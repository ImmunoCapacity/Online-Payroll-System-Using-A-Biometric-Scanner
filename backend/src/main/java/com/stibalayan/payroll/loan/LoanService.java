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
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Loan Management: loans approved by their lender, repaid through payroll.
 *
 * A loan is recorded with its lender, amount, interest and payment period
 * (Payment From and Payment To dates). The total (amount plus interest) is
 * split evenly over the months of that period: one deduction a month, taken
 * in the payroll that ends on the 25th (the 11th–25th cut-off). The last
 * month takes the leftover centavos.
 *
 * Each released payroll records one payment per loan due (loan_payment); the
 * balance is the total minus its payments. When an employee's pay can't
 * cover a loan, Payroll Computation skips it for that month (recorded as a
 * skipped payment of 0), so the loan simply runs one month longer.
 * Government loans (SSS, Pag-IBIG) are deducted first.
 */
@Service
public class LoanService {

    private static final Pattern REFERENCE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9/-]*$");
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("10000000.00");
    private static final BigDecimal MAX_INTEREST = new BigDecimal("100");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal ONE_PESO = BigDecimal.ONE;
    private static final int MAX_MONTHS = 120;   // ten years
    /** Loans are deducted in the cut-off that ends on this day of the month. */
    static final int DEDUCTION_DAY = 25;
    private static final DateTimeFormatter MONTH_YEAR = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("MMMM d", Locale.ENGLISH);

    private final LoanRepository loans;
    private final LoanPaymentRepository payments;
    private final EmployeeDirectory employees;

    public LoanService(LoanRepository loans, LoanPaymentRepository payments, EmployeeDirectory employees) {
        this.loans = loans;
        this.payments = payments;
        this.employees = employees;
    }

    /** Add Loan: startDate and endDate are Payment From and Payment To. */
    public record LoanRequest(String employeeId, String lender, String reference, BigDecimal amount,
                              BigDecimal interestRate, String startDate, String endDate) {
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
        String lender = Validation.requiredText(r.lender(), "lender", "Lender", 100);
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
        BigDecimal rate = r.interestRate() == null ? BigDecimal.ZERO : r.interestRate();
        if (rate.signum() < 0 || rate.compareTo(MAX_INTEREST) > 0 || rate.scale() > 2) {
            throw Validation.invalid("interestRate", "Interest must be from 0 to 100%, with up to 2 decimals.");
        }
        LocalDate start = Validation.date(r.startDate(), "startDate", "Payment From", true);
        LocalDate end = Validation.date(r.endDate(), "endDate", "Payment To", true);
        if (end.isBefore(start)) {
            throw Validation.invalid("endDate", "Payment To can't be before Payment From.");
        }
        if (staff.getDateHired() != null && end.isBefore(staff.getDateHired())) {
            throw Validation.invalid("endDate", "The payment period ends before this employee was hired.");
        }
        int months = monthsBetween(start, end);
        if (months > MAX_MONTHS) {
            throw Validation.invalid("endDate", "The payment period can be at most " + MAX_MONTHS + " months (10 years).");
        }
        BigDecimal total = totalWithInterest(amount, rate);
        BigDecimal perMonth = perPayroll(total, months);
        if (perMonth.signum() <= 0) {
            throw Validation.invalid("amount", "The loan amount is too small for that many months.");
        }

        Loan l = new Loan();
        EmployeeId eid = EmployeeId.parse(r.employeeId());
        if (eid.isFaculty()) {
            l.setFacultyId(eid.number());
        } else {
            l.setAdminstaffId(eid.number());
        }
        l.setLender(lender);
        // The type decides the payslip line: SSS LOAN, PAG-IBIG LOAN or OTHER DEDUCTIONS.
        l.setType(typeOf(lender));
        l.setReference(reference);
        l.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        l.setInterestRate(rate.setScale(2, RoundingMode.HALF_UP));
        l.setTotalPayable(total);
        l.setDeductionPerPayroll(perMonth);
        l.setStartDate(start);
        l.setEndDate(end);
        l.setRecordedOn(LocalDate.now());
        l.setRecordedBy(userId);
        return view(loans.saveAndFlush(l), employees.all());
    }

    // ---------------------------------------------------------------
    // Payroll
    // ---------------------------------------------------------------

    /**
     * The loan deductions for a pay period, per employee id, in the order
     * Payroll Computation applies them (government loans first, then the
     * oldest). Loans are deducted once a month, in the period that has the
     * 25th; each loan whose Payment From month has come and that still has a
     * balance. A period already released keeps what it recorded (including a
     * skip).
     */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> deductionsFor(LocalDate from, LocalDate to) {
        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        YearMonth month = deductionMonth(from, to);
        List<Loan> all = new ArrayList<>(loans.findAll());
        all.sort(Comparator.comparing((Loan l) -> isGovernment(l) ? 0 : 1).thenComparing(Loan::getId));
        for (Loan l : all) {
            if (l.getStartDate() == null) continue;
            List<LoanPayment> paid = payments.findByLoanIdOrderByPeriodFromAsc(l.getId());
            LoanPayment thisPeriod = paid.stream().filter(p -> p.getPeriodFrom().equals(from)).findFirst().orElse(null);
            BigDecimal amount;
            boolean skipped = false;
            if (thisPeriod != null) {
                amount = thisPeriod.getAmount();
                skipped = thisPeriod.isSkipped();
            } else {
                if (month == null || month.isBefore(YearMonth.from(l.getStartDate()))) continue;
                BigDecimal balance = total(l).subtract(sum(paid));
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
            BigDecimal balance = total(l).subtract(otherPeriods);
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
        BigDecimal running = total(l);
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
        BigDecimal remaining = total(l).subtract(deducted).max(BigDecimal.ZERO);
        YearMonth endMonth = scheduledEnd(l);

        Map<String, Object> m = new HashMap<>();
        m.put("id", l.getId());
        m.put("employeeKey", employeeId);
        m.put("employeeId", s == null ? "" : s.getEmployeeNumber());
        m.put("employeeName", s == null ? "(removed employee)" : s.getFullName());
        m.put("employeeRole", s == null ? "" : roleOf(s.staffType()));
        m.put("employeeType", s == null ? "" : s.staffType());
        m.put("type", l.getType());
        m.put("lender", lenderLabel(l));
        m.put("lenderLabel", lenderLabel(l));
        m.put("reference", l.getReference());
        m.put("amount", l.getAmount());
        m.put("interestRate", l.getInterestRate() == null ? BigDecimal.ZERO : l.getInterestRate());
        m.put("interestAmount", total(l).subtract(l.getAmount()));
        m.put("totalPayable", total(l));
        m.put("deductionPerPayroll", l.getDeductionPerPayroll());
        m.put("startDate", l.getStartDate() == null ? null : l.getStartDate().toString());
        m.put("startPeriodLabel", l.getStartDate() == null ? "—" : YearMonth.from(l.getStartDate()).format(MONTH_YEAR));
        m.put("endDate", l.getEndDate() != null ? l.getEndDate().toString() : endMonth == null ? null : endMonth.atEndOfMonth().toString());
        m.put("endPeriodLabel", endMonth == null ? "—" : endMonth.format(MONTH_YEAR));
        // Each skipped month moves the end one month later.
        m.put("expectedEndPeriodLabel", endMonth == null ? "—" : endMonth.plusMonths(skips).format(MONTH_YEAR));
        m.put("periods", l.getStartDate() == null || endMonth == null ? null
                : (int) ChronoUnit.MONTHS.between(YearMonth.from(l.getStartDate()), endMonth) + 1);
        m.put("skippedPeriods", skips);
        m.put("recordedOn", l.getRecordedOn() == null ? null : l.getRecordedOn().toString());
        m.put("totalDeducted", deducted);
        m.put("remainingBalance", remaining);
        m.put("status", remaining.signum() == 0 ? "Paid"
                : l.getStartDate() != null && YearMonth.from(l.getStartDate()).isAfter(YearMonth.now()) ? "Upcoming" : "Active");
        m.put("deductionHistory", history);
        return m;
    }

    /** What payroll deducts in total: the amount plus interest. */
    static BigDecimal total(Loan l) {
        return l.getTotalPayable() != null ? l.getTotalPayable() : l.getAmount();
    }

    static BigDecimal totalWithInterest(BigDecimal amount, BigDecimal rate) {
        return amount.add(amount.multiply(rate).divide(HUNDRED, 2, RoundingMode.HALF_UP)).setScale(2, RoundingMode.HALF_UP);
    }

    /** This month's deduction: the monthly amount, or the balance when less (or within a peso of it). */
    private static BigDecimal scheduled(Loan l, BigDecimal balance) {
        BigDecimal amount = l.getDeductionPerPayroll().min(balance);
        BigDecimal left = balance.subtract(amount);
        return left.signum() > 0 && left.compareTo(ONE_PESO) < 0 ? balance : amount;
    }

    /** Total ÷ months, rounded down to the centavo; the last month takes what's left. */
    static BigDecimal perPayroll(BigDecimal total, int months) {
        return total.divide(BigDecimal.valueOf(months), 2, RoundingMode.DOWN);
    }

    /** Months from Payment From to Payment To, both included (Nov 1 – Apr 30 is 6). */
    static int monthsBetween(LocalDate start, LocalDate end) {
        return (int) ChronoUnit.MONTHS.between(YearMonth.from(start), YearMonth.from(end)) + 1;
    }

    /** The month whose loan deduction falls in this pay period (it has the 25th), or null. */
    static YearMonth deductionMonth(LocalDate from, LocalDate to) {
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (d.getDayOfMonth() == DEDUCTION_DAY) return YearMonth.from(d);
        }
        return null;
    }

    /** "SSS Loan", "Pag-IBIG Loan" or e.g. "BDO Loan" (decides the payslip line). */
    static String typeOf(String lender) {
        String t = lender.toLowerCase(Locale.ROOT);
        if (t.contains("sss")) return "SSS Loan";
        if (t.contains("pag-ibig") || t.contains("pagibig") || t.contains("pag ibig") || t.contains("hdmf")) return "Pag-IBIG Loan";
        String type = lender + " Loan";
        return type.length() > 50 ? type.substring(0, 50) : type;
    }

    private static boolean isGovernment(Loan l) {
        String t = String.valueOf(l.getType()).toLowerCase(Locale.ROOT);
        return t.contains("sss") || t.contains("pag-ibig") || t.contains("pagibig");
    }

    /** e.g. "SSS", "BDO" (older loans: "BDO (Bank)" kept as the name). */
    private static String lenderLabel(Loan l) {
        if (l.getLenderName() != null && !l.getLenderName().isBlank()) return l.getLenderName();
        if (l.getLender() != null && !l.getLender().isBlank()) return l.getLender();
        return l.getType();
    }

    /** The last month scheduled; for loans recorded without Payment To, from total ÷ deduction. */
    private static YearMonth scheduledEnd(Loan l) {
        if (l.getEndDate() != null) return YearMonth.from(l.getEndDate());
        if (l.getStartDate() == null) return null;
        BigDecimal per = l.getDeductionPerPayroll();
        if (per == null || per.signum() <= 0) return null;
        int n = total(l).divide(per, 0, RoundingMode.CEILING).intValue();
        return YearMonth.from(l.getStartDate()).plusMonths(Math.min(n, MAX_MONTHS) - 1L);
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
