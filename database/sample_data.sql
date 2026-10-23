-- ---------------------------------------------------------------
-- Sample data for testing and demonstration (optional).
-- Import AFTER payroll_schema.sql:  mysql -u root < database/sample_data.sql
--
-- 10 employees — 4 Faculty, 4 Admin, 2 Faculty/Admin — with complete
-- profiles and fingerprint (device User) IDs 101–110, and three pay periods:
--
--   Sep 11 – Sep 25, 2026   biometric DTR, classes, classroom checks
--   Sep 26 – Oct 10, 2026   same, up to Oct 8 (the day before this data was made)
--   Oct 11 – Oct 25, 2026   classes only — future dates have no attendance yet
--
-- Attendance is deliberately mixed: some late arrivals, absences and manual
-- entries; classroom checks mostly approved, recent ones waiting for
-- approval or incomplete, and a few flagged, rejected or not checked.
-- All classes on Fri Sep 25 are cancelled (typhoon class suspension).
--
-- Leave: every Admin weekday absence is an approved sick leave (paid in
-- payroll), plus pending, rejected, cancelled and unpaid requests.
-- Loans: four loans starting Sep 11 – Oct 11, with no deductions yet; they
-- are recorded when a payroll period is released.
-- Benefits: Rice (all), Transportation (Admin, Faculty/Admin) and Internet
-- (Faculty, Faculty/Admin) allowances, paid every payroll period.
--
-- Safe to run again: the 10 sample employees (Employee IDs
-- STIBLN-0001 to STIBLN-0010, emails @example.com) are deleted first, with everything
-- linked to them, and the payroll runs of the three sample periods are
-- cleared so they can be run again. Other employees are not touched.
-- Emails use example.com so payslip emails never reach real people.
-- Needs one Payroll Master account (it is recorded as the user who
-- entered, checked and approved the records).
-- ---------------------------------------------------------------

USE Payroll_DB;

SET @master := (SELECT user_id FROM users
                WHERE role = 'Payroll Master' AND is_active = 1
                ORDER BY user_id LIMIT 1);

-- 0. Remove an earlier copy of the sample (classes, checks, audit, history,
--    DTR, loans, rates and payroll rows go with the employees through
--    ON DELETE CASCADE). Payroll runs of the three sample periods are
--    removed too — for every employee — so they can be run again.
DELETE FROM payroll_run
WHERE (pay_period_start, pay_period_end) IN
      (('2026-09-11', '2026-09-25'), ('2026-09-26', '2026-10-10'), ('2026-10-11', '2026-10-25'));
DELETE FROM faculty_staff WHERE employee_number IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F');
DELETE FROM admin_staff   WHERE employee_number IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F');


-- ---------------------------------------------------------------
-- 1. Employees
-- ---------------------------------------------------------------

-- Faculty (faculty_staff): paid approved teaching hours × rate per hour/unit.
INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0006-M', '101', 'Jose', 'Marquez', 'Ramirez', 'Male', 38, '1988-03-14',
    '09171234501', 'Brgy. Caloocan, Balayan, Batangas', 'mikeyyy.tagle28+13@gmail.com', 'Married', 2, 'Active', 'Full-time', '2019-06-03',
    18, 7.0, 420.00, '34-1234501-1', '12-345678901-1', '1234-5678-9101', '123-456-701-000', 'Instructor II', 'IT department; adviser of BSIT 2A.');
SET @f1 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0009-F', '102', 'Angela', 'Cruz', 'Dizon', 'Female', 29, '1997-07-22',
    '09171234502', 'Brgy. Gimalas, Balayan, Batangas', 'mikeyyy.tagle28+2@gmail.com', 'Single', 0, 'Active', 'Part-time', '2023-08-07',
    9, 6.0, 380.00, '34-1234502-2', '12-345678902-2', '1234-5678-9102', '123-456-702-000', 'Instructor I', 'General Education.');
SET @f2 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0003-M', '103', 'Paolo', 'Santos', 'Villareal', 'Male', 45, '1981-11-02',
    '09171234503', 'Brgy. Calzada, Calaca, Batangas', 'mikeyyy.tagle28+23@gmail.com', 'Married', 3, 'Active', 'Full-time', '2014-06-16',
    15, 7.0, 450.00, '34-1234503-3', '12-345678903-3', '1234-5678-9103', '123-456-703-000', 'Instructor III', 'Senior faculty, networking and databases.');
SET @f3 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0010-F', '104', 'Kristine', 'Lopez', 'Bautista', 'Female', 27, '1999-01-30',
    '09171234504', 'Brgy. Sampaga, Balayan, Batangas', 'mikeyyy.tagle28+15@gmail.com', 'Single', 0, 'Active', 'Contractual', '2025-06-09',
    9, 5.0, 360.00, '34-1234504-4', '12-345678904-4', '1234-5678-9104', '123-456-704-000', 'Instructor I', 'Mathematics.');
SET @f4 := LAST_INSERT_ID();

-- Admin (admin_staff, is_faculty = 0): paid biometric office hours × rate per hour.
INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0004-M', '105', 'Ramon', 'Aguilar', 'Castillo', 'Male', 41, '1985-05-18',
    '09171234505', 'Brgy. Poblacion 3, Balayan, Batangas', 'mikeyyy.tagle28+25@gmail.com', 'Married', 2, 'Active', 'Full-time', '2016-02-01',
    'Registrar', 'Registrar Officer', 8.0, 130.00, 0, '34-1234505-5', '12-345678905-5', '1234-5678-9105', '123-456-705-000', NULL);
SET @a1 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0007-F', '106', 'Liza', 'Flores', 'Mercado', 'Female', 34, '1992-09-09',
    '09171234506', 'Brgy. Lanatan, Balayan, Batangas', 'mikeyyy.tagle28+17@gmail.com', 'Married', 1, 'Active', 'Full-time', '2020-07-13',
    'Accounting', 'Cashier', 8.0, 110.00, 0, '34-1234506-6', '12-345678906-6', '1234-5678-9106', '123-456-706-000', NULL);
SET @a2 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0001-M', '107', 'Danilo', 'Perez', 'Ocampo', 'Male', 50, '1976-12-05',
    '09171234507', 'Brgy. Langgangan, Balayan, Batangas', 'mikeyyy.tagle28+5@gmail.com', 'Widowed', 1, 'Active', 'Full-time', '2010-03-22',
    'Facilities', 'Maintenance Staff', 8.0, 95.00, 0, '34-1234507-7', '12-345678907-7', '1234-5678-9107', '123-456-707-000', NULL);
SET @a3 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0008-F', '108', 'Joanna', 'Reyes', 'Salazar', 'Female', 31, '1995-04-27',
    '09171234508', 'Brgy. Navotas, Balayan, Batangas', 'mikeyyy.tagle28+11@gmail.com', 'Single', 0, 'Active', 'Full-time', '2021-09-01',
    'Admissions', 'Admissions Officer', 8.0, 120.00, 0, '34-1234508-8', '12-345678908-8', '1234-5678-9108', '123-456-708-000', NULL);
SET @a4 := LAST_INSERT_ID();

-- Faculty/Admin (admin_staff, is_faculty = 1): office hours × office rate
-- plus approved teaching hours × teaching rate (rate_per_hour_unit).
INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0002-F', '109', 'Teresa', 'Mendoza', 'Aquino', 'Female', 47, '1979-08-11',
    '09171234509', 'Brgy. Dalig, Balayan, Batangas', 'mikeyyy.tagle28+29@gmail.com', 'Married', 2, 'Active', 'Full-time', '2012-06-04',
    'Academic Affairs', 'Program Head', 8.0, 160.00, 1, 'Instructor III', 400.00, 3, 3.0,
    '34-1234509-9', '12-345678909-9', '1234-5678-9109', '123-456-709-000', 'Also teaches Ethics.');
SET @a5 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0005-M', '110', 'Vincent', 'Torres', 'Gomez', 'Male', 36, '1990-02-17',
    '09171234510', 'Brgy. Magabe, Balayan, Batangas', 'mikeyyy.tagle28+30@gmail.com', 'Married', 1, 'Active', 'Full-time', '2018-01-15',
    'IT Department', 'IT Coordinator', 8.0, 140.00, 1, 'Instructor II', 380.00, 3, 4.0,
    '34-1234510-0', '12-345678910-0', '1234-5678-9110', '123-456-710-000', 'Also teaches Web Development.');
SET @a6 := LAST_INSERT_ID();


-- ---------------------------------------------------------------
-- Helper tables (dropped at the end)
-- ---------------------------------------------------------------

-- k = sample employee 1–10.
DROP TEMPORARY TABLE IF EXISTS tmp_emp;
CREATE TEMPORARY TABLE tmp_emp (k INT PRIMARY KEY, faculty_id INT NULL, adminstaff_id INT NULL, kind VARCHAR(15));
INSERT INTO tmp_emp VALUES
    (1, @f1, NULL, 'Faculty'), (2, @f2, NULL, 'Faculty'), (3, @f3, NULL, 'Faculty'), (4, @f4, NULL, 'Faculty'),
    (5, NULL, @a1, 'Admin'), (6, NULL, @a2, 'Admin'), (7, NULL, @a3, 'Admin'), (8, NULL, @a4, 'Admin'),
    (9, NULL, @a5, 'Faculty/Admin'), (10, NULL, @a6, 'Faculty/Admin');

-- Weekly teaching plan. wd = WEEKDAY(): 0 = Monday … 4 = Friday.
DROP TEMPORARY TABLE IF EXISTS tmp_plan;
CREATE TEMPORARY TABLE tmp_plan (k INT, wd INT, t_start TIME, t_end TIME, subject VARCHAR(100), section VARCHAR(50), room VARCHAR(50));
INSERT INTO tmp_plan VALUES
    (1, 0, '07:30', '09:00', 'Data Structures and Algorithms', 'BSIT 2A', 'CLAB 3'),
    (1, 2, '07:30', '09:00', 'Data Structures and Algorithms', 'BSIT 2A', 'CLAB 3'),
    (1, 1, '10:00', '12:00', 'Computer Programming 2', 'BSIT 1B', 'CLAB 1'),
    (1, 3, '10:00', '12:00', 'Computer Programming 2', 'BSIT 1B', 'CLAB 1'),
    (2, 0, '13:00', '14:30', 'Purposive Communication', 'BSBA 1A', 'Room 201'),
    (2, 2, '13:00', '14:30', 'Purposive Communication', 'BSBA 1A', 'Room 201'),
    (2, 4, '08:00', '11:00', 'Readings in Philippine History', 'BSHM 1A', 'Room 202'),
    (3, 1, '13:00', '15:00', 'Database Systems', 'BSIT 3A', 'CLAB 2'),
    (3, 3, '13:00', '15:00', 'Database Systems', 'BSIT 3A', 'CLAB 2'),
    (3, 4, '13:00', '16:00', 'Networking 1', 'BSIT 2B', 'CLAB 2'),
    (4, 0, '10:00', '11:00', 'Mathematics in the Modern World', 'BSTM 1A', 'Room 203'),
    (4, 2, '10:00', '11:00', 'Mathematics in the Modern World', 'BSTM 1A', 'Room 203'),
    (4, 4, '10:00', '11:00', 'Mathematics in the Modern World', 'BSTM 1A', 'Room 203'),
    (4, 1, '14:00', '16:00', 'Business Statistics', 'BSBA 2A', 'Room 204'),
    (9, 1, '08:00', '09:30', 'Ethics', 'BSHM 2A', 'Room 205'),
    (9, 3, '08:00', '09:30', 'Ethics', 'BSHM 2A', 'Room 205'),
    (10, 0, '15:00', '17:00', 'Web Systems and Technologies', 'BSIT 3B', 'CLAB 1'),
    (10, 2, '15:00', '17:00', 'Web Systems and Technologies', 'BSIT 3B', 'CLAB 1');

-- Every date from Sep 11 to Oct 25, 2026.
DROP TEMPORARY TABLE IF EXISTS tmp_days;
CREATE TEMPORARY TABLE tmp_days AS
    SELECT DATE('2026-09-11') + INTERVAL seq DAY AS d FROM seq_0_to_44;


-- ---------------------------------------------------------------
-- 2. Faculty Schedule: weekly classes Sep 11 – Oct 25
-- ---------------------------------------------------------------

INSERT INTO faculty_class_schedule (faculty_id, adminstaff_id, subject, class_section, room, class_date,
    scheduled_start, scheduled_end, grace_period_minutes, schedule_status, status_reason,
    created_by, updated_by, created_at, updated_at)
SELECT e.faculty_id, e.adminstaff_id, p.subject, p.section, p.room, t.d,
       p.t_start, p.t_end, 15,
       IF(t.d = '2026-09-25', 'Cancelled', 'Scheduled'),
       IF(t.d = '2026-09-25', 'Class suspension (Tropical Cyclone Wind Signal No. 2)', NULL),
       @master, @master, '2026-09-07 09:00:00',
       IF(t.d = '2026-09-25', '2026-09-24 18:30:00', '2026-09-07 09:00:00')
FROM tmp_days t
JOIN tmp_plan p ON WEEKDAY(t.d) = p.wd
JOIN tmp_emp e ON e.k = p.k
ORDER BY t.d, p.t_start;

-- Change history: every class was created on Sep 7; the Sep 25 classes were cancelled.
INSERT INTO faculty_schedule_history (class_schedule_id, action, details, changed_by, changed_at)
SELECT c.class_schedule_id, 'Created',
       CONCAT(c.subject, ' (', c.class_section, '), ', c.room, ', ', c.class_date, ' ',
              TIME_FORMAT(c.scheduled_start, '%H:%i'), '–', TIME_FORMAT(c.scheduled_end, '%H:%i')),
       @master, '2026-09-07 09:00:00'
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id;

INSERT INTO faculty_schedule_history (class_schedule_id, action, details, changed_by, changed_at)
SELECT c.class_schedule_id, 'Cancelled', c.status_reason, @master, '2026-09-24 18:30:00'
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.schedule_status = 'Cancelled';


-- ---------------------------------------------------------------
-- 3. Faculty Teaching Hours: classroom checks up to Oct 8
--    v is a fixed pseudo-random number 0–19 per class, so the mix of
--    outcomes is the same every time the file runs.
-- ---------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS tmp_cls;
CREATE TEMPORARY TABLE tmp_cls AS
SELECT c.class_schedule_id AS id, e.k, c.class_date AS d, c.scheduled_start AS s, c.scheduled_end AS en,
       MOD(e.k * 7 + DAY(c.class_date) * 3 + MONTH(c.class_date) + HOUR(c.scheduled_start) * 5, 20) AS v,
       CAST('' AS CHAR(12)) AS outcome, CAST('' AS CHAR(12)) AS final
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.schedule_status = 'Scheduled' AND c.class_date <= '2026-10-08';

UPDATE tmp_cls SET outcome = CASE
    WHEN d = '2026-10-08' AND MOD(v, 2) = 0 THEN 'none'             -- not checked yet
    WHEN d = '2026-10-08' THEN 'incomplete'                           -- only the beginning check so far
    WHEN v = 0 THEN 'absent'                                          -- absent at both checks
    WHEN v = 2 THEN 'early'                                           -- present, then gone at the end
    WHEN v = 1 THEN 'latecheck'                                       -- beginning check outside the grace period
    WHEN d = '2026-10-07' AND MOD(v, 3) = 0 THEN 'incomplete'        -- only the beginning check so far
    ELSE 'ok' END;

UPDATE tmp_cls SET final = CASE
    WHEN outcome = 'none' THEN ''
    WHEN outcome = 'incomplete' THEN 'Incomplete'
    WHEN d >= '2026-10-03' THEN 'Pending'                             -- recent: not reviewed yet
    WHEN outcome IN ('absent', 'early') THEN 'Rejected'
    ELSE 'Approved' END;

INSERT INTO faculty_teaching_attendance (class_schedule_id,
    start_check_at, start_check_status, start_checked_by,
    end_check_at, end_check_status, end_checked_by,
    remarks, approval_status, payable_hours, approved_by, approved_at, review_note, created_at, updated_at)
SELECT t.id,
       TIMESTAMP(t.d, t.s) + INTERVAL IF(t.outcome = 'latecheck', 25, MOD(t.v, 8) + 1) MINUTE,
       IF(t.outcome = 'absent', 'Absent', 'Present'),
       @master,
       IF(t.outcome = 'incomplete', NULL, TIMESTAMP(t.d, t.en) - INTERVAL (MOD(t.v, 6) + 1) MINUTE),
       IF(t.outcome = 'incomplete', NULL, IF(t.outcome IN ('absent', 'early'), 'Absent', 'Present')),
       IF(t.outcome = 'incomplete', NULL, @master),
       CASE t.outcome
           WHEN 'absent' THEN 'Classroom empty at both checks.'
           WHEN 'early' THEN 'Class dismissed early; faculty not in the room at the ending check.'
           WHEN 'latecheck' THEN 'Beginning check done late (staff meeting ran over).'
           ELSE NULL END,
       t.final,
       CASE t.final
           WHEN 'Approved' THEN ROUND(TIME_TO_SEC(TIMEDIFF(t.en, t.s)) / 3600, 2)
           WHEN 'Rejected' THEN 0
           ELSE NULL END,
       IF(t.final IN ('Approved', 'Rejected'), @master, NULL),
       IF(t.final IN ('Approved', 'Rejected'), TIMESTAMP(t.d + INTERVAL 1 DAY, '16:30:00'), NULL),
       CASE
           WHEN t.final = 'Rejected' AND t.outcome = 'absent' THEN 'Faculty absent; no substitute arranged.'
           WHEN t.final = 'Rejected' THEN 'Left before the end of class.'
           WHEN t.final = 'Approved' AND t.outcome = 'latecheck' THEN 'Checked late; faculty confirmed present from the start of class.'
           ELSE NULL END,
       TIMESTAMP(t.d, t.s),
       TIMESTAMP(t.d, t.en)
FROM tmp_cls t
WHERE t.outcome <> 'none';

-- Audit history of every check, approval and rejection.
INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, 'Beginning check recorded',
       CONCAT(TIME_FORMAT(a.start_check_at, '%H:%i'), ' ', a.start_check_status), NULL, @master, a.start_check_at
FROM faculty_teaching_attendance a JOIN tmp_cls t ON t.id = a.class_schedule_id;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, 'Ending check recorded',
       CONCAT(TIME_FORMAT(a.end_check_at, '%H:%i'), ' ', a.end_check_status), NULL, @master, a.end_check_at
FROM faculty_teaching_attendance a JOIN tmp_cls t ON t.id = a.class_schedule_id
WHERE a.end_check_at IS NOT NULL;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, a.approval_status,
       IF(a.approval_status = 'Approved',
          CONCAT('Payable teaching hours: ', a.payable_hours),
          'No teaching hours will be paid for this class.'),
       a.review_note, @master, a.approved_at
FROM faculty_teaching_attendance a JOIN tmp_cls t ON t.id = a.class_schedule_id
WHERE a.approval_status IN ('Approved', 'Rejected');


-- ---------------------------------------------------------------
-- 4. Daily Time Record (biometric), weekdays Sep 11 – Oct 8
-- ---------------------------------------------------------------

-- Admin and Faculty/Admin: office day around 8:00–17:00. w is a fixed
-- pseudo-random number 0–24 per person per day:
--   w = 0    absent (no record; Faculty/Admin are never absent here)
--   w = 1–2  late (time-in after 8:15)
--   w = 3    manual entry (scanner did not read the finger)
--   else     on time
INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date,
    time_in, time_out, status, is_manual_entry, remarks, recorded_by, created_at)
SELECT s.fingerprint_id, NULL, NULL, x.adminstaff_id, x.d,
       CASE WHEN x.w IN (1, 2) THEN ADDTIME('08:20:00', SEC_TO_TIME(x.w * 9 * 60))
            WHEN x.w = 3 THEN '08:00:00'
            ELSE ADDTIME('07:40:00', SEC_TO_TIME(MOD(x.w, 19) * 60)) END,
       ADDTIME('17:00:00', SEC_TO_TIME(MOD(x.w * 3, 16) * 60)),
       IF(x.w IN (1, 2), 'Late', 'Present'),
       IF(x.w = 3, 1, 0),
       IF(x.w = 3, 'Fingerprint not read by the scanner; time verified by the department head.', NULL),
       IF(x.w = 3, @master, NULL),
       TIMESTAMP(x.d, '17:30:00')
FROM (
    SELECT e.k, e.adminstaff_id, e.kind, t.d, MOD(e.k * 13 + DAY(t.d) * 7 + MONTH(t.d) * 3, 25) AS w
    FROM tmp_days t JOIN tmp_emp e ON e.kind IN ('Admin', 'Faculty/Admin')
    WHERE WEEKDAY(t.d) < 5 AND t.d <= '2026-10-08'
) x
JOIN admin_staff s ON s.adminstaff_id = x.adminstaff_id
WHERE NOT (x.w = 0 AND x.kind = 'Admin');

-- Faculty: scan in before the first class and out after the last class of
-- the day, on days with classes — skipped on days they missed a class.
INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date,
    time_in, time_out, status, is_manual_entry, remarks, recorded_by, created_at)
SELECT f.fingerprint_id, NULL, f.faculty_id, NULL, x.d,
       SUBTIME(x.first_start, SEC_TO_TIME((10 + MOD(x.mv, 10)) * 60)),
       ADDTIME(x.last_end, SEC_TO_TIME((5 + MOD(x.mv, 10)) * 60)),
       'Present', 0, NULL, NULL, TIMESTAMP(x.d, x.last_end)
FROM (
    SELECT t.k, t.d, MIN(t.s) AS first_start, MAX(t.en) AS last_end, MIN(t.v) AS mv,
           SUM(t.outcome = 'absent') AS absences
    FROM tmp_cls t
    WHERE t.k BETWEEN 1 AND 4
    GROUP BY t.k, t.d
) x
JOIN tmp_emp e ON e.k = x.k
JOIN faculty_staff f ON f.faculty_id = e.faculty_id
WHERE x.absences = 0;


-- ---------------------------------------------------------------
-- 5. Leave Management
-- ---------------------------------------------------------------

SET @masterName := (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE user_id = @master);
SET @sick := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Sick Leave');
SET @vacation := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Vacation Leave');
SET @paternity := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Paternity Leave');
SET @lwop := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Leave Without Pay');

-- Every weekday an Admin employee has no DTR record (Sep 11 – Oct 8) was an
-- approved sick leave — so those days are paid as leave in payroll.
INSERT INTO employee_leave (adminstaff_id, leave_category, leave_category_id, is_paid, reason, status,
    date_requested, date_approved, approved_by, recorded_by, date_from, date_to, remarks, total_days, total_leave_credit)
SELECT e.adminstaff_id, 'Sick Leave', @sick, 1, 'Fever; medical certificate submitted.', 'Approved',
       TIMESTAMP(t.d, '07:30:00'), TIMESTAMP(t.d + INTERVAL 1 DAY, '09:00:00'), @masterName, @master,
       t.d, t.d, 'Medical certificate on file.', 1, 15
FROM tmp_days t
JOIN tmp_emp e ON e.kind = 'Admin'
WHERE WEEKDAY(t.d) < 5 AND t.d <= '2026-10-08'
  AND NOT EXISTS (SELECT 1 FROM daily_time_record r WHERE r.adminstaff_id = e.adminstaff_id AND r.record_date = t.d);

-- Other approved leave, as the Payroll Master records it (approved outside the system).
INSERT INTO employee_leave (faculty_id, adminstaff_id, leave_category, leave_category_id, is_paid, reason, status,
    date_requested, date_approved, approved_by, recorded_by, date_from, date_to, remarks, total_days, total_leave_credit)
VALUES
    -- paid: family trip
    (NULL, @a2, 'Vacation Leave', @vacation, 1, 'Family trip to Bicol.', 'Approved',
     '2026-10-07 10:15:00', '2026-10-07 10:15:00', @masterName, @master, '2026-10-19', '2026-10-21', NULL, 3, 15),
    -- unpaid
    (NULL, @a4, 'Leave Without Pay', @lwop, 0, 'Accompanying a family member to a hospital in Manila.', 'Approved',
     '2026-10-06 08:45:00', '2026-10-06 16:00:00', @masterName, @master, '2026-10-22', '2026-10-23', NULL, 2, NULL),
    -- paid, faculty
    (@f1, NULL, 'Paternity Leave', @paternity, 1, 'Birth of second child (expected Oct 27).', 'Approved',
     '2026-10-08 11:20:00', '2026-10-08 11:20:00', @masterName, @master, '2026-10-27', '2026-11-04', NULL, 7, NULL);


-- ---------------------------------------------------------------
-- 6. Loan Management (no deductions yet: payroll hasn't been released;
--    releasing a period records the deductions against these loans)
-- ---------------------------------------------------------------

INSERT INTO loan (faculty_id, adminstaff_id, loan_type, loan_amount, `current_date`, date_from, date_to,
    reference_no, deduction_per_payroll, remarks, recorded_by)
VALUES
    (NULL, @a1, 'SSS Salary Loan', 20000.00, '2026-09-08', '2026-09-11', NULL, 'SSS-2026-104501', 1000.00, 'Approved by SSS on Sep 4.', @master),
    (NULL, @a2, 'Pag-IBIG MPL', 15000.00, '2026-09-22', '2026-09-26', NULL, 'HDMF-MPL-2026-0206', 750.00, NULL, @master),
    (@f1, NULL, 'Pag-IBIG Calamity Loan', 10000.00, '2026-10-06', '2026-10-11', NULL, 'HDMF-CAL-2026-0031', 500.00, 'Typhoon damage to house.', @master),
    (NULL, @a6, 'Other Loan', 3000.00, '2026-09-09', '2026-09-11', NULL, 'ADV-2026-007', 1500.00, 'Salary advance.', @master);


-- ---------------------------------------------------------------
-- 7. Benefits Table: allowances paid every payroll period
-- ---------------------------------------------------------------

INSERT IGNORE INTO benefit (benefit_name, default_amount, is_active) VALUES
    ('Rice Allowance', 500.00, 1),
    ('Transportation Allowance', 300.00, 1),
    ('Internet Allowance', 250.00, 1);

SET @rice := (SELECT benefit_id FROM benefit WHERE benefit_name = 'Rice Allowance');
SET @transport := (SELECT benefit_id FROM benefit WHERE benefit_name = 'Transportation Allowance');
SET @internet := (SELECT benefit_id FROM benefit WHERE benefit_name = 'Internet Allowance');

INSERT INTO employee_benefit (benefit_id, faculty_id, adminstaff_id, amount)
SELECT @rice, e.faculty_id, e.adminstaff_id, 500.00 FROM tmp_emp e;

INSERT INTO employee_benefit (benefit_id, faculty_id, adminstaff_id, amount)
SELECT @transport, e.faculty_id, e.adminstaff_id, 300.00 FROM tmp_emp e WHERE e.kind IN ('Admin', 'Faculty/Admin');

INSERT INTO employee_benefit (benefit_id, faculty_id, adminstaff_id, amount)
SELECT @internet, e.faculty_id, e.adminstaff_id, 250.00 FROM tmp_emp e WHERE e.kind IN ('Faculty', 'Faculty/Admin');


-- ---------------------------------------------------------------
-- 8. Basic pay (monthly, record only): a regular month at their rates.
--    Admin: rate/hour x office hours x 22 days. Faculty/Admin: that plus
--    rate/hour/unit x weekly lecture hours x 4. Faculty have no basic pay.
-- ---------------------------------------------------------------

UPDATE admin_staff
SET basic_pay = ROUND(IFNULL(rate_per_hour, 0) * IFNULL(office_hours, 0) * 22
                + IF(is_faculty, IFNULL(rate_per_hour_unit, 0) * IFNULL(lecture_hours, 0) * 4, 0))
WHERE employee_number IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F');


-- ---------------------------------------------------------------
-- Clean up and show what was added
-- ---------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS tmp_emp;
DROP TEMPORARY TABLE IF EXISTS tmp_plan;
DROP TEMPORARY TABLE IF EXISTS tmp_days;
DROP TEMPORARY TABLE IF EXISTS tmp_cls;

SELECT 'Sample employees' AS item,
       (SELECT COUNT(*) FROM faculty_staff WHERE employee_number IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F'))
     + (SELECT COUNT(*) FROM admin_staff WHERE employee_number IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F')) AS total
UNION ALL
SELECT 'Classes (Sep 11 – Oct 25)', COUNT(*) FROM faculty_class_schedule c
    LEFT JOIN faculty_staff f ON f.faculty_id = c.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = c.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F')
UNION ALL
SELECT CONCAT('Classroom checks: ', approval_status), COUNT(*) FROM faculty_teaching_attendance ta
    JOIN faculty_class_schedule c ON c.class_schedule_id = ta.class_schedule_id
    LEFT JOIN faculty_staff f ON f.faculty_id = c.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = c.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F')
    GROUP BY approval_status
UNION ALL
SELECT 'DTR records (Sep 11 – Oct 8)', COUNT(*) FROM daily_time_record r
    LEFT JOIN faculty_staff f ON f.faculty_id = r.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = r.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F')
UNION ALL
SELECT CONCAT('Leave requests: ', l.status), COUNT(*) FROM employee_leave l
    LEFT JOIN faculty_staff f ON f.faculty_id = l.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = l.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F')
    GROUP BY l.status
UNION ALL
SELECT 'Loans', COUNT(*) FROM loan WHERE reference_no IN ('SSS-2026-104501', 'HDMF-MPL-2026-0206', 'HDMF-CAL-2026-0031', 'ADV-2026-007')
UNION ALL
SELECT CONCAT('Benefit: ', b.benefit_name), COUNT(*) FROM employee_benefit eb JOIN benefit b USING (benefit_id)
    LEFT JOIN faculty_staff f ON f.faculty_id = eb.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = eb.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0001-M', 'STIBLN-0002-F', 'STIBLN-0003-M', 'STIBLN-0004-M', 'STIBLN-0005-M', 'STIBLN-0006-M', 'STIBLN-0007-F', 'STIBLN-0008-F', 'STIBLN-0009-F', 'STIBLN-0010-F')
    GROUP BY b.benefit_name;


-- ---------------------------------------------------------------
-- 9. Twenty more employees (STIBLN-0011 to STIBLN-0030) — 8 Faculty,
--    8 Admin, 4 Faculty/Admin — same ratio as the first 10, with a wider
--    mix of scenarios: approved / pending / rejected / unpaid leave,
--    loans, a resignation, part-time and contractual staff, and a
--    Monday class that lands on a double-pay regular holiday.
--
--   Aug 11 – Aug 25, 2026   pay period 1
--   Aug 26 – Sep 10, 2026   pay period 2
--   Sep 11 – Sep 25, 2026   pay period 3 (shared with the first 10)
--   Sep 26 – Oct 10, 2026   pay period 4 (shared with the first 10, DTR to Oct 8)
--   Oct 11 – Oct 25, 2026   pay period 5 (shared with the first 10; classes only)
--
-- Scenarios by employee (Employee ID):
--   STIBLN-0012-F  Jasmine Rosales       approved Vacation Leave (Aug 24–26)
--   STIBLN-0013-M  Edgar Manalo          Pag-IBIG Calamity Loan
--   STIBLN-0014-F  Mariel Santiago       part-time; notable classroom absences (unexcused)
--   STIBLN-0015-M  Noel Marasigan        leave request Pending
--   STIBLN-0016-F  Charisse Trinidad     leave request Rejected
--   STIBLN-0017-M  Ferdinand Dela Cruz   Monday class on Aug 31 (National Heroes Day, double pay)
--   STIBLN-0018-F  Precious Gatdula      approved Leave Without Pay (Sep 18–19)
--   STIBLN-0020-F  Sheila Bagsic         SSS Salary Loan
--   STIBLN-0022-F  Maricel Esguerra      approved Sick Leave, 3 days (hospitalization)
--   STIBLN-0023-M  Johnny Maranan        Personal/Other Loan
--   STIBLN-0024-F  Divina Lumbres        Resigned effective Sep 16, 2026
--   STIBLN-0027-M  Arnel Rosario         Pag-IBIG MPL
--   STIBLN-0028-F  Grace Nepomuceno      approved Maternity Leave (starting Nov 2)
--   STIBLN-0030-F  Len Aldave            salary-advance (Other) loan
--   the rest (0011, 0019, 0021, 0025, 0026, 0029) are the diverse baseline:
--   normal attendance, a mix of Full-time / Part-time / Contractual.
--
-- Safe to run again: the 20 employees below (Employee IDs STIBLN-0011 to
-- STIBLN-0030, emails @example.com) are deleted first, with everything
-- linked to them, and their five pay periods' payroll runs are cleared so
-- they can be run again.
-- ---------------------------------------------------------------

SET @master2 := (SELECT user_id FROM users
                WHERE role = 'Payroll Master' AND is_active = 1
                ORDER BY user_id LIMIT 1);

DELETE FROM payroll_run
WHERE (pay_period_start, pay_period_end) IN
      (('2026-08-11', '2026-08-25'), ('2026-08-26', '2026-09-10'),
       ('2026-09-11', '2026-09-25'), ('2026-09-26', '2026-10-10'), ('2026-10-11', '2026-10-25'));
SET @ids20 := "'STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F'";
DELETE FROM faculty_staff WHERE employee_number IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F');
DELETE FROM admin_staff   WHERE employee_number IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F');


-- ---------------------------------------------------------------
-- 9.1 Employees
-- ---------------------------------------------------------------

-- Faculty (faculty_staff)
INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0011-M', '111', 'Marco', 'Ilagan', 'Dimaculangan', 'Male', 32, '1994-02-10',
    '09171234511', 'Brgy. Poblacion 1, Balayan, Batangas', 'mikeyyy.tagle28+18@gmail.com', 'Single', 0, 'Active', 'Full-time', '2022-06-01',
    12, 3.0, 400.00, '34-1234511-11', '12-345678911-11', '1234-5678-9111', '123-456-711-000', 'Instructor I', 'Computer Science department.');
SET @nf1 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0012-F', '112', 'Jasmine', 'Alano', 'Rosales', 'Female', 35, '1991-05-20',
    '09171234512', 'Brgy. Calzada, Calaca, Batangas', 'mikeyyy.tagle28+10@gmail.com', 'Married', 1, 'Active', 'Full-time', '2017-07-10',
    9, 3.0, 410.00, '34-1234512-12', '12-345678912-12', '1234-5678-9112', '123-456-712-000', 'Instructor II', 'General Education; approved vacation Aug 24-26.');
SET @nf2 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0013-M', '113', 'Edgar', 'Buenaventura', 'Manalo', 'Male', 44, '1982-01-15',
    '09171234513', 'Brgy. Sampaga, Balayan, Batangas', 'mikeyyy.tagle28+7@gmail.com', 'Married', 3, 'Active', 'Full-time', '2013-03-05',
    15, 4.0, 450.00, '34-1234513-13', '12-345678913-13', '1234-5678-9113', '123-456-713-000', 'Instructor III', 'Information Systems; Pag-IBIG Calamity Loan on file.');
SET @nf3 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0014-F', '114', 'Mariel', 'Corpuz', 'Santiago', 'Female', 27, '1999-09-02',
    '09171234514', 'Brgy. Lanatan, Balayan, Batangas', 'mikeyyy.tagle28+20@gmail.com', 'Single', 0, 'Active', 'Part-time', '2024-08-12',
    3, 3.0, 370.00, '34-1234514-14', '12-345678914-14', '1234-5678-9114', '123-456-714-000', 'Instructor I', 'Humanities; part-time, one weekly meeting.');
SET @nf4 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0015-M', '115', 'Noel', 'Peralta', 'Marasigan', 'Male', 39, '1987-04-18',
    '09171234515', 'Brgy. Gimalas, Balayan, Batangas', 'mikeyyy.tagle28+21@gmail.com', 'Married', 2, 'Active', 'Full-time', '2015-01-20',
    9, 3.0, 420.00, '34-1234515-15', '12-345678915-15', '1234-5678-9115', '123-456-715-000', 'Instructor II', 'Statistics; leave request pending approval.');
SET @nf5 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0016-F', '116', 'Charisse', 'Ballon', 'Trinidad', 'Female', 26, '2000-03-09',
    '09171234516', 'Brgy. Navotas, Balayan, Batangas', 'mikeyyy.tagle28+4@gmail.com', 'Single', 0, 'Active', 'Contractual', '2025-01-06',
    6, 3.0, 360.00, '34-1234516-16', '12-345678916-16', '1234-5678-9116', '123-456-716-000', 'Instructor I', 'Hospitality Management; one leave request rejected.');
SET @nf6 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0017-M', '117', 'Ferdinand', 'Lontoc', 'Dela Cruz', 'Male', 47, '1979-06-25',
    '09171234517', 'Brgy. Caloocan, Balayan, Batangas', 'mikeyyy.tagle28+8@gmail.com', 'Married', 2, 'Active', 'Full-time', '2011-09-15',
    12, 3.0, 440.00, '34-1234517-17', '12-345678917-17', '1234-5678-9117', '123-456-717-000', 'Instructor III', 'IT department; Monday class falls on National Heroes Day (Aug 31), paid double.');
SET @nf7 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('STIBLN-0018-F', '118', 'Precious Anne', 'Navarro', 'Gatdula', 'Female', 30, '1996-07-30',
    '09171234518', 'Brgy. Dalig, Balayan, Batangas', 'mikeyyy.tagle28+24@gmail.com', 'Married', 1, 'Active', 'Full-time', '2019-10-02',
    9, 3.0, 400.00, '34-1234518-18', '12-345678918-18', '1234-5678-9118', '123-456-718-000', 'Instructor II', 'Business department; unpaid leave Sep 18-19.');
SET @nf8 := LAST_INSERT_ID();

-- Admin (admin_staff, is_faculty = 0)
INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0019-M', '119', 'Allan', 'Basilio', 'Jimenez', 'Male', 40, '1986-02-11',
    '09171234519', 'Brgy. Poblacion 2, Balayan, Batangas', 'mikeyyy.tagle28+1@gmail.com', 'Married', 2, 'Active', 'Full-time', '2014-05-19',
    'Human Resources', 'HR Officer', 8.0, 130.00, 0, '34-1234519-19', '12-345678919-19', '1234-5678-9119', '123-456-719-000', NULL);
SET @na1 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0020-F', '120', 'Sheila Marie', 'Antazo', 'Bagsic', 'Female', 33, '1993-08-14',
    '09171234520', 'Brgy. Lucban, Balayan, Batangas', 'mikeyyy.tagle28+28@gmail.com', 'Single', 0, 'Active', 'Full-time', '2019-03-11',
    'Library', 'Librarian', 8.0, 110.00, 0, '34-1234520-20', '12-345678920-20', '1234-5678-9120', '123-456-720-000', 'SSS Salary Loan on file.');
SET @na2 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0021-M', '121', 'Rolando', 'Estrella', 'Panganiban', 'Male', 48, '1978-12-01',
    '09171234521', 'Brgy. Munting Indang, Balayan, Batangas', 'mikeyyy.tagle28+26@gmail.com', 'Married', 3, 'Active', 'Full-time', '2009-11-03',
    'Security', 'Security Head', 8.0, 120.00, 0, '34-1234521-21', '12-345678921-21', '1234-5678-9121', '123-456-721-000', NULL);
SET @na3 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0022-F', '122', 'Maricel', 'Dungo', 'Esguerra', 'Female', 37, '1989-10-05',
    '09171234522', 'Brgy. Santa Ana, Balayan, Batangas', 'mikeyyy.tagle28+19@gmail.com', 'Married', 2, 'Active', 'Full-time', '2016-04-20',
    'Guidance Office', 'Guidance Counselor', 8.0, 125.00, 0, '34-1234522-22', '12-345678922-22', '1234-5678-9122', '123-456-722-000', 'Hospitalized Sep 1-3; sick leave approved.');
SET @na4 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0023-M', '123', 'Johnny', 'Rivera', 'Maranan', 'Male', 29, '1997-01-27',
    '09171234523', 'Brgy. Gumamela, Balayan, Batangas', 'mikeyyy.tagle28+12@gmail.com', 'Single', 0, 'Active', 'Contractual', '2023-10-16',
    'Procurement', 'Procurement Officer', 8.0, 100.00, 0, '34-1234523-23', '12-345678923-23', '1234-5678-9123', '123-456-723-000', 'Personal loan on file.');
SET @na5 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0024-F', '124', 'Divina Gracia', 'Olivar', 'Lumbres', 'Female', 42, '1984-05-09',
    '09171234524', 'Brgy. Sulok, Balayan, Batangas', 'mikeyyy.tagle28+6@gmail.com', 'Widowed', 1, 'Resigned', 'Full-time', '2012-02-13',
    'Clinic', 'School Nurse', 8.0, 115.00, 0, '34-1234524-24', '12-345678924-24', '1234-5678-9124', '123-456-724-000', 'Resigned effective Sep 16, 2026.');
SET @na6 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0025-M', '125', 'Kevin', 'Montalbo', 'Abrigo', 'Male', 25, '2001-11-19',
    '09171234525', 'Brgy. Niyugan, Balayan, Batangas', 'mikeyyy.tagle28+14@gmail.com', 'Single', 0, 'Active', 'Full-time', '2024-02-05',
    'IT Department', 'IT Support Staff', 8.0, 105.00, 0, '34-1234525-25', '12-345678925-25', '1234-5678-9125', '123-456-725-000', NULL);
SET @na7 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0026-F', '126', 'Rowena', 'Faustino', 'Katigbak', 'Female', 36, '1990-06-08',
    '09171234526', 'Brgy. Tangos, Balayan, Batangas', 'mikeyyy.tagle28+27@gmail.com', 'Married', 1, 'Active', 'Part-time', '2021-08-23',
    'Admissions', 'Admissions Staff', 4.0, 95.00, 0, '34-1234526-26', '12-345678926-26', '1234-5678-9126', '123-456-726-000', 'Part-time, half-day schedule.');
SET @na8 := LAST_INSERT_ID();

-- Faculty/Admin (admin_staff, is_faculty = 1)
INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0027-M', '127', 'Arnel', 'Bautista', 'Rosario', 'Male', 45, '1981-03-02',
    '09171234527', 'Brgy. Dilao, Balayan, Batangas', 'mikeyyy.tagle28+3@gmail.com', 'Married', 2, 'Active', 'Full-time', '2010-06-21',
    'Academic Affairs', 'Program Head', 8.0, 165.00, 1, 'Instructor III', 400.00, 3, 2.0,
    '34-1234527-27', '12-345678927-27', '1234-5678-9127', '123-456-727-000', 'Business program; Pag-IBIG MPL loan on file.');
SET @na9 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0028-F', '128', 'Grace', 'Villamor', 'Nepomuceno', 'Female', 34, '1992-02-27',
    '09171234528', 'Brgy. Calabuso, Balayan, Batangas', 'mikeyyy.tagle28+9@gmail.com', 'Married', 1, 'Active', 'Full-time', '2018-09-17',
    'Academic Affairs', 'Department Coordinator', 8.0, 150.00, 1, 'Instructor II', 390.00, 3, 1.5,
    '34-1234528-28', '12-345678928-28', '1234-5678-9128', '123-456-728-000', 'IT program; maternity leave approved starting Nov 2.');
SET @na10 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0029-M', '129', 'Oliver', 'Tagle', 'Macaraeg', 'Male', 38, '1988-08-08',
    '09171234529', 'Brgy. Sta. Maria, Balayan, Batangas', 'mikeyyy.tagle28+22@gmail.com', 'Married', 2, 'Active', 'Full-time', '2014-10-13',
    'Guidance Office', 'Guidance Head', 8.0, 155.00, 1, 'Instructor II', 380.00, 3, 1.5,
    '34-1234529-29', '12-345678929-29', '1234-5678-9129', '123-456-729-000', 'Also teaches Values Education.');
SET @na11 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('STIBLN-0030-F', '130', 'Len', 'Hernandez', 'Aldave', 'Female', 31, '1995-04-16',
    '09171234530', 'Brgy. Santo Nino, Balayan, Batangas', 'mikeyyy.tagle28+16@gmail.com', 'Single', 0, 'Active', 'Full-time', '2020-05-04',
    'Registrar', 'Registrar Supervisor', 8.0, 145.00, 1, 'Instructor I', 360.00, 3, 2.0,
    '34-1234530-30', '12-345678930-30', '1234-5678-9130', '123-456-730-000', 'Also teaches Office Systems; other loan on file.');
SET @na12 := LAST_INSERT_ID();


-- ---------------------------------------------------------------
-- Helper tables (dropped at the end)
-- ---------------------------------------------------------------

-- k = new employee 1-20 (STIBLN-0011 to STIBLN-0030).
DROP TEMPORARY TABLE IF EXISTS tmp_emp;
CREATE TEMPORARY TABLE tmp_emp (k INT PRIMARY KEY, faculty_id INT NULL, adminstaff_id INT NULL, kind VARCHAR(15));
INSERT INTO tmp_emp VALUES
    (1, @nf1, NULL, 'Faculty'), (2, @nf2, NULL, 'Faculty'), (3, @nf3, NULL, 'Faculty'), (4, @nf4, NULL, 'Faculty'),
    (5, @nf5, NULL, 'Faculty'), (6, @nf6, NULL, 'Faculty'), (7, @nf7, NULL, 'Faculty'), (8, @nf8, NULL, 'Faculty'),
    (9, NULL, @na1, 'Admin'), (10, NULL, @na2, 'Admin'), (11, NULL, @na3, 'Admin'), (12, NULL, @na4, 'Admin'),
    (13, NULL, @na5, 'Admin'), (14, NULL, @na6, 'Admin'), (15, NULL, @na7, 'Admin'), (16, NULL, @na8, 'Admin'),
    (17, NULL, @na9, 'Faculty/Admin'), (18, NULL, @na10, 'Faculty/Admin'), (19, NULL, @na11, 'Faculty/Admin'), (20, NULL, @na12, 'Faculty/Admin');

-- Weekly teaching plan. wd = WEEKDAY(): 0 = Monday … 4 = Friday.
DROP TEMPORARY TABLE IF EXISTS tmp_plan;
CREATE TEMPORARY TABLE tmp_plan (k INT, wd INT, t_start TIME, t_end TIME, subject VARCHAR(100), section VARCHAR(50), room VARCHAR(50));
INSERT INTO tmp_plan VALUES
    (1, 0, '07:30', '09:00', 'Fundamentals of Programming', 'BSIT 1A', 'CLAB 1'),
    (1, 2, '07:30', '09:00', 'Fundamentals of Programming', 'BSIT 1A', 'CLAB 1'),
    (2, 1, '10:00', '11:30', 'Oral Communication', 'BSHM 1B', 'Room 210'),
    (2, 3, '10:00', '11:30', 'Oral Communication', 'BSHM 1B', 'Room 210'),
    (3, 0, '13:00', '15:00', 'Information Management', 'BSIT 3A', 'CLAB 2'),
    (3, 2, '13:00', '15:00', 'Information Management', 'BSIT 3A', 'CLAB 2'),
    (4, 4, '08:00', '11:00', 'Rizal''s Life and Works', 'BSBA 1B', 'Room 211'),
    (5, 1, '13:00', '14:30', 'Statistics and Probability', 'BSTM 2A', 'Room 212'),
    (5, 3, '13:00', '14:30', 'Statistics and Probability', 'BSTM 2A', 'Room 212'),
    (6, 2, '09:00', '12:00', 'Front Office Operations', 'BSHM 2B', 'Room 213'),
    (7, 0, '10:00', '11:30', 'Object-Oriented Programming', 'BSIT 2A', 'CLAB 1'),
    (7, 2, '10:00', '11:30', 'Object-Oriented Programming', 'BSIT 2A', 'CLAB 1'),
    (8, 1, '08:00', '09:30', 'Human Behavior in Organization', 'BSBA 2B', 'Room 214'),
    (8, 3, '08:00', '09:30', 'Human Behavior in Organization', 'BSBA 2B', 'Room 214'),
    (17, 3, '14:00', '16:00', 'Strategic Management', 'BSBA 3A', 'Room 215'),
    (18, 0, '08:00', '09:30', 'Research Methods', 'BSIT 3B', 'Room 216'),
    (19, 2, '14:00', '15:30', 'Values Education', 'BSHM 1A', 'Room 217'),
    (20, 4, '10:00', '12:00', 'Office Systems and Procedures', 'BSOA 1A', 'Room 218');

-- Every date from Aug 11 to Oct 25, 2026 (76 days).
DROP TEMPORARY TABLE IF EXISTS tmp_days;
CREATE TEMPORARY TABLE tmp_days AS
    SELECT DATE('2026-08-11') + INTERVAL seq DAY AS d FROM seq_0_to_75;


-- ---------------------------------------------------------------
-- 9.2 Faculty Schedule: weekly classes Aug 11 – Oct 25
-- ---------------------------------------------------------------

INSERT INTO faculty_class_schedule (faculty_id, adminstaff_id, subject, class_section, room, class_date,
    scheduled_start, scheduled_end, grace_period_minutes, schedule_status, status_reason,
    created_by, updated_by, created_at, updated_at)
SELECT e.faculty_id, e.adminstaff_id, p.subject, p.section, p.room, t.d,
       p.t_start, p.t_end, 15,
       IF(t.d = '2026-09-25', 'Cancelled', 'Scheduled'),
       IF(t.d = '2026-09-25', 'Class suspension (Tropical Cyclone Wind Signal No. 2)', NULL),
       @master2, @master2, '2026-08-07 09:00:00',
       IF(t.d = '2026-09-25', '2026-09-24 18:30:00', '2026-08-07 09:00:00')
FROM tmp_days t
JOIN tmp_plan p ON WEEKDAY(t.d) = p.wd
JOIN tmp_emp e ON e.k = p.k
ORDER BY t.d, p.t_start;

INSERT INTO faculty_schedule_history (class_schedule_id, action, details, changed_by, changed_at)
SELECT c.class_schedule_id, 'Created',
       CONCAT(c.subject, ' (', c.class_section, '), ', c.room, ', ', c.class_date, ' ',
              TIME_FORMAT(c.scheduled_start, '%H:%i'), '–', TIME_FORMAT(c.scheduled_end, '%H:%i')),
       @master2, '2026-08-07 09:00:00'
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id;

INSERT INTO faculty_schedule_history (class_schedule_id, action, details, changed_by, changed_at)
SELECT c.class_schedule_id, 'Cancelled', c.status_reason, @master2, '2026-09-24 18:30:00'
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.schedule_status = 'Cancelled';


-- ---------------------------------------------------------------
-- 9.3 Faculty Teaching Hours: classroom checks up to Oct 8
-- ---------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS tmp_cls;
CREATE TEMPORARY TABLE tmp_cls AS
SELECT c.class_schedule_id AS id, e.k, c.class_date AS d, c.scheduled_start AS s, c.scheduled_end AS en,
       MOD(e.k * 11 + DAY(c.class_date) * 5 + MONTH(c.class_date) * 2 + HOUR(c.scheduled_start) * 3, 20) AS v,
       CAST('' AS CHAR(12)) AS outcome, CAST('' AS CHAR(12)) AS final
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.schedule_status = 'Scheduled' AND c.class_date <= '2026-10-08';

UPDATE tmp_cls SET outcome = CASE
    WHEN d = '2026-10-08' AND MOD(v, 2) = 0 THEN 'none'
    WHEN d = '2026-10-08' THEN 'incomplete'
    WHEN k = 4 AND d IN ('2026-08-21', '2026-09-18', '2026-10-02') THEN 'absent'   -- Mariel Santiago: several unexcused classroom absences
    WHEN v = 0 THEN 'absent'
    WHEN v = 2 THEN 'early'
    WHEN v = 1 THEN 'latecheck'
    WHEN d = '2026-10-07' AND MOD(v, 3) = 0 THEN 'incomplete'
    ELSE 'ok' END;

UPDATE tmp_cls SET final = CASE
    WHEN outcome = 'none' THEN ''
    WHEN outcome = 'incomplete' THEN 'Incomplete'
    WHEN d >= '2026-10-03' THEN 'Pending'
    WHEN outcome IN ('absent', 'early') THEN 'Rejected'
    ELSE 'Approved' END;

INSERT INTO faculty_teaching_attendance (class_schedule_id,
    start_check_at, start_check_status, start_checked_by,
    end_check_at, end_check_status, end_checked_by,
    remarks, approval_status, payable_hours, approved_by, approved_at, review_note, created_at, updated_at)
SELECT t.id,
       TIMESTAMP(t.d, t.s) + INTERVAL IF(t.outcome = 'latecheck', 25, MOD(t.v, 8) + 1) MINUTE,
       IF(t.outcome = 'absent', 'Absent', 'Present'),
       @master2,
       IF(t.outcome = 'incomplete', NULL, TIMESTAMP(t.d, t.en) - INTERVAL (MOD(t.v, 6) + 1) MINUTE),
       IF(t.outcome = 'incomplete', NULL, IF(t.outcome IN ('absent', 'early'), 'Absent', 'Present')),
       IF(t.outcome = 'incomplete', NULL, @master2),
       CASE t.outcome
           WHEN 'absent' THEN 'Classroom empty at both checks.'
           WHEN 'early' THEN 'Class dismissed early; faculty not in the room at the ending check.'
           WHEN 'latecheck' THEN 'Beginning check done late (staff meeting ran over).'
           ELSE NULL END,
       t.final,
       CASE t.final
           WHEN 'Approved' THEN ROUND(TIME_TO_SEC(TIMEDIFF(t.en, t.s)) / 3600, 2)
           WHEN 'Rejected' THEN 0
           ELSE NULL END,
       IF(t.final IN ('Approved', 'Rejected'), @master2, NULL),
       IF(t.final IN ('Approved', 'Rejected'), TIMESTAMP(t.d + INTERVAL 1 DAY, '16:30:00'), NULL),
       CASE
           WHEN t.final = 'Rejected' AND t.outcome = 'absent' THEN 'Faculty absent; no substitute arranged.'
           WHEN t.final = 'Rejected' THEN 'Left before the end of class.'
           WHEN t.final = 'Approved' AND t.outcome = 'latecheck' THEN 'Checked late; faculty confirmed present from the start of class.'
           ELSE NULL END,
       TIMESTAMP(t.d, t.s),
       TIMESTAMP(t.d, t.en)
FROM tmp_cls t
WHERE t.outcome <> 'none';

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, 'Beginning check recorded',
       CONCAT(TIME_FORMAT(a.start_check_at, '%H:%i'), ' ', a.start_check_status), NULL, @master2, a.start_check_at
FROM faculty_teaching_attendance a JOIN tmp_cls t ON t.id = a.class_schedule_id;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, 'Ending check recorded',
       CONCAT(TIME_FORMAT(a.end_check_at, '%H:%i'), ' ', a.end_check_status), NULL, @master2, a.end_check_at
FROM faculty_teaching_attendance a JOIN tmp_cls t ON t.id = a.class_schedule_id
WHERE a.end_check_at IS NOT NULL;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, a.approval_status,
       IF(a.approval_status = 'Approved',
          CONCAT('Payable teaching hours: ', a.payable_hours),
          'No teaching hours will be paid for this class.'),
       a.review_note, @master2, a.approved_at
FROM faculty_teaching_attendance a JOIN tmp_cls t ON t.id = a.class_schedule_id
WHERE a.approval_status IN ('Approved', 'Rejected');


-- ---------------------------------------------------------------
-- 9.4 Daily Time Record (biometric), weekdays Aug 11 – Oct 8
-- ---------------------------------------------------------------

INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date,
    time_in, time_out, status, is_manual_entry, remarks, recorded_by, created_at)
SELECT s.fingerprint_id, NULL, NULL, x.adminstaff_id, x.d,
       CASE WHEN x.w IN (1, 2) THEN ADDTIME('08:20:00', SEC_TO_TIME(x.w * 9 * 60))
            WHEN x.w = 3 THEN '08:00:00'
            ELSE ADDTIME('07:40:00', SEC_TO_TIME(MOD(x.w, 19) * 60)) END,
       ADDTIME('17:00:00', SEC_TO_TIME(MOD(x.w * 3, 16) * 60)),
       IF(x.w IN (1, 2), 'Late', 'Present'),
       IF(x.w = 3, 1, 0),
       IF(x.w = 3, 'Fingerprint not read by the scanner; time verified by the department head.', NULL),
       IF(x.w = 3, @master2, NULL),
       TIMESTAMP(x.d, '17:30:00')
FROM (
    SELECT e.k, e.adminstaff_id, e.kind, t.d, MOD(e.k * 17 + DAY(t.d) * 7 + MONTH(t.d) * 3, 25) AS w
    FROM tmp_days t JOIN tmp_emp e ON e.kind IN ('Admin', 'Faculty/Admin')
    WHERE WEEKDAY(t.d) < 5 AND t.d <= '2026-10-08'
) x
JOIN admin_staff s ON s.adminstaff_id = x.adminstaff_id
WHERE NOT (x.w = 0 AND x.kind = 'Admin');

INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date,
    time_in, time_out, status, is_manual_entry, remarks, recorded_by, created_at)
SELECT f.fingerprint_id, NULL, f.faculty_id, NULL, x.d,
       SUBTIME(x.first_start, SEC_TO_TIME((10 + MOD(x.mv, 10)) * 60)),
       ADDTIME(x.last_end, SEC_TO_TIME((5 + MOD(x.mv, 10)) * 60)),
       'Present', 0, NULL, NULL, TIMESTAMP(x.d, x.last_end)
FROM (
    SELECT t.k, t.d, MIN(t.s) AS first_start, MAX(t.en) AS last_end, MIN(t.v) AS mv,
           SUM(t.outcome = 'absent') AS absences
    FROM tmp_cls t
    WHERE t.k BETWEEN 1 AND 8
    GROUP BY t.k, t.d
) x
JOIN tmp_emp e ON e.k = x.k
JOIN faculty_staff f ON f.faculty_id = e.faculty_id
WHERE x.absences = 0;

-- Divina Lumbres (STIBLN-0024-F) resigned Sep 16, 2026: remove her DTR after that date.
DELETE r FROM daily_time_record r
JOIN admin_staff a ON a.adminstaff_id = r.adminstaff_id
WHERE a.employee_number = 'STIBLN-0024-F' AND r.record_date >= '2026-09-16';


-- ---------------------------------------------------------------
-- 9.5 Leave Management
-- ---------------------------------------------------------------

SET @masterName2 := (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE user_id = @master2);
SET @sick2 := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Sick Leave');
SET @vacation2 := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Vacation Leave');
SET @maternity2 := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Maternity Leave');
SET @lwop2 := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Leave Without Pay');

-- Every Admin weekday with no DTR record (Aug 11 – Oct 8, excluding Divina
-- Lumbres' post-resignation gap, already not a weekday-absence case) is an
-- approved sick leave.
INSERT INTO employee_leave (adminstaff_id, leave_category, leave_category_id, is_paid, reason, status,
    date_requested, date_approved, approved_by, recorded_by, date_from, date_to, remarks, total_days, total_leave_credit)
SELECT e.adminstaff_id, 'Sick Leave', @sick2, 1, 'Fever; medical certificate submitted.', 'Approved',
       TIMESTAMP(t.d, '07:30:00'), TIMESTAMP(t.d + INTERVAL 1 DAY, '09:00:00'), @masterName2, @master2,
       t.d, t.d, 'Medical certificate on file.', 1, 15
FROM tmp_days t
JOIN tmp_emp e ON e.kind = 'Admin'
JOIN admin_staff a ON a.adminstaff_id = e.adminstaff_id
WHERE WEEKDAY(t.d) < 5 AND t.d <= '2026-10-08'
  AND NOT (a.employee_number = 'STIBLN-0024-F' AND t.d >= '2026-09-16')
  AND NOT EXISTS (SELECT 1 FROM daily_time_record r WHERE r.adminstaff_id = e.adminstaff_id AND r.record_date = t.d);

-- Explicit leave requests, in all four statuses.
INSERT INTO employee_leave (faculty_id, adminstaff_id, leave_category, leave_category_id, is_paid, reason, status,
    date_requested, date_approved, approved_by, recorded_by, date_from, date_to, remarks, total_days, total_leave_credit)
VALUES
    -- approved: family event
    (@nf2, NULL, 'Vacation Leave', @vacation2, 1, 'Cousin''s wedding in Nasugbu.', 'Approved',
     '2026-08-18 09:00:00', '2026-08-18 09:00:00', @masterName2, @master2, '2026-08-24', '2026-08-26', NULL, 3, 15),
    -- pending: not yet decided
    (@nf5, NULL, 'Vacation Leave', @vacation2, 1, 'Family reunion in Cavite.', 'Pending',
     '2026-10-07 15:40:00', NULL, NULL, @master2, '2026-10-26', '2026-10-27', NULL, 2, 15),
    -- rejected: schedule conflict with classes
    (@nf6, NULL, 'Vacation Leave', @vacation2, 1, 'Personal trip.', 'Rejected',
     '2026-10-05 08:10:00', '2026-10-05 16:00:00', @masterName2, @master2, '2026-10-15', '2026-10-16',
     'No available substitute for Front Office Operations.', 2, 15),
    -- unpaid: approved
    (@nf8, NULL, 'Leave Without Pay', @lwop2, 0, 'Attending to a family matter in Lipa.', 'Approved',
     '2026-09-15 10:00:00', '2026-09-15 14:00:00', @masterName2, @master2, '2026-09-18', '2026-09-19', NULL, 2, NULL),
    -- approved: multi-day hospitalization
    (NULL, @na4, 'Sick Leave', @sick2, 1, 'Hospitalized for dengue fever.', 'Approved',
     '2026-08-29 07:45:00', '2026-08-29 08:30:00', @masterName2, @master2, '2026-09-01', '2026-09-03',
     'Medical certificate and hospital discharge summary on file.', 3, 15),
    -- approved: upcoming maternity leave
    (NULL, @na10, 'Maternity Leave', @maternity2, 1, 'Expected delivery date Nov 10, 2026.', 'Approved',
     '2026-10-08 13:20:00', '2026-10-08 13:20:00', @masterName2, @master2, '2026-11-02', '2027-01-28',
     NULL, 105, NULL);


-- ---------------------------------------------------------------
-- 9.6 Loan Management
-- ---------------------------------------------------------------

INSERT INTO loan (faculty_id, adminstaff_id, loan_type, loan_amount, `current_date`, date_from, date_to,
    reference_no, deduction_per_payroll, lender, lender_name, interest_rate, remarks, recorded_by)
VALUES
    (@nf3, NULL, 'Pag-IBIG Calamity Loan', 12000.00, '2026-09-05', '2026-09-11', NULL,
     'HDMF-CAL-2026-0045', 600.00, 'Pag-IBIG', NULL, 0, 'Typhoon damage to house.', @master2),
    (NULL, @na2, 'SSS Salary Loan', 18000.00, '2026-08-18', '2026-08-26', NULL,
     'SSS-2026-104522', 900.00, 'SSS', NULL, 0, 'Approved by SSS on Aug 14.', @master2),
    (NULL, @na5, 'Personal Loan', 8000.00, '2026-09-20', '2026-09-26', NULL,
     'PL-2026-0310', 800.00, 'Bank', 'BDO Balayan Branch', 2.5, '10-month term, with interest.', @master2),
    (NULL, @na9, 'Pag-IBIG MPL', 15000.00, '2026-09-28', '2026-10-11', NULL,
     'HDMF-MPL-2026-0280', 750.00, 'Pag-IBIG', NULL, 0, NULL, @master2),
    (NULL, @na12, 'Other Loan', 4000.00, '2026-09-10', '2026-09-26', NULL,
     'ADV-2026-019', 2000.00, 'School', NULL, 0, 'Salary advance.', @master2);


-- ---------------------------------------------------------------
-- 9.7 Benefits Table: allowances paid every payroll period
--     (Divina Lumbres, resigned, gets none going forward.)
-- ---------------------------------------------------------------

SET @rice2 := (SELECT benefit_id FROM benefit WHERE benefit_name = 'Rice Allowance');
SET @transport2 := (SELECT benefit_id FROM benefit WHERE benefit_name = 'Transportation Allowance');
SET @internet2 := (SELECT benefit_id FROM benefit WHERE benefit_name = 'Internet Allowance');

INSERT INTO employee_benefit (benefit_id, faculty_id, adminstaff_id, amount)
SELECT @rice2, e.faculty_id, e.adminstaff_id, 500.00 FROM tmp_emp e WHERE e.k <> 14;

INSERT INTO employee_benefit (benefit_id, faculty_id, adminstaff_id, amount)
SELECT @transport2, e.faculty_id, e.adminstaff_id, 300.00 FROM tmp_emp e WHERE e.kind IN ('Admin', 'Faculty/Admin') AND e.k <> 14;

INSERT INTO employee_benefit (benefit_id, faculty_id, adminstaff_id, amount)
SELECT @internet2, e.faculty_id, e.adminstaff_id, 250.00 FROM tmp_emp e WHERE e.kind IN ('Faculty', 'Faculty/Admin');


-- ---------------------------------------------------------------
-- 9.8 Basic pay (monthly, record only)
-- ---------------------------------------------------------------

UPDATE admin_staff
SET basic_pay = ROUND(IFNULL(rate_per_hour, 0) * IFNULL(office_hours, 0) * 22
                + IF(is_faculty, IFNULL(rate_per_hour_unit, 0) * IFNULL(lecture_hours, 0) * 4, 0))
WHERE employee_number IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F');


-- ---------------------------------------------------------------
-- Clean up and show what was added
-- ---------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS tmp_emp;
DROP TEMPORARY TABLE IF EXISTS tmp_plan;
DROP TEMPORARY TABLE IF EXISTS tmp_days;
DROP TEMPORARY TABLE IF EXISTS tmp_cls;

SELECT 'New employees' AS item,
       (SELECT COUNT(*) FROM faculty_staff WHERE employee_number IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F'))
     + (SELECT COUNT(*) FROM admin_staff WHERE employee_number IN ('STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F')) AS total
UNION ALL
SELECT 'Classes (Aug 11 – Oct 25)', COUNT(*) FROM faculty_class_schedule c
    LEFT JOIN faculty_staff f ON f.faculty_id = c.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = c.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F')
UNION ALL
SELECT CONCAT('Classroom checks: ', approval_status), COUNT(*) FROM faculty_teaching_attendance ta
    JOIN faculty_class_schedule c ON c.class_schedule_id = ta.class_schedule_id
    LEFT JOIN faculty_staff f ON f.faculty_id = c.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = c.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F')
    GROUP BY approval_status
UNION ALL
SELECT 'DTR records (Aug 11 – Oct 8)', COUNT(*) FROM daily_time_record r
    LEFT JOIN faculty_staff f ON f.faculty_id = r.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = r.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F')
UNION ALL
SELECT CONCAT('Leave requests: ', l.status), COUNT(*) FROM employee_leave l
    LEFT JOIN faculty_staff f ON f.faculty_id = l.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = l.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F')
    GROUP BY l.status
UNION ALL
SELECT 'Loans', COUNT(*) FROM loan WHERE reference_no IN ('HDMF-CAL-2026-0045', 'SSS-2026-104522', 'PL-2026-0310', 'HDMF-MPL-2026-0280', 'ADV-2026-019')
UNION ALL
SELECT CONCAT('Benefit: ', b.benefit_name), COUNT(*) FROM employee_benefit eb JOIN benefit b USING (benefit_id)
    LEFT JOIN faculty_staff f ON f.faculty_id = eb.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = eb.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) IN ('STIBLN-0011-M', 'STIBLN-0012-F', 'STIBLN-0013-M', 'STIBLN-0014-F', 'STIBLN-0015-M', 'STIBLN-0016-F', 'STIBLN-0017-M', 'STIBLN-0018-F', 'STIBLN-0019-M', 'STIBLN-0020-F', 'STIBLN-0021-M', 'STIBLN-0022-F', 'STIBLN-0023-M', 'STIBLN-0024-F', 'STIBLN-0025-M', 'STIBLN-0026-F', 'STIBLN-0027-M', 'STIBLN-0028-F', 'STIBLN-0029-M', 'STIBLN-0030-F')
    GROUP BY b.benefit_name;


-- ---------------------------------------------------------------
-- Extend the original 10 employees' attendance back to Aug 11, 2026
-- so every pay period (Aug 11 onward) has payable hours for them, same
-- as the 20 employees added later. Idempotent: safe to re-run.
-- ---------------------------------------------------------------

SET @master := (SELECT user_id FROM users WHERE role IN ('Payroll Master') ORDER BY user_id LIMIT 1);
SET @masterName := (SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE user_id = @master);

SET @f1 := (SELECT faculty_id FROM faculty_staff WHERE employee_number = 'STIBLN-0006-M');
SET @f2 := (SELECT faculty_id FROM faculty_staff WHERE employee_number = 'STIBLN-0009-F');
SET @f3 := (SELECT faculty_id FROM faculty_staff WHERE employee_number = 'STIBLN-0003-M');
SET @f4 := (SELECT faculty_id FROM faculty_staff WHERE employee_number = 'STIBLN-0010-F');
SET @a1 := (SELECT adminstaff_id FROM admin_staff WHERE employee_number = 'STIBLN-0004-M');
SET @a2 := (SELECT adminstaff_id FROM admin_staff WHERE employee_number = 'STIBLN-0007-F');
SET @a3 := (SELECT adminstaff_id FROM admin_staff WHERE employee_number = 'STIBLN-0001-M');
SET @a4 := (SELECT adminstaff_id FROM admin_staff WHERE employee_number = 'STIBLN-0008-F');
SET @a5 := (SELECT adminstaff_id FROM admin_staff WHERE employee_number = 'STIBLN-0002-F');
SET @a6 := (SELECT adminstaff_id FROM admin_staff WHERE employee_number = 'STIBLN-0005-M');

-- Idempotency: remove anything previously generated for this backfill range.
DELETE c FROM faculty_class_schedule c
JOIN (SELECT @f1 AS fid UNION SELECT @f2 UNION SELECT @f3 UNION SELECT @f4) e ON c.faculty_id = e.fid
WHERE c.class_date BETWEEN '2026-08-11' AND '2026-09-10';

DELETE r FROM daily_time_record r
WHERE r.record_date BETWEEN '2026-08-11' AND '2026-09-10'
  AND (r.faculty_id IN (@f1, @f2, @f3, @f4)
       OR r.adminstaff_id IN (@a1, @a2, @a3, @a4, @a5, @a6));

DELETE l FROM employee_leave l
WHERE l.date_from BETWEEN '2026-08-11' AND '2026-09-10'
  AND l.adminstaff_id IN (@a1, @a2, @a3, @a4, @a5, @a6)
  AND l.reason = 'Fever; medical certificate submitted.';

-- ---------------------------------------------------------------
-- Helper tables
-- ---------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_emp;
CREATE TEMPORARY TABLE tmp_emp (k INT PRIMARY KEY, faculty_id INT NULL, adminstaff_id INT NULL, kind VARCHAR(15));
INSERT INTO tmp_emp VALUES
    (1, @f1, NULL, 'Faculty'), (2, @f2, NULL, 'Faculty'), (3, @f3, NULL, 'Faculty'), (4, @f4, NULL, 'Faculty'),
    (5, NULL, @a1, 'Admin'), (6, NULL, @a2, 'Admin'), (7, NULL, @a3, 'Admin'), (8, NULL, @a4, 'Admin'),
    (9, NULL, @a5, 'Faculty/Admin'), (10, NULL, @a6, 'Faculty/Admin');

DROP TEMPORARY TABLE IF EXISTS tmp_plan;
CREATE TEMPORARY TABLE tmp_plan (k INT, wd INT, t_start TIME, t_end TIME, subject VARCHAR(100), section VARCHAR(50), room VARCHAR(50));
INSERT INTO tmp_plan VALUES
    (1, 0, '07:30', '09:00', 'Data Structures and Algorithms', 'BSIT 2A', 'CLAB 3'),
    (1, 2, '07:30', '09:00', 'Data Structures and Algorithms', 'BSIT 2A', 'CLAB 3'),
    (1, 1, '10:00', '12:00', 'Computer Programming 2', 'BSIT 1B', 'CLAB 1'),
    (1, 3, '10:00', '12:00', 'Computer Programming 2', 'BSIT 1B', 'CLAB 1'),
    (2, 0, '13:00', '14:30', 'Purposive Communication', 'BSBA 1A', 'Room 201'),
    (2, 2, '13:00', '14:30', 'Purposive Communication', 'BSBA 1A', 'Room 201'),
    (2, 4, '08:00', '11:00', 'Readings in Philippine History', 'BSHM 1A', 'Room 202'),
    (3, 1, '13:00', '15:00', 'Database Systems', 'BSIT 3A', 'CLAB 2'),
    (3, 3, '13:00', '15:00', 'Database Systems', 'BSIT 3A', 'CLAB 2'),
    (3, 4, '13:00', '16:00', 'Networking 1', 'BSIT 2B', 'CLAB 2'),
    (4, 0, '10:00', '11:00', 'Mathematics in the Modern World', 'BSTM 1A', 'Room 203'),
    (4, 2, '10:00', '11:00', 'Mathematics in the Modern World', 'BSTM 1A', 'Room 203'),
    (4, 4, '10:00', '11:00', 'Mathematics in the Modern World', 'BSTM 1A', 'Room 203'),
    (4, 1, '14:00', '16:00', 'Business Statistics', 'BSBA 2A', 'Room 204'),
    (9, 1, '08:00', '09:30', 'Ethics', 'BSHM 2A', 'Room 205'),
    (9, 3, '08:00', '09:30', 'Ethics', 'BSHM 2A', 'Room 205'),
    (10, 0, '15:00', '17:00', 'Web Systems and Technologies', 'BSIT 3B', 'CLAB 1'),
    (10, 2, '15:00', '17:00', 'Web Systems and Technologies', 'BSIT 3B', 'CLAB 1');

-- Every date from Aug 11 to Sep 10, 2026 (30 days) — fills the gap before
-- the original Sep 11 – Oct 25 range this file already covers.
DROP TEMPORARY TABLE IF EXISTS tmp_days2;
CREATE TEMPORARY TABLE tmp_days2 AS
    SELECT DATE('2026-08-11') + INTERVAL seq DAY AS d FROM seq_0_to_29;

-- ---------------------------------------------------------------
-- Faculty Schedule: weekly classes Aug 11 – Sep 10. Aug 21 (Ninoy Aquino
-- Day, Special Non-Working) and Aug 31 (National Heroes Day, Regular
-- Holiday) are stand-down days, same treatment as the Sep 25 typhoon
-- suspension elsewhere in this file.
-- ---------------------------------------------------------------
INSERT INTO faculty_class_schedule (faculty_id, adminstaff_id, subject, class_section, room, class_date,
    scheduled_start, scheduled_end, grace_period_minutes, schedule_status, status_reason,
    created_by, updated_by, created_at, updated_at)
SELECT e.faculty_id, e.adminstaff_id, p.subject, p.section, p.room, t.d,
       p.t_start, p.t_end, 15,
       IF(t.d IN ('2026-08-21', '2026-08-31'), 'Cancelled', 'Scheduled'),
       CASE t.d WHEN '2026-08-21' THEN 'Special Non-Working Day (Ninoy Aquino Day)'
                WHEN '2026-08-31' THEN 'Regular Holiday (National Heroes Day)'
                ELSE NULL END,
       @master, @master, '2026-08-07 09:00:00',
       IF(t.d IN ('2026-08-21', '2026-08-31'), TIMESTAMP(t.d - INTERVAL 1 DAY, '18:30:00'), '2026-08-07 09:00:00')
FROM tmp_days2 t
JOIN tmp_plan p ON WEEKDAY(t.d) = p.wd
JOIN tmp_emp e ON e.k = p.k
ORDER BY t.d, p.t_start;

INSERT INTO faculty_schedule_history (class_schedule_id, action, details, changed_by, changed_at)
SELECT c.class_schedule_id, 'Created',
       CONCAT(c.subject, ' (', c.class_section, '), ', c.room, ', ', c.class_date, ' ',
              TIME_FORMAT(c.scheduled_start, '%H:%i'), '–', TIME_FORMAT(c.scheduled_end, '%H:%i')),
       @master, '2026-08-07 09:00:00'
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.class_date BETWEEN '2026-08-11' AND '2026-09-10';

INSERT INTO faculty_schedule_history (class_schedule_id, action, details, changed_by, changed_at)
SELECT c.class_schedule_id, 'Cancelled', c.status_reason, @master, c.updated_at
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.schedule_status = 'Cancelled' AND c.class_date BETWEEN '2026-08-11' AND '2026-09-10';

-- ---------------------------------------------------------------
-- Faculty Teaching Hours: classroom checks (fully resolved — this
-- range is well in the past, so every class is Approved or Rejected).
-- ---------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_cls2;
CREATE TEMPORARY TABLE tmp_cls2 AS
SELECT c.class_schedule_id AS id, e.k, c.class_date AS d, c.scheduled_start AS s, c.scheduled_end AS en,
       MOD(e.k * 7 + DAY(c.class_date) * 3 + MONTH(c.class_date) + HOUR(c.scheduled_start) * 5, 20) AS v,
       CAST('' AS CHAR(12)) AS outcome, CAST('' AS CHAR(12)) AS final
FROM faculty_class_schedule c
JOIN tmp_emp e ON c.faculty_id <=> e.faculty_id AND c.adminstaff_id <=> e.adminstaff_id
WHERE c.schedule_status = 'Scheduled' AND c.class_date BETWEEN '2026-08-11' AND '2026-09-10';

UPDATE tmp_cls2 SET outcome = CASE
    WHEN v = 0 THEN 'absent'
    WHEN v = 2 THEN 'early'
    WHEN v = 1 THEN 'latecheck'
    ELSE 'ok' END;

UPDATE tmp_cls2 SET final = CASE
    WHEN outcome IN ('absent', 'early') THEN 'Rejected'
    ELSE 'Approved' END;

INSERT INTO faculty_teaching_attendance (class_schedule_id,
    start_check_at, start_check_status, start_checked_by,
    end_check_at, end_check_status, end_checked_by,
    remarks, approval_status, payable_hours, approved_by, approved_at, review_note, created_at, updated_at)
SELECT t.id,
       TIMESTAMP(t.d, t.s) + INTERVAL IF(t.outcome = 'latecheck', 25, MOD(t.v, 8) + 1) MINUTE,
       IF(t.outcome = 'absent', 'Absent', 'Present'),
       @master,
       TIMESTAMP(t.d, t.en) - INTERVAL (MOD(t.v, 6) + 1) MINUTE,
       IF(t.outcome IN ('absent', 'early'), 'Absent', 'Present'),
       @master,
       CASE t.outcome
           WHEN 'absent' THEN 'Classroom empty at both checks.'
           WHEN 'early' THEN 'Class dismissed early; faculty not in the room at the ending check.'
           WHEN 'latecheck' THEN 'Beginning check done late (staff meeting ran over).'
           ELSE NULL END,
       t.final,
       IF(t.final = 'Approved', ROUND(TIME_TO_SEC(TIMEDIFF(t.en, t.s)) / 3600, 2), 0),
       @master,
       TIMESTAMP(t.d + INTERVAL 1 DAY, '16:30:00'),
       CASE
           WHEN t.final = 'Rejected' AND t.outcome = 'absent' THEN 'Faculty absent; no substitute arranged.'
           WHEN t.final = 'Rejected' THEN 'Left before the end of class.'
           WHEN t.final = 'Approved' AND t.outcome = 'latecheck' THEN 'Checked late; faculty confirmed present from the start of class.'
           ELSE NULL END,
       TIMESTAMP(t.d, t.s),
       TIMESTAMP(t.d, t.en)
FROM tmp_cls2 t;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, 'Beginning check recorded',
       CONCAT(TIME_FORMAT(a.start_check_at, '%H:%i'), ' ', a.start_check_status), NULL, @master, a.start_check_at
FROM faculty_teaching_attendance a JOIN tmp_cls2 t ON t.id = a.class_schedule_id;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, 'Ending check recorded',
       CONCAT(TIME_FORMAT(a.end_check_at, '%H:%i'), ' ', a.end_check_status), NULL, @master, a.end_check_at
FROM faculty_teaching_attendance a JOIN tmp_cls2 t ON t.id = a.class_schedule_id;

INSERT INTO faculty_attendance_audit (attendance_id, action, details, reason, performed_by, performed_at)
SELECT a.attendance_id, a.approval_status,
       IF(a.approval_status = 'Approved',
          CONCAT('Payable teaching hours: ', a.payable_hours),
          'No teaching hours will be paid for this class.'),
       a.review_note, @master, a.approved_at
FROM faculty_teaching_attendance a JOIN tmp_cls2 t ON t.id = a.class_schedule_id;

-- ---------------------------------------------------------------
-- Daily Time Record: Admin / Faculty-Admin office hours, weekdays,
-- excluding the two holidays (treated as full stand-down, like Sep 25).
-- ---------------------------------------------------------------
INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date,
    time_in, time_out, status, is_manual_entry, remarks, recorded_by, created_at)
SELECT s.fingerprint_id, NULL, NULL, x.adminstaff_id, x.d,
       CASE WHEN x.w IN (1, 2) THEN ADDTIME('08:20:00', SEC_TO_TIME(x.w * 9 * 60))
            WHEN x.w = 3 THEN '08:00:00'
            ELSE ADDTIME('07:40:00', SEC_TO_TIME(MOD(x.w, 19) * 60)) END,
       ADDTIME('17:00:00', SEC_TO_TIME(MOD(x.w * 3, 16) * 60)),
       IF(x.w IN (1, 2), 'Late', 'Present'),
       IF(x.w = 3, 1, 0),
       IF(x.w = 3, 'Fingerprint not read by the scanner; time verified by the department head.', NULL),
       IF(x.w = 3, @master, NULL),
       TIMESTAMP(x.d, '17:30:00')
FROM (
    SELECT e.k, e.adminstaff_id, e.kind, t.d, MOD(e.k * 13 + DAY(t.d) * 7 + MONTH(t.d) * 3, 25) AS w
    FROM tmp_days2 t JOIN tmp_emp e ON e.kind IN ('Admin', 'Faculty/Admin')
    WHERE WEEKDAY(t.d) < 5 AND t.d NOT IN ('2026-08-21', '2026-08-31')
) x
JOIN admin_staff s ON s.adminstaff_id = x.adminstaff_id
WHERE NOT (x.w = 0 AND x.kind = 'Admin');

-- Faculty: scan in/out around classes, skipped on days with a class absence.
INSERT INTO daily_time_record (fingerprint_id, device_id, faculty_id, adminstaff_id, record_date,
    time_in, time_out, status, is_manual_entry, remarks, recorded_by, created_at)
SELECT f.fingerprint_id, NULL, f.faculty_id, NULL, x.d,
       SUBTIME(x.first_start, SEC_TO_TIME((10 + MOD(x.mv, 10)) * 60)),
       ADDTIME(x.last_end, SEC_TO_TIME((5 + MOD(x.mv, 10)) * 60)),
       'Present', 0, NULL, NULL, TIMESTAMP(x.d, x.last_end)
FROM (
    SELECT t.k, t.d, MIN(t.s) AS first_start, MAX(t.en) AS last_end, MIN(t.v) AS mv,
           SUM(t.outcome = 'absent') AS absences
    FROM tmp_cls2 t
    WHERE t.k BETWEEN 1 AND 4
    GROUP BY t.k, t.d
) x
JOIN tmp_emp e ON e.k = x.k
JOIN faculty_staff f ON f.faculty_id = e.faculty_id
WHERE x.absences = 0;

-- ---------------------------------------------------------------
-- Leave: every Admin weekday with no DTR record in this range is an
-- approved sick leave, same convention as the rest of the file.
-- ---------------------------------------------------------------
SET @sick := (SELECT leave_category_id FROM leave_category WHERE category_name = 'Sick Leave');

INSERT INTO employee_leave (adminstaff_id, leave_category, leave_category_id, is_paid, reason, status,
    date_requested, date_approved, approved_by, recorded_by, date_from, date_to, remarks, total_days, total_leave_credit)
SELECT e.adminstaff_id, 'Sick Leave', @sick, 1, 'Fever; medical certificate submitted.', 'Approved',
       TIMESTAMP(t.d, '07:30:00'), TIMESTAMP(t.d + INTERVAL 1 DAY, '09:00:00'), @masterName, @master,
       t.d, t.d, 'Medical certificate on file.', 1, 15
FROM tmp_days2 t
JOIN tmp_emp e ON e.kind = 'Admin'
WHERE WEEKDAY(t.d) < 5 AND t.d NOT IN ('2026-08-21', '2026-08-31')
  AND NOT EXISTS (SELECT 1 FROM daily_time_record r WHERE r.adminstaff_id = e.adminstaff_id AND r.record_date = t.d);

DROP TEMPORARY TABLE IF EXISTS tmp_cls2;
DROP TEMPORARY TABLE IF EXISTS tmp_days2;
DROP TEMPORARY TABLE IF EXISTS tmp_plan;
DROP TEMPORARY TABLE IF EXISTS tmp_emp;

SELECT 'Original 10 backfilled for Aug 11 - Sep 10, 2026' AS result;
