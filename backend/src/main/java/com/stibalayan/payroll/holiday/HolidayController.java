package com.stibalayan.payroll.holiday;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.Validation;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Philippine holidays (table holiday), marked on the Dashboard calendar.
 *
 * GET /api/holidays?year=2026   [{ date, name, type }] in date order
 */
@RestController
@RequestMapping("/api/holidays")
@RequireModule(SystemModule.DASHBOARD)
public class HolidayController {

    private final JdbcTemplate jdbc;

    public HolidayController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam String year) {
        int y = year != null && year.matches("\\d{4}") ? Integer.parseInt(year) : 0;
        if (y < 1950 || y > 2100) {
            throw Validation.invalid("year", "Year must be between 1950 and 2100.");
        }
        List<Map<String, Object>> holidays = jdbc.query(
                "SELECT holiday_date, holiday_name, holiday_type FROM holiday WHERE YEAR(holiday_date) = ? ORDER BY holiday_date",
                (ResultSet rs, int i) -> {
                    Map<String, Object> h = new LinkedHashMap<>();
                    h.put("date", rs.getDate("holiday_date").toLocalDate().toString());
                    h.put("name", rs.getString("holiday_name"));
                    h.put("type", rs.getString("holiday_type"));
                    return h;
                }, y);
        return Map.of("success", true, "holidays", holidays);
    }
}
