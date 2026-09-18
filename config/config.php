<?php
/**
 * Database Connection Configuration
 * ---------------------------------------------------------------
 * Connects to the Payroll_DB database (see payroll_schema.sql) using
 * PDO with prepared-statement support and exceptions enabled.
 *
 * XAMPP defaults are used below. Update these if your setup differs
 * (e.g. a MySQL root password set via phpMyAdmin, a different port,
 * or a remote/production database host).
 *
 * Usage in another PHP file:
 *   require_once __DIR__ . '/../config/config.php';
 *   $stmt = $pdo->prepare("SELECT * FROM faculty_staff WHERE faculty_id = ?");
 *   $stmt->execute([$facultyId]);
 *   $row = $stmt->fetch();
 * ---------------------------------------------------------------
 */

// ---- Connection settings ----
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'Payroll_DB');
define('DB_USER', 'root');
define('DB_PASS', '');        // XAMPP's default MySQL root password is blank
define('DB_CHARSET', 'utf8mb4');

$dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // throw exceptions on errors instead of silent failures
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         // return rows as associative arrays
    PDO::ATTR_EMULATE_PREPARES   => false,                    // use real prepared statements (safer against SQL injection)
];

try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
} catch (PDOException $e) {
    // Do not leak connection details (host/user/password) in the response.
    http_response_code(500);
    error_log('Database connection failed: ' . $e->getMessage());
    die(json_encode([
        'success' => false,
        'message' => 'Unable to connect to the database. Please check the server configuration.'
    ]));
}
