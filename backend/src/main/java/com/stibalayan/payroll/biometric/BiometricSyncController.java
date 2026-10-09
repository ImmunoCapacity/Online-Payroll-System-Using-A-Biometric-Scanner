package com.stibalayan.payroll.biometric;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/biometric/sync — pull attendance from the K40 into the DTR.
 * Part of the Daily Time Record module; called by the "Sync Device" button on dtr.html.
 */
@RestController
@RequestMapping("/api/biometric")
public class BiometricSyncController {

    private final BiometricSyncService syncService;

    public BiometricSyncController(BiometricSyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping("/sync")
    @RequireModule(SystemModule.DAILY_TIME_RECORD)
    public Map<String, Object> sync() {
        return syncService.sync();
    }
}
