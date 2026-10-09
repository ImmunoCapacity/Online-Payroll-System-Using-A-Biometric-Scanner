package com.stibalayan.payroll.schedule;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.teaching.TeachingAttendanceRepository;
import com.stibalayan.payroll.user.UserNames;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Faculty Schedule module: the planned classes (who teaches what, where and
 * when). Classes are never deleted — they are cancelled, with a reason, and
 * every change is kept in faculty_schedule_history.
 *
 * Whether a class actually took place is not decided here; that is the
 * Faculty Teaching Hours module (teaching package), which reads these
 * classes by their id.
 */
@Service
public class FacultyScheduleService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    /** Fixed grace period for classroom checks: 15 minutes before or after. */
    private static final int GRACE_MINUTES = 15;
    private static final int MAX_RANGE_DAYS = 400;
    private static final int MAX_REPEAT_WEEKS = 26;   // one semester and then some
    private static final Set<String> INACTIVE = Set.of("Inactive", "Resigned", "Terminated");

    private final FacultyClassRepository classes;
    private final ScheduleHistoryRepository history;
    private final TeachingAttendanceRepository attendance;
    private final Teachers teachers;
    private final UserNames userNames;

    public FacultyScheduleService(FacultyClassRepository classes, ScheduleHistoryRepository history,
                                  TeachingAttendanceRepository attendance, Teachers teachers, UserNames userNames) {
        this.classes = classes;
        this.history = history;
        this.attendance = attendance;
        this.teachers = teachers;
        this.userNames = userNames;
    }

    /** Teaching employees for the faculty pickers. */
    @Transactional(readOnly = true)
    public List<Map<String, String>> teacherChoices() {
        List<Map<String, String>> result = new ArrayList<>();
        teachers.all().forEach((id, s) -> result.add(Map.of(
                "id", id,
                "employeeNumber", s.getEmployeeNumber(),
                "displayName", s.getFullName(),
                "type", s.staffType(),
                "status", s.getEmploymentStatus() == null ? "" : s.getEmploymentStatus())));
        return result;
    }

    /** Classes between two dates (inclusive), optionally for one teacher. */
    @Transactional(readOnly = true)
    public List<ClassView> list(String fromText, String toText, String employeeId) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The end date must not be before the start date.");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw Validation.invalid("to", "Choose a range of at most " + MAX_RANGE_DAYS + " days.");
        }
        List<FacultyClass> rows = classes.findByClassDateBetweenOrderByClassDateAscScheduledStartAsc(from, to);
        if (employeeId != null && !employeeId.isBlank()) {
            rows = rows.stream().filter(c -> Teachers.employeeIdOf(c).equals(employeeId)).toList();
        }
        return views(rows);
    }

    @Transactional(readOnly = true)
    public ClassView get(int id) {
        return views(List.of(find(id))).get(0);
    }

    /**
     * Adds a class, or one per week up to repeatWeeklyUntil. Overlaps with
     * the teacher's other classes are allowed but flagged for review; the
     * response lists them.
     */
    @Transactional
    public Map<String, Object> create(ClassRequest r, int userId) {
        StaffMember teacher = activeTeacher(r.employeeId());
        Fields f = validate(r, teacher);

        List<LocalDate> dates = new ArrayList<>();
        dates.add(f.date);
        LocalDate until = Validation.date(r.repeatWeeklyUntil(), "repeatWeeklyUntil", "Repeat until", false);
        if (until != null) {
            if (!until.isAfter(f.date)) {
                throw Validation.invalid("repeatWeeklyUntil", "Repeat until must be after the class date.");
            }
            if (until.isAfter(f.date.plusWeeks(MAX_REPEAT_WEEKS))) {
                throw Validation.invalid("repeatWeeklyUntil", "Classes can repeat for at most " + MAX_REPEAT_WEEKS + " weeks at a time.");
            }
            for (LocalDate d = f.date.plusWeeks(1); !d.isAfter(until); d = d.plusWeeks(1)) {
                dates.add(d);
            }
        }

        EmployeeId eid = EmployeeId.parse(r.employeeId());
        List<Integer> created = new ArrayList<>();
        for (LocalDate date : dates) {
            FacultyClass c = new FacultyClass();
            if (eid.isFaculty()) {
                c.setFacultyId(eid.number());
            } else {
                c.setAdminstaffId(eid.number());
            }
            f.applyTo(c);
            c.setClassDate(date);
            c.setCreatedBy(userId);
            c.setUpdatedBy(userId);
            classes.save(c);
            history.save(new ScheduleHistory(c.getId(), "Created", describe(c), userId));
            created.add(c.getId());
        }
        classes.flush();

        List<String> overlaps = new ArrayList<>();
        for (ClassView v : views(classes.findAllById(created))) {
            if (!v.overlapsWith().isEmpty()) {
                overlaps.add(v.classDate());
            }
        }
        return Map.of("created", created.size(), "ids", created, "overlapDates", overlaps);
    }

    /** Changes a class that hasn't been checked yet; the change is kept in its history. */
    @Transactional
    public ClassView update(int id, ClassRequest r, int userId) {
        FacultyClass c = find(id);
        if (c.isCancelled()) {
            throw conflict("Restore this class before editing it.");
        }
        requireNoChecks(c, "edited");
        StaffMember teacher = activeTeacher(Teachers.employeeIdOf(c));
        if (r.employeeId() != null && !r.employeeId().isBlank() && !r.employeeId().equals(Teachers.employeeIdOf(c))) {
            throw Validation.invalid("employeeId",
                    "A class can't be moved to another faculty member. Cancel it and add a new class instead.");
        }
        Fields f = validate(r, teacher);

        String before = describe(c);
        f.applyTo(c);
        String after = describe(c);
        if (before.equals(after)) {
            return get(id);
        }
        c.setUpdatedBy(userId);
        classes.saveAndFlush(c);
        history.save(new ScheduleHistory(c.getId(), "Updated", before + "  →  " + after, userId));
        return get(id);
    }

    @Transactional
    public ClassView cancel(int id, String reasonText, int userId) {
        FacultyClass c = find(id);
        if (c.isCancelled()) {
            throw conflict("This class is already cancelled.");
        }
        requireNoChecks(c, "cancelled");
        String reason = Validation.requiredText(reasonText, "reason", "Reason for cancelling", 255);
        c.setScheduleStatus(FacultyClass.CANCELLED);
        c.setStatusReason(reason);
        c.setUpdatedBy(userId);
        classes.saveAndFlush(c);
        history.save(new ScheduleHistory(c.getId(), "Cancelled", reason, userId));
        return get(id);
    }

    @Transactional
    public ClassView restore(int id, int userId) {
        FacultyClass c = find(id);
        if (!c.isCancelled()) {
            throw conflict("Only cancelled classes can be restored.");
        }
        c.setScheduleStatus(FacultyClass.SCHEDULED);
        c.setStatusReason(null);
        c.setUpdatedBy(userId);
        classes.saveAndFlush(c);
        history.save(new ScheduleHistory(c.getId(), "Restored", describe(c), userId));
        return get(id);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> history(int id) {
        find(id);
        List<ScheduleHistory> rows = history.findByClassScheduleIdOrderByIdDesc(id);
        Map<Integer, String> names = userNames.of(rows.stream().map(ScheduleHistory::getChangedBy).toList());
        List<Map<String, Object>> result = new ArrayList<>();
        for (ScheduleHistory h : rows) {
            Map<String, Object> row = new HashMap<>();
            row.put("action", h.getAction());
            row.put("details", h.getDetails());
            row.put("changedBy", names.getOrDefault(h.getChangedBy(), "—"));
            row.put("changedAt", h.getChangedAt() == null ? null : h.getChangedAt().toString());
            result.add(row);
        }
        return result;
    }

    // ---------------------------------------------------------------

    /** The validated, normalised fields of a request. */
    private record Fields(String subject, String section, String room, LocalDate date,
                          LocalTime start, LocalTime end, int grace) {
        void applyTo(FacultyClass c) {
            c.setSubject(subject);
            c.setClassSection(section);
            c.setRoom(room);
            c.setClassDate(date);
            c.setScheduledStart(start);
            c.setScheduledEnd(end);
            c.setGracePeriodMinutes(grace);
        }
    }

    private Fields validate(ClassRequest r, StaffMember teacher) {
        String subject = Validation.requiredText(r.subject(), "subject", "Subject", 100);
        String section = Validation.requiredText(r.classSection(), "classSection", "Class/section", 50);
        String room = Validation.optionalText(r.room(), "room", "Room", 50);
        LocalDate date = Validation.date(r.classDate(), "classDate", "Class date", true);
        if (teacher.getDateHired() != null && date.isBefore(teacher.getDateHired())) {
            throw Validation.invalid("classDate", "The class date is before this faculty member was hired (" + teacher.getDateHired() + ").");
        }
        LocalTime start = Validation.time(r.scheduledStart(), "scheduledStart", "Start time", true);
        LocalTime end = Validation.time(r.scheduledEnd(), "scheduledEnd", "End time", true);
        if (!end.isAfter(start)) {
            throw Validation.invalid("scheduledEnd", "The end time must be later than the start time.");
        }
        // The beginning and ending check windows (15 minutes each side) must not overlap.
        if (GRACE_MINUTES * 2L >= java.time.Duration.between(start, end).toMinutes()) {
            throw Validation.invalid("scheduledEnd", "A class must be longer than " + (GRACE_MINUTES * 2) + " minutes.");
        }
        return new Fields(subject, section, room, date, start, end, GRACE_MINUTES);
    }

    private StaffMember activeTeacher(String employeeId) {
        StaffMember teacher = teachers.require(employeeId);
        if (INACTIVE.contains(teacher.getEmploymentStatus())) {
            throw Validation.invalid("employeeId", teacher.getFullName() + " is " + teacher.getEmploymentStatus().toLowerCase() + " and can't be scheduled.");
        }
        return teacher;
    }

    /** Once a classroom check exists, the plan it was checked against must not change. */
    private void requireNoChecks(FacultyClass c, String verb) {
        attendance.findByClassScheduleId(c.getId()).ifPresent(a -> {
            throw conflict("This class already has classroom checks recorded in Faculty Teaching Hours, so it can't be " + verb + ".");
        });
    }

    private FacultyClass find(int id) {
        return classes.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Class not found."));
    }

    private static String describe(FacultyClass c) {
        return c.getSubject() + " (" + c.getClassSection() + ")"
                + (c.getRoom() == null ? "" : ", " + c.getRoom())
                + ", " + c.getClassDate() + " " + c.getScheduledStart().format(HH_MM) + "–" + c.getScheduledEnd().format(HH_MM);
    }

    /** Builds the views, with overlap flags and the teaching attendance status. */
    private List<ClassView> views(List<FacultyClass> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        Map<String, StaffMember> people = teachers.all();

        // Overlaps are checked against all of the teacher's classes on those dates,
        // not only the ones being shown.
        Map<String, List<FacultyClass>> sameDay = new HashMap<>();
        Set<String> keys = new HashSet<>();
        for (FacultyClass c : rows) {
            String key = Teachers.employeeIdOf(c) + "|" + c.getClassDate();
            if (keys.add(key)) {
                sameDay.put(key, c.getFacultyId() != null
                        ? classes.findByFacultyIdAndClassDate(c.getFacultyId(), c.getClassDate())
                        : classes.findByAdminstaffIdAndClassDate(c.getAdminstaffId(), c.getClassDate()));
            }
        }

        Map<Integer, String> statusByClass = new HashMap<>();
        attendance.findByClassScheduleIdIn(rows.stream().map(FacultyClass::getId).toList())
                .forEach(a -> statusByClass.put(a.getClassScheduleId(), a.getApprovalStatus()));

        List<Integer> userIds = new ArrayList<>();
        rows.forEach(c -> { userIds.add(c.getCreatedBy()); userIds.add(c.getUpdatedBy()); });
        Map<Integer, String> names = userNames.of(userIds);

        List<ClassView> result = new ArrayList<>();
        for (FacultyClass c : rows) {
            String employeeId = Teachers.employeeIdOf(c);
            StaffMember s = people.get(employeeId);
            List<Integer> overlaps = new ArrayList<>();
            if (!c.isCancelled()) {
                for (FacultyClass other : sameDay.get(employeeId + "|" + c.getClassDate())) {
                    if (!Objects.equals(other.getId(), c.getId()) && !other.isCancelled()
                            && c.getScheduledStart().isBefore(other.getScheduledEnd())
                            && other.getScheduledStart().isBefore(c.getScheduledEnd())) {
                        overlaps.add(other.getId());
                    }
                }
            }
            result.add(new ClassView(
                    c.getId(), employeeId,
                    s == null ? "" : s.getEmployeeNumber(),
                    s == null ? "(no longer teaching)" : s.getFullName(),
                    s == null ? "" : s.staffType(),
                    c.getSubject(), c.getClassSection(), c.getRoom(),
                    c.getClassDate().toString(),
                    c.getScheduledStart().format(HH_MM), c.getScheduledEnd().format(HH_MM),
                    c.getGracePeriodMinutes(), c.getScheduleStatus(), c.getStatusReason(),
                    overlaps, statusByClass.get(c.getId()),
                    names.get(c.getCreatedBy()), names.get(c.getUpdatedBy()),
                    c.getUpdatedAt() == null ? null : c.getUpdatedAt().toString()));
        }
        return result;
    }

    private static ApiException conflict(String message) {
        return new ApiException(HttpStatus.CONFLICT, message);
    }
}
