(function () {

    'use strict';

    // ============================================================
    // WAIT FOR PAGE TO LOAD
    // ============================================================

    document.addEventListener('DOMContentLoaded', function () {

        // ========================================================
        // USER ROLES
        // ========================================================

        const ROLES = {

            'admin@institution.edu': {
                role: 'System Administrator',
                dashboard: 'system-admin.html'
            },

            'payroll.master@institution.edu': {
                role: 'Payroll Master',
                dashboard: 'dashboard.html'
            },

            'payroll.staff@institution.edu': {
                role: 'Payroll Staff',
                dashboard: 'payroll-staff.html'
            },

            'faculty@institution.edu': {
                role: 'Faculty Staff',
                dashboard: 'faculty.html'
            },

            'adminstaff@institution.edu': {
                role: 'Administrative Staff',
                dashboard: 'admin-staff.html'
            }

        };


        // ========================================================
        // LOGIN SETTINGS
        // ========================================================

        const DEMO_PASSWORD = 'PayrollPro2026';

        const LOCKED_EMAIL = 'locked@institution.edu';


        // ========================================================
        // GET HTML ELEMENTS
        // ========================================================

        const form =
            document.getElementById('loginForm');

        const emailInput =
            document.getElementById('email');

        const passwordInput =
            document.getElementById('password');

        const emailError =
            document.getElementById('emailError');

        const passwordError =
            document.getElementById('passwordError');

        const loginBtn =
            document.getElementById('loginBtn');

        const loginBtnText =
            document.getElementById('loginBtnText');

        const loginBtnSpinner =
            document.getElementById('loginBtnSpinner');

        const lockedAlert =
            document.getElementById('lockedAlert');

        const statusMessage =
            document.getElementById('statusMessage');

        const togglePassword =
            document.getElementById('togglePassword');

        const toggleIcon =
            document.getElementById('toggleIcon');

        const forgotPassword =
            document.getElementById('forgotPassword');


        let isLoading = false;


        // ========================================================
        // CHECK REQUIRED LOGIN ELEMENTS
        // ========================================================

        if (!form) {

            console.error(
                '[PayrollPro Login] #loginForm was not found.'
            );

            return;

        }

        if (!emailInput) {

            console.error(
                '[PayrollPro Login] #email was not found.'
            );

            return;

        }

        if (!passwordInput) {

            console.error(
                '[PayrollPro Login] #password was not found.'
            );

            return;

        }

        if (!loginBtn) {

            console.error(
                '[PayrollPro Login] #loginBtn was not found.'
            );

            return;

        }


        // ========================================================
        // LOADING STATE
        // ========================================================

        function setLoading(loading) {

            isLoading = loading;

            loginBtn.disabled = loading;

            emailInput.disabled = loading;

            passwordInput.disabled = loading;


            if (togglePassword) {

                togglePassword.disabled = loading;

            }


            if (loginBtnSpinner) {

                loginBtnSpinner.classList.toggle(
                    'd-none',
                    !loading
                );

            }


            if (loginBtnText) {

                loginBtnText.textContent =
                    loading
                        ? 'Signing in…'
                        : 'Log In';

            }

        }


        // ========================================================
        // CLEAR ERRORS
        // ========================================================

        function clearErrors() {

            emailInput.classList.remove('is-invalid');

            passwordInput.classList.remove('is-invalid');


            if (emailError) {

                emailError.textContent = '';

            }


            if (passwordError) {

                passwordError.textContent = '';

                passwordError.style.display = 'none';

                passwordError.classList.remove('d-block');

            }


            if (lockedAlert) {

                lockedAlert.classList.remove('show');

            }


            if (statusMessage) {

                statusMessage.classList.remove('show');

                statusMessage.textContent = '';

            }

        }


        // ========================================================
        // SHOW LOGIN ERROR
        // ========================================================

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


        // ========================================================
        // SHOW LOCKED ACCOUNT
        // ========================================================

        function showLocked() {

            clearErrors();


            if (lockedAlert) {

                lockedAlert.classList.add('show');

            }


            emailInput.classList.add('is-invalid');

            passwordInput.classList.add('is-invalid');

        }


        // ========================================================
        // SHOW STATUS MESSAGE
        // ========================================================

        function showStatus(message) {

            clearErrors();


            if (!statusMessage) {

                return;

            }


            statusMessage.textContent = message;

            statusMessage.classList.add('show');

        }


        // ========================================================
        // DEFAULT STATE
        // ========================================================

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

            togglePassword.addEventListener(
                'click',
                function () {

                    const isPassword =
                        passwordInput.type === 'password';


                    passwordInput.type =
                        isPassword
                            ? 'text'
                            : 'password';


                    toggleIcon.className =
                        isPassword
                            ? 'bi bi-eye-slash'
                            : 'bi bi-eye';


                    togglePassword.setAttribute(
                        'aria-label',
                        isPassword
                            ? 'Hide password'
                            : 'Show password'
                    );


                    togglePassword.setAttribute(
                        'aria-pressed',
                        String(isPassword)
                    );

                }
            );

        }


        // ========================================================
        // FORGOT PASSWORD
        // ========================================================

        if (forgotPassword) {

            forgotPassword.addEventListener(
                'click',
                function (e) {

                    e.preventDefault();

                    showStatus(
                        'Password reset requests are handled by your institution\'s IT or HR office.'
                    );

                }
            );

        }


        // ========================================================
        // LOGIN FORM
        // ========================================================

        form.addEventListener(
            'submit',
            function (e) {

                // VERY IMPORTANT:
                // Prevent the browser from submitting the form
                // using ?email=...&password=...
                e.preventDefault();

                e.stopPropagation();


                if (isLoading) {

                    return;

                }


                clearErrors();


                // =================================================
                // GET INPUT VALUES
                // =================================================

                const email =
                    emailInput.value
                        .trim()
                        .toLowerCase();

                const password =
                    passwordInput.value;


                // =================================================
                // VALIDATE EMAIL
                // =================================================

                if (!email) {

                    emailInput.classList.add(
                        'is-invalid'
                    );


                    if (emailError) {

                        emailError.textContent =
                            'Please enter your email address.';

                    }


                    emailInput.focus();

                    return;

                }


                // =================================================
                // VALIDATE PASSWORD
                // =================================================

                if (!password) {

                    passwordInput.classList.add(
                        'is-invalid'
                    );


                    if (passwordError) {

                        passwordError.textContent =
                            'Please enter your password.';

                        passwordError.style.display =
                            'block';

                    }


                    passwordInput.focus();

                    return;

                }


                // =================================================
                // START LOADING
                // =================================================

                setLoading(true);


                // =================================================
                // DEMO LOGIN CHECK
                // =================================================

                setTimeout(
                    function () {

                        // -----------------------------------------
                        // CHECK LOCKED ACCOUNT
                        // -----------------------------------------

                        if (email === LOCKED_EMAIL) {

                            setLoading(false);

                            showLocked();

                            return;

                        }


                        // -----------------------------------------
                        // FIND USER
                        // -----------------------------------------

                        const user =
                            ROLES[email];


                        // -----------------------------------------
                        // INVALID LOGIN
                        // -----------------------------------------

                        if (
                            !user ||
                            password !== DEMO_PASSWORD
                        ) {

                            setLoading(false);

                            showError(
                                'Invalid email or password'
                            );

                            return;

                        }


                        // =================================================
                        // SAVE LOGIN INFORMATION
                        // =================================================

                        try {

                            // ---------------------------------------------
                            // AUTHENTICATION FLAG
                            // ---------------------------------------------

                            localStorage.setItem(
                                'ppAuthenticated',
                                'true'
                            );


                            // ---------------------------------------------
                            // CREATE INITIALS
                            // ---------------------------------------------

                            const initials =
                                (user.role || 'U')
                                    .split(' ')
                                    .map(function (part) {

                                        return part.charAt(0);

                                    })
                                    .join('')
                                    .slice(0, 2)
                                    .toUpperCase();


                            // ---------------------------------------------
                            // SAVE LOGGED-IN USER
                            // ---------------------------------------------

                            localStorage.setItem(
                                'ppUser',
                                JSON.stringify({

                                    name: user.role,

                                    role: user.role,

                                    initials: initials

                                })
                            );


                            console.log(
                                '[PayrollPro Login] Login successful:',
                                user.role
                            );


                            console.log(
                                '[PayrollPro Login] Saved ppUser:',
                                localStorage.getItem('ppUser')
                            );


                        } catch (error) {

                            console.error(
                                '[PayrollPro Login] Could not save login state:',
                                error
                            );


                            setLoading(false);

                            showError(
                                'Unable to save login information. Please try again.'
                            );

                            return;

                        }


                        // =================================================
                        // REDIRECT
                        // =================================================

                        if (loginBtnText) {

                            loginBtnText.textContent =
                                'Redirecting…';

                        }


                        setTimeout(
                            function () {

                                window.location.href =
                                    user.dashboard;

                            },
                            600
                        );


                    },
                    1200
                );

            }
        );


        // ========================================================
        // DEMO STATE BUTTONS
        // ========================================================

        document
            .querySelectorAll('[data-state]')
            .forEach(function (btn) {

                btn.addEventListener(
                    'click',
                    function () {

                        const state =
                            btn.getAttribute(
                                'data-state'
                            );


                        setDefaultState();


                        switch (state) {

                            case 'error':

                                emailInput.value =
                                    'user@institution.edu';

                                passwordInput.value =
                                    'wrongpassword';

                                showError(
                                    'Invalid email or password'
                                );

                                break;


                            case 'loading':

                                emailInput.value =
                                    'faculty@institution.edu';

                                passwordInput.value =
                                    '••••••••';

                                setLoading(true);

                                break;


                            case 'locked':

                                emailInput.value =
                                    LOCKED_EMAIL;

                                passwordInput.value =
                                    '••••••••';

                                showLocked();

                                break;


                            default:

                                break;

                        }

                    }
                );

            });


        // ========================================================
        // INITIAL STATE
        // ========================================================

        setLoading(false);


        console.log(
            '[PayrollPro Login] Login script initialized successfully.'
        );

    });

})();