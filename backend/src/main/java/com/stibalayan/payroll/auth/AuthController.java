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

    public AuthController(AuthService authService, AuthInterceptor authInterceptor) {
        this.authService = authService;
        this.authInterceptor = authInterceptor;
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
