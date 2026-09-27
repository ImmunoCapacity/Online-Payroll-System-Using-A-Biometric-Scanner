(function () {

    'use strict';


    // ============================================================
    // SYSTEM ADMINISTRATOR LAYOUT
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


    // ============================================================
    // STAT CARDS
    // ============================================================

    (function updateStatCards() {

        var employees = DataStore.getEmployees();
        var active = employees.filter(function (e) { return e.status === 'Active'; });
        var faculty = active.filter(function (e) { return e.type === 'Faculty'; }).length;
        var admin = active.filter(function (e) { return e.type === 'Admin'; }).length;

        var users = DataStore.getUsers();
        var activeUsers = users.filter(function (u) { return u.active; });

        var devices = DataStore.getDevices();
        var anyDeviceOnline = devices.some(function (d) { return d.status === 'Active'; });

        document.getElementById('statTotalEmployees').textContent = active.length;
        document.getElementById('statTotalEmployeesMeta').textContent = faculty + ' Faculty · ' + admin + ' Admin Staff';
        document.getElementById('statSystemUsers').textContent = users.length;
        document.getElementById('statActiveUsers').textContent = activeUsers.length;
        document.getElementById('statActiveUsersMeta').textContent = (users.length - activeUsers.length) + ' account' + ((users.length - activeUsers.length) !== 1 ? 's' : '') + ' inactive';
        document.getElementById('statDeviceStatus').textContent = anyDeviceOnline ? 'Online' : 'Offline';

    })();


    // ============================================================
    // BIOMETRIC DEVICE SYNC
    // ============================================================

    var syncButton =
        document.getElementById(
            'syncDeviceBtn'
        );


    if (syncButton) {

        syncButton.addEventListener(
            'click',
            function () {

                var originalText =
                    syncButton.innerHTML;


                syncButton.disabled = true;


                syncButton.innerHTML =
                    '<span class="spinner-border spinner-border-sm me-1"></span>' +
                    'Syncing...';


                fetch('api/fingerprint-sync.php')
                    .then(function (response) {
                        return response.json().then(function (data) {
                            return { ok: response.ok, data: data };
                        });
                    })
                    .then(function (result) {
                        syncButton.disabled = false;

                        if (result.ok && result.data.success) {
                            syncButton.innerHTML =
                                '<i class="bi bi-check-circle me-1"></i>' +
                                'Sync Complete';

                            if (window.PPToast) {
                                PPToast.success(
                                    'Synced ' + result.data.total_logs_from_device + ' log(s) from the device — ' +
                                    result.data.inserted + ' new, ' +
                                    result.data.skipped_no_matching_employee + ' unmatched.'
                                );
                            }
                        } else {
                            syncButton.innerHTML =
                                '<i class="bi bi-exclamation-triangle me-1"></i>' +
                                'Sync Failed';

                            if (window.PPToast) {
                                PPToast.error(result.data.message || 'Device sync failed.');
                            }
                        }

                        setTimeout(function () {
                            syncButton.innerHTML = originalText;
                        }, 2500);
                    })
                    .catch(function (error) {
                        syncButton.disabled = false;
                        syncButton.innerHTML =
                            '<i class="bi bi-exclamation-triangle me-1"></i>' +
                            'Sync Failed';

                        if (window.PPToast) {
                            PPToast.error('Could not reach the sync endpoint. Is the PHP backend running?');
                        }

                        console.error('[Biometric Sync]', error);

                        setTimeout(function () {
                            syncButton.innerHTML = originalText;
                        }, 2500);
                    });

            }
        );

    }

})();