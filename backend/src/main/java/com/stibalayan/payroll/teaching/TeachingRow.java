package com.stibalayan.payroll.teaching;

import java.math.BigDecimal;
import java.util.List;

/**
 * One scheduled class with its classroom checks, as the Faculty Teaching
 * Hours screen shows it. Schedule fields come from the Faculty Schedule
 * record (not stored again here).
 *
 * approvalStatus is "Not checked", "Incomplete" (one check) or "Complete"
 * (both checks). payableHours is always the live figure the rules give for
 * whatever checks are recorded so far (0 when none, or when checked Absent).
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
        BigDecimal payableHours,
        int lateMinutes) {
}
