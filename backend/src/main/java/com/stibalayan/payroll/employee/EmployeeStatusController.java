package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
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
 * Employee Status in Maintenance: the choices offered for an employee's
 * Employment Status in Employee Records, beyond the three built-ins —
 * Active, On Leave and Archived — which drive real behavior (On Leave is set
 * automatically when a leave period covers today, see
 * EmployeeService.markOnLeaveIfCurrent; Archived sets is_archived) and so
 * aren't managed here. The rest (Inactive, Resigned, Terminated, and any the
 * Payroll Master adds) are plain labels, freely renamed and removed while
 * unused — table employee_status.
 *
 * GET    /api/employee-statuses          [{ id, name, employees, builtIn }] — the three
 *                                        built-ins (id null, builtIn true) come first.
 * POST   /api/employee-statuses          { name }  add a status
 * PUT    /api/employee-statuses/{id}     { name }  rename; employees with the old name get the new one
 * DELETE /api/employee-statuses/{id}     remove a status no employee has
 */
@RestController
@RequestMapping("/api/employee-statuses")
@RequireModule(SystemModule.MAINTENANCE)
public class EmployeeStatusController {

    private static final String USAGE = "(SELECT COUNT(*) FROM faculty_staff f WHERE f.employment_status = s.status_name)"
            + " + (SELECT COUNT(*) FROM admin_staff a WHERE a.employment_status = s.status_name)";

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public EmployeeStatusController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "statuses", statuses());
    }

    @PostMapping
    @Transactional
    public Map<String, Object> add(@RequestBody Map<String, Object> body, HttpServletRequest http) {
        String name = name(str(body.get("name")), null);
        jdbc.update("INSERT INTO employee_status (status_name) VALUES (?)", name);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Status", "Added", name);
        return Map.of("success", true, "statuses", statuses());
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> rename(@PathVariable int id, @RequestBody Map<String, Object> body, HttpServletRequest http) {
        String old = find(id);
        String name = name(str(body.get("name")), id);
        jdbc.update("UPDATE employee_status SET status_name = ? WHERE status_id = ?", name, id);
        // Employees store the status by name, so they follow the rename.
        jdbc.update("UPDATE faculty_staff SET employment_status = ? WHERE employment_status = ?", name, old);
        jdbc.update("UPDATE admin_staff SET employment_status = ? WHERE employment_status = ?", name, old);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Status", "Renamed", old + " → " + name);
        return Map.of("success", true, "statuses", statuses());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> remove(@PathVariable int id, HttpServletRequest http) {
        String name = find(id);
        Integer used = jdbc.queryForObject("SELECT " + USAGE + " FROM employee_status s WHERE s.status_id = ?", Integer.class, id);
        if (used != null && used > 0) {
            throw new ApiException(HttpStatus.CONFLICT, name + " can't be removed: " + used + " employee"
                    + (used == 1 ? " has" : "s have") + " this status. Change their status in Employee Records first.");
        }
        jdbc.update("DELETE FROM employee_status WHERE status_id = ?", id);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Status", "Removed", name);
        return Map.of("success", true, "statuses", statuses());
    }

    // ---------------------------------------------------------------

    private List<Map<String, Object>> statuses() {
        List<Map<String, Object>> result = new ArrayList<>();
        result.add(builtIn("Active"));
        result.add(builtIn("On Leave"));
        result.add(builtIn("Archived"));
        result.addAll(jdbc.query("SELECT s.status_id, s.status_name, " + USAGE + " AS used FROM employee_status s ORDER BY s.status_name",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getInt("status_id"));
                    m.put("name", rs.getString("status_name"));
                    m.put("employees", rs.getInt("used"));
                    m.put("builtIn", false);
                    return m;
                }));
        return result;
    }

    /** A built-in status, shown for reference only: how many employees currently have it. */
    private Map<String, Object> builtIn(String name) {
        Integer count = jdbc.queryForObject(
                "SELECT (SELECT COUNT(*) FROM faculty_staff WHERE employment_status = ?) "
                        + "+ (SELECT COUNT(*) FROM admin_staff WHERE employment_status = ?)",
                Integer.class, name, name);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", null);
        m.put("name", name);
        m.put("employees", count == null ? 0 : count);
        m.put("builtIn", true);
        return m;
    }

    private String find(int id) {
        List<String> names = jdbc.queryForList("SELECT status_name FROM employee_status WHERE status_id = ?", String.class, id);
        if (names.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Employee status not found.");
        }
        return names.get(0);
    }

    /** 1–20 characters (the column size), unique ignoring case, and not one of the built-in statuses. */
    private String name(String value, Integer currentId) {
        String name = Validation.requiredText(value, "name", "Employee status", 20).replaceAll("\\s+", " ");
        if (name.equalsIgnoreCase("Active") || name.equalsIgnoreCase("On Leave") || name.equalsIgnoreCase("Archived")) {
            throw Validation.invalid("name", name + " is already a built-in status.");
        }
        Integer taken = jdbc.queryForObject("SELECT COUNT(*) FROM employee_status WHERE LOWER(status_name) = LOWER(?)"
                + (currentId == null ? "" : " AND status_id <> " + currentId), Integer.class, name);
        if (taken != null && taken > 0) {
            throw Validation.invalid("name", name + " already exists.");
        }
        return name;
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
