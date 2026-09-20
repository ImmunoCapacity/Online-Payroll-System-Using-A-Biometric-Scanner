/**
 * PayrollPro Data Store
 * ---------------------------------------------------------------
 * Single source of truth for all demo/mock data in the frontend.
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

    var SEED = {

        employees: [
            { id: 'EMP-2021-014', employeeNumber: 'EMP-2021-014', displayName: 'Dr. Maria Santos', firstName: 'Maria', lastName: 'Santos', type: 'Faculty', department: 'Faculty', position: 'Instructor II', email: 'maria.santos@institution.edu', phone: '0917-111-2222', status: 'Active', dateHired: '2020-01-15', notes: 'Department head', scheduleStart: '07:30', scheduleEnd: '09:30', rateType: 'Per Unit', rate: 920, units: 18, fingerprintEnrolled: true, fingerprintEnrolledDate: '2024-08-12', fingerprintId: 'FP-EMP2021014' },
            { id: 'EMP-2022-031', employeeNumber: 'EMP-2022-031', displayName: 'Prof. James Rivera', firstName: 'James', lastName: 'Rivera', type: 'Faculty', department: 'Faculty', position: 'Instructor I', email: 'james.rivera@institution.edu', phone: '0917-555-6666', status: 'On Leave', dateHired: '2019-09-01', notes: 'On sick leave', scheduleStart: '10:00', scheduleEnd: '12:00', rateType: 'Per Unit', rate: 820, units: 21, fingerprintEnrolled: true, fingerprintEnrolledDate: '2024-09-03', fingerprintId: 'FP-EMP2022031' },
            { id: 'EMP-1002', employeeNumber: 'EMP-1002', displayName: 'Anna Cruz', firstName: 'Anna', lastName: 'Cruz', type: 'Admin', department: 'Admin', position: 'HR Officer', email: 'anna.cruz@institution.edu', phone: '0917-333-4444', status: 'Active', dateHired: '2021-06-10', notes: 'Handles HR records', scheduleStart: null, scheduleEnd: null, rateType: 'Per Hour', rate: 185, units: 88, fingerprintEnrolled: false, fingerprintEnrolledDate: null, fingerprintId: null },
            { id: 'EMP-1004', employeeNumber: 'EMP-1004', displayName: 'Elena Villanueva', firstName: 'Elena', lastName: 'Villanueva', type: 'Admin', department: 'Admin', position: 'Registrar Staff', email: 'elena.villanueva@institution.edu', phone: '0917-777-8888', status: 'Inactive', dateHired: '2018-02-20', notes: 'Retired last quarter', scheduleStart: null, scheduleEnd: null, rateType: 'Per Hour', rate: 175, units: 92, fingerprintEnrolled: true, fingerprintEnrolledDate: '2024-07-22', fingerprintId: 'FP-EMP1004' },
            { id: 'EMP-2020-052', employeeNumber: 'EMP-2020-052', displayName: 'Roberto Mendoza', firstName: 'Roberto', lastName: 'Mendoza', type: 'Faculty', department: 'Faculty', position: 'Instructor I', email: 'roberto.mendoza@institution.edu', phone: '0917-222-3333', status: 'Active', dateHired: '2023-08-01', notes: '', scheduleStart: '13:00', scheduleEnd: '15:00', rateType: 'Per Unit', rate: 780, units: 15, fingerprintEnrolled: false, fingerprintEnrolledDate: null, fingerprintId: null },
            { id: 'EMP-2024-003', employeeNumber: 'EMP-2024-003', displayName: 'Michael Tan', firstName: 'Michael', lastName: 'Tan', type: 'Faculty', department: 'Faculty', position: 'Instructor I', email: 'michael.tan@institution.edu', phone: '0917-444-5555', status: 'Active', dateHired: '2024-01-10', notes: '', scheduleStart: '08:00', scheduleEnd: '10:00', rateType: 'Per Unit', rate: 780, units: 12, fingerprintEnrolled: false, fingerprintEnrolledDate: null, fingerprintId: null },
            { id: 'EMP-2022-045', employeeNumber: 'EMP-2022-045', displayName: 'Grace Lim', firstName: 'Grace', lastName: 'Lim', type: 'Admin', department: 'Admin', position: 'Cashier', email: 'grace.lim@institution.edu', phone: '0917-666-7777', status: 'Active', dateHired: '2022-03-15', notes: '', scheduleStart: null, scheduleEnd: null, rateType: 'Per Hour', rate: 175, units: 90, fingerprintEnrolled: true, fingerprintEnrolledDate: '2025-01-15', fingerprintId: 'FP-EMP2022045' },
            { id: 'EMP-2023-019', employeeNumber: 'EMP-2023-019', displayName: 'Dr. Patricia Go', firstName: 'Patricia', lastName: 'Go', type: 'Faculty', department: 'Faculty', position: 'Instructor II', email: 'patricia.go@institution.edu', phone: '0917-888-9999', status: 'Active', dateHired: '2021-11-08', notes: '', scheduleStart: '14:00', scheduleEnd: '16:00', rateType: 'Per Unit', rate: 850, units: 20, fingerprintEnrolled: true, fingerprintEnrolledDate: '2024-11-08', fingerprintId: 'FP-EMP2023019' },
            { id: 'EMP-2023-007', employeeNumber: 'EMP-2023-007', displayName: 'Elena Villanueva (Admin)', firstName: 'Elena', lastName: 'V.', type: 'Admin', department: 'Admin', position: 'Records Officer', email: 'elenav.records@institution.edu', phone: '0917-999-0000', status: 'Active', dateHired: '2023-02-01', notes: '', scheduleStart: null, scheduleEnd: null, rateType: 'Per Hour', rate: 172, units: 80, fingerprintEnrolled: false, fingerprintEnrolledDate: null, fingerprintId: null }
        ],

        devices: [
            { id: 1, deviceName: 'Main Gate Scanner', location: 'Main Building Entrance', ipAddress: '192.168.1.50', status: 'Active', dateAdded: '2024-01-05T08:00:00' },
            { id: 2, deviceName: 'Faculty Room Scanner', location: 'Faculty Room', ipAddress: '192.168.1.51', status: 'Active', dateAdded: '2024-01-05T08:05:00' },
            { id: 3, deviceName: 'Admin Wing Scanner', location: 'Administration Wing', ipAddress: '192.168.1.52', status: 'Inactive', dateAdded: '2024-06-11T09:00:00' }
        ],

        dtr: [
            { id: 1, employeeId: 'EMP-2021-014', deviceId: 1, date: 'TODAY', timeIn: '07:42', timeOut: '17:05', status: 'present', manual: false },
            { id: 2, employeeId: 'EMP-2022-031', deviceId: 2, date: 'TODAY', timeIn: '10:22', timeOut: '18:00', status: 'late', manual: false },
            { id: 3, employeeId: 'EMP-1002', deviceId: 3, date: 'TODAY', timeIn: '08:01', timeOut: '17:30', status: 'present', manual: false },
            { id: 4, employeeId: 'EMP-2020-052', deviceId: null, date: 'TODAY', timeIn: null, timeOut: null, status: 'absent', manual: false },
            { id: 5, employeeId: 'EMP-1004', deviceId: 3, date: 'TODAY', timeIn: '08:10', timeOut: '16:45', status: 'present', manual: false },
            { id: 6, employeeId: 'EMP-2024-003', deviceId: null, date: 'TODAY', timeIn: null, timeOut: null, status: 'leave', manual: false },
            { id: 7, employeeId: 'EMP-2022-045', deviceId: 3, date: 'TODAY', timeIn: '08:18', timeOut: '17:00', status: 'late', manual: false },
            { id: 8, employeeId: 'EMP-2023-019', deviceId: 2, date: 'TODAY', timeIn: '13:55', timeOut: '17:20', status: 'present', manual: false }
        ],

        teachingSchedule: [
            { id: 1, employeeId: 'EMP-2021-014', days: ['Mon', 'Wed', 'Fri'], timeStart: '07:30', timeEnd: '09:30', subject: 'Data Structures' },
            { id: 2, employeeId: 'EMP-2022-031', days: ['Tue', 'Thu'], timeStart: '10:00', timeEnd: '12:00', subject: 'Web Development' },
            { id: 3, employeeId: 'EMP-2020-052', days: ['Mon', 'Wed'], timeStart: '13:00', timeEnd: '15:00', subject: 'Networking Fundamentals' },
            { id: 4, employeeId: 'EMP-2024-003', days: ['Tue', 'Thu', 'Fri'], timeStart: '08:00', timeEnd: '10:00', subject: 'Systems Analysis' },
            { id: 5, employeeId: 'EMP-2023-019', days: ['Mon', 'Thu'], timeStart: '14:00', timeEnd: '16:00', subject: 'Database Management' }
        ],

        leaveCategories: [
            { id: 1, name: 'Sick Leave', paid: true, maxDays: 12, active: true },
            { id: 2, name: 'Vacation Leave', paid: true, maxDays: 15, active: true },
            { id: 3, name: 'Maternity Leave', paid: true, maxDays: 105, active: true },
            { id: 4, name: 'Paternity Leave', paid: true, maxDays: 7, active: true },
            { id: 5, name: 'Leave Without Pay', paid: false, maxDays: 30, active: true }
        ],

        leaveRequests: [
            { id: 101, employeeId: 'EMP-2021-014', employee: 'Dr. Maria Santos', category: 'Vacation', dateFrom: '2026-07-14', dateTo: '2026-07-16', filedDate: '2026-07-04', status: 'Pending', reason: 'Family vacation' },
            { id: 102, employeeId: 'EMP-2022-031', employee: 'Prof. James Rivera', category: 'Sick', dateFrom: '2026-07-10', dateTo: '2026-07-11', filedDate: '2026-07-06', status: 'Pending', reason: 'Flu symptoms' },
            { id: 103, employeeId: 'EMP-1004', employee: 'Elena Villanueva', category: 'Maternity', dateFrom: '2026-08-01', dateTo: '2026-11-13', filedDate: '2026-06-20', status: 'Approved', reason: 'Maternity leave' },
            { id: 104, employeeId: 'EMP-2024-003', employee: 'Michael Tan', category: 'Paternity', dateFrom: '2026-07-20', dateTo: '2026-07-26', filedDate: '2026-07-01', status: 'Rejected', reason: 'Newborn care', remarks: 'Insufficient documentation submitted.' },
            { id: 105, employeeId: 'EMP-2020-052', employee: 'Roberto Mendoza', category: 'Vacation', dateFrom: '2026-06-05', dateTo: '2026-06-07', filedDate: '2026-05-28', status: 'Approved', reason: 'Personal travel' }
        ],

        loans: [
            {
                id: 1,
                employeeId: 'EMP-2021-014',
                employeeName: 'Dr. Maria Santos',
                employeeRole: 'Faculty Staff',
                type: 'SSS Salary Loan',
                reference: 'SSS-2026-00123',
                amount: 20000,
                deductionPerPayroll: 1000,
                startPeriod: '2026-03-11_2026-03-25',
                startPeriodLabel: 'March 11 – March 25, 2026',
                remarks: '',
                deductionHistory: [
                    { period: 'March 11 – March 25, 2026', amount: 1000, remainingBalance: 19000, dateProcessed: '2026-03-25' },
                    { period: 'March 26 – April 10, 2026', amount: 1000, remainingBalance: 18000, dateProcessed: '2026-04-10' },
                    { period: 'April 11 – April 25, 2026', amount: 1000, remainingBalance: 17000, dateProcessed: '2026-04-25' },
                    { period: 'April 26 – May 10, 2026', amount: 1000, remainingBalance: 16000, dateProcessed: '2026-05-10' },
                    { period: 'May 11 – May 25, 2026', amount: 1000, remainingBalance: 15000, dateProcessed: '2026-05-25' },
                    { period: 'May 26 – June 10, 2026', amount: 1000, remainingBalance: 14000, dateProcessed: '2026-06-10' },
                    { period: 'June 11 – June 25, 2026', amount: 1000, remainingBalance: 13000, dateProcessed: '2026-06-25' },
                    { period: 'June 26 – July 10, 2026', amount: 1000, remainingBalance: 12000, dateProcessed: '2026-07-10' },
                    { period: 'July 11 – July 25, 2026', amount: 1000, remainingBalance: 11000, dateProcessed: '2026-07-25' },
                    { period: 'July 26 – August 10, 2026', amount: 1000, remainingBalance: 10000, dateProcessed: '2026-08-10' },
                    { period: 'August 11 – August 25, 2026', amount: 1000, remainingBalance: 9000, dateProcessed: '2026-08-25' },
                    { period: 'August 26 – September 10, 2026', amount: 1000, remainingBalance: 8000, dateProcessed: '2026-09-10' }
                ]
            },
            {
                id: 2,
                employeeId: 'EMP-1004',
                employeeName: 'Elena Villanueva',
                employeeRole: 'Administrative Staff',
                type: 'Pag-IBIG MPL',
                reference: 'HDMF-2025-0456',
                amount: 15000,
                deductionPerPayroll: 750,
                startPeriod: '2025-11-11_2025-11-25',
                startPeriodLabel: 'November 11 – November 25, 2025',
                remarks: '',
                deductionHistory: [
                    { period: 'August 26 – September 10, 2026', amount: 750, remainingBalance: 750, dateProcessed: '2026-09-10' },
                    { period: 'September 11 – September 25, 2026', amount: 750, remainingBalance: 0, dateProcessed: '2026-09-25' }
                ]
            }
        ],

        rates: [
            { id: 1, empId: 'EMP-2021-014', rateType: 'Per Unit', amount: 850, effective: '2024-01-01', end: '2025-12-31', active: false },
            { id: 2, empId: 'EMP-2021-014', rateType: 'Per Unit', amount: 920, effective: '2026-01-01', end: null, active: true },
            { id: 3, empId: 'EMP-2022-031', rateType: 'Per Unit', amount: 820, effective: '2025-06-01', end: null, active: true },
            { id: 4, empId: 'EMP-2023-019', rateType: 'Per Unit', amount: 850, effective: '2025-01-01', end: null, active: true },
            { id: 5, empId: 'EMP-2020-052', rateType: 'Per Unit', amount: 780, effective: '2023-08-01', end: null, active: true }
        ],

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
            }
        },

        payslips: {
            'EMP-2021-014': {
                '2026-07-01': { periodLabel: 'July 1 – July 15, 2026', payDate: 'July 16, 2026', rateType: 'per unit', rate: 920, units: 18, unitsLabel: 'Teaching units worked', gross: 16560, deductions: { bir: 3922, philhealth: 680, pagibig: 200, loan: 0 }, benefits: { 'Chalk Allowance': 500, 'Internet Allowance': 800 } },
                '2026-06-16': { periodLabel: 'June 16 – June 30, 2026', payDate: 'July 1, 2026', rateType: 'per unit', rate: 920, units: 16, unitsLabel: 'Teaching units worked', gross: 14720, deductions: { bir: 3400, philhealth: 650, pagibig: 200, loan: 0 }, benefits: { 'Chalk Allowance': 500, 'Internet Allowance': 800 } },
                '2026-06-01': { periodLabel: 'June 1 – June 15, 2026', payDate: 'June 16, 2026', rateType: 'per unit', rate: 920, units: 20, unitsLabel: 'Teaching units worked', gross: 18400, deductions: { bir: 4600, philhealth: 700, pagibig: 200, loan: 0 }, benefits: { 'Chalk Allowance': 500, 'Internet Allowance': 800 } }
            }
        },

        thirteenthMonth: [
            { employeeId: 'EMP-2021-014', employee: 'Dr. Maria Santos', annualGross: 198720, amount: 16560, year: 2026 }
        ],

        users: [
            { id: 1, firstName: 'System', lastName: 'Administrator', username: 'sysadmin', role: 'System Administrator', email: 'admin@institution.edu', contactNumber: '0917-000-0002', active: true },
            { id: 2, firstName: 'Maria Elena', lastName: 'Reyes', username: 'mreyes.master', role: 'Payroll Master', email: 'payroll.master@institution.edu', contactNumber: '0917-000-0001', active: true },
            { id: 3, firstName: 'Carlo', lastName: 'Santiago', username: 'csantiago.staff', role: 'Payroll Staff', email: 'payroll.staff@institution.edu', contactNumber: '0917-000-0003', active: true }
        ],

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

    function ensureSeeded() {
        if (read('seeded', false)) {
            resolveTodayPlaceholders();
            // Backfill any collection added in a later update (existing
            // browsers won't have it since the full seed only runs once).
            if (read('teachingSchedule', null) === null) {
                write('teachingSchedule', SEED.teachingSchedule);
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
        getTaxBrackets: function () { return read('taxBrackets', { bir: {}, philhealth: {}, pagibig: {} }); },
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
