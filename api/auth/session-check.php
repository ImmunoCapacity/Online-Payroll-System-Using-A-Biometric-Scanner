<?php
/**
 * GET /api/auth/session-check.php
 * Returns the currently logged-in user, or 401 if no one is logged in.
 * This is what a real auth-guard would call instead of trusting
 * localStorage alone.
 */

require_once __DIR__ . '/../_bootstrap.php';

$user = currentUser();

if ($user === null) {
    respond(['success' => false, 'message' => 'Not logged in.'], 401);
}

respond(['success' => true, 'user' => $user]);
