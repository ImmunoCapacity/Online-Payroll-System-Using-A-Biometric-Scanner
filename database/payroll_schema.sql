-- ---------------------------------------------------------------
-- Payroll_DB — Online Payroll System Using a Biometric Scanner
-- Follows the Data Dictionary in the capstone paper (Tables 1–10).
--
-- Deviations from the paper, and why:
--   * users.password is VARCHAR(255): it holds a BCrypt hash (60 chars),
--     never plain passwords.
--   * daily_time_record has its own dtr_id key and a record_date column; the
--     paper's fingerprint_id cannot be the key, since one person punches every day.
--   * faculty_staff / admin_staff also carry employee_number and notes,
--     used by Employee Records. Employees are records, not users: they have
--     no username or password and cannot log in. Only the users table logs in.
--   * loan and employee_leave get employee foreign keys so a record can be
--     traced to its employee. "leave" is a reserved word in MySQL, hence
--     employee_leave.
--   * lecture_hours / office_hours are DECIMAL(4,1); the paper's DECIMAL(2,1)
--     can only hold up to 9.9 hours.
--   * Tables 11–22 at the end are not in the paper's data dictionary but are
--     needed by modules the paper's Scope describes (Deduction Tables,
--     Leave Category Maintenance, Benefit Maintenance, Employee Rank,
--     Employee Schedule, Audit Trail, Faculty Schedule, Faculty Teaching
--     Hours).
--
-- This one file builds the whole database: every table, column and seed
-- row. Import it once in phpMyAdmin (XAMPP) or:
--     mysql -u root < database/payroll_schema.sql
-- Running it again on an existing Payroll_DB only adds missing tables; it
-- does not add new columns to tables that already exist.
-- ---------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS Payroll_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE Payroll_DB;

-- Table 5. Users — the only accounts that can log in.
-- role is exactly one of: Payroll Master | Payroll Staff | System Administrator
CREATE TABLE IF NOT EXISTS users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    first_name     VARCHAR(50)  NOT NULL,
    middle_name    VARCHAR(50),
    last_name      VARCHAR(50)  NOT NULL,
    username       VARCHAR(50)  UNIQUE,
    password       VARCHAR(255) NOT NULL,
    role           VARCHAR(50)  NOT NULL
                   CHECK (role IN ('Payroll Master', 'Payroll Staff', 'System Administrator')),
    email          VARCHAR(100) NOT NULL UNIQUE,
    contact_number VARCHAR(50),
    is_active      TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Table 1. Faculty Staff
CREATE TABLE IF NOT EXISTS faculty_staff (
    faculty_id         INT AUTO_INCREMENT PRIMARY KEY,
    employee_number    VARCHAR(50)  NOT NULL UNIQUE,
    fingerprint_id     VARCHAR(50)  UNIQUE,         -- = the K40's "User ID" for this person
    firstname          VARCHAR(50)  NOT NULL,
    middlename         VARCHAR(50),
    lastname           VARCHAR(50)  NOT NULL,
    gender             VARCHAR(50),
    age                INT,
    birthdate          DATE,
    contact_number     VARCHAR(50),
    address            VARCHAR(255),
    email_address      VARCHAR(100) NOT NULL UNIQUE,
    civil_status       VARCHAR(20),
    dependent_number   INT DEFAULT 0,
    employment_status  VARCHAR(50)  NOT NULL DEFAULT 'Active',
    employee_type      VARCHAR(20),                 -- full-time | part-time | contractual | temporary
    date_hired         DATE,
    load_units         INT,
    lecture_hours      DECIMAL(4,1),
    rate_per_hour_unit DECIMAL(10,2),
    sss_id             VARCHAR(50),
    philhealth_id      VARCHAR(50),
    pagibig_id         VARCHAR(50),
    tin_id             VARCHAR(50),
    instructor_rank    VARCHAR(20),                 -- Instructor I | II | III
    notes              TEXT
) ENGINE=InnoDB;

-- Table 2. Admin Staff
CREATE TABLE IF NOT EXISTS admin_staff (
    adminstaff_id      INT AUTO_INCREMENT PRIMARY KEY,
    employee_number    VARCHAR(50)  NOT NULL UNIQUE,
    fingerprint_id     VARCHAR(50)  UNIQUE,
    firstname          VARCHAR(50)  NOT NULL,
    middlename         VARCHAR(50),
    lastname           VARCHAR(50)  NOT NULL,
    gender             VARCHAR(50),
    age                INT,
    birthdate          DATE,
    contact_number     VARCHAR(50),
    address            VARCHAR(255),
    email_address      VARCHAR(100) NOT NULL UNIQUE,
    civil_status       VARCHAR(20),
    dependent_number   INT DEFAULT 0,
    employment_status  VARCHAR(50)  NOT NULL DEFAULT 'Active',
    employee_type      VARCHAR(20),
    date_hired         DATE,
    department         VARCHAR(50),
    position           VARCHAR(50),
    office_hours       DECIMAL(4,1),
    rate_per_hour      DECIMAL(10,2),
    -- "Faculty/Admin": admin staff who also teach (paper, Payroll Module).
    -- They carry the faculty fields of Table 1 as well.
    is_faculty         TINYINT(1)    NOT NULL DEFAULT 0,
    instructor_rank    VARCHAR(20),
    rate_per_hour_unit DECIMAL(10,2),
    load_units         INT,
    lecture_hours      DECIMAL(4,1),
    sss_id             VARCHAR(50),
    philhealth_id      VARCHAR(50),
    pagibig_id         VARCHAR(50),
    tin_id             VARCHAR(50),
    notes              TEXT
) ENGINE=InnoDB;

-- Table 6. Device — biometric scanners
CREATE TABLE IF NOT EXISTS device (
    device_id   INT AUTO_INCREMENT PRIMARY KEY,
    device_name VARCHAR(50) NOT NULL,
    location    VARCHAR(50),
    ip_address  VARCHAR(50) NOT NULL UNIQUE,
    status      VARCHAR(20) NOT NULL DEFAULT 'Active',
    date_added  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Table 3. Daily Time Record — one row per employee per day
CREATE TABLE IF NOT EXISTS daily_time_record (
    dtr_id             INT AUTO_INCREMENT PRIMARY KEY,
    fingerprint_id     VARCHAR(50),
    device_id          INT,
    faculty_id         INT,
    adminstaff_id      INT,
    record_date        DATE        NOT NULL,
    time_in            TIME,
    time_out           TIME,
    number_of_holidays INT         DEFAULT 0,
    status             VARCHAR(20),                 -- Present | Late | Absent
    is_manual_entry    TINYINT(1)  NOT NULL DEFAULT 0,
    remarks            VARCHAR(255),               -- reason for a manual entry
    recorded_by        INT,                        -- users.user_id who encoded a manual entry
    created_at         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_dtr_faculty_day (faculty_id, record_date),
    UNIQUE KEY uq_dtr_admin_day (adminstaff_id, record_date),
    CONSTRAINT fk_dtr_device  FOREIGN KEY (device_id)     REFERENCES device (device_id)          ON DELETE SET NULL,
    CONSTRAINT fk_dtr_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_dtr_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 4. Payroll — one computed payslip per employee per pay period
CREATE TABLE IF NOT EXISTS payroll (
    payroll_id              INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id              INT,
    adminstaff_id           INT,
    firstname               VARCHAR(50),
    middlename              VARCHAR(50),
    lastname                VARCHAR(50),
    basic_salary            DECIMAL(10,2) DEFAULT 0,
    gross_pay               DECIMAL(10,2) DEFAULT 0,
    net_pay                 DECIMAL(10,2) DEFAULT 0,
    benefits                DECIMAL(10,2) DEFAULT 0,
    total_hours_worked      DECIMAL(6,2)  DEFAULT 0,
    employee_rate           DECIMAL(10,2) DEFAULT 0,
    total_deductions        DECIMAL(10,2) DEFAULT 0,
    other_deductions        DECIMAL(10,2) DEFAULT 0,
    sss_contribution        DECIMAL(10,2) DEFAULT 0,
    philhealth_contribution DECIMAL(10,2) DEFAULT 0,
    pagibig_contribution    DECIMAL(10,2) DEFAULT 0,
    sss_loan                DECIMAL(10,2) DEFAULT 0,
    pagibig_loan            DECIMAL(10,2) DEFAULT 0,
    tax                     DECIMAL(10,2) DEFAULT 0,
    pay_period_start        DATE NOT NULL,
    pay_period_end          DATE NOT NULL,
    date_generated          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payroll_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_payroll_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 7. Deduction — itemised deductions of a payroll row
CREATE TABLE IF NOT EXISTS deduction (
    deduction_id   INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id     INT,
    adminstaff_id  INT,
    payroll_id     INT NOT NULL,
    deduction_type VARCHAR(50)   NOT NULL,          -- SSS | PhilHealth | Pagibig | Tax | Loan
    amount         DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_deduction_payroll FOREIGN KEY (payroll_id)    REFERENCES payroll (payroll_id)          ON DELETE CASCADE,
    CONSTRAINT fk_deduction_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_deduction_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 8. Leave
CREATE TABLE IF NOT EXISTS employee_leave (
    leave_id           INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id         INT,
    adminstaff_id      INT,
    leave_category     VARCHAR(50) NOT NULL,        -- sick | vacation | maternity | paternity | ...
    status             VARCHAR(50) NOT NULL DEFAULT 'Pending',
    date_requested     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_approved      DATETIME,
    approved_by        VARCHAR(50),
    date_from          DATE        NOT NULL,
    date_to            DATE        NOT NULL,
    remarks            VARCHAR(255),
    total_days         INT,
    total_leave_credit INT,
    used_leave         INT,
    remaining_leave    INT,
    CONSTRAINT fk_leave_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_leave_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 9. Loan
CREATE TABLE IF NOT EXISTS loan (
    loan_id       INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id    INT,
    adminstaff_id INT,
    loan_type     VARCHAR(50)   NOT NULL,           -- SSS Loan | Pag-IBIG Loan | Personal Loan
    loan_amount   DECIMAL(10,2) NOT NULL,
    `current_date` DATE         NOT NULL,           -- date the loan was recorded/approved
    date_from     DATE,
    date_to       DATE,
    CONSTRAINT fk_loan_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_loan_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 10. 13th Month Pay
CREATE TABLE IF NOT EXISTS thirteenth_month_pay (
    thirteenth_month_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id          INT,
    adminstaff_id       INT,
    year_covered        YEAR          NOT NULL,
    annual_gross_salary DECIMAL(10,2) NOT NULL,
    amount              DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_13th_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_13th_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Tables below are required by modules in the paper's Scope but are
-- missing from its Data Dictionary.
-- ---------------------------------------------------------------

-- 11. Deduction Tables module (6.1–6.4): contribution / tax brackets per year.
--     Monthly amounts; payroll applies them to the monthly equivalent of pay.
CREATE TABLE IF NOT EXISTS bir_table (
    bir_id         INT AUTO_INCREMENT PRIMARY KEY,
    effective_year YEAR          NOT NULL,
    bracket_min    DECIMAL(12,2) NOT NULL,
    bracket_max    DECIMAL(12,2),                -- NULL = and above
    base_tax       DECIMAL(12,2) NOT NULL DEFAULT 0,
    rate_percent   DECIMAL(5,2)  NOT NULL         -- applied to the excess over bracket_min
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS philhealth_table (
    philhealth_id   INT AUTO_INCREMENT PRIMARY KEY,
    effective_year  YEAR          NOT NULL,
    salary_min      DECIMAL(12,2) NOT NULL,
    salary_max      DECIMAL(12,2),
    monthly_premium DECIMAL(12,2),               -- fixed premium, or NULL = salary x rate
    rate_percent    DECIMAL(5,2)  NOT NULL        -- total premium rate, shared 50/50
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagibig_table (
    pagibig_id       INT AUTO_INCREMENT PRIMARY KEY,
    effective_year   YEAR          NOT NULL,
    compensation_min DECIMAL(12,2) NOT NULL,
    compensation_max DECIMAL(12,2),
    employee_share   DECIMAL(12,2),              -- fixed share, or NULL = compensation x rate
    rate_percent     DECIMAL(5,2)  NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sss_table (
    sss_id                INT AUTO_INCREMENT PRIMARY KEY,
    effective_year        YEAR          NOT NULL,
    compensation_min      DECIMAL(12,2) NOT NULL,
    compensation_max      DECIMAL(12,2),
    monthly_salary_credit DECIMAL(12,2) NOT NULL,
    employee_rate_percent DECIMAL(5,2)  NOT NULL  -- employee share of the MSC
) ENGINE=InnoDB;

-- 12. Leave Category Maintenance (5.3)
CREATE TABLE IF NOT EXISTS leave_category (
    leave_category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name     VARCHAR(50) NOT NULL UNIQUE,  -- sick, vacation, maternity, paternity, ...
    is_paid           TINYINT(1)  NOT NULL DEFAULT 1,
    is_active         TINYINT(1)  NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- 13. Leave credits per employee (Employee Records Management: "manage the
--     number of leave credits allocated per employee"; interview: 15 days).
CREATE TABLE IF NOT EXISTS leave_credit (
    leave_credit_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id      INT,
    adminstaff_id   INT,
    year_covered    YEAR NOT NULL,
    total_credits   INT  NOT NULL DEFAULT 15,
    CONSTRAINT fk_credit_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_credit_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 14. Benefit Maintenance (9.3)
CREATE TABLE IF NOT EXISTS benefit (
    benefit_id   INT AUTO_INCREMENT PRIMARY KEY,
    benefit_name VARCHAR(50)   NOT NULL UNIQUE,   -- rice, transportation, uniform, chalk, ...
    default_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active    TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS employee_benefit (
    employee_benefit_id INT AUTO_INCREMENT PRIMARY KEY,
    benefit_id    INT NOT NULL,
    faculty_id    INT,
    adminstaff_id INT,
    amount        DECIMAL(10,2) NOT NULL,          -- per payroll period
    CONSTRAINT fk_eb_benefit FOREIGN KEY (benefit_id)    REFERENCES benefit (benefit_id)          ON DELETE CASCADE,
    CONSTRAINT fk_eb_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_eb_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 15. Employee Rank management ("add new ranks as needed")
CREATE TABLE IF NOT EXISTS employee_rank (
    rank_id   INT AUTO_INCREMENT PRIMARY KEY,
    rank_name VARCHAR(20) NOT NULL UNIQUE           -- Instructor I, Instructor II, Instructor III, ...
) ENGINE=InnoDB;

INSERT IGNORE INTO employee_rank (rank_name) VALUES ('Instructor I'), ('Instructor II'), ('Instructor III');

-- 16. Employee Schedule module — old weekly teaching slots. Superseded by
--     faculty_class_schedule (19); kept so existing data is not lost.
CREATE TABLE IF NOT EXISTS employee_schedule (
    schedule_id   INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id    INT,
    adminstaff_id INT,
    day_of_week   VARCHAR(3)  NOT NULL,             -- Mon, Tue, ...
    time_start    TIME        NOT NULL,
    time_end      TIME        NOT NULL,
    subject       VARCHAR(100),                     -- faculty teaching load; NULL for office hours
    CONSTRAINT fk_sched_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_sched_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 17. Audit Trail (Utility 10.3)
CREATE TABLE IF NOT EXISTS audit_trail (
    audit_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT,
    module     VARCHAR(50)  NOT NULL,
    action     VARCHAR(100) NOT NULL,
    details    VARCHAR(255),
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 18. Payroll Computation History: one row per payroll run
CREATE TABLE IF NOT EXISTS payroll_run (
    payroll_run_id   INT AUTO_INCREMENT PRIMARY KEY,
    pay_period_start DATE        NOT NULL,
    pay_period_end   DATE        NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'Computed',   -- Computed | Reviewed | Released
    computed_by      INT,
    computed_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_run_user FOREIGN KEY (computed_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 19–22. Faculty Schedule (planned classes) and Faculty Teaching Hours
--        (manual classroom checks, approval, audit).
--        19 faculty_class_schedule: one row per class meeting. Faculty/Admin
--           staff (admin_staff with is_faculty = 1) use adminstaff_id. The
--           grace period is fixed at 15 minutes by the application.
--        20 faculty_schedule_history: every change to a class.
--        21 faculty_teaching_attendance: the beginning and ending classroom
--           checks. Check times are verification times, not time-in/out.
--           payable_hours is set on approval; payroll pays approved rows only.
--        22 faculty_attendance_audit: every check, correction, approval and
--           rejection.
CREATE TABLE IF NOT EXISTS faculty_class_schedule (
    class_schedule_id    INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id           INT,
    adminstaff_id        INT,
    subject              VARCHAR(100) NOT NULL,
    class_section        VARCHAR(50)  NOT NULL,
    room                 VARCHAR(50),
    class_date           DATE         NOT NULL,
    scheduled_start      TIME         NOT NULL,
    scheduled_end        TIME         NOT NULL,
    grace_period_minutes INT          NOT NULL DEFAULT 15,
    schedule_status      VARCHAR(20)  NOT NULL DEFAULT 'Scheduled',   -- Scheduled | Cancelled
    status_reason        VARCHAR(255),                                -- why it was cancelled
    created_by           INT,
    updated_by           INT,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_fcs_one_employee CHECK ((faculty_id IS NULL) <> (adminstaff_id IS NULL)),
    CONSTRAINT chk_fcs_times        CHECK (scheduled_end > scheduled_start),
    CONSTRAINT chk_fcs_grace        CHECK (grace_period_minutes BETWEEN 0 AND 60),
    CONSTRAINT fk_fcs_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_fcs_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE,
    CONSTRAINT fk_fcs_created FOREIGN KEY (created_by)    REFERENCES users (user_id)              ON DELETE SET NULL,
    CONSTRAINT fk_fcs_updated FOREIGN KEY (updated_by)    REFERENCES users (user_id)              ON DELETE SET NULL,
    INDEX idx_fcs_date (class_date)
) ENGINE=InnoDB;

-- Change history of each class (created, edited, cancelled, restored).
CREATE TABLE IF NOT EXISTS faculty_schedule_history (
    history_id        INT AUTO_INCREMENT PRIMARY KEY,
    class_schedule_id INT          NOT NULL,
    action            VARCHAR(20)  NOT NULL,
    details           TEXT,
    changed_by        INT,
    changed_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_fsh_class FOREIGN KEY (class_schedule_id) REFERENCES faculty_class_schedule (class_schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_fsh_user  FOREIGN KEY (changed_by)        REFERENCES users (user_id)                            ON DELETE SET NULL
) ENGINE=InnoDB;

-- Faculty Teaching Hours: the two classroom checks of one scheduled class.
-- The check times are when the classroom was verified, NOT the faculty
-- member's time-in or time-out. payable_hours is set when approved.
CREATE TABLE IF NOT EXISTS faculty_teaching_attendance (
    attendance_id      INT AUTO_INCREMENT PRIMARY KEY,
    class_schedule_id  INT          NOT NULL UNIQUE,
    start_check_at     DATETIME,
    start_check_status VARCHAR(10),                                  -- Present | Absent
    start_checked_by   INT,
    end_check_at       DATETIME,
    end_check_status   VARCHAR(10),                                  -- Present | Absent
    end_checked_by     INT,
    remarks            VARCHAR(255),
    approval_status    VARCHAR(20)  NOT NULL DEFAULT 'Incomplete',   -- Incomplete | Pending | Approved | Rejected
    payable_hours      DECIMAL(5,2),
    approved_by        INT,
    approved_at        DATETIME,
    review_note        VARCHAR(255),
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_fta_class    FOREIGN KEY (class_schedule_id) REFERENCES faculty_class_schedule (class_schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_fta_start_by FOREIGN KEY (start_checked_by)  REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_fta_end_by   FOREIGN KEY (end_checked_by)    REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_fta_approver FOREIGN KEY (approved_by)       REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Every check, correction, approval and rejection, so nothing changes silently.
CREATE TABLE IF NOT EXISTS faculty_attendance_audit (
    audit_id      INT AUTO_INCREMENT PRIMARY KEY,
    attendance_id INT          NOT NULL,
    action        VARCHAR(30)  NOT NULL,
    details       TEXT,
    reason        VARCHAR(255),
    performed_by  INT,
    performed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faa_attendance FOREIGN KEY (attendance_id) REFERENCES faculty_teaching_attendance (attendance_id) ON DELETE CASCADE,
    CONSTRAINT fk_faa_user       FOREIGN KEY (performed_by)  REFERENCES users (user_id)                             ON DELETE SET NULL
) ENGINE=InnoDB;
