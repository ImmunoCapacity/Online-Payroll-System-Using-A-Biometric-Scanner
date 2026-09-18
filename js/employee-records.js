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

    let employeeList = DataStore.getEmployees();

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

    function persist() {
        DataStore.saveEmployees(employeeList);
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
            employeeEmail.value = employee.email;
            employeePhone.value = employee.phone;
            employeeStatusSelect.value = employee.status;
            employeeJoined.value = employee.dateHired;
            employeeNotes.value = employee.notes || '';
        }

        const modal = new bootstrap.Modal(employeeModal);
        modal.show();
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

        if (DataStore.isEmployeeNumberTaken(number, editingId)) {
            employeeNumber.classList.add('is-invalid');
            if (employeeNumberError) employeeNumberError.textContent = 'This employee number is already in use.';
            employeeNumber.focus();
            return;
        }

        const payload = {
            id: editingId || number,
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

        const existingIndex = employeeList.findIndex(function (item) { return item.id === payload.id; });
        if (existingIndex >= 0) {
            // Preserve fields this form doesn't manage (type, schedule, rate, fingerprint, etc.)
            payload.type = employeeList[existingIndex].type || payload.department;
            employeeList[existingIndex] = Object.assign({}, employeeList[existingIndex], payload);
        } else {
            payload.type = payload.department;
            employeeList.unshift(payload);
        }

        persist();
        bootstrap.Modal.getInstance(employeeModal).hide();
        renderTable();
        PPToast.success(existingIndex >= 0 ? 'Employee updated.' : 'Employee added.');
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
                message: 'Delete ' + match.displayName + ' (' + match.employeeNumber + ')? This will not remove their historical payroll, DTR, leave, or loan records, but they will no longer appear in employee lists. This cannot be undone.',
                confirmText: 'Delete Employee',
                tone: 'danger'
            }).then(function (confirmed) {
                if (!confirmed) return;
                employeeList = employeeList.filter(function (item) { return item.id !== id; });
                persist();
                renderTable();
                PPToast.success('Employee deleted.');
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

    renderTable();

    if (new URLSearchParams(location.search).get('action') === 'add') {
        openModal(null);
    }
})();
