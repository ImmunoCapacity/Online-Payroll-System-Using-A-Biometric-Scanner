package com.stibalayan.payroll.user;

/** Result of creating a system account, for the "User added" toast. */
public record UserCreateResult(UserResponse user, boolean emailSent, boolean mailConfigured) {
}
