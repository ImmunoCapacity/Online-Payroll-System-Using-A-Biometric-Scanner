package com.stibalayan.payroll.report;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SessionUser;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Export PDF / Export Excel on the Reports page. The page sends the report
 * exactly as shown (after its filters); this returns it as a file.
 *
 * POST /api/reports/export  {@link ReportTable} with format "pdf" or "xlsx"
 */
@RestController
@RequestMapping("/api/reports")
@RequireModule(SystemModule.REPORTS)
public class ReportExportController {

    private static final int MAX_COLUMNS = 20;
    private static final int MAX_ROWS = 10_000;
    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final ReportPdf pdf;
    private final ReportXlsx xlsx;
    private final AuditService audit;

    public ReportExportController(ReportPdf pdf, ReportXlsx xlsx, AuditService audit) {
        this.pdf = pdf;
        this.xlsx = xlsx;
        this.audit = audit;
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@RequestBody ReportTable report, HttpServletRequest http) {
        String format = report.format() == null ? "" : report.format().toLowerCase(Locale.ROOT);
        if (!format.equals("pdf") && !format.equals("xlsx")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Choose PDF or Excel.");
        }
        if (report.title() == null || report.title().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The report has no title.");
        }
        if (report.columns() == null || report.columns().isEmpty() || report.columns().size() > MAX_COLUMNS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The report has no columns.");
        }
        if (report.columns().stream().anyMatch(c -> c == null || c.label() == null)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Every column needs a name.");
        }
        if (report.rows() == null || report.rows().size() > MAX_ROWS
                || report.rows().stream().anyMatch(r -> r == null)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The report is too large to export.");
        }

        SessionUser user = AuthInterceptor.currentUser(http);
        List<String> info = new ArrayList<>();
        if (report.subtitle() != null) {
            report.subtitle().stream().filter(s -> s != null && !s.isBlank()).limit(5).forEach(info::add);
        }
        // Who exported it and when: small, in the page footer (PDF) or under the table (Excel).
        String generated = "Generated " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a", Locale.ENGLISH))
                + " by " + user.name();

        boolean isPdf = format.equals("pdf");
        byte[] file = isPdf ? pdf.render(report, info, generated) : xlsx.render(report, info, generated);
        String name = report.title().trim().replaceAll("[^A-Za-z0-9]+", "-").replaceAll("^-|-$", "")
                + "_" + LocalDate.now() + (isPdf ? ".pdf" : ".xlsx");

        audit.log(user.id(), "Reports", "Export",
                "Exported " + report.title().trim() + " as " + (isPdf ? "PDF" : "Excel") + " (" + report.rows().size() + " rows)");

        return ResponseEntity.ok()
                .contentType(isPdf ? MediaType.APPLICATION_PDF : XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(file);
    }

    /** Relative column widths from the longest text in each column. */
    static float[] weights(ReportTable report) {
        List<ReportTable.Column> columns = report.columns();
        float[] w = new float[columns.size()];
        for (int i = 0; i < w.length; i++) {
            ReportTable.Column c = columns.get(i);
            // Header text is bold capitals, so it counts a little wider.
            float longest = Math.min(c.label().length(), 16) * 1.15f;
            for (List<Object> row : report.rows()) {
                Object v = i < row.size() ? row.get(i) : null;
                longest = Math.max(longest, ReportPdf.format(c, v).length());
            }
            if (report.totals() != null && i < report.totals().size() && report.totals().get(i) != null) {
                longest = Math.max(longest, ReportPdf.format(c, report.totals().get(i)).length() * 1.1f);
            }
            w[i] = Math.max(c.isNumeric() ? 7 : 6, Math.min(32, longest + 1));
        }
        return w;
    }
}
