package com.stibalayan.payroll.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Leave Category Maintenance (paper 5.3): a kind of leave, paid or unpaid,
 * and for paid leave how many days a year each employee is paid for (their
 * leave credits of this type).
 */
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

    /** Paid leave: days a year each employee is paid for; null for unpaid leave. */
    @Column(name = "paid_days")
    private Integer paidDays;

    public Integer getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public boolean isPaid() { return paid; }
    public void setPaid(boolean paid) { this.paid = paid; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Integer getPaidDays() { return paidDays; }
    public void setPaidDays(Integer paidDays) { this.paidDays = paidDays; }
}
