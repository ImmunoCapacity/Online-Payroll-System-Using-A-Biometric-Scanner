-- ============================================================================
-- OPTIONAL SAMPLE / DEMO DATA
-- Mirrors the mock data already hard-coded in the frontend (js/*.js) so the
-- UI has something realistic to display once wired to this schema.
-- Run payroll_schema.sql FIRST, then this file.
-- This is demo data only — do not use in a production deployment.
-- ============================================================================

USE `Payroll_DB`;

-- Users (system accounts)
INSERT INTO `users` (`first_name`,`last_name`,`username`,`password`,`role`,`email`,`contact_number`) VALUES
('Maria', 'Elena Reyes', 'mreyes.master', '$2y$10$uqju/ZWKImu8MXt1DI0.9eqkyUQN.XguqX1oc72.Jf7nnof9vZSDG', 'Payroll Master', 'payroll.master@institution.edu', '0917-000-0001'),
('System', 'Administrator', 'sysadmin', '$2y$10$uqju/ZWKImu8MXt1DI0.9eqkyUQN.XguqX1oc72.Jf7nnof9vZSDG', 'System Administrator', 'admin@institution.edu', '0917-000-0002'),
('Carlo', 'Santiago', 'csantiago.staff', '$2y$10$uqju/ZWKImu8MXt1DI0.9eqkyUQN.XguqX1oc72.Jf7nnof9vZSDG', 'Payroll Staff', 'payroll.staff@institution.edu', '0917-000-0003');

-- Faculty staff
INSERT INTO `faculty_staff`
(`fingerprint_id`,`username`,`password`,`firstname`,`lastname`,`gender`,`birthdate`,`contact_number`,`address`,`email_address`,`civil_status`,`dependent_number`,`employment_status`,`employee_type`,`date_hired`,`load_units`,`lecture_hours`,`rate_per_hour_unit`,`sss_id`,`philhealth_id`,`pagibig_id`,`tin_id`,`instructor_rank`) VALUES
('FP-EMP2021014', 'maria.santos', '$2y$10$uqju/ZWKImu8MXt1DI0.9eqkyUQN.XguqX1oc72.Jf7nnof9vZSDG', 'Maria', 'Santos', 'Female', '1985-03-14', '0917-111-2222', 'Balayan, Batangas', 'maria.santos@institution.edu', 'Married', 2, 'Active', 'Full-time', '2020-01-15', 18, 9.0, 920.00, 'SSS-0001', 'PH-0001', 'PAG-0001', 'TIN-0001', 'Instructor II'),
('FP-EMP2022031', 'james.rivera', NULL, 'James', 'Rivera', 'Male', '1988-07-22', '0917-555-6666', 'Balayan, Batangas', 'james.rivera@institution.edu', 'Single', 0, 'On Leave', 'Full-time', '2019-09-01', 21, 9.9, 820.00, 'SSS-0002', 'PH-0002', 'PAG-0002', 'TIN-0002', 'Instructor I');

-- Admin staff
INSERT INTO `admin_staff`
(`fingerprint_id`,`username`,`password`,`firstname`,`lastname`,`gender`,`birthdate`,`contact_number`,`address`,`email_address`,`civil_status`,`dependent_number`,`employment_status`,`employee_type`,`date_hired`,`department`,`office_hours`,`rate_per_hour`,`sss_id`,`philhealth_id`,`pagibig_id`,`tin_id`,`position`) VALUES
('FP-EMP1002', 'anna.cruz', '$2y$10$uqju/ZWKImu8MXt1DI0.9eqkyUQN.XguqX1oc72.Jf7nnof9vZSDG', 'Anna', 'Cruz', 'Female', '1990-11-02', '0917-333-4444', 'Balayan, Batangas', 'anna.cruz@institution.edu', 'Single', 0, 'Active', 'Full-time', '2021-06-10', 'Admin', 8.0, 185.00, 'SSS-0003', 'PH-0003', 'PAG-0003', 'TIN-0003', 'HR Officer'),
('FP-EMP1004', 'elena.villanueva', NULL, 'Elena', 'Villanueva', 'Female', '1979-05-18', '0917-777-8888', 'Balayan, Batangas', 'elena.villanueva@institution.edu', 'Widowed', 1, 'Inactive', 'Full-time', '2018-02-20', 'Admin', 8.0, 175.00, 'SSS-0004', 'PH-0004', 'PAG-0004', 'TIN-0004', 'Registrar Staff');

-- Biometric device
INSERT INTO `device` (`device_name`,`location`,`ip_address`,`status`) VALUES
('Main Gate Scanner', 'Main Building Entrance', '192.168.1.50', 'Active'),
('Faculty Room Scanner', 'Faculty Room', '192.168.1.51', 'Active');

-- Leave categories
INSERT INTO `leave_category` (`category_name`,`is_paid`,`max_days`,`is_active`) VALUES
('Sick Leave', 1, 12, 1),
('Vacation Leave', 1, 15, 1),
('Maternity Leave', 1, 105, 1),
('Paternity Leave', 1, 7, 1),
('Leave Without Pay', 0, 30, 1);

-- BIR withholding tax brackets (2026)
INSERT INTO `bir_tax_bracket` (`effective_year`,`salary_min`,`salary_max`,`base_amount`,`rate_percent`) VALUES
(2026, 0.00, 20833.00, 0.00, 0.00),
(2026, 20833.01, 33333.00, 0.00, 15.00),
(2026, 33333.01, 66667.00, 1875.00, 20.00),
(2026, 66667.01, 166667.00, 8541.80, 25.00),
(2026, 166667.01, 666667.00, 33541.80, 30.00),
(2026, 666667.01, NULL, 183541.80, 35.00);

-- PhilHealth brackets (2026)
INSERT INTO `philhealth_bracket` (`effective_year`,`salary_min`,`salary_max`,`monthly_premium`,`rate_percent`) VALUES
(2026, 0.00, 10000.00, 500.00, 5.00),
(2026, 10000.01, 89999.99, NULL, 5.00),
(2026, 90000.00, NULL, 5000.00, 5.00);

-- Pag-IBIG brackets (2026)
INSERT INTO `pagibig_bracket` (`effective_year`,`compensation_min`,`compensation_max`,`employee_share`,`rate_percent`) VALUES
(2026, 0.00, 1500.00, 0.00, 0.00),
(2026, 1500.01, 10000.00, NULL, 2.00),
(2026, 10000.01, NULL, 200.00, 2.00);

-- Employee rate history
INSERT INTO `employee_rate` (`faculty_id`,`adminstaff_id`,`rate_type`,`amount`,`effective_date`,`end_date`,`is_active`) VALUES
(1, NULL, 'Per Unit', 850.00, '2024-01-01', '2025-12-31', 0),
(1, NULL, 'Per Unit', 920.00, '2026-01-01', NULL, 1),
(2, NULL, 'Per Unit', 820.00, '2025-06-01', NULL, 1);

-- Daily time records (today's mock attendance)
INSERT INTO `daily_time_record` (`fingerprint_id`,`device_id`,`faculty_id`,`adminstaff_id`,`record_date`,`time_in`,`time_out`,`number_of_holidays`,`status`,`is_manual_entry`) VALUES
('FP-EMP2021014', 1, 1, NULL, CURDATE(), '07:42:00', '17:05:00', 0, 'Present', 0),
('FP-EMP1002', 1, NULL, 1, CURDATE(), '08:01:00', '17:30:00', 0, 'Present', 0),
(NULL, 2, 2, NULL, CURDATE(), NULL, NULL, 0, 'Leave', 0);

-- Payroll (one processed pay period)
INSERT INTO `payroll`
(`faculty_id`,`adminstaff_id`,`firstname`,`middlename`,`lastname`,`basic_salary`,`gross_pay`,`net_pay`,`benefits`,`total_hours_worked`,`employee_rate`,`total_deductions`,`other_deductions`,`sss_contribution`,`philhealth_contribution`,`pagibig_contribution`,`sss_loan`,`pagibig_loan`,`tax`,`pay_period_start`,`pay_period_end`,`status`,`pay_date`) VALUES
(1, NULL, 'Maria', NULL, 'Santos', 16560.00, 17060.00, 11430.00, 500.00, 0, 920.00, 5630.00, 0.00, 828.00, 680.00, 200.00, 0.00, 0.00, 3922.00, '2026-06-16', '2026-06-30', 'Released', '2026-07-01'),
(NULL, 1, 'Anna', NULL, 'Cruz', 16280.00, 16280.00, 12930.00, 0.00, 88, 185.00, 3350.00, 0.00, 814.00, 420.00, 200.00, 0.00, 0.00, 1916.00, '2026-06-16', '2026-06-30', 'Released', '2026-07-01');

-- Deductions tied to the payroll rows above
INSERT INTO `deduction` (`faculty_id`,`adminstaff_id`,`payroll_id`,`deduction_type`,`amount`) VALUES
(1, NULL, 1, 'SSS', 828.00),
(1, NULL, 1, 'PhilHealth', 680.00),
(1, NULL, 1, 'Pag-IBIG', 200.00),
(1, NULL, 1, 'Tax', 3922.00),
(NULL, 1, 2, 'SSS', 814.00),
(NULL, 1, 2, 'PhilHealth', 420.00),
(NULL, 1, 2, 'Pag-IBIG', 200.00),
(NULL, 1, 2, 'Tax', 1916.00);

-- Leave requests
INSERT INTO `leave_record`
(`faculty_id`,`adminstaff_id`,`leave_category`,`status`,`date_requested`,`date_approved`,`approved_by`,`date_from`,`date_to`,`remarks`,`total_days`,`total_leave_credit`,`used_leave`,`remaining_leave`) VALUES
(1, NULL, 'Vacation Leave', 'Pending', '2026-07-04 09:00:00', NULL, NULL, '2026-07-14', '2026-07-16', 'Family vacation', 3, 15, 7, 8),
(NULL, 1, 'Sick Leave', 'Approved', '2026-06-08 08:30:00', '2026-06-08 14:00:00', 'Maria Elena Reyes', '2026-06-10', '2026-06-11', 'Medical consultation', 2, 12, 4, 8);

-- Loans
INSERT INTO `loan` (`faculty_id`,`adminstaff_id`,`loan_type`,`loan_amount`,`term_months`,`monthly_deduction`,`remaining_balance`,`status`,`remarks`,`date_filed`,`date_from`,`date_to`) VALUES
(1, NULL, 'SSS Salary Loan', 50000.00, 18, 2777.78, 50000.00, 'Pending', NULL, '2026-07-02', '2026-08-01', '2028-01-01'),
(NULL, 1, 'Pag-IBIG Loan', 80000.00, 24, 3333.33, 80000.00, 'Pending', NULL, '2026-07-05', '2026-08-01', '2028-07-01');

-- 13th month pay
INSERT INTO `thirteenth_month_pay` (`faculty_id`,`adminstaff_id`,`annual_gross_salary`,`amount`,`pay_year`) VALUES
(1, NULL, 198720.00, 16560.00, 2026),
(NULL, 1, 195360.00, 16280.00, 2026);
