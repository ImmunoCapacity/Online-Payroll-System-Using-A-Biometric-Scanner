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


                setTimeout(function () {

                    syncButton.disabled = false;


                    syncButton.innerHTML =
                        '<i class="bi bi-check-circle me-1"></i>' +
                        'Sync Complete';


                    setTimeout(function () {

                        syncButton.innerHTML =
                            originalText;

                    }, 2000);


                }, 1500);

            }
        );

    }

})();