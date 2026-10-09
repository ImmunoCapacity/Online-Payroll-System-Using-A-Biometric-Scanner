package com.stibalayan.payroll.biometric;

import java.time.LocalDateTime;

/**
 * One punch read from the scanner. enrollNumber is the device's "User ID",
 * which must match an employee's fingerprint_id.
 */
public record AttendanceLog(String enrollNumber, LocalDateTime timestamp) {
}
