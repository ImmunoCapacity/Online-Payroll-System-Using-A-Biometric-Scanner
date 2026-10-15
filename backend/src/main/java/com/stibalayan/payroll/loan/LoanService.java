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
import java.util.HashMap;
import java.util.LinkedHashSet;
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
 * Each released payroll period records one payment per active loan
 * (loan_payment); the balance is the loan amount minus its payments. Payroll
 * deducts the "deduction per payroll", or the remaining balance when that is
 * smaller, starting with the loan's start period.
 */
@Service
public class LoanService {

    public static final Set<String> TYPES =
            new LinkedHashSet<>(List.of("SSS Salary Loan", "Pag-IBIG MPL", "Pag-IBIG Calamity Loan", "Other Loan"));
    private static final Pattern REFERENCE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9/-]*$");
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("10000000.00");
    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("MMMM d");

    private final LoanRepository loans;
    private final LoanPaymentRepository payments;
    private final EmployeeDirectory employees;

    public LoanService(LoanRepository loans, LoanPaymentRepository payments, EmployeeDirectory employees) {
        this.loans = loans;
        this.payments = payments;
        this.employees = employees;
    }

    public record LoanRequest(String employeeId, String type, String reference, BigDecimal amount,
                              BigDecimal deductionPerPayroll, String startDate, String remarks) {
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
        String type = r.type() == null ? "" : r.type().trim();
        if (!TYPES.contains(type)) {
            throw Validation.invalid("type", "Choose a loan type: " + String.join(", ", TYPES) + ".");
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
        BigDecimal deduction = Validation.money(r.deductionPerPayroll(), "deductionPerPayroll", "Deduction per payroll", MAX_AMOUNT);
        if (deduction == null || deduction.signum() <= 0) {
            throw Validation.invalid("deductionPerPayroll", "Deduction per payroll must be more than zero.");
        }
        if (deduction.compareTo(amount) > 0) {
            throw Validation.invalid("deductionPerPayroll", "Deduction per payroll can't be more than the loan amount.");
        }
        LocalDate start = Validation.date(r.startDate(), "startDate", "Deduction start period", true);
        if (start.getDayOfMonth() != 11 && start.getDayOfMonth() != 26) {
            throw Validation.invalid("startDate", "Choose a payroll period (they start on the 11th or the 26th).");
        }
        if (staff.getDateHired() != null && periodEnd(start).isBefore(staff.getDateHired())) {
            throw Validation.invalid("startDate", "That period is before this employee was hired.");
        }

        Loan l = new Loan();
        EmployeeId eid = EmployeeId.parse(r.employeeId());
        if (eid.isFaculty()) {
            l.setFacultyId(eid.number());
        } else {
            l.setAdminstaffId(eid.number());
        }
        l.setType(type);
        l.setReference(reference);
        l.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        l.setDeductionPerPayroll(deduction.setScale(2, RoundingMode.HALF_UP));
        l.setStartDate(start);
        l.setRecordedOn(LocalDate.now());
        l.setRemarks(Validation.optionalText(r.remarks(), "remarks", "Remarks", 255));
        l.setRecordedBy(userId);
        return view(loans.saveAndFlush(l), employees.all());
    }

    // ---------------------------------------------------------------
    // Payroll
    // ---------------------------------------------------------------

    /**
     * The loan deductions for a pay period, per employee id: each loan that
     * has started and still has a balance. A period already released keeps
     * the amount it recorded.
     */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> deductionsFor(LocalDate from, LocalDate to) {
        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        for (Loan l : loans.findAll()) {
            if (l.getStartDate() == null || l.getStartDate().isAfter(to)) continue;
            List<LoanPayment> paid = payments.findByLoanIdOrderByPeriodFromAsc(l.getId());
            LoanPayment thisPeriod = paid.stream().filter(p -> p.getPeriodFrom().equals(from)).findFirst().orElse(null);
            BigDecimal amount;
            if (thisPeriod != null) {
                amount = thisPeriod.getAmount();
            } else {
                BigDecimal balance = l.getAmount().subtract(sum(paid));
                if (balance.signum() <= 0) continue;
                amount = l.getDeductionPerPayroll().min(balance);
            }
            Map<String, Object> m = new HashMap<>();
            m.put("loanId", l.getId());
            m.put("type", l.getType());
            m.put("reference", l.getReference());
            m.put("amount", amount);
            result.computeIfAbsent(EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId()), k -> new ArrayList<>()).add(m);
        }
        return result;
    }

    public record PaymentItem(Integer loanId, BigDecimal amount) {
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
            BigDecimal amount = Validation.money(item.amount(), "amount", "Loan deduction", MAX_AMOUNT);
            if (amount == null) continue;
            List<LoanPayment> paid = payments.findByLoanIdOrderByPeriodFromAsc(l.getId());
            BigDecimal otherPeriods = sum(paid.stream().filter(p -> !p.getPeriodFrom().equals(from)).toList());
            BigDecimal balance = l.getAmount().subtract(otherPeriods);
            if (amount.compareTo(balance) > 0) {
                throw Validation.invalid("amount", "The deduction for " + l.getReference() + " is more than its remaining balance.");
            }
            LoanPayment p = payments.findByLoanIdAndPeriodFrom(l.getId(), from).orElseGet(LoanPayment::new);
            if (amount.signum() == 0) {
                if (p.getId() != null) payments.delete(p);
                continue;
            }
            p.setLoanId(l.getId());
            p.setPeriodFrom(from);
            p.setPeriodTo(to);
            p.setPeriodLabel(label);
            p.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
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
        for (LoanPayment p : paid) {
            running = running.subtract(p.getAmount());
            Map<String, Object> h = new HashMap<>();
            h.put("period", p.getPeriodLabel() != null ? p.getPeriodLabel() : periodLabel(p.getPeriodFrom()));
            h.put("amount", p.getAmount());
            h.put("remainingBalance", running.max(BigDecimal.ZERO));
            h.put("dateProcessed", p.getDateProcessed() == null ? null : p.getDateProcessed().toLocalDate().toString());
            history.add(h);
        }
        BigDecimal deducted = sum(paid);
        BigDecimal remaining = l.getAmount().subtract(deducted).max(BigDecimal.ZERO);

        Map<String, Object> m = new HashMap<>();
        m.put("id", l.getId());
        m.put("employeeKey", employeeId);
        m.put("employeeId", s == null ? "" : s.getEmployeeNumber());
        m.put("employeeName", s == null ? "(removed employee)" : s.getFullName());
        m.put("employeeRole", s == null ? "" : roleOf(s.staffType()));
        m.put("type", l.getType());
        m.put("reference", l.getReference());
        m.put("amount", l.getAmount());
        m.put("deductionPerPayroll", l.getDeductionPerPayroll());
        m.put("startDate", l.getStartDate() == null ? null : l.getStartDate().toString());
        m.put("startPeriodLabel", l.getStartDate() == null ? "—" : periodLabel(l.getStartDate()));
        m.put("remarks", l.getRemarks());
        m.put("recordedOn", l.getRecordedOn() == null ? null : l.getRecordedOn().toString());
        m.put("totalDeducted", deducted);
        m.put("remainingBalance", remaining);
        m.put("status", remaining.signum() == 0 ? "Paid" : "Active");
        m.put("deductionHistory", history);
        return m;
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
