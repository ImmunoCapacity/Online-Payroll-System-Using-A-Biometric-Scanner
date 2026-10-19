package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.benefit.BenefitService;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.contribution.ContributionTableService;
import com.stibalayan.payroll.loan.LoanService;
import com.stibalayan.payroll.rate.RateService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inputs for computing a pay period:
 * GET  /api/payroll/hours?from=&to=             office (biometric) and approved teaching hours per employee
 * GET  /api/payroll/benefits                    each employee's benefits (Benefits Table)
 * GET  /api/payroll/loan-deductions?from=&to=   loan deductions for the period
 * GET  /api/payroll/contribution-tables         BIR, PhilHealth, Pag-IBIG and SSS tables by year
 * GET  /api/payroll/rates?date=                 each employee's rates in effect on a date
 *
 * Payroll Computation History (stored in payroll_run / payroll):
 * GET  /api/payroll/runs?from=&to=              the saved payroll of a period (run: null if none)
 * GET  /api/payroll/runs/summary                every saved period with its totals
 * PUT  /api/payroll/runs                        { from, to, label, employees }  save Run Payroll / Recompute
 * POST /api/payroll/runs/{id}/review            { employeeId }  mark one employee reviewed
 * POST /api/payroll/runs/{id}/review-all        mark every employee of the period reviewed
 * POST /api/payroll/runs/{id}/release           record loan deductions and lock the period
 * POST /api/payroll/runs/{id}/email             "Distribute Payslips": email each stored payslip
 * GET  /api/payroll/released?year=              released payroll rows (Reports)
 */
@RestController
@RequestMapping("/api/payroll")
@RequireModule(SystemModule.PAYROLL)
public class PayrollController {

    private final PayslipMailService payslipMail;
    private final PayrollHoursService payrollHours;
    private final LoanService loans;
    private final BenefitService benefits;
    private final ContributionTableService contributionTables;
    private final RateService rates;
    private final PayrollRunService runs;

    public PayrollController(PayslipMailService payslipMail, PayrollHoursService payrollHours, LoanService loans,
                             BenefitService benefits, ContributionTableService contributionTables, RateService rates,
                             PayrollRunService runs) {
        this.payslipMail = payslipMail;
        this.payrollHours = payrollHours;
        this.loans = loans;
        this.benefits = benefits;
        this.contributionTables = contributionTables;
        this.rates = rates;
        this.runs = runs;
    }

    /** Each employee's active benefits (Benefits Table), paid every period. */
    @GetMapping("/benefits")
    public Map<String, Object> benefits() {
        return Map.of("success", true, "benefits", benefits.perEmployee());
    }

    @GetMapping("/hours")
    public Map<String, Object> hours(@RequestParam String from, @RequestParam String to) {
        return Map.of("success", true, "hours", payrollHours.hours(from, to));
    }

    /** Loan deductions per employee for a pay period. */
    @GetMapping("/loan-deductions")
    public Map<String, Object> loanDeductions(@RequestParam String from, @RequestParam String to) {
        return Map.of("success", true, "deductions", loans.deductionsFor(
                Validation.date(from, "from", "Start date", true), Validation.date(to, "to", "End date", true)));
    }

    @GetMapping("/contribution-tables")
    public Map<String, Object> contributionTables() {
        return Map.of("success", true, "tables", contributionTables.all());
    }

    @GetMapping("/rates")
    public Map<String, Object> rates(@RequestParam String date) {
        return Map.of("success", true, "rates", rates.ratesOn(Validation.date(date, "date", "Date", true)));
    }

    // ---- Saved runs ----

    @GetMapping("/runs")
    public Map<String, Object> run(@RequestParam String from, @RequestParam String to) {
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("run", runs.find(from, to));
        return result;
    }

    @GetMapping("/runs/summary")
    public Map<String, Object> summary() {
        return Map.of("success", true, "runs", runs.summaries());
    }

    @PutMapping("/runs")
    public Map<String, Object> save(@RequestBody PayrollRunService.SaveRequest request, HttpServletRequest http) {
        return Map.of("success", true, "run", runs.save(request, AuthInterceptor.currentUser(http).id()));
    }

    public record ReviewRequest(String employeeId) {
    }

    @PostMapping("/runs/{id}/review")
    public Map<String, Object> review(@PathVariable int id, @RequestBody ReviewRequest request) {
        return Map.of("success", true, "run", runs.review(id, request.employeeId()));
    }

    @PostMapping("/runs/{id}/review-all")
    public Map<String, Object> reviewAll(@PathVariable int id, HttpServletRequest http) {
        return Map.of("success", true, "run", runs.reviewAll(id, AuthInterceptor.currentUser(http).id()));
    }

    @PostMapping("/runs/{id}/release")
    public Map<String, Object> release(@PathVariable int id, HttpServletRequest http) {
        return Map.of("success", true, "run", runs.release(id, AuthInterceptor.currentUser(http).id()));
    }

    /** Emails the stored payslips of a released period (Distribute Payslips). */
    @PostMapping("/runs/{id}/email")
    public Map<String, Object> email(@PathVariable int id) {
        List<Map<String, String>> results = payslipMail.send(runs.payslips(id));
        long sent = results.stream().filter(r -> "sent".equals(r.get("status"))).count();
        Map<String, Object> run = runs.recordEmails(id, results, sent);
        return Map.of("success", true, "sent", sent, "total", results.size(), "results", results, "run", run);
    }

    @GetMapping("/released")
    @RequireModule(SystemModule.REPORTS)
    public Map<String, Object> released(@RequestParam(required = false) Integer year) {
        return Map.of("success", true, "records", runs.released(year));
    }
}
