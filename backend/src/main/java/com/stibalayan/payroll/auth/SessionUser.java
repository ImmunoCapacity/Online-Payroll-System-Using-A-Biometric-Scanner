package com.stibalayan.payroll.auth;

import java.io.Serializable;

/**
 * The logged-in user as kept in the HTTP session and returned to the
 * frontend. id is users.user_id; role is one of {@link Roles}.
 */
public record SessionUser(int id, String name, String email, String role) implements Serializable {

    public static final String SESSION_KEY = "user";
}
