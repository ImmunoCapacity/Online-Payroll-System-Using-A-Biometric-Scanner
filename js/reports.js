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
        leave: {
            title: 'Leave Report', breadcrumb: 'Leave Report', parent: 'Employees',
            description: 'Leave taken by each employee per leave type: the dates, paid and unpaid days, and the paid days left for the year.'
        },
        employees: {
            title: 'Employee List Report', breadcrumb: 'Employee List', parent: 'Employees',
            description: 'Complete list of admin and faculty staff and their employment details.'
        }
    };

    var currentReport = 'payroll';

    /* Payslip and 13th Month Pay: the record/group behind each rendered row,
       by index, so clicking a row can look up its full breakdown. Both null
       on every other report. */
    var rowRecords = null;
    var rowReportKey = null;


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
                    employee: r.employee,
                    employeeType: r.employeeType,
                    gross: 0,
                    benefits: 0,
                    // One entry per calendar month (Jan–Dec); null until a released
                    // cut-off ending in that month contributes gross pay to it.
                    months: [null, null, null, null, null, null, null, null, null, null, null, null]
                };
                order.push(key);
            }
            var row = groups[key];
            row.gross += number(r.gross);
            var m = Number(r.periodEnd.slice(5, 7)) - 1;
            row.months[m] = round2((row.months[m] || 0) + number(r.gross));
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
    var MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    function col(label, kind, strong) {
        return { label: label, kind: kind || TEXT, strong: !!strong };
    }

    function cellHtml(column, value) {
        var html = column.kind === MONEY ? (value == null ? '' : peso(value))
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


    /* Payslip detail (offcanvas): laid out like the emailed payslip
       (PayslipPdf on the server) — same rows, columns and wording as the
       breakdown shown while processing (js/payroll-processing.js), fetched
       fresh from api/payroll/runs since a released period keeps its full
       breakdown there. */

    function num2(n) {
        return (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function hrs(n) {
        return String(Math.round((Number(n) || 0) * 100) / 100);
    }

    function calcGross(emp) {
        if (emp.earnings) {
            return round2(emp.earnings.reduce(function (s, e) { return s + e.amount; }, 0));
        }
        return round2(emp.hours * emp.rate);
    }

    function calcBenefitsTotal(benefits) {
        return round2((benefits || []).reduce(function (s, b) { return s + b.amount; }, 0));
    }

    function calcDeductionsTotal(d) {
        return round2(d.sss + d.philhealth + d.pagibig + d.bir + d.loan);
    }

    function calcNet(emp) {
        return round2(calcGross(emp) + calcBenefitsTotal(emp.benefits) - calcDeductionsTotal(emp.deductions));
    }

    function skippedLoans(emp) {
        return (emp.loanItems || []).filter(function (l) { return l.skipped; });
    }

    /** Earnings lines grouped into the payslip rows (same rule as the PDF). */
    function payslipEarnings(emp) {
        var rows = { lecture: null, office: null, leave: null, holiday: null, adjustment: null, late: null };
        function add(key, l) {
            var r = rows[key] || (rows[key] = { hours: 0, amount: 0, rate: null, mixed: false });
            r.hours += Number(l.hours) || 0;
            r.amount += Number(l.amount) || 0;
            if (l.rate != null) {
                if (r.rate != null && Number(r.rate) !== Number(l.rate)) r.mixed = true;
                r.rate = l.rate;
            }
        }
        var lines = emp.earnings || [{ label: emp.type === 'Faculty' ? 'teaching' : 'office', hours: emp.hours, rate: emp.rate, amount: calcGross(emp) }];
        lines.forEach(function (l) {
            var label = String(l.label || '').toLowerCase();
            add(label.indexOf('adjustment') === 0 ? 'adjustment'
                : label.indexOf('late deduction') === 0 ? 'late'
                : label.indexOf('holiday') !== -1 ? 'holiday'
                : label.indexOf('teaching') !== -1 ? 'lecture'
                : label.indexOf('office') !== -1 ? 'office'
                : label.indexOf('leave') !== -1 ? 'leave' : 'adjustment', l);
        });
        return rows;
    }

    /** Loans as on the payslip: SSS loan, Pag-IBIG loan, others (the server's rule). */
    function payslipLoans(emp) {
        var sss = 0, pagibig = 0, other = 0;
        if (emp.loanItems && emp.loanItems.length) {
            emp.loanItems.forEach(function (l) {
                var t = String(l.type || '').toLowerCase();
                var a = Number(l.amount) || 0;
                if (t.indexOf('sss') !== -1) sss += a;
                else if (t.indexOf('pag-ibig') !== -1 || t.indexOf('pagibig') !== -1) pagibig += a;
                else other += a;
            });
        } else {
            other = Number(emp.deductions.loan) || 0;
        }
        return { sss: sss, pagibig: pagibig, other: other };
    }

    function psRow(label, hours, rate, amount) {
        return '<tr><td>' + label + '</td>' +
            '<td class="num">' + hours + '</td><td class="num">' + rate + '</td><td class="num">' + amount + '</td></tr>';
    }

    function showPayslip(emp, periodLabel) {
        var ded = emp.deductions;
        var e = payslipEarnings(emp);
        function earningRow(label, r) {
            return psRow(label, r ? hrs(r.hours) : '', r && r.rate != null && !r.mixed ? num2(r.rate) : '', r ? num2(r.amount) : '');
        }
        var applied = calcGross(emp);
        var benefits = calcBenefitsTotal(emp.benefits);
        var loans = payslipLoans(emp);

        $('breakdownBody').innerHTML =
            '<table class="pp-payslip">' +
                '<tbody class="pp-payslip-info">' +
                    '<tr><th>Payroll Computation For:</th><td colspan="3">' + escapeHtml(String(periodLabel).toUpperCase()) + '</td></tr>' +
                    '<tr><th>Employee No.</th><td colspan="3">' + escapeHtml(emp.employeeNumber) + '</td></tr>' +
                    '<tr><th>Employee Name</th><td colspan="3">' + escapeHtml(String(emp.name).toUpperCase()) + '</td></tr>' +
                    '<tr><th>Designation</th><td colspan="3">' + escapeHtml(String(emp.designation || emp.type).toUpperCase()) + '</td></tr>' +
                '</tbody>' +
                '<tbody>' +
                    '<tr class="pp-payslip-head"><td></td><td class="num">Hrs Worked</td><td class="num">Rate</td><td class="num">Applied Salary</td></tr>' +
                    earningRow('No. of Hours Lecture', e.lecture) +
                    earningRow('No. of Office Hours', e.office) +
                    (e.leave ? earningRow('Paid Leave', e.leave) : '') +
                    earningRow('Holiday', e.holiday) +
                    earningRow('Adjustment', e.adjustment) +
                    (e.late ? earningRow('Late Deduction', e.late) : '') +
                    '<tr class="pp-payslip-total"><td></td><td colspan="2">Total Applied Salary</td><td class="num">' + num2(applied) + '</td></tr>' +
                '</tbody>' +
                '<tbody>' +
                    '<tr class="pp-payslip-section"><td colspan="4">Benefits</td></tr>' +
                    ((emp.benefits || []).length
                        ? emp.benefits.map(function (b) {
                            return '<tr><td colspan="3">' + escapeHtml(String(b.name).toUpperCase()) + '</td><td class="num">' + num2(b.amount) + '</td></tr>';
                        }).join('')
                        : '<tr><td colspan="3">NONE</td><td class="num">0.00</td></tr>') +
                    '<tr class="pp-payslip-total"><td></td><td colspan="2">Gross Pay</td><td class="num">' + num2(applied + benefits) + '</td></tr>' +
                '</tbody>' +
                '<tbody>' +
                    '<tr class="pp-payslip-section"><td colspan="4">Deductions</td></tr>' +
                    [['SSS Contri', ded.sss], ['Pag-IBIG', ded.pagibig], ['PhilHealth', ded.philhealth], ['Tax', ded.bir],
                     ['SSS Loan', loans.sss], ['Pag-IBIG Loan', loans.pagibig], ['Other Deductions', loans.other]].map(function (d) {
                        return '<tr><td colspan="2">' + d[0].toUpperCase() + '</td><td class="num">' + num2(d[1]) + '</td><td></td></tr>';
                    }).join('') +
                    '<tr class="pp-payslip-total"><td colspan="2" class="num">Total Deductions</td><td class="num">' + num2(calcDeductionsTotal(ded)) + '</td><td></td></tr>' +
                '</tbody>' +
                '<tbody><tr class="pp-payslip-net"><td colspan="3">Net Pay</td><td class="num">' + num2(calcNet(emp)) + '</td></tr></tbody>' +
            '</table>' +
            (emp.overlapHours
                ? '<p class="pp-payslip-note">' + emp.overlapHours + ' office hrs overlapped approved classes and were not counted twice.</p>'
                : '') +
            (emp.unapprovedClasses
                ? '<p class="pp-payslip-note text-warning">' + emp.unapprovedClasses +
                  ' scheduled class(es) not yet approved in Faculty Teaching Hours — not paid.</p>'
                : '') +
            skippedLoans(emp).map(function (l) {
                return '<p class="pp-payslip-note text-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>' +
                    escapeHtml(l.lender || l.type) + ' loan' + (l.reference ? ' ' + escapeHtml(l.reference) : '') +
                    ' (' + peso(l.scheduled) + ') skipped — pay wasn\'t enough. The loan runs one month longer.</p>';
            }).join('');

        $('breakdownTitle').textContent = 'Payslip — ' + emp.name;
        new bootstrap.Offcanvas($('breakdownPanel')).show();
    }

    function openPayslip(record) {
        fetch('api/payroll/runs?from=' + encodeURIComponent(record.periodStart) + '&to=' + encodeURIComponent(record.periodEnd))
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success || !data.run) throw new Error(data.message || 'Could not load this payslip.');
                var emp = data.run.employees.find(function (e) { return e.id === record.employeeKey; });
                if (!emp) throw new Error('This payslip could not be found.');
                showPayslip(emp, record.periodLabel);
            })
            .catch(function (error) {
                if (window.PPToast) PPToast.error(error.message || 'Could not load this payslip.');
            });
    }

    var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    /** 13th Month Pay (PD 851): gross pay earned each month of the year (Jan–Dec), then the total ÷ 12. */
    function show13thMonthBreakdown(row) {
        $('breakdownBody').innerHTML =
            '<table class="pp-payslip">' +
                '<tbody class="pp-payslip-info">' +
                    '<tr><th>Employee No.</th><td colspan="3">' + escapeHtml(row.employeeId) + '</td></tr>' +
                    '<tr><th>Employee Name</th><td colspan="3">' + escapeHtml(String(row.employee).toUpperCase()) + '</td></tr>' +
                    '<tr><th>Position</th><td colspan="3">' + escapeHtml(PayrollProLayout.staffTypeLabel(row.employeeType)) + '</td></tr>' +
                '</tbody>' +
                '<tbody>' +
                    '<tr class="pp-payslip-head"><td>Month</td><td class="num"></td><td class="num"></td><td class="num">Gross Pay</td></tr>' +
                    MONTH_NAMES.map(function (name, i) {
                        var g = row.months[i];
                        return '<tr><td colspan="3">' + name + '</td><td class="num">' + (g == null ? '—' : num2(g)) + '</td></tr>';
                    }).join('') +
                    '<tr class="pp-payslip-total"><td colspan="3">Total Gross Pay</td><td class="num">' + num2(row.gross) + '</td></tr>' +
                '</tbody>' +
                '<tbody><tr class="pp-payslip-net"><td colspan="3">13th Month Pay (Total Gross Pay ÷ 12)</td><td class="num">' + num2(row.thirteenthMonth) + '</td></tr></tbody>' +
            '</table>';

        $('breakdownTitle').textContent = '13th Month Pay — ' + row.employee;
        new bootstrap.Offcanvas($('breakdownPanel')).show();
    }


    /* Payroll report */
    function renderPayrollReport(records) {
        var columns = [col('EMP. ID'), col('EMPLOYEE NAME', TEXT, true), col('POSITION'), col('TOTAL HOURS', NUM),
            col('GROSS PAY', MONEY), col('SSS', MONEY), col('PHILHEALTH', MONEY), col('PAG-IBIG', MONEY),
            col('TAX', MONEY), col('LOAN', MONEY), col('TOTAL DEDUCTION', MONEY), col('NET PAY', MONEY, true)];

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
            columns: [col('GROSS PAY', MONEY), col('TOTAL DEDUCTION', MONEY), col('NET PAY', MONEY, true)],
            extra: function (r, v) { return [v.gross, v.deductions, v.net]; }
        },
        thirteenth: {
            columns: MONTH_ABBR.map(function (m) { return col(m, MONEY); })
                .concat([col('GROSS PAY', MONEY), col('13TH MONTH PAY', MONEY, true)]),
            extra: function (r, v) {
                var months = (r.months || []).map(function (m) { return m == null ? null : number(m); });
                while (months.length < 12) { months.push(null); }
                return months.concat([v.gross, number(getValue(r, ['thirteenthMonth', 'thirteenthMonthPay', '13thMonthPay'], 0))]);
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

        var columns = [col('EMP. ID'), col('EMPLOYEE NAME', TEXT, true), col('POSITION')].concat(def.columns);
        var rows = records.map(function (record) {
            return baseCells(record).concat(def.extra(record, getPayrollValues(record)));
        });
        show(columns, rows, sumColumns(rows, columns));

        var clickable = reportKey === 'payslip' || reportKey === 'thirteenth';
        rowRecords = clickable ? records : null;
        rowReportKey = clickable ? reportKey : null;
        tableBody.classList.toggle('report-rows-clickable', clickable);
        $('payslipHint').classList.toggle('d-none', !clickable);
        if (clickable) {
            setText('payslipHintText', reportKey === 'payslip'
                ? "Click a row to view that employee's payslip."
                : "Click a row to view that employee's 13th month pay breakdown.");
        }
    }


    /* Loan Report (paper, 8.5): balances and deduction history, from the database via api/loans */
    function renderLoanReport() {
        var columns = [col('EMP. ID'), col('EMPLOYEE NAME', TEXT, true), col('LENDER'), col('REFERENCE'),
            col('LOAN AMOUNT', MONEY), col('INTEREST (%)'), col('MONTHLY', MONEY), col('TOTAL DEDUCTED', MONEY), col('BALANCE', MONEY, true)];
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
                        number(l.amount), number(l.interestRate).toFixed(2) + '%', number(l.deductionPerPayroll), number(l.totalDeducted), number(l.remainingBalance)];
                });
                var totals = sumColumns(rows, columns);
                totals[6] = null; // a sum of monthly amounts means nothing
                show(columns, rows, totals);
            })
            .catch(function () {
                if (currentReport !== 'loans') return;
                showLoading(columns, 'Could not load loans from the server.');
            });
    }

    /* Employee List Report (paper, 8.6): from the database via api/employees */
    function renderEmployeeListReport() {
        var columns = [col('EMP. NO.'), col('EMPLOYEE NAME', TEXT, true), col('POSITION'), col('EMAIL'),
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
                    return [e.employeeNumber, e.displayName, PayrollProLayout.staffTypeLabel(e.department), e.email, e.phone, e.dateHired || ''];
                }));
            })
            .catch(function (error) {
                console.error('[Reports] Employee list failed:', error);
                if (currentReport !== 'employees') return;
                showLoading(columns, 'Could not load employees from the server.');
            });
    }


    /* Leave Report: recorded leave (api/leave/requests) for the chosen year,
       one row per employee and leave type, with the paid days left of that
       type (Maintenance → Leave Categories). Read live, so leave recorded in
       Leave Management shows here right away. */
    var leaveYear = $('leaveYear');

    (function fillLeaveYears() {
        var now = new Date().getFullYear();
        for (var y = now + 1; y >= now - 4; y--) {
            leaveYear.add(new Option(String(y), String(y), false, y === now));
        }
    })();

    function shortDate(iso) {
        var p = iso.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function leaveDates(l) {
        return l.dateFrom === l.dateTo ? shortDate(l.dateFrom) : shortDate(l.dateFrom) + '–' + shortDate(l.dateTo);
    }

    function renderLeaveReport() {
        var columns = [col('EMP. ID'), col('EMPLOYEE NAME', TEXT, true), col('POSITION'), col('LEAVE TYPE'), col('DATES'),
            col('PAID DAYS', NUM), col('UNPAID DAYS', NUM), col('PAID DAYS LEFT')];
        showLoading(columns, 'Loading leave…');
        var year = leaveYear.value;

        Promise.all([
            fetch('api/leave/requests').then(function (r) { return r.json(); }),
            fetch('api/leave/balance/all?year=' + year).then(function (r) { return r.json(); })
        ]).then(function (results) {
            if (currentReport !== 'leave' || leaveYear.value !== year) return;
            if (!results[0].success) throw new Error(results[0].message);
            if (!results[1].success) throw new Error(results[1].message);
            var balances = results[1].balances;

            var selectedType = employeeType.value;
            var search = reportSearch.value.trim().toLowerCase();
            var groups = {};
            results[0].requests
                .filter(function (l) {
                    var typeMatch = selectedType === 'all' ||
                        (selectedType === 'both' && l.employeeType === 'Faculty/Admin') ||
                        String(l.employeeType).toLowerCase() === selectedType;
                    var searchMatch = !search ||
                        String(l.employeeName).toLowerCase().includes(search) ||
                        String(l.employeeNumber).toLowerCase().includes(search);
                    return l.dateFrom.slice(0, 4) === year && typeMatch && searchMatch;
                })
                .sort(function (a, b) { return a.dateFrom.localeCompare(b.dateFrom); })
                .forEach(function (l) {
                    var key = l.employeeId + '|' + l.categoryId;
                    var g = groups[key] || (groups[key] = {
                        employeeId: l.employeeId, id: l.employeeNumber, name: l.employeeName, type: l.employeeType,
                        category: l.category, categoryId: l.categoryId, dates: [], paid: 0, unpaid: 0
                    });
                    g.dates.push(leaveDates(l) + (l.paid ? '' : ' (unpaid)'));
                    if (l.paid) g.paid += Number(l.days) || 0; else g.unpaid += Number(l.days) || 0;
                });

            var rows = Object.keys(groups).map(function (k) { return groups[k]; })
                .sort(function (a, b) { return a.name.localeCompare(b.name) || a.category.localeCompare(b.category); })
                .map(function (g) {
                    var b = (balances[g.employeeId] || []).find(function (x) { return x.categoryId === g.categoryId; });
                    var left = b ? b.remaining + ' of ' + b.total : '—';
                    return [g.id, g.name, PayrollProLayout.staffTypeLabel(g.type), g.category, g.dates.join(', '), g.paid, g.unpaid, left];
                });
            var totals = sumColumns(rows, columns);
            show(columns, rows, totals, 'No leave recorded for ' + year + ' with the selected filters.');
        }).catch(function (error) {
            console.error('[Reports] Leave report failed:', error);
            if (currentReport !== 'leave') return;
            showLoading(columns, 'Could not load leave from the server.');
        });
    }

    leaveYear.addEventListener('change', function () { selectReport(currentReport); });


    /* Select report */
    function selectReport(reportKey) {
        var def = reportDefinitions[reportKey];
        if (!def) { return; }

        currentReport = reportKey;

        rowRecords = null;
        rowReportKey = null;
        tableBody.classList.remove('report-rows-clickable');
        $('payslipHint').classList.add('d-none');

        reportTitle.textContent = def.title;
        reportParent.textContent = def.parent;
        reportBreadcrumb.textContent = def.breadcrumb;
        reportDescription.textContent = def.description;

        // Leave is by year; the payroll period filter doesn't apply to it.
        $('leaveYearFilter').classList.toggle('d-none', reportKey !== 'leave');
        $('payrollPeriodFilter').classList.toggle('d-none', reportKey === 'leave');
        // Only administrative staff have leave, so the Leave Report has no Faculty choice.
        var facultyOption = employeeType.querySelector('option[value="faculty"]');
        facultyOption.hidden = reportKey === 'leave';
        if (reportKey === 'leave' && employeeType.value === 'faculty') employeeType.value = 'all';

        if (reportKey === 'leave') {
            renderLeaveReport();
        } else if (reportKey === 'loans') {
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

    tableBody.addEventListener('click', function (e) {
        if (!rowRecords) return;
        var row = e.target.closest('tr');
        if (!row) return;
        var index = Array.prototype.indexOf.call(tableBody.children, row);
        var record = rowRecords[index];
        if (!record) return;
        if (rowReportKey === 'payslip') openPayslip(record);
        else if (rowReportKey === 'thirteenth') show13thMonthBreakdown(record);
    });


    /* Filter lines printed under the title of an exported file */
    function filterLines() {
        var lines = [];
        if (currentReport === 'thirteenth') {
            var p = payrollPeriod.value;
            var match = p === 'all' ? null : payrollRecords.find(function (r) { return r.periodLabel === p; });
            lines.push('Year: ' + (match ? match.periodEnd.slice(0, 4) : 'All years'));
        } else if (currentReport === 'leave') {
            lines.push('Year: ' + leaveYear.value);
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

    /** The Position filter's Faculty/Faculty-Admin option text follows their renamed display name; values stay fixed custom codes. */
    function applyBuiltInTypeLabels() {
        var opt = employeeType.querySelector('option[value="faculty"]');
        if (opt) opt.textContent = PayrollProLayout.staffTypeLabel('Faculty');
        opt = employeeType.querySelector('option[value="both"]');
        if (opt) opt.textContent = PayrollProLayout.staffTypeLabel('Faculty/Admin');
    }

    PayrollProLayout.loadStaffTypeLabels().then(function () {
        applyBuiltInTypeLabels();
        return fetch('api/payroll/released');
    })
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
