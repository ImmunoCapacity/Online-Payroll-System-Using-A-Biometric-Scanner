(function () {
    const GRACE_MINUTES = 15;

    const employees = [
        { id: 'EMP-2021-014', name: 'Dr. Maria Santos', type: 'Faculty', initials: 'MS', enrolled: true, enrolledDate: '2024-08-12' },
        { id: 'EMP-2022-031', name: 'Prof. James Rivera', type: 'Faculty', initials: 'JR', enrolled: true, enrolledDate: '2024-09-03' },
        { id: 'EMP-2023-007', name: 'Anna Cruz', type: 'Admin', initials: 'AC', enrolled: false },
        { id: 'EMP-2020-052', name: 'Roberto Mendoza', type: 'Faculty', initials: 'RM', enrolled: false },
        { id: 'EMP-2021-089', name: 'Elena Villanueva', type: 'Admin', initials: 'EV', enrolled: true, enrolledDate: '2024-07-22' },
        { id: 'EMP-2024-003', name: 'Michael Tan', type: 'Faculty', initials: 'MT', enrolled: false },
        { id: 'EMP-2022-045', name: 'Grace Lim', type: 'Admin', initials: 'GL', enrolled: true, enrolledDate: '2025-01-15' },
        { id: 'EMP-2023-019', name: 'Dr. Patricia Go', type: 'Faculty', initials: 'PG', enrolled: true, enrolledDate: '2024-11-08' }
    ];

    let selectedId = null;
    let isScanning = false;
    let deviceConnected = true;

    const employeeList = document.getElementById('employeeList');
    const employeeSearch = document.getElementById('employeeSearch');
    const enrollPanel = document.getElementById('enrollPanel');
    const deviceDot = document.getElementById('deviceDot');
    const deviceStatus = document.getElementById('deviceStatus');

    function badgeClass(type) {
        return type === 'Faculty' ? 'pp-badge-faculty' : 'pp-badge-admin';
    }

    function getFilteredEmployees() {
        const q = employeeSearch.value.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter(function (e) {
            return e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q);
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
                    '<div class="pp-avatar" aria-hidden="true">' + emp.initials + '</div>' +
                    '<div class="flex-grow-1 min-width-0">' +
                        '<div class="pp-employee-name text-truncate">' + emp.name + '</div>' +
                        '<div class="pp-employee-id">' + emp.id + '</div>' +
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

        if (emp.enrolled) {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel">' +
                    '<div class="pp-avatar mb-3" style="width:64px;height:64px;font-size:1.25rem;">' + emp.initials + '</div>' +
                    '<div class="pp-selected-name">' + emp.name + '</div>' +
                    '<div class="pp-selected-meta">' + emp.id + ' · <span class="pp-badge ' + badgeClass(emp.type) + '">' + emp.type + '</span></div>' +
                    '<span class="pp-badge-enrolled"><i class="bi bi-check-circle-fill me-1"></i> Enrolled</span>' +
                    '<p class="pp-enrolled-info">Fingerprint registered on ' + formatDate(emp.enrolledDate) + '</p>' +
                    '<button type="button" class="btn btn-pp-outline" id="btnReenroll" ' + (deviceConnected ? '' : 'disabled') + '>' +
                        '<i class="bi bi-arrow-repeat me-1"></i> Re-enroll' +
                    '</button>' +
                    (!deviceConnected ? '<p class="small text-danger mt-2 mb-0">Scanner disconnected. Re-enrollment unavailable.</p>' : '') +
                '</div>';
            document.getElementById('btnReenroll').addEventListener('click', function () { startScan(emp, true); });
        } else {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel">' +
                    '<div class="pp-avatar mb-3" style="width:64px;height:64px;font-size:1.25rem;">' + emp.initials + '</div>' +
                    '<div class="pp-selected-name">' + emp.name + '</div>' +
                    '<div class="pp-selected-meta">' + emp.id + ' · <span class="pp-badge ' + badgeClass(emp.type) + '">' + emp.type + '</span></div>' +
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
                document.getElementById('btnScan').addEventListener('click', function () { startScan(emp, false); });
            }
        }
    }

    function selectEmployee(id) {
        selectedId = id;
        isScanning = false;
        renderList();
        renderEnrollPanel(employees.find(function (e) { return e.id === id; }));
    }

    function startScan(emp, isReenroll) {
        if (!deviceConnected || isScanning) return;
        isScanning = true;
        renderEnrollPanel(emp);

        setTimeout(function () {
            emp.enrolled = true;
            emp.enrolledDate = new Date().toISOString().slice(0, 10);
            isScanning = false;
            renderList();
            renderEnrollPanel(emp);
            deviceStatus.innerHTML = '<span class="pp-device-dot connected"></span><span>Connected device: <strong>ZKTeco K40</strong></span>';
            deviceDot.classList.add('connected');
            deviceDot.classList.remove('disconnected');
        }, 1600);
    }

    employeeSearch.addEventListener('input', renderList);
    renderList();
    renderEnrollPanel(null);
})();
