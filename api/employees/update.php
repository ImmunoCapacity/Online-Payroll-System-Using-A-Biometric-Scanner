<?php
/**
 * POST /api/employees/update.php
 * Body: { id ("F3" or "A5"), employeeNumber, displayName, email, phone,
 *         status, dateHired, notes }
 *
 * NOTE: department/type cannot be changed here — an employee's id prefix
 * (F/A) determines which table they live in permanently. Moving someone
 * from Faculty to Admin (or back) isn't supported yet; that would require
 * migrating their row — and its history in DTR, payroll, etc. — to the
 * other table.
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['System Administrator', 'Payroll Master', 'Payroll Staff']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Use POST.'], 405);
}

$body = jsonBody();

$id = (string) ($body['id'] ?? '');
$employeeNumber = trim((string) ($body['employeeNumber'] ?? ''));
$displayName = trim((string) ($body['displayName'] ?? ''));
$email = trim((string) ($body['email'] ?? ''));
$phone = trim((string) ($body['phone'] ?? ''));
$status = (string) ($body['status'] ?? 'Active');
$dateHired = (string) ($body['dateHired'] ?? '');
$notes = trim((string) ($body['notes'] ?? ''));

if (strlen($id) < 2 || !in_array($id[0], ['F', 'A'], true)) {
    respond(['success' => false, 'message' => 'Invalid employee id.'], 422);
}

$table = $id[0] === 'F' ? 'faculty_staff' : 'admin_staff';
$idColumn = $id[0] === 'F' ? 'faculty_id' : 'adminstaff_id';
$numericId = (int) substr($id, 1);

if ($employeeNumber === '' || $displayName === '' || $email === '' || $phone === '' || $dateHired === '') {
    respond(['success' => false, 'message' => 'Employee number, name, email, phone, and date hired are all required.'], 422);
}

// employee_number must stay unique across both tables, excluding this row.
$facultyCheck = $pdo->prepare('SELECT faculty_id FROM faculty_staff WHERE employee_number = ? AND NOT (faculty_id = ? AND ? = "faculty_staff")');
$facultyCheck->execute([$employeeNumber, $numericId, $table]);
$adminCheck = $pdo->prepare('SELECT adminstaff_id FROM admin_staff WHERE employee_number = ? AND NOT (adminstaff_id = ? AND ? = "admin_staff")');
$adminCheck->execute([$employeeNumber, $numericId, $table]);

if ($facultyCheck->fetch() || $adminCheck->fetch()) {
    respond(['success' => false, 'message' => 'This employee number is already in use.'], 422);
}

$nameParts = preg_split('/\s+/', $displayName);
$lastName = array_pop($nameParts);
$firstName = $nameParts ? implode(' ', $nameParts) : $lastName;

try {
    $stmt = $pdo->prepare(
        "UPDATE `$table` SET employee_number = ?, firstname = ?, lastname = ?, email_address = ?, contact_number = ?, employment_status = ?, date_hired = ?, notes = ? WHERE `$idColumn` = ?"
    );
    $stmt->execute([$employeeNumber, $firstName, $lastName, $email, $phone, $status, $dateHired, $notes, $numericId]);
} catch (PDOException $e) {
    respond(['success' => false, 'message' => 'Could not save employee — the email address may already be in use.'], 422);
}

if ($stmt->rowCount() === 0) {
    // Either nothing changed, or the id doesn't exist — check which.
    $exists = $pdo->prepare("SELECT 1 FROM `$table` WHERE `$idColumn` = ?");
    $exists->execute([$numericId]);
    if (!$exists->fetch()) {
        respond(['success' => false, 'message' => 'Employee not found.'], 404);
    }
}

respond(['success' => true]);
