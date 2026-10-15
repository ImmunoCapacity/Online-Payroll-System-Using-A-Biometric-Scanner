package com.stibalayan.payroll.leave;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Leave Management (paper 5.x) and Leave Category Maintenance (5.3).
 *
 * Rules:
 *   - Leave days are working days, Monday to Friday.
 *   - A request may not exceed its category's maximum days, nor overlap the
 *     employee's other pending or approved leave.
 *   - Categories that use credits draw on the employee's yearly leave
 *     credits (15 by default). A request that needs more than the remaining
 *     credits can't be filed or approved.
 *   - Only pending requests can be edited. Approving, rejecting and
 *     cancelling record who did it and when; rejecting needs remarks.
 *   - Approved PAID leave is paid in payroll as office hours (Admin and
 *     Faculty/Admin staff) — see paidLeaveDays().
 */
@Service
public class LeaveService {

    private static final Set<String> INACTIVE = Set.of("Inactive", "Resigned", "Terminated");
    private static final int MAX_DAYS_LIMIT = 366;

    private final LeaveCategoryRepository categories;
    private final EmployeeLeaveRepository leaves;
    private final LeaveCreditRepository credits;
    private final EmployeeDirectory employees;

    public LeaveService(LeaveCategoryRepository categories, EmployeeLeaveRepository leaves,
                        LeaveCreditRepository credits, EmployeeDirectory employees) {
        this.categories = categories;
        this.leaves = leaves;
        this.credits = credits;
        this.employees = employees;
    }

    // ---------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------

    public record CategoryRequest(String name, Boolean paid, Integer maxDays, Boolean usesCredits, Boolean active) {
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
        Integer maxDays = Validation.wholeNumber(r.maxDays(), "maxDays", "Maximum days", MAX_DAYS_LIMIT);
        if (maxDays != null && maxDays < 1) {
            throw Validation.invalid("maxDays", "Maximum days must be at least 1.");
        }
        boolean paid = r.paid() == null || r.paid();
        boolean usesCredits = r.usesCredits() != null && r.usesCredits();
        if (usesCredits && !paid) {
            throw Validation.invalid("usesCredits", "Only paid leave can use leave credits.");
        }
        c.setName(name);
        c.setPaid(paid);
        c.setMaxDays(maxDays);
        c.setUsesCredits(usesCredits);
        c.setActive(r.active() == null || r.active());
        return categoryView(categories.save(c));
    }

    private static Map<String, Object> categoryView(LeaveCategory c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("paid", c.isPaid());
        m.put("maxDays", c.getMaxDays());
        m.put("usesCredits", c.isUsesCredits());
        m.put("active", c.isActive());
        return m;
    }

    // ---------------------------------------------------------------
    // Requests
    // ---------------------------------------------------------------

    public record LeaveRequest(String employeeId, Integer categoryId, String dateFrom, String dateTo, String reason) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> requestList() {
        Map<String, StaffMember> people = employees.all();
        Map<Integer, LeaveCategory> cats = categoryMap();
        List<Map<String, Object>> result = new ArrayList<>();
        leaves.findAllByOrderByDateFromDescIdDesc().forEach(l -> result.add(view(l, people, cats)));
        return result;
    }

    @Transactional
    public Map<String, Object> create(LeaveRequest r, int userId) {
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
        return view(leaves.saveAndFlush(l), employees.all(), categoryMap());
    }

    @Transactional
    public Map<String, Object> update(int id, LeaveRequest r) {
        EmployeeLeave l = find(id);
        if (!l.isPending()) {
            throw conflict("Only pending leave requests can be edited (this one is " + l.getStatus().toLowerCase() + ").");
        }
        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        if (r.employeeId() != null && !r.employeeId().isBlank() && !r.employeeId().equals(employeeId)) {
            throw Validation.invalid("employeeId", "A request can't be moved to another employee. Cancel it and record a new one.");
        }
        apply(l, r, employees.require(employeeId));
        return view(leaves.saveAndFlush(l), employees.all(), categoryMap());
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
        LocalDate from = Validation.date(r.dateFrom(), "dateFrom", "Start date", true);
        LocalDate to = Validation.date(r.dateTo(), "dateTo", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("dateTo", "The end date can't be before the start date.");
        }
        if (staff.getDateHired() != null && from.isBefore(staff.getDateHired())) {
            throw Validation.invalid("dateFrom", "The start date is before this employee was hired (" + staff.getDateHired() + ").");
        }
        if (from.getYear() != to.getYear()) {
            throw Validation.invalid("dateTo", "File leave that crosses the new year as two requests, one per year.");
        }
        int days = workdays(from, to);
        if (days == 0) {
            throw Validation.invalid("dateTo", "These dates have no working days (Monday to Friday).");
        }
        if (c.getMaxDays() != null && days > c.getMaxDays()) {
            throw Validation.invalid("dateTo", c.getName() + " allows at most " + c.getMaxDays() + " working days per request (this is " + days + ").");
        }
        String reason = Validation.requiredText(r.reason(), "reason", "Reason", 255);

        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        for (EmployeeLeave other : leavesOf(employeeId)) {
            if (!other.getId().equals(l.getId())
                    && (other.isPending() || EmployeeLeave.APPROVED.equals(other.getStatus()))
                    && !other.getDateFrom().isAfter(to) && !other.getDateTo().isBefore(from)) {
                throw Validation.invalid("dateFrom", "These dates overlap another " + other.getStatus().toLowerCase()
                        + " leave (" + other.getCategoryName() + ", " + other.getDateFrom() + " to " + other.getDateTo() + ").");
            }
        }
        if (c.isUsesCredits()) {
            Map<String, Object> b = balance(employeeId, from.getYear(), l.getId());
            int remaining = (Integer) b.get("remaining");
            if (days > remaining) {
                throw Validation.invalid("dateTo", "Only " + remaining + " leave credit" + (remaining == 1 ? "" : "s")
                        + " left for " + from.getYear() + "; this request needs " + days + ".");
            }
        }

        l.setCategoryId(c.getId());
        l.setCategoryName(c.getName());
        l.setPaid(c.isPaid());
        l.setDateFrom(from);
        l.setDateTo(to);
        l.setTotalDays(days);
        l.setReason(reason);
    }

    @Transactional
    public Map<String, Object> approve(int id, String remarksText, String reviewer) {
        EmployeeLeave l = find(id);
        if (!l.isPending()) {
            throw conflict("Only pending requests can be approved (this one is " + l.getStatus().toLowerCase() + ").");
        }
        String remarks = Validation.optionalText(remarksText, "remarks", "Remarks", 255);
        LeaveCategory c = l.getCategoryId() == null ? null : categories.findById(l.getCategoryId()).orElse(null);
        if (c != null && c.isUsesCredits()) {
            String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
            Map<String, Object> b = balance(employeeId, l.getDateFrom().getYear(), l.getId());
            int total = (Integer) b.get("total");
            int used = (Integer) b.get("used");
            if (l.getTotalDays() > total - used) {
                throw conflict("Not enough leave credits: " + (total - used) + " left for " + l.getDateFrom().getYear()
                        + ", this request needs " + l.getTotalDays() + ".");
            }
            l.setTotalLeaveCredit(total);
            l.setUsedLeave(used);
            l.setRemainingLeave(total - used - l.getTotalDays());
        }
        return review(l, EmployeeLeave.APPROVED, remarks, reviewer);
    }

    @Transactional
    public Map<String, Object> reject(int id, String remarksText, String reviewer) {
        EmployeeLeave l = find(id);
        if (!l.isPending()) {
            throw conflict("Only pending requests can be rejected (this one is " + l.getStatus().toLowerCase() + ").");
        }
        String remarks = Validation.requiredText(remarksText, "remarks", "Reason for rejecting", 255);
        return review(l, EmployeeLeave.REJECTED, remarks, reviewer);
    }

    /** Withdraws a pending or approved request; approved days go back to the employee's credits. */
    @Transactional
    public Map<String, Object> cancel(int id, String remarksText, String reviewer) {
        EmployeeLeave l = find(id);
        if (!l.isPending() && !EmployeeLeave.APPROVED.equals(l.getStatus())) {
            throw conflict("Only pending or approved requests can be cancelled.");
        }
        String remarks = Validation.requiredText(remarksText, "remarks", "Reason for cancelling", 255);
        l.setRemainingLeave(null);
        return review(l, EmployeeLeave.CANCELLED, remarks, reviewer);
    }

    private Map<String, Object> review(EmployeeLeave l, String status, String remarks, String reviewer) {
        l.setStatus(status);
        l.setRemarks(remarks);
        l.setDateApproved(LocalDateTime.now());
        l.setApprovedBy(reviewer == null ? null : reviewer.length() > 50 ? reviewer.substring(0, 50) : reviewer);
        return view(leaves.saveAndFlush(l), employees.all(), categoryMap());
    }

    // ---------------------------------------------------------------
    // Credits
    // ---------------------------------------------------------------

    @Transactional(readOnly = true)
    public Map<String, Object> balance(String employeeId, int year) {
        employees.require(employeeId);
        return balance(employeeId, year, null);
    }

    /** Credits for a year; excludeLeaveId leaves one request out of "used" and "pending". */
    private Map<String, Object> balance(String employeeId, int year, Integer excludeLeaveId) {
        Map<Integer, LeaveCategory> cats = categoryMap();
        int used = 0;
        int pending = 0;
        for (EmployeeLeave l : leavesOf(employeeId)) {
            if (l.getId().equals(excludeLeaveId) || l.getDateFrom().getYear() != year) continue;
            LeaveCategory c = cats.get(l.getCategoryId());
            if (c == null || !c.isUsesCredits() || l.getTotalDays() == null) continue;
            if (EmployeeLeave.APPROVED.equals(l.getStatus())) used += l.getTotalDays();
            if (l.isPending()) pending += l.getTotalDays();
        }
        int total = creditRow(employeeId, year).map(LeaveCredit::getTotalCredits).orElse(LeaveCredit.DEFAULT_CREDITS);
        Map<String, Object> m = new HashMap<>();
        m.put("employeeId", employeeId);
        m.put("year", year);
        m.put("total", total);
        m.put("used", used);
        m.put("pending", pending);
        m.put("remaining", Math.max(0, total - used));
        return m;
    }

    @Transactional
    public Map<String, Object> setCredits(String employeeId, Integer year, Integer totalCredits) {
        employees.require(employeeId);
        if (year == null || year < 2000 || year > 2100) {
            throw Validation.invalid("year", "Enter a valid year.");
        }
        Integer total = Validation.wholeNumber(totalCredits, "totalCredits", "Leave credits", 365);
        if (total == null) {
            throw Validation.invalid("totalCredits", "Leave credits are required.");
        }
        int used = (Integer) balance(employeeId, year, null).get("used");
        if (total < used) {
            throw Validation.invalid("totalCredits", "Credits can't be less than the " + used + " day(s) already used in " + year + ".");
        }
        LeaveCredit row = creditRow(employeeId, year).orElseGet(() -> {
            LeaveCredit fresh = new LeaveCredit();
            EmployeeId eid = EmployeeId.parse(employeeId);
            if (eid.isFaculty()) fresh.setFacultyId(eid.number()); else fresh.setAdminstaffId(eid.number());
            fresh.setYear(year);
            return fresh;
        });
        row.setTotalCredits(total);
        credits.saveAndFlush(row);
        return balance(employeeId, year, null);
    }

    private java.util.Optional<LeaveCredit> creditRow(String employeeId, int year) {
        EmployeeId eid = EmployeeId.parse(employeeId);
        return eid.isFaculty() ? credits.findByFacultyIdAndYear(eid.number(), year)
                : credits.findByAdminstaffIdAndYear(eid.number(), year);
    }

    // ---------------------------------------------------------------
    // Payroll
    // ---------------------------------------------------------------

    /** Approved paid leave: the working days per employee falling inside [from, to]. */
    @Transactional(readOnly = true)
    public Map<String, Set<LocalDate>> paidLeaveDates(LocalDate from, LocalDate to) {
        Map<String, Set<LocalDate>> result = new HashMap<>();
        for (EmployeeLeave l : leaves.findByStatusAndDateFromLessThanEqualAndDateToGreaterThanEqual(EmployeeLeave.APPROVED, to, from)) {
            if (!l.isPaid()) continue;
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

    private Map<Integer, LeaveCategory> categoryMap() {
        Map<Integer, LeaveCategory> map = new HashMap<>();
        categories.findAll().forEach(c -> map.put(c.getId(), c));
        return map;
    }

    private EmployeeLeave find(int id) {
        return leaves.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Leave request not found."));
    }

    private static Map<String, Object> view(EmployeeLeave l, Map<String, StaffMember> people, Map<Integer, LeaveCategory> cats) {
        String employeeId = EmployeeDirectory.idOf(l.getFacultyId(), l.getAdminstaffId());
        StaffMember s = people.get(employeeId);
        LeaveCategory c = cats.get(l.getCategoryId());
        Map<String, Object> m = new HashMap<>();
        m.put("id", l.getId());
        m.put("employeeId", employeeId);
        m.put("employeeNumber", s == null ? "" : s.getEmployeeNumber());
        m.put("employeeName", s == null ? "(removed employee)" : s.getFullName());
        m.put("employeeType", s == null ? "" : s.staffType());
        m.put("categoryId", l.getCategoryId());
        m.put("category", l.getCategoryName());
        m.put("usesCredits", c != null && c.isUsesCredits());
        m.put("paid", l.isPaid());
        m.put("reason", l.getReason());
        m.put("status", l.getStatus());
        m.put("dateFrom", l.getDateFrom().toString());
        m.put("dateTo", l.getDateTo().toString());
        m.put("days", l.getTotalDays());
        m.put("dateFiled", l.getDateRequested() == null ? null : l.getDateRequested().toLocalDate().toString());
        m.put("reviewedBy", l.getApprovedBy());
        m.put("reviewedAt", l.getDateApproved() == null ? null : l.getDateApproved().toString());
        m.put("remarks", l.getRemarks());
        m.put("creditsTotal", l.getTotalLeaveCredit());
        m.put("creditsRemaining", l.getRemainingLeave());
        return m;
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }
}
