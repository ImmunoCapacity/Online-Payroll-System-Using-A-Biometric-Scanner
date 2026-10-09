# Backend — Java Spring Boot

This is the backend described in the capstone paper (*Technical Background*):
Java with Spring Boot, MySQL, and the ZKTeco K40 connected through the ZKTeco
SDK and JACOB (Java COM Bridge). It also serves the HTML/CSS/JS frontend in the
repository root, so the whole system runs at `http://localhost:8080`.

## What you need

| Tool | Notes |
|---|---|
| JDK 17 or newer | 64-bit |
| IntelliJ IDEA | Comes with Maven built in. Or install Maven 3.9 yourself. |
| XAMPP | Only the MySQL part. Apache and PHP are no longer used. |
| ZKTeco Standalone SDK | Provides `zkemkeeper.dll`. Needed only for device sync. |
| JACOB 1.21 | [jacob-1.21.zip](https://github.com/freemansoft/jacob-project/releases/tag/Root_B-1_21) |

## Setup

1. **Database.** Start MySQL in XAMPP. In phpMyAdmin, import
   `database/payroll_schema.sql`. This creates `Payroll_DB` with every table
   from the paper's data dictionary.
2. **JACOB.** Unzip `jacob-1.21.zip`. Copy `jacob.jar` and
   `jacob-1.21-x64.dll` into `backend/lib/` (create the folder). This
   folder is git-ignored, so each teammate does this once.
3. **ZKTeco SDK.** Install the Standalone SDK and register `zkemkeeper.dll`
   from an administrator prompt: `regsvr32 zkemkeeper.dll`. The SDK, the
   JACOB DLL and the JDK must all be 64-bit (or all 32-bit).
4. **Settings.** Edit `src/main/resources/application.properties`:
   - your MySQL password, if you set one;
   - `device.ip` / `device.comm-key`: the K40's address (Menu → Comm. → Ethernet);
   - `bootstrap.admin.email` / `bootstrap.admin.password`: the first System
     Administrator. It is created on startup if the `users` table is empty.
     Clear these values after the first run.
5. **Device row.** Log in as the System Administrator. On the Biometric
   Devices page, add a row whose IP address equals `device.ip`.

## Emailing payslips

"Distribute Payslips" on the Payroll Processing page emails each employee
their payslip at the address in their employee record. To turn it on, fill
in `spring.mail.username` and `spring.mail.password` in
`application.properties`. For Gmail, turn on 2-Step Verification for the
sending account, then create an App Password (Google Account → Security →
App passwords) and use that, not the normal password.

## Run

IntelliJ: open the `backend/` folder and run `PayrollApplication`. Then set
the run configuration's working directory to `backend/`, and add the VM option
`-Djava.library.path=lib` so JACOB can find its DLL.

Command line, from `backend/`:

```
mvn spring-boot:run
```

Then open http://localhost:8080.

## API

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/login` | anyone |
| POST | `/api/auth/logout` | anyone |
| GET | `/api/auth/session` | logged in |
| GET / POST | `/api/employees` | Employee Record Management → Payroll Master |
| PUT / DELETE | `/api/employees/{id}` (`F3`, `A5`) | Employee Record Management → Payroll Master |
| POST | `/api/biometric/sync` | Daily Time Record → Payroll Master, Payroll Staff |
| GET | `/api/dtr?date=YYYY-MM-DD` | Daily Time Record → Payroll Master, Payroll Staff |
| GET | `/api/dtr/employees` | Attendance Recording → Payroll Master, Payroll Staff |
| POST | `/api/dtr/manual` | Attendance Recording → Payroll Master, Payroll Staff |
| GET | `/api/dtr/hours?from=&to=` | Payroll → Payroll Master |
| GET | `/api/payroll/hours?from=&to=` (office + approved teaching hours) | Payroll → Payroll Master |
| GET | `/api/faculty-schedule/teachers`, `/classes?from=&to=`, `/classes/{id}/history` | Faculty Schedule → Payroll Master, Payroll Staff |
| POST / PUT | `/api/faculty-schedule/classes`, `/classes/{id}`, `/classes/{id}/cancel`, `/classes/{id}/restore` | Faculty Schedule management → Payroll Master |
| GET | `/api/teaching-hours/classes?from=&to=`, `/classes/{id}/audit` | Faculty Teaching Hours → Payroll Master, Payroll Staff |
| POST | `/api/teaching-hours/classes/{id}/checks` | Faculty Teaching Hours → Payroll Master, Payroll Staff |
| POST | `/api/teaching-hours/classes/{id}/approve`, `/reject` | Teaching Hours approval → Payroll Master |
| POST | `/api/payroll/payslips/email` | Payroll → Payroll Master |
| GET | `/api/fingerprints` | Fingerprint Registration → Payroll Master, Payroll Staff |
| PUT / DELETE | `/api/fingerprints/{id}` | Fingerprint Registration → Payroll Master, Payroll Staff |
| GET / POST | `/api/users` | Utility → System Administrator |
| PUT / DELETE | `/api/users/{id}` | Utility → System Administrator |

Errors always come back as `{ "success": false, "message": "..." }`, plus
`"field"` when the error is about one input.

## Roles and access control

There are exactly three roles, all stored in the `users` table. Faculty and
administrative staff are employee records, not users: they cannot log in.

| Module | Payroll Master | Payroll Staff | System Administrator |
|---|:-:|:-:|:-:|
| Dashboard | ✓ | ✓ | |
| Fingerprint Registration | ✓ | ✓ | |
| Daily Time Record | ✓ | ✓ | |
| Attendance Recording | ✓ | ✓ | |
| Faculty Schedule — view | ✓ | ✓ | |
| Faculty Schedule — add, edit, cancel | ✓ | | |
| Faculty Teaching Hours — classroom checks | ✓ | ✓ | |
| Faculty Teaching Hours — approve / reject | ✓ | | |
| Maintenance | ✓ | | |
| Deduction Tables | ✓ | | |
| Payroll | ✓ | | |
| Reports | ✓ | | |
| Employee Record Management | ✓ | | |
| Utility | | | ✓ |

This table lives in code in three places, which must stay in step:
- `auth/SystemModule.java`: the backend. Every protected endpoint is
  annotated `@RequireModule(SystemModule.X)`, and the request is refused
  with 403 if the role isn't allowed.
- `js/auth-guard.js`: which pages each role may open.
- `js/payrollpro-layout.js`: the sidebar menu for each role.

## Matching punches to employees

When a fingerprint is enrolled on the K40, set the device's **User ID** for
that person to the same value as the employee's `fingerprint_id` in the
database. A sync uses that value to match each punch to an employee. For each
employee and day:
- the earliest punch becomes time-in;
- the latest punch after it becomes time-out;
- a time-in later than `attendance.standard-start` plus
  `attendance.grace-minutes` (08:00 + 15 min) is marked **Late**.

## Code layout

```
com.stibalayan.payroll
├── auth        login, session, @RequireModule access control
├── employee    faculty_staff / admin_staff records (module 9.1); Faculty/Admin
│               staff are admin_staff rows with is_faculty = 1
├── biometric   K40 via JACOB + zkemkeeper, attendance sync (modules 1.0 / 2.0)
├── dtr         daily_time_record
├── schedule    Faculty Schedule: planned classes (faculty_class_schedule) + history
├── teaching    Faculty Teaching Hours: classroom checks, approval, audit
├── payroll     payroll hours (office + approved teaching), payslip emails
├── device      device table
├── user        system accounts (users table)
├── common      error handling
└── config      static frontend, interceptors, password hashing
```

## Faculty Schedule and Faculty Teaching Hours

- **Faculty Schedule** (`faculty-schedule.html`) holds the *planned* classes:
  faculty, subject, class/section, room, date, scheduled start and end, and a
  grace period. Classes can repeat weekly. They are never deleted, only
  cancelled with a reason and restored, and every change is kept in
  `faculty_schedule_history`. Overlapping classes are allowed but flagged.
  Once a classroom check exists, the class can no longer be edited or
  cancelled.
- **Faculty Teaching Hours** (`teaching-hours.html`) holds the *evidence*.
  Payroll Staff or the Payroll Master visit the classroom at the beginning
  and at the end of each class and record when they checked and whether the
  faculty member was Present or Absent. The check times are verification
  times, not time-in or time-out. The biometric scanner is not used for
  teaching.
- **Rules:**
  - A class pays its scheduled duration only when both checks found the
    faculty member present. Any Absent check means 0 hours.
  - A check outside the grace window, a missing check or a Present/Absent
    mismatch is flagged.
  - The Payroll Master approves or rejects each class. Approving a flagged
    class needs a review note.
  - Approved classes are locked.
  - Changing a recorded check needs a reason. Every action is kept in
    `faculty_attendance_audit`.
- **Payroll** (`/api/payroll/hours`):
  - Faculty earnings = approved teaching hours × faculty rate.
  - Admin earnings = biometric office hours × rate.
  - Faculty/Admin staff get both, each at its own rate. Office time that
    overlaps an approved class is not counted twice
    (`payroll.exclude-teaching-from-office-hours`).
  - Unapproved classes are never paid.
