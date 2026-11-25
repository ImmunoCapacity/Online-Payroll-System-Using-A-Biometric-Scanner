package com.stibalayan.payroll.teaching;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.schedule.FacultyClass;
import com.stibalayan.payroll.schedule.FacultyClassRepository;
import com.stibalayan.payroll.schedule.Teachers;
import com.stibalayan.payroll.user.UserNames;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Faculty Teaching Hours module: the Attendance Monitoring Staff or Payroll
 * Master checks the classroom at the beginning and at the end of each
 * scheduled class and records what they saw, then saves it. Teaching
 * attendance does not come from the biometric scanner.
 *
 * Rules (the "attendance rules" payroll relies on):
 *   - A class is payable when the faculty member was Present or Late at the
 *     beginning check and Present at the ending check; the payable hours are
 *     then the full scheduled duration — Present and Late are paid the same,
 *     there is no per-minute deduction. Any Absent check, or a check still
 *     missing, makes the class pay 0 hours — there is no separate approval
 *     step, payroll reads these checks directly (approvedHours).
 *   - Checks outside the grace window, missing checks and mixed
 *     Present/Absent evidence are flagged for review, informationally; they
 *     don't block anything.
 *   - Changing an already-recorded check needs an explanation in Remarks,
 *     and every check and correction is kept in faculty_attendance_audit.
 */
@Service
public class TeachingHoursService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_RANGE_DAYS = 400;
    private static final String NOT_CHECKED = "Not checked";

    private final FacultyClassRepository classes;
    private final TeachingAttendanceRepository attendance;
    private final AttendanceAuditRepository audit;
    private final Teachers teachers;
    private final UserNames userNames;

    public TeachingHoursService(FacultyClassRepository classes, TeachingAttendanceRepository attendance,
                                AttendanceAuditRepository audit, Teachers teachers, UserNames userNames) {
        this.classes = classes;
        this.attendance = attendance;
        this.audit = audit;
        this.teachers = teachers;
        this.userNames = userNames;
    }

    /**
     * Scheduled (not cancelled) classes between two dates with their checks.
     * status filters by approval status ("Not checked", "Incomplete",
     * "Pending", "Approved", "Rejected") or "flagged".
     */
    @Transactional(readOnly = true)
    public List<TeachingRow> list(String fromText, String toText, String employeeId, String status) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The end date must not be before the start date.");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw Validation.invalid("to", "Choose a range of at most " + MAX_RANGE_DAYS + " days.");
        }
        List<FacultyClass> rows = classes.findByClassDateBetweenOrderByClassDateAscScheduledStartAsc(from, to).stream()
                .filter(c -> !c.isCancelled())
                .filter(c -> employeeId == null || employeeId.isBlank() || Teachers.employeeIdOf(c).equals(employeeId))
                .toList();
        List<TeachingRow> result = rows(rows);
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            result = result.stream()
                    .filter(r -> "flagged".equalsIgnoreCase(status) ? !r.flags().isEmpty() : r.approvalStatus().equalsIgnoreCase(status))
                    .toList();
        }
        return result;
    }

    @Transactional(readOnly = true)
    public TeachingRow get(int classId) {
        return rows(List.of(findClass(classId))).get(0);
    }

    /**
     * Records (or corrects) the beginning or ending classroom check: Present,
     * Late (beginning only) or Absent, chosen directly by whoever records it
     * — not derived from a time they enter, so there's nothing to default to
     * the wrong answer — then saved. The verification time itself is set
     * automatically the first time a check is recorded (the moment it's
     * saved for today's classes; a class from an earlier day that was never
     * checked is recorded at its own scheduled start or end) and never moves
     * on a later correction — only the status/remarks do.
     */
    @Transactional
    public TeachingRow recordCheck(int classId, CheckRequest r, int userId) {
        FacultyClass c = findClass(classId);
        if (c.isCancelled()) {
            throw conflict("This class was cancelled in Faculty Schedule; there is nothing to check.");
        }
        boolean start = "start".equalsIgnoreCase(r.check());
        if (!start && !"end".equalsIgnoreCase(r.check())) {
            throw Validation.invalid("check", "Choose the beginning or the ending check.");
        }
        String which = start ? "Beginning check" : "Ending check";

        String status = Validation.requiredText(r.status(), "status", "Attendance", 20);
        Set<String> allowed = start
                ? Set.of(TeachingAttendance.PRESENT, TeachingAttendance.LATE, TeachingAttendance.ABSENT)
                : Set.of(TeachingAttendance.PRESENT, TeachingAttendance.ABSENT);
        if (!allowed.contains(status)) {
            throw Validation.invalid("status", start ? "Choose Present, Late or Absent." : "Choose Present or Absent.");
        }

        TeachingAttendance existing = attendance.findByClassScheduleId(classId).orElse(null);
        TeachingAttendance a = existing;
        if (a == null) {
            a = new TeachingAttendance(classId);
        }
        if (!start && a.getStartCheckAt() == null) {
            throw conflict("Record the beginning check first.");
        }

        LocalDateTime oldAt = start ? a.getStartCheckAt() : a.getEndCheckAt();
        String oldStatus = start ? a.getStartCheckStatus() : a.getEndCheckStatus();
        boolean replacing = oldAt != null;

        LocalDateTime at = replacing ? oldAt : (c.getClassDate().isEqual(LocalDate.now())
                ? LocalDateTime.now()
                : c.getClassDate().atTime(start ? c.getScheduledStart() : c.getScheduledEnd()));

        if (replacing && !oldStatus.equals(status)) {
            // Corrections to the recorded status are allowed, never silently: Remarks must explain it, and it's logged.
            Validation.requiredText(r.remarks(), "remarks", "Remarks", 255);
        }

        String oldRemarks = a.getRemarks();
        if (r.remarks() != null) {
            a.setRemarks(Validation.optionalText(r.remarks(), "remarks", "Remarks", 255));
        }

        if (start) {
            a.setStartCheckAt(at);
            a.setStartCheckStatus(status);
            a.setStartCheckedBy(userId);
        } else {
            a.setEndCheckAt(at);
            a.setEndCheckStatus(status);
            a.setEndCheckedBy(userId);
        }
        a.setApprovalStatus(a.bothChecksRecorded() ? TeachingAttendance.COMPLETE : TeachingAttendance.INCOMPLETE);
        attendance.saveAndFlush(a);

        String described = describeCheck(at, status);
        if (r.remarks() != null && !java.util.Objects.equals(oldRemarks, a.getRemarks())) {
            described += " · Remarks: " + (a.getRemarks() == null ? "(cleared)" : a.getRemarks());
        }
        if (replacing) {
            audit.save(new AttendanceAudit(a.getId(), which + " corrected",
                    describeCheck(oldAt, oldStatus) + "  →  " + described, null, userId));
        } else {
            audit.save(new AttendanceAudit(a.getId(), which + " recorded", described, null, userId));
        }
        return get(classId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> auditHistory(int classId) {
        findClass(classId);
        TeachingAttendance a = attendance.findByClassScheduleId(classId).orElse(null);
        if (a == null) {
            return List.of();
        }
        List<AttendanceAudit> rows = audit.findByAttendanceIdOrderByIdDesc(a.getId());
        Map<Integer, String> names = userNames.of(rows.stream().map(AttendanceAudit::getPerformedBy).toList());
        List<Map<String, Object>> result = new ArrayList<>();
        for (AttendanceAudit row : rows) {
            Map<String, Object> m = new HashMap<>();
            m.put("action", row.getAction());
            m.put("details", row.getDetails());
            m.put("reason", row.getReason());
            m.put("performedBy", names.getOrDefault(row.getPerformedBy(), "—"));
            m.put("performedAt", row.getPerformedAt() == null ? null : row.getPerformedAt().toString());
            result.add(m);
        }
        return result;
    }

    /**
     * For payroll: payable teaching hours per employee between two dates,
     * directly from the recorded checks (no approval gate), with the paid
     * class periods (to exclude them from a Faculty/Admin employee's office
     * hours) and how many classes in the range still need checks.
     */
    @Transactional(readOnly = true)
    public Map<String, ApprovedHours> approvedHours(LocalDate from, LocalDate to) {
        List<FacultyClass> rows = classes.findByClassDateBetweenOrderByClassDateAscScheduledStartAsc(from, to).stream()
                .filter(c -> !c.isCancelled()).toList();
        Map<Integer, TeachingAttendance> byClass = new HashMap<>();
        attendance.findByClassScheduleIdIn(rows.stream().map(FacultyClass::getId).toList())
                .forEach(a -> byClass.put(a.getClassScheduleId(), a));

        Map<String, ApprovedHours> result = new LinkedHashMap<>();
        for (FacultyClass c : rows) {
            String employeeId = Teachers.employeeIdOf(c);
            ApprovedHours h = result.computeIfAbsent(employeeId, k -> new ApprovedHours());
            TeachingAttendance a = byClass.get(c.getId());
            if (a != null && a.bothChecksRecorded()) {
                BigDecimal hrs = payableFor(c, a);
                h.hours = h.hours.add(hrs);
                h.hoursByDate.merge(c.getClassDate(), hrs, BigDecimal::add);
                h.approvedClasses++;
                if (hrs.signum() > 0) {
                    h.lateMinutes += a.getLateMinutes();
                    h.periods.add(new ClassPeriod(c.getClassDate(), c.getScheduledStart(), c.getScheduledEnd()));
                } else {
                    h.notPaid.add(new UnpaidClass(c.getClassDate(), hours(c.durationMinutes()), false));
                }
            } else {
                h.unapprovedClasses++;
                h.notPaid.add(new UnpaidClass(c.getClassDate(), hours(c.durationMinutes()), true));
            }
        }
        return result;
    }

    /** Approved teaching for one employee in a pay period. */
    public static final class ApprovedHours {
        public BigDecimal hours = BigDecimal.ZERO;
        /** The same approved hours per class date (double-pay holidays). */
        public final Map<LocalDate, BigDecimal> hoursByDate = new HashMap<>();
        public int approvedClasses;
        public int unapprovedClasses;
        /** Minutes late at the beginning check of approved, paid classes (deducted in payroll). */
        public int lateMinutes;
        public final List<ClassPeriod> periods = new ArrayList<>();
        /** Scheduled classes not paid as taught (not approved, or approved with 0 hours): paid leave covers them. */
        public final List<UnpaidClass> notPaid = new ArrayList<>();
    }

    public record ClassPeriod(LocalDate date, LocalTime start, LocalTime end) {
    }

    /** A scheduled class that wasn't paid as taught; pending = counted in unapprovedClasses. */
    public record UnpaidClass(LocalDate date, BigDecimal scheduledHours, boolean pending) {
    }

    // ---------------------------------------------------------------

    /**
     * Payable hours under the rules: the scheduled duration when the teacher was
     * Present (or Late) at the beginning and Present at the end; 0 when a check
     * is missing or shows Absent. Minutes late are deducted separately in
     * payroll (rate per hour ÷ 60 × minutes late).
     */
    static BigDecimal payableFor(FacultyClass c, TeachingAttendance a) {
        boolean present = a != null && taught(a.getStartCheckStatus())
                && TeachingAttendance.PRESENT.equals(a.getEndCheckStatus());
        return present ? hours(c.durationMinutes()) : BigDecimal.ZERO.setScale(2);
    }

    /** Not checked, Incomplete (one check) or Complete (both) — no approval gate. */
    private static String effectiveStatus(TeachingAttendance a) {
        if (a == null) {
            return NOT_CHECKED;
        }
        return a.bothChecksRecorded() ? TeachingAttendance.COMPLETE : TeachingAttendance.INCOMPLETE;
    }

    /** Issues needing review: a missed deadline, or conflicting Present/Absent evidence. */
    static List<String> flags(FacultyClass c, TeachingAttendance a, LocalDateTime now) {
        List<String> flags = new ArrayList<>();
        int grace = c.getGracePeriodMinutes();
        LocalDateTime start = c.getClassDate().atTime(c.getScheduledStart());
        LocalDateTime end = c.getClassDate().atTime(c.getScheduledEnd());
        LocalDateTime startCheck = a == null ? null : a.getStartCheckAt();
        LocalDateTime endCheck = a == null ? null : a.getEndCheckAt();

        if (startCheck == null && now.isAfter(start.plusMinutes(grace))) {
            flags.add("Beginning check missing");
        }
        if (endCheck == null && now.isAfter(end.plusMinutes(grace))) {
            flags.add("Ending check missing");
        }
        if (startCheck != null && endCheck != null
                && taught(a.getStartCheckStatus()) != taught(a.getEndCheckStatus())) {
            flags.add(taught(a.getStartCheckStatus())
                    ? "Conflicting evidence: present at the beginning, absent at the end"
                    : "Conflicting evidence: absent at the beginning, present at the end");
        }
        return flags;
    }

    /** Present or Late: the faculty member was in the classroom. */
    private static boolean taught(String status) {
        return TeachingAttendance.PRESENT.equals(status) || TeachingAttendance.LATE.equals(status);
    }

    private static BigDecimal hours(long minutes) {
        return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    private static String describeCheck(LocalDateTime at, String status) {
        return at.toLocalTime().format(HH_MM) + " " + status;
    }

    private List<TeachingRow> rows(List<FacultyClass> list) {
        if (list.isEmpty()) {
            return List.of();
        }
        Map<String, StaffMember> people = teachers.all();
        Map<Integer, TeachingAttendance> byClass = new HashMap<>();
        attendance.findByClassScheduleIdIn(list.stream().map(FacultyClass::getId).toList())
                .forEach(a -> byClass.put(a.getClassScheduleId(), a));

        List<Integer> userIds = new ArrayList<>();
        byClass.values().forEach(a -> {
            userIds.add(a.getStartCheckedBy());
            userIds.add(a.getEndCheckedBy());
        });
        Map<Integer, String> names = userNames.of(userIds);
        LocalDateTime now = LocalDateTime.now();

        List<TeachingRow> result = new ArrayList<>();
        for (FacultyClass c : list) {
            String employeeId = Teachers.employeeIdOf(c);
            StaffMember s = people.get(employeeId);
            TeachingAttendance a = byClass.get(c.getId());
            result.add(new TeachingRow(
                    c.getId(), employeeId,
                    s == null ? "" : s.getEmployeeNumber(),
                    s == null ? "(no longer teaching)" : s.getFullName(),
                    s == null ? "" : s.staffType(),
                    c.getSubject(), c.getClassSection(), c.getRoom(),
                    c.getClassDate().toString(),
                    c.getScheduledStart().format(HH_MM), c.getScheduledEnd().format(HH_MM),
                    c.getGracePeriodMinutes(), hours(c.durationMinutes()),
                    a == null || a.getStartCheckAt() == null ? null : a.getStartCheckAt().toLocalTime().format(HH_MM),
                    a == null ? null : a.getStartCheckStatus(),
                    a == null ? null : names.get(a.getStartCheckedBy()),
                    a == null || a.getEndCheckAt() == null ? null : a.getEndCheckAt().toLocalTime().format(HH_MM),
                    a == null ? null : a.getEndCheckStatus(),
                    a == null ? null : names.get(a.getEndCheckedBy()),
                    a == null ? null : a.getRemarks(),
                    effectiveStatus(a),
                    flags(c, a, now),
                    payableFor(c, a),
                    a == null ? 0 : a.getLateMinutes()));
        }
        return result;
    }

    private FacultyClass findClass(int id) {
        return classes.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Class not found."));
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }
}
