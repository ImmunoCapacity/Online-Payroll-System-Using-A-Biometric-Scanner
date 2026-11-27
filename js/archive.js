/**
 * Utility → Archive, System Administrator (and, for ?view=schedules only,
 * Attendance Monitoring Staff). Read-only.
 *
 *   ?view=employees   archived employees (api/utility/archive); archiving and
 *                     restoring are done by the Payroll Master in Employee Records.
 *   ?view=bir|pagibig|sss|philhealth
 *                     deduction tables the Payroll Master archived in
 *                     Maintenance when the government changed them
 *                     (api/utility/archive/tables/{table}).
 *   ?view=schedules   archived faculty classes (api/utility/archive/schedules);
 *                     "Archive All Schedules" in Faculty Schedule is how they
 *                     get archived, by Attendance Monitoring Staff.
 *
 * The sub-menu (payrollpro-layout.js) switches views without reloading.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'archive',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var el = function (id) { return document.getElementById(id); };
    var employees = null;

    /** Each archived table: its title and the columns of its brackets. */
    var TABLES = {
        bir: {
            title: 'BIR Table',
            columns: [['Bracket Min', 'min'], ['Bracket Max', 'max'], ['Base Amount', 'base'], ['Rate %', 'rate']]
        },
        pagibig: {
            title: 'Pag-IBIG Table',
            columns: [['Compensation Min', 'min'], ['Compensation Max', 'max'], ['Employee Share', 'share'], ['Rate %', 'rate']]
        },
        sss: {
            title: 'SSS Table',
            columns: [['Compensation Min', 'min'], ['Compensation Max', 'max'], ['Monthly Salary Credit', 'msc'], ['Employee Share %', 'rate']]
        },
        philhealth: {
            title: 'PhilHealth Table',
            columns: [['Salary Min', 'min'], ['Salary Max', 'max'], ['Monthly Premium', 'premium'], ['Rate %', 'rate']]
        }
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function date(text) {
        if (!text) return '—';
        var d = new Date(text.length === 10 ? text + 'T00:00:00' : text);
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function dateTime(text) {
        return new Date(text).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function peso(n) {
        return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function api(url) {
        return fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            if (!data.success) {
                throw new Error(data.message === 'Not Found.'
                    ? 'The server doesn\'t have this Archive page yet. Restart it with start-payroll.bat.' : data.message);
            }
            return data;
        });
    }

    // ---------------------------------------------------------------
    // Employees
    // ---------------------------------------------------------------

    function renderEmployees() {
        var q = el('archiveSearch').value.trim().toLowerCase();
        var shown = employees.filter(function (e) {
            return !q || (e.employeeNumber + ' ' + e.name).toLowerCase().indexOf(q) !== -1;
        });
        el('archiveCount').textContent = employees.length
            ? shown.length + ' of ' + employees.length + ' archived employee' + (employees.length === 1 ? '' : 's') + '.'
            : '';
        el('archiveEmpty').classList.toggle('d-none', shown.length > 0);
        el('archiveEmpty').textContent = employees.length ? 'No archived employees match the search.' : 'No archived employees.';
        el('archiveBody').innerHTML = shown.map(function (e) {
            return '<tr>' +
                '<td>' + escapeHtml(e.employeeNumber) + '</td>' +
                '<td><strong>' + escapeHtml(e.name) + '</strong></td>' +
                '<td>' + escapeHtml(PayrollProLayout.staffTypeLabel(e.type)) + '</td>' +
                '<td>' + escapeHtml(e.status) + '</td>' +
                '<td>' + date(e.dateHired) + '</td>' +
                '<td>' + date(e.archivedAt) + '</td>' +
            '</tr>';
        }).join('');
    }

    function loadEmployees() {
        if (employees) { renderEmployees(); return; }
        el('archiveBody').innerHTML = '';
        el('archiveEmpty').textContent = 'Loading…';
        el('archiveEmpty').classList.remove('d-none');
        api('api/utility/archive').then(function (data) {
            employees = data.employees;
            renderEmployees();
        }).catch(function (error) {
            el('archiveEmpty').textContent = error.message || 'Could not load the archive.';
            el('archiveEmpty').classList.remove('d-none');
        });
    }

    el('archiveSearch').addEventListener('input', function () { if (employees) renderEmployees(); });

    // ---------------------------------------------------------------
    // Deduction tables
    // ---------------------------------------------------------------

    var tableToken = 0;

    function cell(key, value) {
        if (key === 'rate') return Number(value) + '%';
        if (value == null) return key === 'max' ? 'Above' : '—';
        return peso(value);
    }

    function loadTable(key) {
        var config = TABLES[key];
        var token = ++tableToken;
        el('tableArchives').innerHTML = '';
        el('tablesEmptyWrap').classList.remove('d-none');
        el('tablesEmpty').textContent = 'Loading…';
        api('api/utility/archive/tables/' + key).then(function (data) {
            if (token !== tableToken) return;
            el('tablesEmptyWrap').classList.toggle('d-none', data.archives.length > 0);
            el('tablesEmpty').textContent = 'No archived ' + config.title + ' yet.';
            el('tableArchives').innerHTML = data.archives.map(function (a) {
                return '<div class="pp-widget mb-3">' +
                    '<div class="pp-widget-header">' +
                        '<h2 class="pp-widget-title">' + a.year + ' ' + escapeHtml(config.title) + '</h2>' +
                        '<span class="text-muted small">Archived ' + dateTime(a.archivedAt) + ' · ' +
                            a.brackets.length + ' bracket' + (a.brackets.length === 1 ? '' : 's') + '</span>' +
                    '</div>' +
                    '<div class="pp-widget-body">' +
                        '<div class="pp-table-wrap"><table class="pp-table w-100">' +
                            '<thead><tr>' + config.columns.map(function (c) {
                                return '<th class="text-end">' + escapeHtml(c[0]) + '</th>';
                            }).join('') + '</tr></thead>' +
                            '<tbody>' + a.brackets.map(function (b) {
                                return '<tr>' + config.columns.map(function (c) {
                                    return '<td class="text-end">' + cell(c[1], b[c[1]]) + '</td>';
                                }).join('') + '</tr>';
                            }).join('') + '</tbody>' +
                        '</table></div>' +
                    '</div>' +
                '</div>';
            }).join('');
        }).catch(function (error) {
            if (token !== tableToken) return;
            el('tablesEmpty').textContent = error.message || 'Could not load the archive.';
        });
    }

    // ---------------------------------------------------------------
    // Faculty schedules
    // ---------------------------------------------------------------

    var schedules = null;      // flat rows from the server, one per archived class date
    var scheduleEmployees = []; // grouped: one entry per employee, with their deduplicated classes
    var DAY_LABEL = {
        MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
        THURSDAY: 'Thursday', FRIDAY: 'Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday'
    };
    var scheduleDetailModal = null;

    /**
     * The server lists one row per archived class date (a recurring class can
     * repeat for months), which is noisy to browse. Grouped here into one
     * row per employee, and within that, one row per distinct recurring
     * class (same subject/section/room/day/time) — the latest date stands
     * in for the whole run, since the day of week is what matters, not any
     * one occurrence.
     */
    function groupSchedules(rows) {
        var byEmployee = {};
        rows.forEach(function (c) {
            var emp = byEmployee[c.employeeId] || (byEmployee[c.employeeId] = {
                employeeId: c.employeeId, employeeNumber: c.employeeNumber, employeeName: c.employeeName,
                type: c.type, classesByKey: {}
            });
            var key = [c.subject, c.classSection, c.room, c.dayOfWeek, c.scheduledStart, c.scheduledEnd].join('|');
            var existing = emp.classesByKey[key];
            if (!existing || c.classDate > existing.classDate) {
                emp.classesByKey[key] = c;
            }
        });
        return Object.keys(byEmployee).map(function (id) {
            var emp = byEmployee[id];
            var classes = Object.keys(emp.classesByKey).map(function (k) { return emp.classesByKey[k]; });
            classes.sort(function (a, b) { return a.subject.localeCompare(b.subject); });
            return {
                employeeId: emp.employeeId, employeeNumber: emp.employeeNumber, employeeName: emp.employeeName,
                type: emp.type, classes: classes
            };
        }).sort(function (a, b) { return a.employeeName.localeCompare(b.employeeName); });
    }

    function renderSchedules() {
        var q = el('schedulesSearch').value.trim().toLowerCase();
        var shown = scheduleEmployees.filter(function (e) {
            return !q || (e.employeeNumber + ' ' + e.employeeName).toLowerCase().indexOf(q) !== -1;
        });
        el('schedulesCount').textContent = scheduleEmployees.length
            ? shown.length + ' of ' + scheduleEmployees.length + ' faculty member' + (scheduleEmployees.length === 1 ? '' : 's') + ' with archived classes.'
            : '';
        el('schedulesEmpty').classList.toggle('d-none', shown.length > 0);
        el('schedulesEmpty').textContent = scheduleEmployees.length ? 'No faculty match the search.' : 'No archived classes.';
        el('schedulesBody').innerHTML = shown.map(function (e, i) {
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(e.employeeId) + '" ' +
                    'aria-label="View the archived schedule of ' + escapeHtml(e.employeeName) + '">' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + escapeHtml(e.employeeNumber) + '</td>' +
                '<td><strong>' + escapeHtml(e.employeeName) + '</strong></td>' +
                '<td>' + e.classes.length + ' class' + (e.classes.length === 1 ? '' : 'es') + '</td>' +
            '</tr>';
        }).join('');
    }

    function openScheduleDetail(employeeId) {
        var e = scheduleEmployees.find(function (x) { return x.employeeId === employeeId; });
        if (!e) return;
        el('scheduleDetailTitle').textContent = e.employeeName + '’s Archived Schedule';
        el('scheduleDetailBody').innerHTML = e.classes.map(function (c) {
            return '<tr>' +
                '<td>' + escapeHtml(c.subject) + ' <span class="text-muted">(' + escapeHtml(c.classSection) + ')</span></td>' +
                '<td>' + escapeHtml(c.room || '—') + '</td>' +
                '<td>' + escapeHtml(DAY_LABEL[c.dayOfWeek] || c.dayOfWeek) + '</td>' +
                '<td>' + escapeHtml(c.status) + '</td>' +
            '</tr>';
        }).join('');
        if (!scheduleDetailModal) scheduleDetailModal = new bootstrap.Modal(el('scheduleDetailModal'));
        scheduleDetailModal.show();
    }

    el('schedulesBody').addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-employee]');
        if (row) openScheduleDetail(row.dataset.employee);
    });
    el('schedulesBody').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-employee]')) {
            e.preventDefault();
            openScheduleDetail(e.target.dataset.employee);
        }
    });

    function loadSchedules() {
        if (schedules) { renderSchedules(); return; }
        el('schedulesBody').innerHTML = '';
        el('schedulesEmpty').textContent = 'Loading…';
        el('schedulesEmpty').classList.remove('d-none');
        api('api/utility/archive/schedules').then(function (data) {
            schedules = data.classes;
            scheduleEmployees = groupSchedules(schedules);
            renderSchedules();
        }).catch(function (error) {
            el('schedulesEmpty').textContent = error.message || 'Could not load the archive.';
            el('schedulesEmpty').classList.remove('d-none');
        });
    }

    el('schedulesSearch').addEventListener('input', function () { if (schedules) renderSchedules(); });

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    // Attendance Monitoring Staff can only open ?view=schedules (see auth-guard.js);
    // falling back to "employees" for them just lands on a "no access" wall.
    function defaultView() {
        try {
            var raw = localStorage.getItem('ppUser');
            var user = raw ? JSON.parse(raw) : null;
            return user && user.role === 'Attendance Monitoring Staff' ? 'schedules' : 'employees';
        } catch (e) {
            return 'employees';
        }
    }

    function show(view) {
        if (view !== 'employees' && view !== 'schedules' && !TABLES[view]) view = defaultView();
        document.querySelectorAll('.pp-archive-sidebar-link').forEach(function (a) {
            a.classList.toggle('active', a.dataset.archive === view);
        });
        var isEmployees = view === 'employees';
        var isSchedules = view === 'schedules';
        el('employeesView').classList.toggle('d-none', !isEmployees);
        el('schedulesView').classList.toggle('d-none', !isSchedules);
        el('tablesView').classList.toggle('d-none', isEmployees || isSchedules);
        if (isEmployees) {
            el('archiveTitle').textContent = 'Archive — Employees';
            el('archiveSubtitle').textContent = 'Employees who no longer work here. Their payroll, attendance and leave history is kept.';
            el('archiveNote').textContent = 'This list is read-only. The Payroll Master archives and restores employees in Employee Records.';
            loadEmployees();
        } else if (isSchedules) {
            el('archiveTitle').textContent = 'Archive — Faculty Schedules';
            el('archiveSubtitle').textContent = 'Classes already held, cleared from the active Faculty Schedule view.';
            el('archiveNote').textContent = 'This list is read-only. Attendance Monitoring Staff archives past classes from Faculty Schedule ("Archive All Schedules").';
            loadSchedules();
        } else {
            var title = TABLES[view].title;
            el('archiveTitle').textContent = 'Archive — ' + title;
            el('archiveSubtitle').textContent = 'Earlier ' + title + ' brackets, replaced when the government changed the table.';
            el('archiveNote').textContent = 'This list is read-only. The Payroll Master archives a table in Maintenance before entering the new brackets; ' +
                'archived brackets are no longer used by payroll.';
            loadTable(view);
        }
    }

    document.querySelectorAll('.pp-archive-sidebar-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            history.replaceState({}, '', 'archive.html?view=' + encodeURIComponent(link.dataset.archive));
            show(link.dataset.archive);
        });
    });

    PayrollProLayout.loadStaffTypeLabels().then(function () {
        show(new URLSearchParams(location.search).get('view') || defaultView());
    });
})();
