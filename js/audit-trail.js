/**
 * Utility → Audit Trail (api/audit/search), System Administrator.
 *
 * Read-only log of every recorded change, filtered by date range, user,
 * module and text, newest first (up to 1000 at a time). Export CSV saves
 * the entries shown, for Excel.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'audit',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var el = function (id) { return document.getElementById(id); };
    var entries = [];
    var token = 0;
    var searchTimer = null;

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function when(text) {
        if (!text) return '—';
        return new Date(text).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    // Default range: the last 30 days.
    var today = new Date();
    var monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    el('auditFrom').value = iso(monthAgo);
    el('auditTo').value = iso(today);

    function loadFilters() {
        return fetch('api/audit/filters').then(function (r) { return r.json(); }).then(function (data) {
            if (!data.success) return;
            el('auditUser').innerHTML = '<option value="">All users</option>' + data.users.map(function (u) {
                return '<option value="' + u.id + '">' + escapeHtml(u.name || ('User #' + u.id)) + ' (' + escapeHtml(u.role) + ')</option>';
            }).join('');
            el('auditModule').innerHTML = '<option value="">All modules</option>' + data.modules.map(function (m) {
                return '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>';
            }).join('');
        }).catch(function () { /* the list still loads without filters */ });
    }

    function load() {
        var from = el('auditFrom').value;
        var to = el('auditTo').value;
        if (!from || !to) return;
        if (to < from) {
            el('auditCount').textContent = 'The "To" date can\'t be before the "From" date.';
            return;
        }
        var params = 'from=' + from + '&to=' + to + '&limit=1000';
        if (el('auditUser').value) params += '&userId=' + encodeURIComponent(el('auditUser').value);
        if (el('auditModule').value) params += '&module=' + encodeURIComponent(el('auditModule').value);
        if (el('auditSearch').value.trim()) params += '&q=' + encodeURIComponent(el('auditSearch').value.trim());
        var mine = ++token;
        el('auditCount').textContent = 'Loading…';
        fetch('api/audit/search?' + params).then(function (r) { return r.json(); }).then(function (data) {
            if (mine !== token) return;
            if (!data.success) throw new Error(data.message === 'Not Found.'
                ? 'The server doesn\'t have the Audit Trail page yet. Restart it with start-payroll.bat.' : data.message);
            entries = data.entries;
            el('auditCount').textContent = data.total > entries.length
                ? 'Showing the newest ' + entries.length + ' of ' + data.total + ' entries. Narrow the dates or filters to see older ones.'
                : data.total + ' entr' + (data.total === 1 ? 'y' : 'ies') + '.';
            render();
        }).catch(function (error) {
            if (mine !== token) return;
            entries = [];
            render();
            el('auditCount').textContent = error.message || 'Could not load the audit trail.';
        });
    }

    function render() {
        el('auditEmpty').classList.toggle('d-none', entries.length > 0);
        el('auditBody').innerHTML = entries.map(function (e) {
            return '<tr>' +
                '<td class="text-nowrap">' + when(e.at) + '</td>' +
                '<td>' + escapeHtml(e.user) + (e.email ? '<br><span class="text-muted small">' + escapeHtml(e.email) + '</span>' : '') + '</td>' +
                '<td>' + escapeHtml(e.module) + '</td>' +
                '<td><strong>' + escapeHtml(e.action) + '</strong></td>' +
                '<td class="pp-util-details">' + escapeHtml(e.details || '') + '</td>' +
            '</tr>';
        }).join('');
    }

    function csvCell(value) {
        var text = String(value == null ? '' : value);
        // Guard against spreadsheet formulas in exported text.
        if (/^[=+\-@]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    }

    el('exportCsvBtn').addEventListener('click', function () {
        if (!entries.length) {
            PPToast.error('There are no entries to export.');
            return;
        }
        var rows = [['Date & Time', 'User', 'Email', 'Module', 'Action', 'Details']].concat(entries.map(function (e) {
            return [String(e.at || '').replace('T', ' '), e.user, e.email || '', e.module, e.action, e.details || ''];
        }));
        var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
        var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = 'audit-trail_' + el('auditFrom').value + '_to_' + el('auditTo').value + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });

    ['auditFrom', 'auditTo', 'auditUser', 'auditModule'].forEach(function (id) {
        el(id).addEventListener('change', load);
    });
    el('auditSearch').addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(load, 350);
    });

    loadFilters();
    load();
})();
