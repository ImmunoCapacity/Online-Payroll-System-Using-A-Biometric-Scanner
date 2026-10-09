package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.dtr.DailyTimeRecord;
import com.stibalayan.payroll.dtr.DailyTimeRecordRepository;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.teaching.TeachingHoursService;
import com.stibalayan.payroll.teaching.TeachingHoursService.ApprovedHours;
import com.stibalayan.payroll.teaching.TeachingHoursService.ClassPeriod;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The hours payroll pays for, per employee, in one pay period:
 *
 *   officeHours   — from the biometric Daily Time Record (administrative work)
 *   teachingHours — APPROVED payable hours from Faculty Teaching Hours, never
 *                   straight from the Faculty Schedule
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
    private final boolean excludeOverlap;

    public PayrollHoursService(DailyTimeRecordRepository dtr, AdminStaffRepository admins, TeachingHoursService teaching,
                               @Value("${payroll.exclude-teaching-from-office-hours:true}") boolean excludeOverlap) {
        this.dtr = dtr;
        this.admins = admins;
        this.teaching = teaching;
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

        // Biometric minutes per employee, less any overlap with approved classes (Faculty/Admin only).
        Map<String, long[]> office = new HashMap<>();   // employeeId -> {minutes, days, overlapMinutes}
        for (DailyTimeRecord r : dtr.findByRecordDateBetween(from, to)) {
            String employeeId = r.getFacultyId() != null ? EmployeeId.faculty(r.getFacultyId())
                    : r.getAdminstaffId() != null ? EmployeeId.admin(r.getAdminstaffId()) : null;
            if (employeeId == null || r.getTimeIn() == null || r.getTimeOut() == null || !r.getTimeOut().isAfter(r.getTimeIn())) {
                continue;
            }
            long[] t = office.computeIfAbsent(employeeId, k -> new long[3]);
            t[0] += Duration.between(r.getTimeIn(), r.getTimeOut()).toMinutes();
            t[1]++;
            boolean facultyAdmin = r.getAdminstaffId() != null && facultyAdmins.contains(r.getAdminstaffId());
            if (excludeOverlap && facultyAdmin && taught.containsKey(employeeId)) {
                for (ClassPeriod p : taught.get(employeeId).periods) {
                    if (p.date().equals(r.getRecordDate())) {
                        t[2] += overlapMinutes(r.getTimeIn(), r.getTimeOut(), p.start(), p.end());
                    }
                }
            }
        }

        Set<String> ids = new LinkedHashSet<>(office.keySet());
        ids.addAll(taught.keySet());
        List<Map<String, Object>> result = new ArrayList<>();
        for (String id : ids) {
            long[] t = office.getOrDefault(id, new long[3]);
            ApprovedHours h = taught.get(id);
            Map<String, Object> row = new HashMap<>();
            row.put("employeeId", id);
            row.put("biometricHours", hours(t[0]));
            row.put("daysWorked", t[1]);
            row.put("overlapHours", hours(t[2]));
            row.put("officeHours", hours(Math.max(0, t[0] - t[2])));
            row.put("teachingHours", h == null ? BigDecimal.ZERO.setScale(2) : h.hours.setScale(2, RoundingMode.HALF_UP));
            row.put("approvedClasses", h == null ? 0 : h.approvedClasses);
            row.put("unapprovedClasses", h == null ? 0 : h.unapprovedClasses);
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
