/**
 * Maintenance (Payroll Master): Employee Rates, Leave Categories and the
 * Deduction Tables (BIR, PhilHealth, Pag-IBIG, SSS). Everything is stored
 * in the database; every change is written to the audit trail by the
 * server, and the latest change of each table is shown under it.
 */
(function () {
    PayrollProLayout.init({
        activeNav: 'maintenance',
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    function api(url, method, body) {
        return fetch(url, {
            method: method || 'GET',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        }).then(function (r) {
            return r.json().catch(function () {
                return { success: false, message: 'Unexpected response from the server.' };
            });
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function peso(n) {
        if (n === null || n === undefined || n === '') return '—';
        return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function todayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /** Rows open their edit form on click, or Enter/Space when focused. */
    function clickableRows(bodyId, open) {
        var body = document.getElementById(bodyId);
        body.addEventListener('click', function (e) {
            var row = e.target.closest('tr[data-id]');
            if (row) open(parseInt(row.dataset.id, 10));
        });
        body.addEventListener('keydown', function (e) {
            var row = e.target.closest('tr[data-id]');
            if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                open(parseInt(row.dataset.id, 10));
            }
        });
    }

    function rowAttrs(id, label) {
        return 'class="pp-row-clickable" tabindex="0" role="button" data-id="' + id + '" aria-label="' + escapeHtml(label) + '"';
    }

    /** The Remove/Deactivate button of an edit modal: shown only when editing. */
    function setRemoveButton(id, text, show, restore) {
        var btn = document.getElementById(id);
        btn.textContent = text;
        btn.classList.toggle('d-none', !show);
        btn.classList.toggle('is-restore', !!restore);
    }

    // ================================================================
    // AUDIT — the last change of each table, from the audit trail
    // ================================================================

    var AUDIT_MODULES = {
        rates: 'Employee Rates',
        leave: 'Leave Categories',
        ranks: 'Instructor Ranks',
        holidays: 'Holiday Calendar',
        bir: 'BIR Table',
        philhealth: 'PhilHealth Table',
        pagibig: 'Pag-IBIG Table',
        sss: 'SSS Table'
    };
    var AUDIT_TARGETS = {
        rates: 'ratesAudit', leave: 'leaveAudit', ranks: 'ranksAudit', holidays: 'holidaysAudit', bir: 'birAudit',
        philhealth: 'phAudit', pagibig: 'pagAudit', sss: 'sssAudit'
    };

    function formatAudit(entry) {
        if (!entry) return 'No changes recorded yet.';
        var d = new Date(entry.at);
        var ts = d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        return 'Last change: <strong>' + escapeHtml(entry.action) + '</strong> — ' + escapeHtml(entry.detail) +
            ' · by ' + escapeHtml(entry.user) + ' · ' + ts;
    }

    function loadAudit() {
        var names = Object.keys(AUDIT_MODULES).map(function (k) { return AUDIT_MODULES[k]; });
        return api('api/audit/latest?modules=' + encodeURIComponent(names.join(','))).then(function (data) {
            if (!data.success) return;
            Object.keys(AUDIT_MODULES).forEach(function (key) {
                document.getElementById(AUDIT_TARGETS[key]).innerHTML = formatAudit(data.latest[AUDIT_MODULES[key]]);
            });
        }).catch(function () { /* the tables still work without it */ });
    }

    // ================================================================
    // SECTION NAV
    // ================================================================

    var sectionMap = {
        rates: 'sectionRates',
        leave: 'sectionLeave',
        ranks: 'sectionRanks',
        holidays: 'sectionHolidays',
        benefits: 'sectionBenefits',
        bir: 'sectionBir',
        philhealth: 'sectionPhilhealth',
        pagibig: 'sectionPagibig',
        sss: 'sectionSss'
    };

    document.querySelectorAll('.pp-maint-nav-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var section = btn.dataset.section;
            document.querySelectorAll('.pp-maint-nav-btn').forEach(function (b) {
                b.classList.toggle('active', b === btn);
            });
            Object.keys(sectionMap).forEach(function (key) {
                document.getElementById(sectionMap[key]).classList.toggle('d-none', key !== section);
            });
        });
    });

    // ================================================================
    // EMPLOYEE RATES (api/rates) — history per employee. A new rate
    // closes the current one the day before; the employee record is
    // updated, and payroll pays each period at the rate in effect then.
    // ================================================================

    var rates = [];
    var rateEmployees = [];

    function loadRates() {
        return api('api/rates').then(function (data) {
            if (!data.success) throw new Error(data.message);
            rates = data.rates;
            rateEmployees = data.employees;
            renderRates();
        }).catch(function () {
            document.getElementById('ratesBody').innerHTML =
                '<tr><td colspan="7" class="text-center text-muted py-4">Could not load employee rates from the server.</td></tr>';
        });
    }

    function renderRates() {
        if (!rates.length) {
            document.getElementById('ratesBody').innerHTML =
                '<tr><td colspan="7" class="text-center text-muted py-4">No employees with a rate yet. Rates are set in Employee Records or here.</td></tr>';
            return;
        }
        document.getElementById('ratesBody').innerHTML = rates.map(function (r) {
            return (
                '<tr class="pp-row-clickable' + (r.active ? '' : ' inactive') + '" tabindex="0" role="button" ' +
                    'data-employee="' + escapeHtml(r.employeeId) + '" data-kind="' + escapeHtml(r.kind) + '" ' +
                    'aria-label="New rate for ' + escapeHtml(r.employeeName) + '">' +
                    '<td>' + escapeHtml(r.employeeNumber) + '</td>' +
                    '<td><strong>' + escapeHtml(r.employeeName) + '</strong><br><span class="text-muted small">' + escapeHtml(r.employeeType) + '</span></td>' +
                    '<td>' + escapeHtml(r.rateType) + '</td>' +
                    '<td class="col-money">' + peso(r.amount) + '</td>' +
                    '<td>' + formatDate(r.effective) + '</td>' +
                    '<td>' + (r.end ? formatDate(r.end) : '—') + '</td>' +
                    '<td>' + (r.recordedBy ? escapeHtml(r.recordedBy) : '<span class="text-muted small">—</span>') + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    var rateEmployee = document.getElementById('rateEmployee');
    var rateType = document.getElementById('rateType');

    function populateRateTypes() {
        var emp = rateEmployees.find(function (e) { return e.id === rateEmployee.value; });
        rateType.innerHTML = emp
            ? emp.kinds.map(function (k) { return '<option value="' + k.kind + '">' + escapeHtml(k.label) + '</option>'; }).join('')
            : '<option value="" selected hidden data-hint>Select an employee first</option>';
    }

    // Clicking a rate row opens a new rate for that employee and rate type.
    function openRateForm(employeeId, kind) {
        var emp = rateEmployees.find(function (e) { return e.id === employeeId; });
        if (!emp) {
            PPToast.error('Only active employees can be given a new rate.');
            return;
        }
        var form = document.getElementById('rateForm');
        form.reset();
        PPValidate.clear(form);
        rateEmployee.innerHTML = '<option value="' + escapeHtml(emp.id) + '">' +
            escapeHtml(emp.name) + ' (' + escapeHtml(emp.employeeType) + ')</option>';
        rateEmployee.value = emp.id;
        rateEmployee.disabled = true;
        populateRateTypes();
        if (kind && emp.kinds.some(function (k) { return k.kind === kind; })) rateType.value = kind;
        document.getElementById('rateModalTitle').textContent = 'New Rate — ' + emp.name;
        document.getElementById('rateEffective').max = todayIso();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('rateModal')).show();
    }

    var ratesBody = document.getElementById('ratesBody');
    ratesBody.addEventListener('click', function (event) {
        var row = event.target.closest('tr[data-employee]');
        if (row) openRateForm(row.dataset.employee, row.dataset.kind);
    });
    ratesBody.addEventListener('keydown', function (event) {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('tr[data-employee]')) {
            event.preventDefault();
            openRateForm(event.target.dataset.employee, event.target.dataset.kind);
        }
    });

    function currentRate() {
        return rates.find(function (r) {
            return r.employeeId === rateEmployee.value && r.kind === rateType.value && r.active;
        });
    }

    // A new rate ends the current one the day before, so it must start after
    // the current rate's effective date, and it can't start in the future.
    document.getElementById('rateEffective').ppValidator = function (value) {
        if (value > todayIso()) return 'The effective date can\'t be in the future.';
        var current = currentRate();
        return current && value <= current.effective
            ? 'Must be after the current rate\'s effective date (' + formatDate(current.effective) + ').'
            : '';
    };

    rateEmployee.addEventListener('change', function () {
        populateRateTypes();
        var effective = document.getElementById('rateEffective');
        if (effective.value) PPValidate.validateField(effective);
    });
    rateType.addEventListener('change', function () {
        var effective = document.getElementById('rateEffective');
        if (effective.value) PPValidate.validateField(effective);
    });

    document.getElementById('rateForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!PPValidate.validateForm(form)) {
            return;
        }
        var name = rateEmployee.selectedOptions[0].textContent;
        api('api/rates', 'POST', {
            employeeId: rateEmployee.value,
            kind: rateType.value,
            amount: parseFloat(document.getElementById('rateAmount').value),
            effectiveDate: document.getElementById('rateEffective').value
        }).then(function (result) {
            if (!result.success) {
                var fields = { employeeId: 'rateEmployee', kind: 'rateType', amount: 'rateAmount', effectiveDate: 'rateEffective' };
                if (!PPValidate.showServerError(form, result, fields)) PPToast.error(result.message);
                return;
            }
            rates = result.rates;
            renderRates();
            loadAudit();
            bootstrap.Modal.getInstance(document.getElementById('rateModal')).hide();
            PPToast.success('Rate added for ' + name + '.');
        }).catch(function () {
            PPToast.error('Could not reach the server.');
        });
    });

    // ================================================================
    // LEAVE CATEGORIES (api/leave/categories)
    // ================================================================

    var leaveCategories = [];
    var leaveEditId = null;

    function loadLeaveCategories() {
        return api('api/leave/categories').then(function (data) {
            if (!data.success) throw new Error(data.message);
            leaveCategories = data.categories;
            renderLeave();
        }).catch(function () {
            document.getElementById('leaveBody').innerHTML =
                '<tr><td colspan="3" class="text-center text-muted py-4">Could not load leave categories from the server.</td></tr>';
        });
    }

    /** Saves a category; returns the server's reply. */
    function saveLeaveCategory(id, data) {
        return api(id ? 'api/leave/categories/' + id : 'api/leave/categories', id ? 'PUT' : 'POST', data);
    }

    function renderLeave() {
        document.getElementById('leaveBody').innerHTML = leaveCategories.map(function (c) {
            return (
                '<tr ' + rowAttrs(c.id, 'Edit ' + c.name) + (c.active ? '' : ' data-inactive="1"') + '>' +
                    '<td><strong>' + escapeHtml(c.name) + '</strong>' +
                        (c.active ? '' : ' <span class="pp-badge-inactive">Inactive</span>') + '</td>' +
                    '<td>' + (c.paid ? '<span class="pp-badge-leave-paid">Paid</span>' : '<span class="pp-badge-leave-unpaid">Unpaid</span>') + '</td>' +
                    '<td class="col-num">' + (c.paid && c.paidDays != null ? c.paidDays : '—') + '</td>' +
                '</tr>'
            );
        }).join('');
    }

    /** Paid for how many days only applies to paid leave. */
    function syncLeavePaidDays() {
        var paid = document.getElementById('leavePaid').value === 'Paid';
        var input = document.getElementById('leavePaidDays');
        document.getElementById('leavePaidDaysGroup').classList.toggle('d-none', !paid);
        input.required = paid;
        if (!paid) {
            input.value = '';
            PPValidate.clear(input.closest('.mb-0'));
        }
    }

    function openLeaveForm(cat) {
        leaveEditId = cat ? cat.id : null;
        var form = document.getElementById('leaveForm');
        form.reset();
        document.getElementById('leaveModalTitle').textContent = cat ? 'Edit Leave Category' : 'Add Leave Category';
        if (cat) {
            document.getElementById('leaveName').value = cat.name;
            document.getElementById('leavePaid').value = cat.paid ? 'Paid' : 'Unpaid';
            document.getElementById('leavePaidDays').value = cat.paidDays == null ? '' : cat.paidDays;
        }
        syncLeavePaidDays();
        setRemoveButton('leaveRemoveBtn', cat && !cat.active ? 'Reactivate' : 'Deactivate', !!cat, cat && !cat.active);
        PPValidate.clear(form);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('leaveModal')).show();
    }

    clickableRows('leaveBody', function (id) {
        var cat = leaveCategories.find(function (c) { return c.id === id; });
        if (cat) openLeaveForm(cat);
    });

    document.getElementById('btnAddLeave').addEventListener('click', function () { openLeaveForm(null); });
    document.getElementById('leavePaid').addEventListener('change', syncLeavePaidDays);

    function setLeaveActive(cat, active) {
        saveLeaveCategory(cat.id, { name: cat.name, paid: cat.paid, paidDays: cat.paidDays, active: active }).then(function (data) {
            if (!data.success) { PPToast.error(data.message); return; }
            bootstrap.Modal.getOrCreateInstance(document.getElementById('leaveModal')).hide();
            PPToast.success('"' + cat.name + '" ' + (active ? 'reactivated.' : 'deactivated.'));
            loadLeaveCategories();
            loadAudit();
        }).catch(function () {
            PPToast.error('Could not reach the server.');
        });
    }

    document.getElementById('leaveRemoveBtn').addEventListener('click', function () {
        var cat = leaveCategories.find(function (c) { return c.id === leaveEditId; });
        if (!cat) return;
        if (!cat.active) {
            setLeaveActive(cat, true);
            return;
        }
        ConfirmModal.show({
            title: 'Deactivate Leave Category',
            message: 'Deactivate "' + cat.name + '"? It can no longer be chosen for new leave. Leave already recorded is kept.',
            confirmText: 'Deactivate',
            tone: 'danger'
        }).then(function (confirmed) {
            if (confirmed) setLeaveActive(cat, false);
        });
    });

    // Leave category names must be unique.
    document.getElementById('leaveName').ppValidator = function (value) {
        var taken = leaveCategories.some(function (c) {
            return c.id !== leaveEditId && String(c.name).toLowerCase() === value.toLowerCase();
        });
        return taken ? 'A leave category with this name already exists.' : '';
    };

    document.getElementById('leaveForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!PPValidate.validateForm(form)) {
            return;
        }
        var existing = leaveEditId && leaveCategories.find(function (c) { return c.id === leaveEditId; });
        var paid = document.getElementById('leavePaid').value === 'Paid';
        var data = {
            name: document.getElementById('leaveName').value.trim(),
            paid: paid,
            paidDays: paid ? parseInt(document.getElementById('leavePaidDays').value, 10) : null,
            active: existing ? existing.active : true
        };
        saveLeaveCategory(leaveEditId, data).then(function (result) {
            if (!result.success) {
                var fields = { name: 'leaveName', paidDays: 'leavePaidDays' };
                if (!PPValidate.showServerError(form, result, fields)) PPToast.error(result.message);
                return;
            }
            bootstrap.Modal.getInstance(document.getElementById('leaveModal')).hide();
            PPToast.success('Leave category saved.');
            loadLeaveCategories();
            loadAudit();
        }).catch(function () {
            PPToast.error('Could not reach the server.');
        });
    });

    // ================================================================
    // DEDUCTION TABLES (api/contribution-tables) — brackets per year
    // ================================================================

    var TABLES = { bir: {}, philhealth: {}, pagibig: {}, sss: {} };

    var bracketConfigs = {
        bir: {
            yearSelect: 'birYear',
            body: 'birBody',
            label: 'BIR Table',
            addBtn: 'btnAddBir',
            archiveBtn: 'btnArchiveBir',
            fields: [
                { id: 'min', label: 'Bracket Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Bracket Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'base', label: 'Base Amount (₱)', type: 'number', key: 'base' },
                { id: 'rate', label: 'Rate (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr ' + rowAttrs(b.id, 'Edit bracket ' + peso(b.min)) + '>' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + peso(b.base) + '</td>' +
                        '<td class="col-num">' + Number(b.rate) + '%</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Bracket ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', base ' + peso(b.base) + ', rate ' + b.rate + '%';
            }
        },
        philhealth: {
            yearSelect: 'phYear',
            body: 'phBody',
            label: 'PhilHealth Table',
            addBtn: 'btnAddPh',
            archiveBtn: 'btnArchivePh',
            fields: [
                { id: 'min', label: 'Salary Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Salary Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'premium', label: 'Monthly Premium (₱)', type: 'number', key: 'premium', optional: true },
                { id: 'rate', label: 'Rate (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr ' + rowAttrs(b.id, 'Edit bracket ' + peso(b.min)) + '>' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + (b.premium != null ? peso(b.premium) : '—') + '</td>' +
                        '<td class="col-num">' + Number(b.rate) + '%</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Salary ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', premium ' + (b.premium != null ? peso(b.premium) : 'computed') + ', rate ' + b.rate + '%';
            }
        },
        pagibig: {
            yearSelect: 'pagYear',
            body: 'pagBody',
            label: 'Pag-IBIG Table',
            addBtn: 'btnAddPag',
            archiveBtn: 'btnArchivePag',
            fields: [
                { id: 'min', label: 'Compensation Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Compensation Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'share', label: 'Employee Share (₱)', type: 'number', key: 'share', optional: true },
                { id: 'rate', label: 'Rate (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr ' + rowAttrs(b.id, 'Edit bracket ' + peso(b.min)) + '>' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + (b.share != null ? peso(b.share) : '—') + '</td>' +
                        '<td class="col-num">' + Number(b.rate) + '%</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Compensation ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', share ' + (b.share != null ? peso(b.share) : 'computed') + ', rate ' + b.rate + '%';
            }
        },
        sss: {
            yearSelect: 'sssYear',
            body: 'sssBody',
            label: 'SSS Table',
            addBtn: 'btnAddSss',
            archiveBtn: 'btnArchiveSss',
            fields: [
                { id: 'min', label: 'Compensation Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Compensation Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'msc', label: 'Monthly Salary Credit (₱)', type: 'number', key: 'msc' },
                { id: 'rate', label: 'Employee Share (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr ' + rowAttrs(b.id, 'Edit bracket ' + peso(b.min)) + '>' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + peso(b.msc) + '</td>' +
                        '<td class="col-num">' + Number(b.rate) + '%</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Compensation ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', MSC ' + peso(b.msc) + ', employee share ' + b.rate + '%';
            }
        }
    };

    var pendingBracketSave = null;
    var bracketModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('bracketModal'));
    var highStakesModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('highStakesModal'));

    /** Years with brackets, plus this year and next (so new brackets can be entered after archiving). */
    function populateYearSelect(configKey) {
        var select = document.getElementById(bracketConfigs[configKey].yearSelect);
        var previous = select.value;
        var now = new Date().getFullYear();
        var years = Object.keys(TABLES[configKey] || {});
        [String(now), String(now + 1)].forEach(function (y) { if (years.indexOf(y) === -1) years.push(y); });
        years.sort(function (a, b) { return b - a; });
        select.innerHTML = years.map(function (y) {
            var has = ((TABLES[configKey] || {})[y] || []).length > 0;
            return '<option value="' + y + '">' + y + (has ? '' : ' (no brackets)') + '</option>';
        }).join('');
        select.value = previous && years.indexOf(previous) !== -1 ? previous : String(now);
    }

    function getYearBrackets(configKey) {
        var year = document.getElementById(bracketConfigs[configKey].yearSelect).value;
        return (TABLES[configKey] || {})[year] || [];
    }

    function renderBracketTable(configKey) {
        var config = bracketConfigs[configKey];
        var body = document.getElementById(config.body);
        var brackets = getYearBrackets(configKey).slice().sort(function (a, b) { return a.min - b.min; });
        body.innerHTML = brackets.length
            ? brackets.map(function (b) { return config.renderRow(b); }).join('')
            : '<tr><td colspan="4" class="text-center text-muted py-4">No brackets for this year. Click Add Bracket to enter them.</td></tr>';
        document.getElementById(config.archiveBtn).disabled = !brackets.length;
    }

    /** Archive Table: the government changed it; the year's brackets go to the Archive and new ones are entered. */
    function archiveTable(configKey) {
        var config = bracketConfigs[configKey];
        var year = document.getElementById(config.yearSelect).value;
        var count = getYearBrackets(configKey).length;
        if (!count) return;
        ConfirmModal.show({
            title: 'Archive ' + config.label,
            message: 'Archive the ' + year + ' ' + config.label + ' (' + count + ' bracket' + (count === 1 ? '' : 's') + ')? ' +
                'Use this when the government changes the table. The brackets move to the Archive and are no longer used ' +
                'by payroll, so enter the new brackets for ' + year + ' right after. Released payroll is not changed.',
            confirmText: 'Archive Table',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            api('api/contribution-tables/' + configKey + '/archive', 'POST', { year: parseInt(year, 10) }).then(function (data) {
                if (!data.success) { PPToast.error(data.message || 'Could not archive the table.'); return; }
                TABLES[configKey] = data.years;
                populateYearSelect(configKey);
                document.getElementById(config.yearSelect).value = year;
                renderBracketTable(configKey);
                loadAudit();
                PPToast.success('The ' + year + ' ' + config.label + ' was archived. Click Add Bracket to enter the new brackets.');
            }).catch(function () {
                PPToast.error('Could not reach the server.');
            });
        });
    }

    // Remove Bracket (in the edit form): removes one row of the table.
    document.getElementById('bracketRemoveBtn').addEventListener('click', function () {
        var form = document.getElementById('bracketForm');
        var configKey = form.dataset.config;
        var id = parseInt(form.dataset.id, 10);
        if (!configKey || !id) return;
        bracketModal.hide();
        ConfirmModal.show({
            title: 'Remove Bracket Row',
            message: 'Remove this bracket row? Ensure remaining brackets still cover all salary ranges.',
            confirmText: 'Remove Row',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) { bracketModal.show(); return; }
            api('api/contribution-tables/' + configKey + '/' + id, 'DELETE').then(function (data) {
                if (!data.success) { PPToast.error(data.message || 'Could not remove the row.'); return; }
                TABLES[configKey] = data.years;
                populateYearSelect(configKey);
                renderBracketTable(configKey);
                loadAudit();
                PPToast.success('Bracket row removed.');
            }).catch(function () {
                PPToast.error('Could not reach the server.');
            });
        });
    });

    function buildBracketFormFields(config, values) {
        return config.fields.map(function (f) {
            var val = values && values[f.key] != null ? values[f.key] : '';
            var req = f.optional ? '' : 'required';
            var hint = f.optional ? ' <span class="text-muted fw-normal">(leave blank for open-ended)</span>' : '';
            // Peso amounts and percentages: not negative, 2 decimals; a rate can't exceed 100%.
            var max = f.key === 'rate' ? '100' : '100000000';
            return (
                '<div class="mb-3">' +
                    '<label for="bf_' + f.key + '" class="pp-form-label">' + f.label + hint + '</label>' +
                    '<input type="' + f.type + '" class="form-control pp-form-control" id="bf_' + f.key + '" ' +
                        'step="' + (f.step || '0.01') + '" min="0" max="' + max + '" value="' + val + '" ' +
                        'data-validate="number" data-decimals="2" data-label="' + f.label.replace(/\s*\(.*\)$/, '') + '" ' +
                        'inputmode="decimal" ' + req + '>' +
                    '<div class="invalid-feedback"></div>' +
                '</div>'
            );
        }).join('');
    }

    function openBracketForm(configKey, id, isNew) {
        var config = bracketConfigs[configKey];
        var year = document.getElementById(config.yearSelect).value;
        var existing = null;
        if (!isNew) {
            existing = getYearBrackets(configKey).find(function (b) { return b.id === id; });
        }
        document.getElementById('bracketModalTitle').textContent = (isNew ? 'Add Bracket' : 'Edit Bracket') + ' — ' + year;
        document.getElementById('bracketFormFields').innerHTML = buildBracketFormFields(config, existing);
        document.getElementById('bracketForm').dataset.config = configKey;
        document.getElementById('bracketForm').dataset.id = isNew ? '' : id;
        document.getElementById('bracketForm').dataset.isNew = isNew ? '1' : '0';
        setRemoveButton('bracketRemoveBtn', 'Remove Bracket', !isNew);
        PPValidate.clear(document.getElementById('bracketForm'));
        bracketModal.show();
    }

    document.getElementById('bracketForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!PPValidate.validateForm(form)) {
            return;
        }
        var configKey = form.dataset.config;
        var config = bracketConfigs[configKey];
        var year = document.getElementById(config.yearSelect).value;
        var record = {};
        config.fields.forEach(function (f) {
            var raw = document.getElementById('bf_' + f.key).value;
            record[f.key] = raw === '' ? null : parseFloat(raw);
        });

        var isNew = form.dataset.isNew === '1';
        var editingId = form.dataset.id ? parseInt(form.dataset.id, 10) : null;

        // The range must make sense and must not overlap another bracket of the same year.
        if (record.max != null && record.max <= record.min) {
            PPValidate.setError(document.getElementById('bf_max'), 'Max must be greater than min (' + peso(record.min) + ').');
            document.getElementById('bf_max').focus();
            return;
        }
        var newMax = record.max == null ? Infinity : record.max;
        var overlap = getYearBrackets(configKey).find(function (b) {
            if (!isNew && b.id === editingId) return false;
            var bMax = b.max == null ? Infinity : b.max;
            return record.min < bMax && newMax > b.min;
        });
        if (overlap) {
            PPValidate.setError(document.getElementById('bf_min'),
                'This range overlaps the ' + peso(overlap.min) + ' – ' + (overlap.max != null ? peso(overlap.max) : 'Above') + ' bracket.');
            document.getElementById('bf_min').focus();
            return;
        }

        pendingBracketSave = { configKey: configKey, year: year, isNew: isNew, id: editingId, record: record };

        document.getElementById('highStakesSummary').innerHTML =
            '<strong>' + config.label + ' · Year ' + year + '</strong><br>' + config.summary(record);

        bracketModal.hide();
        highStakesModal.show();
    });

    document.getElementById('btnHighStakesConfirm').addEventListener('click', function () {
        if (!pendingBracketSave) return;
        var save = pendingBracketSave;
        var body = Object.assign({ year: parseInt(save.year, 10) }, save.record);
        var url = 'api/contribution-tables/' + save.configKey + (save.isNew ? '' : '/' + save.id);
        var button = this;
        button.disabled = true;

        api(url, save.isNew ? 'POST' : 'PUT', body).then(function (data) {
            if (!data.success) {
                highStakesModal.hide();
                openBracketForm(save.configKey, save.id, save.isNew);
                // Put the values back and show the server's message beside the field.
                Object.keys(save.record).forEach(function (k) {
                    var input = document.getElementById('bf_' + k);
                    if (input) input.value = save.record[k] == null ? '' : save.record[k];
                });
                var fields = { min: 'bf_min', max: 'bf_max', base: 'bf_base', premium: 'bf_premium', share: 'bf_share', msc: 'bf_msc', rate: 'bf_rate' };
                if (!PPValidate.showServerError(document.getElementById('bracketForm'), data, fields)) PPToast.error(data.message);
                return;
            }
            pendingBracketSave = null;
            TABLES[save.configKey] = data.years;
            highStakesModal.hide();
            renderBracketTable(save.configKey);
            loadAudit();
            PPToast.success('Bracket table updated.');
        }).catch(function () {
            PPToast.error('Could not reach the server.');
        }).then(function () {
            button.disabled = false;
        });
    });

    function loadTables() {
        return api('api/contribution-tables').then(function (data) {
            if (!data.success) throw new Error(data.message);
            TABLES = data.tables;
            Object.keys(bracketConfigs).forEach(function (key) {
                populateYearSelect(key);
                renderBracketTable(key);
            });
        }).catch(function () {
            Object.keys(bracketConfigs).forEach(function (key) {
                document.getElementById(bracketConfigs[key].body).innerHTML =
                    '<tr><td colspan="4" class="text-center text-muted py-4">Could not load the table from the server.</td></tr>';
            });
        });
    }

    Object.keys(bracketConfigs).forEach(function (key) {
        var config = bracketConfigs[key];
        document.getElementById(config.yearSelect).addEventListener('change', function () {
            renderBracketTable(key);
        });
        document.getElementById(config.addBtn).addEventListener('click', function () {
            openBracketForm(key, null, true);
        });
        document.getElementById(config.archiveBtn).addEventListener('click', function () {
            archiveTable(key);
        });
        clickableRows(config.body, function (id) {
            openBracketForm(key, id, false);
        });
    });

    // ================================================================
    // INSTRUCTOR RANKS (api/ranks) — the choices for an employee's
    // Instructor Rank. Renaming updates the employees who have it; a rank
    // can only be removed when nobody has it.
    // ================================================================

    var ranks = [];
    var rankEditId = null;

    function loadRanks() {
        return api('api/ranks').then(function (data) {
            if (!data.success) throw new Error(data.message);
            ranks = data.ranks;
            renderRanks();
        }).catch(function () {
            document.getElementById('ranksBody').innerHTML =
                '<tr><td colspan="2" class="text-center text-muted py-4">Could not load instructor ranks from the server.</td></tr>';
        });
    }

    function renderRanks() {
        var body = document.getElementById('ranksBody');
        if (!ranks.length) {
            body.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-4">No ranks yet. Click Add Rank.</td></tr>';
            return;
        }
        body.innerHTML = ranks.map(function (r) {
            return '<tr ' + rowAttrs(r.id, 'Edit ' + r.name) + '>' +
                '<td><strong>' + escapeHtml(r.name) + '</strong></td>' +
                '<td class="col-num">' + r.employees + '</td>' +
            '</tr>';
        }).join('');
    }

    function openRankForm(rank) {
        rankEditId = rank ? rank.id : null;
        document.getElementById('rankModalTitle').textContent = rank ? 'Rename Instructor Rank' : 'Add Instructor Rank';
        document.getElementById('rankForm').reset();
        document.getElementById('rankName').value = rank ? rank.name : '';
        setRemoveButton('rankRemoveBtn', 'Remove', !!rank);
        // A rank can only be removed when nobody has it.
        var removeBtn = document.getElementById('rankRemoveBtn');
        removeBtn.disabled = !!(rank && rank.employees);
        removeBtn.title = rank && rank.employees ? rank.employees + ' employee(s) have this rank' : '';
        PPValidate.clear(document.getElementById('rankForm'));
        bootstrap.Modal.getOrCreateInstance(document.getElementById('rankModal')).show();
    }

    document.getElementById('btnAddRank').addEventListener('click', function () { openRankForm(null); });

    document.getElementById('rankName').ppValidator = function (value) {
        var taken = ranks.some(function (r) {
            return r.id !== rankEditId && String(r.name).toLowerCase() === value.trim().toLowerCase();
        });
        return taken ? 'This rank already exists.' : '';
    };

    clickableRows('ranksBody', function (id) {
        var rank = ranks.find(function (r) { return r.id === id; });
        if (rank) openRankForm(rank);
    });

    document.getElementById('rankRemoveBtn').addEventListener('click', function () {
        var rank = ranks.find(function (r) { return r.id === rankEditId; });
        if (!rank) return;
        ConfirmModal.show({
            title: 'Remove Instructor Rank',
            message: 'Remove "' + rank.name + '"? It will no longer be offered in Employee Records.',
            confirmText: 'Remove',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            api('api/ranks/' + rank.id, 'DELETE').then(function (data) {
                if (!data.success) { PPToast.error(data.message); return; }
                bootstrap.Modal.getOrCreateInstance(document.getElementById('rankModal')).hide();
                ranks = data.ranks;
                renderRanks();
                PPToast.success('"' + rank.name + '" removed.');
                loadAudit();
            }).catch(function () { PPToast.error('Could not reach the server.'); });
        });
    });

    document.getElementById('rankForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!PPValidate.validateForm(form)) return;
        var name = document.getElementById('rankName').value.trim();
        api(rankEditId ? 'api/ranks/' + rankEditId : 'api/ranks', rankEditId ? 'PUT' : 'POST', { name: name })
            .then(function (data) {
                if (!data.success) {
                    if (!PPValidate.showServerError(form, data, { name: 'rankName' })) PPToast.error(data.message);
                    return;
                }
                bootstrap.Modal.getInstance(document.getElementById('rankModal')).hide();
                ranks = data.ranks;
                renderRanks();
                PPToast.success(rankEditId ? 'Rank renamed.' : '"' + name + '" added.');
                loadAudit();
            }).catch(function () { PPToast.error('Could not reach the server.'); });
    });

    // ================================================================
    // HOLIDAY CALENDAR (api/holidays) — the holidays on the Dashboard
    // calendar. Hours worked on a double-pay holiday are paid twice.
    // ================================================================

    var holidays = [];
    var holidayEditId = null;
    var holidayYear = document.getElementById('holidayYear');

    (function fillHolidayYears() {
        var now = new Date().getFullYear();
        for (var y = now - 2; y <= now + 2; y++) {
            holidayYear.add(new Option(String(y), String(y), false, y === now));
        }
    })();

    function loadHolidays() {
        return api('api/holidays?year=' + holidayYear.value).then(function (data) {
            if (!data.success) throw new Error(data.message);
            holidays = data.holidays;
            renderHolidays();
        }).catch(function () {
            document.getElementById('holidaysBody').innerHTML =
                '<tr><td colspan="4" class="text-center text-muted py-4">Could not load holidays from the server.</td></tr>';
        });
    }

    function holidayDateText(iso) {
        var p = iso.split('-').map(Number);
        return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderHolidays() {
        var body = document.getElementById('holidaysBody');
        if (!holidays.length) {
            body.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No holidays for ' +
                escapeHtml(holidayYear.value) + ' yet. Click Add Holiday.</td></tr>';
            return;
        }
        body.innerHTML = holidays.map(function (h) {
            return '<tr ' + rowAttrs(h.id, 'Edit ' + h.name) + '>' +
                '<td>' + holidayDateText(h.date) + '</td>' +
                '<td><strong>' + escapeHtml(h.name) + '</strong></td>' +
                '<td>' + escapeHtml(h.type) + '</td>' +
                '<td>' + (h.doublePay ? '<span class="pp-badge-leave-paid">Yes</span>' : '<span class="pp-badge-inactive">No</span>') + '</td>' +
            '</tr>';
        }).join('');
    }

    function openHolidayForm(holiday) {
        holidayEditId = holiday ? holiday.id : null;
        var form = document.getElementById('holidayForm');
        document.getElementById('holidayModalTitle').textContent = holiday ? 'Edit Holiday' : 'Add Holiday';
        form.reset();
        document.getElementById('holidayDate').value = holiday ? holiday.date : '';
        document.getElementById('holidayName').value = holiday ? holiday.name : '';
        document.getElementById('holidayType').value = holiday ? holiday.type : 'Regular Holiday';
        document.getElementById('holidayDoublePay').value = holiday ? (holiday.doublePay ? 'Yes' : 'No') : 'Yes';
        setRemoveButton('holidayRemoveBtn', 'Remove', !!holiday);
        PPValidate.clear(form);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('holidayModal')).show();
    }

    holidayYear.addEventListener('change', loadHolidays);
    document.getElementById('btnAddHoliday').addEventListener('click', function () { openHolidayForm(null); });

    // Regular holidays are usually double pay; special days usually aren't.
    document.getElementById('holidayType').addEventListener('change', function (e) {
        document.getElementById('holidayDoublePay').value = e.target.value === 'Regular Holiday' ? 'Yes' : 'No';
    });

    clickableRows('holidaysBody', function (id) {
        var holiday = holidays.find(function (h) { return h.id === id; });
        if (holiday) openHolidayForm(holiday);
    });

    document.getElementById('holidayRemoveBtn').addEventListener('click', function () {
        var holiday = holidays.find(function (h) { return h.id === holidayEditId; });
        if (!holiday) return;
        ConfirmModal.show({
            title: 'Remove Holiday',
            message: 'Remove "' + holiday.name + '" (' + holidayDateText(holiday.date) + ')? It will no longer be marked on the calendar or paid as a holiday.',
            confirmText: 'Remove',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            api('api/holidays/' + holiday.id, 'DELETE').then(function (data) {
                if (!data.success) { PPToast.error(data.message); return; }
                bootstrap.Modal.getOrCreateInstance(document.getElementById('holidayModal')).hide();
                holidays = data.holidays;
                renderHolidays();
                PPToast.success('"' + holiday.name + '" removed.');
                loadAudit();
            }).catch(function () { PPToast.error('Could not reach the server.'); });
        });
    });

    document.getElementById('holidayForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!PPValidate.validateForm(form)) return;
        var payload = {
            date: document.getElementById('holidayDate').value,
            name: document.getElementById('holidayName').value.trim(),
            type: document.getElementById('holidayType').value,
            doublePay: document.getElementById('holidayDoublePay').value === 'Yes'
        };
        api(holidayEditId ? 'api/holidays/' + holidayEditId : 'api/holidays', holidayEditId ? 'PUT' : 'POST', payload)
            .then(function (data) {
                if (!data.success) {
                    var fields = { date: 'holidayDate', name: 'holidayName', type: 'holidayType' };
                    if (!PPValidate.showServerError(form, data, fields)) PPToast.error(data.message);
                    return;
                }
                bootstrap.Modal.getInstance(document.getElementById('holidayModal')).hide();
                // Show the year of the saved holiday.
                var year = payload.date.slice(0, 4);
                if (!Array.prototype.some.call(holidayYear.options, function (o) { return o.value === year; })) {
                    holidayYear.add(new Option(year, year));
                }
                holidayYear.value = year;
                holidays = data.holidays;
                renderHolidays();
                PPToast.success(holidayEditId ? 'Holiday updated.' : '"' + payload.name + '" added.');
                loadAudit();
            }).catch(function () { PPToast.error('Could not reach the server.'); });
    });

    loadRates();
    loadLeaveCategories();
    loadHolidays();
    loadRanks();
    loadTables();
    loadAudit();

    if (location.hash === '#leave') {
        document.querySelector('[data-section="leave"]').click();
    } else if (location.hash === '#holidays') {
        document.querySelector('[data-section="holidays"]').click();
    } else if (location.hash === '#ranks') {
        document.querySelector('[data-section="ranks"]').click();
    } else if (location.hash === '#benefits') {
        document.querySelector('[data-section="benefits"]').click();
    } else if (location.hash === '#bir') {
        document.querySelector('[data-section="bir"]').click();
    } else if (location.hash === '#sss') {
        document.querySelector('[data-section="sss"]').click();
    }
})();
