/**
 * Faculty Teaching Hours — manual classroom checks (api/teaching-hours).
 *
 * For each scheduled class (from Faculty Schedule) the Attendance Monitoring
 * Staff or Payroll Master records a beginning and an ending classroom check,
 * then saves it; payable hours are derived directly from the checks, with
 * no separate approval step. Corrections to an already-recorded check need
 * an explanation in Remarks and are kept in the audit history. The server
 * enforces all of this; the page only hides what the user can't do.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'dtr',
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var STATUS_CLASS = {
        'Not checked': 'not-checked',
        Incomplete: 'incomplete',
        Complete: 'approved'
    };
    var STATUS_LABEL = {
        'Not checked': 'Not checked',
        Incomplete: 'Incomplete',
        Complete: 'Complete'
    };

    var LONG_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    var teachers = [];
    var weekStats = {};       // employeeId -> { classes, needsChecks, pending } this week
    var onCampusByEmployee = {}; // employeeId -> { timeIn, timeOut } today (api/teaching-hours/on-campus)
    var teacher = null;       // the faculty member being viewed
    var view = 'day';
    var rows = [];
    var openClassId = null;
    var roomFloor = {};        // room name -> floor level (Room Maintenance, api/rooms)
    var defaultTimeFloor = true; // first load of a faculty member: default to the earliest time + lowest floor

    var el = function (id) { return document.getElementById(id); };
    var listView = el('listView');
    var facultyView = el('facultyView');
    var anchorDate = el('anchorDate');
    var statusFilter = el('statusFilter');
    var timeFilter = el('timeFilter');
    var floorFilter = el('floorFilter');
    var body = el('teachingBody');
    var emptyState = el('emptyState');
    var checkModal = new bootstrap.Modal(el('checkModal'));


    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function api(url, options) {
        return fetch(url, options).then(function (r) { return r.json(); });
    }

    function postJson(url, payload) {
        return api(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function shortDate(text) {
        var d = parseIso(text);
        return DAY_NAMES[d.getDay()] + ', ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function time12(hhmm) {
        if (!hhmm) return '—';
        var p = hhmm.split(':').map(Number);
        return (p[0] % 12 || 12) + ':' + String(p[1]).padStart(2, '0') + ' ' + (p[0] >= 12 ? 'PM' : 'AM');
    }

    function hours(value) {
        return value == null ? '—' : Number(value).toFixed(2);
    }

    function statusBadge(status) {
        return '<span class="fm-status ' + (STATUS_CLASS[status] || 'not-checked') + '">' + escapeHtml(STATUS_LABEL[status] || status) + '</span>';
    }

    function checkCell(time, status) {
        if (!time) return '<span class="fm-check-none">—</span>';
        return '<span class="fm-check"><span class="fm-check-time">' + time12(time) + '</span>' +
            '<span class="fm-check-status ' + String(status).toLowerCase() + '">' + escapeHtml(status) + '</span></span>';
    }

    /** A biometric scanner record (that day's, or today's) — context only, not evidence a class was taught. */
    function onCampusBadge(timeIn, timeOut) {
        return timeIn
            ? '<span class="fm-status approved" title="Daily Time Record">' + time12(timeIn) +
                (timeOut ? ' – ' + time12(timeOut) : ' – (not yet out)') + '</span>'
            : '<span class="fm-status no-scan" title="No Daily Time Record">No scanner record</span>';
    }

    function addDays(text, days) {
        var d = parseIso(text);
        d.setDate(d.getDate() + days);
        return iso(d);
    }

    /** Monday of the week containing the date. */
    function weekStart(text) {
        var d = parseIso(text);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return iso(d);
    }

    function prettyDate(text) {
        var d = parseIso(text);
        return LONG_DAY_NAMES[d.getDay()] + ', ' + d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function employeeStatusBadge(status) {
        var cls = status === 'Active' ? 'pp-badge-present' : status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent';
        return '<span class="pp-badge ' + cls + '">' + escapeHtml(status || '—') + '</span>';
    }

    /** "1st Floor" sorts before "2nd Floor"; floors without a leading number sort last, alphabetically. */
    function floorSortKey(floor) {
        var m = /^(\d+)/.exec(String(floor || '').trim());
        return m ? Number(m[1]) : Infinity;
    }

    function compareFloors(a, b) {
        var ka = floorSortKey(a), kb = floorSortKey(b);
        return ka !== kb ? ka - kb : String(a).localeCompare(String(b));
    }

    /** Room Maintenance (api/rooms): each room's floor level, for the Floor filter below. */
    function loadRooms() {
        return api('api/rooms').then(function (data) {
            roomFloor = {};
            (data.success ? data.rooms : []).forEach(function (r) { roomFloor[r.name] = r.floorLevel; });
        }).catch(function () { roomFloor = {}; });
    }

    // ---------------------------------------------------------------
    // 1. Faculty list (counts for this week)
    // ---------------------------------------------------------------

    function loadTeachers() {
        var from = weekStart(iso(new Date()));
        return Promise.all([
            api('api/faculty-schedule/teachers'),
            api('api/teaching-hours/classes?from=' + from + '&to=' + addDays(from, 6)),
            api('api/teaching-hours/on-campus')
        ]).then(function (results) {
            if (!results[0].success) throw new Error(results[0].message || 'Could not load faculty.');
            teachers = results[0].teachers;
            weekStats = {};
            (results[1].success ? results[1].classes : []).forEach(function (r) {
                var s = weekStats[r.employeeId] || (weekStats[r.employeeId] = { classes: 0, needsChecks: 0 });
                s.classes++;
                if (r.approvalStatus === 'Not checked' || r.approvalStatus === 'Incomplete') s.needsChecks++;
            });
            onCampusByEmployee = results[2].success ? results[2].onCampus : {};
        });
    }

    function renderFacultyList() {
        var q = el('facultySearch').value.trim().toLowerCase();
        var type = el('facultyTypeFilter').value;
        var shown = teachers.filter(function (t) {
            var searchMatch = !q || (t.displayName + ' ' + t.employeeNumber).toLowerCase().indexOf(q) !== -1;
            var typeMatch = type === 'all' || t.type === type;
            return searchMatch && typeMatch;
        });
        if (!shown.length) {
            el('facultyBody').innerHTML = '';
            el('facultyEmpty').textContent = teachers.length
                ? 'No faculty match the search.'
                : 'No faculty yet. Add Faculty or Faculty/Admin staff in Employee Records.';
            el('facultyEmpty').classList.remove('d-none');
            return;
        }
        el('facultyEmpty').classList.add('d-none');
        el('facultyBody').innerHTML = shown.map(function (t) {
            var s = weekStats[t.id] || { classes: 0, needsChecks: 0 };
            var onCampus = onCampusByEmployee[t.id] || {};
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(t.id) + '" ' +
                    'aria-label="Open the classes of ' + escapeHtml(t.displayName) + '">' +
                '<td>' + escapeHtml(t.employeeNumber) + '</td>' +
                '<td><strong>' + escapeHtml(t.displayName) + '</strong></td>' +
                '<td>' + escapeHtml(PayrollProLayout.staffTypeLabel(t.type)) + '</td>' +
                '<td>' + onCampusBadge(onCampus.timeIn, onCampus.timeOut) + '</td>' +
                '<td class="text-end">' + s.classes + '</td>' +
                '<td class="text-end">' + (s.needsChecks ? '<span class="fm-status incomplete">' + s.needsChecks + '</span>' : '0') + '</td>' +
            '</tr>';
        }).join('');
    }

    // ---------------------------------------------------------------
    // 2. One faculty member: day list or week timetable
    // ---------------------------------------------------------------

    function range() {
        var a = anchorDate.value || iso(new Date());
        if (view === 'day') return { from: a, to: a };
        var from = weekStart(a);
        return { from: from, to: addDays(from, 6) };
    }

    function showFaculty(employeeId) {
        teacher = teachers.find(function (t) { return t.id === employeeId; });
        if (!teacher) {
            showList();
            PPToast.error('That faculty member was not found.');
            return;
        }
        listView.classList.add('d-none');
        facultyView.classList.remove('d-none');
        window.scrollTo(0, 0);
        el('facultyName').textContent = teacher.displayName;
        el('facultyMeta').innerHTML = escapeHtml(teacher.employeeNumber) + ' · ' + employeeStatusBadge(teacher.status);
        defaultTimeFloor = true;
        load();
    }

    function showList() {
        teacher = null;
        facultyView.classList.add('d-none');
        listView.classList.remove('d-none');
        renderFacultyList();
    }

    function load() {
        if (!teacher) return Promise.resolve();
        var r = range();
        el('rangeLabel').textContent = view === 'day'
            ? prettyDate(r.from)
            : 'Week of ' + prettyDate(r.from) + ' – ' + prettyDate(r.to);
        body.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading classes…</td></tr>';
        emptyState.classList.add('d-none');
        return api('api/teaching-hours/classes?from=' + r.from + '&to=' + r.to + '&employeeId=' + encodeURIComponent(teacher.id))
            .then(function (data) {
                if (!data.success) throw new Error(data.message || 'Could not load classes.');
                rows = data.classes;
                updateTimeFloorFilters();
                render();
            })
            .catch(function (error) {
                // The message lives in the day list, so show that even in week view.
                el('weekWrap').classList.add('d-none');
                el('weekLegend').classList.add('d-none');
                el('dayWrap').classList.remove('d-none');
                body.innerHTML = '';
                emptyState.textContent = error.message || 'Could not load classes. Is the backend running?';
                emptyState.classList.remove('d-none');
            });
    }

    /**
     * Rebuilds the Time and Floor filter options from the classes just
     * loaded. The first time a faculty member's page is opened, they
     * default to the earliest scheduled time and the lowest floor present
     * that day; after that, the user's own choice is kept across date
     * navigation as long as it's still offered, otherwise it falls back to
     * "All".
     */
    function updateTimeFloorFilters() {
        var times = [];
        rows.forEach(function (r) {
            if (times.indexOf(r.scheduledStart) === -1) times.push(r.scheduledStart);
        });
        times.sort();

        var floors = [];
        rows.forEach(function (r) {
            var f = roomFloor[r.room];
            if (f && floors.indexOf(f) === -1) floors.push(f);
        });
        floors.sort(compareFloors);

        var prevTime = timeFilter.value;
        var prevFloor = floorFilter.value;

        timeFilter.innerHTML = '<option value="all">All times</option>' + times.map(function (t) {
            return '<option value="' + escapeHtml(t) + '">' + time12(t) + '</option>';
        }).join('');
        floorFilter.innerHTML = '<option value="all">All floors</option>' + floors.map(function (f) {
            return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>';
        }).join('');

        if (defaultTimeFloor) {
            timeFilter.value = times.length ? times[0] : 'all';
            floorFilter.value = floors.length ? floors[0] : 'all';
            defaultTimeFloor = false;
        } else {
            timeFilter.value = times.indexOf(prevTime) !== -1 ? prevTime : 'all';
            floorFilter.value = floors.indexOf(prevFloor) !== -1 ? prevFloor : 'all';
        }
    }

    function filtered() {
        var status = statusFilter.value;
        var time = timeFilter.value;
        var floor = floorFilter.value;
        return rows.filter(function (r) {
            if (time !== 'all' && r.scheduledStart !== time) return false;
            if (floor !== 'all' && roomFloor[r.room] !== floor) return false;
            if (status === 'all') return true;
            if (status === 'flagged') return r.flags.length > 0;
            return r.approvalStatus === status;
        });
    }

    function render() {
        var week = view === 'week';
        el('weekWrap').classList.toggle('d-none', !week);
        el('weekLegend').classList.toggle('d-none', !week);
        el('dayWrap').classList.toggle('d-none', week);
        if (week) {
            renderWeek();
        } else {
            renderDay();
        }
    }

    function renderDay() {
        var shown = filtered();
        if (!shown.length) {
            body.innerHTML = '';
            emptyState.textContent = rows.length
                ? 'No classes match this status.'
                : 'No scheduled classes on this day. Classes are planned in Faculty Schedule.';
            emptyState.classList.remove('d-none');
            return;
        }
        emptyState.classList.add('d-none');

        body.innerHTML = shown.map(function (r) {
            var payable = r.approvalStatus === 'Complete'
                ? '<strong>' + hours(r.payableHours) + '</strong>'
                : '<span class="text-muted" title="Recorded so far">' + hours(r.payableHours) + '</span>';
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-id="' + r.classId + '" ' +
                    'aria-label="Classroom checks for ' + escapeHtml(r.subject) + '">' +
                '<td>' + time12(r.scheduledStart) + ' – ' + time12(r.scheduledEnd) + '</td>' +
                '<td><span class="fm-subject">' + escapeHtml(r.subject) + '</span>' +
                    '<span class="fm-sub">' + escapeHtml(r.classSection) + (r.room ? ' · ' + escapeHtml(r.room) : '') + '</span>' +
                    (r.flags.length ? '<span class="fm-flag" title="' + escapeHtml(r.flags.join('\n')) + '"><i class="bi bi-flag-fill"></i> ' + r.flags.length + '</span>' : '') +
                    '</td>' +
                '<td>' + onCampusBadge(r.biometricTimeIn, r.biometricTimeOut) + '</td>' +
                '<td>' + checkCell(r.startCheckAt, r.startCheckStatus) + '</td>' +
                '<td>' + checkCell(r.endCheckAt, r.endCheckStatus) + '</td>' +
                '<td class="text-end">' + payable + '</td>' +
            '</tr>';
        }).join('');
    }

    /** Week timetable (js/week-timetable.js), coloured by check / approval status. */
    function renderWeek() {
        PPWeekTimetable.render(el('weekGrid'), {
            weekStart: range().from,
            items: filtered().map(function (r) {
                var checks = (r.startCheckAt ? 'In ' + time12(r.startCheckAt) : 'In —') + ' · ' +
                    (r.endCheckAt ? 'Out ' + time12(r.endCheckAt) : 'Out —');
                return {
                    id: r.classId,
                    date: r.classDate,
                    start: r.scheduledStart,
                    end: r.scheduledEnd,
                    title: r.subject,
                    lines: [r.classSection + (r.room ? ' · ' + r.room : ''), time12(r.scheduledStart) + ' – ' + time12(r.scheduledEnd)],
                    note: (STATUS_LABEL[r.approvalStatus] || r.approvalStatus) + (r.flags.length ? ' · ⚑ ' + r.flags.length : ''),
                    variant: STATUS_CLASS[r.approvalStatus] || 'not-checked',
                    tooltip: r.subject + ' · ' + r.classSection + ' · ' + time12(r.scheduledStart) + '–' + time12(r.scheduledEnd) +
                        '\nClassroom checks: ' + checks +
                        '\nStatus: ' + (STATUS_LABEL[r.approvalStatus] || r.approvalStatus) +
                        (r.flags.length ? '\nFlags: ' + r.flags.join('; ') : '')
                };
            })
        });
    }


    // ---------------------------------------------------------------
    // Class modal: checks, review, audit
    // ---------------------------------------------------------------

    function detailItem(label, value) {
        return '<div><span class="fm-detail-label">' + label + '</span><span class="fm-detail-value">' + value + '</span></div>';
    }

    /**
     * Pick Present, Late (beginning only) or Absent — chosen directly, never
     * guessed from a time, so there's nothing to default to the wrong
     * answer — then Save. Changing an already-recorded status needs an
     * explanation in Remarks.
     */
    function checkForm(r, which) {
        var start = which === 'start';
        var time = start ? r.startCheckAt : r.endCheckAt;
        var status = start ? r.startCheckStatus : r.endCheckStatus;
        var by = start ? r.startCheckedBy : r.endCheckedBy;
        var future = r.classDate > iso(new Date());
        var waiting = !start && !r.startCheckAt;
        var disabled = future || waiting;
        var id = which + 'Check';
        var options = start ? ['Present', 'Late', 'Absent'] : ['Present', 'Absent'];

        var buttons = options.map(function (opt) {
            return '<button type="button" class="btn fm-status-btn fm-status-btn-' + opt.toLowerCase() +
                (status === opt ? ' active' : '') + '" data-status="' + opt + '"' + (disabled ? ' disabled' : '') + '>' +
                opt + '</button>';
        }).join('');

        return '<div class="col-md-6"><form class="fm-check-card" id="' + id + 'Form" data-check="' + which + '" novalidate>' +
            '<h3>' + (start ? 'Beginning of Class' : 'End of Class') + '</h3>' +
            '<div class="fm-status-buttons">' + buttons + '</div>' +
            (waiting ? '<p class="fm-note mt-2 mb-0">Record the beginning check first.</p>' : '') +
            (time ? '<div class="fm-check-recorded">Recorded by ' + escapeHtml(by || '—') + '</div>' : '') +
            '<button type="submit" class="btn btn-pp-primary mt-3"' + (disabled ? ' disabled' : '') + '><i class="bi bi-check-lg me-1"></i> Save</button>' +
        '</form></div>';
    }

    function openClass(classId) {
        var r = rows.find(function (x) { return x.classId === classId; });
        if (!r) return;
        openClassId = classId;

        el('checkTitle').textContent = r.subject + ' — ' + r.classSection;

        var payable = '<div class="fm-payable"><span>' + (r.approvalStatus === 'Complete' ? 'Payable teaching hours' : 'Payable so far') + '</span>' +
            '<strong>' + hours(r.payableHours) + '</strong>' +
            '<span class="fm-note">Paid only when the faculty member was present (or late) at the start and present at the end.</span></div>';

        el('checkBody').innerHTML =
            '<div class="fm-detail-grid">' +
                detailItem('Faculty', escapeHtml(r.employeeName)) +
                detailItem('Date', escapeHtml(shortDate(r.classDate))) +
                detailItem('Scheduled', time12(r.scheduledStart) + ' – ' + time12(r.scheduledEnd)) +
                detailItem('Scheduled hours', hours(r.scheduledHours)) +
                detailItem('Room', r.room ? escapeHtml(r.room) : '—') +
                detailItem('Status', statusBadge(r.approvalStatus)) +
                detailItem('On Campus', onCampusBadge(r.biometricTimeIn, r.biometricTimeOut)) +
            '</div>' +
            '<p class="fm-note mb-3">On Campus is that day\'s biometric scanner record (Daily Time Record) — it shows the faculty member was on campus, not that this specific class was taught. Record the classroom check itself below.</p>' +
            (r.flags.length
                ? '<ul class="fm-flags mb-3">' + r.flags.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') + '</ul>'
                : '') +
            (r.classDate > iso(new Date())
                ? '<p class="fm-note">This class is in the future. Checks can be recorded on the day of the class.</p>' : '') +
            '<div class="fm-section-title">Classroom Checks</div>' +
            '<div class="row g-3">' + checkForm(r, 'start') + checkForm(r, 'end') + '</div>' +
            '<form id="remarksForm" novalidate>' +
                '<label for="checkRemarks" class="pp-form-label mt-3">Remarks ' +
                    '<span class="text-muted fw-normal">(required only if you change a recorded status)</span></label>' +
                '<textarea class="form-control pp-form-control" id="checkRemarks" maxlength="255" rows="2" data-validate="text" data-label="Remarks"' +
                    (r.classDate > iso(new Date()) ? ' disabled' : '') + '>' + escapeHtml(r.remarks || '') + '</textarea>' +
            '</form>' +
            '<div class="fm-section-title">Payable Teaching Hours</div>' + payable +
            '<div class="fm-section-title">Audit History</div>' +
            '<ul class="fm-history" id="auditList"><li class="text-muted">Loading…</li></ul>';

        PPValidate.attach(el('remarksForm'));

        ['start', 'end'].forEach(function (which) {
            var form = el(which + 'CheckForm');
            if (!form) return;
            PPValidate.attach(form);
            form.querySelectorAll('.fm-status-btn').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    form.querySelectorAll('.fm-status-btn').forEach(function (b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                });
            });
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                submitCheck(r, form);
            });
        });

        if (!el('checkModal').classList.contains('show')) {
            checkModal.show();
        }
        loadAudit(classId);
    }

    function loadAudit(classId) {
        api('api/teaching-hours/classes/' + classId + '/audit').then(function (data) {
            var list = el('auditList');
            if (!list) return;
            if (!data.success || !data.audit.length) {
                list.innerHTML = '<li class="text-muted">Nothing recorded yet.</li>';
                return;
            }
            list.innerHTML = data.audit.map(function (a) {
                return '<li><strong>' + escapeHtml(a.action) + '</strong> — ' + escapeHtml(a.details || '') +
                    (a.reason ? '<div>Reason: ' + escapeHtml(a.reason) + '</div>' : '') +
                    '<div class="fm-history-meta">' + escapeHtml(a.performedBy) + ' · ' +
                    escapeHtml((a.performedAt || '').replace('T', ' ').slice(0, 16)) + '</div></li>';
            }).join('');
        });
    }

    function submitCheck(r, form) {
        var active = form.querySelector('.fm-status-btn.active');
        if (!active) {
            PPToast.error('Choose Present, Late or Absent first.');
            return;
        }
        var which = form.dataset.check;
        if (!PPValidate.validateForm(form) || !PPValidate.validateForm(el('remarksForm'))) return;

        var payload = {
            check: which,
            status: active.dataset.status,
            remarks: el('checkRemarks').value.trim()
        };
        var controls = form.querySelectorAll('.fm-status-btn, button[type="submit"]');
        controls.forEach(function (b) { b.disabled = true; });
        postJson('api/teaching-hours/classes/' + r.classId + '/checks', payload).then(function (data) {
            controls.forEach(function (b) { b.disabled = false; });
            if (!data.success) {
                var map = { remarks: 'checkRemarks' };
                if (!PPValidate.showServerError(el('checkBody'), data, map)) PPToast.error(data.message || 'Could not save the check.');
                return;
            }
            PPToast.success((which === 'start' ? 'Beginning' : 'Ending') + ' check saved.');
            replaceRow(data.class);
        }).catch(function () {
            controls.forEach(function (b) { b.disabled = false; });
            PPToast.error('Could not reach the server.');
        });
    }

    /** Puts a saved record back into the list and refreshes the open modal. */
    function replaceRow(updated) {
        var i = rows.findIndex(function (x) { return x.classId === updated.classId; });
        if (i >= 0) rows[i] = updated;
        render();
        openClass(updated.classId);
    }

    // ---------------------------------------------------------------
    // Navigation: ?employee=F2 opens that faculty member's page
    // ---------------------------------------------------------------

    function openFaculty(employeeId) {
        history.pushState({ employee: employeeId }, '', 'teaching-hours.html?employee=' + encodeURIComponent(employeeId));
        showFaculty(employeeId);
    }

    function route() {
        var employeeId = new URLSearchParams(window.location.search).get('employee');
        if (employeeId) {
            showFaculty(employeeId);
        } else {
            showList();
        }
    }

    window.addEventListener('popstate', route);

    el('backToList').addEventListener('click', function () {
        if (history.state && history.state.employee) {
            history.back();   // back to the list we came from
        } else {
            history.pushState({}, '', 'teaching-hours.html');
            loadTeachers().then(showList, showList);
        }
    });

    // ---------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------

    el('facultySearch').addEventListener('input', renderFacultyList);
    el('facultyTypeFilter').addEventListener('change', renderFacultyList);

    el('facultyBody').addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-employee]');
        if (row) openFaculty(row.dataset.employee);
    });
    el('facultyBody').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-employee]')) {
            e.preventDefault();
            openFaculty(e.target.dataset.employee);
        }
    });

    document.querySelectorAll('.fm-view-toggle [data-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            view = btn.dataset.view;
            document.querySelectorAll('.fm-view-toggle [data-view]').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            load();
        });
    });

    el('prevRange').addEventListener('click', function () {
        anchorDate.value = addDays(anchorDate.value, view === 'day' ? -1 : -7);
        load();
    });
    el('nextRange').addEventListener('click', function () {
        anchorDate.value = addDays(anchorDate.value, view === 'day' ? 1 : 7);
        load();
    });
    el('todayBtn').addEventListener('click', function () {
        anchorDate.value = iso(new Date());
        load();
    });
    anchorDate.addEventListener('change', function () {
        if (anchorDate.value) load();
    });
    statusFilter.addEventListener('change', render);
    timeFilter.addEventListener('change', render);
    floorFilter.addEventListener('change', render);

    // Day list rows and week timetable blocks both open the checks window.
    [body, el('weekGrid')].forEach(function (container) {
        container.addEventListener('click', function (e) {
            var item = e.target.closest('[data-id]');
            if (item) openClass(Number(item.dataset.id));
        });
        container.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) {
                e.preventDefault();
                openClass(Number(e.target.dataset.id));
            }
        });
    });
    el('checkModal').addEventListener('hidden.bs.modal', function () {
        openClassId = null;
        // Refresh the list counts for when the user goes back.
        loadTeachers().catch(function () {});
    });

    var params = new URLSearchParams(window.location.search);
    anchorDate.value = params.get('date') || iso(new Date());
    if (params.get('status')) {
        statusFilter.value = params.get('status');
    }

    el('facultyBody').innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Loading faculty…</td></tr>';
    Promise.all([PayrollProLayout.loadStaffTypeLabels(), PayrollProLayout.loadEmployeeTypeOptions(), loadRooms()]).then(function (results) {
        PayrollProLayout.populateEmployeeTypeSelect(el('facultyTypeFilter'), results[1]);
        return loadTeachers();
    })
        .catch(function (error) {
            PPToast.error(error.message || 'Could not load faculty.');
        })
        .then(route);
})();
