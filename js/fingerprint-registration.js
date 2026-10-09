/**
 * Fingerprint Registration (paper, module 1.0)
 * ---------------------------------------------------------------
 * The fingerprint itself is captured and stored on the ZKTeco K40.
 * This page records which device "User ID" belongs to which employee
 * (api/fingerprints). Every punch the K40 records carries that User ID,
 * which is how "Sync Device" on the DTR page matches it to the employee.
 * ---------------------------------------------------------------
 */
(function () {
    PayrollProLayout.init({
        activeNav: 'fingerprint',
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    let employees = [];
    let nextDeviceUserId = '1';
    let selectedId = null;

    const employeeList = document.getElementById('employeeList');
    const employeeSearch = document.getElementById('employeeSearch');
    const enrollPanel = document.getElementById('enrollPanel');
    const deviceDot = document.getElementById('deviceDot');
    const deviceNameLabel = document.getElementById('deviceNameLabel');

    deviceNameLabel.textContent = 'ZKTeco K40';
    deviceDot.className = 'pp-device-dot connected';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function api(url, options) {
        return fetch(url, options).then(function (response) {
            return response.json().catch(function () {
                return { success: false, message: 'Unexpected response from the server.' };
            });
        });
    }

    function initials(emp) {
        return emp.displayName.split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }

    function badgeClass(type) {
        return type === 'Faculty' ? 'pp-badge-faculty' : type === 'Faculty/Admin' ? 'pp-badge-faculty-admin' : 'pp-badge-admin';
    }

    function selected() {
        return employees.find(function (e) { return e.id === selectedId; }) || null;
    }

    function load() {
        return api('api/fingerprints').then(function (data) {
            if (!data.success) throw new Error(data.message || 'Failed to load employees.');
            employees = data.employees;
            nextDeviceUserId = data.nextDeviceUserId;
            renderList();
            renderEnrollPanel(selected());
        }).catch(function (error) {
            console.error('[Fingerprint Registration]', error);
            employeeList.innerHTML = '<div class="pp-empty-state">Could not load employees from the server. Is the Spring Boot backend running?</div>';
        });
    }

    function renderList() {
        const q = employeeSearch.value.trim().toLowerCase();
        const filtered = employees.filter(function (e) {
            return !q || e.displayName.toLowerCase().includes(q) || String(e.employeeNumber).toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            employeeList.innerHTML = '<div class="pp-empty-state">' +
                (employees.length ? 'No employees match your search.' : 'No employees yet. Add them in Employee Records.') +
                '</div>';
            return;
        }

        employeeList.innerHTML = filtered.map(function (emp) {
            const active = emp.id === selectedId ? ' active' : '';
            const registered = emp.fingerprintId
                ? '<i class="bi bi-fingerprint text-success ms-1" title="Registered as device User ID ' + escapeHtml(emp.fingerprintId) + '"></i>'
                : '';
            return (
                '<div class="pp-employee-item' + active + '" role="option" aria-selected="' + (active ? 'true' : 'false') + '" data-id="' + emp.id + '" tabindex="0">' +
                    '<div class="pp-avatar" aria-hidden="true">' + escapeHtml(initials(emp)) + '</div>' +
                    '<div class="flex-grow-1 min-width-0">' +
                        '<div class="pp-employee-name text-truncate">' + escapeHtml(emp.displayName) + registered + '</div>' +
                        '<div class="pp-employee-id">' + escapeHtml(emp.employeeNumber) + '</div>' +
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

    function header(emp) {
        return (
            '<div class="pp-avatar mb-3" style="width:64px;height:64px;font-size:1.25rem;">' + escapeHtml(initials(emp)) + '</div>' +
            '<div class="pp-selected-name">' + escapeHtml(emp.displayName) + '</div>' +
            '<div class="pp-selected-meta">' + escapeHtml(emp.employeeNumber) + ' · <span class="pp-badge ' + badgeClass(emp.type) + '">' + emp.type + '</span></div>'
        );
    }

    function renderEnrollPanel(emp) {
        if (!emp) {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel pp-no-selection">' +
                    '<i class="bi bi-person-lines-fill display-4 text-muted mb-3"></i>' +
                    '<p>Select an employee from the list to register their fingerprint.</p>' +
                '</div>';
            return;
        }

        if (emp.fingerprintId) {
            enrollPanel.innerHTML =
                '<div class="pp-enroll-panel">' +
                    header(emp) +
                    '<span class="pp-badge-enrolled"><i class="bi bi-check-circle-fill me-1"></i> Registered</span>' +
                    '<p class="pp-enrolled-info">Device User ID <strong>' + escapeHtml(emp.fingerprintId) + '</strong> on the K40. ' +
                        'Punches from this User ID are recorded as ' + escapeHtml(emp.displayName) + '’s attendance.</p>' +
                    '<div class="d-flex gap-2 justify-content-center">' +
                        '<button type="button" class="btn btn-pp-outline" id="btnChange"><i class="bi bi-pencil me-1"></i> Change User ID</button>' +
                        '<button type="button" class="btn btn-pp-outline" id="btnRemove"><i class="bi bi-x-circle me-1"></i> Remove</button>' +
                    '</div>' +
                '</div>';
            document.getElementById('btnChange').addEventListener('click', function () { renderForm(emp, emp.fingerprintId); });
            document.getElementById('btnRemove').addEventListener('click', function () { removeRegistration(emp); });
            return;
        }

        renderForm(emp, nextDeviceUserId);
    }

    // Steps follow how enrollment works on the K40: the finger is scanned on
    // the device under a User ID, and that same User ID is saved here.
    function renderForm(emp, value) {
        enrollPanel.innerHTML =
            '<div class="pp-enroll-panel">' +
                header(emp) +
                '<div class="pp-scanner-icon" aria-hidden="true"><i class="bi bi-fingerprint"></i></div>' +
                '<ol class="text-start small mb-3" style="max-width: 26rem;">' +
                    '<li>On the K40, go to <strong>Menu → User Mgt → New User</strong>.</li>' +
                    '<li>Enter the User ID below, then choose <strong>FP</strong> and have the employee scan the same finger three times.</li>' +
                    '<li>Save on the device, then click <strong>Save Registration</strong> here.</li>' +
                '</ol>' +
                '<form id="registerForm" class="w-100" style="max-width: 18rem;" novalidate>' +
                    '<label for="deviceUserId" class="pp-form-label">Device User ID</label>' +
                    '<div class="mb-3">' +
                        '<input type="text" inputmode="numeric" maxlength="9" class="form-control pp-form-control" id="deviceUserId" value="' + escapeHtml(value) + '" ' +
                            'data-validate="number" data-decimals="0" min="1" max="999999999" required>' +
                        '<div class="invalid-feedback"></div>' +
                    '</div>' +
                    '<button type="submit" class="btn btn-pp-primary w-100" id="btnSave"><i class="bi bi-check-lg me-1"></i> Save Registration</button>' +
                '</form>' +
            '</div>';

        const form = document.getElementById('registerForm');
        const input = document.getElementById('deviceUserId');
        PPValidate.attach(form);

        // Digits only, and not already used by another employee.
        input.addEventListener('input', function () {
            const digits = input.value.replace(/\D/g, '');
            if (digits !== input.value) input.value = digits;
        });
        input.ppValidator = function (text) {
            const id = String(Number(text));
            const owner = employees.find(function (e) {
                return e.id !== emp.id && e.fingerprintId === id;
            });
            return owner ? 'Device User ID ' + id + ' is already assigned to ' + owner.displayName + '.' : '';
        };

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!PPValidate.validateForm(form)) return;
            saveRegistration(emp, input.value.trim());
        });
    }

    function saveRegistration(emp, deviceUserId) {
        const btn = document.getElementById('btnSave');
        btn.disabled = true;
        api('api/fingerprints/' + encodeURIComponent(emp.id), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fingerprintId: deviceUserId })
        }).then(function (data) {
            btn.disabled = false;
            if (!data.success) {
                // Any rejection here is about the User ID, so show it beside the field.
                PPValidate.setError(document.getElementById('deviceUserId'), data.message || 'Could not save the registration.');
                return;
            }
            PPToast.success(emp.displayName + ' is registered as device User ID ' + data.employee.fingerprintId + '.');
            load();
        }).catch(function () {
            btn.disabled = false;
            PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
        });
    }

    function removeRegistration(emp) {
        ConfirmModal.show({
            title: 'Remove Fingerprint Registration',
            message: 'Remove device User ID ' + emp.fingerprintId + ' from ' + emp.displayName + '? Their punches will no longer be matched until they are registered again. Also delete the user on the K40.',
            confirmText: 'Remove',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            api('api/fingerprints/' + encodeURIComponent(emp.id), { method: 'DELETE' }).then(function (data) {
                if (!data.success) {
                    PPToast.error(data.message || 'Could not remove the registration.');
                    return;
                }
                PPToast.success('Registration removed.');
                load();
            });
        });
    }

    function selectEmployee(id) {
        selectedId = id;
        renderList();
        renderEnrollPanel(selected());
    }

    employeeSearch.addEventListener('input', renderList);

    load();
})();
