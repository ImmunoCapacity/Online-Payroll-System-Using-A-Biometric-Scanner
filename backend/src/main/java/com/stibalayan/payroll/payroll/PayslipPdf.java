package com.stibalayan.payroll.payroll;

import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.FacultyStaff;
import com.stibalayan.payroll.employee.StaffMember;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.DecimalFormat;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * The payslip as a PDF, laid out like the school's payslip form:
 *
 *   logo, school name and address
 *   PAYROLL COMPUTATION FOR / EMPLOYEE NO. / EMPLOYEE NAME / DESIGNATION
 *   HRS WORKED · RATE · APPLIED SALARY: lecture hours, office hours, paid
 *     leave, holiday, adjustment -> TOTAL APPLIED SALARY
 *   BENEFITS -> GROSS PAY
 *   DEDUCTIONS: SSS, Pag-IBIG, PhilHealth, tax, SSS loan, Pag-IBIG loan,
 *     other deductions -> TOTAL DEDUCTIONS
 *   NET PAY
 *   signatures: Payroll Master (who released the period) and the employee
 *
 * Amounts are plain numbers with two decimals, as on the form.
 */
@Component
public class PayslipPdf {

    private static final Logger log = LoggerFactory.getLogger(PayslipPdf.class);
    private static final Color LINE = new Color(0x9c, 0xa3, 0xaf);
    private static final Font NORMAL = new Font(Font.HELVETICA, 9);
    private static final Font BOLD = new Font(Font.HELVETICA, 9, Font.BOLD);
    private static final Font TITLE = new Font(Font.HELVETICA, 12, Font.BOLD);
    private static final Font SMALL = new Font(Font.HELVETICA, 8);
    private static final float[] WIDTHS = {44, 18, 16, 22};

    private final String schoolName;
    private final String schoolAddress;
    private final Path logo;

    public PayslipPdf(@Value("${payslip.mail.school-name:}") String schoolName,
                      @Value("${payslip.mail.school-address:PED Plaza Business Centre, Ermita St., Balayan, Batangas}") String schoolAddress,
                      @Value("${frontend.dir:..}") String frontendDir) {
        this.schoolName = schoolName.isBlank() ? "Payroll Office" : schoolName;
        this.schoolAddress = schoolAddress;
        this.logo = Path.of(frontendDir).resolve("sti_logo.png").toAbsolutePath().normalize();
    }

    public byte[] render(StaffMember s, PayslipRequest.Payslip p, String period, String preparedBy) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 48, 48, 40, 40);
        try {
            PdfWriter.getInstance(doc, out);
            doc.addTitle("Payslip " + period + " - " + s.getFullName());
            doc.open();
            doc.add(header());
            doc.add(body(s, p, period));
            doc.add(signatures(s, preparedBy));
        } catch (DocumentException e) {
            throw new IllegalStateException("Could not build the payslip PDF", e);
        } finally {
            doc.close();
        }
        return out.toByteArray();
    }

    // ---------------------------------------------------------------

    private PdfPTable header() throws DocumentException {
        PdfPTable t = new PdfPTable(new float[] {14, 86});
        t.setWidthPercentage(100);
        PdfPCell logoCell = blank();
        try {
            if (Files.isRegularFile(logo)) {
                Image img = Image.getInstance(logo.toString());
                img.scaleToFit(56, 40);
                logoCell = new PdfPCell(img, false);
                logoCell.setBorder(Rectangle.NO_BORDER);
            }
        } catch (Exception e) {
            log.warn("Payslip logo not loaded from {}", logo, e);
        }
        logoCell.setRowspan(2);
        logoCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        t.addCell(logoCell);
        t.addCell(text(schoolName, TITLE));
        t.addCell(text(schoolAddress, SMALL));
        t.setSpacingAfter(14);
        return t;
    }

    private PdfPTable body(StaffMember s, PayslipRequest.Payslip p, String period) throws DocumentException {
        PdfPTable t = new PdfPTable(WIDTHS);
        t.setWidthPercentage(100);

        info(t, "PAYROLL COMPUTATION FOR:", period.toUpperCase());
        info(t, "EMPLOYEE NO.", nz(s.getEmployeeNumber()));
        info(t, "EMPLOYEE NAME", s.getFullName().toUpperCase());
        info(t, "DESIGNATION", designation(s).toUpperCase());
        gap(t);

        // Earnings
        t.addCell(blank());
        t.addCell(right("HRS WORKED", BOLD));
        t.addCell(right("RATE", BOLD));
        t.addCell(right("APPLIED SALARY", BOLD));
        Line lecture = new Line();
        Line office = new Line();
        Line leave = new Line();
        Line holiday = new Line();
        Line other = new Line();
        if (p.earnings() == null || p.earnings().isEmpty()) {
            (s instanceof FacultyStaff ? lecture : office).add(p.hours(), p.rate(), money(p.gross()));
        } else {
            for (PayslipRequest.Earning e : p.earnings()) {
                String label = nz(e.label()).toLowerCase();
                // Adjustments first: their reason often mentions "leave".
                // Holiday double pay before teaching/office: its label names both.
                Line target = label.startsWith("adjustment") ? other
                        : label.startsWith("holiday") ? holiday
                        : label.contains("teaching") ? lecture
                        : label.contains("office") ? office
                        : label.contains("leave") ? leave : other;
                target.add(e.hours(), e.rate(), money(e.amount()));
            }
        }
        earningRow(t, "NO. OF HOURS LECTURE", lecture);
        earningRow(t, "NO. OF OFFICE HOURS", office);
        if (!leave.isEmpty()) {
            earningRow(t, "PAID LEAVE", leave);
        }
        earningRow(t, "HOLIDAY", holiday);
        earningRow(t, "ADJUSTMENT", other);
        BigDecimal applied = money(p.gross());
        t.addCell(blank());
        t.addCell(span(text("TOTAL APPLIED SALARY", BOLD), 2));
        t.addCell(right(amount(applied), BOLD));
        gap(t);

        // Benefits
        t.addCell(span(text("BENEFITS", BOLD), 4));
        BigDecimal benefits = BigDecimal.ZERO;
        List<PayslipRequest.Benefit> list = p.benefits() == null ? List.of() : p.benefits();
        for (PayslipRequest.Benefit b : list) {
            benefits = benefits.add(money(b.amount()));
            t.addCell(span(text(nz(b.name()).toUpperCase(), NORMAL), 3));
            t.addCell(right(amount(b.amount()), NORMAL));
        }
        if (list.isEmpty()) {
            t.addCell(span(text("NONE", NORMAL), 3));
            t.addCell(right(amount(BigDecimal.ZERO), NORMAL));
        }
        BigDecimal gross = applied.add(benefits);
        t.addCell(blank());
        t.addCell(span(text("GROSS PAY", BOLD), 2));
        t.addCell(right(amount(gross), BOLD));
        gap(t);

        // Deductions (amounts in the RATE column, as on the form)
        PayslipRequest.Deductions d = p.deductions() == null ? PayslipRequest.Deductions.none() : p.deductions();
        t.addCell(span(text("DEDUCTIONS", BOLD), 4));
        BigDecimal deductions = BigDecimal.ZERO;
        deductions = deductions.add(deductionRow(t, "SSS CONTRI", d.sss()));
        deductions = deductions.add(deductionRow(t, "PAG-IBIG", d.pagibig()));
        deductions = deductions.add(deductionRow(t, "PHILHEALTH", d.philhealth()));
        deductions = deductions.add(deductionRow(t, "TAX", d.bir()));
        deductions = deductions.add(deductionRow(t, "SSS LOAN", d.sssLoan()));
        deductions = deductions.add(deductionRow(t, "PAG-IBIG LOAN", d.pagibigLoan()));
        deductions = deductions.add(deductionRow(t, "OTHER DEDUCTIONS", d.other()));
        t.addCell(span(right("TOTAL DEDUCTIONS", BOLD), 2));
        t.addCell(right(amount(deductions), BOLD));
        t.addCell(blank());
        gap(t);

        // Net pay, boxed
        BigDecimal net = gross.subtract(deductions);
        PdfPCell label = span(text("NET PAY", BOLD), 3);
        PdfPCell value = right(amount(net), BOLD);
        for (PdfPCell c : new PdfPCell[] {label, value}) {
            c.setBorder(Rectangle.BOX);
            c.setBorderColor(Color.BLACK);
            c.setBorderWidth(1f);
            c.setPaddingTop(5);
            c.setPaddingBottom(6);
        }
        t.addCell(label);
        t.addCell(value);
        t.setSpacingAfter(48);
        return t;
    }

    private PdfPTable signatures(StaffMember s, String preparedBy) throws DocumentException {
        PdfPTable t = new PdfPTable(new float[] {42, 16, 42});
        t.setWidthPercentage(100);
        // The middle column is just space between the two signatures (no rules).
        t.addCell(center(nz(preparedBy).toUpperCase(), BOLD));
        t.addCell(center(" ", NORMAL));
        t.addCell(center(" ", BOLD));
        PdfPCell a = center("FULL NAME AND SIGNATURE", SMALL);
        PdfPCell b = center("EMPLOYEE SIGNATURE", SMALL);
        a.setBorder(Rectangle.TOP);
        b.setBorder(Rectangle.TOP);
        a.setBorderColor(Color.BLACK);
        b.setBorderColor(Color.BLACK);
        t.addCell(a);
        t.addCell(center(" ", NORMAL));
        t.addCell(b);
        t.addCell(center("PAYROLL MASTER", BOLD));
        t.addCell(center(" ", NORMAL));
        t.addCell(center(s.getFullName().toUpperCase(), BOLD));
        return t;
    }

    // ---------------------------------------------------------------

    /** Hours, rate and amount of one earnings row (several lines of one kind are added up). */
    private static final class Line {
        BigDecimal hours = BigDecimal.ZERO;
        BigDecimal amount = BigDecimal.ZERO;
        BigDecimal rate;
        boolean mixedRates;
        boolean used;

        void add(BigDecimal h, BigDecimal r, BigDecimal a) {
            used = true;
            hours = hours.add(h == null ? BigDecimal.ZERO : h);
            amount = amount.add(a);
            if (r != null) {
                if (rate != null && rate.compareTo(r) != 0) mixedRates = true;
                rate = r;
            }
        }

        boolean isEmpty() {
            return !used;
        }
    }

    private static void earningRow(PdfPTable t, String label, Line l) {
        t.addCell(text(label, NORMAL));
        t.addCell(right(l.isEmpty() ? "" : hours(l.hours), NORMAL));
        t.addCell(right(l.isEmpty() || l.rate == null || l.mixedRates ? "" : amount(l.rate), NORMAL));
        t.addCell(right(l.isEmpty() ? "" : amount(l.amount), NORMAL));
    }

    private static BigDecimal deductionRow(PdfPTable t, String label, BigDecimal value) {
        BigDecimal v = money(value);
        t.addCell(span(text(label, NORMAL), 2));
        t.addCell(right(amount(v), NORMAL));
        t.addCell(blank());
        return v;
    }

    private static void info(PdfPTable t, String label, String value) {
        t.addCell(text(label, BOLD));
        t.addCell(span(text(value, NORMAL), 3));
    }

    private static void gap(PdfPTable t) {
        PdfPCell c = span(text(" ", SMALL), 4);
        c.setBorder(Rectangle.NO_BORDER);
        c.setFixedHeight(10);
        t.addCell(c);
    }

    /** Position (Admin), else Instructor Rank, else the staff type; also shown in Payroll Computation. */
    public static String designation(StaffMember s) {
        if (s instanceof AdminStaff a) {
            if (a.getPosition() != null && !a.getPosition().isBlank()) return a.getPosition();
            if (a.getInstructorRank() != null && !a.getInstructorRank().isBlank()) return a.getInstructorRank();
        }
        if (s instanceof FacultyStaff f && f.getInstructorRank() != null && !f.getInstructorRank().isBlank()) {
            return f.getInstructorRank();
        }
        return s.staffType();
    }

    private static PdfPCell text(String value, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(plain(value), font));
        c.setBorder(Rectangle.BOTTOM);
        c.setBorderColor(LINE);
        c.setBorderWidth(0.3f);
        c.setPaddingTop(3);
        c.setPaddingBottom(4);
        return c;
    }

    private static PdfPCell right(String value, Font font) {
        PdfPCell c = text(value, font);
        c.setHorizontalAlignment(Element.ALIGN_RIGHT);
        return c;
    }

    private static PdfPCell center(String value, Font font) {
        PdfPCell c = text(value, font);
        c.setBorder(Rectangle.NO_BORDER);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        return c;
    }

    private static PdfPCell span(PdfPCell c, int columns) {
        c.setColspan(columns);
        return c;
    }

    private static PdfPCell blank() {
        return text("", NORMAL);
    }

    private static BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String amount(BigDecimal value) {
        return new DecimalFormat("#,##0.00").format(money(value));
    }

    private static String hours(BigDecimal value) {
        return value == null ? "0" : value.setScale(2, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }

    /**
     * The built-in PDF font doesn't render typographic dashes and quotes
     * (an en dash in a period label prints as garbage characters), so they
     * become their plain equivalents.
     */
    private static String plain(String value) {
        return nz(value)
                .replace('–', '-').replace('—', '-')
                .replace('‘', '\'').replace('’', '\'')
                .replace('“', '"').replace('”', '"')
                .replace("…", "...");
    }
}
