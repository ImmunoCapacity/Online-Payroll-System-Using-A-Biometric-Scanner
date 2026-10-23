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
 *    at the address in their employee record (api/payroll/runs/{id}/email).
 *
 * Runs are saved in the database (payroll_run / payroll via
 * api/payroll/runs), so every computer sees the same payroll, and Reports
 * read the released ones.
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
    // PAY PERIODS — the cut-offs from Maintenance → Payroll Periods
    // (js/payroll-periods.js). The current period and the five before it.
    // ================================================================

    function buildPeriods() {
        var periods = {};
        PPPeriods.recent(6).forEach(function (p) {
            var payDate = new Date(p.end.getFullYear(), p.end.getMonth(), p.end.getDate() + 1);
            periods[p.from] = { key: p.from, from: p.from, to: p.to, label: p.label, payDate: iso(payDate) };
        });
        return periods;
    }

    // Filled once the payroll periods are loaded (bottom of this file).
    var PERIODS = {};
    var currentPeriod = null;

    // The saved run of the selected period (api/payroll/runs), or null
    // when payroll hasn't been run for it yet.
    var run = null;
    var loading = false;

    function currentRun() {
        return run || { status: 'open', employees: [] };
    }

    function jsonPost(url, body, method) {
        return api(url, {
            method: method || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        });
    }

    function loadRun() {
        var period = PERIODS[currentPeriod];
        var key = currentPeriod;
        loading = true;
        run = null;
        render();
        return api('api/payroll/runs?from=' + period.from + '&to=' + period.to).then(function (data) {
            if (key !== currentPeriod) return;
            if (!data.success) throw new Error(data.message || 'Could not load the payroll.');
            run = data.run;
        }).catch(function (error) {
            if (key !== currentPeriod) return;
            PPToast.error(error.message || 'Could not reach the server.');
        }).then(function () {
            if (key !== currentPeriod) return;
            loading = false;
            render();
        });
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

    // Loaded from the database (Maintenance → Deduction Tables) on each Run Payroll.
    var TABLES = {};
    var PERIODS_PER_MONTH = 2;

    // The table for the given year, or the latest year before it.
    function tableFor(name, year) {
        var byYear = TABLES[name] || {};
        var years = Object.keys(byYear).map(Number).filter(function (y) { return y <= year; }).sort(function (a, b) { return b - a; });
        if (!years.length) years = Object.keys(byYear).map(Number).sort(function (a, b) { return b - a; });
        return years.length ? byYear[years[0]] : [];
    }

    function bracketFor(rows, amount) {
        // Brackets are to the centavo (…20,833.00 / 20,833.01…); a half-centavo
        // amount (e.g. after the PhilHealth half share) would fall between them.
        amount = round2(amount);
        return rows.find(function (b) {
            return amount >= b.min && (b.max == null || amount <= b.max);
        }) || null;
    }

    /**
     * Contributions and withholding tax for this gross pay. Loans are
     * applied afterwards by applyLoans(), from what is left.
     */
    function computeDeductions(gross, year) {
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

        return {
            sss: round2(sssMonthly / PERIODS_PER_MONTH),
            philhealth: round2(phMonthly / PERIODS_PER_MONTH),
            pagibig: round2(pagMonthly / PERIODS_PER_MONTH),
            bir: round2(taxMonthly / PERIODS_PER_MONTH),
            loan: 0
        };
    }

    /**
     * Loans (Loan Management) from api/payroll/loan-deductions, already in
     * order: government loans (SSS, Pag-IBIG) first, then the oldest. Each
     * takes its scheduled amount from the pay left after contributions and
     * tax; a loan the pay can't fully cover is skipped this period (nothing
     * deducted, flagged) and runs one month longer. Net pay never goes
     * below zero. Returns the items as stored with the payroll.
     */
    function applyLoans(loanItems, available) {
        var left = round2(Math.max(0, available));
        return (loanItems || []).map(function (l) {
            var scheduled = round2(Number(l.amount) || 0);
            var base = { loanId: l.loanId, type: l.type, lender: l.lender, reference: l.reference };
            // A released period keeps what it recorded.
            if (l.skipped || scheduled > left) {
                base.amount = 0;
                base.skipped = true;
                base.scheduled = scheduled;
                return base;
            }
            left = round2(left - scheduled);
            base.amount = scheduled;
            return base;
        });
    }

    function skippedLoans(emp) {
        return (emp.loanItems || []).filter(function (l) { return l.skipped; });
    }

    /** Pop-up after Run Payroll: the loans skipped because the pay wasn't enough. */
    function showSkippedLoans(employees, periodLabel) {
        var rows = [];
        employees.forEach(function (emp) {
            skippedLoans(emp).forEach(function (l) {
                rows.push('<tr><td><strong>' + escapeHtml(emp.name) + '</strong><br><span class="text-muted small">' +
                    escapeHtml(emp.employeeNumber) + '</span></td>' +
                    '<td>' + escapeHtml(l.lender || l.type) + '<br><span class="text-muted small">' + escapeHtml(l.reference || '') + '</span></td>' +
                    '<td class="text-end">' + peso(l.scheduled) + '</td>' +
                    '<td class="text-end">' + peso(calcNet(emp)) + '</td></tr>');
            });
        });
        if (!rows.length) return;

        var el = document.getElementById('loanSkipModal');
        if (!el) {
            var wrap = document.createElement('div');
            wrap.innerHTML =
                '<div class="modal fade pp-modal" id="loanSkipModal" tabindex="-1" aria-labelledby="loanSkipTitle" aria-hidden="true">' +
                    '<div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content">' +
                        '<div class="modal-header">' +
                            '<h2 class="modal-title" id="loanSkipTitle"><i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>Loan Deductions Skipped</h2>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<p id="loanSkipIntro" class="mb-3"></p>' +
                            '<div class="table-responsive"><table class="pp-table w-100">' +
                                '<thead><tr><th>Employee</th><th>Loan</th><th class="text-end">Not Deducted</th><th class="text-end">Net Pay</th></tr></thead>' +
                                '<tbody id="loanSkipBody"></tbody>' +
                            '</table></div>' +
                            '<p class="text-muted small mt-3 mb-0">Contributions and tax are taken first, then loans (SSS and Pag-IBIG first). ' +
                            'A loan the remaining pay can\'t fully cover is skipped this month, and the loan runs one month longer.</p>' +
                        '</div>' +
                        '<div class="modal-footer"><button type="button" class="btn btn-pp-primary" data-bs-dismiss="modal">OK</button></div>' +
                    '</div></div>' +
                '</div>';
            document.body.appendChild(wrap.firstChild);
            el = document.getElementById('loanSkipModal');
        }
        document.getElementById('loanSkipIntro').textContent = rows.length + ' loan deduction' + (rows.length === 1 ? ' was' : 's were') +
            ' skipped in the ' + periodLabel + ' payroll because the employee\'s pay wasn\'t enough.';
        document.getElementById('loanSkipBody').innerHTML = rows.join('');
        bootstrap.Modal.getOrCreateInstance(el).show();
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
            // Approved paid leave (Leave Management): a normal office day per leave day.
            var leaveDays = Number(h.paidLeaveDays) || 0;
            if (leaveDays > 0) {
                var hoursPerDay = Number(e.officeHours) || 8;
                add('Paid leave (' + leaveDays + ' day' + (leaveDays === 1 ? '' : 's') + ')', leaveDays * hoursPerDay, e.rate);
            }
        }
        if (e.department === 'Faculty') {
            add('Approved teaching hours', h.teachingHours, e.rate);
        }
        if (e.department === 'Faculty/Admin') {
            add('Approved teaching hours', h.teachingHours, e.teachingRate);
        }
        // Minutes late at approved classes (Faculty Teaching Hours): deducted at
        // rate per hour ÷ 60 × minutes late. Hours are kept to 4 decimals.
        var lateMinutes = Number(h.teachingLateMinutes) || 0;
        if (lateMinutes > 0 && (e.department === 'Faculty' || e.department === 'Faculty/Admin')) {
            var teachRate = e.department === 'Faculty/Admin' ? e.teachingRate : e.rate;
            var perMinute = (Number(teachRate) || 0) / 60;
            add('Late deduction (' + lateMinutes + ' min × ₱' + perMinute.toFixed(2) + '/min)',
                -Math.round(lateMinutes / 60 * 10000) / 10000, teachRate);
        }
        // Approved paid leave on days with classes: the classes missed are paid
        // at the teaching rate (their scheduled hours).
        var leaveClasses = Number(h.paidLeaveClasses) || 0;
        if (leaveClasses > 0 && (e.department === 'Faculty' || e.department === 'Faculty/Admin')) {
            add('Paid leave (' + leaveClasses + ' class' + (leaveClasses === 1 ? '' : 'es') + ')', h.paidLeaveTeachingHours,
                e.department === 'Faculty/Admin' ? e.teachingRate : e.rate);
        }
        // Regular holidays not worked (Monday–Friday) are still paid: a normal
        // office day, and the classes scheduled that day at the teaching rate.
        var regularDays = Number(h.regularHolidayDays) || 0;
        if (regularDays > 0 && e.department !== 'Faculty') {
            add('Regular holiday pay (' + regularDays + ' day' + (regularDays === 1 ? '' : 's') + ')',
                regularDays * (Number(e.officeHours) || 8), e.rate);
        }
        var regularClasses = Number(h.regularHolidayClasses) || 0;
        if (regularClasses > 0 && (e.department === 'Faculty' || e.department === 'Faculty/Admin')) {
            add('Regular holiday pay (' + regularClasses + ' class' + (regularClasses === 1 ? '' : 'es') + ')',
                h.regularHolidayTeachingHours, e.department === 'Faculty/Admin' ? e.teachingRate : e.rate);
        }
        // Double-pay holidays (Maintenance → Holiday Calendar): the hours worked
        // that day are already paid above, so these lines pay them once more.
        var holidayOffice = Number(h.holidayOfficeHours) || 0;
        var holidayTeaching = Number(h.holidayTeachingHours) || 0;
        if (holidayOffice > 0 && e.department !== 'Faculty') {
            add('Holiday double pay (office hours)', holidayOffice, e.rate);
        }
        if (holidayTeaching > 0) {
            add('Holiday double pay (teaching hours)', holidayTeaching, e.department === 'Faculty/Admin' ? e.teachingRate : e.rate);
        }
        return lines;
    }

    /** Holiday double pay lines pay hours already counted in another line. */
    function isHolidayLine(line) {
        return String(line.label || '').toLowerCase().indexOf('holiday') === 0;
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

    var lastIncomplete = [];

    function computePayroll(period) {
        return Promise.all([
            api('api/employees'),
            api('api/payroll/hours?from=' + period.from + '&to=' + period.to),
            api('api/payroll/loan-deductions?from=' + period.from + '&to=' + period.to),
            api('api/payroll/benefits'),
            api('api/payroll/contribution-tables'),
            api('api/payroll/rates?date=' + period.to),
            api('api/payroll/adjustments/period?from=' + period.from + '&to=' + period.to),
            api('api/dtr/incomplete?from=' + period.from + '&to=' + period.to)
        ]).then(function (results) {
            var incompleteData = results[7];
            lastIncomplete = (incompleteData && incompleteData.success) ? (incompleteData.records || []) : [];
            var employeesData = results[0];
            var hoursData = results[1];
            var loanData = results[2];
            if (!employeesData.success) throw new Error(employeesData.message || 'Could not load employees.');
            if (!hoursData.success) throw new Error(hoursData.message || 'Could not load hours worked.');
            if (!loanData.success) throw new Error(loanData.message || 'Could not load loan deductions.');
            var loansById = loanData.deductions || {};
            var benefitData = results[3];
            if (!benefitData.success) throw new Error(benefitData.message || 'Could not load benefits.');
            var benefitsById = benefitData.benefits || {};
            if (!results[4].success) throw new Error(results[4].message || 'Could not load the deduction tables.');
            TABLES = results[4].tables;
            if (!results[5].success) throw new Error(results[5].message || 'Could not load employee rates.');
            // Rates in effect at the end of the period (Maintenance → Employee Rates),
            // so an earlier period is paid at the rate that applied then.
            var ratesById = results[5].rates || {};
            employeesData.employees.forEach(function (e) {
                var r = ratesById[e.id];
                if (!r) return;
                if (e.department === 'Faculty') {
                    if (r.teaching != null) e.rate = r.teaching;
                } else {
                    if (r.office != null) e.rate = r.office;
                    if (e.department === 'Faculty/Admin' && r.teaching != null) e.teachingRate = r.teaching;
                }
            });

            var hoursById = {};
            hoursData.hours.forEach(function (h) { hoursById[h.employeeId] = h; });

            // Payroll Adjustment: corrections paid in this cut-off (+ add, − deduct).
            // They are part of gross pay, so contributions and tax follow them.
            if (!results[6].success) throw new Error(results[6].message || 'Could not load payroll adjustments.');
            var adjustmentsById = results[6].adjustments || {};

            var year = Number(period.to.slice(0, 4));

            return employeesData.employees
                .filter(function (e) { return e.status === 'Active'; })
                // Not yet hired by the end of the period: not part of this payroll.
                .filter(function (e) { return !e.dateHired || e.dateHired <= period.to; })
                .sort(function (a, b) {
                    return (TYPE_ORDER[a.department] - TYPE_ORDER[b.department]) || a.displayName.localeCompare(b.displayName);
                })
                .map(function (e) {
                    var worked = hoursById[e.id] || {
                        officeHours: 0, teachingHours: 0, daysWorked: 0, overlapHours: 0, unapprovedClasses: 0, paidLeaveDays: 0
                    };
                    var earnings = buildEarnings(e, worked).concat((adjustmentsById[e.id] || []).map(function (a) {
                        return { label: a.label, hours: Number(a.hours) || 0, rate: Number(a.rate) || 0, amount: round2(Number(a.amount) || 0) };
                    }));
                    var emp = {
                        id: e.id,
                        employeeNumber: e.employeeNumber,
                        name: e.displayName,
                        type: e.department,
                        designation: e.position || e.instructorRank || e.department,
                        hours: round2(earnings.reduce(function (s, l) { return isHolidayLine(l) ? s : s + l.hours; }, 0)),
                        daysWorked: worked.daysWorked,
                        overlapHours: Number(worked.overlapHours) || 0,
                        unapprovedClasses: worked.unapprovedClasses || 0,
                        rate: Number(e.rate) || 0,
                        earnings: earnings,
                        // Benefits Table: paid every payroll period.
                        benefits: (benefitsById[e.id] || []).map(function (b) {
                            return { name: b.name, amount: round2(Number(b.amount) || 0) };
                        }),
                        status: 'computed'
                    };
                    emp.deductions = computeDeductions(calcGross(emp), year);
                    // Loans from what's left after contributions and tax; one the pay
                    // can't cover is skipped (recorded against the loan on release).
                    var available = calcGross(emp) + calcBenefitsTotal(emp.benefits) - calcDeductionsTotal(emp.deductions);
                    emp.loanItems = applyLoans(loansById[e.id], available);
                    emp.deductions.loan = round2(emp.loanItems.reduce(function (s, l) { return s + l.amount; }, 0));
                    return emp;
                });
        });
    }

    var btnRun = document.getElementById('btnRunPayroll');
    var btnRelease = document.getElementById('btnRelease');
    var btnDistribute = document.getElementById('btnDistribute');
    var btnReviewAll = document.getElementById('btnReviewAll');

    btnRun.addEventListener('click', function () {
        var period = PERIODS[currentPeriod];
        if (loading || currentRun().status === 'released') return;

        btnRun.disabled = true;
        btnRun.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Computing…';

        var key = currentPeriod;
        computePayroll(period).then(function (computed) {
            return jsonPost('api/payroll/runs', {
                from: period.from, to: period.to, label: period.label, employees: computed
            }, 'PUT');
        }).then(function (data) {
            if (!data.success) throw new Error(data.message || 'Could not save the payroll.');
            if (key !== currentPeriod) return;
            run = data.run;
            render();
            var employees = run.employees;

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
            if (lastIncomplete.length) {
                var byEmp = {};
                lastIncomplete.forEach(function (r) { byEmp[r.employeeName] = true; });
                var names = Object.keys(byEmp);
                PPToast.error(lastIncomplete.length + ' day' + (lastIncomplete.length === 1 ? '' : 's') +
                    ' with a time-in but no time-out (' + names.slice(0, 3).join(', ') +
                    (names.length > 3 ? ', +' + (names.length - 3) + ' more' : '') +
                    ') are paid ₱0 for that day. Correct them in Attendance Recording, then click Recompute.');
            }
            showSkippedLoans(employees, run.label);
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
        var state = currentRun();
        btnRun.disabled = loading || state.status === 'released';
        btnRun.innerHTML = state.status === 'processing'
            ? '<i class="bi bi-arrow-repeat me-1"></i> Recompute Payroll'
            : '<i class="bi bi-play-fill me-1"></i> Run Payroll';
        btnRelease.disabled = loading || state.status !== 'processing' || !allReviewed();
        btnReviewAll.disabled = loading || state.status !== 'processing' || !getEmployees().length || allReviewed();
        btnDistribute.disabled = loading || state.status !== 'released';
        btnDistribute.innerHTML = state.distributed
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
            empty.innerHTML = loading
                ? 'Loading payroll…'
                : 'No payroll data for this period. Click <strong>Run Payroll</strong> to compute.';
            empty.classList.remove('d-none');
        } else {
            empty.classList.add('d-none');
            tbody.innerHTML = employees.map(function (emp, idx) {
                return (
                    '<tr class="pp-row-clickable" tabindex="0" role="button" data-idx="' + idx + '" ' +
                        'aria-label="View payroll breakdown for ' + escapeHtml(emp.name) + '">' +
                        '<td>' + escapeHtml(emp.employeeNumber) + '</td>' +
                        '<td><strong>' + escapeHtml(emp.name) + '</strong>' +
                            (skippedLoans(emp).length
                                ? ' <span class="pp-loan-skip-flag" title="Pay wasn\'t enough: loan not deducted this period">' +
                                  '<i class="bi bi-exclamation-triangle-fill"></i> Loan skipped</span>'
                                : '') + '</td>' +
                        '<td>' + typeBadge(emp.type) + '</td>' +
                        '<td class="col-units">' + emp.hours + ' hrs</td>' +
                        '<td class="col-money">' + peso(calcGross(emp)) + '</td>' +
                        '<td class="col-money">' + peso(calcDeductionsTotal(emp.deductions)) + '</td>' +
                        '<td class="col-money"><strong>' + peso(calcNet(emp)) + '</strong></td>' +
                    '</tr>'
                );
            }).join('');
        }

        updateTotals();
        updateButtons();
    }

    // ----------------------------------------------------------------
    // Breakdown: laid out like the emailed payslip (PayslipPdf on the
    // server): rows, columns and totals in the same order and wording.
    // ----------------------------------------------------------------

    function num2(n) {
        return (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function hrs(n) {
        return String(Math.round((Number(n) || 0) * 100) / 100);
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

    function psRow(label, hours, rate, amount, cls) {
        return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td>' +
            '<td class="num">' + hours + '</td><td class="num">' + rate + '</td><td class="num">' + amount + '</td></tr>';
    }

    function showBreakdown(idx) {
        var emp = getEmployees()[idx];
        if (!emp) return;

        var ded = emp.deductions;
        var e = payslipEarnings(emp);
        function earningRow(label, r) {
            return psRow(label, r ? hrs(r.hours) : '', r && r.rate != null && !r.mixed ? num2(r.rate) : '', r ? num2(r.amount) : '');
        }
        var applied = calcGross(emp);
        var benefits = calcBenefitsTotal(emp.benefits);
        var loans = payslipLoans(emp);
        var period = PERIODS[currentPeriod] ? PERIODS[currentPeriod].label : (run ? run.label : '');

        document.getElementById('breakdownTitle').textContent = 'Payslip';
        document.getElementById('breakdownBody').innerHTML =
            '<table class="pp-payslip">' +
                '<tbody class="pp-payslip-info">' +
                    '<tr><th>Payroll Computation For:</th><td colspan="3">' + escapeHtml(String(period).toUpperCase()) + '</td></tr>' +
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
                    (emp.benefits.length
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
            }).join('') +
            (emp.status === 'computed'
                ? '<button type="button" class="btn btn-pp-primary w-100 mt-3" id="btnMarkReviewed">Mark as Reviewed</button>'
                : '');

        if (emp.status === 'computed') {
            document.getElementById('btnMarkReviewed').addEventListener('click', function (event) {
                var button = event.currentTarget;
                button.disabled = true;
                jsonPost('api/payroll/runs/' + run.id + '/review', { employeeId: emp.id }).then(function (data) {
                    if (!data.success) throw new Error(data.message || 'Could not mark as reviewed.');
                    run = data.run;
                    render();
                    bootstrap.Offcanvas.getInstance(document.getElementById('breakdownPanel')).hide();
                }).catch(function (error) {
                    button.disabled = false;
                    PPToast.error(error.message || 'Could not reach the server.');
                });
            });
        }

        new bootstrap.Offcanvas(document.getElementById('breakdownPanel')).show();
    }


    // ================================================================
    // RELEASE
    // The server records each loan deduction against its loan (Loan
    // Management) and the itemised deductions, then locks the period —
    // all or nothing. Reports read the released payroll.
    // ================================================================

    // Review All: marks every computed employee of the period as reviewed.
    btnReviewAll.addEventListener('click', function () {
        if (!run || allReviewed()) return;
        var pending = getEmployees().filter(function (e) { return e.status === 'computed'; }).length;
        ConfirmModal.show({
            title: 'Review All',
            message: 'Mark all ' + pending + ' employee' + (pending === 1 ? '' : 's') + ' not yet reviewed as reviewed? ' +
                'Check their breakdowns first — this is the same as clicking Mark as Reviewed for each.',
            confirmText: 'Review All'
        }).then(function (confirmed) {
            if (!confirmed) return;
            btnReviewAll.disabled = true;
            jsonPost('api/payroll/runs/' + run.id + '/review-all').then(function (data) {
                if (!data.success) throw new Error(data.message || 'Could not review all.');
                run = data.run;
                render();
                PPToast.success('All employees are reviewed. You can now release the payroll.');
            }).catch(function (error) {
                PPToast.error(error.message === 'Not Found.'
                    ? 'The server doesn\'t have Review All yet. Restart it with start-payroll.bat.'
                    : error.message || 'Could not reach the server.');
                updateButtons();
            });
        });
    });

    btnRelease.addEventListener('click', function () {
        if (!run || !allReviewed()) return;
        var period = PERIODS[currentPeriod];

        ConfirmModal.show({
            title: 'Release Payroll',
            message: 'Release the ' + period.label + ' payroll? Loan deductions are recorded and the period can no longer be recomputed.',
            confirmText: 'Release'
        }).then(function (confirmed) {
            if (!confirmed) return;
            btnRelease.disabled = true;
            jsonPost('api/payroll/runs/' + run.id + '/release').then(function (data) {
                if (!data.success) {
                    PPToast.error((data.message || 'Could not release the payroll.') + ' Payroll was not released.');
                    return;
                }
                run = data.run;
                PPToast.success('Payroll released for ' + period.label + '. Click Distribute Payslips to email them.');
            }).catch(function () {
                PPToast.error('Could not reach the server. Payroll was not released.');
            }).then(function () {
                render();
            });
        });
    });

    // ================================================================
    // DISTRIBUTE PAYSLIPS (email) — sent from the payroll saved in the database
    // ================================================================

    btnDistribute.addEventListener('click', function () {
        if (!run || run.status !== 'released') return;
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

            jsonPost('api/payroll/runs/' + run.id + '/email').then(function (data) {
                if (!data.success) {
                    PPToast.error(data.message || 'Could not send the payslips.');
                    return;
                }
                run = data.run;
                window.dispatchEvent(new Event('pp:notifications-refresh'));
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
    periodSelect.addEventListener('change', function () {
        currentPeriod = periodSelect.value;
        loadRun();
    });

    PPPeriods.load().then(function () {
        PERIODS = buildPeriods();
        currentPeriod = Object.keys(PERIODS)[0];
        periodSelect.innerHTML = Object.keys(PERIODS).map(function (key) {
            return '<option value="' + key + '">' + PERIODS[key].label + '</option>';
        }).join('');
        periodSelect.value = currentPeriod;
        loadRun();
    });
})();
