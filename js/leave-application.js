(function () {
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

    var currentEmployee = {
        id: 'EMP-2024-012',
        name: 'Dr. Maria Santos',
        role: 'Faculty Staff',
        initials: 'MS'
    };

    var loans = [
        {
            id: 1,
            employeeId: 'EMP-2024-012',
            type: 'SSS Salary Loan',
            reference: 'SSS-2026-00841',
            amount: 50000,
            deductionPerPayroll: 2500,
            startPeriod: 'March 11 – March 25, 2026',
            deductionHistory: [
                {
                    period: 'March 11 – March 25, 2026',
                    amount: 2500,
                    remainingBalance: 47500,
                    dateProcessed: '2026-03-25'
                },
                {
                    period: 'March 26 – April 10, 2026',
                    amount: 2500,
                    remainingBalance: 45000,
                    dateProcessed: '2026-04-10'
                },
                {
                    period: 'April 11 – April 25, 2026',
                    amount: 2500,
                    remainingBalance: 42500,
                    dateProcessed: '2026-04-25'
                },
                {
                    period: 'April 26 – May 10, 2026',
                    amount: 2500,
                    remainingBalance: 40000,
                    dateProcessed: '2026-05-10'
                },
                {
                    period: 'May 11 – May 25, 2026',
                    amount: 2500,
                    remainingBalance: 37500,
                    dateProcessed: '2026-05-25'
                },
                {
                    period: 'May 26 – June 10, 2026',
                    amount: 2500,
                    remainingBalance: 35000,
                    dateProcessed: '2026-06-10'
                },
                {
                    period: 'June 11 – June 25, 2026',
                    amount: 2500,
                    remainingBalance: 32500,
                    dateProcessed: '2026-06-25'
                },
                {
                    period: 'June 26 – July 10, 2026',
                    amount: 2500,
                    remainingBalance: 30000,
                    dateProcessed: '2026-07-10'
                },
                {
                    period: 'July 11 – July 25, 2026',
                    amount: 2500,
                    remainingBalance: 27500,
                    dateProcessed: '2026-07-25'
                },
                {
                    period: 'July 26 – August 10, 2026',
                    amount: 2500,
                    remainingBalance: 25000,
                    dateProcessed: '2026-08-10'
                },
                {
                    period: 'August 11 – August 25, 2026',
                    amount: 2500,
                    remainingBalance: 22500,
                    dateProcessed: '2026-08-25'
                },
                {
                    period: 'August 26 – September 10, 2026',
                    amount: 2500,
                    remainingBalance: 20000,
                    dateProcessed: '2026-09-10'
                }
            ]
        },

        {
            id: 2,
            employeeId: 'EMP-2024-012',
            type: 'Pag-IBIG MPL',
            reference: 'HDMF-2025-00372',
            amount: 15000,
            deductionPerPayroll: 1500,
            startPeriod: 'April 11 – April 25, 2026',
            deductionHistory: [
                {
                    period: 'April 11 – April 25, 2026',
                    amount: 1500,
                    remainingBalance: 13500,
                    dateProcessed: '2026-04-25'
                },
                {
                    period: 'April 26 – May 10, 2026',
                    amount: 1500,
                    remainingBalance: 12000,
                    dateProcessed: '2026-05-10'
                },
                {
                    period: 'May 11 – May 25, 2026',
                    amount: 1500,
                    remainingBalance: 10500,
                    dateProcessed: '2026-05-25'
                },
                {
                    period: 'May 26 – June 10, 2026',
                    amount: 1500,
                    remainingBalance: 9000,
                    dateProcessed: '2026-06-10'
                },
                {
                    period: 'June 11 – June 25, 2026',
                    amount: 1500,
                    remainingBalance: 7500,
                    dateProcessed: '2026-06-25'
                },
                {
                    period: 'June 26 – July 10, 2026',
                    amount: 1500,
                    remainingBalance: 6000,
                    dateProcessed: '2026-07-10'
                },
                {
                    period: 'July 11 – July 25, 2026',
                    amount: 1500,
                    remainingBalance: 4500,
                    dateProcessed: '2026-07-25'
                },
                {
                    period: 'July 26 – August 10, 2026',
                    amount: 1500,
                    remainingBalance: 3000,
                    dateProcessed: '2026-08-10'
                },
                {
                    period: 'August 11 – August 25, 2026',
                    amount: 1500,
                    remainingBalance: 1500,
                    dateProcessed: '2026-08-25'
                },
                {
                    period: 'August 26 – September 10, 2026',
                    amount: 1500,
                    remainingBalance: 0,
                    dateProcessed: '2026-09-10'
                }
            ]
        }
    ];

    function peso(value) {
        var amount = Number(value) || 0;

        return '₱' + amount.toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(iso) {
        if (!iso) {
            return '—';
        }

        var date = new Date(iso + 'T00:00:00');

        return date.toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getTotalDeducted(loan) {
        return loan.deductionHistory.reduce(function (total, item) {
            return total + Number(item.amount || 0);
        }, 0);
    }

    function getRemainingBalance(loan) {
        return Math.max(
            0,
            loan.amount - getTotalDeducted(loan)
        );
    }

    function getLoanStatus(loan) {
        return getRemainingBalance(loan) <= 0
            ? 'Paid'
            : 'Active';
    }

    function statusBadge(status) {
        if (status === 'Paid') {
            return (
                '<span class="loan-status loan-status-paid">' +
                    'Paid' +
                '</span>'
            );
        }

        return (
            '<span class="loan-status loan-status-active">' +
                'Active' +
            '</span>'
        );
    }

    function renderLoans() {
        var tbody = document.getElementById('loanHistoryBody');
        var empty = document.getElementById('loanEmptyState');

        var employeeLoans = loans.filter(function (loan) {
            return loan.employeeId === currentEmployee.id;
        });

        if (!employeeLoans.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');

        tbody.innerHTML = employeeLoans.map(function (loan) {
            var totalDeducted = getTotalDeducted(loan);
            var remainingBalance = getRemainingBalance(loan);
            var status = getLoanStatus(loan);

            return (
                '<tr>' +

                    '<td>' +
                        '<strong>' +
                            escapeHtml(loan.type) +
                        '</strong>' +
                    '</td>' +

                    '<td>' +
                        escapeHtml(loan.reference) +
                    '</td>' +

                    '<td class="loan-money">' +
                        peso(loan.amount) +
                    '</td>' +

                    '<td class="loan-money">' +
                        peso(loan.deductionPerPayroll) +
                    '</td>' +

                    '<td class="loan-money">' +
                        peso(totalDeducted) +
                    '</td>' +

                    '<td class="loan-balance ' +
                        (remainingBalance <= 0
                            ? 'loan-balance-paid'
                            : '') +
                    '">' +
                        peso(remainingBalance) +
                    '</td>' +

                    '<td>' +
                        statusBadge(status) +
                    '</td>' +

                    '<td class="col-actions">' +

                        '<button ' +
                            'type="button" ' +
                            'class="loan-view-btn" ' +
                            'data-loan-id="' + loan.id + '">' +

                            'View Details' +

                        '</button>' +

                    '</td>' +

                '</tr>'
            );
        }).join('');
    }

    function findLoan(id) {
        return loans.find(function (loan) {
            return (
                loan.id === id &&
                loan.employeeId === currentEmployee.id
            );
        });
    }

    function showLoanDetails(loan) {
        var totalDeducted = getTotalDeducted(loan);
        var remainingBalance = getRemainingBalance(loan);
        var status = getLoanStatus(loan);

        document.getElementById(
            'detailEmployeeInitials'
        ).textContent = currentEmployee.initials;

        document.getElementById(
            'detailEmployeeName'
        ).textContent = currentEmployee.name;

        document.getElementById(
            'detailEmployeeMeta'
        ).textContent =
            currentEmployee.id +
            ' · ' +
            currentEmployee.role;

        document.getElementById(
            'detailLoanStatus'
        ).innerHTML = statusBadge(status);

        document.getElementById(
            'detailLoanType'
        ).textContent = loan.type;

        document.getElementById(
            'detailReference'
        ).textContent = loan.reference;

        document.getElementById(
            'detailStartPeriod'
        ).textContent = loan.startPeriod;

        document.getElementById(
            'detailDeduction'
        ).textContent = peso(loan.deductionPerPayroll);

        document.getElementById(
            'detailLoanAmount'
        ).textContent = peso(loan.amount);

        document.getElementById(
            'detailTotalDeducted'
        ).textContent = peso(totalDeducted);

        document.getElementById(
            'detailRemainingBalance'
        ).textContent = peso(remainingBalance);

        renderDeductionHistory(loan);

        var modal = bootstrap.Modal.getOrCreateInstance(
            document.getElementById('loanDetailsModal')
        );

        modal.show();
    }

    function renderDeductionHistory(loan) {
        var tbody = document.getElementById(
            'loanDeductionHistoryBody'
        );

        var empty = document.getElementById(
            'loanDeductionHistoryEmpty'
        );

        if (!loan.deductionHistory.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');

        tbody.innerHTML = loan.deductionHistory
            .slice()
            .reverse()
            .map(function (item) {
                return (
                    '<tr>' +

                        '<td>' +
                            escapeHtml(item.period) +
                        '</td>' +

                        '<td>' +
                            peso(item.amount) +
                        '</td>' +

                        '<td>' +
                            peso(item.remainingBalance) +
                        '</td>' +

                        '<td>' +
                            formatDate(item.dateProcessed) +
                        '</td>' +

                    '</tr>'
                );
            })
            .join('');
    }

    document.getElementById(
        'loanHistoryBody'
    ).addEventListener('click', function (event) {

        var button = event.target.closest('[data-loan-id]');

        if (!button) {
            return;
        }

        var loanId = parseInt(
            button.getAttribute('data-loan-id'),
            10
        );

        var loan = findLoan(loanId);

        if (loan) {
            showLoanDetails(loan);
        }
    });

    renderLoans();
})();