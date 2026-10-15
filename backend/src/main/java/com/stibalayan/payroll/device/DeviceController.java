package com.stibalayan.payroll.device;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Biometric Devices (System Administrator: device configuration).
 *
 * GET    /api/devices          every registered scanner
 * POST   /api/devices          { deviceName, location, ipAddress, status }
 * PUT    /api/devices/{id}     same body
 * DELETE /api/devices/{id}     attendance already recorded keeps its rows
 * GET    /api/devices/status   the scanners, for the Payroll dashboards
 *
 * Sync Device reads the K40 at device.ip, which must match a row here.
 */
@RestController
@RequestMapping("/api/devices")
@RequireModule(SystemModule.UTILITY)
public class DeviceController {

    private static final Pattern IPV4 = Pattern.compile(
            "^((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$");
    private static final Set<String> STATUSES = Set.of("Active", "Inactive");

    private final DeviceRepository devices;
    private final AuditService audit;

    public DeviceController(DeviceRepository devices, AuditService audit) {
        this.devices = devices;
        this.audit = audit;
    }

    public record DeviceRequest(String deviceName, String location, String ipAddress, String status) {
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "devices", views());
    }

    @GetMapping("/status")
    @RequireModule(SystemModule.DASHBOARD)
    public Map<String, Object> status() {
        return Map.of("success", true, "devices", views());
    }

    @PostMapping
    @Transactional
    public Map<String, Object> create(@RequestBody DeviceRequest request, HttpServletRequest http) {
        Device d = apply(new Device(), request);
        audit.log(AuthInterceptor.currentUser(http).id(), "Biometric Devices", "Added device",
                d.getDeviceName() + " · " + d.getIpAddress());
        return Map.of("success", true, "devices", views());
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> update(@PathVariable int id, @RequestBody DeviceRequest request, HttpServletRequest http) {
        Device d = apply(find(id), request);
        audit.log(AuthInterceptor.currentUser(http).id(), "Biometric Devices", "Updated device",
                d.getDeviceName() + " · " + d.getIpAddress() + " · " + d.getStatus());
        return Map.of("success", true, "devices", views());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest http) {
        Device d = find(id);
        devices.delete(d);
        audit.log(AuthInterceptor.currentUser(http).id(), "Biometric Devices", "Deleted device", d.getDeviceName());
        return Map.of("success", true, "devices", views());
    }

    // ---------------------------------------------------------------

    private Device find(int id) {
        return devices.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Device not found."));
    }

    private Device apply(Device d, DeviceRequest r) {
        String name = Validation.requiredText(r.deviceName(), "deviceName", "Device name", 50);
        String location = Validation.requiredText(r.location(), "location", "Location", 50);
        String ip = Validation.requiredText(r.ipAddress(), "ipAddress", "IP address", 15);
        if (!IPV4.matcher(ip).matches()) {
            throw Validation.invalid("ipAddress", "Enter a valid IPv4 address, e.g. 192.168.1.201.");
        }
        String status = r.status() == null || r.status().isBlank() ? "Active" : r.status().trim();
        if (!STATUSES.contains(status)) {
            throw Validation.invalid("status", "Status must be Active or Inactive.");
        }
        Integer id = d.getId() == null ? -1 : d.getId();
        if (devices.existsByDeviceNameIgnoreCaseAndIdNot(name, id)) {
            throw Validation.invalid("deviceName", "Another device already has this name.");
        }
        if (devices.existsByIpAddressAndIdNot(ip, id)) {
            throw Validation.invalid("ipAddress", "This IP address is already used by another device.");
        }
        d.setDeviceName(name);
        d.setLocation(location);
        d.setIpAddress(ip);
        d.setStatus(status);
        return devices.saveAndFlush(d);
    }

    private List<Map<String, Object>> views() {
        return devices.findAllByOrderByDateAddedDesc().stream().map(d -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", d.getId());
            m.put("deviceName", d.getDeviceName());
            m.put("location", d.getLocation());
            m.put("ipAddress", d.getIpAddress());
            m.put("status", d.getStatus());
            m.put("dateAdded", d.getDateAdded() == null ? null : d.getDateAdded().toString());
            return m;
        }).toList();
    }
}
