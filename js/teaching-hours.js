/**
 * Faculty Teaching Hours — manual classroom checks (api/teaching-hours).
 *
 * For each scheduled class (from Faculty Schedule) the Payroll Staff or
 * Payroll Master records a beginning and an ending classroom check. Records
 * with both checks wait for approval by the Payroll Master; only approved
 * classes are paid. Corrections need a reason and are kept in the audit
 * history. The server enforces all of this; the page only hides what the
 * user can't do.
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

    var canApprove = (function () {
        try {
            return JSON.parse(localStorage.getItem('ppUser') || '{}').role === 'Payroll Master';
        } catch (e) {
            return false;
        }
    })();

    var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var STATUS_CLASS = {
        'Not checked': 'not-checked',
        Incomplete: 'incomplete',
        Pending: 'pending',
        Approved: 'approved',
        Rejected: 'rejected'
    };
    var STATUS_LABEL = {
        'Not checked': 'Not checked',
        Incomplete: 'Incomplete',
        Pending: 'Waiting for approval',
        Approved: 'Approved',
        Rejected: 'Rejected'
    };

    var LONG_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    var teachers = [];
    var weekStats = {};       // employeeId -> { classes, needsChecks, pending } this week
    var teacher = null;       // the faculty member being viewed
    var view = 'day';
    var rows = [];
    var openClassId = null;

    var el = function (id) { return document.getElementById(id); };
    var listView = el('listView');
    var facultyView = el('facultyView');
    var anchorDate = el('anchorDate');
    var statusFilter = el('statusFilter');
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

    function nowHHMM() {
        var d = new Date();
        return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function shiftTime(hhmm, minutes) {
        var p = hhmm.split(':').map(Number);
        var total = Math.max(0, Math.min(23 * 60 + 59, p[0] * 60 + p[1] + minutes));
        return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
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
            '<span class="fm-check-status ' + (status === 'Present' ? 'present' : 'absent') + '">' + escapeHtml(status) + '</span></span>';
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

    // ---------------------------------------------------------------
    // 1. Faculty list (counts for this week)
    // ---------------------------------------------------------------

    function loadTeachers() {
        var from = weekStart(iso(new Date()));
        return Promise.all([
            api('api/faculty-schedule/teachers'),
            api('api/teaching-hours/classes?from=' + from + '&to=' + addDays(from, 6))
        ]).then(function (results) {
            if (!results[0].success) throw new Error(results[0].message || 'Could not load faculty.');
            teachers = results[0].teachers;
            weekStats = {};
            (results[1].success ? results[1].classes : []).forEach(function (r) {
                var s = weekStats[r.employeeId] || (weekStats[r.employeeId] = { classes: 0, needsChecks: 0, pending: 0 });
                s.classes++;
                if (r.approvalStatus === 'Not checked' || r.approvalStatus === 'Incomplete') s.needsChecks++;
                if (r.approvalStatus === 'Pending') s.pending++;
            });
        });
    }

    function renderFacultyList() {
        var q = el('facultySearch').value.trim().toLowerCase();
        var shown = teachers.filter(function (t) {
            return !q || (t.displayName + ' ' + t.employeeNumber).toLowerCase().indexOf(q) !== -1;
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
            var s = weekStats[t.id] || { classes: 0, needsChecks: 0, pending: 0 };
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(t.id) + '" ' +
                    'aria-label="Open the classes of ' + escapeHtml(t.displayName) + '">' +
                '<td><strong>' + escapeHtml(t.displayName) + '</strong></td>' +
                '<td>' + escapeHtml(t.employeeNumber) + '</td>' +
                '<td>' + employeeStatusBadge(t.status) + '</td>' +
                '<td class="text-end">' + s.classes + '</td>' +
                '<td class="text-end">' + (s.needsChecks ? '<span class="fm-status incomplete">' + s.needsChecks + '</span>' : '0') + '</td>' +
                '<td class="text-end">' + (s.pending ? '<span class="fm-status pending">' + s.pending + '</span>' : '0') + '</td>' +
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

    function filtered() {
        var status = statusFilter.value;
        return rows.filter(function (r) {
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
            var payable = r.approvalStatus === 'Approved'
                ? '<strong>' + hours(r.payableHours) + '</strong>'
                : r.payableIfApproved != null
                    ? '<span class="text-muted" title="If approved">' + hours(r.payableIfApproved) + '</span>'
                    : '<span class="text-muted">—</span>';
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-id="' + r.classId + '" ' +
                    'aria-label="Classroom checks for ' + escapeHtml(r.subject) + '">' +
                '<td>' + time12(r.scheduledStart) + ' – ' + time12(r.scheduledEnd) + '</td>' +
                '<td><span class="fm-subject">' + escapeHtml(r.subject) + '</span>' +
                    '<span class="fm-sub">' + escapeHtml(r.classSection) + (r.room ? ' · ' + escapeHtml(r.room) : '') + '</span></td>' +
                '<td>' + checkCell(r.startCheckAt, r.startCheckStatus) + '</td>' +
                '<td>' + checkCell(r.endCheckAt, r.endCheckStatus) + '</td>' +
                '<td>' + statusBadge(r.approvalStatus) +
                    (r.flags.length ? '<span class="fm-flag" title="' + escapeHtml(r.flags.join('\n')) + '"><i class="bi bi-flag-fill"></i> ' + r.flags.length + '</span>' : '') +
                '</td>' +
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

    function checkForm(r, which) {
        var start = which === 'start';
        var time = start ? r.startCheckAt : r.endCheckAt;
        var status = start ? r.startCheckStatus : r.endCheckStatus;
        var by = start ? r.startCheckedBy : r.endCheckedBy;
        var anchor = start ? r.scheduledStart : r.scheduledEnd;
        var locked = r.approvalStatus === 'Approved';
        var future = r.classDate > iso(new Date());
        var disabled = locked || future ? ' disabled' : '';
        var defaultTime = time || (r.classDate === iso(new Date()) ? nowHHMM() : '');
        var id = which + 'Check';

        return '<div class="col-md-6"><form class="fm-check-card" id="' + id + 'Form" data-check="' + which + '" novalidate>' +
            '<h3>' + (start ? 'Beginning of Class' : 'End of Class') + '</h3>' +
            '<div class="fm-window">Grace window: ' + time12(shiftTime(anchor, -r.gracePeriodMinutes)) + ' – ' +
                time12(shiftTime(anchor, r.gracePeriodMinutes)) + '</div>' +
            '<div class="row g-2">' +
                '<div class="col-6">' +
                    '<label for="' + id + 'Time" class="pp-form-label">Verified at</label>' +
                    '<input type="time" class="form-control pp-form-control" id="' + id + 'Time" value="' + escapeHtml(defaultTime) + '" ' +
                        'data-validate="time" data-label="Verification time" required' + disabled + '>' +
                '</div>' +
                '<div class="col-6">' +
                    '<label for="' + id + 'Status" class="pp-form-label">Faculty was</label>' +
                    '<select class="form-select pp-form-select" id="' + id + 'Status" data-label="Attendance" required' + disabled + '>' +
                        // Placeholder only: shown until a choice is made, not listed as an option.
                        '<option value="" hidden data-hint' + (status ? '' : ' selected') + '>Select…</option>' +
                        '<option value="Present"' + (status === 'Present' ? ' selected' : '') + '>Present</option>' +
                        '<option value="Absent"' + (status === 'Absent' ? ' selected' : '') + '>Absent</option>' +
                    '</select>' +
                '</div>' +
                (time
                    ? '<div class="col-12"><label for="' + id + 'Reason" class="pp-form-label">Reason for correction <span class="text-muted fw-normal">(required only if you change this check)</span></label>' +
                      '<input type="text" class="form-control pp-form-control" id="' + id + 'Reason" maxlength="255" data-validate="text" data-label="Reason for the correction"' + disabled + '></div>'
                    : '') +
            '</div>' +
            (time ? '<div class="fm-check-recorded">Recorded by ' + escapeHtml(by || '—') + '</div>' : '') +
            (locked || future ? '' :
                '<button type="submit" class="btn btn-pp-primary btn-sm mt-3">' +
                    (time ? 'Save Correction' : 'Record ' + (start ? 'Beginning' : 'Ending') + ' Check') + '</button>') +
        '</form></div>';
    }

    function reviewPanel(r) {
        if (!canApprove || r.approvalStatus === 'Approved' || r.approvalStatus === 'Rejected' || r.approvalStatus === 'Not checked') {
            return '';
        }
        var needsNote = r.flags.length > 0;
        return '<div class="fm-section-title">Review &amp; Approval</div>' +
            '<form id="reviewForm" class="fm-check-card" novalidate>' +
                '<label for="reviewNote" class="pp-form-label">Review note ' +
                    (needsNote ? '<span class="text-danger">(required — this record is flagged)</span>' : '<span class="text-muted fw-normal">(required to reject)</span>') + '</label>' +
                '<input type="text" class="form-control pp-form-control" id="reviewNote" maxlength="255" data-validate="text" data-label="Review note">' +
                '<div class="d-flex gap-2 mt-3">' +
                    (r.approvalStatus === 'Pending'
                        ? '<button type="button" class="btn btn-pp-primary" id="approveBtn"><i class="bi bi-check2-circle me-1"></i> Approve ' + hours(r.payableIfApproved) + ' hrs</button>'
                        : '<span class="fm-note align-self-center">Both checks are needed before this class can be approved.</span>') +
                    '<button type="button" class="btn btn-outline-danger ms-auto" id="rejectBtn">Reject</button>' +
                '</div>' +
            '</form>';
    }

    function openClass(classId) {
        var r = rows.find(function (x) { return x.classId === classId; });
        if (!r) return;
        openClassId = classId;

        el('checkTitle').textContent = r.subject + ' — ' + r.classSection;

        var payable;
        if (r.approvalStatus === 'Approved') {
            payable = '<div class="fm-payable"><span>Approved payable teaching hours</span><strong>' + hours(r.payableHours) + '</strong>' +
                '<span class="fm-note">Approved by ' + escapeHtml(r.approvedBy || '—') + ' · ' + escapeHtml((r.approvedAt || '').replace('T', ' ').slice(0, 16)) + '</span></div>';
        } else if (r.approvalStatus === 'Rejected') {
            payable = '<div class="fm-payable"><span>Rejected — no teaching hours will be paid</span><strong>0.00</strong></div>';
        } else if (r.payableIfApproved != null) {
            payable = '<div class="fm-payable"><span>Payable if approved</span><strong>' + hours(r.payableIfApproved) + '</strong>' +
                '<span class="fm-note">Paid only when both checks found the faculty member present.</span></div>';
        } else {
            payable = '<div class="fm-payable"><span>Payable hours</span><strong>—</strong><span class="fm-note">Recorded after both checks and approval.</span></div>';
        }

        el('checkBody').innerHTML =
            '<div class="fm-detail-grid">' +
                detailItem('Faculty', escapeHtml(r.employeeName)) +
                detailItem('Date', escapeHtml(shortDate(r.classDate))) +
                detailItem('Scheduled', time12(r.scheduledStart) + ' – ' + time12(r.scheduledEnd)) +
                detailItem('Scheduled hours', hours(r.scheduledHours)) +
                detailItem('Room', r.room ? escapeHtml(r.room) : '—') +
                detailItem('Status', statusBadge(r.approvalStatus)) +
            '</div>' +
            (r.flags.length
                ? '<ul class="fm-flags mb-3">' + r.flags.map(function (f) { return '<li>' + escapeHtml(f) + '</li>'; }).join('') + '</ul>'
                : '') +
            (r.approvalStatus === 'Approved'
                ? '<p class="fm-note"><i class="bi bi-lock-fill"></i> Approved records are locked; they may already be in payroll.</p>' : '') +
            (r.classDate > iso(new Date())
                ? '<p class="fm-note">This class is in the future. Checks can be recorded on the day of the class.</p>' : '') +
            (r.reviewNote ? '<p class="mb-2"><strong>Review note:</strong> ' + escapeHtml(r.reviewNote) + '</p>' : '') +
            '<div class="fm-section-title">Classroom Checks</div>' +
            '<div class="row g-3">' + checkForm(r, 'start') + checkForm(r, 'end') + '</div>' +
            '<div class="mt-3">' +
                '<label for="checkRemarks" class="pp-form-label">Remarks <span class="text-muted fw-normal">(optional, saved with the next check)</span></label>' +
                '<input type="text" class="form-control pp-form-control" id="checkRemarks" maxlength="255" value="' + escapeHtml(r.remarks || '') + '"' +
                    (r.approvalStatus === 'Approved' ? ' disabled' : '') + '>' +
            '</div>' +
            '<div class="fm-section-title">Payable Teaching Hours</div>' + payable +
            reviewPanel(r) +
            '<div class="fm-section-title">Audit History</div>' +
            '<ul class="fm-history" id="auditList"><li class="text-muted">Loading…</li></ul>';

        ['startCheckForm', 'endCheckForm'].forEach(function (formId) {
            var form = el(formId);
            if (!form) return;
            PPValidate.attach(form);
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                submitCheck(r, form);
            });
        });
        if (el('reviewForm')) {
            PPValidate.attach(el('reviewForm'));
            if (el('approveBtn')) el('approveBtn').addEventListener('click', function () { review(r, 'approve'); });
            el('rejectBtn').addEventListener('click', function () { review(r, 'reject'); });
        }

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
        var which = form.dataset.check;
        var prefix = which + 'Check';
        if (!PPValidate.validateForm(form)) return;

        var payload = {
            check: which,
            time: el(prefix + 'Time').value,
            status: el(prefix + 'Status').value,
            remarks: el('checkRemarks').value.trim(),
            reason: el(prefix + 'Reason') ? el(prefix + 'Reason').value.trim() : null
        };
        var btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        postJson('api/teaching-hours/classes/' + r.classId + '/checks', payload).then(function (data) {
            btn.disabled = false;
            if (!data.success) {
                var map = { time: prefix + 'Time', status: prefix + 'Status', reason: prefix + 'Reason', remarks: 'checkRemarks' };
                if (!PPValidate.showServerError(el('checkBody'), data, map)) PPToast.error(data.message || 'Could not save the check.');
                return;
            }
            PPToast.success((which === 'start' ? 'Beginning' : 'Ending') + ' check saved.');
            replaceRow(data.class);
        }).catch(function () {
            btn.disabled = false;
            PPToast.error('Could not reach the server.');
        });
    }

    function review(r, action) {
        var note = el('reviewNote');
        var text = note.value.trim();
        if (action === 'reject' && !text) {
            PPValidate.setError(note, 'Give a reason for rejecting.');
            note.focus();
            return;
        }
        if (action === 'approve' && r.flags.length && !text) {
            PPValidate.setError(note, 'This record is flagged. Add a review note explaining the approval.');
            note.focus();
            return;
        }
        postJson('api/teaching-hours/classes/' + r.classId + '/' + action, { note: text }).then(function (data) {
            if (!data.success) {
                if (!PPValidate.showServerError(el('checkBody'), data, { note: 'reviewNote' })) PPToast.error(data.message);
                return;
            }
            PPToast.success(action === 'approve' ? 'Teaching hours approved.' : 'Record rejected.');
            replaceRow(data.class);
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

    if (canApprove) {
        el('approveHint').classList.remove('d-none');
    }

    var params = new URLSearchParams(window.location.search);
    anchorDate.value = params.get('date') || iso(new Date());
    if (params.get('status')) {
        statusFilter.value = params.get('status');
    }

    el('facultyBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading faculty…</td></tr>';
    loadTeachers()
        .catch(function (error) {
            PPToast.error(error.message || 'Could not load faculty.');
        })
        .then(route);
})();
