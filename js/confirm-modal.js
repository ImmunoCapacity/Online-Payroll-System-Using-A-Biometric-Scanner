/**
 * PayrollPro Confirm Modal
 * ---------------------------------------------------------------
 * Replaces native confirm() dialogs with a proper Bootstrap modal
 * that matches the rest of the design system. Injects its own
 * markup once, then exposes a promise-based API:
 *
 *   ConfirmModal.show({
 *       title: 'Delete employee?',
 *       message: 'This cannot be undone.',
 *       confirmText: 'Delete',
 *       tone: 'danger' // 'danger' | 'primary'
 *   }).then(function (confirmed) {
 *       if (confirmed) { ... }
 *   });
 * ---------------------------------------------------------------
 */
(function (global) {
    'use strict';

    var MODAL_ID = 'ppConfirmModal';
    var modalEl = null;
    var bsModal = null;
    var pendingResolve = null;

    function ensureMarkup() {
        if (document.getElementById(MODAL_ID)) return;

        var wrapper = document.createElement('div');
        wrapper.innerHTML =
            '<div class="modal fade pp-modal pp-modal-highstakes" id="' + MODAL_ID + '" tabindex="-1" aria-hidden="true">' +
                '<div class="modal-dialog modal-dialog-centered">' +
                    '<div class="modal-content">' +
                        '<div class="modal-header">' +
                            '<h2 class="modal-title"><i class="bi bi-exclamation-triangle-fill me-2" id="ppConfirmModalIcon"></i><span id="ppConfirmModalTitle">Are you sure?</span></h2>' +
                            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                        '</div>' +
                        '<div class="modal-body">' +
                            '<div class="pp-highstakes-alert d-flex gap-2 align-items-start">' +
                                '<i class="bi bi-exclamation-triangle-fill flex-shrink-0 mt-1"></i>' +
                                '<div id="ppConfirmModalMessage"></div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="modal-footer">' +
                            '<button type="button" class="btn btn-pp-outline" data-bs-dismiss="modal" id="ppConfirmModalCancel">Cancel</button>' +
                            '<button type="button" class="btn" id="ppConfirmModalOk">Confirm</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(wrapper.firstChild);

        modalEl = document.getElementById(MODAL_ID);
        bsModal = new bootstrap.Modal(modalEl);

        document.getElementById('ppConfirmModalOk').addEventListener('click', function () {
            bsModal.hide();
            if (pendingResolve) { pendingResolve(true); pendingResolve = null; }
        });

        modalEl.addEventListener('hidden.bs.modal', function () {
            if (pendingResolve) { pendingResolve(false); pendingResolve = null; }
        });
    }

    function show(options) {
        options = options || {};
        ensureMarkup();

        var isDanger = options.tone === 'danger';

        document.getElementById('ppConfirmModalTitle').textContent = options.title || 'Are you sure?';
        document.getElementById('ppConfirmModalMessage').textContent = options.message || 'This action cannot be undone.';

        var alertBox = modalEl.querySelector('.pp-highstakes-alert');
        alertBox.classList.toggle('pp-alert-danger', isDanger);

        var okBtn = document.getElementById('ppConfirmModalOk');
        okBtn.textContent = options.confirmText || 'Confirm';
        okBtn.className = 'btn ' + (isDanger ? 'btn-pp-danger' : 'btn-pp-highstakes');

        return new Promise(function (resolve) {
            pendingResolve = resolve;
            bsModal.show();
        });
    }

    global.ConfirmModal = { show: show };

})(window);
