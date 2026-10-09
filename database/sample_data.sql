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
-- Safe to run again: the 10 sample employees (employee numbers
-- 02001000101–02001000110) are deleted first, together with everything
-- linked to them. Other employees are not touched.
-- Emails use example.com so payslip emails never reach real people.
-- Needs one Payroll Master account (it is recorded as the user who
-- entered, checked and approved the records).
-- ---------------------------------------------------------------

USE Payroll_DB;

SET @master := (SELECT user_id FROM users
                WHERE role = 'Payroll Master' AND is_active = 1
                ORDER BY user_id LIMIT 1);

-- 0. Remove an earlier copy of the sample (classes, checks, audit, history
--    and DTR rows go with the employees through ON DELETE CASCADE).
DELETE FROM faculty_staff WHERE employee_number BETWEEN '02001000101' AND '02001000110';
DELETE FROM admin_staff   WHERE employee_number BETWEEN '02001000101' AND '02001000110';


-- ---------------------------------------------------------------
-- 1. Employees
-- ---------------------------------------------------------------

-- Faculty (faculty_staff): paid approved teaching hours × rate per hour/unit.
INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('02001000101', '101', 'Jose', 'Marquez', 'Ramirez', 'Male', 38, '1988-03-14',
    '09171234501', 'Brgy. Caloocan, Balayan, Batangas', 'jose.ramirez@example.com', 'Married', 2, 'Active', 'Full-time', '2019-06-03',
    18, 7.0, 420.00, '34-1234501-1', '12-345678901-1', '1234-5678-9101', '123-456-701-000', 'Instructor II', 'IT department; adviser of BSIT 2A.');
SET @f1 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('02001000102', '102', 'Angela', 'Cruz', 'Dizon', 'Female', 29, '1997-07-22',
    '09171234502', 'Brgy. Gimalas, Balayan, Batangas', 'angela.dizon@example.com', 'Single', 0, 'Active', 'Part-time', '2023-08-07',
    9, 6.0, 380.00, '34-1234502-2', '12-345678902-2', '1234-5678-9102', '123-456-702-000', 'Instructor I', 'General Education.');
SET @f2 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('02001000103', '103', 'Paolo', 'Santos', 'Villareal', 'Male', 45, '1981-11-02',
    '09171234503', 'Brgy. Calzada, Calaca, Batangas', 'paolo.villareal@example.com', 'Married', 3, 'Active', 'Full-time', '2014-06-16',
    15, 7.0, 450.00, '34-1234503-3', '12-345678903-3', '1234-5678-9103', '123-456-703-000', 'Instructor III', 'Senior faculty, networking and databases.');
SET @f3 := LAST_INSERT_ID();

INSERT INTO faculty_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    load_units, lecture_hours, rate_per_hour_unit, sss_id, philhealth_id, pagibig_id, tin_id, instructor_rank, notes)
VALUES ('02001000104', '104', 'Kristine', 'Lopez', 'Bautista', 'Female', 27, '1999-01-30',
    '09171234504', 'Brgy. Sampaga, Balayan, Batangas', 'kristine.bautista@example.com', 'Single', 0, 'Active', 'Contractual', '2025-06-09',
    9, 5.0, 360.00, '34-1234504-4', '12-345678904-4', '1234-5678-9104', '123-456-704-000', 'Instructor I', 'Mathematics.');
SET @f4 := LAST_INSERT_ID();

-- Admin (admin_staff, is_faculty = 0): paid biometric office hours × rate per hour.
INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('02001000105', '105', 'Ramon', 'Aguilar', 'Castillo', 'Male', 41, '1985-05-18',
    '09171234505', 'Brgy. Poblacion 3, Balayan, Batangas', 'ramon.castillo@example.com', 'Married', 2, 'Active', 'Full-time', '2016-02-01',
    'Registrar', 'Registrar Officer', 8.0, 130.00, 0, '34-1234505-5', '12-345678905-5', '1234-5678-9105', '123-456-705-000', NULL);
SET @a1 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('02001000106', '106', 'Liza', 'Flores', 'Mercado', 'Female', 34, '1992-09-09',
    '09171234506', 'Brgy. Lanatan, Balayan, Batangas', 'liza.mercado@example.com', 'Married', 1, 'Active', 'Full-time', '2020-07-13',
    'Accounting', 'Cashier', 8.0, 110.00, 0, '34-1234506-6', '12-345678906-6', '1234-5678-9106', '123-456-706-000', NULL);
SET @a2 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('02001000107', '107', 'Danilo', 'Perez', 'Ocampo', 'Male', 50, '1976-12-05',
    '09171234507', 'Brgy. Langgangan, Balayan, Batangas', 'danilo.ocampo@example.com', 'Widowed', 1, 'Active', 'Full-time', '2010-03-22',
    'Facilities', 'Maintenance Staff', 8.0, 95.00, 0, '34-1234507-7', '12-345678907-7', '1234-5678-9107', '123-456-707-000', NULL);
SET @a3 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('02001000108', '108', 'Joanna', 'Reyes', 'Salazar', 'Female', 31, '1995-04-27',
    '09171234508', 'Brgy. Navotas, Balayan, Batangas', 'joanna.salazar@example.com', 'Single', 0, 'Active', 'Full-time', '2021-09-01',
    'Admissions', 'Admissions Officer', 8.0, 120.00, 0, '34-1234508-8', '12-345678908-8', '1234-5678-9108', '123-456-708-000', NULL);
SET @a4 := LAST_INSERT_ID();

-- Faculty/Admin (admin_staff, is_faculty = 1): office hours × office rate
-- plus approved teaching hours × teaching rate (rate_per_hour_unit).
INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('02001000109', '109', 'Teresa', 'Mendoza', 'Aquino', 'Female', 47, '1979-08-11',
    '09171234509', 'Brgy. Dalig, Balayan, Batangas', 'teresa.aquino@example.com', 'Married', 2, 'Active', 'Full-time', '2012-06-04',
    'Academic Affairs', 'Program Head', 8.0, 160.00, 1, 'Instructor III', 400.00, 3, 3.0,
    '34-1234509-9', '12-345678909-9', '1234-5678-9109', '123-456-709-000', 'Also teaches Ethics.');
SET @a5 := LAST_INSERT_ID();

INSERT INTO admin_staff (employee_number, fingerprint_id, firstname, middlename, lastname, gender, age, birthdate,
    contact_number, address, email_address, civil_status, dependent_number, employment_status, employee_type, date_hired,
    department, position, office_hours, rate_per_hour, is_faculty, instructor_rank, rate_per_hour_unit, load_units, lecture_hours,
    sss_id, philhealth_id, pagibig_id, tin_id, notes)
VALUES ('02001000110', '110', 'Vincent', 'Torres', 'Gomez', 'Male', 36, '1990-02-17',
    '09171234510', 'Brgy. Magabe, Balayan, Batangas', 'vincent.gomez@example.com', 'Married', 1, 'Active', 'Full-time', '2018-01-15',
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
-- Clean up and show what was added
-- ---------------------------------------------------------------

DROP TEMPORARY TABLE IF EXISTS tmp_emp;
DROP TEMPORARY TABLE IF EXISTS tmp_plan;
DROP TEMPORARY TABLE IF EXISTS tmp_days;
DROP TEMPORARY TABLE IF EXISTS tmp_cls;

SELECT 'Sample employees' AS item,
       (SELECT COUNT(*) FROM faculty_staff WHERE employee_number BETWEEN '02001000101' AND '02001000110')
     + (SELECT COUNT(*) FROM admin_staff WHERE employee_number BETWEEN '02001000101' AND '02001000110') AS total
UNION ALL
SELECT 'Classes (Sep 11 – Oct 25)', COUNT(*) FROM faculty_class_schedule c
    LEFT JOIN faculty_staff f ON f.faculty_id = c.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = c.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) BETWEEN '02001000101' AND '02001000110'
UNION ALL
SELECT CONCAT('Classroom checks: ', approval_status), COUNT(*) FROM faculty_teaching_attendance ta
    JOIN faculty_class_schedule c ON c.class_schedule_id = ta.class_schedule_id
    LEFT JOIN faculty_staff f ON f.faculty_id = c.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = c.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) BETWEEN '02001000101' AND '02001000110'
    GROUP BY approval_status
UNION ALL
SELECT 'DTR records (Sep 11 – Oct 8)', COUNT(*) FROM daily_time_record r
    LEFT JOIN faculty_staff f ON f.faculty_id = r.faculty_id
    LEFT JOIN admin_staff a ON a.adminstaff_id = r.adminstaff_id
    WHERE COALESCE(f.employee_number, a.employee_number) BETWEEN '02001000101' AND '02001000110';
