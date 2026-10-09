package com.stibalayan.payroll.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Faculty Schedule module: one planned class meeting — who teaches which
 * subject and section, where, on which date and between which times.
 * This is the plan only; whether the class was actually held is recorded
 * in the Faculty Teaching Hours module (teaching package).
 *
 * Faculty staff use facultyId; Faculty/Admin staff (admin_staff with
 * is_faculty = 1) use adminstaffId.
 */
@Entity
@Table(name = "faculty_class_schedule")
public class FacultyClass {

    public static final String SCHEDULED = "Scheduled";
    public static final String CANCELLED = "Cancelled";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "class_schedule_id")
    private Integer id;

    @Column(name = "faculty_id")
    private Integer facultyId;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    private String subject;

    @Column(name = "class_section")
    private String classSection;

    private String room;

    @Column(name = "class_date")
    private LocalDate classDate;

    @Column(name = "scheduled_start")
    private LocalTime scheduledStart;

    @Column(name = "scheduled_end")
    private LocalTime scheduledEnd;

    @Column(name = "grace_period_minutes")
    private int gracePeriodMinutes;

    @Column(name = "schedule_status")
    private String scheduleStatus = SCHEDULED;

    @Column(name = "status_reason")
    private String statusReason;

    @Column(name = "created_by")
    private Integer createdBy;

    @Column(name = "updated_by")
    private Integer updatedBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public boolean isCancelled() { return CANCELLED.equals(scheduleStatus); }

    /** Scheduled length in minutes. */
    public long durationMinutes() {
        return java.time.Duration.between(scheduledStart, scheduledEnd).toMinutes();
    }

    public Integer getId() { return id; }
    public Integer getFacultyId() { return facultyId; }
    public void setFacultyId(Integer facultyId) { this.facultyId = facultyId; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getClassSection() { return classSection; }
    public void setClassSection(String classSection) { this.classSection = classSection; }
    public String getRoom() { return room; }
    public void setRoom(String room) { this.room = room; }
    public LocalDate getClassDate() { return classDate; }
    public void setClassDate(LocalDate classDate) { this.classDate = classDate; }
    public LocalTime getScheduledStart() { return scheduledStart; }
    public void setScheduledStart(LocalTime scheduledStart) { this.scheduledStart = scheduledStart; }
    public LocalTime getScheduledEnd() { return scheduledEnd; }
    public void setScheduledEnd(LocalTime scheduledEnd) { this.scheduledEnd = scheduledEnd; }
    public int getGracePeriodMinutes() { return gracePeriodMinutes; }
    public void setGracePeriodMinutes(int gracePeriodMinutes) { this.gracePeriodMinutes = gracePeriodMinutes; }
    public String getScheduleStatus() { return scheduleStatus; }
    public void setScheduleStatus(String scheduleStatus) { this.scheduleStatus = scheduleStatus; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Integer getCreatedBy() { return createdBy; }
    public void setCreatedBy(Integer createdBy) { this.createdBy = createdBy; }
    public Integer getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Integer updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
