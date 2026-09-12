/**
 * PayrollPro Layout
 * Shared Sidebar + Topbar
 */

(function (global) {

    'use strict';


    // ============================================================
    // PAYROLL MASTER NAVIGATION
    // ============================================================

    var NAV_ITEMS = [

        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: 'bi-speedometer2',
            href: 'dashboard.html'
        },

        {
            id: 'employees',
            label: 'Employee Records',
            icon: 'bi-people',
            href: 'employee-records.html'
        },

        {
            id: 'dtr',
            label: 'Daily Time Record',
            icon: 'bi-clock-history',
            href: 'dtr.html'
        },

        {
            id: 'payroll',
            label: 'Payroll Processing',
            icon: 'bi-cash-stack',
            href: 'payroll-processing.html'
        },

        {
            id: 'leave',
            label: 'Leave Management',
            icon: 'bi-calendar-check',
            href: 'leave-loan-approval.html'
        },

        {
            id: 'loans',
            label: 'Loan Management',
            icon: 'bi-bank',
            href: 'leave-loan-approval.html?tab=loans'
        },

        {
            id: 'reports',
            label: 'Reports',
            icon: 'bi-file-earmark-bar-graph',
            href: '#'
        },

        {
            id: 'maintenance',
            label: 'Maintenance',
            icon: 'bi-sliders',
            href: 'maintenance.html'
        }

    ];


    // ============================================================
    // SYSTEM ADMINISTRATOR NAVIGATION
    // ============================================================

    var SYSTEM_ADMIN_NAV_ITEMS = [

        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: 'bi-speedometer2',
            href: 'system-admin.html'
        },

        {
            id: 'users',
            label: 'User Management',
            icon: 'bi-person-gear',
            href: '#'
        },

        {
            id: 'employees',
            label: 'Employee Records',
            icon: 'bi-people',
            href: 'employee-records.html'
        },

        {
            id: 'biometric',
            label: 'Biometric Device',
            icon: 'bi-fingerprint',
            href: '#'
        },

        {
            id: 'maintenance',
            label: 'System Maintenance',
            icon: 'bi-sliders',
            href: 'maintenance.html'
        },

        {
            id: 'reports',
            label: 'Reports',
            icon: 'bi-file-earmark-bar-graph',
            href: '#'
        }

    ];


    // ============================================================
    // PAYROLL STAFF NAVIGATION
    // ============================================================

    var PAYROLL_STAFF_NAV_ITEMS = [

        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: 'bi-speedometer2',
            href: 'payroll-staff.html'
        },

        {
            id: 'employees',
            label: 'Employee Records',
            icon: 'bi-people',
            href: 'employee-records.html'
        },

        {
            id: 'dtr',
            label: 'Daily Time Record',
            icon: 'bi-clock-history',
            href: 'dtr.html'
        },

        {
            id: 'leave',
            label: 'Leave Management',
            icon: 'bi-calendar-check',
            href: 'leave-loan-approval.html'
        },

        {
            id: 'reports',
            label: 'Attendance Reports',
            icon: 'bi-file-earmark-bar-graph',
            href: '#'
        }

    ];


    // ============================================================
    // STAFF NAVIGATION
    // ============================================================

    var STAFF_NAV_ITEMS = [

        {
            id: 'payslip',
            label: 'My Payslip',
            icon: 'bi-receipt',
            href: 'payslip.html'
        },

        {
            id: 'attendance',
            label: 'My Attendance',
            icon: 'bi-clock-history',
            href: '#'
        },

        {
            id: 'leave',
            label: 'My Leave',
            icon: 'bi-calendar-check',
            href: 'leave-application.html'
        },

        {
            id: 'loans',
            label: 'My Loans',
            icon: 'bi-bank',
            href: 'loan-application.html'
        },

        {
            id: 'thirteenth',
            label: '13th Month Pay',
            icon: 'bi-gift',
            href: 'payslip.html#thirteenth'
        },

        {
            id: 'benefits',
            label: 'Benefits',
            icon: 'bi-heart-pulse',
            href: 'payslip.html#benefits'
        }

    ];


    // ============================================================
    // DEFAULTS
    // ============================================================

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


    // ============================================================
    // ROLE -> NAV MODE
    // ============================================================

   var ROLE_TO_NAVMODE = {

    'System Administrator': 'admin',

    'Payroll Master': 'master',

    'Payroll Staff': 'payrollStaff',

    'Faculty Staff': 'staff',

    'Administrative Staff': 'staff'

};


    // ============================================================
    // GET NAVIGATION
    // ============================================================

    function getNavItems(navMode) {

    if (navMode === 'admin') {

        return SYSTEM_ADMIN_NAV_ITEMS;

    }

    if (navMode === 'payrollStaff') {

        return PAYROLL_STAFF_NAV_ITEMS;

    }

    if (navMode === 'staff') {

        return STAFF_NAV_ITEMS;

    }

    // Default = Payroll Master

    return NAV_ITEMS;

}


    // ============================================================
    // RENDER SIDEBAR
    // ============================================================

    function renderSidebar(activeNav, navMode, brandHref) {

        var items = getNavItems(navMode);


        var links = items.map(function (item) {

            var active =
                item.id === activeNav
                    ? ' active'
                    : '';


            var current =
                item.id === activeNav
                    ? ' aria-current="page"'
                    : '';


            return (

                '<a href="' + item.href + '"' +
                ' class="pp-sidebar-link' + active + '"' +
                current +
                '>' +

                    '<i class="bi ' + item.icon + '"></i>' +

                    '<span>' +
                        item.label +
                    '</span>' +

                '</a>'

            );

        }).join('');


        return (

            '<aside class="pp-sidebar" id="ppSidebar" aria-label="Main navigation">' +

                '<a href="' + brandHref + '" class="pp-sidebar-brand">' +

                    '<div class="pp-sidebar-logo" aria-hidden="true">' +
                        '<i class="bi bi-building"></i>' +
                    '</div>' +

                    '<div class="pp-sidebar-brand-text">' +
                        '<span>Payroll System</span>' +
                    '</div>' +

                '</a>' +

                '<nav class="pp-sidebar-nav">' +

                    links +

                '</nav>' +

                '<div class="pp-sidebar-footer">' +
                    'Online Payroll System<br>' +
                    'Using a Biometric Scanner' +
                '</div>' +

            '</aside>' +

            '<div class="pp-sidebar-overlay" id="ppSidebarOverlay" aria-hidden="true"></div>'

        );

    }


    // ============================================================
    // RENDER TOPBAR
    // ============================================================

    function renderTopbar(config) {

        var user = config.user;

        var inst = config.institution;


        var notifDot = config.notifications

            ? '<span class="pp-notif-dot" aria-hidden="true"></span>'

            : '';


        return (

            '<header class="pp-topbar">' +

                '<div class="d-flex align-items-center gap-2 min-width-0">' +

                    '<button type="button" ' +
                            'class="pp-sidebar-toggle" ' +
                            'id="ppSidebarToggle" ' +
                            'aria-label="Open navigation menu">' +

                        '<i class="bi bi-list"></i>' +

                    '</button>' +

                    '<div class="pp-topbar-institution">' +

                        '<div class="pp-topbar-inst-logo" aria-hidden="true">' +
                            '<i class="bi bi-mortarboard"></i>' +
                        '</div>' +

                        '<span class="pp-topbar-inst-name">' +
                            inst.name +
                        '</span>' +

                    '</div>' +

                '</div>' +

                '<div class="pp-topbar-actions">' +

                    '<button type="button" ' +
                            'class="pp-topbar-btn" ' +
                            'aria-label="Notifications">' +

                        '<i class="bi bi-bell"></i>' +

                        notifDot +

                    '</button>' +

                    '<div class="pp-topbar-user-wrapper">' +

                        '<button type="button" ' +
                                'class="pp-topbar-user" ' +
                                'id="ppUserMenuButton" ' +
                                'aria-expanded="false">' +

                            '<div class="pp-topbar-user-info">' +

                                '<div class="pp-topbar-user-name">' +
                                    user.name +
                                '</div>' +

                                '<div class="pp-topbar-user-role">' +
                                    user.role +
                                '</div>' +

                            '</div>' +

                            '<div class="pp-topbar-avatar" aria-hidden="true">' +

                                user.initials +

                            '</div>' +

                        '</button>' +

                        '<div class="pp-user-dropdown" id="ppUserDropdown">' +

                            '<div class="pp-user-dropdown-header">' +

                                '<div class="pp-user-dropdown-name">' +
                                    user.name +
                                '</div>' +

                                '<div class="pp-user-dropdown-role">' +
                                    user.role +
                                '</div>' +

                            '</div>' +

                            '<div class="pp-user-dropdown-divider"></div>' +

                            '<a href="#" class="pp-user-dropdown-item">' +

                                '<i class="bi bi-person"></i>' +

                                '<span>Profile</span>' +

                            '</a>' +

                            '<a href="#" class="pp-user-dropdown-item">' +

                                '<i class="bi bi-gear"></i>' +

                                '<span>Settings</span>' +

                            '</a>' +

                            '<div class="pp-user-dropdown-divider"></div>' +

                            '<button type="button" ' +
                                    'class="pp-user-dropdown-item pp-logout-button" ' +
                                    'id="ppLogoutBtn">' +

                                '<i class="bi bi-box-arrow-right"></i>' +

                                '<span>Logout</span>' +

                            '</button>' +

                        '</div>' +

                    '</div>' +

                '</div>' +

            '</header>'

        );

    }


    // ============================================================
    // SIDEBAR TOGGLE
    // ============================================================

    function bindSidebarToggle() {

        var sidebar =
            document.getElementById('ppSidebar');

        var overlay =
            document.getElementById('ppSidebarOverlay');

        var toggle =
            document.getElementById('ppSidebarToggle');


        if (!sidebar || !toggle) {

            return;

        }


        function openSidebar() {

            sidebar.classList.add('open');

            if (overlay) {

                overlay.classList.add('show');

            }

            document.body.style.overflow = 'hidden';

        }


        function closeSidebar() {

            sidebar.classList.remove('open');

            if (overlay) {

                overlay.classList.remove('show');

            }

            document.body.style.overflow = '';

        }


        toggle.addEventListener('click', function () {

            if (sidebar.classList.contains('open')) {

                closeSidebar();

            } else {

                openSidebar();

            }

        });


        if (overlay) {

            overlay.addEventListener(
                'click',
                closeSidebar
            );

        }


        sidebar
            .querySelectorAll('.pp-sidebar-link')
            .forEach(function (link) {

                link.addEventListener('click', function () {

                    if (window.innerWidth < 992) {

                        closeSidebar();

                    }

                });

            });


        window.addEventListener('resize', function () {

            if (window.innerWidth >= 992) {

                closeSidebar();

            }

        });

    }


    // ============================================================
    // USER MENU
    // ============================================================

    function bindUserMenu() {

        var userButton =
            document.getElementById('ppUserMenuButton');

        var dropdown =
            document.getElementById('ppUserDropdown');

        var logoutButton =
            document.getElementById('ppLogoutBtn');


        if (!userButton || !dropdown) {

            return;

        }


        userButton.addEventListener(
            'click',
            function (event) {

                event.stopPropagation();


                var isOpen =
                    dropdown.classList.contains('show');


                if (isOpen) {

                    dropdown.classList.remove('show');

                    userButton.setAttribute(
                        'aria-expanded',
                        'false'
                    );

                } else {

                    dropdown.classList.add('show');

                    userButton.setAttribute(
                        'aria-expanded',
                        'true'
                    );

                }

            }
        );


        document.addEventListener(
            'click',
            function () {

                dropdown.classList.remove('show');

                userButton.setAttribute(
                    'aria-expanded',
                    'false'
                );

            }
        );


        dropdown.addEventListener(
            'click',
            function (event) {

                event.stopPropagation();

            }
        );


        if (logoutButton) {

            logoutButton.addEventListener(
                'click',
                function () {

                    try {

                        localStorage.removeItem(
                            'ppAuthenticated'
                        );

                        localStorage.removeItem(
                            'ppUser'
                        );

                    } catch (error) {

                        console.warn(
                            'Could not clear login state:',
                            error
                        );

                    }


                    window.location.replace(
                        'index.html'
                    );

                }
            );

        }

    }


    // ============================================================
    // STORED USER
    // ============================================================

    function getStoredUser() {

        try {

            var stored =
                localStorage.getItem('ppUser');


            if (stored) {

                return JSON.parse(stored);

            }

        } catch (error) {

            console.warn(
                'Could not read stored user:',
                error
            );

        }


        return null;

    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    function init(options) {

        try {

            var navModeExplicitlySet =
                !!(options && options.navMode !== undefined);


            var config = {

                activeNav: DEFAULTS.activeNav,

                navMode: DEFAULTS.navMode,

                brandHref: DEFAULTS.brandHref,

                user: Object.assign(
                    {},
                    DEFAULTS.user
                ),

                institution: Object.assign(
                    {},
                    DEFAULTS.institution
                ),

                notifications:
                    DEFAULTS.notifications

            };


            if (options) {

                if (options.activeNav !== undefined) {

                    config.activeNav =
                        options.activeNav;

                }

                if (options.navMode !== undefined) {

                    config.navMode =
                        options.navMode;

                }

                if (options.brandHref !== undefined) {

                    config.brandHref =
                        options.brandHref;

                }

                if (options.notifications !== undefined) {

                    config.notifications =
                        options.notifications;

                }

                if (options.user) {

                    config.user = Object.assign(
                        {},
                        config.user,
                        options.user
                    );

                }

                if (options.institution) {

                    config.institution = Object.assign(
                        {},
                        config.institution,
                        options.institution
                    );

                }

            }


            var storedUser =
                getStoredUser();


            if (storedUser) {

                config.user = Object.assign(
                    {},
                    config.user,
                    storedUser
                );

            }


            if (
                !navModeExplicitlySet &&
                storedUser &&
                storedUser.role
            ) {

                var derivedNavMode =
                    ROLE_TO_NAVMODE[storedUser.role];


                if (derivedNavMode) {

                    config.navMode =
                        derivedNavMode;

                } else {

                    console.warn(
                        '[PayrollProLayout] Unrecognized role:',
                        storedUser.role
                    );

                }

            }


            // ====================================================
            // BRAND LINK
            // ====================================================

            if (config.navMode === 'admin') {

                config.brandHref =
                    'system-admin.html';

            } else if (config.navMode === 'payrollStaff') {

                config.brandHref =
                    'payroll-staff.html';

            } else if (config.navMode === 'staff') {

                config.brandHref =
                    'payslip.html';

            } else {

                config.brandHref =
                    'dashboard.html';

            }


            // ====================================================
            // SIDEBAR
            // ====================================================

            var sidebarMount =
                document.getElementById(
                    'pp-sidebar-mount'
                );


            if (sidebarMount) {

                sidebarMount.innerHTML =
                    renderSidebar(
                        config.activeNav,
                        config.navMode,
                        config.brandHref
                    );

            }


            // ====================================================
            // TOPBAR
            // ====================================================

            var topbarMount =
                document.getElementById(
                    'pp-topbar-mount'
                );


            if (topbarMount) {

                topbarMount.innerHTML =
                    renderTopbar(config);

            }


            bindSidebarToggle();

            bindUserMenu();


            return config;

        } catch (error) {

            console.error(
                '[PayrollProLayout] init() failed:',
                error
            );

            return null;

        }

    }


    // ============================================================
    // EXPORT
    // ============================================================

    global.PayrollProLayout = {

        init: init,

        NAV_ITEMS: NAV_ITEMS,

        ADMIN_NAV_ITEMS:
            SYSTEM_ADMIN_NAV_ITEMS,

        PAYROLL_STAFF_NAV_ITEMS:
            PAYROLL_STAFF_NAV_ITEMS,

        STAFF_NAV_ITEMS:
            STAFF_NAV_ITEMS

    };


})(window);