package com.stibalayan.payroll.loan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Paper, Data Dictionary Table 9 — an employee loan approved by its lender
 * (SSS, Pag-IBIG, ...) and repaid through payroll deductions.
 */
@Entity
@Table(name = "loan")
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "loan_id")
    private Integer id;

    @Column(name = "faculty_id")
    private Integer facultyId;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    @Column(name = "loan_type")
    private String type;

    @Column(name = "loan_amount")
    private BigDecimal amount;

    /** Date the loan was recorded. (current_date is an SQL keyword, hence the quotes.) */
    @Column(name = "`current_date`")
    private LocalDate recordedOn;

    /** Payment From: deductions start in this month. */
    @Column(name = "date_from")
    private LocalDate startDate;

    /** Date the loan was fully paid. */
    @Column(name = "date_to")
    private LocalDate paidOffDate;

    @Column(name = "reference_no")
    private String reference;

    @Column(name = "deduction_per_payroll")
    private BigDecimal deductionPerPayroll;

    /** Who lent it, as typed (e.g. SSS, Pag-IBIG, BDO). */
    private String lender;

    @Column(name = "lender_name")
    private String lenderName;

    /** Payment To: the last month deducted (null: older loans, worked out from the amounts). */
    @Column(name = "end_date")
    private LocalDate endDate;

    /** Interest in percent of the loan amount, for the whole loan. */
    @Column(name = "interest_rate")
    private BigDecimal interestRate;

    /** Loan amount plus interest: what payroll deducts in total (null: older loans, the amount). */
    @Column(name = "total_payable")
    private BigDecimal totalPayable;

    private String remarks;

    @Column(name = "recorded_by")
    private Integer recordedBy;

    public Integer getId() { return id; }
    public Integer getFacultyId() { return facultyId; }
    public void setFacultyId(Integer facultyId) { this.facultyId = facultyId; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public LocalDate getRecordedOn() { return recordedOn; }
    public void setRecordedOn(LocalDate recordedOn) { this.recordedOn = recordedOn; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getPaidOffDate() { return paidOffDate; }
    public void setPaidOffDate(LocalDate paidOffDate) { this.paidOffDate = paidOffDate; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }
    public BigDecimal getDeductionPerPayroll() { return deductionPerPayroll; }
    public void setDeductionPerPayroll(BigDecimal deductionPerPayroll) { this.deductionPerPayroll = deductionPerPayroll; }
    public String getLender() { return lender; }
    public void setLender(String lender) { this.lender = lender; }
    public String getLenderName() { return lenderName; }
    public void setLenderName(String lenderName) { this.lenderName = lenderName; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public BigDecimal getInterestRate() { return interestRate; }
    public void setInterestRate(BigDecimal interestRate) { this.interestRate = interestRate; }
    public BigDecimal getTotalPayable() { return totalPayable; }
    public void setTotalPayable(BigDecimal totalPayable) { this.totalPayable = totalPayable; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public Integer getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Integer recordedBy) { this.recordedBy = recordedBy; }
}
