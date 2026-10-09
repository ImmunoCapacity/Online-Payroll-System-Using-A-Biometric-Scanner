/**
 * Biometric Device Sync (Daily Time Record module)
 * ---------------------------------------------------------------
 * The "Sync Device" button on dtr.html pulls attendance logs from the
 * ZKTeco K40 into daily_time_record (POST api/biometric/sync).
 * Available to Payroll Master and Payroll Staff — the server refuses
 * any other role.
 * ---------------------------------------------------------------
 */
(function () {

    'use strict';

    var syncButton = document.getElementById('syncDeviceBtn');

    if (!syncButton) return;

    syncButton.addEventListener('click', function () {

        var originalText = syncButton.innerHTML;

        function restoreLater() {
            setTimeout(function () {
                syncButton.innerHTML = originalText;
            }, 2500);
        }

        function showFailed(message) {
            syncButton.disabled = false;
            syncButton.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Sync Failed';
            if (window.PPToast) PPToast.error(message);
            restoreLater();
        }

        syncButton.disabled = true;
        syncButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Syncing...';

        fetch('api/biometric/sync', { method: 'POST' })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.success) {
                    showFailed(result.data.message || 'Device sync failed.');
                    return;
                }

                syncButton.disabled = false;
                syncButton.innerHTML = '<i class="bi bi-check-circle me-1"></i>Sync Complete';

                // Let the DTR table reload with the new punches.
                document.dispatchEvent(new CustomEvent('pp:dtr-synced'));

                if (window.PPToast) {
                    PPToast.success(
                        'Synced ' + result.data.total_logs_from_device + ' log(s) from the device — ' +
                        result.data.inserted + ' new, ' +
                        result.data.skipped_no_matching_employee + ' unmatched.'
                    );
                }

                restoreLater();
            })
            .catch(function (error) {
                console.error('[Biometric Sync]', error);
                showFailed('Could not reach the sync endpoint. Is the Spring Boot backend running?');
            });
    });

})();
