(function () {

    /* Layout */
    PayrollProLayout.init({
        activeNav: 'reports',
        user: { name: 'Maria Elena Reyes', role: 'Payroll Master', initials: 'MR' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });


    /* Elements */
    var $ = function (id) { return document.getElementById(id); };

    var reportTitle = $('reportTitle');
    var reportParent = $('reportParent');
    var reportBreadcrumb = $('reportBreadcrumb');
    var reportDescription = $('reportDescription');
    var payrollPeriod = $('payrollPeriod');
    var employeeType = $('employeeType');
    var reportSearch = $('reportSearch');
    var tableHead = $('reportTableHead');
    var tableBody = $('reportTableBody');
    var tableFooter = $('reportTableFooter');


    /* Report definitions */
    var GOV = 'Government Contributions';

    var reportDefinitions = {
        payroll: {
            title: 'Payroll Report', breadcrumb: 'Payroll Report', parent: 'Payroll',
            description: 'Payroll summary for the selected period: gross pay, itemised deductions and net pay.'
        },
        payslip: {
            title: 'Payslip', breadcrumb: 'Payslip', parent: 'Payroll',
            description: 'Employee payslip records showing earnings, deductions and net pay.'
        },
        thirteenth: {
            title: '13th Month Pay', breadcrumb: '13th Month Pay', parent: 'Payroll',
            description: '13th-month pay computation records for employees.'
        },
        sss: {
            title: 'SSS Remittance Report', breadcrumb: 'SSS Remittance', parent: GOV,
            description: 'Government contribution records for SSS.'
        },
        philhealth: {
            title: 'PhilHealth Remittance Report', breadcrumb: 'PhilHealth Remittance', parent: GOV,
            description: 'Government contribution records for PhilHealth.'
        },
        pagibig: {
            title: 'Pag-IBIG Remittance Report', breadcrumb: 'Pag-IBIG Remittance', parent: GOV,
            description: 'Government contribution records for Pag-IBIG.'
        },
        bir: {
            title: 'BIR Remittance Report', breadcrumb: 'BIR Remittance', parent: GOV,
            description: 'Withholding tax records for BIR reporting.'
        },
        loans: {
            title: 'Loan Report', breadcrumb: 'Loan Report', parent: 'Payroll',
            description: 'Loan balances and deduction history of admin and faculty staff.'
        },
        employees: {
            title: 'Employee List Report', breadcrumb: 'Employee List', parent: 'Employees',
            description: 'Complete list of admin and faculty staff and their employment details.'
        }
    };

    var currentReport = 'payroll';


    /* Field keys */
    var KEYS = {
        id: ['employeeId', 'empId', 'employeeNumber', 'id'],
        name: ['employeeName', 'employee', 'name'],
        type: ['employeeType', 'type'],
        period: ['periodLabel', 'payPeriod', 'period']
    };


    /* Helpers */
    function peso(value) {
        return '₱' + (Number(value) || 0).toLocaleString('en-PH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function number(value) {
        return Number(value) || 0;
    }

    function round2(value) {
        return Math.round(number(value) * 100) / 100;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getValue(object, keys, fallback) {
        for (var i = 0; i < keys.length; i++) {
            if (object && object[keys[i]] !== undefined && object[keys[i]] !== null) {
                return object[keys[i]];
            }
        }
        return fallback;
    }

    function setText(id, text) {
        var el = $(id);
        if (el) { el.textContent = text; }
    }

    function idOf(r)   { return getValue(r, KEYS.id, '—'); }
    function nameOf(r) { return getValue(r, KEYS.name, '—'); }
    function typeOf(r) { return getValue(r, KEYS.type, '—'); }


    /* Records: released payroll from the database (api/payroll/released) */
    var payrollRecords = [];

    function getPayrollRecords() {
        return payrollRecords;
    }

    /**
     * 13th month pay (PD 851): one twelfth of the basic salary earned in a
     * calendar year — here the gross pay of every released period of that
     * year (benefits excluded). A selected period picks its year; "All
     * periods" shows each employee once per year.
     */
    function thirteenthMonthRecords() {
        var selectedPeriod = payrollPeriod.value;
        var year = null;
        if (selectedPeriod !== 'all') {
            var match = payrollRecords.find(function (r) { return r.periodLabel === selectedPeriod; });
            year = match ? match.periodEnd.slice(0, 4) : null;
        }
        var groups = {};
        var order = [];
        filterPayrollRecords(true).forEach(function (r) {
            var y = r.periodEnd.slice(0, 4);
            if (year && y !== year) return;
            var key = r.employeeKey + '|' + y;
            if (!groups[key]) {
                groups[key] = {
                    employeeId: r.employeeId,
                    employee: r.employee + (year ? '' : ' (' + y + ')'),
                    employeeType: r.employeeType,
                    gross: 0,
                    benefits: 0
                };
                order.push(key);
            }
            groups[key].gross += number(r.gross);
        });
        return order.map(function (key) {
            var row = groups[key];
            row.gross = Math.round(row.gross * 100) / 100;
            row.thirteenthMonth = Math.round(row.gross / 12 * 100) / 100;
            return row;
        });
    }

    function buildPayrollPeriods() {
        var periods = {};

        getPayrollRecords().forEach(function (record) {
            var period = getValue(record, KEYS.period, '');
            if (period) { periods[period] = true; }
        });

        Object.keys(periods).forEach(function (period) {
            var option = document.createElement('option');
            option.value = period;
            option.textContent = period;
            payrollPeriod.appendChild(option);
        });
    }

    // ignorePeriod: every period (used by the 13th month report).
    function filterPayrollRecords(ignorePeriod) {
        var selectedPeriod = payrollPeriod.value;
        var selectedType = employeeType.value;
        var search = reportSearch.value.trim().toLowerCase();

        return getPayrollRecords().filter(function (record) {
            var type = String(getValue(record, KEYS.type, '')).toLowerCase();
            var empName = String(getValue(record, KEYS.name, '')).toLowerCase();
            var empId = String(getValue(record, KEYS.id, '')).toLowerCase();

            var periodMatch = ignorePeriod || selectedPeriod === 'all' ||
                getValue(record, KEYS.period, '') === selectedPeriod;

            var typeMatch = true;
            // Exact matches, so Faculty/Admin staff only show under their own type.
            if (selectedType === 'faculty') { typeMatch = type === 'faculty'; }
            if (selectedType === 'admin') { typeMatch = type === 'admin'; }
            if (selectedType === 'both') {
                typeMatch = type === 'faculty/admin' || type.includes('both') || type.includes('admin / faculty');
            }

            var searchMatch = !search ||
                empName.includes(search) ||
                empId.includes(search);

            return periodMatch && typeMatch && searchMatch;
        });
    }


    /* Payroll values */
    function getPayrollValues(record) {
        var g = function (keys) { return number(getValue(record, keys, 0)); };

        var gross = g(['grossPay', 'gross']);
        var benefits = g(['benefits']);
        var sss = g(['sss', 'sssContribution']);
        var philhealth = g(['philhealth', 'philHealth', 'philhealthContribution']);
        var pagibig = g(['pagibig', 'pagIbig', 'pagibigContribution']);
        var tax = g(['tax', 'bir', 'withholdingTax']);
        var loan = g(['loan', 'loanDeduction']);

        var deductions = number(getValue(
            record, ['deductions', 'totalDeductions'],
            sss + philhealth + pagibig + tax + loan
        ));

        var net = number(getValue(
            record, ['netPay', 'net'],
            gross + benefits - deductions
        ));

        return {
            gross: gross + benefits,
            sss: sss,
            philhealth: philhealth,
            pagibig: pagibig,
            tax: tax,
            loan: loan,
            deductions: deductions,
            net: net,
            hours: round2(g(['hours', 'workedHours', 'totalHours']))
        };
    }


    /* Table
       Every report is shown through show(): columns ({ label, kind, strong }),
       rows of raw values and optional totals (one per column, null = none).
       kind is 'text', 'money' or 'number'. The same data is what Export PDF
       and Export Excel send to the server, so the files match the screen. */
    var exportData = null;

    var TEXT = 'text', MONEY = 'money', NUM = 'number';

    function col(label, kind, strong) {
        return { label: label, kind: kind || TEXT, strong: !!strong };
    }

    function cellHtml(column, value) {
        var html = column.kind === MONEY ? peso(value)
            : column.kind === NUM ? escapeHtml(value == null ? '—' : value)
            : escapeHtml(value == null || value === '' ? '—' : value);
        if (column.strong) { html = '<strong>' + html + '</strong>'; }
        return '<td' + (column.kind === TEXT ? '' : ' class="report-num"') + '>' + html + '</td>';
    }

    function show(columns, rows, totals, emptyText) {
        tableHead.innerHTML = '<tr>' + columns.map(function (c) {
            return '<th' + (c.kind === TEXT ? '' : ' class="report-num"') + '>' + escapeHtml(c.label) + '</th>';
        }).join('') + '</tr>';

        tableBody.innerHTML = rows.length
            ? rows.map(function (row) {
                return '<tr>' + columns.map(function (c, i) { return cellHtml(c, row[i]); }).join('') + '</tr>';
            }).join('')
            : '<tr><td colspan="' + columns.length + '" class="report-empty">' +
              (emptyText || 'No records found for the selected filters.') + '</td></tr>';

        tableFooter.innerHTML = '';
        if (totals && rows.length) {
            var lead = 0;
            while (lead < columns.length && totals[lead] == null) { lead++; }
            lead = Math.max(1, lead);
            var cells = '<th colspan="' + lead + '">Total</th>';
            for (var i = lead; i < columns.length; i++) {
                var v = totals[i];
                cells += '<th class="report-num">' +
                    (v == null ? '' : columns[i].kind === MONEY ? peso(v) : escapeHtml(round2(v))) + '</th>';
            }
            tableFooter.innerHTML = '<tr>' + cells + '</tr>';
        }

        setText('reportRecordLabel', rows.length + (rows.length === 1 ? ' record' : ' records'));

        exportData = {
            columns: columns.map(function (c) { return { label: c.label, kind: c.kind }; }),
            rows: rows,
            totals: totals || null
        };
    }

    function showLoading(columns, text) {
        exportData = null;
        tableHead.innerHTML = '<tr>' + columns.map(function (c) {
            return '<th' + (c.kind === TEXT ? '' : ' class="report-num"') + '>' + escapeHtml(c.label) + '</th>';
        }).join('') + '</tr>';
        tableBody.innerHTML = '<tr><td colspan="' + columns.length + '" class="report-empty">' + text + '</td></tr>';
        tableFooter.innerHTML = '';
    }

    function sumColumns(rows, columns) {
        return columns.map(function (c, i) {
            if (c.kind === TEXT) return null;
            return round2(rows.reduce(function (sum, row) { return sum + number(row[i]); }, 0));
        });
    }

    function baseCells(record) {
        return [idOf(record), nameOf(record), typeOf(record)];
    }


    /* Payroll report */
    function renderPayrollReport(records) {
        var columns = [col('EMP. ID'), col('EMPLOYEE', TEXT, true), col('TYPE'), col('HOURS', NUM),
            col('GROSS PAY', MONEY), col('SSS', MONEY), col('PHILHEALTH', MONEY), col('PAG-IBIG', MONEY),
            col('TAX', MONEY), col('LOAN', MONEY), col('TOTAL DED.', MONEY), col('NET PAY', MONEY, true)];

        var rows = records.map(function (record) {
            var v = getPayrollValues(record);
            return baseCells(record).concat([v.hours, v.gross, v.sss, v.philhealth, v.pagibig,
                v.tax, v.loan, v.deductions, v.net]);
        });
        var totals = sumColumns(rows, columns);

        show(columns, rows, totals);
        updateSummary(records, { gross: totals[4], deductions: totals[10], net: totals[11] });
        setText('reportPeriodLabel', payrollPeriod.selectedOptions[0].textContent.trim());
    }


    /* Summary (cards are optional) */
    function updateSummary(records, totals) {
        setText('summaryEmployees', records.length);
        setText('summaryGross', peso(totals.gross));
        setText('summaryDeductions', peso(totals.deductions));
        setText('summaryNet', peso(totals.net));
    }


    /* Other reports */
    var simpleReports = {
        payslip: {
            columns: [col('GROSS PAY', MONEY), col('TOTAL DED.', MONEY), col('NET PAY', MONEY, true)],
            extra: function (r, v) { return [v.gross, v.deductions, v.net]; }
        },
        thirteenth: {
            columns: [col('GROSS PAY', MONEY), col('13TH MONTH PAY', MONEY, true)],
            extra: function (r, v) {
                return [v.gross, number(getValue(r, ['thirteenthMonth', 'thirteenthMonthPay', '13thMonthPay'], 0))];
            }
        },
        sss: {
            columns: [col('SSS CONTRIBUTION', MONEY)],
            extra: function (r, v) { return [v.sss]; }
        },
        philhealth: {
            columns: [col('PHILHEALTH CONTRIBUTION', MONEY)],
            extra: function (r, v) { return [v.philhealth]; }
        },
        pagibig: {
            columns: [col('PAG-IBIG CONTRIBUTION', MONEY)],
            extra: function (r, v) { return [v.pagibig]; }
        },
        bir: {
            columns: [col('WITHHOLDING TAX', MONEY)],
            extra: function (r, v) { return [v.tax]; }
        }
    };

    function renderSimpleReport(reportKey, records) {
        var def = simpleReports[reportKey];
        if (!def) { return; }

        var columns = [col('EMP. ID'), col('EMPLOYEE', TEXT, true), col('TYPE')].concat(def.columns);
        var rows = records.map(function (record) {
            return baseCells(record).concat(def.extra(record, getPayrollValues(record)));
        });
        show(columns, rows, sumColumns(rows, columns));
    }


    /* Loan Report (paper, 8.5): balances and deduction history, from the database via api/loans */
    function renderLoanReport() {
        var columns = [col('EMP. ID'), col('EMPLOYEE', TEXT, true), col('LENDER'), col('REFERENCE'),
            col('LOAN AMOUNT', MONEY), col('PER PAYROLL', MONEY), col('TOTAL DEDUCTED', MONEY), col('BALANCE', MONEY, true)];
        showLoading(columns, 'Loading loans…');

        fetch('api/loans')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (currentReport !== 'loans') return;
                if (!data.success) throw new Error(data.message);

                var search = reportSearch.value.trim().toLowerCase();
                var loans = data.loans.filter(function (l) {
                    return !search ||
                        String(l.employeeName || '').toLowerCase().includes(search) ||
                        String(l.employeeId || '').toLowerCase().includes(search);
                });
                var rows = loans.map(function (l) {
                    return [l.employeeId, l.employeeName, l.lenderLabel || l.type, l.reference || '',
                        number(l.amount), number(l.deductionPerPayroll), number(l.totalDeducted), number(l.remainingBalance)];
                });
                var totals = sumColumns(rows, columns);
                totals[5] = null; // a sum of per-payroll amounts means nothing
                show(columns, rows, totals);
            })
            .catch(function () {
                if (currentReport !== 'loans') return;
                showLoading(columns, 'Could not load loans from the server.');
            });
    }

    /* Employee List Report (paper, 8.6): from the database via api/employees */
    function renderEmployeeListReport() {
        var columns = [col('EMP. NO.'), col('EMPLOYEE', TEXT, true), col('TYPE'), col('EMAIL'),
            col('CONTACT'), col('DATE HIRED')];
        showLoading(columns, 'Loading employees…');

        fetch('api/employees')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (currentReport !== 'employees') return;
                if (!data.success) throw new Error(data.message);

                var selectedType = employeeType.value;
                var search = reportSearch.value.trim().toLowerCase();
                var employees = data.employees.filter(function (e) {
                    var typeMatch = selectedType === 'all' ||
                        (selectedType === 'both' && e.department === 'Faculty/Admin') ||
                        e.department.toLowerCase() === selectedType;
                    var searchMatch = !search ||
                        e.displayName.toLowerCase().includes(search) ||
                        String(e.employeeNumber).toLowerCase().includes(search);
                    return typeMatch && searchMatch;
                });

                show(columns, employees.map(function (e) {
                    return [e.employeeNumber, e.displayName, e.department, e.email, e.phone, e.dateHired || ''];
                }));
            })
            .catch(function (error) {
                console.error('[Reports] Employee list failed:', error);
                if (currentReport !== 'employees') return;
                showLoading(columns, 'Could not load employees from the server.');
            });
    }


    /* Select report */
    function selectReport(reportKey) {
        var def = reportDefinitions[reportKey];
        if (!def) { return; }

        currentReport = reportKey;

        reportTitle.textContent = def.title;
        reportParent.textContent = def.parent;
        reportBreadcrumb.textContent = def.breadcrumb;
        reportDescription.textContent = def.description;

        if (reportKey === 'loans') {
            renderLoanReport();
        } else if (reportKey === 'employees') {
            renderEmployeeListReport();
        } else {
            var records = filterPayrollRecords();

            if (reportKey === 'payroll') {
                renderPayrollReport(records);
            } else if (reportKey === 'thirteenth') {
                renderSimpleReport(reportKey, thirteenthMonthRecords());
            } else {
                renderSimpleReport(reportKey, records);
            }
        }

        setSidebarState(reportKey);
    }


    /* Events */
    $('generateReport').addEventListener('click', function () {
        selectReport(currentReport);
        if (window.PPToast) PPToast.success('Report generated successfully.');
    });

    [payrollPeriod, employeeType].forEach(function (el) {
        el.addEventListener('change', function () { selectReport(currentReport); });
    });

    reportSearch.addEventListener('input', function () { selectReport(currentReport); });


    /* Filter lines printed under the title of an exported file */
    function filterLines() {
        var lines = [];
        if (currentReport === 'thirteenth') {
            var p = payrollPeriod.value;
            var match = p === 'all' ? null : payrollRecords.find(function (r) { return r.periodLabel === p; });
            lines.push('Year: ' + (match ? match.periodEnd.slice(0, 4) : 'All years'));
        } else if (currentReport !== 'loans' && currentReport !== 'employees') {
            lines.push(payrollPeriod.value === 'all'
                ? 'All released payroll periods' : 'Payroll period: ' + payrollPeriod.selectedOptions[0].textContent.trim());
        }
        // Only filters actually in use.
        if (currentReport !== 'loans' && employeeType.value !== 'all') {
            lines.push(employeeType.selectedOptions[0].textContent.trim());
        }
        var search = reportSearch.value.trim();
        if (search) { lines.push('Search: "' + search + '"'); }
        return lines.length ? [lines.join('   |   ')] : [];
    }


    /* Print: only a letterhead, the title, the filters in use and the
       table (css/reports.css @media print). */
    window.addEventListener('beforeprint', function () {
        setText('printTitle', reportDefinitions[currentReport].title);
        setText('printSubtitle', filterLines().join(''));
    });

    $('printReport').addEventListener('click', function () { window.print(); });


    /* Export PDF / Excel: the server builds the file from the table on screen */
    function exportReport(format, button) {
        if (!exportData) {
            if (window.PPToast) PPToast.error('Wait for the report to finish loading.');
            return;
        }
        var label = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Exporting…';

        fetch('api/reports/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                format: format,
                title: reportDefinitions[currentReport].title,
                subtitle: filterLines(),
                columns: exportData.columns,
                rows: exportData.rows,
                totals: exportData.totals
            })
        })
            .then(function (response) {
                if (!response.ok) {
                    return response.json().catch(function () { return {}; }).then(function (data) {
                        throw new Error(data.message || 'The export failed.');
                    });
                }
                var disposition = response.headers.get('Content-Disposition') || '';
                var match = /filename="?([^";]+)"?/.exec(disposition);
                return response.blob().then(function (blob) {
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.href = url;
                    link.download = match ? match[1] : currentReport + '-report.' + format;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
                });
            })
            .catch(function (error) {
                if (window.PPToast) PPToast.error(error.message || 'The export failed.');
            })
            .then(function () {
                button.disabled = false;
                button.innerHTML = label;
            });
    }

    $('exportPdf').addEventListener('click', function () { exportReport('pdf', this); });
    $('exportExcel').addEventListener('click', function () { exportReport('xlsx', this); });


    /* Sidebar state */
    function setSidebarState(key) {
        document.querySelectorAll('.pp-reports-sidebar-link').forEach(function (a) {
            a.classList.toggle('active', a.dataset.report === key);
        });

        var parent = document.querySelector('.pp-sidebar-link[href="reports.html"]');
        if (parent) { parent.classList.add('reports-expanded'); }
    }


    /* Sidebar
       The Reports sub-menu is rendered (always open) by payrollpro-layout.js.
       On this page its links switch reports without reloading. */
    document.querySelectorAll('.pp-reports-sidebar-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            if (link.dataset.external) return; // e.g. Attendance Report has its own page

            e.preventDefault();

            selectReport(link.dataset.report);

            window.history.replaceState(
                {}, '',
                'reports.html?report=' + encodeURIComponent(link.dataset.report)
            );
        });
    });


    /* Init */
    var startKey = new URLSearchParams(location.search).get('report');

    fetch('api/payroll/released')
        .then(function (response) { return response.json(); })
        .then(function (data) {
            if (!data.success) throw new Error(data.message);
            payrollRecords = data.records;
        })
        .catch(function (error) {
            console.error('[Reports] Released payroll failed:', error);
            if (window.PPToast) PPToast.error('Could not load released payroll from the server.');
        })
        .then(function () {
            buildPayrollPeriods();
            selectReport(reportDefinitions[startKey] ? startKey : 'payroll');
        });

})();
