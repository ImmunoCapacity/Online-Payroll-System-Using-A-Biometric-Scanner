(function () {
    PayrollProLayout.init({
        activeNav: 'loans',
        navMode: 'staff',
        user: { name: 'Dr. Maria Santos', role: 'Faculty Staff', initials: 'MS' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    var loans = [
        {
            id: 1,
            type: 'Pag-IBIG Loan',
            principal: 120000,
            term: 24,
            monthlyDeduction: 5000,
            remainingBalance: 85000,
            status: 'Approved',
            filedDate: '2025-03-15'
        },
        {
            id: 2,
            type: 'Institutional Loan',
            principal: 30000,
            term: 12,
            monthlyDeduction: 2500,
            remainingBalance: 0,
            status: 'Fully Paid',
            filedDate: '2024-06-01'
        },
        {
            id: 3,
            type: 'SSS Salary Loan',
            principal: 50000,
            term: 18,
            monthlyDeduction: 2777.78,
            remainingBalance: 50000,
            status: 'Pending',
            filedDate: '2026-07-02'
        }
    ];

    var nextId = 4;

    function peso(n) {
        return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function calcMonthly(principal, term) {
        if (!principal || !term || term <= 0) return 0;
        return principal / term;
    }

    function statusBadge(status) {
        var map = {
            Pending: 'pp-badge-pending',
            Approved: 'pp-badge-approved',
            Rejected: 'pp-badge-rejected',
            'Fully Paid': 'pp-badge-paid'
        };
        return '<span class="pp-badge ' + (map[status] || 'pp-badge-cancelled') + '">' + status + '</span>';
    }

    function progressBar(loan) {
        if (loan.status === 'Pending' || loan.status === 'Rejected') {
            return '<span class="text-muted small">—</span>';
        }
        var paid = loan.principal - loan.remainingBalance;
        var pct = loan.principal > 0 ? Math.min(100, Math.round((paid / loan.principal) * 100)) : 0;
        return (
            '<div class="pp-loan-progress-wrap">' +
                '<div class="pp-loan-progress-label"><span>' + pct + '% paid</span><span>' + peso(paid) + '</span></div>' +
                '<div class="pp-loan-progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
                    '<div class="pp-loan-progress-bar" style="width:' + pct + '%"></div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderHistory() {
        var tbody = document.getElementById('loanHistoryBody');
        var empty = document.getElementById('loanEmptyState');
        var sorted = loans.slice().sort(function (a, b) {
            return b.filedDate.localeCompare(a.filedDate);
        });

        if (!sorted.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = sorted.map(function (l) {
            return (
                '<tr>' +
                    '<td><strong>' + l.type + '</strong></td>' +
                    '<td class="col-money">' + peso(l.principal) + '</td>' +
                    '<td class="col-units">' + l.term + ' mo</td>' +
                    '<td class="col-money">' + peso(l.monthlyDeduction) + '</td>' +
                    '<td class="col-money">' + (l.status === 'Pending' || l.status === 'Rejected' ? '—' : peso(l.remainingBalance)) + '</td>' +
                    '<td>' + statusBadge(l.status) + '</td>' +
                    '<td>' + progressBar(l) + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function updateDeductionPreview() {
        var principal = parseFloat(document.getElementById('loanPrincipal').value) || 0;
        var term = parseInt(document.getElementById('loanTerm').value, 10) || 0;
        var monthly = calcMonthly(principal, term);
        document.getElementById('monthlyDeductionDisplay').textContent = peso(monthly);
    }

    document.getElementById('loanPrincipal').addEventListener('input', updateDeductionPreview);
    document.getElementById('loanTerm').addEventListener('change', updateDeductionPreview);

    document.getElementById('loanForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        var type = document.getElementById('loanType').value;
        var principal = parseFloat(document.getElementById('loanPrincipal').value);
        var term = parseInt(document.getElementById('loanTerm').value, 10);
        var monthly = calcMonthly(principal, term);

        loans.unshift({
            id: nextId++,
            type: type,
            principal: principal,
            term: term,
            monthlyDeduction: monthly,
            remainingBalance: principal,
            status: 'Pending',
            filedDate: new Date().toISOString().slice(0, 10)
        });

        form.reset();
        form.classList.remove('was-validated');
        updateDeductionPreview();
        bootstrap.Modal.getInstance(document.getElementById('loanFormModal')).hide();
        renderHistory();
    });

    document.getElementById('loanFormModal').addEventListener('hidden.bs.modal', function () {
        var form = document.getElementById('loanForm');
        form.reset();
        form.classList.remove('was-validated');
        updateDeductionPreview();
    });

    renderHistory();
    updateDeductionPreview();
})();
