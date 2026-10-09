package com.stibalayan.payroll.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Faculty Teaching Hours module: the manual classroom checks of one
 * scheduled class (class_schedule_id → Faculty Schedule).
 *
 * The check times are when the Payroll Staff/Master verified the classroom —
 * never the faculty member's time-in or time-out. payableHours is set only
 * when the record is approved; payroll reads approved records only.
 */
@Entity
@Table(name = "faculty_teaching_attendance")
public class TeachingAttendance {

    public static final String PRESENT = "Present";
    public static final String ABSENT = "Absent";

    /** Only one of the two checks is recorded. */
    public static final String INCOMPLETE = "Incomplete";
    /** Both checks recorded, waiting for approval. */
    public static final String PENDING = "Pending";
    public static final String APPROVED = "Approved";
    public static final String REJECTED = "Rejected";

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

    @Column(name = "end_check_at")
    private LocalDateTime endCheckAt;

    @Column(name = "end_check_status")
    private String endCheckStatus;

    @Column(name = "end_checked_by")
    private Integer endCheckedBy;

    private String remarks;

    @Column(name = "approval_status")
    private String approvalStatus = INCOMPLETE;

    @Column(name = "payable_hours")
    private BigDecimal payableHours;

    @Column(name = "approved_by")
    private Integer approvedBy;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "review_note")
    private String reviewNote;

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
    public BigDecimal getPayableHours() { return payableHours; }
    public void setPayableHours(BigDecimal payableHours) { this.payableHours = payableHours; }
    public Integer getApprovedBy() { return approvedBy; }
    public void setApprovedBy(Integer approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public String getReviewNote() { return reviewNote; }
    public void setReviewNote(String reviewNote) { this.reviewNote = reviewNote; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
