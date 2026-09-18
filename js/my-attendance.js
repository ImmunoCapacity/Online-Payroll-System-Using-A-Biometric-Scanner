(function () {
    PayrollProLayout.init({
        activeNav: 'attendance',
        navMode: 'staff',
        user: { name: 'Dr. Maria Santos', role: 'Faculty Staff', initials: 'MS' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    var CURRENT_EMPLOYEE_ID = 'EMP-2021-014';

    function formatDate(iso) {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatTime12(t) {
        if (!t) return '—';
        var parts = t.split(':');
        var h = parseInt(parts[0], 10);
        var m = parts[1];
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + m + ' ' + ampm;
    }

    function parseTime(t) {
        if (!t) return null;
        var p = t.split(':').map(Number);
        return p[0] * 60 + p[1];
    }

    function calcHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return '—';
        var diff = parseTime(timeOut) - parseTime(timeIn);
        if (diff <= 0) return '—';
        var h = Math.floor(diff / 60), m = diff % 60;
        return h + 'h ' + (m ? m + 'm' : '');
    }

    function statusBadge(status) {
        var map = {
            present: ['pp-badge-present', 'Present'],
            late: ['pp-badge-late', 'Late'],
            absent: ['pp-badge-absent', 'Absent'],
            leave: ['pp-badge-leave', 'On Leave']
        };
        var item = map[status] || map.absent;
        return '<span class="pp-badge ' + item[0] + '">' + item[1] + '</span>';
    }

    var records = DataStore.getDTR()
        .filter(function (r) { return r.employeeId === CURRENT_EMPLOYEE_ID; })
        .sort(function (a, b) { return b.date.localeCompare(a.date); });

    document.getElementById('statPresent').textContent = records.filter(function (r) { return r.status === 'present'; }).length;
    document.getElementById('statLate').textContent = records.filter(function (r) { return r.status === 'late'; }).length;
    document.getElementById('statAbsent').textContent = records.filter(function (r) { return r.status === 'absent'; }).length;

    var tbody = document.getElementById('attendanceBody');
    var empty = document.getElementById('attendanceEmpty');

    if (!records.length) {
        empty.classList.remove('d-none');
    } else {
        tbody.innerHTML = records.map(function (r) {
            return (
                '<tr>' +
                    '<td>' + formatDate(r.date) + '</td>' +
                    '<td class="col-time">' + formatTime12(r.timeIn) + '</td>' +
                    '<td class="col-time">' + formatTime12(r.timeOut) + '</td>' +
                    '<td class="col-hours">' + calcHours(r.timeIn, r.timeOut) + '</td>' +
                    '<td>' + statusBadge(r.status) + '</td>' +
                '</tr>'
            );
        }).join('');
    }
})();
