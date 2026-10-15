package com.stibalayan.payroll.device;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** A registered biometric scanner (paper, Table 6 — Device). */
@Entity
@Table(name = "device")
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "device_id")
    private Integer id;

    @Column(name = "device_name")
    private String deviceName;

    @Column(name = "location")
    private String location;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "status")
    private String status;

    @Column(name = "date_added", insertable = false, updatable = false)
    private LocalDateTime dateAdded;

    public Integer getId() { return id; }
    public String getDeviceName() { return deviceName; }
    public void setDeviceName(String deviceName) { this.deviceName = deviceName; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getDateAdded() { return dateAdded; }
}
