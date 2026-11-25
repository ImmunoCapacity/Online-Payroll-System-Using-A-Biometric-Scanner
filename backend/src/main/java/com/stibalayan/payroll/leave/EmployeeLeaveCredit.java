package com.stibalayan.payroll.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Leave Credit (Maintenance): a per-employee override of one paid leave
 * category's days-a-year, for one calendar year — e.g. a correction, or an
 * exception to the probationary period (LeaveService.inProbation). No row
 * for an employee/category/year falls back to the category's own default
 * (or 0, while on probation). Admin staff only — Faculty don't have leave.
 */
@Entity
@Table(name = "leave_credit")
public class EmployeeLeaveCredit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leave_credit_id")
    private Integer id;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    @Column(name = "leave_category_id")
    private Integer categoryId;

    @Column(name = "year_covered")
    private Integer year;

    @Column(name = "total_credits")
    private Integer totalCredits;

    @Column(name = "updated_by")
    private Integer updatedBy;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    public Integer getId() { return id; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public Integer getCategoryId() { return categoryId; }
    public void setCategoryId(Integer categoryId) { this.categoryId = categoryId; }
    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }
    public Integer getTotalCredits() { return totalCredits; }
    public void setTotalCredits(Integer totalCredits) { this.totalCredits = totalCredits; }
    public Integer getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(Integer updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
