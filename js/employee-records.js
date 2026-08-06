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

    const employees = [
        { id: 'EMP-1001', name: 'Dr. Maria Santos', department: 'Faculty', email: 'maria.santos@institution.edu', phone: '0917-111-2222', status: 'Active', joined: '2020-01-15', notes: 'Department head' },
        { id: 'EMP-1002', name: 'Anna Cruz', department: 'Admin', email: 'anna.cruz@institution.edu', phone: '0917-333-4444', status: 'Active', joined: '2021-06-10', notes: 'Handles HR records' },
        { id: 'EMP-1003', name: 'Prof. James Rivera', department: 'Faculty', email: 'james.rivera@institution.edu', phone: '0917-555-6666', status: 'On Leave', joined: '2019-09-01', notes: 'On sick leave' },
        { id: 'EMP-1004', name: 'Elena Villanueva', department: 'Admin', email: 'elena.villanueva@institution.edu', phone: '0917-777-8888', status: 'Inactive', joined: '2018-02-20', notes: 'Retired last quarter' }
    ];

    let employeeList = employees;

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
    const employeeDepartmentSelect = document.getElementById('employeeDepartmentSelect');
    const employeeEmail = document.getElementById('employeeEmail');
    const employeePhone = document.getElementById('employeePhone');
    const employeeStatusSelect = document.getElementById('employeeStatusSelect');
    const employeeJoined = document.getElementById('employeeJoined');
    const employeeNotes = document.getElementById('employeeNotes');

    function getFilteredEmployees() {
        const q = employeeSearch.value.trim().toLowerCase();
        const department = employeeDepartment.value;
        const status = employeeStatus.value;

        return employeeList.filter(function (employee) {
            const matchesText = !q || (employee.name + ' ' + employee.email).toLowerCase().includes(q);
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
                    '<td><strong>' + employee.name + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + employee.id + '</span></td>' +
                    '<td>' + employee.department + '</td>' +
                    '<td>' + employee.email + '</td>' +
                    '<td>' + employee.phone + '</td>' +
                    '<td><span class="pp-badge ' + (employee.status === 'Active' ? 'pp-badge-present' : employee.status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent') + '">' + employee.status + '</span></td>' +
                    '<td class="text-center"><button type="button" class="btn btn-sm btn-pp-outline me-2" data-action="edit" data-id="' + employee.id + '"><i class="bi bi-pencil"></i></button><button type="button" class="btn btn-sm btn-pp-outline" data-action="delete" data-id="' + employee.id + '"><i class="bi bi-trash"></i></button></td>' +
                '</tr>'
            );
        }).join('');
    }

    function resetForm() {
        employeeForm.reset();
        employeeId.value = '';
        modalTitle.textContent = 'Add Employee';
        employeeStatusSelect.value = 'Active';
        employeeDepartmentSelect.value = '';
        employeeJoined.value = new Date().toISOString().slice(0, 10);
    }

    function openModal(employee) {
        resetForm();
        if (employee) {
            modalTitle.textContent = 'Edit Employee';
            employeeId.value = employee.id;
            employeeName.value = employee.name;
            employeeNumber.value = employee.id;
            employeeDepartmentSelect.value = employee.department;
            employeeEmail.value = employee.email;
            employeePhone.value = employee.phone;
            employeeStatusSelect.value = employee.status;
            employeeJoined.value = employee.joined;
            employeeNotes.value = employee.notes || '';
        }

        const modal = new bootstrap.Modal(employeeModal);
        modal.show();
    }

    function saveEmployee(event) {
        event.preventDefault();

        const payload = {
            id: employeeId.value || 'EMP-' + Date.now().toString().slice(-4),
            name: employeeName.value.trim(),
            department: employeeDepartmentSelect.value,
            email: employeeEmail.value.trim(),
            phone: employeePhone.value.trim(),
            status: employeeStatusSelect.value,
            joined: employeeJoined.value,
            notes: employeeNotes.value.trim()
        };

        if (!payload.name || !payload.department || !payload.email || !payload.phone || !payload.joined) {
            return;
        }

        const existingIndex = employeeList.findIndex(function (item) { return item.id === payload.id; });
        if (existingIndex >= 0) {
            employeeList[existingIndex] = payload;
        } else {
            employeeList.unshift(payload);
        }

        bootstrap.Modal.getInstance(employeeModal).hide();
        renderTable();
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

        if (action === 'delete') {
            employeeList = employeeList.filter(function (item) { return item.id !== id; });
            renderTable();
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

    employeeModal.addEventListener('hidden.bs.modal', resetForm);

    renderTable();
})();
