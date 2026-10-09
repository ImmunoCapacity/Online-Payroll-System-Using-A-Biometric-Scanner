package com.stibalayan.payroll.teaching;

/**
 * One classroom check. check is "start" (beginning of class) or "end";
 * time is "HH:mm" on the class date — when the classroom was verified;
 * status is "Present" or "Absent". reason is required when it replaces a
 * check that was already recorded.
 */
public record CheckRequest(String check, String time, String status, String remarks, String reason) {
}
