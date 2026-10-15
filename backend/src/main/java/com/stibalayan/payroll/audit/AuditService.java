package com.stibalayan.payroll.audit;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

/**
 * Audit Trail (Utility 10.3, table audit_trail): who changed what and when.
 * Maintenance tables, employee rates, devices and payroll releases are
 * written here; the System Administrator dashboard reads it.
 */
@Service
public class AuditService {

    private final JdbcTemplate jdbc;

    public AuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void log(Integer userId, String module, String action, String details) {
        jdbc.update("INSERT INTO audit_trail (user_id, module, action, details) VALUES (?, ?, ?, ?)",
                userId, cut(module, 50), cut(action, 100), cut(details, 255));
    }

    /** Most recent entries first; module null = every module. */
    public List<Map<String, Object>> recent(String module, int limit) {
        String sql = "SELECT a.module, a.action, a.details, a.created_at, "
                + "TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name "
                + "FROM audit_trail a LEFT JOIN users u ON u.user_id = a.user_id "
                + (module == null ? "" : "WHERE a.module = ? ")
                + "ORDER BY a.created_at DESC, a.audit_id DESC LIMIT ?";
        Object[] args = module == null ? new Object[] {limit} : new Object[] {module, limit};
        List<Map<String, Object>> result = new ArrayList<>();
        jdbc.query(sql, (RowCallbackHandler) rs -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("section", rs.getString("module"));
            m.put("action", rs.getString("action"));
            m.put("detail", rs.getString("details"));
            String name = rs.getString("user_name");
            m.put("user", name == null || name.isBlank() ? "System" : name);
            Timestamp at = rs.getTimestamp("created_at");
            m.put("at", at == null ? null : at.toLocalDateTime().toString());
            result.add(m);
        }, args);
        return result;
    }

    /** The latest entry of each module, for the "Last change" lines in Maintenance. */
    public Map<String, Object> latest(List<String> modules) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String module : modules) {
            List<Map<String, Object>> one = recent(module, 1);
            result.put(module, one.isEmpty() ? null : one.get(0));
        }
        return result;
    }

    private static String cut(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
