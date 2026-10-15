package com.stibalayan.payroll.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Leave Category Maintenance (paper 5.3): a kind of leave and its rules. */
@Entity
@Table(name = "leave_category")
public class LeaveCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leave_category_id")
    private Integer id;

    @Column(name = "category_name")
    private String name;

    @Column(name = "is_paid", nullable = false)
    private boolean paid;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    /** Most working days one request may cover; null = no limit. */
    @Column(name = "max_days")
    private Integer maxDays;

    /** Whether approved days count against the employee's yearly leave credits. */
    @Column(name = "uses_credits", nullable = false)
    private boolean usesCredits;

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isPaid() { return paid; }
    public void setPaid(boolean paid) { this.paid = paid; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Integer getMaxDays() { return maxDays; }
    public void setMaxDays(Integer maxDays) { this.maxDays = maxDays; }
    public boolean isUsesCredits() { return usesCredits; }
    public void setUsesCredits(boolean usesCredits) { this.usesCredits = usesCredits; }
}
