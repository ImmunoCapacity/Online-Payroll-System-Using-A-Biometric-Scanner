package com.stibalayan.payroll.employee;

import java.math.BigDecimal;

/**
 * Body of create/update requests from employee-records.js. Fields follow the
 * paper's Data Dictionary (Tables 1 and 2).
 *
 * department is the staff type — "Faculty", "Admin" or "Faculty/Admin" — and
 * is only used on create. rate is the faculty rate per hour/unit or the admin
 * rate per hour. instructorRank, loadUnits and lectureHours apply to faculty;
 * officeDepartment, position and officeHours apply to admin staff. A
 * Faculty/Admin employee has both sets: rate is their office rate per hour and
 * teachingRate their rate per hour/unit for teaching.
 */
public record EmployeeRequest(
        String employeeNumber,
        String firstName,
        String middleName,
        String lastName,
        String department,
        String email,
        String phone,
        String status,
        String dateHired,
        String notes,
        String gender,
        String birthdate,
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
}
