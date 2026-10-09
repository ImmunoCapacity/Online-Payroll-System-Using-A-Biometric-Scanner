package com.stibalayan.payroll.dtr;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaff;
import com.stibalayan.payroll.employee.FacultyStaffRepository;
import com.stibalayan.payroll.employee.StaffMember;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Daily Time Record (paper, module 2.0) and Attendance Recording (4.0).
 *
 * Biometric rows come from the K40 sync; manual rows are the fallback the
 * paper describes for when the scanner can't record someone. A manual row
 * keeps the reason and who entered it, for verification.
 */
@Service
public class DtrService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final Set<String> STATUSES = Set.of("present", "late", "absent");

    private final DailyTimeRecordRepository dtr;
    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;
    private final LocalTime standardStart;
    private final int graceMinutes;

    public DtrService(DailyTimeRecordRepository dtr, FacultyStaffRepository faculty, AdminStaffRepository admins,
                      @Value("${attendance.standard-start}") String standardStart,
                      @Value("${attendance.grace-minutes}") int graceMinutes) {
        this.dtr = dtr;
        this.faculty = faculty;
        this.admins = admins;
        this.standardStart = LocalTime.parse(standardStart);
        this.graceMinutes = graceMinutes;
    }

    /**
     * Everyone's attendance for a day. For today and past days, active
     * employees with no record are listed as absent.
     */
    @Transactional(readOnly = true)
    public List<DtrRow> forDate(String dateText) {
        LocalDate date = parseDate(dateText);

        Map<Integer, FacultyStaff> facultyById = new HashMap<>();
        faculty.findAll().forEach(f -> facultyById.put(f.getId(), f));
        Map<Integer, AdminStaff> adminById = new HashMap<>();
        admins.findAll().forEach(a -> adminById.put(a.getId(), a));

        List<DtrRow> rows = new ArrayList<>();
        Set<String> withRecord = new HashSet<>();

        for (DailyTimeRecord r : dtr.findByRecordDate(date)) {
            if (r.getFacultyId() != null && facultyById.containsKey(r.getFacultyId())) {
                rows.add(row(r, EmployeeId.faculty(r.getFacultyId()), facultyById.get(r.getFacultyId())));
                withRecord.add(EmployeeId.faculty(r.getFacultyId()));
            } else if (r.getAdminstaffId() != null && adminById.containsKey(r.getAdminstaffId())) {
                rows.add(row(r, EmployeeId.admin(r.getAdminstaffId()), adminById.get(r.getAdminstaffId())));
                withRecord.add(EmployeeId.admin(r.getAdminstaffId()));
            }
        }

        if (!date.isAfter(LocalDate.now())) {
            facultyById.values().stream()
                    .filter(f -> "Active".equals(f.getEmploymentStatus()))
                    .filter(f -> !withRecord.contains(EmployeeId.faculty(f.getId())))
                    .forEach(f -> rows.add(absent(EmployeeId.faculty(f.getId()), f, date)));
            adminById.values().stream()
                    .filter(a -> "Active".equals(a.getEmploymentStatus()))
                    .filter(a -> !withRecord.contains(EmployeeId.admin(a.getId())))
                    .forEach(a -> rows.add(absent(EmployeeId.admin(a.getId()), a, date)));
        }

        rows.sort(Comparator.comparing(DtrRow::employeeName, String.CASE_INSENSITIVE_ORDER));
        return rows;
    }

    /**
     * Hours worked per employee over a pay period, from the DTR (paper,
     * Figures 3.1–3.2: "Get Number of Hours Worked from Attendance Records").
     * A day counts only when it has both a time-in and a time-out.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> hoursWorked(String fromText, String toText) {
        LocalDate from = parseDate(fromText);
        LocalDate to = parseDate(toText);
        if (to.isBefore(from)) {
            throw unprocessable("The end date must not be before the start date.");
        }

        Map<String, long[]> totals = new HashMap<>(); // employeeId -> {minutes, days}
        for (DailyTimeRecord r : dtr.findByRecordDateBetween(from, to)) {
            String employeeId = r.getFacultyId() != null ? EmployeeId.faculty(r.getFacultyId())
                    : r.getAdminstaffId() != null ? EmployeeId.admin(r.getAdminstaffId()) : null;
            if (employeeId == null || r.getTimeIn() == null || r.getTimeOut() == null
                    || !r.getTimeOut().isAfter(r.getTimeIn())) {
                continue;
            }
            long[] t = totals.computeIfAbsent(employeeId, k -> new long[2]);
            t[0] += Duration.between(r.getTimeIn(), r.getTimeOut()).toMinutes();
            t[1]++;
        }

        List<Map<String, Object>> result = new ArrayList<>();
        totals.forEach((employeeId, t) -> result.add(Map.of(
                "employeeId", employeeId,
                "hours", Math.round(t[0] / 60.0 * 100) / 100.0,
                "daysWorked", t[1])));
        return result;
    }

    /** Employees that can be picked for a manual entry. */
    @Transactional(readOnly = true)
    public List<Map<String, String>> employees() {
        // Admin and Faculty/Admin staff only. Faculty teaching attendance is
        // recorded as classroom checks in Faculty Teaching Hours, not here.
        List<Map<String, String>> result = new ArrayList<>();
        admins.findAll().stream().filter(a -> !"Inactive".equals(a.getEmploymentStatus()))
                .forEach(a -> result.add(choice(EmployeeId.admin(a.getId()), a)));
        result.sort(Comparator.comparing(m -> m.get("displayName"), String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    @Transactional
    public DtrRow saveManualEntry(ManualEntryRequest request, int recordedBy) {
        if (request.employeeId() == null || request.employeeId().isBlank()) {
            throw Validation.invalid("employeeId", "Select an employee from the list.");
        }
        EmployeeId employeeId = EmployeeId.parse(request.employeeId());
        if (employeeId.isFaculty()) {
            throw Validation.invalid("employeeId",
                    "Manual entries are for Admin and Faculty/Admin staff. Record faculty classes in Faculty Teaching Hours.");
        }
        StaffMember staff = employeeId.isFaculty()
                ? faculty.findById(employeeId.number()).orElseThrow(DtrService::employeeNotFound)
                : admins.findById(employeeId.number()).orElseThrow(DtrService::employeeNotFound);

        LocalDate date = Validation.date(request.date(), "date", "Date", true);
        if (date.isAfter(LocalDate.now())) {
            throw Validation.invalid("date", "You can't record attendance for a future date.");
        }
        if (staff.getDateHired() != null && date.isBefore(staff.getDateHired())) {
            throw Validation.invalid("date", "The date is before this employee was hired (" + staff.getDateHired() + ").");
        }

        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty()) {
            throw Validation.invalid("reason", "A reason is required for a manual entry.");
        }
        if (reason.length() > 255) {
            throw Validation.invalid("reason", "The reason can be at most 255 characters.");
        }

        String status = request.status() == null || request.status().isBlank() ? "auto" : request.status().toLowerCase();
        if (!status.equals("auto") && !STATUSES.contains(status)) {
            throw Validation.invalid("status", "Status must be present, late, absent or auto.");
        }

        LocalTime timeIn = Validation.time(request.timeIn(), "timeIn", "Time in", false);
        LocalTime timeOut = Validation.time(request.timeOut(), "timeOut", "Time out", false);
        if (!status.equals("absent") && timeIn == null) {
            throw Validation.invalid("timeIn", "Time in is required unless the employee is marked absent.");
        }
        // One record per calendar day (the K40 sync works the same way), so
        // there are no overnight shifts: time-out must be later the same day.
        if (timeIn != null && timeOut != null && !timeOut.isAfter(timeIn)) {
            throw Validation.invalid("timeOut", "Time out must be later than time in (same day).");
        }
        if (timeOut != null && date.equals(LocalDate.now()) && timeOut.isAfter(LocalTime.now().plusMinutes(1))) {
            throw Validation.invalid("timeOut", "Time out can't be later than the current time.");
        }
        if (timeIn != null && date.equals(LocalDate.now()) && timeIn.isAfter(LocalTime.now().plusMinutes(1))) {
            throw Validation.invalid("timeIn", "Time in can't be later than the current time.");
        }
        if (status.equals("auto")) {
            status = timeIn.isAfter(standardStart.plusMinutes(graceMinutes)) ? "late" : "present";
        }
        if (status.equals("absent")) {
            timeIn = null;
            timeOut = null;
        }

        // One record per employee per day: a manual entry replaces whatever is there.
        DailyTimeRecord record = (employeeId.isFaculty()
                ? dtr.findFirstByFacultyIdAndRecordDate(employeeId.number(), date)
                : dtr.findFirstByAdminstaffIdAndRecordDate(employeeId.number(), date))
                .orElseGet(DailyTimeRecord::new);

        record.setFacultyId(employeeId.isFaculty() ? employeeId.number() : null);
        record.setAdminstaffId(employeeId.isFaculty() ? null : employeeId.number());
        record.setFingerprintId(staff.getFingerprintId());
        record.setRecordDate(date);
        record.setTimeIn(timeIn);
        record.setTimeOut(timeOut);
        record.setStatus(capitalize(status));
        record.setManualEntry(true);
        record.setRemarks(reason);
        record.setRecordedBy(recordedBy);
        dtr.save(record);

        return row(record, request.employeeId(), staff);
    }

    private static DtrRow row(DailyTimeRecord r, String employeeId, StaffMember s) {
        return new DtrRow(r.getId(), employeeId, s.getEmployeeNumber(), s.getFullName(), s.staffType(),
                r.getRecordDate().toString(), time(r.getTimeIn()), time(r.getTimeOut()),
                r.getStatus() == null ? "absent" : r.getStatus().toLowerCase(), r.isManualEntry(), r.getRemarks());
    }

    private static DtrRow absent(String employeeId, StaffMember s, LocalDate date) {
        return new DtrRow(null, employeeId, s.getEmployeeNumber(), s.getFullName(), s.staffType(),
                date.toString(), null, null, "absent", false, null);
    }

    private static Map<String, String> choice(String id, StaffMember s) {
        return Map.of("id", id, "employeeNumber", s.getEmployeeNumber(), "displayName", s.getFullName(), "type", s.staffType());
    }

    private static String time(LocalTime t) {
        return t == null ? null : t.format(HH_MM);
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value == null ? "" : value.trim());
        } catch (DateTimeParseException e) {
            throw unprocessable("Date must be a valid date (YYYY-MM-DD).");
        }
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ApiException employeeNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Employee not found.");
    }
}
