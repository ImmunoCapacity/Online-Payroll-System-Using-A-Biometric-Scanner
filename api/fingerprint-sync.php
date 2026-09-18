<?php
/**
 * Biometric Device Sync
 * ---------------------------------------------------------------
 * Pulls attendance logs from the ZKTeco K40 over the LAN and writes
 * them into daily_time_record, matching each log to an employee via
 * the fingerprint_id already stored on faculty_staff / admin_staff.
 *
 * REQUIRES: composer install   (installs rats/zkteco — see composer.json)
 *
 * Called by the "Sync Device" button on system-admin.html
 * (see js/system-admin-dashboard.js).
 *
 * IMPORTANT — before this can do anything useful:
 *   1. Set the real device IP in config/device.php
 *   2. Make sure a row for this device exists in the `device` table
 *      (Biometric Devices page) with a matching ip_address
 *   3. Whoever enrolls a fingerprint on the physical K40 must set the
 *      device's "User ID" for that person to the SAME value stored in
 *      that employee's `fingerprint_id` column — that's the only way
 *      a punch on the device can be matched back to an employee here.
 * ---------------------------------------------------------------
 */

declare(strict_types=1);
header('Content-Type: application/json');

require_once __DIR__ . '/../config/config.php';   // provides $pdo
require_once __DIR__ . '/../config/device.php';   // provides DEVICE_IP / DEVICE_PORT / DEVICE_COMM_KEY
require_once __DIR__ . '/../vendor/autoload.php';  // composer autoloader (php-zkteco)

use Rats\Zkteco\Lib\ZKTeco;

/**
 * Pull one attendance-log field out of a record regardless of whether
 * the installed library version returns an associative array
 * (['uid'=>..,'id'=>..,'state'=>..,'timestamp'=>..]) or a plain
 * indexed array ([$uid, $id, $state, $timestamp]).
 * Run this file once after your first real sync and check the
 * "debug_first_record" field in the response to confirm which shape
 * your version returns — adjust the $keys/$index pairs below if needed.
 */
function pluck(array $record, string $assocKey, int $index)
{
    if (array_key_exists($assocKey, $record)) {
        return $record[$assocKey];
    }
    if (array_key_exists($index, $record)) {
        return $record[$index];
    }
    return null;
}

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload);
    exit;
}

// ---- 1. Connect to the device ----
$zk = new ZKTeco(DEVICE_IP, DEVICE_PORT);

if (!$zk->connect()) {
    respond([
        'success' => false,
        'message' => 'Could not reach the biometric device at ' . DEVICE_IP . ':' . DEVICE_PORT .
                      '. Check that it is powered on, on the same network, and that the IP in config/device.php is correct.'
    ], 502);
}

$rawLogs = $zk->getAttendance();   // array of [uid, id, state, timestamp] rows — see Rats\Zkteco\Lib\Helper\Attendance
$zk->disconnect();

if ($rawLogs === false) {
    respond([
        'success' => false,
        'message' => 'Connected to the device, but reading the attendance log failed. If the device has a Comm Key set, this library version may not support it — see the fallback options in the README notes.'
    ], 502);
}

// ---- 2. Look up the device's row (for device_id on each DTR record) ----
$deviceStmt = $pdo->prepare('SELECT device_id FROM device WHERE ip_address = ? LIMIT 1');
$deviceStmt->execute([DEVICE_IP]);
$deviceRow = $deviceStmt->fetch();
$deviceId = $deviceRow['device_id'] ?? null;

if ($deviceId === null) {
    respond([
        'success' => false,
        'message' => 'No row in the device table has ip_address = ' . DEVICE_IP . '. Add this scanner on the Biometric Devices page first.'
    ], 422);
}

// ---- 3. Build a fingerprint_id -> employee lookup ----
$employeesByFingerprint = [];

$facultyStmt = $pdo->query("SELECT faculty_id, fingerprint_id FROM faculty_staff WHERE fingerprint_id IS NOT NULL AND fingerprint_id <> ''");
foreach ($facultyStmt->fetchAll() as $row) {
    $employeesByFingerprint[$row['fingerprint_id']] = ['column' => 'faculty_id', 'id' => (int) $row['faculty_id']];
}

$adminStmt = $pdo->query("SELECT adminstaff_id, fingerprint_id FROM admin_staff WHERE fingerprint_id IS NOT NULL AND fingerprint_id <> ''");
foreach ($adminStmt->fetchAll() as $row) {
    $employeesByFingerprint[$row['fingerprint_id']] = ['column' => 'adminstaff_id', 'id' => (int) $row['adminstaff_id']];
}

// ---- 4. Process each log ----
$insertStmt = $pdo->prepare(
    'INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date, time_in, status, is_manual_entry)
     VALUES (:fingerprint_id, :device_id, :faculty_id, :adminstaff_id, :record_date, :time_in, :status, 0)'
);
$updateTimeOutStmt = $pdo->prepare('UPDATE daily_time_record SET time_out = ? WHERE dtr_id = ?');

$STANDARD_START = '08:00:00';
$GRACE_MINUTES = 15;

$inserted = 0;
$updated = 0;
$skippedUnmapped = 0;
$skippedInvalid = 0;
$firstRecordDebug = null;

foreach ($rawLogs as $log) {
    if (!is_array($log)) {
        $skippedInvalid++;
        continue;
    }

    if ($firstRecordDebug === null) {
        $firstRecordDebug = $log; // returned in the response so you can confirm the real shape on first run
    }

    // "id" here is the device's User ID field — the one whoever enrolled
    // the fingerprint typed in on the device, matched against fingerprint_id.
    $deviceUserId = (string) pluck($log, 'id', 1);
    $timestampRaw = pluck($log, 'timestamp', 3);

    if ($deviceUserId === '' || $timestampRaw === null) {
        $skippedInvalid++;
        continue;
    }

    if (!isset($employeesByFingerprint[$deviceUserId])) {
        $skippedUnmapped++;
        continue;
    }

    $employee = $employeesByFingerprint[$deviceUserId];
    $column = $employee['column'];

    try {
        $dt = new DateTime((string) $timestampRaw);
    } catch (Exception $e) {
        $skippedInvalid++;
        continue;
    }

    $date = $dt->format('Y-m-d');
    $time = $dt->format('H:i:s');

    $find = $pdo->prepare(sprintf(
        'SELECT dtr_id, time_in, time_out FROM daily_time_record WHERE %s = ? AND record_date = ?',
        $column
    ));
    $find->execute([$employee['id'], $date]);
    $existing = $find->fetch();

    if ($existing) {
        // Second punch of the day with no time_out yet -> treat as time-out
        if (empty($existing['time_out']) && !empty($existing['time_in']) && $time > $existing['time_in']) {
            $updateTimeOutStmt->execute([$time, $existing['dtr_id']]);
            $updated++;
        }
        // else: duplicate/near-duplicate punch, ignore
        continue;
    }

    $scheduledStart = new DateTime($date . ' ' . $STANDARD_START);
    $graceEnd = (clone $scheduledStart)->modify('+' . $GRACE_MINUTES . ' minutes');
    $status = $dt > $graceEnd ? 'Late' : 'Present';

    $insertStmt->execute([
        ':fingerprint_id' => $deviceUserId,
        ':device_id'      => $deviceId,
        ':faculty_id'     => $column === 'faculty_id' ? $employee['id'] : null,
        ':adminstaff_id'  => $column === 'adminstaff_id' ? $employee['id'] : null,
        ':record_date'    => $date,
        ':time_in'        => $time,
        ':status'         => $status,
    ]);
    $inserted++;
}

respond([
    'success' => true,
    'message' => 'Sync complete.',
    'total_logs_from_device' => count($rawLogs),
    'inserted' => $inserted,
    'updated_time_out' => $updated,
    'skipped_no_matching_employee' => $skippedUnmapped,
    'skipped_invalid' => $skippedInvalid,
    'debug_first_record' => $firstRecordDebug
]);
