package com.stibalayan.payroll.user;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.Roles;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.notification.EmailLog;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * User Account Management (Utility module): the System Administrator creates,
 * edits, deactivates and deletes Payroll Master, Attendance Monitoring Staff and System
 * Administrator accounts.
 *
 * Guard rails so the system can't be locked out:
 *   - you can't delete, deactivate or change the role of your own account;
 *   - System Administrator accounts can't be deleted (only deactivated);
 *   - the last active System Administrator can't be deactivated or demoted.
 */
@Service
public class UserService {

    private static final int MIN_PASSWORD_LENGTH = 8;
    private static final int MAX_PASSWORD_LENGTH = 72;
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z0-9._-]{3,50}$");
    private static final String GENERATED_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
    private static final String GENERATED_DIGITS = "23456789";

    private final UserRepository users;
    private final BCryptPasswordEncoder passwordEncoder;
    private final UserCredentialsMailService credentialsMail;
    private final AuditService audit;
    private final SecureRandom random = new SecureRandom();

    public UserService(UserRepository users, BCryptPasswordEncoder passwordEncoder,
                       UserCredentialsMailService credentialsMail, AuditService audit) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.credentialsMail = credentialsMail;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listAll() {
        return users.findAllByOrderByRoleAscFirstNameAsc().stream().map(UserResponse::of).toList();
    }

    @Transactional
    public UserCreateResult create(UserRequest request, Integer createdBy) {
        validate(request, null);
        String password = request.password() == null ? "" : request.password();
        if (password.isEmpty()) {
            throw Validation.invalid("password", "Password is required for a new account.");
        }
        checkPassword(password);

        User user = new User();
        apply(user, request);
        user.setPassword(passwordEncoder.encode(password));
        user.setPasswordChangedAt(LocalDateTime.now());
        User saved = users.save(user);

        boolean sent = credentialsMail.send(saved, password, true);
        audit.log(createdBy, EmailLog.MODULE, sent ? EmailLog.CREDENTIALS : EmailLog.CREDENTIALS_FAILED,
                "New account for " + saved.getEmail());
        return new UserCreateResult(UserResponse.of(saved), sent, credentialsMail.isConfigured());
    }

    /**
     * "Send Email" (User Management): a fresh random password, emailed to the
     * account. The password is never shown in the UI or logged — only the
     * account holder receives it, by email.
     */
    @Transactional
    public boolean sendCredentials(int id, int currentUserId) {
        User user = users.findById(id).orElseThrow(UserService::notFound);
        String password = generatePassword();
        user.setPassword(passwordEncoder.encode(password));
        user.setPasswordChangedAt(LocalDateTime.now());
        boolean sent = credentialsMail.send(user, password, false);
        audit.log(currentUserId, EmailLog.MODULE, sent ? EmailLog.CREDENTIALS : EmailLog.CREDENTIALS_FAILED,
                (sent ? "New password emailed to " : "Could not email a new password to ") + user.getEmail());
        if (!sent) {
            throw unprocessable("The account's password was reset, but the email could not be sent. "
                    + "Check the mail settings, then try again or tell them the account needs a new password.");
        }
        return true;
    }

    @Transactional
    public UserResponse update(int id, UserRequest request, int currentUserId) {
        User user = users.findById(id).orElseThrow(UserService::notFound);
        validate(request, id);

        boolean active = request.active() == null || request.active();
        if (id == currentUserId && (!active || !user.getRole().equals(request.role()))) {
            throw unprocessable("You can't deactivate your own account or change your own role.");
        }
        boolean losesAdmin = Roles.SYSTEM_ADMINISTRATOR.equals(user.getRole()) && user.isActive()
                && (!active || !Roles.SYSTEM_ADMINISTRATOR.equals(request.role()));
        if (losesAdmin && users.countByRoleAndActiveTrue(Roles.SYSTEM_ADMINISTRATOR) <= 1) {
            throw unprocessable("This is the last active System Administrator account. Create another one first.");
        }

        String password = request.password() == null ? "" : request.password();
        if (!password.isEmpty()) {
            checkPassword(password);
        }

        apply(user, request);
        if (!password.isEmpty()) {
            user.setPassword(passwordEncoder.encode(password));
            user.setPasswordChangedAt(LocalDateTime.now());
        }
        return UserResponse.of(user);
    }

    @Transactional
    public void delete(int id, int currentUserId) {
        if (id == currentUserId) {
            throw unprocessable("You can't delete your own account.");
        }
        User user = users.findById(id).orElseThrow(UserService::notFound);
        if (Roles.SYSTEM_ADMINISTRATOR.equals(user.getRole())) {
            throw unprocessable("System Administrator accounts can't be deleted. Deactivate the account instead.");
        }
        users.delete(user);
    }

    /** Field-by-field checks in form order; the same rules run in js/form-validation.js. */
    private void validate(UserRequest r, Integer id) {
        Validation.name(r.firstName(), "firstName", "First name", true);
        Validation.name(r.lastName(), "lastName", "Last name", true);
        String username = Validation.requiredText(r.username(), "username", "Username", 50);
        if (!USERNAME.matcher(username).matches()) {
            throw Validation.invalid("username",
                    "Username must be 3–50 characters: letters, digits, periods (.), underscores (_) or hyphens (-).");
        }
        if (blank(r.role()) || !Roles.ALL.contains(r.role())) {
            throw Validation.invalid("role", "Role must be Payroll Master, Attendance Monitoring Staff or System Administrator.");
        }
        String email = Validation.email(r.email(), "email", "Email");
        Validation.phone(r.contactNumber(), "contactNumber", "Contact number");

        boolean usernameTaken = id == null
                ? users.existsByUsernameIgnoreCase(username)
                : users.existsByUsernameIgnoreCaseAndIdNot(username, id);
        if (usernameTaken) {
            throw Validation.invalid("username", "This username is already taken.");
        }
        boolean emailTaken = id == null
                ? users.existsByEmailIgnoreCase(email)
                : users.existsByEmailIgnoreCaseAndIdNot(email, id);
        if (emailTaken) {
            throw Validation.invalid("email", "This email address is already used by another account.");
        }
    }

    /** A 10-character random password: readable (no 0/O/1/l/I), a letter and a digit guaranteed. */
    private String generatePassword() {
        char[] chars = new char[10];
        chars[0] = GENERATED_LETTERS.charAt(random.nextInt(GENERATED_LETTERS.length()));
        chars[1] = GENERATED_DIGITS.charAt(random.nextInt(GENERATED_DIGITS.length()));
        String pool = GENERATED_LETTERS + GENERATED_DIGITS;
        for (int i = 2; i < chars.length; i++) {
            chars[i] = pool.charAt(random.nextInt(pool.length()));
        }
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }

    /** At least 8 characters, at most 72 (BCrypt ignores anything longer), with a letter and a digit. */
    public static void checkPassword(String password) {
        if (password.length() < MIN_PASSWORD_LENGTH || password.length() > MAX_PASSWORD_LENGTH
                || !password.matches(".*\\p{L}.*") || !password.matches(".*\\d.*")) {
            throw Validation.invalid("password", "Password must be " + MIN_PASSWORD_LENGTH + "–" + MAX_PASSWORD_LENGTH
                    + " characters and include at least one letter and one number.");
        }
    }

    private static void apply(User user, UserRequest r) {
        user.setFirstName(r.firstName().trim());
        user.setLastName(r.lastName().trim());
        user.setUsername(r.username().trim());
        user.setRole(r.role());
        user.setEmail(r.email().trim());
        user.setContactNumber(r.contactNumber().trim());
        user.setActive(r.active() == null || r.active());
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "User account not found.");
    }
}
