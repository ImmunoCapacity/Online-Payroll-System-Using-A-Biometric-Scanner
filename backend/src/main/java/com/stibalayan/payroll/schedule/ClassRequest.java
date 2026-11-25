package com.stibalayan.payroll.schedule;

/**
 * Body of create/update requests from faculty-schedule.js. A class is a
 * weekly day-of-week pattern (dayOfWeek, "MONDAY".."SATURDAY") repeated on
 * the same day, same time, from validFrom through validUntil ("YYYY-MM-DD");
 * times are "HH:mm". Editing applies to the whole series identified by the
 * class id in the URL, not just one occurrence. The grace period is not
 * sent: it is fixed by Maintenance → Grace Period.
 */
public record ClassRequest(
        String employeeId,
        String subject,
        String classSection,
        String room,
        String dayOfWeek,
        String scheduledStart,
        String scheduledEnd,
        String validFrom,
        String validUntil) {
}
