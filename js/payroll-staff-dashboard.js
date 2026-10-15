/**
 * ============================================================
 * PayrollPro
 * Payroll Staff Dashboard
 * ============================================================
 */

(function () {

    'use strict';


    // ============================================================
    // INITIALIZE WHEN PAGE LOADS
    // ============================================================

    document.addEventListener('DOMContentLoaded', function () {

        initializePayrollStaffLayout();

        updateCurrentDate();

        loadDashboardData();

    });


    // ============================================================
    // PAYROLL STAFF LAYOUT
    // ============================================================

    function initializePayrollStaffLayout() {

        if (!window.PayrollProLayout) {

            console.error(
                'PayrollProLayout is not available.'
            );

            return;
        }


        PayrollProLayout.init({

            // ----------------------------------------------------
            // ACTIVE PAGE
            // ----------------------------------------------------

            activeNav: 'dashboard',


            // ----------------------------------------------------
            // IMPORTANT:
            // THIS MUST BE payrollStaff
            // NOT master
            // ----------------------------------------------------

            navMode: 'payrollStaff',


            // ----------------------------------------------------
            // USER INFORMATION
            // ----------------------------------------------------

            user: {

                name: 'Payroll Staff',

                role: 'Payroll Staff',

                initials: 'PS'

            },


            // ----------------------------------------------------
            // INSTITUTION
            // ----------------------------------------------------

            institution: {

                name: 'STI College Balayan',

                short: 'STI'

            },


            // ----------------------------------------------------
            // NOTIFICATIONS
            // ----------------------------------------------------

            notifications: true

        });

    }


    // ============================================================
    // CURRENT DATE
    // ============================================================

    function updateCurrentDate() {

        var dateElement =
            document.getElementById('currentDate');


        if (!dateElement) {

            return;

        }


        var today = new Date();


        var formattedDate =
            today.toLocaleDateString(
                'en-US',
                {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }
            );


        dateElement.textContent =
            formattedDate;

    }


    // ============================================================
    // DASHBOARD DATA
    // ============================================================

    // Today's attendance from the Daily Time Record (api/dtr/summary).
    function loadDashboardData() {

        var now = new Date();
        var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

        fetch('api/dtr/summary?from=' + today + '&to=' + today)
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) throw new Error(data.message);
                showAttendance(data.employees);
            })
            .catch(function (error) {
                console.error('[Payroll Staff Dashboard] Could not load attendance:', error);
                setText('presentPercentage', 'Could not load attendance');
            });

    }

    function showAttendance(employees) {

        function count(key) {
            return employees.reduce(function (sum, e) { return sum + (e[key] || 0); }, 0);
        }

        var present = count('present');
        var late = count('late');
        var absent = count('absent');
        var onLeave = count('onLeave');

        var total = employees.length;

        setText(
            'totalEmployees',
            String(total)
        );


        setText(
            'presentToday',
            String(present)
        );


        setText(
            'lateToday',
            String(late)
        );


        setText(
            'absentToday',
            String(absent)
        );


        setText(
            'overviewPresent',
            String(present)
        );


        setText(
            'overviewLate',
            String(late)
        );


        setText(
            'overviewAbsent',
            String(absent)
        );


        setText(
            'overviewLeave',
            String(onLeave)
        );


        // --------------------------------------------------------
        // PRESENT PERCENTAGE
        // --------------------------------------------------------

        var percentage =
            total > 0
                ? Math.round((present / total) * 100)
                : 0;


        setText(
            'presentPercentage',
            percentage + '% of employees'
        );

    }


    // ============================================================
    // SAFE TEXT UPDATE
    // ============================================================

    function setText(id, value) {

        var element =
            document.getElementById(id);


        if (element) {

            element.textContent = value;

        }

    }

})();