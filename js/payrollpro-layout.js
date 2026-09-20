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
            href: 'leave-loan-approval.html'
        },

        {
            id: 'reports',
            label: 'Reports',
            icon: 'bi-file-earmark-bar-graph',
            href: 'reports.html'
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
            href: 'user-management.html'
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
            href: 'biometric-devices.html'
        },

        {
            id: 'fingerprint',
            label: 'Fingerprint Enrollment',
            icon: 'bi-fingerprint',
            href: 'fingerprint-registration.html'
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
            href: 'reports.html'
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
            href: 'attendance-reports.html'
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
            href: 'my-attendance.html'
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
                ' title="' + item.label + '"' +
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

                '<button type="button" class="pp-sidebar-collapse-btn" id="ppSidebarCollapseBtn" aria-label="Collapse sidebar">' +
                    '<i class="bi bi-chevron-left"></i>' +
                '</button>' +

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

                            '<button type="button" class="pp-user-dropdown-item" id="ppOpenProfile">' +

                                '<i class="bi bi-person"></i>' +

                                '<span>Profile</span>' +

                            '</button>' +

                            '<button type="button" class="pp-user-dropdown-item" id="ppOpenSettings">' +

                                '<i class="bi bi-gear"></i>' +

                                '<span>Settings</span>' +

                            '</button>' +

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

                    fetch('api/auth/logout.php', { method: 'POST' }).catch(function () {
                        // Best-effort — still clear local state and redirect even if
                        // the backend is unreachable.
                    });

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


    function bindSidebarCollapse() {

        var btn = document.getElementById('ppSidebarCollapseBtn');
        if (!btn) return;

        function updateAriaLabel() {
            var collapsed = document.body.classList.contains('pp-sidebar-collapsed');
            btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
        }

        updateAriaLabel();

        btn.addEventListener('click', function () {
            var collapsed = document.body.classList.toggle('pp-sidebar-collapsed');
            updateAriaLabel();
            try {
                localStorage.setItem('ppSidebarCollapsed', String(collapsed));
            } catch (error) {
                // ignore — collapse still works for this page view
            }
        });
    }


    // ============================================================
    // PROFILE / SETTINGS MODALS
    // ============================================================

    function ensureAccountModals(config) {

        if (document.getElementById('ppProfileModal')) {
            return;
        }

        var user = config.user;
        var wrapper = document.createElement('div');

        wrapper.innerHTML =

            '<div class="modal fade pp-modal" id="ppProfileModal" tabindex="-1" aria-hidden="true">' +
                '<div class="modal-dialog modal-dialog-centered">' +
                    '<div class="modal-content">' +
                        '<div class="modal-header">' +
                            '<h2 class="modal-title"><i class="bi bi-person me-2"></i>Profile</h2>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="mb-3">' +
                                '<label class="pp-form-label">Name</label>' +
                                '<input type="text" class="form-control pp-form-control" value="' + user.name + '" disabled>' +
                            '</div>' +
                            '<div class="mb-3">' +
                                '<label class="pp-form-label">Role</label>' +
                                '<input type="text" class="form-control pp-form-control" value="' + user.role + '" disabled>' +
                            '</div>' +
                            '<div class="mb-0">' +
                                '<label class="pp-form-label">Institution</label>' +
                                '<input type="text" class="form-control pp-form-control" value="' + config.institution.name + '" disabled>' +
                            '</div>' +
                            '<p class="pp-form-note mt-3 mb-0">Profile details are managed by your System Administrator and cannot be edited here.</p>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-pp-outline" data-bs-dismiss="modal">Close</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="modal fade pp-modal" id="ppSettingsModal" tabindex="-1" aria-hidden="true">' +
                '<div class="modal-dialog modal-dialog-centered">' +
                    '<div class="modal-content">' +
                        '<div class="modal-header">' +
                            '<h2 class="modal-title"><i class="bi bi-gear me-2"></i>Settings</h2>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="form-check form-switch mb-3">' +
                                '<input class="form-check-input" type="checkbox" role="switch" id="ppSettingNotifications">' +
                                '<label class="form-check-label" for="ppSettingNotifications">Enable notifications</label>' +
                            '</div>' +
                            '<div class="form-check form-switch mb-0">' +
                                '<input class="form-check-input" type="checkbox" role="switch" id="ppSettingCompactSidebar">' +
                                '<label class="form-check-label" for="ppSettingCompactSidebar">Always collapse sidebar on load</label>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-pp-outline" data-bs-dismiss="modal">Cancel</button>' +
                            '<button type="button" class="btn btn-pp-primary" id="ppSettingsSave">Save Changes</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        while (wrapper.firstChild) {
            document.body.appendChild(wrapper.firstChild);
        }
    }

    function bindAccountModals(config) {

        ensureAccountModals(config);

        var profileBtn = document.getElementById('ppOpenProfile');
        var settingsBtn = document.getElementById('ppOpenSettings');
        var profileModalEl = document.getElementById('ppProfileModal');
        var settingsModalEl = document.getElementById('ppSettingsModal');

        if (!profileModalEl || !settingsModalEl) {
            return;
        }

        var profileModal = bootstrap.Modal.getOrCreateInstance(profileModalEl);
        var settingsModal = bootstrap.Modal.getOrCreateInstance(settingsModalEl);

        if (profileBtn) {
            profileBtn.addEventListener('click', function () {
                profileModal.show();
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', function () {
                try {
                    var saved = JSON.parse(localStorage.getItem('ppSettings') || '{}');
                    document.getElementById('ppSettingNotifications').checked = saved.notifications !== false;
                    document.getElementById('ppSettingCompactSidebar').checked = !!saved.compactSidebar;
                } catch (error) {
                    // ignore — defaults already set in markup
                }
                settingsModal.show();
            });
        }

        var saveBtn = document.getElementById('ppSettingsSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var settings = {
                    notifications: document.getElementById('ppSettingNotifications').checked,
                    compactSidebar: document.getElementById('ppSettingCompactSidebar').checked
                };
                try {
                    localStorage.setItem('ppSettings', JSON.stringify(settings));
                    // This becomes the explicit sidebar state from now on,
                    // taking effect immediately rather than only on next load.
                    localStorage.setItem('ppSidebarCollapsed', String(settings.compactSidebar));
                    document.body.classList.toggle('pp-sidebar-collapsed', settings.compactSidebar);
                    var collapseBtn = document.getElementById('ppSidebarCollapseBtn');
                    if (collapseBtn) {
                        collapseBtn.setAttribute('aria-label', settings.compactSidebar ? 'Expand sidebar' : 'Collapse sidebar');
                    }
                } catch (error) {
                    console.warn('[PayrollProLayout] Could not save settings:', error);
                }
                settingsModal.hide();
                if (global.PPToast) {
                    global.PPToast.success('Settings saved.');
                }
            });
        }
    }


    // ============================================================
    // INITIALIZE
    // ============================================================

    function init(options) {

        try {

            // Apply sidebar collapsed state as early as possible, before any
            // markup is injected, to avoid a flash of the expanded sidebar.
            (function applyInitialSidebarState() {
                try {
                    var explicit = localStorage.getItem('ppSidebarCollapsed');
                    var collapsed;
                    if (explicit !== null) {
                        collapsed = explicit === 'true';
                    } else {
                        var settings = JSON.parse(localStorage.getItem('ppSettings') || '{}');
                        collapsed = !!settings.compactSidebar;
                    }
                    document.body.classList.toggle('pp-sidebar-collapsed', collapsed);
                } catch (error) {
                    // ignore — sidebar just stays expanded
                }
            })();

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

            bindSidebarCollapse();

            bindUserMenu();

            bindAccountModals(config);


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