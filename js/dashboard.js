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

    // The cut-off today falls in (Maintenance → Payroll Periods, js/payroll-periods.js).
    // Drawn first with the default cut-offs, then again once they are loaded.
    function periodContaining(date) {
        var p = PPPeriods.of(date);
        return { start: p.start, end: p.end };
    }

    function longDate(date) {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    var period = periodContaining(new Date());

    var currentPayroll = {
        start: period.start,
        end: period.end,

        startDate: longDate(period.start),
        endDate: longDate(period.end),

        periodLabel:
            period.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
            ' – ' + longDate(period.end),

        status: 'Processing'
    };


    var calendarYear = currentPayroll.start.getFullYear();
    var calendarMonth = currentPayroll.start.getMonth();


    /* ============================================================
       HOLIDAYS (api/holidays), loaded once per year
       ============================================================ */

    var holidaysByYear = {};

    // Every holiday is marked the same way (the type shows in its tooltip).
    var HOLIDAY_CLASS = 'payroll-holiday-mark';

    function isoDate(year, month, day) {
        return year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    }

    function loadHolidays(year) {
        if (holidaysByYear[year]) {
            return;
        }

        holidaysByYear[year] = {};   // loading; re-render when it arrives

        fetch('api/holidays?year=' + year)
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (!data.success) return;
                data.holidays.forEach(function (h) { holidaysByYear[year][h.date] = h; });
                if (year === calendarYear) renderPayrollCalendar();
            })
            .catch(function () {
                delete holidaysByYear[year];   // try again next time the month changes
            });
    }

    function renderHolidayList(holidays) {
        var list = document.getElementById('payrollCalendarHolidays');
        if (!list) return;

        list.innerHTML = '';

        if (holidays.length === 0) {
            list.innerHTML = '<div class="payroll-holiday-empty">No holidays this month.</div>';
            return;
        }

        holidays.forEach(function (h) {
            var item = document.createElement('div');
            item.className = 'payroll-holiday-item';
            item.title = h.type;

            var dot = document.createElement('span');
            dot.className = 'payroll-holiday-dot ' + HOLIDAY_CLASS;

            var day = document.createElement('strong');
            day.textContent = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            var name = document.createElement('span');
            name.className = 'payroll-holiday-name';
            name.textContent = h.name;

            item.appendChild(dot);
            item.appendChild(day);
            item.appendChild(name);
            list.appendChild(item);
        });
    }


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


        loadHolidays(calendarYear);

        var holidays = holidaysByYear[calendarYear] || {};
        var monthHolidays = [];


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


            var date = new Date(calendarYear, calendarMonth, day);
            var titles = [];


            if (
                date >= currentPayroll.start &&
                date <= currentPayroll.end
            ) {
                dayElement.classList.add(
                    'payroll-calendar-day-period'
                );
            }


            if (date.getTime() === currentPayroll.start.getTime()) {
                dayElement.classList.add(
                    'payroll-calendar-day-start'
                );

                titles.push('Payroll Period Start');
            }


            if (date.getTime() === currentPayroll.end.getTime()) {
                dayElement.classList.add(
                    'payroll-calendar-day-end'
                );

                titles.push('Payroll Period End');
            }


            var holiday = holidays[isoDate(calendarYear, calendarMonth, day)];

            if (holiday) {
                dayElement.classList.add(
                    'payroll-calendar-day-holiday',
                    HOLIDAY_CLASS
                );

                titles.push(holiday.name + ' (' + holiday.type + ')');
                monthHolidays.push(holiday);
            }


            if (titles.length) {
                dayElement.title = titles.join('\n');
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


        renderHolidayList(monthHolidays);
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


        var legendDates =
            document.getElementById('payrollPeriodLegendDates');

        if (legendDates) {
            legendDates.textContent = currentPayroll.periodLabel;
        }


        var markers =
            document.querySelectorAll('.payroll-period-marker');

        if (markers.length === 2) {
            markers[0].textContent = currentPayroll.start.getDate();
            markers[1].textContent = currentPayroll.end.getDate();
        }
    }


    renderPayrollInformation();
    renderPayrollCalendar();

    PPPeriods.load().then(function () {
        var p = periodContaining(new Date());
        if (p.start.getTime() === currentPayroll.start.getTime() && p.end.getTime() === currentPayroll.end.getTime()) return;
        currentPayroll.start = p.start;
        currentPayroll.end = p.end;
        currentPayroll.startDate = longDate(p.start);
        currentPayroll.endDate = longDate(p.end);
        currentPayroll.periodLabel = p.start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' – ' + longDate(p.end);
        renderPayrollInformation();
        renderPayrollCalendar();
    });


    /* ============================================================
       BIOMETRIC DEVICE STATUS
       ============================================================ */

    (function renderBiometricDevice() {
        var nameEl = document.getElementById('biometricDeviceName');
        var statusEl = document.getElementById('biometricStatus');

        if (!nameEl || !statusEl) {
            return;
        }

        fetch('api/devices/status')
            .then(function (response) { return response.json(); })
            .then(function (data) { show(data.success ? data.devices : []); })
            .catch(function () { show([]); });

        function show(devices) {
        var device = devices.find(function (d) { return d.status === 'Active'; }) || devices[0];

        if (!device) {
            // No scanner added yet (System Administrator → Biometric Devices).
            nameEl.textContent = 'No device added';
            statusEl.classList.remove('pp-device-status-connected');
            statusEl.classList.add('pp-device-status-disconnected');
            statusEl.innerHTML = '<span class="pp-device-dot"></span>Not set up';
            var syncEl = document.getElementById('biometricLastSync');
            if (syncEl) syncEl.textContent = '—';
            return;
        }

        nameEl.textContent = device.deviceName;

        var isOnline = device.status === 'Active';
        statusEl.classList.toggle('pp-device-status-connected', isOnline);
        statusEl.classList.toggle('pp-device-status-disconnected', !isOnline);
        statusEl.innerHTML = '<span class="pp-device-dot"></span>' + (isOnline ? 'Active' : 'Inactive');
        }
    })();



    /* ============================================================
       RECENT ACTIVITY (api/audit/activity): the latest changes from
       the audit trail — payroll, attendance, leave, loans and employee
       records. Refreshed every minute.
       ============================================================ */

    (function recentActivity() {

        var list = document.getElementById('recentActivityList');
        if (!list) return;

        // Module → icon and colour.
        var KINDS = [
            { match: /payroll|loan|rate|bir|sss|philhealth|pag-ibig|benefit/i, cls: 'pp-activity-icon-success', icon: 'bi-cash-stack' },
            { match: /attendance|teaching|holiday|schedule/i, cls: 'pp-activity-icon-warning', icon: 'bi-clock-history' },
            { match: /leave/i, cls: 'pp-activity-icon-info', icon: 'bi-calendar-check' },
            { match: /.*/, cls: 'pp-activity-icon-primary', icon: 'bi-person' }
        ];

        function esc(value) {
            return String(value == null ? '' : value)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        }

        function ago(iso) {
            var then = new Date(iso);
            var minutes = Math.round((Date.now() - then.getTime()) / 60000);
            if (minutes < 1) return 'Just now';
            if (minutes < 60) return minutes + ' min ago';
            var hours = Math.round(minutes / 60);
            if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
            return then.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        }

        function load() {
            fetch('api/audit/activity?limit=8')
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (!data.success) throw new Error(data.message);
                    if (!data.entries.length) {
                        list.innerHTML = '<div class="pp-empty-state">No recent activity yet.</div>';
                        return;
                    }
                    list.innerHTML = data.entries.map(function (a) {
                        var kind = KINDS.find(function (k) { return k.match.test(a.module); });
                        return '<div class="pp-activity-item">' +
                            '<div class="pp-activity-icon ' + kind.cls + '"><i class="bi ' + kind.icon + '"></i></div>' +
                            '<div class="pp-activity-content">' +
                                '<div class="pp-activity-text"><strong>' + esc(a.action) + '</strong>' +
                                    (a.detail ? ' — ' + esc(a.detail) : '') + '</div>' +
                                '<div class="pp-activity-time">' + esc(a.module) + ' · by ' + esc(a.user) +
                                    ' · <span title="' + esc(new Date(a.at).toLocaleString('en-PH')) + '">' + ago(a.at) + '</span></div>' +
                            '</div>' +
                        '</div>';
                    }).join('');
                })
                .catch(function () {
                    list.innerHTML = '<div class="pp-empty-state">Could not load recent activity.</div>';
                });
        }

        load();
        setInterval(function () { if (!document.hidden) load(); }, 60000);
    })();

})();
