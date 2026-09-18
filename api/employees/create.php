<?php
/**
 * POST /api/employees/create.php
 * Body: { employeeNumber, displayName, department ("Faculty"|"Admin"),
 *         email, phone, status, dateHired, notes }
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['System Administrator', 'Payroll Master', 'Payroll Staff']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Use POST.'], 405);
}

$body = jsonBody();

$employeeNumber = trim((string) ($body['employeeNumber'] ?? ''));
$displayName = trim((string) ($body['displayName'] ?? ''));
$department = (string) ($body['department'] ?? '');
$email = trim((string) ($body['email'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));
$status = (string) ($body['status'] ?? 'Active');
$dateHired = (string) ($body['dateHired'] ?? '');
$notes = trim((string) ($body['notes'] ?? ''));

if ($employeeNumber === '' || $displayName === '' || $email === '' || $phone === '' || $dateHired === '') {
    respond(['success' => false, 'message' => 'Employee number, name, email, phone, and date hired are all required.'], 422);
}

if (!in_array($department, ['Faculty', 'Admin'], true)) {
    respond(['success' => false, 'message' => 'Department must be "Faculty" or "Admin".'], 422);
}

// employee_number must be unique across BOTH tables (the database can only
// enforce uniqueness within one table at a time).
$facultyCheck = $pdo->prepare('SELECT faculty_id FROM faculty_staff WHERE employee_number = ?');
$facultyCheck->execute([$employeeNumber]);
$adminCheck = $pdo->prepare('SELECT adminstaff_id FROM admin_staff WHERE employee_number = ?');
$adminCheck->execute([$employeeNumber]);

if ($facultyCheck->fetch() || $adminCheck->fetch()) {
    respond(['success' => false, 'message' => 'This employee number is already in use.'], 422);
}

// Split "Dr. Maria Santos" into first name "Dr. Maria" / last name "Santos" —
// everything but the last word is the first name, since the DB requires both.
$nameParts = preg_split('/\s+/', $displayName);
$lastName = array_pop($nameParts);
$firstName = $nameParts ? implode(' ', $nameParts) : $lastName;
if (count($nameParts) === 0) {
    // Single-word name: use it as both, rather than leaving first name empty.
    $firstName = $lastName;
}

try {
    if ($department === 'Faculty') {
        $stmt = $pdo->prepare(
            'INSERT INTO faculty_staff (employee_number, firstname, lastname, email_address, contact_number, employment_status, date_hired, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$employeeNumber, $firstName, $lastName, $email, $phone, $status, $dateHired, $notes]);
        $newId = 'F' . $pdo->lastInsertId();
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO admin_staff (employee_number, firstname, lastname, email_address, contact_number, employment_status, date_hired, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$employeeNumber, $firstName, $lastName, $email, $phone, $status, $dateHired, $notes]);
        $newId = 'A' . $pdo->lastInsertId();
    }
} catch (PDOException $e) {
    // Most likely the email_address UNIQUE constraint.
    respond(['success' => false, 'message' => 'Could not save employee — the email address may already be in use.'], 422);
}

respond([
    'success' => true,
    'id' => $newId
]);
