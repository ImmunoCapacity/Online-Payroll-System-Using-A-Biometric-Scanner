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
    const employeeNumber = document.getElementById('employeeNumber');   // read-only, assigned by the server
    const employeeGender = document.getElementById('employeeGender');
    let nextIdBase = '';   // e.g. "STIBLN-0015" for a new employee (api/employees/next-id)
    const employeeDepartmentSelect = document.getElementById('employeeDepartmentSelect');
    const employeeEmail = document.getElementById('employeeEmail');
    const employeePhone = document.getElementById('employeePhone');
    const employeeJoined = document.getElementById('employeeJoined');
    const saveButton = employeeForm.querySelector('button[type="submit"]');
    // Employment Status: hidden on Add (new employees always start Active),
    // shown on Edit. "Archived" is a status choice like any other — the
    // server hides/shows the employee based on it (see EmployeeService.apply()).
    const employeeStatusRow = document.getElementById('employeeStatusRow');
    const employeeStatusSelect = document.getElementById('employeeStatusSelect');
    const employeeStatusHint = document.getElementById('employeeStatusHint');
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
        basicPay: { id: 'employeeBasicPay', number: true },   // monthly; record only
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

    // Utility and Security Guard are non-teaching staff like Admin: same
    // table (admin_staff) and the same field set, just their own label.
    const ADMIN_LIKE = ['Admin', 'Utility', 'Security Guard'];

    function typeFields(department) {
        if (department === 'Faculty') return FACULTY_FIELDS;
        if (ADMIN_LIKE.indexOf(department) !== -1) return ADMIN_FIELDS;
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
            const value = employee[key] == null ? '' : String(employee[key]);
            const input = document.getElementById(fields[key].id);
            // A saved choice that is no longer in a list (e.g. a rank) still shows.
            if (input.tagName === 'SELECT' && value && !Array.prototype.some.call(input.options, function (o) { return o.value === value; })) {
                input.insertAdjacentHTML('beforeend', '<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>');
            }
            input.value = value;
        });
    }

    // Instructor Rank choices: Maintenance → Instructor Ranks (api/ranks).
    // Each rank's standard rate per hour, so picking one can fill in the
    // Rate per Hour/Unit field below it.
    let rankRates = {};
    function loadRanks() {
        return fetch('api/ranks')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) return;
                rankRates = {};
                data.ranks.forEach(function (r) { rankRates[r.name] = r.ratePerHour; });
                document.getElementById('employeeRank').innerHTML = '<option value="">—</option>' +
                    data.ranks.map(function (r) {
                        return '<option value="' + escapeHtml(r.name) + '">' + escapeHtml(r.name) + '</option>';
                    }).join('');
            })
            .catch(function () { /* the field just offers no ranks */ });
    }

    // Picking a rank fills in its standard rate (the user can still change it).
    // Bound to 'change', not programmatic value-setting, so loading an existing
    // employee for editing keeps their actual saved rate.
    document.getElementById('employeeRank').addEventListener('change', function () {
        const rate = rankRates[this.value];
        if (rate != null) document.getElementById('employeeRateUnit').value = rate;
    });

    // Faculty and Admin staff have different employment fields; Faculty/Admin get both.
    function toggleTypeFields(department) {
        const both = department === 'Faculty/Admin';
        const adminLike = ADMIN_LIKE.indexOf(department) !== -1;
        facultyFields.classList.toggle('d-none', department !== 'Faculty' && !both);
        adminFields.classList.toggle('d-none', !adminLike && !both);
        // Basic Pay: Admin (and its Utility/Security Guard variants) and Faculty/Admin only (Faculty have none).
        const hasBasicPay = adminLike || both;
        document.getElementById('basicPayField').classList.toggle('d-none', !hasBasicPay);
        if (!hasBasicPay) document.getElementById('employeeBasicPay').value = '';
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

    function renderTable() {
        const rows = getFilteredEmployees();

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
                    '<td>' + escapeHtml(employee.employeeNumber) + '</td>' +
                    '<td><strong>' + name + '</strong></td>' +
                    '<td>' + escapeHtml(employee.department) + '</td>' +
                    '<td>' + escapeHtml(employee.email) + '</td>' +
                    '<td>' + escapeHtml(employee.phone) + '</td>' +
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
        employeeType: 'employeeType',
        basicPay: 'employeeBasicPay',
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
        tinId: 'employeeTinId'
    };

    function serverFields(department) {
        // A faculty member's "rate" is the per hour/unit field.
        return department === 'Faculty'
            ? Object.assign({}, SERVER_FIELDS, { rate: 'employeeRateUnit' })
            : SERVER_FIELDS;
    }

    // Archived records can be viewed but not edited — except Employment
    // Status itself, so they can still be un-archived from here.
    function setReadOnly(readOnly) {
        employeeForm.querySelectorAll('input, select, textarea').forEach(function (field) {
            if (field.id === 'employeeDepartmentSelect' || field.id === 'employeeStatusSelect') return;
            field.disabled = readOnly;
        });
        saveButton.classList.toggle('d-none', readOnly);
    }

    employeeStatusSelect.addEventListener('change', function () {
        employeeStatusHint.classList.toggle('d-none', employeeStatusSelect.value !== 'Archived');
    });

    function resetForm() {
        employeeForm.reset();
        employeeId.value = '';
        idEdited = false;
        modalTitle.textContent = 'Add Employee';
        employeeDepartmentSelect.value = '';
        employeeDepartmentSelect.disabled = false;
        employeeStatusRow.classList.add('d-none');
        employeeStatusSelect.value = 'Active';
        employeeStatusHint.classList.add('d-none');
        setReadOnly(false);
        employeeJoined.value = new Date().toISOString().slice(0, 10);
        toggleTypeFields('');
        clearNumberError();
    }

    employeeDepartmentSelect.addEventListener('change', function () {
        toggleTypeFields(employeeDepartmentSelect.value);
    });

    // Employee ID: STIBLN-####-M / -F. New employees see the number they will
    // get; the letter follows the Gender field (also when it is corrected).
    function genderLetter() {
        return employeeGender.value === 'Female' ? 'F' : employeeGender.value === 'Male' ? 'M' : '?';
    }

    // Once the Employee ID is typed in, it is kept as typed (no suggested number or letter).
    let idEdited = false;
    employeeNumber.addEventListener('input', function () { idEdited = true; });

    // STIBLN-####-M/F (4 or more digits; M or F matching the Gender field), and
    // unique among all employees (archived included). Same rule on the server.
    const EMPLOYEE_ID = /^STIBLN-\d{4,}-[MF]$/;
    employeeNumber.ppValidator = function (value) {
        const id = value.trim().toUpperCase();
        if (!EMPLOYEE_ID.test(id)) return 'Employee ID must look like STIBLN-0037-M: STIBLN, a dash, at least 4 digits, a dash, then M or F.';
        const letter = genderLetter();
        if (letter !== '?' && id.slice(-1) !== letter) {
            return 'The last letter must be ' + letter + ' (' + employeeGender.value + ').';
        }
        const taken = employeeList.some(function (e) {
            return String(e.employeeNumber).toUpperCase() === id && e.id !== employeeId.value;
        });
        return taken ? 'This Employee ID is already used by another employee.' : '';
    };

    function showEmployeeId() {
        if (idEdited) return;
        if (employeeId.value) {
            employeeNumber.value = employeeNumber.value.replace(/-[MF?]$/, '-' + genderLetter());
        } else {
            const letter = genderLetter();
            employeeNumber.value = nextIdBase + (letter === '?' ? '' : '-' + letter);
        }
    }

    /** Next ID from the loaded list (archived included), until the server's answer arrives. */
    function nextIdFromList() {
        const highest = employeeList.reduce(function (max, e) {
            const m = /^STIBLN-(\d+)-[MF]$/.exec(e.employeeNumber || '');
            return m ? Math.max(max, Number(m[1])) : max;
        }, 0);
        return 'STIBLN-' + String(highest + 1).padStart(4, '0');
    }

    function loadNextId() {
        nextIdBase = nextIdFromList();
        showEmployeeId();
        fetch('api/employees/next-id')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success || employeeId.value || idEdited) return;
                nextIdBase = data.nextId;
                showEmployeeId();
            })
            .catch(function () { /* the server assigns it on save anyway */ });
    }

    employeeGender.addEventListener('change', showEmployeeId);

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
            employeeJoined.value = employee.dateHired;
            // Older records may hold e.g. "0917-000-0000"; keep only the allowed characters.
            PPValidate.sanitize(employeeForm);

            employeeStatusRow.classList.remove('d-none');
            employeeStatusSelect.value = employee.archived ? 'Archived' : (employee.status || 'Active');
            employeeStatusHint.classList.toggle('d-none', !employee.archived);
            // Archived records are read-only except Employment Status itself,
            // so changing it away from Archived is how they're brought back.
            if (employee.archived) {
                modalTitle.textContent = 'Archived Employee';
                setReadOnly(true);
            }
        } else {
            loadNextId();
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

        if (!PPValidate.validateForm(employeeForm)) {
            return;
        }

        // Employee ID as shown (suggested STIBLN-####-M/F, or typed in).
        const payload = {
            employeeNumber: employeeNumber.value.trim().toUpperCase(),
            firstName: employeeFirstName.value.trim(),
            lastName: employeeLastName.value.trim(),
            department: employeeDepartmentSelect.value,
            email: employeeEmail.value.trim(),
            phone: employeePhone.value.trim(),
            status: editingId ? employeeStatusSelect.value : 'Active',
            dateHired: employeeJoined.value
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
                PPToast.success(editingId ? 'Employee updated.' : 'Employee added with ID ' + data.employeeNumber + '.');
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

    // Employees are never deleted, only archived (Employment Status:
    // Archived): their payroll, DTR, leave and loan history is kept, and
    // they are hidden from lists and pickers. Changing the status again —
    // the only editable field once archived — brings them back.

    addEmployeeBtn.addEventListener('click', function () {
        openModal(null);
    });

    employeeForm.addEventListener('submit', saveEmployee);
    [employeeSearch, employeeDepartment, employeeStatus].forEach(function (field) {
        field.addEventListener('input', renderTable);
        field.addEventListener('change', renderTable);
    });


    employeeModal.addEventListener('hidden.bs.modal', resetForm);

    Promise.all([loadEmployees(), loadRanks()]).then(function () {
        if (new URLSearchParams(location.search).get('action') === 'add') {
            openModal(null);
        }
    });
})();
