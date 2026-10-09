package com.stibalayan.payroll.employee;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One employee in the shape the frontend works with. id is prefixed with
 * the table it lives in: "F3" = faculty_staff #3, "A5" = admin_staff #5.
 * department here is the staff type ("Faculty", "Admin" or "Faculty/Admin");
 * an admin employee's office is officeDepartment. For Faculty/Admin, rate is
 * the office rate per hour and teachingRate the rate per hour/unit for teaching.
 */
public record EmployeeResponse(
        String id,
        String employeeNumber,
        String displayName,
        String firstName,
        String middleName,
        String lastName,
        String type,
        String department,
        String email,
        String phone,
        String status,
        String dateHired,
        String notes,
        boolean fingerprintEnrolled,
        String gender,
        String birthdate,
        Integer age,
        String civilStatus,
        Integer dependents,
        String address,
        String employeeType,
        String sssId,
        String philhealthId,
        String pagibigId,
        String tinId,
        BigDecimal rate,
        String instructorRank,
        Integer loadUnits,
        BigDecimal lectureHours,
        String officeDepartment,
        String position,
        BigDecimal officeHours,
        BigDecimal teachingRate) {

    static EmployeeResponse of(FacultyStaff f) {
        return build("F", f, f.getRatePerHourUnit(), f.getInstructorRank(), f.getLoadUnits(),
                f.getLectureHours(), null, null, null, null);
    }

    static EmployeeResponse of(AdminStaff a) {
        if (a.isFaculty()) {
            return build("A", a, a.getRatePerHour(), a.getInstructorRank(), a.getLoadUnits(), a.getLectureHours(),
                    a.getDepartment(), a.getPosition(), a.getOfficeHours(), a.getRatePerHourUnit());
        }
        return build("A", a, a.getRatePerHour(), null, null, null,
                a.getDepartment(), a.getPosition(), a.getOfficeHours(), null);
    }

    private static EmployeeResponse build(String prefix, StaffMember s, BigDecimal rate,
                                          String instructorRank, Integer loadUnits, BigDecimal lectureHours,
                                          String officeDepartment, String position, BigDecimal officeHours,
                                          BigDecimal teachingRate) {
        String type = s.staffType();
        return new EmployeeResponse(
                prefix + s.getId(),
                s.getEmployeeNumber(),
                s.getFullName(),
                s.getFirstname(),
                s.getMiddlename(),
                s.getLastname(),
                type,
                type,
                s.getEmailAddress(),
                s.getContactNumber(),
                s.getEmploymentStatus(),
                text(s.getDateHired()),
                s.getNotes(),
                s.getFingerprintId() != null && !s.getFingerprintId().isEmpty(),
                s.getGender(),
                text(s.getBirthdate()),
                s.getAge(),
                s.getCivilStatus(),
                s.getDependentNumber(),
                s.getAddress(),
                s.getEmployeeType(),
                s.getSssId(),
                s.getPhilhealthId(),
                s.getPagibigId(),
                s.getTinId(),
                rate,
                instructorRank,
                loadUnits,
                lectureHours,
                officeDepartment,
                position,
                officeHours,
                teachingRate);
    }

    private static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }
}
