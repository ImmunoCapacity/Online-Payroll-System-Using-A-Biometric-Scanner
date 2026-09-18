/**
 * PayrollPro Toast
 * Small, self-injecting success/error toast used after actions like
 * saving, approving, rejecting, or deleting something — so the user
 * gets explicit confirmation instead of the UI just silently updating.
 *
 *   PPToast.success('Employee saved.');
 *   PPToast.error('Could not save changes.');
 */
(function (global) {
    'use strict';

    var CONTAINER_ID = 'ppToastContainer';

    function ensureContainer() {
        var container = document.getElementById(CONTAINER_ID);
        if (container) return container;

        container = document.createElement('div');
        container.id = CONTAINER_ID;
        container.className = 'pp-toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
        return container;
    }

    function show(message, type) {
        var container = ensureContainer();

        var toast = document.createElement('div');
        toast.className = 'pp-toast pp-toast-' + (type || 'success');
        toast.setAttribute('role', 'status');

        var icon = type === 'error' ? 'bi-x-circle-fill' : 'bi-check-circle-fill';
        toast.innerHTML =
            '<i class="bi ' + icon + '"></i>' +
            '<span class="pp-toast-message"></span>' +
            '<button type="button" class="pp-toast-close" aria-label="Dismiss">&times;</button>';
        toast.querySelector('.pp-toast-message').textContent = message;

        container.appendChild(toast);

        // Trigger enter transition on next frame
        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        function remove() {
            toast.classList.remove('show');
            setTimeout(function () {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 200);
        }

        toast.querySelector('.pp-toast-close').addEventListener('click', remove);
        setTimeout(remove, 4000);
    }

    global.PPToast = {
        success: function (message) { show(message, 'success'); },
        error: function (message) { show(message, 'error'); }
    };

})(window);
