/**
 * Utility → Archive (api/utility/archive), System Administrator.
 * Read-only list of archived employees; archiving and restoring are done by
 * the Payroll Master in Employee Records.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'archive',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var el = function (id) { return document.getElementById(id); };
    var employees = [];

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function date(text) {
        if (!text) return '—';
        var d = new Date(text.length === 10 ? text + 'T00:00:00' : text);
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function render() {
        var q = el('archiveSearch').value.trim().toLowerCase();
        var shown = employees.filter(function (e) {
            return !q || (e.employeeNumber + ' ' + e.name).toLowerCase().indexOf(q) !== -1;
        });
        el('archiveCount').textContent = employees.length
            ? shown.length + ' of ' + employees.length + ' archived employee' + (employees.length === 1 ? '' : 's') + '.'
            : '';
        el('archiveEmpty').classList.toggle('d-none', shown.length > 0);
        el('archiveEmpty').textContent = employees.length ? 'No archived employees match the search.' : 'No archived employees.';
        el('archiveBody').innerHTML = shown.map(function (e) {
            return '<tr>' +
                '<td>' + escapeHtml(e.employeeNumber) + '</td>' +
                '<td><strong>' + escapeHtml(e.name) + '</strong></td>' +
                '<td>' + escapeHtml(e.type) + '</td>' +
                '<td>' + escapeHtml(e.status) + '</td>' +
                '<td>' + date(e.dateHired) + '</td>' +
                '<td>' + date(e.archivedAt) + '</td>' +
            '</tr>';
        }).join('');
    }

    el('archiveSearch').addEventListener('input', render);

    fetch('api/utility/archive').then(function (r) { return r.json(); }).then(function (data) {
        if (!data.success) throw new Error(data.message === 'Not Found.'
            ? 'The server doesn\'t have the Archive page yet. Restart it with start-payroll.bat.' : data.message);
        employees = data.employees;
        render();
    }).catch(function (error) {
        el('archiveEmpty').textContent = error.message || 'Could not load the archive.';
        el('archiveEmpty').classList.remove('d-none');
    });
})();
