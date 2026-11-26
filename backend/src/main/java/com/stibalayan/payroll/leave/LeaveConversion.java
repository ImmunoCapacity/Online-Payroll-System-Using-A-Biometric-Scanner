package com.stibalayan.payroll.leave;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A recorded cash-out of one employee's unused leave credits of one paid,
 * convertible category, for one completed calendar year (covered_year) —
 * computed on their hire-date anniversary and recorded once the pay period
 * it fell in is released (LeaveService.commitConversions). Recording one
 * also resets that year's leave_credit override to 0 remaining, so the same
 * days are never paid out twice.
 */
@Entity
@Table(name = "leave_conversion")
public class LeaveConversion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "conversion_id")
    private Integer id;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    @Column(name = "leave_category_id")
    private Integer categoryId;

    @Column(name = "covered_year")
    private Integer coveredYear;

    @Column(name = "anniversary_date")
    private LocalDate anniversaryDate;

    @Column(name = "unused_days")
    private Integer unusedDays;

    @Column(name = "daily_rate")
    private BigDecimal dailyRate;

    @Column(name = "exempt_amount")
    private BigDecimal exemptAmount;

    @Column(name = "taxable_amount")
    private BigDecimal taxableAmount;

    @Column(name = "payroll_run_id")
    private Integer payrollRunId;

    @Column(name = "created_by")
    private Integer createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    public Integer getId() { return id; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public Integer getCategoryId() { return categoryId; }
    public void setCategoryId(Integer categoryId) { this.categoryId = categoryId; }
    public Integer getCoveredYear() { return coveredYear; }
    public void setCoveredYear(Integer coveredYear) { this.coveredYear = coveredYear; }
    public LocalDate getAnniversaryDate() { return anniversaryDate; }
    public void setAnniversaryDate(LocalDate anniversaryDate) { this.anniversaryDate = anniversaryDate; }
    public Integer getUnusedDays() { return unusedDays; }
    public void setUnusedDays(Integer unusedDays) { this.unusedDays = unusedDays; }
    public BigDecimal getDailyRate() { return dailyRate; }
    public void setDailyRate(BigDecimal dailyRate) { this.dailyRate = dailyRate; }
    public BigDecimal getExemptAmount() { return exemptAmount; }
    public void setExemptAmount(BigDecimal exemptAmount) { this.exemptAmount = exemptAmount; }
    public BigDecimal getTaxableAmount() { return taxableAmount; }
    public void setTaxableAmount(BigDecimal taxableAmount) { this.taxableAmount = taxableAmount; }
    public Integer getPayrollRunId() { return payrollRunId; }
    public void setPayrollRunId(Integer payrollRunId) { this.payrollRunId = payrollRunId; }
    public Integer getCreatedBy() { return createdBy; }
    public void setCreatedBy(Integer createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
