(function () {
    PayrollProLayout.init({
        activeNav: 'reports',
        navMode: 'payrollStaff',
        user: { name: 'Maria Elena Reyes', role: 'Payroll Staff', initials: 'MR' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    var employees = DataStore.getEmployees().filter(function (e) { return e.status !== 'Inactive'; });
    var dtr = DataStore.getDTR();

    var reportType = document.getElementById('reportType');
    var reportBody = document.getElementById('reportBody');
    var reportEmpty = document.getElementById('reportEmpty');

    function render() {
        var type = reportType.value;
        var filtered = employees.filter(function (e) { return type === 'all' || e.type === type; });

        if (!filtered.length) {
            reportBody.innerHTML = '';
            reportEmpty.classList.remove('d-none');
            return;
        }
        reportEmpty.classList.add('d-none');

        reportBody.innerHTML = filtered.map(function (emp) {
            var empRecords = dtr.filter(function (r) { return r.employeeId === emp.id; });
            var present = empRecords.filter(function (r) { return r.status === 'present'; }).length;
            var late = empRecords.filter(function (r) { return r.status === 'late'; }).length;
            var absent = empRecords.filter(function (r) { return r.status === 'absent'; }).length;
            var leave = empRecords.filter(function (r) { return r.status === 'leave'; }).length;
            var total = empRecords.length;
            var rate = total ? Math.round(((present + late) / total) * 1000) / 10 : 0;

            return (
                '<tr>' +
                    '<td><strong>' + emp.displayName + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + emp.employeeNumber + '</span></td>' +
                    '<td><span class="pp-badge ' + (emp.type === 'Faculty' ? 'pp-badge-faculty' : 'pp-badge-admin') + '">' + emp.type + '</span></td>' +
                    '<td class="col-num">' + present + '</td>' +
                    '<td class="col-num">' + late + '</td>' +
                    '<td class="col-num">' + absent + '</td>' +
                    '<td class="col-num">' + leave + '</td>' +
                    '<td class="col-num"><strong>' + rate + '%</strong></td>' +
                '</tr>'
            );
        }).join('');
    }

    reportType.addEventListener('change', render);
    render();
})();
