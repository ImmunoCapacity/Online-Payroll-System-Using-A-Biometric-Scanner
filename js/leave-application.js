/**
 * Leave Management — recorded leave in the database (api/leave).
 *
 * Leave is approved outside the system; the Payroll Master only records
 * approved leave: employee, leave type, dates, paid or unpaid, and reason.
 * Clicking a row opens it for correction. Days are working days
 * (Monday–Friday). Paid leave of a type that uses credits draws on the
 * employee's yearly leave credits (15 by default, editable here); the server
 * refuses leave beyond the remaining balance. Paid leave is included in payroll.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'leave',
        navMode: 'master',
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    var requests = [];
    var categories = [];
    var employees = [];
    var editingId = null;
    var paidChosen = false;   // the user picked Paid/Unpaid; don't override it from the leave type

    var el = function (id) { return document.getElementById(id); };
    var leaveModal = new bootstrap.Modal(el('leaveModal'));
    var leaveForm = el('leaveForm');

    var SERVER_FIELDS = {
        employeeId: 'leaveEmployee',
        categoryId: 'leaveCategory',
        dateFrom: 'leaveFrom',
        dateTo: 'leaveTo',
        reason: 'leaveReason',
        paid: 'leavePaid'
    };

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function api(url, method, body) {
        return fetch(url, {
            method: method || 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) { return r.json(); });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function formatDate(text) {
        if (!text) return '—';
        return parseIso(text.slice(0, 10)).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /** "Oct 19, 2026", "Oct 19 – 21, 2026" or "Oct 27 – Nov 4, 2026". */
    function dateRange(from, to) {
        if (!to || to === from) return formatDate(from);
        var a = parseIso(from);
        var b = parseIso(to);
        var month = function (d) { return d.toLocaleDateString('en-PH', { month: 'short' }); };
        if (a.getFullYear() !== b.getFullYear()) return formatDate(from) + ' – ' + formatDate(to);
        if (a.getMonth() === b.getMonth()) return month(a) + ' ' + a.getDate() + ' – ' + b.getDate() + ', ' + b.getFullYear();
        return month(a) + ' ' + a.getDate() + ' – ' + month(b) + ' ' + b.getDate() + ', ' + b.getFullYear();
    }

    /** Monday–Friday days from one date to another, inclusive (same rule as the server). */
    function workdays(from, to) {
        if (!from || !to || to < from) return 0;
        var d = parseIso(from);
        var end = parseIso(to);
        var days = 0;
        while (d <= end) {
            if (d.getDay() !== 0 && d.getDay() !== 6) days++;
            d.setDate(d.getDate() + 1);
        }
        return days;
    }

    function payBadge(paid) {
        return '<span class="leave-badge ' + (paid ? 'paid' : 'unpaid') + '">' + (paid ? 'Paid' : 'Unpaid') + '</span>';
    }

    function categoryById(id) {
        return categories.find(function (c) { return c.id === Number(id); });
    }

    // ---------------------------------------------------------------
    // Loading and the list
    // ---------------------------------------------------------------

    function load() {
        return Promise.all([api('api/leave/requests'), api('api/leave/categories'), api('api/employees')])
            .then(function (results) {
                results.forEach(function (r) {
                    if (!r.success) throw new Error(r.message || 'Could not load leave data.');
                });
                requests = results[0].requests;
                categories = results[1].categories;
                employees = results[2].employees.filter(function (e) {
                    return ['Inactive', 'Resigned', 'Terminated'].indexOf(e.status) === -1;
                });
                fillFilters();
                render();
            })
            .catch(function (error) {
                el('leaveTableBody').innerHTML = '';
                el('leaveEmptyState').querySelector('span').textContent =
                    error.message || 'Could not load recorded leave. Is the backend running?';
                el('leaveEmptyState').classList.remove('d-none');
            });
    }

    function fillFilters() {
        var filter = el('leaveTypeFilter');
        var chosen = filter.value;
        filter.innerHTML = '<option value="All" hidden data-hint>All leave types</option>' +
            categories.map(function (c) {
                return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>';
            }).join('');
        filter.value = categories.some(function (c) { return c.name === chosen; }) ? chosen : 'All';
    }

    function render() {
        var search = el('leaveSearch').value.trim().toLowerCase();
        var type = el('leaveTypeFilter').value;
        var pay = el('leavePayFilter').value;
        var date = el('leaveDateFilter').value;

        var shown = requests.filter(function (r) {
            return (!search || (r.employeeName + ' ' + r.employeeNumber).toLowerCase().indexOf(search) !== -1) &&
                (type === 'All' || r.category === type) &&
                (pay === 'All' || (pay === 'paid') === !!r.paid) &&
                (!date || (date >= r.dateFrom && date <= r.dateTo));
        });

        el('leaveListCount').textContent = shown.length + (shown.length === 1 ? ' record' : ' records');
        if (!shown.length) {
            el('leaveTableBody').innerHTML = '';
            el('leaveEmptyState').querySelector('span').textContent = requests.length
                ? 'No recorded leave matches the filters.'
                : 'No leave recorded yet. Click Record Leave to add approved leave.';
            el('leaveEmptyState').classList.remove('d-none');
            return;
        }
        el('leaveEmptyState').classList.add('d-none');

        el('leaveTableBody').innerHTML = shown.map(function (r) {
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-id="' + r.id + '" ' +
                    'aria-label="Edit leave of ' + escapeHtml(r.employeeName) + '">' +
                '<td><strong>' + escapeHtml(r.employeeName) + '</strong>' +
                    '<span class="leave-sub">' + escapeHtml(r.employeeNumber) + ' · ' + escapeHtml(r.employeeType) + '</span></td>' +
                '<td>' + escapeHtml(r.category) + '</td>' +
                '<td>' + dateRange(r.dateFrom, r.dateTo) + '</td>' +
                '<td class="leave-days-cell">' + r.days + ' day' + (r.days === 1 ? '' : 's') + '</td>' +
                '<td>' + payBadge(r.paid) + '</td>' +
                '<td class="leave-filed-date">' + formatDate(r.reviewedAt || r.dateFiled) + '</td>' +
                '<td class="leave-reason-cell" title="' + escapeHtml(r.reason) + '">' + escapeHtml(r.reason) + '</td>' +
            '</tr>';
        }).join('');
    }

    // ---------------------------------------------------------------
    // Record / edit
    // ---------------------------------------------------------------

    function fillFormChoices(request) {
        el('leaveEmployee').innerHTML = '<option value="" selected hidden data-hint>Select employee</option>' +
            employees.map(function (e) {
                return '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.displayName) + ' — ' +
                    escapeHtml(e.employeeNumber) + ' (' + escapeHtml(e.department) + ')</option>';
            }).join('');
        el('leaveCategory').innerHTML = '<option value="" selected hidden data-hint>Select leave type</option>' +
            categories.filter(function (c) { return c.active || (request && c.id === request.categoryId); })
                .map(function (c) {
                    return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
                }).join('');
    }

    function openForm(request) {
        editingId = request ? request.id : null;
        paidChosen = !!request;
        leaveForm.reset();
        PPValidate.clear(leaveForm);
        fillFormChoices(request);
        el('leaveModalTitle').textContent = request ? 'Edit Recorded Leave' : 'Record Approved Leave';
        el('leaveEmployee').disabled = !!request;
        el('leaveRecordedNote').textContent = request && request.reviewedBy
            ? 'Recorded by ' + request.reviewedBy + ' · ' + formatDate(request.reviewedAt)
            : '';
        if (request) {
            if (!el('leaveEmployee').querySelector('option[value="' + request.employeeId + '"]')) {
                el('leaveEmployee').insertAdjacentHTML('beforeend',
                    '<option value="' + escapeHtml(request.employeeId) + '">' + escapeHtml(request.employeeName) + '</option>');
            }
            el('leaveEmployee').value = request.employeeId;
            el('leaveCategory').value = request.categoryId;
            el('leaveFrom').value = request.dateFrom;
            el('leaveTo').value = request.dateTo;
            el('leavePaid').value = request.paid ? 'true' : 'false';
            el('leaveReason').value = request.reason || '';
        }
        updateSummary();
        leaveModal.show();
    }

    var summaryToken = 0;

    /** Working days, pay and — for paid credit-based leave — the employee's balance. */
    function updateSummary() {
        var box = el('leaveSummary');
        var employeeId = el('leaveEmployee').value;
        var category = categoryById(el('leaveCategory').value);
        var from = el('leaveFrom').value;
        var to = el('leaveTo').value;
        var paid = el('leavePaid').value === 'true';
        box.classList.remove('is-warning');
        el('creditBox').classList.add('d-none');

        if (!employeeId || !category || !from || !to || to < from) {
            box.textContent = 'Choose an employee, leave type and dates.';
            return;
        }
        var days = workdays(from, to);
        var text = days + ' working day' + (days === 1 ? '' : 's') + ' (Monday–Friday) · ' +
            (paid ? 'Paid — included in payroll' : 'Unpaid — not paid in payroll');
        var warn = days === 0 || (category.maxDays && days > category.maxDays);
        if (category.maxDays && days > category.maxDays) {
            text += ' · more than the ' + category.maxDays + '-day maximum for ' + category.name;
        }
        box.textContent = text;
        box.classList.toggle('is-warning', !!warn);

        if (category.usesCredits && paid) {
            loadCredits(employeeId, Number(from.slice(0, 4)), days, ++summaryToken);
        }
    }

    /** Leave credits for the year, with an editor for the yearly total. */
    function loadCredits(employeeId, year, days, token) {
        var box = el('creditBox');
        box.classList.remove('d-none', 'is-warning');
        box.textContent = 'Checking leave credits…';
        api('api/leave/balance?employeeId=' + encodeURIComponent(employeeId) + '&year=' + year).then(function (data) {
            if (token !== summaryToken || !data.success) return;
            var b = data.balance;
            // When editing, this leave's own days are already counted as used.
            var own = 0;
            if (editingId) {
                var r = requests.find(function (x) { return x.id === editingId; });
                if (r && r.paid && r.usesCredits && Number(r.dateFrom.slice(0, 4)) === year) own = r.days;
            }
            var remaining = b.remaining + own;
            var short = days > remaining;
            box.classList.toggle('is-warning', short);
            box.innerHTML =
                '<div class="d-flex flex-wrap align-items-end gap-3">' +
                    '<div>Leave credits ' + year + ': ' + remaining + ' of ' + b.total + ' left' +
                        (short ? '<br><strong class="text-danger">Not enough credits. Record it as unpaid, or raise the credits.</strong>' : '') +
                    '</div>' +
                    '<div class="d-flex align-items-end gap-2 ms-auto">' +
                        '<div><label for="creditTotal" class="pp-form-label mb-1">Credits for ' + year + '</label>' +
                        '<input type="number" class="form-control pp-form-control" id="creditTotal" style="width:7rem" ' +
                            'min="0" max="365" step="1" value="' + b.total + '"></div>' +
                        '<button type="button" class="btn btn-pp-outline" id="saveCreditsBtn">Save</button>' +
                    '</div>' +
                '</div>';
            el('saveCreditsBtn').addEventListener('click', function () {
                var total = el('creditTotal').value.trim();
                if (!/^\d+$/.test(total)) {
                    PPValidate.setError(el('creditTotal'), 'Enter a whole number of days.');
                    return;
                }
                api('api/leave/credits', 'PUT', { employeeId: employeeId, year: year, totalCredits: Number(total) })
                    .then(function (res) {
                        if (!res.success) {
                            PPValidate.setError(el('creditTotal'), res.message || 'Could not save the credits.');
                            return;
                        }
                        PPToast.success('Leave credits for ' + year + ' set to ' + res.balance.total + '.');
                        updateSummary();
                    });
            });
        });
    }

    el('leaveCategory').addEventListener('change', function () {
        // Default Paid/Unpaid from the leave type until the user picks one.
        var category = categoryById(el('leaveCategory').value);
        if (category && !paidChosen) el('leavePaid').value = category.paid ? 'true' : 'false';
    });
    el('leavePaid').addEventListener('change', function () { paidChosen = true; });

    ['leaveEmployee', 'leaveCategory', 'leaveFrom', 'leaveTo', 'leavePaid'].forEach(function (id) {
        el(id).addEventListener('change', updateSummary);
    });

    leaveForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!PPValidate.validateForm(leaveForm)) return;
        var payload = {
            employeeId: el('leaveEmployee').value,
            categoryId: Number(el('leaveCategory').value),
            dateFrom: el('leaveFrom').value,
            dateTo: el('leaveTo').value,
            paid: el('leavePaid').value === 'true',
            reason: el('leaveReason').value.trim()
        };
        var btn = el('saveLeaveBtn');
        btn.disabled = true;
        api(editingId ? 'api/leave/requests/' + editingId : 'api/leave/requests', editingId ? 'PUT' : 'POST', payload)
            .then(function (data) {
                btn.disabled = false;
                if (!data.success) {
                    if (!PPValidate.showServerError(leaveForm, data, SERVER_FIELDS)) PPToast.error(data.message || 'Could not save the leave.');
                    return;
                }
                leaveModal.hide();
                PPToast.success(editingId ? 'Leave updated.' : 'Leave recorded for ' + data.request.employeeName + '.');
                load();
            })
            .catch(function () {
                btn.disabled = false;
                PPToast.error('Could not reach the server.');
            });
    });

    // ---------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------

    function openRow(id) {
        var r = requests.find(function (x) { return x.id === id; });
        if (r) openForm(r);
    }

    el('recordLeaveBtn').addEventListener('click', function () { openForm(null); });
    el('leaveSearch').addEventListener('input', render);
    ['leaveTypeFilter', 'leavePayFilter', 'leaveDateFilter'].forEach(function (id) {
        el(id).addEventListener('change', render);
    });
    el('leaveTableBody').addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-id]');
        if (row) openRow(Number(row.dataset.id));
    });
    el('leaveTableBody').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
            e.preventDefault();
            openRow(Number(e.target.dataset.id));
        }
    });

    load();
})();
