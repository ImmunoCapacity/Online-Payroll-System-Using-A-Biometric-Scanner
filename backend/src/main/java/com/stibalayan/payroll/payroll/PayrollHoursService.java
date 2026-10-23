package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.dtr.DailyTimeRecord;
import com.stibalayan.payroll.dtr.DailyTimeRecordRepository;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import com.stibalayan.payroll.leave.LeaveService;
import com.stibalayan.payroll.settings.SettingsService;
import com.stibalayan.payroll.teaching.TeachingHoursService;
import com.stibalayan.payroll.teaching.TeachingHoursService.ApprovedHours;
import com.stibalayan.payroll.teaching.TeachingHoursService.ClassPeriod;
import com.stibalayan.payroll.teaching.TeachingHoursService.UnpaidClass;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The hours payroll pays for, per employee, in one pay period:
 *
 *   officeHours   — from the biometric Daily Time Record (administrative work)
 *   paidLeaveDays — approved paid leave days not also worked (Leave Management),
 *                   paid as office days (Admin, Faculty/Admin)
 *   paidLeaveTeachingHours — scheduled classes on paid leave days that were
 *                   not taught: paid leave pays them at the teaching rate
 *                   (Faculty, Faculty/Admin)
 *   teachingLateMinutes — minutes late at the beginning check of those classes
 *   teachingHours — APPROVED payable hours from Faculty Teaching Hours, never
 *                   straight from the Faculty Schedule
 *   holidayOfficeHours / holidayTeachingHours — the part of those hours
 *                   worked on a double-pay holiday (Holiday Calendar); payroll
 *                   pays them once more as Holiday pay
 *   regularHolidayDays / regularHolidayTeachingHours — regular holidays
 *                   (Monday–Friday) the employee did not work and was not on
 *                   paid leave: paid anyway, a normal office day (Admin,
 *                   Faculty/Admin) and the classes scheduled that day, even
 *                   if cancelled for the holiday (Faculty, Faculty/Admin)
 *
 * Faculty earnings = teachingHours × faculty rate; Admin earnings =
 * officeHours × rate; a Faculty/Admin employee gets both, each at its own
 * rate. When payroll.exclude-teaching-from-office-hours is on, office time
 * that overlaps an approved class is not counted twice.
 */
@Service
public class PayrollHoursService {

    private final DailyTimeRecordRepository dtr;
    private final AdminStaffRepository admins;
    private final TeachingHoursService teaching;
    private final LeaveService leave;
    private final JdbcTemplate jdbc;
    private final EmployeeDirectory employees;
    private final SettingsService settings;
    private final boolean excludeOverlap;

    public PayrollHoursService(DailyTimeRecordRepository dtr, AdminStaffRepository admins, TeachingHoursService teaching,
                               LeaveService leave, JdbcTemplate jdbc, EmployeeDirectory employees, SettingsService settings,
                               @Value("${payroll.exclude-teaching-from-office-hours:true}") boolean excludeOverlap) {
        this.dtr = dtr;
        this.admins = admins;
        this.teaching = teaching;
        this.leave = leave;
        this.jdbc = jdbc;
        this.employees = employees;
        this.settings = settings;
        this.excludeOverlap = excludeOverlap;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> hours(String fromText, String toText) {
        LocalDate from = Validation.date(fromText, "from", "Start date", true);
        LocalDate to = Validation.date(toText, "to", "End date", true);
        if (to.isBefore(from)) {
            throw Validation.invalid("to", "The end date must not be before the start date.");
        }

        Map<String, ApprovedHours> taught = teaching.approvedHours(from, to);
        Set<Integer> facultyAdmins = new HashSet<>();
        admins.findAll().stream().filter(AdminStaff::isFaculty).forEach(a -> facultyAdmins.add(a.getId()));
        Set<LocalDate> doublePay = new HashSet<>(jdbc.query(
                "SELECT holiday_date FROM holiday WHERE double_pay = 1 AND holiday_date BETWEEN ? AND ?",
                (rs, i) -> rs.getDate(1).toLocalDate(), Date.valueOf(from), Date.valueOf(to)));
        LocalTime officeStart = settings.officeStart();

        // Biometric minutes per employee, less any overlap with approved classes (Faculty/Admin only).
        // employeeId -> {minutes, days, overlapMinutes, minutes on double-pay holidays (less overlap)}
        Map<String, long[]> office = new HashMap<>();
        Map<String, Set<LocalDate>> workedDates = new HashMap<>();
        for (DailyTimeRecord r : dtr.findByRecordDateBetween(from, to)) {
            String employeeId = r.getFacultyId() != null ? EmployeeId.faculty(r.getFacultyId())
                    : r.getAdminstaffId() != null ? EmployeeId.admin(r.getAdminstaffId()) : null;
            if (employeeId == null || r.getTimeIn() == null || r.getTimeOut() == null || !r.getTimeOut().isAfter(r.getTimeIn())) {
                continue;
            }
            // Pay never starts before the official office start time, even if the
            // employee clocked in earlier.
            LocalTime payableIn = r.getTimeIn().isBefore(officeStart) ? officeStart : r.getTimeIn();
            long[] t = office.computeIfAbsent(employeeId, k -> new long[4]);
            long minutes = r.getTimeOut().isAfter(payableIn) ? Duration.between(payableIn, r.getTimeOut()).toMinutes() : 0;
            long overlap = 0;
            t[0] += minutes;
            t[1]++;
            workedDates.computeIfAbsent(employeeId, k -> new HashSet<>()).add(r.getRecordDate());
            boolean facultyAdmin = r.getAdminstaffId() != null && facultyAdmins.contains(r.getAdminstaffId());
            if (excludeOverlap && facultyAdmin && taught.containsKey(employeeId)) {
                for (ClassPeriod p : taught.get(employeeId).periods) {
                    if (p.date().equals(r.getRecordDate())) {
                        overlap += overlapMinutes(payableIn, r.getTimeOut(), p.start(), p.end());
                    }
                }
            }
            t[2] += overlap;
            if (doublePay.contains(r.getRecordDate())) {
                t[3] += Math.max(0, minutes - overlap);
            }
        }

        // Approved paid leave, but not on days the employee also worked (no double pay).
        Map<String, Set<LocalDate>> leaveDates = leave.paidLeaveDates(from, to);
        Map<String, Integer> paidLeaveDays = new HashMap<>();
        leaveDates.forEach((id, dates) -> {
            Set<LocalDate> worked = workedDates.getOrDefault(id, Set.of());
            int days = (int) dates.stream().filter(d -> !worked.contains(d)).count();
            if (days > 0) paidLeaveDays.put(id, days);
        });

        // Classes on paid leave days that weren't taught: paid leave pays their scheduled
        // hours, and they no longer count as waiting for approval.
        Map<String, BigDecimal> leaveTeachingHours = new HashMap<>();
        Map<String, Integer> leaveClasses = new HashMap<>();
        Map<String, Integer> pendingOnLeave = new HashMap<>();
        leaveDates.forEach((id, dates) -> {
            ApprovedHours h = taught.get(id);
            if (h == null) return;
            for (UnpaidClass c : h.notPaid) {
                if (!dates.contains(c.date())) continue;
                leaveTeachingHours.merge(id, c.scheduledHours(), BigDecimal::add);
                leaveClasses.merge(id, 1, Integer::sum);
                if (c.pending()) pendingOnLeave.merge(id, 1, Integer::sum);
            }
        });

        // Regular holidays on weekdays are paid even when not worked (unless already
        // paid as worked hours or paid leave). employeeId -> {office days, classes}
        Map<String, int[]> regular = new HashMap<>();
        Map<String, BigDecimal> regularTeaching = new HashMap<>();
        Map<String, Integer> pendingOnHoliday = new HashMap<>();
        List<LocalDate> regularDays = jdbc.query(
                "SELECT holiday_date FROM holiday WHERE holiday_type = 'Regular Holiday' AND holiday_date BETWEEN ? AND ?",
                (rs, i) -> rs.getDate(1).toLocalDate(), Date.valueOf(from), Date.valueOf(to)).stream()
                .filter(d -> d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY).toList();
        if (!regularDays.isEmpty()) {
            Map<String, StaffMember> people = employees.all();
            // Admin side: a normal office day for each regular holiday not worked and not on paid leave.
            people.forEach((id, s) -> {
                if (s.isArchived() || !"Active".equals(s.getEmploymentStatus()) || "Faculty".equals(s.staffType())) return;
                Set<LocalDate> worked = workedDates.getOrDefault(id, Set.of());
                Set<LocalDate> onLeave = leaveDates.getOrDefault(id, Set.of());
                for (LocalDate d : regularDays) {
                    if (s.getDateHired() != null && s.getDateHired().isAfter(d)) continue;
                    if (!worked.contains(d) && !onLeave.contains(d)) regular.computeIfAbsent(id, k -> new int[2])[0]++;
                }
            });
            // Faculty side: the classes scheduled on the holiday (cancelled for it, or not
            // taught), at their scheduled hours; not on paid leave days (paid there).
            for (LocalDate d : regularDays) {
                jdbc.queryForList("SELECT s.faculty_id, s.adminstaff_id, s.scheduled_start, s.scheduled_end, s.schedule_status, "
                        + "a.approval_status, a.payable_hours FROM faculty_class_schedule s "
                        + "LEFT JOIN faculty_teaching_attendance a ON a.class_schedule_id = s.class_schedule_id "
                        + "WHERE s.class_date = ?", Date.valueOf(d)).forEach(c -> {
                    String id = EmployeeDirectory.idOf((Integer) c.get("faculty_id"), (Integer) c.get("adminstaff_id"));
                    StaffMember s = people.get(id);
                    if (s == null || s.isArchived() || !"Active".equals(s.getEmploymentStatus())) return;
                    if (leaveDates.getOrDefault(id, Set.of()).contains(d)) return;
                    BigDecimal paidAsTaught = (BigDecimal) c.get("payable_hours");
                    if ("Approved".equals(c.get("approval_status")) && paidAsTaught != null && paidAsTaught.signum() > 0) return;
                    LocalTime start = ((java.sql.Time) c.get("scheduled_start")).toLocalTime();
                    LocalTime end = ((java.sql.Time) c.get("scheduled_end")).toLocalTime();
                    regular.computeIfAbsent(id, k -> new int[2])[1]++;
                    regularTeaching.merge(id, hours(Duration.between(start, end).toMinutes()), BigDecimal::add);
                    boolean cancelled = "Cancelled".equals(c.get("schedule_status"));
                    if (!cancelled && !"Rejected".equals(c.get("approval_status")) && !"Approved".equals(c.get("approval_status"))) {
                        pendingOnHoliday.merge(id, 1, Integer::sum);
                    }
                });
            }
        }

        Set<String> ids = new LinkedHashSet<>(office.keySet());
        ids.addAll(taught.keySet());
        ids.addAll(paidLeaveDays.keySet());
        ids.addAll(regular.keySet());
        List<Map<String, Object>> result = new ArrayList<>();
        for (String id : ids) {
            long[] t = office.getOrDefault(id, new long[4]);
            ApprovedHours h = taught.get(id);
            BigDecimal holidayTeaching = h == null ? BigDecimal.ZERO : h.hoursByDate.entrySet().stream()
                    .filter(d -> doublePay.contains(d.getKey()))
                    .map(Map.Entry::getValue)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Map<String, Object> row = new HashMap<>();
            row.put("holidayOfficeHours", hours(t[3]));
            row.put("holidayTeachingHours", holidayTeaching.setScale(2, RoundingMode.HALF_UP));
            row.put("paidLeaveDays", paidLeaveDays.getOrDefault(id, 0));
            row.put("employeeId", id);
            row.put("biometricHours", hours(t[0]));
            row.put("daysWorked", t[1]);
            row.put("overlapHours", hours(t[2]));
            row.put("officeHours", hours(Math.max(0, t[0] - t[2])));
            row.put("teachingHours", h == null ? BigDecimal.ZERO.setScale(2) : h.hours.setScale(2, RoundingMode.HALF_UP));
            row.put("approvedClasses", h == null ? 0 : h.approvedClasses);
            // Minutes late at approved classes: payroll deducts rate per hour ÷ 60 × minutes.
            row.put("teachingLateMinutes", h == null ? 0 : h.lateMinutes);
            row.put("unapprovedClasses", Math.max(0, h == null ? 0 : h.unapprovedClasses - pendingOnLeave.getOrDefault(id, 0)
                    - pendingOnHoliday.getOrDefault(id, 0)));
            row.put("paidLeaveTeachingHours", leaveTeachingHours.getOrDefault(id, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
            row.put("paidLeaveClasses", leaveClasses.getOrDefault(id, 0));
            int[] reg = regular.getOrDefault(id, new int[2]);
            row.put("regularHolidayDays", reg[0]);
            row.put("regularHolidayClasses", reg[1]);
            row.put("regularHolidayTeachingHours", regularTeaching.getOrDefault(id, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
            result.add(row);
        }
        return result;
    }

    private static long overlapMinutes(LocalTime aStart, LocalTime aEnd, LocalTime bStart, LocalTime bEnd) {
        LocalTime start = aStart.isAfter(bStart) ? aStart : bStart;
        LocalTime end = aEnd.isBefore(bEnd) ? aEnd : bEnd;
        return end.isAfter(start) ? Duration.between(start, end).toMinutes() : 0;
    }

    private static BigDecimal hours(long minutes) {
        return BigDecimal.valueOf(minutes).divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }
}
