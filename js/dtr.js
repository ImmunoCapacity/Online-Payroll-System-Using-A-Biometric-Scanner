(function () {

    PayrollProLayout.init({
        // Manual Entry is the Attendance Recording module; highlight it in the menu.
        activeNav: new URLSearchParams(window.location.search).get('section') === 'manual'
            ? 'attendance-recording'
            : 'dtr',

        user: {
            name: 'Maria Elena Reyes',
            role: 'Payroll Staff',
            initials: 'MR'
        },

        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },

        notifications: true
    });

    /* Data */

    const today =
        new Date().toISOString().slice(0, 10);


    /* Time */

    function parseTime(value) {

        if (!value) {
            return null;
        }

        const parts =
            value.split(':').map(Number);

        return (
            parts[0] * 60 +
            parts[1]
        );
    }


    function formatTime12(value) {

        if (!value) {
            return '—';
        }

        const parts =
            value.split(':');

        let hour =
            parseInt(parts[0], 10);

        const minute =
            parts[1];

        const ampm =
            hour >= 12
                ? 'PM'
                : 'AM';

        hour =
            hour % 12 || 12;

        return (
            hour +
            ':' +
            minute +
            ' ' +
            ampm
        );
    }


    function calcHours(timeIn, timeOut) {

        if (!timeIn || !timeOut) {
            return '—';
        }

        const diff =
            parseTime(timeOut) -
            parseTime(timeIn);

        if (diff <= 0) {
            return '—';
        }

        const hours =
            Math.floor(diff / 60);

        const minutes =
            diff % 60;

        return (
            hours +
            'h ' +
            (minutes ? minutes + 'm' : '')
        );
    }


    /* Badges */

    function statusBadge(status) {

        const map = {

            present: [
                'pp-badge-present',
                'Present'
            ],

            late: [
                'pp-badge-late',
                'Late'
            ],

            absent: [
                'pp-badge-absent',
                'Absent'
            ],

            leave: [
                'pp-badge-leave',
                'On Leave'
            ]

        };

        const item =
            map[status] ||
            map.absent;

        return (
            '<span class="pp-badge ' +
            item[0] +
            '">' +
            item[1] +
            '</span>'
        );
    }


    function typeBadge(type) {

        return (
            '<span class="pp-badge ' +
            (
                type === 'Faculty'
                    ? 'pp-badge-faculty'
                    : type === 'Faculty/Admin'
                        ? 'pp-badge-faculty-admin'
                        : 'pp-badge-admin'
            ) +
            '">' +
            type +
            '</span>'
        );
    }


    /* Sections */

    const sections = {

        biometric:
            document.getElementById(
                'sectionBiometric'
            ),

        manual:
            document.getElementById(
                'sectionManual'
            )

    };



    function setDTRSidebarState(target) {

        document
            .querySelectorAll(
                '.pp-dtr-sidebar-link'
            )
            .forEach(function (item) {

                item.classList.toggle(
                    'active',
                    item.dataset.section === target
                );

            });


        const parent =
            document.querySelector(
                '.pp-sidebar-link[href="dtr.html"]'
            );

        const group =
            document.querySelector(
                '.pp-dtr-sidebar-group'
            );


        if (parent) {

            parent.classList.add(
                'dtr-expanded'
            );

        }


        if (group) {

            group.classList.add(
                'is-open'
            );

        }

    }


    function switchDTRSection(target) {

        if (!sections[target]) {
            target = 'biometric';
        }


        Object.keys(sections)
            .forEach(function (key) {

                if (sections[key]) {

                    sections[key].classList.toggle(
                        'active',
                        key === target
                    );

                }

            });


        setDTRSidebarState(target);

    }


    /* Sidebar
       The DTR sub-menu is rendered (always open) by payrollpro-layout.js.
       On this page its links switch sections without reloading; Faculty
       Schedule and Faculty Teaching Hours are pages of their own. */

    document
        .querySelectorAll(
            '.pp-dtr-sidebar-link:not([data-external])'
        )
        .forEach(function (link) {

            link.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();

                    const target =
                        link.dataset.section;

                    switchDTRSection(
                        target
                    );

                    window.history.replaceState(
                        {},
                        '',
                        'dtr.html?section=' +
                        encodeURIComponent(target)
                    );

                }
            );

        });


    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const initialSection =
        urlParams.get('section') ||
        'biometric';

    // Old links to the teaching section now go to its own module.
    if (initialSection === 'teaching') {
        window.location.replace('teaching-hours.html');
        return;
    }

    switchDTRSection(
        initialSection
    );


    /* Biometric */

    const filterDate =
        document.getElementById(
            'filterDate'
        );

    const filterType =
        document.getElementById(
            'filterType'
        );

    const filterSearch =
        document.getElementById(
            'filterSearch'
        );

    const dtrBody =
        document.getElementById(
            'dtrBody'
        );

    const emptyTable =
        document.getElementById(
            'emptyTable'
        );


    if (filterDate) {
        filterDate.value = today;
    }


    /* Records from the database (api/dtr): biometric punches synced from
       the K40 plus manual entries. */

    let dbRecords = [];
    let dbRecordsDate = null;

    function loadDtrRecords() {

        if (!filterDate) {
            return Promise.resolve();
        }

        const date =
            filterDate.value || today;

        return fetch('api/dtr?date=' + encodeURIComponent(date))
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (!data.success) {
                    throw new Error(data.message || 'Failed to load attendance.');
                }
                dbRecords = data.records;
                dbRecordsDate = date;
                renderTable();
            })
            .catch(function (error) {
                console.error('[DTR]', error);
                dbRecords = [];
                dbRecordsDate = null;
                renderTable();
                if (window.PPToast) {
                    PPToast.error('Could not load attendance from the server.');
                }
            });
    }



    function getFilteredRows() {

        if (
            !filterDate ||
            !filterType ||
            !filterSearch
        ) {
            return [];
        }


        const date =
            filterDate.value;

        const type =
            filterType.value;

        const query =
            filterSearch.value
                .trim()
                .toLowerCase();


        if (dbRecordsDate !== date) {
            return [];
        }


        return dbRecords

            .map(function (r) {

                return {
                    record: {
                        timeIn: r.timeIn,
                        timeOut: r.timeOut,
                        status: r.status,
                        manual: r.manual,
                        reason: r.remarks
                    },
                    employee: {
                        id: r.employeeNumber,
                        displayName: r.employeeName,
                        type: r.type
                    }
                };

            })

            .filter(function (row) {

                if (!row.employee) {
                    return false;
                }


                if (
                    type !== 'all' &&
                    row.employee.type !== type
                ) {
                    return false;
                }


                if (
                    query &&
                    !row.employee.displayName
                        .toLowerCase()
                        .includes(query)
                ) {
                    return false;
                }


                return true;

            })

            .sort(function (a, b) {

                return (
                    a.employee.displayName
                        .localeCompare(
                            b.employee.displayName
                        )
                );

            });

    }


    function renderTable() {

        if (
            !dtrBody ||
            !emptyTable
        ) {
            return;
        }


        const rows =
            getFilteredRows();


        if (!rows.length) {

            dtrBody.innerHTML = '';

            emptyTable.classList.remove(
                'd-none'
            );

            return;

        }


        emptyTable.classList.add(
            'd-none'
        );


        dtrBody.innerHTML =
            rows
                .map(function (row) {

                    const emp =
                        row.employee;

                    const rec =
                        row.record;


                    const manualTag =
                        rec.manual
                            ? ' <i class="bi bi-pencil-fill text-muted" title="Manual entry' +
                              (rec.reason ? ': ' + escapeHtml(rec.reason) : '') + '"></i>'
                            : '';


                    return `
                        <tr>

                            <td>

                                <strong>
                                    ${escapeHtml(emp.displayName)}
                                </strong>

                                ${manualTag}

                                <br>

                                <span class="text-muted small">
                                    ${escapeHtml(emp.id)}
                                </span>

                            </td>

                            <td>
                                ${typeBadge(emp.type)}
                            </td>

                            <td class="col-time">
                                ${formatTime12(rec.timeIn)}
                            </td>

                            <td class="col-time">
                                ${formatTime12(rec.timeOut)}
                            </td>

                            <td class="col-hours">
                                ${calcHours(
                                    rec.timeIn,
                                    rec.timeOut
                                )}
                            </td>

                            <td>
                                ${statusBadge(rec.status)}
                            </td>

                        </tr>
                    `;

                })
                .join('');

    }


    // "Sync Device" (js/biometric-sync.js) pulled new punches from the K40.
    document.addEventListener(
        'pp:dtr-synced',
        loadDtrRecords
    );


    // A new date needs that day's records from the server; type and search
    // just filter what's already loaded.
    if (filterDate) {

        filterDate.addEventListener(
            'change',
            loadDtrRecords
        );

    }


    [
        filterType,
        filterSearch
    ]
        .filter(Boolean)
        .forEach(function (element) {

            element.addEventListener(
                'input',
                renderTable
            );

            element.addEventListener(
                'change',
                renderTable
            );

        });


    const statusFilterClearBtn =
        document.getElementById(
            'statusFilterClearBtn'
        );


    if (statusFilterClearBtn) {

        statusFilterClearBtn.addEventListener(
            'click',
            function () {

                if (filterDate) {
                    filterDate.value = today;
                }

                if (filterType) {
                    filterType.value = 'all';
                }

                if (filterSearch) {
                    filterSearch.value = '';
                }

                loadDtrRecords();

            }
        );

    }


    /* Manual Entry */

    const manualForm =
        document.getElementById(
            'manualEntryForm'
        );

    const manualEmployeeSearch =
        document.getElementById(
            'manualEmployeeSearch'
        );

    const manualEmployee =
        document.getElementById(
            'manualEmployee'
        );

    const manualDate =
        document.getElementById(
            'manualDate'
        );

    const manualEmployeeResults =
        document.getElementById(
            'manualEmployeeResults'
        );


    if (manualDate) {

        manualDate.value =
            today;

        manualDate.max =
            today;

    }


    /* Employees for the manual entry picker (api/dtr/employees).
       ids look like "F3" (faculty #3) or "A5" (admin #5). */

    let manualEmployees = [];


    function loadManualEmployees() {

        fetch('api/dtr/employees')
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {

                if (!data.success) {
                    throw new Error(data.message || 'Failed to load employees.');
                }

                manualEmployees = data.employees;

            })
            .catch(function (error) {
                console.error('[DTR] Could not load employees:', error);
            });

    }


    /* Employee search dropdown */

    const MAX_EMPLOYEE_RESULTS = 8;

    let employeeMatches = [];
    let activeEmployeeIndex = -1;


    function employeeLabel(employee) {
        return employee.displayName + ' (' + employee.employeeNumber + ')';
    }


    function employeeInitials(name) {
        return String(name || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(function (part) { return part.charAt(0).toUpperCase(); })
            .join('');
    }


    function closeEmployeeResults() {

        manualEmployeeResults.classList.remove('is-open');
        manualEmployeeSearch.setAttribute('aria-expanded', 'false');
        activeEmployeeIndex = -1;

    }


    function renderEmployeeResults() {

        const query =
            manualEmployeeSearch.value.trim().toLowerCase();

        employeeMatches =
            manualEmployees
                .filter(function (e) {
                    return (
                        !query ||
                        e.displayName.toLowerCase().includes(query) ||
                        String(e.employeeNumber).toLowerCase().includes(query) ||
                        employeeLabel(e).toLowerCase() === query
                    );
                })
                .slice(0, MAX_EMPLOYEE_RESULTS);

        activeEmployeeIndex = -1;

        manualEmployeeResults.innerHTML =
            employeeMatches.length
                ? employeeMatches
                    .map(function (employee, index) {

                        return (
                            '<button type="button" class="pp-faculty-result" role="option" tabindex="-1" data-index="' + index + '">' +
                                '<span class="pp-faculty-result-avatar">' + escapeHtml(employeeInitials(employee.displayName)) + '</span>' +
                                '<span>' +
                                    '<span class="pp-faculty-result-name">' + escapeHtml(employee.displayName) + '</span>' +
                                    '<span class="pp-faculty-result-info">' +
                                        escapeHtml(employee.employeeNumber) +
                                        (employee.type ? ' &middot; ' + escapeHtml(employee.type) : '') +
                                    '</span>' +
                                '</span>' +
                            '</button>'
                        );

                    })
                    .join('')
                : '<div class="pp-faculty-result-empty">No employees found.</div>';

        manualEmployeeResults.classList.add('is-open');
        manualEmployeeSearch.setAttribute('aria-expanded', 'true');

    }


    function highlightEmployeeResult(index) {

        const buttons =
            manualEmployeeResults.querySelectorAll('.pp-faculty-result');

        buttons.forEach(function (button, i) {
            button.classList.toggle('is-active', i === index);
        });

        if (buttons[index]) {
            buttons[index].scrollIntoView({ block: 'nearest' });
        }

        activeEmployeeIndex = index;

    }


    function chooseEmployee(employee) {

        manualEmployeeSearch.value = employeeLabel(employee);

        // Let the input handler below fill the hidden id and type.
        manualEmployeeSearch.dispatchEvent(new Event('input', { bubbles: true }));

        closeEmployeeResults();

    }


    // Accepts "Name (EMP-NO)" from the list, or just the exact name.
    function resolveEmployeeFromSearch(
        value
    ) {

        const match =
            value.match(
                /\(([^)]+)\)\s*$/
            );


        if (match) {

            return manualEmployees.find(
                function (e) {
                    return e.employeeNumber === match[1];
                }
            );

        }


        return manualEmployees.find(
            function (e) {

                return (
                    e.displayName.toLowerCase() ===
                    value.trim().toLowerCase()
                );

            }
        );

    }


    // The read-only "Employee Type" box follows the chosen employee.
    const manualEmployeeType =
        document.getElementById('employeeType');

    const EMPLOYEE_TYPE_OPTION = {
        'Admin': 'admin',
        'Faculty/Admin': 'admin_faculty'
    };


    // Field rules beyond js/form-validation.js's data attributes.
    if (manualEmployeeSearch) {
        manualEmployeeSearch.ppValidator = function (value) {
            return resolveEmployeeFromSearch(value)
                ? ''
                : 'Please select an employee from the list.';
        };
    }

    // Today's entries can't be in the future either.
    function notLaterThanNow(value) {
        if (!manualDate || manualDate.value !== today) {
            return '';
        }
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        return parseTime(value) > nowMinutes + 1
            ? 'Time can\'t be later than the current time.'
            : '';
    }

    ['manualTimeIn', 'manualTimeOut'].forEach(function (id) {
        const input = document.getElementById(id);
        if (input) {
            input.ppValidator = notLaterThanNow;
        }
    });

    // API field name -> input id, so server errors show beside the right field.
    const MANUAL_SERVER_FIELDS = {
        employeeId: 'manualEmployeeSearch',
        date: 'manualDate',
        timeIn: 'manualTimeIn',
        timeOut: 'manualTimeOut',
        status: 'manualStatus',
        reason: 'manualReason'
    };


    if (
        manualEmployeeSearch &&
        manualEmployee
    ) {

        // Errors go under the search box, not inside its wrapper.
        manualEmployeeSearch._ppFeedback =
            manualEmployeeSearch
                .closest('.pp-employee-picker')
                .parentElement
                .querySelector('.invalid-feedback');

        manualEmployeeSearch.addEventListener(
            'input',
            function (e) {

                // chooseEmployee's own dispatch shouldn't reopen the list.
                if (e.isTrusted) {
                    renderEmployeeResults();
                }

                const employee =
                    resolveEmployeeFromSearch(
                        manualEmployeeSearch.value
                    );

                manualEmployee.value =
                    employee
                        ? employee.id
                        : '';

                if (manualEmployeeType) {
                    manualEmployeeType.value =
                        employee
                            ? (EMPLOYEE_TYPE_OPTION[employee.type] || '')
                            : '';
                }

            }
        );

    }


    if (manualEmployeeSearch && manualEmployeeResults) {

        manualEmployeeSearch.addEventListener('focus', renderEmployeeResults);

        manualEmployeeSearch.addEventListener('keydown', function (e) {

            if (!manualEmployeeResults.classList.contains('is-open')) {
                if (e.key === 'ArrowDown') {
                    renderEmployeeResults();
                }
                return;
            }

            if (e.key === 'ArrowDown' && employeeMatches.length) {
                e.preventDefault();
                highlightEmployeeResult((activeEmployeeIndex + 1) % employeeMatches.length);
            } else if (e.key === 'ArrowUp' && employeeMatches.length) {
                e.preventDefault();
                highlightEmployeeResult(
                    (activeEmployeeIndex - 1 + employeeMatches.length) % employeeMatches.length
                );
            } else if (e.key === 'Enter') {
                const pick =
                    employeeMatches[activeEmployeeIndex] ||
                    (employeeMatches.length === 1 ? employeeMatches[0] : null);
                if (pick) {
                    e.preventDefault();
                    chooseEmployee(pick);
                }
            } else if (e.key === 'Escape') {
                closeEmployeeResults();
            }

        });

        // mousedown fires before the input's blur, so the click isn't lost.
        manualEmployeeResults.addEventListener('mousedown', function (e) {

            const button = e.target.closest('.pp-faculty-result');

            if (button) {
                e.preventDefault();
                chooseEmployee(employeeMatches[Number(button.dataset.index)]);
            }

        });

        manualEmployeeSearch.addEventListener('blur', closeEmployeeResults);

    }


    if (manualForm) {

        manualForm.addEventListener(
            'submit',
            function (e) {

                e.preventDefault();

                if (!PPValidate.validateForm(manualForm)) {
                    return;
                }


                const employee =
                    resolveEmployeeFromSearch(
                        manualEmployeeSearch.value
                    );

                const payload = {

                    employeeId:
                        employee.id,

                    date:
                        manualDate.value,

                    timeIn:
                        document.getElementById('manualTimeIn').value,

                    timeOut:
                        document.getElementById('manualTimeOut').value || null,

                    status:
                        document.getElementById('manualStatus').value,

                    reason:
                        document.getElementById('manualReason').value.trim()

                };


                if (
                    !payload.date ||
                    !payload.timeIn ||
                    !payload.reason
                ) {
                    return;
                }


                const submitBtn =
                    manualForm.querySelector('button[type="submit"]');

                if (submitBtn) {
                    submitBtn.disabled = true;
                }


                fetch('api/dtr/manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (data) {

                        if (submitBtn) {
                            submitBtn.disabled = false;
                        }

                        if (!data.success) {
                            if (!PPValidate.showServerError(manualForm, data, MANUAL_SERVER_FIELDS)) {
                                PPToast.error(data.message || 'Could not save the attendance record.');
                            }
                            return;
                        }


                        manualForm.reset();

                        PPValidate.clear(manualForm);

                        manualEmployee.value =
                            '';

                        manualDate.value =
                            today;


                        // Show the saved day in Biometric Records.
                        if (filterDate) {
                            filterDate.value = payload.date;
                        }

                        loadDtrRecords();


                        PPToast.success(
                            'Attendance record saved for ' + employee.displayName + '.'
                        );

                    })
                    .catch(function () {

                        if (submitBtn) {
                            submitBtn.disabled = false;
                        }

                        PPToast.error('Could not reach the server. Is the Spring Boot backend running?');

                    });

            }
        );

    }


    function escapeHtml(value) {

        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    /* Initialize */

    loadManualEmployees();

    loadDtrRecords();

})();
