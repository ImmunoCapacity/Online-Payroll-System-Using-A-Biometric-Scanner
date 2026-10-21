package com.stibalayan.payroll.holiday;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Date;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Philippine holidays (table holiday): Maintenance → Holiday Calendar, and
 * marked on the Dashboard calendar. A double-pay holiday pays the hours
 * worked that day twice (PayrollHoursService).
 *
 * GET    /api/holidays?year=2026  [{ id, date, name, type, doublePay }] in date order
 * POST   /api/holidays            { date, name, type, doublePay }  add
 * PUT    /api/holidays/{id}       { date, name, type, doublePay }  change
 * DELETE /api/holidays/{id}       remove
 */
@RestController
@RequestMapping("/api/holidays")
@RequireModule(SystemModule.MAINTENANCE)
public class HolidayController {

    private static final String MODULE = "Holiday Calendar";
    private static final Set<String> TYPES = Set.of("Regular Holiday", "Special Non-Working Day", "Special Working Day");

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public HolidayController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    @RequireModule(SystemModule.DASHBOARD)
    public Map<String, Object> list(@RequestParam String year) {
        int y = year != null && year.matches("\\d{4}") ? Integer.parseInt(year) : 0;
        if (y < 1950 || y > 2100) {
            throw Validation.invalid("year", "Year must be between 1950 and 2100.");
        }
        return Map.of("success", true, "holidays", holidays(y));
    }

    @PostMapping
    @Transactional
    public Map<String, Object> add(@RequestBody Map<String, Object> body, HttpServletRequest http) {
        Holiday h = holiday(body, null);
        jdbc.update("INSERT INTO holiday (holiday_date, holiday_name, holiday_type, double_pay) VALUES (?, ?, ?, ?)",
                Date.valueOf(h.date), h.name, h.type, h.doublePay);
        audit.log(AuthInterceptor.currentUser(http).id(), MODULE, "Added", h.describe());
        return Map.of("success", true, "holidays", holidays(h.date.getYear()));
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> change(@PathVariable int id, @RequestBody Map<String, Object> body, HttpServletRequest http) {
        Holiday old = find(id);
        Holiday h = holiday(body, id);
        jdbc.update("UPDATE holiday SET holiday_date = ?, holiday_name = ?, holiday_type = ?, double_pay = ? WHERE holiday_id = ?",
                Date.valueOf(h.date), h.name, h.type, h.doublePay, id);
        audit.log(AuthInterceptor.currentUser(http).id(), MODULE, "Updated", old.describe() + " → " + h.describe());
        return Map.of("success", true, "holidays", holidays(h.date.getYear()));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> remove(@PathVariable int id, HttpServletRequest http) {
        Holiday h = find(id);
        jdbc.update("DELETE FROM holiday WHERE holiday_id = ?", id);
        audit.log(AuthInterceptor.currentUser(http).id(), MODULE, "Removed", h.describe());
        return Map.of("success", true, "holidays", holidays(h.date.getYear()));
    }

    // ---------------------------------------------------------------

    private record Holiday(LocalDate date, String name, String type, boolean doublePay) {
        String describe() {
            return name + " (" + date + ", " + type + (doublePay ? ", double pay" : "") + ")";
        }
    }

    private List<Map<String, Object>> holidays(int year) {
        return jdbc.query("SELECT holiday_id, holiday_date, holiday_name, holiday_type, double_pay FROM holiday "
                        + "WHERE YEAR(holiday_date) = ? ORDER BY holiday_date",
                (ResultSet rs, int i) -> {
                    Map<String, Object> h = new LinkedHashMap<>();
                    h.put("id", rs.getInt("holiday_id"));
                    h.put("date", rs.getDate("holiday_date").toLocalDate().toString());
                    h.put("name", rs.getString("holiday_name"));
                    h.put("type", rs.getString("holiday_type"));
                    h.put("doublePay", rs.getBoolean("double_pay"));
                    return h;
                }, year);
    }

    private Holiday find(int id) {
        List<Holiday> found = jdbc.query("SELECT holiday_date, holiday_name, holiday_type, double_pay FROM holiday WHERE holiday_id = ?",
                (rs, i) -> new Holiday(rs.getDate("holiday_date").toLocalDate(), rs.getString("holiday_name"),
                        rs.getString("holiday_type"), rs.getBoolean("double_pay")), id);
        if (found.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Holiday not found.");
        }
        return found.get(0);
    }

    /** Date (one holiday per date), name (1–100 characters), one of the three types. */
    private Holiday holiday(Map<String, Object> body, Integer currentId) {
        LocalDate date = Validation.date(text(body.get("date")), "date", "Date", true);
        if (date.getYear() < 1950 || date.getYear() > 2100) {
            throw Validation.invalid("date", "Date must be between 1950 and 2100.");
        }
        String name = Validation.requiredText(text(body.get("name")), "name", "Holiday name", 100).replaceAll("\\s+", " ");
        String type = text(body.get("type"));
        if (type == null || !TYPES.contains(type)) {
            throw Validation.invalid("type", "Choose the holiday type.");
        }
        List<String> taken = jdbc.queryForList("SELECT holiday_name FROM holiday WHERE holiday_date = ?"
                + (currentId == null ? "" : " AND holiday_id <> " + currentId), String.class, Date.valueOf(date));
        if (!taken.isEmpty()) {
            throw Validation.invalid("date", taken.get(0) + " is already on this date.");
        }
        return new Holiday(date, name, type, Boolean.TRUE.equals(body.get("doublePay")));
    }

    private static String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
