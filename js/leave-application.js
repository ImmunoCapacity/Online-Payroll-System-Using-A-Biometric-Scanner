(function () {

    /* PayrollPro layout */

    PayrollProLayout.init({

        activeNav: 'leave',

        navMode: 'master',

        institution: {
            name: 'STI Balayan',
            short: 'STI'
        },

        notifications: true

    });


    /* Data */

    var requests = [];

    var filteredRequests = [];


    /* Elements */

    var searchInput =
        document.getElementById('leaveSearch');

    var typeFilter =
        document.getElementById('leaveTypeFilter');

    var statusFilter =
        document.getElementById('leaveStatusFilter');

    var dateFilter =
        document.getElementById('leaveDateFilter');

    var tableBody =
        document.getElementById('leaveTableBody');

    var emptyState =
        document.getElementById('leaveEmptyState');

    var listCount =
        document.getElementById('leaveListCount');


    /* Helpers */

    function escapeHtml(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return '';
        }

        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

    }


    /* Format date */

    function formatDate(value) {

        if (!value) {
            return '—';
        }

        var date =
            new Date(
                value + 'T00:00:00'
            );

        if (
            isNaN(
                date.getTime()
            )
        ) {
            return '—';
        }

        return date.toLocaleDateString(
            'en-PH',
            {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }
        );

    }


    /* Count days */

    function countDays(from, to) {

        if (!from || !to) {
            return 0;
        }

        var start =
            new Date(
                from + 'T00:00:00'
            );

        var end =
            new Date(
                to + 'T00:00:00'
            );

        if (
            isNaN(start.getTime()) ||
            isNaN(end.getTime())
        ) {
            return 0;
        }

        if (end < start) {
            return 0;
        }

        return Math.round(
            (end - start) /
            86400000
        ) + 1;

    }


    /* Employee ID */

    function getEmployeeId(request) {

        return (
            request.employeeId ||
            request.adminStaffId ||
            request.facultyId ||
            request.employeeNumber ||
            '—'
        );

    }


    /* Leave type */

    function getLeaveTypeLabel(category) {

        var types = {

            Sick:
                'Sick Leave',

            Vacation:
                'Vacation Leave',

            Maternity:
                'Maternity Leave',

            Paternity:
                'Paternity Leave',

            Emergency:
                'Emergency Leave',

            Personal:
                'Personal Leave'

        };

        return (
            types[category] ||
            category ||
            '—'
        );

    }


    /* Pay */

    function getPayStatus(request) {

        if (!request) {
            return 'Unpaid';
        }

        if (
            request.payStatus === 'Paid' ||
            request.paid === true
        ) {
            return 'Paid';
        }

        if (
            request.payStatus === 'Unpaid' ||
            request.paid === false
        ) {
            return 'Unpaid';
        }

        return 'Unpaid';

    }


    /* Status */

    function getStatusClass(status) {

        switch (status) {

            case 'Approved':
                return 'leave-status-approved';

            case 'Rejected':
                return 'leave-status-rejected';

            case 'Cancelled':
                return 'leave-status-cancelled';

            case 'Pending':
            default:
                return 'leave-status-pending';

        }

    }


    /* Remarks */

    function getRemarks(request) {

        if (!request) {
            return '';
        }

        return (
            request.remarks ||
            request.reason ||
            ''
        );

    }


    /* Date filter */

    function matchesDateFilter(request) {

        var selectedDate =
            dateFilter.value;

        if (!selectedDate) {
            return true;
        }

        if (
            !request.dateFrom ||
            !request.dateTo
        ) {
            return false;
        }

        return (
            selectedDate >= request.dateFrom &&
            selectedDate <= request.dateTo
        );

    }


    /* Filters */

    function applyFilters() {

        var search =
            searchInput.value
                .trim()
                .toLowerCase();

        var selectedType =
            typeFilter.value;

        var selectedStatus =
            statusFilter.value;


        filteredRequests =
            requests.filter(
                function (request) {

                    var employeeName =
                        String(
                            request.employee ||
                            ''
                        ).toLowerCase();


                    var employeeId =
                        String(
                            getEmployeeId(
                                request
                            )
                        ).toLowerCase();


                    var matchesSearch =
                        !search ||
                        employeeName.indexOf(
                            search
                        ) !== -1 ||
                        employeeId.indexOf(
                            search
                        ) !== -1;


                    var matchesType =
                        selectedType === 'All' ||
                        request.category ===
                            selectedType;


                    var matchesStatus =
                        selectedStatus === 'All' ||
                        request.status ===
                            selectedStatus;


                    var matchesDate =
                        matchesDateFilter(
                            request
                        );


                    return (
                        matchesSearch &&
                        matchesType &&
                        matchesStatus &&
                        matchesDate
                    );

                }
            );


        filteredRequests.sort(
            function (a, b) {

                var dateA =
                    a.filedDate || '';

                var dateB =
                    b.filedDate || '';

                return dateB.localeCompare(
                    dateA
                );

            }
        );


        renderTable();

    }


    /* Leave type options */

    function buildLeaveTypeOptions(selected) {

        var types = [

            {
                value: 'Sick',
                label: 'Sick Leave'
            },

            {
                value: 'Vacation',
                label: 'Vacation Leave'
            },

            {
                value: 'Maternity',
                label: 'Maternity Leave'
            },

            {
                value: 'Paternity',
                label: 'Paternity Leave'
            },

            {
                value: 'Emergency',
                label: 'Emergency Leave'
            },

            {
                value: 'Personal',
                label: 'Personal Leave'
            }

        ];

        return types
            .map(
                function (type) {

                    return (
                        '<option value="' +
                        escapeHtml(type.value) +
                        '"' +
                        (
                            type.value === selected
                                ? ' selected'
                                : ''
                        ) +
                        '>' +
                        escapeHtml(type.label) +
                        '</option>'
                    );

                }
            )
            .join('');

    }


    /* Render table */

    function renderTable() {

        var count =
            filteredRequests.length;


        listCount.textContent =
            count +
            (
                count === 1
                    ? ' record'
                    : ' records'
            );


        if (!count) {

            tableBody.innerHTML =
                '';

            emptyState.classList.remove(
                'd-none'
            );

            return;

        }


        emptyState.classList.add(
            'd-none'
        );


        tableBody.innerHTML =
            filteredRequests
                .map(
                    function (request, index) {

                        var name =
                            request.employee ||
                            'Unknown Employee';


                        var employeeId =
                            getEmployeeId(
                                request
                            );


                        var category =
                            request.category ||
                            'Sick';


                        var days =
                            countDays(
                                request.dateFrom,
                                request.dateTo
                            );


                        var pay =
                            getPayStatus(
                                request
                            );


                        var status =
                            request.status ||
                            'Pending';


                        var remarks =
                            getRemarks(
                                request
                            );


                        var statusClass =
                            getStatusClass(
                                status
                            );


                        return (

                            '<tr>' +

                                '<td>' +

                                    '<div class="leave-employee-cell">' +

                                        '<strong>' +
                                            escapeHtml(name) +
                                        '</strong>' +

                                        '<span>' +
                                            escapeHtml(employeeId) +
                                        '</span>' +

                                    '</div>' +

                                '</td>' +


                                '<td>' +

                                    '<select ' +
                                        'class="leave-inline-select leave-type-input" ' +
                                        'data-index="' + index + '"' +
                                    '>' +

                                        buildLeaveTypeOptions(
                                            category
                                        ) +

                                    '</select>' +

                                '</td>' +


                                '<td>' +

                                    '<input ' +
                                        'type="date" ' +
                                        'class="leave-inline-date leave-date-from-input" ' +
                                        'data-index="' + index + '" ' +
                                        'value="' +
                                            escapeHtml(
                                                request.dateFrom || ''
                                            ) +
                                        '"' +
                                    '>' +

                                '</td>' +


                                '<td>' +

                                    '<input ' +
                                        'type="date" ' +
                                        'class="leave-inline-date leave-date-to-input" ' +
                                        'data-index="' + index + '" ' +
                                        'value="' +
                                            escapeHtml(
                                                request.dateTo || ''
                                            ) +
                                        '"' +
                                    '>' +

                                '</td>' +


                                '<td>' +

                                    '<span ' +
                                        'class="leave-days-cell" ' +
                                        'data-days-index="' + index + '"' +
                                    '>' +

                                        escapeHtml(
                                            days +
                                            (
                                                days === 1
                                                    ? ' day'
                                                    : ' days'
                                            )
                                        ) +

                                    '</span>' +

                                '</td>' +


                                '<td>' +

                                    '<select ' +
                                        'class="leave-inline-select leave-pay-input" ' +
                                        'data-index="' + index + '"' +
                                    '>' +

                                        '<option value="Paid"' +
                                            (
                                                pay === 'Paid'
                                                    ? ' selected'
                                                    : ''
                                            ) +
                                        '>' +
                                            'Paid' +
                                        '</option>' +

                                        '<option value="Unpaid"' +
                                            (
                                                pay === 'Unpaid'
                                                    ? ' selected'
                                                    : ''
                                            ) +
                                        '>' +
                                            'Unpaid' +
                                        '</option>' +

                                    '</select>' +

                                '</td>' +


                                '<td>' +

                                    '<span class="leave-filed-date">' +
                                        escapeHtml(
                                            formatDate(
                                                request.filedDate
                                            )
                                        ) +
                                    '</span>' +

                                '</td>' +


                                '<td>' +

                                    '<select ' +
                                        'class="leave-inline-select leave-status-input ' +
                                            statusClass +
                                        '" ' +
                                        'data-index="' + index + '"' +
                                    '>' +

                                        '<option value="Pending"' +
                                            (
                                                status === 'Pending'
                                                    ? ' selected'
                                                    : ''
                                            ) +
                                        '>' +
                                            'Pending' +
                                        '</option>' +

                                        '<option value="Approved"' +
                                            (
                                                status === 'Approved'
                                                    ? ' selected'
                                                    : ''
                                            ) +
                                        '>' +
                                            'Approved' +
                                        '</option>' +

                                        '<option value="Rejected"' +
                                            (
                                                status === 'Rejected'
                                                    ? ' selected'
                                                    : ''
                                            ) +
                                        '>' +
                                            'Rejected' +
                                        '</option>' +

                                        '<option value="Cancelled"' +
                                            (
                                                status === 'Cancelled'
                                                    ? ' selected'
                                                    : ''
                                            ) +
                                        '>' +
                                            'Cancelled' +
                                        '</option>' +

                                    '</select>' +

                                '</td>' +


                                '<td>' +

                                    '<input ' +
                                        'type="text" ' +
                                        'class="leave-inline-input leave-remarks-input" ' +
                                        'data-index="' + index + '" ' +
                                        'value="' +
                                            escapeHtml(
                                                remarks
                                            ) +
                                        '" ' +
                                        'placeholder="Enter remarks"' +
                                    '>' +

                                '</td>' +

                            '</tr>'

                        );

                    }
                )
                .join('');


        bindInlineFields();

    }


    /* Inline field events */

    function bindInlineFields() {

        var typeInputs =
            document.querySelectorAll(
                '.leave-type-input'
            );

        var payInputs =
            document.querySelectorAll(
                '.leave-pay-input'
            );

        var dateFromInputs =
            document.querySelectorAll(
                '.leave-date-from-input'
            );

        var dateToInputs =
            document.querySelectorAll(
                '.leave-date-to-input'
            );

        var statusInputs =
            document.querySelectorAll(
                '.leave-status-input'
            );

        var remarksInputs =
            document.querySelectorAll(
                '.leave-remarks-input'
            );


        typeInputs.forEach(
            function (input) {

                input.addEventListener(
                    'change',
                    function () {

                        var index =
                            Number(
                                input.dataset.index
                            );

                        requests[
                            filteredRequests[index]._originalIndex
                        ].category =
                            input.value;

                    }
                );

            }
        );


        payInputs.forEach(
            function (input) {

                input.addEventListener(
                    'change',
                    function () {

                        var index =
                            Number(
                                input.dataset.index
                            );

                        var request =
                            filteredRequests[index];

                        request.payStatus =
                            input.value;

                        request.paid =
                            input.value === 'Paid';

                    }
                );

            }
        );


        dateFromInputs.forEach(
            function (input) {

                input.addEventListener(
                    'change',
                    function () {

                        var index =
                            Number(
                                input.dataset.index
                            );

                        var request =
                            filteredRequests[index];

                        request.dateFrom =
                            input.value;

                        updateDays(
                            index,
                            request
                        );

                    }
                );

            }
        );


        dateToInputs.forEach(
            function (input) {

                input.addEventListener(
                    'change',
                    function () {

                        var index =
                            Number(
                                input.dataset.index
                            );

                        var request =
                            filteredRequests[index];

                        request.dateTo =
                            input.value;

                        updateDays(
                            index,
                            request
                        );

                    }
                );

            }
        );


        statusInputs.forEach(
            function (input) {

                input.addEventListener(
                    'change',
                    function () {

                        var index =
                            Number(
                                input.dataset.index
                            );

                        var request =
                            filteredRequests[index];

                        request.status =
                            input.value;

                        input.className =
                            'leave-inline-select leave-status-input ' +
                            getStatusClass(
                                input.value
                            );

                    }
                );

            }
        );


        remarksInputs.forEach(
            function (input) {

                input.addEventListener(
                    'input',
                    function () {

                        var index =
                            Number(
                                input.dataset.index
                            );

                        var request =
                            filteredRequests[index];

                        request.remarks =
                            input.value;

                    }
                );

            }
        );

    }


    /* Update days */

    function updateDays(index, request) {

        var days =
            countDays(
                request.dateFrom,
                request.dateTo
            );

        var daysElement =
            document.querySelector(
                '[data-days-index="' +
                index +
                '"]'
            );

        if (!daysElement) {
            return;
        }

        daysElement.textContent =
            days +
            (
                days === 1
                    ? ' day'
                    : ' days'
            );

    }


    /* Load data */

    function loadRequests() {

        var stored =
            DataStore.getLeaveRequests();

        if (
            Array.isArray(stored)
        ) {

            requests =
                stored.slice();

        } else {

            requests = [];

        }

        applyFilters();

    }


    /* Filters */

    searchInput.addEventListener(
        'input',
        applyFilters
    );


    typeFilter.addEventListener(
        'change',
        applyFilters
    );


    statusFilter.addEventListener(
        'change',
        applyFilters
    );


    dateFilter.addEventListener(
        'change',
        applyFilters
    );


    /* Initial load */

    loadRequests();

})();