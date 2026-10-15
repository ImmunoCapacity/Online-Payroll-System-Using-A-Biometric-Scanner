package com.stibalayan.payroll.user;

/** A system account as sent to the browser — never includes the password. */
public record UserResponse(
        int id,
        String firstName,
        String lastName,
        String username,
        String role,
        String email,
        String contactNumber,
        boolean active,
        String passwordChangedAt) {

    static UserResponse of(User u) {
        return new UserResponse(u.getId(), u.getFirstName(), u.getLastName(), u.getUsername(), u.getRole(),
                u.getEmail(), u.getContactNumber(), u.isActive(),
                u.getPasswordChangedAt() == null ? null : u.getPasswordChangedAt().toString());
    }
}
