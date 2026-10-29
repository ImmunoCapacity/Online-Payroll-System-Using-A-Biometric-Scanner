package com.stibalayan.payroll.user;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Emails a system account's login email and password — when the account is
 * first created, and whenever the System Administrator clicks "Send Email"
 * in User Management to (re)send them. Never throws: the caller decides
 * what to do (and what to tell the admin) when sending fails.
 */
@Service
public class UserCredentialsMailService {

    private static final Logger log = LoggerFactory.getLogger(UserCredentialsMailService.class);

    private final JavaMailSender mailSender;
    private final String mailUsername;
    private final String from;
    private final String schoolName;

    public UserCredentialsMailService(JavaMailSender mailSender,
                                      @Value("${spring.mail.username:}") String mailUsername,
                                      @Value("${payslip.mail.from:}") String from,
                                      @Value("${payslip.mail.school-name:}") String schoolName) {
        this.mailSender = mailSender;
        this.mailUsername = mailUsername;
        this.from = from.isBlank() ? mailUsername : from;
        this.schoolName = schoolName.isBlank() ? "Payroll Office" : schoolName;
    }

    public boolean isConfigured() {
        return !mailUsername.isBlank();
    }

    /** True if the email was sent. The password is never logged. */
    public boolean send(User user, String plainPassword, boolean isNewAccount) {
        if (!isConfigured()) {
            return false;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, schoolName + " Payroll");
            helper.setTo(user.getEmail());
            helper.setSubject(isNewAccount ? "Your PayrollPro account" : "Your new PayrollPro password");
            helper.setText(
                    "<div style=\"font-family:Arial,sans-serif;color:#1f2937;max-width:480px\">"
                    + "<p>Hello " + escape(user.getFirstName()) + ",</p>"
                    + "<p>" + (isNewAccount
                            ? "An account was created for you on PayrollPro (" + escape(user.getRole()) + "). "
                            : "Your PayrollPro password was reset by a System Administrator. ")
                    + "Use these details to log in:</p>"
                    + "<p style=\"margin:16px 0\">"
                    + "<strong>Email:</strong> " + escape(user.getEmail()) + "<br>"
                    + "<strong>Password:</strong> <span style=\"font-size:18px;font-weight:bold;letter-spacing:1px\">"
                    + escape(plainPassword) + "</span></p>"
                    + "<p>For your security, sign in and change this password as soon as you can "
                    + "(or use Forgot Password on the login page).</p>"
                    + "<p style=\"color:#6b7280;font-size:12px\">" + escape(schoolName) + "</p></div>", true);
            mailSender.send(message);
            return true;
        } catch (Exception e) {
            log.warn("Could not email login credentials to {}", user.getEmail(), e);
            return false;
        }
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
