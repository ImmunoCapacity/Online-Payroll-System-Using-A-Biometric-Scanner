/**
 * Payroll Processing (paper, module 7.0 — Figures 3.1–3.3)
 * ---------------------------------------------------------------
 * 1. Run Payroll: employees and rates come from Employee Records
 *    (api/employees); hours worked come from the Daily Time Record for
 *    the pay period (api/dtr/hours). Gross Pay = Rate × Hours Worked.
 *    Deductions come from the Deduction Tables; Admin Staff are
 *    processed first, then Faculty Staff.
 * 2. Review each employee's breakdown (Review and Recompute).
 * 3. Release Payslips once everyone is reviewed.
 * 4. Distribute Payslips: the server emails each employee their payslip
 *    at the address in their employee record (api/payroll/payslips/email).
 *
 * Runs are kept in this browser (DataStore 'payrollRuns') until the
 * payroll tables are connected to the database.
 * ---------------------------------------------------------------
 */
(function () {
    PayrollProLayout.init({
        activeNav: 'payroll',
        institution: { name: 'STI Balayan', short: 'STI' }
    });

    // ================================================================
    // HELPERS
    // ================================================================

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    function peso(n) {
        return '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function iso(date) {
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var d = String(date.getDate()).padStart(2, '0');
        return date.getFullYear() + '-' + m + '-' + d;
    }

    function api(url, options) {
        return fetch(url, options).then(function (response) {
            return response.json().catch(function () {
                return { success: false, message: 'Unexpected response from the server.' };
            });
        });
    }

    // ================================================================
    // PAY PERIODS — semi-monthly cutoffs: 1–15 and 16–end of month.
    // The current period and the three before it.
    // ================================================================

    function buildPeriods() {
        var periods = {};
        var today = new Date();
        var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() <= 15 ? 1 : 16);

        for (var i = 0; i < 4; i++) {
            var end = start.getDate() === 1
                ? new Date(start.getFullYear(), start.getMonth(), 15)
                : new Date(start.getFullYear(), start.getMonth() + 1, 0);
            var payDate = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
            var fmt = { month: 'short', day: 'numeric' };

            periods[iso(start)] = {
                key: iso(start),
                from: iso(start),
                to: iso(end),
                label: start.toLocaleDateString('en-US', fmt) + ' – ' + end.toLocaleDateString('en-US', fmt) + ', ' + end.getFullYear(),
                payDate: iso(payDate)
            };

            // Step back one cutoff.
            start = start.getDate() === 16
                ? new Date(start.getFullYear(), start.getMonth(), 1)
                : new Date(start.getFullYear(), start.getMonth() - 1, 16);
        }
        return periods;
    }

    var PERIODS = buildPeriods();
    var currentPeriod = Object.keys(PERIODS)[0];

    // Saved runs: { periodKey: { status, employees, distributed } }
    var runs = DataStore.get('payrollRuns', {});

    function saveRuns() {
        DataStore.set('payrollRuns', runs);
    }

    function currentRun() {
        return runs[currentPeriod] || { status: 'open', employees: [] };
    }

    function getEmployees() {
        return currentRun().employees;
    }

    // ================================================================
    // DEDUCTIONS (Deduction Tables module)
    // Pay periods are semi-monthly while the government tables are
    // monthly, so each table is applied to the monthly equivalent of the
    // period's gross pay (gross × 2) and half of the result is deducted
    // per period.
    // ================================================================

    var TABLES = DataStore.getTaxBrackets();
    var PERIODS_PER_MONTH = 2;

    // The table for the given year, or the latest year before it.
    function tableFor(name, year) {
        var byYear = TABLES[name] || {};
        var years = Object.keys(byYear).map(Number).filter(function (y) { return y <= year; }).sort(function (a, b) { return b - a; });
        if (!years.length) years = Object.keys(byYear).map(Number).sort(function (a, b) { return b - a; });
        return years.length ? byYear[years[0]] : [];
    }

    function bracketFor(rows, amount) {
        return rows.find(function (b) {
            return amount >= b.min && (b.max == null || amount <= b.max);
        }) || null;
    }

    function computeDeductions(employeeNumber, gross, year) {
        if (gross <= 0) {
            return { sss: 0, philhealth: 0, pagibig: 0, bir: 0, loan: 0 };
        }

        var monthly = gross * PERIODS_PER_MONTH;

        var sssRow = bracketFor(tableFor('sss', year), monthly);
        var sssMonthly = sssRow ? sssRow.msc * sssRow.rate / 100 : 0;

        // PhilHealth premium is shared equally by employer and employee.
        var phRow = bracketFor(tableFor('philhealth', year), monthly);
        var phPremium = phRow ? (phRow.premium != null ? phRow.premium : monthly * phRow.rate / 100) : 0;
        var phMonthly = phPremium / 2;

        var pagRow = bracketFor(tableFor('pagibig', year), monthly);
        var pagMonthly = pagRow ? (pagRow.share != null ? pagRow.share : monthly * pagRow.rate / 100) : 0;

        // Withholding tax is computed on taxable pay (gross less contributions).
        var taxable = Math.max(0, monthly - sssMonthly - phMonthly - pagMonthly);
        var birRow = bracketFor(tableFor('bir', year), taxable);
        var threshold = birRow && birRow.min > 0 ? birRow.min - 0.01 : 0;
        var taxMonthly = birRow ? birRow.base + Math.max(0, taxable - threshold) * birRow.rate / 100 : 0;

        // Active loans (Loan Management), matched by employee number:
        // the scheduled amount per payroll, never more than what's left.
        var loan = DataStore.getLoans()
            .filter(function (l) { return l.employeeId === employeeNumber && DataStore.getLoanStatus(l) === 'Active'; })
            .reduce(function (sum, l) {
                return sum + Math.min(Number(l.deductionPerPayroll || 0), DataStore.getLoanRemainingBalance(l));
            }, 0);

        return {
            sss: round2(sssMonthly / PERIODS_PER_MONTH),
            philhealth: round2(phMonthly / PERIODS_PER_MONTH),
            pagibig: round2(pagMonthly / PERIODS_PER_MONTH),
            bir: round2(taxMonthly / PERIODS_PER_MONTH),
            loan: round2(loan)
        };
    }

    // Paper, Figures 3.1–3.2: Gross Pay = Rate per Hour × Number of Hours Worked,
    // computed per role: office hours (biometric DTR) at the admin rate and
    // approved teaching hours (Faculty Teaching Hours) at the faculty rate.
    // Runs saved before earnings lines existed fall back to hours × rate.
    function calcGross(emp) {
        if (emp.earnings) {
            return round2(emp.earnings.reduce(function (s, e) { return s + e.amount; }, 0));
        }
        return round2(emp.hours * emp.rate);
    }

    /**
     * Earnings lines for one employee:
     *   Admin          — office hours × rate per hour
     *   Faculty        — approved teaching hours × rate per hour/unit
     *   Faculty/Admin  — both, each at its own rate (office time that overlaps
     *                    an approved class is already excluded by the server)
     * Scheduled classes are never paid unless approved in Faculty Teaching Hours.
     */
    function buildEarnings(e, h) {
        var lines = [];
        function add(label, hours, rate) {
            hours = Number(hours) || 0;
            rate = Number(rate) || 0;
            lines.push({ label: label, hours: hours, rate: rate, amount: round2(hours * rate) });
        }
        if (e.department === 'Admin' || e.department === 'Faculty/Admin') {
            add('Office hours (biometric DTR)', h.officeHours, e.rate);
        }
        if (e.department === 'Faculty') {
            add('Approved teaching hours', h.teachingHours, e.rate);
        }
        if (e.department === 'Faculty/Admin') {
            add('Approved teaching hours', h.teachingHours, e.teachingRate);
        }
        return lines;
    }

    function calcDeductionsTotal(d) {
        return round2(d.sss + d.philhealth + d.pagibig + d.bir + d.loan);
    }

    function calcBenefitsTotal(benefits) {
        return round2(benefits.reduce(function (s, b) { return s + b.amount; }, 0));
    }

    function calcNet(emp) {
        return round2(calcGross(emp) + calcBenefitsTotal(emp.benefits) - calcDeductionsTotal(emp.deductions));
    }

    // ================================================================
    // RUN PAYROLL
    // ================================================================

    // Paper (Payroll Module): Admin Staff are processed first, then Faculty Staff,
    // then Admin Staff who are also Faculty Staff (Faculty/Admin).
    var TYPE_ORDER = { Admin: 0, Faculty: 1, 'Faculty/Admin': 2 };

    function computePayroll(period) {
        return Promise.all([
            api('api/employees'),
            api('api/payroll/hours?from=' + period.from + '&to=' + period.to)
        ]).then(function (results) {
            var employeesData = results[0];
            var hoursData = results[1];
            if (!employeesData.success) throw new Error(employeesData.message || 'Could not load employees.');
            if (!hoursData.success) throw new Error(hoursData.message || 'Could not load hours worked.');

            var hoursById = {};
            hoursData.hours.forEach(function (h) { hoursById[h.employeeId] = h; });

            var year = Number(period.to.slice(0, 4));

            return employeesData.employees
                .filter(function (e) { return e.status === 'Active'; })
                .sort(function (a, b) {
                    return (TYPE_ORDER[a.department] - TYPE_ORDER[b.department]) || a.displayName.localeCompare(b.displayName);
                })
                .map(function (e) {
                    var worked = hoursById[e.id] || {
                        officeHours: 0, teachingHours: 0, daysWorked: 0, overlapHours: 0, unapprovedClasses: 0
                    };
                    var earnings = buildEarnings(e, worked);
                    var emp = {
                        id: e.id,
                        employeeNumber: e.employeeNumber,
                        name: e.displayName,
                        type: e.department,
                        hours: round2(earnings.reduce(function (s, l) { return s + l.hours; }, 0)),
                        daysWorked: worked.daysWorked,
                        overlapHours: Number(worked.overlapHours) || 0,
                        unapprovedClasses: worked.unapprovedClasses || 0,
                        rate: Number(e.rate) || 0,
                        earnings: earnings,
                        benefits: [],   // Benefit Maintenance isn't built yet
                        status: 'computed'
                    };
                    emp.deductions = computeDeductions(e.employeeNumber, calcGross(emp), year);
                    return emp;
                });
        });
    }

    var btnRun = document.getElementById('btnRunPayroll');
    var btnRelease = document.getElementById('btnRelease');
    var btnDistribute = document.getElementById('btnDistribute');

    btnRun.addEventListener('click', function () {
        var period = PERIODS[currentPeriod];
        var run = currentRun();
        if (run.status === 'released') return;

        btnRun.disabled = true;
        btnRun.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Computing…';

        computePayroll(period).then(function (employees) {
            runs[currentPeriod] = { status: 'processing', employees: employees, distributed: null };
            saveRuns();
            render();

            var noHours = employees.filter(function (e) { return e.hours === 0; }).length;
            var noRate = employees.filter(function (e) {
                return e.earnings.some(function (l) { return l.rate === 0; });
            }).length;
            var unapproved = employees.reduce(function (s, e) { return s + e.unapprovedClasses; }, 0);
            PPToast.success('Payroll computed for ' + employees.length + ' employee' + (employees.length === 1 ? '' : 's') + '.');
            if (noHours || noRate) {
                PPToast.error(
                    (noHours ? noHours + ' with no payable hours for this period' : '') +
                    (noHours && noRate ? '; ' : '') +
                    (noRate ? noRate + ' with a missing rate in Employee Records' : '') + '.'
                );
            }
            if (unapproved) {
                PPToast.error(unapproved + ' scheduled class' + (unapproved === 1 ? ' is' : 'es are') +
                    ' not yet checked or approved in Faculty Teaching Hours and ' + (unapproved === 1 ? 'is' : 'are') +
                    ' not paid. Approve them, then click Recompute.');
            }
        }).catch(function (error) {
            console.error('[Payroll]', error);
            PPToast.error(error.message || 'Could not compute payroll.');
        }).then(function () {
            render();
        });
    });

    // ================================================================
    // RENDER
    // ================================================================

    function statusBadge(emp) {
        var map = {
            computed: ['pp-badge-computed', 'Computed'],
            reviewed: ['pp-badge-reviewed', 'Reviewed'],
            released: ['pp-badge-released', 'Released']
        };
        var item = map[emp.status] || map.computed;
        var mail = '';
        if (emp.emailStatus === 'sent') {
            mail = ' <i class="bi bi-envelope-check-fill text-success" title="Payslip emailed"></i>';
        } else if (emp.emailStatus) {
            mail = ' <i class="bi bi-envelope-exclamation-fill text-danger" title="' + escapeHtml(emp.emailMessage || 'Not sent') + '"></i>';
        }
        return '<span class="pp-badge ' + item[0] + '">' + item[1] + '</span>' + mail;
    }

    function typeBadge(type) {
        var cls = type === 'Faculty' ? 'pp-badge-faculty' : type === 'Faculty/Admin' ? 'pp-badge-faculty-admin' : 'pp-badge-admin';
        return '<span class="pp-badge ' + cls + '">' + type + '</span>';
    }

    function periodStatusBadge(status) {
        var labels = { open: 'Open', processing: 'Processing', released: 'Released' };
        return '<span class="pp-period-badge ' + status + '" id="periodBadge">' + (labels[status] || status) + '</span>';
    }

    function allReviewed() {
        var employees = getEmployees();
        return employees.length > 0 && employees.every(function (e) {
            return e.status === 'reviewed' || e.status === 'released';
        });
    }

    function updateButtons() {
        var run = currentRun();
        btnRun.disabled = run.status === 'released';
        btnRun.innerHTML = run.status === 'processing'
            ? '<i class="bi bi-arrow-repeat me-1"></i> Recompute Payroll'
            : '<i class="bi bi-play-fill me-1"></i> Run Payroll';
        btnRelease.disabled = run.status !== 'processing' || !allReviewed();
        btnDistribute.disabled = run.status !== 'released';
        btnDistribute.innerHTML = run.distributed
            ? '<i class="bi bi-envelope-paper me-1"></i> Resend Payslips'
            : '<i class="bi bi-envelope-paper me-1"></i> Distribute Payslips';
    }

    function updateTotals() {
        var gross = 0, ded = 0, net = 0;
        getEmployees().forEach(function (emp) {
            gross += calcGross(emp) + calcBenefitsTotal(emp.benefits);
            ded += calcDeductionsTotal(emp.deductions);
            net += calcNet(emp);
        });
        document.getElementById('totalGross').textContent = peso(gross);
        document.getElementById('totalDeductions').textContent = peso(ded);
        document.getElementById('totalNet').textContent = peso(net);
    }

    // Clicking a row (or Enter/Space on a focused row) opens its breakdown.
    var payrollBody = document.getElementById('payrollBody');
    payrollBody.addEventListener('click', function (event) {
        var row = event.target.closest('tr[data-idx]');
        if (row) showBreakdown(parseInt(row.dataset.idx, 10));
    });
    payrollBody.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-idx]')) {
            event.preventDefault();
            showBreakdown(parseInt(event.target.dataset.idx, 10));
        }
    });

    function render() {
        var employees = getEmployees();
        var tbody = document.getElementById('payrollBody');
        var empty = document.getElementById('emptyPayroll');

        document.getElementById('periodBadge').outerHTML = periodStatusBadge(currentRun().status);

        if (employees.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
        } else {
            empty.classList.add('d-none');
            tbody.innerHTML = employees.map(function (emp, idx) {
                return (
                    '<tr class="pp-row-clickable" tabindex="0" role="button" data-idx="' + idx + '" ' +
                        'aria-label="View payroll breakdown for ' + escapeHtml(emp.name) + '">' +
                        '<td><strong>' + escapeHtml(emp.name) + '</strong><br><span class="text-muted" style="font-size:0.75rem;">' + escapeHtml(emp.employeeNumber) + '</span></td>' +
                        '<td>' + typeBadge(emp.type) + '</td>' +
                        '<td class="col-units">' + emp.hours + ' hrs</td>' +
                        '<td class="col-money">' + peso(calcGross(emp)) + '</td>' +
                        '<td class="col-money">' + peso(calcDeductionsTotal(emp.deductions)) + '</td>' +
                        '<td class="col-money"><strong>' + peso(calcNet(emp)) + '</strong></td>' +
                        '<td>' + statusBadge(emp) + '</td>' +
                    '</tr>'
                );
            }).join('');
        }

        updateTotals();
        updateButtons();
    }

    function line(label, amount) {
        return '<div class="pp-breakdown-line"><span>' + label + '</span><span class="amount">' + peso(amount) + '</span></div>';
    }

    function showBreakdown(idx) {
        var emp = getEmployees()[idx];
        if (!emp) return;

        var ded = emp.deductions;
        var benefitsHtml = emp.benefits.length
            ? emp.benefits.map(function (b) { return line(escapeHtml(b.name), b.amount); }).join('')
            : '<div class="pp-breakdown-line"><span class="text-muted">No benefits applied</span><span class="amount">₱0.00</span></div>';

        document.getElementById('breakdownTitle').textContent = emp.name;
        document.getElementById('breakdownBody').innerHTML =
            '<p class="pp-breakdown-meta">' + escapeHtml(emp.employeeNumber) + ' · ' + emp.type + ' · ' +
                emp.hours + ' payable hours' +
                (emp.earnings ? '' : ' @ ' + peso(emp.rate) + ' per hour') + '</p>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-section-title">Earnings</div>' +
                (emp.earnings || []).map(function (l) {
                    return line(escapeHtml(l.label) + '<br><span class="text-muted" style="font-size:0.75rem;">' +
                        l.hours + ' hrs × ' + peso(l.rate) + '</span>', l.amount);
                }).join('') +
                (emp.overlapHours
                    ? '<div class="pp-breakdown-line"><span class="text-muted" style="font-size:0.75rem;">' + emp.overlapHours +
                      ' office hrs overlapped approved classes and were not counted twice</span><span></span></div>'
                    : '') +
                (emp.unapprovedClasses
                    ? '<div class="pp-breakdown-line"><span class="text-warning" style="font-size:0.75rem;">' + emp.unapprovedClasses +
                      ' scheduled class(es) not yet approved in Faculty Teaching Hours — not paid</span><span></span></div>'
                    : '') +
                '<div class="pp-breakdown-line total"><span>Gross Pay</span><span class="amount">' + peso(calcGross(emp)) + '</span></div></div>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-section-title">Benefits</div>' + benefitsHtml + '</div>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-section-title">Deductions</div>' +
                line('SSS', ded.sss) +
                line('PhilHealth', ded.philhealth) +
                line('Pag-IBIG', ded.pagibig) +
                line('BIR Withholding Tax', ded.bir) +
                line('Loan Repayment', ded.loan) +
                '<div class="pp-breakdown-line total"><span>Total Deductions</span><span class="amount">' + peso(calcDeductionsTotal(ded)) + '</span></div></div>' +
            '<div class="pp-breakdown-section"><div class="pp-breakdown-line total"><span>Net Pay</span><span class="amount" style="color:var(--pp-accent);font-size:1.125rem;">' + peso(calcNet(emp)) + '</span></div></div>' +
            (emp.status === 'computed'
                ? '<button type="button" class="btn btn-pp-primary w-100" id="btnMarkReviewed">Mark as Reviewed</button>'
                : '');

        if (emp.status === 'computed') {
            document.getElementById('btnMarkReviewed').addEventListener('click', function () {
                emp.status = 'reviewed';
                saveRuns();
                render();
                bootstrap.Offcanvas.getInstance(document.getElementById('breakdownPanel')).hide();
            });
        }

        new bootstrap.Offcanvas(document.getElementById('breakdownPanel')).show();
    }

    // ================================================================
    // RELEASE
    // ================================================================

    // Itemised like the paper's Payroll table (Table 4) so the Reports
    // module (SSS / PhilHealth / Pag-IBIG / BIR remittance) has data.
    function persistReleasedPayroll(period) {
        var records = DataStore.get('payroll', []).filter(function (r) {
            return r.periodLabel !== period.label; // replace an earlier release of the same period
        });
        getEmployees().forEach(function (emp) {
            records.push({
                id: DataStore.nextNumericId(records),
                employeeId: emp.employeeNumber,
                employee: emp.name,
                employeeType: emp.type,
                periodLabel: period.label,
                payDate: period.payDate,
                hours: emp.hours,
                employeeRate: emp.rate,
                gross: calcGross(emp),
                benefits: calcBenefitsTotal(emp.benefits),
                sss: emp.deductions.sss,
                philhealth: emp.deductions.philhealth,
                pagibig: emp.deductions.pagibig,
                tax: emp.deductions.bir,
                loan: emp.deductions.loan,
                deductions: calcDeductionsTotal(emp.deductions),
                net: calcNet(emp),
                dateGenerated: new Date().toISOString()
            });
        });
        DataStore.set('payroll', records);
    }

    btnRelease.addEventListener('click', function () {
        if (!allReviewed()) return;
        var period = PERIODS[currentPeriod];
        var run = currentRun();
        run.employees.forEach(function (e) { e.status = 'released'; });
        run.status = 'released';
        saveRuns();
        persistReleasedPayroll(period);
        render();
        PPToast.success('Payroll released for ' + period.label + '. Click Distribute Payslips to email them.');
    });

    // ================================================================
    // DISTRIBUTE PAYSLIPS (email)
    // ================================================================

    btnDistribute.addEventListener('click', function () {
        var run = currentRun();
        if (run.status !== 'released') return;
        var period = PERIODS[currentPeriod];
        var employees = getEmployees();

        ConfirmModal.show({
            title: run.distributed ? 'Resend Payslips' : 'Distribute Payslips',
            message: 'Email the ' + period.label + ' payslip to ' + employees.length + ' employee' +
                (employees.length === 1 ? '' : 's') + ' at the email address in their employee record?',
            confirmText: 'Send Emails'
        }).then(function (confirmed) {
            if (!confirmed) return;

            btnDistribute.disabled = true;
            btnDistribute.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending…';

            api('api/payroll/payslips/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    periodLabel: period.label,
                    payDate: period.payDate,
                    payslips: employees.map(function (emp) {
                        return {
                            employeeId: emp.id,
                            hours: emp.hours,
                            rate: emp.rate,
                            gross: calcGross(emp),
                            earnings: emp.earnings || null,
                            benefits: emp.benefits,
                            deductions: emp.deductions
                        };
                    })
                })
            }).then(function (data) {
                if (!data.success) {
                    PPToast.error(data.message || 'Could not send the payslips.');
                    return;
                }

                data.results.forEach(function (r) {
                    var emp = employees.find(function (e) { return e.id === r.employeeId; });
                    if (emp) {
                        emp.emailStatus = r.status;
                        emp.emailMessage = r.message || null;
                    }
                });
                run.distributed = { sent: data.sent, total: data.total, at: new Date().toISOString() };
                saveRuns();

                if (data.sent === data.total) {
                    PPToast.success('Payslips emailed to all ' + data.total + ' employee' + (data.total === 1 ? '' : 's') + '.');
                } else {
                    PPToast.error('Emailed ' + data.sent + ' of ' + data.total + ' payslips. Hover the red envelope icons to see why.');
                }
            }).catch(function () {
                PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
            }).then(function () {
                render();
            });
        });
    });

    // ================================================================
    // PERIOD SELECT
    // ================================================================

    var periodSelect = document.getElementById('periodSelect');
    periodSelect.innerHTML = Object.keys(PERIODS).map(function (key) {
        return '<option value="' + key + '">' + PERIODS[key].label + '</option>';
    }).join('');
    periodSelect.value = currentPeriod;
    periodSelect.addEventListener('change', function () {
        currentPeriod = periodSelect.value;
        render();
    });

    /**
     * Saved runs keep a copy of each employee's name. Refresh names and
     * employee numbers from Employee Records for runs not yet released, so
     * an edited name shows here. Released runs stay exactly as they were
     * paid. (Hours, rates and amounts change only on Run Payroll/Recompute.)
     */
    function refreshEmployeeDetails() {
        api('api/employees').then(function (data) {
            if (!data.success) return;
            var byId = {};
            data.employees.forEach(function (e) { byId[e.id] = e; });
            var changed = false;
            Object.keys(runs).forEach(function (key) {
                var run = runs[key];
                if (!run || run.status === 'released' || !run.employees) return;
                run.employees.forEach(function (emp) {
                    var e = byId[emp.id];
                    if (e && (emp.name !== e.displayName || emp.employeeNumber !== e.employeeNumber)) {
                        emp.name = e.displayName;
                        emp.employeeNumber = e.employeeNumber;
                        changed = true;
                    }
                });
            });
            if (changed) {
                saveRuns();
                render();
            }
        }).catch(function () {
            // Offline: keep showing the saved names.
        });
    }

    render();
    refreshEmployeeDetails();
})();
