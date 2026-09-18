(function () {
    PayrollProLayout.init({
        activeNav: 'payroll',
        user: { name: 'Maria Elena Reyes', role: 'Payroll Master', initials: 'MR' },
        institution: { name: 'STI Balayan', short: 'STI' }
    });

    var PERIODS = {
        '2026-07-01': {
            label: 'Jul 1 – Jul 15, 2026',
            status: 'processing',
            payDate: '2026-07-16',
            computed: true,
            employees: null
        },
        '2026-06-16': {
            label: 'Jun 16 – Jun 30, 2026',
            status: 'released',
            payDate: '2026-07-01',
            computed: true,
            employees: 'released'
        },
        '2026-07-16': {
            label: 'Jul 16 – Jul 31, 2026',
            status: 'open',
            payDate: '2026-08-01',
            computed: false,
            employees: null
        }
    };

    // Per-employee demo payroll inputs (deductions/benefits for this run).
    // Employees without a preset here fall back to a zeroed default so any
    // employee added in Employee Records can still run through payroll.
    var DEMO_PAYROLL_INPUTS = {
        'EMP-2021-014': { deductions: { bir: 4250, philhealth: 680, pagibig: 200, loan: 0 }, benefits: { chalk: 500, internet: 800 }, status: 'reviewed' },
        'EMP-2022-031': { deductions: { bir: 5100, philhealth: 720, pagibig: 200, loan: 1500 }, benefits: { chalk: 500 }, status: 'reviewed' },
        'EMP-1002': { deductions: { bir: 2180, philhealth: 420, pagibig: 200, loan: 0 }, benefits: { rice: 1500 }, status: 'computed' },
        'EMP-2020-052': { deductions: { bir: 3200, philhealth: 580, pagibig: 200, loan: 800 }, benefits: {}, status: 'computed' },
        'EMP-1004': { deductions: { bir: 1950, philhealth: 390, pagibig: 200, loan: 0 }, benefits: { rice: 1500, laundry: 300 }, status: 'reviewed' },
        'EMP-2024-003': { deductions: { bir: 2100, philhealth: 450, pagibig: 200, loan: 0 }, benefits: { chalk: 500 }, status: 'computed' }
    };

    function buildEmployeesForPayroll() {
        return DataStore.getEmployees()
            .filter(function (e) { return e.status === 'Active'; })
            .map(function (e) {
                var demo = DEMO_PAYROLL_INPUTS[e.id] || { deductions: { bir: 0, philhealth: 0, pagibig: 0, loan: 0 }, benefits: {}, status: 'computed' };
                return {
                    id: e.id,
                    name: e.displayName,
                    type: e.type,
                    units: e.units || 0,
                    rate: e.rate || 0,
                    rateType: e.rateType === 'Per Hour' ? 'per hour' : 'per unit',
                    deductions: Object.assign({}, demo.deductions),
                    benefits: Object.assign({}, demo.benefits),
                    status: demo.status
                };
            });
    }

    var EMPLOYEES = buildEmployeesForPayroll();

    var payrollData = {};
    var currentPeriod = '2026-07-01';

    function peso(n) {
        return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function calcGross(emp) {
        return emp.units * emp.rate;
    }

    function calcDeductionsTotal(d) {
        return d.bir + d.philhealth + d.pagibig + d.loan;
    }

    function calcBenefitsTotal(b) {
        return Object.values(b).reduce(function (s, v) { return s + v; }, 0);
    }

    function calcNet(emp) {
        return calcGross(emp) + calcBenefitsTotal(emp.benefits) - calcDeductionsTotal(emp.deductions);
    }

    function cloneEmployees() {
        return EMPLOYEES.map(function (e) {
            return {
                id: e.id, name: e.name, type: e.type,
                units: e.units, rate: e.rate, rateType: e.rateType,
                deductions: Object.assign({}, e.deductions),
                benefits: Object.assign({}, e.benefits),
                status: e.status
            };
        });
    }

    function initPeriodData() {
        payrollData['2026-07-01'] = cloneEmployees();
        payrollData['2026-06-16'] = cloneEmployees().map(function (e) {
            e.status = 'released';
            return e;
        });
    }

    function statusBadge(status) {
        var map = {
            computed: ['pp-badge-computed', 'Computed'],
            reviewed: ['pp-badge-reviewed', 'Reviewed'],
            released: ['pp-badge-released', 'Released']
        };
        var item = map[status] || map.computed;
        return '<span class="pp-badge ' + item[0] + '">' + item[1] + '</span>';
    }

    function typeBadge(type) {
        return '<span class="pp-badge ' + (type === 'Faculty' ? 'pp-badge-faculty' : 'pp-badge-admin') + '">' + type + '</span>';
    }

    function periodStatusBadge(status) {
        var labels = { open: 'Open', processing: 'Processing', released: 'Released', closed: 'Closed' };
        return '<span class="pp-period-badge ' + status + '" id="periodBadge">' + (labels[status] || status) + '</span>';
    }

    function getEmployees() {
        return payrollData[currentPeriod] || [];
    }

    function updateTotals() {
        var employees = getEmployees();
        var gross = 0, ded = 0, net = 0;
        employees.forEach(function (emp) {
            gross += calcGross(emp) + calcBenefitsTotal(emp.benefits);
            ded += calcDeductionsTotal(emp.deductions);
            net += calcNet(emp);
        });
        document.getElementById('totalGross').textContent = peso(gross);
        document.getElementById('totalDeductions').textContent = peso(ded);
        document.getElementById('totalNet').textContent = peso(net);
    }

    function allReviewed() {
        var employees = getEmployees();
        return employees.length > 0 && employees.every(function (e) {
            return e.status === 'reviewed' || e.status === 'released';
        });
    }

    function updateReleaseButton() {
        var period = PERIODS[currentPeriod];
        var btn = document.getElementById('btnRelease');
        btn.disabled = !period.computed || !allReviewed() || period.status === 'released';
    }

    function renderTable() {
        var employees = getEmployees();
        var tbody = document.getElementById('payrollBody');
        var empty = document.getElementById('emptyPayroll');
        var period = PERIODS[currentPeriod];

        if (!period.computed || employees.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            updateTotals();
            updateReleaseButton();
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = employees.map(function (emp, idx) {
            var gross = calcGross(emp);
            var dedTotal = calcDeductionsTotal(emp.deductions);
            var net = calcNet(emp);
            var unitsLabel = emp.type === 'Faculty'
                ? emp.units + ' units'
                : emp.units + ' hrs';

            return (
                '<tr data-idx="' + idx + '">' +
                    '<td><strong>' + emp.name + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + emp.id + '</span></td>' +
                    '<td>' + typeBadge(emp.type) + '</td>' +
                    '<td class="col-units">' + unitsLabel + '</td>' +
                    '<td class="col-money">' + peso(gross) + '</td>' +
                    '<td class="col-money">' + peso(dedTotal) + '</td>' +
                    '<td class="col-money"><strong>' + peso(net) + '</strong></td>' +
                    '<td>' + statusBadge(emp.status) + '</td>' +
                    '<td><button type="button" class="pp-btn-link btn-breakdown" data-idx="' + idx + '">View Breakdown</button></td>' +
                '</tr>'
            );
        }).join('');

        tbody.querySelectorAll('.btn-breakdown').forEach(function (btn) {
            btn.addEventListener('click', function () {
                showBreakdown(parseInt(btn.dataset.idx, 10));
            });
        });

        updateTotals();
        updateReleaseButton();
    }

    function showBreakdown(idx) {
        var emp = getEmployees()[idx];
        if (!emp) return;

        var gross = calcGross(emp);
        var benefits = calcBenefitsTotal(emp.benefits);
        var ded = emp.deductions;
        var dedTotal = calcDeductionsTotal(ded);
        var net = calcNet(emp);

        var benefitsHtml = Object.keys(emp.benefits).length
            ? Object.keys(emp.benefits).map(function (k) {
                return '<div class="pp-breakdown-line"><span>' + k.charAt(0).toUpperCase() + k.slice(1) + ' Allowance</span><span class="amount">' + peso(emp.benefits[k]) + '</span></div>';
            }).join('')
            : '<div class="pp-breakdown-line"><span class="text-muted">No benefits applied</span><span class="amount">₱0.00</span></div>';

        document.getElementById('breakdownTitle').textContent = emp.name;
        document.getElementById('breakdownBody').innerHTML =
            '<p class="pp-breakdown-meta">' + emp.id + ' · ' + emp.type + ' · ' + emp.units + ' ' + (emp.type === 'Faculty' ? 'units' : 'hours') + ' @ ' + peso(emp.rate) + ' ' + emp.rateType + '</p>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-section-title">Earnings</div>' +
                '<div class="pp-breakdown-line"><span>Gross Pay</span><span class="amount">' + peso(gross) + '</span></div></div>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-section-title">Benefits</div>' + benefitsHtml + '</div>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-section-title">Deductions</div>' +
                '<div class="pp-breakdown-line"><span>BIR Tax</span><span class="amount">' + peso(ded.bir) + '</span></div>' +
                '<div class="pp-breakdown-line"><span>PhilHealth</span><span class="amount">' + peso(ded.philhealth) + '</span></div>' +
                '<div class="pp-breakdown-line"><span>Pag-IBIG</span><span class="amount">' + peso(ded.pagibig) + '</span></div>' +
                '<div class="pp-breakdown-line"><span>Loan Repayment</span><span class="amount">' + peso(ded.loan) + '</span></div>' +
                '<div class="pp-breakdown-line total"><span>Total Deductions</span><span class="amount">' + peso(dedTotal) + '</span></div></div>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-line total"><span>Net Pay</span><span class="amount" style="color:var(--pp-accent);font-size:1.125rem;">' + peso(net) + '</span></div></div>' +
            (emp.status === 'computed'
                ? '<button type="button" class="btn btn-pp-primary w-100" id="btnMarkReviewed">Mark as Reviewed</button>'
                : '');

        if (emp.status === 'computed') {
            document.getElementById('btnMarkReviewed').addEventListener('click', function () {
                emp.status = 'reviewed';
                renderTable();
                bootstrap.Offcanvas.getInstance(document.getElementById('breakdownPanel')).hide();
            });
        }

        new bootstrap.Offcanvas(document.getElementById('breakdownPanel')).show();
    }

    function populatePeriodSelect() {
        var sel = document.getElementById('periodSelect');
        sel.innerHTML = Object.keys(PERIODS).map(function (key) {
            return '<option value="' + key + '">' + PERIODS[key].label + '</option>';
        }).join('');
        sel.value = currentPeriod;
    }

    function onPeriodChange() {
        currentPeriod = document.getElementById('periodSelect').value;
        var period = PERIODS[currentPeriod];
        document.getElementById('periodBadge').outerHTML = periodStatusBadge(period.status);
        document.getElementById('btnRunPayroll').disabled = period.status === 'released' || period.status === 'closed';
        renderTable();
    }

    document.getElementById('periodSelect').addEventListener('change', onPeriodChange);

    document.getElementById('btnRunPayroll').addEventListener('click', function () {
        var btn = this;
        var period = PERIODS[currentPeriod];
        if (period.computed) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Computing…';

        setTimeout(function () {
            payrollData[currentPeriod] = cloneEmployees();
            period.computed = true;
            period.status = 'processing';
            document.getElementById('periodBadge').outerHTML = periodStatusBadge('processing');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-play-fill me-1"></i> Run Payroll';
            renderTable();
        }, 1800);
    });

    function persistReleasedPayroll(period) {
        var records = DataStore.get('payroll', []);
        getEmployees().forEach(function (emp) {
            records.push({
                id: DataStore.nextNumericId(records),
                employeeId: emp.id,
                employee: emp.name,
                periodLabel: period.label,
                payDate: period.payDate,
                gross: calcGross(emp),
                benefits: calcBenefitsTotal(emp.benefits),
                deductions: calcDeductionsTotal(emp.deductions),
                net: calcNet(emp),
                dateGenerated: new Date().toISOString()
            });
        });
        DataStore.set('payroll', records);
    }

    document.getElementById('btnRelease').addEventListener('click', function () {
        if (!allReviewed()) return;
        var period = PERIODS[currentPeriod];
        getEmployees().forEach(function (e) { e.status = 'released'; });
        period.status = 'released';
        document.getElementById('periodBadge').outerHTML = periodStatusBadge('released');
        updateReleaseButton();
        persistReleasedPayroll(period);
        renderTable();
        PPToast.success('Payslips released for ' + period.label + '. Employees can now view them in the Staff Module.');
    });

    initPeriodData();
    populatePeriodSelect();
    onPeriodChange();
})();
