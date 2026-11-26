/**
 * Payroll Processing → Payroll Adjustment (api/payroll/adjustments/grid).
 *
 * A grid per cut-off: one row per employee, and each employee can have one
 * or more adjustments. For each adjustment the Payroll Master enters the
 * days being corrected (Date From – Date To; days = working days, Mon–Fri),
 * hours per day to ADD and/or DEDUCT, and a reason. Amounts = hours × days ×
 * the rate on that adjustment's own Date From; Net Total = addition −
 * deduction summed across every adjustment, added to that cut-off's pay when
 * payroll is computed. The server recomputes everything when saving; this
 * page shows the same numbers as you type. A released cut-off is read-only.
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
    var state = {};           // employeeId -> [{ dateFrom, dateTo, addHours, deductHours, reason, adjustmentId }]
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

    /** The cut-off a date falls in (Maintenance → Payroll Periods, js/payroll-periods.js). */
    function cutoffContaining(date) {
        var p = PPPeriods.of(date);
        return { start: p.from, end: p.to };
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

    function emptyEntry() {
        return { adjustmentId: null, dateFrom: '', dateTo: '', addHours: '', deductHours: '', reason: '' };
    }

    function snapshotEntries(row) {
        return (row.entries || []).map(function (e) {
            return {
                adjustmentId: e.adjustmentId,
                dateFrom: e.dateFrom || '',
                dateTo: e.dateTo || '',
                addHours: e.addHours != null && Number(e.addHours) ? String(Number(e.addHours)) : '',
                deductHours: e.deductHours != null && Number(e.deductHours) ? String(Number(e.deductHours)) : '',
                reason: e.reason || '',
                rate: e.rate // the rate it was actually saved with, kept while dateFrom doesn't change
            };
        });
    }

    /**
     * Rate for one entry: an already-saved entry keeps the rate it was saved
     * with until its Date From changes; otherwise the rate on Date From if
     * known, else the employee's current rate (row.rate).
     */
    function rateForEntry(row, e) {
        if (e.adjustmentId != null && e.rate != null) {
            var original = (saved[row.employeeId] || []).find(function (o) { return o.adjustmentId === e.adjustmentId; });
            if (original && original.dateFrom === e.dateFrom) return Number(e.rate) || 0;
        }
        var onDate = e.dateFrom && ratesByDate[e.dateFrom] ? ratesByDate[e.dateFrom][row.employeeId] : null;
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

    /** One entry's computed days/rate/add/deduct/total. */
    function computeEntry(row, e) {
        var days = workdays(e.dateFrom, e.dateTo);
        var rate = rateForEntry(row, e);
        var add = round2(num(e.addHours) * days * rate);
        var deduct = round2(num(e.deductHours) * days * rate);
        return { days: days, rate: rate, add: add, deduct: deduct, total: round2(add - deduct) };
    }

    /** An employee row's entries, summed. */
    function computeRow(row) {
        var entries = state[row.employeeId] || [];
        var add = 0, deduct = 0, count = 0;
        entries.forEach(function (e) {
            var c = computeEntry(row, e);
            if (c.add || c.deduct) {
                add += c.add;
                deduct += c.deduct;
                count++;
            }
        });
        return { count: count, add: round2(add), deduct: round2(deduct), total: round2(add - deduct) };
    }

    function entrySignature(e) {
        return ['dateFrom', 'dateTo', 'addHours', 'deductHours', 'reason'].map(function (k) {
            return String(e[k] || '').trim();
        }).join('|');
    }

    function isChanged(employeeId) {
        var a = (state[employeeId] || []).map(entrySignature);
        var b = (saved[employeeId] || []).map(entrySignature);
        if (a.length !== b.length) return true;
        return a.some(function (sig, i) { return sig !== b[i]; });
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
        el('adjustmentBody').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Loading…</td></tr>';
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
                state[r.employeeId] = snapshotEntries(r);
                saved[r.employeeId] = snapshotEntries(r);
            });
            // Rates on the saved Date From values, so the totals match the saved amounts.
            var dates = [];
            grid.rows.forEach(function (r) { (r.entries || []).forEach(function (e) { dates.push(e.dateFrom); }); });
            return Promise.all(dates.filter(function (d, i) { return d && dates.indexOf(d) === i; }).map(loadRatesFor));
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
        // The hint line is optional on the page.
        var hint = el('adjustmentHint') && el('adjustmentHint').querySelector('span');
        if (hint) {
            hint.textContent = grid.released
                ? 'This cut-off\'s payroll is released, so its adjustments are paid and can no longer be changed.'
                : 'Addition and Deduction are hours per day. Days are working days (Mon–Fri) from Date From to Date To; ' +
                  'amounts = hours × days × rate. The Net Total is added to (or taken from) this cut-off\'s pay when payroll is computed.';
        }
        el('saveAdjustmentsBtn').title = grid.released
            ? 'This cut-off\'s payroll is released, so its adjustments can no longer be changed.' : '';

        if (!grid.rows.length) {
            el('adjustmentBody').innerHTML = '';
            el('emptyState').textContent = 'No employees.';
            el('emptyState').classList.remove('d-none');
            return;
        }
        el('adjustmentBody').innerHTML = grid.rows.map(function (r) {
            var locked = isLocked(r);
            var id = escapeHtml(r.employeeId);
            return '<tr data-id="' + id + '" class="pp-row-clickable' + (locked && r.status ? ' is-locked' : '') + '" ' +
                    'tabindex="0" role="button" aria-label="Adjust payroll for ' + escapeHtml(r.name) + '">' +
                '<td>' + escapeHtml(r.employeeNumber) + '</td>' +
                '<td><strong>' + escapeHtml(r.name) + '</strong>' +
                    (r.status === 'Applied' ? '<span class="pp-adjust-lock" title="Paid when the cut-off was released"><i class="bi bi-lock-fill"></i></span>' : '') +
                    (r.inPayroll === false && r.status !== 'Applied' ? '<span class="pp-adjust-warn" title="Not Active (or hired after this cut-off), so not in this cut-off\'s payroll. Clear this row."><i class="bi bi-exclamation-triangle-fill"></i> Not in payroll</span>' : '') + '</td>' +
                '<td>' + escapeHtml(PayrollProLayout.staffTypeLabel(r.type)) + '</td>' +
                '<td class="text-end" data-cell="count"></td>' +
                '<td class="text-end amount-total" data-cell="total"></td>' +
                '<td data-cell="reasons"></td>' +
            '</tr>';
        }).join('');
        grid.rows.forEach(function (r) { updateRow(r.employeeId); });
        applySearch();
        updateTotals();
    }

    /** Refreshes one row's display cells from its current state. */
    function updateRow(employeeId) {
        var tr = el('adjustmentBody').querySelector('tr[data-id="' + CSS.escape(employeeId) + '"]');
        if (!tr) return;
        var row = rowOf(employeeId);
        var entries = state[employeeId] || [];
        var c = computeRow(row);
        tr.querySelector('[data-cell="count"]').textContent = c.count || '';
        var total = tr.querySelector('[data-cell="total"]');
        total.textContent = c.total ? (c.total > 0 ? '+' : '−') + money(Math.abs(c.total)) : '';
        total.classList.toggle('amount-add', c.total > 0);
        total.classList.toggle('amount-deduct', c.total < 0);
        var reasons = entries.map(function (e) { return e.reason; }).filter(Boolean).join('; ');
        tr.querySelector('[data-cell="reasons"]').textContent = reasons || '—';
        tr.querySelector('[data-cell="reasons"]').title = reasons;
        tr.classList.toggle('is-changed', isChanged(employeeId));
    }

    function updateTotals() {
        var add = 0, deduct = 0, employeeCount = 0;
        grid.rows.forEach(function (r) {
            var c = computeRow(r);
            add += c.add;
            deduct += c.deduct;
            if (c.count) employeeCount++;
        });
        var total = round2(add - deduct);
        el('adjustmentFoot').innerHTML = '<tr>' +
            '<th colspan="3">' + employeeCount + ' employee' + (employeeCount === 1 ? '' : 's') + ' adjusted</th>' +
            '<th></th>' +
            '<th class="text-end amount-total">' + (total < 0 ? '−' : total > 0 ? '+' : '') + money(Math.abs(total)) + '</th>' +
            '<th></th></tr>';
    }

    function applySearch() {
        var q = el('adjustmentSearch').value.trim().toLowerCase();
        var type = el('typeSelect').value;
        el('adjustmentBody').querySelectorAll('tr[data-id]').forEach(function (tr) {
            var r = rowOf(tr.dataset.id);
            var searchMatch = !q || (r.employeeNumber + ' ' + r.name).toLowerCase().indexOf(q) !== -1;
            var typeMatch = type === 'all' || r.type === type;
            tr.style.display = searchMatch && typeMatch ? '' : 'none';
        });
    }

    // ---------------------------------------------------------------
    // Editing (Adjust Payroll modal — one employee, one or more entries)
    // ---------------------------------------------------------------

    var adjustModal = null;
    var adjustEmployeeId = null;
    var draft = null; // [{ adjustmentId, dateFrom, dateTo, addHours, deductHours, reason }]

    /** An entry with hours needs dates and a reason; { field, message } of the first problem, or null. */
    function validateEntry(e) {
        var bad = null;
        [e.addHours, e.deductHours].forEach(function (v, i) {
            var n = parseFloat(v);
            if (!bad && String(v).trim() && (!isFinite(n) || n < 0 || n > 24)) {
                bad = { field: i ? 'deductHours' : 'addHours', message: 'hours per day must be from 0 to 24.' };
            }
        });
        if (bad) return bad;
        if (!num(e.addHours) && !num(e.deductHours)) return { field: 'addHours', message: 'enter an addition or a deduction, or remove this adjustment.' };
        if (!e.dateFrom) return { field: 'dateFrom', message: 'enter Date From.' };
        if (!e.dateTo) return { field: 'dateTo', message: 'enter Date To.' };
        if (e.dateTo < e.dateFrom) return { field: 'dateTo', message: 'Date To can\'t be before Date From.' };
        if (e.dateTo > grid.applyEnd) return { field: 'dateTo', message: 'the dates must end on or before the cut-off.' };
        if (e.dateTo >= e.dateFrom && !workdays(e.dateFrom, e.dateTo)) return { field: 'dateTo', message: 'those dates have no working days.' };
        if (!String(e.reason).trim()) return { field: 'reason', message: 'enter the reason.' };
        return null;
    }

    /** The first entry (of a non-locked row) with a validation problem, or null. */
    function firstProblem() {
        var result = null;
        grid.rows.some(function (r) {
            if (isLocked(r)) return false;
            var entries = state[r.employeeId] || [];
            return entries.some(function (e, index) {
                var issue = validateEntry(e);
                if (issue) { result = { row: r, index: index, issue: issue }; return true; }
                return false;
            });
        });
        return result;
    }

    function previewHtml(c) {
        return '<span>Rate <strong>₱' + money(c.rate) + '</strong></span>' +
            '<span>Days <strong>' + c.days + '</strong></span>' +
            '<span class="amount-add">+₱' + money(c.add) + '</span>' +
            '<span class="amount-deduct">−₱' + money(c.deduct) + '</span>' +
            '<span class="amount-total">' + (c.total < 0 ? '−' : c.total > 0 ? '+' : '') + '₱' + money(Math.abs(c.total)) + '</span>';
    }

    function entryCard(index, e, row, locked) {
        return '<div class="pp-adjust-entry" data-index="' + index + '">' +
            '<div class="pp-adjust-entry-head">' +
                '<strong>Adjustment ' + (index + 1) + '</strong>' +
                (locked ? '' : '<button type="button" class="pp-adjust-entry-remove" data-index="' + index + '" aria-label="Remove this adjustment"><i class="bi bi-trash"></i></button>') +
            '</div>' +
            '<div class="row g-2">' +
                '<div class="col-sm-6"><label class="pp-form-label">Date From</label>' +
                    '<input type="date" class="form-control pp-form-control" data-field="dateFrom" data-index="' + index + '" value="' + escapeHtml(e.dateFrom) + '" max="' + grid.applyEnd + '"' + (locked ? ' disabled' : '') + '></div>' +
                '<div class="col-sm-6"><label class="pp-form-label">Date To</label>' +
                    '<input type="date" class="form-control pp-form-control" data-field="dateTo" data-index="' + index + '" value="' + escapeHtml(e.dateTo) + '" max="' + grid.applyEnd + '"' + (locked ? ' disabled' : '') + '></div>' +
            '</div>' +
            '<div class="row g-2 mt-0">' +
                '<div class="col-sm-6"><label class="pp-form-label">Addition <span class="pp-sub d-inline">(hrs / day)</span></label>' +
                    '<input type="number" class="form-control pp-form-control" data-field="addHours" data-index="' + index + '" value="' + escapeHtml(e.addHours) + '" min="0" max="24" step="0.5" inputmode="decimal"' + (locked ? ' disabled' : '') + '></div>' +
                '<div class="col-sm-6"><label class="pp-form-label">Deduction <span class="pp-sub d-inline">(hrs / day)</span></label>' +
                    '<input type="number" class="form-control pp-form-control" data-field="deductHours" data-index="' + index + '" value="' + escapeHtml(e.deductHours) + '" min="0" max="24" step="0.5" inputmode="decimal"' + (locked ? ' disabled' : '') + '></div>' +
            '</div>' +
            '<div class="mb-0"><label class="pp-form-label">Reason</label>' +
                '<input type="text" class="form-control pp-form-control" data-field="reason" data-index="' + index + '" value="' + escapeHtml(e.reason) + '" maxlength="200" placeholder="e.g. Leave not recorded in time"' + (locked ? ' disabled' : '') + '></div>' +
            '<div class="pp-adjust-entry-preview">' + previewHtml(computeEntry(row, e)) + '</div>' +
        '</div>';
    }

    function renderEntries() {
        var row = rowOf(adjustEmployeeId);
        var locked = isLocked(row);
        el('adjustEmptyEntries').classList.toggle('d-none', draft.length > 0);
        el('adjustEntries').innerHTML = draft.map(function (e, i) { return entryCard(i, e, row, locked); }).join('');
        if (window.PPDatePicker) PPDatePicker.upgrade(el('adjustEntries'));
        updateGrandTotal();
    }

    /** Refreshes one entry's preview numbers in place, without rebuilding any input (keeps focus). */
    function refreshEntryPreview(index) {
        var card = el('adjustEntries').querySelector('.pp-adjust-entry[data-index="' + index + '"]');
        if (!card || !draft[index]) return;
        card.querySelector('.pp-adjust-entry-preview').innerHTML = previewHtml(computeEntry(rowOf(adjustEmployeeId), draft[index]));
        updateGrandTotal();
    }

    function updateGrandTotal() {
        var row = rowOf(adjustEmployeeId);
        var add = 0, deduct = 0;
        draft.forEach(function (e) {
            var c = computeEntry(row, e);
            add += c.add;
            deduct += c.deduct;
        });
        var total = round2(add - deduct);
        var strong = el('adjustGrandTotal');
        strong.textContent = (total < 0 ? '−' : total > 0 ? '+' : '') + '₱' + money(Math.abs(total));
        strong.classList.toggle('amount-add', total > 0);
        strong.classList.toggle('amount-deduct', total < 0);
    }

    function clearEntryErrors() {
        el('adjustEntries').querySelectorAll('.is-invalid').forEach(function (i) { i.classList.remove('is-invalid'); });
    }

    function showEntryError(index, issue) {
        clearEntryErrors();
        var input = el('adjustEntries').querySelector('[data-index="' + index + '"][data-field="' + issue.field + '"]');
        if (input) input.classList.add('is-invalid');
        PPToast.error('Adjustment ' + (index + 1) + ': ' + issue.message);
    }

    function openAdjust(employeeId) {
        var r = rowOf(employeeId);
        if (!r) return;
        adjustEmployeeId = employeeId;
        draft = (state[employeeId] || []).map(function (e) { return Object.assign({}, e); });
        var locked = isLocked(r);

        el('adjustModalTitle').textContent = 'Adjust Payroll — ' + r.name;
        el('adjustEmployeeNumber').textContent = r.employeeNumber;
        el('adjustPosition').textContent = PayrollProLayout.staffTypeLabel(r.type);
        el('addEntryBtn').classList.toggle('d-none', locked);
        el('adjustSaveBtn').classList.toggle('d-none', locked);
        el('adjustLockedNote').classList.toggle('d-none', !locked);

        clearEntryErrors();
        renderEntries();
        if (!adjustModal) adjustModal = new bootstrap.Modal(el('adjustModal'));
        adjustModal.show();
    }

    el('adjustmentBody').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-id]');
        if (tr) openAdjust(tr.dataset.id);
    });
    el('adjustmentBody').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
            e.preventDefault();
            openAdjust(e.target.dataset.id);
        }
    });

    el('addEntryBtn').addEventListener('click', function () {
        draft.push(emptyEntry());
        renderEntries();
    });

    el('adjustEntries').addEventListener('click', function (e) {
        var btn = e.target.closest('.pp-adjust-entry-remove');
        if (!btn) return;
        draft.splice(Number(btn.dataset.index), 1);
        renderEntries();
    });

    el('adjustEntries').addEventListener('input', function (e) {
        var field = e.target.dataset.field;
        var index = e.target.dataset.index;
        if (!field || index == null || !draft[index]) return;
        draft[index][field] = e.target.value;
        e.target.classList.remove('is-invalid');
        // Leaving Date To empty: use Date From (a single day).
        if (field === 'dateFrom') {
            if (!draft[index].dateTo) {
                draft[index].dateTo = draft[index].dateFrom;
                var toInput = el('adjustEntries').querySelector('[data-index="' + index + '"][data-field="dateTo"]');
                if (toInput) toInput.value = draft[index].dateTo;
            }
            loadRatesFor(draft[index].dateFrom).then(function () { refreshEntryPreview(index); });
            return;
        }
        refreshEntryPreview(index);
    });

    el('adjustForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var row = rowOf(adjustEmployeeId);
        if (!row || isLocked(row)) return;
        for (var i = 0; i < draft.length; i++) {
            var issue = validateEntry(draft[i]);
            if (issue) { showEntryError(i, issue); return; }
        }
        state[adjustEmployeeId] = draft.map(function (e) { return Object.assign({}, e); });
        updateRow(adjustEmployeeId);
        updateTotals();
        adjustModal.hide();
    });

    function save() {
        if (!grid || grid.released) return;
        var problem = firstProblem();
        if (problem) {
            openAdjust(problem.row.employeeId);
            showEntryError(problem.index, problem.issue);
            return;
        }
        // "Are you sure?" with what will be saved for this cut-off.
        var adjusted = 0, removed = 0, net = 0;
        grid.rows.forEach(function (r) {
            if (isLocked(r)) return;
            var c = computeRow(r);
            if (c.count) {
                adjusted++;
                net += c.total;
            } else if ((saved[r.employeeId] || []).length) {
                removed++;
            }
        });
        net = round2(net);
        ConfirmModal.show({
            title: 'Save Adjustments',
            message: 'Save the adjustments for ' + cutoffLabel(grid.applyStart, grid.applyEnd) + '? ' +
                adjusted + ' employee' + (adjusted === 1 ? '' : 's') + ' adjusted, net ' +
                (net < 0 ? '−' : net > 0 ? '+' : '') + '₱' + money(Math.abs(net)) +
                (removed ? ', ' + removed + ' employee' + (removed === 1 ? '' : 's') + ' cleared' : '') + '.',
            confirmText: 'Save'
        }).then(function (confirmed) {
            if (confirmed) send();
        });
    }

    function send() {
        var rows = grid.rows.filter(function (r) { return !isLocked(r); }).map(function (r) {
            var entries = (state[r.employeeId] || []).filter(function (e) { return num(e.addHours) || num(e.deductHours); });
            return {
                employeeId: r.employeeId,
                entries: entries.map(function (e) {
                    return {
                        dateFrom: e.dateFrom || null,
                        dateTo: e.dateTo || null,
                        addHours: num(e.addHours) || null,
                        deductHours: num(e.deductHours) || null,
                        reason: String(e.reason || '').trim()
                    };
                })
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
    el('typeSelect').addEventListener('change', function () { if (grid) applySearch(); });

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

    Promise.all([PayrollProLayout.loadStaffTypeLabels(), PayrollProLayout.loadEmployeeTypeOptions()]).then(function (results) {
        PayrollProLayout.populateEmployeeTypeSelect(el('typeSelect'), results[1]);
        return PPPeriods.load();
    }).then(function () {
        fillCutoffs();
        load();
    });
})();
