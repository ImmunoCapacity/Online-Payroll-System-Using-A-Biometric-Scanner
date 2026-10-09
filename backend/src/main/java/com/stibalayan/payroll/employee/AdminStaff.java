package com.stibalayan.payroll.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/**
 * Paper, Data Dictionary Table 2 — Admin Staff. With isFaculty set, the
 * employee is "Faculty/Admin" (paper, Payroll Module: "Admin Staff who are
 * also Faculty Staff") and also carries the faculty fields of Table 1.
 */
@Entity
@Table(name = "admin_staff")
public class AdminStaff extends StaffMember {

    public static final String ADMIN = "Admin";
    public static final String FACULTY_ADMIN = "Faculty/Admin";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "adminstaff_id")
    private Integer id;

    /** The office the employee belongs to (e.g. Registrar). */
    private String department;

    private String position;

    @Column(name = "office_hours")
    private BigDecimal officeHours;

    @Column(name = "rate_per_hour")
    private BigDecimal ratePerHour;

    @Column(name = "is_faculty", nullable = false)
    private boolean faculty;

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

    /** "Faculty/Admin" for admin staff who also teach, otherwise "Admin". */
    @Override
    public String staffType() { return faculty ? FACULTY_ADMIN : ADMIN; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public BigDecimal getOfficeHours() { return officeHours; }
    public void setOfficeHours(BigDecimal officeHours) { this.officeHours = officeHours; }
    public BigDecimal getRatePerHour() { return ratePerHour; }
    public void setRatePerHour(BigDecimal ratePerHour) { this.ratePerHour = ratePerHour; }
    public boolean isFaculty() { return faculty; }
    public void setFaculty(boolean faculty) { this.faculty = faculty; }
    public String getInstructorRank() { return instructorRank; }
    public void setInstructorRank(String instructorRank) { this.instructorRank = instructorRank; }
    public BigDecimal getRatePerHourUnit() { return ratePerHourUnit; }
    public void setRatePerHourUnit(BigDecimal ratePerHourUnit) { this.ratePerHourUnit = ratePerHourUnit; }
    public Integer getLoadUnits() { return loadUnits; }
    public void setLoadUnits(Integer loadUnits) { this.loadUnits = loadUnits; }
    public BigDecimal getLectureHours() { return lectureHours; }
    public void setLectureHours(BigDecimal lectureHours) { this.lectureHours = lectureHours; }
}
