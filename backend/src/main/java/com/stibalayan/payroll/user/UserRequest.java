package com.stibalayan.payroll.user;

/**
 * Body of create/update requests from user-management.js.
 * password is required when creating; when editing, leave it empty to keep
 * the current password.
 */
public record UserRequest(
        String firstName,
        String lastName,
        String username,
        String role,
        String email,
        String contactNumber,
        String password,
        Boolean active) {
}
