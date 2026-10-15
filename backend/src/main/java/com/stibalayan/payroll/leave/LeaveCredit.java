package com.stibalayan.payroll.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An employee's paid-leave credits for one year (default 15 when no row
 * exists). Used by categories with uses_credits = 1.
 */
@Entity
@Table(name = "leave_credit")
public class LeaveCredit {

    public static final int DEFAULT_CREDITS = 15;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leave_credit_id")
    private Integer id;

    @Column(name = "faculty_id")
    private Integer facultyId;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    @Column(name = "year_covered", columnDefinition = "YEAR")
    private Integer year;

    @Column(name = "total_credits", nullable = false)
    private int totalCredits = DEFAULT_CREDITS;

    public Integer getId() { return id; }
    public Integer getFacultyId() { return facultyId; }
    public void setFacultyId(Integer facultyId) { this.facultyId = facultyId; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public Integer getYear() { return year; }
    public void setYear(Integer year) { this.year = year; }
    public int getTotalCredits() { return totalCredits; }
    public void setTotalCredits(int totalCredits) { this.totalCredits = totalCredits; }
}
