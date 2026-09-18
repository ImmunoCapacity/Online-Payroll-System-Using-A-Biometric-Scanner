(function () {
    PayrollProLayout.init({
        activeNav: 'employees',
        user: {
            name: 'Maria Elena Reyes',
            role: 'Payroll Master',
            initials: 'MR'
        },
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    let employeeList = [];

    const employeeSearch = document.getElementById('employeeSearch');
    const employeeDepartment = document.getElementById('employeeDepartment');
    const employeeStatus = document.getElementById('employeeStatus');
    const employeeBody = document.getElementById('employeeBody');
    const emptyState = document.getElementById('emptyState');
    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    const employeeModal = document.getElementById('employeeModal');
    const employeeForm = document.getElementById('employeeForm');
    const modalTitle = document.getElementById('employeeModalTitle');
    const employeeId = document.getElementById('employeeId');
    const employeeName = document.getElementById('employeeName');
    const employeeNumber = document.getElementById('employeeNumber');
    const employeeNumberError = document.getElementById('employeeNumberError');
    const employeeDepartmentSelect = document.getElementById('employeeDepartmentSelect');
    const employeeEmail = document.getElementById('employeeEmail');
    const employeePhone = document.getElementById('employeePhone');
    const employeeStatusSelect = document.getElementById('employeeStatusSelect');
    const employeeJoined = document.getElementById('employeeJoined');
    const employeeNotes = document.getElementById('employeeNotes');
    const saveButton = employeeForm.querySelector('button[type="submit"]');

    // ================================================================
    // LOAD FROM THE REAL DATABASE (api/employees/list.php)
    // ================================================================

    function loadEmployees() {
        employeeBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading employees…</td></tr>';
        emptyState.classList.add('d-none');

        return fetch('api/employees/list.php')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) {
                    throw new Error(data.message || 'Failed to load employees.');
                }
                employeeList = data.employees;
                renderTable();
            })
            .catch(function (error) {
                employeeBody.innerHTML = '';
                emptyState.textContent = 'Could not load employees from the server. Is the PHP backend running and the database reachable?';
                emptyState.classList.remove('d-none');
                console.error('[Employee Records]', error);
            });
    }

    function getFilteredEmployees() {
        const q = employeeSearch.value.trim().toLowerCase();
        const department = employeeDepartment.value;
        const status = employeeStatus.value;

        return employeeList.filter(function (employee) {
            const matchesText = !q || (employee.displayName + ' ' + employee.email).toLowerCase().includes(q);
            const matchesDepartment = department === 'all' || employee.department === department;
            const matchesStatus = status === 'all' || employee.status === status;
            return matchesText && matchesDepartment && matchesStatus;
        });
    }

    function updateSummary() {
        document.getElementById('summaryActive').textContent = employeeList.filter(function (e) { return e.status === 'Active'; }).length;
        document.getElementById('summaryFaculty').textContent = employeeList.filter(function (e) { return e.department === 'Faculty'; }).length;
        document.getElementById('summaryAdmin').textContent = employeeList.filter(function (e) { return e.department === 'Admin'; }).length;
    }

    function renderTable() {
        const rows = getFilteredEmployees();
        updateSummary();

        if (rows.length === 0) {
            employeeBody.innerHTML = '';
            emptyState.textContent = 'No employees match your search.';
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        employeeBody.innerHTML = rows.map(function (employee) {
            return (
                '<tr>' +
                    '<td><strong>' + employee.displayName + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + employee.employeeNumber + '</span></td>' +
                    '<td>' + employee.department + '</td>' +
                    '<td>' + employee.email + '</td>' +
                    '<td>' + employee.phone + '</td>' +
                    '<td><span class="pp-badge ' + (employee.status === 'Active' ? 'pp-badge-present' : employee.status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent') + '">' + employee.status + '</span></td>' +
                    '<td class="text-center">' +
                        '<button type="button" class="btn btn-sm btn-pp-outline me-2" data-action="edit" data-id="' + employee.id + '" aria-label="Edit ' + employee.displayName + '"><i class="bi bi-pencil"></i></button>' +
                        '<button type="button" class="btn btn-sm btn-pp-outline" data-action="delete" data-id="' + employee.id + '" aria-label="Delete ' + employee.displayName + '"><i class="bi bi-trash"></i></button>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function clearNumberError() {
        employeeNumber.classList.remove('is-invalid');
        if (employeeNumberError) employeeNumberError.textContent = '';
    }

    function resetForm() {
        employeeForm.reset();
        employeeId.value = '';
        modalTitle.textContent = 'Add Employee';
        employeeStatusSelect.value = 'Active';
        employeeDepartmentSelect.value = '';
        employeeDepartmentSelect.disabled = false;
        employeeJoined.value = new Date().toISOString().slice(0, 10);
        clearNumberError();
    }

    function openModal(employee) {
        resetForm();
        if (employee) {
            modalTitle.textContent = 'Edit Employee';
            employeeId.value = employee.id;
            employeeName.value = employee.displayName;
            employeeNumber.value = employee.employeeNumber;
            employeeDepartmentSelect.value = employee.department;
            // Department decides which database table a row lives in and
            // can't be changed after creation without moving that history —
            // see api/employees/update.php.
            employeeDepartmentSelect.disabled = true;
            employeeEmail.value = employee.email;
            employeePhone.value = employee.phone;
            employeeStatusSelect.value = employee.status;
            employeeJoined.value = employee.dateHired;
            employeeNotes.value = employee.notes || '';
        }

        const modal = new bootstrap.Modal(employeeModal);
        modal.show();
    }

    function setSaving(saving) {
        saveButton.disabled = saving;
        saveButton.textContent = saving ? 'Saving…' : 'Save Employee';
    }

    function saveEmployee(event) {
        event.preventDefault();
        clearNumberError();

        const editingId = employeeId.value || null;
        const number = employeeNumber.value.trim();

        if (!number) {
            employeeNumber.classList.add('is-invalid');
            if (employeeNumberError) employeeNumberError.textContent = 'Employee number is required.';
            employeeNumber.focus();
            return;
        }

        const payload = {
            employeeNumber: number,
            displayName: employeeName.value.trim(),
            department: employeeDepartmentSelect.value,
            email: employeeEmail.value.trim(),
            phone: employeePhone.value.trim(),
            status: employeeStatusSelect.value,
            dateHired: employeeJoined.value,
            notes: employeeNotes.value.trim()
        };

        if (!payload.displayName || !payload.department || !payload.email || !payload.phone || !payload.dateHired) {
            return;
        }

        var url = editingId ? 'api/employees/update.php' : 'api/employees/create.php';
        if (editingId) {
            payload.id = editingId;
        }

        setSaving(true);

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                setSaving(false);

                if (!data.success) {
                    employeeNumber.classList.add('is-invalid');
                    if (employeeNumberError) employeeNumberError.textContent = data.message || 'Could not save employee.';
                    return;
                }

                bootstrap.Modal.getInstance(employeeModal).hide();
                PPToast.success(editingId ? 'Employee updated.' : 'Employee added.');
                loadEmployees();
            })
            .catch(function (error) {
                setSaving(false);
                PPToast.error('Could not reach the server. Is the PHP backend running?');
                console.error('[Employee Records]', error);
            });
    }

    employeeBody.addEventListener('click', function (event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.getAttribute('data-action');
        const id = button.getAttribute('data-id');
        const match = employeeList.find(function (item) { return item.id === id; });

        if (action === 'edit' && match) {
            openModal(match);
        }

        if (action === 'delete' && match) {
            ConfirmModal.show({
                title: 'Delete Employee',
                message: 'Delete ' + match.displayName + ' (' + match.employeeNumber + ')? This will also remove their historical payroll, DTR, leave, and loan records. This cannot be undone.',
                confirmText: 'Delete Employee',
                tone: 'danger'
            }).then(function (confirmed) {
                if (!confirmed) return;

                fetch('api/employees/delete.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: id })
                })
                    .then(function (response) { return response.json(); })
                    .then(function (data) {
                        if (!data.success) {
                            PPToast.error(data.message || 'Could not delete employee.');
                            return;
                        }
                        PPToast.success('Employee deleted.');
                        loadEmployees();
                    })
                    .catch(function (error) {
                        PPToast.error('Could not reach the server. Is the PHP backend running?');
                        console.error('[Employee Records]', error);
                    });
            });
        }
    });

    addEmployeeBtn.addEventListener('click', function () {
        openModal(null);
    });

    employeeForm.addEventListener('submit', saveEmployee);
    [employeeSearch, employeeDepartment, employeeStatus].forEach(function (field) {
        field.addEventListener('input', renderTable);
        field.addEventListener('change', renderTable);
    });

    employeeNumber.addEventListener('input', clearNumberError);

    employeeModal.addEventListener('hidden.bs.modal', resetForm);

    loadEmployees().then(function () {
        if (new URLSearchParams(location.search).get('action') === 'add') {
            openModal(null);
        }
    });
})();
