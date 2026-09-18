(function () {
    PayrollProLayout.init({
        activeNav: 'users',
        navMode: 'admin',
        user: { name: 'System Administrator', role: 'System Administrator', initials: 'SA' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var users = DataStore.getUsers();

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
    var userActive = document.getElementById('userActive');
    var userModalTitle = document.getElementById('userModalTitle');

    function persist() {
        DataStore.saveUsers(users);
    }

    function isUsernameTaken(username, excludeId) {
        return users.some(function (u) {
            return u.username.toLowerCase() === username.toLowerCase() && u.id !== excludeId;
        });
    }

    function renderTable() {
        if (!users.length) {
            userBody.innerHTML = '';
            userEmpty.classList.remove('d-none');
            return;
        }
        userEmpty.classList.add('d-none');
        userBody.innerHTML = users.map(function (u) {
            var fullName = u.firstName + ' ' + u.lastName;
            return (
                '<tr>' +
                    '<td><strong>' + fullName + '</strong></td>' +
                    '<td>' + u.username + '</td>' +
                    '<td>' + u.role + '</td>' +
                    '<td>' + u.email + '</td>' +
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
        userUsername.classList.remove('is-invalid');
        userUsernameError.textContent = '';
    }

    function resetForm() {
        userForm.reset();
        userForm.classList.remove('was-validated');
        userId.value = '';
        userModalTitle.textContent = 'Add User';
        userRole.value = 'Payroll Staff';
        userActive.checked = true;
        clearUsernameError();
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
            userUsername.value = user.username;
            userRole.value = user.role;
            userEmail.value = user.email;
            userContact.value = user.contactNumber;
            userActive.checked = !!user.active;
            userModal.show();
        }

        if (btn.dataset.action === 'delete') {
            ConfirmModal.show({
                title: 'Delete User Account',
                message: 'Delete the account for ' + user.firstName + ' ' + user.lastName + ' (' + user.username + ')? They will immediately lose access to the system.',
                confirmText: 'Delete Account',
                tone: 'danger'
            }).then(function (confirmed) {
                if (!confirmed) return;
                users = users.filter(function (u) { return u.id !== id; });
                persist();
                renderTable();
                PPToast.success('User account deleted.');
            });
        }
    });

    userForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearUsernameError();

        if (!userForm.checkValidity()) {
            userForm.classList.add('was-validated');
            return;
        }

        var editingId = userId.value ? parseInt(userId.value, 10) : null;
        var username = userUsername.value.trim();

        if (isUsernameTaken(username, editingId)) {
            userUsername.classList.add('is-invalid');
            userUsernameError.textContent = 'This username is already taken.';
            return;
        }

        var payload = {
            id: editingId || DataStore.nextNumericId(users),
            firstName: userFirstName.value.trim(),
            lastName: userLastName.value.trim(),
            username: username,
            role: userRole.value,
            email: userEmail.value.trim(),
            contactNumber: userContact.value.trim(),
            active: userActive.checked
        };

        var idx = users.findIndex(function (u) { return u.id === payload.id; });
        if (idx >= 0) {
            users[idx] = payload;
        } else {
            users.unshift(payload);
        }

        persist();
        userModal.hide();
        renderTable();
        PPToast.success(editingId ? 'User updated.' : 'User added.');
    });

    userModalEl.addEventListener('hidden.bs.modal', resetForm);

    renderTable();
})();
