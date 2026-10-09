/**
 * Week timetable shared by Faculty Schedule and Faculty Teaching Hours
 * (window.PPWeekTimetable): hours down the side, days across the top,
 * each class a block placed by its start and end time. Overlapping classes
 * on the same day are drawn side by side.
 *
 *   PPWeekTimetable.render(container, {
 *       weekStart: 'YYYY-MM-DD',          // a Monday
 *       items: [{
 *           id, date: 'YYYY-MM-DD', start: 'HH:mm', end: 'HH:mm',
 *           title, lines: ['...'], note: 'Cancelled', variant: 'approved',
 *           tooltip: '...'
 *       }]
 *   });
 *
 * variant picks the colour (see .fm-week-class.is-* in faculty-modules.css).
 * Blocks carry data-id; the page handles clicks on them.
 */
(function () {
    'use strict';

    var HOUR_PX = 56;             // height of one hour
    var DEFAULT_FIRST_HOUR = 7;   // 7:00 AM
    var DEFAULT_LAST_HOUR = 20;   // 8:00 PM
    var DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    var COLUMNS = '4rem repeat(%n, minmax(5.5rem, 1fr))';

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function iso(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function addDays(text, days) {
        var d = parseIso(text);
        d.setDate(d.getDate() + days);
        return iso(d);
    }

    function minutesOf(hhmm) {
        var p = hhmm.split(':').map(Number);
        return p[0] * 60 + p[1];
    }

    function hourLabel(hour) {
        return (hour % 12 || 12) + ' ' + (hour >= 12 ? 'PM' : 'AM');
    }

    /** Side-by-side lanes for items that overlap in time. */
    function assignLanes(items) {
        var sorted = items.slice().sort(function (a, b) { return minutesOf(a.start) - minutesOf(b.start); });
        var placed = [];
        var group = null;
        var groupEnd = -1;
        var laneEnds = [];
        sorted.forEach(function (item) {
            var start = minutesOf(item.start);
            if (!group || start >= groupEnd) {
                group = { lanes: 0 };
                laneEnds = [];
                groupEnd = -1;
            }
            var lane = laneEnds.findIndex(function (end) { return end <= start; });
            if (lane === -1) {
                lane = laneEnds.length;
                laneEnds.push(0);
            }
            laneEnds[lane] = minutesOf(item.end);
            group.lanes = Math.max(group.lanes, laneEnds.length);
            groupEnd = Math.max(groupEnd, minutesOf(item.end));
            placed.push({ item: item, lane: lane, group: group });
        });
        return placed;
    }

    function render(container, options) {
        var items = options.items || [];
        var days = [];
        for (var i = 0; i < 7; i++) days.push(addDays(options.weekStart, i));
        // Monday–Saturday; Sunday only when something is on it.
        if (!items.some(function (it) { return it.date === days[6]; })) days.pop();

        var first = DEFAULT_FIRST_HOUR;
        var last = DEFAULT_LAST_HOUR;
        items.forEach(function (it) {
            first = Math.min(first, Math.floor(minutesOf(it.start) / 60));
            last = Math.max(last, Math.ceil(minutesOf(it.end) / 60));
        });
        var height = (last - first) * HOUR_PX;
        var today = iso(new Date());
        var columns = COLUMNS.replace('%n', days.length);

        var html = '<div class="fm-week-head" style="grid-template-columns:' + columns + ';">' +
            '<div class="fm-week-corner"></div>' +
            days.map(function (d) {
                var date = parseIso(d);
                return '<div class="fm-week-day' + (d === today ? ' is-today' : '') + '">' +
                    '<span>' + DAY_NAMES[date.getDay()] + '</span><strong>' + date.getDate() + '</strong></div>';
            }).join('') +
        '</div>';

        html += '<div class="fm-week-body" style="grid-template-columns:' + columns + ';">';
        html += '<div class="fm-week-hours" style="height:' + height + 'px">';
        for (var h = first; h < last; h++) {
            html += '<div class="fm-week-hour" style="height:' + HOUR_PX + 'px"><span>' + hourLabel(h) + '</span></div>';
        }
        html += '</div>';

        days.forEach(function (d) {
            html += '<div class="fm-week-col' + (d === today ? ' is-today' : '') + '" style="height:' + height + 'px; background-size: 100% ' + HOUR_PX + 'px;">';
            assignLanes(items.filter(function (it) { return it.date === d; })).forEach(function (p) {
                var it = p.item;
                var top = (minutesOf(it.start) - first * 60) / 60 * HOUR_PX;
                var blockHeight = (minutesOf(it.end) - minutesOf(it.start)) / 60 * HOUR_PX;
                var width = 100 / p.group.lanes;
                // Short classes show less: a 1-hour block has room for the
                // title and the note; shorter ones only the title. The
                // tooltip and the details window always have everything.
                var lines = blockHeight >= 80 ? (it.lines || []) : [];
                var note = blockHeight >= 44 ? it.note : '';
                html += '<div class="fm-week-class' + (it.variant ? ' is-' + it.variant : '') + (blockHeight < 80 ? ' is-short' : '') + '" tabindex="0" role="button" ' +
                        'data-id="' + escapeHtml(it.id) + '" ' +
                        'style="top:' + top + 'px; height:' + (blockHeight - 2) + 'px; left:calc(' + (p.lane * width) + '% + 2px); width:calc(' + width + '% - 4px);" ' +
                        'title="' + escapeHtml(it.tooltip || it.title) + '">' +
                    '<strong>' + escapeHtml(it.title) + '</strong>' +
                    lines.map(function (line) { return '<span>' + escapeHtml(line) + '</span>'; }).join('') +
                    (note ? '<em>' + escapeHtml(note) + '</em>' : '') +
                '</div>';
            });
            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    }

    window.PPWeekTimetable = { render: render };
})();
