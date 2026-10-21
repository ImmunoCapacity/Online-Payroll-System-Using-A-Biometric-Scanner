/**
 * Loan Management (api/employees, api/loans).
 *
 *   1. Employees: one row per employee with their active loans, what is
 *      deducted every payroll and the remaining balance.
 *   2. Click an employee: their loans, with Add Loan.
 *   3. Click a loan: its details and deduction history (skipped periods too).
 *
 * Add Loan takes the lender, reference, amount and payment period (first and
 * last payroll period); the deduction per payroll is the amount spread over
 * those periods, the last one taking the leftover centavos (worked out again
 * by the server). Payroll Computation deducts it every period; when the pay
 * isn't enough, it is skipped and flagged, and the loan runs one period longer.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'loans',
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var el = function (id) { return document.getElementById(id); };
    var employees = [];     // { id, number, name, type, status }
    var loans = [];
    var currentEmployeeId = null;
    var currentLoanId = null;

    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function api(url, options) {
        return fetch(url, options).then(function (r) { return r.json(); });
    }

    function peso(value) {
        return '₱' + (Number(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function initials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '--';
        return (parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
    }

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    /** Payroll periods start on the 11th (to the 25th) or the 26th (to the 10th). */
    function periodStartOn(date) {
        return date.getDate() >= 26 ? new Date(date.getFullYear(), date.getMonth(), 26)
            : date.getDate() >= 11 ? new Date(date.getFullYear(), date.getMonth(), 11)
            : new Date(date.getFullYear(), date.getMonth() - 1, 26);
    }

    function nextPeriod(start) {
        return start.getDate() === 11
            ? new Date(start.getFullYear(), start.getMonth(), 26)
            : new Date(start.getFullYear(), start.getMonth() + 1, 11);
    }

    function periodLabel(start) {
        var end = start.getDate() === 11
            ? new Date(start.getFullYear(), start.getMonth(), 25)
            : new Date(start.getFullYear(), start.getMonth() + 1, 10);
        return MONTHS[start.getMonth()].slice(0, 3) + ' ' + start.getDate() +
            (start.getFullYear() === end.getFullYear() ? '' : ', ' + start.getFullYear()) +
            ' – ' + MONTHS[end.getMonth()].slice(0, 3) + ' ' + end.getDate() + ', ' + end.getFullYear();
    }

    function isOpen(loan) {
        return loan.status !== 'Paid';
    }

    function loansOf(employeeId) {
        return loans.filter(function (l) { return l.employeeKey === employeeId; });
    }

    function statusBadge(loan) {
        var badge = loan.status === 'Paid'
            ? '<span class="loan-status loan-status-paid">Fully paid</span>'
            : loan.status === 'Upcoming'
                ? '<span class="loan-status loan-status-upcoming">Starts ' + escapeHtml(formatDate(loan.startDate).replace(/, \d{4}$/, '')) + '</span>'
                : '<span class="loan-status loan-status-active">Active</span>';
        if (loan.skippedPeriods) {
            badge += ' <span class="loan-status loan-status-skipped" title="Pay wasn\'t enough in ' + loan.skippedPeriods +
                ' period' + (loan.skippedPeriods === 1 ? '' : 's') + '">Skipped ' + loan.skippedPeriods + '×</span>';
        }
        return badge;
    }

    // ---------------------------------------------------------------
    // Loading
    // ---------------------------------------------------------------

    function loadData() {
        return Promise.all([api('api/employees'), api('api/loans')]).then(function (results) {
            if (!results[0].success) throw new Error(results[0].message || 'Could not load employees.');
            if (!results[1].success) throw new Error(results[1].message || 'Could not load loans.');
            loans = results[1].loans;
            var withLoans = {};
            loans.forEach(function (l) { withLoans[l.employeeKey] = true; });
            // Current employees, and anyone else who still has a loan on record.
            employees = results[0].employees
                .filter(function (e) {
                    return ['Inactive', 'Resigned', 'Terminated'].indexOf(e.status) === -1 || withLoans[e.id];
                })
                .map(function (e) {
                    return { id: e.id, number: e.employeeNumber, name: e.displayName, type: e.department, status: e.status };
                })
                .sort(function (a, b) { return a.name.localeCompare(b.name); });
            populateEmployeeSelect();
            renderEmployees();
            if (currentEmployeeId && !el('employeeLoansView').classList.contains('d-none')) showEmployee(currentEmployeeId);
            if (currentLoanId && !el('loanDetailsView').classList.contains('d-none')) showLoan(currentLoanId);
        }).catch(function (error) {
            el('loanTableBody').innerHTML = '';
            el('loanEmptyState').textContent = error.message || 'Could not reach the server.';
            el('loanEmptyState').classList.remove('d-none');
        });
    }

    // ---------------------------------------------------------------
    // 1. Employees
    // ---------------------------------------------------------------

    function summary(employeeId) {
        var list = loansOf(employeeId);
        var open = list.filter(isOpen);
        return {
            active: open.length,
            // What payroll deducts now: loans that have started.
            perPayroll: open.filter(function (l) { return l.status === 'Active'; })
                .reduce(function (s, l) { return s + Number(l.deductionPerPayroll || 0); }, 0),
            paid: list.reduce(function (s, l) { return s + Number(l.totalDeducted || 0); }, 0),
            remaining: open.reduce(function (s, l) { return s + Number(l.remainingBalance || 0); }, 0),
            skipped: open.some(function (l) { return l.skippedPeriods > 0; })
        };
    }

    function renderEmployees() {
        var search = el('loanSearch').value.trim().toLowerCase();
        var type = el('loanTypeFilter').value;
        var show = el('loanStatusFilter').value;

        var rows = employees.filter(function (e) {
            var s = summary(e.id);
            return (!search || (e.name + ' ' + e.number).toLowerCase().indexOf(search) !== -1) &&
                (type === 'all' || e.type === type) &&
                (show === 'all' || (show === 'with' && s.active) || (show === 'none' && !s.active) || (show === 'skipped' && s.skipped));
        });

        el('loanEmptyState').classList.toggle('d-none', rows.length > 0);
        el('loanEmptyState').textContent = 'No employees match the filters.';
        el('loanTableBody').innerHTML = rows.map(function (e) {
            var s = summary(e.id);
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(e.id) + '" ' +
                    'aria-label="Loans of ' + escapeHtml(e.name) + '">' +
                '<td>' + escapeHtml(e.number) + '</td>' +
                '<td><strong>' + escapeHtml(e.name) + '</strong>' +
                    (s.skipped ? ' <span class="loan-status loan-status-skipped" title="A loan deduction was skipped because the pay wasn\'t enough">Skipped</span>' : '') +
                '</td>' +
                '<td>' + escapeHtml(e.type) + '</td>' +
                '<td class="text-end">' + s.active + '</td>' +
                '<td class="text-end loan-money">' + (s.perPayroll ? peso(s.perPayroll) : '—') + '</td>' +
                '<td class="text-end loan-balance">' + (s.remaining ? peso(s.remaining) : '—') + '</td>' +
            '</tr>';
        }).join('');
    }

    ['loanSearch'].forEach(function (id) { el(id).addEventListener('input', renderEmployees); });
    ['loanTypeFilter', 'loanStatusFilter'].forEach(function (id) { el(id).addEventListener('change', renderEmployees); });

    el('loanTableBody').addEventListener('click', function (event) {
        var row = event.target.closest('[data-employee]');
        if (row) showEmployee(row.dataset.employee);
    });

    // ---------------------------------------------------------------
    // 2. One employee's loans
    // ---------------------------------------------------------------

    function showView(id) {
        ['loanManagementView', 'employeeLoansView', 'loanDetailsView'].forEach(function (v) {
            el(v).classList.toggle('d-none', v !== id);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showEmployee(employeeId) {
        var e = employees.find(function (x) { return x.id === employeeId; });
        if (!e) return;
        currentEmployeeId = employeeId;
        currentLoanId = null;
        var s = summary(employeeId);
        el('empInitials').textContent = initials(e.name);
        el('empName').textContent = e.name;
        el('empMeta').textContent = e.number + ' · ' + e.type + (e.status && e.status !== 'Active' ? ' · ' + e.status : '');
        el('empActiveCount').textContent = s.active;
        el('empPerPayroll').textContent = peso(s.perPayroll);
        el('empPaid').textContent = peso(s.paid);
        el('empRemaining').textContent = peso(s.remaining);

        var list = loansOf(employeeId).sort(function (a, b) {
            return (isOpen(b) - isOpen(a)) || String(b.startDate).localeCompare(String(a.startDate));
        });
        el('empLoansEmpty').classList.toggle('d-none', list.length > 0);
        el('empLoansBody').innerHTML = list.map(function (l) {
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-loan-id="' + l.id + '" aria-label="Loan ' + escapeHtml(l.reference) + '">' +
                '<td><strong>' + escapeHtml(l.lenderLabel || l.type) + '</strong></td>' +
                '<td>' + escapeHtml(l.reference) + '</td>' +
                '<td class="text-end loan-money">' + peso(l.amount) + '</td>' +
                '<td>' + escapeHtml(l.startPeriodLabel) + '<br><span class="text-muted small">to ' + escapeHtml(l.endPeriodLabel) + '</span></td>' +
                '<td class="text-end">' + (l.periods || '—') + '</td>' +
                '<td class="text-end loan-money">' + peso(l.deductionPerPayroll) + '</td>' +
                '<td class="text-end loan-money">' + peso(l.totalDeducted) + '</td>' +
                '<td class="text-end loan-money"><strong>' + peso(l.remainingBalance) + '</strong></td>' +
                '<td>' + statusBadge(l) + '</td>' +
            '</tr>';
        }).join('');
        showView('employeeLoansView');
    }

    el('empLoansBody').addEventListener('click', function (event) {
        var row = event.target.closest('[data-loan-id]');
        if (row) showLoan(parseInt(row.dataset.loanId, 10));
    });

    el('backToEmployees').addEventListener('click', function () {
        currentEmployeeId = null;
        renderEmployees();
        showView('loanManagementView');
    });

    // ---------------------------------------------------------------
    // 3. One loan
    // ---------------------------------------------------------------

    function showLoan(loanId) {
        var loan = loans.find(function (l) { return l.id === loanId; });
        if (!loan) return;
        currentLoanId = loanId;
        el('backToEmployeeLoansLabel').textContent = 'Back to ' + loan.employeeName + '\'s loans';
        el('detailEmployeeInitials').textContent = initials(loan.employeeName);
        el('detailEmployeeName').textContent = loan.employeeName;
        el('detailEmployeeMeta').textContent = loan.employeeId + ' · ' + loan.employeeRole;
        el('detailLoanStatus').innerHTML = statusBadge(loan);
        el('detailLender').textContent = loan.lenderLabel || loan.type;
        el('detailReference').textContent = loan.reference;
        el('detailPeriod').textContent = loan.startPeriodLabel + ' to ' + loan.endPeriodLabel +
            (loan.periods ? ' (' + loan.periods + ' periods)' : '');
        el('detailDeduction').textContent = peso(loan.deductionPerPayroll);
        el('detailSkippedWrap').classList.toggle('d-none', !loan.skippedPeriods);
        el('detailSkipped').textContent = loan.skippedPeriods
            ? loan.skippedPeriods + ' (pay wasn\'t enough) — now expected to end ' + loan.expectedEndPeriodLabel
            : '';
        el('detailRemarksWrap').classList.toggle('d-none', !loan.remarks);
        el('detailRemarks').textContent = loan.remarks || '';
        el('detailLoanAmount').textContent = peso(loan.amount);
        el('detailTotalDeducted').textContent = peso(loan.totalDeducted);
        el('detailRemainingBalance').textContent = peso(loan.remainingBalance);

        var history = loan.deductionHistory || [];
        el('loanDeductionHistoryEmpty').classList.toggle('d-none', history.length > 0);
        el('loanDeductionHistoryBody').innerHTML = history.slice().reverse().map(function (h) {
            return '<tr' + (h.skipped ? ' class="loan-history-skipped"' : '') + '>' +
                '<td>' + escapeHtml(h.period) + '</td>' +
                '<td class="loan-money">' + (h.skipped
                    ? '<span class="loan-status loan-status-skipped">Skipped</span> <span class="text-muted small">pay wasn\'t enough</span>'
                    : peso(h.amount)) + '</td>' +
                '<td class="loan-money">' + peso(h.remainingBalance) + '</td>' +
                '<td>' + formatDate(h.dateProcessed) + '</td>' +
            '</tr>';
        }).join('');
        showView('loanDetailsView');
    }

    el('backToEmployeeLoans').addEventListener('click', function () {
        var loan = loans.find(function (l) { return l.id === currentLoanId; });
        if (loan) showEmployee(loan.employeeKey);
        else showView('loanManagementView');
    });

    // Rows are focusable: Enter or Space opens them like a click.
    ['loanTableBody', 'empLoansBody'].forEach(function (id) {
        el(id).addEventListener('keydown', function (event) {
            if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[tabindex]')) {
                event.preventDefault();
                event.target.click();
            }
        });
    });

    // ---------------------------------------------------------------
    // Add Loan
    // ---------------------------------------------------------------

    var form = el('recordLoanForm');
    var modal = bootstrap.Modal.getOrCreateInstance(el('recordLoanModal'));

    function populateEmployeeSelect() {
        el('loanEmployee').innerHTML = '<option value="" selected hidden data-hint>Select employee</option>' +
            employees.filter(function (e) { return ['Inactive', 'Resigned', 'Terminated'].indexOf(e.status) === -1; })
                .map(function (e) {
                    return '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.name) + ' — ' + escapeHtml(e.number) + '</option>';
                }).join('');
    }

    /** Payment From: two periods back (a loan already running) to two years ahead. */
    function populateStartPeriods() {
        var start = periodStartOn(new Date());
        for (var i = 0; i < 2; i++) start = periodStartOn(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1));
        var current = iso(periodStartOn(new Date()));
        var options = '<option value="" selected hidden data-hint>First payroll period</option>';
        for (var n = 0; n < 50; n++) {
            options += '<option value="' + iso(start) + '">' + periodLabel(start) + (iso(start) === current ? ' (current)' : '') + '</option>';
            start = nextPeriod(start);
        }
        el('loanStartPeriod').innerHTML = options;
    }

    /** Payment To: from Payment From up to 10 years (240 periods). */
    function populateEndPeriods() {
        var select = el('loanEndPeriod');
        var from = el('loanStartPeriod').value;
        var keep = select.value;
        if (!from) {
            select.innerHTML = '<option value="" selected hidden data-hint>Last payroll period</option>';
            select.disabled = true;
            return;
        }
        var start = parseIso(from);
        var options = '<option value="" hidden data-hint>Last payroll period</option>';
        for (var n = 1; n <= 240; n++) {
            options += '<option value="' + iso(start) + '" data-periods="' + n + '">' + periodLabel(start) +
                ' · ' + n + ' period' + (n === 1 ? '' : 's') + '</option>';
            start = nextPeriod(start);
        }
        select.innerHTML = options;
        select.disabled = false;
        select.value = keep && keep >= from ? keep : '';
    }

    /** Number of periods and the deduction per payroll, as the server works them out. */
    function updateComputed() {
        var amount = parseFloat(el('loanAmount').value);
        var option = el('loanEndPeriod').selectedOptions[0];
        var periods = option && option.dataset.periods ? parseInt(option.dataset.periods, 10) : 0;
        el('loanPeriods').value = periods || '—';
        if (!(amount > 0) || !periods) {
            el('loanPerPayroll').value = '—';
            el('loanPerPayrollHint').textContent = '';
            return;
        }
        var cents = Math.round(amount * 100);
        var per = Math.floor(cents / periods);
        var last = cents - per * (periods - 1);
        el('loanPerPayroll').value = peso(per / 100);
        el('loanPerPayrollHint').textContent = periods > 1 && last !== per
            ? peso(amount) + ' ÷ ' + periods + '; the last period deducts ' + peso(last / 100) + '.'
            : peso(amount) + ' ÷ ' + periods + '.';
    }

    function updateLenderName() {
        var lender = el('loanLender').value;
        var named = lender === 'Bank' || lender === 'Cooperative' || lender === 'Other';
        el('loanLenderNameGroup').classList.toggle('d-none', !named);
        el('loanLenderNameLabel').textContent = lender === 'Bank' ? 'Bank Name' : lender === 'Cooperative' ? 'Cooperative Name' : 'Lender Name';
        el('loanLenderName').placeholder = lender === 'Bank' ? 'e.g. BDO' : lender === 'Cooperative' ? 'e.g. STI Employees Cooperative' : 'e.g. company cash advance';
    }

    function openAddLoan(employeeId) {
        form.reset();
        PPValidate.clear(form);
        el('loanEmployeeGroup').classList.toggle('d-none', !!employeeId);
        el('loanEmployee').value = employeeId || '';
        var e = employees.find(function (x) { return x.id === employeeId; });
        el('recordLoanTitle').textContent = e ? 'Add Loan — ' + e.name : 'Add Loan';
        updateLenderName();
        populateEndPeriods();
        updateComputed();
        modal.show();
    }

    el('btnAddLoan').addEventListener('click', function () { openAddLoan(currentEmployeeId); });
    el('btnAddLoanAny').addEventListener('click', function () { openAddLoan(null); });
    el('loanLender').addEventListener('change', updateLenderName);
    el('loanStartPeriod').addEventListener('change', function () { populateEndPeriods(); updateComputed(); });
    el('loanEndPeriod').addEventListener('change', updateComputed);
    el('loanAmount').addEventListener('input', updateComputed);

    el('loanReference').ppValidator = function (value) {
        if (!/^[A-Za-z0-9][A-Za-z0-9\/-]*$/.test(value)) {
            return 'Reference number can only contain letters, digits, hyphens (-) and slashes (/).';
        }
        var taken = loans.some(function (l) { return String(l.reference).toLowerCase() === value.toLowerCase(); });
        return taken ? 'A loan with this reference number already exists.' : '';
    };

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!PPValidate.validateForm(form)) return;

        var employeeId = el('loanEmployee').value;
        var employee = employees.find(function (e) { return e.id === employeeId; });
        if (!employee) return;
        var lender = el('loanLender').value;
        var submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;

        api('api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId: employeeId,
                lender: lender,
                lenderName: el('loanLenderNameGroup').classList.contains('d-none') ? null : el('loanLenderName').value.trim(),
                reference: el('loanReference').value.trim(),
                amount: parseFloat(el('loanAmount').value),
                startDate: el('loanStartPeriod').value,
                endDate: el('loanEndPeriod').value,
                remarks: el('loanRemarks').value.trim()
            })
        }).then(function (data) {
            submit.disabled = false;
            if (!data.success) {
                var fields = {
                    employeeId: 'loanEmployee', lender: 'loanLender', lenderName: 'loanLenderName', reference: 'loanReference',
                    amount: 'loanAmount', startDate: 'loanStartPeriod', endDate: 'loanEndPeriod', remarks: 'loanRemarks'
                };
                if (!PPValidate.showServerError(form, data, fields)) PPToast.error(data.message || 'Could not save the loan.');
                return;
            }
            modal.hide();
            PPToast.success('Loan saved for ' + employee.name + ': ' + peso(data.loan.deductionPerPayroll) + ' per payroll.');
            currentEmployeeId = employeeId;
            loadData().then(function () { showEmployee(employeeId); });
        }).catch(function () {
            submit.disabled = false;
            PPToast.error('Could not reach the server.');
        });
    });

    populateStartPeriods();
    showView('loanManagementView');
    loadData();
})();
