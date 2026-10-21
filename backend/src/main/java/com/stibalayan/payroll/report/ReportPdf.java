package com.stibalayan.payroll.report;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.HeaderFooter;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.DecimalFormat;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * A report as a PDF: the school letterhead, the report title and filters,
 * then the table with its header repeated on every page and the totals
 * row at the end. Wide reports (more than six columns) are landscape.
 * Amounts are plain numbers with two decimals, as on the payslip.
 */
@Component
public class ReportPdf {

    private static final Logger log = LoggerFactory.getLogger(ReportPdf.class);
    private static final Color HEAD_FILL = new Color(0x1e, 0x3a, 0x8a);
    private static final Color STRIPE = new Color(0xf3, 0xf4, 0xf6);
    private static final Color TOTAL_FILL = new Color(0xe5, 0xe7, 0xeb);
    private static final Color LINE = new Color(0xd1, 0xd5, 0xdb);
    private static final Font SCHOOL = new Font(Font.HELVETICA, 13, Font.BOLD);
    private static final Font ADDRESS = new Font(Font.HELVETICA, 8, Font.NORMAL, Color.DARK_GRAY);
    private static final Font TITLE = new Font(Font.HELVETICA, 12, Font.BOLD);
    private static final Font INFO = new Font(Font.HELVETICA, 8, Font.NORMAL, Color.DARK_GRAY);
    private static final Font FOOTER = new Font(Font.HELVETICA, 7, Font.NORMAL, Color.GRAY);
    private static final Font HEAD =new Font(Font.HELVETICA, 7.5f, Font.BOLD, Color.WHITE);
    private static final Font CELL = new Font(Font.HELVETICA, 8);
    private static final Font TOTAL = new Font(Font.HELVETICA, 8, Font.BOLD);

    private final String schoolName;
    private final String schoolAddress;
    private final Path logo;

    public ReportPdf(@Value("${payslip.mail.school-name:}") String schoolName,
                     @Value("${payslip.mail.school-address:PED Plaza Business Centre, Ermita St., Balayan, Batangas}") String schoolAddress,
                     @Value("${frontend.dir:..}") String frontendDir) {
        this.schoolName = schoolName.isBlank() ? "Payroll Office" : schoolName;
        this.schoolAddress = schoolAddress;
        this.logo = Path.of(frontendDir).resolve("sti_logo.png").toAbsolutePath().normalize();
    }

    public byte[] render(ReportTable report, List<String> info, String generated) {
        List<ReportTable.Column> columns = report.columns();
        boolean wide = columns.size() > 6;
        Document doc = new Document(wide ? PageSize.A4.rotate() : PageSize.A4, 36, 36, 32, 40);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            PdfWriter.getInstance(doc, out);
            doc.addTitle(report.title());
            HeaderFooter footer = new HeaderFooter(new Phrase(generated + "      Page ", FOOTER), true);
            footer.setAlignment(Element.ALIGN_RIGHT);
            footer.setBorder(Rectangle.TOP);
            footer.setBorderColor(LINE);
            doc.setFooter(footer);
            doc.open();

            doc.add(letterhead());
            Paragraph title = new Paragraph(report.title().toUpperCase(), TITLE);
            title.setAlignment(Element.ALIGN_CENTER);
            doc.add(title);
            for (String line : info) {
                Paragraph p = new Paragraph(line, INFO);
                p.setAlignment(Element.ALIGN_CENTER);
                doc.add(p);
            }
            doc.add(table(report));
        } catch (DocumentException e) {
            throw new IllegalStateException("Could not build the report PDF", e);
        } finally {
            doc.close();
        }
        return out.toByteArray();
    }

    private PdfPTable letterhead() throws DocumentException {
        PdfPTable t = new PdfPTable(new float[] {10, 90});
        t.setWidthPercentage(100);
        PdfPCell logoCell = plain(new Phrase(""));
        try {
            if (Files.isRegularFile(logo)) {
                Image img = Image.getInstance(logo.toString());
                img.scaleToFit(52, 38);
                logoCell = new PdfPCell(img, false);
                logoCell.setBorder(Rectangle.NO_BORDER);
            }
        } catch (Exception e) {
            log.warn("Report logo not loaded from {}", logo, e);
        }
        logoCell.setRowspan(2);
        logoCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        t.addCell(logoCell);
        PdfPCell school = plain(new Phrase(schoolName, SCHOOL));
        school.setVerticalAlignment(Element.ALIGN_BOTTOM);
        t.addCell(school);
        t.addCell(plain(new Phrase(schoolAddress, ADDRESS)));
        PdfPCell rule = plain(new Phrase(""));
        rule.setColspan(2);
        rule.setBorder(Rectangle.BOTTOM);
        rule.setBorderColor(HEAD_FILL);
        rule.setBorderWidth(1.2f);
        t.addCell(rule);
        t.setSpacingAfter(10);
        return t;
    }

    private PdfPTable table(ReportTable report) throws DocumentException {
        List<ReportTable.Column> columns = report.columns();
        PdfPTable t = new PdfPTable(ReportExportController.weights(report));
        t.setWidthPercentage(100);
        t.setSpacingBefore(10);
        t.setHeaderRows(1);

        for (ReportTable.Column c : columns) {
            PdfPCell cell = cell(c.label(), HEAD, c.isNumeric());
            cell.setBackgroundColor(HEAD_FILL);
            cell.setBorderColor(HEAD_FILL);
            cell.setPaddingTop(5);
            cell.setPaddingBottom(5);
            t.addCell(cell);
        }

        if (report.rows().isEmpty()) {
            PdfPCell none = cell("No records found for the selected filters.", CELL, false);
            none.setColspan(columns.size());
            none.setHorizontalAlignment(Element.ALIGN_CENTER);
            t.addCell(none);
        }
        int n = 0;
        for (List<Object> row : report.rows()) {
            boolean stripe = n++ % 2 == 1;
            for (int i = 0; i < columns.size(); i++) {
                Object value = i < row.size() ? row.get(i) : null;
                PdfPCell cell = cell(format(columns.get(i), value), CELL, columns.get(i).isNumeric());
                if (stripe) {
                    cell.setBackgroundColor(STRIPE);
                }
                t.addCell(cell);
            }
        }

        List<Object> totals = report.totals();
        if (totals != null && !totals.isEmpty() && !report.rows().isEmpty()) {
            // "TOTAL" spans the leading columns that have no total.
            int lead = 0;
            while (lead < columns.size() && (lead >= totals.size() || totals.get(lead) == null)) {
                lead++;
            }
            lead = Math.max(1, lead);
            PdfPCell label = cell("TOTAL", TOTAL, false);
            label.setColspan(lead);
            label.setBackgroundColor(TOTAL_FILL);
            t.addCell(label);
            for (int i = lead; i < columns.size(); i++) {
                Object value = i < totals.size() ? totals.get(i) : null;
                PdfPCell cell = cell(value == null ? "" : format(columns.get(i), value), TOTAL, true);
                cell.setBackgroundColor(TOTAL_FILL);
                t.addCell(cell);
            }
        }
        return t;
    }

    static String format(ReportTable.Column column, Object value) {
        if (!column.isNumeric()) {
            String s = ReportTable.text(value);
            return s.isBlank() ? "—" : s;
        }
        BigDecimal n = ReportTable.number(value);
        if (n == null) {
            return "—";
        }
        return new DecimalFormat(column.isMoney() ? "#,##0.00" : "#,##0.##").format(n);
    }

    private static PdfPCell cell(String text, Font font, boolean right) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setHorizontalAlignment(right ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
        c.setVerticalAlignment(Element.ALIGN_MIDDLE);
        c.setBorderColor(LINE);
        c.setBorderWidth(0.5f);
        c.setPadding(4);
        return c;
    }

    private static PdfPCell plain(Phrase p) {
        PdfPCell c = new PdfPCell(p);
        c.setBorder(Rectangle.NO_BORDER);
        return c;
    }
}
