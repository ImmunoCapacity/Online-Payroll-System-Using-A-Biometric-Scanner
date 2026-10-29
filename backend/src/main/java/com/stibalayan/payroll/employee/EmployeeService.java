package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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
 *
 * Employee IDs are assigned by the server: STIBLN-####-M or STIBLN-####-F,
 * the next number across both tables plus the gender letter. The number never
 * changes; the letter follows the gender if it is corrected.
 */
@Service
public class EmployeeService {

    private static final String FACULTY = "Faculty";
    private static final String ADMIN = AdminStaff.ADMIN;
    private static final String FACULTY_ADMIN = AdminStaff.FACULTY_ADMIN;

    // Paper, Tables 1 and 2: "active, inactive, resigned, terminated, on leave".
    private static final Set<String> STATUSES = Set.of("Active", "Inactive", "On Leave", "Resigned", "Terminated");
    // Only employees who no longer work here can be archived.
    private static final Set<String> ARCHIVABLE = Set.of("Inactive", "Resigned", "Terminated");

    // The choices offered by the form's select boxes.
    private static final Set<String> GENDERS = new LinkedHashSet<>(List.of("Male", "Female"));
    private static final Set<String> CIVIL_STATUSES =
            new LinkedHashSet<>(List.of("Single", "Married", "Widowed", "Divorced", "Separated"));
    private static final Set<String> EMPLOYEE_TYPES =
            new LinkedHashSet<>(List.of("Full-time", "Part-time", "Contractual"));

    // Sanity limits; the columns themselves allow more.
    private static final int MIN_AGE = 18;   // the school does not hire anyone younger than 18
    private static final int MAX_AGE = 100;
    private static final LocalDate EARLIEST_HIRE_DATE = LocalDate.of(1950, 1, 1);
    private static final int MAX_DEPENDENTS = 20;
    private static final int MAX_LOAD_UNITS = 99;
    private static final BigDecimal MAX_RATE = new BigDecimal("100000.00");
    private static final BigDecimal MAX_BASIC_PAY = new BigDecimal("10000000.00");
    private static final BigDecimal MAX_LECTURE_HOURS = new BigDecimal("999.9");   // decimal(4,1)
    private static final BigDecimal MAX_OFFICE_HOURS = new BigDecimal("24.0");     // per day

    private static final String ID_PREFIX = "STIBLN-";
    /** Employee ID: STIBLN-####-M or -F (4 or more digits). */
    private static final java.util.regex.Pattern EMPLOYEE_ID = java.util.regex.Pattern.compile("^STIBLN-\\d{4,}-[MF]$");

    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;
    private final JdbcTemplate jdbc;

    public EmployeeService(FacultyStaffRepository faculty, AdminStaffRepository admins, JdbcTemplate jdbc) {
        this.faculty = faculty;
        this.admins = admins;
        this.jdbc = jdbc;
    }

    /** Every employee; archived ones only when asked for (Employee Records' Archived view). */
    @Transactional(readOnly = true)
    public List<EmployeeResponse> listAll(boolean includeArchived) {
        List<EmployeeResponse> result = new ArrayList<>();
        faculty.findAllByOrderByFirstnameAsc().stream().filter(f -> includeArchived || !f.isArchived())
                .forEach(f -> result.add(EmployeeResponse.of(f)));
        admins.findAllByOrderByFirstnameAsc().stream().filter(a -> includeArchived || !a.isArchived())
                .forEach(a -> result.add(EmployeeResponse.of(a)));
        return result;
    }

    /** synchronized: two employees added at the same moment never get the same number. */
    @Transactional
    public synchronized String create(EmployeeRequest request) {
        String department = request.department() == null ? "" : request.department();
        if (!department.equals(FACULTY) && !department.equals(ADMIN) && !department.equals(FACULTY_ADMIN)) {
            throw Validation.invalid("department", "Choose a staff type: Faculty, Admin or Faculty/Admin.");
        }
        validate(request);
        checkRank(request.instructorRank());
        // Email must be unique across BOTH tables; the database can only
        // enforce uniqueness within one table at a time.
        checkUnique(request, null);
        // The ID entered in the form, or the next STIBLN-####-M/F when left blank.
        String employeeNumber = employeeNumber(request, null);
        if (employeeNumber == null) {
            employeeNumber = ID_PREFIX + nextSequence() + "-" + genderLetter(request.gender());
        }

        if (department.equals(FACULTY)) {
            FacultyStaff staff = new FacultyStaff();
            apply(staff, request);
            staff.setEmployeeNumber(employeeNumber);
            return "F" + saveOrExplain(() -> faculty.saveAndFlush(staff)).getId();
        }
        AdminStaff staff = new AdminStaff();
        staff.setFaculty(department.equals(FACULTY_ADMIN));
        apply(staff, request);
        staff.setEmployeeNumber(employeeNumber);
        return "A" + saveOrExplain(() -> admins.saveAndFlush(staff)).getId();
    }

    @Transactional
    public void update(String id, EmployeeRequest request) {
        EmployeeId eid = EmployeeId.parse(id);
        requireNotArchived(find(id));
        validate(request);
        checkRank(request.instructorRank());
        checkUnique(request, eid);
        // A changed ID is used as entered; otherwise the letter follows a corrected gender.
        String entered = employeeNumber(request, eid);

        if (eid.isFaculty()) {
            FacultyStaff staff = faculty.findById(eid.number()).orElseThrow(EmployeeService::notFound);
            apply(staff, request);
            staff.setEmployeeNumber(entered != null ? entered : withGender(staff.getEmployeeNumber(), request.gender()));
            saveOrExplain(() -> faculty.saveAndFlush(staff));
        } else {
            AdminStaff staff = admins.findById(eid.number()).orElseThrow(EmployeeService::notFound);
            apply(staff, request);
            staff.setEmployeeNumber(entered != null ? entered : withGender(staff.getEmployeeNumber(), request.gender()));
            saveOrExplain(() -> admins.saveAndFlush(staff));
        }
    }

    /**
     * Archives an employee. Employees are never deleted: their payroll, DTR,
     * leave, loan and schedule history stays; they are only hidden from
     * lists and pickers. Only employees who no longer work here (Inactive,
     * Resigned or Terminated) can be archived; reason, when given, sets that
     * status first (Employee Records asks for it). Returns the employee's name.
     */
    @Transactional
    public String archive(String id, String reason) {
        StaffMember staff = find(id);
        if (staff.isArchived()) {
            throw unprocessable(staff.getFullName() + " is already archived.");
        }
        if (reason != null && !reason.isBlank()) {
            if (!ARCHIVABLE.contains(reason.trim())) {
                throw Validation.invalid("reason", "Choose why: Resigned, Terminated or Inactive.");
            }
            staff.setEmploymentStatus(reason.trim());
        }
        if (!ARCHIVABLE.contains(staff.getEmploymentStatus())) {
            throw Validation.invalid("employmentStatus", "Only employees who are Inactive, Resigned or Terminated can be archived. "
                    + "Change " + staff.getFullName() + "'s employment status first.");
        }
        staff.setArchived(true);
        staff.setArchivedAt(LocalDateTime.now());
        save(staff);
        return staff.getFullName();
    }

    /** Brings an archived employee back to the lists, as Active again. Returns the employee's name. */
    @Transactional
    public String restore(String id) {
        StaffMember staff = find(id);
        if (!staff.isArchived()) {
            throw unprocessable(staff.getFullName() + " is not archived.");
        }
        staff.setEmploymentStatus("Active");
        staff.setArchived(false);
        staff.setArchivedAt(null);
        save(staff);
        return staff.getFullName();
    }

    private StaffMember find(String id) {
        EmployeeId eid = EmployeeId.parse(id);
        return eid.isFaculty()
                ? faculty.findById(eid.number()).orElseThrow(EmployeeService::notFound)
                : admins.findById(eid.number()).orElseThrow(EmployeeService::notFound);
    }

    private void save(StaffMember staff) {
        if (staff instanceof FacultyStaff f) {
            faculty.saveAndFlush(f);
        } else {
            admins.saveAndFlush((AdminStaff) staff);
        }
    }

    private static void requireNotArchived(StaffMember staff) {
        if (staff.isArchived()) {
            throw unprocessable(staff.getFullName() + " is archived. Restore the employee before editing.");
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
        if (r.gender() == null || r.gender().isBlank()) {
            throw Validation.invalid("gender", "Gender is required (it sets the M/F at the end of the Employee ID).");
        }
        oneOf(r.gender(), GENDERS, "gender", "Gender");

        LocalDate today = LocalDate.now();
        LocalDate birthdate = Validation.date(r.birthdate(), "birthdate", "Birthdate", true);
        if (birthdate.isAfter(today)) {
            throw Validation.invalid("birthdate", "Birthdate can't be in the future.");
        }
        if (birthdate.isAfter(today.minusYears(MIN_AGE))) {
            throw Validation.invalid("birthdate", "The employee must be at least " + MIN_AGE + " years old.");
        }
        if (birthdate.isBefore(today.minusYears(MAX_AGE))) {
            throw Validation.invalid("birthdate", "Birthdate must make the employee at most " + MAX_AGE + " years old.");
        }
        oneOf(r.civilStatus(), CIVIL_STATUSES, "civilStatus", "Civil status");
        Validation.wholeNumber(r.dependents(), "dependents", "Number of dependents", MAX_DEPENDENTS);
        Validation.optionalText(r.address(), "address", "Address", 255);
        Validation.email(r.email(), "email", "Email");
        Validation.phone(r.phone(), "phone", "Contact number");

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
        if (r.employeeType() == null || r.employeeType().isBlank()) {
            throw Validation.invalid("employeeType", "Employee type is required.");
        }
        oneOf(r.employeeType(), EMPLOYEE_TYPES, "employeeType", "Employee type");

        // Which of the Faculty/Admin section's fields apply (and so are
        // required) follows the same rule as which ones the form shows.
        String department = r.department() == null ? "" : r.department();
        boolean faculty = department.equals(FACULTY) || department.equals(FACULTY_ADMIN);
        boolean admin = department.equals(ADMIN) || department.equals(FACULTY_ADMIN);

        if (faculty && (r.instructorRank() == null || r.instructorRank().isBlank())) {
            throw Validation.invalid("instructorRank", "Instructor rank is required.");
        }
        Validation.optionalText(r.instructorRank(), "instructorRank", "Instructor rank", 20);

        // rate is the one rate field every department always shows (Faculty's
        // Rate per Hour/Unit, or Admin/Faculty-Admin's Rate per Hour).
        if (r.rate() == null) {
            throw Validation.invalid("rate", "Rate is required.");
        }
        Validation.money(r.rate(), "rate", "Rate", MAX_RATE);

        // teachingRate only exists as its own field for Faculty/Admin.
        if (department.equals(FACULTY_ADMIN) && r.teachingRate() == null) {
            throw Validation.invalid("teachingRate", "Teaching rate is required.");
        }
        Validation.money(r.teachingRate(), "teachingRate", "Teaching rate", MAX_RATE);

        // Faculty have no basic pay (see apply()); Admin and Faculty/Admin must enter one.
        if (admin && r.basicPay() == null) {
            throw Validation.invalid("basicPay", "Basic pay is required.");
        }
        Validation.money(r.basicPay(), "basicPay", "Basic pay", MAX_BASIC_PAY);

        if (faculty && r.loadUnits() == null) {
            throw Validation.invalid("loadUnits", "Load units is required.");
        }
        Validation.wholeNumber(r.loadUnits(), "loadUnits", "Load units", MAX_LOAD_UNITS);

        if (faculty && r.lectureHours() == null) {
            throw Validation.invalid("lectureHours", "Lecture hours is required.");
        }
        Validation.decimal(r.lectureHours(), "lectureHours", "Lecture hours", 1, MAX_LECTURE_HOURS);

        if (admin && (r.officeDepartment() == null || r.officeDepartment().isBlank())) {
            throw Validation.invalid("officeDepartment", "Department is required.");
        }
        Validation.optionalText(r.officeDepartment(), "officeDepartment", "Department", 50);

        if (admin && (r.position() == null || r.position().isBlank())) {
            throw Validation.invalid("position", "Position is required.");
        }
        Validation.optionalText(r.position(), "position", "Position", 50);

        if (admin && r.officeHours() == null) {
            throw Validation.invalid("officeHours", "Office hours is required.");
        }
        Validation.decimal(r.officeHours(), "officeHours", "Office hours", 1, MAX_OFFICE_HOURS);

        if (r.sssId() == null || r.sssId().isBlank()) {
            throw Validation.invalid("sssId", "SSS No. is required.");
        }
        Validation.governmentId(r.sssId(), "sssId", "SSS No.", 10);

        if (r.philhealthId() == null || r.philhealthId().isBlank()) {
            throw Validation.invalid("philhealthId", "PhilHealth No. is required.");
        }
        Validation.governmentId(r.philhealthId(), "philhealthId", "PhilHealth No.", 12);

        if (r.pagibigId() == null || r.pagibigId().isBlank()) {
            throw Validation.invalid("pagibigId", "Pag-IBIG No. is required.");
        }
        Validation.governmentId(r.pagibigId(), "pagibigId", "Pag-IBIG No.", 12);

        if (r.tinId() == null || r.tinId().isBlank()) {
            throw Validation.invalid("tinId", "TIN is required.");
        }
        Validation.governmentId(r.tinId(), "tinId", "TIN", 9, 12, 14);

        Validation.optionalText(r.notes(), "notes", "Notes", 1000);
    }

    /** An optional choice from a fixed list (the form's select options). */
    private static void oneOf(String value, Set<String> allowed, String field, String label) {
        if (value != null && !value.isBlank() && !allowed.contains(value.trim())) {
            throw Validation.invalid(field, label + " must be one of: " + String.join(", ", allowed) + ".");
        }
    }

    /**
     * The next Employee ID number, zero-padded to 4 digits: one more than the
     * highest STIBLN number in either staff table (archived employees included,
     * so a number is never reused).
     */
    private String nextSequence() {
        Integer max = jdbc.queryForObject(
                "SELECT MAX(CAST(SUBSTRING(employee_number, 8, LENGTH(employee_number) - 9) AS UNSIGNED)) FROM ("
                + " SELECT employee_number FROM faculty_staff UNION ALL SELECT employee_number FROM admin_staff) t"
                + " WHERE employee_number REGEXP '^STIBLN-[0-9]+-[MF]$'", Integer.class);
        return String.format("%04d", (max == null ? 0 : max) + 1);
    }

    /** The Employee ID (STIBLN-####-M/F) of an employee, e.g. right after it was created. */
    @Transactional(readOnly = true)
    public String employeeNumberOf(String id) {
        return find(id).getEmployeeNumber();
    }

    /** The ID the next new employee would get, without the M/F letter (e.g. "STIBLN-0015"). */
    @Transactional(readOnly = true)
    public String previewNextId() {
        return ID_PREFIX + nextSequence();
    }

    private static String genderLetter(String gender) {
        return "Female".equals(gender == null ? null : gender.trim()) ? "F" : "M";
    }

    /** Same number, letter for the (possibly corrected) gender: STIBLN-0007-M -> STIBLN-0007-F. */
    private static String withGender(String employeeNumber, String gender) {
        if (employeeNumber == null || !employeeNumber.matches("^STIBLN-\\d+-[MF]$")) {
            return employeeNumber;
        }
        return employeeNumber.substring(0, employeeNumber.length() - 1) + genderLetter(gender);
    }

    /**
     * The Employee ID entered in the form, upper-cased, or null when left blank.
     * Format STIBLN-####-M/F (EMPLOYEE_ID: 4 or more digits, at most 20
     * characters since the payroll table keeps it too), the letter matching
     * the gender, and not used by any other employee, archived ones included.
     */
    private String employeeNumber(EmployeeRequest r, EmployeeId current) {
        String id = r.employeeNumber() == null ? "" : r.employeeNumber().trim().toUpperCase();
        if (id.isEmpty()) {
            return null;
        }
        if (id.length() > 20 || !EMPLOYEE_ID.matcher(id).matches()) {
            throw Validation.invalid("employeeNumber",
                    "Employee ID must look like STIBLN-0037-M: STIBLN, a dash, at least 4 digits, a dash, then M or F.");
        }
        if (!id.endsWith("-" + genderLetter(r.gender()))) {
            throw Validation.invalid("employeeNumber", "The last letter of the Employee ID must be " + genderLetter(r.gender())
                    + " (" + r.gender() + ").");
        }
        boolean taken;
        if (current == null) {
            taken = faculty.existsByEmployeeNumber(id) || admins.existsByEmployeeNumber(id);
        } else if (current.isFaculty()) {
            taken = faculty.existsByEmployeeNumberAndIdNot(id, current.number()) || admins.existsByEmployeeNumber(id);
        } else {
            taken = admins.existsByEmployeeNumberAndIdNot(id, current.number()) || faculty.existsByEmployeeNumber(id);
        }
        if (taken) {
            throw Validation.invalid("employeeNumber", "This Employee ID is already used by another employee.");
        }
        return id;
    }

    /** An Instructor Rank must be one of the ranks in Maintenance (table employee_rank). */
    private void checkRank(String rank) {
        if (rank == null || rank.isBlank()) {
            return;
        }
        Integer known = jdbc.queryForObject("SELECT COUNT(*) FROM employee_rank WHERE rank_name = ?", Integer.class, rank.trim());
        if (known == null || known == 0) {
            throw Validation.invalid("instructorRank", "Choose an instructor rank from the list (add new ranks in Maintenance).");
        }
    }

    /** Email must be unique across both staff tables. */
    private void checkUnique(EmployeeRequest r, EmployeeId current) {
        String email = trim(r.email());
        boolean emailTaken;
        if (current == null) {
            emailTaken = faculty.existsByEmailAddressIgnoreCase(email) || admins.existsByEmailAddressIgnoreCase(email);
        } else if (current.isFaculty()) {
            emailTaken = faculty.existsByEmailAddressIgnoreCaseAndIdNot(email, current.number())
                    || admins.existsByEmailAddressIgnoreCase(email);
        } else {
            emailTaken = admins.existsByEmailAddressIgnoreCaseAndIdNot(email, current.number())
                    || faculty.existsByEmailAddressIgnoreCase(email);
        }
        if (emailTaken) {
            throw Validation.invalid("email", "This email address is already used by another employee.");
        }
    }

    /** Copies a validated request onto the entity. */
    private static void apply(StaffMember staff, EmployeeRequest r) {
        staff.setFirstname(trim(r.firstName()));
        staff.setMiddlename(blankToNull(r.middleName()));
        staff.setLastname(trim(r.lastName()));
        staff.setEmailAddress(trim(r.email()));
        staff.setContactNumber(trim(r.phone()));
        staff.setEmploymentStatus(r.status() == null || r.status().isBlank() ? "Active" : r.status());
        staff.setDateHired(parseDate(r.dateHired(), "Date hired"));
        // Notes are no longer on the form; keep any saved ones unless notes are sent.
        if (r.notes() != null) {
            staff.setNotes(trim(r.notes()));
        }
        // Faculty have no basic pay (Admin and Faculty/Admin do).
        staff.setBasicPay(staff instanceof FacultyStaff ? null : r.basicPay());

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
