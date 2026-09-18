<?php
/**
 * POST /api/auth/logout.php
 * Destroys the current session. No body needed.
 */

require_once __DIR__ . '/../_bootstrap.php';

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

session_destroy();

respond(['success' => true, 'message' => 'Logged out.']);
