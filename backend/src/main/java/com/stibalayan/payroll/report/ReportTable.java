package com.stibalayan.payroll.report;

import java.math.BigDecimal;
import java.util.List;

/**
 * A report as shown on the Reports page, sent back for export: the title,
 * the filter lines under it, the columns and the raw cell values.
 *
 * kind of a column: "text", "money" (two decimals) or "number".
 * Cells of money and number columns are numbers (or null); totals has one
 * entry per column, null where the column has no total.
 */
public record ReportTable(String format,
                          String title,
                          List<String> subtitle,
                          List<Column> columns,
                          List<List<Object>> rows,
                          List<Object> totals) {

    public record Column(String label, String kind) {

        public boolean isMoney() {
            return "money".equals(kind);
        }

        public boolean isNumeric() {
            return "money".equals(kind) || "number".equals(kind);
        }
    }

    /** A numeric cell as a BigDecimal, or null when it is blank or not a number. */
    public static BigDecimal number(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(value.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static String text(Object value) {
        return value == null ? "" : value.toString();
    }
}
