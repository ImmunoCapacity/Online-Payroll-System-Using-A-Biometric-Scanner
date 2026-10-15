/**
 * Forgot Password (login page)
 * ---------------------------------------------------------------
 * 1. Email:  api/auth/forgot-password emails a 6-digit code (OTP).
 * 2. Code:   api/auth/verify-otp checks it and returns a reset token.
 * 3. New password + confirm: api/auth/reset-password saves it.
 * The new password replaces the account's password — the same one the
 * System Administrator manages in User Management.
 * ---------------------------------------------------------------
 */
(function () {
    'use strict';

    var link = document.getElementById('forgotPassword');
    var modalEl = document.getElementById('resetModal');
    if (!link || !modalEl || typeof bootstrap === 'undefined') return;

    var modal = new bootstrap.Modal(modalEl);
    var emailForm = document.getElementById('resetEmailForm');
    var codeForm = document.getElementById('resetCodeForm');
    var passwordForm = document.getElementById('resetPasswordForm');
    var emailInput = document.getElementById('resetEmail');
    var codeInput = document.getElementById('resetCode');
    var newPassword = document.getElementById('resetNewPassword');
    var confirmPassword = document.getElementById('resetConfirmPassword');
    var message = document.getElementById('resetMessage');
    var resendLink = document.getElementById('resetResend');

    var EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    var state = { email: '', token: '' };
    var resendTimer = null;

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------

    function post(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function (response) {
            return response.json().catch(function () {
                return { success: false, message: 'Unexpected response from the server.' };
            });
        });
    }

    function showStep(step) {
        [emailForm, codeForm, passwordForm].forEach(function (form) {
            form.classList.toggle('d-none', form.dataset.step !== String(step));
        });
        modalEl.querySelectorAll('.reset-steps li').forEach(function (li) {
            var n = Number(li.dataset.step);
            li.classList.toggle('active', n === step);
            li.classList.toggle('done', n < step);
        });
        hideMessage();
        var first = { 1: emailInput, 2: codeInput, 3: newPassword }[step];
        setTimeout(function () { first.focus(); }, 50);
    }

    function setFieldError(input, text) {
        var feedback = document.getElementById(input.id + 'Error');
        input.classList.toggle('is-invalid', !!text);
        if (feedback) feedback.textContent = text || '';
    }

    function clearFieldErrors() {
        [emailInput, codeInput, newPassword, confirmPassword].forEach(function (input) { setFieldError(input, ''); });
    }

    function showMessage(text, kind) {
        message.textContent = text;
        message.className = 'reset-message show ' + (kind || 'error');
    }

    function hideMessage() {
        message.textContent = '';
        message.className = 'reset-message';
    }

    function busy(button, isBusy, label) {
        button.disabled = isBusy;
        if (isBusy) {
            button.dataset.label = button.textContent;
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' + label;
        } else if (button.dataset.label) {
            button.textContent = button.dataset.label;
        }
    }

    function failed() {
        showMessage('Could not reach the server. Check your connection and try again.');
    }

    // "Resend code" is available again after 60 seconds.
    function startResendTimer() {
        var seconds = 60;
        clearInterval(resendTimer);
        resendLink.classList.add('disabled');
        resendLink.textContent = 'Resend code (' + seconds + 's)';
        resendTimer = setInterval(function () {
            seconds--;
            if (seconds <= 0) {
                clearInterval(resendTimer);
                resendLink.classList.remove('disabled');
                resendLink.textContent = 'Resend code';
            } else {
                resendLink.textContent = 'Resend code (' + seconds + 's)';
            }
        }, 1000);
    }

    function sendCode(button) {
        busy(button, true, 'Sending…');
        return post('api/auth/forgot-password', { email: state.email }).then(function (data) {
            if (!data.success) {
                if (data.field === 'email') setFieldError(emailInput, data.message);
                else showMessage(data.message || 'Could not send the code.');
                return false;
            }
            return data.message;
        }).catch(function () {
            failed();
            return false;
        }).then(function (result) {
            busy(button, false);
            return result;
        });
    }

    // ------------------------------------------------------------
    // Open
    // ------------------------------------------------------------

    link.addEventListener('click', function (e) {
        e.preventDefault();
        state = { email: '', token: '' };
        [emailForm, codeForm, passwordForm].forEach(function (form) { form.reset(); });
        clearFieldErrors();
        // Start from the email typed on the login form, if any.
        var loginEmail = document.getElementById('email');
        if (loginEmail && loginEmail.value.trim()) emailInput.value = loginEmail.value.trim();
        showStep(1);
        modal.show();
    });

    modalEl.addEventListener('shown.bs.modal', function () {
        var visible = modalEl.querySelector('.reset-step:not(.d-none) input');
        if (visible) visible.focus();
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
        clearInterval(resendTimer);
        state.token = '';
        newPassword.value = '';
        confirmPassword.value = '';
    });

    // ------------------------------------------------------------
    // Step 1 — email
    // ------------------------------------------------------------

    emailForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFieldErrors();
        hideMessage();
        var email = emailInput.value.trim();
        if (!email) { setFieldError(emailInput, 'Email is required.'); return; }
        if (!EMAIL.test(email)) { setFieldError(emailInput, 'Enter a valid email address (e.g. name@example.com).'); return; }
        state.email = email;

        sendCode(document.getElementById('resetSendBtn')).then(function (result) {
            if (!result) return;
            showStep(2);
            document.getElementById('resetCodeHelp').textContent = result;
            startResendTimer();
        });
    });

    // ------------------------------------------------------------
    // Step 2 — code
    // ------------------------------------------------------------

    // Digits only.
    codeInput.addEventListener('input', function () {
        codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
        setFieldError(codeInput, '');
    });

    codeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFieldErrors();
        hideMessage();
        var code = codeInput.value.trim();
        if (!/^\d{6}$/.test(code)) { setFieldError(codeInput, 'Enter the 6-digit code from the email.'); return; }

        var button = document.getElementById('resetVerifyBtn');
        busy(button, true, 'Checking…');
        post('api/auth/verify-otp', { email: state.email, code: code }).then(function (data) {
            if (!data.success) {
                if (data.field === 'code') setFieldError(codeInput, data.message);
                else showMessage(data.message || 'Could not verify the code.');
                return;
            }
            state.token = data.resetToken;
            clearInterval(resendTimer);
            showStep(3);
        }).catch(failed).then(function () {
            busy(button, false);
        });
    });

    resendLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (resendLink.classList.contains('disabled')) return;
        clearFieldErrors();
        hideMessage();
        sendCode(document.getElementById('resetVerifyBtn')).then(function (result) {
            if (!result) return;
            codeInput.value = '';
            showMessage('A new code has been sent. Earlier codes no longer work.', 'info');
            startResendTimer();
        });
    });

    document.getElementById('resetChangeEmail').addEventListener('click', function (e) {
        e.preventDefault();
        clearInterval(resendTimer);
        showStep(1);
    });

    // ------------------------------------------------------------
    // Step 3 — new password + confirm
    // ------------------------------------------------------------

    function passwordProblem(value) {
        if (!value) return 'New password is required.';
        if (value.length < 8 || value.length > 72 || !/\p{L}/u.test(value) || !/\d/.test(value)) {
            return 'Password must be 8–72 characters and include at least one letter and one number.';
        }
        return '';
    }

    newPassword.addEventListener('input', function () { setFieldError(newPassword, ''); });
    confirmPassword.addEventListener('input', function () { setFieldError(confirmPassword, ''); });

    document.getElementById('resetShowPasswords').addEventListener('change', function (e) {
        var type = e.target.checked ? 'text' : 'password';
        newPassword.type = type;
        confirmPassword.type = type;
    });

    passwordForm.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFieldErrors();
        hideMessage();
        var problem = passwordProblem(newPassword.value);
        if (problem) { setFieldError(newPassword, problem); return; }
        if (!confirmPassword.value) { setFieldError(confirmPassword, 'Confirm your new password.'); return; }
        if (newPassword.value !== confirmPassword.value) { setFieldError(confirmPassword, 'The passwords don\'t match.'); return; }

        var button = document.getElementById('resetSaveBtn');
        busy(button, true, 'Saving…');
        post('api/auth/reset-password', {
            email: state.email,
            resetToken: state.token,
            password: newPassword.value,
            confirmPassword: confirmPassword.value
        }).then(function (data) {
            if (!data.success) {
                if (data.field === 'password') setFieldError(newPassword, data.message);
                else if (data.field === 'confirmPassword') setFieldError(confirmPassword, data.message);
                else showMessage(data.message || 'Could not change the password.');
                return;
            }
            modal.hide();
            // Back on the login form: fill in the email and say so.
            var loginEmail = document.getElementById('email');
            var loginPassword = document.getElementById('password');
            var status = document.getElementById('statusMessage');
            if (loginEmail) loginEmail.value = state.email;
            if (loginPassword) { loginPassword.value = ''; setTimeout(function () { loginPassword.focus(); }, 300); }
            if (status) {
                status.textContent = data.message || 'Your password has been changed. You can now log in.';
                status.classList.add('show', 'alert-success-note');
            }
        }).catch(failed).then(function () {
            busy(button, false);
        });
    });
})();
