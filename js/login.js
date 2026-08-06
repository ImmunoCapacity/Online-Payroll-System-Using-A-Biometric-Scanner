(function () {
    const ROLES = {
        'admin@institution.edu': { role: 'System Administrator', dashboard: '/dashboard/admin' },
        'payroll.master@institution.edu': { role: 'Payroll Master', dashboard: '/dashboard/payroll-master' },
        'payroll@institution.edu': { role: 'Payroll Staff', dashboard: '/dashboard/payroll-staff' },
        'faculty@institution.edu': { role: 'Faculty Staff', dashboard: '/dashboard/faculty' },
        'adminstaff@institution.edu': { role: 'Administrative Staff', dashboard: '/dashboard/admin-staff' }
    };

    const DEMO_PASSWORD = 'PayrollPro2026';
    const LOCKED_EMAIL = 'locked@institution.edu';

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

    function setLoading(loading) {
        isLoading = loading;
        loginBtn.disabled = loading;
        emailInput.disabled = loading;
        passwordInput.disabled = loading;
        togglePassword.disabled = loading;
        loginBtnSpinner.classList.toggle('d-none', !loading);
        loginBtnText.textContent = loading ? 'Signing in…' : 'Log In';
    }

    function clearErrors() {
        emailInput.classList.remove('is-invalid');
        passwordInput.classList.remove('is-invalid');
        emailError.textContent = '';
        passwordError.textContent = '';
        passwordError.style.display = 'none';
        lockedAlert.classList.remove('show');
        statusMessage.classList.remove('show');
        statusMessage.textContent = '';
    }

    function showError(message) {
        clearErrors();
        emailInput.classList.add('is-invalid');
        passwordInput.classList.add('is-invalid');
        passwordError.textContent = message;
        passwordError.style.display = 'block';
        passwordError.classList.add('d-block');
    }

    function showLocked() {
        clearErrors();
        lockedAlert.classList.add('show');
        emailInput.classList.add('is-invalid');
        passwordInput.classList.add('is-invalid');
    }

    function showStatus(message) {
        clearErrors();
        statusMessage.textContent = message;
        statusMessage.classList.add('show');
    }

    function setDefaultState() {
        clearErrors();
        setLoading(false);
        emailInput.value = '';
        passwordInput.value = '';
    }

    togglePassword.addEventListener('click', function () {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
        togglePassword.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
        togglePassword.setAttribute('aria-pressed', String(isPassword));
    });

    forgotPassword.addEventListener('click', function (e) {
        e.preventDefault();
        showStatus('Password reset requests are handled by your institution\'s IT or HR office.');
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (isLoading) return;

        clearErrors();

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (!email) {
            emailInput.classList.add('is-invalid');
            emailError.textContent = 'Please enter your email address.';
            emailInput.focus();
            return;
        }

        if (!password) {
            passwordInput.classList.add('is-invalid');
            passwordError.textContent = 'Please enter your password.';
            passwordError.style.display = 'block';
            passwordInput.focus();
            return;
        }

        setLoading(true);

        setTimeout(function () {
            if (email === LOCKED_EMAIL) {
                setLoading(false);
                showLocked();
                return;
            }

            const user = ROLES[email];
            if (!user || password !== DEMO_PASSWORD) {
                setLoading(false);
                showError('Invalid email or password');
                return;
            }

            try {
                window.localStorage.setItem('ppAuthenticated', 'true');
                window.localStorage.setItem('ppUser', JSON.stringify({
                    name: user.role,
                    role: user.role,
                    initials: (user.role || 'U').split(' ').map(function (part) {
                        return part.charAt(0);
                    }).join('').slice(0, 2).toUpperCase()
                }));
            } catch (error) {
                console.warn('Could not save login state:', error);
            }

            loginBtnText.textContent = 'Redirecting…';
            setTimeout(function () {
                const redirectTarget = new URLSearchParams(window.location.search).get('redirect');
                const destination = redirectTarget ? decodeURIComponent(redirectTarget) : 'dashboard.html';
                window.location.href = destination;
            }, 600);
        }, 1200);
    });

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
                    emailInput.value = LOCKED_EMAIL;
                    passwordInput.value = '••••••••';
                    showLocked();
                    break;
                default:
                    break;
            }
        });
    });
})();
