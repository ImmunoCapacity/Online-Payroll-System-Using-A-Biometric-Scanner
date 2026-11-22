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
 * Employee Types in Maintenance: the choices offered for an employee's
 * Employee Type in Employee Records.
 *
 * Three built-in types (Faculty, Admin, Faculty/Admin) drive real pay-rule
 * differences (which table an employee lives in, teaching hours vs office
 * hours, rate kinds) and that behavior is fixed in code by type_code — it
 * never changes. Only their display name is renamable (table
 * built_in_employee_type); the rename shows up everywhere the type is shown
 * to a user (Employee Records, DTR, reports, etc. — see
 * PayrollProLayout.staffTypeLabel on the frontend and GET .../labels below).
 *
 * Beyond those three, a Payroll Master can add more "Admin-like" types
 * (table employee_type) — an employee with one of these lives in admin_staff
 * like a plain Admin (office hours/rate, no teaching fields), labelled by
 * admin_staff.staff_role. These can be freely renamed and removed (while
 * unused).
 *
 * GET    /api/employee-types          [{ id, name, employees, builtIn }] — the three
 *                                      built-ins (fixed negative ids) come first.
 * GET    /api/employee-types/labels    { "Faculty": "...", "Admin": "...", "Faculty/Admin": "..." }
 *                                      — current display names, readable by every role.
 * POST   /api/employee-types          { name }  add a (non-built-in) type
 * PUT    /api/employee-types/{id}     { name }  rename — built-ins rename only their display
 *                                      name; a positive id also moves existing employees over.
 * DELETE /api/employee-types/{id}     remove a non-built-in type no employee has
 */
@RestController
@RequestMapping("/api/employee-types")
@RequireModule(SystemModule.MAINTENANCE)
public class EmployeeTypeController {

    private static final String USAGE = "(SELECT COUNT(*) FROM admin_staff a WHERE a.staff_role = t.type_name)";

    /** Fixed negative ids for the three built-in types, so they can be addressed through the same rename endpoint. */
    private static final Map<Integer, String> BUILT_IN_CODES = Map.of(-1, "Faculty", -2, "Admin", -3, "Faculty/Admin");

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public EmployeeTypeController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "types", types());
    }

    /** Every role needs this to show an employee's type correctly — not gated to Maintenance. */
    @GetMapping("/labels")
    @RequireModule(SystemModule.EMPLOYEE_TYPE_LABELS_READ)
    public Map<String, Object> labels() {
        Map<String, String> labels = new LinkedHashMap<>();
        jdbc.query("SELECT type_code, display_name FROM built_in_employee_type",
                (rs, i) -> labels.put(rs.getString("type_code"), rs.getString("display_name")));
        return Map.of("success", true, "labels", labels);
    }

    /**
     * Every type an "Employee Type" filter dropdown should offer: the three
     * built-ins (value = fixed code, label = current display name) followed
     * by every type added in Maintenance (value = label = its name). Every
     * role needs this to filter correctly — not gated to Maintenance.
     */
    @GetMapping("/options")
    @RequireModule(SystemModule.EMPLOYEE_TYPE_LABELS_READ)
    public Map<String, Object> options() {
        List<Map<String, String>> options = new ArrayList<>();
        for (String code : List.of("Faculty", "Admin", "Faculty/Admin")) {
            options.add(Map.of("value", code, "label", builtInLabel(code)));
        }
        jdbc.queryForList("SELECT type_name FROM employee_type ORDER BY type_name", String.class)
                .forEach(name -> options.add(Map.of("value", name, "label", name)));
        return Map.of("success", true, "options", options);
    }

    @PostMapping
    @Transactional
    public Map<String, Object> add(@RequestBody Map<String, Object> body, HttpServletRequest http) {
        String name = name(str(body.get("name")), null);
        jdbc.update("INSERT INTO employee_type (type_name) VALUES (?)", name);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Types", "Added", name);
        return Map.of("success", true, "types", types());
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> rename(@PathVariable int id, @RequestBody Map<String, Object> body, HttpServletRequest http) {
        if (id < 0) {
            String code = builtInCode(id);
            String old = builtInLabel(code);
            String name = name(str(body.get("name")), id);
            jdbc.update("UPDATE built_in_employee_type SET display_name = ? WHERE type_code = ?", name, code);
            audit.log(AuthInterceptor.currentUser(http).id(), "Employee Types", "Renamed", old + " → " + name);
            return Map.of("success", true, "types", types());
        }
        String old = find(id);
        String name = name(str(body.get("name")), id);
        jdbc.update("UPDATE employee_type SET type_name = ? WHERE type_id = ?", name, id);
        // Employees store the type by name, so they follow the rename.
        jdbc.update("UPDATE admin_staff SET staff_role = ? WHERE staff_role = ?", name, old);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Types", "Renamed", old + " → " + name);
        return Map.of("success", true, "types", types());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> remove(@PathVariable int id, HttpServletRequest http) {
        if (id < 0) {
            throw new ApiException(HttpStatus.CONFLICT, "Built-in staff types can't be removed.");
        }
        String name = find(id);
        Integer used = jdbc.queryForObject("SELECT " + USAGE + " FROM employee_type t WHERE t.type_id = ?", Integer.class, id);
        if (used != null && used > 0) {
            throw new ApiException(HttpStatus.CONFLICT, name + " can't be removed: " + used + " employee"
                    + (used == 1 ? " has" : "s have") + " this type. Change their type in Employee Records first.");
        }
        jdbc.update("DELETE FROM employee_type WHERE type_id = ?", id);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Types", "Removed", name);
        return Map.of("success", true, "types", types());
    }

    // ---------------------------------------------------------------

    private List<Map<String, Object>> types() {
        List<Map<String, Object>> result = new ArrayList<>();
        result.add(builtInRow(-1, "Faculty", "SELECT COUNT(*) FROM faculty_staff"));
        result.add(builtInRow(-2, "Admin", "SELECT COUNT(*) FROM admin_staff WHERE is_faculty = 0 AND staff_role IS NULL"));
        result.add(builtInRow(-3, "Faculty/Admin", "SELECT COUNT(*) FROM admin_staff WHERE is_faculty = 1"));
        result.addAll(jdbc.query("SELECT t.type_id, t.type_name, " + USAGE + " AS used FROM employee_type t ORDER BY t.type_name",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getInt("type_id"));
                    m.put("name", rs.getString("type_name"));
                    m.put("employees", rs.getInt("used"));
                    m.put("builtIn", false);
                    return m;
                }));
        return result;
    }

    /** A built-in staff type row: its current (renamable) display name and how many employees have it. */
    private Map<String, Object> builtInRow(int id, String code, String countSql) {
        Integer count = jdbc.queryForObject(countSql, Integer.class);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("name", builtInLabel(code));
        m.put("employees", count == null ? 0 : count);
        m.put("builtIn", true);
        return m;
    }

    private String builtInLabel(String code) {
        List<String> names = jdbc.queryForList(
                "SELECT display_name FROM built_in_employee_type WHERE type_code = ?", String.class, code);
        return names.isEmpty() ? code : names.get(0);
    }

    private String builtInCode(int id) {
        String code = BUILT_IN_CODES.get(id);
        if (code == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Employee type not found.");
        }
        return code;
    }

    private String find(int id) {
        List<String> names = jdbc.queryForList("SELECT type_name FROM employee_type WHERE type_id = ?", String.class, id);
        if (names.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Employee type not found.");
        }
        return names.get(0);
    }

    /**
     * 1–20 characters (the column size), unique (ignoring case) among both
     * the built-in display names and the other employee types, whichever
     * one this isn't.
     */
    private String name(String value, Integer currentId) {
        String name = Validation.requiredText(value, "name", "Employee type", 20).replaceAll("\\s+", " ");
        Integer takenBuiltIn = jdbc.queryForObject("SELECT COUNT(*) FROM built_in_employee_type WHERE LOWER(display_name) = LOWER(?)"
                + (currentId == null || currentId >= 0 ? "" : " AND type_code <> '" + BUILT_IN_CODES.get(currentId) + "'"),
                Integer.class, name);
        Integer takenOther = jdbc.queryForObject("SELECT COUNT(*) FROM employee_type WHERE LOWER(type_name) = LOWER(?)"
                + (currentId == null || currentId < 0 ? "" : " AND type_id <> " + currentId), Integer.class, name);
        if ((takenBuiltIn != null && takenBuiltIn > 0) || (takenOther != null && takenOther > 0)) {
            throw Validation.invalid("name", name + " already exists.");
        }
        return name;
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
