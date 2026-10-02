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


    /* Records */
    function getPayrollRecords() {
        return typeof DataStore === 'undefined' ? [] : DataStore.get('payroll', []);
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

    function filterPayrollRecords() {
        var selectedPeriod = payrollPeriod.value;
        var selectedType = employeeType.value;
        var search = reportSearch.value.trim().toLowerCase();

        return getPayrollRecords().filter(function (record) {
            var type = String(getValue(record, KEYS.type, '')).toLowerCase();
            var empName = String(getValue(record, KEYS.name, '')).toLowerCase();
            var empId = String(getValue(record, KEYS.id, '')).toLowerCase();

            var periodMatch = selectedPeriod === 'all' ||
                getValue(record, KEYS.period, '') === selectedPeriod;

            var typeMatch = true;
            if (selectedType === 'faculty') { typeMatch = type.includes('faculty'); }
            if (selectedType === 'admin') { typeMatch = type.includes('admin'); }
            if (selectedType === 'both') {
                typeMatch = type.includes('both') || type.includes('admin / faculty');
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
            hours: g(['hours', 'workedHours', 'totalHours'])
        };
    }


    /* Table builders */
    function headRow(columns) {
        return '<tr>' + columns.map(function (c) {
            return '<th>' + c + '</th>';
        }).join('') + '</tr>';
    }

    function bodyRows(rows, colspan) {
        if (!rows.length) {
            return '<tr><td colspan="' + colspan + '" class="report-empty">' +
                'No records found for the selected filters.</td></tr>';
        }

        return rows.map(function (cells) {
            return '<tr>' + cells.map(function (c) {
                return '<td>' + c + '</td>';
            }).join('') + '</tr>';
        }).join('');
    }


    /* Payroll report */
    function renderPayrollReport(records) {
        var columns = ['EMP. ID', 'EMPLOYEE', 'TYPE', 'HOURS', 'GROSS PAY', 'SSS',
            'PHILHEALTH', 'PAG-IBIG', 'TAX', 'LOAN', 'TOTAL DED.', 'NET PAY'];

        var t = { hours: 0, gross: 0, sss: 0, philhealth: 0, pagibig: 0,
            tax: 0, loan: 0, deductions: 0, net: 0 };

        var rows = records.map(function (record) {
            var v = getPayrollValues(record);

            Object.keys(t).forEach(function (k) { t[k] += v[k]; });

            return [
                escapeHtml(idOf(record)),
                '<strong>' + escapeHtml(nameOf(record)) + '</strong>',
                escapeHtml(typeOf(record)),
                v.hours,
                peso(v.gross), peso(v.sss), peso(v.philhealth), peso(v.pagibig),
                peso(v.tax), peso(v.loan), peso(v.deductions),
                '<strong>' + peso(v.net) + '</strong>'
            ];
        });

        tableHead.innerHTML = headRow(columns);
        tableBody.innerHTML = bodyRows(rows, columns.length);

        tableFooter.innerHTML =
            '<tr><th colspan="3">Total</th>' +
            '<th>' + t.hours + '</th>' +
            [t.gross, t.sss, t.philhealth, t.pagibig, t.tax, t.loan, t.deductions, t.net]
                .map(function (x) { return '<th>' + peso(x) + '</th>'; }).join('') +
            '</tr>';

        updateSummary(records, t);
        updateRecordHeader(records);
    }


    /* Summary (cards are optional) */
    function updateSummary(records, totals) {
        setText('summaryEmployees', records.length);
        setText('summaryGross', peso(totals.gross));
        setText('summaryDeductions', peso(totals.deductions));
        setText('summaryNet', peso(totals.net));
    }

    function updateRecordHeader(records) {
        setText('reportPeriodLabel', payrollPeriod.selectedOptions[0].textContent.trim());
        setText('reportRecordLabel', records.length + (records.length === 1 ? ' record' : ' records'));
    }


    /* Other reports */
    var simpleReports = {
        payslip: {
            columns: ['EMP. ID', 'EMPLOYEE', 'TYPE', 'GROSS PAY', 'TOTAL DED.', 'NET PAY'],
            extra: function (r, v) { return [peso(v.gross), peso(v.deductions), peso(v.net)]; }
        },
        thirteenth: {
            columns: ['EMP. ID', 'EMPLOYEE', 'TYPE', 'GROSS PAY', '13TH MONTH PAY'],
            extra: function (r, v) {
                var t = number(getValue(r,
                    ['thirteenthMonth', 'thirteenthMonthPay', '13thMonthPay'], 0));
                return [peso(v.gross), peso(t)];
            }
        },
        sss: {
            columns: ['EMP. ID', 'EMPLOYEE', 'TYPE', 'SSS CONTRIBUTION'],
            extra: function (r, v) { return [peso(v.sss)]; }
        },
        philhealth: {
            columns: ['EMP. ID', 'EMPLOYEE', 'TYPE', 'PHILHEALTH CONTRIBUTION'],
            extra: function (r, v) { return [peso(v.philhealth)]; }
        },
        pagibig: {
            columns: ['EMP. ID', 'EMPLOYEE', 'TYPE', 'PAG-IBIG CONTRIBUTION'],
            extra: function (r, v) { return [peso(v.pagibig)]; }
        },
        bir: {
            columns: ['EMP. ID', 'EMPLOYEE', 'TYPE', 'WITHHOLDING TAX'],
            extra: function (r, v) { return [peso(v.tax)]; }
        }
    };

    function renderSimpleReport(reportKey, records) {
        var def = simpleReports[reportKey];
        if (!def) { return; }

        var rows = records.map(function (record) {
            var base = [
                escapeHtml(idOf(record)),
                escapeHtml(nameOf(record)),
                escapeHtml(typeOf(record))
            ];
            return base.concat(def.extra(record, getPayrollValues(record)));
        });

        tableHead.innerHTML = headRow(def.columns);
        tableBody.innerHTML = bodyRows(rows, def.columns.length);
        tableFooter.innerHTML = '';
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

        var records = filterPayrollRecords();

        if (reportKey === 'payroll') {
            renderPayrollReport(records);
        } else {
            renderSimpleReport(reportKey, records);
        }

        setSidebarState(reportKey);
    }


    /* Events */
    $('generateReport').addEventListener('click', function () {
        selectReport(currentReport);

        if (typeof Toast !== 'undefined' && Toast.success) {
            Toast.success('Report generated successfully.');
        }
    });

    [payrollPeriod, employeeType].forEach(function (el) {
        el.addEventListener('change', function () { selectReport(currentReport); });
    });

    reportSearch.addEventListener('input', function () { selectReport(currentReport); });


    /* Print / PDF */
    $('printReport').addEventListener('click', function () { window.print(); });
    $('exportPdf').addEventListener('click', function () { window.print(); });


    /* Export Excel (CSV) */
    $('exportExcel').addEventListener('click', function () {
        var csv = [];

        document.querySelectorAll('.report-table tr').forEach(function (row) {
            var values = [];

            row.querySelectorAll('th, td').forEach(function (cell) {
                values.push('"' + cell.innerText.replace(/"/g, '""') + '"');
            });

            csv.push(values.join(','));
        });

        var blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');

        link.href = url;
        link.download = currentReport + '-report.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });


    /* Sidebar tree items */
    var NAV_ITEMS = [
        { key: 'payroll',    label: 'Payroll Report',        icon: 'bi-file-earmark-text' },
        { key: 'payslip',    label: 'Payslip',               icon: 'bi-receipt' },
        { key: 'thirteenth', label: '13th Month Pay',        icon: 'bi-calendar-check' },
        { key: 'sss',        label: 'SSS Remittance',        icon: 'bi-bank' },
        { key: 'philhealth', label: 'PhilHealth Remittance', icon: 'bi-heart-pulse' },
        { key: 'pagibig',    label: 'Pag-IBIG Remittance',   icon: 'bi-house-door' },
        { key: 'bir',        label: 'BIR Remittance',        icon: 'bi-journal-text' }
    ];


    /* Sidebar state */
    function setSidebarState(key) {
        document.querySelectorAll('.pp-reports-sidebar-link').forEach(function (a) {
            a.classList.toggle('active', a.dataset.report === key);
        });

        var parent = document.querySelector('.pp-sidebar-link[href="reports.html"]');
        var group = document.querySelector('.pp-reports-sidebar-group');

        if (parent) { parent.classList.add('reports-expanded'); }
        if (group) { group.classList.add('is-open'); }
    }


    /* Sidebar tree */
    var reportsSidebarLink = document.querySelector('.pp-sidebar-link[href="reports.html"]');

    if (reportsSidebarLink) {

        var reportsGroup = document.querySelector('.pp-reports-sidebar-group');

        if (!reportsGroup) {
            reportsGroup = document.createElement('div');
            reportsGroup.className = 'pp-reports-sidebar-group';

            reportsGroup.innerHTML = NAV_ITEMS.map(function (item) {
                return '<a href="reports.html?report=' + item.key + '"' +
                    ' class="pp-reports-sidebar-link" data-report="' + item.key + '">' +
                    '<i class="bi ' + item.icon + '"></i>' +
                    '<span>' + item.label + '</span></a>';
            }).join('');

            reportsSidebarLink.parentNode.insertBefore(
                reportsGroup,
                reportsSidebarLink.nextSibling
            );
        }

        /* Chevron */
        if (!reportsSidebarLink.querySelector('.pp-reports-chevron')) {
            var chevron = document.createElement('i');
            chevron.className = 'bi bi-chevron-down pp-reports-chevron';
            reportsSidebarLink.appendChild(chevron);
        }

        /* Item clicks */
        reportsGroup.querySelectorAll('.pp-reports-sidebar-link').forEach(function (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();

                selectReport(link.dataset.report);

                window.history.replaceState(
                    {}, '',
                    'reports.html?report=' + encodeURIComponent(link.dataset.report)
                );
            });
        });

        /* Open / close */
        reportsSidebarLink.addEventListener('click', function (e) {
            e.preventDefault();

            var isOpen = reportsGroup.classList.contains('is-open');

            reportsGroup.classList.toggle('is-open', !isOpen);
            reportsSidebarLink.classList.toggle('reports-expanded', !isOpen);
        });

    }


    /* Init */
    var startKey = new URLSearchParams(location.search).get('report');

    buildPayrollPeriods();
    selectReport(reportDefinitions[startKey] ? startKey : 'payroll');

})();