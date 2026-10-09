package com.stibalayan.payroll.dtr;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * One employee's attendance for one day (paper, Table 3 — Daily Time Record).
 * Exactly one of facultyId / adminstaffId is set.
 */
@Entity
@Table(name = "daily_time_record")
public class DailyTimeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "dtr_id")
    private Integer id;

    @Column(name = "fingerprint_id")
    private String fingerprintId;

    @Column(name = "device_id")
    private Integer deviceId;

    @Column(name = "faculty_id")
    private Integer facultyId;

    @Column(name = "adminstaff_id")
    private Integer adminstaffId;

    @Column(name = "record_date")
    private LocalDate recordDate;

    @Column(name = "time_in")
    private LocalTime timeIn;

    @Column(name = "time_out")
    private LocalTime timeOut;

    /** "Present", "Late" or "Absent". */
    private String status;

    /** True when encoded by hand (Attendance Recording fallback), false when from the scanner. */
    @Column(name = "is_manual_entry")
    private boolean manualEntry;

    /** Why a manual entry was made (paper: manual logging "subject to verification"). */
    private String remarks;

    /** users.user_id of whoever encoded a manual entry. */
    @Column(name = "recorded_by")
    private Integer recordedBy;

    public Integer getId() { return id; }
    public String getFingerprintId() { return fingerprintId; }
    public void setFingerprintId(String fingerprintId) { this.fingerprintId = fingerprintId; }
    public Integer getDeviceId() { return deviceId; }
    public void setDeviceId(Integer deviceId) { this.deviceId = deviceId; }
    public Integer getFacultyId() { return facultyId; }
    public void setFacultyId(Integer facultyId) { this.facultyId = facultyId; }
    public Integer getAdminstaffId() { return adminstaffId; }
    public void setAdminstaffId(Integer adminstaffId) { this.adminstaffId = adminstaffId; }
    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }
    public LocalTime getTimeIn() { return timeIn; }
    public void setTimeIn(LocalTime timeIn) { this.timeIn = timeIn; }
    public LocalTime getTimeOut() { return timeOut; }
    public void setTimeOut(LocalTime timeOut) { this.timeOut = timeOut; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isManualEntry() { return manualEntry; }
    public void setManualEntry(boolean manualEntry) { this.manualEntry = manualEntry; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public Integer getRecordedBy() { return recordedBy; }
    public void setRecordedBy(Integer recordedBy) { this.recordedBy = recordedBy; }
}
