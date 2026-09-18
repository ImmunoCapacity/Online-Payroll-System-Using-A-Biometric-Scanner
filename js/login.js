(function () {

    'use strict';

    var ROLE_HOME = {
        'System Administrator': 'system-admin.html',
        'Payroll Master': 'dashboard.html',
        'Payroll Staff': 'payroll-staff.html',
        'Faculty Staff': 'payslip.html',
        'Administrative Staff': 'payslip.html'
    };

    // ============================================================
    // IF ALREADY LOGGED IN, SKIP THE LOGIN SCREEN
    // ============================================================

    (function redirectIfAlreadyAuthenticated() {

        try {
            var authed = localStorage.getItem('ppAuthenticated') === 'true';
            var raw = localStorage.getItem('ppUser');

            if (authed && raw) {
                var user = JSON.parse(raw);
                window.location.replace(ROLE_HOME[user.role] || 'dashboard.html');
            }
        } catch (error) {
            // If localStorage is unavailable, just show the login form as normal.
        }

    })();

    // ============================================================
    // WAIT FOR PAGE TO LOAD
    // ============================================================

    document.addEventListener('DOMContentLoaded', function () {

        // ========================================================
        // GET HTML ELEMENTS
        // ========================================================

        const form = document.getElementById('loginForm');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const loginBtn = document.getElementById('loginBtn');
        const loginBtnText = document.getElementById('loginBtnText');
        const loginBtnSpinner = document.getElementById('loginBtnSpinner');
        const lockedAlert = document.getElementById('lockedAlert');
        const statusMessage = document.getElementById('statusMessage');
        const togglePassword = document.getElementById('togglePassword');
        const toggleIcon = document.getElementById('toggleIcon');
        const forgotPassword = document.getElementById('forgotPassword');

        let isLoading = false;

        // ========================================================
        // CHECK REQUIRED LOGIN ELEMENTS
        // ========================================================

        if (!form) { console.error('[Login] #loginForm was not found.'); return; }
        if (!emailInput) { console.error('[Login] #email was not found.'); return; }
        if (!passwordInput) { console.error('[Login] #password was not found.'); return; }
        if (!loginBtn) { console.error('[Login] #loginBtn was not found.'); return; }

        // ========================================================
        // LOADING STATE
        // ========================================================

        function setLoading(loading) {
            isLoading = loading;
            loginBtn.disabled = loading;
            emailInput.disabled = loading;
            passwordInput.disabled = loading;

            if (togglePassword) togglePassword.disabled = loading;
            if (loginBtnSpinner) loginBtnSpinner.classList.toggle('d-none', !loading);
            if (loginBtnText) loginBtnText.textContent = loading ? 'Signing in…' : 'Log In';
        }

        // ========================================================
        // CLEAR / SHOW ERRORS
        // ========================================================

        function clearErrors() {
            emailInput.classList.remove('is-invalid');
            passwordInput.classList.remove('is-invalid');

            if (emailError) emailError.textContent = '';

            if (passwordError) {
                passwordError.textContent = '';
                passwordError.style.display = 'none';
                passwordError.classList.remove('d-block');
            }

            if (lockedAlert) lockedAlert.classList.remove('show');

            if (statusMessage) {
                statusMessage.classList.remove('show');
                statusMessage.textContent = '';
            }
        }

        function showError(message) {
            clearErrors();
            emailInput.classList.add('is-invalid');
            passwordInput.classList.add('is-invalid');

            if (passwordError) {
                passwordError.textContent = message;
                passwordError.style.display = 'block';
                passwordError.classList.add('d-block');
            }
        }

        function showLocked() {
            clearErrors();
            if (lockedAlert) lockedAlert.classList.add('show');
            emailInput.classList.add('is-invalid');
            passwordInput.classList.add('is-invalid');
        }

        function showStatus(message) {
            clearErrors();
            if (!statusMessage) return;
            statusMessage.textContent = message;
            statusMessage.classList.add('show');
        }

        function setDefaultState() {
            clearErrors();
            setLoading(false);
            emailInput.value = '';
            passwordInput.value = '';
        }

        // ========================================================
        // TOGGLE PASSWORD
        // ========================================================

        if (togglePassword && toggleIcon) {
            togglePassword.addEventListener('click', function () {
                const isPassword = passwordInput.type === 'password';
                passwordInput.type = isPassword ? 'text' : 'password';
                toggleIcon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
                togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
                togglePassword.setAttribute('aria-pressed', String(isPassword));
            });
        }

        // ========================================================
        // FORGOT PASSWORD
        // ========================================================

        if (forgotPassword) {
            forgotPassword.addEventListener('click', function (e) {
                e.preventDefault();
                showStatus('Password reset requests are handled by your institution\'s IT or HR office.');
            });
        }

        // ========================================================
        // LOGIN FORM
        // ========================================================

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();

            if (isLoading) return;

            clearErrors();

            const email = emailInput.value.trim().toLowerCase();
            const password = passwordInput.value;

            if (!email) {
                emailInput.classList.add('is-invalid');
                if (emailError) emailError.textContent = 'Please enter your email address.';
                emailInput.focus();
                return;
            }

            if (!password) {
                passwordInput.classList.add('is-invalid');
                if (passwordError) {
                    passwordError.textContent = 'Please enter your password.';
                    passwordError.style.display = 'block';
                }
                passwordInput.focus();
                return;
            }

            setLoading(true);

            fetch('api/auth/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        return { status: response.status, data: data };
                    });
                })
                .then(function (result) {
                    if (result.status === 403) {
                        setLoading(false);
                        showLocked();
                        return;
                    }

                    if (!result.data.success) {
                        setLoading(false);
                        showError(result.data.message || 'Invalid email or password.');
                        return;
                    }

                    const user = result.data.user;
                    const initials = (user.role || 'U')
                        .split(' ')
                        .map(function (part) { return part.charAt(0); })
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                    try {
                        localStorage.setItem('ppAuthenticated', 'true');
                        localStorage.setItem('ppUser', JSON.stringify({
                            name: user.name,
                            role: user.role,
                            email: user.email,
                            initials: initials
                        }));
                    } catch (storageError) {
                        setLoading(false);
                        showError('Unable to save login information. Please try again.');
                        return;
                    }

                    if (loginBtnText) loginBtnText.textContent = 'Redirecting…';

                    setTimeout(function () {
                        window.location.href = ROLE_HOME[user.role] || 'dashboard.html';
                    }, 400);
                })
                .catch(function (error) {
                    console.error('[Login] Request failed:', error);
                    setLoading(false);
                    showError('Could not reach the server. Is the PHP backend running?');
                });
        });

        // ========================================================
        // DEMO STATE PREVIEW BUTTONS (if present on the page)
        // ========================================================
        // Purely cosmetic — lets you preview the Error/Loading/Locked
        // visual states without a real request. Harmless alongside the
        // real login above, since it only fires on an explicit click.

        document.querySelectorAll('[data-state]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const state = btn.getAttribute('data-state');
                setDefaultState();

                switch (state) {
                    case 'error':
                        emailInput.value = 'user@institution.edu';
                        passwordInput.value = 'wrongpassword';
                        showError('Invalid email or password');
                        break;
                    case 'loading':
                        emailInput.value = 'faculty@institution.edu';
                        passwordInput.value = '••••••••';
                        setLoading(true);
                        break;
                    case 'locked':
                        emailInput.value = 'locked@institution.edu';
                        passwordInput.value = '••••••••';
                        showLocked();
                        break;
                    default:
                        break;
                }
            });
        });

        // ========================================================
        // INITIAL STATE
        // ========================================================

        setLoading(false);

    });

})();
