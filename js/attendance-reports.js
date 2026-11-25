/**
 * Attendance Report: per employee, the working days present, late, absent
 * or on approved leave in a date range (api/dtr/summary), plus the hours
 * worked (office + approved teaching, api/payroll/hours) in each payroll
 * cut-off the date range covers. Defaults to the current pay period
 * (Maintenance → Payroll Periods).
 */
(function () {
    PayrollProLayout.init({
        activeNav: 'reports',
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    var reportType = document.getElementById('reportType');
    var reportFrom = document.getElementById('reportFrom');
    var reportTo = document.getElementById('reportTo');
    var reportHeadRow = document.getElementById('reportHeadRow');
    var reportBody = document.getElementById('reportBody');
    var reportEmpty = document.getElementById('reportEmpty');
    var employees = [];
    var cutoffs = [];          // payroll cut-offs the selected range covers
    var hoursByCutoff = [];    // same order as cutoffs; each a { employeeId: hours } map
    var baseColumns = 8;       // Employee ID, Employee Name, Position, Present, Late, Absent, On Leave, Attendance Rate

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    var DAY_STATUS = {
        present: ['pp-badge-present', 'Present'],
        late: ['pp-badge-late', 'Late'],
        absent: ['pp-badge-absent', 'Absent'],
        leave: ['pp-badge-leave', 'On Leave'],
        'rest-day': ['pp-att-muted', 'Rest Day'],
        upcoming: ['pp-att-muted', '—'],
        'not-hired': ['pp-att-muted', 'Not yet hired']
    };

    function dayStatusBadge(status) {
        var s = DAY_STATUS[status] || DAY_STATUS.absent;
        return '<span class="pp-badge ' + s[0] + '">' + s[1] + '</span>';
    }

    /* Cut-off (Maintenance → Payroll Periods). Choosing one fills From and
       To; changing a date by hand switches it to "Custom dates". */
    var reportCutoff = document.getElementById('reportCutoff');

    function cutoffContaining(date) {
        var p = PPPeriods.of(date);
        return { start: p.from, end: p.to, startDate: p.start, endDate: p.end };
    }

    function cutoffLabel(c) {
        return c.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' – ' +
            c.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function syncCutoff() {
        var value = reportFrom.value + '|' + reportTo.value;
        var match = Array.prototype.some.call(reportCutoff.options, function (o) { return o.value === value; });
        reportCutoff.value = match ? value : 'custom';
    }

    // The current cut-off and the 24 before it (one year), newest first.
    function fillCutoffs() {
        var c = cutoffContaining(new Date());
        var options = [];
        for (var i = 0; i < 25; i++) {
            options.push('<option value="' + c.start + '|' + c.end + '">' + cutoffLabel(c) + (i === 0 ? ' (current)' : '') + '</option>');
            var before = new Date(c.startDate);
            before.setDate(before.getDate() - 1);
            c = cutoffContaining(before);
        }
        options.push('<option value="custom">Custom dates</option>');
        reportCutoff.innerHTML = options.join('');
        var current = cutoffContaining(new Date());
        reportFrom.value = current.start;
        reportTo.value = current.end;
        syncCutoff();
    }

    reportCutoff.addEventListener('change', function () {
        if (reportCutoff.value === 'custom') {
            reportFrom.focus();
            return;
        }
        var range = reportCutoff.value.split('|');
        reportFrom.value = range[0];
        reportTo.value = range[1];
        load();
    });

    /** Every payroll cut-off the date range touches, oldest first. */
    function cutoffsInRange(from, to) {
        var list = [];
        var p = PPPeriods.of(from);
        while (p.from <= to) {
            list.push(p);
            if (p.to >= to) break;
            p = PPPeriods.next(p);
        }
        return list;
    }

    function loadingRow() {
        return '<tr><td colspan="' + (baseColumns + cutoffs.length) + '" class="text-center text-muted py-4">Loading…</td></tr>';
    }

    function load() {
        if (!reportFrom.value || !reportTo.value) return;
        if (reportTo.value < reportFrom.value) {
            reportBody.innerHTML = '';
            reportEmpty.textContent = 'The To date can\'t be before the From date.';
            reportEmpty.classList.remove('d-none');
            return;
        }
        cutoffs = cutoffsInRange(reportFrom.value, reportTo.value);
        renderHead();
        reportBody.innerHTML = loadingRow();
        reportEmpty.classList.add('d-none');
        Promise.all([
            fetch('api/dtr/summary?from=' + reportFrom.value + '&to=' + reportTo.value).then(function (r) { return r.json(); }),
            Promise.all(cutoffs.map(function (c) {
                return fetch('api/payroll/hours?from=' + c.from + '&to=' + c.to).then(function (r) { return r.json(); });
            }))
        ])
            .then(function (results) {
                if (!results[0].success) throw new Error(results[0].message);
                employees = results[0].employees;
                hoursByCutoff = results[1].map(function (data) {
                    var byEmployee = {};
                    if (data.success) {
                        data.hours.forEach(function (h) {
                            byEmployee[h.employeeId] = (Number(h.officeHours) || 0) + (Number(h.teachingHours) || 0);
                        });
                    }
                    return byEmployee;
                });
                render();
            })
            .catch(function (error) {
                employees = [];
                reportBody.innerHTML = '';
                reportEmpty.textContent = (error && error.message) || 'Could not load attendance from the server.';
                reportEmpty.classList.remove('d-none');
            });
    }

    function renderHead() {
        reportHeadRow.querySelectorAll('.cutoff-hours-head').forEach(function (th) { th.remove(); });
        var extra = cutoffs.map(function (c) {
            return '<th class="col-num cutoff-hours-head">' + escapeHtml(c.label) + '</th>';
        }).join('');
        reportHeadRow.insertAdjacentHTML('beforeend', extra);
    }

    function hoursCell(employeeId) {
        return hoursByCutoff.map(function (byEmployee) {
            return '<td class="col-num">' + (Number(byEmployee[employeeId]) || 0).toFixed(2) + '</td>';
        }).join('');
    }

    function render() {
        renderHead();
        var type = reportType.value;
        var filtered = employees.filter(function (e) { return type === 'all' || e.type === type; });

        if (!filtered.length) {
            reportBody.innerHTML = '';
            reportEmpty.textContent = 'No attendance records found for the selected filter.';
            reportEmpty.classList.remove('d-none');
            return;
        }
        reportEmpty.classList.add('d-none');

        reportBody.innerHTML = filtered.map(function (emp) {
            var badge = emp.type === 'Faculty' ? 'pp-badge-faculty' : emp.type === 'Faculty/Admin' ? 'pp-badge-faculty-admin' : 'pp-badge-admin';
            return (
                '<tr class="pp-row-clickable" tabindex="0" role="button" data-id="' + escapeHtml(emp.employeeId) + '" ' +
                        'aria-label="Daily time in/out for ' + escapeHtml(emp.employeeName) + '">' +
                    '<td>' + escapeHtml(emp.employeeNumber) + '</td>' +
                    '<td><strong>' + escapeHtml(emp.employeeName) + '</strong></td>' +
                    '<td><span class="pp-badge ' + badge + '">' + escapeHtml(PayrollProLayout.staffTypeLabel(emp.type)) + '</span></td>' +
                    '<td class="col-num">' + emp.present + '</td>' +
                    '<td class="col-num">' + emp.late + '</td>' +
                    '<td class="col-num">' + emp.absent + '</td>' +
                    '<td class="col-num">' + emp.onLeave + '</td>' +
                    '<td class="col-num"><strong>' + (emp.attendanceRate == null ? '—' : emp.attendanceRate + '%') + '</strong></td>' +
                    hoursCell(emp.employeeId) +
                '</tr>'
            );
        }).join('');
    }

    /* Daily time in/out for one employee (api/dtr/employee-days), over the
       report's selected range. That endpoint allows at most two months. */
    var employeeDaysModal = new bootstrap.Modal(document.getElementById('employeeDaysModal'));
    var MAX_DAY_DETAIL_DAYS = 62;

    function daysBetween(from, to) {
        return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
    }

    function openEmployeeDays(employeeId) {
        var emp = employees.find(function (e) { return e.employeeId === employeeId; });
        if (!emp) return;

        document.getElementById('employeeDaysTitle').textContent = emp.employeeName;
        document.getElementById('employeeDaysSubtitle').textContent =
            escapeHtml(emp.employeeNumber) + ' · ' + longDate(reportFrom.value) + ' – ' + longDate(reportTo.value);
        var body = document.getElementById('employeeDaysBody');

        if (daysBetween(reportFrom.value, reportTo.value) > MAX_DAY_DETAIL_DAYS) {
            body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">' +
                'Pick a narrower date range above (at most two months) to see daily time in/out.</td></tr>';
            employeeDaysModal.show();
            return;
        }

        body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Loading…</td></tr>';
        employeeDaysModal.show();
        fetch('api/dtr/employee-days?employeeId=' + encodeURIComponent(employeeId) +
            '&from=' + reportFrom.value + '&to=' + reportTo.value)
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) throw new Error(data.message);
                if (!data.attendance.days.length) {
                    body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No days in this range.</td></tr>';
                    return;
                }
                body.innerHTML = data.attendance.days.map(function (d) {
                    var date = new Date(d.date + 'T00:00:00');
                    return '<tr>' +
                        '<td>' + date.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + '</td>' +
                        '<td>' + time12(d.timeIn) + '</td>' +
                        '<td>' + time12(d.timeOut) + '</td>' +
                        '<td class="col-num">' + hoursText(d.hours) + '</td>' +
                        '<td>' + dayStatusBadge(d.status) + (d.manual ? ' <span class="text-muted small"><i class="bi bi-pencil-fill"></i> Manual</span>' : '') + '</td>' +
                    '</tr>';
                }).join('');
            })
            .catch(function (error) {
                body.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">' +
                    escapeHtml((error && error.message) || 'Could not load daily attendance.') + '</td></tr>';
            });
    }

    reportBody.addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-id]');
        if (row) openEmployeeDays(row.dataset.id);
    });
    reportBody.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
            e.preventDefault();
            openEmployeeDays(e.target.dataset.id);
        }
    });

    /* Export PDF / Excel: the server (api/reports/export) builds the file
       from the rows on screen, with the school letterhead. */
    function longDate(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function exportReport(format, button) {
        var type = reportType.value;
        var rows = employees.filter(function (e) { return type === 'all' || e.type === type; });
        if (!rows.length) {
            PPToast.error('There is nothing to export for these dates.');
            return;
        }
        var sum = function (k) { return rows.reduce(function (s, e) { return s + (Number(e[k]) || 0); }, 0); };
        var subtitle = longDate(reportFrom.value) + ' – ' + longDate(reportTo.value) +
            (type === 'all' ? '' : '   |   ' + reportType.selectedOptions[0].textContent.trim());
        var label = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Exporting…';

        fetch('api/reports/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                format: format,
                title: 'Attendance Report',
                subtitle: [subtitle],
                columns: [
                    { label: 'EMP. ID', kind: 'text' }, { label: 'EMPLOYEE NAME', kind: 'text' }, { label: 'POSITION', kind: 'text' },
                    { label: 'PRESENT', kind: 'number' }, { label: 'LATE', kind: 'number' }, { label: 'ABSENT', kind: 'number' },
                    { label: 'ON LEAVE', kind: 'number' }, { label: 'ATTENDANCE RATE (%)', kind: 'number' }
                ].concat(cutoffs.map(function (c) {
                    return { label: c.label.toUpperCase() + ' HOURS', kind: 'number' };
                })),
                rows: rows.map(function (e) {
                    return [e.employeeNumber, e.employeeName, e.type, e.present, e.late, e.absent, e.onLeave, e.attendanceRate]
                        .concat(hoursByCutoff.map(function (byEmployee) { return (Number(byEmployee[e.employeeId]) || 0).toFixed(2); }));
                }),
                totals: [null, null, null, sum('present'), sum('late'), sum('absent'), sum('onLeave'), null]
                    .concat(hoursByCutoff.map(function (byEmployee) {
                        return rows.reduce(function (s, e) { return s + (Number(byEmployee[e.employeeId]) || 0); }, 0).toFixed(2);
                    }))
            })
        })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().catch(function () { return {}; }).then(function (data) {
                        throw new Error(data.message || 'The export failed.');
                    });
                }
                var match = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') || '');
                return response.blob().then(function (blob) {
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.href = url;
                    link.download = match ? match[1] : 'attendance-report.' + format;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                });
            })
            .catch(function (error) { PPToast.error(error.message || 'The export failed.'); })
            .then(function () {
                button.disabled = false;
                button.innerHTML = label;
            });
    }

    /* Print: letterhead, title, dates and the table only (css/attendance-reports.css). */
    window.addEventListener('beforeprint', function () {
        document.getElementById('printSubtitle').textContent = longDate(reportFrom.value) + ' – ' + longDate(reportTo.value) +
            (reportType.value === 'all' ? '' : '   |   ' + reportType.selectedOptions[0].textContent.trim());
    });
    document.getElementById('printReport').addEventListener('click', function () { window.print(); });

    document.getElementById('exportPdf').addEventListener('click', function () { exportReport('pdf', this); });
    document.getElementById('exportExcel').addEventListener('click', function () { exportReport('xlsx', this); });

    reportType.addEventListener('change', render);
    reportFrom.addEventListener('change', function () { syncCutoff(); load(); });
    reportTo.addEventListener('change', function () { syncCutoff(); load(); });

    Promise.all([PayrollProLayout.loadStaffTypeLabels(), PayrollProLayout.loadEmployeeTypeOptions()]).then(function (results) {
        PayrollProLayout.populateEmployeeTypeSelect(reportType, results[1]);
        return PPPeriods.load();
    }).then(function () {
        fillCutoffs();
        load();
    });
})();
