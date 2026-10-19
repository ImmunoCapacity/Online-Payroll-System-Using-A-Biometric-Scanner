/**
 * Biometric Records: weekly and monthly views, and one employee's attendance.
 *
 *  - View (filter bar): Daily is the table of one day (js/dtr.js). Weekly and
 *    Monthly show each employee's totals for the week (Mon–Sun) or month
 *    containing the chosen date: present, late, absent, on leave, hours
 *    (api/dtr/summary).
 *  - Clicking an employee opens their attendance, where you choose Daily,
 *    Weekly or Monthly and step back / forward (api/dtr/employee-days).
 */
(function () {
    'use strict';

    var el = function (id) { return document.getElementById(id); };
    var filterView = el('filterView');
    var filterDate = el('filterDate');
    var filterType = el('filterType');
    var filterSearch = el('filterSearch');
    if (!filterView || !filterDate) return;

    var summaryRows = [];
    var summaryToken = 0;
    var att = { employeeId: null, view: 'weekly', anchor: null, token: 0 };
    var modal = new bootstrap.Modal(el('attendanceModal'));

    // ---------------------------------------------------------------
    // Dates
    // ---------------------------------------------------------------

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseIso(text) {
        var p = String(text).split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function today() {
        return iso(new Date());
    }

    /** [from, to] of the day, the week (Monday–Sunday) or the month containing a date. */
    function rangeOf(view, dateText) {
        var d = parseIso(dateText || today());
        if (view === 'monthly') {
            return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
        }
        if (view === 'weekly') {
            var monday = new Date(d);
            monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            var sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            return [iso(monday), iso(sunday)];
        }
        return [iso(d), iso(d)];
    }

    function shift(view, dateText, step) {
        var d = parseIso(dateText);
        if (view === 'monthly') return iso(new Date(d.getFullYear(), d.getMonth() + step, 1));
        d.setDate(d.getDate() + (view === 'weekly' ? 7 : 1) * step);
        return iso(d);
    }

    function rangeLabel(view, range) {
        var a = parseIso(range[0]);
        var b = parseIso(range[1]);
        if (view === 'monthly') return a.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
        if (view === 'daily') return a.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return a.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' – ' +
            b.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // ---------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function time12(hhmm) {
        if (!hhmm) return '—';
        var p = hhmm.split(':').map(Number);
        var h = p[0] % 12 || 12;
        return h + ':' + String(p[1]).padStart(2, '0') + ' ' + (p[0] < 12 ? 'AM' : 'PM');
    }

    function hoursText(h) {
        var n = Number(h) || 0;
        if (!n) return '—';
        var hours = Math.floor(n);
        var minutes = Math.round((n - hours) * 60);
        return hours + 'h' + (minutes ? ' ' + minutes + 'm' : '');
    }

    var STATUS = {
        present: ['pp-badge-present', 'Present'],
        late: ['pp-badge-late', 'Late'],
        absent: ['pp-badge-absent', 'Absent'],
        leave: ['pp-badge-leave', 'On Leave'],
        'rest-day': ['pp-att-muted', 'Rest Day'],
        upcoming: ['pp-att-muted', '—'],
        'not-hired': ['pp-att-muted', 'Not yet hired']
    };

    function statusBadge(status) {
        var s = STATUS[status] || STATUS.absent;
        return '<span class="pp-badge ' + s[0] + '">' + s[1] + '</span>';
    }

    function typeBadge(type) {
        var cls = type === 'Faculty' ? 'pp-badge-faculty' : type === 'Faculty/Admin' ? 'pp-badge-faculty-admin' : 'pp-badge-admin';
        return '<span class="pp-badge ' + cls + '">' + escapeHtml(type) + '</span>';
    }

    function api(url) {
        return fetch(url).then(function (r) { return r.json(); });
    }

    // ---------------------------------------------------------------
    // Page view: Daily (dtr.js) / Weekly / Monthly (totals per employee)
    // ---------------------------------------------------------------

    function applyView() {
        var view = filterView.value;
        var daily = view === 'daily';
        el('dtrDailyCard').classList.toggle('d-none', !daily);
        el('dtrSummaryCard').classList.toggle('d-none', daily);
        el('filterDateLabel').textContent = daily ? 'Date' : view === 'weekly' ? 'Week of' : 'Month of';
        var hint = el('dtrViewHint').querySelector('span');
        hint.textContent = daily
            ? 'Click an employee to see their attendance by day, week or month.'
            : 'Showing ' + rangeLabel(view, rangeOf(view, filterDate.value)) + '. Click an employee to see their attendance by day, week or month.';
        if (!daily) loadSummary();
    }

    function loadSummary() {
        var view = filterView.value;
        if (view === 'daily') return;
        var range = rangeOf(view, filterDate.value);
        var token = ++summaryToken;
        el('dtrSummaryBody').innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Loading…</td></tr>';
        el('dtrSummaryEmpty').classList.add('d-none');
        api('api/dtr/summary?from=' + range[0] + '&to=' + range[1]).then(function (data) {
            if (token !== summaryToken) return;
            if (!data.success) throw new Error(data.message);
            summaryRows = data.employees;
            renderSummary();
        }).catch(function () {
            if (token !== summaryToken) return;
            summaryRows = [];
            el('dtrSummaryBody').innerHTML = '';
            el('dtrSummaryEmpty').textContent = 'Could not load attendance from the server.';
            el('dtrSummaryEmpty').classList.remove('d-none');
        });
    }

    function renderSummary() {
        var type = filterType ? filterType.value : 'all';
        var q = filterSearch ? filterSearch.value.trim().toLowerCase() : '';
        var rows = summaryRows.filter(function (r) {
            return (type === 'all' || r.type === type) &&
                (!q || (r.employeeName + ' ' + r.employeeNumber).toLowerCase().indexOf(q) !== -1);
        });
        if (!rows.length) {
            el('dtrSummaryBody').innerHTML = '';
            el('dtrSummaryEmpty').textContent = 'No employees match the current filters.';
            el('dtrSummaryEmpty').classList.remove('d-none');
            return;
        }
        el('dtrSummaryEmpty').classList.add('d-none');
        el('dtrSummaryBody').innerHTML = rows.map(function (r) {
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(r.employeeId) + '" ' +
                    'aria-label="Attendance of ' + escapeHtml(r.employeeName) + '">' +
                '<td><strong>' + escapeHtml(r.employeeName) + '</strong><br><span class="text-muted small">' + escapeHtml(r.employeeNumber) + '</span></td>' +
                '<td>' + typeBadge(r.type) + '</td>' +
                '<td class="text-end">' + r.present + '</td>' +
                '<td class="text-end">' + r.late + '</td>' +
                '<td class="text-end">' + r.absent + '</td>' +
                '<td class="text-end">' + r.onLeave + '</td>' +
                '<td class="text-end">' + hoursText(r.hours) + '</td>' +
            '</tr>';
        }).join('');
    }

    filterView.addEventListener('change', applyView);
    filterDate.addEventListener('change', function () { if (filterView.value !== 'daily') applyView(); });
    if (filterType) filterType.addEventListener('change', function () { if (filterView.value !== 'daily') renderSummary(); });
    if (filterSearch) filterSearch.addEventListener('input', function () { if (filterView.value !== 'daily') renderSummary(); });
    // New scans (Sync Device / auto-sync) refresh the totals too.
    document.addEventListener('pp:dtr-synced', function () { if (filterView.value !== 'daily') loadSummary(); });

    // ---------------------------------------------------------------
    // One employee: Daily / Weekly / Monthly
    // ---------------------------------------------------------------

    function openAttendance(employeeId) {
        if (!employeeId) return;
        att.employeeId = employeeId;
        att.view = filterView.value === 'daily' ? 'weekly' : filterView.value;
        att.anchor = filterDate.value || today();
        el('attendanceTitle').textContent = 'Attendance';
        el('attendanceSub').textContent = '';
        loadAttendance();
        modal.show();
    }

    function loadAttendance() {
        var range = rangeOf(att.view, att.anchor);
        var token = ++att.token;
        document.querySelectorAll('[data-att-view]').forEach(function (b) {
            b.classList.toggle('active', b.dataset.attView === att.view);
            b.setAttribute('aria-pressed', b.dataset.attView === att.view ? 'true' : 'false');
        });
        el('attRange').textContent = rangeLabel(att.view, range);
        el('attBody').innerHTML = '<p class="text-muted text-center py-4 mb-0">Loading…</p>';
        el('attTotals').innerHTML = '';
        api('api/dtr/employee-days?employeeId=' + encodeURIComponent(att.employeeId) + '&from=' + range[0] + '&to=' + range[1])
            .then(function (data) {
                if (token !== att.token) return;
                if (!data.success) {
                    throw new Error(data.message === 'Not Found.'
                        ? 'The server doesn\'t have this view yet. Restart it with start-payroll.bat.' : data.message);
                }
                var a = data.attendance;
                el('attendanceTitle').textContent = a.employee.name;
                el('attendanceSub').textContent = a.employee.employeeNumber + ' · ' + a.employee.type;
                renderTotals(a.totals);
                if (att.view === 'daily') renderDay(a.days[0]);
                else if (att.view === 'weekly') renderWeek(a.days);
                else renderMonth(a.days, range);
            })
            .catch(function (error) {
                if (token !== att.token) return;
                el('attBody').innerHTML = '<p class="text-danger text-center py-4 mb-0">' +
                    escapeHtml(error.message || 'Could not load the attendance.') + '</p>';
            });
    }

    function renderTotals(t) {
        el('attTotals').innerHTML =
            '<span><strong>' + t.present + '</strong> present</span>' +
            '<span><strong>' + t.late + '</strong> late</span>' +
            '<span><strong>' + t.absent + '</strong> absent</span>' +
            '<span><strong>' + t.onLeave + '</strong> on leave</span>' +
            '<span><strong>' + hoursText(t.hours) + '</strong> worked</span>';
    }

    function renderDay(d) {
        el('attTotals').innerHTML = '';
        el('attBody').innerHTML =
            '<div class="pp-att-day">' +
                '<div class="pp-att-day-status">' + statusBadge(d.status) + (d.manual ? ' <span class="text-muted small"><i class="bi bi-pencil-fill"></i> Manual entry</span>' : '') + '</div>' +
                '<div class="pp-att-day-grid">' +
                    '<div><span>Time In</span><strong>' + time12(d.timeIn) + '</strong></div>' +
                    '<div><span>Time Out</span><strong>' + time12(d.timeOut) + '</strong></div>' +
                    '<div><span>Total Hours</span><strong>' + hoursText(d.hours) + '</strong></div>' +
                '</div>' +
                (d.remarks ? '<p class="text-muted small mb-0 mt-3">Remarks: ' + escapeHtml(d.remarks) + '</p>' : '') +
            '</div>';
    }

    function renderWeek(days) {
        el('attBody').innerHTML =
            '<div class="pp-table-wrap"><table class="pp-table pp-att-table"><thead><tr>' +
                '<th>Day</th><th>Time In</th><th>Time Out</th><th>Total Hours</th><th>Status</th>' +
            '</tr></thead><tbody>' +
            days.map(function (d) {
                var date = parseIso(d.date);
                return '<tr class="pp-row-clickable" data-day="' + d.date + '" tabindex="0" role="button">' +
                    '<td><strong>' + date.toLocaleDateString('en-PH', { weekday: 'short' }) + '</strong> ' +
                        '<span class="text-muted">' + date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + '</span></td>' +
                    '<td>' + time12(d.timeIn) + '</td>' +
                    '<td>' + time12(d.timeOut) + '</td>' +
                    '<td>' + hoursText(d.hours) + '</td>' +
                    '<td>' + statusBadge(d.status) + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>';
    }

    function renderMonth(days, range) {
        var first = parseIso(range[0]);
        var lead = (first.getDay() + 6) % 7;   // weeks start on Monday
        var cells = [];
        for (var i = 0; i < lead; i++) cells.push('<div class="pp-att-cell empty"></div>');
        days.forEach(function (d) {
            var date = parseIso(d.date);
            cells.push('<button type="button" class="pp-att-cell status-' + d.status + '" data-day="' + d.date + '" ' +
                'title="' + escapeHtml((STATUS[d.status] || STATUS.absent)[1] + (d.timeIn ? ' · ' + time12(d.timeIn) + ' – ' + time12(d.timeOut) : '')) + '">' +
                '<span class="pp-att-num">' + date.getDate() + '</span>' +
                '<span class="pp-att-cell-status">' + ((STATUS[d.status] || STATUS.absent)[1] === '—' ? '' : (STATUS[d.status] || STATUS.absent)[1]) + '</span>' +
                (Number(d.hours) ? '<span class="pp-att-cell-hours">' + hoursText(d.hours) + '</span>' : '') +
            '</button>');
        });
        el('attBody').innerHTML =
            '<div class="pp-att-month">' +
                ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) { return '<div class="pp-att-weekday">' + w + '</div>'; }).join('') +
                cells.join('') +
            '</div>' +
            '<p class="text-muted small mt-2 mb-0">Click a day to see it in detail.</p>';
    }

    // Clicking a day (week list or month calendar) opens it in the Daily view.
    el('attBody').addEventListener('click', function (e) {
        var day = e.target.closest('[data-day]');
        if (!day) return;
        att.view = 'daily';
        att.anchor = day.dataset.day;
        loadAttendance();
    });

    document.querySelectorAll('[data-att-view]').forEach(function (b) {
        b.addEventListener('click', function () {
            att.view = b.dataset.attView;
            loadAttendance();
        });
    });
    el('attPrev').addEventListener('click', function () { att.anchor = shift(att.view, att.anchor, -1); loadAttendance(); });
    el('attNext').addEventListener('click', function () { att.anchor = shift(att.view, att.anchor, 1); loadAttendance(); });

    // Rows of either table open the employee's attendance.
    ['dtrBody', 'dtrSummaryBody'].forEach(function (id) {
        var body = el(id);
        if (!body) return;
        body.addEventListener('click', function (e) {
            var row = e.target.closest('tr[data-employee]');
            if (row) openAttendance(row.dataset.employee);
        });
        body.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-employee]')) {
                e.preventDefault();
                openAttendance(e.target.dataset.employee);
            }
        });
    });

    applyView();
})();
