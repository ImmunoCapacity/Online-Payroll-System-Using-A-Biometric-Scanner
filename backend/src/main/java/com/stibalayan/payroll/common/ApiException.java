package com.stibalayan.payroll.common;

import org.springframework.http.HttpStatus;

/**
 * Thrown anywhere in a request to stop it with a status code and a message
 * the frontend can show as-is. Rendered as { success: false, message } plus
 * { field } when the error belongs to one input, so the page can show the
 * message beside that field.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String field;

    public ApiException(HttpStatus status, String message) {
        this(status, message, null);
    }

    public ApiException(HttpStatus status, String message, String field) {
        super(message);
        this.status = status;
        this.field = field;
    }

    public HttpStatus getStatus() {
        return status;
    }

    /** The request field the error is about (e.g. "phone"), or null. */
    public String getField() {
        return field;
    }
}
