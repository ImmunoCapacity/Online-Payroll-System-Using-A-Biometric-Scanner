package com.stibalayan.payroll.dtr;

import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.StaffMember;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Time;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Attendance over a date range, from the Daily Time Record:
 *
 *   summary()      per employee, how many working days were present, late,
 *                  absent or on approved leave, and the hours worked
 *                  (Attendance Report; Biometric Records weekly / monthly view)
 *   employeeDays() one employee, day by day (Biometric Records → click a row)
 *
 * A weekday (Monday to Friday) with no record and no approved leave counts as
 * absent; days before the employee was hired and days after today are not
 * counted. Hours are time out − time in.
 */
@Service
public class AttendanceSummaryService {

    private static final int MAX_DAYS = 400;

    private final JdbcTemplate jdbc;
    private final EmployeeDirectory employees;

    public AttendanceSummaryService(JdbcTemplate jdbc, EmployeeDirectory employees) {
        this.jdbc = jdbc;
        this.employees = employees;
    }

    /** One day of the DTR: status (lowercase) and times. */
    private record Day(String status, LocalTime timeIn, LocalTime timeOut, boolean manual, String remarks) {
        BigDecimal hours() {
            if (timeIn == null || timeOut == null || !timeOut.isAfter(timeIn)) return BigDecimal.ZERO;
            return BigDecimal.valueOf(Duration.between(timeIn, timeOut).toMinutes()).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> summary(String fromText, String toText) {
        LocalDate[] range = range(fromText, toText);
        LocalDate from = range[0];
        LocalDate last = range[1];
        Map<String, Map<LocalDate, Day>> dtr = dtr(from, last, null);
        Map<String, Set<LocalDate>> leave = leave(from, last, null);

        List<Map<String, Object>> result = new ArrayList<>();
        employees.all().forEach((id, s) -> {
            if (!"Active".equals(s.getEmploymentStatus())) return;
            int present = 0, late = 0, absent = 0, onLeave = 0;
            BigDecimal hours = BigDecimal.ZERO;
            Map<LocalDate, Day> days = dtr.getOrDefault(id, Map.of());
            Set<LocalDate> leaveDays = leave.getOrDefault(id, Set.of());
            LocalDate start = s.getDateHired() != null && s.getDateHired().isAfter(from) ? s.getDateHired() : from;
            for (LocalDate d = start; !d.isAfter(last); d = d.plusDays(1)) {
                Day day = days.get(d);
                String status = day == null ? null : day.status();
                if (day != null) hours = hours.add(day.hours());
                if ("present".equals(status)) present++;
                else if ("late".equals(status)) late++;
                else if (weekday(d) && leaveDays.contains(d)) onLeave++;
                else if (weekday(d)) absent++;
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeId", id);
            m.put("employeeNumber", s.getEmployeeNumber());
            m.put("employeeName", s.getFullName());
            m.put("type", s.staffType());
            m.put("present", present);
            m.put("late", late);
            m.put("absent", absent);
            m.put("onLeave", onLeave);
            m.put("hours", hours);
            int counted = present + late + absent;
            m.put("attendanceRate", counted == 0 ? null : Math.round((present + late) * 1000.0 / counted) / 10.0);
            result.add(m);
        });
        result.sort((a, b) -> String.valueOf(a.get("employeeName")).compareToIgnoreCase(String.valueOf(b.get("employeeName"))));
        return result;
    }

    /**
     * One employee, day by day: { employee, from, to, days: [{ date, timeIn, timeOut, hours, status, manual, remarks }],
     * totals: { present, late, absent, onLeave, hours } }. status: present | late | absent | leave | rest-day
     * (Saturday/Sunday without a record) | not-hired | upcoming (after today).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> employeeDays(String employeeId, String fromText, String toText) {
        StaffMember s = employees.require(employeeId);
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The end date can't be before the start date.");
        }
        if (from.plusDays(62).isBefore(to)) {
            throw Validation.invalid("to", "Choose a range of at most two months.");
        }
        LocalDate today = LocalDate.now();
        Map<LocalDate, Day> dtr = dtr(from, to, employeeId).getOrDefault(employeeId, Map.of());
        Set<LocalDate> leaveDays = leave(from, to, employeeId).getOrDefault(employeeId, Set.of());

        int present = 0, late = 0, absent = 0, onLeave = 0;
        BigDecimal hours = BigDecimal.ZERO;
        List<Map<String, Object>> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            Day day = dtr.get(d);
            String status;
            if (day != null && day.status() != null) {
                status = day.status();
            } else if (s.getDateHired() != null && d.isBefore(s.getDateHired())) {
                status = "not-hired";
            } else if (d.isAfter(today)) {
                status = "upcoming";
            } else if (!weekday(d)) {
                status = "rest-day";
            } else if (leaveDays.contains(d)) {
                status = "leave";
            } else {
                status = "absent";
            }
            switch (status) {
                case "present" -> present++;
                case "late" -> late++;
                case "leave" -> onLeave++;
                case "absent" -> absent++;
                default -> { }
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", d.toString());
            m.put("timeIn", day == null || day.timeIn() == null ? null : day.timeIn().toString().substring(0, 5));
            m.put("timeOut", day == null || day.timeOut() == null ? null : day.timeOut().toString().substring(0, 5));
            BigDecimal h = day == null ? BigDecimal.ZERO : day.hours();
            hours = hours.add(h);
            m.put("hours", h);
            m.put("status", status);
            m.put("manual", day != null && day.manual());
            m.put("remarks", day == null ? null : day.remarks());
            days.add(m);
        }
        Map<String, Object> employee = new LinkedHashMap<>();
        employee.put("id", employeeId);
        employee.put("employeeNumber", s.getEmployeeNumber());
        employee.put("name", s.getFullName());
        employee.put("type", s.staffType());
        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("present", present);
        totals.put("late", late);
        totals.put("absent", absent);
        totals.put("onLeave", onLeave);
        totals.put("hours", hours);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("employee", employee);
        result.put("from", from.toString());
        result.put("to", to.toString());
        result.put("days", days);
        result.put("totals", totals);
        return result;
    }

    // ---------------------------------------------------------------

    private static LocalDate[] range(String fromText, String toText) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The end date can't be before the start date.");
        }
        if (from.plusDays(MAX_DAYS).isBefore(to)) {
            throw Validation.invalid("to", "Choose a range of at most " + MAX_DAYS + " days.");
        }
        LocalDate last = to.isAfter(LocalDate.now()) ? LocalDate.now() : to;
        return new LocalDate[] {from, last};
    }

    /** DTR days per employee in [from, to]; one employee only when employeeId is given. */
    private Map<String, Map<LocalDate, Day>> dtr(LocalDate from, LocalDate to, String employeeId) {
        Map<String, Map<LocalDate, Day>> dtr = new HashMap<>();
        jdbc.query("SELECT faculty_id, adminstaff_id, record_date, LOWER(status), time_in, time_out, is_manual_entry, remarks "
                + "FROM daily_time_record WHERE record_date BETWEEN ? AND ?", (RowCallbackHandler) rs -> {
            String id = EmployeeDirectory.idOf((Integer) rs.getObject(1), (Integer) rs.getObject(2));
            if (employeeId != null && !employeeId.equals(id)) return;
            Time in = rs.getTime(5);
            Time out = rs.getTime(6);
            dtr.computeIfAbsent(id, k -> new HashMap<>()).put(rs.getDate(3).toLocalDate(),
                    new Day(rs.getString(4), in == null ? null : in.toLocalTime(), out == null ? null : out.toLocalTime(),
                            rs.getBoolean(7), rs.getString(8)));
        }, Date.valueOf(from), Date.valueOf(to));
        return dtr;
    }

    /** Approved leave days (paid or unpaid) per employee in [from, to]. */
    private Map<String, Set<LocalDate>> leave(LocalDate from, LocalDate to, String employeeId) {
        Map<String, Set<LocalDate>> leave = new HashMap<>();
        jdbc.query("SELECT faculty_id, adminstaff_id, date_from, date_to FROM employee_leave "
                + "WHERE status = 'Approved' AND date_from <= ? AND date_to >= ?", (RowCallbackHandler) rs -> {
            String id = EmployeeDirectory.idOf((Integer) rs.getObject(1), (Integer) rs.getObject(2));
            if (employeeId != null && !employeeId.equals(id)) return;
            LocalDate start = rs.getDate(3).toLocalDate();
            LocalDate end = rs.getDate(4).toLocalDate();
            for (LocalDate d = start.isBefore(from) ? from : start; !d.isAfter(end) && !d.isAfter(to); d = d.plusDays(1)) {
                leave.computeIfAbsent(id, k -> new HashSet<>()).add(d);
            }
        }, Date.valueOf(to), Date.valueOf(from));
        return leave;
    }

    private static boolean weekday(LocalDate d) {
        return d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY;
    }
}
