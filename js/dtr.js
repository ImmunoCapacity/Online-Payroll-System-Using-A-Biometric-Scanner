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
    const facultyEmployees = employees.filter(function (e) { return e.type === 'Faculty'; });

    const today = new Date().toISOString().slice(0, 10);

    let records = DataStore.getDTR();
    let schedules = DataStore.getTeachingSchedule();

    function persistRecords() {
        DataStore.saveDTR(records);
    }

    function persistSchedules() {
        DataStore.saveTeachingSchedule(schedules);
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


    /* ================================================================
       TABS
       ================================================================ */

    document.querySelectorAll('.pp-dtr-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.pp-dtr-tab').forEach(function (t) {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');

            const target = tab.getAttribute('data-tab');
            document.getElementById('panelBiometric').classList.toggle('active', target === 'biometric');
            document.getElementById('panelTeaching').classList.toggle('active', target === 'teaching');
        });
    });


    /* ================================================================
       BIOMETRIC RECORDS PANEL
       ================================================================ */

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

    function teachingPresent(emp, rec) {
        if (emp.type !== 'Faculty' || !emp.scheduleStart || !emp.scheduleEnd) return null;
        if (!rec.timeIn || !rec.timeOut) return false;
        const inMin = parseTime(rec.timeIn);
        const outMin = parseTime(rec.timeOut);
        const schedStart = parseTime(emp.scheduleStart);
        const schedEnd = parseTime(emp.scheduleEnd);
        return inMin <= schedStart + GRACE_MINUTES && outMin >= schedEnd - 15;
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

    let selectedStatus = null; // set by clicking a summary card: 'present' | 'late' | 'absent' | null

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
                if (selectedStatus && row.record.status !== selectedStatus) return false;
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

        document.querySelectorAll('.pp-summary-card[data-status]').forEach(function (card) {
            const active = card.dataset.status === selectedStatus;
            card.classList.toggle('is-active', active);
            card.setAttribute('aria-pressed', String(active));
        });

        const clearGroup = document.getElementById('statusFilterClearGroup');
        const clearLabel = document.getElementById('statusFilterClearLabel');
        if (selectedStatus) {
            clearGroup.classList.remove('d-none');
            clearLabel.textContent = 'Showing: ' + selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1);
        } else {
            clearGroup.classList.add('d-none');
        }
    }

    document.querySelectorAll('.pp-summary-card[data-status]').forEach(function (card) {
        function toggleStatus() {
            selectedStatus = selectedStatus === card.dataset.status ? null : card.dataset.status;
            renderTable();
        }
        card.addEventListener('click', toggleStatus);
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleStatus();
            }
        });
    });

    document.getElementById('statusFilterClearBtn').addEventListener('click', function () {
        selectedStatus = null;
        renderTable();
    });

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


    /* ================================================================
       SYNC NOW (real biometric device sync)
       ================================================================ */

    const syncNowBtn = document.getElementById('syncNowBtn');
    const scannerStatus = document.getElementById('scannerStatus');
    const scannerLastSync = document.getElementById('scannerLastSync');
    const syncLastLabel = document.getElementById('syncLastLabel');

    function formatNowLabel() {
        return new Date().toLocaleString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    syncNowBtn.addEventListener('click', function () {
        const originalText = syncNowBtn.innerHTML;
        syncNowBtn.disabled = true;
        syncNowBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Syncing...';

        fetch('api/fingerprint-sync.php')
            .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
            .then(function (result) {
                syncNowBtn.disabled = false;
                syncNowBtn.innerHTML = originalText;

                if (result.ok && result.data.success) {
                    const now = formatNowLabel();
                    scannerStatus.classList.remove('pp-device-status-disconnected');
                    scannerStatus.classList.add('pp-device-status-connected');
                    scannerStatus.innerHTML = '<span class="pp-device-dot"></span> Connected';
                    scannerLastSync.textContent = 'Last synchronization: Today, ' + now;
                    syncLastLabel.textContent = 'Last synced: ' + now;
                    PPToast.success(
                        'Synced ' + result.data.total_logs_from_device + ' log(s) from the device — ' +
                        result.data.inserted + ' new, ' +
                        result.data.skipped_no_matching_employee + ' unmatched.'
                    );
                } else {
                    scannerStatus.classList.remove('pp-device-status-connected');
                    scannerStatus.classList.add('pp-device-status-disconnected');
                    scannerStatus.innerHTML = '<span class="pp-device-dot"></span> Disconnected';
                    PPToast.error(result.data.message || 'Device sync failed.');
                }
            })
            .catch(function (error) {
                syncNowBtn.disabled = false;
                syncNowBtn.innerHTML = originalText;
                scannerStatus.classList.remove('pp-device-status-connected');
                scannerStatus.classList.add('pp-device-status-disconnected');
                scannerStatus.innerHTML = '<span class="pp-device-dot"></span> Disconnected';
                PPToast.error('Could not reach the sync endpoint. Is the PHP backend running?');
                console.error('[Biometric Sync]', error);
            });
    });


    /* ================================================================
       FACULTY TEACHING HOURS — SCHEDULE
       ================================================================ */

    const addScheduleBtn = document.getElementById('addScheduleBtn');
    const scheduleModalEl = document.getElementById('scheduleModal');
    const scheduleModal = new bootstrap.Modal(scheduleModalEl);
    const scheduleForm = document.getElementById('scheduleForm');
    const scheduleFaculty = document.getElementById('scheduleFaculty');
    const gridEditBody = document.getElementById('gridEditBody');
    const scheduleModalTitle = document.getElementById('scheduleModalTitle');

    const scheduleFacultySearch = document.getElementById('scheduleFacultySearch');
    const scheduleFacultyList = document.getElementById('scheduleFacultyList');
    const scheduleDetailEmpty = document.getElementById('scheduleDetailEmpty');
    const scheduleDetailContent = document.getElementById('scheduleDetailContent');
    const scheduleDetailName = document.getElementById('scheduleDetailName');
    const scheduleDetailMeta = document.getElementById('scheduleDetailMeta');
    const scheduleDetailBody = document.getElementById('scheduleDetailBody');
    const scheduleDetailNoSchedule = document.getElementById('scheduleDetailNoSchedule');
    const editScheduleBtn = document.getElementById('editScheduleBtn');
    const deleteScheduleBtn = document.getElementById('deleteScheduleBtn');

    const DAY_COLUMNS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const GRID_START_HOUR = 7;
    const GRID_END_HOUR = 20; // 7:00 AM – 8:00 PM

    let selectedScheduleFacultyId = null;

    function populateFacultySelects() {
        const options = facultyEmployees.map(function (e) {
            return '<option value="' + e.id + '">' + e.displayName + '</option>';
        }).join('');
        scheduleFaculty.innerHTML = options;

        document.getElementById('facultyDatalist').innerHTML = facultyEmployees.map(function (e) {
            return '<option value="' + e.displayName + ' (' + e.id + ')"></option>';
        }).join('');
    }

    function facultyName(employeeId) {
        const emp = employees.find(function (e) { return e.id === employeeId; });
        return emp ? emp.displayName : employeeId;
    }

    function initials(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '--';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function hourLabel12(h) {
        var hh = h % 12;
        if (hh === 0) hh = 12;
        return (hh < 10 ? '0' + hh : String(hh));
    }

    function rowLabel(hour) {
        return hourLabel12(hour) + ':00 - ' + hourLabel12(hour + 1) + ':00';
    }

    function formatTimeRange(start, end) {
        return formatTime12(start) + ' – ' + formatTime12(end);
    }

    function schedulesForFaculty(employeeId) {
        return schedules.filter(function (s) { return s.employeeId === employeeId; });
    }

    // ---- Faculty list (searchable) ----

    function renderScheduleFacultyList() {
        const q = scheduleFacultySearch.value.trim().toLowerCase();
        const filtered = facultyEmployees.filter(function (e) {
            return !q || e.displayName.toLowerCase().includes(q);
        });

        if (!filtered.length) {
            scheduleFacultyList.innerHTML = '<div class="pp-empty-state">No faculty match your search.</div>';
            return;
        }

        scheduleFacultyList.innerHTML = filtered.map(function (e) {
            const active = e.id === selectedScheduleFacultyId ? ' active' : '';
            const count = schedulesForFaculty(e.id).length;
            return (
                '<div class="pp-employee-item' + active + '" role="option" aria-selected="' + (active ? 'true' : 'false') + '" data-id="' + e.id + '" tabindex="0">' +
                    '<div class="pp-avatar" aria-hidden="true">' + initials(e.displayName) + '</div>' +
                    '<div class="flex-grow-1 min-width-0">' +
                        '<div class="pp-employee-name text-truncate">' + e.displayName + '</div>' +
                        '<div class="pp-employee-id">' + count + ' course' + (count === 1 ? '' : 's') + ' scheduled</div>' +
                    '</div>' +
                '</div>'
            );
        }).join('');

        scheduleFacultyList.querySelectorAll('.pp-employee-item').forEach(function (el) {
            el.addEventListener('click', function () { selectScheduleFaculty(el.dataset.id); });
            el.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectScheduleFaculty(el.dataset.id);
                }
            });
        });
    }

    scheduleFacultySearch.addEventListener('input', renderScheduleFacultyList);

    // ---- Selected faculty's weekly schedule (time grid) ----

    function selectScheduleFaculty(employeeId) {
        selectedScheduleFacultyId = employeeId;
        renderScheduleFacultyList();
        renderScheduleDetail();
    }

    function renderScheduleDetail() {
        if (!selectedScheduleFacultyId) {
            scheduleDetailEmpty.classList.remove('d-none');
            scheduleDetailContent.classList.add('d-none');
            return;
        }

        scheduleDetailEmpty.classList.add('d-none');
        scheduleDetailContent.classList.remove('d-none');

        const emp = employees.find(function (e) { return e.id === selectedScheduleFacultyId; });
        const entries = schedulesForFaculty(selectedScheduleFacultyId);

        scheduleDetailName.textContent = emp ? emp.displayName : selectedScheduleFacultyId;
        scheduleDetailMeta.textContent = entries.length + ' course' + (entries.length === 1 ? '' : 's') + ' scheduled this term';

        if (!entries.length) {
            scheduleDetailBody.innerHTML = '';
            scheduleDetailNoSchedule.classList.remove('d-none');
            return;
        }
        scheduleDetailNoSchedule.classList.add('d-none');

        let rows = '';
        for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
            const rowStartMin = h * 60;
            const rowEndMin = (h + 1) * 60;

            const cells = DAY_COLUMNS.map(function (d) {
                const match = entries.find(function (s) {
                    return s.days.indexOf(d) !== -1 && parseTime(s.timeStart) < rowEndMin && parseTime(s.timeEnd) > rowStartMin;
                });
                return '<td class="pp-grid-cell' + (match ? ' is-scheduled' : '') + '">' + (match ? match.subject : '') + '</td>';
            }).join('');

            rows += '<tr><td class="pp-grid-time-col">' + rowLabel(h) + '</td>' + cells + '</tr>';
        }

        scheduleDetailBody.innerHTML = rows;
    }

    editScheduleBtn.addEventListener('click', function () {
        if (selectedScheduleFacultyId) openScheduleModal(selectedScheduleFacultyId);
    });

    deleteScheduleBtn.addEventListener('click', function () {
        if (!selectedScheduleFacultyId) return;
        const name = facultyName(selectedScheduleFacultyId);

        ConfirmModal.show({
            title: 'Delete Teaching Schedule',
            message: 'Delete the entire weekly teaching schedule for ' + name + '? This does not affect attendance already logged, and cannot be undone.',
            confirmText: 'Delete Schedule',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            schedules = schedules.filter(function (s) { return s.employeeId !== selectedScheduleFacultyId; });
            persistSchedules();
            renderScheduleFacultyList();
            renderScheduleDetail();
            PPToast.success('Teaching schedule deleted for ' + name + '.');
        });
    });

    // ---- Add/Edit modal (grid entry) ----

    function openScheduleModal(employeeId) {
        const targetId = employeeId || selectedScheduleFacultyId || (facultyEmployees[0] && facultyEmployees[0].id);
        if (!targetId) return;

        scheduleModalTitle.textContent = schedulesForFaculty(targetId).length ? 'Edit Teaching Schedule' : 'Add Teaching Schedule';
        scheduleFaculty.value = targetId;
        populateGridEditor(targetId);
        scheduleModal.show();
    }

    function populateGridEditor(employeeId) {
        const entries = schedulesForFaculty(employeeId);
        let rows = '';

        for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
            const rowStartMin = h * 60;
            const rowEndMin = (h + 1) * 60;

            const cells = DAY_COLUMNS.map(function (d) {
                const match = entries.find(function (s) {
                    return s.days.indexOf(d) !== -1 && parseTime(s.timeStart) < rowEndMin && parseTime(s.timeEnd) > rowStartMin;
                });
                return (
                    '<td class="p-1">' +
                        '<input type="text" class="form-control pp-form-control form-control-sm grid-cell-input" ' +
                        'data-hour="' + h + '" data-day="' + d + '" value="' + (match ? match.subject : '') + '">' +
                    '</td>'
                );
            }).join('');

            rows += '<tr><td class="pp-grid-time-col">' + rowLabel(h) + '</td>' + cells + '</tr>';
        }

        gridEditBody.innerHTML = rows;
    }

    scheduleFaculty.addEventListener('change', function () {
        populateGridEditor(scheduleFaculty.value);
    });

    /**
     * Reads every grid-cell input and, for each day column, merges
     * consecutive hours with the same (non-empty) course name into one
     * schedule block — typing "Data Structures" into two hours in a row
     * produces one 2-hour block, not two separate ones.
     */
    function readGridAsSchedules(employeeId) {
        const inputs = Array.prototype.slice.call(gridEditBody.querySelectorAll('.grid-cell-input'));
        const runs = [];

        DAY_COLUMNS.forEach(function (d) {
            const dayInputs = inputs
                .filter(function (el) { return el.dataset.day === d; })
                .sort(function (a, b) { return Number(a.dataset.hour) - Number(b.dataset.hour); });

            let currentRun = null;

            dayInputs.forEach(function (el) {
                const value = el.value.trim();
                const hour = Number(el.dataset.hour);

                if (value && currentRun && currentRun.subject === value && currentRun.endHour === hour) {
                    currentRun.endHour = hour + 1;
                } else {
                    if (currentRun) runs.push(currentRun);
                    currentRun = value ? { subject: value, days: [d], startHour: hour, endHour: hour + 1 } : null;
                }
            });
            if (currentRun) runs.push(currentRun);
        });

        return runs.map(function (run) {
            const pad = function (n) { return (n < 10 ? '0' : '') + n; };
            return {
                id: DataStore.nextNumericId(schedules),
                employeeId: employeeId,
                subject: run.subject,
                days: run.days,
                timeStart: pad(run.startHour) + ':00',
                timeEnd: pad(run.endHour) + ':00'
            };
        });
    }

    addScheduleBtn.addEventListener('click', function () {
        openScheduleModal(selectedScheduleFacultyId);
    });

    scheduleForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const employeeId = scheduleFaculty.value;
        const newEntries = readGridAsSchedules(employeeId);

        // Replace this faculty member's whole week with what's now in the grid.
        schedules = schedules.filter(function (s) { return s.employeeId !== employeeId; }).concat(newEntries);
        persistSchedules();

        scheduleModal.hide();
        selectedScheduleFacultyId = employeeId;
        renderScheduleFacultyList();
        renderScheduleDetail();
        PPToast.success('Teaching schedule saved for ' + facultyName(employeeId) + '.');
    });


    /* ================================================================
       FACULTY TEACHING HOURS — ATTENDANCE
       ================================================================ */

    const teachingForm = document.getElementById('teachingAttendanceForm');
    const teachingFacultySearch = document.getElementById('teachingFacultySearch');
    const teachingFaculty = document.getElementById('teachingFaculty');
    const teachingFacultyError = document.getElementById('teachingFacultyError');
    const teachingDate = document.getElementById('teachingDate');
    const teachingTimeIn = document.getElementById('teachingTimeIn');
    const teachingTimeOut = document.getElementById('teachingTimeOut');
    const teachingScheduleHint = document.getElementById('teachingScheduleHint');
    const teachingAttendanceBody = document.getElementById('teachingAttendanceBody');
    const teachingAttendanceEmpty = document.getElementById('teachingAttendanceEmpty');

    teachingDate.value = today;
    teachingDate.max = today;

    function resolveFacultyFromSearch(value) {
        const match = value.match(/\(([^)]+)\)\s*$/);
        if (match) {
            return facultyEmployees.find(function (e) { return e.id === match[1]; });
        }
        return facultyEmployees.find(function (e) {
            return e.displayName.toLowerCase() === value.toLowerCase();
        });
    }

    function scheduleForFaculty(employeeId) {
        return schedules.find(function (s) { return s.employeeId === employeeId; });
    }

    function updateScheduleHint() {
        const emp = resolveFacultyFromSearch(teachingFacultySearch.value);
        teachingFaculty.value = emp ? emp.id : '';

        if (!emp) {
            teachingScheduleHint.innerHTML = '';
            return;
        }

        const schedule = scheduleForFaculty(emp.id);
        if (!schedule) {
            teachingScheduleHint.innerHTML = '<span class="text-muted small"><i class="bi bi-info-circle me-1"></i>No teaching schedule set for this faculty member yet.</span>';
            return;
        }
        const dayPills = schedule.days.map(function (d) { return '<span class="pp-day-pill">' + d + '</span>'; }).join(' ');
        teachingScheduleHint.innerHTML =
            '<span class="text-muted small"><i class="bi bi-calendar-check me-1"></i>Scheduled: ' + dayPills +
            ' &nbsp;' + formatTimeRange(schedule.timeStart, schedule.timeEnd) + ' — ' + schedule.subject + '</span>';
    }

    teachingFacultySearch.addEventListener('input', function () {
        teachingFacultySearch.classList.remove('is-invalid');
        teachingFacultyError.classList.add('d-none');
        updateScheduleHint();
    });

    function renderTeachingAttendance() {
        const facultyIds = facultyEmployees.map(function (e) { return e.id; });
        const rows = records
            .filter(function (r) { return r.manual && facultyIds.indexOf(r.employeeId) !== -1; })
            .sort(function (a, b) { return b.date.localeCompare(a.date); });

        if (!rows.length) {
            teachingAttendanceBody.innerHTML = '';
            teachingAttendanceEmpty.classList.remove('d-none');
            return;
        }
        teachingAttendanceEmpty.classList.add('d-none');
        teachingAttendanceBody.innerHTML = rows.map(function (r) {
            return (
                '<tr>' +
                    '<td><strong>' + facultyName(r.employeeId) + '</strong></td>' +
                    '<td>' + r.date + '</td>' +
                    '<td class="col-time">' + formatTime12(r.timeIn) + '</td>' +
                    '<td class="col-time">' + formatTime12(r.timeOut) + '</td>' +
                    '<td>' + statusBadge(r.status) + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    teachingForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const emp = resolveFacultyFromSearch(teachingFacultySearch.value);
        if (!emp) {
            teachingFacultySearch.classList.add('is-invalid');
            teachingFacultyError.classList.remove('d-none');
            teachingFacultySearch.focus();
            return;
        }
        teachingFacultySearch.classList.remove('is-invalid');
        teachingFacultyError.classList.add('d-none');
        teachingFaculty.value = emp.id;

        if (!teachingDate.value || !teachingTimeIn.value) {
            teachingForm.classList.add('was-validated');
            return;
        }
        teachingForm.classList.remove('was-validated');

        const employeeId = emp.id;
        const date = teachingDate.value;
        const timeIn = teachingTimeIn.value;
        const timeOut = teachingTimeOut.value || null;

        const schedule = scheduleForFaculty(employeeId);
        const scheduledStart = schedule ? schedule.timeStart : STANDARD_START;
        const status = deriveStatus(timeIn, scheduledStart);

        const existing = records.findIndex(function (r) { return r.employeeId === employeeId && r.date === date; });
        const entry = { employeeId: employeeId, date: date, timeIn: timeIn, timeOut: timeOut, status: status, manual: true, reason: 'Teaching hours encoded manually' };

        if (existing >= 0) {
            records[existing] = entry;
        } else {
            records.push(entry);
        }
        persistRecords();

        teachingForm.reset();
        teachingDate.value = today;
        teachingFaculty.value = '';
        teachingScheduleHint.innerHTML = '';
        renderTeachingAttendance();
        renderTable();
        PPToast.success('Teaching attendance logged for ' + facultyName(employeeId) + '.');
    });


    /* ================================================================
       INIT
       ================================================================ */

    populateDatalist();
    populateFacultySelects();
    renderTable();
    renderScheduleFacultyList();
    renderScheduleDetail();
    renderTeachingAttendance();
    updateScheduleHint();
})();
