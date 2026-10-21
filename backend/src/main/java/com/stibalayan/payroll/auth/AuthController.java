package com.stibalayan.payroll.auth;

import com.stibalayan.payroll.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AuthInterceptor authInterceptor;
    private final PasswordResetService passwordReset;

    public AuthController(AuthService authService, AuthInterceptor authInterceptor, PasswordResetService passwordReset) {
        this.authService = authService;
        this.authInterceptor = authInterceptor;
        this.passwordReset = passwordReset;
    }

    // ---- Forgot Password (no login needed) ----

    /**
     * The email a reset was started for. It is fixed for the rest of the
     * reset: the code check and the new password use this one, never an
     * email sent by the browser, so a reset can't be switched to another
     * account half-way.
     */
    private static final String RESET_EMAIL = "passwordResetEmail";

    /** Body: { email } (step 1), or {} to resend the code to the same email. */
    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String email = body.get("email");
        HttpSession session = request.getSession(true);
        if (email == null || email.isBlank()) {
            email = (String) session.getAttribute(RESET_EMAIL);   // Resend code
            if (email == null) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "This reset has expired. Start again.");
            }
        }
        passwordReset.requestCode(email);
        session.setAttribute(RESET_EMAIL, email.trim());
        return Map.of("success", true, "message",
                "If an account uses this email, a 6-digit code has been sent to it. It expires in 10 minutes.");
    }

    /** Body: { code }. Returns a resetToken for /reset-password. */
    @PostMapping("/verify-otp")
    public Map<String, Object> verifyOtp(@RequestBody Map<String, String> body, HttpServletRequest request) {
        return Map.of("success", true, "resetToken", passwordReset.verifyCode(resetEmail(request), body.get("code")));
    }

    /** Body: { resetToken, password, confirmPassword }. */
    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@RequestBody Map<String, String> body, HttpServletRequest request) {
        passwordReset.resetPassword(resetEmail(request), body.get("resetToken"), body.get("password"), body.get("confirmPassword"));
        request.getSession().removeAttribute(RESET_EMAIL);
        return Map.of("success", true, "message", "Your password has been changed. You can now log in.");
    }

    private static String resetEmail(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        String email = session == null ? null : (String) session.getAttribute(RESET_EMAIL);
        if (email == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "This reset has expired. Start again.");
        }
        return email;
    }

    /** Body: { "email": "...", "password": "..." } */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String email = body.get("email");
        email = email == null ? "" : email.trim();
        String password = body.get("password");

        if (email.isEmpty() || password == null || password.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Email and password are required.");
        }

        SessionUser user = authService.authenticate(email, password);

        // New session id on login, so a session id planted before login is useless.
        request.getSession(true);
        request.changeSessionId();
        request.getSession().setAttribute(SessionUser.SESSION_KEY, user);

        return Map.of("success", true, "user", user);
    }

    @PostMapping("/logout")
    public Map<String, Object> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return Map.of("success", true, "message", "Logged out.");
    }

    /** The currently logged-in user, or 401. */
    @GetMapping("/session")
    public Map<String, Object> session(HttpServletRequest request) {
        SessionUser user = authInterceptor.refreshedUser(request);
        if (user == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Not logged in.");
        }
        return Map.of("success", true, "user", user);
    }
}
