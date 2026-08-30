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

        /*
         * Temporary demonstration data.
         *
         * These can later be replaced with
         * Spring Boot API calls.
         */


        setText(
            'totalEmployees',
            '120'
        );


        setText(
            'presentToday',
            '96'
        );


        setText(
            'lateToday',
            '8'
        );


        setText(
            'absentToday',
            '6'
        );


        setText(
            'overviewPresent',
            '96'
        );


        setText(
            'overviewLate',
            '8'
        );


        setText(
            'overviewAbsent',
            '6'
        );


        setText(
            'overviewLeave',
            '10'
        );


        // --------------------------------------------------------
        // PRESENT PERCENTAGE
        // --------------------------------------------------------

        var total = 120;

        var present = 96;


        var percentage =
            Math.round(
                (present / total) * 100
            );


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