(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'dashboard',

        user: {
            name: 'Maria Elena Reyes',
            role: 'Payroll Master',
            initials: 'MR'
        },

        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },

        notifications: true
    });


    /* ============================================================
       CURRENT PAYROLL PERIOD
       ============================================================ */

    var currentPayroll = {
        year: 2026,
        month: 8,

        startDay: 11,
        endDay: 25,

        startDate: 'September 11, 2026',
        endDate: 'September 25, 2026',

        periodLabel: 'September 11 – September 25, 2026',

        status: 'Processing'
    };


    var calendarYear = currentPayroll.year;
    var calendarMonth = currentPayroll.month;


    /* ============================================================
       CALENDAR
       ============================================================ */

    function renderPayrollCalendar() {
        var calendar =
            document.getElementById('payrollCalendar');

        var monthLabel =
            document.getElementById('payrollCalendarMonth');

        if (!calendar || !monthLabel) {
            return;
        }


        var firstDay =
            new Date(calendarYear, calendarMonth, 1);

        var lastDay =
            new Date(calendarYear, calendarMonth + 1, 0);

        var daysInMonth =
            lastDay.getDate();

        var startingDay =
            firstDay.getDay();


        monthLabel.textContent =
            firstDay.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
            });


        calendar.innerHTML = '';


        var dayNames = [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat'
        ];


        dayNames.forEach(function (day) {
            var dayName =
                document.createElement('div');

            dayName.className =
                'payroll-calendar-weekday';

            dayName.textContent = day;

            calendar.appendChild(dayName);
        });


        var previousMonth =
            new Date(
                calendarYear,
                calendarMonth,
                0
            );

        var previousMonthDays =
            previousMonth.getDate();


        for (
            var previousIndex = startingDay - 1;
            previousIndex >= 0;
            previousIndex--
        ) {
            var previousDay =
                document.createElement('div');

            previousDay.className =
                'payroll-calendar-day payroll-calendar-day-muted';

            previousDay.textContent =
                previousMonthDays - previousIndex;

            calendar.appendChild(previousDay);
        }


        for (
            var day = 1;
            day <= daysInMonth;
            day++
        ) {
            var dayElement =
                document.createElement('div');

            dayElement.className =
                'payroll-calendar-day';

            dayElement.textContent = day;


            var isPayrollMonth =
                calendarYear === currentPayroll.year &&
                calendarMonth === currentPayroll.month;


            if (
                isPayrollMonth &&
                day >= currentPayroll.startDay &&
                day <= currentPayroll.endDay
            ) {
                dayElement.classList.add(
                    'payroll-calendar-day-period'
                );
            }


            if (
                isPayrollMonth &&
                day === currentPayroll.startDay
            ) {
                dayElement.classList.add(
                    'payroll-calendar-day-start'
                );

                dayElement.title =
                    'Payroll Period Start';
            }


            if (
                isPayrollMonth &&
                day === currentPayroll.endDay
            ) {
                dayElement.classList.add(
                    'payroll-calendar-day-end'
                );

                dayElement.title =
                    'Payroll Period End';
            }


            calendar.appendChild(dayElement);
        }


        var totalCells =
            startingDay + daysInMonth;

        var remainingCells =
            totalCells % 7 === 0
                ? 0
                : 7 - (totalCells % 7);


        for (
            var nextDay = 1;
            nextDay <= remainingCells;
            nextDay++
        ) {
            var nextDayElement =
                document.createElement('div');

            nextDayElement.className =
                'payroll-calendar-day payroll-calendar-day-muted';

            nextDayElement.textContent =
                nextDay;

            calendar.appendChild(nextDayElement);
        }
    }


    /* ============================================================
       PREVIOUS MONTH
       ============================================================ */

    function showPreviousMonth() {
        calendarMonth--;


        if (calendarMonth < 0) {
            calendarMonth = 11;
            calendarYear--;
        }


        renderPayrollCalendar();
    }


    /* ============================================================
       NEXT MONTH
       ============================================================ */

    function showNextMonth() {
        calendarMonth++;


        if (calendarMonth > 11) {
            calendarMonth = 0;
            calendarYear++;
        }


        renderPayrollCalendar();
    }


    var previousMonthButton =
        document.getElementById(
            'payrollCalendarPrevious'
        );


    if (previousMonthButton) {
        previousMonthButton.addEventListener(
            'click',
            showPreviousMonth
        );
    }


    var nextMonthButton =
        document.getElementById(
            'payrollCalendarNext'
        );


    if (nextMonthButton) {
        nextMonthButton.addEventListener(
            'click',
            showNextMonth
        );
    }


    /* ============================================================
       CURRENT PAYROLL INFORMATION
       ============================================================ */

    function renderPayrollInformation() {
        var period =
            document.getElementById(
                'currentPayrollPeriod'
            );

        var status =
            document.getElementById(
                'payrollPeriodStatus'
            );

        var startDate =
            document.getElementById(
                'payrollPeriodStartDate'
            );

        var endDate =
            document.getElementById(
                'payrollPeriodEndDate'
            );


        if (period) {
            period.textContent =
                currentPayroll.periodLabel;
        }


        if (status) {
            status.textContent =
                currentPayroll.status;
        }


        if (startDate) {
            startDate.textContent =
                currentPayroll.startDate;
        }


        if (endDate) {
            endDate.textContent =
                currentPayroll.endDate;
        }
    }


    renderPayrollInformation();
    renderPayrollCalendar();

})();