(function () {

    PayrollProLayout.init({
        activeNav: 'dtr',

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


    /* Constants */

    const GRACE_MINUTES = 15;
    const STANDARD_START = '08:00';

    const DAY_COLUMNS = [
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat'
    ];

    const GRID_START_HOUR = 7;
    const GRID_END_HOUR = 20;


    /* Data */

    const employees =
        DataStore.getEmployees().filter(function (e) {
            return e.status !== 'Inactive';
        });

    const facultyEmployees =
        employees.filter(function (e) {
            return e.type === 'Faculty';
        });

    const today =
        new Date().toISOString().slice(0, 10);

    let records =
        DataStore.getDTR();

    let schedules =
        DataStore.getTeachingSchedule();


    function persistRecords() {
        DataStore.saveDTR(records);
    }


    function persistSchedules() {
        DataStore.saveTeachingSchedule(schedules);
    }


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


    function deriveStatus(
        timeIn,
        scheduledStart
    ) {

        if (!timeIn) {
            return 'absent';
        }

        const start =
            parseTime(
                scheduledStart ||
                STANDARD_START
            );

        const actual =
            parseTime(timeIn);

        return (
            actual >
            start + GRACE_MINUTES
                ? 'late'
                : 'present'
        );
    }


    function formatDateInput(date) {

        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1
            ).padStart(2, '0');

        const day =
            String(
                date.getDate()
            ).padStart(2, '0');

        return (
            year +
            '-' +
            month +
            '-' +
            day
        );
    }


    function getDayName(date) {

        const names = [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ];

        return names[
            date.getDay()
        ];
    }


    function getNextDateForDay(day) {

        const targetIndex =
            DAY_COLUMNS.indexOf(day);

        const date =
            new Date();

        const currentIndex =
            date.getDay() === 0
                ? 6
                : date.getDay() - 1;

        let difference =
            targetIndex -
            currentIndex;

        if (difference < 0) {
            difference += 7;
        }

        date.setDate(
            date.getDate() +
            difference
        );

        return formatDateInput(date);
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

        teaching:
            document.getElementById(
                'sectionTeaching'
            ),

        manual:
            document.getElementById(
                'sectionManual'
            )

    };


    const dtrMain =
        document.getElementById(
            'dtrMain'
        );


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


        if (dtrMain) {

            dtrMain.classList.toggle(
                'pp-teaching-mode',
                target === 'teaching'
            );

        }


        setDTRSidebarState(target);

    }


    /* Sidebar */

    const dtrSidebarLink =
        document.querySelector(
            '.pp-sidebar-link[href="dtr.html"]'
        );


    if (dtrSidebarLink) {

        let dtrGroup =
            document.querySelector(
                '.pp-dtr-sidebar-group'
            );


        if (!dtrGroup) {

            dtrGroup =
                document.createElement('div');

            dtrGroup.className =
                'pp-dtr-sidebar-group';


            dtrGroup.innerHTML = `

                <a
                    href="dtr.html?section=biometric"
                    class="pp-dtr-sidebar-link"
                    data-section="biometric"
                >
                    <i class="bi bi-fingerprint"></i>
                    <span>Biometric Records</span>
                </a>

                <a
                    href="dtr.html?section=teaching"
                    class="pp-dtr-sidebar-link"
                    data-section="teaching"
                >
                    <i class="bi bi-person-workspace"></i>
                    <span>Faculty Teaching Hours</span>
                </a>

                <a
                    href="dtr.html?section=manual"
                    class="pp-dtr-sidebar-link"
                    data-section="manual"
                >
                    <i class="bi bi-pencil-square"></i>
                    <span>Manual Entry</span>
                </a>

            `;


            dtrSidebarLink.parentNode.insertBefore(
                dtrGroup,
                dtrSidebarLink.nextSibling
            );

        }


        if (
            !dtrSidebarLink.querySelector(
                '.pp-dtr-chevron'
            )
        ) {

            const chevron =
                document.createElement('i');

            chevron.className =
                'bi bi-chevron-down pp-dtr-chevron';

            dtrSidebarLink.appendChild(
                chevron
            );

        }


        dtrGroup
            .querySelectorAll(
                '.pp-dtr-sidebar-link'
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


        dtrSidebarLink.addEventListener(
            'click',
            function (e) {

                const isDTRPage =
                    window.location.pathname.endsWith(
                        'dtr.html'
                    );


                if (!isDTRPage) {
                    return;
                }


                e.preventDefault();


                const isOpen =
                    dtrGroup.classList.contains(
                        'is-open'
                    );


                dtrGroup.classList.toggle(
                    'is-open',
                    !isOpen
                );


                dtrSidebarLink.classList.toggle(
                    'dtr-expanded',
                    !isOpen
                );

            }
        );

    }


    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const initialSection =
        urlParams.get('section') ||
        'biometric';

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


    function teachingPresent(
        emp,
        rec
    ) {

        if (
            emp.type !== 'Faculty' ||
            !emp.scheduleStart ||
            !emp.scheduleEnd
        ) {
            return null;
        }

        if (
            !rec.timeIn ||
            !rec.timeOut
        ) {
            return false;
        }


        const inMin =
            parseTime(rec.timeIn);

        const outMin =
            parseTime(rec.timeOut);

        const start =
            parseTime(emp.scheduleStart);

        const end =
            parseTime(emp.scheduleEnd);


        return (
            inMin <=
            start + GRACE_MINUTES &&
            outMin >=
            end - GRACE_MINUTES
        );
    }


    function teachingCell(
        emp,
        rec
    ) {

        if (emp.type !== 'Faculty') {

            return `
                <td class="text-center">
                    <span class="pp-teaching-icon na">
                        —
                    </span>
                </td>
            `;

        }


        const met =
            teachingPresent(
                emp,
                rec
            );


        if (
            rec.status === 'leave' ||
            rec.status === 'absent'
        ) {

            return `
                <td class="text-center">
                    <i class="bi bi-x-circle-fill pp-teaching-icon missed"></i>
                </td>
            `;

        }


        if (met) {

            return `
                <td class="text-center">
                    <i class="bi bi-check-circle-fill pp-teaching-icon met"></i>
                </td>
            `;

        }


        return `
            <td class="text-center">
                <i class="bi bi-exclamation-circle-fill pp-teaching-icon missed"></i>
            </td>
        `;

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


        return records

            .filter(function (r) {

                return r.date === date;

            })

            .map(function (r) {

                const employee =
                    employees.find(
                        function (e) {
                            return e.id === r.employeeId;
                        }
                    );


                return {
                    record: r,
                    employee: employee
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
                            ? ' <i class="bi bi-pencil-fill text-muted" title="Manual entry"></i>'
                            : '';


                    return `
                        <tr>

                            <td>

                                <strong>
                                    ${emp.displayName}
                                </strong>

                                ${manualTag}

                                <br>

                                <span class="text-muted small">
                                    ${emp.id}
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

                            ${teachingCell(
                                emp,
                                rec
                            )}

                        </tr>
                    `;

                })
                .join('');

    }


    [
        filterDate,
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

                renderTable();

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

    const employeeDatalist =
        document.getElementById(
            'employeeDatalist'
        );


    if (manualDate) {

        manualDate.value =
            today;

        manualDate.max =
            today;

    }


    function populateDatalist() {

        if (!employeeDatalist) {
            return;
        }


        employeeDatalist.innerHTML =
            employees
                .map(function (employee) {

                    return (
                        '<option value="' +
                        employee.displayName +
                        ' (' +
                        employee.id +
                        ')"></option>'
                    );

                })
                .join('');

    }


    function resolveEmployeeFromSearch(
        value
    ) {

        const match =
            value.match(
                /\(([^)]+)\)\s*$/
            );


        if (match) {

            return employees.find(
                function (e) {

                    return (
                        e.id ===
                        match[1]
                    );

                }
            );

        }


        return employees.find(
            function (e) {

                return (
                    e.displayName
                        .toLowerCase() ===
                    value
                        .toLowerCase()
                );

            }
        );

    }


    if (
        manualEmployeeSearch &&
        manualEmployee
    ) {

        manualEmployeeSearch.addEventListener(
            'input',
            function () {

                const employee =
                    resolveEmployeeFromSearch(
                        manualEmployeeSearch.value
                    );

                manualEmployee.value =
                    employee
                        ? employee.id
                        : '';

            }
        );

    }


    if (manualForm) {

        manualForm.addEventListener(
            'submit',
            function (e) {

                e.preventDefault();

                manualForm.classList.add(
                    'was-validated'
                );


                const employee =
                    resolveEmployeeFromSearch(
                        manualEmployeeSearch.value
                    );


                if (!employee) {

                    manualEmployeeSearch.classList.add(
                        'is-invalid'
                    );

                    return;

                }


                manualEmployeeSearch.classList.remove(
                    'is-invalid'
                );


                const date =
                    manualDate.value;

                const timeIn =
                    document.getElementById(
                        'manualTimeIn'
                    ).value;

                const timeOut =
                    document.getElementById(
                        'manualTimeOut'
                    ).value ||
                    null;

                const reason =
                    document.getElementById(
                        'manualReason'
                    ).value.trim();

                const selectedStatus =
                    document.getElementById(
                        'manualStatus'
                    ).value;


                if (
                    !date ||
                    !timeIn ||
                    !reason
                ) {
                    return;
                }


                const scheduledStart =
                    employee.type === 'Faculty' &&
                    employee.scheduleStart
                        ? employee.scheduleStart
                        : STANDARD_START;


                let status =
                    deriveStatus(
                        timeIn,
                        scheduledStart
                    );


                if (
                    selectedStatus !==
                    'auto'
                ) {
                    status =
                        selectedStatus;
                }


                const existing =
                    records.findIndex(
                        function (r) {

                            return (
                                r.employeeId ===
                                employee.id &&
                                r.date ===
                                date
                            );

                        }
                    );


                const entry = {

                    employeeId:
                        employee.id,

                    date:
                        date,

                    timeIn:
                        timeIn,

                    timeOut:
                        timeOut,

                    status:
                        status,

                    manual:
                        true,

                    reason:
                        reason

                };


                if (existing >= 0) {

                    records[existing] =
                        entry;

                } else {

                    records.push(
                        entry
                    );

                }


                persistRecords();


                if (filterDate) {
                    filterDate.value = date;
                }


                manualForm.reset();

                manualForm.classList.remove(
                    'was-validated'
                );

                manualEmployee.value =
                    '';

                manualDate.value =
                    today;


                renderTable();


                PPToast.success(
                    'Attendance record saved.'
                );

            }
        );

    }


    /* Faculty Schedule */

    const addScheduleBtn =
        document.getElementById(
            'addScheduleBtn'
        );

    const scheduleModalEl =
        document.getElementById(
            'scheduleModal'
        );

    const scheduleModal =
        scheduleModalEl
            ? new bootstrap.Modal(
                scheduleModalEl
            )
            : null;

    const scheduleForm =
        document.getElementById(
            'scheduleForm'
        );

    const scheduleFaculty =
        document.getElementById(
            'scheduleFaculty'
        );

    const gridEditBody =
        document.getElementById(
            'gridEditBody'
        );

    const scheduleModalTitle =
        document.getElementById(
            'scheduleModalTitle'
        );

    const scheduleDetailEmpty =
        document.getElementById(
            'scheduleDetailEmpty'
        );

    const scheduleDetailContent =
        document.getElementById(
            'scheduleDetailContent'
        );

    const scheduleDetailName =
        document.getElementById(
            'scheduleDetailName'
        );

    const scheduleDetailMeta =
        document.getElementById(
            'scheduleDetailMeta'
        );

    const scheduleDetailBody =
        document.getElementById(
            'scheduleDetailBody'
        );

    const scheduleDetailNoSchedule =
        document.getElementById(
            'scheduleDetailNoSchedule'
        );

    const editScheduleBtn =
        document.getElementById(
            'editScheduleBtn'
        );

    const deleteScheduleBtn =
        document.getElementById(
            'deleteScheduleBtn'
        );

    const facultySearch =
        document.getElementById(
            'facultySearch'
        );

    const facultySearchResults =
        document.getElementById(
            'facultySearchResults'
        );


    let selectedScheduleFacultyId =
        null;

    let selectedMonitoringClass =
        null;


    function facultyName(
        employeeId
    ) {

        const employee =
            employees.find(
                function (e) {
                    return e.id === employeeId;
                }
            );

        return employee
            ? employee.displayName
            : employeeId;

    }


    function escapeHtml(value) {

        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    function getInitials(name) {

        return String(name || '')
            .replace(/^Dr\.\s*/i, '')
            .replace(/^Prof\.\s*/i, '')
            .split(/\s+/)
            .filter(Boolean)
            .map(function (word) {
                return word.charAt(0);
            })
            .slice(0, 2)
            .join('')
            .toUpperCase();

    }


    function hourLabel12(hour) {

        let value =
            hour % 12;

        if (value === 0) {
            value = 12;
        }

        return (
            value < 10
                ? '0' + value
                : String(value)
        );

    }


    function rowLabel(hour) {

        return (
            hourLabel12(hour) +
            ':00 - ' +
            hourLabel12(hour + 1) +
            ':00'
        );

    }


    function schedulesForFaculty(
        employeeId
    ) {

        return schedules.filter(
            function (schedule) {

                return (
                    schedule.employeeId ===
                    employeeId
                );

            }
        );

    }


    function populateFacultySelect() {

        if (!scheduleFaculty) {
            return;
        }


        scheduleFaculty.innerHTML =
            facultyEmployees
                .map(function (employee) {

                    return (
                        '<option value="' +
                        escapeHtml(employee.id) +
                        '">' +
                        escapeHtml(
                            employee.displayName
                        ) +
                        '</option>'
                    );

                })
                .join('');

    }


    function getMonitoringRecord(
        employeeId,
        date,
        subject,
        day,
        timeStart
    ) {

        return records.find(
            function (record) {

                return (
                    record.teachingMonitoring === true &&
                    record.employeeId === employeeId &&
                    record.date === date &&
                    record.subject === subject &&
                    record.day === day &&
                    record.timeStart === timeStart
                );

            }
        ) || null;

    }


    function monitoringStatusClass(
        status
    ) {

        if (status === 'Late') {
            return 'status-late';
        }

        if (status === 'Not Teaching') {
            return 'status-not-teaching';
        }

        return 'status-teaching';

    }


    function monitoringStatusLabel(
        status
    ) {

        if (status === 'Late') {
            return '◷ Late';
        }

        if (status === 'Not Teaching') {
            return '× Not Teaching';
        }

        return '✓ Teaching';

    }


    /* Faculty search */

    function showFacultySearchResults(
        value
    ) {

        if (
            !facultySearch ||
            !facultySearchResults
        ) {
            return;
        }


        const query =
            value
                .trim()
                .toLowerCase();


        const results =
            facultyEmployees.filter(
                function (employee) {

                    return employee.displayName
                        .toLowerCase()
                        .includes(query);

                }
            );


        facultySearchResults.innerHTML = '';


        if (!results.length) {

            facultySearchResults.innerHTML = `
                <div class="pp-faculty-result-empty">
                    No faculty found.
                </div>
            `;

            facultySearchResults.classList.add(
                'is-open'
            );

            return;

        }


        results.forEach(
            function (employee) {

                const schedulesCount =
                    schedulesForFaculty(
                        employee.id
                    ).length;


                const button =
                    document.createElement(
                        'button'
                    );

                button.type =
                    'button';

                button.className =
                    'pp-faculty-result';


                button.innerHTML = `

                    <span class="pp-faculty-result-avatar">
                        ${escapeHtml(
                            getInitials(
                                employee.displayName
                            )
                        )}
                    </span>

                    <span>

                        <span class="pp-faculty-result-name">
                            ${escapeHtml(
                                employee.displayName
                            )}
                        </span>

                        <span class="pp-faculty-result-info">
                            ${schedulesCount}
                            course${schedulesCount === 1 ? '' : 's'}
                            scheduled
                        </span>

                    </span>

                `;


                button.addEventListener(
                    'click',
                    function () {

                        facultySearch.value =
                            employee.displayName;

                        facultySearchResults.classList.remove(
                            'is-open'
                        );

                        selectScheduleFaculty(
                            employee.id
                        );

                    }
                );


                facultySearchResults.appendChild(
                    button
                );

            }
        );


        facultySearchResults.classList.add(
            'is-open'
        );

    }


    if (facultySearch) {

        facultySearch.addEventListener(
            'focus',
            function () {

                showFacultySearchResults(
                    facultySearch.value
                );

            }
        );


        facultySearch.addEventListener(
            'input',
            function () {

                showFacultySearchResults(
                    facultySearch.value
                );

            }
        );

    }


    document.addEventListener(
        'click',
        function (event) {

            if (
                !facultySearch ||
                !facultySearchResults
            ) {
                return;
            }


            if (
                !facultySearch.contains(
                    event.target
                ) &&
                !facultySearchResults.contains(
                    event.target
                )
            ) {

                facultySearchResults.classList.remove(
                    'is-open'
                );

            }

        }
    );


    function selectScheduleFaculty(
        employeeId
    ) {

        selectedScheduleFacultyId =
            employeeId;


        const employee =
            employees.find(
                function (e) {
                    return e.id === employeeId;
                }
            );


        if (facultySearch && employee) {

            facultySearch.value =
                employee.displayName;

        }


        renderScheduleDetail();

    }


    function renderScheduleDetail() {

        if (
            !scheduleDetailEmpty ||
            !scheduleDetailContent
        ) {
            return;
        }


        if (!selectedScheduleFacultyId) {

            scheduleDetailEmpty.classList.remove(
                'd-none'
            );

            scheduleDetailContent.classList.add(
                'd-none'
            );

            return;

        }


        scheduleDetailEmpty.classList.add(
            'd-none'
        );

        scheduleDetailContent.classList.remove(
            'd-none'
        );


        const employee =
            employees.find(
                function (e) {

                    return (
                        e.id ===
                        selectedScheduleFacultyId
                    );

                }
            );


        const entries =
            schedulesForFaculty(
                selectedScheduleFacultyId
            );


        scheduleDetailName.textContent =
            employee
                ? employee.displayName
                : selectedScheduleFacultyId;


        scheduleDetailMeta.textContent =
            entries.length +
            ' course' +
            (
                entries.length === 1
                    ? ''
                    : 's'
            ) +
            ' scheduled this term';


        if (!entries.length) {

            scheduleDetailBody.innerHTML = '';

            scheduleDetailNoSchedule.classList.remove(
                'd-none'
            );

            return;

        }


        scheduleDetailNoSchedule.classList.add(
            'd-none'
        );


        let rows = '';


        for (
            let hour = GRID_START_HOUR;
            hour < GRID_END_HOUR;
            hour++
        ) {

            const rowStart =
                hour * 60;

            const rowEnd =
                (hour + 1) * 60;


            const cells =
                DAY_COLUMNS
                    .map(function (day) {

                        const match =
                            entries.find(
                                function (schedule) {

                                    return (
                                        schedule.days.indexOf(day) !== -1 &&
                                        parseTime(
                                            schedule.timeStart
                                        ) < rowEnd &&
                                        parseTime(
                                            schedule.timeEnd
                                        ) > rowStart
                                    );

                                }
                            );


                        if (!match) {

                            return `
                                <td class="pp-grid-cell"></td>
                            `;

                        }


                        const monitoringDate =
                            getNextDateForDay(day);


                        const monitoring =
                            getMonitoringRecord(
                                selectedScheduleFacultyId,
                                monitoringDate,
                                match.subject,
                                day,
                                match.timeStart
                            );


                        const status =
                            monitoring
                                ? monitoring.teachingStatus
                                : null;


                        const statusClass =
                            status
                                ? monitoringStatusClass(
                                    status
                                )
                                : '';


                        const statusLabel =
                            status
                                ? monitoringStatusLabel(
                                    status
                                )
                                : 'Click to check';


                        return `

                            <td class="pp-grid-cell is-scheduled">

                                <button
                                    type="button"
                                    class="pp-schedule-class ${statusClass}"
                                    data-faculty-id="${escapeHtml(
                                        selectedScheduleFacultyId
                                    )}"
                                    data-subject="${escapeHtml(
                                        match.subject
                                    )}"
                                    data-day="${escapeHtml(day)}"
                                    data-time-start="${escapeHtml(
                                        match.timeStart
                                    )}"
                                    data-time-end="${escapeHtml(
                                        match.timeEnd
                                    )}"
                                >

                                    <span>
                                        ${escapeHtml(
                                            match.subject
                                        )}
                                    </span>

                                    <small>
                                        ${formatTime12(
                                            match.timeStart
                                        )}
                                        –
                                        ${formatTime12(
                                            match.timeEnd
                                        )}
                                    </small>

                                    <span class="pp-schedule-status">
                                        ${statusLabel}
                                    </span>

                                </button>

                            </td>

                        `;

                    })
                    .join('');


            rows += `

                <tr>

                    <td class="pp-grid-time-col">
                        ${rowLabel(hour)}
                    </td>

                    ${cells}

                </tr>

            `;

        }


        scheduleDetailBody.innerHTML =
            rows;


        scheduleDetailBody
            .querySelectorAll(
                '.pp-schedule-class'
            )
            .forEach(function (button) {

                button.addEventListener(
                    'click',
                    function () {

                        openTeachingMonitoring(
                            button.dataset.facultyId,
                            button.dataset.subject,
                            button.dataset.day,
                            button.dataset.timeStart,
                            button.dataset.timeEnd
                        );

                    }
                );

            });

    }


    /* Schedule editor */

    function openScheduleModal(
        employeeId
    ) {

        if (
            !scheduleModal ||
            !scheduleFaculty ||
            !scheduleModalTitle
        ) {
            return;
        }


        const targetId =
            employeeId ||
            selectedScheduleFacultyId ||
            (
                facultyEmployees[0] &&
                facultyEmployees[0].id
            );


        if (!targetId) {
            return;
        }


        const existing =
            schedulesForFaculty(
                targetId
            );


        scheduleModalTitle.textContent =
            existing.length
                ? 'Edit Teaching Schedule'
                : 'Add Teaching Schedule';


        scheduleFaculty.value =
            targetId;


        populateGridEditor(
            targetId
        );


        scheduleModal.show();

    }


    function populateGridEditor(
        employeeId
    ) {

        if (!gridEditBody) {
            return;
        }


        const entries =
            schedulesForFaculty(
                employeeId
            );


        let rows = '';


        for (
            let hour = GRID_START_HOUR;
            hour < GRID_END_HOUR;
            hour++
        ) {

            const rowStart =
                hour * 60;

            const rowEnd =
                (hour + 1) * 60;


            const cells =
                DAY_COLUMNS
                    .map(function (day) {

                        const match =
                            entries.find(
                                function (schedule) {

                                    return (
                                        schedule.days.indexOf(day) !== -1 &&
                                        parseTime(
                                            schedule.timeStart
                                        ) < rowEnd &&
                                        parseTime(
                                            schedule.timeEnd
                                        ) > rowStart
                                    );

                                }
                            );


                        return `

                            <td>

                                <input
                                    type="text"
                                    class="form-control pp-form-control form-control-sm grid-cell-input"
                                    data-hour="${hour}"
                                    data-day="${escapeHtml(day)}"
                                    value="${escapeHtml(
                                        match
                                            ? match.subject
                                            : ''
                                    )}"
                                >

                            </td>

                        `;

                    })
                    .join('');


            rows += `

                <tr>

                    <td class="pp-grid-time-col">
                        ${rowLabel(hour)}
                    </td>

                    ${cells}

                </tr>

            `;

        }


        gridEditBody.innerHTML =
            rows;

    }


    function readGridAsSchedules(
        employeeId
    ) {

        if (!gridEditBody) {
            return [];
        }


        const inputs =
            Array.prototype.slice.call(
                gridEditBody.querySelectorAll(
                    '.grid-cell-input'
                )
            );


        const runs = [];


        DAY_COLUMNS.forEach(
            function (day) {

                const dayInputs =
                    inputs
                        .filter(function (input) {

                            return (
                                input.dataset.day ===
                                day
                            );

                        })
                        .sort(function (a, b) {

                            return (
                                Number(
                                    a.dataset.hour
                                ) -
                                Number(
                                    b.dataset.hour
                                )
                            );

                        });


                let currentRun =
                    null;


                dayInputs.forEach(
                    function (input) {

                        const subject =
                            input.value.trim();

                        const hour =
                            Number(
                                input.dataset.hour
                            );


                        if (
                            subject &&
                            currentRun &&
                            currentRun.subject === subject &&
                            currentRun.endHour === hour
                        ) {

                            currentRun.endHour =
                                hour + 1;

                        } else {

                            if (currentRun) {

                                runs.push(
                                    currentRun
                                );

                            }


                            currentRun =
                                subject
                                    ? {
                                        subject:
                                            subject,

                                        days:
                                            [day],

                                        startHour:
                                            hour,

                                        endHour:
                                            hour + 1
                                    }
                                    : null;

                        }

                    }
                );


                if (currentRun) {

                    runs.push(
                        currentRun
                    );

                }

            }
        );


        return runs.map(
            function (run) {

                function pad(value) {

                    return (
                        value < 10
                            ? '0'
                            : ''
                    ) + value;

                }


                return {

                    id:
                        DataStore.nextNumericId(
                            schedules
                        ),

                    employeeId:
                        employeeId,

                    subject:
                        run.subject,

                    days:
                        run.days,

                    timeStart:
                        pad(
                            run.startHour
                        ) +
                        ':00',

                    timeEnd:
                        pad(
                            run.endHour
                        ) +
                        ':00'

                };

            }
        );

    }


    if (scheduleFaculty) {

        scheduleFaculty.addEventListener(
            'change',
            function () {

                populateGridEditor(
                    scheduleFaculty.value
                );

            }
        );

    }


    if (addScheduleBtn) {

        addScheduleBtn.addEventListener(
            'click',
            function () {

                openScheduleModal(
                    selectedScheduleFacultyId
                );

            }
        );

    }


    if (editScheduleBtn) {

        editScheduleBtn.addEventListener(
            'click',
            function () {

                openScheduleModal(
                    selectedScheduleFacultyId
                );

            }
        );

    }


    if (deleteScheduleBtn) {

        deleteScheduleBtn.addEventListener(
            'click',
            function () {

                if (
                    !selectedScheduleFacultyId
                ) {
                    return;
                }


                const name =
                    facultyName(
                        selectedScheduleFacultyId
                    );


                ConfirmModal.show({

                    title:
                        'Delete Teaching Schedule',

                    message:
                        'Delete the entire weekly teaching schedule for ' +
                        name +
                        '?',

                    confirmText:
                        'Delete Schedule',

                    tone:
                        'danger'

                })
                .then(function (confirmed) {

                    if (!confirmed) {
                        return;
                    }


                    schedules =
                        schedules.filter(
                            function (schedule) {

                                return (
                                    schedule.employeeId !==
                                    selectedScheduleFacultyId
                                );

                            }
                        );


                    persistSchedules();

                    renderScheduleDetail();


                    if (facultySearch) {
                        facultySearch.value = '';
                    }


                    if (scheduleDetailContent) {
                        scheduleDetailContent.classList.add(
                            'd-none'
                        );
                    }


                    if (scheduleDetailEmpty) {
                        scheduleDetailEmpty.classList.remove(
                            'd-none'
                        );
                    }


                    selectedScheduleFacultyId =
                        null;


                    PPToast.success(
                        'Teaching schedule deleted.'
                    );

                });

            }
        );

    }


    if (scheduleForm) {

        scheduleForm.addEventListener(
            'submit',
            function (e) {

                e.preventDefault();


                const employeeId =
                    scheduleFaculty.value;


                const newEntries =
                    readGridAsSchedules(
                        employeeId
                    );


                schedules =
                    schedules
                        .filter(function (schedule) {

                            return (
                                schedule.employeeId !==
                                employeeId
                            );

                        })
                        .concat(
                            newEntries
                        );


                persistSchedules();


                if (scheduleModal) {
                    scheduleModal.hide();
                }


                selectedScheduleFacultyId =
                    employeeId;


                if (facultySearch) {

                    const employee =
                        employees.find(
                            function (e) {
                                return e.id === employeeId;
                            }
                        );

                    facultySearch.value =
                        employee
                            ? employee.displayName
                            : '';

                }


                renderScheduleDetail();


                PPToast.success(
                    'Teaching schedule saved.'
                );

            }
        );

    }


    /* Teaching Monitoring */

    const teachingMonitoringModalEl =
        document.getElementById(
            'teachingMonitoringModal'
        );

    const teachingMonitoringModal =
        teachingMonitoringModalEl
            ? new bootstrap.Modal(
                teachingMonitoringModalEl
            )
            : null;

    const teachingMonitoringForm =
        document.getElementById(
            'teachingMonitoringForm'
        );

    const monitorFaculty =
        document.getElementById(
            'monitorFaculty'
        );

    const monitorDate =
        document.getElementById(
            'monitorDate'
        );

    const monitorCheckTime =
        document.getElementById(
            'monitorCheckTime'
        );

    const monitorSubject =
        document.getElementById(
            'monitorSubject'
        );

    const monitorPeriod =
        document.getElementById(
            'monitorPeriod'
        );

    const monitorStatus =
        document.getElementById(
            'monitorStatus'
        );

    const monitorRemarks =
        document.getElementById(
            'monitorRemarks'
        );


    if (monitorDate) {
        monitorDate.max = today;
    }


    function automaticTeachingStatus(
        scheduledStart,
        checkTime
    ) {

        const start =
            parseTime(
                scheduledStart
            );

        const actual =
            parseTime(
                checkTime
            );


        if (
            actual >
            start + GRACE_MINUTES
        ) {
            return 'Late';
        }


        return 'Teaching';

    }


    function openTeachingMonitoring(
        employeeId,
        subject,
        day,
        timeStart,
        timeEnd
    ) {

        if (!teachingMonitoringModal) {
            return;
        }


        const employee =
            employees.find(
                function (e) {
                    return e.id === employeeId;
                }
            );


        if (!employee) {
            return;
        }


        selectedMonitoringClass = {

            employeeId:
                employeeId,

            subject:
                subject,

            day:
                day,

            timeStart:
                timeStart,

            timeEnd:
                timeEnd

        };


        const date =
            getNextDateForDay(day);


        const now =
            new Date();


        let checkTime =
            now.toTimeString()
                .slice(0, 5);


        if (
            getDayName(now) !== day
        ) {

            checkTime =
                timeStart;

        }


        monitorFaculty.value =
            employee.displayName;

        monitorDate.value =
            date;

        monitorCheckTime.value =
            checkTime;

        monitorSubject.value =
            subject;

        monitorPeriod.value =
            formatTime12(timeStart) +
            ' – ' +
            formatTime12(timeEnd);


        const existing =
            getMonitoringRecord(
                employeeId,
                date,
                subject,
                day,
                timeStart
            );


        if (existing) {

            monitorStatus.value =
                existing.teachingStatus;

            monitorRemarks.value =
                existing.remarks || '';

            monitorCheckTime.value =
                existing.checkTime;

        } else {

            monitorStatus.value =
                automaticTeachingStatus(
                    timeStart,
                    checkTime
                );

            monitorRemarks.value =
                '';

        }


        teachingMonitoringModal.show();

    }


    if (monitorCheckTime) {

        monitorCheckTime.addEventListener(
            'change',
            function () {

                if (
                    !selectedMonitoringClass
                ) {
                    return;
                }


                if (
                    monitorStatus.value ===
                    'Not Teaching'
                ) {
                    return;
                }


                monitorStatus.value =
                    automaticTeachingStatus(
                        selectedMonitoringClass.timeStart,
                        monitorCheckTime.value
                    );

            }
        );

    }


    if (monitorStatus) {

        monitorStatus.addEventListener(
            'change',
            function () {

                if (
                    monitorStatus.value ===
                    'Not Teaching'
                ) {
                    return;
                }


                if (
                    !selectedMonitoringClass ||
                    !monitorCheckTime.value
                ) {
                    return;
                }


                monitorStatus.value =
                    automaticTeachingStatus(
                        selectedMonitoringClass.timeStart,
                        monitorCheckTime.value
                    );

            }
        );

    }


    if (teachingMonitoringForm) {

        teachingMonitoringForm.addEventListener(
            'submit',
            function (e) {

                e.preventDefault();


                if (
                    !selectedMonitoringClass
                ) {
                    return;
                }


                const item =
                    selectedMonitoringClass;


                const date =
                    monitorDate.value;

                const checkTime =
                    monitorCheckTime.value;

                const status =
                    monitorStatus.value;

                const remarks =
                    monitorRemarks.value.trim();


                if (
                    !date ||
                    !checkTime ||
                    !status
                ) {
                    return;
                }


                const existingIndex =
                    records.findIndex(
                        function (record) {

                            return (
                                record.teachingMonitoring === true &&
                                record.employeeId === item.employeeId &&
                                record.date === date &&
                                record.subject === item.subject &&
                                record.day === item.day &&
                                record.timeStart === item.timeStart
                            );

                        }
                    );


                const entry = {

                    employeeId:
                        item.employeeId,

                    date:
                        date,

                    checkTime:
                        checkTime,

                    teachingStatus:
                        status,

                    remarks:
                        remarks,

                    teachingMonitoring:
                        true,

                    subject:
                        item.subject,

                    day:
                        item.day,

                    timeStart:
                        item.timeStart,

                    timeEnd:
                        item.timeEnd

                };


                if (existingIndex >= 0) {

                    records[existingIndex] =
                        entry;

                } else {

                    records.push(
                        entry
                    );

                }


                persistRecords();


                teachingMonitoringModal.hide();


                renderScheduleDetail();


                PPToast.success(
                    'Teaching monitoring record saved.'
                );


                selectedMonitoringClass =
                    null;

            }
        );

    }


    /* Initialize */

    populateDatalist();

    populateFacultySelect();

    renderTable();

    renderScheduleDetail();

})();