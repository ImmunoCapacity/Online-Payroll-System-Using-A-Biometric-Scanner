package com.stibalayan.payroll.biometric;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/biometric/sync — pull attendance from the K40 into the DTR.
 * Device Sync (Payroll Master, Attendance Monitoring Staff, System Administrator); called
 * by the "Sync Device" button on dtr.html and biometric-devices.html.
 *
 * GET /api/biometric/status — live sync state; dtr.html and biometric-devices.html poll it; dtr.html reloads
 * the table when "changes" goes up.
 */
@RestController
@RequestMapping("/api/biometric")
public class BiometricSyncController {

    private final BiometricLiveSync liveSync;
    private final BiometricSyncService syncService;

    public BiometricSyncController(BiometricLiveSync liveSync, BiometricSyncService syncService) {
        this.liveSync = liveSync;
        this.syncService = syncService;
    }

    @PostMapping("/sync")
    @RequireModule(SystemModule.DEVICE_SYNC)
    public Map<String, Object> sync() {
        return liveSync.syncNow();
    }

    @GetMapping("/status")
    @RequireModule(SystemModule.SCANNER_STATUS)
    public Map<String, Object> status() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("live", liveSync.isEnabled());
        status.put("connected", liveSync.isConnected());
        status.put("changes", syncService.changeCount());
        status.put("lastSyncAt", syncService.lastSyncAt() == null ? null : syncService.lastSyncAt().toString());
        return status;
    }
}
