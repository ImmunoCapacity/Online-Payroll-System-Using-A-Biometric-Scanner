(function () {
    PayrollProLayout.init({
        activeNav: 'fingerprint',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    let employees = DataStore.getEmployees();
    const devices = DataStore.getDevices();
    const activeDevice = devices.find(function (d) { return d.status === 'Active'; }) || devices[0];

    let selectedId = null;
    let isScanning = false;
    let deviceConnected = activeDevice ? activeDevice.status === 'Active' : true;

    const employeeList = document.getElementById('employeeList');
    const employeeSearch = document.getElementById('employeeSearch');
    const enrollPanel = document.getElementById('enrollPanel');
    const deviceDot = document.getElementById('deviceDot');
    const deviceStatus = document.getElementById('deviceStatus');
    const deviceNameLabel = document.getElementById('deviceNameLabel');

    deviceNameLabel.textContent = activeDevice ? activeDevice.deviceName : 'No device registered';

    function persist() {
        DataStore.saveEmployees(employees);
    }

    function initials(emp) {
        var parts = emp.displayName.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s*/, '').split(' ');
        return parts.map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }

    function badgeClass(type) {
        return type === 'Faculty' ? 'pp-badge-faculty' : 'pp-badge-admin';
    }

    function getFilteredEmployees() {
        const q = employeeSearch.value.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter(function (e) {
            return e.displayName.toLowerCase().includes(q) || e.employeeNumber.toLowerCase().includes(q);
        });
    }

    function renderList() {
        const filtered = getFilteredEmployees();
        if (filtered.length === 0) {
            employeeList.innerHTML = '<div class="pp-empty-state">No employees match your search.</div>';
            return;
        }

        employeeList.innerHTML = filtered.map(function (emp) {
            const active = emp.id === selectedId ? ' active' : '';
            return (
                '<div class="pp-employee-item' + active + '" role="option" aria-selected="' + (active ? 'true' : 'false') + '" data-id="' + emp.id + '" tabindex="0">' +
                    '<div class="pp-avatar" aria-hidden="true">' + initials(emp) + '</div>' +
                    '<div class="flex-grow-1 min-width-0">' +
                        '<div class="pp-employee-name text-truncate">' + emp.displayName + '</div>' +
                        '<div class="pp-employee-id">' + emp.employeeNumber + '</div>' +
                    '</div>' +
                    '<span class="pp-badge ' + badgeClass(emp.type) + '">' + emp.type + '</span>' +
                '</div>'
            );
        }).join('');

        employeeList.querySelectorAll('.pp-employee-item').forEach(function (el) {
            el.addEventListener('click', function () { selectEmployee(el.dataset.id); });
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectEmployee(el.dataset.id);
                }
            });
        });
    }

    function formatDate(iso) {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    function renderEnrollPanel(emp) {
        if (!emp) {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel pp-no-selection" id="emptyState">' +
                    '<i class="bi bi-person-lines-fill display-4 text-muted mb-3"></i>' +
                    '<p>Select an employee from the list to view or manage fingerprint enrollment.</p>' +
                '</div>';
            return;
        }

        if (emp.fingerprintEnrolled) {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel">' +
                    '<div class="pp-avatar mb-3" style="width:64px;height:64px;font-size:1.25rem;">' + initials(emp) + '</div>' +
                    '<div class="pp-selected-name">' + emp.displayName + '</div>' +
                    '<div class="pp-selected-meta">' + emp.employeeNumber + ' · <span class="pp-badge ' + badgeClass(emp.type) + '">' + emp.type + '</span></div>' +
                    '<span class="pp-badge-enrolled"><i class="bi bi-check-circle-fill me-1"></i> Enrolled</span>' +
                    '<p class="pp-enrolled-info">Fingerprint registered on ' + formatDate(emp.fingerprintEnrolledDate) + '</p>' +
                    '<button type="button" class="btn btn-pp-outline" id="btnReenroll" ' + (deviceConnected ? '' : 'disabled') + '>' +
                        '<i class="bi bi-arrow-repeat me-1"></i> Re-enroll' +
                    '</button>' +
                    (!deviceConnected ? '<p class="small text-danger mt-2 mb-0">Scanner disconnected. Re-enrollment unavailable.</p>' : '') +
                '</div>';
            document.getElementById('btnReenroll').addEventListener('click', function () { startScan(emp); });
        } else {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel">' +
                    '<div class="pp-avatar mb-3" style="width:64px;height:64px;font-size:1.25rem;">' + initials(emp) + '</div>' +
                    '<div class="pp-selected-name">' + emp.displayName + '</div>' +
                    '<div class="pp-selected-meta">' + emp.employeeNumber + ' · <span class="pp-badge ' + badgeClass(emp.type) + '">' + emp.type + '</span></div>' +
                    '<div class="pp-scanner-icon' + (isScanning ? ' scanning' : '') + '" id="scannerIcon" aria-hidden="true">' +
                        '<i class="bi bi-fingerprint"></i>' +
                    '</div>' +
                    '<p class="pp-enroll-instruction" id="scanInstruction">' +
                        (isScanning
                            ? 'Scanning… Ask the employee to place their finger on the scanner.'
                            : 'Ask the employee to place their finger on the scanner') +
                    '</p>' +
                    '<button type="button" class="btn btn-pp-primary px-4" id="btnScan" ' + (isScanning || !deviceConnected ? 'disabled' : '') + '>' +
                        (isScanning
                            ? '<span class="spinner-border spinner-border-sm me-2"></span>Scanning…'
                            : '<i class="bi bi-fingerprint me-1"></i> Scan Fingerprint') +
                    '</button>' +
                    (!deviceConnected ? '<p class="small text-danger mt-2 mb-0">Scanner disconnected. Connect the device to enroll.</p>' : '') +
                '</div>';
            if (!isScanning) {
                document.getElementById('btnScan').addEventListener('click', function () { startScan(emp); });
            }
        }
    }

    function selectEmployee(id) {
        selectedId = id;
        isScanning = false;
        renderList();
        renderEnrollPanel(employees.find(function (e) { return e.id === id; }));
    }

    function startScan(emp) {
        if (!deviceConnected || isScanning) return;
        isScanning = true;
        renderEnrollPanel(emp);

        setTimeout(function () {
            emp.fingerprintEnrolled = true;
            emp.fingerprintEnrolledDate = new Date().toISOString().slice(0, 10);
            emp.fingerprintId = 'FP-' + emp.employeeNumber;
            persist();
            isScanning = false;
            renderList();
            renderEnrollPanel(emp);
            PPToast.success(emp.displayName + '\u2019s fingerprint has been enrolled.');
        }, 2500);
    }

    function setDeviceConnected(connected) {
        deviceConnected = connected;
        deviceDot.className = 'pp-device-dot ' + (connected ? 'connected' : 'disconnected');
        deviceStatus.setAttribute('title', connected ? 'Device online' : 'Device offline — check USB/network connection');
        if (selectedId) {
            renderEnrollPanel(employees.find(function (e) { return e.id === selectedId; }));
        }
    }

    employeeSearch.addEventListener('input', renderList);

    renderList();

    /* Demo: double-click device status to simulate a disconnect */
    deviceStatus.addEventListener('dblclick', function () {
        setDeviceConnected(!deviceConnected);
    });
    deviceStatus.style.cursor = 'help';
    deviceStatus.title = 'Double-click to simulate disconnect (demo only)';
})();
