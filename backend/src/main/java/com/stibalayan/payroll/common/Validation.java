package com.stibalayan.payroll.common;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/**
 * Input rules shared by the services. The same rules run in the browser
 * (js/form-validation.js); these are the ones that count, because they stop
 * bad data before it reaches the database.
 *
 * Each check takes the request field name so the error can be shown beside
 * the right input, and a label for the message. Optional values come back as
 * null when blank.
 */
public final class Validation {

    /** Letters (any language, e.g. ñ), spaces, hyphens, apostrophes and periods ("Ma.", "Jr."); no digits. */
    private static final Pattern NAME = Pattern.compile("^\\p{L}[\\p{L}\\p{M} .'’-]*$");

    /** Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX. */
    private static final Pattern PHONE_PH = Pattern.compile("^(09\\d{9}|\\+639\\d{9})$");

    private static final Pattern EMAIL =
            Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\\.[A-Za-z]{2,}$");

    /** Employee number format already in use: 11 digits (e.g. 02000839239). */
    private static final Pattern EMPLOYEE_NUMBER = Pattern.compile("^\\d{11}$");

    /** Digits with optional dashes or spaces between groups (government ID numbers). */
    private static final Pattern GOV_ID = Pattern.compile("^\\d[\\d -]*\\d$");

    private Validation() {
    }

    public static String requiredText(String value, String field, String label, int maxLength) {
        String text = trim(value);
        if (text.isEmpty()) {
            throw invalid(field, label + " is required.");
        }
        if (text.length() > maxLength) {
            throw invalid(field, label + " can be at most " + maxLength + " characters.");
        }
        return text;
    }

    /** Optional free text; null when blank. */
    public static String optionalText(String value, String field, String label, int maxLength) {
        String text = trim(value);
        if (text.isEmpty()) {
            return null;
        }
        if (text.length() > maxLength) {
            throw invalid(field, label + " can be at most " + maxLength + " characters.");
        }
        return text;
    }

    public static String name(String value, String field, String label, boolean required) {
        String text = required ? requiredText(value, field, label, 50) : optionalText(value, field, label, 50);
        if (text != null && !NAME.matcher(text).matches()) {
            throw invalid(field, label + " can only contain letters, spaces, hyphens (-), apostrophes (') and periods.");
        }
        return text;
    }

    public static String phone(String value, String field, String label) {
        String text = requiredText(value, field, label, 13);
        if (!PHONE_PH.matcher(text).matches()) {
            throw invalid(field, label + " must be a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.");
        }
        return text;
    }

    public static String email(String value, String field, String label) {
        String text = requiredText(value, field, label, 100);
        if (!EMAIL.matcher(text).matches() || text.contains("..")) {
            throw invalid(field, "Enter a valid email address (e.g. name@example.com).");
        }
        return text;
    }

    public static String employeeNumber(String value, String field) {
        String text = requiredText(value, field, "Employee ID", 50);
        if (!EMPLOYEE_NUMBER.matcher(text).matches()) {
            throw invalid(field, "Employee ID must be exactly 11 digits (e.g. 02000839239).");
        }
        return text;
    }

    /**
     * Optional government ID: digits with optional dashes or spaces, and one
     * of the allowed digit counts (e.g. SSS has 10).
     */
    public static String governmentId(String value, String field, String label, int... digitCounts) {
        String text = optionalText(value, field, label, 50);
        if (text == null) {
            return null;
        }
        int digits = text.replaceAll("\\D", "").length();
        boolean countOk = false;
        for (int n : digitCounts) {
            countOk |= digits == n;
        }
        if (!GOV_ID.matcher(text).matches() || !countOk) {
            throw invalid(field, label + " must be " + describe(digitCounts) + " digits (dashes allowed).");
        }
        return text;
    }

    /** Optional peso amount: not negative, at most 2 decimal places, at most max. */
    public static BigDecimal money(BigDecimal value, String field, String label, BigDecimal max) {
        return decimal(value, field, label, 2, max);
    }

    /** Optional non-negative decimal with at most scale decimal places, at most max. */
    public static BigDecimal decimal(BigDecimal value, String field, String label, int scale, BigDecimal max) {
        if (value == null) {
            return null;
        }
        if (value.signum() < 0) {
            throw invalid(field, label + " can't be negative.");
        }
        if (value.stripTrailingZeros().scale() > scale) {
            throw invalid(field, label + (scale == 0 ? " must be a whole number." : " can have at most " + scale + " decimal place" + (scale == 1 ? "." : "s.")));
        }
        if (value.compareTo(max) > 0) {
            throw invalid(field, label + " can be at most " + max.toPlainString() + ".");
        }
        return value;
    }

    /** Optional whole number from 0 to max. */
    public static Integer wholeNumber(Integer value, String field, String label, int max) {
        if (value == null) {
            return null;
        }
        if (value < 0) {
            throw invalid(field, label + " can't be negative.");
        }
        if (value > max) {
            throw invalid(field, label + " can be at most " + max + ".");
        }
        return value;
    }

    /** A date in YYYY-MM-DD form; null when blank and not required. */
    public static LocalDate date(String value, String field, String label, boolean required) {
        String text = trim(value);
        if (text.isEmpty()) {
            if (required) {
                throw invalid(field, label + " is required.");
            }
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException e) {
            throw invalid(field, label + " must be a valid date (YYYY-MM-DD).");
        }
    }

    /** A time in HH:mm form; null when blank and not required. */
    public static LocalTime time(String value, String field, String label, boolean required) {
        String text = trim(value);
        if (text.isEmpty()) {
            if (required) {
                throw invalid(field, label + " is required.");
            }
            return null;
        }
        try {
            return LocalTime.parse(text);
        } catch (DateTimeParseException e) {
            throw invalid(field, label + " must be a valid time (HH:mm).");
        }
    }

    /** A 422 error tied to one request field. */
    public static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message, field);
    }

    private static String describe(int[] counts) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < counts.length; i++) {
            if (i > 0) {
                text.append(i == counts.length - 1 ? " or " : ", ");
            }
            text.append(counts[i]);
        }
        return text.toString();
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
