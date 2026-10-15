package com.stibalayan.payroll.contribution;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deduction Tables (paper 6.1–6.4): the BIR, PhilHealth, Pag-IBIG and SSS
 * brackets per year, kept in bir_table, philhealth_table, pagibig_table and
 * sss_table. Payroll applies them to the monthly equivalent of pay.
 *
 * Each bracket is sent and returned as { id, min, max, <third>, rate } —
 * the third value is base (BIR), premium (PhilHealth), share (Pag-IBIG) or
 * msc (SSS). max, premium and share may be empty.
 */
@Service
public class ContributionTableService {

    private static final BigDecimal MAX_AMOUNT = new BigDecimal("100000000");
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    /** One table: its name in the database and the column behind each field. */
    record Table(String key, String label, String sqlTable, String idColumn, String minColumn, String maxColumn,
                 String thirdKey, String thirdLabel, String thirdColumn, boolean thirdOptional, String rateColumn) {
    }

    private static final Map<String, Table> TABLES = new LinkedHashMap<>();

    static {
        add(new Table("bir", "BIR Table", "bir_table", "bir_id", "bracket_min", "bracket_max",
                "base", "Base amount", "base_tax", false, "rate_percent"));
        add(new Table("philhealth", "PhilHealth Table", "philhealth_table", "philhealth_id", "salary_min", "salary_max",
                "premium", "Monthly premium", "monthly_premium", true, "rate_percent"));
        add(new Table("pagibig", "Pag-IBIG Table", "pagibig_table", "pagibig_id", "compensation_min", "compensation_max",
                "share", "Employee share", "employee_share", true, "rate_percent"));
        add(new Table("sss", "SSS Table", "sss_table", "sss_id", "compensation_min", "compensation_max",
                "msc", "Monthly salary credit", "monthly_salary_credit", false, "employee_rate_percent"));
    }

    private static void add(Table t) {
        TABLES.put(t.key(), t);
    }

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public ContributionTableService(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public record BracketRequest(Integer year, BigDecimal min, BigDecimal max, BigDecimal base, BigDecimal premium,
                                 BigDecimal share, BigDecimal msc, BigDecimal rate) {

        BigDecimal third(String key) {
            return switch (key) {
                case "base" -> base;
                case "premium" -> premium;
                case "share" -> share;
                default -> msc;
            };
        }
    }

    /** { bir: { "2025": [ ... ], ... }, philhealth: { ... }, pagibig: { ... }, sss: { ... } } */
    @Transactional(readOnly = true)
    public Map<String, Object> all() {
        Map<String, Object> result = new LinkedHashMap<>();
        TABLES.values().forEach(t -> result.put(t.key(), byYear(t)));
        return result;
    }

    @Transactional
    public Map<String, List<Map<String, Object>>> save(String tableKey, Integer id, BracketRequest r, int userId) {
        Table t = table(tableKey);
        int year;
        if (id == null) {
            year = validYear(r.year());
        } else {
            year = yearOf(t, id);
        }
        BigDecimal min = required(Validation.money(r.min(), "min", "Minimum", MAX_AMOUNT), "min", "Minimum");
        BigDecimal max = Validation.money(r.max(), "max", "Maximum", MAX_AMOUNT);
        if (max != null && max.compareTo(min) <= 0) {
            throw Validation.invalid("max", "Max must be greater than min (" + peso(min) + ").");
        }
        BigDecimal third = Validation.money(r.third(t.thirdKey()), t.thirdKey(), t.thirdLabel(), MAX_AMOUNT);
        if (third == null && !t.thirdOptional()) {
            throw Validation.invalid(t.thirdKey(), t.thirdLabel() + " is required.");
        }
        BigDecimal rate = required(Validation.decimal(r.rate(), "rate", "Rate", 2, HUNDRED), "rate", "Rate");

        // Brackets of the same year may not overlap.
        for (Map<String, Object> b : rows(t, year)) {
            if (id != null && id.equals(b.get("id"))) continue;
            BigDecimal bMin = (BigDecimal) b.get("min");
            BigDecimal bMax = (BigDecimal) b.get("max");
            boolean overlaps = (bMax == null || min.compareTo(bMax) < 0) && (max == null || max.compareTo(bMin) > 0);
            if (overlaps) {
                throw Validation.invalid("min", "This range overlaps the " + peso(bMin) + " – "
                        + (bMax == null ? "Above" : peso(bMax)) + " bracket.");
            }
        }

        if (id == null) {
            jdbc.update("INSERT INTO " + t.sqlTable() + " (effective_year, " + t.minColumn() + ", " + t.maxColumn() + ", "
                    + t.thirdColumn() + ", " + t.rateColumn() + ") VALUES (?, ?, ?, ?, ?)", year, min, max, third, rate);
        } else {
            jdbc.update("UPDATE " + t.sqlTable() + " SET " + t.minColumn() + " = ?, " + t.maxColumn() + " = ?, "
                    + t.thirdColumn() + " = ?, " + t.rateColumn() + " = ? WHERE " + t.idColumn() + " = ?",
                    min, max, third, rate, id);
        }
        audit.log(userId, t.label(), id == null ? "Added bracket" : "Updated bracket",
                summary(t, min, max, third, rate) + " (" + year + ")");
        return byYear(t);
    }

    @Transactional
    public Map<String, List<Map<String, Object>>> delete(String tableKey, int id, int userId) {
        Table t = table(tableKey);
        int year = yearOf(t, id);
        Map<String, Object> b = rows(t, year).stream().filter(x -> Integer.valueOf(id).equals(x.get("id")))
                .findFirst().orElseThrow();
        jdbc.update("DELETE FROM " + t.sqlTable() + " WHERE " + t.idColumn() + " = ?", id);
        audit.log(userId, t.label(), "Removed bracket", summary(t, (BigDecimal) b.get("min"), (BigDecimal) b.get("max"),
                (BigDecimal) b.get(t.thirdKey()), (BigDecimal) b.get("rate")) + " (" + year + ")");
        return byYear(t);
    }

    /** Starts a new year with a copy of the latest year's brackets, e.g. when new rates take effect. */
    @Transactional
    public Map<String, List<Map<String, Object>>> copyYear(String tableKey, Integer yearValue, int userId) {
        Table t = table(tableKey);
        int year = validYear(yearValue);
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM " + t.sqlTable() + " WHERE effective_year = ?",
                Integer.class, year);
        if (exists != null && exists > 0) {
            throw Validation.invalid("year", "The " + t.label() + " already has brackets for " + year + ".");
        }
        Integer source = jdbc.queryForObject("SELECT MAX(effective_year) FROM " + t.sqlTable(), Integer.class);
        if (source != null) {
            jdbc.update("INSERT INTO " + t.sqlTable() + " (effective_year, " + t.minColumn() + ", " + t.maxColumn() + ", "
                    + t.thirdColumn() + ", " + t.rateColumn() + ") SELECT ?, " + t.minColumn() + ", " + t.maxColumn()
                    + ", " + t.thirdColumn() + ", " + t.rateColumn() + " FROM " + t.sqlTable() + " WHERE effective_year = ?",
                    year, source);
        }
        audit.log(userId, t.label(), "Added year", year + (source == null ? "" : " (copied from " + source + ")"));
        return byYear(t);
    }

    // ---------------------------------------------------------------

    private Table table(String key) {
        Table t = TABLES.get(key);
        if (t == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Unknown table.");
        }
        return t;
    }

    private static int validYear(Integer year) {
        if (year == null || year < 2000 || year > 2100) {
            throw Validation.invalid("year", "Choose a year from 2000 to 2100.");
        }
        return year;
    }

    private int yearOf(Table t, int id) {
        List<Integer> years = jdbc.queryForList("SELECT effective_year FROM " + t.sqlTable() + " WHERE "
                + t.idColumn() + " = ?", Integer.class, id);
        if (years.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Bracket not found.");
        }
        return years.get(0);
    }

    private Map<String, List<Map<String, Object>>> byYear(Table t) {
        Map<String, List<Map<String, Object>>> years = new TreeMap<>();
        List<Integer> list = jdbc.queryForList("SELECT DISTINCT effective_year FROM " + t.sqlTable(), Integer.class);
        list.forEach(y -> years.put(String.valueOf(y), rows(t, y)));
        return years;
    }

    private List<Map<String, Object>> rows(Table t, int year) {
        List<Map<String, Object>> list = new ArrayList<>();
        jdbc.query("SELECT " + t.idColumn() + ", " + t.minColumn() + ", " + t.maxColumn() + ", " + t.thirdColumn() + ", "
                + t.rateColumn() + " FROM " + t.sqlTable() + " WHERE effective_year = ? ORDER BY " + t.minColumn(), (RowCallbackHandler) rs -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", rs.getInt(1));
            m.put("min", rs.getBigDecimal(2));
            m.put("max", rs.getBigDecimal(3));
            m.put(t.thirdKey(), rs.getBigDecimal(4));
            m.put("rate", rs.getBigDecimal(5));
            list.add(m);
        }, year);
        return list;
    }

    private static BigDecimal required(BigDecimal value, String field, String label) {
        if (value == null) {
            throw Validation.invalid(field, label + " is required.");
        }
        return value;
    }

    private static String peso(BigDecimal n) {
        return "₱" + String.format("%,.2f", n.setScale(2, RoundingMode.HALF_UP));
    }

    private static String summary(Table t, BigDecimal min, BigDecimal max, BigDecimal third, BigDecimal rate) {
        return peso(min) + " – " + (max == null ? "Above" : peso(max)) + ", " + t.thirdLabel().toLowerCase() + " "
                + (third == null ? "computed" : peso(third)) + ", rate " + rate.stripTrailingZeros().toPlainString() + "%";
    }
}
