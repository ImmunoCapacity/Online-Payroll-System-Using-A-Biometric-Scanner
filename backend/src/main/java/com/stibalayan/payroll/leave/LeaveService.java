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

    private static final Set<String> INACTIVE = Set.of("Inactive", "Resigned", "Terminated");
    private static final int MAX_PAID_DAYS = 366;

    private final LeaveCategoryRepository categories;
    private final EmployeeLeaveRepository leaves;
    private final EmployeeDirectory employees;

    public LeaveService(LeaveCategoryRepository categories, EmployeeLeaveRepository leaves, EmployeeDirectory employees) {
        this.categories = categories;
        this.leaves = leaves;
        this.employees = employees;
    }

    // ---------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------

    /** paidDays: for paid leave, the days a year each employee is paid for. */
    public record CategoryRequest(String name, Boolean paid, Integer paidDays, Boolean active) {
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
        c.setActive(r.active() == null || r.active());
        return categoryView(categories.save(c));
    }

    private static Map<String, Object> categoryView(LeaveCategory c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("paid", c.isPaid());
        m.put("paidDays", c.isPaid() ? c.getPaidDays() : null);
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
        return view(leaves.saveAndFlush(l), employees.all());
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
        return view(leaves.saveAndFlush(l), employees.all());
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
            creditTotal = c.getPaidDays() == null ? 0 : c.getPaidDays();
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
        employees.require(employeeId);
        if (EmployeeId.parse(employeeId).isFaculty()) return List.of();
        List<Map<String, Object>> result = new ArrayList<>();
        for (LeaveCategory c : categories.findAllByOrderByNameAsc()) {
            if (!c.isPaid()) continue;
            int total = c.getPaidDays() == null ? 0 : c.getPaidDays();
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
    // Payroll
    // ---------------------------------------------------------------

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
