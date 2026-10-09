/**
 * Dropdown hints (window.PPSelectHint).
 *
 * A placeholder such as "Select type" or "All leave types" is shown as grey
 * hint text instead of being one of the choices. Mark it in the markup:
 *
 *   <select data-clearable>
 *       <option value="all" hidden data-hint>All leave types</option>
 *       ...
 *
 * The hint option stays the select's value while nothing is chosen (so
 * filter code that checks for "all" keeps working), but `hidden` keeps it
 * out of the list. Selects with data-clearable (filters) get a small ×
 * that resets them to the hint and fires "change" like a normal pick.
 */
(function () {
    'use strict';

    var enhanced = [];

    function hintOf(select) {
        return select.querySelector('option[data-hint]');
    }

    function sync(select) {
        var hint = hintOf(select);
        var showingHint = !!hint && select.value === hint.value;
        select.classList.toggle('pp-select-is-hint', showingHint);
        if (select._ppClear) {
            select._ppClear.hidden = showingHint || select.disabled;
        }
    }

    function enhance(select) {
        if (select._ppHint || !hintOf(select)) return;
        select._ppHint = true;
        enhanced.push(select);

        if (select.hasAttribute('data-clearable')) {
            var wrap = document.createElement('span');
            wrap.className = 'pp-select-wrap';
            select.parentNode.insertBefore(wrap, select);
            wrap.appendChild(select);

            var clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'pp-select-clear';
            clear.setAttribute('aria-label', 'Clear ' + (hintOf(select).textContent.trim() || 'filter'));
            clear.title = 'Clear';
            clear.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
            clear.addEventListener('click', function () {
                var hint = hintOf(select);
                if (!hint) return;
                select.value = hint.value;
                select.dispatchEvent(new Event('input', { bubbles: true }));
                select.dispatchEvent(new Event('change', { bubbles: true }));
                sync(select);
                select.focus();
            });
            wrap.appendChild(clear);
            select._ppClear = clear;
            select.classList.add('pp-select-has-clear');
        }

        select.addEventListener('change', function () { sync(select); });
        sync(select);
    }

    function enhanceAll(root) {
        (root || document).querySelectorAll('select').forEach(enhance);
    }

    function refresh() {
        enhanced.forEach(sync);
        enhanceAll();   // options built later by page scripts (e.g. employee pickers)
    }

    function start() {
        enhanceAll();
        // Page scripts sometimes set .value directly or reset forms, which
        // fires no event; keep the grey hint and × in step.
        document.addEventListener('reset', function () { setTimeout(refresh, 0); }, true);
        setInterval(refresh, 400);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    window.PPSelectHint = { refresh: refresh, enhance: enhance };
})();
