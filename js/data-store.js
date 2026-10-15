/**
 * Clean-up of the old browser data store.
 * ---------------------------------------------------------------
 * Every module now keeps its data in the database (through the api/
 * endpoints). Earlier versions of the system kept some collections
 * (payroll runs, deduction tables, rates, devices, ...) in this browser's
 * localStorage under "ppData:" keys. Those copies are no longer read, so
 * they are removed once here to avoid confusion.
 * ---------------------------------------------------------------
 */
(function () {
    'use strict';
    try {
        var stale = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('ppData:') === 0) stale.push(key);
        }
        stale.forEach(function (key) { localStorage.removeItem(key); });
    } catch (e) {
        // Storage unavailable (private mode, blocked): nothing to clean.
    }
})();
