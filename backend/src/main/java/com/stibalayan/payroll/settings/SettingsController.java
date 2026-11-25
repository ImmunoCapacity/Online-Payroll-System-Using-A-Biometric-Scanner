package com.stibalayan.payroll.settings;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.biometric.BiometricLiveSync;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Maintenance → Grace Period and Payroll Periods.
 *
 * GET    /api/settings                    grace period, payroll period rules (every signed-in user: pages need the cut-offs)
 * PUT    /api/settings/grace              { officeStart, officeGraceMinutes, classGraceMinutes }
 * POST   /api/settings/period-rules       { effectiveDate, firstDay, secondDay }  change the cut-offs from a date
 * DELETE /api/settings/period-rules/{id}  remove a change that has not taken effect
 * GET    /api/settings/device             the K40's connection settings           — System Administrator
 * PUT    /api/settings/device             { ip, port, commKey, machineNumber }     — System Administrator
 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settings;
    private final BiometricLiveSync liveSync;

    public SettingsController(SettingsService settings, BiometricLiveSync liveSync) {
        this.settings = settings;
        this.liveSync = liveSync;
    }

    @GetMapping
    @RequireModule(SystemModule.SETTINGS_READ)
    public Map<String, Object> all() {
        Map<String, Object> m = new java.util.LinkedHashMap<>(settings.all());
        m.put("success", true);
        return m;
    }

    @PutMapping("/grace")
    @RequireModule(SystemModule.MAINTENANCE)
    public Map<String, Object> grace(@RequestBody SettingsService.GraceRequest request, HttpServletRequest http) {
        return Map.of("success", true, "grace", settings.saveGrace(request, AuthInterceptor.currentUser(http).id()));
    }

    @PostMapping("/period-rules")
    @RequireModule(SystemModule.MAINTENANCE)
    public Map<String, Object> addRule(@RequestBody SettingsService.RuleRequest request, HttpServletRequest http) {
        return Map.of("success", true, "periodRules", settings.addRule(request, AuthInterceptor.currentUser(http).id()));
    }

    @DeleteMapping("/period-rules/{id}")
    @RequireModule(SystemModule.MAINTENANCE)
    public Map<String, Object> removeRule(@PathVariable int id, HttpServletRequest http) {
        return Map.of("success", true, "periodRules", settings.removeRule(id, AuthInterceptor.currentUser(http).id()));
    }

    @GetMapping("/device")
    @RequireModule(SystemModule.UTILITY)
    public Map<String, Object> device() {
        return Map.of("success", true, "device", settings.deviceView());
    }

    @PutMapping("/device")
    @RequireModule(SystemModule.UTILITY)
    public Map<String, Object> saveDevice(@RequestBody SettingsService.DeviceRequest request, HttpServletRequest http) {
        Map<String, Object> device = settings.saveDevice(request, AuthInterceptor.currentUser(http).id());
        liveSync.reconnect();
        return Map.of("success", true, "device", device);
    }
}
