(function () {
    PayrollProLayout.init({
        activeNav: 'dtr',
        user: {
            name: 'Maria Elena Reyes',
            role: 'Payroll Staff',
            initials: 'MR'
        },
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    const GRACE_MINUTES = 15;
    const STANDARD_START = '08:00';

    const employees = [
        { id: 'EMP-2021-014', name: 'Dr. Maria Santos', type: 'Faculty', scheduleStart: '07:30', scheduleEnd: '09:30' },
        { id: 'EMP-2022-031', name: 'Prof. James Rivera', type: 'Faculty', scheduleStart: '10:00', scheduleEnd: '12:00' },
        { id: 'EMP-2023-007', name: 'Anna Cruz', type: 'Admin' },
        { id: 'EMP-2020-052', name: 'Roberto Mendoza', type: 'Faculty', scheduleStart: '13:00', scheduleEnd: '15:00' },
        { id: 'EMP-2021-089', name: 'Elena Villanueva', type: 'Admin' },
        { id: 'EMP-2024-003', name: 'Michael Tan', type: 'Faculty', scheduleStart: '08:00', scheduleEnd: '10:00' },
        { id: 'EMP-2022-045', name: 'Grace Lim', type: 'Admin' },
        { id: 'EMP-2023-019', name: 'Dr. Patricia Go', type: 'Faculty', scheduleStart: '14:00', scheduleEnd: '16:00' }
    ];

    const today = new Date().toISOString().slice(0, 10);

    let records = [
        { empId: 'EMP-2021-014', date: today, timeIn: '07:42', timeOut: '17:05', status: 'present', manual: false },
        { empId: 'EMP-2022-031', date: today, timeIn: '10:22', timeOut: '18:00', status: 'late', manual: false },
        { empId: 'EMP-2023-007', date: today, timeIn: '08:01', timeOut: '17:30', status: 'present', manual: false },
        { empId: 'EMP-2020-052', date: today, timeIn: null, timeOut: null, status: 'absent', manual: false },
        { empId: 'EMP-2021-089', date: today, timeIn: '08:10', timeOut: '16:45', status: 'present', manual: false },
        { empId: 'EMP-2024-003', date: today, timeIn: null, timeOut: null, status: 'leave', manual: false },
        { empId: 'EMP-2022-045', date: today, timeIn: '08:18', timeOut: '17:00', status: 'late', manual: false },
        { empId: 'EMP-2023-019', date: today, timeIn: '13:55', timeOut: '17:20', status: 'present', manual: false }
    ];

    const filterDate = document.getElementById('filterDate');
    const filterType = document.getElementById('filterType');
    const filterSearch = document.getElementById('filterSearch');
    const dtrBody = document.getElementById('dtrBody');
    const emptyTable = document.getElementById('emptyTable');
    const manualForm = document.getElementById('manualEntryForm');
    const manualModal = document.getElementById('manualEntryModal');
    const employeeDatalist = document.getElementById('employeeDatalist');
    const manualEmployeeSearch = document.getElementById('manualEmployeeSearch');
    const manualEmployee = document.getElementById('manualEmployee');
    const manualDate = document.getElementById('manualDate');

    filterDate.value = today;
    manualDate.value = today;
    manualDate.max = today;

    function populateDatalist() {
        employeeDatalist.innerHTML = employees.map(function (e) {
            return '<option value="' + e.name + ' (' + e.id + ')"></option>';
        }).join('');
    }

    function parseTime(t) {
        if (!t) return null;
        const parts = t.split(':').map(Number);
        return parts[0] * 60 + parts[1];
    }

    function formatTime12(t) {
        if (!t) return '—';
        const parts = t.split(':');
        let h = parseInt(parts[0], 10);
        const m = parts[1];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + m + ' ' + ampm;
    }

    function calcHours(timeIn, timeOut) {
        if (!timeIn || !timeOut) return '—';
        const diff = parseTime(timeOut) - parseTime(timeIn);
        if (diff <= 0) return '—';
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return h + 'h ' + (m ? m + 'm' : '');
    }

    function deriveStatus(timeIn, scheduledStart) {
        if (!timeIn) return 'absent';
        const start = parseTime(scheduledStart || STANDARD_START);
        const graceEnd = start + GRACE_MINUTES;
        const actual = parseTime(timeIn);
        return actual > graceEnd ? 'late' : 'present';
    }

    function teachingPresent(emp, rec) {
        if (emp.type !== 'Faculty' || !emp.scheduleStart || !emp.scheduleEnd) return null;
        if (!rec.timeIn || !rec.timeOut) return false;
        const inMin = parseTime(rec.timeIn);
        const outMin = parseTime(rec.timeOut);
        const schedStart = parseTime(emp.scheduleStart);
        const schedEnd = parseTime(emp.scheduleEnd);
        return inMin <= schedStart + GRACE_MINUTES && outMin >= schedEnd - 15;
    }

    function statusBadge(status) {
        const map = {
            present: ['pp-badge-present', 'Present'],
            late: ['pp-badge-late', 'Late'],
            absent: ['pp-badge-absent', 'Absent'],
            leave: ['pp-badge-leave', 'On Leave']
        };
        const item = map[status] || map.absent;
        return '<span class="pp-badge ' + item[0] + '">' + item[1] + '</span>';
    }

    function typeBadge(type) {
        return '<span class="pp-badge ' + (type === 'Faculty' ? 'pp-badge-faculty' : 'pp-badge-admin') + '">' + type + '</span>';
    }

    function teachingCell(emp, rec) {
        if (emp.type !== 'Faculty') {
            return '<td class="text-center"><span class="pp-teaching-icon na" title="Not applicable">—</span></td>';
        }
        const met = teachingPresent(emp, rec);
        if (rec.status === 'leave' || rec.status === 'absent') {
            return '<td class="text-center"><i class="bi bi-x-circle-fill pp-teaching-icon missed" title="Not present during scheduled teaching period"></i></td>';
        }
        if (met) {
            return '<td class="text-center"><i class="bi bi-check-circle-fill pp-teaching-icon met" title="Present during scheduled teaching (' + emp.scheduleStart + '–' + emp.scheduleEnd + ')"></i></td>';
        }
        return '<td class="text-center"><i class="bi bi-exclamation-circle-fill pp-teaching-icon missed" title="Not present during full scheduled teaching period"></i></td>';
    }

    function getFilteredRows() {
        const date = filterDate.value;
        const type = filterType.value;
        const q = filterSearch.value.trim().toLowerCase();

        return records
            .filter(function (r) { return r.date === date; })
            .map(function (r) {
                const emp = employees.find(function (e) { return e.id === r.empId; });
                return { record: r, employee: emp };
            })
            .filter(function (row) {
                if (!row.employee) return false;
                if (type !== 'all' && row.employee.type !== type) return false;
                if (q && !row.employee.name.toLowerCase().includes(q)) return false;
                return true;
            })
            .sort(function (a, b) { return a.employee.name.localeCompare(b.employee.name); });
    }

    function updateSummary() {
        const date = filterDate.value;
        const dayRecords = records.filter(function (r) { return r.date === date; });
        let present = 0, late = 0, absent = 0;
        dayRecords.forEach(function (r) {
            if (r.status === 'present') present++;
            else if (r.status === 'late') late++;
            else if (r.status === 'absent') absent++;
        });
        document.getElementById('summaryPresent').textContent = present;
        document.getElementById('summaryLate').textContent = late;
        document.getElementById('summaryAbsent').textContent = absent;
    }

    function renderTable() {
        const rows = getFilteredRows();
        updateSummary();

        if (rows.length === 0) {
            dtrBody.innerHTML = '';
            emptyTable.classList.remove('d-none');
            return;
        }

        emptyTable.classList.add('d-none');
        dtrBody.innerHTML = rows.map(function (row) {
            const emp = row.employee;
            const rec = row.record;
            const manualTag = rec.manual ? ' <i class="bi bi-pencil-fill text-muted" title="Manual entry" style="font-size:0.7rem;"></i>' : '';
            return (
                '<tr>' +
                    '<td><strong>' + emp.name + '</strong>' + manualTag + '<br><span class="text-muted" style="font-size:0.75rem;">' + emp.id + '</span></td>' +
                    '<td>' + typeBadge(emp.type) + '</td>' +
                    '<td class="col-time">' + formatTime12(rec.timeIn) + '</td>' +
                    '<td class="col-time">' + formatTime12(rec.timeOut) + '</td>' +
                    '<td class="col-hours">' + calcHours(rec.timeIn, rec.timeOut) + '</td>' +
                    '<td>' + statusBadge(rec.status) + '</td>' +
                    teachingCell(emp, rec) +
                '</tr>'
            );
        }).join('');
    }

    function resolveEmployeeFromSearch(value) {
        const match = value.match(/\(([^)]+)\)\s*$/);
        if (match) {
            return employees.find(function (e) { return e.id === match[1]; });
        }
        return employees.find(function (e) {
            return e.name.toLowerCase() === value.toLowerCase();
        });
    }

    manualEmployeeSearch.addEventListener('input', function () {
        const emp = resolveEmployeeFromSearch(manualEmployeeSearch.value);
        manualEmployee.value = emp ? emp.id : '';
    });

    manualForm.addEventListener('submit', function (e) {
        e.preventDefault();
        manualForm.classList.add('was-validated');

        const emp = resolveEmployeeFromSearch(manualEmployeeSearch.value);
        if (!emp) {
            manualEmployeeSearch.classList.add('is-invalid');
            return;
        }
        manualEmployeeSearch.classList.remove('is-invalid');

        const date = manualDate.value;
        const timeIn = document.getElementById('manualTimeIn').value;
        const timeOut = document.getElementById('manualTimeOut').value || null;
        const reason = document.getElementById('manualReason').value.trim();

        if (!date || !timeIn || !reason) return;

        const scheduledStart = emp.type === 'Faculty' && emp.scheduleStart ? emp.scheduleStart : STANDARD_START;
        const status = deriveStatus(timeIn, scheduledStart);

        const existing = records.findIndex(function (r) {
            return r.empId === emp.id && r.date === date;
        });

        const entry = {
            empId: emp.id,
            date: date,
            timeIn: timeIn,
            timeOut: timeOut,
            status: status,
            manual: true,
            reason: reason
        };

        if (existing >= 0) {
            records[existing] = entry;
        } else {
            records.push(entry);
        }

        filterDate.value = date;
        bootstrap.Modal.getInstance(manualModal).hide();
        manualForm.reset();
        manualForm.classList.remove('was-validated');
        manualDate.value = today;
        renderTable();
    });

    manualModal.addEventListener('hidden.bs.modal', function () {
        manualForm.reset();
        manualForm.classList.remove('was-validated');
        manualEmployeeSearch.classList.remove('is-invalid');
        manualDate.value = filterDate.value || today;
    });

    [filterDate, filterType, filterSearch].forEach(function (el) {
        el.addEventListener('input', renderTable);
        el.addEventListener('change', renderTable);
    });

    populateDatalist();
    renderTable();
})();
