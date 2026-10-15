/**
 * Leave Management — leave requests in the database (api/leave).
 *
 * Record a request for an employee, then approve, reject or cancel it.
 * Days are working days (Monday–Friday). Leave types that use credits draw
 * on the employee's yearly leave credits (15 by default, editable here);
 * the server refuses requests and approvals beyond the remaining balance.
 * Approved paid leave is included in payroll.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'leave',
        navMode: 'master',
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    var requests = [];
    var categories = [];
    var employees = [];
    var editingId = null;
    var current = null;   // request open in the details window

    var el = function (id) { return document.getElementById(id); };
    var leaveModal = new bootstrap.Modal(el('leaveModal'));
    var detailModal = new bootstrap.Modal(el('detailModal'));
    var leaveForm = el('leaveForm');

    var SERVER_FIELDS = {
        employeeId: 'leaveEmployee',
        categoryId: 'leaveCategory',
        dateFrom: 'leaveFrom',
        dateTo: 'leaveTo',
        reason: 'leaveReason'
    };

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    function api(url, method, body) {
        return fetch(url, {
            method: method || 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) { return r.json(); });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function parseIso(text) {
        var p = text.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]);
    }

    function formatDate(text) {
        if (!text) return '—';
        return parseIso(text).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    /** "Oct 19, 2026", "Oct 19 – 21, 2026" or "Oct 27 – Nov 4, 2026". */
    function dateRange(from, to) {
        if (!to || to === from) return formatDate(from);
        var a = parseIso(from);
        var b = parseIso(to);
        var month = function (d) { return d.toLocaleDateString('en-PH', { month: 'short' }); };
        if (a.getFullYear() !== b.getFullYear()) return formatDate(from) + ' – ' + formatDate(to);
        if (a.getMonth() === b.getMonth()) return month(a) + ' ' + a.getDate() + ' – ' + b.getDate() + ', ' + b.getFullYear();
        return month(a) + ' ' + a.getDate() + ' – ' + month(b) + ' ' + b.getDate() + ', ' + b.getFullYear();
    }

    /** Monday–Friday days from one date to another, inclusive (same rule as the server). */
    function workdays(from, to) {
        if (!from || !to || to < from) return 0;
        var d = parseIso(from);
        var end = parseIso(to);
        var days = 0;
        while (d <= end) {
            if (d.getDay() !== 0 && d.getDay() !== 6) days++;
            d.setDate(d.getDate() + 1);
        }
        return days;
    }

    function statusBadge(status) {
        return '<span class="leave-badge ' + String(status).toLowerCase() + '">' + escapeHtml(status) + '</span>';
    }

    function payBadge(paid) {
        return '<span class="leave-badge ' + (paid ? 'paid' : 'unpaid') + '">' + (paid ? 'Paid' : 'Unpaid') + '</span>';
    }

    function categoryById(id) {
        return categories.find(function (c) { return c.id === Number(id); });
    }

    // ---------------------------------------------------------------
    // Loading and the list
    // ---------------------------------------------------------------

    function load() {
        return Promise.all([api('api/leave/requests'), api('api/leave/categories'), api('api/employees')])
            .then(function (results) {
                results.forEach(function (r) {
                    if (!r.success) throw new Error(r.message || 'Could not load leave data.');
                });
                requests = results[0].requests;
                categories = results[1].categories;
                employees = results[2].employees.filter(function (e) {
                    return ['Inactive', 'Resigned', 'Terminated'].indexOf(e.status) === -1;
                });
                fillFilters();
                render();
            })
            .catch(function (error) {
                el('leaveTableBody').innerHTML = '';
                el('leaveEmptyState').querySelector('span').textContent =
                    error.message || 'Could not load leave requests. Is the backend running?';
                el('leaveEmptyState').classList.remove('d-none');
            });
    }

    function fillFilters() {
        var filter = el('leaveTypeFilter');
        var chosen = filter.value;
        filter.innerHTML = '<option value="All" hidden data-hint>All leave types</option>' +
            categories.map(function (c) {
                return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + '</option>';
            }).join('');
        filter.value = categories.some(function (c) { return c.name === chosen; }) ? chosen : 'All';
    }

    function render() {
        var search = el('leaveSearch').value.trim().toLowerCase();
        var type = el('leaveTypeFilter').value;
        var status = el('leaveStatusFilter').value;
        var date = el('leaveDateFilter').value;

        var shown = requests.filter(function (r) {
            return (!search || (r.employeeName + ' ' + r.employeeNumber).toLowerCase().indexOf(search) !== -1) &&
                (type === 'All' || r.category === type) &&
                (status === 'All' || r.status === status) &&
                (!date || (date >= r.dateFrom && date <= r.dateTo));
        });

        el('leaveListCount').textContent = shown.length + (shown.length === 1 ? ' record' : ' records');
        if (!shown.length) {
            el('leaveTableBody').innerHTML = '';
            el('leaveEmptyState').querySelector('span').textContent = requests.length
                ? 'No leave requests match the filters.'
                : 'No leave requests yet. Click Record Leave to add one.';
            el('leaveEmptyState').classList.remove('d-none');
            return;
        }
        el('leaveEmptyState').classList.add('d-none');

        el('leaveTableBody').innerHTML = shown.map(function (r) {
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-id="' + r.id + '" ' +
                    'aria-label="Leave request of ' + escapeHtml(r.employeeName) + '">' +
                '<td><strong>' + escapeHtml(r.employeeName) + '</strong>' +
                    '<span class="leave-sub">' + escapeHtml(r.employeeNumber) + ' · ' + escapeHtml(r.employeeType) + '</span></td>' +
                '<td>' + escapeHtml(r.category) + '</td>' +
                '<td>' + dateRange(r.dateFrom, r.dateTo) + '</td>' +
                '<td class="leave-days-cell">' + r.days + ' day' + (r.days === 1 ? '' : 's') + '</td>' +
                '<td>' + payBadge(r.paid) + '</td>' +
                '<td class="leave-filed-date">' + formatDate(r.dateFiled) + '</td>' +
                '<td>' + statusBadge(r.status) + '</td>' +
                '<td class="leave-reason-cell" title="' + escapeHtml(r.reason) + '">' + escapeHtml(r.reason) + '</td>' +
            '</tr>';
        }).join('');
    }

    // ---------------------------------------------------------------
    // Record / edit
    // ---------------------------------------------------------------

    function fillFormChoices(request) {
        el('leaveEmployee').innerHTML = '<option value="" selected hidden data-hint>Select employee</option>' +
            employees.map(function (e) {
                return '<option value="' + escapeHtml(e.id) + '">' + escapeHtml(e.displayName) + ' — ' +
                    escapeHtml(e.employeeNumber) + ' (' + escapeHtml(e.department) + ')</option>';
            }).join('');
        el('leaveCategory').innerHTML = '<option value="" selected hidden data-hint>Select leave type</option>' +
            categories.filter(function (c) { return c.active || (request && c.id === request.categoryId); })
                .map(function (c) {
                    var notes = [c.paid ? 'paid' : 'unpaid'];
                    if (c.maxDays) notes.push('max ' + c.maxDays + ' days');
                    if (c.usesCredits) notes.push('uses credits');
                    return '<option value="' + c.id + '">' + escapeHtml(c.name) + ' (' + notes.join(', ') + ')</option>';
                }).join('');
    }

    function openForm(request) {
        editingId = request ? request.id : null;
        leaveForm.reset();
        PPValidate.clear(leaveForm);
        fillFormChoices(request);
        el('leaveModalTitle').textContent = request ? 'Edit Leave Request' : 'Record Leave';
        el('leaveEmployee').disabled = !!request;
        if (request) {
            if (!el('leaveEmployee').querySelector('option[value="' + request.employeeId + '"]')) {
                el('leaveEmployee').insertAdjacentHTML('beforeend',
                    '<option value="' + escapeHtml(request.employeeId) + '">' + escapeHtml(request.employeeName) + '</option>');
            }
            el('leaveEmployee').value = request.employeeId;
            el('leaveCategory').value = request.categoryId;
            el('leaveFrom').value = request.dateFrom;
            el('leaveTo').value = request.dateTo;
            el('leaveReason').value = request.reason || '';
        }
        updateSummary();
        leaveModal.show();
    }

    var summaryToken = 0;

    /** Working days, pay and — for credit-based leave — the employee's balance. */
    function updateSummary() {
        var box = el('leaveSummary');
        var employeeId = el('leaveEmployee').value;
        var category = categoryById(el('leaveCategory').value);
        var from = el('leaveFrom').value;
        var to = el('leaveTo').value;
        box.classList.remove('is-warning');

        if (!employeeId || !category || !from || !to || to < from) {
            box.textContent = 'Choose an employee, leave type and dates.';
            return;
        }
        var days = workdays(from, to);
        var text = days + ' working day' + (days === 1 ? '' : 's') + ' (Monday–Friday) · ' +
            (category.paid ? 'Paid leave' : 'Unpaid leave');
        var warn = days === 0 || (category.maxDays && days > category.maxDays);
        if (category.maxDays && days > category.maxDays) {
            text += ' · more than the ' + category.maxDays + '-day maximum for ' + category.name;
        }
        if (!category.usesCredits) {
            box.textContent = text;
            box.classList.toggle('is-warning', !!warn);
            return;
        }

        var token = ++summaryToken;
        box.textContent = text + ' · checking leave credits…';
        api('api/leave/balance?employeeId=' + encodeURIComponent(employeeId) + '&year=' + from.slice(0, 4))
            .then(function (data) {
                if (token !== summaryToken || !data.success) return;
                var b = data.balance;
                // When editing, this request's own days are not yet "used".
                var remaining = b.remaining;
                box.textContent = text + ' · ' + remaining + ' of ' + b.total + ' leave credits left for ' + b.year +
                    (b.pending ? ' (' + b.pending + ' more day' + (b.pending === 1 ? '' : 's') + ' pending)' : '');
                box.classList.toggle('is-warning', !!warn || days > remaining);
            });
    }

    ['leaveEmployee', 'leaveCategory', 'leaveFrom', 'leaveTo'].forEach(function (id) {
        el(id).addEventListener('change', updateSummary);
    });

    leaveForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!PPValidate.validateForm(leaveForm)) return;
        var payload = {
            employeeId: el('leaveEmployee').value,
            categoryId: Number(el('leaveCategory').value),
            dateFrom: el('leaveFrom').value,
            dateTo: el('leaveTo').value,
            reason: el('leaveReason').value.trim()
        };
        var btn = el('saveLeaveBtn');
        btn.disabled = true;
        api(editingId ? 'api/leave/requests/' + editingId : 'api/leave/requests', editingId ? 'PUT' : 'POST', payload)
            .then(function (data) {
                btn.disabled = false;
                if (!data.success) {
                    if (!PPValidate.showServerError(leaveForm, data, SERVER_FIELDS)) PPToast.error(data.message || 'Could not save the request.');
                    return;
                }
                leaveModal.hide();
                PPToast.success(editingId ? 'Leave request updated.' : 'Leave recorded for ' + data.request.employeeName + '.');
                load();
            })
            .catch(function () {
                btn.disabled = false;
                PPToast.error('Could not reach the server.');
            });
    });

    // ---------------------------------------------------------------
    // Details and review
    // ---------------------------------------------------------------

    function detailItem(label, value) {
        return '<div><span class="leave-detail-label">' + label + '</span><span class="leave-detail-value">' + value + '</span></div>';
    }

    function openDetail(id) {
        var r = requests.find(function (x) { return x.id === id; });
        if (!r) return;
        current = r;
        var pending = r.status === 'Pending';
        var canCancel = pending || r.status === 'Approved';

        el('detailTitle').textContent = r.category + ' — ' + r.employeeName;
        el('detailBody').innerHTML =
            '<div class="leave-detail-grid">' +
                detailItem('Employee', escapeHtml(r.employeeName) + '<span class="leave-sub">' + escapeHtml(r.employeeNumber) + ' · ' + escapeHtml(r.employeeType) + '</span>') +
                detailItem('Dates', dateRange(r.dateFrom, r.dateTo)) +
                detailItem('Working days', r.days) +
                detailItem('Pay', payBadge(r.paid)) +
                detailItem('Filed', formatDate(r.dateFiled)) +
                detailItem('Status', statusBadge(r.status)) +
            '</div>' +
            '<p class="mb-2"><strong>Reason:</strong> ' + escapeHtml(r.reason || '—') + '</p>' +
            (r.reviewedBy
                ? '<p class="mb-2"><strong>' + escapeHtml(r.status) + ' by</strong> ' + escapeHtml(r.reviewedBy) + ' · ' +
                  escapeHtml((r.reviewedAt || '').replace('T', ' ').slice(0, 16)) +
                  (r.remarks ? '<br><strong>Remarks:</strong> ' + escapeHtml(r.remarks) : '') + '</p>'
                : '') +
            (r.usesCredits
                ? '<div class="leave-section-title">Leave credits ' + r.dateFrom.slice(0, 4) + '</div>' +
                  '<div id="creditBox" class="leave-summary">Loading…</div>'
                : '') +
            (canCancel
                ? '<div class="leave-section-title">' + (pending ? 'Review' : 'Cancel this leave') + '</div>' +
                  '<form id="reviewForm" novalidate>' +
                  '<label for="reviewRemarks" class="pp-form-label">Remarks ' +
                  '<span class="text-muted fw-normal">(required to reject or cancel)</span></label>' +
                  '<input type="text" class="form-control pp-form-control" id="reviewRemarks" maxlength="255" data-validate="text" data-label="Remarks">' +
                  '</form>'
                : '');

        var footer = '';
        if (pending) {
            footer += '<button type="button" class="btn btn-pp-outline me-auto" id="editLeaveBtn"><i class="bi bi-pencil me-1"></i> Edit</button>' +
                '<button type="button" class="btn btn-outline-secondary" data-review="cancel">Cancel Request</button>' +
                '<button type="button" class="btn btn-outline-danger" data-review="reject">Reject</button>' +
                '<button type="button" class="btn btn-pp-primary" data-review="approve"><i class="bi bi-check2-circle me-1"></i> Approve</button>';
        } else if (canCancel) {
            footer += '<button type="button" class="btn btn-outline-danger ms-auto" data-review="cancel">Cancel Leave</button>';
        } else {
            footer += '<button type="button" class="btn btn-pp-outline" data-bs-dismiss="modal">Close</button>';
        }
        el('detailFooter').innerHTML = footer;

        if (el('editLeaveBtn')) {
            el('editLeaveBtn').addEventListener('click', function () { detailModal.hide(); openForm(r); });
        }
        el('detailFooter').querySelectorAll('[data-review]').forEach(function (btn) {
            btn.addEventListener('click', function () { review(r, btn.dataset.review); });
        });
        if (el('reviewForm')) {
            PPValidate.attach(el('reviewForm'));
            el('reviewForm').addEventListener('submit', function (e) { e.preventDefault(); });
        }
        if (r.usesCredits) loadCredits(r);

        detailModal.show();
    }

    /** The employee's credits for the request's year, with an editor for the total. */
    function loadCredits(r) {
        var year = Number(r.dateFrom.slice(0, 4));
        api('api/leave/balance?employeeId=' + encodeURIComponent(r.employeeId) + '&year=' + year).then(function (data) {
            var box = el('creditBox');
            if (!box || !data.success) return;
            var b = data.balance;
            box.innerHTML =
                '<div class="d-flex flex-wrap align-items-end gap-3">' +
                    '<div>' + b.used + ' used · ' + b.remaining + ' left' +
                        (b.pending ? ' · ' + b.pending + ' pending' : '') +
                        (r.status === 'Pending' && r.days > b.remaining
                            ? '<br><strong class="text-danger">Not enough credits to approve this request.</strong>' : '') +
                    '</div>' +
                    '<form id="creditForm" class="d-flex align-items-end gap-2 ms-auto" novalidate>' +
                        '<div><label for="creditTotal" class="pp-form-label mb-1">Credits for ' + year + '</label>' +
                        '<input type="number" class="form-control pp-form-control" id="creditTotal" style="width:7rem" ' +
                            'min="' + b.used + '" max="365" step="1" value="' + b.total + '" data-validate="number" data-decimals="0" ' +
                            'data-label="Leave credits" required></div>' +
                        '<button type="submit" class="btn btn-pp-outline">Save</button>' +
                    '</form>' +
                '</div>';
            var form = el('creditForm');
            PPValidate.attach(form);
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                if (!PPValidate.validateForm(form)) return;
                api('api/leave/credits', 'PUT', { employeeId: r.employeeId, year: year, totalCredits: Number(el('creditTotal').value) })
                    .then(function (res) {
                        if (!res.success) {
                            if (!PPValidate.showServerError(form, res, { totalCredits: 'creditTotal' })) PPToast.error(res.message);
                            return;
                        }
                        PPToast.success('Leave credits for ' + year + ' set to ' + res.balance.total + '.');
                        loadCredits(r);
                    });
            });
        });
    }

    function review(r, action) {
        var remarksInput = el('reviewRemarks');
        var remarks = remarksInput ? remarksInput.value.trim() : '';
        if ((action === 'reject' || action === 'cancel') && !remarks) {
            PPValidate.setError(remarksInput, action === 'reject' ? 'Give a reason for rejecting.' : 'Give a reason for cancelling.');
            remarksInput.focus();
            return;
        }
        api('api/leave/requests/' + r.id + '/' + action, 'POST', { remarks: remarks }).then(function (data) {
            if (!data.success) {
                if (!(remarksInput && PPValidate.showServerError(el('detailBody'), data, { remarks: 'reviewRemarks' }))) {
                    PPToast.error(data.message || 'Could not update the request.');
                }
                return;
            }
            detailModal.hide();
            PPToast.success({ approve: 'Leave approved.', reject: 'Leave rejected.', cancel: 'Leave cancelled.' }[action]);
            load();
        }).catch(function () {
            PPToast.error('Could not reach the server.');
        });
    }

    // ---------------------------------------------------------------
    // Wiring
    // ---------------------------------------------------------------

    el('recordLeaveBtn').addEventListener('click', function () { openForm(null); });
    el('leaveSearch').addEventListener('input', render);
    ['leaveTypeFilter', 'leaveStatusFilter', 'leaveDateFilter'].forEach(function (id) {
        el(id).addEventListener('change', render);
    });
    el('leaveTableBody').addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-id]');
        if (row) openDetail(Number(row.dataset.id));
    });
    el('leaveTableBody').addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) {
            e.preventDefault();
            openDetail(Number(e.target.dataset.id));
        }
    });

    load();
})();
