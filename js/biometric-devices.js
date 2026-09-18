(function () {
    PayrollProLayout.init({
        activeNav: 'biometric',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var devices = DataStore.getDevices();

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

    function persist() {
        DataStore.saveDevices(devices);
    }

    function formatDate(iso) {
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
                    '<td><strong>' + d.deviceName + '</strong></td>' +
                    '<td>' + d.location + '</td>' +
                    '<td>' + d.ipAddress + '</td>' +
                    '<td><span class="pp-badge ' + (d.status === 'Active' ? 'pp-badge-present' : 'pp-badge-absent') + '">' + d.status + '</span></td>' +
                    '<td>' + formatDate(d.dateAdded) + '</td>' +
                    '<td class="col-actions text-center">' +
                        '<button type="button" class="btn btn-sm btn-pp-outline me-2" data-action="edit" data-id="' + d.id + '" aria-label="Edit ' + d.deviceName + '"><i class="bi bi-pencil"></i></button>' +
                        '<button type="button" class="btn btn-sm btn-pp-outline" data-action="delete" data-id="' + d.id + '" aria-label="Delete ' + d.deviceName + '"><i class="bi bi-trash"></i></button>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function resetForm() {
        deviceForm.reset();
        deviceForm.classList.remove('was-validated');
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
                message: 'Delete "' + device.deviceName + '"? Historical attendance logs recorded on this device will keep the device name for reference.',
                confirmText: 'Delete Device',
                tone: 'danger'
            }).then(function (confirmed) {
                if (!confirmed) return;
                devices = devices.filter(function (d) { return d.id !== id; });
                persist();
                renderTable();
                PPToast.success('Device deleted.');
            });
        }
    });

    deviceForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!deviceForm.checkValidity()) {
            deviceForm.classList.add('was-validated');
            return;
        }

        var editingId = deviceId.value ? parseInt(deviceId.value, 10) : null;
        var payload = {
            id: editingId || DataStore.nextNumericId(devices),
            deviceName: deviceName.value.trim(),
            location: deviceLocation.value.trim(),
            ipAddress: deviceIp.value.trim(),
            status: deviceStatusSelect.value,
            dateAdded: editingId ? devices.find(function (d) { return d.id === editingId; }).dateAdded : new Date().toISOString()
        };

        var idx = devices.findIndex(function (d) { return d.id === payload.id; });
        if (idx >= 0) {
            devices[idx] = payload;
        } else {
            devices.unshift(payload);
        }

        persist();
        deviceModal.hide();
        renderTable();
        PPToast.success(editingId ? 'Device updated.' : 'Device added.');
    });

    deviceModalEl.addEventListener('hidden.bs.modal', resetForm);

    renderTable();
})();
