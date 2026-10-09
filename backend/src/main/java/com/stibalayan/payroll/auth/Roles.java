package com.stibalayan.payroll.auth;

import java.util.Set;

/**
 * The only three user roles in the system, exactly as stored in users.role,
 * kept in the session and used by the frontend. Employees (faculty and
 * administrative staff) are records, not users, and cannot log in.
 */
public final class Roles {

    public static final String PAYROLL_MASTER = "Payroll Master";
    public static final String PAYROLL_STAFF = "Payroll Staff";
    public static final String SYSTEM_ADMINISTRATOR = "System Administrator";

    public static final Set<String> ALL = Set.of(PAYROLL_MASTER, PAYROLL_STAFF, SYSTEM_ADMINISTRATOR);

    private Roles() {
    }
}
