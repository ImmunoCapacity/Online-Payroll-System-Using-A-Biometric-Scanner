package com.stibalayan.payroll.payroll;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.loan.LoanService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payroll Computation History (tables payroll_run and payroll): each pay
 * period's payroll as computed on the Payroll Processing page, reviewed per
 * employee, then released. Releasing records the loan deductions and the
 * itemised deductions (table deduction) and locks the period. Reports read
 * released rows; payslips are emailed from the stored rows.
 *
 * Each payroll row keeps the employee's full breakdown (earnings lines,
 * benefits, deductions, loan items) as JSON in payroll.breakdown, and the
 * totals in the paper's columns (basic_salary, gross_pay, net_pay, ...).
 */
@Service
public class PayrollRunService {

    public static final String PROCESSING = "Processing";
    public static final String RELEASED = "Released";
    private static final BigDecimal MAX = new BigDecimal("99999999.99");
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() { };

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final EmployeeDirectory employees;
    private final LoanService loans;
    private final AuditService audit;

    private final PayrollAdjustmentService adjustments;

    public PayrollRunService(JdbcTemplate jdbc, ObjectMapper json, EmployeeDirectory employees, LoanService loans,
                             AuditService audit, PayrollAdjustmentService adjustments) {
        this.adjustments = adjustments;
        this.jdbc = jdbc;
        this.json = json;
        this.employees = employees;
        this.loans = loans;
        this.audit = audit;
    }

    /** Body of PUT /api/payroll/runs: the computed payroll of one period. */
    public record SaveRequest(String from, String to, String label, List<Map<String, Object>> employees) {
    }

    private record Run(int id, LocalDate from, LocalDate to, String label, String status) {
    }

    /** The run of one pay period, or null if payroll hasn't been run for it. */
    @Transactional(readOnly = true)
    public Map<String, Object> find(String fromText, String toText) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        List<Integer> ids = jdbc.queryForList("SELECT payroll_run_id FROM payroll_run WHERE pay_period_start = ? AND pay_period_end = ?",
                Integer.class, Date.valueOf(from), Date.valueOf(to));
        return ids.isEmpty() ? null : view(ids.get(0));
    }

    /** Saves (or replaces) the computed payroll of a period that isn't released yet. Everyone starts as Computed. */
    @Transactional
    public Map<String, Object> save(SaveRequest r, int userId) {
        LocalDate from = Validation.date(r.from(), "from", "Start date", true);
        LocalDate to = Validation.date(r.to(), "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The period end can't be before its start.");
        }
        String label = Validation.requiredText(r.label(), "label", "Pay period", 60);
        List<Map<String, Object>> list = r.employees() == null ? List.of() : r.employees();

        List<Integer> ids = jdbc.queryForList("SELECT payroll_run_id FROM payroll_run WHERE pay_period_start = ? AND pay_period_end = ? FOR UPDATE",
                Integer.class, Date.valueOf(from), Date.valueOf(to));
        int runId;
        if (ids.isEmpty()) {
            jdbc.update("INSERT INTO payroll_run (pay_period_start, pay_period_end, period_label, status, computed_by) VALUES (?, ?, ?, ?, ?)",
                    Date.valueOf(from), Date.valueOf(to), label, PROCESSING, userId);
            runId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
        } else {
            runId = ids.get(0);
            if (RELEASED.equals(run(runId).status())) {
                throw new ApiException(HttpStatus.CONFLICT, "This pay period is already released and can't be recomputed.");
            }
            jdbc.update("UPDATE payroll_run SET period_label = ?, computed_by = ?, computed_at = NOW() WHERE payroll_run_id = ?",
                    label, userId, runId);
            jdbc.update("DELETE FROM payroll WHERE payroll_run_id = ?", runId);
        }

        Set<String> seen = new HashSet<>();
        for (Map<String, Object> e : list) {
            String employeeId = String.valueOf(e.get("id"));
            StaffMember s = employees.require(employeeId);
            if (!seen.add(employeeId)) {
                throw Validation.invalid("employees", "An employee is listed twice.");
            }
            insertRow(runId, from, to, employeeId, s, e);
        }
        return view(runId);
    }

    @Transactional
    public Map<String, Object> review(int runId, String employeeId) {
        Run run = run(runId);
        if (RELEASED.equals(run.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "This pay period is already released.");
        }
        EmployeeId eid = EmployeeId.parse(employeeId);
        int changed = jdbc.update("UPDATE payroll SET review_status = 'Reviewed' WHERE payroll_run_id = ? AND "
                + (eid.isFaculty() ? "faculty_id" : "adminstaff_id") + " = ?", runId, eid.number());
        if (changed == 0) {
            throw new ApiException(HttpStatus.NOT_FOUND, "This employee isn't in the payroll of this period.");
        }
        return view(runId);
    }

    /** "Review All": marks every employee of an unreleased period as reviewed. */
    @Transactional
    public Map<String, Object> reviewAll(int runId, int userId) {
        Run run = run(runId);
        if (RELEASED.equals(run.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "This pay period is already released.");
        }
        int changed = jdbc.update("UPDATE payroll SET review_status = 'Reviewed' WHERE payroll_run_id = ? AND review_status <> 'Reviewed'",
                runId);
        audit.log(userId, "Payroll", "Reviewed all", run.label() + " · " + changed + " employee" + (changed == 1 ? "" : "s"));
        return view(runId);
    }

    /**
     * Releases a period once everyone is reviewed: records each loan
     * deduction against its loan (Loan Management), writes the itemised
     * deductions and locks the period — all or nothing.
     */
    @Transactional
    public Map<String, Object> release(int runId, int userId) {
        Run run = run(runId);
        if (RELEASED.equals(run.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "This pay period is already released.");
        }
        List<Map<String, Object>> rows = rows(runId);
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "There is no payroll to release. Click Run Payroll first.");
        }
        if (rows.stream().anyMatch(r -> !"Reviewed".equals(r.get("review_status")))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Review every employee before releasing.");
        }

        List<LoanService.PaymentItem> payments = new ArrayList<>();
        BigDecimal totalNet = BigDecimal.ZERO;
        for (Map<String, Object> r : rows) {
            Map<String, Object> b = breakdown(r);
            for (Object item : list(b.get("loanItems"))) {
                Map<?, ?> l = (Map<?, ?>) item;
                BigDecimal amount = money(l.get("amount"));
                boolean skipped = Boolean.TRUE.equals(l.get("skipped"));
                // A skipped loan (pay not enough) is recorded too, so its history shows it.
                if (l.get("loanId") != null && (amount.signum() > 0 || skipped)) {
                    payments.add(new LoanService.PaymentItem(((Number) l.get("loanId")).intValue(), amount, skipped));
                }
            }
            int payrollId = (Integer) r.get("payroll_id");
            Object facultyId = r.get("faculty_id");
            Object adminId = r.get("adminstaff_id");
            addDeduction(payrollId, facultyId, adminId, "SSS", (BigDecimal) r.get("sss_contribution"));
            addDeduction(payrollId, facultyId, adminId, "PhilHealth", (BigDecimal) r.get("philhealth_contribution"));
            addDeduction(payrollId, facultyId, adminId, "Pagibig", (BigDecimal) r.get("pagibig_contribution"));
            addDeduction(payrollId, facultyId, adminId, "Tax", (BigDecimal) r.get("tax"));
            BigDecimal loan = ((BigDecimal) r.get("sss_loan")).add((BigDecimal) r.get("pagibig_loan")).add((BigDecimal) r.get("other_deductions"));
            addDeduction(payrollId, facultyId, adminId, "Loan", loan);
            totalNet = totalNet.add((BigDecimal) r.get("net_pay"));
        }
        loans.recordPayments(new LoanService.PaymentRequest(run.from().toString(), run.to().toString(), run.label(), payments), userId);

        jdbc.update("UPDATE payroll SET review_status = 'Released', date_generated = NOW() WHERE payroll_run_id = ?", runId);
        jdbc.update("UPDATE payroll_run SET status = ?, released_by = ?, released_at = NOW() WHERE payroll_run_id = ?",
                RELEASED, userId, runId);
        // Payroll Adjustments paid in this cut-off are now done.
        adjustments.markApplied(runId, run.from(), run.to());
        audit.log(userId, "Payroll", "Released payroll", run.label() + " · " + rows.size() + " employee"
                + (rows.size() == 1 ? "" : "s") + " · net ₱" + String.format("%,.2f", totalNet));
        return view(runId);
    }

    /** The stored payslips of a released period, in the shape the mail service sends. */
    @Transactional(readOnly = true)
    public PayslipRequest payslips(int runId) {
        Run run = run(runId);
        if (!RELEASED.equals(run.status())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Release the payroll before distributing payslips.");
        }
        List<PayslipRequest.Payslip> slips = new ArrayList<>();
        for (Map<String, Object> r : rows(runId)) {
            Map<String, Object> b = breakdown(r);
            List<PayslipRequest.Earning> earnings = new ArrayList<>();
            for (Object o : list(b.get("earnings"))) {
                Map<?, ?> l = (Map<?, ?>) o;
                earnings.add(new PayslipRequest.Earning(String.valueOf(l.get("label")), money(l.get("hours")),
                        money(l.get("rate")), money(l.get("amount"))));
            }
            List<PayslipRequest.Benefit> benefits = new ArrayList<>();
            for (Object o : list(b.get("benefits"))) {
                Map<?, ?> l = (Map<?, ?>) o;
                benefits.add(new PayslipRequest.Benefit(String.valueOf(l.get("name")), money(l.get("amount"))));
            }
            slips.add(new PayslipRequest.Payslip(
                    EmployeeDirectory.idOf((Integer) r.get("faculty_id"), (Integer) r.get("adminstaff_id")),
                    (BigDecimal) r.get("total_hours_worked"), (BigDecimal) r.get("employee_rate"),
                    (BigDecimal) r.get("basic_salary"), benefits,
                    new PayslipRequest.Deductions((BigDecimal) r.get("sss_contribution"), (BigDecimal) r.get("philhealth_contribution"),
                            (BigDecimal) r.get("pagibig_contribution"), (BigDecimal) r.get("tax"),
                            (BigDecimal) r.get("sss_loan"), (BigDecimal) r.get("pagibig_loan"), (BigDecimal) r.get("other_deductions")),
                    earnings));
        }
        // The Payroll Master who released the period signs the payslips.
        List<String> releasedBy = jdbc.queryForList("SELECT TRIM(CONCAT(u.first_name, ' ', u.last_name)) FROM payroll_run r "
                + "JOIN users u ON u.user_id = r.released_by WHERE r.payroll_run_id = ?", String.class, runId);
        return new PayslipRequest(run.label(), run.to().plusDays(1).toString(),
                releasedBy.isEmpty() ? "" : releasedBy.get(0), slips);
    }

    /** Saves how each payslip email went. */
    @Transactional
    public Map<String, Object> recordEmails(int runId, List<Map<String, String>> results, long sent) {
        for (Map<String, String> r : results) {
            EmployeeId eid = EmployeeId.parse(r.get("employeeId"));
            jdbc.update("UPDATE payroll SET email_status = ?, email_message = ? WHERE payroll_run_id = ? AND "
                            + (eid.isFaculty() ? "faculty_id" : "adminstaff_id") + " = ?",
                    r.get("status"), cut(r.get("message"), 255), runId, eid.number());
        }
        jdbc.update("UPDATE payroll_run SET distributed_at = NOW(), emails_sent = ?, emails_total = ? WHERE payroll_run_id = ?",
                sent, results.size(), runId);
        return view(runId);
    }

    /** Released payroll rows for Reports, newest period first; year null = every year. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> released(Integer year) {
        List<Map<String, Object>> result = new ArrayList<>();
        String sql = "SELECT p.*, r.period_label, r.pay_period_start, r.pay_period_end FROM payroll p "
                + "JOIN payroll_run r ON r.payroll_run_id = p.payroll_run_id WHERE r.status = 'Released' "
                + (year == null ? "" : "AND YEAR(r.pay_period_end) = ? ")
                + "ORDER BY r.pay_period_start DESC, p.employee_type, p.lastname, p.firstname";
        Object[] args = year == null ? new Object[0] : new Object[] {year};
        jdbc.queryForList(sql, args).forEach(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeKey", EmployeeDirectory.idOf((Integer) r.get("faculty_id"), (Integer) r.get("adminstaff_id")));
            m.put("employeeId", r.get("employee_number"));
            m.put("employee", fullName(r));
            m.put("employeeType", r.get("employee_type"));
            m.put("periodLabel", r.get("period_label"));
            m.put("periodStart", r.get("pay_period_start").toString());
            m.put("periodEnd", r.get("pay_period_end").toString());
            m.put("payDate", LocalDate.parse(r.get("pay_period_end").toString()).plusDays(1).toString());
            m.put("hours", r.get("total_hours_worked"));
            m.put("employeeRate", r.get("employee_rate"));
            m.put("gross", r.get("basic_salary"));
            m.put("benefits", r.get("benefits"));
            m.put("sss", r.get("sss_contribution"));
            m.put("philhealth", r.get("philhealth_contribution"));
            m.put("pagibig", r.get("pagibig_contribution"));
            m.put("tax", r.get("tax"));
            m.put("loan", ((BigDecimal) r.get("sss_loan")).add((BigDecimal) r.get("pagibig_loan")).add((BigDecimal) r.get("other_deductions")));
            m.put("deductions", r.get("total_deductions"));
            m.put("net", r.get("net_pay"));
            m.put("dateGenerated", dateTime(r.get("date_generated")));
            result.add(m);
        });
        return result;
    }

    /** Every saved run, newest first, for the dashboards. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> summaries() {
        return jdbc.queryForList("SELECT r.payroll_run_id, r.pay_period_start, r.pay_period_end, r.period_label, r.status, "
                + "r.released_at, COUNT(p.payroll_id) AS employees, COALESCE(SUM(p.gross_pay), 0) AS gross, "
                + "COALESCE(SUM(p.total_deductions), 0) AS deductions, COALESCE(SUM(p.net_pay), 0) AS net "
                + "FROM payroll_run r LEFT JOIN payroll p ON p.payroll_run_id = r.payroll_run_id "
                + "GROUP BY r.payroll_run_id ORDER BY r.pay_period_start DESC").stream().map(r -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", r.get("payroll_run_id"));
                    m.put("from", r.get("pay_period_start").toString());
                    m.put("to", r.get("pay_period_end").toString());
                    m.put("label", r.get("period_label"));
                    m.put("status", String.valueOf(r.get("status")).toLowerCase());
                    m.put("releasedAt", dateTime(r.get("released_at")));
                    m.put("employees", r.get("employees"));
                    m.put("gross", r.get("gross"));
                    m.put("deductions", r.get("deductions"));
                    m.put("net", r.get("net"));
                    return m;
                }).toList();
    }

    // ---------------------------------------------------------------

    private void insertRow(int runId, LocalDate from, LocalDate to, String employeeId, StaffMember s, Map<String, Object> e) {
        // Amounts are recomputed here from the lines, so the stored totals always add up.
        List<Map<String, Object>> earnings = new ArrayList<>();
        BigDecimal gross = BigDecimal.ZERO;
        BigDecimal hours = BigDecimal.ZERO;
        for (Object o : list(e.get("earnings"))) {
            Map<?, ?> l = (Map<?, ?>) o;
            // A Payroll Adjustment that deducts hours is a negative line.
            boolean adjustment = String.valueOf(l.get("label")).startsWith("Adjustment:");
            BigDecimal h = adjustment ? checkSigned(money(l.get("hours")), "hours") : check(money(l.get("hours")), "hours");
            BigDecimal rate = check(money(l.get("rate")), "rate");
            BigDecimal amount = h.multiply(rate).setScale(2, RoundingMode.HALF_UP);
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("label", Validation.requiredText(String.valueOf(l.get("label")), "earnings", "Earnings label", 100));
            line.put("hours", h);
            line.put("rate", rate);
            line.put("amount", amount);
            earnings.add(line);
            gross = gross.add(amount);
            // Holiday double pay pays hours already counted in another line once more.
            if (!String.valueOf(line.get("label")).toLowerCase().startsWith("holiday")) {
                hours = hours.add(h);
            }
        }
        if (gross.signum() < 0) {
            throw Validation.invalid("earnings", s.getFullName() + ": the payroll adjustment deducts more than the pay for this cut-off.");
        }
        List<Map<String, Object>> benefits = new ArrayList<>();
        BigDecimal benefitTotal = BigDecimal.ZERO;
        for (Object o : list(e.get("benefits"))) {
            Map<?, ?> l = (Map<?, ?>) o;
            BigDecimal amount = check(money(l.get("amount")), "benefits");
            benefits.add(Map.of("name", Validation.requiredText(String.valueOf(l.get("name")), "benefits", "Benefit", 50), "amount", amount));
            benefitTotal = benefitTotal.add(amount);
        }
        Map<?, ?> d = e.get("deductions") instanceof Map<?, ?> m ? m : Map.of();
        BigDecimal sss = check(money(d.get("sss")), "deductions");
        BigDecimal philhealth = check(money(d.get("philhealth")), "deductions");
        BigDecimal pagibig = check(money(d.get("pagibig")), "deductions");
        BigDecimal tax = check(money(d.get("bir")), "deductions");

        List<Map<String, Object>> loanItems = new ArrayList<>();
        BigDecimal sssLoan = BigDecimal.ZERO;
        BigDecimal pagibigLoan = BigDecimal.ZERO;
        BigDecimal otherLoan = BigDecimal.ZERO;
        for (Object o : list(e.get("loanItems"))) {
            Map<?, ?> l = (Map<?, ?>) o;
            // Skipped: the pay couldn't cover this loan, so nothing is deducted this period.
            boolean skipped = Boolean.TRUE.equals(l.get("skipped"));
            BigDecimal amount = skipped ? BigDecimal.ZERO : check(money(l.get("amount")), "loanItems");
            String type = String.valueOf(l.get("type"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("loanId", l.get("loanId") instanceof Number n ? n.intValue() : null);
            item.put("type", type);
            item.put("lender", l.get("lender") == null ? null : String.valueOf(l.get("lender")));
            item.put("reference", l.get("reference") == null ? null : String.valueOf(l.get("reference")));
            item.put("amount", amount);
            if (skipped) {
                item.put("skipped", true);
                item.put("scheduled", check(money(l.get("scheduled")), "loanItems"));
            }
            loanItems.add(item);
            String t = type.toLowerCase();
            if (t.contains("sss")) sssLoan = sssLoan.add(amount);
            else if (t.contains("pag-ibig") || t.contains("pagibig")) pagibigLoan = pagibigLoan.add(amount);
            else otherLoan = otherLoan.add(amount);
        }
        BigDecimal loan = sssLoan.add(pagibigLoan).add(otherLoan);
        BigDecimal deductions = sss.add(philhealth).add(pagibig).add(tax).add(loan);
        BigDecimal net = gross.add(benefitTotal).subtract(deductions);

        Map<String, Object> breakdown = new LinkedHashMap<>();
        breakdown.put("id", employeeId);
        breakdown.put("employeeNumber", s.getEmployeeNumber());
        breakdown.put("name", s.getFullName());
        breakdown.put("type", s.staffType());
        breakdown.put("hours", hours);
        breakdown.put("daysWorked", e.get("daysWorked"));
        breakdown.put("overlapHours", e.get("overlapHours"));
        breakdown.put("unapprovedClasses", e.get("unapprovedClasses"));
        breakdown.put("rate", check(money(e.get("rate")), "rate"));
        breakdown.put("earnings", earnings);
        breakdown.put("benefits", benefits);
        breakdown.put("deductions", Map.of("sss", sss, "philhealth", philhealth, "pagibig", pagibig, "bir", tax, "loan", loan));
        breakdown.put("loanItems", loanItems);

        EmployeeId eid = EmployeeId.parse(employeeId);
        jdbc.update("INSERT INTO payroll (faculty_id, adminstaff_id, firstname, middlename, lastname, basic_salary, gross_pay, net_pay, "
                        + "benefits, total_hours_worked, employee_rate, total_deductions, other_deductions, sss_contribution, "
                        + "philhealth_contribution, pagibig_contribution, sss_loan, pagibig_loan, tax, pay_period_start, pay_period_end, "
                        + "payroll_run_id, employee_number, employee_type, review_status, breakdown) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Computed', ?)",
                eid.isFaculty() ? eid.number() : null, eid.isFaculty() ? null : eid.number(),
                s.getFirstname(), s.getMiddlename(), s.getLastname(),
                gross, gross.add(benefitTotal), net, benefitTotal, hours, breakdown.get("rate"), deductions, otherLoan,
                sss, philhealth, pagibig, sssLoan, pagibigLoan, tax, Date.valueOf(from), Date.valueOf(to),
                runId, s.getEmployeeNumber(), s.staffType(), write(breakdown));
    }

    private void addDeduction(int payrollId, Object facultyId, Object adminId, String type, BigDecimal amount) {
        if (amount != null && amount.signum() > 0) {
            jdbc.update("INSERT INTO deduction (faculty_id, adminstaff_id, payroll_id, deduction_type, amount) VALUES (?, ?, ?, ?, ?)",
                    facultyId, adminId, payrollId, type, amount);
        }
    }

    private Run run(int runId) {
        List<Run> list = jdbc.query("SELECT payroll_run_id, pay_period_start, pay_period_end, period_label, status FROM payroll_run WHERE payroll_run_id = ?",
                (rs, n) -> new Run(rs.getInt(1), rs.getDate(2).toLocalDate(), rs.getDate(3).toLocalDate(), rs.getString(4), rs.getString(5)),
                runId);
        if (list.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Payroll run not found.");
        }
        return list.get(0);
    }

    private List<Map<String, Object>> rows(int runId) {
        return jdbc.queryForList("SELECT * FROM payroll WHERE payroll_run_id = ? ORDER BY payroll_id", runId);
    }

    /** The run in the shape the Payroll Processing page works with. */
    private Map<String, Object> view(int runId) {
        Map<String, Object> run = jdbc.queryForMap("SELECT * FROM payroll_run WHERE payroll_run_id = ?", runId);
        Map<String, StaffMember> people = employees.all();
        List<Map<String, Object>> list = new ArrayList<>();
        boolean released = RELEASED.equals(run.get("status"));
        for (Map<String, Object> r : rows(runId)) {
            Map<String, Object> b = breakdown(r);
            // Not yet released: show the employee's current name and number (e.g. after a correction).
            StaffMember s = people.get(String.valueOf(b.get("id")));
            if (!released && s != null) {
                b.put("name", s.getFullName());
                b.put("employeeNumber", s.getEmployeeNumber());
            } else if (r.get("employee_number") != null) {
                // Released: the stored number (kept up to date when IDs were reformatted).
                b.put("employeeNumber", r.get("employee_number"));
            }
            if (s != null) {
                b.put("designation", PayslipPdf.designation(s));
            }
            b.put("status", String.valueOf(r.get("review_status")).toLowerCase());
            b.put("emailStatus", r.get("email_status"));
            b.put("emailMessage", r.get("email_message"));
            list.add(b);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", runId);
        m.put("from", run.get("pay_period_start").toString());
        m.put("to", run.get("pay_period_end").toString());
        m.put("label", run.get("period_label"));
        m.put("status", String.valueOf(run.get("status")).toLowerCase());
        m.put("releasedAt", dateTime(run.get("released_at")));
        Object distributedAt = run.get("distributed_at");
        if (distributedAt != null) {
            m.put("distributed", Map.of("sent", run.get("emails_sent"), "total", run.get("emails_total"),
                    "at", dateTime(distributedAt)));
        } else {
            m.put("distributed", null);
        }
        m.put("employees", list);
        return m;
    }

    private Map<String, Object> breakdown(Map<String, Object> row) {
        try {
            Object text = row.get("breakdown");
            return text == null ? new LinkedHashMap<>() : json.readValue(String.valueOf(text), MAP);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unreadable payroll breakdown #" + row.get("payroll_id"), e);
        }
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String fullName(Map<String, Object> r) {
        String middle = r.get("middlename") == null || String.valueOf(r.get("middlename")).isBlank()
                ? " " : " " + r.get("middlename") + " ";
        return (r.get("firstname") + middle + r.get("lastname")).trim();
    }

    private static List<?> list(Object value) {
        return value instanceof List<?> l ? l : List.of();
    }

    private static BigDecimal money(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(value)).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            throw Validation.invalid("employees", "A payroll amount is not a number.");
        }
    }

    /** Like check(), but may be negative (a Payroll Adjustment that deducts hours). */
    private static BigDecimal checkSigned(BigDecimal value, String field) {
        if (value.abs().compareTo(MAX) > 0) {
            throw Validation.invalid(field, "A payroll amount is out of range.");
        }
        return value;
    }

    private static BigDecimal check(BigDecimal value, String field) {
        if (value.signum() < 0 || value.compareTo(MAX) > 0) {
            throw Validation.invalid(field, "A payroll amount is out of range.");
        }
        return value;
    }

    /** DATETIME values come back as Timestamp or LocalDateTime depending on the driver. */
    private static String dateTime(Object value) {
        if (value == null) return null;
        return value instanceof Timestamp t ? t.toLocalDateTime().toString() : value.toString();
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
