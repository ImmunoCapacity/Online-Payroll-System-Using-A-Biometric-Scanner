package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaffRepository;
import com.stibalayan.payroll.employee.StaffMember;
import jakarta.mail.internet.MimeMessage;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/**
 * Emails each employee their complete payslip (paper, Payslip Report:
 * "Payslips are automatically sent to the employee's registered company
 * email address").
 *
 * The recipient always comes from the employee's record in the database,
 * never from the request. Totals are recomputed here from the itemised
 * amounts, so the email always adds up.
 */
@Service
public class PayslipMailService {

    private static final Logger log = LoggerFactory.getLogger(PayslipMailService.class);
    private static final int MAX_PAYSLIPS = 500;

    private final JavaMailSender mailSender;
    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;
    private final String username;
    private final String from;
    private final String schoolName;

    public PayslipMailService(JavaMailSender mailSender, FacultyStaffRepository faculty, AdminStaffRepository admins,
                              @Value("${spring.mail.username:}") String username,
                              @Value("${payslip.mail.from:}") String from,
                              @Value("${payslip.mail.school-name:}") String schoolName) {
        this.mailSender = mailSender;
        this.faculty = faculty;
        this.admins = admins;
        this.username = username;
        this.from = from.isBlank() ? username : from;
        this.schoolName = schoolName.isBlank() ? "Payroll Office" : schoolName;
    }

    /** One result per payslip: status is "sent", "failed" or "no-email". */
    public List<Map<String, String>> send(PayslipRequest request) {
        if (username.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Email isn't set up yet. Fill in spring.mail.username and spring.mail.password in application.properties, then restart.");
        }
        if (request.payslips() == null || request.payslips().isEmpty()) {
            throw unprocessable("There are no payslips to send.");
        }
        if (request.payslips().size() > MAX_PAYSLIPS) {
            throw unprocessable("Too many payslips in one request.");
        }
        String period = text(request.periodLabel());
        if (period.isEmpty()) {
            throw unprocessable("The pay period is required.");
        }

        // Validate every payslip before sending anything, so a bad amount
        // can't leave the batch half-sent.
        request.payslips().forEach(PayslipMailService::totals);

        List<Map<String, String>> results = new ArrayList<>();
        for (PayslipRequest.Payslip payslip : request.payslips()) {
            results.add(sendOne(payslip, period, text(request.payDate())));
        }
        return results;
    }

    private Map<String, String> sendOne(PayslipRequest.Payslip p, String period, String payDate) {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("employeeId", p.employeeId());

        Optional<? extends StaffMember> staff = find(p.employeeId());
        if (staff.isEmpty()) {
            result.put("status", "failed");
            result.put("message", "Employee not found.");
            return result;
        }
        StaffMember s = staff.get();
        result.put("name", s.getFullName());

        String to = text(s.getEmailAddress());
        if (to.isEmpty()) {
            result.put("status", "no-email");
            result.put("message", "No email address on file.");
            return result;
        }
        result.put("email", to);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from, schoolName + " Payroll");
            helper.setTo(to);
            helper.setSubject("Payslip for " + period);
            helper.setText(plainText(s, p, period, payDate), html(s, p, period, payDate));
            mailSender.send(message);
            result.put("status", "sent");
        } catch (MailException | jakarta.mail.MessagingException | java.io.UnsupportedEncodingException e) {
            log.warn("Could not email payslip to {} ({})", to, p.employeeId(), e);
            result.put("status", "failed");
            result.put("message", "The email could not be sent. Check the mail settings and the address.");
        }
        return result;
    }

    private Optional<? extends StaffMember> find(String employeeId) {
        try {
            EmployeeId id = EmployeeId.parse(employeeId);
            return id.isFaculty() ? faculty.findById(id.number()) : admins.findById(id.number());
        } catch (ApiException e) {
            return Optional.empty();
        }
    }

    // ---------------------------------------------------------------
    // Payslip content: earnings, benefits, itemised deductions, net pay.
    // ---------------------------------------------------------------

    private record Totals(BigDecimal gross, BigDecimal benefits, BigDecimal deductions, BigDecimal net) {
    }

    private static Totals totals(PayslipRequest.Payslip p) {
        BigDecimal gross = money(p.gross());
        BigDecimal benefits = p.benefits() == null ? BigDecimal.ZERO
                : p.benefits().stream().map(b -> money(b.amount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        PayslipRequest.Deductions d = p.deductions();
        BigDecimal deductions = d == null ? BigDecimal.ZERO
                : money(d.sss()).add(money(d.philhealth())).add(money(d.pagibig())).add(money(d.bir())).add(money(d.loan()));
        return new Totals(gross, benefits, deductions, gross.add(benefits).subtract(deductions));
    }

    private String html(StaffMember s, PayslipRequest.Payslip p, String period, String payDate) {
        Totals t = totals(p);
        PayslipRequest.Deductions d = p.deductions() == null
                ? new PayslipRequest.Deductions(null, null, null, null, null) : p.deductions();

        StringBuilder benefitRows = new StringBuilder();
        if (p.benefits() != null) {
            for (PayslipRequest.Benefit b : p.benefits()) {
                benefitRows.append(row(esc(b.name()), peso(b.amount())));
            }
        }
        if (benefitRows.isEmpty()) {
            benefitRows.append(row("None", peso(BigDecimal.ZERO)));
        }

        return "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937\">"
                + "<h2 style=\"margin:0 0 4px;color:#1f4fa3\">" + esc(schoolName) + "</h2>"
                + "<div style=\"color:#6b7280;margin-bottom:16px\">Payslip — " + esc(period)
                + (payDate.isEmpty() ? "" : " · Pay date " + esc(payDate)) + "</div>"
                + "<p style=\"margin:0 0 16px\"><strong>" + esc(s.getFullName()) + "</strong><br>"
                + "Employee No. " + esc(s.getEmployeeNumber()) + "</p>"
                + section("Earnings")
                + "<table style=\"width:100%;border-collapse:collapse\">"
                + earningRows(p)
                + row("<strong>Gross pay</strong>", "<strong>" + peso(t.gross()) + "</strong>")
                + "</table>"
                + section("Benefits")
                + "<table style=\"width:100%;border-collapse:collapse\">" + benefitRows
                + row("<strong>Total benefits</strong>", "<strong>" + peso(t.benefits()) + "</strong>")
                + "</table>"
                + section("Deductions")
                + "<table style=\"width:100%;border-collapse:collapse\">"
                + row("SSS", peso(d.sss()))
                + row("PhilHealth", peso(d.philhealth()))
                + row("Pag-IBIG", peso(d.pagibig()))
                + row("Withholding tax (BIR)", peso(d.bir()))
                + row("Loan repayment", peso(d.loan()))
                + row("<strong>Total deductions</strong>", "<strong>" + peso(t.deductions()) + "</strong>")
                + "</table>"
                + "<div style=\"margin-top:16px;padding:12px;background:#eef4ff;border-radius:6px;font-size:18px\">"
                + "<strong>Net pay: " + peso(t.net()) + "</strong></div>"
                + "<p style=\"color:#6b7280;font-size:12px;margin-top:16px\">This payslip was sent automatically by the "
                + esc(schoolName) + " payroll system. Please contact the Payroll Office about any discrepancy.</p>"
                + "</div>";
    }

    private String plainText(StaffMember s, PayslipRequest.Payslip p, String period, String payDate) {
        Totals t = totals(p);
        PayslipRequest.Deductions d = p.deductions() == null
                ? new PayslipRequest.Deductions(null, null, null, null, null) : p.deductions();
        return schoolName + "\nPayslip — " + period + (payDate.isEmpty() ? "" : " (pay date " + payDate + ")") + "\n\n"
                + s.getFullName() + " — Employee No. " + s.getEmployeeNumber() + "\n\n"
                + earningText(p) + "Gross pay: " + peso(t.gross()) + "\n"
                + "Total benefits: " + peso(t.benefits()) + "\n\n"
                + "SSS: " + peso(d.sss()) + "\nPhilHealth: " + peso(d.philhealth()) + "\nPag-IBIG: " + peso(d.pagibig())
                + "\nWithholding tax (BIR): " + peso(d.bir()) + "\nLoan repayment: " + peso(d.loan())
                + "\nTotal deductions: " + peso(t.deductions()) + "\n\nNET PAY: " + peso(t.net()) + "\n";
    }

    /**
     * Earnings lines: one per role (office hours from the biometric DTR,
     * approved teaching hours from Faculty Teaching Hours), each at its own
     * rate. Older requests without lines show hours × rate.
     */
    private static String earningRows(PayslipRequest.Payslip p) {
        if (p.earnings() == null || p.earnings().isEmpty()) {
            return row("Hours worked", esc(number(p.hours()))) + row("Rate", peso(p.rate()));
        }
        StringBuilder rows = new StringBuilder();
        for (PayslipRequest.Earning e : p.earnings()) {
            rows.append(row(esc(e.label()) + "<br><span style=\"color:#6b7280;font-size:12px\">"
                    + esc(number(e.hours())) + " hrs × " + peso(e.rate()) + "</span>", peso(e.amount())));
        }
        return rows.toString();
    }

    private static String earningText(PayslipRequest.Payslip p) {
        if (p.earnings() == null || p.earnings().isEmpty()) {
            return "Hours worked: " + number(p.hours()) + "\nRate: " + peso(p.rate()) + "\n";
        }
        StringBuilder text = new StringBuilder();
        for (PayslipRequest.Earning e : p.earnings()) {
            text.append(e.label()).append(": ").append(number(e.hours())).append(" hrs × ")
                    .append(peso(e.rate())).append(" = ").append(peso(e.amount())).append('\n');
        }
        return text.toString();
    }

    private static String section(String title) {
        return "<div style=\"margin:16px 0 4px;font-weight:bold;text-transform:uppercase;font-size:12px;color:#6b7280\">"
                + title + "</div>";
    }

    private static String row(String label, String value) {
        return "<tr><td style=\"padding:4px 0;border-bottom:1px solid #e5e7eb\">" + label + "</td>"
                + "<td style=\"padding:4px 0;border-bottom:1px solid #e5e7eb;text-align:right\">" + value + "</td></tr>";
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value.signum() < 0) {
            throw unprocessable("Payslip amounts can't be negative.");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static String peso(BigDecimal value) {
        return "₱" + new DecimalFormat("#,##0.00").format(money(value));
    }

    private static String number(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }

    private static String esc(String value) {
        return HtmlUtils.htmlEscape(value == null ? "" : value);
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    private static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }
}
