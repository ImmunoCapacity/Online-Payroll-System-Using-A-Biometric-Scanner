package com.stibalayan.payroll.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Faculty Teaching Hours module: the manual classroom checks of one
 * scheduled class (class_schedule_id → Faculty Schedule).
 *
 * The check times are when the Attendance Monitoring Staff/Master verified
 * the classroom — never the faculty member's time-in or time-out. Payable
 * hours are derived directly from the checks (TeachingHoursService.payableFor);
 * there is no separate approval step.
 */
@Entity
@Table(name = "faculty_teaching_attendance")
public class TeachingAttendance {

    public static final String PRESENT = "Present";
    public static final String ABSENT = "Absent";
    /** Beginning check only: the faculty member taught, but arrived late. Paid the same as Present. */
    public static final String LATE = "Late";

    /** Only one of the two checks is recorded. */
    public static final String INCOMPLETE = "Incomplete";
    /** Both checks recorded; payable hours are final. */
    public static final String COMPLETE = "Complete";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attendance_id")
    private Integer id;

    @Column(name = "class_schedule_id")
    private Integer classScheduleId;

    @Column(name = "start_check_at")
    private LocalDateTime startCheckAt;

    @Column(name = "start_check_status")
    private String startCheckStatus;

    @Column(name = "start_checked_by")
    private Integer startCheckedBy;

    /** Unused — Late no longer carries a per-minute payroll deduction; kept at 0. */
    @Column(name = "late_minutes", nullable = false)
    private int lateMinutes;

    @Column(name = "end_check_at")
    private LocalDateTime endCheckAt;

    @Column(name = "end_check_status")
    private String endCheckStatus;

    @Column(name = "end_checked_by")
    private Integer endCheckedBy;

    private String remarks;

    @Column(name = "approval_status")
    private String approvalStatus = INCOMPLETE;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    protected TeachingAttendance() {
    }

    public TeachingAttendance(Integer classScheduleId) {
        this.classScheduleId = classScheduleId;
    }

    public boolean bothChecksRecorded() {
        return startCheckAt != null && endCheckAt != null;
    }

    public Integer getId() { return id; }
    public Integer getClassScheduleId() { return classScheduleId; }
    public LocalDateTime getStartCheckAt() { return startCheckAt; }
    public void setStartCheckAt(LocalDateTime startCheckAt) { this.startCheckAt = startCheckAt; }
    public String getStartCheckStatus() { return startCheckStatus; }
    public void setStartCheckStatus(String startCheckStatus) { this.startCheckStatus = startCheckStatus; }
    public Integer getStartCheckedBy() { return startCheckedBy; }
    public int getLateMinutes() { return lateMinutes; }
    public void setLateMinutes(int lateMinutes) { this.lateMinutes = lateMinutes; }
    public void setStartCheckedBy(Integer startCheckedBy) { this.startCheckedBy = startCheckedBy; }
    public LocalDateTime getEndCheckAt() { return endCheckAt; }
    public void setEndCheckAt(LocalDateTime endCheckAt) { this.endCheckAt = endCheckAt; }
    public String getEndCheckStatus() { return endCheckStatus; }
    public void setEndCheckStatus(String endCheckStatus) { this.endCheckStatus = endCheckStatus; }
    public Integer getEndCheckedBy() { return endCheckedBy; }
    public void setEndCheckedBy(Integer endCheckedBy) { this.endCheckedBy = endCheckedBy; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
