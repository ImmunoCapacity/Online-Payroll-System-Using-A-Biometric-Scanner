(function () {
    PayrollProLayout.init({
        activeNav: 'leave',
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

    var leaveRequests = [
        { id: 101, employee: 'Dr. Maria Santos', category: 'Vacation', dateFrom: '2026-07-14', dateTo: '2026-07-16', filedDate: '2026-07-04', status: 'Pending', reason: 'Family vacation' },
        { id: 102, employee: 'Juan Dela Cruz', category: 'Sick', dateFrom: '2026-07-10', dateTo: '2026-07-11', filedDate: '2026-07-06', status: 'Pending', reason: 'Flu symptoms' },
        { id: 103, employee: 'Elena Villanueva', category: 'Maternity', dateFrom: '2026-08-01', dateTo: '2026-11-13', filedDate: '2026-06-20', status: 'Approved', reason: 'Maternity leave' },
        { id: 104, employee: 'Michael Tan', category: 'Paternity', dateFrom: '2026-07-20', dateTo: '2026-07-26', filedDate: '2026-07-01', status: 'Rejected', reason: 'Newborn care', remarks: 'Insufficient documentation submitted.' },
        { id: 105, employee: 'Ana Reyes', category: 'Vacation', dateFrom: '2026-06-05', dateTo: '2026-06-07', filedDate: '2026-05-28', status: 'Approved', reason: 'Personal travel' }
    ];

    var loanRequests = [
        { id: 201, employee: 'Dr. Maria Santos', type: 'SSS Salary Loan', principal: 50000, term: 18, filedDate: '2026-07-02', status: 'Pending' },
        { id: 202, employee: 'Carlos Mendoza', type: 'Pag-IBIG Loan', principal: 80000, term: 24, filedDate: '2026-07-05', status: 'Pending' },
        { id: 203, employee: 'Juan Dela Cruz', type: 'Institutional Loan', principal: 25000, term: 12, filedDate: '2026-06-15', status: 'Approved' },
        { id: 204, employee: 'Rosa Garcia', type: 'SSS Salary Loan', principal: 30000, term: 12, filedDate: '2026-06-01', status: 'Rejected', remarks: 'Existing loan balance exceeds policy limit.' }
    ];

    var pendingReject = null;
    var rejectModalEl = document.getElementById('rejectModal');
    var rejectModal = new bootstrap.Modal(rejectModalEl);

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

    function peso(n) {
        return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

    function inDateRange(filedDate, from, to) {
        if (from && filedDate < from) return false;
        if (to && filedDate > to) return false;
        return true;
    }

    function actionButtons(item, type) {
        if (item.status !== 'Pending') {
            return '<span class="text-muted small">—</span>';
        }
        return (
            '<div class="pp-approval-actions">' +
                '<button type="button" class="btn-pp-approve" data-action="approve" data-type="' + type + '" data-id="' + item.id + '">Approve</button>' +
                '<button type="button" class="btn-pp-reject" data-action="reject" data-type="' + type + '" data-id="' + item.id + '">Reject</button>' +
            '</div>'
        );
    }

    function renderLeaveApprovals() {
        var status = document.getElementById('leaveFilterStatus').value;
        var from = document.getElementById('leaveFilterFrom').value;
        var to = document.getElementById('leaveFilterTo').value;
        var tbody = document.getElementById('leaveApprovalBody');
        var empty = document.getElementById('leaveApprovalEmpty');

        var filtered = leaveRequests.filter(function (r) {
            if (status !== 'all' && r.status !== status) return false;
            return inDateRange(r.filedDate, from, to);
        }).sort(function (a, b) {
            return b.filedDate.localeCompare(a.filedDate);
        });

        document.getElementById('leavePendingCount').textContent = leaveRequests.filter(function (r) {
            return r.status === 'Pending';
        }).length;

        if (!filtered.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = filtered.map(function (r) {
            var days = countDays(r.dateFrom, r.dateTo);
            return (
                '<tr>' +
                    '<td><strong>' + r.employee + '</strong></td>' +
                    '<td>' + r.category + '</td>' +
                    '<td class="col-details">' + formatRange(r.dateFrom, r.dateTo) + ' · ' + days + ' day' + (days !== 1 ? 's' : '') + '</td>' +
                    '<td class="col-time">' + formatDate(r.filedDate) + '</td>' +
                    '<td>' + statusBadge(r.status) + '</td>' +
                    '<td class="col-actions">' + actionButtons(r, 'leave') + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function renderLoanApprovals() {
        var status = document.getElementById('loanFilterStatus').value;
        var from = document.getElementById('loanFilterFrom').value;
        var to = document.getElementById('loanFilterTo').value;
        var tbody = document.getElementById('loanApprovalBody');
        var empty = document.getElementById('loanApprovalEmpty');

        var filtered = loanRequests.filter(function (r) {
            if (status !== 'all' && r.status !== status) return false;
            return inDateRange(r.filedDate, from, to);
        }).sort(function (a, b) {
            return b.filedDate.localeCompare(a.filedDate);
        });

        document.getElementById('loanPendingCount').textContent = loanRequests.filter(function (r) {
            return r.status === 'Pending';
        }).length;

        if (!filtered.length) {
            tbody.innerHTML = '';
            empty.classList.remove('d-none');
            return;
        }

        empty.classList.add('d-none');
        tbody.innerHTML = filtered.map(function (r) {
            var monthly = r.principal / r.term;
            return (
                '<tr>' +
                    '<td><strong>' + r.employee + '</strong></td>' +
                    '<td>' + r.type + '</td>' +
                    '<td class="col-details">' + peso(r.principal) + ' · ' + r.term + ' mo · ' + peso(monthly) + '/mo</td>' +
                    '<td class="col-time">' + formatDate(r.filedDate) + '</td>' +
                    '<td>' + statusBadge(r.status) + '</td>' +
                    '<td class="col-actions">' + actionButtons(r, 'loan') + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    function findRequest(type, id) {
        var list = type === 'leave' ? leaveRequests : loanRequests;
        return list.find(function (r) { return r.id === id; });
    }

    function switchTab(tab) {
        document.querySelectorAll('.pp-approval-tab').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.getElementById('panelLeave').classList.toggle('d-none', tab !== 'leave');
        document.getElementById('panelLoans').classList.toggle('d-none', tab !== 'loans');

        var activeNav = tab === 'loans' ? 'loans' : 'leave';
        document.querySelectorAll('.pp-sidebar-link').forEach(function (link) {
            var href = link.getAttribute('href') || '';
            var isLeave = href.indexOf('leave-loan-approval') >= 0 && href.indexOf('tab=loans') < 0;
            var isLoans = href.indexOf('tab=loans') >= 0;
            link.classList.toggle('active', (tab === 'leave' && isLeave && !isLoans) || (tab === 'loans' && isLoans));
            if ((tab === 'leave' && isLeave && !isLoans) || (tab === 'loans' && isLoans)) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    document.querySelectorAll('.pp-approval-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchTab(btn.dataset.tab);
        });
    });

    ['leaveFilterStatus', 'leaveFilterFrom', 'leaveFilterTo'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', renderLeaveApprovals);
    });

    ['loanFilterStatus', 'loanFilterFrom', 'loanFilterTo'].forEach(function (id) {
        document.getElementById(id).addEventListener('change', renderLoanApprovals);
    });

    document.getElementById('leaveClearFilters').addEventListener('click', function () {
        document.getElementById('leaveFilterStatus').value = 'Pending';
        document.getElementById('leaveFilterFrom').value = '';
        document.getElementById('leaveFilterTo').value = '';
        renderLeaveApprovals();
    });

    document.getElementById('loanClearFilters').addEventListener('click', function () {
        document.getElementById('loanFilterStatus').value = 'Pending';
        document.getElementById('loanFilterFrom').value = '';
        document.getElementById('loanFilterTo').value = '';
        renderLoanApprovals();
    });

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var type = btn.getAttribute('data-type');
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var item = findRequest(type, id);
        if (!item || item.status !== 'Pending') return;

        if (action === 'approve') {
            item.status = 'Approved';
            renderLeaveApprovals();
            renderLoanApprovals();
            return;
        }

        if (action === 'reject') {
            pendingReject = { type: type, id: id, item: item };
            document.getElementById('rejectContext').textContent =
                'Reject ' + (type === 'leave' ? 'leave' : 'loan') + ' request from ' + item.employee + '. Remarks are required.';
            document.getElementById('rejectForm').reset();
            document.getElementById('rejectForm').classList.remove('was-validated');
            rejectModal.show();
        }
    });

    document.getElementById('rejectForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        if (!pendingReject) return;

        var item = pendingReject.item;
        item.status = 'Rejected';
        item.remarks = document.getElementById('rejectRemarks').value.trim();
        pendingReject = null;
        rejectModal.hide();
        renderLeaveApprovals();
        renderLoanApprovals();
    });

    rejectModalEl.addEventListener('hidden.bs.modal', function () {
        pendingReject = null;
        document.getElementById('rejectForm').reset();
        document.getElementById('rejectForm').classList.remove('was-validated');
    });

    var params = new URLSearchParams(location.search);
    if (params.get('tab') === 'loans') {
        switchTab('loans');
    }

    renderLeaveApprovals();
    renderLoanApprovals();
})();
