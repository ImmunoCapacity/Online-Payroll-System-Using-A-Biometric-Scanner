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

    function loadDashboardData() {

        var employees = DataStore.getEmployees().filter(function (e) { return e.status === 'Active'; });
        var today = new Date().toISOString().slice(0, 10);
        var todaysDtr = DataStore.getDTR().filter(function (r) { return r.date === today; });

        var present = todaysDtr.filter(function (r) { return r.status === 'present'; }).length;
        var late = todaysDtr.filter(function (r) { return r.status === 'late'; }).length;
        var absent = todaysDtr.filter(function (r) { return r.status === 'absent'; }).length;
        var onLeave = todaysDtr.filter(function (r) { return r.status === 'leave'; }).length;

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