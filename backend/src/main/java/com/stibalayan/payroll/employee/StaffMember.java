package com.stibalayan.payroll.employee;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import java.time.LocalDate;

/**
 * Columns shared by faculty_staff and admin_staff (paper, Data Dictionary
 * Tables 1 and 2). Employees are records only — they are not users and
 * cannot log in. The paper keeps the two kinds of employee in separate
 * tables, so each has its own entity with its own id column and
 * type-specific fields; everything else lives here.
 */
@MappedSuperclass
public abstract class StaffMember {

    @Column(name = "employee_number")
    private String employeeNumber;

    /** The ZKTeco K40's "User ID" for this person. */
    @Column(name = "fingerprint_id")
    private String fingerprintId;

    private String firstname;

    private String middlename;

    private String lastname;

    private String gender;

    private LocalDate birthdate;

    /** Kept in step with birthdate on every save. */
    private Integer age;

    private String address;

    @Column(name = "contact_number")
    private String contactNumber;

    @Column(name = "email_address")
    private String emailAddress;

    @Column(name = "civil_status")
    private String civilStatus;

    @Column(name = "dependent_number")
    private Integer dependentNumber;

    @Column(name = "employment_status")
    private String employmentStatus;

    /** Full-time, part-time, contractual or temporary. */
    @Column(name = "employee_type")
    private String employeeType;

    @Column(name = "date_hired")
    private LocalDate dateHired;

    @Column(name = "sss_id")
    private String sssId;

    @Column(name = "philhealth_id")
    private String philhealthId;

    @Column(name = "pagibig_id")
    private String pagibigId;

    @Column(name = "tin_id")
    private String tinId;

    private String notes;

    public abstract Integer getId();

    /** "Faculty", "Admin" or "Faculty/Admin" — what the screens show as the staff type. */
    public abstract String staffType();

    public String getEmployeeNumber() { return employeeNumber; }
    public void setEmployeeNumber(String employeeNumber) { this.employeeNumber = employeeNumber; }
    public String getFingerprintId() { return fingerprintId; }
    public void setFingerprintId(String fingerprintId) { this.fingerprintId = fingerprintId; }
    public String getFirstname() { return firstname; }
    public void setFirstname(String firstname) { this.firstname = firstname; }
    public String getMiddlename() { return middlename; }
    public void setMiddlename(String middlename) { this.middlename = middlename; }
    public String getLastname() { return lastname; }
    public void setLastname(String lastname) { this.lastname = lastname; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public LocalDate getBirthdate() { return birthdate; }
    public void setBirthdate(LocalDate birthdate) { this.birthdate = birthdate; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getContactNumber() { return contactNumber; }
    public void setContactNumber(String contactNumber) { this.contactNumber = contactNumber; }
    public String getEmailAddress() { return emailAddress; }
    public void setEmailAddress(String emailAddress) { this.emailAddress = emailAddress; }
    public String getCivilStatus() { return civilStatus; }
    public void setCivilStatus(String civilStatus) { this.civilStatus = civilStatus; }
    public Integer getDependentNumber() { return dependentNumber; }
    public void setDependentNumber(Integer dependentNumber) { this.dependentNumber = dependentNumber; }
    public String getEmploymentStatus() { return employmentStatus; }
    public void setEmploymentStatus(String employmentStatus) { this.employmentStatus = employmentStatus; }
    public String getEmployeeType() { return employeeType; }
    public void setEmployeeType(String employeeType) { this.employeeType = employeeType; }
    public LocalDate getDateHired() { return dateHired; }
    public void setDateHired(LocalDate dateHired) { this.dateHired = dateHired; }
    public String getSssId() { return sssId; }
    public void setSssId(String sssId) { this.sssId = sssId; }
    public String getPhilhealthId() { return philhealthId; }
    public void setPhilhealthId(String philhealthId) { this.philhealthId = philhealthId; }
    public String getPagibigId() { return pagibigId; }
    public void setPagibigId(String pagibigId) { this.pagibigId = pagibigId; }
    public String getTinId() { return tinId; }
    public void setTinId(String tinId) { this.tinId = tinId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getFullName() {
        return ((firstname == null ? "" : firstname) + " " + (lastname == null ? "" : lastname)).trim();
    }
}
