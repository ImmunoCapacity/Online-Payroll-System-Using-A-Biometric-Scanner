(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'loans',
        navMode: 'staff',
        user: {
            name: 'Dr. Maria Santos',
            role: 'Faculty Staff',
            initials: 'MS'
        },
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: false
    });

    var CURRENT_EMPLOYEE_ID = 'EMP-2021-014';
    var CURRENT_EMPLOYEE_ROLE = 'Faculty Staff';

    var loans = DataStore.getLoans().filter(function (loan) {
        return loan.employeeId === CURRENT_EMPLOYEE_ID;
    });

    function peso(value) {
        var amount = Number(value) || 0;
        return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(iso) {
        if (!iso) return '—';
        var date = new Date(iso + 'T00:00:00');
        return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getInitials(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '--';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    function statusBadge(status) {
        if (status === 'Paid') {
            return '<span class="loan-status loan-status-paid">Paid</span>';
        }
        return '<span class="loan-status loan-status-active">Active</span>';
    }

    function findLoan(id) {
        return loans.find(function (loan) { return loan.id === id; });
    }

    function renderLoans() {
        var tbody = document.getElementById('loanHistoryBody');
        var empty = document.getElementById('loanEmptyState');

        if (!loans.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = loans.map(function (loan) {
            var totalDeducted = DataStore.getLoanTotalDeducted(loan);
            var remaining = DataStore.getLoanRemainingBalance(loan);
            var status = DataStore.getLoanStatus(loan);

            return (
                '<tr>' +
                    '<td>' + escapeHtml(loan.type) + '</td>' +
                    '<td>' + escapeHtml(loan.reference) + '</td>' +
                    '<td class="loan-money">' + peso(loan.amount) + '</td>' +
                    '<td class="loan-money">' + peso(loan.deductionPerPayroll) + '</td>' +
                    '<td class="loan-money">' + peso(totalDeducted) + '</td>' +
                    '<td class="loan-balance ' + (remaining <= 0 ? 'loan-balance-paid' : '') + '">' + peso(remaining) + '</td>' +
                    '<td>' + statusBadge(status) + '</td>' +
                    '<td class="col-actions">' +
                        '<button type="button" class="loan-view-btn" data-loan-id="' + loan.id + '">View Details</button>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function renderDeductionHistory(loan) {
        var tbody = document.getElementById('loanDeductionHistoryBody');
        var empty = document.getElementById('loanDeductionHistoryEmpty');

        var history = loan.deductionHistory || [];
        if (!history.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = history.slice().reverse().map(function (item) {
            return (
                '<tr>' +
                    '<td>' + escapeHtml(item.period) + '</td>' +
                    '<td class="loan-money">' + peso(item.amount) + '</td>' +
                    '<td class="loan-money">' + peso(item.remainingBalance) + '</td>' +
                    '<td>' + formatDate(item.dateProcessed) + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function showLoanDetails(loan) {
        var totalDeducted = DataStore.getLoanTotalDeducted(loan);
        var remaining = DataStore.getLoanRemainingBalance(loan);
        var status = DataStore.getLoanStatus(loan);

        document.getElementById('detailEmployeeInitials').textContent = getInitials(loan.employeeName);
        document.getElementById('detailEmployeeName').textContent = loan.employeeName;
        document.getElementById('detailEmployeeMeta').textContent = CURRENT_EMPLOYEE_ROLE;
        document.getElementById('detailLoanStatus').innerHTML = statusBadge(status);
        document.getElementById('detailLoanType').textContent = loan.type;
        document.getElementById('detailReference').textContent = loan.reference;
        document.getElementById('detailStartPeriod').textContent = loan.startPeriodLabel;
        document.getElementById('detailDeduction').textContent = peso(loan.deductionPerPayroll);
        document.getElementById('detailLoanAmount').textContent = peso(loan.amount);
        document.getElementById('detailTotalDeducted').textContent = peso(totalDeducted);
        document.getElementById('detailRemainingBalance').textContent = peso(remaining);

        renderDeductionHistory(loan);

        var modal = new bootstrap.Modal(document.getElementById('loanDetailsModal'));
        modal.show();
    }

    document.getElementById('loanHistoryBody').addEventListener('click', function (event) {
        var button = event.target.closest('[data-loan-id]');
        if (!button) return;

        var loanId = parseInt(button.getAttribute('data-loan-id'), 10);
        var loan = findLoan(loanId);
        if (loan) showLoanDetails(loan);
    });

    renderLoans();
})();
