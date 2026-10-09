package com.stibalayan.payroll.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Put on a controller class or method to say which module it belongs to.
 * The request is refused with 401 if nobody is logged in, and 403 if the
 * user's role may not use that module (see {@link SystemModule}). Endpoints
 * without this annotation are public (e.g. login).
 *
 * <pre>
 * &#64;RequireModule(SystemModule.EMPLOYEE_RECORD_MANAGEMENT)
 * </pre>
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireModule {

    SystemModule value();
}
