<?php
/**
 * API Bootstrap
 * ---------------------------------------------------------------
 * Included by every endpoint under /api. Starts the session, loads
 * the database connection, and provides small shared helpers so
 * every endpoint responds and guards access the same way.
 *
 * Usage in an endpoint that requires login:
 *   require_once __DIR__ . '/../_bootstrap.php';
 *   requireRole(['Payroll Master', 'System Administrator']);
 *   // ... $pdo and $currentUser are now available
 *
 * Usage in a public endpoint (e.g. login itself):
 *   require_once __DIR__ . '/../_bootstrap.php';
 *   // no requireRole() call — just use $pdo
 * ---------------------------------------------------------------
 */

declare(strict_types=1);

// Session cookie hardening — set before session_start().
session_set_cookie_params([
    'lifetime' => 0,          // expires when the browser closes
    'path'     => '/',
    'httponly' => true,       // not readable from JavaScript
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/../config/config.php'; // provides $pdo

/**
 * Send a JSON response and stop execution.
 */
function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

/**
 * The currently logged-in user, from the session, or null if none.
 */
function currentUser(): ?array
{
    return $_SESSION['user'] ?? null;
}

/**
 * Stop the request with 401 unless someone is logged in.
 * Stop it with 403 if they're logged in but not one of $allowedRoles.
 * Pass no argument (or an empty array) to just require "logged in, any role".
 *
 * @return array The current user, for convenience.
 */
function requireRole(array $allowedRoles = []): array
{
    $user = currentUser();

    if ($user === null) {
        respond([
            'success' => false,
            'message' => 'You must be logged in to do that.'
        ], 401);
    }

    if (!empty($allowedRoles) && !in_array($user['role'], $allowedRoles, true)) {
        respond([
            'success' => false,
            'message' => 'Your account role does not have access to this action.'
        ], 403);
    }

    return $user;
}

/**
 * Read and decode a JSON request body. Returns an empty array if the
 * body is missing or not valid JSON.
 */
function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
