-- ============================================================================
-- Migration 002: Employee Self-Service Login
-- Adds username/password columns to faculty_staff and admin_staff so
-- Faculty Staff and Administrative Staff can log in directly, the same
-- way System Administrator / Payroll Master / Payroll Staff already do
-- via the `users` table.
--
-- Run this against an existing Payroll_DB that was created from
-- payroll_schema.sql before this migration existed. Fresh installs using
-- the updated payroll_schema.sql already include these columns.
-- ============================================================================

USE `Payroll_DB`;

ALTER TABLE `faculty_staff`
    ADD COLUMN `username` VARCHAR(50)  DEFAULT NULL AFTER `fingerprint_id`,
    ADD COLUMN `password` VARCHAR(255) DEFAULT NULL AFTER `username`,
    ADD UNIQUE KEY `uq_faculty_username` (`username`);

ALTER TABLE `admin_staff`
    ADD COLUMN `username` VARCHAR(50)  DEFAULT NULL AFTER `fingerprint_id`,
    ADD COLUMN `password` VARCHAR(255) DEFAULT NULL AFTER `username`,
    ADD UNIQUE KEY `uq_adminstaff_username` (`username`);

-- NOTE: `username` is nullable and NOT NOT NULL — an employee without
-- portal access simply has no username/password set. NULL values are
-- exempt from MySQL's UNIQUE constraint (multiple NULLs are allowed),
-- so this is safe for employees who never get a login.
--
-- NOTE: MySQL cannot enforce uniqueness of `username` ACROSS separate
-- tables (users / faculty_staff / admin_staff) with a single constraint.
-- The application layer (see api/auth/login.php and the employee-save
-- endpoint) must check all three tables before accepting a new username,
-- to avoid two different people being able to log in with the same one.
