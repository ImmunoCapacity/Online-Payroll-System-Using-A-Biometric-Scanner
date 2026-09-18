/**
 * PayrollPro Auth Guard
 * ---------------------------------------------------------------
 * Included as the FIRST script on every internal page (before any
 * CSS/content would otherwise render) so an unauthenticated visitor
 * is sent back to the login page immediately, instead of being able
 * to open any page directly by URL.
 *
 * Optionally, a page can restrict itself to specific roles by
 * setting `window.PP_ALLOWED_ROLES = ['System Administrator', ...]`
 * in an inline <script> BEFORE this file is included. If omitted,
 * any authenticated user may view the page.
 * ---------------------------------------------------------------
 */
(function () {
    'use strict';

    var ROLE_HOME = {
        'System Administrator': 'system-admin.html',
        'Payroll Master': 'dashboard.html',
        'Payroll Staff': 'payroll-staff.html',
        'Faculty Staff': 'payslip.html',
        'Administrative Staff': 'payslip.html'
    };

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

    var user = getUser();

    if (!user) {
        window.location.replace('index.html');
        return;
    }

    var allowedRoles = window.PP_ALLOWED_ROLES;
    if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(user.role) === -1) {
        // Logged in, but this page isn't meant for their role —
        // send them to their own home page instead of the login screen.
        window.location.replace(ROLE_HOME[user.role] || 'index.html');
    }
})();
