package com.stibalayan.payroll.teaching;

/**
 * One classroom check. check is "start" (beginning of class) or "end";
 * status is "Present", "Late" (beginning only) or "Absent" — chosen directly
 * by whoever records it. The verification time is set automatically (the
 * moment it's recorded, or the class's own scheduled time when recording a
 * check missed from an earlier day) and is never shown or sent by the
 * client — payable hours are always measured from the class's scheduled
 * start/end, never from when the check happens to be recorded.
 *
 * lateMinutes is required (> 0) when the start check is Late: how many
 * minutes after the scheduled start the faculty member arrived, deducted
 * from the payable hours. earlyLeaveMinutes is required (> 0) when the end
 * check is Absent: how many minutes before the scheduled end they left,
 * also deducted. Both are ignored for any other status.
 *
 * remarks is freeform notes on the record (not tied to start or end
 * specifically); required when it changes the status of a check that was
 * already recorded, otherwise optional — sent null to leave it unchanged.
 */
public record CheckRequest(String check, String status, Integer lateMinutes, Integer earlyLeaveMinutes, String remarks) {
}
