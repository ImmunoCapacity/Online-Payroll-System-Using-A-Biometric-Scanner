package com.stibalayan.payroll.loan;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loan Management: loans approved by their lender, repaid through payroll.
 *
 * A loan is recorded with its lender, amount and payment period (first and
 * last payroll period); the deduction per payroll is the amount spread evenly
 * over those periods, the last one taking the leftover centavos.
 *
 * Each released payroll period records one payment per active loan
 * (loan_payment); the balance is the loan amount minus its payments. When an
 * employee's pay can't cover a loan, Payroll Computation skips it for that
 * period (recorded as a skipped payment of 0), so the loan simply runs one
 * period longer. Government loans (SSS, Pag-IBIG) are deducted first.
 */
@Service
public class LoanService {

    public static final List<String> LENDERS = List.of("SSS", "Pag-IBIG", "Bank", "Cooperative", "Other");
    private static final Set<String> NAMED_LENDERS = Set.of("Bank", "Cooperative", "Other");
    private static final Pattern REFERENCE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9/-]*$");
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("10000000.00");
    private static final BigDecimal ONE_PESO = BigDecimal.ONE;
    private static final int MAX_PERIODS = 240;   // ten years of cut-offs
    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("MMMM d");

    private final LoanRepository loans;
    private final LoanPaymentRepository payments;
    private final EmployeeDirectory employees;

    public LoanService(LoanRepository loans, LoanPaymentRepository payments, EmployeeDirectory employees) {
        this.loans = loans;
        this.payments = payments;
        this.employees = employees;
    }

    /** Add Loan: startDate and endDate are the starts of the first and last payroll periods. */
    public record LoanRequest(String employeeId, String lender, String lenderName, String reference, BigDecimal amount,
                              String startDate, String endDate, String remarks) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        Map<String, StaffMember> people = employees.all();
        List<Map<String, Object>> result = new ArrayList<>();
        loans.findAllByOrderByIdDesc().forEach(l -> result.add(view(l, people)));
        return result;
    }

    @Transactional
    public Map<String, Object> create(LoanRequest r, int userId) {
        StaffMember staff = employees.require(r.employeeId());
        String lender = r.lender() == null ? "" : r.lender().trim();
        if (!LENDERS.contains(lender)) {
            throw Validation.invalid("lender", "Choose the lender: " + String.join(", ", LENDERS) + ".");
        }
        String lenderName = null;
        if (NAMED_LENDERS.contains(lender)) {
            lenderName = Validation.requiredText(r.lenderName(), "lenderName",
                    lender.equals("Bank") ? "Bank name" : "Lender name", 100);
        }
        String reference = Validation.requiredText(r.reference(), "reference", "Reference number", 30);
        if (!REFERENCE.matcher(reference).matches()) {
            throw Validation.invalid("reference", "Reference number can only contain letters, digits, hyphens (-) and slashes (/).");
        }
        if (loans.existsByReferenceIgnoreCase(reference)) {
            throw Validation.invalid("reference", "A loan with this reference number already exists.");
        }
        BigDecimal amount = Validation.money(r.amount(), "amount", "Loan amount", MAX_AMOUNT);
        if (amount == null || amount.signum() <= 0) {
            throw Validation.invalid("amount", "Loan amount must be more than zero.");
        }
        LocalDate start = period(r.startDate(), "startDate", "Payment From");
        LocalDate end = period(r.endDate(), "endDate", "Payment To");
        if (end.isBefore(start)) {
            throw Validation.invalid("endDate", "Payment To can't be before Payment From.");
        }
        if (staff.getDateHired() != null && periodEnd(start).isBefore(staff.getDateHired())) {
            throw Validation.invalid("startDate", "That period is before this employee was hired.");
        }
        int periods = periodsBetween(start, end);
        if (periods > MAX_PERIODS) {
            throw Validation.invalid("endDate", "The payment period can be at most " + MAX_PERIODS + " payroll periods (10 years).");
        }
        BigDecimal perPayroll = perPayroll(amount, periods);
        if (perPayroll.signum() <= 0) {
            throw Validation.invalid("amount", "The loan amount is too small for that many payroll periods.");
        }

        Loan l = new Loan();
        EmployeeId eid = EmployeeId.parse(r.employeeId());
        if (eid.isFaculty()) {
            l.setFacultyId(eid.number());
        } else {
            l.setAdminstaffId(eid.number());
        }
        l.setLender(lender);
        l.setLenderName(lenderName);
        // The type decides the payslip line: SSS LOAN, PAG-IBIG LOAN or OTHER DEDUCTIONS.
        l.setType(lender + " Loan");
        l.setReference(reference);
        l.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        l.setDeductionPerPayroll(perPayroll);
        l.setStartDate(start);
        l.setEndDate(end);
        l.setRecordedOn(LocalDate.now());
        l.setRemarks(Validation.optionalText(r.remarks(), "remarks", "Remarks", 255));
        l.setRecordedBy(userId);
        return view(loans.saveAndFlush(l), employees.all());
    }

    // ---------------------------------------------------------------
    // Payroll
    // ---------------------------------------------------------------

    /**
     * The loan deductions for a pay period, per employee id, in the order
     * Payroll Computation applies them (government loans first, then the
     * oldest): each loan that has started and still has a balance. A period
     * already released keeps what it recorded (including a skip).
     */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> deductionsFor(LocalDate from, LocalDate to) {
        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        List<Loan> all = new ArrayList<>(loans.findAll());
        all.sort(Comparator.comparing((Loan l) -> isGovernment(l) ? 0 : 1).thenComparing(Loan::getId));
        for (Loan l : all) {
            if (l.getStartDate() == null || l.getStartDate().isAfter(to)) continue;
            List<LoanPayment> paid = payments.findByLoanIdOrderByPeriodFromAsc(l.getId());
            LoanPayment thisPeriod = paid.stream().filter(p -> p.getPeriodFrom().equals(from)).findFirst().orElse(null);
            BigDecimal amount;
            boolean skipped = false;
            if (thisPeriod != null) {
                amount = thisPeriod.getAmount();
                skipped = thisPeriod.isSkipped();
            } else {
                BigDecimal balance = l.getAmount().subtract(sum(paid));
                if (balance.signum() <= 0) continue;
                amount = scheduled(l, balance);
            }
            Map<String, Object> m = new HashMap<>();
            m.put("loanId", l.getId());
            m.put("type", l.getType());
            m.put("lender", lenderLabel(l));
            m.put("reference", l.getReference());
            m.put("amount", amount);
            m.put("skipped", skipped);
            result.computeIfAbsent(EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId()), k -> new ArrayList<>()).add(m);
        }
        return result;
    }

    /** loanId and amount deducted, or skipped (pay not enough: nothing deducted). */
    public record PaymentItem(Integer loanId, BigDecimal amount, boolean skipped) {
    }

    public record PaymentRequest(String periodFrom, String periodTo, String periodLabel, List<PaymentItem> payments) {
    }

    /** Records the deductions of a released payroll period (again on re-release: replaces that period's amounts). */
    @Transactional
    public int recordPayments(PaymentRequest r, int userId) {
        LocalDate from = Validation.date(r.periodFrom(), "periodFrom", "Period start", true);
        LocalDate to = Validation.date(r.periodTo(), "periodTo", "Period end", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("periodTo", "The period end can't be before its start.");
        }
        String label = Validation.optionalText(r.periodLabel(), "periodLabel", "Period", 60);
        int saved = 0;
        for (PaymentItem item : r.payments() == null ? List.<PaymentItem>of() : r.payments()) {
            Loan l = loans.findById(item.loanId() == null ? -1 : item.loanId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Loan not found."));
            BigDecimal amount = item.skipped() ? BigDecimal.ZERO : Validation.money(item.amount(), "amount", "Loan deduction", MAX_AMOUNT);
            if (amount == null) continue;
            List<LoanPayment> paid = payments.findByLoanIdOrderByPeriodFromAsc(l.getId());
            BigDecimal otherPeriods = sum(paid.stream().filter(p -> !p.getPeriodFrom().equals(from)).toList());
            BigDecimal balance = l.getAmount().subtract(otherPeriods);
            if (amount.compareTo(balance) > 0) {
                throw Validation.invalid("amount", "The deduction for " + l.getReference() + " is more than its remaining balance.");
            }
            LoanPayment p = payments.findByLoanIdAndPeriodFrom(l.getId(), from).orElseGet(LoanPayment::new);
            if (amount.signum() == 0 && !item.skipped()) {
                if (p.getId() != null) payments.delete(p);
                continue;
            }
            p.setLoanId(l.getId());
            p.setPeriodFrom(from);
            p.setPeriodTo(to);
            p.setPeriodLabel(label);
            p.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
            p.setSkipped(item.skipped());
            p.setRemainingBalance(balance.subtract(amount).setScale(2, RoundingMode.HALF_UP));
            p.setDateProcessed(LocalDateTime.now());
            p.setRecordedBy(userId);
            payments.save(p);
            l.setPaidOffDate(balance.subtract(amount).signum() == 0 ? to : null);
            loans.save(l);
            saved++;
        }
        return saved;
    }

    // ---------------------------------------------------------------

    private Map<String, Object> view(Loan l, Map<String, StaffMember> people) {
        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        StaffMember s = people.get(employeeId);
        List<LoanPayment> paid = payments.findByLoanIdOrderByPeriodFromAsc(l.getId());

        List<Map<String, Object>> history = new ArrayList<>();
        BigDecimal running = l.getAmount();
        int skips = 0;
        for (LoanPayment p : paid) {
            running = running.subtract(p.getAmount());
            if (p.isSkipped()) skips++;
            Map<String, Object> h = new HashMap<>();
            h.put("period", p.getPeriodLabel() != null ? p.getPeriodLabel() : periodLabel(p.getPeriodFrom()));
            h.put("amount", p.getAmount());
            h.put("skipped", p.isSkipped());
            h.put("remainingBalance", running.max(BigDecimal.ZERO));
            h.put("dateProcessed", p.getDateProcessed() == null ? null : p.getDateProcessed().toLocalDate().toString());
            history.add(h);
        }
        BigDecimal deducted = sum(paid);
        BigDecimal remaining = l.getAmount().subtract(deducted).max(BigDecimal.ZERO);
        LocalDate end = scheduledEnd(l);

        Map<String, Object> m = new HashMap<>();
        m.put("id", l.getId());
        m.put("employeeKey", employeeId);
        m.put("employeeId", s == null ? "" : s.getEmployeeNumber());
        m.put("employeeName", s == null ? "(removed employee)" : s.getFullName());
        m.put("employeeRole", s == null ? "" : roleOf(s.staffType()));
        m.put("employeeType", s == null ? "" : s.staffType());
        m.put("type", l.getType());
        m.put("lender", l.getLender() != null ? l.getLender() : lenderFromType(l.getType()));
        m.put("lenderName", l.getLenderName());
        m.put("lenderLabel", lenderLabel(l));
        m.put("reference", l.getReference());
        m.put("amount", l.getAmount());
        m.put("deductionPerPayroll", l.getDeductionPerPayroll());
        m.put("startDate", l.getStartDate() == null ? null : l.getStartDate().toString());
        m.put("startPeriodLabel", l.getStartDate() == null ? "—" : periodLabel(l.getStartDate()));
        m.put("endDate", end == null ? null : end.toString());
        m.put("endPeriodLabel", end == null ? "—" : periodLabel(end));
        // Each skipped period moves the end one period later.
        LocalDate expectedEnd = end;
        for (int i = 0; i < skips && expectedEnd != null; i++) expectedEnd = nextPeriod(expectedEnd);
        m.put("expectedEndPeriodLabel", expectedEnd == null ? "—" : periodLabel(expectedEnd));
        m.put("periods", l.getStartDate() == null || end == null ? null : periodsBetween(l.getStartDate(), end));
        m.put("skippedPeriods", skips);
        m.put("remarks", l.getRemarks());
        m.put("recordedOn", l.getRecordedOn() == null ? null : l.getRecordedOn().toString());
        m.put("totalDeducted", deducted);
        m.put("remainingBalance", remaining);
        m.put("status", remaining.signum() == 0 ? "Paid"
                : l.getStartDate() != null && l.getStartDate().isAfter(LocalDate.now()) ? "Upcoming" : "Active");
        m.put("deductionHistory", history);
        return m;
    }

    /** This period's deduction: the per-payroll amount, or the balance when less (or within a peso of it). */
    private static BigDecimal scheduled(Loan l, BigDecimal balance) {
        BigDecimal amount = l.getDeductionPerPayroll().min(balance);
        BigDecimal left = balance.subtract(amount);
        return left.signum() > 0 && left.compareTo(ONE_PESO) < 0 ? balance : amount;
    }

    /** Amount ÷ periods, rounded down to the centavo; the last period takes what's left. */
    static BigDecimal perPayroll(BigDecimal amount, int periods) {
        return amount.divide(BigDecimal.valueOf(periods), 2, RoundingMode.DOWN);
    }

    private static boolean isGovernment(Loan l) {
        String t = (l.getLender() != null ? l.getLender() : String.valueOf(l.getType())).toLowerCase();
        return t.contains("sss") || t.contains("pag-ibig") || t.contains("pagibig");
    }

    private static String lenderFromType(String type) {
        String t = type == null ? "" : type.toLowerCase();
        return t.startsWith("sss") ? "SSS" : t.startsWith("pag-ibig") ? "Pag-IBIG" : "Other";
    }

    /** e.g. "SSS", "BDO (Bank)", "Teachers' Coop (Cooperative)". */
    private static String lenderLabel(Loan l) {
        String lender = l.getLender() != null ? l.getLender() : lenderFromType(l.getType());
        return l.getLenderName() == null || l.getLenderName().isBlank() ? lender : l.getLenderName() + " (" + lender + ")";
    }

    /** The last scheduled period; for loans recorded before payment periods, from amount ÷ deduction. */
    private static LocalDate scheduledEnd(Loan l) {
        if (l.getEndDate() != null || l.getStartDate() == null) return l.getEndDate();
        BigDecimal per = l.getDeductionPerPayroll();
        if (per == null || per.signum() <= 0) return null;
        int n = l.getAmount().divide(per, 0, RoundingMode.CEILING).intValue();
        LocalDate end = l.getStartDate();
        for (int i = 1; i < Math.min(n, MAX_PERIODS); i++) end = nextPeriod(end);
        return end;
    }

    private static LocalDate period(String text, String field, String label) {
        LocalDate d = Validation.date(text, field, label, true);
        if (d.getDayOfMonth() != 11 && d.getDayOfMonth() != 26) {
            throw Validation.invalid(field, "Choose a payroll period for " + label + " (they start on the 11th or the 26th).");
        }
        return d;
    }

    /** Payroll periods from one period start to another, both included. */
    static int periodsBetween(LocalDate start, LocalDate end) {
        int n = 1;
        for (LocalDate d = start; d.isBefore(end) && n <= MAX_PERIODS; d = nextPeriod(d)) n++;
        return n;
    }

    static LocalDate nextPeriod(LocalDate start) {
        return start.getDayOfMonth() == 11 ? start.withDayOfMonth(26) : start.plusMonths(1).withDayOfMonth(11);
    }

    private static String roleOf(String staffType) {
        return switch (staffType) {
            case "Faculty" -> "Faculty Staff";
            case "Faculty/Admin" -> "Administrative and Faculty Staff";
            default -> "Administrative Staff";
        };
    }

    /** Pay periods run the 11th–25th and the 26th–10th of the next month. */
    static LocalDate periodEnd(LocalDate start) {
        return start.getDayOfMonth() == 11 ? start.withDayOfMonth(25) : start.plusMonths(1).withDayOfMonth(10);
    }

    static String periodLabel(LocalDate start) {
        LocalDate end = periodEnd(start);
        return start.format(MONTH_DAY) + (start.getYear() == end.getYear() ? "" : ", " + start.getYear())
                + " – " + end.format(MONTH_DAY) + ", " + end.getYear();
    }

    private static BigDecimal sum(List<LoanPayment> list) {
        return list.stream().map(LoanPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
