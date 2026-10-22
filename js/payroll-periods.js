/**
 * Payroll periods (cut-offs) from Maintenance → Payroll Periods, for every
 * page that shows or picks a cut-off. Same rules as PayrollPeriods.java:
 *
 *   - Each rule has two start days (e.g. 11 and 26: the 11th–25th and the
 *     26th–10th of the next month) and an effective date.
 *   - A date uses the newest rule in effect on it; a period of an older rule
 *     ends the day before a newer rule starts.
 *
 * Usage: PPPeriods.load().then(function () { var p = PPPeriods.current(); ... });
 * A period is { start: Date, end: Date, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', label }.
 */
(function (global) {
    'use strict';

    var DEFAULT_RULES = [{ effectiveDate: '2000-01-01', firstDay: 11, secondDay: 26 }];
    var rules = DEFAULT_RULES.map(toRule);
    var loading = null;

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function parse(iso) {
        var p = String(iso).slice(0, 10).split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function addDays(d, n) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    }

    function toRule(r) {
        return { effective: parse(r.effectiveDate), firstDay: Number(r.firstDay), secondDay: Number(r.secondDay) };
    }

    function ruleFor(d) {
        var found = rules[0];
        rules.forEach(function (r) { if (r.effective <= d) found = r; });
        return found;
    }

    function startOn(r, d) {
        if (d.getDate() >= r.secondDay) return new Date(d.getFullYear(), d.getMonth(), r.secondDay);
        if (d.getDate() >= r.firstDay) return new Date(d.getFullYear(), d.getMonth(), r.firstDay);
        return new Date(d.getFullYear(), d.getMonth() - 1, r.secondDay);
    }

    function nextStart(r, start) {
        var s = startOn(r, start);
        return s.getDate() === r.firstDay
            ? new Date(s.getFullYear(), s.getMonth(), r.secondDay)
            : new Date(s.getFullYear(), s.getMonth() + 1, r.firstDay);
    }

    function label(start, end) {
        return MONTHS[start.getMonth()] + ' ' + start.getDate() +
            (start.getFullYear() === end.getFullYear() ? '' : ', ' + start.getFullYear()) +
            ' – ' + MONTHS[end.getMonth()] + ' ' + end.getDate() + ', ' + end.getFullYear();
    }

    function make(start, end) {
        return { start: start, end: end, from: iso(start), to: iso(end), label: label(start, end) };
    }

    /** The period that contains a date (Date or 'YYYY-MM-DD'). */
    function of(date) {
        var d = typeof date === 'string' ? parse(date) : new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var r = ruleFor(d);
        var start = startOn(r, d);
        if (start < r.effective) start = r.effective;
        var end = addDays(nextStart(r, start), -1);
        for (var i = 0; i < rules.length; i++) {
            var e = rules[i].effective;
            if (e > start && e <= end) { end = addDays(e, -1); break; }
        }
        return make(start, end);
    }

    var api = {
        /** Loads the rules once per page; resolves even if the server can't be reached (the default 11/26 applies). */
        load: function () {
            if (!loading) {
                loading = fetch('api/settings')
                    .then(function (r) { return r.json(); })
                    .then(function (data) {
                        if (data && data.success && data.periodRules && data.periodRules.length) {
                            rules = data.periodRules.slice().sort(function (a, b) {
                                return a.effectiveDate.localeCompare(b.effectiveDate);
                            }).map(toRule);
                        }
                        api.settings = data && data.success ? data : null;
                        return api;
                    })
                    .catch(function () { return api; });
            }
            return loading;
        },
        /** Loads the rules again (after Maintenance changes them). */
        reload: function () {
            loading = null;
            return api.load();
        },
        settings: null,
        of: of,
        current: function () { return of(new Date()); },
        previous: function (p) { return of(addDays(p.start, -1)); },
        next: function (p) { return of(addDays(p.end, 1)); },
        /** The current period and the n−1 before it, newest first. */
        recent: function (n) {
            var list = [];
            var p = of(new Date());
            for (var i = 0; i < n; i++) { list.push(p); p = api.previous(p); }
            return list;
        },
        /** Whether from–to is exactly one period. */
        isPeriod: function (from, to) {
            var p = of(from);
            return p.from === from && p.to === to;
        },
        /** e.g. "11th–25th and 26th–10th of the next month" for the rule in effect today. */
        describe: function (date) {
            var r = ruleFor(date ? (typeof date === 'string' ? parse(date) : date) : new Date());
            return describe(r.firstDay, r.secondDay);
        },
        describeDays: describe,
        iso: iso,
        parse: parse
    };

    function ordinal(n) {
        var s = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th';
        return n + s;
    }

    function describe(first, second) {
        var a = ordinal(first) + '–' + ordinal(second - 1);
        var b = first === 1 ? ordinal(second) + '–end of the month' : ordinal(second) + '–' + ordinal(first - 1) + ' of the next month';
        return a + ' and ' + b;
    }

    global.PPPeriods = api;
})(window);
