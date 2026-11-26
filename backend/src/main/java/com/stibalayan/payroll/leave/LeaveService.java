package com.stibalayan.payroll.leave;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.EmployeeService;
import com.stibalayan.payroll.employee.StaffMember;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
 * Leave Management (paper 5.x) and Leave Category Maintenance (5.3).
 *
 * Rules:
 *   - Leave days are working days, Monday to Friday.
 *   - Leave is approved outside the system; the Payroll Master only records
 *     approved leave (employee, type, dates, paid or unpaid). It is stored as
 *     Approved with who recorded it and when, and can be corrected.
 *   - Recorded leave may not overlap the employee's other recorded leave.
 *   - Each paid leave type gives every employee a number of paid days a year
 *     (their leave credits of that type, e.g. Sick Leave 15). Paid leave
 *     uses them up; it can't exceed what is left (the rest is recorded as
 *     unpaid).
 *   - Only administrative staff (Admin and Faculty/Admin) have leave; faculty
 *     don't. PAID leave is paid in payroll as office hours — see paidLeaveDates().
 */
@Service
public class LeaveService {

    private static final Set<String> INACTIVE = Set.of("Inactive", "Resigned", "Terminated", "Archived");
    private static final int MAX_PAID_DAYS = 366;
    /** Maternity Leave is female-only, Paternity Leave male-only. */
    private static final String MATERNITY = "Maternity Leave";
    private static final String PATERNITY = "Paternity Leave";
    private static final int MAX_PROBATION_MONTHS = 60;
    /** system_setting key: months of a new hire's leave credits being 0 (Maintenance → Leave Credit). */
    static final String PROBATION_MONTHS_KEY = "leave.probationary-months";
    private static final int DEFAULT_PROBATION_MONTHS = 12;

    /** The BIR RR 29-2025 de-minimis exemption: the first 12 days a year of monetized Vacation Leave. */
    private static final int VL_EXEMPT_DAYS = 12;

    private final LeaveCategoryRepository categories;
    private final EmployeeLeaveRepository leaves;
    private final EmployeeLeaveCreditRepository credits;
    private final LeaveConversionRepository conversions;
    private final EmployeeDirectory employees;
    private final EmployeeService employeeService;
    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public LeaveService(LeaveCategoryRepository categories, EmployeeLeaveRepository leaves,
                        EmployeeLeaveCreditRepository credits, LeaveConversionRepository conversions,
                        EmployeeDirectory employees, EmployeeService employeeService, JdbcTemplate jdbc, AuditService audit) {
        this.categories = categories;
        this.leaves = leaves;
        this.credits = credits;
        this.conversions = conversions;
        this.employees = employees;
        this.employeeService = employeeService;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    // ---------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------

    /**
     * paidDays: for paid leave, the days a year each employee is paid for.
     * convertible: for paid leave, whether unused credits cash out
     * automatically on the employee's hire-date anniversary (Payroll
     * Processing) — ignored (always false) for unpaid leave.
     */
    public record CategoryRequest(String name, Boolean paid, Integer paidDays, Boolean convertible, Boolean active) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> categoryList() {
        List<Map<String, Object>> result = new ArrayList<>();
        categories.findAllByOrderByNameAsc().forEach(c -> result.add(categoryView(c)));
        return result;
    }

    @Transactional
    public Map<String, Object> saveCategory(Integer id, CategoryRequest r) {
        LeaveCategory c = id == null ? new LeaveCategory()
                : categories.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Leave category not found."));
        String name = Validation.requiredText(r.name(), "name", "Category name", 50);
        boolean taken = id == null ? categories.existsByNameIgnoreCase(name) : categories.existsByNameIgnoreCaseAndIdNot(name, id);
        if (taken) {
            throw Validation.invalid("name", "A leave category with this name already exists.");
        }
        boolean paid = r.paid() == null || r.paid();
        Integer paidDays = null;
        if (paid) {
            paidDays = Validation.wholeNumber(r.paidDays(), "paidDays", "Paid days", MAX_PAID_DAYS);
            if (paidDays == null || paidDays < 1) {
                throw Validation.invalid("paidDays", "Enter how many days a year this leave is paid (at least 1).");
            }
        }
        c.setName(name);
        c.setPaid(paid);
        c.setPaidDays(paidDays);
        c.setConvertible(paid && r.convertible() != null && r.convertible());
        c.setActive(r.active() == null || r.active());
        return categoryView(categories.save(c));
    }

    private static Map<String, Object> categoryView(LeaveCategory c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("paid", c.isPaid());
        m.put("paidDays", c.isPaid() ? c.getPaidDays() : null);
        m.put("convertible", c.isPaid() && c.isConvertible());
        m.put("active", c.isActive());
        return m;
    }

    // ---------------------------------------------------------------
    // Requests
    // ---------------------------------------------------------------

    /** paid: whether this leave is paid; null = the leave type's default. */
    public record LeaveRequest(String employeeId, Integer categoryId, String dateFrom, String dateTo, Boolean paid) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> requestList() {
        Map<String, StaffMember> people = employees.all();
        List<Map<String, Object>> result = new ArrayList<>();
        // Only recorded (approved) leave; old pending/rejected/cancelled requests from the
        // earlier approval workflow stay in the table but are not shown or paid.
        leaves.findAllByOrderByDateFromDescIdDesc().stream()
                .filter(l -> EmployeeLeave.APPROVED.equals(l.getStatus()))
                .filter(l -> l.getAdminstaffId() != null)
                .forEach(l -> result.add(view(l, people)));
        return result;
    }

    /** Records leave that was already approved (outside the system); it counts in payroll right away. */
    @Transactional
    public Map<String, Object> create(LeaveRequest r, int userId, String recordedBy) {
        if (EmployeeId.parse(r.employeeId()).isFaculty()) {
            throw Validation.invalid("employeeId", "Leave is for administrative staff only. Faculty don't have leave.");
        }
        StaffMember staff = employees.require(r.employeeId());
        if (INACTIVE.contains(staff.getEmploymentStatus())) {
            throw Validation.invalid("employeeId", staff.getFullName() + " is " + staff.getEmploymentStatus().toLowerCase() + ".");
        }
        EmployeeLeave l = new EmployeeLeave();
        EmployeeId eid = EmployeeId.parse(r.employeeId());
        if (eid.isFaculty()) {
            l.setFacultyId(eid.number());
        } else {
            l.setAdminstaffId(eid.number());
        }
        l.setRecordedBy(userId);
        apply(l, r, staff);
        markApproved(l, recordedBy);
        Map<String, Object> saved = view(leaves.saveAndFlush(l), employees.all());
        employeeService.markOnLeaveIfCurrent(r.employeeId(), l.getDateFrom(), l.getDateTo());
        return saved;
    }

    /** Corrects a recorded leave (type, dates or paid); the employee can't change. */
    @Transactional
    public Map<String, Object> update(int id, LeaveRequest r, String recordedBy) {
        EmployeeLeave l = find(id);
        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        if (r.employeeId() != null && !r.employeeId().isBlank() && !r.employeeId().equals(employeeId)) {
            throw Validation.invalid("employeeId", "Recorded leave can't be moved to another employee.");
        }
        apply(l, r, employees.require(employeeId));
        markApproved(l, recordedBy);
        Map<String, Object> saved = view(leaves.saveAndFlush(l), employees.all());
        employeeService.markOnLeaveIfCurrent(employeeId, l.getDateFrom(), l.getDateTo());
        return saved;
    }

    /** Validates a request against the rules and copies it onto the entity. */
    private void apply(EmployeeLeave l, LeaveRequest r, StaffMember staff) {
        if (r.categoryId() == null) {
            throw Validation.invalid("categoryId", "Select a leave type.");
        }
        LeaveCategory c = categories.findById(r.categoryId())
                .orElseThrow(() -> Validation.invalid("categoryId", "Select a leave type."));
        if (!c.isActive() && !c.getId().equals(l.getCategoryId())) {
            throw Validation.invalid("categoryId", c.getName() + " is no longer offered.");
        }
        if (!appliesTo(c, staff)) {
            throw Validation.invalid("categoryId", c.getName() + " is only for "
                    + (MATERNITY.equalsIgnoreCase(c.getName()) ? "female" : "male") + " employees.");
        }
        LocalDate from = Validation.date(r.dateFrom(), "dateFrom", "Start date", true);
        LocalDate to = Validation.date(r.dateTo(), "dateTo", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("dateTo", "The end date can't be before the start date.");
        }
        if (staff.getDateHired() != null && from.isBefore(staff.getDateHired())) {
            throw Validation.invalid("dateFrom", "The start date is before this employee was hired (" + staff.getDateHired() + ").");
        }
        if (from.getYear() != to.getYear()) {
            throw Validation.invalid("dateTo", "Record leave that crosses the new year as two leaves, one per year.");
        }
        int days = workdays(from, to);
        if (days == 0) {
            throw Validation.invalid("dateTo", "These dates have no working days (Monday to Friday).");
        }
        // Unpaid leave types are never paid; paid ones are unless recorded as unpaid.
        boolean paid = c.isPaid() && (r.paid() == null || r.paid());

        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        for (EmployeeLeave other : leavesOf(employeeId)) {
            if (!other.getId().equals(l.getId())
                    && EmployeeLeave.APPROVED.equals(other.getStatus())
                    && !other.getDateFrom().isAfter(to) && !other.getDateTo().isBefore(from)) {
                throw Validation.invalid("dateFrom", "These dates overlap leave already recorded for this employee ("
                        + other.getCategoryName() + ", " + other.getDateFrom() + " to " + other.getDateTo() + ").");
            }
        }
        // Paid leave uses up the employee's paid days of this type for the year.
        Integer creditTotal = null;
        Integer creditUsed = null;
        if (paid) {
            creditTotal = creditTotalFor(staff, employeeId, c, from.getYear());
            creditUsed = usedDays(employeeId, c.getId(), from.getYear(), l.getId());
            int remaining = Math.max(0, creditTotal - creditUsed);
            if (days > remaining) {
                throw Validation.invalid("dateTo", "Only " + remaining + " paid day" + (remaining == 1 ? "" : "s") + " of "
                        + c.getName() + " left for " + from.getYear() + "; this leave needs " + days
                        + ". Record it as unpaid, or split it into a paid and an unpaid leave.");
            }
        }

        l.setTotalLeaveCredit(creditTotal);
        l.setUsedLeave(creditUsed);
        l.setRemainingLeave(creditTotal == null ? null : creditTotal - creditUsed - days);
        l.setCategoryId(c.getId());
        l.setCategoryName(c.getName());
        l.setPaid(paid);
        l.setDateFrom(from);
        l.setDateTo(to);
        l.setTotalDays(days);
    }

    /**
     * Leave is approved outside the system (by the employee's head / HR); the
     * Payroll Master only records it, so it is stored as Approved, stamped with
     * who recorded it and when.
     */
    private static void markApproved(EmployeeLeave l, String recordedBy) {
        l.setStatus(EmployeeLeave.APPROVED);
        l.setRemarks(null);
        l.setDateApproved(LocalDateTime.now());
        l.setApprovedBy(recordedBy == null ? null : recordedBy.length() > 50 ? recordedBy.substring(0, 50) : recordedBy);
    }

    // ---------------------------------------------------------------
    // Leave credits: the paid days of each paid leave type
    // ---------------------------------------------------------------

    /**
     * An employee's leave credits for a year, per paid leave type: the paid
     * days a year, used (recorded paid leave) and what is left.
     * excludeLeaveId leaves one leave out of "used" (when editing it).
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> balance(String employeeId, int year, Integer excludeLeaveId) {
        StaffMember staff = employees.require(employeeId);
        if (EmployeeId.parse(employeeId).isFaculty()) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (LeaveCategory c : categories.findAllByOrderByNameAsc()) {
            if (!c.isPaid() || !appliesTo(c, staff)) continue;
            int total = creditTotalFor(staff, employeeId, c, year);
            int used = usedDays(employeeId, c.getId(), year, excludeLeaveId);
            Map<String, Object> m = new HashMap<>();
            m.put("categoryId", c.getId());
            m.put("category", c.getName());
            m.put("active", c.isActive());
            m.put("total", total);
            m.put("used", used);
            m.put("remaining", Math.max(0, total - used));
            result.add(m);
        }
        return result;
    }

    /** Every admin employee's leave credits for a year (Reports → Leave Report). */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> balanceAll(int year) {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        employees.all().forEach((employeeId, staff) -> {
            if (!EmployeeId.parse(employeeId).isFaculty()) {
                result.put(employeeId, balance(employeeId, year, null));
            }
        });
        return result;
    }

    /** Paid working days of one leave type recorded for the employee in a year. */
    private int usedDays(String employeeId, int categoryId, int year, Integer excludeLeaveId) {
        int used = 0;
        for (EmployeeLeave l : leavesOf(employeeId)) {
            if (l.getId().equals(excludeLeaveId) || l.getDateFrom().getYear() != year) continue;
            if (!EmployeeLeave.APPROVED.equals(l.getStatus()) || !l.isPaid() || l.getTotalDays() == null) continue;
            if (l.getCategoryId() != null && l.getCategoryId() == categoryId) used += l.getTotalDays();
        }
        return used;
    }

    // ---------------------------------------------------------------
    // Leave Credit (Maintenance): the probationary period, and per-employee
    // overrides of a category's paid days for one year.
    // ---------------------------------------------------------------

    /** Maternity Leave only applies to female employees, Paternity Leave only to male employees. */
    private static boolean appliesTo(LeaveCategory c, StaffMember staff) {
        if (MATERNITY.equalsIgnoreCase(c.getName())) return "Female".equalsIgnoreCase(staff.getGender());
        if (PATERNITY.equalsIgnoreCase(c.getName())) return "Male".equalsIgnoreCase(staff.getGender());
        return true;
    }

    /** Whether a new hire's paid leave credits are still 0 (Maintenance → Leave Credit). */
    private boolean inProbation(StaffMember staff) {
        LocalDate hired = staff.getDateHired();
        return hired != null && ChronoUnit.MONTHS.between(hired, LocalDate.now()) < probationaryMonths();
    }

    /**
     * The paid days a year this employee gets of this category, for this
     * year: an explicit override if one is set, otherwise 0 while on
     * probation, otherwise the category's own default.
     */
    private int creditTotalFor(StaffMember staff, String employeeId, LeaveCategory c, int year) {
        EmployeeId eid = EmployeeId.parse(employeeId);
        if (!eid.isFaculty()) {
            Integer override = credits.findByAdminstaffIdAndCategoryIdAndYear(eid.number(), c.getId(), year)
                    .map(EmployeeLeaveCredit::getTotalCredits).orElse(null);
            if (override != null) return override;
        }
        if (inProbation(staff)) return 0;
        return c.getPaidDays() == null ? 0 : c.getPaidDays();
    }

    public int probationaryMonths() {
        List<String> v = jdbc.queryForList("SELECT setting_value FROM system_setting WHERE setting_key = ?",
                String.class, PROBATION_MONTHS_KEY);
        if (v.isEmpty() || v.get(0) == null || v.get(0).isBlank()) return DEFAULT_PROBATION_MONTHS;
        try {
            return Integer.parseInt(v.get(0).trim());
        } catch (NumberFormatException e) {
            return DEFAULT_PROBATION_MONTHS;
        }
    }

    @Transactional
    public Map<String, Object> saveProbationaryMonths(Integer months, int userId) {
        if (months == null || months < 0 || months > MAX_PROBATION_MONTHS) {
            throw Validation.invalid("months", "Enter 0 to " + MAX_PROBATION_MONTHS + " months (0 = no waiting period).");
        }
        jdbc.update("INSERT INTO system_setting (setting_key, setting_value) VALUES (?, ?) "
                + "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", PROBATION_MONTHS_KEY, String.valueOf(months));
        audit.log(userId, "Leave Credit", "Changed probationary period", months + " month" + (months == 1 ? "" : "s"));
        return probationView();
    }

    public Map<String, Object> probationView() {
        Map<String, Object> m = new HashMap<>();
        m.put("months", probationaryMonths());
        return m;
    }

    public record CreditRequest(String employeeId, Integer categoryId, Integer year, Integer totalCredits) {
    }

    /**
     * One row per admin employee for a year, with their total paid leave
     * days used across every paid category — the Maintenance → Leave Credit
     * table. Click a row for the per-category breakdown and use history.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> creditSummary(int year) {
        List<LeaveCategory> paidCategories = categories.findAllByOrderByNameAsc().stream()
                .filter(LeaveCategory::isPaid).toList();
        List<Map<String, Object>> result = new ArrayList<>();
        employees.all().forEach((employeeId, staff) -> {
            if (EmployeeId.parse(employeeId).isFaculty()) return;
            int used = 0;
            for (LeaveCategory c : paidCategories) {
                if (!appliesTo(c, staff)) continue;
                used += usedDays(employeeId, c.getId(), year, null);
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeId", employeeId);
            m.put("employeeNumber", staff.getEmployeeNumber());
            m.put("employeeName", staff.getFullName());
            m.put("employeeType", staff.staffType());
            m.put("year", year);
            m.put("used", used);
            result.add(m);
        });
        result.sort(Comparator.comparing(m -> String.valueOf(m.get("employeeName"))));
        return result;
    }

    /** One employee's leave credits for a year, per paid category, with whether each is overridden. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> creditDetail(String employeeId, int year) {
        StaffMember staff = employees.require(employeeId);
        if (EmployeeId.parse(employeeId).isFaculty()) return List.of();
        int adminId = EmployeeId.parse(employeeId).number();
        Set<Integer> overridden = new HashSet<>();
        for (EmployeeLeaveCredit credit : credits.findAllByYear(year)) {
            if (credit.getAdminstaffId() == adminId) overridden.add(credit.getCategoryId());
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (LeaveCategory c : categories.findAllByOrderByNameAsc()) {
            if (!c.isPaid() || !appliesTo(c, staff)) continue;
            Map<String, Object> m = creditRow(staff, employeeId, c, year);
            m.put("overridden", overridden.contains(c.getId()));
            result.add(m);
        }
        return result;
    }

    /** One employee's recorded leave (every type, paid or not) for a year (Maintenance → Leave Credit → use history). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> creditHistory(String employeeId, int year) {
        employees.require(employeeId);
        Map<String, StaffMember> people = employees.all();
        List<Map<String, Object>> result = new ArrayList<>();
        for (EmployeeLeave l : leavesOf(employeeId)) {
            if (l.getDateFrom().getYear() != year || !EmployeeLeave.APPROVED.equals(l.getStatus())) continue;
            result.add(view(l, people));
        }
        result.sort(Comparator.comparing(m -> String.valueOf(m.get("dateFrom"))));
        return result;
    }

    /** Sets (or replaces) an employee's override for one category and year. */
    @Transactional
    public Map<String, Object> saveCreditOverride(CreditRequest r, int userId) {
        if (r.employeeId() == null || r.employeeId().isBlank()) {
            throw Validation.invalid("employeeId", "Select an employee.");
        }
        EmployeeId eid = EmployeeId.parse(r.employeeId());
        if (eid.isFaculty()) {
            throw Validation.invalid("employeeId", "Leave is for administrative staff only. Faculty don't have leave.");
        }
        StaffMember staff = employees.require(r.employeeId());

        if (r.categoryId() == null) {
            throw Validation.invalid("categoryId", "Select a leave type.");
        }
        LeaveCategory c = categories.findById(r.categoryId())
                .orElseThrow(() -> Validation.invalid("categoryId", "Select a leave type."));
        if (!c.isPaid()) {
            throw Validation.invalid("categoryId", c.getName() + " is unpaid leave and has no credits to override.");
        }
        if (!appliesTo(c, staff)) {
            throw Validation.invalid("categoryId", c.getName() + " is only for "
                    + (MATERNITY.equalsIgnoreCase(c.getName()) ? "female" : "male") + " employees.");
        }

        int currentYear = LocalDate.now().getYear();
        if (r.year() == null || r.year() < currentYear - 1 || r.year() > currentYear + 1) {
            throw Validation.invalid("year", "Choose " + (currentYear - 1) + " to " + (currentYear + 1) + ".");
        }

        Integer totalCredits = Validation.wholeNumber(r.totalCredits(), "totalCredits", "Paid days", MAX_PAID_DAYS);
        if (totalCredits == null || totalCredits < 0) {
            throw Validation.invalid("totalCredits", "Enter the number of paid days this employee gets (0 or more).");
        }

        EmployeeLeaveCredit credit = credits.findByAdminstaffIdAndCategoryIdAndYear(eid.number(), r.categoryId(), r.year())
                .orElseGet(EmployeeLeaveCredit::new);
        boolean isNew = credit.getId() == null;
        credit.setAdminstaffId(eid.number());
        credit.setCategoryId(r.categoryId());
        credit.setYear(r.year());
        credit.setTotalCredits(totalCredits);
        credit.setUpdatedBy(userId);
        credits.save(credit);
        audit.log(userId, "Leave Credit", isNew ? "Added override" : "Updated override",
                staff.getFullName() + " · " + c.getName() + " · " + r.year() + " · " + totalCredits + " day" + (totalCredits == 1 ? "" : "s"));
        Map<String, Object> row = creditRow(staff, r.employeeId(), c, r.year());
        row.put("overridden", true);
        return row;
    }

    /** Removes an employee's override, if any — they go back to the category's own default (or 0, on probation). */
    @Transactional
    public Map<String, Object> removeCreditOverride(String employeeId, int categoryId, int year, int userId) {
        StaffMember staff = employees.require(employeeId);
        EmployeeId eid = EmployeeId.parse(employeeId);
        LeaveCategory c = categories.findById(categoryId).orElseThrow(() -> Validation.invalid("categoryId", "Select a leave type."));
        credits.findByAdminstaffIdAndCategoryIdAndYear(eid.number(), categoryId, year).ifPresent(credit -> {
            credits.delete(credit);
            audit.log(userId, "Leave Credit", "Removed override", staff.getFullName() + " · " + c.getName() + " · " + year);
        });
        Map<String, Object> row = creditRow(staff, employeeId, c, year);
        row.put("overridden", false);
        return row;
    }

    public record CategoryAmount(Integer categoryId, Integer totalCredits) {
    }

    public record RestoreAllRequest(Integer year, List<CategoryAmount> credits) {
    }

    /**
     * Sets every eligible admin employee's override of the given leave
     * categories, for one year, to the given amounts in one go (e.g. a
     * yearly credit renewal) — Maintenance → Leave Credit → Restore Credits
     * for All. Skips an employee for a category that doesn't apply to them
     * (Maternity/Paternity Leave).
     */
    @Transactional
    public int restoreCreditsForAll(RestoreAllRequest r, int userId) {
        int currentYear = LocalDate.now().getYear();
        if (r.year() == null || r.year() < currentYear - 1 || r.year() > currentYear + 1) {
            throw Validation.invalid("year", "Choose " + (currentYear - 1) + " to " + (currentYear + 1) + ".");
        }
        if (r.credits() == null || r.credits().isEmpty()) {
            throw Validation.invalid("credits", "Choose at least one leave type to restore.");
        }

        List<Map.Entry<LeaveCategory, Integer>> targets = new ArrayList<>();
        for (CategoryAmount ca : r.credits()) {
            if (ca.categoryId() == null) {
                throw Validation.invalid("credits", "Select a leave type.");
            }
            LeaveCategory c = categories.findById(ca.categoryId())
                    .orElseThrow(() -> Validation.invalid("credits", "Select a leave type."));
            if (!c.isPaid()) {
                throw Validation.invalid("credits", c.getName() + " is unpaid leave and has no credits to restore.");
            }
            Integer totalCredits = Validation.wholeNumber(ca.totalCredits(), "credits", "Paid days", MAX_PAID_DAYS);
            if (totalCredits == null || totalCredits < 0) {
                throw Validation.invalid("credits", "Enter the number of paid days for " + c.getName() + " (0 or more).");
            }
            targets.add(Map.entry(c, totalCredits));
        }

        int updated = 0;
        for (Map.Entry<String, StaffMember> entry : employees.all().entrySet()) {
            String employeeId = entry.getKey();
            if (EmployeeId.parse(employeeId).isFaculty()) continue;
            StaffMember staff = entry.getValue();
            int adminId = EmployeeId.parse(employeeId).number();
            for (Map.Entry<LeaveCategory, Integer> target : targets) {
                LeaveCategory c = target.getKey();
                if (!appliesTo(c, staff)) continue;
                EmployeeLeaveCredit credit = credits.findByAdminstaffIdAndCategoryIdAndYear(adminId, c.getId(), r.year())
                        .orElseGet(EmployeeLeaveCredit::new);
                credit.setAdminstaffId(adminId);
                credit.setCategoryId(c.getId());
                credit.setYear(r.year());
                credit.setTotalCredits(target.getValue());
                credit.setUpdatedBy(userId);
                credits.save(credit);
                updated++;
            }
        }
        String summary = targets.stream().map(t -> t.getKey().getName() + " = " + t.getValue()).reduce((a, b) -> a + ", " + b).orElse("");
        audit.log(userId, "Leave Credit", "Restored credits for all", r.year() + " · " + summary + " · " + updated + " override(s) set");
        return updated;
    }

    private Map<String, Object> creditRow(StaffMember staff, String employeeId, LeaveCategory c, int year) {
        int total = creditTotalFor(staff, employeeId, c, year);
        int used = usedDays(employeeId, c.getId(), year, null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("employeeId", employeeId);
        m.put("employeeNumber", staff.getEmployeeNumber());
        m.put("employeeName", staff.getFullName());
        m.put("employeeType", staff.staffType());
        m.put("categoryId", c.getId());
        m.put("category", c.getName());
        m.put("year", year);
        m.put("total", total);
        m.put("used", used);
        m.put("remaining", Math.max(0, total - used));
        return m;
    }

    // ---------------------------------------------------------------
    // Payroll
    // ---------------------------------------------------------------

    /**
     * Unused leave credits to cash out this pay period: one entry per
     * employee whose hire-date anniversary falls inside [from, to], per
     * convertible paid category that applies to them. covered_year is the
     * calendar year just completed as of that anniversary — that year's
     * leave_credit balance (its own default, or an override) is what's
     * being cashed out here, same number Maintenance → Leave Credit would
     * show for that employee/category/year. An employee/category/year
     * already recorded in leave_conversion (a previous period's release)
     * is skipped — it was already paid out.
     *
     * Pure and read-only: recomputed fresh every time Payroll Processing
     * runs or recomputes a period. Nothing is written here — Payroll
     * Processing folds these amounts into the employee's regular earnings
     * (taxable) and benefits (exempt) lines so they're actually paid, and
     * only when the period is released does commitConversion() record the
     * history and reset that year's credit.
     */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> leaveConversions(LocalDate from, LocalDate to) {
        Map<String, List<Map<String, Object>>> result = new LinkedHashMap<>();
        List<LeaveCategory> convertible = categories.findAllByOrderByNameAsc().stream()
                .filter(LeaveCategory::isPaid).filter(LeaveCategory::isConvertible).toList();
        if (convertible.isEmpty()) {
            return result;
        }
        for (Map.Entry<String, StaffMember> entry : employees.all().entrySet()) {
            String employeeId = entry.getKey();
            EmployeeId eid = EmployeeId.parse(employeeId);
            if (eid.isFaculty()) continue;
            StaffMember staff = entry.getValue();
            LocalDate hired = staff.getDateHired();
            if (hired == null) continue;
            BigDecimal dailyRate = dailyRateFor(staff);
            if (dailyRate.signum() <= 0) continue;

            for (LocalDate anniversary : anniversariesBetween(hired, from, to)) {
                int coveredYear = anniversary.getYear() - 1;
                if (coveredYear < hired.getYear()) continue; // no full completed year yet
                for (LeaveCategory c : convertible) {
                    if (!appliesTo(c, staff)) continue;
                    if (conversions.findByAdminstaffIdAndCategoryIdAndCoveredYear(eid.number(), c.getId(), coveredYear).isPresent()) {
                        continue;
                    }
                    int total = creditTotalFor(staff, employeeId, c, coveredYear);
                    int used = usedDays(employeeId, c.getId(), coveredYear, null);
                    int unused = Math.max(0, total - used);
                    if (unused <= 0) continue;

                    int exemptDays = isVacationLeave(c) ? Math.min(unused, VL_EXEMPT_DAYS) : 0;
                    int taxableDays = unused - exemptDays;
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("categoryId", c.getId());
                    m.put("category", c.getName());
                    m.put("coveredYear", coveredYear);
                    m.put("anniversaryDate", anniversary.toString());
                    m.put("unusedDays", unused);
                    m.put("exemptDays", exemptDays);
                    m.put("taxableDays", taxableDays);
                    m.put("dailyRate", dailyRate);
                    m.put("exemptAmount", dailyRate.multiply(BigDecimal.valueOf(exemptDays)).setScale(2, RoundingMode.HALF_UP));
                    m.put("taxableAmount", dailyRate.multiply(BigDecimal.valueOf(taxableDays)).setScale(2, RoundingMode.HALF_UP));
                    result.computeIfAbsent(employeeId, k -> new ArrayList<>()).add(m);
                }
            }
        }
        return result;
    }

    /**
     * Records one employee's leave conversion once its pay period is
     * released (PayrollRunService.release): the history row, and the
     * covered year's leave_credit override reset to exactly what was used
     * (remaining 0 from then on, so it can't be used or converted again).
     * Does nothing if this employee/category/year was already recorded.
     */
    @Transactional
    public void commitConversion(String employeeId, Map<String, Object> entry, int payrollRunId, int userId) {
        EmployeeId eid = EmployeeId.parse(employeeId);
        if (eid.isFaculty()) return;
        Integer categoryId = asInt(entry.get("categoryId"));
        Integer coveredYear = asInt(entry.get("coveredYear"));
        if (categoryId == null || coveredYear == null) return;
        if (conversions.findByAdminstaffIdAndCategoryIdAndCoveredYear(eid.number(), categoryId, coveredYear).isPresent()) {
            return;
        }
        LeaveCategory c = categories.findById(categoryId).orElse(null);

        LeaveConversion lc = new LeaveConversion();
        lc.setAdminstaffId(eid.number());
        lc.setCategoryId(categoryId);
        lc.setCoveredYear(coveredYear);
        lc.setAnniversaryDate(LocalDate.parse(String.valueOf(entry.get("anniversaryDate"))));
        lc.setUnusedDays(asInt(entry.get("unusedDays")));
        lc.setDailyRate(asMoney(entry.get("dailyRate")));
        lc.setExemptAmount(asMoney(entry.get("exemptAmount")));
        lc.setTaxableAmount(asMoney(entry.get("taxableAmount")));
        lc.setPayrollRunId(payrollRunId);
        lc.setCreatedBy(userId);
        conversions.save(lc);

        // This year's credit is settled now — reset so it reads as fully used, never counted again.
        int used = usedDays(employeeId, categoryId, coveredYear, null);
        EmployeeLeaveCredit credit = credits.findByAdminstaffIdAndCategoryIdAndYear(eid.number(), categoryId, coveredYear)
                .orElseGet(EmployeeLeaveCredit::new);
        credit.setAdminstaffId(eid.number());
        credit.setCategoryId(categoryId);
        credit.setYear(coveredYear);
        credit.setTotalCredits(used);
        credit.setUpdatedBy(userId);
        credits.save(credit);

        StaffMember staff = employees.require(employeeId);
        audit.log(userId, "Leave Credit", "Converted to cash", staff.getFullName() + " · " + (c == null ? "" : c.getName())
                + " · " + coveredYear + " · " + entry.get("unusedDays") + " day(s) · exempt ₱" + entry.get("exemptAmount")
                + " + taxable ₱" + entry.get("taxableAmount"));
    }

    /** BIR RR 29-2025: only Vacation Leave gets the de-minimis exemption on monetization. */
    private static boolean isVacationLeave(LeaveCategory c) {
        return "Vacation Leave".equalsIgnoreCase(c.getName());
    }

    /**
     * Daily rate = rate per hour × office hours a day. For this system's
     * hourly-paid admin staff this is exactly the DOLE 261-working-day
     * divisor's daily rate (annual pay ÷ 261 = hourly rate × office hours ×
     * 261 ÷ 261), without needing a separate monthly-salary figure.
     */
    private static BigDecimal dailyRateFor(StaffMember staff) {
        if (!(staff instanceof AdminStaff a) || a.getRatePerHour() == null || a.getOfficeHours() == null) {
            return BigDecimal.ZERO;
        }
        return a.getRatePerHour().multiply(a.getOfficeHours()).setScale(2, RoundingMode.HALF_UP);
    }

    /** Every anniversary (month/day) of hireDate that falls within [from, to]. */
    private static List<LocalDate> anniversariesBetween(LocalDate hireDate, LocalDate from, LocalDate to) {
        List<LocalDate> result = new ArrayList<>();
        for (int year = from.getYear(); year <= to.getYear(); year++) {
            // plusYears resolves Feb 29 to Feb 28 in a non-leap target year.
            LocalDate candidate = hireDate.plusYears((long) year - hireDate.getYear());
            if (!candidate.isBefore(from) && !candidate.isAfter(to)) {
                result.add(candidate);
            }
        }
        return result;
    }

    private static Integer asInt(Object value) {
        return value instanceof Number n ? n.intValue() : null;
    }

    private static BigDecimal asMoney(Object value) {
        return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value)).setScale(2, RoundingMode.HALF_UP);
    }

    /** Approved paid leave: the working days per employee falling inside [from, to]. */
    @Transactional(readOnly = true)
    public Map<String, Set<LocalDate>> paidLeaveDates(LocalDate from, LocalDate to) {
        Map<String, Set<LocalDate>> result = new HashMap<>();
        for (EmployeeLeave l : leaves.findByStatusAndDateFromLessThanEqualAndDateToGreaterThanEqual(EmployeeLeave.APPROVED, to, from)) {
            if (!l.isPaid() || l.getAdminstaffId() == null) continue;
            LocalDate start = l.getDateFrom().isAfter(from) ? l.getDateFrom() : from;
            LocalDate end = l.getDateTo().isBefore(to) ? l.getDateTo() : to;
            for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
                if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY) {
                    result.computeIfAbsent(EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId()),
                            k -> new java.util.TreeSet<>()).add(d);
                }
            }
        }
        return result;
    }

    /** Monday–Friday days from start to end inclusive. */
    public static int workdays(LocalDate start, LocalDate end) {
        int days = 0;
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY) days++;
        }
        return days;
    }

    // ---------------------------------------------------------------

    private List<EmployeeLeave> leavesOf(String employeeId) {
        EmployeeId eid = EmployeeId.parse(employeeId);
        return eid.isFaculty() ? leaves.findByFacultyId(eid.number()) : leaves.findByAdminstaffId(eid.number());
    }

    private EmployeeLeave find(int id) {
        return leaves.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Leave request not found."));
    }

    private static Map<String, Object> view(EmployeeLeave l, Map<String, StaffMember> people) {
        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        StaffMember s = people.get(employeeId);
        Map<String, Object> m = new HashMap<>();
        m.put("id", l.getId());
        m.put("employeeId", employeeId);
        m.put("employeeNumber", s == null ? "" : s.getEmployeeNumber());
        m.put("employeeName", s == null ? "(removed employee)" : s.getFullName());
        m.put("employeeType", s == null ? "" : s.staffType());
        m.put("categoryId", l.getCategoryId());
        m.put("category", l.getCategoryName());
        m.put("paid", l.isPaid());
        m.put("status", l.getStatus());
        m.put("dateFrom", l.getDateFrom().toString());
        m.put("dateTo", l.getDateTo().toString());
        m.put("days", l.getTotalDays());
        m.put("dateFiled", l.getDateRequested() == null ? null : l.getDateRequested().toLocalDate().toString());
        m.put("reviewedBy", l.getApprovedBy());
        m.put("reviewedAt", l.getDateApproved() == null ? null : l.getDateApproved().toString());
        return m;
    }
}
