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
    const employeeFirstName = document.getElementById('employeeFirstName');
    const employeeLastName = document.getElementById('employeeLastName');
    const employeeNumber = document.getElementById('employeeNumber');
    const employeeNumberError = document.getElementById('employeeNumberError');
    const employeeDepartmentSelect = document.getElementById('employeeDepartmentSelect');
    const employeeEmail = document.getElementById('employeeEmail');
    const employeePhone = document.getElementById('employeePhone');
    const employeeStatusSelect = document.getElementById('employeeStatusSelect');
    const employeeJoined = document.getElementById('employeeJoined');
    const employeeNotes = document.getElementById('employeeNotes');
    const saveButton = employeeForm.querySelector('button[type="submit"]');
    const facultyFields = document.getElementById('facultyFields');
    const adminFields = document.getElementById('adminFields');

    // Extra fields from the paper's Data Dictionary (Tables 1 and 2):
    // API field name -> form input id. number: true sends a number (or null).
    const PROFILE_FIELDS = {
        middleName: { id: 'employeeMiddleName' },
        gender: { id: 'employeeGender' },
        birthdate: { id: 'employeeBirthdate' },
        civilStatus: { id: 'employeeCivilStatus' },
        dependents: { id: 'employeeDependents', number: true },
        address: { id: 'employeeAddress' },
        employeeType: { id: 'employeeType' },
        sssId: { id: 'employeeSssId' },
        philhealthId: { id: 'employeePhilhealthId' },
        pagibigId: { id: 'employeePagibigId' },
        tinId: { id: 'employeeTinId' }
    };
    const FACULTY_FIELDS = {
        instructorRank: { id: 'employeeRank' },
        rate: { id: 'employeeRateUnit', number: true },
        loadUnits: { id: 'employeeLoadUnits', number: true },
        lectureHours: { id: 'employeeLectureHours', number: true }
    };
    const ADMIN_FIELDS = {
        officeDepartment: { id: 'employeeOfficeDept' },
        position: { id: 'employeePosition' },
        rate: { id: 'employeeRateHour', number: true },
        officeHours: { id: 'employeeOfficeHours', number: true }
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Faculty/Admin (admin staff who also teach) have both sets of fields:
    // rate is their office rate per hour, teachingRate their rate per hour/unit.
    const FACULTY_ADMIN_FIELDS = Object.assign({}, ADMIN_FIELDS, {
        instructorRank: FACULTY_FIELDS.instructorRank,
        teachingRate: { id: 'employeeRateUnit', number: true },
        loadUnits: FACULTY_FIELDS.loadUnits,
        lectureHours: FACULTY_FIELDS.lectureHours
    });

    function typeFields(department) {
        if (department === 'Faculty') return FACULTY_FIELDS;
        if (department === 'Admin') return ADMIN_FIELDS;
        if (department === 'Faculty/Admin') return FACULTY_ADMIN_FIELDS;
        return {};
    }

    function readFields(fields, payload) {
        Object.keys(fields).forEach(function (key) {
            const value = document.getElementById(fields[key].id).value.trim();
            payload[key] = value === '' ? null : (fields[key].number ? Number(value) : value);
        });
    }

    function fillFields(fields, employee) {
        Object.keys(fields).forEach(function (key) {
            const value = employee[key];
            document.getElementById(fields[key].id).value = value == null ? '' : value;
        });
    }

    // Faculty and Admin staff have different employment fields; Faculty/Admin get both.
    function toggleTypeFields(department) {
        const both = department === 'Faculty/Admin';
        facultyFields.classList.toggle('d-none', department !== 'Faculty' && !both);
        adminFields.classList.toggle('d-none', department !== 'Admin' && !both);
        document.getElementById('employeeRateUnitLabel').textContent =
            both ? 'Teaching Rate per Hour/Unit (₱)' : 'Rate per Hour/Unit (₱)';
    }

    // ================================================================
    // LOAD FROM THE REAL DATABASE (GET api/employees)
    // ================================================================

    function loadEmployees() {
        employeeBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading employees…</td></tr>';
        emptyState.classList.add('d-none');

        return fetch('api/employees')
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
                emptyState.textContent = 'Could not load employees from the server. Is the Spring Boot backend running and the database reachable?';
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
        document.getElementById('summaryFacultyAdmin').textContent = employeeList.filter(function (e) { return e.department === 'Faculty/Admin'; }).length;
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
            const name = escapeHtml(employee.displayName);
            return (
                '<tr>' +
                    '<td><strong>' + name + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + escapeHtml(employee.employeeNumber) + '</span></td>' +
                    '<td>' + escapeHtml(employee.department) + '</td>' +
                    '<td>' + escapeHtml(employee.email) + '</td>' +
                    '<td>' + escapeHtml(employee.phone) + '</td>' +
                    '<td><span class="pp-badge ' + (employee.status === 'Active' ? 'pp-badge-present' : employee.status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent') + '">' + escapeHtml(employee.status) + '</span></td>' +
                    '<td class="text-center">' +
                        '<button type="button" class="btn btn-sm btn-pp-outline me-2" data-action="edit" data-id="' + employee.id + '" aria-label="Edit ' + name + '"><i class="bi bi-pencil"></i></button>' +
                        '<button type="button" class="btn btn-sm btn-pp-outline" data-action="delete" data-id="' + employee.id + '" aria-label="Delete ' + name + '"><i class="bi bi-trash"></i></button>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function clearNumberError() {
        PPValidate.clear(employeeForm);
    }

    // API field name -> input id, so server errors show beside the right field.
    const SERVER_FIELDS = {
        firstName: 'employeeFirstName',
        middleName: 'employeeMiddleName',
        lastName: 'employeeLastName',
        gender: 'employeeGender',
        birthdate: 'employeeBirthdate',
        civilStatus: 'employeeCivilStatus',
        dependents: 'employeeDependents',
        address: 'employeeAddress',
        email: 'employeeEmail',
        phone: 'employeePhone',
        employeeNumber: 'employeeNumber',
        department: 'employeeDepartmentSelect',
        dateHired: 'employeeJoined',
        status: 'employeeStatusSelect',
        employeeType: 'employeeType',
        instructorRank: 'employeeRank',
        rate: 'employeeRateHour',
        teachingRate: 'employeeRateUnit',
        loadUnits: 'employeeLoadUnits',
        lectureHours: 'employeeLectureHours',
        officeDepartment: 'employeeOfficeDept',
        position: 'employeePosition',
        officeHours: 'employeeOfficeHours',
        sssId: 'employeeSssId',
        philhealthId: 'employeePhilhealthId',
        pagibigId: 'employeePagibigId',
        tinId: 'employeeTinId',
        notes: 'employeeNotes'
    };

    function serverFields(department) {
        // A faculty member's "rate" is the per hour/unit field.
        return department === 'Faculty'
            ? Object.assign({}, SERVER_FIELDS, { rate: 'employeeRateUnit' })
            : SERVER_FIELDS;
    }

    function resetForm() {
        employeeForm.reset();
        employeeId.value = '';
        modalTitle.textContent = 'Add Employee';
        employeeStatusSelect.value = 'Active';
        employeeDepartmentSelect.value = '';
        employeeDepartmentSelect.disabled = false;
        employeeJoined.value = new Date().toISOString().slice(0, 10);
        toggleTypeFields('');
        clearNumberError();
    }

    employeeDepartmentSelect.addEventListener('change', function () {
        toggleTypeFields(employeeDepartmentSelect.value);
    });

    function openModal(employee) {
        resetForm();
        if (employee) {
            modalTitle.textContent = 'Edit Employee';
            employeeId.value = employee.id;
            employeeFirstName.value = employee.firstName || '';
            employeeLastName.value = employee.lastName || '';
            employeeNumber.value = employee.employeeNumber;
            employeeDepartmentSelect.value = employee.department;
            toggleTypeFields(employee.department);
            fillFields(PROFILE_FIELDS, employee);
            fillFields(typeFields(employee.department), employee);
            // Department decides which database table a row lives in and
            // can't be changed after creation without moving that history —
            // see EmployeeService in the backend.
            employeeDepartmentSelect.disabled = true;
            employeeEmail.value = employee.email;
            employeePhone.value = employee.phone;
            employeeStatusSelect.value = employee.status;
            employeeJoined.value = employee.dateHired;
            employeeNotes.value = employee.notes || '';
            // Older records may hold e.g. "0917-000-0000"; keep only the allowed characters.
            PPValidate.sanitize(employeeForm);
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

        if (!PPValidate.validateForm(employeeForm)) {
            return;
        }
        const duplicate = employeeList.find(function (e) {
            return e.employeeNumber === number && e.id !== editingId;
        });
        if (duplicate) {
            PPValidate.setError(employeeNumber, 'This Employee ID is already used by ' + duplicate.displayName + '.');
            employeeNumber.focus();
            return;
        }

        const payload = {
            employeeNumber: number,
            firstName: employeeFirstName.value.trim(),
            lastName: employeeLastName.value.trim(),
            department: employeeDepartmentSelect.value,
            email: employeeEmail.value.trim(),
            phone: employeePhone.value.trim(),
            status: employeeStatusSelect.value,
            dateHired: employeeJoined.value,
            notes: employeeNotes.value.trim()
        };
        readFields(PROFILE_FIELDS, payload);
        readFields(typeFields(payload.department), payload);

        var url = editingId ? 'api/employees/' + encodeURIComponent(editingId) : 'api/employees';

        setSaving(true);

        fetch(url, {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                setSaving(false);

                if (!data.success) {
                    if (!PPValidate.showServerError(employeeForm, data, serverFields(payload.department))) {
                        PPToast.error(data.message || 'Could not save employee.');
                    }
                    return;
                }

                bootstrap.Modal.getInstance(employeeModal).hide();
                PPToast.success(editingId ? 'Employee updated.' : 'Employee added.');
                loadEmployees();
            })
            .catch(function (error) {
                setSaving(false);
                PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
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

                fetch('api/employees/' + encodeURIComponent(id), { method: 'DELETE' })
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
                        PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
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


    employeeModal.addEventListener('hidden.bs.modal', resetForm);

    loadEmployees().then(function () {
        if (new URLSearchParams(location.search).get('action') === 'add') {
            openModal(null);
        }
    });
})();
