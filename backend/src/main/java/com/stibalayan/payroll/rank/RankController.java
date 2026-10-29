package com.stibalayan.payroll.rank;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import org.springframework.web.bind.annotation.RestController;

/**
 * Instructor ranks (table employee_rank) in Maintenance — the choices for an
 * employee's Instructor Rank (Employee Records).
 *
 * GET    /api/ranks          [{ id, name, employees }] (employees = how many have this rank)
 * POST   /api/ranks          { name }  add a rank
 * PUT    /api/ranks/{id}     { name }  rename; employees with the old name get the new one
 * DELETE /api/ranks/{id}     remove a rank no employee has
 */
@RestController
@RequestMapping("/api/ranks")
@RequireModule(SystemModule.MAINTENANCE)
public class RankController {

    private static final String USAGE = "(SELECT COUNT(*) FROM faculty_staff f WHERE f.instructor_rank = r.rank_name)"
            + " + (SELECT COUNT(*) FROM admin_staff a WHERE a.instructor_rank = r.rank_name)";

    private static final BigDecimal MAX_RATE = new BigDecimal("100000.00");

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public RankController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "ranks", ranks());
    }

    @PostMapping
    @Transactional
    public Map<String, Object> add(@RequestBody Map<String, Object> body, HttpServletRequest http) {
        String name = name(str(body.get("name")), null);
        BigDecimal rate = rate(body.get("ratePerHour"));
        jdbc.update("INSERT INTO employee_rank (rank_name, rate_per_hour) VALUES (?, ?)", name, rate);
        audit.log(AuthInterceptor.currentUser(http).id(), "Instructor Ranks", "Added", name);
        return Map.of("success", true, "ranks", ranks());
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> rename(@PathVariable int id, @RequestBody Map<String, Object> body, HttpServletRequest http) {
        String old = find(id);
        String name = name(str(body.get("name")), id);
        BigDecimal rate = rate(body.get("ratePerHour"));
        jdbc.update("UPDATE employee_rank SET rank_name = ?, rate_per_hour = ? WHERE rank_id = ?", name, rate, id);
        // Employees store the rank by name, so they follow the rename.
        jdbc.update("UPDATE faculty_staff SET instructor_rank = ? WHERE instructor_rank = ?", name, old);
        jdbc.update("UPDATE admin_staff SET instructor_rank = ? WHERE instructor_rank = ?", name, old);
        audit.log(AuthInterceptor.currentUser(http).id(), "Instructor Ranks", "Renamed", old + " → " + name);
        return Map.of("success", true, "ranks", ranks());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> remove(@PathVariable int id, HttpServletRequest http) {
        String name = find(id);
        Integer used = jdbc.queryForObject("SELECT " + USAGE + " FROM employee_rank r WHERE r.rank_id = ?", Integer.class, id);
        if (used != null && used > 0) {
            throw new ApiException(HttpStatus.CONFLICT, name + " can't be removed: " + used + " employee"
                    + (used == 1 ? " has" : "s have") + " this rank. Change their rank in Employee Records first.");
        }
        jdbc.update("DELETE FROM employee_rank WHERE rank_id = ?", id);
        audit.log(AuthInterceptor.currentUser(http).id(), "Instructor Ranks", "Removed", name);
        return Map.of("success", true, "ranks", ranks());
    }

    // ---------------------------------------------------------------

    private List<Map<String, Object>> ranks() {
        return jdbc.query("SELECT r.rank_id, r.rank_name, r.rate_per_hour, " + USAGE + " AS used FROM employee_rank r ORDER BY r.rank_name",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getInt("rank_id"));
                    m.put("name", rs.getString("rank_name"));
                    m.put("ratePerHour", rs.getBigDecimal("rate_per_hour"));
                    m.put("employees", rs.getInt("used"));
                    return m;
                });
    }

    private String find(int id) {
        List<String> names = jdbc.queryForList("SELECT rank_name FROM employee_rank WHERE rank_id = ?", String.class, id);
        if (names.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Rank not found.");
        }
        return names.get(0);
    }

    /** 1–20 characters (the column size), unique ignoring case. */
    private String name(String value, Integer currentId) {
        String name = Validation.requiredText(value, "name", "Rank name", 20).replaceAll("\\s+", " ");
        Integer taken = jdbc.queryForObject("SELECT COUNT(*) FROM employee_rank WHERE LOWER(rank_name) = LOWER(?)"
                + (currentId == null ? "" : " AND rank_id <> " + currentId), Integer.class, name);
        if (taken != null && taken > 0) {
            throw Validation.invalid("name", name + " already exists.");
        }
        return name;
    }

    /** Optional standard rate per hour, prefilled into Employee Records when this rank is picked. */
    private BigDecimal rate(Object value) {
        if (value == null || String.valueOf(value).trim().isEmpty()) {
            return null;
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException e) {
            throw Validation.invalid("ratePerHour", "Rate per hour must be a number.");
        }
        amount = Validation.money(amount, "ratePerHour", "Rate per hour", MAX_RATE);
        return amount == null ? null : amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
