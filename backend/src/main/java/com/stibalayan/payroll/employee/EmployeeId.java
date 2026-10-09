package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.common.ApiException;
import org.springframework.http.HttpStatus;

/**
 * The id the frontend uses for an employee: the table prefix plus the row id.
 * "F3" = faculty_staff #3, "A5" = admin_staff #5.
 */
public record EmployeeId(char table, int number) {

    public static EmployeeId parse(String id) {
        if (id == null || id.length() < 2 || (id.charAt(0) != 'F' && id.charAt(0) != 'A')) {
            throw invalid();
        }
        try {
            return new EmployeeId(id.charAt(0), Integer.parseInt(id.substring(1)));
        } catch (NumberFormatException e) {
            throw invalid();
        }
    }

    public static String faculty(int id) {
        return "F" + id;
    }

    public static String admin(int id) {
        return "A" + id;
    }

    public boolean isFaculty() {
        return table == 'F';
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid employee id.");
    }
}
