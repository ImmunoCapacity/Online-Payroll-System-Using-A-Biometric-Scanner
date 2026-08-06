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

    var EMPLOYEES = [
        {
            id: 'EMP-2021-014', name: 'Dr. Maria Santos', type: 'Faculty',
            units: 18, rate: 850, rateType: 'per unit',
            deductions: { bir: 4250, philhealth: 680, pagibig: 200, loan: 0 },
            benefits: { chalk: 500, internet: 800 },
            status: 'reviewed'
        },
        {
            id: 'EMP-2022-031', name: 'Prof. James Rivera', type: 'Faculty',
            units: 21, rate: 820, rateType: 'per unit',
            deductions: { bir: 5100, philhealth: 720, pagibig: 200, loan: 1500 },
            benefits: { chalk: 500 },
            status: 'reviewed'
        },
        {
            id: 'EMP-2023-007', name: 'Anna Cruz', type: 'Admin',
            units: 88, rate: 185, rateType: 'per hour',
            deductions: { bir: 2180, philhealth: 420, pagibig: 200, loan: 0 },
            benefits: { rice: 1500 },
            status: 'computed'
        },
        {
            id: 'EMP-2020-052', name: 'Roberto Mendoza', type: 'Faculty',
            units: 15, rate: 800, rateType: 'per unit',
            deductions: { bir: 3200, philhealth: 580, pagibig: 200, loan: 800 },
            benefits: {},
            status: 'computed'
        },
        {
            id: 'EMP-2021-089', name: 'Elena Villanueva', type: 'Admin',
            units: 92, rate: 175, rateType: 'per hour',
            deductions: { bir: 1950, philhealth: 390, pagibig: 200, loan: 0 },
            benefits: { rice: 1500, laundry: 300 },
            status: 'reviewed'
        },
        {
            id: 'EMP-2024-003', name: 'Michael Tan', type: 'Faculty',
            units: 12, rate: 780, rateType: 'per unit',
            deductions: { bir: 2100, philhealth: 450, pagibig: 200, loan: 0 },
            benefits: { chalk: 500 },
            status: 'computed'
        }
    ];

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

    document.getElementById('btnRelease').addEventListener('click', function () {
        if (!allReviewed()) return;
        var period = PERIODS[currentPeriod];
        getEmployees().forEach(function (e) { e.status = 'released'; });
        period.status = 'released';
        document.getElementById('periodBadge').outerHTML = periodStatusBadge('released');
        updateReleaseButton();
        renderTable();
        alert('Payslips released for ' + period.label + '. Employees can now view them in the Staff Module.');
    });

    initPeriodData();
    populatePeriodSelect();
    onPeriodChange();
})();
