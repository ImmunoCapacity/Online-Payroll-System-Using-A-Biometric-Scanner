(function () {

    'use strict';


    // ============================================================
    // SYSTEM ADMINISTRATOR LAYOUT
    // The System Administrator only has the Utility module: user
    // accounts, biometric device configuration, and the audit trail.
    // Payroll and employee data are deliberately not shown here.
    // ============================================================

    PayrollProLayout.init({

        activeNav: 'dashboard',

        navMode: 'admin',

        user: {

            name: 'System Administrator',

            role: 'System Administrator',

            initials: 'SA'

        },

        institution: {

            name: 'STI Balayan',

            short: 'STI'

        },

        notifications: true

    });


    var ROLES = [
        { name: 'System Administrator', icon: 'bi-shield-check' },
        { name: 'Payroll Master', icon: 'bi-cash-stack' },
        { name: 'Payroll Staff', icon: 'bi-fingerprint' }
    ];


    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }


    // ============================================================
    // STAT CARDS
    // ============================================================

    (function updateDeviceCard() {

        var devices = DataStore.getDevices();
        var activeDevices = devices.filter(function (d) { return d.status === 'Active'; });

        document.getElementById('statDeviceStatus').textContent = activeDevices.length ? 'Online' : 'Offline';
        document.getElementById('statDeviceMeta').textContent = activeDevices.length + ' of ' + devices.length + ' device' + (devices.length !== 1 ? 's' : '') + ' active';

    })();


    // ============================================================
    // USER ACCOUNTS (from the database, api/users)
    // ============================================================

    function renderUserStats(users) {

        var activeUsers = users.filter(function (u) { return u.active; });
        var inactive = users.length - activeUsers.length;

        document.getElementById('statSystemUsers').textContent = users.length;
        document.getElementById('statActiveUsers').textContent = activeUsers.length;
        document.getElementById('statActiveUsersMeta').textContent = inactive + ' account' + (inactive !== 1 ? 's' : '') + ' inactive';

    }


    function renderRoleSummary(users) {

        document.getElementById('userAccountsBadge').textContent =
            users.length + ' Account' + (users.length !== 1 ? 's' : '');

        document.getElementById('roleSummaryBody').innerHTML = ROLES.map(function (role) {
            var inRole = users.filter(function (u) { return u.role === role.name; });
            var active = inRole.filter(function (u) { return u.active; }).length;

            return (
                '<tr>' +
                    '<td><i class="bi ' + role.icon + ' me-2"></i>' + role.name + '</td>' +
                    '<td>' + inRole.length + '</td>' +
                    '<td>' + active + '</td>' +
                '</tr>'
            );
        }).join('');

    }


    fetch('api/users')
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (!data.success) throw new Error(data.message);
            renderUserStats(data.users);
            renderRoleSummary(data.users);
        })
        .catch(function (error) {
            console.error('[System Admin Dashboard] Could not load user accounts:', error);
            document.getElementById('statActiveUsersMeta').textContent = 'Could not load accounts';
        });


    // ============================================================
    // RECENT SYSTEM ACTIVITY (audit trail)
    // ============================================================

    (function renderActivity() {

        var list = document.getElementById('activityList');
        var entries = DataStore.getAuditLog().slice(0, 8);

        if (entries.length === 0) {
            list.innerHTML = '<li class="pp-activity-item"><p class="pp-activity-text text-muted mb-0">No system activity recorded yet.</p></li>';
            return;
        }

        list.innerHTML = entries.map(function (entry) {
            var when = new Date(entry.at);

            return (
                '<li class="pp-activity-item">' +
                    '<div class="pp-activity-icon employee" aria-hidden="true">' +
                        '<i class="bi bi-journal-text"></i>' +
                    '</div>' +
                    '<div>' +
                        '<p class="pp-activity-text">' +
                            '<strong>' + escapeHtml(entry.user) + '</strong> — ' +
                            escapeHtml(entry.action) + ' (' + escapeHtml(entry.section) + ')' +
                            (entry.detail ? ': ' + escapeHtml(entry.detail) : '') +
                        '</p>' +
                        '<time class="pp-activity-time">' +
                            (isNaN(when) ? '' : when.toLocaleString()) +
                        '</time>' +
                    '</div>' +
                '</li>'
            );
        }).join('');

    })();

})();
