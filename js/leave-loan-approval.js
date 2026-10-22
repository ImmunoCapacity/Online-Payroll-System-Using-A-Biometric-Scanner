/**
 * Loan Management (api/employees, api/loans).
 *
 *   1. Employees: one row per employee with their active loans, what is
 *      deducted every month and the remaining balance.
 *   2. Click an employee: their loans, with Add Loan.
 *   3. Click a loan: its details and deduction history (skipped months too).
 *
 * Add Loan takes the lender, reference, amount, interest and payment period
 * (Payment From and Payment To dates); the amount plus interest is divided
 * by the months in between, the last month taking the leftover centavos
 * (worked out again by the server). Payroll Computation deducts it once a
 * month, in the first payroll of the month; when the pay isn't enough, it is skipped
 * and flagged, and the loan runs one month longer.
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


    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
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
                ' month' + (loan.skippedPeriods === 1 ? '' : 's') + '">Skipped ' + loan.skippedPeriods + '×</span>';
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
                '<td class="text-end loan-money">' + peso(l.totalPayable) + '</td>' +
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
            (loan.periods ? ' (' + loan.periods + ' month' + (loan.periods === 1 ? '' : 's') + ')' : '');
        el('detailDeduction').textContent = peso(loan.deductionPerPayroll);
        el('detailSkippedWrap').classList.toggle('d-none', !loan.skippedPeriods);
        el('detailSkipped').textContent = loan.skippedPeriods
            ? loan.skippedPeriods + ' (pay wasn\'t enough) — now expected to end ' + loan.expectedEndPeriodLabel
            : '';
        el('detailInterest').textContent = Number(loan.interestRate) ? Number(loan.interestRate) + '% of ' + peso(loan.amount) + ' = ' + peso(loan.interestAmount) : 'None';
        el('detailLoanAmount').textContent = peso(loan.totalPayable);
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

    /** Months from Payment From to Payment To, both included (Nov 1 – Apr 30 is 6). */
    function monthsBetween(from, to) {
        var a = parseIso(from), b = parseIso(to);
        return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
    }

    function monthLabel(isoDate) {
        var d = parseIso(isoDate);
        return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    }

    /** The deduction per payroll, as the server works it out: (amount + interest) ÷ months. */
    function updateComputed() {
        var amount = parseFloat(el('loanAmount').value);
        var rate = parseFloat(el('loanInterest').value) || 0;
        var from = el('loanStartDate').value;
        var to = el('loanEndDate').value;
        el('loanEndDate').min = from || '';
        var months = from && to && to >= from ? monthsBetween(from, to) : 0;
        if (!(amount > 0) || !months || rate < 0) {
            el('loanPerPayroll').value = 'Computed automatically';
            el('loanPerPayrollHint').textContent = '(Loan amount + interest) ÷ number of months from Payment From to Payment To.';
            return;
        }
        var cents = Math.round(amount * 100);
        var total = cents + Math.round(cents * rate / 100);
        var per = Math.floor(total / months);
        var last = total - per * (months - 1);
        el('loanPerPayroll').value = peso(per / 100);
        el('loanPerPayrollHint').textContent =
            (rate ? peso(amount) + ' + ' + rate + '% interest = ' + peso(total / 100) : peso(total / 100)) +
            ' ÷ ' + months + ' month' + (months === 1 ? '' : 's') +
            ' (' + monthLabel(from) + (months > 1 ? ' – ' + monthLabel(to) : '') + '), deducted in the first payroll of each month' +
            (months > 1 && last !== per ? '; the last month deducts ' + peso(last / 100) + '.' : '.');
    }

    function openAddLoan(employeeId) {
        form.reset();
        PPValidate.clear(form);
        el('loanEmployeeGroup').classList.toggle('d-none', !!employeeId);
        el('loanEmployee').value = employeeId || '';
        var e = employees.find(function (x) { return x.id === employeeId; });
        el('recordLoanTitle').textContent = e ? 'Add Loan — ' + e.name : 'Add Loan';
        updateComputed();
        modal.show();
    }

    el('btnAddLoan').addEventListener('click', function () { openAddLoan(currentEmployeeId); });
    el('btnAddLoanAny').addEventListener('click', function () { openAddLoan(null); });
    ['loanStartDate', 'loanEndDate', 'loanAmount', 'loanInterest'].forEach(function (id) {
        el(id).addEventListener('input', updateComputed);
        el(id).addEventListener('change', updateComputed);
    });

    el('loanEndDate').ppValidator = function (value) {
        var from = el('loanStartDate').value;
        if (from && value < from) return 'Payment To can\'t be before Payment From.';
        return from && monthsBetween(from, value) > 120 ? 'The payment period can be at most 120 months (10 years).' : '';
    };

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
        var lender = el('loanLender').value.trim();
        var submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;

        api('api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employeeId: employeeId,
                lender: lender,
                reference: el('loanReference').value.trim(),
                amount: parseFloat(el('loanAmount').value),
                interestRate: parseFloat(el('loanInterest').value) || 0,
                startDate: el('loanStartDate').value,
                endDate: el('loanEndDate').value
            })
        }).then(function (data) {
            submit.disabled = false;
            if (!data.success) {
                var fields = {
                    employeeId: 'loanEmployee', lender: 'loanLender', reference: 'loanReference', interestRate: 'loanInterest',
                    amount: 'loanAmount', startDate: 'loanStartDate', endDate: 'loanEndDate'
                };
                if (!PPValidate.showServerError(form, data, fields)) PPToast.error(data.message || 'Could not save the loan.');
                return;
            }
            modal.hide();
            PPToast.success('Loan saved for ' + employee.name + ': ' + peso(data.loan.deductionPerPayroll) + ' a month.');
            currentEmployeeId = employeeId;
            loadData().then(function () { showEmployee(employeeId); });
        }).catch(function () {
            submit.disabled = false;
            PPToast.error('Could not reach the server.');
        });
    });

    showView('loanManagementView');
    loadData();
})();
