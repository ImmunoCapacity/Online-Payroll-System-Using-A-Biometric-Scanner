package com.stibalayan.payroll.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Paper, Data Dictionary Table 8 — one leave request of an employee. */
@Entity
@Table(name = "employee_leave")
public class EmployeeLeave {

    public static final String PENDING = "Pending";
    public static final String APPROVED = "Approved";
    public static final String REJECTED = "Rejected";
    public static final String CANCELLED = "Cancelled";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leave_id")
    private Integer id;

    @Column(name = "faculty_id")
    private Integer facultyId;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    /** Category name as it was when filed (paper column). */
    @Column(name = "leave_category")
    private String categoryName;

    @Column(name = "leave_category_id")
    private Integer categoryId;

    @Column(name = "is_paid", nullable = false)
    private boolean paid;

    private String reason;

    private String status = PENDING;

    @Column(name = "date_requested", insertable = false, updatable = false)
    private LocalDateTime dateRequested;

    /** When it was approved, rejected or cancelled. */
    @Column(name = "date_approved")
    private LocalDateTime dateApproved;

    /** Name of the user who approved, rejected or cancelled it. */
    @Column(name = "approved_by")
    private String approvedBy;

    @Column(name = "recorded_by")
    private Integer recordedBy;

    @Column(name = "date_from")
    private LocalDate dateFrom;

    @Column(name = "date_to")
    private LocalDate dateTo;

    /** Reviewer's remarks. */
    private String remarks;

    /** Working days (Mon–Fri) covered. */
    @Column(name = "total_days")
    private Integer totalDays;

    @Column(name = "total_leave_credit")
    private Integer totalLeaveCredit;

    @Column(name = "used_leave")
    private Integer usedLeave;

    @Column(name = "remaining_leave")
    private Integer remainingLeave;

    public boolean isPending() { return PENDING.equals(status); }

    public Integer getId() { return id; }
    public Integer getFacultyId() { return facultyId; }
    public void setFacultyId(Integer facultyId) { this.facultyId = facultyId; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public String getCategoryName() { return categoryName; }
    public void setCategoryName(String categoryName) { this.categoryName = categoryName; }
    public Integer getCategoryId() { return categoryId; }
    public void setCategoryId(Integer categoryId) { this.categoryId = categoryId; }
    public boolean isPaid() { return paid; }
    public void setPaid(boolean paid) { this.paid = paid; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getDateRequested() { return dateRequested; }
    public LocalDateTime getDateApproved() { return dateApproved; }
    public void setDateApproved(LocalDateTime dateApproved) { this.dateApproved = dateApproved; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public Integer getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Integer recordedBy) { this.recordedBy = recordedBy; }
    public LocalDate getDateFrom() { return dateFrom; }
    public void setDateFrom(LocalDate dateFrom) { this.dateFrom = dateFrom; }
    public LocalDate getDateTo() { return dateTo; }
    public void setDateTo(LocalDate dateTo) { this.dateTo = dateTo; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public Integer getTotalDays() { return totalDays; }
    public void setTotalDays(Integer totalDays) { this.totalDays = totalDays; }
    public Integer getTotalLeaveCredit() { return totalLeaveCredit; }
    public void setTotalLeaveCredit(Integer totalLeaveCredit) { this.totalLeaveCredit = totalLeaveCredit; }
    public Integer getUsedLeave() { return usedLeave; }
    public void setUsedLeave(Integer usedLeave) { this.usedLeave = usedLeave; }
    public Integer getRemainingLeave() { return remainingLeave; }
    public void setRemainingLeave(Integer remainingLeave) { this.remainingLeave = remainingLeave; }
}
