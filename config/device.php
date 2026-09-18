<?php
/**
 * Biometric Device Configuration
 * ---------------------------------------------------------------
 * Connection settings for the ZKTeco K40 fingerprint scanner.
 *
 * HOW TO FIND THESE VALUES:
 *   1. On the K40 itself: Menu -> Comm. -> Ethernet
 *      - Note the IP address shown there (set it to a fixed/static IP
 *        so it never changes — ask your router to reserve that IP for
 *        the device's MAC address, or set a static IP directly on the
 *        device if its menu supports it).
 *   2. The port is 4370 unless you changed it on the device.
 *   3. The Comm Key is a numeric password set on the device
 *      (Menu -> Comm. -> Ethernet -> Comm Key). Leave it as 0 if you
 *      never set one.
 * ---------------------------------------------------------------
 */

define('DEVICE_IP', '192.168.1.201');   // TODO: replace with your K40's actual IP
define('DEVICE_PORT', 4370);            // ZKTeco default — do not change unless you changed it on the device
define('DEVICE_COMM_KEY', 0);           // 0 = no password set on the device
