package com.stibalayan.payroll.benefit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/** Benefit Maintenance (paper 9.3): an allowance paid every payroll period. */
@Entity
@Table(name = "benefit")
public class Benefit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "benefit_id")
    private Integer id;

    @Column(name = "benefit_name")
    private String name;

    /** Suggested amount per payroll period when assigning it to an employee. */
    @Column(name = "default_amount")
    private BigDecimal defaultAmount;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getDefaultAmount() { return defaultAmount; }
    public void setDefaultAmount(BigDecimal defaultAmount) { this.defaultAmount = defaultAmount; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
