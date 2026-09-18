(function () {
    PayrollProLayout.init({
        activeNav: 'reports',
        user: { name: 'Maria Elena Reyes', role: 'Payroll Master', initials: 'MR' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    function peso(n) {
        return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function switchTab(tab) {
        document.querySelectorAll('.pp-approval-tab').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.getElementById('panelPayroll').classList.toggle('d-none', tab !== 'payroll');
        document.getElementById('panelLeave').classList.toggle('d-none', tab !== 'leave');
        document.getElementById('panelLoans').classList.toggle('d-none', tab !== 'loans');
    }

    document.querySelectorAll('.pp-approval-tab').forEach(function (btn) {
        btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });

    // ---- Payroll summary ----
    function renderPayrollSummary() {
        var records = DataStore.get('payroll', []);
        var byPeriod = {};
        records.forEach(function (r) {
            if (!byPeriod[r.periodLabel]) {
                byPeriod[r.periodLabel] = { count: 0, gross: 0, deductions: 0, net: 0 };
            }
            var bucket = byPeriod[r.periodLabel];
            bucket.count += 1;
            bucket.gross += r.gross + (r.benefits || 0);
            bucket.deductions += r.deductions;
            bucket.net += r.net;
        });

        var tbody = document.getElementById('payrollReportBody');
        var empty = document.getElementById('payrollReportEmpty');
        var periods = Object.keys(byPeriod);

        if (!periods.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }
        empty.classList.add('d-none');
        tbody.innerHTML = periods.map(function (label) {
            var b = byPeriod[label];
            return (
                '<tr>' +
                    '<td><strong>' + label + '</strong></td>' +
                    '<td class="col-num">' + b.count + '</td>' +
                    '<td class="col-money">' + peso(b.gross) + '</td>' +
                    '<td class="col-money">' + peso(b.deductions) + '</td>' +
                    '<td class="col-money"><strong>' + peso(b.net) + '</strong></td>' +
                '</tr>'
            );
        }).join('');
    }

    // ---- Leave summary ----
    function renderLeaveSummary() {
        var requests = DataStore.getLeaveRequests();
        var byCategory = {};
        requests.forEach(function (r) {
            if (!byCategory[r.category]) {
                byCategory[r.category] = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
            }
            if (byCategory[r.category][r.status] !== undefined) {
                byCategory[r.category][r.status] += 1;
            }
        });

        var tbody = document.getElementById('leaveReportBody');
        var empty = document.getElementById('leaveReportEmpty');
        var categories = Object.keys(byCategory);

        if (!categories.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }
        empty.classList.add('d-none');
        tbody.innerHTML = categories.map(function (cat) {
            var c = byCategory[cat];
            var total = c.Pending + c.Approved + c.Rejected + c.Cancelled;
            return (
                '<tr>' +
                    '<td><strong>' + cat + '</strong></td>' +
                    '<td class="col-num">' + c.Pending + '</td>' +
                    '<td class="col-num">' + c.Approved + '</td>' +
                    '<td class="col-num">' + c.Rejected + '</td>' +
                    '<td class="col-num">' + c.Cancelled + '</td>' +
                    '<td class="col-num"><strong>' + total + '</strong></td>' +
                '</tr>'
            );
        }).join('');
    }

    // ---- Loan summary ----
    function renderLoanSummary() {
        var loans = DataStore.getLoans().filter(function (l) { return l.status !== 'Rejected'; });
        var byType = {};
        loans.forEach(function (l) {
            if (!byType[l.type]) {
                byType[l.type] = { count: 0, principal: 0, balance: 0 };
            }
            byType[l.type].count += 1;
            byType[l.type].principal += l.principal;
            byType[l.type].balance += (l.remainingBalance != null ? l.remainingBalance : l.principal);
        });

        var tbody = document.getElementById('loanReportBody');
        var empty = document.getElementById('loanReportEmpty');
        var types = Object.keys(byType);

        if (!types.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }
        empty.classList.add('d-none');
        tbody.innerHTML = types.map(function (type) {
            var t = byType[type];
            return (
                '<tr>' +
                    '<td><strong>' + type + '</strong></td>' +
                    '<td class="col-num">' + t.count + '</td>' +
                    '<td class="col-money">' + peso(t.principal) + '</td>' +
                    '<td class="col-money">' + peso(t.balance) + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    renderPayrollSummary();
    renderLeaveSummary();
    renderLoanSummary();
})();
