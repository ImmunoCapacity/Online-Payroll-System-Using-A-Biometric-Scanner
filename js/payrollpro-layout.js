/**
 * PayrollPro — reusable app shell (sidebar + topbar)
 *
 * Usage:
 *   PayrollProLayout.init({
 *     activeNav: 'dashboard',
 *     user: { name: 'Jane Mercado', role: 'Payroll Master', initials: 'JM' },
 *     institution: { name: 'STI Balayan', short: 'STI' }
 *   });
 *
 * Markup:
 *   <body class="pp-app pp-app-shell">
 *     <div id="pp-sidebar-mount"></div>
 *     <div class="pp-shell-main">
 *       <div id="pp-topbar-mount"></div>
 *       <main class="pp-content">…</main>
 *     </div>
 *   </body>
 */
(function (global) {
    'use strict';

    var NAV_ITEMS = [
        { id: 'dashboard',           label: 'Dashboard',           icon: 'bi-speedometer2',        href: 'dashboard.html' },
        { id: 'employees',           label: 'Employee Records',    icon: 'bi-people',              href: 'employee-records.html' },
        { id: 'dtr',                 label: 'Daily Time Record',   icon: 'bi-clock-history',       href: 'dtr.html' },
        { id: 'payroll',             label: 'Payroll Processing',  icon: 'bi-cash-stack',          href: 'payroll-processing.html' },
        { id: 'leave',               label: 'Leave Management',    icon: 'bi-calendar-check',      href: 'leave-loan-approval.html' },
        { id: 'loans',               label: 'Loan Management',     icon: 'bi-bank',                href: 'leave-loan-approval.html?tab=loans' },
        { id: 'reports',             label: 'Reports',             icon: 'bi-file-earmark-bar-graph', href: '#' },
        { id: 'maintenance',         label: 'Maintenance',         icon: 'bi-sliders',             href: 'maintenance.html' },
        { id: 'settings',            label: 'Settings',            icon: 'bi-gear',                href: '#' }
    ];

    var STAFF_NAV_ITEMS = [
        { id: 'payslip',       label: 'My Payslip',        icon: 'bi-receipt',           href: 'payslip.html' },
        { id: 'attendance',    label: 'My Attendance',     icon: 'bi-clock-history',     href: '#' },
        { id: 'leave',         label: 'My Leave',          icon: 'bi-calendar-check',    href: 'leave-application.html' },
        { id: 'loans',         label: 'My Loans',          icon: 'bi-bank',              href: 'loan-application.html' },
        { id: 'thirteenth',    label: '13th Month Pay',    icon: 'bi-gift',              href: 'payslip.html#thirteenth' },
        { id: 'benefits',      label: 'Benefits',          icon: 'bi-heart-pulse',       href: 'payslip.html#benefits' },
        { id: 'settings',      label: 'Settings',          icon: 'bi-gear',              href: '#' }
    ];

    var DEFAULTS = {
        activeNav: 'dashboard',
        navMode: 'master',
        brandHref: 'dashboard.html',
        user: {
            name: 'User',
            role: 'Staff',
            initials: 'U'
        },
        institution: {
            name: 'Academic Institution',
            short: 'AI'
        },
        notifications: true
    };

    function getNavItems(navMode) {
        return navMode === 'staff' ? STAFF_NAV_ITEMS : NAV_ITEMS;
    }

    function renderSidebar(activeNav, navMode, brandHref) {
        var items = getNavItems(navMode);
        var links = items.map(function (item) {
            var active = item.id === activeNav ? ' active' : '';
            var current = item.id === activeNav ? ' aria-current="page"' : '';
            return (
                '<a href="' + item.href + '" class="pp-sidebar-link' + active + '"' + current + '>' +
                    '<i class="bi ' + item.icon + '"></i>' +
                    '<span>' + item.label + '</span>' +
                '</a>'
            );
        }).join('');

        return (
            '<aside class="pp-sidebar" id="ppSidebar" aria-label="Main navigation">' +
                '<a href="' + brandHref + '" class="pp-sidebar-brand">' +
                    '<div class="pp-sidebar-logo" aria-hidden="true"><i class="bi bi-building"></i></div>' +
                    '<div class="pp-sidebar-brand-text">Payroll<span>Pro</span></div>' +
                '</a>' +
                '<nav class="pp-sidebar-nav">' + links + '</nav>' +
                '<div class="pp-sidebar-footer">Online Payroll System<br>Using a Biometric Scanner</div>' +
            '</aside>' +
            '<div class="pp-sidebar-overlay" id="ppSidebarOverlay" aria-hidden="true"></div>'
        );
    }

    function renderTopbar(config) {
        var user = config.user;
        var inst = config.institution;
        var notifDot = config.notifications
            ? '<span class="pp-notif-dot" aria-hidden="true"></span>'
            : '';

        return (
            '<header class="pp-topbar">' +
                '<div class="d-flex align-items-center gap-2 min-width-0">' +
                    '<button type="button" class="pp-sidebar-toggle" id="ppSidebarToggle" aria-label="Open navigation menu">' +
                        '<i class="bi bi-list"></i>' +
                    '</button>' +
                    '<div class="pp-topbar-institution">' +
                        '<div class="pp-topbar-inst-logo" aria-hidden="true"><i class="bi bi-mortarboard"></i></div>' +
                        '<span class="pp-topbar-inst-name">' + inst.name + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="pp-topbar-actions">' +
                    '<button type="button" class="pp-topbar-btn" aria-label="Notifications (' + (config.notifications ? '3 unread' : 'none') + ')">' +
                        '<i class="bi bi-bell"></i>' +
                        notifDot +
                    '</button>' +
                    '<div class="pp-topbar-user">' +
                        '<div class="pp-topbar-user-info">' +
                            '<div class="pp-topbar-user-name">' + user.name + '</div>' +
                            '<div class="pp-topbar-user-role">' + user.role + '</div>' +
                        '</div>' +
                        '<div class="pp-topbar-avatar" aria-hidden="true" title="' + user.name + '">' + user.initials + '</div>' +
                    '</div>' +
                '</div>' +
            '</header>'
        );
    }

    function bindSidebarToggle() {
        var sidebar = document.getElementById('ppSidebar');
        var overlay = document.getElementById('ppSidebarOverlay');
        var toggle = document.getElementById('ppSidebarToggle');

        if (!sidebar || !toggle) return;

        function open() {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }

        function close() {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('show');
            document.body.style.overflow = '';
        }

        toggle.addEventListener('click', function () {
            sidebar.classList.contains('open') ? close() : open();
        });

        if (overlay) overlay.addEventListener('click', close);

        sidebar.querySelectorAll('.pp-sidebar-link').forEach(function (link) {
            link.addEventListener('click', function () {
                if (window.innerWidth < 992) close();
            });
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth >= 992) close();
        });
    }

    function getStoredUser() {
        try {
            var stored = window.localStorage.getItem('ppUser');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            return null;
        }
    }

    function isLoginPage() {
        var path = window.location.pathname;
        return path.endsWith('/index.html') || path.endsWith('/index.htm') || path === '/' || path.endsWith('/login.html');
    }

    function isAuthenticated() {
        try {
            return window.localStorage.getItem('ppAuthenticated') === 'true';
        } catch (error) {
            return false;
        }
    }

    function ensureAuthentication() {
        // Protect the app pages so users cannot browse the dashboard without logging in.
        if (isLoginPage()) {
            // If a user is already signed in, send them to the dashboard instead of showing the login page again.
            if (isAuthenticated()) {
                window.location.replace('dashboard.html');
            }
            return false;
        }

        if (!isAuthenticated()) {
            // Send the user back to the login page after a successful sign-in.
            var target = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
            window.location.replace('index.html?redirect=' + target);
            return false;
        }

        return true;
    }

    function init(options) {
        var config = {};
        var key;
        for (key in DEFAULTS) {
            if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
                config[key] = DEFAULTS[key];
            }
        }
        if (options) {
            for (key in options) {
                if (Object.prototype.hasOwnProperty.call(options, key)) {
                    if (typeof options[key] === 'object' && options[key] !== null && typeof config[key] === 'object') {
                        var sub;
                        for (sub in config[key]) {
                            if (Object.prototype.hasOwnProperty.call(config[key], sub)) {
                                config[key][sub] = options[key][sub] !== undefined ? options[key][sub] : config[key][sub];
                            }
                        }
                    } else {
                        config[key] = options[key];
                    }
                }
            }
        }

        // Use the stored user details if available so the top bar stays consistent after login.
        var storedUser = getStoredUser();
        if (storedUser) {
            config.user = Object.assign({}, config.user, storedUser);
        }

        if (!ensureAuthentication()) {
            return config;
        }

        var sidebarMount = document.getElementById('pp-sidebar-mount');
        var topbarMount = document.getElementById('pp-topbar-mount');

        if (config.navMode === 'staff') {
            config.brandHref = config.brandHref || 'payslip.html';
        } else {
            config.brandHref = config.brandHref || 'dashboard.html';
        }

        if (sidebarMount) {
            sidebarMount.innerHTML = renderSidebar(config.activeNav, config.navMode, config.brandHref);
        }
        if (topbarMount) {
            topbarMount.innerHTML = renderTopbar(config);
        }

        bindSidebarToggle();
        return config;
    }

    global.PayrollProLayout = { init: init, NAV_ITEMS: NAV_ITEMS, STAFF_NAV_ITEMS: STAFF_NAV_ITEMS };
})(typeof window !== 'undefined' ? window : this);
