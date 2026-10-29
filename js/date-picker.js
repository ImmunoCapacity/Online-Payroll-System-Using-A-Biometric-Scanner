/**
 * Upgrades every native type="date"/"time" .pp-form-control input to
 * Flatpickr (vendor/flatpickr): a custom-styled, theme-aware calendar/time
 * popup. The OS's own native picker (Firefox's especially) can't be
 * restyled with CSS at all, which is why this exists.
 *
 * The input keeps its id and disabled/required state, and its .value stays
 * in exactly the format the rest of the app already reads and writes —
 * "YYYY-MM-DD" for dates, 24-hour "HH:MM" for times — so no other file
 * needs to change. js/form-validation.js's data-validate="date"/"time"
 * rules (data-not-future, data-min-age, data-after, …) keep running
 * unchanged; this only adds matching minDate/maxDate so the calendar
 * itself reflects them too.
 *
 * If vendor/flatpickr fails to load, inputs are left as native
 * type="date"/"time" — css/payrollpro.css has a plain restyling fallback
 * for that case.
 */
(function () {
    'use strict';

    if (typeof flatpickr === 'undefined') {
        return;
    }

    function pad(n) {
        return (n < 10 ? '0' : '') + n;
    }

    function todayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    /** "2008-06-01" shifted by (possibly negative) years, same month/day. */
    function shiftYears(iso, years) {
        var m = /^(\d{4})(-\d{2}-\d{2})$/.exec(iso);
        return m ? (Number(m[1]) + years) + m[2] : iso;
    }

    /** A clickable calendar/clock icon at the right edge of the field. */
    function addIcon(input, isTime) {
        var wrap = document.createElement('span');
        wrap.className = 'pp-date-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        var icon = document.createElement('i');
        icon.className = 'pp-date-icon bi ' + (isTime ? 'bi-clock' : 'bi-calendar3');
        icon.setAttribute('aria-hidden', 'true');
        wrap.appendChild(icon);

        icon.addEventListener('click', function () {
            if (!input.disabled && input._flatpickr) input._flatpickr.open();
        });
    }

    function setup(input) {
        var isTime = input.type === 'time';

        // Fixed bounds from the markup (min/max/data-not-future/data-min-age/
        // data-max-age); data-after is dynamic (depends on another field's
        // current value), handled live in onOpen below instead.
        var minDate = input.getAttribute('min') || null;
        var maxDate = input.hasAttribute('data-not-future') ? todayIso() : (input.getAttribute('max') || null);

        var minAge = input.getAttribute('data-min-age');
        if (minAge) {
            var ageMax = shiftYears(todayIso(), -Number(minAge));
            if (!maxDate || ageMax < maxDate) maxDate = ageMax;
        }
        var maxAge = input.getAttribute('data-max-age');
        if (maxAge) {
            var ageMin = shiftYears(todayIso(), -Number(maxAge));
            if (!minDate || ageMin > minDate) minDate = ageMin;
        }

        input.type = 'text';
        input.setAttribute('autocomplete', 'off');
        addIcon(input, isTime);

        // Escape is a real DOM keydown here (unlike a native picker, which
        // the browser handles outside the page), so it bubbles up to
        // Bootstrap's modal and closes the whole form. Stop it from
        // leaving the input when it's only meant to close the popup.
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && input._flatpickr && input._flatpickr.isOpen) {
                e.stopPropagation();
                input._flatpickr.close();
            }
        });

        // Bootstrap's modal focus trap steals focus back from anything
        // appended outside the modal; appending the calendar inside it
        // (Bootstrap's .modal is a fixed, full-viewport layer, so the
        // popup still positions correctly) avoids that, and also escapes
        // .modal-body's scroll clipping. Fields outside a modal use the
        // default (document.body).
        var modal = input.closest('.modal');

        var options = {
            allowInput: true,
            appendTo: modal || undefined,
            dateFormat: isTime ? 'H:i' : 'Y-m-d',
            minDate: minDate || undefined,
            maxDate: maxDate || undefined,
            onOpen: function (selectedDates, dateStr, instance) {
                // Other code sets .value directly (e.g. opening the Edit
                // Employee modal); make sure the popup reflects it.
                instance.setDate(instance.input.value || null, false);

                var afterId = input.getAttribute('data-after');
                var other = afterId ? document.getElementById(afterId) : null;
                if (other && other.value) {
                    if (isTime) {
                        instance.set('minTime', other.value);
                    } else {
                        var gapYears = Number(input.getAttribute('data-after-years') || 0);
                        instance.set('minDate', gapYears ? shiftYears(other.value, gapYears) : other.value);
                    }
                }
            }
        };

        if (isTime) {
            options.enableTime = true;
            options.noCalendar = true;
            options.time_24hr = true;
        }

        flatpickr(input, options);
    }

    function init() {
        document.querySelectorAll('input.pp-form-control[type="date"], input.pp-form-control[type="time"]')
            .forEach(setup);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
