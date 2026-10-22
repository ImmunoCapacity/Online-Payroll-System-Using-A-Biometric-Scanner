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
--   * faculty_staff / admin_staff have is_archived / archived_at: employees are
--     archived, never deleted, so their payroll, DTR, leave and loan history
--     stays. Archived employees are hidden from lists and pickers.
--   * loan and employee_leave get employee foreign keys so a record can be
--     traced to its employee. "leave" is a reserved word in MySQL, hence
--     employee_leave.
--   * lecture_hours / office_hours are DECIMAL(4,1); the paper's DECIMAL(2,1)
--     can only hold up to 9.9 hours.
--   * Tables 11–24 at the end are not in the paper's data dictionary but are
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
    is_active      TINYINT(1)   NOT NULL DEFAULT 1,
    password_changed_at DATETIME                 -- last password change (by the System Administrator or Forgot Password)
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
    employee_type      VARCHAR(20),                 -- full-time | part-time | contractual
    date_hired         DATE,
    load_units         INT,
    lecture_hours      DECIMAL(4,1),
    rate_per_hour_unit DECIMAL(10,2),
    sss_id             VARCHAR(50),
    philhealth_id      VARCHAR(50),
    pagibig_id         VARCHAR(50),
    tin_id             VARCHAR(50),
    instructor_rank    VARCHAR(20),                 -- Instructor I | II | III
    notes              TEXT,
    basic_pay          DECIMAL(10,2),                   -- monthly basic pay (record only; payroll uses hours x rate)
    is_archived        TINYINT(1)   NOT NULL DEFAULT 0,  -- archived records are kept, never deleted
    archived_at        DATETIME
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
    notes              TEXT,
    basic_pay          DECIMAL(10,2),                   -- monthly basic pay (record only; payroll uses hours x rate)
    is_archived        TINYINT(1)   NOT NULL DEFAULT 0,  -- archived records are kept, never deleted
    archived_at        DATETIME
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

-- 18. Payroll Computation History: one row per pay period that was run.
--     (Numbered with the extra tables below; defined here because payroll
--     rows point to it.)
CREATE TABLE IF NOT EXISTS payroll_run (
    payroll_run_id   INT AUTO_INCREMENT PRIMARY KEY,
    pay_period_start DATE        NOT NULL,
    pay_period_end   DATE        NOT NULL,
    period_label     VARCHAR(60),
    status           VARCHAR(20) NOT NULL DEFAULT 'Processing',  -- Processing | Released
    computed_by      INT,
    computed_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_by      INT,
    released_at      DATETIME,
    distributed_at   DATETIME,                                   -- payslips last emailed
    emails_sent      INT,
    emails_total     INT,
    UNIQUE KEY uq_run_period (pay_period_start, pay_period_end),
    CONSTRAINT fk_run_user     FOREIGN KEY (computed_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT fk_run_releaser FOREIGN KEY (released_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Table 4. Payroll — one computed payslip per employee per pay period.
--   payroll_run_id .. email_message are additions: the run the row belongs
--   to, the employee's number and staff type when paid, the review status,
--   the itemised breakdown (earnings lines, benefits, loans) as JSON, and
--   whether the payslip email was sent.
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
    payroll_run_id          INT,
    employee_number         VARCHAR(20),
    employee_type           VARCHAR(20),                  -- Faculty | Admin | Faculty/Admin
    review_status           VARCHAR(20) NOT NULL DEFAULT 'Computed',  -- Computed | Reviewed | Released
    breakdown               LONGTEXT,
    email_status            VARCHAR(20),                  -- sent | failed | skipped
    email_message           VARCHAR(255),
    CONSTRAINT fk_payroll_run     FOREIGN KEY (payroll_run_id) REFERENCES payroll_run (payroll_run_id) ON DELETE CASCADE,
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
    leave_category_id  INT,                         -- leave_category row (12)
    is_paid            TINYINT(1)  NOT NULL DEFAULT 0, -- copied from the category when filed
    reason             VARCHAR(255),                -- the employee's reason
    status             VARCHAR(50) NOT NULL DEFAULT 'Pending',   -- Pending | Approved | Rejected | Cancelled
    date_requested     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_approved      DATETIME,                    -- when it was approved, rejected or cancelled
    approved_by        VARCHAR(50),                 -- name of the user who did that
    recorded_by        INT,                         -- user who recorded the request
    date_from          DATE        NOT NULL,
    date_to            DATE        NOT NULL,
    remarks            VARCHAR(255),                -- reviewer's remarks
    total_days         INT,                         -- working days (Mon–Fri)
    total_leave_credit INT,                         -- credits for the year, when it uses credits
    used_leave         INT,                         -- credits used before this request
    remaining_leave    INT,                         -- credits left after this request
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
    date_from     DATE,                             -- Payment From: first month deducted
    date_to       DATE,                             -- when it was fully paid
    reference_no  VARCHAR(30)   UNIQUE,             -- lender's reference number
    deduction_per_payroll DECIMAL(10,2) NOT NULL DEFAULT 0,
    lender        VARCHAR(100),                     -- who lent it, as typed (SSS, Pag-IBIG, BDO, ...)
    lender_name   VARCHAR(100),                     -- e.g. the bank, for Bank / Cooperative / Other
    end_date      DATE,                             -- Payment To: last month deducted
    interest_rate DECIMAL(5,2)  NOT NULL DEFAULT 0, -- percent of the amount, for the whole loan
    total_payable DECIMAL(10,2),                    -- amount plus interest (deducted once a month, 11th-25th payroll)
    remarks       VARCHAR(255),
    recorded_by   INT,
    CONSTRAINT fk_loan_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_loan_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Table 9a. Loan payments: one deduction per loan per released payroll period.
CREATE TABLE IF NOT EXISTS loan_payment (
    loan_payment_id   INT AUTO_INCREMENT PRIMARY KEY,
    loan_id           INT           NOT NULL,
    period_from       DATE          NOT NULL,
    period_to         DATE          NOT NULL,
    period_label      VARCHAR(60),
    amount            DECIMAL(10,2) NOT NULL,
    remaining_balance DECIMAL(10,2) NOT NULL,       -- balance after this deduction
    skipped           TINYINT(1)    NOT NULL DEFAULT 0, -- pay wasn't enough: nothing deducted, the loan runs one period longer
    date_processed    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by       INT,
    UNIQUE KEY uq_loan_payment_period (loan_id, period_from),
    CONSTRAINT fk_loan_payment_loan FOREIGN KEY (loan_id) REFERENCES loan (loan_id) ON DELETE CASCADE
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

-- Default tables for 2025 and 2026, only when a table is still empty (so
-- changes made in Maintenance are never overwritten by a re-import).
--   BIR: TRAIN law withholding tax, monthly.
--   PhilHealth: 5% premium, ₱10,000 floor and ₱100,000 ceiling, shared 50/50.
--   Pag-IBIG: 1% up to ₱1,500, else 2%; compensation capped at ₱10,000.
--   SSS: Monthly Salary Credit ₱5,000–₱35,000 in ₱500 steps; employee share 5%.
INSERT INTO bir_table (effective_year, bracket_min, bracket_max, base_tax, rate_percent)
SELECT y.yr, b.mn, b.mx, b.base, b.rate
FROM (SELECT 2025 AS yr UNION ALL SELECT 2026) y
CROSS JOIN (
    SELECT 0 AS mn, 20833 AS mx, 0 AS base, 0 AS rate
    UNION ALL SELECT 20833.01, 33333, 0, 15
    UNION ALL SELECT 33333.01, 66667, 1875, 20
    UNION ALL SELECT 66667.01, 166667, 8541.80, 25
    UNION ALL SELECT 166667.01, 666667, 33541.80, 30
    UNION ALL SELECT 666667.01, NULL, 183541.80, 35
) b
WHERE NOT EXISTS (SELECT 1 FROM bir_table);

INSERT INTO philhealth_table (effective_year, salary_min, salary_max, monthly_premium, rate_percent)
SELECT y.yr, b.mn, b.mx, b.premium, 5
FROM (SELECT 2025 AS yr UNION ALL SELECT 2026) y
CROSS JOIN (
    SELECT 0 AS mn, 10000 AS mx, 500 AS premium
    UNION ALL SELECT 10000.01, 99999.99, NULL
    UNION ALL SELECT 100000, NULL, 5000
) b
WHERE NOT EXISTS (SELECT 1 FROM philhealth_table);

INSERT INTO pagibig_table (effective_year, compensation_min, compensation_max, employee_share, rate_percent)
SELECT y.yr, b.mn, b.mx, b.share, b.rate
FROM (SELECT 2025 AS yr UNION ALL SELECT 2026) y
CROSS JOIN (
    SELECT 0 AS mn, 1500 AS mx, NULL AS share, 1 AS rate
    UNION ALL SELECT 1500.01, 10000, NULL, 2
    UNION ALL SELECT 10000.01, NULL, 200, 2
) b
WHERE NOT EXISTS (SELECT 1 FROM pagibig_table);

INSERT INTO sss_table (effective_year, compensation_min, compensation_max, monthly_salary_credit, employee_rate_percent)
SELECT y.yr, b.mn, b.mx, b.msc, 5
FROM (SELECT 2025 AS yr UNION ALL SELECT 2026) y
CROSS JOIN (
    SELECT 0 AS mn, 5249.99 AS mx, 5000 AS msc
    UNION ALL SELECT seq - 250, seq + 249.99, seq FROM seq_5500_to_34500_step_500
    UNION ALL SELECT 34750, NULL, 35000
) b
WHERE NOT EXISTS (SELECT 1 FROM sss_table);

-- 12. Leave Category Maintenance (5.3)
CREATE TABLE IF NOT EXISTS leave_category (
    leave_category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name     VARCHAR(50) NOT NULL UNIQUE,  -- sick, vacation, maternity, paternity, ...
    is_paid           TINYINT(1)  NOT NULL DEFAULT 1,
    is_active         TINYINT(1)  NOT NULL DEFAULT 1,
    paid_days         INT                           -- paid leave: days a year each employee is paid for (their credits)
) ENGINE=InnoDB;

INSERT IGNORE INTO leave_category (category_name, is_paid, is_active, paid_days) VALUES
    ('Sick Leave', 1, 1, 15),
    ('Vacation Leave', 1, 1, 15),
    ('Maternity Leave', 1, 1, 105),
    ('Paternity Leave', 1, 1, 7),
    ('Leave Without Pay', 0, 1, NULL);

-- 13. Leave credits per employee (Employee Records Management: "manage the
--     number of leave credits allocated per employee"; interview: 15 days).
CREATE TABLE IF NOT EXISTS leave_credit (
    leave_credit_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id      INT,
    adminstaff_id   INT,
    year_covered    YEAR NOT NULL,
    total_credits   INT  NOT NULL DEFAULT 15,
    UNIQUE KEY uq_credit_faculty_year (faculty_id, year_covered),
    UNIQUE KEY uq_credit_admin_year (adminstaff_id, year_covered),
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
    UNIQUE KEY uq_eb_faculty (benefit_id, faculty_id),
    UNIQUE KEY uq_eb_admin   (benefit_id, adminstaff_id),
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

-- 18. Payroll Computation History: payroll_run, defined above the payroll table.

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

-- 23. Employee Rates (Maintenance): every rate an employee has had, so a
--     payroll for an earlier period uses the rate that applied then.
--     rate_kind: Office = rate per hour for office work (Admin, Faculty/Admin);
--     Teaching = rate per hour/unit for approved classes (Faculty, Faculty/Admin).
--     The employee record's own rate columns always hold the current rate.
CREATE TABLE IF NOT EXISTS employee_rate (
    rate_id        INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id     INT,
    adminstaff_id  INT,
    rate_kind      VARCHAR(10)   NOT NULL,          -- Office | Teaching
    amount         DECIMAL(10,2) NOT NULL,
    effective_date DATE          NOT NULL,
    end_date       DATE,                            -- NULL = current rate
    recorded_by    INT,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_rate_faculty (faculty_id, rate_kind, effective_date),
    UNIQUE KEY uq_rate_admin   (adminstaff_id, rate_kind, effective_date),
    CONSTRAINT fk_rate_faculty FOREIGN KEY (faculty_id)    REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_rate_admin   FOREIGN KEY (adminstaff_id) REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE,
    CONSTRAINT fk_rate_user    FOREIGN KEY (recorded_by)   REFERENCES users (user_id)             ON DELETE SET NULL
) ENGINE=InnoDB;

-- 24. Forgot Password: one-time codes (OTP) emailed to an account's address.
--     Only hashes are stored. A code expires after 10 minutes and allows 5
--     tries; once verified, a reset token (also hashed) lets the user set a
--     new password within 10 minutes. Used rows are kept as a record.
CREATE TABLE IF NOT EXISTS password_reset (
    reset_id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT          NOT NULL,
    otp_hash         VARCHAR(100) NOT NULL,
    expires_at       DATETIME     NOT NULL,
    attempts         INT          NOT NULL DEFAULT 0,
    verified_at      DATETIME,
    token_hash       VARCHAR(100),
    token_expires_at DATETIME,
    used_at          DATETIME,
    created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 25. Holidays (Philippines): Maintenance -> Holiday Calendar, shown on the
--     Dashboard calendar. One row per date. holiday_type is 'Regular
--     Holiday', 'Special Non-Working Day' or 'Special Working Day'. Dates
--     change every year by presidential proclamation, so new years are added
--     as they're declared. double_pay = 1: hours worked that day are paid
--     twice (payroll adds a Holiday line for the extra 100%).
CREATE TABLE IF NOT EXISTS holiday (
    holiday_id   INT AUTO_INCREMENT PRIMARY KEY,
    holiday_date DATE         NOT NULL,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_type VARCHAR(30)  NOT NULL,
    double_pay   TINYINT(1)   NOT NULL DEFAULT 0,
    UNIQUE KEY uq_holiday_date (holiday_date)
) ENGINE=InnoDB;

-- Databases created before double pay existed.
ALTER TABLE holiday ADD COLUMN IF NOT EXISTS double_pay TINYINT(1) NOT NULL DEFAULT 0 AFTER holiday_type;

-- 2026: Proclamation No. 1006 (Sept 3, 2025). Eid'l Fitr and Eid'l Adha are
-- set by separate proclamations each year.
INSERT IGNORE INTO holiday (holiday_date, holiday_name, holiday_type, double_pay) VALUES
    ('2026-01-01', 'New Year''s Day',                       'Regular Holiday', 1),
    ('2026-02-17', 'Chinese New Year',                      'Special Non-Working Day', 0),
    ('2026-02-25', 'EDSA People Power Revolution Anniversary', 'Special Working Day', 0),
    ('2026-03-20', 'Eid''l Fitr',                           'Regular Holiday', 1),
    ('2026-04-02', 'Maundy Thursday',                       'Regular Holiday', 1),
    ('2026-04-03', 'Good Friday',                           'Regular Holiday', 1),
    ('2026-04-04', 'Black Saturday',                        'Special Non-Working Day', 0),
    ('2026-04-09', 'Araw ng Kagitingan',                    'Regular Holiday', 1),
    ('2026-05-01', 'Labor Day',                             'Regular Holiday', 1),
    ('2026-05-27', 'Eid''l Adha',                           'Regular Holiday', 1),
    ('2026-06-12', 'Independence Day',                      'Regular Holiday', 1),
    ('2026-08-21', 'Ninoy Aquino Day',                      'Special Non-Working Day', 0),
    ('2026-08-31', 'National Heroes Day',                   'Regular Holiday', 1),
    ('2026-11-01', 'All Saints'' Day',                      'Special Non-Working Day', 0),
    ('2026-11-02', 'All Souls'' Day',                       'Special Non-Working Day', 0),
    ('2026-11-30', 'Bonifacio Day',                         'Regular Holiday', 1),
    ('2026-12-08', 'Feast of the Immaculate Conception of Mary', 'Special Non-Working Day', 0),
    ('2026-12-24', 'Christmas Eve',                         'Special Non-Working Day', 0),
    ('2026-12-25', 'Christmas Day',                         'Regular Holiday', 1),
    ('2026-12-30', 'Rizal Day',                             'Regular Holiday', 1),
    ('2026-12-31', 'Last Day of the Year',                  'Special Non-Working Day', 0);

-- 26. Payroll Adjustment: one row per employee per cut-off, entered in a
--     grid (Payroll Processing -> Payroll Adjustment). It corrects pay in a
--     later cut-off, e.g. approved leave that wasn't recorded in time and was
--     deducted. days = working days (Mon-Fri) from date_from to date_to;
--     add_hours / deduct_hours are hours per day; amounts = hours x days x rate
--     (the rate on date_from); amount = add_amount - deduct_amount, part of
--     gross pay of the cut-off apply_start..apply_end. Applied once that
--     cut-off's payroll is released.
CREATE TABLE IF NOT EXISTS payroll_adjustment (
    adjustment_id  INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id     INT,
    adminstaff_id  INT,
    apply_start    DATE          NOT NULL,          -- cut-off the adjustment is paid in
    apply_end      DATE          NOT NULL,
    date_from      DATE          NOT NULL,          -- the days being corrected
    date_to        DATE          NOT NULL,
    days           INT           NOT NULL,
    add_hours      DECIMAL(4,1)  NOT NULL DEFAULT 0, -- hours per day added
    deduct_hours   DECIMAL(4,1)  NOT NULL DEFAULT 0, -- hours per day deducted
    rate           DECIMAL(10,2) NOT NULL,
    add_amount     DECIMAL(10,2) NOT NULL DEFAULT 0,
    deduct_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount         DECIMAL(10,2) NOT NULL,          -- add_amount - deduct_amount
    reason         VARCHAR(200)  NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'Pending',  -- Pending | Applied
    payroll_run_id INT,
    recorded_by    INT,
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_adjust_faculty (faculty_id, apply_start),
    UNIQUE KEY uq_adjust_admin   (adminstaff_id, apply_start),
    KEY idx_adjust_period (apply_start, apply_end),
    CONSTRAINT fk_adjust_faculty FOREIGN KEY (faculty_id)     REFERENCES faculty_staff (faculty_id)  ON DELETE CASCADE,
    CONSTRAINT fk_adjust_admin   FOREIGN KEY (adminstaff_id)  REFERENCES admin_staff (adminstaff_id) ON DELETE CASCADE,
    CONSTRAINT fk_adjust_run     FOREIGN KEY (payroll_run_id) REFERENCES payroll_run (payroll_run_id) ON DELETE SET NULL,
    CONSTRAINT fk_adjust_user    FOREIGN KEY (recorded_by)    REFERENCES users (user_id)             ON DELETE SET NULL
) ENGINE=InnoDB;

-- Loans: lender and payment period (Loan Management), and payroll periods
-- skipped because the pay wasn't enough (databases created before these).
ALTER TABLE loan ADD COLUMN IF NOT EXISTS lender VARCHAR(30) AFTER deduction_per_payroll;
ALTER TABLE loan ADD COLUMN IF NOT EXISTS lender_name VARCHAR(100) AFTER lender;
ALTER TABLE loan ADD COLUMN IF NOT EXISTS end_date DATE AFTER lender_name;
ALTER TABLE loan_payment ADD COLUMN IF NOT EXISTS skipped TINYINT(1) NOT NULL DEFAULT 0 AFTER remaining_balance;
ALTER TABLE loan MODIFY COLUMN lender VARCHAR(100);
ALTER TABLE loan ADD COLUMN IF NOT EXISTS interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER end_date;
ALTER TABLE loan ADD COLUMN IF NOT EXISTS total_payable DECIMAL(10,2) AFTER interest_rate;
-- Leave categories: paid leave has its own paid days a year (replaces max days per request and the shared credits).
ALTER TABLE leave_category ADD COLUMN IF NOT EXISTS paid_days INT AFTER is_active;
-- Deduction tables: a year's brackets are archived (archived_at set) when the government changes them.
ALTER TABLE bir_table ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
ALTER TABLE philhealth_table ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
ALTER TABLE pagibig_table ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
ALTER TABLE sss_table ADD COLUMN IF NOT EXISTS archived_at DATETIME NULL;
-- Maintenance → Grace Period (key/value settings; application.properties holds the defaults).
CREATE TABLE IF NOT EXISTS system_setting (
    setting_key   VARCHAR(60)  PRIMARY KEY,
    setting_value VARCHAR(255)
) ENGINE=InnoDB;

-- Maintenance → Payroll Periods: the two cut-off start days, from an effective date.
-- Periods before a rule's effective date keep the older rule.
CREATE TABLE IF NOT EXISTS payroll_period_rule (
    rule_id          INT AUTO_INCREMENT PRIMARY KEY,
    effective_date   DATE NOT NULL UNIQUE,
    first_start_day  INT  NOT NULL,            -- e.g. 11: the 11th–25th
    second_start_day INT  NOT NULL,            -- e.g. 26: the 26th–10th of the next month
    created_by       INT,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT IGNORE INTO payroll_period_rule (effective_date, first_start_day, second_start_day) VALUES ('2000-01-01', 11, 26);

-- Faculty Teaching Hours: minutes late at the beginning check (deducted from pay).
ALTER TABLE faculty_teaching_attendance ADD COLUMN IF NOT EXISTS late_minutes INT NOT NULL DEFAULT 0 AFTER start_checked_by;
