package com.stibalayan.payroll.schedule;

import java.util.List;

/**
 * One planned class as the screens show it. overlapsWith lists the ids of
 * the same teacher's other scheduled classes that overlap it (flagged for
 * review). attendanceStatus is the Faculty Teaching Hours approval status,
 * or null when no classroom check has been recorded yet.
 */
public record ClassView(
        Integer id,
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
        String scheduleStatus,
        String statusReason,
        List<Integer> overlapsWith,
        String attendanceStatus,
        String createdBy,
        String updatedBy,
        String updatedAt) {
}
