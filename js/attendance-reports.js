/**
 * Attendance Report: per employee, the working days present, late, absent
 * or on approved leave in a date range (api/dtr/summary). Defaults to the
 * current pay period (11th–25th or 26th–10th).
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

    // The current pay period.
    (function defaultRange() {
        var today = new Date();
        var start = today.getDate() >= 26 ? new Date(today.getFullYear(), today.getMonth(), 26)
            : today.getDate() >= 11 ? new Date(today.getFullYear(), today.getMonth(), 11)
            : new Date(today.getFullYear(), today.getMonth() - 1, 26);
        var end = start.getDate() === 11
            ? new Date(start.getFullYear(), start.getMonth(), 25)
            : new Date(start.getFullYear(), start.getMonth() + 1, 10);
        reportFrom.value = iso(start);
        reportTo.value = iso(end);
    })();

    function load() {
        if (!reportFrom.value || !reportTo.value) return;
        if (reportTo.value < reportFrom.value) {
            reportBody.innerHTML = '';
            reportEmpty.textContent = 'The To date can\'t be before the From date.';
            reportEmpty.classList.remove('d-none');
            return;
        }
        reportBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Loading…</td></tr>';
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
                    '<td><strong>' + escapeHtml(emp.employeeName) + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + escapeHtml(emp.employeeNumber) + '</span></td>' +
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

    reportType.addEventListener('change', render);
    reportFrom.addEventListener('change', load);
    reportTo.addEventListener('change', load);
    load();
})();
