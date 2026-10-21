/**
 * Utility → Backup & Restore (api/utility/backups), System Administrator.
 *
 * Back Up Now saves a full copy of the database in the backups folder.
 * Each backup can be downloaded, restored or deleted; a backup file from a
 * USB drive can be uploaded and then restored. Restoring needs RESTORE typed
 * in, makes a backup of the current data first, and logs the user out.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'backup',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var el = function (id) { return document.getElementById(id); };
    var backups = [];
    var restoring = null;
    var current = null;   // the backup open in the details window
    var restoreModal = new bootstrap.Modal(el('restoreModal'));
    var backupModal = new bootstrap.Modal(el('backupModal'));

    var KIND = {
        backup: 'With Back Up Now',
        'before-restore': 'Automatically, just before a restore (the data as it was then)',
        upload: 'Uploaded from a file'
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function when(iso) {
        if (!iso) return '—';
        return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function size(bytes) {
        var n = Number(bytes) || 0;
        if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
        if (n >= 1024) return Math.round(n / 1024) + ' KB';
        return n + ' B';
    }

    function json(response) {
        return response.json().catch(function () {
            return { success: false, message: response.status === 413 ? 'The file is too large (at most 200 MB).' : 'Unexpected response from the server.' };
        });
    }

    function busy(button, text) {
        button.dataset.label = button.dataset.label || button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>' + text;
    }

    function idle(button) {
        button.disabled = false;
        if (button.dataset.label) button.innerHTML = button.dataset.label;
    }

    // ---------------------------------------------------------------

    function load() {
        return fetch('api/utility/backups').then(json).then(function (data) {
            if (!data.success) throw new Error(data.message === 'Not Found.'
                ? 'The server doesn\'t have Backup & Restore yet. Restart it with start-payroll.bat.' : data.message);
            backups = data.backups;
            render();
        }).catch(function (error) {
            el('backupBody').innerHTML = '';
            el('backupEmpty').textContent = error.message || 'Could not load the backups.';
            el('backupEmpty').classList.remove('d-none');
        });
    }

    function render() {
        if (!backups.length) {
            el('backupBody').innerHTML = '';
            el('backupEmpty').textContent = 'No backups yet. Click Back Up Now to make the first one.';
            el('backupEmpty').classList.remove('d-none');
            return;
        }
        el('backupEmpty').classList.add('d-none');
        el('backupBody').innerHTML = backups.map(function (b) {
            var name = escapeHtml(b.name);
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-name="' + name + '" aria-label="Backup ' + name + '">' +
                '<td><i class="bi bi-file-earmark-zip me-1 text-muted"></i>' + name + '</td>' +
                '<td>' + when(b.createdAt) + '</td>' +
                '<td class="text-end">' + size(b.size) + '</td>' +
            '</tr>';
        }).join('');
    }

    // Back Up Now
    el('backupNowBtn').addEventListener('click', function () {
        var btn = el('backupNowBtn');
        busy(btn, 'Backing up…');
        fetch('api/utility/backups', { method: 'POST' }).then(json).then(function (data) {
            idle(btn);
            if (!data.success) { PPToast.error(data.message || 'The backup failed.'); return; }
            backups = data.backups;
            render();
            PPToast.success('Backup saved: ' + data.backup.name + ' (' + size(data.backup.size) + ').');
        }).catch(function () {
            idle(btn);
            PPToast.error('Could not reach the server.');
        });
    });

    // Upload a backup file (e.g. from a USB drive)
    el('uploadBackupBtn').addEventListener('click', function () { el('backupFile').click(); });
    el('backupFile').addEventListener('change', function () {
        var file = el('backupFile').files[0];
        el('backupFile').value = '';
        if (!file) return;
        if (!/\.sql$/i.test(file.name)) { PPToast.error('Choose a .sql backup file.'); return; }
        var body = new FormData();
        body.append('file', file);
        var btn = el('uploadBackupBtn');
        busy(btn, 'Uploading…');
        fetch('api/utility/backups/upload', { method: 'POST', body: body }).then(json).then(function (data) {
            idle(btn);
            if (!data.success) { PPToast.error(data.message || 'The upload failed.'); return; }
            backups = data.backups;
            render();
            PPToast.success('Uploaded as ' + data.backup.name + '. Click Restore on it to use it.');
        }).catch(function () {
            idle(btn);
            PPToast.error('Could not reach the server.');
        });
    });

    // Clicking a row opens the backup's details and actions.
    function openBackup(name) {
        var b = backups.find(function (x) { return x.name === name; });
        if (!b) return;
        current = b;
        el('backupName').textContent = b.name;
        el('backupCreated').textContent = when(b.createdAt);
        el('backupSize').textContent = size(b.size);
        el('backupKind').textContent = KIND[b.kind] || KIND.backup;
        el('downloadBackupBtn').href = 'api/utility/backups/' + encodeURIComponent(b.name) + '/download';
        backupModal.show();
    }

    el('backupBody').addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-name]');
        if (row) openBackup(row.dataset.name);
    });
    el('backupBody').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-name]')) {
            e.preventDefault();
            openBackup(e.target.dataset.name);
        }
    });

    el('openRestoreBtn').addEventListener('click', function () {
        if (!current) return;
        restoring = current;
        el('restoreName').textContent = current.name;
        el('restoreWhen').textContent = when(current.createdAt);
        el('restoreConfirm').value = '';
        el('restoreBtn').disabled = true;
        backupModal.hide();
        restoreModal.show();
    });

    el('deleteBackupBtn').addEventListener('click', function () {
        if (!current) return;
        var b = current;
        backupModal.hide();
        ConfirmModal.show({
            title: 'Delete Backup',
            message: 'Delete ' + b.name + '? This backup file will be removed from this computer.',
            confirmText: 'Delete',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            fetch('api/utility/backups/' + encodeURIComponent(b.name), { method: 'DELETE' }).then(json).then(function (data) {
                if (!data.success) { PPToast.error(data.message || 'Could not delete the backup.'); return; }
                backups = data.backups;
                render();
                PPToast.success('Backup deleted.');
            }).catch(function () { PPToast.error('Could not reach the server.'); });
        });
    });

    // Restore: only after RESTORE is typed
    el('restoreConfirm').addEventListener('input', function () {
        el('restoreBtn').disabled = el('restoreConfirm').value.trim() !== 'RESTORE';
    });
    el('restoreModal').addEventListener('shown.bs.modal', function () { el('restoreConfirm').focus(); });

    el('restoreForm').addEventListener('submit', function (e) {
        e.preventDefault();
        if (!restoring || el('restoreConfirm').value.trim() !== 'RESTORE') return;
        var btn = el('restoreBtn');
        busy(btn, 'Restoring…');
        fetch('api/utility/backups/' + encodeURIComponent(restoring.name) + '/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: 'RESTORE' })
        }).then(json).then(function (data) {
            if (!data.success) {
                idle(btn);
                PPToast.error(data.message || 'The restore failed.');
                return;
            }
            restoreModal.hide();
            PPToast.success('Restored from ' + data.restored + '. The previous data was saved as ' +
                data.safetyBackup.name + '. Logging out…');
            // Accounts may have changed with the restored data: log in again.
            setTimeout(function () {
                fetch('api/auth/logout', { method: 'POST' }).catch(function () {}).then(function () {
                    try { localStorage.removeItem('ppAuthenticated'); localStorage.removeItem('ppUser'); } catch (err) { /* ignore */ }
                    window.location.href = 'index.html';
                });
            }, 3500);
        }).catch(function () {
            idle(btn);
            PPToast.error('Could not reach the server.');
        });
    });

    load();
})();
