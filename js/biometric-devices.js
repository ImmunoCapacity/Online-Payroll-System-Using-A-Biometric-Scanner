(function () {
    PayrollProLayout.init({
        activeNav: 'biometric',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var devices = [];

    function api(url, method, body) {
        return fetch(url, {
            method: method || 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) {
            return r.json().catch(function () {
                return { success: false, message: 'Unexpected response from the server.' };
            });
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function loadDevices() {
        api('api/devices').then(function (data) {
            if (!data.success) throw new Error(data.message);
            devices = data.devices;
            renderTable();
        }).catch(function () {
            deviceBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Could not load devices from the server.</td></tr>';
        });
    }

    var deviceBody = document.getElementById('deviceBody');
    var deviceEmpty = document.getElementById('deviceEmpty');
    var addDeviceBtn = document.getElementById('addDeviceBtn');
    var deviceModalEl = document.getElementById('deviceModal');
    var deviceModal = new bootstrap.Modal(deviceModalEl);
    var deviceForm = document.getElementById('deviceForm');
    var deviceId = document.getElementById('deviceId');
    var deviceName = document.getElementById('deviceName');
    var deviceLocation = document.getElementById('deviceLocation');
    var deviceIp = document.getElementById('deviceIp');
    var deviceStatusSelect = document.getElementById('deviceStatusSelect');
    var deviceModalTitle = document.getElementById('deviceModalTitle');

    function formatDate(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderTable() {
        if (!devices.length) {
            deviceBody.innerHTML = '';
            deviceEmpty.classList.remove('d-none');
            return;
        }
        deviceEmpty.classList.add('d-none');
        deviceBody.innerHTML = devices.map(function (d) {
            return (
                '<tr>' +
                    '<td><strong>' + escapeHtml(d.deviceName) + '</strong></td>' +
                    '<td>' + escapeHtml(d.location) + '</td>' +
                    '<td>' + escapeHtml(d.ipAddress) + '</td>' +
                    '<td><span class="pp-badge ' + (d.status === 'Active' ? 'pp-badge-present' : 'pp-badge-absent') + '">' + d.status + '</span></td>' +
                    '<td>' + formatDate(d.dateAdded) + '</td>' +
                    '<td class="col-actions text-center">' +
                        '<button type="button" class="btn btn-sm btn-pp-outline me-2" data-action="edit" data-id="' + d.id + '" aria-label="Edit ' + escapeHtml(d.deviceName) + '"><i class="bi bi-pencil"></i></button>' +
                        '<button type="button" class="btn btn-sm btn-pp-outline" data-action="delete" data-id="' + d.id + '" aria-label="Delete ' + escapeHtml(d.deviceName) + '"><i class="bi bi-trash"></i></button>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function resetForm() {
        deviceForm.reset();
        PPValidate.clear(deviceForm);
        deviceId.value = '';
        deviceModalTitle.textContent = 'Add Device';
        deviceStatusSelect.value = 'Active';
    }

    addDeviceBtn.addEventListener('click', function () {
        resetForm();
        deviceModal.show();
    });

    deviceBody.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;
        var id = parseInt(btn.dataset.id, 10);
        var device = devices.find(function (d) { return d.id === id; });
        if (!device) return;

        if (btn.dataset.action === 'edit') {
            resetForm();
            deviceModalTitle.textContent = 'Edit Device';
            deviceId.value = device.id;
            deviceName.value = device.deviceName;
            deviceLocation.value = device.location;
            deviceIp.value = device.ipAddress;
            deviceStatusSelect.value = device.status;
            deviceModal.show();
        }

        if (btn.dataset.action === 'delete') {
            ConfirmModal.show({
                title: 'Delete Device',
                message: 'Delete "' + device.deviceName + '"? Attendance already recorded from it is kept.',
                confirmText: 'Delete Device',
                tone: 'danger'
            }).then(function (confirmed) {
                if (!confirmed) return;
                api('api/devices/' + id, 'DELETE').then(function (data) {
                    if (!data.success) { PPToast.error(data.message || 'Could not delete the device.'); return; }
                    devices = data.devices;
                    renderTable();
                    PPToast.success('Device deleted.');
                }).catch(function () {
                    PPToast.error('Could not reach the server.');
                });
            });
        }
    });

    deviceForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!PPValidate.validateForm(deviceForm)) {
            return;
        }

        var editingId = deviceId.value ? parseInt(deviceId.value, 10) : null;

        // Two devices can't share a name or an IP address.
        var name = deviceName.value.trim().toLowerCase();
        var ip = deviceIp.value.trim();
        var clash = devices.find(function (d) {
            return d.id !== editingId && (String(d.deviceName).toLowerCase() === name || d.ipAddress === ip);
        });
        if (clash) {
            var sameIp = clash.ipAddress === ip;
            var field = sameIp ? deviceIp : deviceName;
            PPValidate.setError(field, sameIp
                ? 'This IP address is already used by ' + clash.deviceName + '.'
                : 'Another device already has this name.');
            field.focus();
            return;
        }
        var payload = {
            deviceName: deviceName.value.trim(),
            location: deviceLocation.value.trim(),
            ipAddress: deviceIp.value.trim(),
            status: deviceStatusSelect.value
        };

        api(editingId ? 'api/devices/' + editingId : 'api/devices', editingId ? 'PUT' : 'POST', payload).then(function (data) {
            if (!data.success) {
                var fields = { deviceName: 'deviceName', location: 'deviceLocation', ipAddress: 'deviceIp', status: 'deviceStatusSelect' };
                if (!PPValidate.showServerError(deviceForm, data, fields)) PPToast.error(data.message);
                return;
            }
            devices = data.devices;
            deviceModal.hide();
            renderTable();
            PPToast.success(editingId ? 'Device updated.' : 'Device added.');
        }).catch(function () {
            PPToast.error('Could not reach the server.');
        });
    });

    deviceModalEl.addEventListener('hidden.bs.modal', resetForm);

    loadDevices();
})();
