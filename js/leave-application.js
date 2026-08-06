(function () {
    PayrollProLayout.init({
        activeNav: 'leave',
        navMode: 'staff',
        user: { name: 'Dr. Maria Santos', role: 'Faculty Staff', initials: 'MS' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: true
    });

    var ALLOWANCE = {
        Sick: 12,
        Vacation: 15,
        Maternity: 105,
        Paternity: 7
    };

    var USED = { Sick: 4, Vacation: 7, Maternity: 0, Paternity: 0 };

    var requests = [
        { id: 1, category: 'Sick', dateFrom: '2026-06-10', dateTo: '2026-06-11', status: 'Approved', filedDate: '2026-06-08', reason: 'Medical consultation' },
        { id: 2, category: 'Vacation', dateFrom: '2026-07-14', dateTo: '2026-07-16', status: 'Pending', filedDate: '2026-07-04', reason: 'Family vacation' },
        { id: 3, category: 'Sick', dateFrom: '2026-05-02', dateTo: '2026-05-02', status: 'Rejected', filedDate: '2026-05-01', reason: 'Personal errand' },
        { id: 4, category: 'Vacation', dateFrom: '2026-04-21', dateTo: '2026-04-22', status: 'Cancelled', filedDate: '2026-04-18', reason: 'Changed plans' }
    ];

    var nextId = 5;

    function syncUsedFromApproved() {
        USED = { Sick: 0, Vacation: 0, Maternity: 0, Paternity: 0 };
        requests.forEach(function (r) {
            if (r.status !== 'Approved') return;
            var days = countDays(r.dateFrom, r.dateTo);
            if (r.category in USED) USED[r.category] += days;
        });
        USED.Sick += 2;
        USED.Vacation += 5;
    }

    function formatDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatRange(from, to) {
        return formatDate(from) + ' – ' + formatDate(to);
    }

    function countDays(from, to) {
        var start = new Date(from + 'T00:00:00');
        var end = new Date(to + 'T00:00:00');
        if (end < start) return 0;
        return Math.round((end - start) / 86400000) + 1;
    }

    function statusBadge(status) {
        var map = {
            Pending: 'pp-badge-pending',
            Approved: 'pp-badge-approved',
            Rejected: 'pp-badge-rejected',
            Cancelled: 'pp-badge-cancelled'
        };
        return '<span class="pp-badge ' + (map[status] || 'pp-badge-cancelled') + '">' + status + '</span>';
    }

    function renderBalance() {
        syncUsedFromApproved();
        var html = Object.keys(ALLOWANCE).map(function (cat) {
            var max = ALLOWANCE[cat];
            var used = USED[cat] || 0;
            var remaining = max - used;
            var cls = cat.toLowerCase();
            return (
                '<div class="pp-balance-card ' + cls + '">' +
                    '<div class="pp-balance-card-label">' + cat + ' Leave</div>' +
                    '<div class="pp-balance-card-value"><span class="remaining">' + remaining + '</span> / ' + max + ' days remaining</div>' +
                    '<div class="pp-balance-card-meta">' + used + ' day' + (used !== 1 ? 's' : '') + ' used this year</div>' +
                '</div>'
            );
        }).join('');
        document.getElementById('leaveBalanceRow').innerHTML = html;
    }

    function renderHistory() {
        var tbody = document.getElementById('leaveHistoryBody');
        var empty = document.getElementById('leaveEmptyState');
        var sorted = requests.slice().sort(function (a, b) {
            return b.filedDate.localeCompare(a.filedDate);
        });

        if (!sorted.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = sorted.map(function (r) {
            var days = countDays(r.dateFrom, r.dateTo);
            var cancelBtn = r.status === 'Pending'
                ? '<button type="button" class="pp-btn-cancel" data-cancel-id="' + r.id + '">Cancel Request</button>'
                : '<span class="text-muted small">—</span>';
            return (
                '<tr>' +
                    '<td><strong>' + r.category + '</strong></td>' +
                    '<td>' + formatRange(r.dateFrom, r.dateTo) + '</td>' +
                    '<td class="col-hours">' + days + '</td>' +
                    '<td>' + statusBadge(r.status) + '</td>' +
                    '<td class="col-time">' + formatDate(r.filedDate) + '</td>' +
                    '<td class="col-actions">' + cancelBtn + '</td>' +
                '</tr>'
            );
        }).join('');

        tbody.querySelectorAll('[data-cancel-id]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = parseInt(btn.getAttribute('data-cancel-id'), 10);
                var req = requests.find(function (r) { return r.id === id; });
                if (!req || req.status !== 'Pending') return;
                if (!confirm('Cancel this pending leave request?')) return;
                req.status = 'Cancelled';
                renderBalance();
                renderHistory();
            });
        });
    }

    function updateDaysPreview() {
        var from = document.getElementById('leaveDateFrom').value;
        var to = document.getElementById('leaveDateTo').value;
        var preview = document.getElementById('leaveDaysPreview');
        if (!from || !to) {
            preview.classList.add('d-none');
            return;
        }
        var days = countDays(from, to);
        if (days <= 0) {
            preview.classList.remove('d-none');
            preview.textContent = 'End date must be on or after the start date.';
            preview.className = 'alert alert-warning border small mb-0';
            return;
        }
        preview.classList.remove('d-none');
        preview.className = 'alert alert-light border small mb-0';
        preview.textContent = 'This request covers ' + days + ' working day' + (days !== 1 ? 's' : '') + '.';
    }

    document.getElementById('leaveDateFrom').addEventListener('change', updateDaysPreview);
    document.getElementById('leaveDateTo').addEventListener('change', updateDaysPreview);

    document.getElementById('leaveForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        var category = document.getElementById('leaveCategory').value;
        var dateFrom = document.getElementById('leaveDateFrom').value;
        var dateTo = document.getElementById('leaveDateTo').value;
        var reason = document.getElementById('leaveReason').value.trim();
        var days = countDays(dateFrom, dateTo);

        if (days <= 0) {
            document.getElementById('leaveDateTo').setCustomValidity('End date must be after start date.');
            form.classList.add('was-validated');
            return;
        }
        document.getElementById('leaveDateTo').setCustomValidity('');

        var pendingDays = requests.filter(function (r) {
            return r.status === 'Pending' && r.category === category;
        }).reduce(function (sum, r) {
            return sum + countDays(r.dateFrom, r.dateTo);
        }, 0);
        var remaining = ALLOWANCE[category] - (USED[category] || 0) - pendingDays;
        if (days > remaining) {
            alert('Insufficient ' + category + ' Leave balance. You have ' + remaining + ' day(s) remaining.');
            return;
        }

        requests.unshift({
            id: nextId++,
            category: category,
            dateFrom: dateFrom,
            dateTo: dateTo,
            status: 'Pending',
            filedDate: new Date().toISOString().slice(0, 10),
            reason: reason
        });

        form.reset();
        form.classList.remove('was-validated');
        document.getElementById('leaveDaysPreview').classList.add('d-none');
        bootstrap.Modal.getInstance(document.getElementById('leaveFormModal')).hide();
        renderBalance();
        renderHistory();
    });

    document.getElementById('leaveFormModal').addEventListener('hidden.bs.modal', function () {
        var form = document.getElementById('leaveForm');
        form.reset();
        form.classList.remove('was-validated');
        document.getElementById('leaveDaysPreview').classList.add('d-none');
    });

    renderBalance();
    renderHistory();
})();
