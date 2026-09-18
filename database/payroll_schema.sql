-- ============================================================================
-- Online Payroll System Using a Biometric Scanner
-- Database Schema for XAMPP (MySQL / MariaDB via phpMyAdmin)
-- Generated from the project's Data Dictionary (Tables 1-10) and cross-checked
-- against the frontend source code (js/*.js, *.html).
-- Engine: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `Payroll_DB`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `Payroll_DB`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. USERS
-- Data Dictionary Table 5. System accounts for System Administrator,
-- Payroll Master, and Payroll Staff (as scoped by the dictionary).
-- ============================================================================
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `user_id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `first_name`     VARCHAR(50)  NOT NULL,
    `last_name`      VARCHAR(50)  NOT NULL,
    `username`       VARCHAR(50)  NOT NULL,
    -- NOTE: widened from the documented varchar(50) to store a salted hash
    -- (e.g. bcrypt) rather than plaintext. See Assumptions #2.
    `password`       VARCHAR(255) NOT NULL,
    `role`           ENUM('System Administrator','Payroll Master','Payroll Staff') NOT NULL,
    `email`          VARCHAR(50)  NOT NULL,
    `contact_number` VARCHAR(50)  DEFAULT NULL,
    `is_active`      TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    UNIQUE KEY `uq_users_username` (`username`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. FACULTY_STAFF
-- Data Dictionary Table 1.
-- ============================================================================
DROP TABLE IF EXISTS `faculty_staff`;
CREATE TABLE `faculty_staff` (
    `faculty_id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `fingerprint_id`     VARCHAR(50)  DEFAULT NULL,
    -- Self-service login credentials (Migration 002). NULL = no portal
    -- access set up yet for this employee.
    `username`           VARCHAR(50)  DEFAULT NULL,
    `password`           VARCHAR(255) DEFAULT NULL,
    `firstname`          VARCHAR(50)  NOT NULL,
    `lastname`           VARCHAR(50)  NOT NULL,
    `middlename`         VARCHAR(50)  DEFAULT NULL,
    `gender`             VARCHAR(50)  DEFAULT NULL,
    `age`                INT UNSIGNED DEFAULT NULL,
    `birthdate`          DATE         DEFAULT NULL,
    `contact_number`     VARCHAR(50)  DEFAULT NULL,
    `address`            VARCHAR(50)  DEFAULT NULL,
    `email_address`      VARCHAR(50)  DEFAULT NULL,
    `civil_status`       VARCHAR(20)  DEFAULT NULL,
    `dependent_number`   INT UNSIGNED NOT NULL DEFAULT 0,
    `employment_status`  VARCHAR(50)  NOT NULL DEFAULT 'Active',
    `employee_type`      VARCHAR(20)  DEFAULT NULL,
    `date_hired`         DATE         DEFAULT NULL,
    `load_units`         INT UNSIGNED DEFAULT NULL,
    `lecture_hours`      DECIMAL(2,1) DEFAULT NULL,
    `rate_per_hour_unit` DECIMAL(10,2) DEFAULT NULL,
    `sss_id`             VARCHAR(50)  DEFAULT NULL,
    `philhealth_id`      VARCHAR(50)  DEFAULT NULL,
    `pagibig_id`         VARCHAR(50)  DEFAULT NULL,
    `tin_id`             VARCHAR(50)  DEFAULT NULL,
    `instructor_rank`    VARCHAR(20)  DEFAULT NULL,
    PRIMARY KEY (`faculty_id`),
    UNIQUE KEY `uq_faculty_fingerprint` (`fingerprint_id`),
    UNIQUE KEY `uq_faculty_username` (`username`),
    UNIQUE KEY `uq_faculty_email` (`email_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. ADMIN_STAFF
-- Data Dictionary Table 2.
-- ============================================================================
DROP TABLE IF EXISTS `admin_staff`;
CREATE TABLE `admin_staff` (
    `adminstaff_id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `fingerprint_id`     VARCHAR(50)  DEFAULT NULL,
    -- Self-service login credentials (Migration 002). NULL = no portal
    -- access set up yet for this employee.
    `username`           VARCHAR(50)  DEFAULT NULL,
    `password`           VARCHAR(255) DEFAULT NULL,
    `firstname`          VARCHAR(50)  NOT NULL,
    `lastname`           VARCHAR(50)  NOT NULL,
    `middlename`         VARCHAR(50)  DEFAULT NULL,
    `gender`             VARCHAR(50)  DEFAULT NULL,
    `age`                INT UNSIGNED DEFAULT NULL,
    `birthdate`          DATE         DEFAULT NULL,
    `contact_number`     VARCHAR(50)  DEFAULT NULL,
    `address`            VARCHAR(50)  DEFAULT NULL,
    `email_address`      VARCHAR(50)  DEFAULT NULL,
    `civil_status`       VARCHAR(20)  DEFAULT NULL,
    `dependent_number`   INT UNSIGNED NOT NULL DEFAULT 0,
    `employment_status`  VARCHAR(50)  NOT NULL DEFAULT 'Active',
    `employee_type`      VARCHAR(20)  DEFAULT NULL,
    `date_hired`         DATE         DEFAULT NULL,
    `department`         VARCHAR(50)  DEFAULT NULL,
    `office_hours`       DECIMAL(2,1) DEFAULT NULL,
    `rate_per_hour`      DECIMAL(10,2) DEFAULT NULL,
    `sss_id`             VARCHAR(50)  DEFAULT NULL,
    `philhealth_id`      VARCHAR(50)  DEFAULT NULL,
    `pagibig_id`         VARCHAR(50)  DEFAULT NULL,
    `tin_id`             VARCHAR(50)  DEFAULT NULL,
    `position`           VARCHAR(50)  DEFAULT NULL,
    PRIMARY KEY (`adminstaff_id`),
    UNIQUE KEY `uq_adminstaff_fingerprint` (`fingerprint_id`),
    UNIQUE KEY `uq_adminstaff_username` (`username`),
    UNIQUE KEY `uq_adminstaff_email` (`email_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. DEVICE
-- Data Dictionary Table 6.
-- ============================================================================
DROP TABLE IF EXISTS `device`;
CREATE TABLE `device` (
    `device_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `device_name` VARCHAR(50) NOT NULL,
    `location`    VARCHAR(50) DEFAULT NULL,
    `ip_address`  VARCHAR(50) DEFAULT NULL,
    `status`      ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    `date_added`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. LEAVE_CATEGORY  (supplementary — see Assumptions #6)
-- Configurable leave types managed on the Maintenance screen
-- (js/maintenance.js: leaveCategories).
-- ============================================================================
DROP TABLE IF EXISTS `leave_category`;
CREATE TABLE `leave_category` (
    `leave_category_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `category_name`     VARCHAR(50) NOT NULL,
    `is_paid`           TINYINT(1)  NOT NULL DEFAULT 1,
    `max_days`          INT UNSIGNED NOT NULL,
    `is_active`         TINYINT(1)  NOT NULL DEFAULT 1,
    PRIMARY KEY (`leave_category_id`),
    UNIQUE KEY `uq_leave_category_name` (`category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. BIR_TAX_BRACKET (supplementary — see Assumptions #6)
-- Withholding tax table, versioned by year (js/maintenance.js: birStore).
-- ============================================================================
DROP TABLE IF EXISTS `bir_tax_bracket`;
CREATE TABLE `bir_tax_bracket` (
    `bracket_id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `effective_year` YEAR NOT NULL,
    `salary_min`     DECIMAL(10,2) NOT NULL,
    `salary_max`     DECIMAL(10,2) DEFAULT NULL COMMENT 'NULL = open-ended top bracket',
    `base_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0,
    `rate_percent`   DECIMAL(5,2)  NOT NULL,
    PRIMARY KEY (`bracket_id`),
    UNIQUE KEY `uq_bir_year_min` (`effective_year`, `salary_min`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. PHILHEALTH_BRACKET (supplementary — see Assumptions #6)
-- ============================================================================
DROP TABLE IF EXISTS `philhealth_bracket`;
CREATE TABLE `philhealth_bracket` (
    `bracket_id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `effective_year`  YEAR NOT NULL,
    `salary_min`      DECIMAL(10,2) NOT NULL,
    `salary_max`      DECIMAL(10,2) DEFAULT NULL,
    `monthly_premium` DECIMAL(10,2) DEFAULT NULL COMMENT 'NULL = computed from rate_percent',
    `rate_percent`    DECIMAL(5,2)  NOT NULL,
    PRIMARY KEY (`bracket_id`),
    UNIQUE KEY `uq_philhealth_year_min` (`effective_year`, `salary_min`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. PAGIBIG_BRACKET (supplementary — see Assumptions #6)
-- ============================================================================
DROP TABLE IF EXISTS `pagibig_bracket`;
CREATE TABLE `pagibig_bracket` (
    `bracket_id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `effective_year`    YEAR NOT NULL,
    `compensation_min`  DECIMAL(10,2) NOT NULL,
    `compensation_max`  DECIMAL(10,2) DEFAULT NULL,
    `employee_share`    DECIMAL(10,2) DEFAULT NULL COMMENT 'NULL = computed from rate_percent',
    `rate_percent`      DECIMAL(5,2)  NOT NULL,
    PRIMARY KEY (`bracket_id`),
    UNIQUE KEY `uq_pagibig_year_min` (`effective_year`, `compensation_min`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. EMPLOYEE_RATE (supplementary — see Assumptions #6)
-- Versioned pay-rate history per employee (js/maintenance.js: rates).
-- Exactly one of faculty_id / adminstaff_id must be set.
-- ============================================================================
DROP TABLE IF EXISTS `employee_rate`;
CREATE TABLE `employee_rate` (
    `rate_id`        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faculty_id`     INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`  INT UNSIGNED DEFAULT NULL,
    `rate_type`      VARCHAR(20)   NOT NULL COMMENT 'e.g. Per Unit, Per Hour',
    `amount`         DECIMAL(10,2) NOT NULL,
    `effective_date` DATE          NOT NULL,
    `end_date`       DATE          DEFAULT NULL,
    `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
    PRIMARY KEY (`rate_id`),
    KEY `idx_rate_faculty` (`faculty_id`),
    KEY `idx_rate_adminstaff` (`adminstaff_id`),
    CONSTRAINT `fk_rate_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_rate_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `chk_rate_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. DAILY_TIME_RECORD (DTR)
-- Data Dictionary Table 3. PK corrected to a surrogate id — see Assumptions #3.
-- Exactly one of faculty_id / adminstaff_id must be set.
-- ============================================================================
DROP TABLE IF EXISTS `daily_time_record`;
CREATE TABLE `daily_time_record` (
    `dtr_id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `fingerprint_id`     VARCHAR(50)  DEFAULT NULL COMMENT 'Raw biometric scan reference captured at log time',
    `device_id`          INT UNSIGNED NOT NULL,
    `faculty_id`         INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`      INT UNSIGNED DEFAULT NULL,
    `record_date`        DATE NOT NULL,
    `time_in`            TIME DEFAULT NULL,
    `time_out`           TIME DEFAULT NULL,
    `number_of_holidays` INT UNSIGNED NOT NULL DEFAULT 0,
    `status`             VARCHAR(20) NOT NULL DEFAULT 'Present' COMMENT 'Present, Late, Absent, Leave',
    -- Supplementary field, see Assumptions #6 (js/dtr.js: manual entry flag)
    `is_manual_entry`    TINYINT(1)  NOT NULL DEFAULT 0,
    `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`dtr_id`),
    KEY `idx_dtr_device` (`device_id`),
    KEY `idx_dtr_faculty_date` (`faculty_id`, `record_date`),
    KEY `idx_dtr_adminstaff_date` (`adminstaff_id`, `record_date`),
    CONSTRAINT `fk_dtr_device` FOREIGN KEY (`device_id`) REFERENCES `device` (`device_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_dtr_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_dtr_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `chk_dtr_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. PAYROLL
-- Data Dictionary Table 4. faculty_id/adminstaff_id added — see Assumptions #4.
-- Exactly one of faculty_id / adminstaff_id must be set.
-- ============================================================================
DROP TABLE IF EXISTS `payroll`;
CREATE TABLE `payroll` (
    `payroll_id`               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faculty_id`               INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`            INT UNSIGNED DEFAULT NULL,
    `firstname`                VARCHAR(50) NOT NULL,
    `middlename`               VARCHAR(50) DEFAULT NULL,
    `lastname`                 VARCHAR(50) NOT NULL,
    `basic_salary`             DECIMAL(10,2) NOT NULL DEFAULT 0,
    `gross_pay`                DECIMAL(10,2) NOT NULL DEFAULT 0,
    `net_pay`                  DECIMAL(10,2) NOT NULL DEFAULT 0,
    `benefits`                 DECIMAL(10,2) NOT NULL DEFAULT 0,
    `total_hours_worked`       DECIMAL(5,2)  DEFAULT NULL,
    `employee_rate`            DECIMAL(10,2) DEFAULT NULL,
    `total_deductions`         DECIMAL(10,2) NOT NULL DEFAULT 0,
    `other_deductions`         DECIMAL(10,2) NOT NULL DEFAULT 0,
    `sss_contribution`         DECIMAL(10,2) NOT NULL DEFAULT 0,
    `philhealth_contribution`  DECIMAL(10,2) NOT NULL DEFAULT 0,
    `pagibig_contribution`     DECIMAL(10,2) NOT NULL DEFAULT 0,
    `sss_loan`                 DECIMAL(10,2) NOT NULL DEFAULT 0,
    `pagibig_loan`             DECIMAL(10,2) NOT NULL DEFAULT 0,
    `tax`                      DECIMAL(10,2) NOT NULL DEFAULT 0,
    `pay_period_start`         DATE NOT NULL,
    `pay_period_end`           DATE NOT NULL,
    -- Supplementary fields, see Assumptions #6 (js/payroll-processing.js)
    `status`                   ENUM('Open','Processing','Reviewed','Released') NOT NULL DEFAULT 'Open',
    `pay_date`                 DATE DEFAULT NULL,
    `date_generated`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`payroll_id`),
    KEY `idx_payroll_faculty` (`faculty_id`),
    KEY `idx_payroll_adminstaff` (`adminstaff_id`),
    KEY `idx_payroll_period` (`pay_period_start`, `pay_period_end`),
    CONSTRAINT `fk_payroll_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_payroll_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `chk_payroll_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. DEDUCTION
-- Data Dictionary Table 7.
-- Exactly one of faculty_id / adminstaff_id must be set.
-- ============================================================================
DROP TABLE IF EXISTS `deduction`;
CREATE TABLE `deduction` (
    `deduction_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faculty_id`     INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`  INT UNSIGNED DEFAULT NULL,
    `payroll_id`     INT UNSIGNED NOT NULL,
    `deduction_type` VARCHAR(50) NOT NULL COMMENT 'SSS, PhilHealth, Pagibig, Tax, Loan, etc.',
    `amount`         DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (`deduction_id`),
    KEY `idx_deduction_faculty` (`faculty_id`),
    KEY `idx_deduction_adminstaff` (`adminstaff_id`),
    KEY `idx_deduction_payroll` (`payroll_id`),
    CONSTRAINT `fk_deduction_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_deduction_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_deduction_payroll` FOREIGN KEY (`payroll_id`) REFERENCES `payroll` (`payroll_id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `chk_deduction_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. LEAVE_RECORD  (Data Dictionary calls this table "Leave"; renamed
-- because LEAVE is a reserved word in MySQL — see Assumptions #3.)
-- Data Dictionary Table 8. faculty_id added — see Assumptions #4.
-- Exactly one of faculty_id / adminstaff_id must be set.
-- ============================================================================
DROP TABLE IF EXISTS `leave_record`;
CREATE TABLE `leave_record` (
    `leave_id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faculty_id`          INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`       INT UNSIGNED DEFAULT NULL,
    `leave_category`      VARCHAR(50) NOT NULL,
    `status`              VARCHAR(50) NOT NULL DEFAULT 'Pending' COMMENT 'Pending, Approved, Rejected, Cancelled',
    `date_requested`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `date_approved`       DATETIME DEFAULT NULL,
    `approved_by`         VARCHAR(50) DEFAULT NULL,
    `date_from`           DATE NOT NULL,
    `date_to`             DATE NOT NULL,
    `remarks`             VARCHAR(50) DEFAULT NULL,
    `total_days`          INT UNSIGNED DEFAULT NULL,
    `total_leave_credit`  INT UNSIGNED DEFAULT NULL,
    `used_leave`          INT UNSIGNED DEFAULT NULL,
    `remaining_leave`     INT DEFAULT NULL,
    PRIMARY KEY (`leave_id`),
    KEY `idx_leave_faculty` (`faculty_id`),
    KEY `idx_leave_adminstaff` (`adminstaff_id`),
    CONSTRAINT `fk_leave_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_leave_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `chk_leave_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. LOAN
-- Data Dictionary Table 9. Heavily extended — see Assumptions #5.
-- The dictionary's version has no employee reference at all; faculty_id/
-- adminstaff_id, term_months, monthly_deduction, remaining_balance, status
-- and remarks were added because the frontend (loan-application.js,
-- leave-loan-approval.js) requires them for the feature to function.
-- `current_date` was renamed to `date_filed` because CURRENT_DATE is a
-- reserved MySQL function name.
-- ============================================================================
DROP TABLE IF EXISTS `loan`;
CREATE TABLE `loan` (
    `loan_id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faculty_id`         INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`      INT UNSIGNED DEFAULT NULL,
    `loan_type`          VARCHAR(50) NOT NULL COMMENT 'SSS Loan, Pag-IBIG Loan, Personal/Institutional Loan',
    `loan_amount`        DECIMAL(10,2) NOT NULL,
    `term_months`        INT UNSIGNED DEFAULT NULL,
    `monthly_deduction`  DECIMAL(10,2) DEFAULT NULL,
    `remaining_balance`  DECIMAL(10,2) DEFAULT NULL,
    `status`             VARCHAR(20) NOT NULL DEFAULT 'Pending' COMMENT 'Pending, Approved, Rejected, Fully Paid',
    `remarks`            VARCHAR(255) DEFAULT NULL,
    `date_filed`         DATE DEFAULT NULL,
    `date_from`          DATE DEFAULT NULL,
    `date_to`            DATE DEFAULT NULL,
    PRIMARY KEY (`loan_id`),
    KEY `idx_loan_faculty` (`faculty_id`),
    KEY `idx_loan_adminstaff` (`adminstaff_id`),
    CONSTRAINT `fk_loan_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_loan_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `chk_loan_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. THIRTEENTH_MONTH_PAY
-- Data Dictionary Table 10. Surrogate primary key added because the
-- dictionary listed no ID column at all — see Assumptions #4.
-- Exactly one of faculty_id / adminstaff_id must be set.
-- ============================================================================
DROP TABLE IF EXISTS `thirteenth_month_pay`;
CREATE TABLE `thirteenth_month_pay` (
    `thirteenth_month_id`  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `faculty_id`           INT UNSIGNED DEFAULT NULL,
    `adminstaff_id`        INT UNSIGNED DEFAULT NULL,
    `annual_gross_salary`  DECIMAL(10,2) NOT NULL,
    `amount`               DECIMAL(10,2) NOT NULL,
    `pay_year`             YEAR DEFAULT NULL,
    `date_generated`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`thirteenth_month_id`),
    KEY `idx_13th_faculty` (`faculty_id`),
    KEY `idx_13th_adminstaff` (`adminstaff_id`),
    CONSTRAINT `fk_13th_faculty` FOREIGN KEY (`faculty_id`) REFERENCES `faculty_staff` (`faculty_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `fk_13th_adminstaff` FOREIGN KEY (`adminstaff_id`) REFERENCES `admin_staff` (`adminstaff_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
    CONSTRAINT `chk_13th_emp_xor` CHECK (
        (`faculty_id` IS NOT NULL AND `adminstaff_id` IS NULL) OR
        (`faculty_id` IS NULL AND `adminstaff_id` IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 16. MAINTENANCE_AUDIT_LOG (supplementary — see Assumptions #6)
-- Change history for rates, brackets, and leave categories
-- (js/maintenance.js: logAudit()).
-- ============================================================================
DROP TABLE IF EXISTS `maintenance_audit_log`;
CREATE TABLE `maintenance_audit_log` (
    `audit_id`      INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id`       INT UNSIGNED DEFAULT NULL,
    `performed_by`  VARCHAR(100) DEFAULT NULL COMMENT 'Fallback display name if user_id is not linked',
    `section`       VARCHAR(50) NOT NULL COMMENT 'Employee Rates, Leave Categories, BIR Table, etc.',
    `action`        VARCHAR(50) NOT NULL COMMENT 'Added, Updated, Deactivated, Removed bracket, etc.',
    `detail`        VARCHAR(255) DEFAULT NULL,
    `performed_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`audit_id`),
    KEY `idx_audit_user` (`user_id`),
    CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
