package com.stibalayan.payroll.loan;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** One payroll deduction for a loan — at most one per loan per pay period. */
@Entity
@Table(name = "loan_payment")
public class LoanPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "loan_payment_id")
    private Integer id;

    @Column(name = "loan_id")
    private Integer loanId;

    @Column(name = "period_from")
    private LocalDate periodFrom;

    @Column(name = "period_to")
    private LocalDate periodTo;

    @Column(name = "period_label")
    private String periodLabel;

    private BigDecimal amount;

    @Column(name = "remaining_balance")
    private BigDecimal remainingBalance;

    @Column(name = "date_processed")
    private LocalDateTime dateProcessed;

    @Column(name = "recorded_by")
    private Integer recordedBy;

    public Integer getId() { return id; }
    public Integer getLoanId() { return loanId; }
    public void setLoanId(Integer loanId) { this.loanId = loanId; }
    public LocalDate getPeriodFrom() { return periodFrom; }
    public void setPeriodFrom(LocalDate periodFrom) { this.periodFrom = periodFrom; }
    public LocalDate getPeriodTo() { return periodTo; }
    public void setPeriodTo(LocalDate periodTo) { this.periodTo = periodTo; }
    public String getPeriodLabel() { return periodLabel; }
    public void setPeriodLabel(String periodLabel) { this.periodLabel = periodLabel; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getRemainingBalance() { return remainingBalance; }
    public void setRemainingBalance(BigDecimal remainingBalance) { this.remainingBalance = remainingBalance; }
    public LocalDateTime getDateProcessed() { return dateProcessed; }
    public void setDateProcessed(LocalDateTime dateProcessed) { this.dateProcessed = dateProcessed; }
    public Integer getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Integer recordedBy) { this.recordedBy = recordedBy; }
}
