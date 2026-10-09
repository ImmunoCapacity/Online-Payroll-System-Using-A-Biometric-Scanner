package com.stibalayan.payroll.dtr;

/**
 * One employee's attendance for a day, as shown in the DTR table. Times are
 * "HH:mm" (or null); status is lowercase: present, late or absent.
 */
public record DtrRow(
        Integer id,
        String employeeId,
        String employeeNumber,
        String employeeName,
        String type,
        String date,
        String timeIn,
        String timeOut,
        String status,
        boolean manual,
        String remarks) {
}
