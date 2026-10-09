package com.stibalayan.payroll.schedule;

/**
 * Body of create/update requests from faculty-schedule.js. Dates are
 * "YYYY-MM-DD", times "HH:mm". repeatWeeklyUntil (create only, optional)
 * adds the same class every week up to and including that date. The grace
 * period is not sent: it is fixed at 15 minutes.
 */
public record ClassRequest(
        String employeeId,
        String subject,
        String classSection,
        String room,
        String classDate,
        String scheduledStart,
        String scheduledEnd,
        String repeatWeeklyUntil) {
}
