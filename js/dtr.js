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

    const employees = DataStore.getEmployees().filter(function (e) { return e.status !== 'Inactive'; });

    const today = new Date().toISOString().slice(0, 10);

    let records = DataStore.getDTR();

    function persistRecords() {
        DataStore.saveDTR(records);
    }

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
            return '<option value="' + e.displayName + ' (' + e.id + ')"></option>';
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
                const emp = employees.find(function (e) { return e.id === r.employeeId; });
                return { record: r, employee: emp };
            })
            .filter(function (row) {
                if (!row.employee) return false;
                if (type !== 'all' && row.employee.type !== type) return false;
                if (q && !row.employee.displayName.toLowerCase().includes(q)) return false;
                return true;
            })
            .sort(function (a, b) { return a.employee.displayName.localeCompare(b.employee.displayName); });
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
                    '<td><strong>' + emp.displayName + '</strong>' + manualTag + '<br><span class="text-muted" style="font-size:0.75rem;">' + emp.id + '</span></td>' +
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
            return e.displayName.toLowerCase() === value.toLowerCase();
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
            return r.employeeId === emp.id && r.date === date;
        });

        const entry = {
            employeeId: emp.id,
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
        persistRecords();

        filterDate.value = date;
        bootstrap.Modal.getInstance(manualModal).hide();
        manualForm.reset();
        manualForm.classList.remove('was-validated');
        manualDate.value = today;
        renderTable();
        PPToast.success('Attendance record saved.');
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
