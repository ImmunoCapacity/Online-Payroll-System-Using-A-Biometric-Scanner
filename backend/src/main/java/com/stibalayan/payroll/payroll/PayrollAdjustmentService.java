package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaff;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.rate.RateService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Payroll Adjustment (Payroll Processing → Payroll Adjustment), entered in a
 * grid: one row per employee per cut-off.
 *
 * For each employee the Payroll Master enters the days being corrected (Date
 * From – Date To; days = working days, Monday to Friday), hours per day to
 * ADD and/or to DEDUCT, and a reason. Amounts = hours × days × the employee's
 * rate on Date From (office rate; teaching rate for Faculty), computed here.
 * Total = addition − deduction, part of gross pay of the chosen cut-off, so
 * contributions and tax follow it. Once that cut-off's payroll is released
 * the adjustments are Applied and can't be changed.
 */
@Service
public class PayrollAdjustmentService {

    public static final String PENDING = "Pending";
    public static final String APPLIED = "Applied";
    private static final BigDecimal MAX_HOURS = new BigDecimal("24");
    private static final Set<String> INACTIVE = Set.of("Inactive", "Resigned", "Terminated");
    private static final Map<String, Integer> TYPE_ORDER = Map.of("Admin", 0, "Faculty", 1, "Faculty/Admin", 2);

    /** One grid row as sent by the page; empty hours = no adjustment. */
    public record Row(String employeeId, String dateFrom, String dateTo, BigDecimal addHours, BigDecimal deductHours,
                      String reason) {
    }

    public record GridRequest(String applyStart, String applyEnd, List<Row> rows) {
    }

    private final JdbcTemplate jdbc;
    private final EmployeeDirectory employees;
    private final RateService rates;

    public PayrollAdjustmentService(JdbcTemplate jdbc, EmployeeDirectory employees, RateService rates) {
        this.jdbc = jdbc;
        this.employees = employees;
        this.rates = rates;
    }

    /** The grid of one cut-off: every current employee (and anyone with an adjustment in it). */
    @Transactional
    public Map<String, Object> grid(String fromText, String toText) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        requireCutoff(from, to);

        Map<String, Map<String, Object>> saved = new HashMap<>();
        jdbc.queryForList("SELECT * FROM payroll_adjustment WHERE apply_start = ? AND apply_end = ?", Date.valueOf(from), Date.valueOf(to))
                .forEach(r -> saved.put(EmployeeDirectory.idOf((Integer) r.get("faculty_id"), (Integer) r.get("adminstaff_id")), r));
        Map<String, Map<String, BigDecimal>> ratesAtEnd = rates.ratesOn(to);

        List<Map<String, Object>> rows = new ArrayList<>();
        employees.all().forEach((id, s) -> {
            Map<String, Object> a = saved.get(id);
            boolean current = !s.isArchived() && !INACTIVE.contains(s.getEmploymentStatus());
            if (!current && a == null) return;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeId", id);
            m.put("employeeNumber", s.getEmployeeNumber());
            m.put("name", s.getFullName());
            m.put("type", s.staffType());
            if (a == null) {
                m.put("rate", rate(s, ratesAtEnd.get(id)));
            } else {
                m.put("rate", a.get("rate"));
                m.put("dateFrom", a.get("date_from").toString());
                m.put("dateTo", a.get("date_to").toString());
                m.put("days", a.get("days"));
                m.put("addHours", a.get("add_hours"));
                m.put("deductHours", a.get("deduct_hours"));
                m.put("addAmount", a.get("add_amount"));
                m.put("deductAmount", a.get("deduct_amount"));
                m.put("amount", a.get("amount"));
                m.put("reason", a.get("reason"));
                m.put("status", a.get("status"));
            }
            rows.add(m);
        });
        rows.sort(Comparator.<Map<String, Object>>comparingInt(m -> TYPE_ORDER.getOrDefault(String.valueOf(m.get("type")), 9))
                .thenComparing(m -> String.valueOf(m.get("name"))));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("applyStart", from.toString());
        result.put("applyEnd", to.toString());
        result.put("released", isReleased(from, to));
        result.put("rows", rows);
        return result;
    }

    /**
     * Saves the grid of one cut-off: rows with hours are added or updated,
     * rows left empty remove that employee's adjustment. All or nothing: a
     * problem in one row (named in the message) saves none.
     * Returns { saved, removed }.
     */
    @Transactional
    public Map<String, Integer> saveGrid(GridRequest request, int userId) {
        LocalDate start = Validation.date(request.applyStart(), "applyStart", "Cut-off", true);
        LocalDate end = Validation.date(request.applyEnd(), "applyEnd", "Cut-off", true);
        requireCutoff(start, end);
        if (isReleased(start, end)) {
            throw new ApiException(HttpStatus.CONFLICT, "This cut-off's payroll is already released; its adjustments can't be changed.");
        }
        int saved = 0;
        int removed = 0;
        List<Row> rows = request.rows() == null ? List.of() : request.rows();
        for (Row r : rows) {
            StaffMember staff = employees.require(r.employeeId());
            EmployeeId eid = EmployeeId.parse(r.employeeId());
            String idColumn = eid.isFaculty() ? "faculty_id" : "adminstaff_id";
            BigDecimal add = hours(r.addHours(), staff, "addition");
            BigDecimal deduct = hours(r.deductHours(), staff, "deduction");

            if (add.signum() == 0 && deduct.signum() == 0) {
                removed += jdbc.update("DELETE FROM payroll_adjustment WHERE " + idColumn + " = ? AND apply_start = ? AND status = ?",
                        eid.number(), Date.valueOf(start), PENDING);
                continue;
            }
            String who = staff.getFullName() + ": ";
            LocalDate from = date(r.dateFrom(), who + "enter Date From.");
            LocalDate to = date(r.dateTo(), who + "enter Date To.");
            if (to.isBefore(from)) {
                throw Validation.invalid("rows", who + "Date To can't be before Date From.");
            }
            if (to.isAfter(end)) {
                throw Validation.invalid("rows", who + "the corrected dates must end on or before the cut-off (" + end + ").");
            }
            if (staff.getDateHired() != null && from.isBefore(staff.getDateHired())) {
                throw Validation.invalid("rows", who + "Date From is before the date hired (" + staff.getDateHired() + ").");
            }
            int days = workdays(from, to);
            if (days == 0) {
                throw Validation.invalid("rows", who + "those dates have no working days (Monday to Friday).");
            }
            String reason = r.reason() == null ? "" : r.reason().trim().replaceAll("\\s+", " ");
            if (reason.isEmpty()) {
                throw Validation.invalid("rows", who + "enter the reason.");
            }
            if (reason.length() > 200) {
                throw Validation.invalid("rows", who + "the reason can be at most 200 characters.");
            }
            BigDecimal rate = rate(staff, rates.ratesOn(from).get(r.employeeId()));
            if (rate == null || rate.signum() <= 0) {
                throw Validation.invalid("rows", who + "no rate on " + from + ". Set one in Maintenance → Employee Rates.");
            }
            BigDecimal d = BigDecimal.valueOf(days);
            BigDecimal addAmount = add.multiply(d).multiply(rate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal deductAmount = deduct.multiply(d).multiply(rate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal amount = addAmount.subtract(deductAmount);

            List<Map<String, Object>> existing = jdbc.queryForList("SELECT adjustment_id, status FROM payroll_adjustment WHERE "
                    + idColumn + " = ? AND apply_start = ?", eid.number(), Date.valueOf(start));
            if (existing.isEmpty()) {
                jdbc.update("INSERT INTO payroll_adjustment (faculty_id, adminstaff_id, apply_start, apply_end, date_from, date_to, days, "
                                + "add_hours, deduct_hours, rate, add_amount, deduct_amount, amount, reason, recorded_by) "
                                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        eid.isFaculty() ? eid.number() : null, eid.isFaculty() ? null : eid.number(),
                        Date.valueOf(start), Date.valueOf(end), Date.valueOf(from), Date.valueOf(to), days,
                        add, deduct, rate, addAmount, deductAmount, amount, reason, userId);
            } else {
                jdbc.update("UPDATE payroll_adjustment SET date_from = ?, date_to = ?, days = ?, add_hours = ?, deduct_hours = ?, rate = ?, "
                                + "add_amount = ?, deduct_amount = ?, amount = ?, reason = ?, recorded_by = ? WHERE adjustment_id = ? AND status = ?",
                        Date.valueOf(from), Date.valueOf(to), days, add, deduct, rate, addAmount, deductAmount, amount, reason, userId,
                        existing.get(0).get("adjustment_id"), PENDING);
            }
            saved++;
        }
        return Map.of("saved", saved, "removed", removed);
    }

    /**
     * Earnings lines per employee for one cut-off, for Payroll Computation:
     * { "A5": [{ label, hours, rate, amount }] } (amount = addition − deduction).
     */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> forPeriod(String fromText, String toText) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        jdbc.queryForList("SELECT * FROM payroll_adjustment WHERE apply_start = ? AND apply_end = ?", Date.valueOf(from), Date.valueOf(to))
                .forEach(r -> {
                    BigDecimal days = BigDecimal.valueOf(((Number) r.get("days")).longValue());
                    BigDecimal netHours = ((BigDecimal) r.get("add_hours")).subtract((BigDecimal) r.get("deduct_hours")).multiply(days);
                    Map<String, Object> line = new LinkedHashMap<>();
                    line.put("label", "Adjustment: " + r.get("reason") + " (" + r.get("date_from") + " to " + r.get("date_to") + ")");
                    line.put("hours", netHours);
                    line.put("rate", r.get("rate"));
                    line.put("amount", r.get("amount"));
                    result.computeIfAbsent(EmployeeDirectory.idOf((Integer) r.get("faculty_id"), (Integer) r.get("adminstaff_id")),
                            k -> new ArrayList<>()).add(line);
                });
        return result;
    }

    /** Called when a cut-off is released: its adjustments are now paid. */
    public void markApplied(int runId, LocalDate from, LocalDate to) {
        jdbc.update("UPDATE payroll_adjustment SET status = ?, payroll_run_id = ? WHERE apply_start = ? AND apply_end = ? AND status = ?",
                APPLIED, runId, Date.valueOf(from), Date.valueOf(to), PENDING);
    }

    // ---------------------------------------------------------------

    private boolean isReleased(LocalDate start, LocalDate end) {
        Integer released = jdbc.queryForObject("SELECT COUNT(*) FROM payroll_run WHERE pay_period_start = ? AND pay_period_end = ? "
                + "AND status = 'Released'", Integer.class, Date.valueOf(start), Date.valueOf(end));
        return released != null && released > 0;
    }

    private static void requireCutoff(LocalDate start, LocalDate end) {
        boolean ok = start.getDayOfMonth() == 11 ? end.equals(start.withDayOfMonth(25))
                : start.getDayOfMonth() == 26 && end.equals(start.plusMonths(1).withDayOfMonth(10));
        if (!ok) {
            throw Validation.invalid("applyStart", "Choose a payroll cut-off (11th–25th or 26th–10th).");
        }
    }

    /** Hours per day: blank = 0; otherwise 0–24 with at most one decimal. */
    private static BigDecimal hours(BigDecimal value, StaffMember staff, String what) {
        if (value == null) return BigDecimal.ZERO;
        if (value.signum() < 0 || value.compareTo(MAX_HOURS) > 0 || value.stripTrailingZeros().scale() > 1) {
            throw Validation.invalid("rows", staff.getFullName() + ": " + what + " hours per day must be from 0 to 24 (one decimal).");
        }
        return value.setScale(1, RoundingMode.UNNECESSARY);
    }

    private static LocalDate date(String text, String message) {
        if (text == null || text.isBlank()) {
            throw Validation.invalid("rows", message);
        }
        try {
            return LocalDate.parse(text.trim());
        } catch (RuntimeException e) {
            throw Validation.invalid("rows", message);
        }
    }

    /** Monday–Friday days from one date to another, inclusive (the Leave rule). */
    static int workdays(LocalDate from, LocalDate to) {
        int days = 0;
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY) days++;
        }
        return days;
    }

    /** Office rate (teaching rate for Faculty) from the rate history; the record's rate if there's none. */
    private static BigDecimal rate(StaffMember staff, Map<String, BigDecimal> onDate) {
        boolean faculty = staff instanceof FacultyStaff;
        BigDecimal rate = onDate == null ? null : onDate.get(faculty ? "teaching" : "office");
        if (rate == null) {
            rate = faculty ? ((FacultyStaff) staff).getRatePerHourUnit() : ((AdminStaff) staff).getRatePerHour();
        }
        return rate;
    }
}
