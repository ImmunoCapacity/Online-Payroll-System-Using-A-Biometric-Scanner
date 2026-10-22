/**
 * Attendance Report: per employee, the working days present, late, absent
 * or on approved leave in a date range (api/dtr/summary). Defaults to the
 * current pay period (Maintenance → Payroll Periods).
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
    var reportBody = document.getElementById('reportBody');
    var reportEmpty = document.getElementById('reportEmpty');
    var employees = [];

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    function load() {
        if (!reportFrom.value || !reportTo.value) return;
        if (reportTo.value < reportFrom.value) {
            reportBody.innerHTML = '';
            reportEmpty.textContent = 'The To date can\'t be before the From date.';
            reportEmpty.classList.remove('d-none');
            return;
        }
        reportBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Loading…</td></tr>';
        reportEmpty.classList.add('d-none');
        fetch('api/dtr/summary?from=' + reportFrom.value + '&to=' + reportTo.value)
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) throw new Error(data.message);
                employees = data.employees;
                render();
            })
            .catch(function (error) {
                employees = [];
                reportBody.innerHTML = '';
                reportEmpty.textContent = (error && error.message) || 'Could not load attendance from the server.';
                reportEmpty.classList.remove('d-none');
            });
    }

    function render() {
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
                '<tr>' +
                    '<td>' + escapeHtml(emp.employeeNumber) + '</td>' +
                    '<td><strong>' + escapeHtml(emp.employeeName) + '</strong></td>' +
                    '<td><span class="pp-badge ' + badge + '">' + escapeHtml(emp.type) + '</span></td>' +
                    '<td class="col-num">' + emp.present + '</td>' +
                    '<td class="col-num">' + emp.late + '</td>' +
                    '<td class="col-num">' + emp.absent + '</td>' +
                    '<td class="col-num">' + emp.onLeave + '</td>' +
                    '<td class="col-num"><strong>' + (emp.attendanceRate == null ? '—' : emp.attendanceRate + '%') + '</strong></td>' +
                '</tr>'
            );
        }).join('');
    }

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
                    { label: 'EMP. ID', kind: 'text' }, { label: 'EMPLOYEE', kind: 'text' }, { label: 'TYPE', kind: 'text' },
                    { label: 'PRESENT', kind: 'number' }, { label: 'LATE', kind: 'number' }, { label: 'ABSENT', kind: 'number' },
                    { label: 'ON LEAVE', kind: 'number' }, { label: 'ATTENDANCE RATE (%)', kind: 'number' }
                ],
                rows: rows.map(function (e) {
                    return [e.employeeNumber, e.employeeName, e.type, e.present, e.late, e.absent, e.onLeave, e.attendanceRate];
                }),
                totals: [null, null, null, sum('present'), sum('late'), sum('absent'), sum('onLeave'), null]
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
    PPPeriods.load().then(function () {
        fillCutoffs();
        load();
    });
})();
