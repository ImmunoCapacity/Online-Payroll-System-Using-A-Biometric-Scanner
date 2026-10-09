package com.stibalayan.payroll.teaching;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Audit history of a teaching attendance record: every check, correction,
 * approval and rejection, with who did it and why. Rows are only ever added.
 */
@Entity
@Table(name = "faculty_attendance_audit")
public class AttendanceAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Integer id;

    @Column(name = "attendance_id")
    private Integer attendanceId;

    private String action;

    private String details;

    private String reason;

    @Column(name = "performed_by")
    private Integer performedBy;

    @Column(name = "performed_at", insertable = false, updatable = false)
    private LocalDateTime performedAt;

    protected AttendanceAudit() {
    }

    public AttendanceAudit(Integer attendanceId, String action, String details, String reason, Integer performedBy) {
        this.attendanceId = attendanceId;
        this.action = action;
        this.details = details;
        this.reason = reason;
        this.performedBy = performedBy;
    }

    public Integer getId() { return id; }
    public Integer getAttendanceId() { return attendanceId; }
    public String getAction() { return action; }
    public String getDetails() { return details; }
    public String getReason() { return reason; }
    public Integer getPerformedBy() { return performedBy; }
    public LocalDateTime getPerformedAt() { return performedAt; }
}
