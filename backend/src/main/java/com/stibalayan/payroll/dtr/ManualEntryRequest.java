package com.stibalayan.payroll.dtr;

/**
 * Attendance Recording (paper, module 4.0): a manual time entry for when the
 * scanner couldn't record someone. date "YYYY-MM-DD"; times "HH:mm".
 * No status: it is decided from time-in (present or late).
 */
public record ManualEntryRequest(
        String employeeId,
        String date,
        String timeIn,
        String timeOut,
        String reason) {
}
