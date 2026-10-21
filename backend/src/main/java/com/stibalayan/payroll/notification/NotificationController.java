package com.stibalayan.payroll.notification;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.SessionUser;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.biometric.BiometricLiveSync;
import com.stibalayan.payroll.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The bell in the top bar: things waiting for the logged-in user, worked
 * out from the data each time (nothing is stored). Each role only sees
 * items of the modules it can open.
 *
 * GET /api/notifications  { notifications: [{ id, icon, level, title, text, href }] }
 *
 * id changes when the item changes (e.g. a count), so the page can tell
 * which ones the user hasn't seen yet.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.ENGLISH);
    private static final DateTimeFormatter SHORT = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);

    private final JdbcTemplate jdbc;
    private final BiometricLiveSync liveSync;

    public NotificationController(JdbcTemplate jdbc, BiometricLiveSync liveSync) {
        this.jdbc = jdbc;
        this.liveSync = liveSync;
    }

    @GetMapping
    public Map<String, Object> list(HttpServletRequest http) {
        SessionUser user = AuthInterceptor.currentUser(http);
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "You must be logged in to do that.");
        }
        String role = user.role();
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> items = new ArrayList<>();

        // Biometric scanner offline (live sync on, but not connected).
        if ((SystemModule.DAILY_TIME_RECORD.allows(role) || SystemModule.UTILITY.allows(role))
                && liveSync.isEnabled() && !liveSync.isConnected()) {
            items.add(item("scanner-offline-" + today, "bi-fingerprint", "danger", "Biometric scanner is offline",
                    "Time ins and outs aren't coming in. Check that the K40 is on and connected to the Wi-Fi.",
                    SystemModule.UTILITY.allows(role) ? "biometric-devices.html" : "dtr.html?section=biometric"));
        }

        // Leave requests waiting for approval.
        if (SystemModule.MAINTENANCE.allows(role)) {
            int leaves = count("SELECT COUNT(*) FROM employee_leave WHERE status = 'Pending'");
            if (leaves > 0) {
                items.add(item("leave-pending-" + leaves, "bi-calendar-check", "warning",
                        leaves + " leave request" + plural(leaves) + " waiting for approval",
                        "Approve or reject them so payroll counts the days correctly.", "leave-application.html"));
            }
        }

        // Classes checked but not yet approved.
        if (SystemModule.FACULTY_TEACHING_APPROVAL.allows(role)) {
            int pending = count("SELECT COUNT(*) FROM faculty_teaching_attendance WHERE approval_status = 'Pending'");
            if (pending > 0) {
                items.add(item("teaching-pending-" + pending, "bi-person-check", "warning",
                        pending + " class" + (pending == 1 ? "" : "es") + " waiting for approval",
                        "Only approved classes are paid as teaching hours.", "teaching-hours.html"));
            }
        }

        // Classes of the last 14 days (ended) without both classroom checks.
        if (SystemModule.FACULTY_TEACHING_HOURS.allows(role)) {
            Integer unchecked = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM faculty_class_schedule s LEFT JOIN faculty_teaching_attendance a "
                            + "ON a.class_schedule_id = s.class_schedule_id "
                            + "WHERE s.schedule_status = 'Scheduled' AND s.class_date BETWEEN ? AND ? "
                            + "AND TIMESTAMP(s.class_date, s.scheduled_end) < NOW() "
                            + "AND (a.attendance_id IS NULL OR a.approval_status = 'Incomplete')",
                    Integer.class, Date.valueOf(today.minusDays(14)), Date.valueOf(today));
            int n = unchecked == null ? 0 : unchecked;
            if (n > 0) {
                items.add(item("teaching-unchecked-" + n, "bi-clipboard-check", "info",
                        n + " class" + (n == 1 ? "" : "es") + " missing classroom checks",
                        "Classes in the last 14 days without their beginning and ending checks.", "teaching-hours.html"));
            }
        }

        // The last cut-off that has ended: payroll not computed, or not released.
        if (SystemModule.PAYROLL.allows(role)) {
            LocalDate[] last = lastEndedCutoff(today);
            String label = last[0].format(SHORT) + " – " + last[1].format(SHORT) + ", " + last[1].getYear();
            List<String> status = jdbc.queryForList("SELECT status FROM payroll_run WHERE pay_period_start = ? AND pay_period_end = ?",
                    String.class, Date.valueOf(last[0]), Date.valueOf(last[1]));
            if (status.isEmpty()) {
                items.add(item("payroll-none-" + last[0], "bi-calculator", "warning", "Payroll not computed yet",
                        "The " + label + " cut-off has ended. Compute and release its payroll.", "payroll-processing.html"));
            } else if (!status.contains("Released")) {
                items.add(item("payroll-unreleased-" + last[0], "bi-send-check", "warning", "Payroll not released yet",
                        "The " + label + " payroll is computed but not released, so payslips can't be sent.", "payroll-processing.html"));
            }
        }

        // Loan deductions skipped because the pay wasn't enough: payroll not yet
        // released, or released in the last 14 days.
        if (SystemModule.PAYROLL.allows(role)) {
            jdbc.queryForList("SELECT r.payroll_run_id, r.period_label, r.status, COUNT(*) AS employees FROM payroll p "
                    + "JOIN payroll_run r ON r.payroll_run_id = p.payroll_run_id "
                    + "WHERE p.breakdown LIKE '%\"skipped\":true%' "
                    + "AND (r.status <> 'Released' OR r.released_at >= NOW() - INTERVAL 14 DAY) "
                    + "GROUP BY r.payroll_run_id, r.period_label, r.status ORDER BY r.pay_period_start DESC").forEach(r -> {
                int n = ((Number) r.get("employees")).intValue();
                boolean released = "Released".equals(r.get("status"));
                items.add(item("loan-skipped-" + r.get("payroll_run_id") + "-" + n, "bi-exclamation-triangle", "danger",
                        "Loan deduction skipped for " + n + " employee" + plural(n),
                        r.get("period_label") + ": their pay wasn't enough to cover a loan, so it wasn't deducted"
                                + (released ? " and the loan runs one month longer." : ". Check them before releasing."),
                        "payroll-processing.html"));
            });
        }

        // Holidays in the next 7 days.
        if (SystemModule.DASHBOARD.allows(role)) {
            jdbc.queryForList("SELECT holiday_date, holiday_name, holiday_type, double_pay FROM holiday WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date",
                    Date.valueOf(today), Date.valueOf(today.plusDays(7))).forEach(h -> {
                LocalDate d = ((Date) h.get("holiday_date")).toLocalDate();
                long days = ChronoUnit.DAYS.between(today, d);
                String when = days == 0 ? "Today" : days == 1 ? "Tomorrow" : d.format(DAY);
                boolean doublePay = Boolean.TRUE.equals(h.get("double_pay")) || Integer.valueOf(1).equals(h.get("double_pay"));
                items.add(item("holiday-" + d, "bi-calendar-event", "info", when + ": " + h.get("holiday_name"),
                        h.get("holiday_type") + (doublePay ? " · double pay for hours worked" : ""), null));
            });
        }

        return Map.of("success", true, "notifications", items);
    }

    // ---------------------------------------------------------------

    /** The most recent cut-off (11th–25th or 26th–10th) that ended before today. */
    static LocalDate[] lastEndedCutoff(LocalDate today) {
        LocalDate start = today.getDayOfMonth() >= 26 ? today.withDayOfMonth(26)
                : today.getDayOfMonth() >= 11 ? today.withDayOfMonth(11)
                : today.minusMonths(1).withDayOfMonth(26);
        LocalDate prevEnd = start.minusDays(1);
        LocalDate prevStart = prevEnd.getDayOfMonth() == 25 ? prevEnd.withDayOfMonth(11)
                : prevEnd.minusMonths(1).withDayOfMonth(26);
        return new LocalDate[] {prevStart, prevEnd};
    }

    private int count(String sql) {
        Integer n = jdbc.queryForObject(sql, Integer.class);
        return n == null ? 0 : n;
    }

    private static String plural(int n) {
        return n == 1 ? "" : "s";
    }

    private static Map<String, Object> item(String id, String icon, String level, String title, String text, String href) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("icon", icon);
        m.put("level", level);
        m.put("title", title);
        m.put("text", text);
        m.put("href", href);
        return m;
    }
}
