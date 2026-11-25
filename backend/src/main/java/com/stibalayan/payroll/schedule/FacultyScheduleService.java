package com.stibalayan.payroll.schedule;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.settings.SettingsService;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.teaching.TeachingAttendanceRepository;
import com.stibalayan.payroll.user.UserNames;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Faculty Schedule module: the planned classes (who teaches what, where and
 * when). Classes are usually cancelled, not deleted — with a reason, and
 * every change kept in faculty_schedule_history — but Attendance Monitoring
 * Staff can also permanently delete one (see {@link #delete}).
 *
 * Whether a class actually took place is not decided here; that is the
 * Faculty Teaching Hours module (teaching package), which reads these
 * classes by their id.
 */
@Service
public class FacultyScheduleService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");
    private static final int MAX_RANGE_DAYS = 400;
    private static final int MAX_REPEAT_WEEKS = 26;   // one semester and then some
    private static final Set<String> INACTIVE = Set.of("Inactive", "Resigned", "Terminated");

    private final FacultyClassRepository classes;
    private final ScheduleHistoryRepository history;
    private final TeachingAttendanceRepository attendance;
    private final Teachers teachers;
    private final UserNames userNames;
    private final SettingsService settings;
    private final AuditService audit;

    public FacultyScheduleService(FacultyClassRepository classes, ScheduleHistoryRepository history,
                                  TeachingAttendanceRepository attendance, Teachers teachers, UserNames userNames,
                                  SettingsService settings, AuditService audit) {
        this.settings = settings;
        this.classes = classes;
        this.history = history;
        this.attendance = attendance;
        this.teachers = teachers;
        this.userNames = userNames;
        this.audit = audit;
    }

    /** Teaching employees for the faculty pickers. */
    @Transactional(readOnly = true)
    public List<Map<String, String>> teacherChoices() {
        List<Map<String, String>> result = new ArrayList<>();
        teachers.all().forEach((id, s) -> {
            if (s.isArchived()) return;   // archived employees are not listed
            result.add(Map.of(
                "id", id,
                "employeeNumber", s.getEmployeeNumber(),
                "displayName", s.getFullName(),
                "type", s.staffType(),
                "status", s.getEmploymentStatus() == null ? "" : s.getEmploymentStatus()));
        });
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
        List<FacultyClass> rows = classes.findByClassDateBetweenOrderByClassDateAscScheduledStartAsc(from, to).stream()
                .filter(c -> !c.isArchived()).toList();
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
     * Adds a weekly class: the same subject/section/room/time, on one day
     * of the week, from validFrom through validUntil. If any resulting date
     * conflicts with the teacher's other scheduled classes, nothing is
     * added — the whole request is rejected so the conflict must be fixed
     * first.
     */
    @Transactional
    public Map<String, Object> create(ClassRequest r, int userId) {
        StaffMember teacher = activeTeacher(r.employeeId());
        SeriesFields f = validateSeries(r, teacher);
        EmployeeId eid = EmployeeId.parse(r.employeeId());

        List<LocalDate> dates = datesFor(f.day(), f.validFrom(), f.validUntil());
        if (dates.isEmpty()) {
            throw Validation.invalid("validUntil", "No " + dayLabel(f.day()) + " falls between those dates.");
        }
        checkNoConflicts(eid, dates, f.start(), f.end(), null);

        List<Integer> created = new ArrayList<>();
        Integer seriesId = null;
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
            c.setSeriesId(seriesId);
            classes.save(c);
            if (seriesId == null) {
                seriesId = c.getId();
                c.setSeriesId(seriesId);
                classes.save(c);
            }
            history.save(new ScheduleHistory(c.getId(), "Created", describe(c), userId));
            created.add(c.getId());
        }
        classes.flush();
        return Map.of("created", created.size(), "ids", created, "seriesId", seriesId);
    }

    /**
     * Changes the weekly pattern of a whole series (every occurrence
     * sharing this class's series id) at once — this is how a scheduling
     * conflict gets fixed without editing each week by hand. The change
     * applies to every occurrence, including ones already in the past or
     * already checked in Faculty Teaching Hours (by explicit choice: a
     * recurring schedule is one thing being corrected, not many). Dates
     * the new pattern no longer covers are cancelled; dates newly covered
     * are added; matching dates are updated in place. Rejected outright if
     * the new pattern would conflict with the teacher's other classes.
     */
    @Transactional
    public Map<String, Object> update(int id, ClassRequest r, int userId) {
        FacultyClass anchor = find(id);
        StaffMember teacher = activeTeacher(Teachers.employeeIdOf(anchor));
        if (r.employeeId() != null && !r.employeeId().isBlank() && !r.employeeId().equals(Teachers.employeeIdOf(anchor))) {
            throw Validation.invalid("employeeId",
                    "A class can't be moved to another faculty member. Cancel it and add a new class instead.");
        }
        SeriesFields f = validateSeries(r, teacher);
        EmployeeId eid = EmployeeId.parse(Teachers.employeeIdOf(anchor));
        int seriesId = anchor.getSeriesId() != null ? anchor.getSeriesId() : anchor.getId();

        List<FacultyClass> siblings = classes.findBySeriesIdOrderByClassDateAsc(seriesId).stream()
                .filter(c -> !c.isCancelled())
                .toList();

        List<LocalDate> desired = datesFor(f.day(), f.validFrom(), f.validUntil());
        if (desired.isEmpty()) {
            throw Validation.invalid("validUntil", "No " + dayLabel(f.day()) + " falls between those dates.");
        }
        checkNoConflicts(eid, desired, f.start(), f.end(), seriesId);

        Map<LocalDate, FacultyClass> existingByDate = new HashMap<>();
        for (FacultyClass c : siblings) {
            existingByDate.put(c.getClassDate(), c);
        }
        Set<LocalDate> desiredSet = new HashSet<>(desired);

        int updated = 0, added = 0, removed = 0;
        for (LocalDate date : desired) {
            FacultyClass c = existingByDate.get(date);
            if (c != null) {
                String before = describe(c);
                f.applyTo(c);
                c.setUpdatedBy(userId);
                classes.save(c);
                String after = describe(c);
                if (!before.equals(after)) {
                    history.save(new ScheduleHistory(c.getId(), "Updated", before + "  →  " + after, userId));
                    updated++;
                }
            } else {
                FacultyClass c2 = new FacultyClass();
                if (anchor.getFacultyId() != null) {
                    c2.setFacultyId(anchor.getFacultyId());
                } else {
                    c2.setAdminstaffId(anchor.getAdminstaffId());
                }
                f.applyTo(c2);
                c2.setClassDate(date);
                c2.setSeriesId(seriesId);
                c2.setCreatedBy(userId);
                c2.setUpdatedBy(userId);
                classes.save(c2);
                history.save(new ScheduleHistory(c2.getId(), "Created", describe(c2), userId));
                added++;
            }
        }
        for (FacultyClass c : siblings) {
            if (!desiredSet.contains(c.getClassDate())) {
                c.setScheduleStatus(FacultyClass.CANCELLED);
                c.setStatusReason("Removed when the weekly schedule was changed.");
                c.setUpdatedBy(userId);
                classes.save(c);
                history.save(new ScheduleHistory(c.getId(), "Cancelled", c.getStatusReason(), userId));
                removed++;
            }
        }
        classes.flush();
        return Map.of("seriesId", seriesId, "updated", updated, "added", added, "removed", removed);
    }

    /** The current weekly pattern of a series, to prefill the edit form. */
    @Transactional(readOnly = true)
    public Map<String, Object> seriesInfo(int id) {
        FacultyClass anchor = find(id);
        int seriesId = anchor.getSeriesId() != null ? anchor.getSeriesId() : anchor.getId();
        List<FacultyClass> active = classes.findBySeriesIdOrderByClassDateAsc(seriesId).stream()
                .filter(c -> !c.isCancelled())
                .toList();
        if (active.isEmpty()) {
            active = List.of(anchor);
        }
        LocalDate validFrom = active.get(0).getClassDate();
        LocalDate validUntil = active.get(active.size() - 1).getClassDate();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("seriesId", seriesId);
        result.put("dayOfWeek", validFrom.getDayOfWeek().name());
        result.put("validFrom", validFrom.toString());
        result.put("validUntil", validUntil.toString());
        result.put("occurrences", active.size());
        return result;
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

    /**
     * Permanently deletes a class's whole weekly series in one go (every
     * occurrence that shares its series id — past, upcoming, cancelled or
     * checked alike), not one occurrence at a time — Attendance Monitoring
     * Staff only. Unlike cancel, this is allowed even after classroom checks
     * were recorded, and removes each occurrence's history and teaching
     * attendance with it (the database cascades those); the deletion itself
     * is kept in the general Audit Trail.
     */
    @Transactional
    public int delete(int id, int userId) {
        FacultyClass anchor = find(id);
        int seriesId = anchor.getSeriesId() != null ? anchor.getSeriesId() : anchor.getId();
        List<FacultyClass> rows = classes.findBySeriesIdOrderByClassDateAsc(seriesId);
        audit.log(userId, "Faculty Schedule", "Deleted class series",
                describe(anchor) + " (" + Teachers.employeeIdOf(anchor) + ") — " + rows.size() + " occurrence(s)");
        classes.deleteAll(rows);
        return rows.size();
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

    /**
     * Archives every class already in the past (before today) that isn't
     * archived yet — a term/semester cleanup. Archived classes are hidden
     * from the active Faculty Schedule view (list()) but keep all their
     * history; upcoming scheduled classes are never touched.
     */
    @Transactional
    public int archiveAllPast(int userId) {
        List<FacultyClass> past = classes.findByClassDateBeforeAndArchivedFalse(LocalDate.now());
        for (FacultyClass c : past) {
            c.setArchived(true);
        }
        classes.saveAll(past);
        if (!past.isEmpty()) {
            audit.log(userId, "Faculty Schedule", "Archived all past classes", past.size() + " class(es) archived");
        }
        return past.size();
    }

    /**
     * Archives every one of a single faculty member's classes — past and
     * upcoming alike — in one go (e.g. once they've retired or resigned
     * and their schedule no longer belongs on the active view).
     */
    @Transactional
    public int archiveForEmployee(String employeeId, int userId) {
        StaffMember teacher = teachers.require(employeeId);
        EmployeeId eid = EmployeeId.parse(employeeId);
        List<FacultyClass> rows = eid.isFaculty()
                ? classes.findByFacultyIdAndArchivedFalse(eid.number())
                : classes.findByAdminstaffIdAndArchivedFalse(eid.number());
        for (FacultyClass c : rows) {
            c.setArchived(true);
        }
        classes.saveAll(rows);
        if (!rows.isEmpty()) {
            audit.log(userId, "Faculty Schedule", "Archived a faculty member's schedule",
                    rows.size() + " class(es) archived for " + teacher.getFullName() + " (" + teacher.getEmployeeNumber() + ")");
        }
        return rows.size();
    }

    /** Archived classes, read-only (Archive page — System Administrator and Attendance Monitoring Staff). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> archivedList() {
        Map<String, StaffMember> people = teachers.all();
        List<Map<String, Object>> result = new ArrayList<>();
        for (FacultyClass c : classes.findByArchivedTrueOrderByClassDateDesc()) {
            String employeeId = Teachers.employeeIdOf(c);
            StaffMember s = people.get(employeeId);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeId", employeeId);
            m.put("employeeNumber", s == null ? "" : s.getEmployeeNumber());
            m.put("employeeName", s == null ? "(no longer teaching)" : s.getFullName());
            m.put("type", s == null ? "" : s.staffType());
            m.put("seriesId", c.getSeriesId() != null ? c.getSeriesId() : c.getId());
            m.put("dayOfWeek", c.getClassDate().getDayOfWeek().name());
            m.put("subject", c.getSubject());
            m.put("classSection", c.getClassSection());
            m.put("room", c.getRoom());
            m.put("classDate", c.getClassDate().toString());
            m.put("scheduledStart", c.getScheduledStart().format(HH_MM));
            m.put("scheduledEnd", c.getScheduledEnd().format(HH_MM));
            m.put("status", c.getScheduleStatus());
            result.add(m);
        }
        return result;
    }

    // ---------------------------------------------------------------

    private static final Set<DayOfWeek> ALLOWED_DAYS = Set.of(
            DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);

    /** The validated, normalised weekly pattern of a request. */
    private record SeriesFields(String subject, String section, String room, DayOfWeek day,
                                LocalTime start, LocalTime end, int grace,
                                LocalDate validFrom, LocalDate validUntil) {
        void applyTo(FacultyClass c) {
            c.setSubject(subject);
            c.setClassSection(section);
            c.setRoom(room);
            c.setScheduledStart(start);
            c.setScheduledEnd(end);
            c.setGracePeriodMinutes(grace);
        }
    }

    private SeriesFields validateSeries(ClassRequest r, StaffMember teacher) {
        String subject = Validation.requiredText(r.subject(), "subject", "Subject", 100);
        String section = Validation.requiredText(r.classSection(), "classSection", "Class/section", 50);
        String room = Validation.optionalText(r.room(), "room", "Room", 50);

        DayOfWeek day;
        try {
            day = DayOfWeek.valueOf(String.valueOf(r.dayOfWeek()).trim().toUpperCase());
        } catch (Exception e) {
            throw Validation.invalid("dayOfWeek", "Choose a day of the week.");
        }
        if (!ALLOWED_DAYS.contains(day)) {
            throw Validation.invalid("dayOfWeek", "Classes can only be scheduled Monday through Saturday.");
        }

        LocalTime start = Validation.time(r.scheduledStart(), "scheduledStart", "Start time", true);
        LocalTime end = Validation.time(r.scheduledEnd(), "scheduledEnd", "End time", true);
        if (!end.isAfter(start)) {
            throw Validation.invalid("scheduledEnd", "The end time must be later than the start time.");
        }
        // The beginning and ending check windows (the class grace period each side, Maintenance →
        // Grace Period) must not overlap.
        int grace = settings.classGraceMinutes();
        if (grace * 2L >= Duration.between(start, end).toMinutes()) {
            throw Validation.invalid("scheduledEnd", "A class must be longer than " + (grace * 2) + " minutes.");
        }

        LocalDate validFrom = Validation.date(r.validFrom(), "validFrom", "Valid from", true);
        LocalDate validUntil = Validation.date(r.validUntil(), "validUntil", "Valid until", true);
        if (teacher.getDateHired() != null && validFrom.isBefore(teacher.getDateHired())) {
            throw Validation.invalid("validFrom", "This is before this faculty member was hired (" + teacher.getDateHired() + ").");
        }
        if (!validUntil.isAfter(validFrom)) {
            throw Validation.invalid("validUntil", "Valid until must be after valid from.");
        }
        if (ChronoUnit.WEEKS.between(validFrom, validUntil) > MAX_REPEAT_WEEKS) {
            throw Validation.invalid("validUntil", "A schedule can run for at most " + MAX_REPEAT_WEEKS + " weeks at a time.");
        }
        return new SeriesFields(subject, section, room, day, start, end, grace, validFrom, validUntil);
    }

    /** Every date of the given weekday, from validFrom through validUntil inclusive. */
    private static List<LocalDate> datesFor(DayOfWeek day, LocalDate validFrom, LocalDate validUntil) {
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate d = validFrom.with(TemporalAdjusters.nextOrSame(day)); !d.isAfter(validUntil); d = d.plusWeeks(1)) {
            dates.add(d);
        }
        return dates;
    }

    private static String dayLabel(DayOfWeek day) {
        return day.getDisplayName(TextStyle.FULL, java.util.Locale.ENGLISH);
    }

    /**
     * Rejects the request outright if any of the given dates/time would
     * overlap one of the teacher's other scheduled classes. excludeSeriesId
     * (editing) leaves that class's own series out of the check.
     */
    private void checkNoConflicts(EmployeeId eid, List<LocalDate> dates, LocalTime start, LocalTime end, Integer excludeSeriesId) {
        List<String> conflicts = new ArrayList<>();
        for (LocalDate date : dates) {
            List<FacultyClass> sameDay = eid.isFaculty()
                    ? classes.findByFacultyIdAndClassDate(eid.number(), date)
                    : classes.findByAdminstaffIdAndClassDate(eid.number(), date);
            for (FacultyClass other : sameDay) {
                if (other.isCancelled()) continue;
                if (excludeSeriesId != null && Objects.equals(other.getSeriesId(), excludeSeriesId)) continue;
                if (start.isBefore(other.getScheduledEnd()) && other.getScheduledStart().isBefore(end)) {
                    conflicts.add(date.toString());
                    break;
                }
            }
        }
        if (!conflicts.isEmpty()) {
            throw conflict("This schedule conflicts with an existing class on " + String.join(", ", conflicts) + ". Resolve the conflict and try again.");
        }
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
                    c.getId(), c.getSeriesId() != null ? c.getSeriesId() : c.getId(), employeeId,
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
