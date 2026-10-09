/**
 * PayrollPro Layout
 * Shared Sidebar + Topbar
 */

(function (global) {

    'use strict';


    // ============================================================
    // ROLE-BASED MENUS
    // Each role sees only the modules it is allowed to use. Keep in
    // step with PAGE_ACCESS in js/auth-guard.js and SystemModule.java.
    //
    //   Payroll Master        Dashboard, Fingerprint Registration, DTR,
    //                         Attendance Recording, Maintenance,
    //                         Deduction Tables, Payroll, Reports,
    //                         Employee Record Management
    //   Payroll Staff         Dashboard, Fingerprint Registration, DTR,
    //                         Attendance Recording
    //   System Administrator  Utility
    // ============================================================


    // ============================================================
    // SUB-MENUS (always open; see renderSubmenu)
    // ============================================================

    // DTR sections. Manual Entry isn't listed: it's the Attendance
    // Recording menu item.
    var DTR_SUBMENU = {
        groupClass: 'pp-dtr-sidebar-group',
        linkClass: 'pp-dtr-sidebar-link',
        dataKey: 'section',
        hrefFor: function (key) { return 'dtr.html?section=' + key; },
        items: [
            { key: 'biometric', label: 'Biometric Records', icon: 'bi-fingerprint' },
            { key: 'schedule', label: 'Faculty Schedule', icon: 'bi-calendar-week', href: 'faculty-schedule.html' },
            { key: 'teaching', label: 'Faculty Teaching Hours', icon: 'bi-person-workspace', href: 'teaching-hours.html' }
        ]
    };

    var REPORTS_SUBMENU = {
        groupClass: 'pp-reports-sidebar-group',
        linkClass: 'pp-reports-sidebar-link',
        dataKey: 'report',
        hrefFor: function (key) { return 'reports.html?report=' + key; },
        items: [
            { key: 'payroll', label: 'Payroll Report', icon: 'bi-file-earmark-text' },
            { key: 'payslip', label: 'Payslip', icon: 'bi-receipt' },
            { key: 'thirteenth', label: '13th Month Pay', icon: 'bi-calendar-check' },
            { key: 'sss', label: 'SSS Remittance', icon: 'bi-bank' },
            { key: 'philhealth', label: 'PhilHealth Remittance', icon: 'bi-heart-pulse' },
            { key: 'pagibig', label: 'Pag-IBIG Remittance', icon: 'bi-house-door' },
            { key: 'bir', label: 'BIR Remittance', icon: 'bi-journal-text' },
            { key: 'loans', label: 'Loan Report', icon: 'bi-cash-coin' },
            { key: 'employees', label: 'Employee List', icon: 'bi-people' },
            { key: 'attendance', label: 'Attendance Report', icon: 'bi-clock-history', href: 'attendance-reports.html' }
        ]
    };


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
            id: 'fingerprint',
            label: 'Fingerprint Registration',
            icon: 'bi-fingerprint',
            href: 'fingerprint-registration.html'
        },

        {
            id: 'dtr',
            label: 'Daily Time Record',
            icon: 'bi-clock-history',
            href: 'dtr.html',
            submenu: DTR_SUBMENU
        },

        {
            id: 'attendance-recording',
            label: 'Attendance Recording',
            icon: 'bi-pencil-square',
            href: 'dtr.html?section=manual'
        },

        {
            id: 'employees',
            label: 'Employee Records',
            icon: 'bi-people',
            href: 'employee-records.html'
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
            href: 'leave-application.html'
        },

        {
            id: 'loans',
            label: 'Loan Management',
            icon: 'bi-bank',
            href: 'leave-loan-approval.html'
        },

        {
            id: 'deductions',
            label: 'Deduction Tables',
            icon: 'bi-table',
            href: 'maintenance.html#bir'
        },

        {
            id: 'reports',
            label: 'Reports',
            icon: 'bi-file-earmark-bar-graph',
            href: 'reports.html',
            submenu: REPORTS_SUBMENU
        },

        {
            id: 'maintenance',
            label: 'Maintenance',
            icon: 'bi-sliders',
            href: 'maintenance.html'
        }

    ];


    // ============================================================
    // SYSTEM ADMINISTRATOR NAVIGATION (Utility module only)
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
            id: 'biometric',
            label: 'Biometric Device',
            icon: 'bi-hdd-network',
            href: 'biometric-devices.html'
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
            id: 'fingerprint',
            label: 'Fingerprint Registration',
            icon: 'bi-fingerprint',
            href: 'fingerprint-registration.html'
        },

        {
            id: 'dtr',
            label: 'Daily Time Record',
            icon: 'bi-clock-history',
            href: 'dtr.html',
            submenu: DTR_SUBMENU
        },

        {
            id: 'attendance-recording',
            label: 'Attendance Recording',
            icon: 'bi-pencil-square',
            href: 'dtr.html?section=manual'
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

    'Payroll Staff': 'payrollStaff'

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

    // Default = Payroll Master

    return NAV_ITEMS;

}


    // ============================================================
    // RENDER SIDEBAR
    // ============================================================

    // A nav item's sub-menu, always rendered open on every page so it
    // doesn't collapse when the user moves to another page. The page that
    // owns it (dtr.js, reports.js) highlights the current entry.
    function renderSubmenu(item) {

        if (!item.submenu) {
            return '';
        }

        var menu = item.submenu;

        return (
            '<div class="pp-sidebar-group ' + menu.groupClass + ' is-open">' +
                menu.items.map(function (sub) {
                    var href = sub.href || menu.hrefFor(sub.key);
                    // Entries with their own page (e.g. Attendance Report) are
                    // highlighted here; the rest by the page that owns the menu.
                    var onOwnPage = sub.href && global.location.pathname.endsWith('/' + sub.href);
                    return (
                        '<a href="' + href + '"' +
                        ' class="pp-sidebar-sublink ' + menu.linkClass + (onOwnPage ? ' active' : '') + '"' +
                        ' data-' + menu.dataKey + '="' + sub.key + '"' +
                        (sub.href ? ' data-external="1"' : '') +
                        '>' +
                            '<i class="bi ' + sub.icon + '"></i>' +
                            '<span>' + sub.label + '</span>' +
                        '</a>'
                    );
                }).join('') +
            '</div>'
        );

    }


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

                '</a>' +

                renderSubmenu(item)

            );

        }).join('');


        return (

            '<aside class="pp-sidebar" id="ppSidebar" aria-label="Main navigation">' +

                '<button type="button" class="pp-sidebar-collapse-btn" id="ppSidebarCollapseBtn" aria-label="Collapse sidebar">' +
                    '<i class="bi bi-chevron-left"></i>' +
                '</button>' +

                '<a href="' + brandHref + '" class="pp-sidebar-brand">' +

                    '<div class="pp-sidebar-logo" aria-hidden="true">' +
                        '<img src="sti_logo.png" alt="" class="pp-logo-img">' +
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
                            '<img src="sti_logo.png" alt="" class="pp-logo-img">' +
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

                    fetch('api/auth/logout', { method: 'POST' }).catch(function () {
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
            btn.title = (collapsed ? 'Expand sidebar' : 'Collapse sidebar') + ' (Ctrl+B)';
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

        bindSidebarShortcut(btn);
    }


    /**
     * Ctrl+B (Cmd+B on a Mac) shows / hides the sidebar: on wide screens it
     * collapses or expands it (same as the collapse button), on small
     * screens it opens or closes the slide-in menu. Tab keeps its usual job
     * of moving between fields and buttons. Ignored while a dialog is open.
     */
    function bindSidebarShortcut(collapseBtn) {

        function dialogOpen() {
            return !!document.querySelector('.modal.show, .offcanvas.show');
        }

        document.addEventListener('keydown', function (event) {
            var isB = event.key === 'b' || event.key === 'B';
            if (!isB || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
                return;
            }
            if (dialogOpen() || (event.target && event.target.isContentEditable)) {
                return;
            }
            event.preventDefault();

            var mobileToggle = document.getElementById('ppSidebarToggle');
            if (window.innerWidth < 992 && mobileToggle) {
                mobileToggle.click();
            } else {
                collapseBtn.click();
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


            // The logged-in user's role always decides the menu, even if
            // the page passed its own navMode — so nobody is shown
            // modules their role can't use.
            if (
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
            PAYROLL_STAFF_NAV_ITEMS

    };


})(window);