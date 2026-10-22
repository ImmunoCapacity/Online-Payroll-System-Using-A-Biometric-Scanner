package com.stibalayan.payroll.teaching;

/**
 * One classroom check. check is "start" (beginning of class) or "end";
 * time is when the faculty member was verified (HH:mm). The status follows
 * the time (Present, Late or Absent; see TeachingHoursService.statusAt);
 * status may only be "Absent" to override it. reason is required when it
 * replaces a check that was already recorded. remarks is no longer used.
 */
public record CheckRequest(String check, String time, String status, String remarks, String reason) {
}
