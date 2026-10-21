package com.stibalayan.payroll.report;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * A report as an Excel workbook (.xlsx, Office Open XML written directly,
 * so no spreadsheet library is needed): school name, report title and
 * filters on top, then the table with a filter on the header row, the
 * header frozen while scrolling, amounts stored as numbers in a
 * "₱#,##0.00" format and the totals row as SUM formulas.
 */
@Component
public class ReportXlsx {

    // Cell styles, indexes into cellXfs in STYLES.
    private static final int S_SCHOOL = 1, S_TITLE = 2, S_INFO = 3, S_HEAD = 4, S_HEAD_NUM = 5,
            S_TEXT = 6, S_MONEY = 7, S_NUMBER = 8, S_TOTAL = 9, S_TOTAL_MONEY = 10, S_TOTAL_NUMBER = 11;

    private final String schoolName;

    public ReportXlsx(@Value("${payslip.mail.school-name:}") String schoolName) {
        this.schoolName = schoolName.isBlank() ? "Payroll Office" : schoolName;
    }

    public byte[] render(ReportTable report, List<String> info, String generated) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            put(zip, "[Content_Types].xml", CONTENT_TYPES);
            put(zip, "_rels/.rels", ROOT_RELS);
            put(zip, "docProps/core.xml", core(report.title()));
            put(zip, "xl/workbook.xml", workbook(sheetName(report.title())));
            put(zip, "xl/_rels/workbook.xml.rels", WORKBOOK_RELS);
            put(zip, "xl/styles.xml", STYLES);
            put(zip, "xl/worksheets/sheet1.xml", sheet(report, info, generated));
        } catch (IOException e) {
            throw new IllegalStateException("Could not build the Excel report", e);
        }
        return out.toByteArray();
    }

    private String sheet(ReportTable report, List<String> info, String generated) {
        List<ReportTable.Column> columns = report.columns();
        int cols = columns.size();
        String lastCol = col(cols - 1);
        StringBuilder rows = new StringBuilder();
        StringBuilder merges = new StringBuilder();
        int r = 0;

        // Letterhead and filters, each merged across the table width.
        r++;
        row(rows, r, cell(0, r, str(schoolName), S_SCHOOL));
        merges.append(merge("A" + r + ":" + lastCol + r));
        r++;
        row(rows, r, cell(0, r, str(report.title()), S_TITLE));
        merges.append(merge("A" + r + ":" + lastCol + r));
        for (String line : info) {
            r++;
            row(rows, r, cell(0, r, str(line), S_INFO));
            merges.append(merge("A" + r + ":" + lastCol + r));
        }
        r++; // blank row

        r++;
        int headRow = r;
        StringBuilder head = new StringBuilder();
        for (int i = 0; i < cols; i++) {
            head.append(cell(i, r, str(columns.get(i).label()), columns.get(i).isNumeric() ? S_HEAD_NUM : S_HEAD));
        }
        row(rows, r, head);

        int firstData = r + 1;
        for (List<Object> values : report.rows()) {
            r++;
            StringBuilder line = new StringBuilder();
            for (int i = 0; i < cols; i++) {
                ReportTable.Column c = columns.get(i);
                Object value = i < values.size() ? values.get(i) : null;
                if (c.isNumeric()) {
                    BigDecimal n = ReportTable.number(value);
                    line.append(n == null ? cell(i, r, "", c.isMoney() ? S_MONEY : S_NUMBER)
                            : cell(i, r, "<v>" + n.toPlainString() + "</v>", c.isMoney() ? S_MONEY : S_NUMBER));
                } else {
                    line.append(cell(i, r, str(ReportTable.text(value)), S_TEXT));
                }
            }
            row(rows, r, line);
        }
        int lastData = r;

        List<Object> totals = report.totals();
        if (totals != null && !totals.isEmpty() && !report.rows().isEmpty()) {
            r++;
            StringBuilder line = new StringBuilder();
            boolean labelled = false;
            for (int i = 0; i < cols; i++) {
                ReportTable.Column c = columns.get(i);
                Object value = i < totals.size() ? totals.get(i) : null;
                BigDecimal n = ReportTable.number(value);
                if (n != null && c.isNumeric()) {
                    String range = col(i) + firstData + ":" + col(i) + lastData;
                    line.append(cell(i, r, "<f>SUM(" + range + ")</f><v>" + n.toPlainString() + "</v>",
                            c.isMoney() ? S_TOTAL_MONEY : S_TOTAL_NUMBER));
                } else if (!labelled) {
                    line.append(cell(i, r, str("TOTAL"), S_TOTAL));
                    labelled = true;
                } else {
                    line.append(cell(i, r, "", S_TOTAL));
                }
            }
            row(rows, r, line);
        }

        // Who exported it and when, small, under the table.
        r += 2;
        row(rows, r, cell(0, r, str(generated), S_INFO));
        merges.append(merge("A" + r + ":" + lastCol + r));

        StringBuilder widths = new StringBuilder("<cols>");
        float[] weights = ReportExportController.weights(report);
        for (int i = 0; i < cols; i++) {
            double w = Math.max(10, Math.min(45, weights[i] * 1.25 + 3));
            widths.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1)
                    .append("\" width=\"").append(w).append("\" customWidth=\"1\"/>");
        }
        widths.append("</cols>");

        String autoFilter = report.rows().isEmpty() ? ""
                : "<autoFilter ref=\"A" + headRow + ":" + lastCol + lastData + "\"/>";
        return XML
                + "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\""
                + " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">"
                + "<sheetPr><pageSetUpPr fitToPage=\"1\"/></sheetPr>"
                + "<sheetViews><sheetView workbookViewId=\"0\" showGridLines=\"0\">"
                + "<pane ySplit=\"" + headRow + "\" topLeftCell=\"A" + (headRow + 1) + "\" activePane=\"bottomLeft\" state=\"frozen\"/>"
                + "</sheetView></sheetViews>"
                + "<sheetFormatPr defaultRowHeight=\"15\"/>"
                + widths
                + "<sheetData>" + rows + "</sheetData>"
                + autoFilter
                + "<mergeCells>" + merges + "</mergeCells>"
                + "<printOptions horizontalCentered=\"1\"/>"
                + "<pageMargins left=\"0.4\" right=\"0.4\" top=\"0.5\" bottom=\"0.5\" header=\"0.3\" footer=\"0.3\"/>"
                + "<pageSetup orientation=\"" + (cols > 6 ? "landscape" : "portrait") + "\" fitToWidth=\"1\" fitToHeight=\"0\"/>"
                + "</worksheet>";
    }

    // ---------------------------------------------------------------

    private static void row(StringBuilder rows, int r, CharSequence cells) {
        rows.append("<row r=\"").append(r).append("\">").append(cells).append("</row>");
    }

    /** content is "" (styled blank), &lt;is&gt;…&lt;/is&gt; text or &lt;v&gt;/&lt;f&gt; number. */
    private static String cell(int c, int r, String content, int style) {
        String ref = col(c) + r;
        if (content.isEmpty()) {
            return "<c r=\"" + ref + "\" s=\"" + style + "\"/>";
        }
        String type = content.startsWith("<is>") ? " t=\"inlineStr\"" : "";
        return "<c r=\"" + ref + "\" s=\"" + style + "\"" + type + ">" + content + "</c>";
    }

    private static String str(String text) {
        return "<is><t xml:space=\"preserve\">" + esc(text) + "</t></is>";
    }

    private static String merge(String ref) {
        return "<mergeCell ref=\"" + ref + "\"/>";
    }

    static String col(int index) {
        StringBuilder s = new StringBuilder();
        for (int n = index + 1; n > 0; n = (n - 1) / 26) {
            s.insert(0, (char) ('A' + (n - 1) % 26));
        }
        return s.toString();
    }

    private static String esc(String s) {
        StringBuilder b = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '&' -> b.append("&amp;");
                case '<' -> b.append("&lt;");
                case '>' -> b.append("&gt;");
                case '"' -> b.append("&quot;");
                default -> {
                    if (ch >= 0x20 || ch == '\t' || ch == '\n') {
                        b.append(ch);
                    }
                }
            }
        }
        return b.toString();
    }

    /** Excel sheet names: at most 31 characters, none of []:*?/\ */
    private static String sheetName(String title) {
        String s = title.replaceAll("[\\[\\]:*?/\\\\]", " ").trim();
        return s.isEmpty() ? "Report" : s.length() > 31 ? s.substring(0, 31).trim() : s;
    }

    private static void put(ZipOutputStream zip, String name, String xml) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(xml.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static String core(String title) {
        return XML + "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\""
                + " xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>" + esc(title) + "</dc:title>"
                + "<dc:creator>PayrollPro</dc:creator></cp:coreProperties>";
    }

    private static String workbook(String sheetName) {
        return XML + "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\""
                + " xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">"
                + "<sheets><sheet name=\"" + esc(sheetName) + "\" sheetId=\"1\" r:id=\"rId1\"/></sheets>"
                + "</workbook>";
    }

    private static final String XML = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>";

    private static final String CONTENT_TYPES = XML
            + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
            + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
            + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
            + "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>"
            + "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>"
            + "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>"
            + "<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>"
            + "</Types>";

    private static final String ROOT_RELS = XML
            + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
            + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>"
            + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>"
            + "</Relationships>";

    private static final String WORKBOOK_RELS = XML
            + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
            + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>"
            + "<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>"
            + "</Relationships>";

    // Fonts: 0 normal, 1 school (bold 14), 2 title (bold 12), 3 info (italic grey), 4 header (bold white), 5 bold.
    // Fills: 2 header blue, 3 totals grey. Borders: 1 thin grey.
    private static final String STYLES = XML
            + "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">"
            + "<numFmts count=\"1\">"
            + "<numFmt numFmtId=\"164\" formatCode=\"&quot;₱&quot;#,##0.00;-&quot;₱&quot;#,##0.00\"/>"
            + "</numFmts>"
            + "<fonts count=\"6\">"
            + "<font><sz val=\"10\"/><name val=\"Calibri\"/></font>"
            + "<font><b/><sz val=\"14\"/><name val=\"Calibri\"/></font>"
            + "<font><b/><sz val=\"12\"/><color rgb=\"FF1E3A8A\"/><name val=\"Calibri\"/></font>"
            + "<font><i/><sz val=\"9\"/><color rgb=\"FF4B5563\"/><name val=\"Calibri\"/></font>"
            + "<font><b/><sz val=\"10\"/><color rgb=\"FFFFFFFF\"/><name val=\"Calibri\"/></font>"
            + "<font><b/><sz val=\"10\"/><name val=\"Calibri\"/></font>"
            + "</fonts>"
            + "<fills count=\"4\">"
            + "<fill><patternFill patternType=\"none\"/></fill>"
            + "<fill><patternFill patternType=\"gray125\"/></fill>"
            + "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FF1E3A8A\"/><bgColor indexed=\"64\"/></patternFill></fill>"
            + "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE5E7EB\"/><bgColor indexed=\"64\"/></patternFill></fill>"
            + "</fills>"
            + "<borders count=\"2\">"
            + "<border><left/><right/><top/><bottom/><diagonal/></border>"
            + "<border><left style=\"thin\"><color rgb=\"FFD1D5DB\"/></left><right style=\"thin\"><color rgb=\"FFD1D5DB\"/></right>"
            + "<top style=\"thin\"><color rgb=\"FFD1D5DB\"/></top><bottom style=\"thin\"><color rgb=\"FFD1D5DB\"/></bottom><diagonal/></border>"
            + "</borders>"
            + "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>"
            + "<cellXfs count=\"12\">"
            + "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>"
            + "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"3\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"4\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment vertical=\"center\" wrapText=\"1\"/></xf>"
            + "<xf numFmtId=\"0\" fontId=\"4\" fillId=\"2\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\" applyAlignment=\"1\"><alignment horizontal=\"right\" vertical=\"center\" wrapText=\"1\"/></xf>"
            + "<xf numFmtId=\"49\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/>"
            + "<xf numFmtId=\"164\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyBorder=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"5\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"/>"
            + "<xf numFmtId=\"164\" fontId=\"5\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"5\" fillId=\"3\" borderId=\"1\" xfId=\"0\" applyNumberFormat=\"1\" applyFont=\"1\" applyFill=\"1\" applyBorder=\"1\"/>"
            + "</cellXfs>"
            + "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles>"
            + "</styleSheet>";
}
