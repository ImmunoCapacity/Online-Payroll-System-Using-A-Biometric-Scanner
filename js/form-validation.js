/**
 * Shared input validation for every form (window.PPValidate).
 *
 * A field opts in with data attributes; the same rules run on the server
 * (backend common/Validation.java), which has the final say.
 *
 *   data-validate="name"             letters, spaces, - ' . (no digits)
 *   data-validate="phone"            09XXXXXXXXX or +639XXXXXXXXX
 *   data-validate="email"
 *   data-validate="employee-number"  11 digits, the format already in use
 *   data-validate="number"           not negative; data-decimals (default 2), min, max
 *   data-validate="gov-id"           digits/dashes; data-digits="10" or "9,12,14"
 *   data-validate="username"
 *   data-validate="password"         8–72 chars, a letter and a number
 *   data-validate="ipv4"
 *   data-validate="date"             data-not-future, data-not-past, data-min-age,
 *                                    data-max-age, data-after="otherId" (on or after;
 *                                    data-after-years="15" adds a gap), min, max
 *   data-validate="time"             data-after="otherId" (must be later)
 *   data-validate="text"             required/maxlength only, no blank-only text
 *   data-label="..."                 name used in messages (default: the <label>)
 *
 * Every [required] field is checked for a value, with or without
 * data-validate. Fields inside a hidden section (.d-none) or disabled are
 * skipped. A page can add its own rule: input.ppValidator = fn(value) -> message.
 *
 * Errors are shown beside the field in a Bootstrap .invalid-feedback element.
 */
(function () {
    'use strict';

    var NAME = /^\p{L}[\p{L}\p{M} .'’-]*$/u;
    var PHONE = /^(09\d{9}|\+639\d{9})$/;
    var EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
    var EMPLOYEE_NUMBER = /^\d{11}$/;
    var GOV_ID = /^\d[\d -]*\d$/;
    var USERNAME = /^[A-Za-z0-9._-]{3,50}$/;
    var IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

    // Characters each kind of field may hold; anything else is dropped as it is typed or pasted.
    var FILTERS = {
        'name': function (v) { return v.replace(/[^\p{L}\p{M} .'’-]/gu, ''); },
        'phone': function (v) {
            var plus = v.trim().charAt(0) === '+';
            return (plus ? '+' : '') + v.replace(/\D/g, '').slice(0, plus ? 12 : 11);
        },
        'employee-number': function (v) { return v.replace(/\D/g, '').slice(0, 11); },
        'gov-id': function (v) { return v.replace(/[^\d -]/g, ''); },
        'username': function (v) { return v.replace(/[^A-Za-z0-9._-]/g, ''); },
        'ipv4': function (v) { return v.replace(/[^\d.]/g, ''); }
    };

    function kind(input) {
        return input.getAttribute('data-validate') || '';
    }

    function today() {
        var d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function pad(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function shiftYears(isoDate, years) {
        return (Number(isoDate.slice(0, 4)) + years) + isoDate.slice(4);
    }

    function labelOf(input) {
        if (input.getAttribute('data-label')) return input.getAttribute('data-label');
        var label = input.id && document.querySelector('label[for="' + input.id + '"]');
        var text = label ? label.textContent : (input.getAttribute('placeholder') || 'This field');
        return text.replace(/\(₱\)|\*/g, '').replace(/\s+/g, ' ').trim();
    }

    function isSkipped(input) {
        return input.disabled || input.type === 'hidden' || input.type === 'button' || input.type === 'submit'
            || input.closest('.d-none') !== null;
    }

    /** The message for a field's current value, or '' when it is valid. */
    function check(input) {
        var type = kind(input);
        var label = labelOf(input);
        var raw = input.value == null ? '' : String(input.value);
        var value = input.type === 'password' ? raw : raw.trim();

        // Typed but unparseable dates, times and numbers come back as ''.
        if (input.validity && input.validity.badInput) {
            if (input.type === 'date') return 'Enter a complete, valid date.';
            if (input.type === 'time') return 'Enter a complete, valid time.';
            return 'Enter a valid number.';
        }

        if (value === '') {
            if (input.required) {
                return input.tagName === 'SELECT' ? 'Select ' + label.toLowerCase() + '.' : label + ' is required.';
            }
            return '';
        }

        var max = input.getAttribute('maxlength');
        if (max && value.length > Number(max)) {
            return label + ' can be at most ' + max + ' characters.';
        }

        var message = '';
        switch (type) {
            case 'name':
                if (!NAME.test(value)) message = label + ' can only contain letters, spaces, hyphens (-), apostrophes (\') and periods.';
                break;
            case 'phone':
                if (!PHONE.test(value)) message = 'Enter a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX.';
                break;
            case 'email':
                if (!EMAIL.test(value) || value.indexOf('..') !== -1 || value.length > 100) message = 'Enter a valid email address (e.g. name@example.com).';
                break;
            case 'employee-number':
                if (!EMPLOYEE_NUMBER.test(value)) message = 'Employee ID must be exactly 11 digits (e.g. 02000839239).';
                break;
            case 'number':
                message = checkNumber(input, value, label);
                break;
            case 'gov-id':
                message = checkGovId(input, value, label);
                break;
            case 'username':
                if (!USERNAME.test(value)) message = 'Username must be 3–50 characters: letters, digits, periods (.), underscores (_) or hyphens (-).';
                break;
            case 'password':
                if (value.length < 8 || value.length > 72 || !/\p{L}/u.test(value) || !/\d/.test(value)) {
                    message = 'Password must be 8–72 characters and include at least one letter and one number.';
                }
                break;
            case 'ipv4':
                if (!IPV4.test(value)) message = 'Enter a valid IPv4 address (e.g. 192.168.1.201).';
                break;
            case 'date':
                message = checkDate(input, value, label);
                break;
            case 'time':
                message = checkTime(input, value, label);
                break;
            case 'text':
            default:
                break;
        }
        if (message) return message;

        if (typeof input.ppValidator === 'function') {
            return input.ppValidator(value) || '';
        }
        return '';
    }

    function checkNumber(input, value, label) {
        if (!/^\d+(\.\d+)?$/.test(value)) {
            return /^-/.test(value) ? label + ' can\'t be negative.' : label + ' must be a number.';
        }
        var decimals = input.hasAttribute('data-decimals') ? Number(input.getAttribute('data-decimals')) : 2;
        var fraction = value.split('.')[1] || '';
        if (fraction.replace(/0+$/, '').length > decimals) {
            return decimals === 0 ? label + ' must be a whole number.'
                : label + ' can have at most ' + decimals + ' decimal place' + (decimals === 1 ? '.' : 's.');
        }
        var number = Number(value);
        var min = input.getAttribute('min');
        var max = input.getAttribute('max');
        if (min !== null && min !== '' && number < Number(min)) {
            return Number(min) > 0 ? label + ' must be at least ' + min + '.' : label + ' can\'t be negative.';
        }
        if (max !== null && max !== '' && number > Number(max)) {
            return label + ' can be at most ' + max + '.';
        }
        return '';
    }

    function checkGovId(input, value, label) {
        var counts = (input.getAttribute('data-digits') || '').split(',').map(Number);
        var digits = value.replace(/\D/g, '').length;
        if (!GOV_ID.test(value) || counts.indexOf(digits) === -1) {
            var list = counts.length > 1 ? counts.slice(0, -1).join(', ') + ' or ' + counts[counts.length - 1] : counts[0];
            return label + ' must be ' + list + ' digits (dashes allowed).';
        }
        return '';
    }

    function checkDate(input, value, label) {
        // Also rejects impossible dates such as 2026-02-30 (JS would roll them over).
        var parsed = new Date(value + 'T00:00:00');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(parsed.getTime())
                || parsed.getFullYear() + '-' + pad(parsed.getMonth() + 1) + '-' + pad(parsed.getDate()) !== value) {
            return 'Enter a complete, valid date.';
        }
        var now = today();
        if (input.hasAttribute('data-not-future') && value > now) return label + ' can\'t be in the future.';
        if (input.hasAttribute('data-not-past') && value < now) return label + ' can\'t be in the past.';
        var min = input.getAttribute('min');
        var max = input.getAttribute('max');
        if (min && value < min) return label + ' can\'t be before ' + min + '.';
        if (max && value > max) return label + ' can\'t be after ' + max + '.';
        var minAge = input.getAttribute('data-min-age');
        var maxAge = input.getAttribute('data-max-age');
        if ((minAge && value > shiftYears(now, -Number(minAge))) || (maxAge && value < shiftYears(now, -Number(maxAge)))) {
            return label + ' must make the employee ' + (minAge || 0) + ' to ' + (maxAge || 120) + ' years old.';
        }
        var other = otherField(input);
        var gapYears = Number(input.getAttribute('data-after-years') || 0);
        if (other && other.value && value < shiftYears(other.value, gapYears)) {
            return gapYears
                ? label + ' must be at least ' + gapYears + ' years after the ' + labelOf(other).toLowerCase() + '.'
                : label + ' can\'t be before ' + labelOf(other).toLowerCase() + '.';
        }
        return '';
    }

    function checkTime(input, value, label) {
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return 'Enter a complete, valid time.';
        var other = otherField(input);
        if (other && other.value && value.slice(0, 5) <= other.value.slice(0, 5)) {
            return label + ' must be later than ' + labelOf(other).toLowerCase() + '.';
        }
        return '';
    }

    function otherField(input) {
        var id = input.getAttribute('data-after');
        var other = id ? document.getElementById(id) : null;
        return other && !isSkipped(other) ? other : null;
    }

    // ---------------------------------------------------------------
    // Showing errors
    // ---------------------------------------------------------------

    function feedbackFor(input) {
        if (input._ppFeedback) return input._ppFeedback;
        // Reuse an .invalid-feedback that already sits after the field.
        var anchor = input.closest('.input-group') || input;
        var node = anchor.nextElementSibling;
        while (node && !node.classList.contains('invalid-feedback')) {
            if (node.matches('input:not([type="hidden"]), select, textarea, label, .input-group')) { node = null; break; }
            node = node.nextElementSibling;
        }
        if (!node) {
            node = document.createElement('div');
            node.className = 'invalid-feedback';
            anchor.insertAdjacentElement('afterend', node);
        }
        // Bootstrap only shows feedback that follows an .is-invalid sibling;
        // d-block makes it work after input groups and datalists too.
        input._ppFeedback = node;
        return node;
    }

    function setError(input, message) {
        if (!input) return;
        var feedback = feedbackFor(input);
        if (message) {
            input.classList.add('is-invalid');
            input.setAttribute('aria-invalid', 'true');
            feedback.textContent = message;
            feedback.classList.add('d-block');
        } else {
            clearError(input);
        }
    }

    function clearError(input) {
        if (!input) return;
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
        if (input._ppFeedback) {
            input._ppFeedback.classList.remove('d-block');
            input._ppFeedback.textContent = '';
        }
    }

    function validateField(input) {
        if (isSkipped(input)) {
            clearError(input);
            return true;
        }
        var message = check(input);
        setError(input, message);
        return !message;
    }

    function fields(form) {
        return Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'));
    }

    /** Checks every field; shows all errors and focuses the first. */
    function validateForm(form) {
        var first = null;
        fields(form).forEach(function (input) {
            if (!validateField(input) && !first) first = input;
        });
        if (first) {
            first.focus();
            if (first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        return !first;
    }

    function clear(form) {
        fields(form).forEach(clearError);
    }

    /** Applies the character filters to values the page filled in (e.g. old "0917-000-0000" numbers). */
    function sanitize(form) {
        fields(form).forEach(applyFilter);
    }

    function applyFilter(input) {
        var filter = FILTERS[kind(input)];
        if (!filter || input.value == null) return;
        var cleaned = filter(input.value);
        if (cleaned !== input.value) input.value = cleaned;
    }

    /**
     * Shows a server error ({ message, field }) beside its field.
     * fieldMap maps API field names to input ids. Returns false when the
     * error isn't about a field on this form (show it some other way).
     */
    function showServerError(form, data, fieldMap) {
        var id = data && data.field && fieldMap ? fieldMap[data.field] : null;
        var input = id ? document.getElementById(id) : null;
        if (!input || !form.contains(input) || isSkipped(input)) return false;
        setError(input, data.message);
        input.focus();
        return true;
    }

    // ---------------------------------------------------------------
    // Wiring (event delegation, so fields added later are covered too)
    // ---------------------------------------------------------------

    function attach(form) {
        if (!form || form._ppValidate) return;
        form._ppValidate = true;
        form.setAttribute('novalidate', '');

        form.addEventListener('input', function (event) {
            var input = event.target;
            if (!input.matches('input, textarea')) return;
            applyFilter(input);
            // Re-check as the user fixes a field that was marked invalid.
            if (input.classList.contains('is-invalid')) validateField(input);
            revalidateDependents(form, input);
        });

        form.addEventListener('change', function (event) {
            var input = event.target;
            if (input.matches('input, select, textarea') && (input.classList.contains('is-invalid') || input.value)) {
                validateField(input);
            }
            revalidateDependents(form, input);
        });

        form.addEventListener('focusout', function (event) {
            var input = event.target;
            if (input.matches('input, select, textarea') && (input.value || input.classList.contains('is-invalid'))) {
                validateField(input);
            }
        });

        // Number fields: no exponent or sign characters ("1e5", "-3").
        form.addEventListener('keydown', function (event) {
            var input = event.target;
            if (input.type !== 'number' || event.ctrlKey || event.metaKey) return;
            var noDecimals = input.getAttribute('data-decimals') === '0';
            if (['e', 'E', '+', '-'].indexOf(event.key) !== -1 || (noDecimals && (event.key === '.' || event.key === ','))) {
                event.preventDefault();
            }
        });
    }

    /** Re-checks fields that compare against this one (e.g. time-out vs time-in). */
    function revalidateDependents(form, input) {
        if (!input.id) return;
        form.querySelectorAll('[data-after="' + input.id + '"]').forEach(function (dependent) {
            if (dependent.value) validateField(dependent);
        });
    }

    function attachAll() {
        document.querySelectorAll('form').forEach(attach);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachAll);
    } else {
        attachAll();
    }

    window.PPValidate = {
        attach: attach,
        validateField: validateField,
        validateForm: validateForm,
        setError: setError,
        clearError: clearError,
        clear: clear,
        sanitize: sanitize,
        showServerError: showServerError,
        check: check,
        today: today
    };
})();
