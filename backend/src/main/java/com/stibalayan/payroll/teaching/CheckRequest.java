package com.stibalayan.payroll.teaching;

/**
 * One classroom check. check is "start" (beginning of class) or "end";
 * status is "Present", "Late" (beginning only) or "Absent" — chosen directly
 * by whoever records it. The verification time is set automatically (the
 * moment it's recorded, or the class's own scheduled time when recording a
 * check missed from an earlier day) and is never shown or sent by the
 * client. remarks is freeform notes on the record (not tied to start or end
 * specifically); required when it changes the status of a check that was
 * already recorded, otherwise optional — sent null to leave it unchanged.
 */
public record CheckRequest(String check, String status, String remarks) {
}
