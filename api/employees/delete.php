<?php
/**
 * POST /api/employees/delete.php
 * Body: { id ("F3" or "A5") }
 */

require_once __DIR__ . '/../_bootstrap.php';

requireRole(['System Administrator', 'Payroll Master', 'Payroll Staff']);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Use POST.'], 405);
}

$body = jsonBody();
$id = (string) ($body['id'] ?? '');

if (strlen($id) < 2 || !in_array($id[0], ['F', 'A'], true)) {
    respond(['success' => false, 'message' => 'Invalid employee id.'], 422);
}

$table = $id[0] === 'F' ? 'faculty_staff' : 'admin_staff';
$idColumn = $id[0] === 'F' ? 'faculty_id' : 'adminstaff_id';
$numericId = (int) substr($id, 1);

$stmt = $pdo->prepare("DELETE FROM `$table` WHERE `$idColumn` = ?");
$stmt->execute([$numericId]);

if ($stmt->rowCount() === 0) {
    respond(['success' => false, 'message' => 'Employee not found.'], 404);
}

respond(['success' => true]);
