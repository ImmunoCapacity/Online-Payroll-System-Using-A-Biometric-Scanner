/**
 * Room Maintenance (api/rooms) — the rooms offered as a class's Room in
 * Faculty Schedule, each with a floor level. A room can be added, edited
 * (renamed and/or moved to another floor — classes using it follow the
 * rename) and removed, as long as no scheduled class still uses it.
 */
(function () {
    'use strict';

    PayrollProLayout.init({
        activeNav: 'dtr',
        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },
        notifications: true
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

    function rowAttrs(id, label) {
        return 'class="pp-row-clickable" tabindex="0" role="button" data-id="' + id + '" aria-label="' + escapeHtml(label) + '"';
    }

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

    var rooms = [];
    var roomEditId = null;

    function loadRooms() {
        return api('api/rooms').then(function (data) {
            if (!data.success) throw new Error(data.message);
            rooms = data.rooms;
            renderRooms();
        }).catch(function () {
            document.getElementById('roomsBody').innerHTML =
                '<tr><td colspan="3" class="text-center text-muted py-4">Could not load rooms from the server.</td></tr>';
        });
    }

    function renderRooms() {
        var body = document.getElementById('roomsBody');
        if (!rooms.length) {
            body.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No rooms yet. Click Add Room.</td></tr>';
            return;
        }
        body.innerHTML = rooms.map(function (r) {
            return '<tr ' + rowAttrs(r.id, 'Edit ' + r.name) + '>' +
                '<td><strong>' + escapeHtml(r.name) + '</strong></td>' +
                '<td>' + escapeHtml(r.floorLevel) + '</td>' +
                '<td class="col-num">' + r.used + '</td>' +
            '</tr>';
        }).join('');
    }

    function openRoomForm(room) {
        roomEditId = room ? room.id : null;
        document.getElementById('roomModalTitle').textContent = room ? 'Edit Room' : 'Add Room';
        document.getElementById('roomForm').reset();
        document.getElementById('roomName').value = room ? room.name : '';
        document.getElementById('roomFloor').value = room ? room.floorLevel : '';
        var removeBtn = document.getElementById('roomRemoveBtn');
        removeBtn.classList.toggle('d-none', !room);
        // A room can only be removed when no scheduled class still uses it.
        removeBtn.disabled = !!(room && room.used);
        removeBtn.title = room && room.used ? room.used + ' scheduled class(es) use this room' : '';
        PPValidate.clear(document.getElementById('roomForm'));
        bootstrap.Modal.getOrCreateInstance(document.getElementById('roomModal')).show();
    }

    document.getElementById('btnAddRoom').addEventListener('click', function () { openRoomForm(null); });

    document.getElementById('roomName').ppValidator = function (value) {
        var taken = rooms.some(function (r) {
            return r.id !== roomEditId && String(r.name).toLowerCase() === value.trim().toLowerCase();
        });
        return taken ? 'This room already exists.' : '';
    };

    clickableRows('roomsBody', function (id) {
        var room = rooms.find(function (r) { return r.id === id; });
        if (room) openRoomForm(room);
    });

    document.getElementById('roomRemoveBtn').addEventListener('click', function () {
        var room = rooms.find(function (r) { return r.id === roomEditId; });
        if (!room) return;
        ConfirmModal.show({
            title: 'Remove Room',
            message: 'Remove "' + room.name + '"? It will no longer be offered in Faculty Schedule.',
            confirmText: 'Remove',
            tone: 'danger'
        }).then(function (confirmed) {
            if (!confirmed) return;
            api('api/rooms/' + room.id, 'DELETE').then(function (data) {
                if (!data.success) { PPToast.error(data.message); return; }
                bootstrap.Modal.getOrCreateInstance(document.getElementById('roomModal')).hide();
                rooms = data.rooms;
                renderRooms();
                PPToast.success('"' + room.name + '" removed.');
            }).catch(function () { PPToast.error('Could not reach the server.'); });
        });
    });

    document.getElementById('roomForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.target;
        if (!PPValidate.validateForm(form)) return;
        var name = document.getElementById('roomName').value.trim();
        var floorLevel = document.getElementById('roomFloor').value.trim();
        api(roomEditId ? 'api/rooms/' + roomEditId : 'api/rooms', roomEditId ? 'PUT' : 'POST',
            { name: name, floorLevel: floorLevel })
            .then(function (data) {
                if (!data.success) {
                    if (!PPValidate.showServerError(form, data, { name: 'roomName', floorLevel: 'roomFloor' })) PPToast.error(data.message);
                    return;
                }
                bootstrap.Modal.getInstance(document.getElementById('roomModal')).hide();
                rooms = data.rooms;
                renderRooms();
                PPToast.success(roomEditId ? 'Room updated.' : '"' + name + '" added.');
            }).catch(function () { PPToast.error('Could not reach the server.'); });
    });

    loadRooms();
})();
