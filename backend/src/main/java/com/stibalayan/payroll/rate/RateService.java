package com.stibalayan.payroll.rate;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaff;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.user.UserNames;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Employee Rates (Maintenance): the history of every employee's rates in
 * table employee_rate. The employee record keeps the current rate; this
 * table keeps when each rate started and ended, so a payroll for an earlier
 * period is paid at the rate that applied then.
 *
 * Kinds: Office (rate per hour, Admin and Faculty/Admin) and Teaching (rate
 * per hour/unit, Faculty and Faculty/Admin).
 */
@Service
public class RateService {

    public static final String OFFICE = "Office";
    public static final String TEACHING = "Teaching";
    private static final BigDecimal MAX_RATE = new BigDecimal("100000.00");
    private static final LocalDate NO_HIRE_DATE = LocalDate.of(2000, 1, 1);

    private final JdbcTemplate jdbc;
    private final EmployeeDirectory employees;
    private final AuditService audit;
    private final UserNames userNames;

    public RateService(JdbcTemplate jdbc, EmployeeDirectory employees, AuditService audit, UserNames userNames) {
        this.jdbc = jdbc;
        this.employees = employees;
        this.audit = audit;
        this.userNames = userNames;
    }

    public record RateRequest(String employeeId, String kind, BigDecimal amount, String effectiveDate) {
    }

    /** One row of employee_rate. */
    private record Row(int id, String kind, BigDecimal amount, LocalDate effective, LocalDate end, Integer recordedBy) {
    }

    /** Every employee's rates, newest first per employee. */
    @Transactional
    public List<Map<String, Object>> history() {
        Map<String, StaffMember> people = employees.all();
        people.forEach((id, s) -> sync(id, s, null));
        List<Map<String, Object>> result = new ArrayList<>();
        List<Integer> recorders = new ArrayList<>();
        people.forEach((id, s) -> rows(id).forEach(r -> recorders.add(r.recordedBy())));
        Map<Integer, String> names = userNames.of(recorders);
        people.values().removeIf(StaffMember::isArchived);   // archived employees are not listed
        people.forEach((id, s) -> rows(id).forEach(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.id());
            m.put("employeeId", id);
            m.put("employeeNumber", s.getEmployeeNumber());
            m.put("employeeName", s.getFullName());
            m.put("employeeType", s.staffType());
            m.put("kind", r.kind());
            m.put("rateType", label(s, r.kind()));
            m.put("amount", r.amount());
            m.put("effective", r.effective().toString());
            m.put("end", r.end() == null ? null : r.end().toString());
            m.put("active", r.end() == null);
            m.put("recordedBy", r.recordedBy() == null ? null : names.get(r.recordedBy()));
            result.add(m);
        }));
        result.sort((a, b) -> {
            int byName = String.valueOf(a.get("employeeName")).compareToIgnoreCase(String.valueOf(b.get("employeeName")));
            if (byName != 0) return byName;
            int byKind = String.valueOf(a.get("kind")).compareTo(String.valueOf(b.get("kind")));
            if (byKind != 0) return byKind;
            return String.valueOf(b.get("effective")).compareTo(String.valueOf(a.get("effective")));
        });
        return result;
    }

    /** Employees and the rate kinds each one has, for the Add New Rate form. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> employeeOptions() {
        List<Map<String, Object>> list = new ArrayList<>();
        employees.all().forEach((id, s) -> {
            if (!"Active".equals(s.getEmploymentStatus())) return;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("name", s.getFullName());
            m.put("employeeType", s.staffType());
            List<Map<String, Object>> kinds = new ArrayList<>();
            kindsOf(s).forEach(k -> kinds.add(Map.of("kind", k, "label", label(s, k))));
            m.put("kinds", kinds);
            list.add(m);
        });
        list.sort((a, b) -> String.valueOf(a.get("name")).compareToIgnoreCase(String.valueOf(b.get("name"))));
        return list;
    }

    /**
     * A new rate from Maintenance: the current one ends the day before. The
     * effective date can't be in the future and must come after the current
     * rate's start. The employee record is updated to the new rate.
     */
    @Transactional
    public void add(RateRequest r, int userId) {
        StaffMember s = employees.require(r.employeeId());
        String id = r.employeeId().trim();
        String kind = r.kind() == null ? "" : r.kind().trim();
        if (!kindsOf(s).contains(kind)) {
            throw Validation.invalid("kind", "Choose a rate type this employee has.");
        }
        BigDecimal amount = Validation.money(r.amount(), "amount", "Rate amount", MAX_RATE);
        if (amount == null || amount.signum() <= 0) {
            throw Validation.invalid("amount", "Rate amount must be more than zero.");
        }
        amount = amount.setScale(2, RoundingMode.HALF_UP);
        LocalDate effective = Validation.date(r.effectiveDate(), "effectiveDate", "Effective date", true);
        if (effective.isAfter(LocalDate.now())) {
            throw Validation.invalid("effectiveDate", "The effective date can't be in the future.");
        }

        sync(id, s, userId);
        Row current = open(id, kind);
        if (current != null && !effective.isAfter(current.effective())) {
            throw Validation.invalid("effectiveDate", "Must be after the current rate's effective date ("
                    + current.effective() + ").");
        }
        if (current != null) {
            jdbc.update("UPDATE employee_rate SET end_date = ? WHERE rate_id = ?", Date.valueOf(effective.minusDays(1)), current.id());
        }
        insert(id, kind, amount, effective, userId);
        setRecordRate(id, s, kind, amount);
        audit.log(userId, "Employee Rates", "Added rate", s.getFullName() + " · " + label(s, kind) + " ₱"
                + String.format("%,.2f", amount) + " effective " + effective);
    }

    /**
     * Keeps the history in step with the employee record after it is created
     * or edited in Employee Records: a changed rate starts today.
     */
    @Transactional
    public void syncEmployee(String employeeId, Integer userId) {
        sync(employeeId, employees.require(employeeId), userId);
    }

    /**
     * Each employee's rates on a date, for payroll: { "A5": { office, teaching } }.
     * Employees with no rate history yet are left out (payroll then uses the
     * rate on the employee record).
     */
    @Transactional
    public Map<String, Map<String, BigDecimal>> ratesOn(LocalDate date) {
        Map<String, Map<String, BigDecimal>> result = new HashMap<>();
        employees.all().forEach((id, s) -> {
            sync(id, s, null);
            Map<String, BigDecimal> m = new HashMap<>();
            for (Row r : rows(id)) {
                boolean applies = !r.effective().isAfter(date) && (r.end() == null || !r.end().isBefore(date));
                if (applies) m.put(r.kind().equals(OFFICE) ? "office" : "teaching", r.amount());
            }
            if (!m.isEmpty()) result.put(id, m);
        });
        return result;
    }

    // ---------------------------------------------------------------

    private void sync(String id, StaffMember s, Integer userId) {
        List<String> kinds = kindsOf(s);
        LocalDate today = LocalDate.now();
        for (String kind : List.of(OFFICE, TEACHING)) {
            Row current = open(id, kind);
            BigDecimal amount = kinds.contains(kind) ? recordRate(s, kind) : null;
            if (amount == null) {
                // No longer has this kind of rate (e.g. Faculty/Admin changed to Admin): end it.
                if (current != null && !kinds.contains(kind)) {
                    if (current.effective().isBefore(today)) {
                        jdbc.update("UPDATE employee_rate SET end_date = ? WHERE rate_id = ?", Date.valueOf(today.minusDays(1)), current.id());
                    } else {
                        jdbc.update("DELETE FROM employee_rate WHERE rate_id = ?", current.id());
                    }
                }
                continue;
            }
            if (current == null) {
                LocalDate start = s.getDateHired() != null ? s.getDateHired() : NO_HIRE_DATE;
                Row latest = rows(id).stream().filter(r -> r.kind().equals(kind)).findFirst().orElse(null);
                if (latest != null && latest.end() != null && !start.isAfter(latest.end())) {
                    start = latest.end().plusDays(1);
                }
                if (start.isAfter(today)) start = today;
                insert(id, kind, amount, start, userId);
            } else if (current.amount().compareTo(amount) != 0) {
                if (!current.effective().isBefore(today)) {
                    jdbc.update("UPDATE employee_rate SET amount = ?, recorded_by = ? WHERE rate_id = ?", amount, userId, current.id());
                } else {
                    jdbc.update("UPDATE employee_rate SET end_date = ? WHERE rate_id = ?", Date.valueOf(today.minusDays(1)), current.id());
                    insert(id, kind, amount, today, userId);
                }
            }
        }
    }

    private static List<String> kindsOf(StaffMember s) {
        if (s instanceof FacultyStaff) return List.of(TEACHING);
        if (s instanceof AdminStaff a && a.isFaculty()) return List.of(OFFICE, TEACHING);
        return List.of(OFFICE);
    }

    private static String label(StaffMember s, String kind) {
        if (kind.equals(OFFICE)) return "Per Hour (office)";
        return s instanceof AdminStaff ? "Per Hour/Unit (teaching)" : "Per Hour/Unit";
    }

    private static BigDecimal recordRate(StaffMember s, String kind) {
        BigDecimal value;
        if (s instanceof FacultyStaff f) {
            value = f.getRatePerHourUnit();
        } else {
            AdminStaff a = (AdminStaff) s;
            value = kind.equals(OFFICE) ? a.getRatePerHour() : a.getRatePerHourUnit();
        }
        return value == null || value.signum() <= 0 ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    private void setRecordRate(String id, StaffMember s, String kind, BigDecimal amount) {
        EmployeeId eid = EmployeeId.parse(id);
        if (eid.isFaculty()) {
            jdbc.update("UPDATE faculty_staff SET rate_per_hour_unit = ? WHERE faculty_id = ?", amount, eid.number());
            ((FacultyStaff) s).setRatePerHourUnit(amount);
        } else if (kind.equals(OFFICE)) {
            jdbc.update("UPDATE admin_staff SET rate_per_hour = ? WHERE adminstaff_id = ?", amount, eid.number());
            ((AdminStaff) s).setRatePerHour(amount);
        } else {
            jdbc.update("UPDATE admin_staff SET rate_per_hour_unit = ? WHERE adminstaff_id = ?", amount, eid.number());
            ((AdminStaff) s).setRatePerHourUnit(amount);
        }
    }

    private void insert(String id, String kind, BigDecimal amount, LocalDate effective, Integer userId) {
        EmployeeId eid = EmployeeId.parse(id);
        jdbc.update("INSERT INTO employee_rate (faculty_id, adminstaff_id, rate_kind, amount, effective_date, recorded_by) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                eid.isFaculty() ? eid.number() : null, eid.isFaculty() ? null : eid.number(),
                kind, amount, Date.valueOf(effective), userId);
    }

    private Row open(String id, String kind) {
        return rows(id).stream().filter(r -> r.kind().equals(kind) && r.end() == null).findFirst().orElse(null);
    }

    /** This employee's rows, newest first. */
    private List<Row> rows(String id) {
        EmployeeId eid = EmployeeId.parse(id);
        String column = eid.isFaculty() ? "faculty_id" : "adminstaff_id";
        return jdbc.query("SELECT rate_id, rate_kind, amount, effective_date, end_date, recorded_by FROM employee_rate WHERE "
                        + column + " = ? ORDER BY effective_date DESC, rate_id DESC",
                (rs, n) -> new Row(rs.getInt(1), rs.getString(2), rs.getBigDecimal(3), rs.getDate(4).toLocalDate(),
                        rs.getDate(5) == null ? null : rs.getDate(5).toLocalDate(),
                        (Integer) rs.getObject(6)),
                eid.number());
    }
}
