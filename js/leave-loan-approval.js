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


    var employees = DataStore.getEmployees()
        .filter(function (e) { return e.status !== 'Inactive'; })
        .map(function (e) {
            return { id: e.id, name: e.displayName, role: e.type === 'Faculty' ? 'Faculty Staff' : 'Administrative Staff' };
        });


    var loans = DataStore.getLoans();

    function persistLoans() {
        DataStore.saveLoans(loans);
    }


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
        return DataStore.getLoanTotalDeducted(loan);
    }


    function getRemainingBalance(loan) {
        return DataStore.getLoanRemainingBalance(loan);
    }


    function getLoanStatus(loan) {
        return DataStore.getLoanStatus(loan);
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
                    id: DataStore.nextNumericId(loans),
                    employeeId: employee.id,
                    employeeName: employee.name,
                    employeeRole: employee.role,
                    type: type,
                    reference: reference,
                    amount: amount,
                    deductionPerPayroll: deduction,
                    startPeriod: startPeriod,
                    startPeriodLabel: startPeriodLabel,
                    remarks: remarks,
                    deductionHistory: []
                });
                persistLoans();


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

                if (window.PPToast) {
                    PPToast.success('Loan recorded for ' + employee.name + '.');
                }
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