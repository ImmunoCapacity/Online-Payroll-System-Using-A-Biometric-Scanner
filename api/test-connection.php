<?php
/**
 * Database Connection Test
 * ---------------------------------------------------------------
 * Open this file in a browser (e.g. http://localhost/your-project/api/test-connection.php)
 * after importing payroll_schema.sql to confirm config.php can reach Payroll_DB.
 * Safe to delete once you've confirmed the connection works.
 * ---------------------------------------------------------------
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../config/config.php';

try {
    $stmt = $pdo->query('SHOW TABLES');
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'success' => true,
        'message' => 'Connected to ' . DB_NAME . ' successfully.',
        'table_count' => count($tables),
        'tables' => $tables
    ], JSON_PRETTY_PRINT);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Query failed: ' . $e->getMessage()
    ]);
}
