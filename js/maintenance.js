(function () {
    PayrollProLayout.init({
        activeNav: 'maintenance',
        user: { name: 'Maria Elena Reyes', role: 'Payroll Master', initials: 'MR' },
        institution: { name: 'STI Balayan', short: 'STI' },
        notifications: false
    });

    var CURRENT_USER = 'Maria Elena Reyes';
    var auditLog = [];

    function logAudit(section, action, detail) {
        var entry = {
            section: section,
            action: action,
            detail: detail,
            user: CURRENT_USER,
            at: new Date().toISOString()
        };
        auditLog.unshift(entry);
        return entry;
    }

    function formatAudit(entry) {
        if (!entry) return 'No changes recorded yet in this session.';
        var d = new Date(entry.at);
        var ts = d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
        return 'Last change: <strong>' + entry.action + '</strong> — ' + entry.detail + ' · by ' + entry.user + ' · ' + ts;
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

    function dayBefore(iso) {
        var d = new Date(iso + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10);
    }

    function rowActions(canDeactivate) {
        var deactivate = canDeactivate !== false
            ? '<button type="button" class="pp-btn-row deactivate" data-action="deactivate">Deactivate</button>'
            : '';
        return (
            '<span class="pp-maint-row-actions">' +
                '<button type="button" class="pp-btn-row" data-action="edit">Edit</button>' +
                deactivate +
            '</span>'
        );
    }

    var sectionMap = {
        rates: 'sectionRates',
        leave: 'sectionLeave',
        bir: 'sectionBir',
        philhealth: 'sectionPhilhealth',
        pagibig: 'sectionPagibig'
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

    var EMPLOYEES = [
        { id: 'EMP-2021-014', name: 'Dr. Maria Santos' },
        { id: 'EMP-2022-031', name: 'Juan Dela Cruz' },
        { id: 'EMP-2023-007', name: 'Elena Villanueva' },
        { id: 'EMP-2020-052', name: 'Michael Tan' },
        { id: 'EMP-2021-089', name: 'Ana Reyes' }
    ];

    var rates = [
        { id: 1, empId: 'EMP-2021-014', rateType: 'Per Unit', amount: 850, effective: '2024-01-01', end: '2025-12-31', active: false },
        { id: 2, empId: 'EMP-2021-014', rateType: 'Per Unit', amount: 920, effective: '2026-01-01', end: null, active: true },
        { id: 3, empId: 'EMP-2022-031', rateType: 'Per Hour', amount: 185.50, effective: '2025-06-01', end: null, active: true },
        { id: 4, empId: 'EMP-2023-007', rateType: 'Per Hour', amount: 172.00, effective: '2025-01-01', end: null, active: true },
        { id: 5, empId: 'EMP-2020-052', rateType: 'Per Unit', amount: 780, effective: '2023-08-01', end: null, active: true }
    ];
    var nextRateId = 6;
    var ratesAuditEntry = null;

    function empName(empId) {
        var e = EMPLOYEES.find(function (x) { return x.id === empId; });
        return e ? e.name : empId;
    }

    function renderRates() {
        var sorted = rates.slice().sort(function (a, b) {
            var na = empName(a.empId);
            var nb = empName(b.empId);
            if (na !== nb) return na.localeCompare(nb);
            return b.effective.localeCompare(a.effective);
        });
        document.getElementById('ratesBody').innerHTML = sorted.map(function (r) {
            return (
                '<tr class="' + (r.active ? '' : 'inactive') + '">' +
                    '<td><strong>' + empName(r.empId) + '</strong></td>' +
                    '<td>' + r.rateType + '</td>' +
                    '<td class="col-money">' + peso(r.amount) + '</td>' +
                    '<td>' + formatDate(r.effective) + '</td>' +
                    '<td>' + (r.end ? formatDate(r.end) : '—') + '</td>' +
                    '<td>' + (r.active ? '<span class="pp-badge-active">Active</span>' : '<span class="pp-badge-inactive">Historical</span>') + '</td>' +
                    '<td class="col-actions">' + (r.active ? rowActions() : '<span class="text-muted small">—</span>') + '</td>' +
                '</tr>'
            );
        }).join('');
        document.getElementById('ratesAudit').innerHTML = formatAudit(ratesAuditEntry);
    }

    function populateRateEmployees() {
        document.getElementById('rateEmployee').innerHTML = EMPLOYEES.map(function (e) {
            return '<option value="' + e.id + '">' + e.name + '</option>';
        }).join('');
    }

    document.getElementById('btnAddRate').addEventListener('click', function () {
        document.getElementById('rateModalTitle').textContent = 'Add New Rate';
        document.getElementById('rateForm').reset();
        document.getElementById('rateForm').classList.remove('was-validated');
        populateRateEmployees();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('rateModal')).show();
    });

    document.getElementById('rateForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        var empId = document.getElementById('rateEmployee').value;
        var effective = document.getElementById('rateEffective').value;
        var prevEnd = dayBefore(effective);

        rates.forEach(function (r) {
            if (r.empId === empId && r.active) {
                r.active = false;
                r.end = prevEnd;
            }
        });

        rates.push({
            id: nextRateId++,
            empId: empId,
            rateType: document.getElementById('rateType').value,
            amount: parseFloat(document.getElementById('rateAmount').value),
            effective: effective,
            end: null,
            active: true
        });

        ratesAuditEntry = logAudit('Employee Rates', 'Added rate', empName(empId) + ' · ' + peso(parseFloat(document.getElementById('rateAmount').value)) + ' effective ' + formatDate(effective));
        bootstrap.Modal.getInstance(document.getElementById('rateModal')).hide();
        renderRates();
    });

    var leaveCategories = [
        { id: 1, name: 'Sick Leave', paid: true, maxDays: 12, active: true },
        { id: 2, name: 'Vacation Leave', paid: true, maxDays: 15, active: true },
        { id: 3, name: 'Maternity Leave', paid: true, maxDays: 105, active: true },
        { id: 4, name: 'Paternity Leave', paid: true, maxDays: 7, active: true },
        { id: 5, name: 'Leave Without Pay', paid: false, maxDays: 30, active: true }
    ];
    var nextLeaveId = 6;
    var leaveEditId = null;
    var leaveAuditEntry = null;

    function renderLeave() {
        document.getElementById('leaveBody').innerHTML = leaveCategories.map(function (c) {
            return (
                '<tr class="' + (c.active ? '' : 'inactive') + '" data-id="' + c.id + '">' +
                    '<td><strong>' + c.name + '</strong></td>' +
                    '<td>' + (c.paid ? '<span class="pp-badge-leave-paid">Paid</span>' : '<span class="pp-badge-leave-unpaid">Unpaid</span>') + '</td>' +
                    '<td class="col-num">' + c.maxDays + '</td>' +
                    '<td>' + (c.active ? '<span class="pp-badge-active">Active</span>' : '<span class="pp-badge-inactive">Inactive</span>') + '</td>' +
                    '<td class="col-actions">' + (c.active ? rowActions() : '<span class="text-muted small">—</span>') + '</td>' +
                '</tr>'
            );
        }).join('');
        document.getElementById('leaveAudit').innerHTML = formatAudit(leaveAuditEntry);

        document.getElementById('leaveBody').querySelectorAll('[data-action="edit"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('tr');
                var cat = leaveCategories.find(function (c) { return c.id === parseInt(row.dataset.id, 10); });
                if (!cat) return;
                leaveEditId = cat.id;
                document.getElementById('leaveModalTitle').textContent = 'Edit Leave Category';
                document.getElementById('leaveName').value = cat.name;
                document.getElementById('leavePaid').value = cat.paid ? 'Paid' : 'Unpaid';
                document.getElementById('leaveMaxDays').value = cat.maxDays;
                document.getElementById('leaveForm').classList.remove('was-validated');
                bootstrap.Modal.getOrCreateInstance(document.getElementById('leaveModal')).show();
            });
        });

        document.getElementById('leaveBody').querySelectorAll('[data-action="deactivate"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var row = btn.closest('tr');
                var cat = leaveCategories.find(function (c) { return c.id === parseInt(row.dataset.id, 10); });
                if (!cat || !confirm('Deactivate "' + cat.name + '"? Employees will no longer be able to file this leave type.')) return;
                cat.active = false;
                leaveAuditEntry = logAudit('Leave Categories', 'Deactivated', cat.name);
                renderLeave();
            });
        });
    }

    document.getElementById('btnAddLeave').addEventListener('click', function () {
        leaveEditId = null;
        document.getElementById('leaveModalTitle').textContent = 'Add Leave Category';
        document.getElementById('leaveForm').reset();
        document.getElementById('leaveForm').classList.remove('was-validated');
        bootstrap.Modal.getOrCreateInstance(document.getElementById('leaveModal')).show();
    });

    document.getElementById('leaveForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        var data = {
            name: document.getElementById('leaveName').value.trim(),
            paid: document.getElementById('leavePaid').value === 'Paid',
            maxDays: parseInt(document.getElementById('leaveMaxDays').value, 10),
            active: true
        };
        if (leaveEditId) {
            var cat = leaveCategories.find(function (c) { return c.id === leaveEditId; });
            Object.assign(cat, data);
            leaveAuditEntry = logAudit('Leave Categories', 'Updated', data.name);
        } else {
            leaveCategories.push(Object.assign({ id: nextLeaveId++ }, data));
            leaveAuditEntry = logAudit('Leave Categories', 'Added', data.name);
        }
        bootstrap.Modal.getInstance(document.getElementById('leaveModal')).hide();
        renderLeave();
    });

    function makeBracketStore(seed) {
        var store = JSON.parse(JSON.stringify(seed));
        var audits = {};
        Object.keys(store).forEach(function (y) { audits[y] = null; });
        return { data: store, audits: audits, nextId: 100 };
    }

    var birStore = makeBracketStore({
        2025: [
            { id: 1, min: 0, max: 20833, base: 0, rate: 0 },
            { id: 2, min: 20833.01, max: 33333, base: 0, rate: 15 },
            { id: 3, min: 33333.01, max: 66667, base: 1875, rate: 20 },
            { id: 4, min: 66667.01, max: 166667, base: 8541.80, rate: 25 },
            { id: 5, min: 166667.01, max: 666667, base: 33541.80, rate: 30 },
            { id: 6, min: 666667.01, max: null, base: 183541.80, rate: 35 }
        ],
        2026: [
            { id: 11, min: 0, max: 20833, base: 0, rate: 0 },
            { id: 12, min: 20833.01, max: 33333, base: 0, rate: 15 },
            { id: 13, min: 33333.01, max: 66667, base: 1875, rate: 20 },
            { id: 14, min: 66667.01, max: 166667, base: 8541.80, rate: 25 },
            { id: 15, min: 166667.01, max: 666667, base: 33541.80, rate: 30 },
            { id: 16, min: 666667.01, max: null, base: 183541.80, rate: 35 }
        ]
    });

    var phStore = makeBracketStore({
        2025: [
            { id: 21, min: 0, max: 10000, premium: 500, rate: 5.0 },
            { id: 22, min: 10000.01, max: 80000, premium: null, rate: 5.0 },
            { id: 23, min: 80000.01, max: null, premium: 5000, rate: 5.0 }
        ],
        2026: [
            { id: 31, min: 0, max: 10000, premium: 500, rate: 5.0 },
            { id: 32, min: 10000.01, max: 89999.99, premium: null, rate: 5.0 },
            { id: 33, min: 90000, max: null, premium: 5000, rate: 5.0 }
        ]
    });

    var pagStore = makeBracketStore({
        2025: [
            { id: 41, min: 0, max: 1500, share: 0, rate: 0 },
            { id: 42, min: 1500.01, max: 10000, share: null, rate: 2.0 },
            { id: 43, min: 10000.01, max: null, share: 200, rate: 2.0 }
        ],
        2026: [
            { id: 51, min: 0, max: 1500, share: 0, rate: 0 },
            { id: 52, min: 1500.01, max: 10000, share: null, rate: 2.0 },
            { id: 53, min: 10000.01, max: null, share: 200, rate: 2.0 }
        ]
    });

    var bracketConfigs = {
        bir: {
            store: birStore,
            yearSelect: 'birYear',
            body: 'birBody',
            audit: 'birAudit',
            label: 'BIR Table',
            addBtn: 'btnAddBir',
            fields: [
                { id: 'min', label: 'Bracket Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Bracket Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'base', label: 'Base Amount (₱)', type: 'number', key: 'base' },
                { id: 'rate', label: 'Rate (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr data-id="' + b.id + '">' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + peso(b.base) + '</td>' +
                        '<td class="col-num">' + b.rate + '%</td>' +
                        '<td class="col-actions">' + rowActions(true) + '</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Bracket ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', base ' + peso(b.base) + ', rate ' + b.rate + '%';
            }
        },
        philhealth: {
            store: phStore,
            yearSelect: 'phYear',
            body: 'phBody',
            audit: 'phAudit',
            label: 'PhilHealth Table',
            addBtn: 'btnAddPh',
            fields: [
                { id: 'min', label: 'Salary Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Salary Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'premium', label: 'Monthly Premium (₱)', type: 'number', key: 'premium', optional: true },
                { id: 'rate', label: 'Rate (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr data-id="' + b.id + '">' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + (b.premium != null ? peso(b.premium) : '—') + '</td>' +
                        '<td class="col-num">' + b.rate + '%</td>' +
                        '<td class="col-actions">' + rowActions(true) + '</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Salary ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', premium ' + (b.premium != null ? peso(b.premium) : 'computed') + ', rate ' + b.rate + '%';
            }
        },
        pagibig: {
            store: pagStore,
            yearSelect: 'pagYear',
            body: 'pagBody',
            audit: 'pagAudit',
            label: 'Pag-IBIG Table',
            addBtn: 'btnAddPag',
            fields: [
                { id: 'min', label: 'Compensation Min (₱)', type: 'number', key: 'min' },
                { id: 'max', label: 'Compensation Max (₱)', type: 'number', key: 'max', optional: true },
                { id: 'share', label: 'Employee Share (₱)', type: 'number', key: 'share', optional: true },
                { id: 'rate', label: 'Rate (%)', type: 'number', key: 'rate', step: '0.01' }
            ],
            renderRow: function (b) {
                return (
                    '<tr data-id="' + b.id + '">' +
                        '<td class="col-money">' + peso(b.min) + '</td>' +
                        '<td class="col-money">' + (b.max != null ? peso(b.max) : 'Above') + '</td>' +
                        '<td class="col-money">' + (b.share != null ? peso(b.share) : '—') + '</td>' +
                        '<td class="col-num">' + b.rate + '%</td>' +
                        '<td class="col-actions">' + rowActions(true) + '</td>' +
                    '</tr>'
                );
            },
            summary: function (b) {
                return 'Compensation ' + peso(b.min) + ' – ' + (b.max != null ? peso(b.max) : 'Above') + ', share ' + (b.share != null ? peso(b.share) : 'computed') + ', rate ' + b.rate + '%';
            }
        }
    };

    var pendingBracketSave = null;
    var bracketModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('bracketModal'));
    var highStakesModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('highStakesModal'));

    function populateYearSelect(selectId, store) {
        var years = Object.keys(store.data).sort(function (a, b) { return b - a; });
        document.getElementById(selectId).innerHTML = years.map(function (y) {
            return '<option value="' + y + '">' + y + '</option>';
        }).join('');
    }

    function getYearBrackets(config) {
        var year = document.getElementById(config.yearSelect).value;
        if (!config.store.data[year]) config.store.data[year] = [];
        return config.store.data[year];
    }

    function renderBracketTable(configKey) {
        var config = bracketConfigs[configKey];
        var brackets = getYearBrackets(config).slice().sort(function (a, b) { return a.min - b.min; });
        document.getElementById(config.body).innerHTML = brackets.map(function (b) {
            return config.renderRow(b);
        }).join('');

        var year = document.getElementById(config.yearSelect).value;
        document.getElementById(config.audit).innerHTML = formatAudit(config.store.audits[year]);

        document.getElementById(config.body).querySelectorAll('[data-action="edit"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openBracketForm(configKey, parseInt(btn.closest('tr').dataset.id, 10), false);
            });
        });

        document.getElementById(config.body).querySelectorAll('[data-action="deactivate"]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = parseInt(btn.closest('tr').dataset.id, 10);
                var brackets = getYearBrackets(config);
                var idx = brackets.findIndex(function (b) { return b.id === id; });
                if (idx < 0) return;
                if (!confirm('Remove this bracket row? Ensure remaining brackets still cover all salary ranges.')) return;
                var removed = brackets.splice(idx, 1)[0];
                var year = document.getElementById(config.yearSelect).value;
                config.store.audits[year] = logAudit(config.label, 'Removed bracket', config.summary(removed) + ' (' + year + ')');
                renderBracketTable(configKey);
            });
        });
    }

    function buildBracketFormFields(config, values) {
        return config.fields.map(function (f) {
            var val = values && values[f.key] != null ? values[f.key] : '';
            var req = f.optional ? '' : 'required';
            var hint = f.optional ? ' <span class="text-muted fw-normal">(leave blank for open-ended)</span>' : '';
            return (
                '<div class="mb-3">' +
                    '<label for="bf_' + f.key + '" class="pp-form-label">' + f.label + hint + '</label>' +
                    '<input type="' + f.type + '" class="form-control pp-form-control" id="bf_' + f.key + '" ' +
                        'step="' + (f.step || '0.01') + '" min="0" value="' + val + '" ' + req + '>' +
                    (f.optional ? '' : '<div class="invalid-feedback">Required.</div>') +
                '</div>'
            );
        }).join('');
    }

    function openBracketForm(configKey, id, isNew) {
        var config = bracketConfigs[configKey];
        var year = document.getElementById(config.yearSelect).value;
        var existing = null;
        if (!isNew) {
            existing = getYearBrackets(config).find(function (b) { return b.id === id; });
        }
        document.getElementById('bracketModalTitle').textContent = (isNew ? 'Add Bracket' : 'Edit Bracket') + ' — ' + year;
        document.getElementById('bracketFormFields').innerHTML = buildBracketFormFields(config, existing);
        document.getElementById('bracketForm').dataset.config = configKey;
        document.getElementById('bracketForm').dataset.id = isNew ? '' : id;
        document.getElementById('bracketForm').dataset.isNew = isNew ? '1' : '0';
        document.getElementById('bracketForm').classList.remove('was-validated');
        bracketModal.show();
    }

    document.getElementById('bracketForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
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
        pendingBracketSave = {
            configKey: configKey,
            year: year,
            isNew: isNew,
            id: form.dataset.id ? parseInt(form.dataset.id, 10) : null,
            record: record
        };

        document.getElementById('highStakesSummary').innerHTML =
            '<strong>' + config.label + ' · Year ' + year + '</strong><br>' + config.summary(record);

        bracketModal.hide();
        highStakesModal.show();
    });

    document.getElementById('btnHighStakesConfirm').addEventListener('click', function () {
        if (!pendingBracketSave) return;
        var configKey = pendingBracketSave.configKey;
        var config = bracketConfigs[configKey];
        var brackets = config.store.data[pendingBracketSave.year];
        var record = pendingBracketSave.record;

        if (pendingBracketSave.isNew) {
            record.id = config.store.nextId++;
            brackets.push(record);
        } else {
            var existing = brackets.find(function (b) { return b.id === pendingBracketSave.id; });
            Object.assign(existing, record);
        }

        config.store.audits[pendingBracketSave.year] = logAudit(
            config.label,
            pendingBracketSave.isNew ? 'Added bracket' : 'Updated bracket',
            config.summary(record) + ' (' + pendingBracketSave.year + ')'
        );

        pendingBracketSave = null;
        highStakesModal.hide();
        renderBracketTable(configKey);
    });

    Object.keys(bracketConfigs).forEach(function (key) {
        var config = bracketConfigs[key];
        populateYearSelect(config.yearSelect, config.store);
        document.getElementById(config.yearSelect).addEventListener('change', function () {
            renderBracketTable(key);
        });
        document.getElementById(config.addBtn).addEventListener('click', function () {
            openBracketForm(key, null, true);
        });
        renderBracketTable(key);
    });

    populateRateEmployees();
    renderRates();
    renderLeave();

    if (location.hash === '#leave') {
        document.querySelector('[data-section="leave"]').click();
    } else if (location.hash === '#bir') {
        document.querySelector('[data-section="bir"]').click();
    }
})();
