package com.stibalayan.payroll.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/** Paper, Data Dictionary Table 1 — Faculty Staff. */
@Entity
@Table(name = "faculty_staff")
public class FacultyStaff extends StaffMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "faculty_id")
    private Integer id;

    /** Instructor I, Instructor II, Instructor III, ... */
    @Column(name = "instructor_rank")
    private String instructorRank;

    @Column(name = "rate_per_hour_unit")
    private BigDecimal ratePerHourUnit;

    @Column(name = "load_units")
    private Integer loadUnits;

    @Column(name = "lecture_hours")
    private BigDecimal lectureHours;

    @Override
    public Integer getId() { return id; }

    @Override
    public String staffType() { return "Faculty"; }

    public String getInstructorRank() { return instructorRank; }
    public void setInstructorRank(String instructorRank) { this.instructorRank = instructorRank; }
    public BigDecimal getRatePerHourUnit() { return ratePerHourUnit; }
    public void setRatePerHourUnit(BigDecimal ratePerHourUnit) { this.ratePerHourUnit = ratePerHourUnit; }
    public Integer getLoadUnits() { return loadUnits; }
    public void setLoadUnits(Integer loadUnits) { this.loadUnits = loadUnits; }
    public BigDecimal getLectureHours() { return lectureHours; }
    public void setLectureHours(BigDecimal lectureHours) { this.lectureHours = lectureHours; }
}
