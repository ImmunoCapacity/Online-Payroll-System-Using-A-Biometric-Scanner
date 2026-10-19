package com.stibalayan.payroll.fingerprint;

import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaffRepository;
import com.stibalayan.payroll.employee.StaffMember;
import jakarta.mail.internet.MimeMessage;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

/**
 * Emails an employee when their fingerprint is registered: that it was added
 * to the system, what it is used for, and how it is protected under the Data
 * Privacy Act of 2012 (Republic Act No. 10173).
 *
 * The recipient comes from the employee's record. A failure never undoes the
 * registration; the caller gets a status to show instead:
 *   sent | not-configured (no Gmail settings) | no-email | failed
 */
@Service
public class FingerprintNoticeService {

    private static final Logger log = LoggerFactory.getLogger(FingerprintNoticeService.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("MMMM d, yyyy");

    private final JavaMailSender mailSender;
    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;
    private final String username;
    private final String from;
    private final String schoolName;

    public FingerprintNoticeService(JavaMailSender mailSender, FacultyStaffRepository faculty, AdminStaffRepository admins,
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

    /** Sends the notice; returns { status, message } for the page. */
    public Map<String, String> sendRegistered(String employeeId) {
        if (username.isBlank()) {
            return result("not-configured", "No notice email was sent: email isn't set up yet (application.properties).");
        }
        EmployeeId id = EmployeeId.parse(employeeId);
        StaffMember staff = id.isFaculty()
                ? faculty.findById(id.number()).orElse(null)
                : admins.findById(id.number()).orElse(null);
        if (staff == null) {
            return result("failed", "No notice email was sent: employee not found.");
        }
        String email = staff.getEmailAddress() == null ? "" : staff.getEmailAddress().trim();
        if (email.isEmpty()) {
            return result("no-email", "No notice email was sent: " + staff.getFullName() + " has no email address on record.");
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(from, schoolName + " Payroll");
            helper.setTo(email);
            helper.setSubject("Your fingerprint has been registered — " + schoolName);
            helper.setText(plainText(staff), html(staff));
            mailSender.send(message);
            return result("sent", "A notice was emailed to " + email + ".");
        } catch (Exception e) {
            log.warn("Could not email the fingerprint registration notice to {}", email, e);
            return result("failed", "The fingerprint was registered, but the notice email to " + email + " could not be sent.");
        }
    }

    private String html(StaffMember s) {
        String name = esc(s.getFirstname());
        String school = esc(schoolName);
        String today = LocalDate.now().format(DATE);
        return "<div style=\"font-family:Arial,sans-serif;color:#1f2937;max-width:600px;line-height:1.5\">"
                + "<h2 style=\"color:#134a61;margin:0 0 12px\">Your fingerprint has been registered</h2>"
                + "<p>Hello " + name + ",</p>"
                + "<p>On " + today + ", your fingerprint was registered in the " + school + " payroll system"
                + " (Employee ID <strong>" + esc(s.getEmployeeNumber()) + "</strong>). From now on you can use the"
                + " biometric scanner to record your time in and time out.</p>"
                + "<h3 style=\"color:#134a61;margin:20px 0 8px\">How your biometric data is protected</h3>"
                + "<p>Your fingerprint is personal information protected by the <strong>Data Privacy Act of 2012"
                + " (Republic Act No. 10173)</strong>. " + school + " handles it as follows:</p>"
                + "<ul style=\"padding-left:20px\">"
                + "<li><strong>Purpose:</strong> it is used only to record your attendance (Daily Time Record) and to compute your pay.</li>"
                + "<li><strong>What is kept:</strong> your fingerprint template stays on the school's biometric scanner."
                + " The payroll system keeps only your scanner User ID and the times you scan — not an image of your fingerprint.</li>"
                + "<li><strong>Who can see it:</strong> only authorized payroll personnel. It is not shared with anyone"
                + " outside the school unless the law requires it.</li>"
                + "<li><strong>How long:</strong> it is kept only while it is needed for your employment and payroll records,"
                + " and removed from the scanner when it is no longer needed.</li>"
                + "</ul>"
                + "<p>Under the law you have the right to be informed, to access and correct your data, to object to its"
                + " processing, to have it erased or blocked, and to file a complaint with the National Privacy Commission."
                + " For questions or requests, contact the school's HR office or Data Protection Officer.</p>"
                + "<p>If you did not have your fingerprint registered, please tell the payroll office right away.</p>"
                + "<p style=\"color:#6b7280;font-size:12px;margin-top:24px\">" + school + " · This is an automatic message.</p>"
                + "</div>";
    }

    private String plainText(StaffMember s) {
        return "Hello " + nz(s.getFirstname()) + ",\n\n"
                + "On " + LocalDate.now().format(DATE) + ", your fingerprint was registered in the " + schoolName
                + " payroll system (Employee ID " + nz(s.getEmployeeNumber()) + "). You can now use the biometric"
                + " scanner to record your time in and time out.\n\n"
                + "HOW YOUR BIOMETRIC DATA IS PROTECTED\n"
                + "Your fingerprint is personal information protected by the Data Privacy Act of 2012 (Republic Act No. 10173).\n"
                + "- Purpose: used only to record your attendance (Daily Time Record) and to compute your pay.\n"
                + "- What is kept: your fingerprint template stays on the school's biometric scanner. The payroll system keeps"
                + " only your scanner User ID and the times you scan, not an image of your fingerprint.\n"
                + "- Who can see it: only authorized payroll personnel. It is not shared outside the school unless the law requires it.\n"
                + "- How long: only while needed for your employment and payroll records; removed from the scanner when no longer needed.\n\n"
                + "You have the right to be informed, to access and correct your data, to object to its processing, to have it"
                + " erased or blocked, and to file a complaint with the National Privacy Commission. For questions, contact the"
                + " school's HR office or Data Protection Officer.\n\n"
                + "If you did not have your fingerprint registered, please tell the payroll office right away.\n\n"
                + schoolName + " (automatic message)";
    }

    private static Map<String, String> result(String status, String message) {
        return Map.of("status", status, "message", message);
    }

    private static String esc(String value) {
        return value == null ? "" : HtmlUtils.htmlEscape(value);
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }
}
