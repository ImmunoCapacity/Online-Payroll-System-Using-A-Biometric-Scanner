/**
 * Benefits Table (Benefit Maintenance) — api/benefits.
 *
 * Two views on one page:
 *   1. the employees, with how many benefits they get and the total;
 *   2. one employee (benefits.html?employee=A5): their benefits, where a
 *      benefit can be added (an existing one or a new one), changed or removed.
 * "Benefit Types" renames, re-prices or deactivates a benefit for everyone.
 * Payroll pays each active benefit every payroll period (api/payroll/benefits).
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'benefits',
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
    });

    var NEW_BENEFIT = '__new__';

    var types = [];        // benefits, each with the employees who get it
    var employees = [];
    var employee = null;   // the employee being viewed
    var editingType = null; // benefit id being changed in the assign window, or null when adding

    var el = function (id) { return document.getElementById(id); };
    var assignModal = new bootstrap.Modal(el('assignModal'));
    var typesModal = new bootstrap.Modal(el('typesModal'));
    var assignForm = el('assignForm');
    var typeForm = el('typeForm');

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

    function peso(value) {
        return '₱' + (Number(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function typeBadge(type) {
        var cls = type === 'Faculty' ? 'pp-badge-faculty' : type === 'Faculty/Admin' ? 'pp-badge-faculty-admin' : 'pp-badge-admin';
        return '<span class="pp-badge ' + cls + '">' + escapeHtml(type) + '</span>';
    }

    function statusBadge(status) {
        var cls = status === 'Active' ? 'pp-badge-present' : status === 'On Leave' ? 'pp-badge-late' : 'pp-badge-absent';
        return '<span class="pp-badge ' + cls + '">' + escapeHtml(status || '—') + '</span>';
    }

    /** The benefits one employee gets: [{ id, name, amount, active, defaultAmount }]. */
    function benefitsOf(employeeId) {
        var list = [];
        types.forEach(function (t) {
            t.employees.forEach(function (a) {
                if (a.employeeId === employeeId) {
                    list.push({ id: t.id, name: t.name, amount: Number(a.amount), active: t.active, defaultAmount: t.defaultAmount });
                }
            });
        });
        return list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    }

    /** What the employee is paid per period (active benefits only). */
    function totalOf(list) {
        return list.reduce(function (s, b) { return s + (b.active ? b.amount : 0); }, 0);
    }

    // ---------------------------------------------------------------
    // Loading
    // ---------------------------------------------------------------

    function load() {
        return Promise.all([api('api/benefits'), api('api/employees')]).then(function (results) {
            if (!results[0].success) throw new Error(results[0].message || 'Could not load benefits.');
            if (!results[1].success) throw new Error(results[1].message || 'Could not load employees.');
            types = results[0].benefits;
            employees = results[1].employees;
        });
    }

    function refresh() {
        return load().then(function () {
            if (employee) {
                employee = employees.find(function (e) { return e.id === employee.id; }) || employee;
                renderEmployee();
            } else {
                renderList();
            }
            renderTypes();
        }).catch(function (error) {
            PPToast.error(error.message || 'Could not reach the server.');
        });
    }

    // ---------------------------------------------------------------
    // 1. Employee list
    // ---------------------------------------------------------------

    function renderList() {
        var q = el('employeeSearch').value.trim().toLowerCase();
        var shown = employees.filter(function (e) {
            return !q || (e.displayName + ' ' + e.employeeNumber).toLowerCase().indexOf(q) !== -1;
        });
        if (!shown.length) {
            el('employeeBody').innerHTML = '';
            el('employeeEmpty').textContent = employees.length ? 'No employees match the search.' : 'No employees yet.';
            el('employeeEmpty').classList.remove('d-none');
            return;
        }
        el('employeeEmpty').classList.add('d-none');
        el('employeeBody').innerHTML = shown.map(function (e) {
            var list = benefitsOf(e.id);
            return '<tr class="pp-row-clickable" tabindex="0" role="button" data-employee="' + escapeHtml(e.id) + '" ' +
                    'aria-label="Benefits of ' + escapeHtml(e.displayName) + '">' +
                '<td><strong>' + escapeHtml(e.displayName) + '</strong><span class="bn-sub">' + escapeHtml(e.employeeNumber) + '</span></td>' +
                '<td>' + typeBadge(e.department) + '</td>' +
                '<td class="text-end">' + list.length + '</td>' +
                '<td class="text-end">' + peso(totalOf(list)) + '</td>' +
            '</tr>';
        }).join('');
    }

    // ---------------------------------------------------------------
    // 2. One employee
    // ---------------------------------------------------------------

    function showEmployee(employeeId) {
        employee = employees.find(function (e) { return e.id === employeeId; });
        if (!employee) {
            showList();
            PPToast.error('That employee was not found.');
            return;
        }
        el('listView').classList.add('d-none');
        el('employeeView').classList.remove('d-none');
        window.scrollTo(0, 0);
        renderEmployee();
    }

    function showList() {
        employee = null;
        el('employeeView').classList.add('d-none');
        el('listView').classList.remove('d-none');
        renderList();
    }

    function renderEmployee() {
        el('employeeName').textContent = employee.displayName;
        el('employeeMeta').innerHTML = escapeHtml(employee.employeeNumber) + ' · ' + typeBadge(employee.department) + ' ' + statusBadge(employee.status);

        var list = benefitsOf(employee.id);
        if (!list.length) {
            el('benefitBody').innerHTML = '';
            el('benefitFoot').innerHTML = '';
            el('benefitEmpty').classList.remove('d-none');
            return;
        }
        el('benefitEmpty').classList.add('d-none');
        el('benefitBody').innerHTML = list.map(function (b) {
            return '<tr class="pp-row-clickable' + (b.active ? '' : ' bn-inactive') + '" tabindex="0" role="button" data-benefit="' + b.id + '" ' +
                    'aria-label="Change ' + escapeHtml(b.name) + '">' +
                '<td><strong>' + escapeHtml(b.name) + '</strong></td>' +
                '<td class="text-end">' + peso(b.amount) + '</td>' +
            '</tr>';
        }).join('');
        el('benefitFoot').innerHTML = '<tr><th>Total paid per period</th><th class="text-end bn-total">' + peso(totalOf(list)) + '</th></tr>';
    }

    // ---------------------------------------------------------------
    // Add / change / remove one benefit for this employee
    // ---------------------------------------------------------------

    function openAssign(benefitId) {
        editingType = benefitId || null;
        assignForm.reset();
        PPValidate.clear(assignForm);
        var have = benefitsOf(employee.id);
        var current = have.find(function (b) { return b.id === benefitId; });

        el('assignTitle').textContent = current ? 'Change ' + current.name : 'Add Benefit';
        el('removeBenefitBtn').classList.toggle('d-none', !current);
        el('assignBenefit').disabled = !!current;
        el('assignBenefit').innerHTML = '<option value="" selected hidden data-hint>Select benefit</option>' +
            types.filter(function (t) {
                // When adding: active benefits the employee doesn't have yet.
                return current ? t.id === current.id
                    : t.active && !have.some(function (b) { return b.id === t.id; });
            }).map(function (t) {
                return '<option value="' + t.id + '">' + escapeHtml(t.name) + ' — default ' + peso(t.defaultAmount) + '</option>';
            }).join('') +
            (current ? '' : '<option value="' + NEW_BENEFIT + '">+ New benefit…</option>');

        if (current) {
            el('assignBenefit').value = String(current.id);
            el('assignAmount').value = current.amount.toFixed(2);
            el('assignNote').textContent = current.active ? '' : 'This benefit is inactive, so it is not paid. Reactivate it under Benefit Types.';
        } else {
            el('assignNote').textContent = '';
        }
        toggleNewFields();
        assignModal.show();
    }

    function toggleNewFields() {
        var isNew = el('assignBenefit').value === NEW_BENEFIT;
        el('newBenefitFields').classList.toggle('d-none', !isNew);
        el('newBenefitName').required = isNew;
        el('assignNote').textContent = isNew ? 'The new benefit is added to Benefit Types with this amount as its default.' : el('assignNote').textContent;
    }

    el('assignBenefit').addEventListener('change', function () {
        toggleNewFields();
        var t = types.find(function (x) { return String(x.id) === el('assignBenefit').value; });
        if (t) el('assignAmount').value = Number(t.defaultAmount).toFixed(2);
    });

    // New benefit names must be unique.
    el('newBenefitName').ppValidator = function (value) {
        return types.some(function (t) { return t.name.toLowerCase() === value.toLowerCase(); })
            ? 'A benefit with this name already exists — pick it from the list.' : '';
    };

    assignForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!PPValidate.validateForm(assignForm)) return;
        var amount = Number(el('assignAmount').value);
        var choice = el('assignBenefit').value;
        var btn = el('saveAssignBtn');
        btn.disabled = true;

        var benefitId = choice === NEW_BENEFIT
            ? api('api/benefits', 'POST', { name: el('newBenefitName').value.trim(), defaultAmount: amount, active: true })
                .then(function (data) {
                    if (!data.success) throw Object.assign(data, { fields: { name: 'newBenefitName', defaultAmount: 'assignAmount' } });
                    return data.benefit.id;
                })
            : Promise.resolve(Number(choice));

        benefitId.then(function (id) {
            return api('api/benefits/' + id + '/employees/' + encodeURIComponent(employee.id), 'PUT', { amount: amount });
        }).then(function (data) {
            btn.disabled = false;
            if (!data.success) throw Object.assign(data, { fields: { amount: 'assignAmount' } });
            assignModal.hide();
            PPToast.success(editingType ? 'Benefit updated.' : 'Benefit added for ' + employee.displayName + '.');
            refresh();
        }).catch(function (error) {
            btn.disabled = false;
            if (error && error.success === false) {
                if (!PPValidate.showServerError(assignForm, error, error.fields || {})) PPToast.error(error.message);
                refresh();
            } else {
                PPToast.error('Could not reach the server.');
            }
        });
    });

    el('removeBenefitBtn').addEventListener('click', function () {
        var current = benefitsOf(employee.id).find(function (b) { return b.id === editingType; });
        if (!current) return;
        assignModal.hide();
        ConfirmModal.show({
            title: 'Remove Benefit',
            message: 'Remove ' + current.name + ' (' + peso(current.amount) + ' per period) from ' + employee.displayName + '?',
            confirmText: 'Remove',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            api('api/benefits/' + current.id + '/employees/' + encodeURIComponent(employee.id), 'DELETE').then(function (data) {
                if (!data.success) { PPToast.error(data.message); return; }
                PPToast.success(current.name + ' removed.');
                refresh();
            });
        });
    });

    // ---------------------------------------------------------------
    // Benefit types (for everyone)
    // ---------------------------------------------------------------

    function renderTypes() {
        el('typesBody').innerHTML = types.length ? types.map(function (t) {
            return '<tr class="pp-row-clickable' + (t.active ? '' : ' bn-inactive') + '" tabindex="0" role="button" data-type="' + t.id + '">' +
                '<td><strong>' + escapeHtml(t.name) + '</strong></td>' +
                '<td class="text-end">' + peso(t.defaultAmount) + '</td>' +
                '<td class="text-end">' + t.employees.length + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="3" class="text-center text-muted py-3">No benefits yet.</td></tr>';
    }

    function resetTypeForm() {
        typeForm.reset();
        PPValidate.clear(typeForm);
        el('typeId').value = '';
        el('typeFormTitle').textContent = 'New Benefit';
        el('saveTypeBtn').textContent = 'Add';
        el('cancelTypeBtn').classList.add('d-none');
    }

    function editType(id) {
        var t = types.find(function (x) { return x.id === id; });
        if (!t) return;
        PPValidate.clear(typeForm);
        el('typeId').value = t.id;
        el('typeName').value = t.name;
        el('typeAmount').value = Number(t.defaultAmount).toFixed(2);
        el('typeActive').value = t.active ? 'true' : 'false';
        el('typeFormTitle').textContent = 'Edit ' + t.name;
        el('saveTypeBtn').textContent = 'Save';
        el('cancelTypeBtn').classList.remove('d-none');
        el('typeName').focus();
    }

    el('typeName').ppValidator = function (value) {
        var id = Number(el('typeId').value) || null;
        return types.some(function (t) { return t.id !== id && t.name.toLowerCase() === value.toLowerCase(); })
            ? 'A benefit with this name already exists.' : '';
    };

    typeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!PPValidate.validateForm(typeForm)) return;
        var id = el('typeId').value;
        api(id ? 'api/benefits/' + id : 'api/benefits', id ? 'PUT' : 'POST', {
            name: el('typeName').value.trim(),
            defaultAmount: Number(el('typeAmount').value),
            active: el('typeActive').value === 'true'
        }).then(function (data) {
            if (!data.success) {
                if (!PPValidate.showServerError(typeForm, data, { name: 'typeName', defaultAmount: 'typeAmount' })) PPToast.error(data.message);
                return;
            }
            PPToast.success(id ? 'Benefit updated.' : 'Benefit added.');
            resetTypeForm();
            refresh();
        });
    });

    el('cancelTypeBtn').addEventListener('click', resetTypeForm);
    el('typesBtn').addEventListener('click', function () { resetTypeForm(); typesModal.show(); });
    el('typesBody').addEventListener('click', function (e) {
        var row = e.target.closest('tr[data-type]');
        if (row) editType(Number(row.dataset.type));
    });

    // ---------------------------------------------------------------
    // Navigation: ?employee=A5 opens that employee's benefits
    // ---------------------------------------------------------------

    function openEmployee(employeeId) {
        history.pushState({ employee: employeeId }, '', 'benefits.html?employee=' + encodeURIComponent(employeeId));
        showEmployee(employeeId);
    }

    function route() {
        var employeeId = new URLSearchParams(window.location.search).get('employee');
        if (employeeId) showEmployee(employeeId); else showList();
    }

    window.addEventListener('popstate', route);

    el('backToList').addEventListener('click', function () {
        if (history.state && history.state.employee) {
            history.back();
        } else {
            history.pushState({}, '', 'benefits.html');
            showList();
        }
    });

    function rowActivate(container, selector, handler) {
        container.addEventListener('click', function (e) {
            var row = e.target.closest(selector);
            if (row) handler(row);
        });
        container.addEventListener('keydown', function (e) {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.matches(selector)) {
                e.preventDefault();
                handler(e.target);
            }
        });
    }

    rowActivate(el('employeeBody'), 'tr[data-employee]', function (row) { openEmployee(row.dataset.employee); });
    rowActivate(el('benefitBody'), 'tr[data-benefit]', function (row) { openAssign(Number(row.dataset.benefit)); });
    el('employeeSearch').addEventListener('input', renderList);
    el('addBenefitBtn').addEventListener('click', function () { openAssign(null); });

    el('employeeBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Loading employees…</td></tr>';
    load().then(function () {
        renderTypes();
        route();
    }).catch(function (error) {
        el('employeeBody').innerHTML = '';
        el('employeeEmpty').textContent = error.message || 'Could not load benefits. Is the backend running?';
        el('employeeEmpty').classList.remove('d-none');
    });
})();
