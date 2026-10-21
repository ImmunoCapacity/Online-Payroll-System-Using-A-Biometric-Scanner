/**
 * Payroll Processing → 13th Month Pay (api/payroll/released).
 *
 * One row per employee for the chosen year: basic pay and net pay of every
 * released cut-off of that year, and the 13th month pay = basic pay ÷ 12
 * (PD 851; same rule as Reports → 13th Month Pay). A cut-off counts in the
 * month and year it ends. Clicking a row shows January to December (blank
 * where nothing was paid) with the 13th month pay at the end.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'payroll',
        navMode: 'master',
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];
    var TYPE_ORDER = { 'Admin': 0, 'Faculty': 1, 'Faculty/Admin': 2 };

    var el = function (id) { return document.getElementById(id); };
    var records = [];
    var employees = [];   // for the selected year, before the type/search filters
    var modal = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function round2(n) {
        return Math.round((Number(n) || 0) * 100) / 100;
    }

    function peso(n) {
        return '₱' + round2(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    /** Groups the year's released rows by employee, with pay per month. */
    function build(year) {
        var byId = {};
        records.forEach(function (r) {
            if (r.periodEnd.slice(0, 4) !== year) return;
            var e = byId[r.employeeKey];
            if (!e) {
                e = byId[r.employeeKey] = {
                    key: r.employeeKey, number: r.employeeId, name: r.employee, type: r.employeeType,
                    months: MONTHS.map(function () { return null; })
                };
            }
            var m = Number(r.periodEnd.slice(5, 7)) - 1;
            var month = e.months[m] || (e.months[m] = { basic: 0, net: 0, periods: [] });
            month.basic = round2(month.basic + Number(r.gross || 0));
            month.net = round2(month.net + Number(r.net || 0));
            month.periods.push(r.periodLabel);
        });
        return Object.keys(byId).map(function (k) {
            var e = byId[k];
            e.basic = round2(e.months.reduce(function (s, m) { return s + (m ? m.basic : 0); }, 0));
            e.net = round2(e.months.reduce(function (s, m) { return s + (m ? m.net : 0); }, 0));
            e.monthsPaid = e.months.filter(Boolean).length;
            e.thirteenth = round2(e.basic / 12);
            return e;
        }).sort(function (a, b) {
            return ((TYPE_ORDER[a.type] == null ? 9 : TYPE_ORDER[a.type]) - (TYPE_ORDER[b.type] == null ? 9 : TYPE_ORDER[b.type])) ||
                String(a.name).localeCompare(String(b.name));
        });
    }

    function filtered() {
        var type = el('typeSelect').value;
        var q = el('thirteenthSearch').value.trim().toLowerCase();
        return employees.filter(function (e) {
            return (type === 'all' || e.type === type) &&
                (!q || (String(e.number) + ' ' + e.name).toLowerCase().indexOf(q) !== -1);
        });
    }

    function render() {
        var rows = filtered();
        el('thirteenthEmpty').classList.toggle('d-none', rows.length > 0);
        el('thirteenthEmpty').textContent = employees.length
            ? 'No employees match the filters.' : 'No released payroll for ' + el('yearSelect').value + '.';
        el('thirteenthBody').innerHTML = rows.map(function (e) {
            return '<tr class="pp-row-clickable" tabindex="0" data-key="' + escapeHtml(e.key) + '" title="Show month by month">' +
                '<td>' + escapeHtml(e.number) + '</td>' +
                '<td><strong>' + escapeHtml(e.name) + '</strong></td>' +
                '<td>' + escapeHtml(e.type) + '</td>' +
                '<td class="text-end">' + e.monthsPaid + '</td>' +
                '<td class="text-end">' + peso(e.basic) + '</td>' +
                '<td class="text-end">' + peso(e.net) + '</td>' +
                '<td class="text-end"><strong>' + peso(e.thirteenth) + '</strong></td>' +
            '</tr>';
        }).join('');
        var sum = function (k) { return rows.reduce(function (s, e) { return s + e[k]; }, 0); };
        el('thirteenthFoot').innerHTML = rows.length
            ? '<tr><th colspan="4">Total (' + rows.length + ' employee' + (rows.length === 1 ? '' : 's') + ')</th>' +
              '<th class="text-end">' + peso(sum('basic')) + '</th>' +
              '<th class="text-end">' + peso(sum('net')) + '</th>' +
              '<th class="text-end">' + peso(sum('thirteenth')) + '</th></tr>'
            : '';
    }

    function showEmployee(key) {
        var e = employees.find(function (x) { return x.key === key; });
        if (!e) return;
        var year = el('yearSelect').value;
        el('thirteenthModalTitle').textContent = e.name;
        el('thirteenthModalSub').textContent = (e.number || '') + ' · ' + e.type + ' · ' + year;
        el('thirteenthMonths').innerHTML = MONTHS.map(function (name, i) {
            var m = e.months[i];
            return '<tr' + (m ? ' title="' + escapeHtml(m.periods.join(', ')) + '"' : '') + '>' +
                '<td>' + name + '</td>' +
                '<td class="text-end">' + (m ? peso(m.basic) : '') + '</td>' +
                '<td class="text-end">' + (m ? peso(m.net) : '') + '</td>' +
            '</tr>';
        }).join('');
        el('thirteenthMonthsFoot').innerHTML =
            '<tr><th>Total</th><th class="text-end">' + peso(e.basic) + '</th><th class="text-end">' + peso(e.net) + '</th></tr>' +
            '<tr class="pp-13th-total"><th colspan="2">13th Month Pay <span class="pp-13th-rule">(total basic pay ÷ 12)</span></th>' +
            '<th class="text-end">' + peso(e.thirteenth) + '</th></tr>';
        modal = modal || new bootstrap.Modal(el('thirteenthModal'));
        modal.show();
    }

    function selectYear() {
        employees = build(el('yearSelect').value);
        render();
    }

    el('thirteenthBody').addEventListener('click', function (ev) {
        var tr = ev.target.closest('tr[data-key]');
        if (tr) showEmployee(tr.dataset.key);
    });
    el('thirteenthBody').addEventListener('keydown', function (ev) {
        var tr = ev.target.closest('tr[data-key]');
        if (tr && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            showEmployee(tr.dataset.key);
        }
    });
    el('yearSelect').addEventListener('change', selectYear);
    el('typeSelect').addEventListener('change', render);
    el('thirteenthSearch').addEventListener('input', render);

    el('thirteenthBody').innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Loading…</td></tr>';
    fetch('api/payroll/released')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (!data.success) throw new Error(data.message);
            records = data.records || [];
        })
        .catch(function (error) {
            console.error('[13th Month] Released payroll failed:', error);
            if (window.PPToast) PPToast.error('Could not load released payroll from the server.');
        })
        .then(function () {
            var current = String(new Date().getFullYear());
            var years = {};
            years[current] = true;
            records.forEach(function (r) { years[r.periodEnd.slice(0, 4)] = true; });
            el('yearSelect').innerHTML = Object.keys(years).sort().reverse().map(function (y) {
                return '<option value="' + y + '">' + y + '</option>';
            }).join('');
            el('yearSelect').value = current;
            selectYear();
        });
})();
