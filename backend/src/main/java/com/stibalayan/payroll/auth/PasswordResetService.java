package com.stibalayan.payroll.auth;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.user.User;
import com.stibalayan.payroll.user.UserRepository;
import com.stibalayan.payroll.user.UserService;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Forgot Password with a one-time code (OTP), table password_reset:
 *
 *   1. requestCode: a 6-digit code is emailed to the account's address. It
 *      expires after 10 minutes; only its hash is stored. The reply is the
 *      same whether or not the email belongs to an account, so the form
 *      can't be used to find out which emails exist.
 *   2. verifyCode: the code is checked (5 tries). A correct code returns a
 *      reset token that is valid for 10 minutes.
 *   3. resetPassword: with that token, the user sets a new password (and
 *      confirms it). The account's password is updated — the same password
 *      the System Administrator manages in User Management.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int CODE_MINUTES = 10;
    private static final int TOKEN_MINUTES = 10;
    private static final int MAX_TRIES = 5;
    private static final int COOLDOWN_SECONDS = 60;
    private static final int MAX_CODES_PER_HOUR = 5;
    private static final String INVALID_CODE = "The code is incorrect or has expired. Request a new code.";

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final BCryptPasswordEncoder encoder;
    private final JavaMailSender mailSender;
    private final AuthService authService;
    private final AuditService audit;
    private final String mailUsername;
    private final String from;
    private final String schoolName;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(JdbcTemplate jdbc, UserRepository users, BCryptPasswordEncoder encoder,
                                JavaMailSender mailSender, AuthService authService, AuditService audit,
                                @Value("${spring.mail.username:}") String mailUsername,
                                @Value("${payslip.mail.from:}") String from,
                                @Value("${payslip.mail.school-name:}") String schoolName) {
        this.jdbc = jdbc;
        this.users = users;
        this.encoder = encoder;
        this.mailSender = mailSender;
        this.authService = authService;
        this.audit = audit;
        this.mailUsername = mailUsername;
        this.from = from.isBlank() ? mailUsername : from;
        this.schoolName = schoolName.isBlank() ? "Payroll Office" : schoolName;
    }

    /** Step 1: email a code to the account, if there is one. */
    @Transactional
    public void requestCode(String emailText) {
        String email = Validation.email(emailText, "email", "Email");
        if (email == null) {
            throw Validation.invalid("email", "Email is required.");
        }
        if (mailUsername.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Password reset by email isn't set up yet. Contact your System Administrator.");
        }
        User user = users.findFirstByEmail(email).filter(User::isActive).orElse(null);
        if (user == null) {
            return;   // same reply as for a real account
        }

        Integer recent = jdbc.queryForObject("SELECT COUNT(*) FROM password_reset WHERE user_id = ? "
                + "AND created_at > NOW() - INTERVAL ? SECOND", Integer.class, user.getId(), COOLDOWN_SECONDS);
        if (recent != null && recent > 0) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "A code was just sent. Wait a minute before requesting another.");
        }
        Integer hourly = jdbc.queryForObject("SELECT COUNT(*) FROM password_reset WHERE user_id = ? "
                + "AND created_at > NOW() - INTERVAL 1 HOUR", Integer.class, user.getId());
        if (hourly != null && hourly >= MAX_CODES_PER_HOUR) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many codes requested. Try again in an hour.");
        }

        String code = String.format("%06d", random.nextInt(1_000_000));
        // Only the newest code works.
        jdbc.update("UPDATE password_reset SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL", user.getId());
        jdbc.update("INSERT INTO password_reset (user_id, otp_hash, expires_at) VALUES (?, ?, ?)",
                user.getId(), encoder.encode(code), Timestamp.valueOf(LocalDateTime.now().plusMinutes(CODE_MINUTES)));
        try {
            sendCode(user, code);
        } catch (Exception e) {
            log.warn("Could not email a password reset code to {}", user.getEmail(), e);
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send the email right now. Try again later.");
        }
    }

    /**
     * Step 2: check the code; returns a reset token for step 3. A wrong try is
     * counted even though an error is returned (no rollback for ApiException).
     */
    @Transactional(noRollbackFor = ApiException.class)
    public String verifyCode(String emailText, String codeText) {
        String code = codeText == null ? "" : codeText.trim();
        if (!code.matches("\\d{6}")) {
            throw Validation.invalid("code", "Enter the 6-digit code from the email.");
        }
        User user = activeUser(emailText);
        Map<String, Object> row = latest(user);
        if (row == null || row.get("verified_at") != null || isPast(row.get("expires_at"))) {
            throw Validation.invalid("code", INVALID_CODE);
        }
        int tries = ((Number) row.get("attempts")).intValue();
        if (tries >= MAX_TRIES) {
            throw Validation.invalid("code", "Too many wrong tries. Request a new code.");
        }
        int resetId = ((Number) row.get("reset_id")).intValue();
        if (!encoder.matches(code, String.valueOf(row.get("otp_hash")))) {
            jdbc.update("UPDATE password_reset SET attempts = attempts + 1 WHERE reset_id = ?", resetId);
            int left = MAX_TRIES - tries - 1;
            throw Validation.invalid("code", left > 0
                    ? "Incorrect code. " + left + " tr" + (left == 1 ? "y" : "ies") + " left."
                    : "Too many wrong tries. Request a new code.");
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.update("UPDATE password_reset SET verified_at = NOW(), token_hash = ?, token_expires_at = ? WHERE reset_id = ?",
                sha256(token), Timestamp.valueOf(LocalDateTime.now().plusMinutes(TOKEN_MINUTES)), resetId);
        return token;
    }

    /** Step 3: set the new password. */
    @Transactional
    public void resetPassword(String emailText, String token, String password, String confirmPassword) {
        User user = activeUser(emailText);
        Map<String, Object> row = latest(user);
        boolean valid = row != null && token != null && !token.isBlank() && row.get("verified_at") != null
                && row.get("token_hash") != null && !isPast(row.get("token_expires_at"))
                && MessageDigest.isEqual(sha256(token).getBytes(StandardCharsets.UTF_8),
                        String.valueOf(row.get("token_hash")).getBytes(StandardCharsets.UTF_8));
        if (!valid) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "This reset has expired. Start again with a new code.");
        }
        String pw = password == null ? "" : password;
        if (pw.isEmpty()) {
            throw Validation.invalid("password", "New password is required.");
        }
        UserService.checkPassword(pw);
        if (!pw.equals(confirmPassword)) {
            throw Validation.invalid("confirmPassword", "The passwords don't match.");
        }
        user.setPassword(encoder.encode(pw));
        user.setPasswordChangedAt(LocalDateTime.now());
        users.save(user);
        jdbc.update("UPDATE password_reset SET used_at = NOW() WHERE reset_id = ?", ((Number) row.get("reset_id")).intValue());
        authService.clearFailures(user.getEmail());
        audit.log(user.getId(), "User Accounts", "Password reset", user.getEmail() + " · by email code (Forgot Password)");
    }

    // ---------------------------------------------------------------

    private User activeUser(String emailText) {
        String email = emailText == null ? "" : emailText.trim();
        return users.findFirstByEmail(email).filter(User::isActive)
                .orElseThrow(() -> Validation.invalid("code", INVALID_CODE));
    }

    /** The newest unused reset of this user, or null. */
    private Map<String, Object> latest(User user) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM password_reset WHERE user_id = ? AND used_at IS NULL "
                + "ORDER BY reset_id DESC LIMIT 1", user.getId());
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static boolean isPast(Object dateTime) {
        if (dateTime == null) return true;
        LocalDateTime at = dateTime instanceof Timestamp t ? t.toLocalDateTime() : (LocalDateTime) dateTime;
        return at.isBefore(LocalDateTime.now());
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private void sendCode(User user, String code) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(from, schoolName + " Payroll");
        helper.setTo(user.getEmail());
        helper.setSubject("Your password reset code: " + code);
        helper.setText(
                "<div style=\"font-family:Arial,sans-serif;color:#1f2937;max-width:480px\">"
                + "<p>Hello " + escape(user.getFirstName()) + ",</p>"
                + "<p>Use this code to reset your PayrollPro password:</p>"
                + "<p style=\"font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0\">" + code + "</p>"
                + "<p>The code expires in " + CODE_MINUTES + " minutes. If you didn't ask to reset your password, "
                + "ignore this email — your password stays the same.</p>"
                + "<p style=\"color:#6b7280;font-size:12px\">" + escape(schoolName) + "</p></div>", true);
        mailSender.send(message);
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
