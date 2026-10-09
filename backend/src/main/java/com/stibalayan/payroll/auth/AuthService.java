package com.stibalayan.payroll.auth;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.user.User;
import com.stibalayan.payroll.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Checks credentials against the users table — the only accounts that can
 * log in (Payroll Master, Payroll Staff, System Administrator). Faculty and
 * administrative staff are employee records, not users.
 */
@Service
public class AuthService {

    // Deliberately the same error for "no such account" and "wrong password" so
    // login can't be used to discover which emails exist.
    private static final String INVALID_CREDENTIALS = "Incorrect email or password.";

    private final UserRepository users;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository users, BCryptPasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public SessionUser authenticate(String email, String password) {
        User user = users.findFirstByEmail(email)
                .filter(u -> u.getPassword() != null && passwordEncoder.matches(password, u.getPassword()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS));

        if (!user.isActive()) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "This account has been deactivated. Contact your System Administrator.");
        }
        if (!Roles.ALL.contains(user.getRole())) {
            // A row with any other role would get no permissions anyway; refuse it outright.
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "This account has no valid role. Contact your System Administrator.");
        }

        return new SessionUser(user.getId(), user.getFirstName() + " " + user.getLastName(), user.getEmail(), user.getRole());
    }
}
