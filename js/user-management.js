(function () {
    PayrollProLayout.init({
        activeNav: 'users',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    // ================================================================
    // User Account Management (Utility module) — accounts live in the
    // database's users table (api/users). These are the only accounts
    // that can log in: Payroll Master, Payroll Staff, System Administrator.
    // ================================================================

    var users = [];

    var userBody = document.getElementById('userBody');
    var userEmpty = document.getElementById('userEmpty');
    var addUserBtn = document.getElementById('addUserBtn');
    var userModalEl = document.getElementById('userModal');
    var userModal = new bootstrap.Modal(userModalEl);
    var userForm = document.getElementById('userForm');
    var userId = document.getElementById('userId');
    var userFirstName = document.getElementById('userFirstName');
    var userLastName = document.getElementById('userLastName');
    var userUsername = document.getElementById('userUsername');
    var userUsernameError = document.getElementById('userUsernameError');
    var userRole = document.getElementById('userRole');
    var userEmail = document.getElementById('userEmail');
    var userContact = document.getElementById('userContact');
    var userPassword = document.getElementById('userPassword');
    var userPasswordHelp = document.getElementById('userPasswordHelp');
    var userActive = document.getElementById('userActive');
    var userModalTitle = document.getElementById('userModalTitle');
    var saveButton = userForm.querySelector('button[type="submit"]');

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // fetch() that always resolves to the server's { success, message, ... }
    function api(url, options) {
        return fetch(url, options).then(function (response) {
            return response.json().catch(function () {
                return { success: false, message: 'Unexpected response from the server.' };
            });
        });
    }

    function loadUsers() {
        return api('api/users')
            .then(function (data) {
                if (!data.success) throw new Error(data.message || 'Failed to load users.');
                users = data.users;
                renderTable();
            })
            .catch(function (error) {
                userBody.innerHTML = '';
                userEmpty.textContent = 'Could not load accounts from the server. Is the Spring Boot backend running?';
                userEmpty.classList.remove('d-none');
                console.error('[User Management]', error);
            });
    }

    function renderTable() {
        if (!users.length) {
            userBody.innerHTML = '';
            userEmpty.textContent = 'No system accounts found.';
            userEmpty.classList.remove('d-none');
            return;
        }
        userEmpty.classList.add('d-none');
        userBody.innerHTML = users.map(function (u) {
            var fullName = escapeHtml(u.firstName + ' ' + u.lastName);
            return (
                '<tr>' +
                    '<td><strong>' + fullName + '</strong></td>' +
                    '<td>' + escapeHtml(u.username || '—') + '</td>' +
                    '<td>' + escapeHtml(u.role) + '</td>' +
                    '<td>' + escapeHtml(u.email) + '</td>' +
                    '<td><span class="pp-badge ' + (u.active ? 'pp-badge-present' : 'pp-badge-absent') + '">' + (u.active ? 'Active' : 'Inactive') + '</span></td>' +
                    '<td class="col-actions text-center">' +
                        '<button type="button" class="btn btn-sm btn-pp-outline me-2" data-action="edit" data-id="' + u.id + '" aria-label="Edit ' + fullName + '"><i class="bi bi-pencil"></i></button>' +
                        '<button type="button" class="btn btn-sm btn-pp-outline" data-action="delete" data-id="' + u.id + '" aria-label="Delete ' + fullName + '"><i class="bi bi-trash"></i></button>' +
                    '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function clearUsernameError() {
        PPValidate.clear(userForm);
    }

    // API field name -> input id, so server errors show beside the right field.
    var SERVER_FIELDS = {
        firstName: 'userFirstName',
        lastName: 'userLastName',
        username: 'userUsername',
        role: 'userRole',
        email: 'userEmail',
        contactNumber: 'userContact',
        password: 'userPassword'
    };

    function setPasswordMode(editing) {
        userPassword.required = !editing;
        userPassword.placeholder = editing ? 'Leave blank to keep the current password' : '';
        userPasswordHelp.textContent = editing
            ? 'Only fill this in to reset the password (8–72 characters, with a letter and a number).'
            : '8–72 characters with at least one letter and one number. The user logs in with their email and this password.';
    }

    function setSaving(saving) {
        saveButton.disabled = saving;
        saveButton.textContent = saving ? 'Saving…' : 'Save User';
    }

    function resetForm() {
        userForm.reset();
        userId.value = '';
        userModalTitle.textContent = 'Add User';
        userRole.value = 'Payroll Staff';
        userActive.checked = true;
        setPasswordMode(false);
        clearUsernameError();
        setSaving(false);
    }

    addUserBtn.addEventListener('click', function () {
        resetForm();
        userModal.show();
    });

    userBody.addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;
        var id = parseInt(btn.dataset.id, 10);
        var user = users.find(function (u) { return u.id === id; });
        if (!user) return;

        if (btn.dataset.action === 'edit') {
            resetForm();
            userModalTitle.textContent = 'Edit User';
            userId.value = user.id;
            userFirstName.value = user.firstName;
            userLastName.value = user.lastName;
            userUsername.value = user.username || '';
            userRole.value = user.role;
            userEmail.value = user.email;
            userContact.value = user.contactNumber || '';
            userActive.checked = !!user.active;
            setPasswordMode(true);
            // Older accounts may hold e.g. "0917-000-0003"; keep only the allowed characters.
            PPValidate.sanitize(userForm);
            userModal.show();
        }

        if (btn.dataset.action === 'delete') {
            ConfirmModal.show({
                title: 'Delete User Account',
                message: 'Delete the account for ' + user.firstName + ' ' + user.lastName + '? They will immediately lose access to the system.',
                confirmText: 'Delete Account',
                tone: 'danger'
            }).then(function (confirmed) {
                if (!confirmed) return;
                api('api/users/' + id, { method: 'DELETE' })
                    .then(function (data) {
                        if (!data.success) {
                            PPToast.error(data.message || 'Could not delete the account.');
                            return;
                        }
                        PPToast.success('User account deleted.');
                        loadUsers();
                    })
                    .catch(function () {
                        PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
                    });
            });
        }
    });

    userForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearUsernameError();

        if (!PPValidate.validateForm(userForm)) {
            return;
        }

        var editingId = userId.value ? parseInt(userId.value, 10) : null;

        // Catch duplicates before the round trip; the server checks again.
        var username = userUsername.value.trim().toLowerCase();
        var email = userEmail.value.trim().toLowerCase();
        var clash = users.find(function (u) {
            return u.id !== editingId && (String(u.username || '').toLowerCase() === username || String(u.email || '').toLowerCase() === email);
        });
        if (clash) {
            var sameUsername = String(clash.username || '').toLowerCase() === username;
            PPValidate.setError(sameUsername ? userUsername : userEmail,
                sameUsername ? 'This username is already taken.' : 'This email address is already used by another account.');
            (sameUsername ? userUsername : userEmail).focus();
            return;
        }

        var payload = {
            firstName: userFirstName.value.trim(),
            lastName: userLastName.value.trim(),
            username: userUsername.value.trim(),
            role: userRole.value,
            email: userEmail.value.trim(),
            contactNumber: userContact.value.trim(),
            password: userPassword.value,
            active: userActive.checked
        };

        setSaving(true);

        api(editingId ? 'api/users/' + editingId : 'api/users', {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (data) {
                setSaving(false);
                if (!data.success) {
                    if (!PPValidate.showServerError(userForm, data, SERVER_FIELDS)) {
                        PPToast.error(data.message || 'Could not save the account.');
                    }
                    return;
                }
                userModal.hide();
                PPToast.success(editingId ? 'User updated.' : 'User added.');
                loadUsers();
            })
            .catch(function () {
                setSaving(false);
                PPToast.error('Could not reach the server. Is the Spring Boot backend running?');
            });
    });

    userModalEl.addEventListener('hidden.bs.modal', resetForm);

    loadUsers();
})();
