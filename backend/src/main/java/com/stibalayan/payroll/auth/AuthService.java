package com.stibalayan.payroll.auth;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.user.User;
import com.stibalayan.payroll.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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

    // Brute-force protection for the public website: after MAX_FAILURES wrong
    // passwords in a row an email is locked for LOCK_TIME. Kept in memory, so a
    // restart clears it.
    private static final int MAX_FAILURES = 5;
    private static final Duration LOCK_TIME = Duration.ofMinutes(15);

    private record Failures(int count, Instant lockedUntil) {
    }

    private final Map<String, Failures> failures = new ConcurrentHashMap<>();

    private final UserRepository users;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthService(UserRepository users, BCryptPasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    /** Lifts a login lockout, e.g. after the password was reset. */
    public void clearFailures(String email) {
        failures.remove(email.trim().toLowerCase(Locale.ROOT));
    }

    public SessionUser authenticate(String email, String password) {
        String key = email.trim().toLowerCase(Locale.ROOT);
        Failures previous = failures.get(key);
        if (previous != null && previous.lockedUntil() != null && Instant.now().isBefore(previous.lockedUntil())) {
            long minutes = Math.max(1, Duration.between(Instant.now(), previous.lockedUntil()).toMinutes() + 1);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in "
                    + minutes + " minute" + (minutes == 1 ? "" : "s") + ".");
        }

        User user = users.findFirstByEmail(email)
                .filter(u -> u.getPassword() != null && passwordEncoder.matches(password, u.getPassword()))
                .orElse(null);
        if (user == null) {
            if (failures.size() > 10_000) failures.clear();   // never grows without bound
            failures.compute(key, (k, f) -> {
                int count = (f == null || f.lockedUntil() != null ? 0 : f.count()) + 1;
                return new Failures(count, count >= MAX_FAILURES ? Instant.now().plus(LOCK_TIME) : null);
            });
            throw new ApiException(HttpStatus.UNAUTHORIZED, INVALID_CREDENTIALS);
        }
        failures.remove(key);

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
