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

    DASHBOARD(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF),
    /** Attendance Monitoring Staff only — day-to-day attendance work, not Payroll Master's job. */
    FINGERPRINT_REGISTRATION(Roles.ATTENDANCE_MONITORING_STAFF),
    DAILY_TIME_RECORD(Roles.ATTENDANCE_MONITORING_STAFF),
    /** Present/late/absent/on-leave per employee — Attendance Monitoring Staff's own DTR, and Payroll Master's Attendance Report. */
    ATTENDANCE_SUMMARY(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF),
    ATTENDANCE_RECORDING(Roles.ATTENDANCE_MONITORING_STAFF),
    /** Viewing planned faculty classes (part of the Daily Time Record). */
    FACULTY_SCHEDULE(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF),
    /** Creating, editing and cancelling faculty classes. */
    FACULTY_SCHEDULE_MANAGEMENT(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF),
    /** "Archive All Schedules" — Attendance Monitoring Staff only, since they keep the schedule up to date. */
    FACULTY_SCHEDULE_ARCHIVE(Roles.ATTENDANCE_MONITORING_STAFF),
    /** Reading archived classes (System Administrator's Archive page, and Attendance Monitoring Staff's own). */
    FACULTY_SCHEDULE_ARCHIVE_READ(Roles.SYSTEM_ADMINISTRATOR, Roles.ATTENDANCE_MONITORING_STAFF),
    /** Permanently deleting a class — Attendance Monitoring Staff only, since they keep the schedule up to date. */
    FACULTY_SCHEDULE_DELETE(Roles.ATTENDANCE_MONITORING_STAFF),
    /** Entering the beginning and ending classroom checks. */
    FACULTY_TEACHING_HOURS(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF),
    /** Room Maintenance (Daily Time Record menu) — the rooms offered as a class's Room in Faculty Schedule. */
    ROOM_MANAGEMENT(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF),
    MAINTENANCE(Roles.PAYROLL_MASTER),
    DEDUCTION_TABLES(Roles.PAYROLL_MASTER),
    PAYROLL(Roles.PAYROLL_MASTER),
    REPORTS(Roles.PAYROLL_MASTER),
    EMPLOYEE_RECORD_MANAGEMENT(Roles.PAYROLL_MASTER),
    /** User accounts, archive, audit trail, backup and restore, device configuration. */
    UTILITY(Roles.SYSTEM_ADMINISTRATOR),
    /** Whether the biometric scanner is connected (DTR live badge, Biometric Device page). */
    SCANNER_STATUS(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF, Roles.SYSTEM_ADMINISTRATOR),
    /** Pulling attendance from the K40 on demand ("Sync Device"), apart from UTILITY's device management. */
    DEVICE_SYNC(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF, Roles.SYSTEM_ADMINISTRATOR),
    /** Reading the grace period and payroll periods (every page that shows cut-offs needs them). */
    SETTINGS_READ(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF, Roles.SYSTEM_ADMINISTRATOR),
    /** Reading the display names of Faculty/Admin/Faculty-Admin (every page that shows an employee's type needs them). */
    EMPLOYEE_TYPE_LABELS_READ(Roles.PAYROLL_MASTER, Roles.ATTENDANCE_MONITORING_STAFF, Roles.SYSTEM_ADMINISTRATOR);

    private final Set<String> roles;

    SystemModule(String... roles) {
        this.roles = Set.of(roles);
    }

    public boolean allows(String role) {
        return roles.contains(role);
    }
}
