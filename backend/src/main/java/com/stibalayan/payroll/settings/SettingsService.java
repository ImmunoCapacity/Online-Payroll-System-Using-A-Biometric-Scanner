package com.stibalayan.payroll.settings;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import java.sql.Date;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Maintenance → Grace Period and Payroll Periods (table system_setting and
 * payroll_period_rule).
 *
 * Grace period:
 *   - office start time and office grace minutes: a time-in after the start
 *     plus the grace is Late (Daily Time Record, scanner sync, manual entry);
 *   - class grace minutes: the window around a class's start and end for the
 *     classroom checks; a faculty member is marked Late only after it, and the
 *     minutes late are deducted from pay.
 * The values in application.properties are the defaults until one is saved.
 */
@Service
public class SettingsService {

    public static final String OFFICE_START = "attendance.standard-start";
    public static final String OFFICE_GRACE = "attendance.grace-minutes";
    public static final String CLASS_GRACE = "class.grace-minutes";
    private static final int MAX_GRACE = 60;
    private static final DateTimeFormatter LONG = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);

    private final JdbcTemplate jdbc;
    private final PayrollPeriods periods;
    private final AuditService audit;
    private final String defaultStart;
    private final int defaultGrace;

    public SettingsService(JdbcTemplate jdbc, PayrollPeriods periods, AuditService audit,
                           @Value("${attendance.standard-start:08:00}") String defaultStart,
                           @Value("${attendance.grace-minutes:15}") int defaultGrace) {
        this.jdbc = jdbc;
        this.periods = periods;
        this.audit = audit;
        this.defaultStart = defaultStart;
        this.defaultGrace = defaultGrace;
    }

    // ---------------------------------------------------------------
    // Grace period
    // ---------------------------------------------------------------

    public LocalTime officeStart() {
        try {
            return LocalTime.parse(get(OFFICE_START, defaultStart));
        } catch (DateTimeParseException e) {
            return LocalTime.of(8, 0);
        }
    }

    public int officeGraceMinutes() {
        return intValue(get(OFFICE_GRACE, String.valueOf(defaultGrace)), defaultGrace);
    }

    public int classGraceMinutes() {
        return intValue(get(CLASS_GRACE, String.valueOf(defaultGrace)), defaultGrace);
    }

    /** A time-in after this is Late. */
    public LocalTime lateAfter() {
        return officeStart().plusMinutes(officeGraceMinutes());
    }

    public record GraceRequest(String officeStart, Integer officeGraceMinutes, Integer classGraceMinutes) {
    }

    @Transactional
    public Map<String, Object> saveGrace(GraceRequest r, int userId) {
        LocalTime start = Validation.time(r.officeStart(), "officeStart", "Office start time", true);
        int office = grace(r.officeGraceMinutes(), "officeGraceMinutes", "Office grace period");
        int cls = grace(r.classGraceMinutes(), "classGraceMinutes", "Class grace period");
        int oldClass = classGraceMinutes();
        put(OFFICE_START, start.toString());
        put(OFFICE_GRACE, String.valueOf(office));
        put(CLASS_GRACE, String.valueOf(cls));
        // Classes from today on that nobody has checked yet follow the new class grace.
        if (cls != oldClass) {
            jdbc.update("UPDATE faculty_class_schedule s SET s.grace_period_minutes = ? WHERE s.class_date >= CURDATE() "
                    + "AND NOT EXISTS (SELECT 1 FROM faculty_teaching_attendance a WHERE a.class_schedule_id = s.class_schedule_id)", cls);
        }
        audit.log(userId, "Grace Period", "Updated", "Office starts " + start + ", late after " + office
                + " min; classroom checks ±" + cls + " min");
        return graceView();
    }

    public Map<String, Object> graceView() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("officeStart", officeStart().toString());
        m.put("officeGraceMinutes", officeGraceMinutes());
        m.put("classGraceMinutes", classGraceMinutes());
        m.put("lateAfter", lateAfter().toString());
        return m;
    }

    // ---------------------------------------------------------------
    // Payroll periods
    // ---------------------------------------------------------------

    public record RuleRequest(String effectiveDate, Integer firstDay, Integer secondDay) {
    }

    /** Adds a new cut-off rule (or replaces the one not yet in effect). */
    @Transactional
    public List<Map<String, Object>> addRule(RuleRequest r, int userId) {
        int first = day(r.firstDay(), "firstDay", "First cut-off start day");
        int second = day(r.secondDay(), "secondDay", "Second cut-off start day");
        if (second <= first) {
            throw Validation.invalid("secondDay", "The second cut-off must start after the first one (day " + first + ").");
        }
        LocalDate effective = Validation.date(r.effectiveDate(), "effectiveDate", "Effective date", true);
        if (!PayrollPeriods.isStartDay(first, second, effective)) {
            throw Validation.invalid("effectiveDate", "The new periods must start on a cut-off day: the " + ordinal(first)
                    + " or the " + ordinal(second) + ".");
        }
        LocalDate lastSaved = periods.lastSavedPayrollEnd();
        if (lastSaved != null && !effective.isAfter(lastSaved)) {
            throw Validation.invalid("effectiveDate", "Payroll is already saved up to " + lastSaved.format(LONG)
                    + ". The new periods must start after that.");
        }
        if (effective.isBefore(LocalDate.now().minusDays(31))) {
            throw Validation.invalid("effectiveDate", "The effective date is too far in the past.");
        }
        // Only one change can wait to take effect: the new one replaces it.
        jdbc.update("DELETE FROM payroll_period_rule WHERE effective_date >= ?", Date.valueOf(effective));
        jdbc.update("INSERT INTO payroll_period_rule (effective_date, first_start_day, second_start_day, created_by) VALUES (?, ?, ?, ?)",
                Date.valueOf(effective), first, second, userId);
        audit.log(userId, "Payroll Periods", "Changed cut-offs", describe(first, second) + " from " + effective.format(LONG));
        return rulesView();
    }

    /** Removes a change that has not taken effect yet. */
    @Transactional
    public List<Map<String, Object>> removeRule(int id, int userId) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM payroll_period_rule WHERE rule_id = ?", id);
        if (rows.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Payroll period rule not found.");
        }
        LocalDate effective = ((Date) rows.get(0).get("effective_date")).toLocalDate();
        LocalDate lastSaved = periods.lastSavedPayrollEnd();
        if (!effective.isAfter(LocalDate.now()) || (lastSaved != null && !effective.isAfter(lastSaved))) {
            throw new ApiException(HttpStatus.CONFLICT, "These periods are already in use and can't be removed. Add a new change instead.");
        }
        jdbc.update("DELETE FROM payroll_period_rule WHERE rule_id = ?", id);
        audit.log(userId, "Payroll Periods", "Removed change", describe(((Number) rows.get(0).get("first_start_day")).intValue(),
                ((Number) rows.get(0).get("second_start_day")).intValue()) + " from " + effective.format(LONG));
        return rulesView();
    }

    /** Every rule, newest first, with whether it is current, upcoming or past. */
    public List<Map<String, Object>> rulesView() {
        List<PayrollPeriods.Rule> rules = periods.rules();
        PayrollPeriods.Rule current = PayrollPeriods.ruleFor(rules, LocalDate.now());
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = rules.size() - 1; i >= 0; i--) {
            PayrollPeriods.Rule r = rules.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.id());
            m.put("effectiveDate", r.effectiveDate().toString());
            m.put("firstDay", r.firstDay());
            m.put("secondDay", r.secondDay());
            m.put("description", describe(r.firstDay(), r.secondDay()));
            m.put("state", r.effectiveDate().isAfter(LocalDate.now()) ? "Upcoming" : r.equals(current) ? "Current" : "Past");
            result.add(m);
        }
        return result;
    }

    public Map<String, Object> all() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("grace", graceView());
        m.put("periodRules", rulesView());
        LocalDate lastSaved = periods.lastSavedPayrollEnd();
        m.put("lastSavedPayrollEnd", lastSaved == null ? null : lastSaved.toString());
        return m;
    }

    /** e.g. "11th–25th and 26th–10th of the next month". */
    public static String describe(int first, int second) {
        String a = ordinal(first) + "–" + ordinal(second - 1);
        String b = first == 1 ? ordinal(second) + "–end of the month" : ordinal(second) + "–" + ordinal(first - 1) + " of the next month";
        return a + " and " + b;
    }

    static String ordinal(int n) {
        String suffix = (n % 100 >= 11 && n % 100 <= 13) ? "th" : switch (n % 10) {
            case 1 -> "st";
            case 2 -> "nd";
            case 3 -> "rd";
            default -> "th";
        };
        return n + suffix;
    }

    // ---------------------------------------------------------------

    private String get(String key, String fallback) {
        List<String> v = jdbc.queryForList("SELECT setting_value FROM system_setting WHERE setting_key = ?", String.class, key);
        return v.isEmpty() || v.get(0) == null || v.get(0).isBlank() ? fallback : v.get(0);
    }

    private void put(String key, String value) {
        jdbc.update("INSERT INTO system_setting (setting_key, setting_value) VALUES (?, ?) "
                + "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", key, value);
    }

    private static int intValue(String s, int fallback) {
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static int grace(Integer v, String field, String label) {
        if (v == null || v < 0 || v > MAX_GRACE) {
            throw Validation.invalid(field, label + " must be 0 to " + MAX_GRACE + " minutes.");
        }
        return v;
    }

    private static int day(Integer v, String field, String label) {
        if (v == null || v < 1 || v > PayrollPeriods.MAX_START_DAY) {
            throw Validation.invalid(field, label + " must be a day from 1 to " + PayrollPeriods.MAX_START_DAY + ".");
        }
        return v;
    }
}
