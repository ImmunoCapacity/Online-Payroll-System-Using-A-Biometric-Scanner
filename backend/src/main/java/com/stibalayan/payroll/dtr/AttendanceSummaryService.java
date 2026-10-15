package com.stibalayan.payroll.dtr;

import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.StaffMember;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
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
 * Attendance Report: per employee, how many working days in a date range
 * were present, late, absent or on approved leave, from the Daily Time
 * Record. A weekday (Monday to Friday) with no record and no approved leave
 * counts as absent; days before the employee was hired and days after
 * today are not counted.
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> summary(String fromText, String toText) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The end date can't be before the start date.");
        }
        if (from.plusDays(MAX_DAYS).isBefore(to)) {
            throw Validation.invalid("to", "Choose a range of at most " + MAX_DAYS + " days.");
        }
        LocalDate last = to.isAfter(LocalDate.now()) ? LocalDate.now() : to;

        // DTR status per employee per day.
        Map<String, Map<LocalDate, String>> dtr = new HashMap<>();
        jdbc.query("SELECT faculty_id, adminstaff_id, record_date, LOWER(status) FROM daily_time_record "
                + "WHERE record_date BETWEEN ? AND ?", (RowCallbackHandler) rs -> {
            String id = EmployeeDirectory.idOf((Integer) rs.getObject(1), (Integer) rs.getObject(2));
            dtr.computeIfAbsent(id, k -> new HashMap<>()).put(rs.getDate(3).toLocalDate(), rs.getString(4));
        }, Date.valueOf(from), Date.valueOf(last));

        // Approved leave days (paid or unpaid).
        Map<String, Set<LocalDate>> leave = new HashMap<>();
        jdbc.query("SELECT faculty_id, adminstaff_id, date_from, date_to FROM employee_leave "
                + "WHERE status = 'Approved' AND date_from <= ? AND date_to >= ?", (RowCallbackHandler) rs -> {
            String id = EmployeeDirectory.idOf((Integer) rs.getObject(1), (Integer) rs.getObject(2));
            LocalDate start = rs.getDate(3).toLocalDate();
            LocalDate end = rs.getDate(4).toLocalDate();
            for (LocalDate d = start.isBefore(from) ? from : start; !d.isAfter(end) && !d.isAfter(last); d = d.plusDays(1)) {
                leave.computeIfAbsent(id, k -> new HashSet<>()).add(d);
            }
        }, Date.valueOf(last), Date.valueOf(from));

        List<Map<String, Object>> result = new ArrayList<>();
        employees.all().forEach((id, s) -> {
            if (!"Active".equals(s.getEmploymentStatus())) return;
            int present = 0, late = 0, absent = 0, onLeave = 0;
            Map<LocalDate, String> days = dtr.getOrDefault(id, Map.of());
            Set<LocalDate> leaveDays = leave.getOrDefault(id, Set.of());
            LocalDate start = s.getDateHired() != null && s.getDateHired().isAfter(from) ? s.getDateHired() : from;
            for (LocalDate d = start; !d.isAfter(last); d = d.plusDays(1)) {
                String status = days.get(d);
                boolean weekday = d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY;
                if ("present".equals(status)) present++;
                else if ("late".equals(status)) late++;
                else if (weekday && leaveDays.contains(d)) onLeave++;
                else if (weekday) absent++;
            }
            result.add(row(id, s, present, late, absent, onLeave));
        });
        result.sort((a, b) -> String.valueOf(a.get("employeeName")).compareToIgnoreCase(String.valueOf(b.get("employeeName"))));
        return result;
    }

    private static Map<String, Object> row(String id, StaffMember s, int present, int late, int absent, int onLeave) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("employeeId", id);
        m.put("employeeNumber", s.getEmployeeNumber());
        m.put("employeeName", s.getFullName());
        m.put("type", s.staffType());
        m.put("present", present);
        m.put("late", late);
        m.put("absent", absent);
        m.put("onLeave", onLeave);
        int counted = present + late + absent;
        m.put("attendanceRate", counted == 0 ? null : Math.round((present + late) * 1000.0 / counted) / 10.0);
        return m;
    }
}
