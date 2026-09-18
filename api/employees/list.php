<?php
/**
 * GET /api/employees/list.php
 * Returns every employee from faculty_staff and admin_staff, combined
 * into one array in the shape the frontend already works with.
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['System Administrator', 'Payroll Master', 'Payroll Staff']);

function mapFacultyRow(array $row): array
{
    return [
        'id'             => 'F' . $row['faculty_id'],
        'employeeNumber' => $row['employee_number'],
        'displayName'    => trim($row['firstname'] . ' ' . $row['lastname']),
        'firstName'      => $row['firstname'],
        'lastName'       => $row['lastname'],
        'type'           => 'Faculty',
        'department'     => 'Faculty',
        'email'          => $row['email_address'],
        'phone'          => $row['contact_number'],
        'status'         => $row['employment_status'],
        'dateHired'      => $row['date_hired'],
        'notes'          => $row['notes'],
        'fingerprintEnrolled' => !empty($row['fingerprint_id']),
    ];
}

function mapAdminRow(array $row): array
{
    return [
        'id'             => 'A' . $row['adminstaff_id'],
        'employeeNumber' => $row['employee_number'],
        'displayName'    => trim($row['firstname'] . ' ' . $row['lastname']),
        'firstName'      => $row['firstname'],
        'lastName'       => $row['lastname'],
        'type'           => 'Admin',
        'department'     => 'Admin',
        'email'          => $row['email_address'],
        'phone'          => $row['contact_number'],
        'status'         => $row['employment_status'],
        'dateHired'      => $row['date_hired'],
        'notes'          => $row['notes'],
        'fingerprintEnrolled' => !empty($row['fingerprint_id']),
    ];
}

$faculty = array_map('mapFacultyRow', $pdo->query('SELECT * FROM faculty_staff ORDER BY firstname')->fetchAll());
$admin = array_map('mapAdminRow', $pdo->query('SELECT * FROM admin_staff ORDER BY firstname')->fetchAll());

respond([
    'success' => true,
    'employees' => array_merge($faculty, $admin)
]);
