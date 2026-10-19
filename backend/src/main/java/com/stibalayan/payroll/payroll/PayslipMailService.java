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
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/**
 * Emails each employee their payslip (paper, Payslip Report: "Payslips are
 * automatically sent to the employee's registered company email address").
 * The payslip itself is a PDF attachment in the school's payslip format
 * (PayslipPdf); the email body is a short note with the net pay.
 *
 * The recipient always comes from the employee's record in the database,
 * never from the request. Totals are recomputed from the itemised amounts,
 * so the payslip always adds up.
 */
@Service
public class PayslipMailService {

    private static final Logger log = LoggerFactory.getLogger(PayslipMailService.class);
    private static final int MAX_PAYSLIPS = 500;

    private final JavaMailSender mailSender;
    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;
    private final PayslipPdf pdf;
    private final String username;
    private final String from;
    private final String schoolName;

    public PayslipMailService(JavaMailSender mailSender, FacultyStaffRepository faculty, AdminStaffRepository admins,
                              PayslipPdf pdf,
                              @Value("${spring.mail.username:}") String username,
                              @Value("${payslip.mail.from:}") String from,
                              @Value("${payslip.mail.school-name:}") String schoolName) {
        this.mailSender = mailSender;
        this.faculty = faculty;
        this.admins = admins;
        this.pdf = pdf;
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
        request.payslips().forEach(PayslipMailService::netPay);

        List<Map<String, String>> results = new ArrayList<>();
        for (PayslipRequest.Payslip payslip : request.payslips()) {
            results.add(sendOne(payslip, period, text(request.preparedBy())));
        }
        return results;
    }

    private Map<String, String> sendOne(PayslipRequest.Payslip p, String period, String preparedBy) {
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
            byte[] attachment = pdf.render(s, p, period, preparedBy);
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from, schoolName + " Payroll");
            helper.setTo(to);
            helper.setSubject("Payslip for " + period);
            BigDecimal net = netPay(p);
            helper.setText(plainText(s, period, net), html(s, period, net));
            helper.addAttachment(fileName(s, period), new ByteArrayResource(attachment), "application/pdf");
            mailSender.send(message);
            result.put("status", "sent");
        } catch (Exception e) {
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

    /** Applied salary + benefits − all deductions; refuses negative amounts. */
    private static BigDecimal netPay(PayslipRequest.Payslip p) {
        BigDecimal gross = money(p.gross());
        if (p.benefits() != null) {
            for (PayslipRequest.Benefit b : p.benefits()) gross = gross.add(money(b.amount()));
        }
        PayslipRequest.Deductions d = p.deductions() == null ? PayslipRequest.Deductions.none() : p.deductions();
        BigDecimal deductions = money(d.sss()).add(money(d.philhealth())).add(money(d.pagibig())).add(money(d.bir()))
                .add(money(d.sssLoan())).add(money(d.pagibigLoan())).add(money(d.other()));
        return gross.subtract(deductions);
    }

    /** e.g. Payslip_STIBLN-0011-M_Oct-11-25-2026.pdf */
    private static String fileName(StaffMember s, String period) {
        String safePeriod = period.replaceAll("[^A-Za-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return "Payslip_" + text(s.getEmployeeNumber()) + "_" + safePeriod + ".pdf";
    }

    private String html(StaffMember s, String period, BigDecimal net) {
        return "<div style=\"font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1f2937;line-height:1.5\">"
                + "<p>Hello " + esc(s.getFirstname()) + ",</p>"
                + "<p>Your payslip for <strong>" + esc(period) + "</strong> is attached as a PDF.</p>"
                + "<p style=\"font-size:16px\">Net pay: <strong>₱" + amount(net) + "</strong></p>"
                + "<p>Please contact the Payroll Office about any discrepancy.</p>"
                + "<p style=\"color:#6b7280;font-size:12px\">" + esc(schoolName) + " · Sent automatically by the payroll system.</p>"
                + "</div>";
    }

    private String plainText(StaffMember s, String period, BigDecimal net) {
        return "Hello " + text(s.getFirstname()) + ",\n\n"
                + "Your payslip for " + period + " is attached as a PDF.\n"
                + "Net pay: PHP " + amount(net) + "\n\n"
                + "Please contact the Payroll Office about any discrepancy.\n\n"
                + schoolName + " (sent automatically by the payroll system)";
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

    private static String amount(BigDecimal value) {
        return new DecimalFormat("#,##0.00").format(value);
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
