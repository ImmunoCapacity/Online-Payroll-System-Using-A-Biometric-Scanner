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

        loadTodayRecords();

        loadRecentActivity();

    });


    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function todayIso() {
        var now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }

    function time12(hhmm) {
        if (!hhmm) return '—';
        var p = hhmm.split(':').map(Number);
        return (p[0] % 12 || 12) + ':' + String(p[1]).padStart(2, '0') + (p[0] < 12 ? ' AM' : ' PM');
    }

    // Today's Attendance: the latest time-ins of the day (api/dtr), newest first.
    function loadTodayRecords() {
        var body = document.getElementById('staffTodayBody');
        if (!body) return;
        fetch('api/dtr?date=' + todayIso())
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) throw new Error(data.message);
                var rows = data.records.filter(function (r) { return r.timeIn; })
                    .sort(function (a, b) { return b.timeIn.localeCompare(a.timeIn); })
                    .slice(0, 6);
                if (!rows.length) return;
                body.innerHTML = rows.map(function (r) {
                    var hours = '—';
                    if (r.timeIn && r.timeOut) {
                        var m = (Number(r.timeOut.slice(0, 2)) * 60 + Number(r.timeOut.slice(3, 5))) -
                            (Number(r.timeIn.slice(0, 2)) * 60 + Number(r.timeIn.slice(3, 5)));
                        hours = Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
                    }
                    var status = String(r.status || '').toLowerCase();
                    return '<tr style="white-space:nowrap"><td>' + esc(r.employeeNumber) + '</td><td><strong>' + esc(r.employeeName) + '</strong></td>' +
                        '<td>' + time12(r.timeIn) + '</td><td>' + time12(r.timeOut) + '</td><td>' + hours + '</td>' +
                        '<td><span class="pp-badge pp-badge-' + esc(status) + '">' + esc(status.toUpperCase()) + '</span></td></tr>';
                }).join('');
            })
            .catch(function (error) { console.error('[Payroll Staff Dashboard] Could not load today\'s records:', error); });
    }

    // Recent Activity: the latest attendance-related changes from the audit trail.
    function loadRecentActivity() {
        var list = document.getElementById('staffActivityList');
        if (!list) return;
        fetch('api/audit/activity?limit=50')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) throw new Error(data.message);
                var items = data.entries.filter(function (a) {
                    return /attendance|teaching|schedule|fingerprint|biometric/i.test(a.module);
                }).slice(0, 6);
                if (!items.length) return;
                list.innerHTML = items.map(function (a) {
                    return '<div class="py-2 border-bottom small">' +
                        '<div><strong>' + esc(a.action) + '</strong>' + (a.detail ? ' — ' + esc(a.detail) : '') + '</div>' +
                        '<div class="text-muted">' + esc(a.module) + ' · by ' + esc(a.user) + ' · ' +
                            esc(new Date(a.at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) +
                        '</div></div>';
                }).join('');
            })
            .catch(function (error) { console.error('[Payroll Staff Dashboard] Could not load activity:', error); });
    }


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