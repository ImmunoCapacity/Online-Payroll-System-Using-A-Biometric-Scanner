package com.stibalayan.payroll.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stibalayan.payroll.user.User;
import com.stibalayan.payroll.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link RequireModule}: 401 when nobody is logged in, 403 when the
 * logged-in user's role may not use the endpoint's module.
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final ObjectMapper objectMapper;
    private final UserRepository users;

    public AuthInterceptor(ObjectMapper objectMapper, UserRepository users) {
        this.objectMapper = objectMapper;
        this.users = users;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }

        RequireModule rule = method.getMethodAnnotation(RequireModule.class);
        if (rule == null) {
            rule = method.getBeanType().getAnnotation(RequireModule.class);
        }
        if (rule == null) {
            return true;
        }

        SessionUser user = refreshedUser(request);
        if (user == null) {
            return reject(response, HttpStatus.UNAUTHORIZED, "You must be logged in to do that.");
        }
        if (!rule.value().allows(user.role())) {
            return reject(response, HttpStatus.FORBIDDEN, "Your account role does not have access to this module.");
        }
        return true;
    }

    /**
     * The session user, re-checked against the users table so that an account
     * deactivated, deleted or given another role by the System Administrator
     * takes effect on the very next request. Returns null (and ends the
     * session) if the account may no longer log in.
     */
    public SessionUser refreshedUser(HttpServletRequest request) {
        SessionUser user = currentUser(request);
        if (user == null) {
            return null;
        }

        User account = users.findById(user.id()).orElse(null);
        if (account == null || !account.isActive() || !Roles.ALL.contains(account.getRole())) {
            request.getSession().invalidate();
            return null;
        }

        if (!account.getRole().equals(user.role())) {
            user = new SessionUser(user.id(), user.name(), user.email(), account.getRole());
            request.getSession().setAttribute(SessionUser.SESSION_KEY, user);
        }
        return user;
    }

    public static SessionUser currentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        return session == null ? null : (SessionUser) session.getAttribute(SessionUser.SESSION_KEY);
    }

    private boolean reject(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Map.of("success", false, "message", message));
        return false;
    }
}
