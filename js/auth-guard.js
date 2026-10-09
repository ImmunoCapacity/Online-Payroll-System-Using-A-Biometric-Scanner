/**
 * PayrollPro Auth Guard
 * ---------------------------------------------------------------
 * Included as the FIRST script on every internal page (before any
 * CSS/content would otherwise render). It:
 *   1. sends visitors who aren't logged in to the login page;
 *   2. sends a logged-in user away from any page their role may not
 *      open (to their own home page);
 *   3. confirms the login with the server (api/auth/session), so a
 *      role edited in localStorage can't unlock other pages.
 *
 * Role-based access control — the system has exactly three roles:
 *
 *   Payroll Master        Dashboard, Fingerprint Registration,
 *                         Daily Time Record, Attendance Recording,
 *                         Maintenance, Deduction Tables, Payroll,
 *                         Reports, Employee Record Management
 *   Payroll Staff         Dashboard, Fingerprint Registration,
 *                         Daily Time Record, Attendance Recording
 *   System Administrator  Utility
 *
 * PAGE_ACCESS below maps every page to the roles that may open it.
 * A page that isn't listed can't be opened by anyone. Keep this in
 * step with backend/.../auth/SystemModule.java and the menus in
 * js/payrollpro-layout.js.
 * ---------------------------------------------------------------
 */
(function (global) {
    'use strict';

    var MASTER = 'Payroll Master';
    var STAFF = 'Payroll Staff';
    var ADMIN = 'System Administrator';

    var ROLE_HOME = {};
    ROLE_HOME[MASTER] = 'dashboard.html';
    ROLE_HOME[STAFF] = 'payroll-staff.html';
    ROLE_HOME[ADMIN] = 'system-admin.html';

    var PAGE_ACCESS = {
        // Dashboard
        'dashboard.html': [MASTER],
        'payroll-staff.html': [STAFF],

        // Fingerprint Registration
        'fingerprint-registration.html': [MASTER, STAFF],

        // Daily Time Record + Attendance Recording (Manual Entry section)
        'dtr.html': [MASTER, STAFF],
        // Faculty Schedule (planned classes; editing is Payroll Master only)
        'faculty-schedule.html': [MASTER, STAFF],
        // Faculty Teaching Hours (classroom checks; approval is Payroll Master only)
        'teaching-hours.html': [MASTER, STAFF],

        // Maintenance + Deduction Tables (rates, leave categories, BIR, PhilHealth, Pag-IBIG)
        'maintenance.html': [MASTER],
        'leave-application.html': [MASTER],      // Maintenance → Leave
        'leave-loan-approval.html': [MASTER],    // Deduction Tables → Loans

        // Payroll
        'payroll-processing.html': [MASTER],

        // Reports
        'reports.html': [MASTER],
        'attendance-reports.html': [MASTER],

        // Employee Record Management
        'employee-records.html': [MASTER],

        // Utility
        'system-admin.html': [ADMIN],
        'user-management.html': [ADMIN],
        'biometric-devices.html': [ADMIN]
    };

    function currentPage() {
        var path = global.location.pathname;
        var page = path.substring(path.lastIndexOf('/') + 1);
        return page || 'index.html';
    }

    function canOpen(role, page) {
        var roles = PAGE_ACCESS[page];
        return !!roles && roles.indexOf(role) !== -1;
    }

    function getUser() {
        try {
            var authed = localStorage.getItem('ppAuthenticated') === 'true';
            var raw = localStorage.getItem('ppUser');
            if (!authed || !raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function logOutLocally() {
        try {
            localStorage.removeItem('ppAuthenticated');
            localStorage.removeItem('ppUser');
        } catch (e) {
            // ignore — redirect anyway
        }
        global.location.replace('index.html');
    }

    function enforce(user) {
        if (!user || !ROLE_HOME[user.role]) {
            // Not logged in, or a role that no longer exists in the system.
            logOutLocally();
            return false;
        }
        if (!canOpen(user.role, currentPage())) {
            // Logged in, but this page isn't for their role — send them home.
            global.location.replace(ROLE_HOME[user.role]);
            return false;
        }
        return true;
    }

    global.PPAccess = {
        ROLE_HOME: ROLE_HOME,
        canOpen: canOpen
    };

    var user = getUser();
    if (!enforce(user)) {
        return;
    }

    // The server's session is the real authority. If it disagrees with
    // what's in localStorage, follow the server.
    if (global.fetch) {
        fetch('api/auth/session', { credentials: 'same-origin' })
            .then(function (response) {
                if (response.status === 401) {
                    logOutLocally();
                    return null;
                }
                return response.ok ? response.json() : null;
            })
            .then(function (data) {
                if (!data || !data.success || !data.user) return;
                if (data.user.role === user.role) return;

                user.role = data.user.role;
                user.name = data.user.name;
                user.email = data.user.email;
                try {
                    localStorage.setItem('ppUser', JSON.stringify(user));
                } catch (e) {
                    // ignore
                }
                if (enforce(user)) {
                    global.location.reload(); // re-render menus for the real role
                }
            })
            .catch(function () {
                // Backend unreachable (e.g. page opened straight from disk):
                // keep the local check above. API calls are still refused
                // by the server without a valid session.
            });
    }
})(window);
