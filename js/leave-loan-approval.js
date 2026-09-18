(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'loans',
        user: {
            name: 'Maria Elena Reyes',
            role: 'Payroll Master',
            initials: 'MR'
        },
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });


    var employees = [
        {
            id: 'EMP-2023-007',
            name: 'Anna Cruz',
            role: 'Admin Staff'
        },
        {
            id: 'EMP-2024-012',
            name: 'Dr. Maria Santos',
            role: 'Faculty Staff'
        },
        {
            id: 'EMP-2022-031',
            name: 'Juan Dela Cruz',
            role: 'Admin Staff'
        },
        {
            id: 'EMP-2021-089',
            name: 'Elena Villanueva',
            role: 'Faculty Staff'
        }
    ];


    var loans = [
        {
            id: 1,
            employeeId: 'EMP-2023-007',
            employeeName: 'Anna Cruz',
            employeeRole: 'Admin Staff',
            type: 'SSS Salary Loan',
            reference: 'SSS-2026-00123',
            amount: 20000,
            deductionPerPayroll: 1000,
            startPeriod: '2026-03-11_2026-03-25',
            startPeriodLabel: 'March 11 – March 25, 2026',
            status: 'Active',
            remarks: '',
            deductionHistory: [
                {
                    period: 'March 11 – March 25, 2026',
                    amount: 1000,
                    remainingBalance: 19000,
                    dateProcessed: '2026-03-25'
                },
                {
                    period: 'March 26 – April 10, 2026',
                    amount: 1000,
                    remainingBalance: 18000,
                    dateProcessed: '2026-04-10'
                },
                {
                    period: 'April 11 – April 25, 2026',
                    amount: 1000,
                    remainingBalance: 17000,
                    dateProcessed: '2026-04-25'
                },
                {
                    period: 'April 26 – May 10, 2026',
                    amount: 1000,
                    remainingBalance: 16000,
                    dateProcessed: '2026-05-10'
                },
                {
                    period: 'May 11 – May 25, 2026',
                    amount: 1000,
                    remainingBalance: 15000,
                    dateProcessed: '2026-05-25'
                },
                {
                    period: 'May 26 – June 10, 2026',
                    amount: 1000,
                    remainingBalance: 14000,
                    dateProcessed: '2026-06-10'
                },
                {
                    period: 'June 11 – June 25, 2026',
                    amount: 1000,
                    remainingBalance: 13000,
                    dateProcessed: '2026-06-25'
                },
                {
                    period: 'June 26 – July 10, 2026',
                    amount: 1000,
                    remainingBalance: 12000,
                    dateProcessed: '2026-07-10'
                },
                {
                    period: 'July 11 – July 25, 2026',
                    amount: 1000,
                    remainingBalance: 11000,
                    dateProcessed: '2026-07-25'
                },
                {
                    period: 'July 26 – August 10, 2026',
                    amount: 1000,
                    remainingBalance: 10000,
                    dateProcessed: '2026-08-10'
                },
                {
                    period: 'August 11 – August 25, 2026',
                    amount: 1000,
                    remainingBalance: 9000,
                    dateProcessed: '2026-08-25'
                },
                {
                    period: 'August 26 – September 10, 2026',
                    amount: 1000,
                    remainingBalance: 8000,
                    dateProcessed: '2026-09-10'
                }
            ]
        },
        {
            id: 2,
            employeeId: 'EMP-2021-089',
            employeeName: 'Elena Villanueva',
            employeeRole: 'Faculty Staff',
            type: 'Pag-IBIG MPL',
            reference: 'HDMF-2025-0456',
            amount: 15000,
            deductionPerPayroll: 750,
            startPeriod: '2025-11-11_2025-11-25',
            startPeriodLabel: 'November 11 – November 25, 2025',
            status: 'Paid',
            remarks: '',
            deductionHistory: [
                {
                    period: 'August 26 – September 10, 2026',
                    amount: 750,
                    remainingBalance: 750,
                    dateProcessed: '2026-09-10'
                },
                {
                    period: 'September 11 – September 25, 2026',
                    amount: 750,
                    remainingBalance: 0,
                    dateProcessed: '2026-09-25'
                }
            ]
        }
    ];


    var nextLoanId = 3;


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
            Number(loan.amount || 0) - getTotalDeducted(loan)
        );
    }


    function getLoanStatus(loan) {
        return getRemainingBalance(loan) <= 0
            ? 'Paid'
            : 'Active';
    }


    function statusBadge(status) {
        if (status === 'Paid') {
            return '<span class="loan-status loan-status-paid">Paid</span>';
        }

        return '<span class="loan-status loan-status-active">Active</span>';
    }


    function getInitials(name) {
        var parts = String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) {
            return '--';
        }

        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }

        return (
            parts[0].charAt(0) +
            parts[parts.length - 1].charAt(0)
        ).toUpperCase();
    }


    function populateEmployeeSelect() {
        var select = document.getElementById('loanEmployee');

        if (!select) {
            return;
        }

        select.innerHTML =
            '<option value="" selected disabled>Select employee</option>' +
            employees.map(function (employee) {
                return (
                    '<option value="' +
                    escapeHtml(employee.id) +
                    '">' +
                    escapeHtml(employee.name) +
                    ' — ' +
                    escapeHtml(employee.id) +
                    '</option>'
                );
            }).join('');
    }


    function renderLoans() {
        var searchInput = document.getElementById('loanSearch');
        var typeFilter = document.getElementById('loanTypeFilter');
        var statusFilter = document.getElementById('loanStatusFilter');

        var tbody = document.getElementById('loanTableBody');
        var empty = document.getElementById('loanEmptyState');

        if (!tbody || !empty) {
            return;
        }

        var search = searchInput
            ? searchInput.value.trim().toLowerCase()
            : '';

        var type = typeFilter
            ? typeFilter.value
            : 'all';

        var status = statusFilter
            ? statusFilter.value
            : 'all';


        var filtered = loans.filter(function (loan) {
            var currentStatus = getLoanStatus(loan);

            var matchesSearch =
                !search ||
                loan.employeeName.toLowerCase().indexOf(search) >= 0 ||
                loan.employeeId.toLowerCase().indexOf(search) >= 0 ||
                loan.reference.toLowerCase().indexOf(search) >= 0;

            var matchesType =
                type === 'all' ||
                loan.type === type;

            var matchesStatus =
                status === 'all' ||
                currentStatus === status;

            return (
                matchesSearch &&
                matchesType &&
                matchesStatus
            );
        });


        if (!filtered.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }


        empty.classList.add('d-none');


        tbody.innerHTML = filtered.map(function (loan) {
            var totalDeducted = getTotalDeducted(loan);
            var remaining = getRemainingBalance(loan);
            var currentStatus = getLoanStatus(loan);

            return (
                '<tr>' +

                    '<td>' +
                        '<strong>' +
                            escapeHtml(loan.employeeName) +
                        '</strong>' +
                    '</td>' +

                    '<td>' +
                        escapeHtml(loan.employeeId) +
                    '</td>' +

                    '<td>' +
                        escapeHtml(loan.type) +
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
                        (remaining <= 0
                            ? 'loan-balance-paid'
                            : '') +
                    '">' +
                        peso(remaining) +
                    '</td>' +

                    '<td>' +
                        statusBadge(currentStatus) +
                    '</td>' +

                    '<td class="col-actions">' +
                        '<button ' +
                            'type="button" ' +
                            'class="loan-view-btn" ' +
                            'data-loan-id="' +
                            loan.id +
                            '">' +
                            'View Details' +
                        '</button>' +
                    '</td>' +

                '</tr>'
            );
        }).join('');
    }


    function findLoan(id) {
        return loans.find(function (loan) {
            return loan.id === id;
        });
    }


    function renderDeductionHistory(loan) {
        var tbody =
            document.getElementById('loanDeductionHistoryBody');

        var empty =
            document.getElementById('loanDeductionHistoryEmpty');

        if (!tbody || !empty) {
            return;
        }


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

                        '<td class="loan-money">' +
                            peso(item.amount) +
                        '</td>' +

                        '<td class="loan-money">' +
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


    function showLoanManagement() {
        var managementView =
            document.getElementById('loanManagementView');

        var detailsView =
            document.getElementById('loanDetailsView');

        if (!managementView || !detailsView) {
            return;
        }

        detailsView.classList.add('d-none');
        managementView.classList.remove('d-none');

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }


    function showLoanDetails(loan) {
        var managementView =
            document.getElementById('loanManagementView');

        var detailsView =
            document.getElementById('loanDetailsView');

        if (!managementView || !detailsView) {
            return;
        }


        var totalDeducted =
            getTotalDeducted(loan);

        var remaining =
            getRemainingBalance(loan);

        var currentStatus =
            getLoanStatus(loan);


        document.getElementById(
            'detailEmployeeInitials'
        ).textContent =
            getInitials(loan.employeeName);


        document.getElementById(
            'detailEmployeeName'
        ).textContent =
            loan.employeeName;


        document.getElementById(
            'detailEmployeeMeta'
        ).textContent =
            loan.employeeId +
            ' · ' +
            loan.employeeRole;


        document.getElementById(
            'detailLoanStatus'
        ).innerHTML =
            statusBadge(currentStatus);


        document.getElementById(
            'detailLoanType'
        ).textContent =
            loan.type;


        document.getElementById(
            'detailReference'
        ).textContent =
            loan.reference;


        document.getElementById(
            'detailStartPeriod'
        ).textContent =
            loan.startPeriodLabel;


        document.getElementById(
            'detailDeduction'
        ).textContent =
            peso(loan.deductionPerPayroll);


        document.getElementById(
            'detailLoanAmount'
        ).textContent =
            peso(loan.amount);


        document.getElementById(
            'detailTotalDeducted'
        ).textContent =
            peso(totalDeducted);


        document.getElementById(
            'detailRemainingBalance'
        ).textContent =
            peso(remaining);


        renderDeductionHistory(loan);


        managementView.classList.add('d-none');
        detailsView.classList.remove('d-none');


        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }


    var loanSearch =
        document.getElementById('loanSearch');

    if (loanSearch) {
        loanSearch.addEventListener(
            'input',
            renderLoans
        );
    }


    var loanTypeFilter =
        document.getElementById('loanTypeFilter');

    if (loanTypeFilter) {
        loanTypeFilter.addEventListener(
            'change',
            renderLoans
        );
    }


    var loanStatusFilter =
        document.getElementById('loanStatusFilter');

    if (loanStatusFilter) {
        loanStatusFilter.addEventListener(
            'change',
            renderLoans
        );
    }


    var loanTableBody =
        document.getElementById('loanTableBody');

    if (loanTableBody) {
        loanTableBody.addEventListener(
            'click',
            function (event) {
                var button =
                    event.target.closest('[data-loan-id]');

                if (!button) {
                    return;
                }


                var loanId = parseInt(
                    button.getAttribute('data-loan-id'),
                    10
                );


                var loan =
                    findLoan(loanId);


                if (loan) {
                    showLoanDetails(loan);
                }
            }
        );
    }


    var backButton =
        document.getElementById('backToLoanManagement');

    if (backButton) {
        backButton.addEventListener(
            'click',
            function () {
                showLoanManagement();
            }
        );
    }


    var recordLoanForm =
        document.getElementById('recordLoanForm');

    if (recordLoanForm) {
        recordLoanForm.addEventListener(
            'submit',
            function (event) {
                event.preventDefault();


                var form = event.target;


                if (!form.checkValidity()) {
                    form.classList.add('was-validated');
                    return;
                }


                var employeeId =
                    document.getElementById(
                        'loanEmployee'
                    ).value;


                var employee =
                    employees.find(function (item) {
                        return item.id === employeeId;
                    });


                if (!employee) {
                    return;
                }


                var type =
                    document.getElementById(
                        'loanType'
                    ).value;


                var reference =
                    document.getElementById(
                        'loanReference'
                    ).value.trim();


                var amount =
                    parseFloat(
                        document.getElementById(
                            'loanAmount'
                        ).value
                    );


                var deduction =
                    parseFloat(
                        document.getElementById(
                            'loanDeduction'
                        ).value
                    );


                var startPeriodSelect =
                    document.getElementById(
                        'loanStartPeriod'
                    );


                var startPeriod =
                    startPeriodSelect.value;


                var startPeriodLabel =
                    startPeriodSelect.options[
                        startPeriodSelect.selectedIndex
                    ].text.trim();


                var remarks =
                    document.getElementById(
                        'loanRemarks'
                    ).value.trim();


                if (
                    !amount ||
                    amount <= 0 ||
                    !deduction ||
                    deduction <= 0
                ) {
                    form.classList.add(
                        'was-validated'
                    );

                    return;
                }


                if (deduction > amount) {
                    alert(
                        'Deduction per payroll cannot be greater than the total loan amount.'
                    );

                    return;
                }


                var duplicateReference =
                    loans.some(function (loan) {
                        return (
                            loan.reference
                                .toLowerCase() ===
                            reference.toLowerCase()
                        );
                    });


                if (duplicateReference) {
                    alert(
                        'A loan with this reference number already exists.'
                    );

                    return;
                }


                loans.push({
                    id: nextLoanId++,
                    employeeId: employee.id,
                    employeeName: employee.name,
                    employeeRole: employee.role,
                    type: type,
                    reference: reference,
                    amount: amount,
                    deductionPerPayroll: deduction,
                    startPeriod: startPeriod,
                    startPeriodLabel: startPeriodLabel,
                    status: 'Active',
                    remarks: remarks,
                    deductionHistory: []
                });


                form.reset();

                form.classList.remove(
                    'was-validated'
                );


                var modalElement =
                    document.getElementById(
                        'recordLoanModal'
                    );


                var modal =
                    bootstrap.Modal.getInstance(
                        modalElement
                    );


                if (modal) {
                    modal.hide();
                }


                renderLoans();
            }
        );
    }


    var recordLoanModal =
        document.getElementById('recordLoanModal');

    if (recordLoanModal) {
        recordLoanModal.addEventListener(
            'hidden.bs.modal',
            function () {
                var form =
                    document.getElementById(
                        'recordLoanForm'
                    );

                if (!form) {
                    return;
                }

                form.reset();

                form.classList.remove(
                    'was-validated'
                );
            }
        );
    }


    populateEmployeeSelect();
    renderLoans();
    showLoanManagement();

})();