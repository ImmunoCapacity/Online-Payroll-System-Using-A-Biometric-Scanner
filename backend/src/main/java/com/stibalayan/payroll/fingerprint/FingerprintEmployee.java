package com.stibalayan.payroll.fingerprint;

/**
 * An employee as shown on the Fingerprint Registration page. fingerprintId
 * is the K40 "User ID" assigned to them, or null if not registered yet.
 */
public record FingerprintEmployee(
        String id,
        String employeeNumber,
        String displayName,
        String type,
        String status,
        String fingerprintId) {
}
