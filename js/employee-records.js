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
    const archiveEmployeeBtn = document.getElementById('archiveEmployeeBtn');
    const restoreEmployeeBtn = document.getElementById('restoreEmployeeBtn');
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
        employeeBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading employees…</td></tr>';
        emptyState.classList.add('d-none');

        // Archived employees too, for the Status filter's "Archived" view.
        return fetch('api/employees?archived=true')
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
            // Archived employees show only under Status: Archived.
            const matchesStatus = status === 'archived'
                ? employee.archived
                : !employee.archived && (status === 'all' || employee.status === status);
            return matchesText && matchesDepartment && matchesStatus;
        });
    }

    function updateSummary() {
        const current = employeeList.filter(function (e) { return !e.archived; });
        document.getElementById('summaryActive').textContent = current.filter(function (e) { return e.status === 'Active'; }).length;
        document.getElementById('summaryFaculty').textContent = current.filter(function (e) { return e.department === 'Faculty'; }).length;
        document.getElementById('summaryAdmin').textContent = current.filter(function (e) { return e.department === 'Admin'; }).length;
        document.getElementById('summaryFacultyAdmin').textContent = current.filter(function (e) { return e.department === 'Faculty/Admin'; }).length;
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
                '<tr class="pp-row-clickable" tabindex="0" role="button" data-id="' + escapeHtml(employee.id) + '" ' +
                    'aria-label="View details of ' + name + '">' +
                    '<td><strong>' + name + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + escapeHtml(employee.employeeNumber) + '</span></td>' +
                    '<td>' + escapeHtml(employee.department) + '</td>' +
                    '<td>' + escapeHtml(employee.email) + '</td>' +
                    '<td>' + escapeHtml(employee.phone) + '</td>' +
                    '<td>' + statusBadge(employee) + '</td>' +
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

    function statusBadge(employee) {
        if (employee.archived) {
            return '<span class="pp-badge pp-badge-archived" title="' + escapeHtml(employee.status) + '">Archived</span>';
        }
        const cls = employee.status === 'Active' ? 'pp-badge-present'
            : employee.status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent';
        return '<span class="pp-badge ' + cls + '">' + escapeHtml(employee.status) + '</span>';
    }

    // Archived records can be viewed but not edited.
    function setReadOnly(readOnly) {
        employeeForm.querySelectorAll('input, select, textarea').forEach(function (field) {
            if (field.id === 'employeeDepartmentSelect') return;   // handled by openModal
            field.disabled = readOnly;
        });
        saveButton.classList.toggle('d-none', readOnly);
    }

    function resetForm() {
        employeeForm.reset();
        employeeId.value = '';
        modalTitle.textContent = 'Add Employee';
        employeeStatusSelect.value = 'Active';
        employeeDepartmentSelect.value = '';
        employeeDepartmentSelect.disabled = false;
        archiveEmployeeBtn.classList.add('d-none');
        restoreEmployeeBtn.classList.add('d-none');
        setReadOnly(false);
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

            // Archived records are read-only until restored.
            if (employee.archived) {
                modalTitle.textContent = 'Archived Employee';
                restoreEmployeeBtn.classList.remove('d-none');
                setReadOnly(true);
            } else {
                archiveEmployeeBtn.classList.remove('d-none');
            }
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

    // Clicking a row (or Enter/Space on a focused row) opens the employee's details.
    function openRow(row) {
        const match = employeeList.find(function (item) { return item.id === row.dataset.id; });
        if (match) openModal(match);
    }

    employeeBody.addEventListener('click', function (event) {
        const row = event.target.closest('tr[data-id]');
        if (row) openRow(row);
    });

    employeeBody.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-id]')) {
            event.preventDefault();
            openRow(event.target);
        }
    });

    // Employees are never deleted, only archived: their payroll, DTR, leave
    // and loan history is kept, and they are hidden from lists and pickers.
    // Only employees who no longer work here (Inactive, Resigned or
    // Terminated) can be archived.
    const ARCHIVABLE = ['Inactive', 'Resigned', 'Terminated'];

    function postAction(id, action) {
        return fetch('api/employees/' + encodeURIComponent(id) + '/' + action, { method: 'POST' })
            .then(function (response) { return response.json(); });
    }

    archiveEmployeeBtn.addEventListener('click', function () {
        const id = employeeId.value;
        const match = employeeList.find(function (item) { return item.id === id; });
        if (!match) return;

        if (ARCHIVABLE.indexOf(match.status) === -1) {
            PPValidate.setError(employeeStatusSelect,
                'Only Inactive, Resigned or Terminated employees can be archived. Change the status and save first.');
            employeeStatusSelect.focus();
            return;
        }

        bootstrap.Modal.getInstance(employeeModal).hide();
        ConfirmModal.show({
            title: 'Archive Employee',
            message: 'Archive ' + match.displayName + ' (' + match.employeeNumber + ')? They will be hidden from lists and ' +
                'can no longer be scheduled or paid. Their payroll, DTR, leave and loan records are kept, and the ' +
                'employee can be restored from Status: Archived.',
            confirmText: 'Archive Employee'
        }).then(function (confirmed) {
            if (!confirmed) return;

            postAction(id, 'archive')
                .then(function (data) {
                    if (!data.success) {
                        PPToast.error(data.message || 'Could not archive the employee.');
                        return;
                    }
                    PPToast.success(match.displayName + ' archived.');
                    loadEmployees();
                })
                .catch(function (error) {
                    PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
                    console.error('[Employee Records]', error);
                });
        });
    });

    restoreEmployeeBtn.addEventListener('click', function () {
        const id = employeeId.value;
        const match = employeeList.find(function (item) { return item.id === id; });
        if (!match) return;

        restoreEmployeeBtn.disabled = true;
        postAction(id, 'restore')
            .then(function (data) {
                if (!data.success) {
                    PPToast.error(data.message || 'Could not restore the employee.');
                    return;
                }
                bootstrap.Modal.getInstance(employeeModal).hide();
                PPToast.success(match.displayName + ' restored. Set their status to Active to schedule and pay them again.');
                loadEmployees();
            })
            .catch(function (error) {
                PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
                console.error('[Employee Records]', error);
            })
            .then(function () {
                restoreEmployeeBtn.disabled = false;
            });
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
