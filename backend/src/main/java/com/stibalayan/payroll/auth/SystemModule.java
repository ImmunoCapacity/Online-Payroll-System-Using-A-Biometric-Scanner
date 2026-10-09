package com.stibalayan.payroll.auth;

import java.util.Set;

/**
 * Role-based access control: the system's modules and the roles allowed to
 * use each one. This is the single source of truth on the backend — every
 * protected endpoint names the module it belongs to with {@link RequireModule}.
 *
 * Keep in step with js/auth-guard.js and the menus in js/payrollpro-layout.js.
 */
public enum SystemModule {

    DASHBOARD(Roles.PAYROLL_MASTER, Roles.PAYROLL_STAFF),
    FINGERPRINT_REGISTRATION(Roles.PAYROLL_MASTER, Roles.PAYROLL_STAFF),
    DAILY_TIME_RECORD(Roles.PAYROLL_MASTER, Roles.PAYROLL_STAFF),
    ATTENDANCE_RECORDING(Roles.PAYROLL_MASTER, Roles.PAYROLL_STAFF),
    /** Viewing planned faculty classes (part of the Daily Time Record). */
    FACULTY_SCHEDULE(Roles.PAYROLL_MASTER, Roles.PAYROLL_STAFF),
    /** Creating, editing and cancelling faculty classes. */
    FACULTY_SCHEDULE_MANAGEMENT(Roles.PAYROLL_MASTER),
    /** Entering the beginning and ending classroom checks. */
    FACULTY_TEACHING_HOURS(Roles.PAYROLL_MASTER, Roles.PAYROLL_STAFF),
    /** Approving or rejecting checked classes — kept apart from entering them. */
    FACULTY_TEACHING_APPROVAL(Roles.PAYROLL_MASTER),
    MAINTENANCE(Roles.PAYROLL_MASTER),
    DEDUCTION_TABLES(Roles.PAYROLL_MASTER),
    PAYROLL(Roles.PAYROLL_MASTER),
    REPORTS(Roles.PAYROLL_MASTER),
    EMPLOYEE_RECORD_MANAGEMENT(Roles.PAYROLL_MASTER),
    /** User accounts, archive, audit trail, backup and restore, device configuration. */
    UTILITY(Roles.SYSTEM_ADMINISTRATOR);

    private final Set<String> roles;

    SystemModule(String... roles) {
        this.roles = Set.of(roles);
    }

    public boolean allows(String role) {
        return roles.contains(role);
    }
}
