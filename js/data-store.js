/**
 * PayrollPro Data Store
 * ---------------------------------------------------------------
 * Browser-side store for the modules not yet connected to the database
 * (leave, loans, maintenance rates and categories, deduction tables, ...).
 * Everything is persisted to localStorage so that changes made on
 * one page (e.g. adding an employee) are reflected everywhere else
 * (DTR, payroll, fingerprint registration, maintenance, etc.)
 * instead of every page keeping its own separate hardcoded array.
 *
 * This is still a frontend-only mock — there is no backend here.
 * It simply replaces "scattered hardcoded arrays" with "one shared,
 * consistent, persisted set of collections" so the app behaves like
 * a real system while a real API is being built.
 * ---------------------------------------------------------------
 */
(function (global) {
    'use strict';

    var PREFIX = 'ppData:';

    function read(key, fallback) {
        try {
            var raw = localStorage.getItem(PREFIX + key);
            if (raw === null || raw === undefined) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[DataStore] failed to read "' + key + '"', e);
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('[DataStore] failed to write "' + key + '"', e);
            return false;
        }
    }

    // ================================================================
    // SEED DATA — used only the very first time the app runs on a
    // browser. After that, everything lives in localStorage and
    // survives reloads/navigation between pages.
    // ================================================================

    // SSS contribution schedule (effective 2025): Monthly Salary Credit (MSC)
    // from ₱5,000 to ₱35,000 in ₱500 steps; employee share is 5% of the MSC.
    function buildSssBrackets(firstId) {
        var rows = [{ id: firstId, min: 0, max: 5249.99, msc: 5000, rate: 5 }];
        for (var msc = 5500; msc <= 34500; msc += 500) {
            rows.push({ id: firstId + rows.length, min: msc - 250, max: msc + 249.99, msc: msc, rate: 5 });
        }
        rows.push({ id: firstId + rows.length, min: 34750, max: null, msc: 35000, rate: 5 });
        return rows;
    }

    var SEED = {

        // No sample people: employees, attendance, leave, loans, rates and
        // payslips start empty. Only reference tables are seeded.
        employees: [],

        devices: [],

        dtr: [],

        teachingSchedule: [],

        leaveCategories: [
            { id: 1, name: 'Sick Leave', paid: true, maxDays: 12, active: true },
            { id: 2, name: 'Vacation Leave', paid: true, maxDays: 15, active: true },
            { id: 3, name: 'Maternity Leave', paid: true, maxDays: 105, active: true },
            { id: 4, name: 'Paternity Leave', paid: true, maxDays: 7, active: true },
            { id: 5, name: 'Leave Without Pay', paid: false, maxDays: 30, active: true }
        ],

        leaveRequests: [],

        loans: [],

        rates: [],

        taxBrackets: {
            bir: {
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
            },
            philhealth: {
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
            },
            pagibig: {
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
            },
            sss: {
                2025: buildSssBrackets(101),
                2026: buildSssBrackets(201)
            }
        },

        payslips: {},

        thirteenthMonth: [],

        users: [],

        auditLog: []
    };

    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    function resolveTodayPlaceholders() {
        // The seed DTR rows use the literal string 'TODAY' so the demo
        // always shows "today's" attendance no matter when it's opened.
        var dtr = read('dtr', null);
        if (dtr) {
            var changed = false;
            dtr.forEach(function (r) {
                if (r.date === 'TODAY') { r.date = todayISO(); changed = true; }
            });
            if (changed) write('dtr', dtr);
        }
    }

    // The sample people the first version of this file seeded (Dr. Maria
    // Santos, Prof. James Rivera, ...). Browsers that ran that version still
    // hold them in localStorage; removeDemoRecords() deletes them once,
    // leaving anything the user entered.
    var DEMO_EMPLOYEE_IDS = [
        'EMP-2021-014', 'EMP-2022-031', 'EMP-1002', 'EMP-1004', 'EMP-2020-052',
        'EMP-2024-003', 'EMP-2022-045', 'EMP-2023-019', 'EMP-2023-007'
    ];
    var DEMO_DEVICE_NAMES = ['Main Gate Scanner', 'Faculty Room Scanner', 'Admin Wing Scanner'];

    function isDemoEmployee(id) {
        return DEMO_EMPLOYEE_IDS.indexOf(id) !== -1;
    }

    function removeDemoRecords() {
        if (read('demoRemoved', false)) return;

        function keep(key, idField) {
            var list = read(key, null);
            if (Array.isArray(list)) {
                write(key, list.filter(function (item) { return !isDemoEmployee(item[idField]); }));
            }
        }
        keep('employees', 'id');
        keep('dtr', 'employeeId');
        keep('teachingSchedule', 'employeeId');
        keep('leaveRequests', 'employeeId');
        keep('loans', 'employeeId');
        keep('rates', 'empId');
        keep('thirteenthMonth', 'employeeId');

        var payslips = read('payslips', null);
        if (payslips && typeof payslips === 'object') {
            DEMO_EMPLOYEE_IDS.forEach(function (id) { delete payslips[id]; });
            write('payslips', payslips);
        }

        var devices = read('devices', null);
        if (Array.isArray(devices)) {
            write('devices', devices.filter(function (d) { return DEMO_DEVICE_NAMES.indexOf(d.deviceName) === -1; }));
        }

        var users = read('users', null);
        if (Array.isArray(users)) {
            write('users', users.filter(function (u) { return !/@institution\.edu$/i.test(u.email || ''); }));
        }

        write('demoRemoved', true);
    }

    function ensureSeeded() {
        if (read('seeded', false)) {
            removeDemoRecords();
            resolveTodayPlaceholders();
            // Backfill any collection added in a later update (existing
            // browsers won't have it since the full seed only runs once).
            if (read('teachingSchedule', null) === null) {
                write('teachingSchedule', SEED.teachingSchedule);
            }
            var brackets = read('taxBrackets', null);
            if (brackets && !brackets.sss) {
                brackets.sss = SEED.taxBrackets.sss;
                write('taxBrackets', brackets);
            }
            return;
        }
        Object.keys(SEED).forEach(function (key) {
            var value = SEED[key];
            if (key === 'dtr') {
                value = JSON.parse(JSON.stringify(value)).map(function (r) {
                    if (r.date === 'TODAY') r.date = todayISO();
                    return r;
                });
            }
            write(key, value);
        });
        write('seeded', true);
        write('demoRemoved', true);   // a fresh seed has no demo records
    }

    function nextNumericId(list, field) {
        field = field || 'id';
        var max = 0;
        (list || []).forEach(function (item) {
            var v = parseInt(item[field], 10);
            if (!isNaN(v) && v > max) max = v;
        });
        return max + 1;
    }

    // ================================================================
    // PUBLIC API
    // ================================================================
    var DataStore = {

        init: function () { ensureSeeded(); },

        // Generic collection access (used for less common collections)
        get: function (key, fallback) { return read(key, fallback); },
        set: function (key, value) { return write(key, value); },

        nextNumericId: nextNumericId,

        // ---- Employees ----
        getEmployees: function () { return read('employees', []); },
        saveEmployees: function (list) { return write('employees', list); },
        getEmployeeById: function (id) {
            return this.getEmployees().find(function (e) { return e.id === id; }) || null;
        },
        isEmployeeNumberTaken: function (employeeNumber, excludeId) {
            return this.getEmployees().some(function (e) {
                return e.employeeNumber.toLowerCase() === String(employeeNumber).toLowerCase() && e.id !== excludeId;
            });
        },

        // ---- Devices ----
        getDevices: function () { return read('devices', []); },
        saveDevices: function (list) { return write('devices', list); },

        // ---- DTR ----
        getDTR: function () { return read('dtr', []); },
        saveDTR: function (list) { return write('dtr', list); },

        // ---- Faculty teaching schedule ----
        getTeachingSchedule: function () { return read('teachingSchedule', []); },
        saveTeachingSchedule: function (list) { return write('teachingSchedule', list); },

        // ---- Leave categories & requests ----
        getLeaveCategories: function () { return read('leaveCategories', []); },
        saveLeaveCategories: function (list) { return write('leaveCategories', list); },
        getLeaveRequests: function () { return read('leaveRequests', []); },
        saveLeaveRequests: function (list) { return write('leaveRequests', list); },

        // ---- Loans ----
        getLoans: function () { return read('loans', []); },
        saveLoans: function (list) { return write('loans', list); },
        getLoanTotalDeducted: function (loan) {
            return (loan.deductionHistory || []).reduce(function (total, item) {
                return total + Number(item.amount || 0);
            }, 0);
        },
        getLoanRemainingBalance: function (loan) {
            return Math.max(0, Number(loan.amount || 0) - DataStore.getLoanTotalDeducted(loan));
        },
        getLoanStatus: function (loan) {
            return DataStore.getLoanRemainingBalance(loan) <= 0 ? 'Paid' : 'Active';
        },

        // ---- Rates ----
        getRates: function () { return read('rates', []); },
        saveRates: function (list) { return write('rates', list); },

        // ---- Tax brackets ----
        getTaxBrackets: function () { return read('taxBrackets', { bir: {}, philhealth: {}, pagibig: {}, sss: {} }); },
        saveTaxBrackets: function (value) { return write('taxBrackets', value); },

        // ---- Payslips / 13th month ----
        getPayslips: function () { return read('payslips', {}); },
        savePayslips: function (value) { return write('payslips', value); },
        getThirteenthMonth: function () { return read('thirteenthMonth', []); },
        saveThirteenthMonth: function (list) { return write('thirteenthMonth', list); },

        // ---- System users (User Management) ----
        getUsers: function () { return read('users', []); },
        saveUsers: function (list) { return write('users', list); },

        // ---- Audit log (Maintenance changes) ----
        getAuditLog: function () { return read('auditLog', []); },
        saveAuditLog: function (list) { return write('auditLog', list); },
        logAudit: function (section, action, detail, actor) {
            var log = this.getAuditLog();
            var entry = { section: section, action: action, detail: detail, user: actor || 'System', at: new Date().toISOString() };
            log.unshift(entry);
            this.saveAuditLog(log.slice(0, 200));
            return entry;
        },

        // Dev utility — wipe everything back to the seed data.
        resetDemoData: function () {
            write('seeded', false);
            ensureSeeded();
        }
    };

    DataStore.init();

    global.DataStore = DataStore;

})(window);
