(function () {
    PayrollProLayout.init({
        activeNav: 'payslip',
        navMode: 'staff',
        user: { name: 'Dr. Maria Santos', role: 'Faculty Staff', initials: 'MS' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    var PAYSLIPS = {
        '2026-07-01': {
            periodLabel: 'July 1 – July 15, 2026',
            payDate: 'July 16, 2026',
            rateType: 'per unit',
            rate: 850,
            units: 18,
            unitsLabel: 'Teaching units worked',
            gross: 15300,
            deductions: { bir: 4250, philhealth: 680, pagibig: 200, loan: 0 },
            benefits: { 'Chalk Allowance': 500, 'Internet Allowance': 800 }
        },
        '2026-06-16': {
            periodLabel: 'June 16 – June 30, 2026',
            payDate: 'July 1, 2026',
            rateType: 'per unit',
            rate: 850,
            units: 16,
            unitsLabel: 'Teaching units worked',
            gross: 13600,
            deductions: { bir: 3800, philhealth: 650, pagibig: 200, loan: 0 },
            benefits: { 'Chalk Allowance': 500, 'Internet Allowance': 800 }
        },
        '2026-06-01': {
            periodLabel: 'June 1 – June 15, 2026',
            payDate: 'June 16, 2026',
            rateType: 'per unit',
            rate: 850,
            units: 20,
            unitsLabel: 'Teaching units worked',
            gross: 17000,
            deductions: { bir: 4600, philhealth: 700, pagibig: 200, loan: 0 },
            benefits: { 'Chalk Allowance': 500, 'Internet Allowance': 800 }
        }
    };

    var EMPLOYEE = { name: 'Dr. Maria Santos', id: 'EMP-2021-014' };

    function peso(n) {
        return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function renderPayslip(periodKey) {
        var ps = PAYSLIPS[periodKey];
        if (!ps) return;

        var ded = ps.deductions;
        var dedTotal = ded.bir + ded.philhealth + ded.pagibig + ded.loan;
        var benTotal = Object.values(ps.benefits).reduce(function (s, v) { return s + v; }, 0);
        var net = ps.gross + benTotal - dedTotal;

        document.getElementById('psName').textContent = EMPLOYEE.name;
        document.getElementById('psId').textContent = EMPLOYEE.id;
        document.getElementById('psPeriod').textContent = ps.periodLabel;
        document.getElementById('psPayDate').textContent = ps.payDate;
        document.getElementById('psRateType').textContent = ps.rateType;
        document.getElementById('psRate').textContent = peso(ps.rate);
        document.getElementById('psUnitsLabel').textContent = ps.unitsLabel;
        document.getElementById('psUnits').textContent = ps.units;
        document.getElementById('psGross').textContent = peso(ps.gross);
        document.getElementById('psBir').textContent = peso(ded.bir);
        document.getElementById('psPhilhealth').textContent = peso(ded.philhealth);
        document.getElementById('psPagibig').textContent = peso(ded.pagibig);
        document.getElementById('psLoan').textContent = peso(ded.loan);
        document.getElementById('psDedTotal').textContent = peso(dedTotal);

        document.getElementById('psBenefitsList').innerHTML = Object.keys(ps.benefits).map(function (name) {
            return '<div class="pp-payslip-row"><span>' + name + '</span><span class="pp-payslip-amount">' + peso(ps.benefits[name]) + '</span></div>';
        }).join('') || '<div class="pp-payslip-row"><span class="text-muted">No benefits this period</span><span class="pp-payslip-amount">₱0.00</span></div>';

        document.getElementById('psBenefitsTotal').textContent = peso(benTotal);
        document.getElementById('psNet').textContent = peso(net);
    }

    function populatePeriodSelect() {
        var sel = document.getElementById('payslipPeriod');
        sel.innerHTML = Object.keys(PAYSLIPS).map(function (key) {
            return '<option value="' + key + '">' + PAYSLIPS[key].periodLabel + '</option>';
        }).join('');
    }

    function switchPanel(panel) {
        document.querySelectorAll('.pp-staff-tab').forEach(function (tab) {
            tab.classList.toggle('active', tab.dataset.panel === panel);
        });
        document.getElementById('panelPayslip').classList.toggle('d-none', panel !== 'payslip');
        document.getElementById('panelThirteenth').classList.toggle('d-none', panel !== 'thirteenth');
        document.getElementById('panelBenefits').classList.toggle('d-none', panel !== 'benefits');
    }

    document.getElementById('payslipPeriod').addEventListener('change', function (e) {
        renderPayslip(e.target.value);
    });

    document.querySelectorAll('.pp-staff-tab').forEach(function (tab) {
        tab.addEventListener('click', function (e) {
            e.preventDefault();
            switchPanel(tab.dataset.panel);
        });
    });

    populatePeriodSelect();
    renderPayslip(document.getElementById('payslipPeriod').value || Object.keys(PAYSLIPS)[0]);
})();
