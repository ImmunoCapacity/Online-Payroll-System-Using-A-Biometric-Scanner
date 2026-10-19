/**
 * Payroll Processing → Payroll Adjustment (api/payroll/adjustments/grid).
 *
 * A grid per cut-off: one row per employee. For each employee the Payroll
 * Master enters the days being corrected (Date From – Date To; days = working
 * days, Mon–Fri), hours per day to ADD and/or DEDUCT, and a reason.
 * Amounts = hours × days × rate (the rate on Date From); Total = addition −
 * deduction, added to that cut-off's pay when payroll is computed. The
 * server recomputes everything when saving; this page shows the same numbers
 * as you type. A released cut-off is read-only.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'payroll',
        navMode: 'master',
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var el = function (id) { return document.getElementById(id); };
    var grid = null;          // { applyStart, applyEnd, released, rows }
    var state = {};           // employeeId -> { dateFrom, dateTo, addHours, deductHours, reason }
    var saved = {};           // employeeId -> the same, as last saved (to spot changes)
    var ratesByDate = {};     // 'YYYY-MM-DD' -> { employeeId: { office, teaching } }
    var currentCutoff = '';

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function api(url, method, body) {
        return fetch(url, {
            method: method || 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) { return r.json(); });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function cutoffLabel(start, end) {
        var a = parseIso(start);
        var b = parseIso(end);
        return a.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + ' – ' +
            b.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function money(n) {
        return (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function round2(n) {
        return Math.round(n * 100) / 100;
    }

    /** Cut-offs: the 11th–25th, and the 26th to the 10th of the next month. */
    function cutoffContaining(date) {
        var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
        if (d >= 11 && d <= 25) return { start: iso(new Date(y, m, 11)), end: iso(new Date(y, m, 25)) };
        if (d >= 26) return { start: iso(new Date(y, m, 26)), end: iso(new Date(y, m + 1, 10)) };
        return { start: iso(new Date(y, m - 1, 26)), end: iso(new Date(y, m, 10)) };
    }

    /** Six cut-offs back (to view), the current one, and the next five. */
    function cutoffChoices() {
        var current = cutoffContaining(new Date());
        var list = [current];
        var c = current;
        for (var i = 0; i < 6; i++) {
            var before = parseIso(c.start);
            before.setDate(before.getDate() - 1);
            c = cutoffContaining(before);
            list.unshift(c);
        }
        c = current;
        for (var j = 0; j < 5; j++) {
            var after = parseIso(c.end);
            after.setDate(after.getDate() + 1);
            c = cutoffContaining(after);
            list.push(c);
        }
        return { list: list, current: current };
    }

    /** Monday–Friday days from one date to another, inclusive (same rule as the server). */
    function workdays(from, to) {
        if (!from || !to || to < from) return 0;
        var d = parseIso(from);
        var end = parseIso(to);
        var days = 0;
        while (d <= end) {
            if (d.getDay() !== 0 && d.getDay() !== 6) days++;
            d.setDate(d.getDate() + 1);
        }
        return days;
    }

    function num(value) {
        var n = parseFloat(value);
        return isFinite(n) && n > 0 ? n : 0;
    }

    function rowOf(employeeId) {
        return grid.rows.find(function (r) { return r.employeeId === employeeId; });
    }

    function isLocked(row) {
        return grid.released || row.status === 'Applied';
    }

    /** Rate for the row: the rate on Date From if known, else the rate shown. */
    function rateFor(row) {
        var s = state[row.employeeId];
        var onDate = s.dateFrom && ratesByDate[s.dateFrom] ? ratesByDate[s.dateFrom][row.employeeId] : null;
        if (onDate) {
            var r = row.type === 'Faculty' ? onDate.teaching : onDate.office;
            if (r != null) return Number(r);
        }
        return Number(row.rate) || 0;
    }

    function loadRatesFor(date) {
        if (!date || ratesByDate[date]) return Promise.resolve();
        ratesByDate[date] = {};
        return api('api/payroll/rates?date=' + date).then(function (data) {
            if (data.success) ratesByDate[date] = data.rates || {};
        }).catch(function () { delete ratesByDate[date]; });
    }

    function compute(row) {
        var s = state[row.employeeId];
        var days = workdays(s.dateFrom, s.dateTo);
        var rate = rateFor(row);
        var add = round2(num(s.addHours) * days * rate);
        var deduct = round2(num(s.deductHours) * days * rate);
        return { days: days, rate: rate, add: add, deduct: deduct, total: round2(add - deduct) };
    }

    function snapshot(row) {
        return {
            dateFrom: row.dateFrom || '',
            dateTo: row.dateTo || '',
            addHours: row.addHours != null && Number(row.addHours) ? String(Number(row.addHours)) : '',
            deductHours: row.deductHours != null && Number(row.deductHours) ? String(Number(row.deductHours)) : '',
            reason: row.reason || ''
        };
    }

    function isChanged(employeeId) {
        var a = state[employeeId];
        var b = saved[employeeId];
        return ['dateFrom', 'dateTo', 'addHours', 'deductHours', 'reason'].some(function (k) {
            return String(a[k] || '').trim() !== String(b[k] || '').trim();
        });
    }

    function hasChanges() {
        return grid && grid.rows.some(function (r) { return isChanged(r.employeeId); });
    }

    // ---------------------------------------------------------------
    // Loading and rendering
    // ---------------------------------------------------------------

    function fillCutoffs() {
        var choices = cutoffChoices();
        el('cutoffSelect').innerHTML = choices.list.map(function (c) {
            var value = c.start + '|' + c.end;
            var now = c.start === choices.current.start ? ' (current)' : '';
            return '<option value="' + value + '">' + cutoffLabel(c.start, c.end) + now + '</option>';
        }).join('');
        el('cutoffSelect').value = choices.current.start + '|' + choices.current.end;
        currentCutoff = el('cutoffSelect').value;
    }

    function load() {
        var c = el('cutoffSelect').value.split('|');
        el('adjustmentBody').innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Loading…</td></tr>';
        el('adjustmentFoot').innerHTML = '';
        return api('api/payroll/adjustments/grid?from=' + c[0] + '&to=' + c[1]).then(function (data) {
            if (!data.success) {
                throw new Error(data.message === 'Not Found.'
                    ? 'The server doesn\'t have Payroll Adjustment yet. Restart it with start-payroll.bat.'
                    : data.message || 'Could not load the adjustments.');
            }
            grid = data.grid;
            state = {};
            saved = {};
            grid.rows.forEach(function (r) {
                state[r.employeeId] = snapshot(r);
                saved[r.employeeId] = snapshot(r);
            });
            // Rates on the saved Date From values, so the totals match the saved amounts.
            var dates = grid.rows.map(function (r) { return r.dateFrom; }).filter(Boolean);
            return Promise.all(dates.filter(function (d, i) { return dates.indexOf(d) === i; }).map(loadRatesFor));
        }).then(function () {
            if (grid) render();
        }).catch(function (error) {
            grid = null;
            el('adjustmentBody').innerHTML = '';
            el('emptyState').textContent = error.message || 'Could not load the adjustments. Is the backend running?';
            el('emptyState').classList.remove('d-none');
        });
    }

    function render() {
        el('emptyState').classList.add('d-none');
        el('saveAdjustmentsBtn').disabled = !!grid.released;
        el('adjustmentHint').querySelector('span').textContent = grid.released
            ? 'This cut-off\'s payroll is released, so its adjustments are paid and can no longer be changed.'
            : 'Addition and Deduction are hours per day. Days are working days (Mon–Fri) from Date From to Date To; ' +
              'amounts = hours × days × rate. The Total is added to (or taken from) this cut-off\'s pay when payroll is computed.';

        if (!grid.rows.length) {
            el('adjustmentBody').innerHTML = '';
            el('emptyState').textContent = 'No employees.';
            el('emptyState').classList.remove('d-none');
            return;
        }
        el('adjustmentBody').innerHTML = grid.rows.map(function (r) {
            var s = state[r.employeeId];
            var locked = isLocked(r);
            var dis = locked ? ' disabled' : '';
            var id = escapeHtml(r.employeeId);
            return '<tr data-id="' + id + '" class="' + (locked && r.status ? 'is-locked' : '') + '">' +
                '<td>' + escapeHtml(r.employeeNumber) + '</td>' +
                '<td><strong>' + escapeHtml(r.name) + '</strong>' +
                    (r.status === 'Applied' ? '<span class="pp-adjust-lock" title="Paid when the cut-off was released"><i class="bi bi-lock-fill"></i></span>' : '') + '</td>' +
                '<td>' + escapeHtml(r.type) + '</td>' +
                '<td class="text-end" data-cell="rate"></td>' +
                '<td><div class="pp-adjust-dates">' +
                    '<input type="date" class="form-control pp-form-control pp-cell pp-cell-date" data-field="dateFrom" value="' + escapeHtml(s.dateFrom) + '" max="' + grid.applyEnd + '" aria-label="Date from for ' + escapeHtml(r.name) + '"' + dis + '>' +
                    '<span>–</span>' +
                    '<input type="date" class="form-control pp-form-control pp-cell pp-cell-date" data-field="dateTo" value="' + escapeHtml(s.dateTo) + '" max="' + grid.applyEnd + '" aria-label="Date to for ' + escapeHtml(r.name) + '"' + dis + '>' +
                '</div></td>' +
                '<td class="text-end" data-cell="days"></td>' +
                '<td class="text-end"><input type="number" class="form-control pp-form-control pp-cell pp-cell-hours" data-field="addHours" min="0" max="24" step="0.5" inputmode="decimal" value="' + escapeHtml(s.addHours) + '" aria-label="Addition hours per day for ' + escapeHtml(r.name) + '"' + dis + '></td>' +
                '<td class="text-end amount-add" data-cell="add"></td>' +
                '<td class="text-end"><input type="number" class="form-control pp-form-control pp-cell pp-cell-hours" data-field="deductHours" min="0" max="24" step="0.5" inputmode="decimal" value="' + escapeHtml(s.deductHours) + '" aria-label="Deduction hours per day for ' + escapeHtml(r.name) + '"' + dis + '></td>' +
                '<td class="text-end amount-deduct" data-cell="deduct"></td>' +
                '<td class="text-end amount-total" data-cell="total"></td>' +
                '<td><input type="text" class="form-control pp-form-control pp-cell pp-cell-reason" data-field="reason" maxlength="200" placeholder="Reason" value="' + escapeHtml(s.reason) + '" aria-label="Reason for ' + escapeHtml(r.name) + '"' + dis + '></td>' +
            '</tr>';
        }).join('');
        grid.rows.forEach(function (r) { updateRow(r.employeeId); });
        applySearch();
        updateTotals();
    }

    /** Recomputes one row's read-only cells, without re-rendering its inputs. */
    function updateRow(employeeId) {
        var tr = el('adjustmentBody').querySelector('tr[data-id="' + CSS.escape(employeeId) + '"]');
        if (!tr) return;
        var row = rowOf(employeeId);
        var c = compute(row);
        tr.querySelector('[data-cell="rate"]').textContent = money(c.rate);
        tr.querySelector('[data-cell="days"]').textContent = c.days || '';
        tr.querySelector('[data-cell="add"]').textContent = c.add ? money(c.add) : '';
        tr.querySelector('[data-cell="deduct"]').textContent = c.deduct ? '−' + money(c.deduct) : '';
        var total = tr.querySelector('[data-cell="total"]');
        total.textContent = c.total ? (c.total > 0 ? '+' : '−') + money(Math.abs(c.total)) : '';
        total.classList.toggle('amount-add', c.total > 0);
        total.classList.toggle('amount-deduct', c.total < 0);
        tr.classList.toggle('is-changed', isChanged(employeeId));
    }

    function updateTotals() {
        var add = 0, deduct = 0, count = 0;
        grid.rows.forEach(function (r) {
            var c = compute(r);
            add += c.add;
            deduct += c.deduct;
            if (c.add || c.deduct) count++;
        });
        var total = round2(add - deduct);
        el('adjustmentFoot').innerHTML = '<tr>' +
            '<th colspan="7">' + count + ' employee' + (count === 1 ? '' : 's') + ' adjusted</th>' +
            '<th class="text-end amount-add">' + money(add) + '</th>' +
            '<th></th>' +
            '<th class="text-end amount-deduct">' + (deduct ? '−' + money(deduct) : money(0)) + '</th>' +
            '<th class="text-end amount-total">' + (total < 0 ? '−' : total > 0 ? '+' : '') + money(Math.abs(total)) + '</th>' +
            '<th></th></tr>';
    }

    function applySearch() {
        var q = el('adjustmentSearch').value.trim().toLowerCase();
        el('adjustmentBody').querySelectorAll('tr[data-id]').forEach(function (tr) {
            var r = rowOf(tr.dataset.id);
            tr.style.display = !q || (r.employeeNumber + ' ' + r.name).toLowerCase().indexOf(q) !== -1 ? '' : 'none';
        });
    }

    // ---------------------------------------------------------------
    // Editing
    // ---------------------------------------------------------------

    el('adjustmentBody').addEventListener('input', function (e) {
        var input = e.target.closest('[data-field]');
        if (!input) return;
        var employeeId = input.closest('tr').dataset.id;
        state[employeeId][input.dataset.field] = input.value;
        input.classList.remove('is-invalid');
        // Leaving Date To empty: use Date From (a single day).
        if (input.dataset.field === 'dateFrom') {
            var to = input.closest('tr').querySelector('[data-field="dateTo"]');
            if (!to.value && input.value) {
                to.value = input.value;
                state[employeeId].dateTo = input.value;
            }
            loadRatesFor(input.value).then(function () { updateRow(employeeId); updateTotals(); });
        }
        updateRow(employeeId);
        updateTotals();
    });

    /** Rows with hours need dates and a reason; marks the cells and returns the first problem. */
    function check() {
        var problem = null;
        grid.rows.forEach(function (r) {
            if (isLocked(r)) return;
            var s = state[r.employeeId];
            var tr = el('adjustmentBody').querySelector('tr[data-id="' + CSS.escape(r.employeeId) + '"]');
            var hours = num(s.addHours) || num(s.deductHours);
            function bad(field, message) {
                tr.querySelector('[data-field="' + field + '"]').classList.add('is-invalid');
                if (!problem) problem = r.name + ': ' + message;
            }
            [s.addHours, s.deductHours].forEach(function (v, i) {
                var n = parseFloat(v);
                if (String(v).trim() && (!isFinite(n) || n < 0 || n > 24)) bad(i ? 'deductHours' : 'addHours', 'hours per day must be from 0 to 24.');
            });
            if (!hours) return;
            if (!s.dateFrom) bad('dateFrom', 'enter Date From.');
            if (!s.dateTo) bad('dateTo', 'enter Date To.');
            if (s.dateFrom && s.dateTo && s.dateTo < s.dateFrom) bad('dateTo', 'Date To can\'t be before Date From.');
            if (s.dateTo && s.dateTo > grid.applyEnd) bad('dateTo', 'the dates must end on or before the cut-off.');
            if (s.dateFrom && s.dateTo && s.dateTo >= s.dateFrom && !workdays(s.dateFrom, s.dateTo)) bad('dateTo', 'those dates have no working days.');
            if (!String(s.reason).trim()) bad('reason', 'enter the reason.');
        });
        return problem;
    }

    function save() {
        if (!grid || grid.released) return;
        var problem = check();
        if (problem) {
            PPToast.error(problem);
            var first = el('adjustmentBody').querySelector('.is-invalid');
            if (first) first.focus();
            return;
        }
        // "Are you sure?" with what will be saved for this cut-off.
        var adjusted = 0, removed = 0, net = 0;
        grid.rows.forEach(function (r) {
            if (isLocked(r)) return;
            var c = compute(r);
            if (c.add || c.deduct) {
                adjusted++;
                net += c.total;
            } else if (saved[r.employeeId].addHours || saved[r.employeeId].deductHours) {
                removed++;
            }
        });
        net = round2(net);
        ConfirmModal.show({
            title: 'Save Adjustments',
            message: 'Save the adjustments for ' + cutoffLabel(grid.applyStart, grid.applyEnd) + '? ' +
                adjusted + ' employee' + (adjusted === 1 ? '' : 's') + ' adjusted, net ' +
                (net < 0 ? '−' : net > 0 ? '+' : '') + '₱' + money(Math.abs(net)) +
                (removed ? ', ' + removed + ' adjustment' + (removed === 1 ? '' : 's') + ' removed' : '') + '.',
            confirmText: 'Save'
        }).then(function (confirmed) {
            if (confirmed) send();
        });
    }

    function send() {
        var rows = grid.rows.filter(function (r) { return !isLocked(r); }).map(function (r) {
            var s = state[r.employeeId];
            return {
                employeeId: r.employeeId,
                dateFrom: s.dateFrom || null,
                dateTo: s.dateTo || null,
                addHours: num(s.addHours) || null,
                deductHours: num(s.deductHours) || null,
                reason: String(s.reason || '').trim()
            };
        });
        var btn = el('saveAdjustmentsBtn');
        btn.disabled = true;
        api('api/payroll/adjustments/grid', 'PUT', { applyStart: grid.applyStart, applyEnd: grid.applyEnd, rows: rows })
            .then(function (data) {
                btn.disabled = false;
                if (!data.success) {
                    PPToast.error(data.message || 'Could not save the adjustments.');
                    return;
                }
                PPToast.success('Adjustments saved for ' + cutoffLabel(grid.applyStart, grid.applyEnd) +
                    '. If this cut-off\'s payroll was already computed, run it again to include them.');
                load();
            })
            .catch(function () {
                btn.disabled = false;
                PPToast.error('Could not reach the server.');
            });
    }

    // ---------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------

    el('saveAdjustmentsBtn').addEventListener('click', save);
    el('adjustmentSearch').addEventListener('input', function () { if (grid) applySearch(); });

    el('cutoffSelect').addEventListener('change', function () {
        var select = el('cutoffSelect');
        if (!hasChanges()) {
            currentCutoff = select.value;
            load();
            return;
        }
        var chosen = select.value;
        select.value = currentCutoff;
        ConfirmModal.show({
            title: 'Unsaved Adjustments',
            message: 'You have changes that aren\'t saved. Switch cut-off and discard them?',
            confirmText: 'Discard and Switch',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            select.value = chosen;
            currentCutoff = chosen;
            load();
        });
    });

    window.addEventListener('beforeunload', function (e) {
        if (hasChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    fillCutoffs();
    load();
})();
