package com.stibalayan.payroll.teaching;

import java.math.BigDecimal;
import java.util.List;

/**
 * One scheduled class with its classroom checks, as the Faculty Teaching
 * Hours screen shows it. Schedule fields come from the Faculty Schedule
 * record (not stored again here).
 *
 * approvalStatus is "Not checked" when no check has been recorded.
 * payableHours is the approved figure; payableIfApproved is what the rules
 * would give for the checks recorded so far.
 */
public record TeachingRow(
        Integer classId,
        String employeeId,
        String employeeNumber,
        String employeeName,
        String employeeType,
        String subject,
        String classSection,
        String room,
        String classDate,
        String scheduledStart,
        String scheduledEnd,
        int gracePeriodMinutes,
        BigDecimal scheduledHours,
        String startCheckAt,
        String startCheckStatus,
        String startCheckedBy,
        String endCheckAt,
        String endCheckStatus,
        String endCheckedBy,
        String remarks,
        String approvalStatus,
        List<String> flags,
        BigDecimal payableIfApproved,
        BigDecimal payableHours,
        String approvedBy,
        String approvedAt,
        String reviewNote) {
}
