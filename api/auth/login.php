<?php
/**
 * POST /api/auth/login.php
 * Body: { "email": "...", "password": "..." }
 *
 * Checks credentials against three tables, in order:
 *   1. users          -> System Administrator / Payroll Master / Payroll Staff
 *      (matched on `email`)
 *   2. faculty_staff   -> Faculty Staff
 *   3. admin_staff      -> Administrative Staff
 *      (faculty/admin are matched on EITHER `email_address` or the newer
 *      `username` column, so this keeps working however each employee's
 *      account was set up)
 */

require_once __DIR__ . '/../_bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['success' => false, 'message' => 'Use POST.'], 405);
}

$body = jsonBody();
$identifier = trim((string) ($body['email'] ?? $body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');

if ($identifier === '' || $password === '') {
    respond(['success' => false, 'message' => 'Email and password are required.'], 422);
}

// Deliberately the same error for "no such account" and "wrong password" so
// this endpoint can't be used to discover which emails/usernames exist.
$invalidCredentials = ['success' => false, 'message' => 'Incorrect email or password.'];

/**
 * Look up one candidate table and, if the credentials match, return the
 * session-ready user array. Returns null on no match.
 */
function tryAccount(PDO $pdo, string $table, string $idColumn, string $lookupSql, string $role, string $accountType, string $identifier, string $password): ?array
{
    $stmt = $pdo->prepare("SELECT * FROM `$table` WHERE $lookupSql LIMIT 1");
    $paramCount = substr_count($lookupSql, '?');
    $stmt->execute(array_fill(0, $paramCount, $identifier));
    $row = $stmt->fetch();

    if (!$row || empty($row['password'])) {
        return null; // no such account here, or no password ever set (no portal access)
    }

    if (!password_verify($password, $row['password'])) {
        return null;
    }

    if ($accountType === 'system') {
        if (!$row['is_active']) {
            return ['inactive' => true];
        }
        return [
            'id'          => (int) $row[$idColumn],
            'accountType' => $accountType,
            'name'        => $row['first_name'] . ' ' . $row['last_name'],
            'email'       => $row['email'],
            'role'        => $row['role'],
        ];
    }

    if ($row['employment_status'] !== 'Active') {
        return ['inactive' => true];
    }

    return [
        'id'          => (int) $row[$idColumn],
        'accountType' => $accountType,
        'name'        => trim($row['firstname'] . ' ' . $row['lastname']),
        'email'       => $row['email_address'],
        'role'        => $role,
    ];
}

$match =
    tryAccount($pdo, 'users', 'user_id', 'email = ?', '', 'system', $identifier, $password)
    ?? tryAccount($pdo, 'faculty_staff', 'faculty_id', '(email_address = ? OR username = ?)', 'Faculty Staff', 'faculty', $identifier, $password)
    ?? tryAccount($pdo, 'admin_staff', 'adminstaff_id', '(email_address = ? OR username = ?)', 'Administrative Staff', 'admin', $identifier, $password);

if ($match === null) {
    respond($invalidCredentials, 401);
}

if (isset($match['inactive'])) {
    respond(['success' => false, 'message' => 'This account has been deactivated. Contact your System Administrator.'], 403);
}

session_regenerate_id(true);
$_SESSION['user'] = $match;

respond([
    'success' => true,
    'user' => $match
]);
