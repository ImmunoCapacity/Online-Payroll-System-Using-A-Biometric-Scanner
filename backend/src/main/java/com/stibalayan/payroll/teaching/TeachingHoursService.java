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
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Faculty Teaching Hours module: the Payroll Staff or Payroll Master checks
 * the classroom at the beginning and at the end of each scheduled class and
 * records what they saw. Teaching attendance does not come from the
 * biometric scanner.
 *
 * Rules (the "attendance rules" payroll relies on):
 *   - A class is payable only when BOTH checks found the faculty member
 *     Present; then the payable hours are the scheduled duration. Any Absent
 *     check makes the class pay 0 hours.
 *   - A record needs both checks before it can be approved; approval is a
 *     separate permission (Payroll Master).
 *   - Checks outside the grace window, missing checks and mixed
 *     Present/Absent evidence are flagged; approving a flagged record needs
 *     a review note.
 *   - Approved records are locked. Changing a recorded check needs a reason,
 *     and every check, correction, approval and rejection is kept in
 *     faculty_attendance_audit.
 *
 * Payroll reads approved records only (approvedHours).
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

    /** Records (or corrects) the beginning or ending classroom check. */
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

        LocalTime time = Validation.time(r.time(), "time", "Verification time", true);
        LocalDateTime at = c.getClassDate().atTime(time);
        if (at.isAfter(LocalDateTime.now().plusMinutes(1))) {
            throw Validation.invalid("time", "You can't record a check for a time that hasn't happened yet.");
        }
        String status = r.status() == null ? "" : r.status().trim();
        if (!TeachingAttendance.PRESENT.equals(status) && !TeachingAttendance.ABSENT.equals(status)) {
            throw Validation.invalid("status", "Choose Present or Absent.");
        }
        String remarks = Validation.optionalText(r.remarks(), "remarks", "Remarks", 255);

        TeachingAttendance a = attendance.findByClassScheduleId(classId).orElse(null);
        boolean isNew = a == null;
        if (isNew) {
            a = new TeachingAttendance(classId);
        }
        if (TeachingAttendance.APPROVED.equals(a.getApprovalStatus())) {
            throw conflict("This class has been approved and is locked. Its teaching hours may already be in payroll.");
        }

        LocalDateTime otherAt = start ? a.getEndCheckAt() : a.getStartCheckAt();
        if (otherAt != null && (start ? !at.isBefore(otherAt) : !at.isAfter(otherAt))) {
            throw Validation.invalid("time", start
                    ? "The beginning check must be earlier than the ending check (" + otherAt.toLocalTime().format(HH_MM) + ")."
                    : "The ending check must be later than the beginning check (" + otherAt.toLocalTime().format(HH_MM) + ").");
        }

        LocalDateTime oldAt = start ? a.getStartCheckAt() : a.getEndCheckAt();
        String oldStatus = start ? a.getStartCheckStatus() : a.getEndCheckStatus();
        boolean replacing = oldAt != null;
        boolean checkChanged = !replacing || !oldAt.equals(at) || !oldStatus.equals(status);
        boolean remarksChanged = !Objects.equals(a.getRemarks(), remarks);
        if (!checkChanged && !remarksChanged) {
            return get(classId);
        }

        String reason = null;
        if (replacing && checkChanged) {
            // Corrections are allowed, never silently: a reason is required and logged.
            reason = Validation.optionalText(r.reason(), "reason", "Reason for the correction", 255);
            if (reason == null) {
                throw Validation.invalid("reason", "This check was already recorded. Give a reason for the correction.");
            }
        }

        String wasStatus = a.getApprovalStatus();
        if (start) {
            a.setStartCheckAt(at);
            a.setStartCheckStatus(status);
            if (checkChanged) a.setStartCheckedBy(userId);
        } else {
            a.setEndCheckAt(at);
            a.setEndCheckStatus(status);
            if (checkChanged) a.setEndCheckedBy(userId);
        }
        a.setRemarks(remarks);
        // A corrected rejection goes back for review.
        a.setApprovalStatus(a.bothChecksRecorded() ? TeachingAttendance.PENDING : TeachingAttendance.INCOMPLETE);
        if (TeachingAttendance.REJECTED.equals(wasStatus)) {
            a.setReviewNote(null);
            a.setApprovedBy(null);
            a.setApprovedAt(null);
            a.setPayableHours(null);
        }
        attendance.saveAndFlush(a);

        if (checkChanged) {
            String now = describeCheck(at, status);
            if (replacing) {
                audit.save(new AttendanceAudit(a.getId(), which + " corrected",
                        describeCheck(oldAt, oldStatus) + "  →  " + now, reason, userId));
            } else {
                audit.save(new AttendanceAudit(a.getId(), which + " recorded", now, null, userId));
            }
        }
        if (remarksChanged) {
            audit.save(new AttendanceAudit(a.getId(), "Remarks updated",
                    (a.getRemarks() == null ? "(none)" : a.getRemarks()), null, userId));
        }
        if (TeachingAttendance.REJECTED.equals(wasStatus)) {
            audit.save(new AttendanceAudit(a.getId(), "Returned for review", "Corrected after rejection", null, userId));
        }
        return get(classId);
    }

    /** Approves a record with both checks; payable hours are fixed by the rules at this point. */
    @Transactional
    public TeachingRow approve(int classId, String noteText, int userId) {
        FacultyClass c = findClass(classId);
        TeachingAttendance a = attendance.findByClassScheduleId(classId)
                .orElseThrow(() -> conflict("No classroom checks have been recorded for this class yet."));
        if (!TeachingAttendance.PENDING.equals(a.getApprovalStatus())) {
            throw conflict(TeachingAttendance.INCOMPLETE.equals(a.getApprovalStatus())
                    ? "Both the beginning and the ending checks are needed before approval."
                    : "Only records waiting for approval can be approved (this one is " + a.getApprovalStatus().toLowerCase() + ").");
        }
        String note = Validation.optionalText(noteText, "note", "Review note", 255);
        List<String> flags = flags(c, a, LocalDateTime.now());
        if (!flags.isEmpty() && note == null) {
            throw Validation.invalid("note", "This record has issues flagged for review. Add a review note explaining the approval.");
        }
        BigDecimal payable = payableFor(c, a);
        a.setApprovalStatus(TeachingAttendance.APPROVED);
        a.setPayableHours(payable);
        a.setApprovedBy(userId);
        a.setApprovedAt(LocalDateTime.now());
        a.setReviewNote(note);
        attendance.saveAndFlush(a);
        audit.save(new AttendanceAudit(a.getId(), "Approved",
                "Payable teaching hours: " + payable.toPlainString()
                        + (flags.isEmpty() ? "" : " · flags: " + String.join("; ", flags)), note, userId));
        return get(classId);
    }

    @Transactional
    public TeachingRow reject(int classId, String noteText, int userId) {
        findClass(classId);
        TeachingAttendance a = attendance.findByClassScheduleId(classId)
                .orElseThrow(() -> conflict("No classroom checks have been recorded for this class yet."));
        if (TeachingAttendance.APPROVED.equals(a.getApprovalStatus())) {
            throw conflict("This class has been approved and is locked.");
        }
        if (TeachingAttendance.REJECTED.equals(a.getApprovalStatus())) {
            throw conflict("This record is already rejected.");
        }
        String note = Validation.requiredText(noteText, "note", "Reason for rejecting", 255);
        a.setApprovalStatus(TeachingAttendance.REJECTED);
        a.setPayableHours(BigDecimal.ZERO.setScale(2));
        a.setApprovedBy(userId);
        a.setApprovedAt(LocalDateTime.now());
        a.setReviewNote(note);
        attendance.saveAndFlush(a);
        audit.save(new AttendanceAudit(a.getId(), "Rejected", "No teaching hours will be paid for this class.", note, userId));
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
     * For payroll: approved payable teaching hours per employee between two
     * dates, with the approved class periods (to exclude them from a
     * Faculty/Admin employee's office hours) and how many classes in the
     * range are still waiting for checks or approval.
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
            String status = a == null ? NOT_CHECKED : a.getApprovalStatus();
            if (TeachingAttendance.APPROVED.equals(status)) {
                BigDecimal hours = a.getPayableHours() == null ? BigDecimal.ZERO : a.getPayableHours();
                h.hours = h.hours.add(hours);
                h.approvedClasses++;
                if (hours.signum() > 0) {
                    h.periods.add(new ClassPeriod(c.getClassDate(), c.getScheduledStart(), c.getScheduledEnd()));
                }
            } else if (!TeachingAttendance.REJECTED.equals(status)) {
                h.unapprovedClasses++;
            }
        }
        return result;
    }

    /** Approved teaching for one employee in a pay period. */
    public static final class ApprovedHours {
        public BigDecimal hours = BigDecimal.ZERO;
        public int approvedClasses;
        public int unapprovedClasses;
        public final List<ClassPeriod> periods = new ArrayList<>();
    }

    public record ClassPeriod(LocalDate date, LocalTime start, LocalTime end) {
    }

    // ---------------------------------------------------------------

    /** Payable hours under the rules: the scheduled duration when both checks found the teacher present. */
    static BigDecimal payableFor(FacultyClass c, TeachingAttendance a) {
        boolean present = TeachingAttendance.PRESENT.equals(a.getStartCheckStatus())
                && TeachingAttendance.PRESENT.equals(a.getEndCheckStatus());
        return present ? hours(c.durationMinutes()) : BigDecimal.ZERO.setScale(2);
    }

    /** Issues needing review. Check times are verification times, compared with the grace window. */
    static List<String> flags(FacultyClass c, TeachingAttendance a, LocalDateTime now) {
        List<String> flags = new ArrayList<>();
        int grace = c.getGracePeriodMinutes();
        LocalDateTime start = c.getClassDate().atTime(c.getScheduledStart());
        LocalDateTime end = c.getClassDate().atTime(c.getScheduledEnd());
        LocalDateTime startCheck = a == null ? null : a.getStartCheckAt();
        LocalDateTime endCheck = a == null ? null : a.getEndCheckAt();

        if (startCheck == null) {
            if (now.isAfter(start.plusMinutes(grace))) flags.add("Beginning check missing");
        } else if (startCheck.isBefore(start.minusMinutes(grace)) || startCheck.isAfter(start.plusMinutes(grace))) {
            flags.add("Beginning check at " + startCheck.toLocalTime().format(HH_MM) + " is outside the grace period ("
                    + window(start, grace) + ")");
        }
        if (endCheck == null) {
            if (now.isAfter(end.plusMinutes(grace))) flags.add("Ending check missing");
        } else if (endCheck.isBefore(end.minusMinutes(grace)) || endCheck.isAfter(end.plusMinutes(grace))) {
            flags.add("Ending check at " + endCheck.toLocalTime().format(HH_MM) + " is outside the grace period ("
                    + window(end, grace) + ")");
        }
        if (startCheck != null && endCheck != null
                && !a.getStartCheckStatus().equals(a.getEndCheckStatus())) {
            flags.add(TeachingAttendance.PRESENT.equals(a.getStartCheckStatus())
                    ? "Conflicting evidence: present at the beginning, absent at the end"
                    : "Conflicting evidence: absent at the beginning, present at the end");
        }
        return flags;
    }

    private static String window(LocalDateTime at, int grace) {
        return at.minusMinutes(grace).toLocalTime().format(HH_MM) + "–" + at.plusMinutes(grace).toLocalTime().format(HH_MM);
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
            userIds.add(a.getApprovedBy());
        });
        Map<Integer, String> names = userNames.of(userIds);
        LocalDateTime now = LocalDateTime.now();

        List<TeachingRow> result = new ArrayList<>();
        for (FacultyClass c : list) {
            String employeeId = Teachers.employeeIdOf(c);
            StaffMember s = people.get(employeeId);
            TeachingAttendance a = byClass.get(c.getId());
            boolean bothChecks = a != null && a.bothChecksRecorded();
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
                    a == null ? NOT_CHECKED : a.getApprovalStatus(),
                    flags(c, a, now),
                    bothChecks ? payableFor(c, a) : null,
                    a == null ? null : a.getPayableHours(),
                    a == null ? null : names.get(a.getApprovedBy()),
                    a == null || a.getApprovedAt() == null ? null : a.getApprovedAt().toString(),
                    a == null ? null : a.getReviewNote()));
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
