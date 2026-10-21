package com.stibalayan.payroll.audit;

import java.sql.Timestamp;
import java.time.LocalDate;
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

    /**
     * Audit Trail page: entries in a date range (inclusive), newest first,
     * optionally for one module and one user, and containing a text (in the
     * action or details). At most `limit` entries; "total" says how many matched.
     */
    public Map<String, Object> search(LocalDate from, LocalDate to, String module, Integer userId,
                                      String text, int limit) {
        StringBuilder where = new StringBuilder(" WHERE a.created_at >= ? AND a.created_at < ?");
        List<Object> args = new ArrayList<>();
        args.add(Timestamp.valueOf(from.atStartOfDay()));
        args.add(Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
        if (module != null && !module.isBlank()) {
            where.append(" AND a.module = ?");
            args.add(module);
        }
        if (userId != null) {
            where.append(" AND a.user_id = ?");
            args.add(userId);
        }
        if (text != null && !text.isBlank()) {
            where.append(" AND (a.action LIKE ? OR a.details LIKE ?)");
            String like = "%" + text.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like);
            args.add(like);
        }
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM audit_trail a" + where, Integer.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(limit);
        List<Map<String, Object>> entries = new ArrayList<>();
        jdbc.query("SELECT a.module, a.action, a.details, a.created_at, u.email, "
                + "TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name "
                + "FROM audit_trail a LEFT JOIN users u ON u.user_id = a.user_id" + where
                + " ORDER BY a.created_at DESC, a.audit_id DESC LIMIT ?", (RowCallbackHandler) rs -> {
            Map<String, Object> m = new LinkedHashMap<>();
            Timestamp at = rs.getTimestamp("created_at");
            m.put("at", at == null ? null : at.toLocalDateTime().toString());
            String name = rs.getString("user_name");
            m.put("user", name == null || name.isBlank() ? "System" : name);
            m.put("email", rs.getString("email"));
            m.put("module", rs.getString("module"));
            m.put("action", rs.getString("action"));
            m.put("details", rs.getString("details"));
            entries.add(m);
        }, pageArgs.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total == null ? 0 : total);
        result.put("entries", entries);
        return result;
    }

    /** Choices for the Audit Trail filters: modules in the log, and users who appear in it. */
    public Map<String, Object> filters() {
        List<String> modules = jdbc.queryForList("SELECT DISTINCT module FROM audit_trail ORDER BY module", String.class);
        List<Map<String, Object>> users = new ArrayList<>();
        jdbc.query("SELECT DISTINCT u.user_id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS name, u.role "
                + "FROM audit_trail a JOIN users u ON u.user_id = a.user_id ORDER BY name", (RowCallbackHandler) rs -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", rs.getInt("user_id"));
            m.put("name", rs.getString("name"));
            m.put("role", rs.getString("role"));
            users.add(m);
        });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("modules", modules);
        result.put("users", users);
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
