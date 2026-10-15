package com.stibalayan.payroll.benefit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/** A benefit given to one employee, with the amount paid every payroll period. */
@Entity
@Table(name = "employee_benefit")
public class EmployeeBenefit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "employee_benefit_id")
    private Integer id;

    @Column(name = "benefit_id")
    private Integer benefitId;

    @Column(name = "faculty_id")
    private Integer facultyId;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    private BigDecimal amount;

    public Integer getId() { return id; }
    public Integer getBenefitId() { return benefitId; }
    public void setBenefitId(Integer benefitId) { this.benefitId = benefitId; }
    public Integer getFacultyId() { return facultyId; }
    public void setFacultyId(Integer facultyId) { this.facultyId = facultyId; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
