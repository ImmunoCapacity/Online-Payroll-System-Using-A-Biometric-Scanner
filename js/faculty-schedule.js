/**
 * Faculty Schedule — planned classes (api/faculty-schedule).
 *
 * Two views on one page:
 *   1. the list of faculty (Faculty and Faculty/Admin staff);
 *   2. one faculty member (faculty-schedule.html?employee=F2): the Add Class
 *      form and their day/week schedule.
 *
 * Everyone with DTR access can view; adding, editing, cancelling and
 * restoring classes is for the Payroll Master (the server enforces this;
 * the form and buttons are only hidden here). The grace period for
 * classroom checks is fixed at 15 minutes. Whether a class was actually
 * taught is recorded in Faculty Teaching Hours, not here.
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

    var canManage = (function () {
        try {
            return JSON.parse(localStorage.getItem('ppUser') || '{}').role === 'Payroll Master';
        } catch (e) {
            return false;
        }
    })();

    var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var INACTIVE = ['Inactive', 'Resigned', 'Terminated'];

    var teachers = [];
    var weekCounts = {};      // employeeId -> classes this week
    var teacher = null;       // the faculty member being viewed
    var view = 'week';
    var classes = [];
    var current = null;       // class open in the detail modal
    var editingId = null;     // class loaded into the form for editing

    var el = function (id) { return document.getElementById(id); };
    var listView = el('listView');
    var facultyView = el('facultyView');
    var anchorDate = el('anchorDate');
    var classBody = el('classBody');
    var emptyState = el('emptyState');
    var classForm = el('classForm');
    var cancelForm = el('cancelForm');
    var detailModal = new bootstrap.Modal(el('detailModal'));
    var cancelModal = new bootstrap.Modal(el('cancelModal'));

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function api(url, options) {
        return fetch(url, options).then(function (r) { return r.json(); });
    }

    function postJson(url, body, method) {
        return api(url, {
            method: method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
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
        return DAY_NAMES[d.getDay()] + ', ' + d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function time12(hhmm) {
        if (!hhmm) return '—';
        var p = hhmm.split(':').map(Number);
        return (p[0] % 12 || 12) + ':' + String(p[1]).padStart(2, '0') + ' ' + (p[0] >= 12 ? 'PM' : 'AM');
    }

    function employeeStatusBadge(status) {
        var cls = status === 'Active' ? 'pp-badge-present' : status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent';
        return '<span class="pp-badge ' + cls + '">' + escapeHtml(status || '—') + '</span>';
    }

    function thisWeek() {
        var from = weekStart(iso(new Date()));
        return { from: from, to: addDays(from, 6) };
    }

    // ---------------------------------------------------------------
    // 1. Faculty list
    // ---------------------------------------------------------------

    function loadTeachers() {
        var week = thisWeek();
        return Promise.all([
            api('api/faculty-schedule/teachers'),
            api('api/faculty-schedule/classes?from=' + week.from + '&to=' + week.to)
        ]).then(function (results) {
            if (!results[0].success) throw new Error(results[0].message || 'Could not load faculty.');
            teachers = results[0].teachers;
            weekCounts = {};
            (results[1].success ? results[1].classes : []).forEach(function (c) {
                if (c.scheduleStatus !== 'Cancelled') {
                    weekCounts[c.employeeId] = (weekCounts[c.employeeId] || 0) + 1;
                }
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
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(t.id) + '" ' +
                    'aria-label="Open the schedule of ' + escapeHtml(t.displayName) + '">' +
                '<td><strong>' + escapeHtml(t.displayName) + '</strong></td>' +
                '<td>' + escapeHtml(t.employeeNumber) + '</td>' +
                '<td>' + employeeStatusBadge(t.status) + '</td>' +
                '<td class="text-end">' + (weekCounts[t.id] || 0) + '</td>' +
            '</tr>';
        }).join('');
    }

    // ---------------------------------------------------------------
    // 2. One faculty member
    // ---------------------------------------------------------------

    function range() {
        var a = anchorDate.value || iso(new Date());
        if (view === 'day') return { from: a, to: a };
        var from = weekStart(a);
        return { from: from, to: addDays(from, 6) };
    }

    function attendanceBadge(status) {
        if (!status) return '';
        var cls = { Incomplete: 'incomplete', Pending: 'pending', Approved: 'approved', Rejected: 'rejected' }[status] || 'not-checked';
        return ' <span class="fm-status ' + cls + '" title="Faculty Teaching Hours">' + escapeHtml(status === 'Pending' ? 'Checked · pending' : status) + '</span>';
    }

    function statusCell(c) {
        if (c.scheduleStatus === 'Cancelled') {
            return '<span class="fm-status cancelled" title="' + escapeHtml(c.statusReason || '') + '">Cancelled</span>';
        }
        return '<span class="fm-status scheduled">Scheduled</span>' +
            (c.overlapsWith.length ? '<span class="fm-flag" title="Overlaps another class of this faculty member"><i class="bi bi-exclamation-triangle-fill"></i> Overlap</span>' : '') +
            attendanceBadge(c.attendanceStatus);
    }

    function formShown() {
        return !el('classFormCol').classList.contains('d-none');
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

        // The Payroll Master gets the Add Class form beside the schedule.
        var showForm = canManage && INACTIVE.indexOf(teacher.status) === -1;
        el('classFormCol').classList.toggle('d-none', !showForm);
        el('scheduleCol').className = showForm ? 'col-xl-8' : 'col-12';
        resetForm();
        loadClasses();
    }

    function showList() {
        teacher = null;
        facultyView.classList.add('d-none');
        listView.classList.remove('d-none');
        renderFacultyList();
    }

    function loadClasses() {
        if (!teacher) return Promise.resolve();
        var r = range();
        el('rangeLabel').textContent = view === 'day'
            ? prettyDate(r.from)
            : 'Week of ' + prettyDate(r.from) + ' – ' + prettyDate(r.to);
        classBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading classes…</td></tr>';
        emptyState.classList.add('d-none');

        return api('api/faculty-schedule/classes?from=' + r.from + '&to=' + r.to + '&employeeId=' + encodeURIComponent(teacher.id))
            .then(function (data) {
                if (!data.success) throw new Error(data.message || 'Could not load classes.');
                classes = data.classes;
                renderClasses();
            })
            .catch(function (error) {
                // The message lives in the day list, so show that even in week view.
                el('weekWrap').classList.add('d-none');
                el('dayWrap').classList.remove('d-none');
                classBody.innerHTML = '';
                emptyState.textContent = error.message || 'Could not load classes. Is the backend running?';
                emptyState.classList.remove('d-none');
            });
    }

    function renderClasses() {
        var week = view === 'week';
        el('weekWrap').classList.toggle('d-none', !week);
        el('dayWrap').classList.toggle('d-none', week);
        if (week) {
            renderWeek();
            return;
        }

        // Cancelled classes stay listed (struck through) so they can be restored.
        var shown = classes;
        if (!shown.length) {
            classBody.innerHTML = '';
            emptyState.textContent = 'No classes in this period.' + (formShown() ? ' Use the Add Class form to plan one.' : '');
            emptyState.classList.remove('d-none');
            return;
        }
        emptyState.classList.add('d-none');

        var html = '';
        var lastDate = null;
        shown.forEach(function (c) {
            if (c.classDate !== lastDate) {
                lastDate = c.classDate;
                html += '<tr class="fm-day-row"><td colspan="4">' + escapeHtml(prettyDate(c.classDate)) + '</td></tr>';
            }
            html +=
                '<tr class="pp-row-clickable' + (c.scheduleStatus === 'Cancelled' ? ' fm-cancelled' : '') + '" tabindex="0" role="button" ' +
                    'data-id="' + c.id + '" aria-label="View class ' + escapeHtml(c.subject) + '">' +
                    '<td>' + time12(c.scheduledStart) + ' – ' + time12(c.scheduledEnd) + '</td>' +
                    '<td><span class="fm-subject">' + escapeHtml(c.subject) + '</span><span class="fm-sub">' + escapeHtml(c.classSection) + '</span></td>' +
                    '<td>' + (c.room ? escapeHtml(c.room) : '<span class="text-muted">—</span>') + '</td>' +
                    '<td>' + statusCell(c) + '</td>' +
                '</tr>';
        });
        classBody.innerHTML = html;
    }

    // ---------------------------------------------------------------
    // Week view: timetable (js/week-timetable.js)
    // ---------------------------------------------------------------

    function renderWeek() {
        PPWeekTimetable.render(el('weekGrid'), {
            weekStart: range().from,
            items: classes.map(function (c) {
                var cancelled = c.scheduleStatus === 'Cancelled';
                var overlap = c.overlapsWith.length > 0;
                return {
                    id: c.id,
                    date: c.classDate,
                    start: c.scheduledStart,
                    end: c.scheduledEnd,
                    title: c.subject,
                    lines: [c.classSection + (c.room ? ' · ' + c.room : ''), time12(c.scheduledStart) + ' – ' + time12(c.scheduledEnd)],
                    note: cancelled ? 'Cancelled' : overlap ? 'Overlap' : '',
                    variant: cancelled ? 'cancelled' : overlap ? 'overlap' : c.attendanceStatus === 'Approved' ? 'approved' : '',
                    tooltip: c.subject + ' · ' + c.classSection + (c.room ? ' · ' + c.room : '') + ' · ' +
                        time12(c.scheduledStart) + '–' + time12(c.scheduledEnd) +
                        (cancelled ? ' · Cancelled' : '') + (overlap ? ' · Overlap' : '')
                };
            })
        });
    }

    // ---------------------------------------------------------------
    // Class details, history, cancel and restore
    // ---------------------------------------------------------------

    function detailItem(label, value) {
        return '<div><span class="fm-detail-label">' + label + '</span><span class="fm-detail-value">' + value + '</span></div>';
    }

    function openDetail(id) {
        var c = classes.find(function (x) { return x.id === id; });
        if (!c) return;
        current = c;

        var overlapNames = c.overlapsWith.map(function (oid) {
            var o = classes.find(function (x) { return x.id === oid; });
            return o ? escapeHtml(o.subject + ' (' + o.classSection + ') ' + time12(o.scheduledStart) + '–' + time12(o.scheduledEnd)) : 'class #' + oid;
        });

        el('detailTitle').textContent = c.subject + ' — ' + c.classSection;
        el('detailBody').innerHTML =
            '<div class="fm-detail-grid">' +
                detailItem('Faculty', escapeHtml(c.employeeName)) +
                detailItem('Date', escapeHtml(prettyDate(c.classDate))) +
                detailItem('Scheduled', time12(c.scheduledStart) + ' – ' + time12(c.scheduledEnd)) +
                detailItem('Room', c.room ? escapeHtml(c.room) : '—') +
                detailItem('Status', statusCell(c)) +
            '</div>' +
            (c.scheduleStatus === 'Cancelled' && c.statusReason
                ? '<p class="mb-2"><strong>Cancelled:</strong> ' + escapeHtml(c.statusReason) + '</p>' : '') +
            (overlapNames.length
                ? '<ul class="fm-flags mb-2"><li>Overlaps: ' + overlapNames.join('; ') + '. Review whether both classes are correct.</li></ul>' : '') +
            (c.attendanceStatus
                ? '<p class="fm-note">Classroom checks have been recorded in Faculty Teaching Hours, so this class can no longer be edited or cancelled.</p>' : '') +
            '<div class="fm-section-title">Change history</div>' +
            '<ul class="fm-history" id="historyList"><li class="text-muted">Loading…</li></ul>';

        var footer = '<a class="btn btn-pp-outline me-auto" href="teaching-hours.html?employee=' + encodeURIComponent(c.employeeId) + '&date=' + c.classDate + '">' +
            '<i class="bi bi-person-workspace me-1"></i> Teaching Hours</a>';
        if (canManage) {
            if (c.scheduleStatus === 'Cancelled') {
                footer += '<button type="button" class="btn btn-pp-primary" id="restoreBtn"><i class="bi bi-arrow-counterclockwise me-1"></i> Restore</button>';
            } else if (!c.attendanceStatus && formShown()) {
                footer += '<button type="button" class="btn btn-outline-danger" id="cancelBtn">Cancel Class</button>' +
                    '<button type="button" class="btn btn-pp-primary" id="editBtn"><i class="bi bi-pencil me-1"></i> Edit</button>';
            }
        }
        el('detailFooter').innerHTML = footer;

        if (el('editBtn')) el('editBtn').addEventListener('click', function () { detailModal.hide(); startEdit(c); });
        if (el('cancelBtn')) el('cancelBtn').addEventListener('click', function () { detailModal.hide(); openCancel(c); });
        if (el('restoreBtn')) el('restoreBtn').addEventListener('click', function () { restore(c); });

        detailModal.show();

        api('api/faculty-schedule/classes/' + c.id + '/history').then(function (data) {
            var list = el('historyList');
            if (!list) return;
            if (!data.success || !data.history.length) {
                list.innerHTML = '<li class="text-muted">No history.</li>';
                return;
            }
            list.innerHTML = data.history.map(function (h) {
                return '<li><strong>' + escapeHtml(h.action) + '</strong> — ' + escapeHtml(h.details || '') +
                    '<div class="fm-history-meta">' + escapeHtml(h.changedBy) + ' · ' +
                    escapeHtml(h.changedAt ? h.changedAt.replace('T', ' ').slice(0, 16) : '') + '</div></li>';
            }).join('');
        });
    }

    function openCancel(c) {
        PPValidate.clear(cancelForm);
        cancelForm.reset();
        el('cancelSummary').textContent = c.subject + ' (' + c.classSection + ') on ' +
            prettyDate(c.classDate) + ', ' + time12(c.scheduledStart) + '–' + time12(c.scheduledEnd) + '.';
        cancelModal.show();
    }

    cancelForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!PPValidate.validateForm(cancelForm) || !current) return;
        el('confirmCancelBtn').disabled = true;
        postJson('api/faculty-schedule/classes/' + current.id + '/cancel', { reason: el('cancelReason').value.trim() })
            .then(function (data) {
                el('confirmCancelBtn').disabled = false;
                if (!data.success) {
                    if (!PPValidate.showServerError(cancelForm, data, { reason: 'cancelReason' })) PPToast.error(data.message);
                    return;
                }
                cancelModal.hide();
                PPToast.success('Class cancelled.');
                loadClasses();
            })
            .catch(function () {
                el('confirmCancelBtn').disabled = false;
                PPToast.error('Could not reach the server.');
            });
    });

    function restore(c) {
        postJson('api/faculty-schedule/classes/' + c.id + '/restore').then(function (data) {
            if (!data.success) { PPToast.error(data.message); return; }
            detailModal.hide();
            PPToast.success('Class restored.');
            loadClasses();
        });
    }

    // ---------------------------------------------------------------
    // Add / edit form (on the page)
    // ---------------------------------------------------------------

    var SERVER_FIELDS = {
        subject: 'classSubject',
        classSection: 'classSection',
        room: 'classRoom',
        classDate: 'classDate',
        scheduledStart: 'classStart',
        scheduledEnd: 'classEnd',
        repeatWeeklyUntil: 'classRepeatUntil'
    };

    function resetForm() {
        editingId = null;
        classForm.reset();
        PPValidate.clear(classForm);
        el('classFormTitle').textContent = 'Add Class';
        el('repeatGroup').classList.remove('d-none');
        el('cancelEditBtn').classList.add('d-none');
        el('saveClassBtn').innerHTML = '<i class="bi bi-plus-lg me-1"></i> Add Class';
        el('classFormCol').querySelector('.fm-form-card').classList.remove('is-editing');
        el('classDate').value = anchorDate.value || iso(new Date());
    }

    function startEdit(c) {
        resetForm();
        editingId = c.id;
        el('classFormTitle').textContent = 'Edit Class';
        el('repeatGroup').classList.add('d-none');
        el('cancelEditBtn').classList.remove('d-none');
        el('saveClassBtn').innerHTML = '<i class="bi bi-check-lg me-1"></i> Save Changes';
        el('classFormCol').querySelector('.fm-form-card').classList.add('is-editing');
        el('classSubject').value = c.subject;
        el('classSection').value = c.classSection;
        el('classRoom').value = c.room || '';
        el('classDate').value = c.classDate;
        el('classStart').value = c.scheduledStart;
        el('classEnd').value = c.scheduledEnd;
        el('classFormCol').scrollIntoView({ behavior: 'smooth', block: 'start' });
        el('classSubject').focus();
    }

    el('cancelEditBtn').addEventListener('click', resetForm);

    classForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!teacher || !PPValidate.validateForm(classForm)) return;

        var payload = {
            employeeId: teacher.id,
            subject: el('classSubject').value.trim(),
            classSection: el('classSection').value.trim(),
            room: el('classRoom').value.trim(),
            classDate: el('classDate').value,
            scheduledStart: el('classStart').value,
            scheduledEnd: el('classEnd').value,
            repeatWeeklyUntil: editingId ? null : (el('classRepeatUntil').value || null)
        };

        var id = editingId;
        var btn = el('saveClassBtn');
        btn.disabled = true;
        postJson(id ? 'api/faculty-schedule/classes/' + id : 'api/faculty-schedule/classes', payload, id ? 'PUT' : 'POST')
            .then(function (data) {
                btn.disabled = false;
                if (!data.success) {
                    if (!PPValidate.showServerError(classForm, data, SERVER_FIELDS)) PPToast.error(data.message || 'Could not save the class.');
                    return;
                }
                if (id) {
                    PPToast.success('Class updated.');
                    if (data.class && data.class.overlapsWith.length) {
                        PPToast.error('This class overlaps another class of this faculty member — flagged for review.');
                    }
                } else {
                    PPToast.success(data.created === 1 ? 'Class added.' : data.created + ' weekly classes added.');
                    if (data.overlapDates && data.overlapDates.length) {
                        PPToast.error('Overlaps with existing classes on ' + data.overlapDates.join(', ') + ' — flagged for review.');
                    }
                }
                anchorDate.value = payload.classDate;
                resetForm();
                loadClasses();
            })
            .catch(function () {
                btn.disabled = false;
                PPToast.error('Could not reach the server.');
            });
    });

    // ---------------------------------------------------------------
    // Navigation: ?employee=F2 opens that faculty member's page
    // ---------------------------------------------------------------

    function openFaculty(employeeId) {
        history.pushState({ employee: employeeId }, '', 'faculty-schedule.html?employee=' + encodeURIComponent(employeeId));
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
            history.pushState({}, '', 'faculty-schedule.html');
            showList();
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
            loadClasses();
        });
    });

    el('prevRange').addEventListener('click', function () {
        anchorDate.value = addDays(anchorDate.value, view === 'day' ? -1 : -7);
        loadClasses();
    });
    el('nextRange').addEventListener('click', function () {
        anchorDate.value = addDays(anchorDate.value, view === 'day' ? 1 : 7);
        loadClasses();
    });
    el('todayBtn').addEventListener('click', function () {
        anchorDate.value = iso(new Date());
        loadClasses();
    });
    anchorDate.addEventListener('change', function () {
        if (anchorDate.value) loadClasses();
    });

    classBody.addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-id]');
        if (row) openDetail(Number(row.dataset.id));
    });
    classBody.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
            e.preventDefault();
            openDetail(Number(e.target.dataset.id));
        }
    });

    // Classes in the week timetable open the same details.
    el('weekGrid').addEventListener('click', function (e) {
        var block = e.target.closest('[data-id]');
        if (block) openDetail(Number(block.dataset.id));
    });
    el('weekGrid').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-id]')) {
            e.preventDefault();
            openDetail(Number(e.target.dataset.id));
        }
    });

    anchorDate.value = new URLSearchParams(window.location.search).get('date') || iso(new Date());

    el('facultyBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading faculty…</td></tr>';
    loadTeachers()
        .catch(function (error) {
            PPToast.error(error.message || 'Could not load faculty.');
        })
        .then(route);
})();
