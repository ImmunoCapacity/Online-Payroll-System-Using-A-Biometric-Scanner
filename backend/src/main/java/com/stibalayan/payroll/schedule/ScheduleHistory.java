package com.stibalayan.payroll.schedule;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** One change to a faculty class: created, updated, cancelled or restored. */
@Entity
@Table(name = "faculty_schedule_history")
public class ScheduleHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "history_id")
    private Integer id;

    @Column(name = "class_schedule_id")
    private Integer classScheduleId;

    private String action;

    private String details;

    @Column(name = "changed_by")
    private Integer changedBy;

    @Column(name = "changed_at", insertable = false, updatable = false)
    private LocalDateTime changedAt;

    protected ScheduleHistory() {
    }

    public ScheduleHistory(Integer classScheduleId, String action, String details, Integer changedBy) {
        this.classScheduleId = classScheduleId;
        this.action = action;
        this.details = details;
        this.changedBy = changedBy;
    }

    public Integer getId() { return id; }
    public Integer getClassScheduleId() { return classScheduleId; }
    public String getAction() { return action; }
    public String getDetails() { return details; }
    public Integer getChangedBy() { return changedBy; }
    public LocalDateTime getChangedAt() { return changedAt; }
}
