package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Employee Records Management (paper, module 9.1) over the two staff tables,
 * with the fields of the paper's Data Dictionary (Tables 1 and 2).
 *
 * Faculty/Admin employees (admin staff who also teach) live in admin_staff
 * with is_faculty set.
 *
 * NOTE: the staff type cannot be changed on update — the id prefix (F/A)
 * fixes which table an employee lives in. Moving someone between Faculty and
 * Admin would mean migrating their row and its DTR/payroll history.
 */
@Service
public class EmployeeService {

    private static final String FACULTY = "Faculty";
    private static final String ADMIN = AdminStaff.ADMIN;
    private static final String FACULTY_ADMIN = AdminStaff.FACULTY_ADMIN;

    // Paper, Tables 1 and 2: "active, inactive, resigned, terminated, on leave".
    private static final Set<String> STATUSES = Set.of("Active", "Inactive", "On Leave", "Resigned", "Terminated");

    // The choices offered by the form's select boxes.
    private static final Set<String> GENDERS = new LinkedHashSet<>(List.of("Male", "Female"));
    private static final Set<String> CIVIL_STATUSES =
            new LinkedHashSet<>(List.of("Single", "Married", "Widowed", "Divorced", "Separated"));
    private static final Set<String> EMPLOYEE_TYPES =
            new LinkedHashSet<>(List.of("Full-time", "Part-time", "Contractual", "Temporary"));

    // Sanity limits; the columns themselves allow more.
    private static final int MIN_AGE = 15;   // Labor Code minimum working age
    private static final int MAX_AGE = 100;
    private static final LocalDate EARLIEST_HIRE_DATE = LocalDate.of(1950, 1, 1);
    private static final int MAX_DEPENDENTS = 20;
    private static final int MAX_LOAD_UNITS = 99;
    private static final BigDecimal MAX_RATE = new BigDecimal("100000.00");
    private static final BigDecimal MAX_LECTURE_HOURS = new BigDecimal("999.9");   // decimal(4,1)
    private static final BigDecimal MAX_OFFICE_HOURS = new BigDecimal("24.0");     // per day

    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;

    public EmployeeService(FacultyStaffRepository faculty, AdminStaffRepository admins) {
        this.faculty = faculty;
        this.admins = admins;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> listAll() {
        List<EmployeeResponse> result = new ArrayList<>();
        faculty.findAllByOrderByFirstnameAsc().forEach(f -> result.add(EmployeeResponse.of(f)));
        admins.findAllByOrderByFirstnameAsc().forEach(a -> result.add(EmployeeResponse.of(a)));
        return result;
    }

    @Transactional
    public String create(EmployeeRequest request) {
        String department = request.department() == null ? "" : request.department();
        if (!department.equals(FACULTY) && !department.equals(ADMIN) && !department.equals(FACULTY_ADMIN)) {
            throw Validation.invalid("department", "Choose a staff type: Faculty, Admin or Faculty/Admin.");
        }
        validate(request);
        // employee_number and email must be unique across BOTH tables; the
        // database can only enforce uniqueness within one table at a time.
        checkUnique(request, null);

        if (department.equals(FACULTY)) {
            FacultyStaff staff = new FacultyStaff();
            apply(staff, request);
            return "F" + saveOrExplain(() -> faculty.saveAndFlush(staff)).getId();
        }
        AdminStaff staff = new AdminStaff();
        staff.setFaculty(department.equals(FACULTY_ADMIN));
        apply(staff, request);
        return "A" + saveOrExplain(() -> admins.saveAndFlush(staff)).getId();
    }

    @Transactional
    public void update(String id, EmployeeRequest request) {
        EmployeeId eid = EmployeeId.parse(id);
        validate(request);
        checkUnique(request, eid);

        if (eid.isFaculty()) {
            FacultyStaff staff = faculty.findById(eid.number()).orElseThrow(EmployeeService::notFound);
            apply(staff, request);
            saveOrExplain(() -> faculty.saveAndFlush(staff));
        } else {
            AdminStaff staff = admins.findById(eid.number()).orElseThrow(EmployeeService::notFound);
            apply(staff, request);
            saveOrExplain(() -> admins.saveAndFlush(staff));
        }
    }

    @Transactional
    public void delete(String id) {
        EmployeeId eid = EmployeeId.parse(id);
        if (eid.isFaculty()) {
            faculty.delete(faculty.findById(eid.number()).orElseThrow(EmployeeService::notFound));
        } else {
            admins.delete(admins.findById(eid.number()).orElseThrow(EmployeeService::notFound));
        }
    }

    /**
     * Field-by-field checks, in the order the form shows them; the error names
     * the field so the page can show it beside the input. The same rules run
     * in the browser (js/form-validation.js).
     */
    private static void validate(EmployeeRequest r) {
        Validation.name(r.firstName(), "firstName", "First name", true);
        Validation.name(r.middleName(), "middleName", "Middle name", false);
        Validation.name(r.lastName(), "lastName", "Last name", true);
        oneOf(r.gender(), GENDERS, "gender", "Gender");

        LocalDate today = LocalDate.now();
        LocalDate birthdate = Validation.date(r.birthdate(), "birthdate", "Birthdate", false);
        if (birthdate != null) {
            if (birthdate.isAfter(today)) {
                throw Validation.invalid("birthdate", "Birthdate can't be in the future.");
            }
            if (birthdate.isAfter(today.minusYears(MIN_AGE)) || birthdate.isBefore(today.minusYears(MAX_AGE))) {
                throw Validation.invalid("birthdate", "Birthdate must make the employee " + MIN_AGE + " to " + MAX_AGE + " years old.");
            }
        }
        oneOf(r.civilStatus(), CIVIL_STATUSES, "civilStatus", "Civil status");
        Validation.wholeNumber(r.dependents(), "dependents", "Number of dependents", MAX_DEPENDENTS);
        Validation.optionalText(r.address(), "address", "Address", 255);
        Validation.email(r.email(), "email", "Email");
        Validation.phone(r.phone(), "phone", "Contact number");

        Validation.employeeNumber(r.employeeNumber(), "employeeNumber");
        LocalDate dateHired = Validation.date(r.dateHired(), "dateHired", "Date hired", true);
        if (dateHired.isAfter(today)) {
            throw Validation.invalid("dateHired", "Date hired can't be in the future.");
        }
        if (dateHired.isBefore(EARLIEST_HIRE_DATE)) {
            throw Validation.invalid("dateHired", "Date hired can't be before " + EARLIEST_HIRE_DATE.getYear() + ".");
        }
        if (birthdate != null && dateHired.isBefore(birthdate.plusYears(MIN_AGE))) {
            throw Validation.invalid("dateHired", "Date hired must be at least " + MIN_AGE + " years after the birthdate.");
        }
        if (r.status() != null && !r.status().isBlank() && !STATUSES.contains(r.status())) {
            throw Validation.invalid("status", "Employment status must be Active, Inactive, On Leave, Resigned, or Terminated.");
        }
        oneOf(r.employeeType(), EMPLOYEE_TYPES, "employeeType", "Employee type");

        Validation.optionalText(r.instructorRank(), "instructorRank", "Instructor rank", 20);
        Validation.money(r.rate(), "rate", "Rate", MAX_RATE);
        Validation.money(r.teachingRate(), "teachingRate", "Teaching rate", MAX_RATE);
        Validation.wholeNumber(r.loadUnits(), "loadUnits", "Load units", MAX_LOAD_UNITS);
        Validation.decimal(r.lectureHours(), "lectureHours", "Lecture hours", 1, MAX_LECTURE_HOURS);
        Validation.optionalText(r.officeDepartment(), "officeDepartment", "Department", 50);
        Validation.optionalText(r.position(), "position", "Position", 50);
        Validation.decimal(r.officeHours(), "officeHours", "Office hours", 1, MAX_OFFICE_HOURS);

        Validation.governmentId(r.sssId(), "sssId", "SSS No.", 10);
        Validation.governmentId(r.philhealthId(), "philhealthId", "PhilHealth No.", 12);
        Validation.governmentId(r.pagibigId(), "pagibigId", "Pag-IBIG No.", 12);
        Validation.governmentId(r.tinId(), "tinId", "TIN", 9, 12, 14);
        Validation.optionalText(r.notes(), "notes", "Notes", 1000);
    }

    /** An optional choice from a fixed list (the form's select options). */
    private static void oneOf(String value, Set<String> allowed, String field, String label) {
        if (value != null && !value.isBlank() && !allowed.contains(value.trim())) {
            throw Validation.invalid(field, label + " must be one of: " + String.join(", ", allowed) + ".");
        }
    }

    /** Employee number and email must be unique across both staff tables. */
    private void checkUnique(EmployeeRequest r, EmployeeId current) {
        String employeeNumber = trim(r.employeeNumber());
        String email = trim(r.email());
        boolean numberTaken;
        boolean emailTaken;
        if (current == null) {
            numberTaken = faculty.existsByEmployeeNumber(employeeNumber) || admins.existsByEmployeeNumber(employeeNumber);
            emailTaken = faculty.existsByEmailAddressIgnoreCase(email) || admins.existsByEmailAddressIgnoreCase(email);
        } else if (current.isFaculty()) {
            numberTaken = faculty.existsByEmployeeNumberAndIdNot(employeeNumber, current.number())
                    || admins.existsByEmployeeNumber(employeeNumber);
            emailTaken = faculty.existsByEmailAddressIgnoreCaseAndIdNot(email, current.number())
                    || admins.existsByEmailAddressIgnoreCase(email);
        } else {
            numberTaken = admins.existsByEmployeeNumberAndIdNot(employeeNumber, current.number())
                    || faculty.existsByEmployeeNumber(employeeNumber);
            emailTaken = admins.existsByEmailAddressIgnoreCaseAndIdNot(email, current.number())
                    || faculty.existsByEmailAddressIgnoreCase(email);
        }
        if (numberTaken) {
            throw Validation.invalid("employeeNumber", "This Employee ID is already in use.");
        }
        if (emailTaken) {
            throw Validation.invalid("email", "This email address is already used by another employee.");
        }
    }

    /** Copies a validated request onto the entity. */
    private static void apply(StaffMember staff, EmployeeRequest r) {
        staff.setEmployeeNumber(trim(r.employeeNumber()));
        staff.setFirstname(trim(r.firstName()));
        staff.setMiddlename(blankToNull(r.middleName()));
        staff.setLastname(trim(r.lastName()));
        staff.setEmailAddress(trim(r.email()));
        staff.setContactNumber(trim(r.phone()));
        staff.setEmploymentStatus(r.status() == null || r.status().isBlank() ? "Active" : r.status());
        staff.setDateHired(parseDate(r.dateHired(), "Date hired"));
        staff.setNotes(trim(r.notes()));

        staff.setGender(blankToNull(r.gender()));
        LocalDate birthdate = blankToNull(r.birthdate()) == null ? null : parseDate(r.birthdate(), "Birthdate");
        if (birthdate != null && birthdate.isAfter(LocalDate.now())) {
            throw unprocessable("Birthdate can't be in the future.");
        }
        staff.setBirthdate(birthdate);
        staff.setAge(birthdate == null ? null : Period.between(birthdate, LocalDate.now()).getYears());
        staff.setCivilStatus(blankToNull(r.civilStatus()));
        staff.setDependentNumber(r.dependents());
        staff.setAddress(blankToNull(r.address()));
        staff.setEmployeeType(blankToNull(r.employeeType()));
        staff.setSssId(blankToNull(r.sssId()));
        staff.setPhilhealthId(blankToNull(r.philhealthId()));
        staff.setPagibigId(blankToNull(r.pagibigId()));
        staff.setTinId(blankToNull(r.tinId()));

        if (staff instanceof FacultyStaff f) {
            f.setRatePerHourUnit(r.rate());
            f.setInstructorRank(blankToNull(r.instructorRank()));
            f.setLoadUnits(r.loadUnits());
            f.setLectureHours(r.lectureHours());
        } else if (staff instanceof AdminStaff a) {
            a.setRatePerHour(r.rate());
            a.setDepartment(blankToNull(r.officeDepartment()));
            a.setPosition(blankToNull(r.position()));
            a.setOfficeHours(r.officeHours());
            // Faculty/Admin also teach, so they keep the faculty fields too.
            a.setRatePerHourUnit(a.isFaculty() ? r.teachingRate() : null);
            a.setInstructorRank(a.isFaculty() ? blankToNull(r.instructorRank()) : null);
            a.setLoadUnits(a.isFaculty() ? r.loadUnits() : null);
            a.setLectureHours(a.isFaculty() ? r.lectureHours() : null);
        }
    }

    private static LocalDate parseDate(String value, String label) {
        try {
            return LocalDate.parse(trim(value));
        } catch (DateTimeParseException e) {
            throw unprocessable(label + " must be a valid date (YYYY-MM-DD).");
        }
    }

    private static <T> T saveOrExplain(Supplier<T> save) {
        try {
            return save.get();
        } catch (DataIntegrityViolationException e) {
            // Most likely the email_address UNIQUE constraint.
            throw unprocessable("Could not save employee — the email address may already be in use.");
        }
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Employee not found.");
    }
}
