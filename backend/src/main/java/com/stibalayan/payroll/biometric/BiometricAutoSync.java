package com.stibalayan.payroll.biometric;

import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Pulls attendance from the K40 on a schedule, so time-ins appear in the DTR
 * without anyone clicking Sync Device. Same work as the button (re-syncing
 * is safe). Interval: biometric.auto-sync-seconds (default 60; 0 = off).
 *
 * When the device can't be reached (switched off, other network), the
 * problem is logged once — not every minute — and again when it recovers.
 */
@Component
public class BiometricAutoSync {

    private static final Logger log = LoggerFactory.getLogger(BiometricAutoSync.class);

    private final BiometricSyncService syncService;
    private final boolean enabled;
    private String lastProblem;

    public BiometricAutoSync(BiometricSyncService syncService,
                             @Value("${biometric.auto-sync-seconds:60}") long seconds) {
        this.syncService = syncService;
        this.enabled = seconds > 0;
        log.info(enabled ? "Biometric auto-sync every {} seconds." : "Biometric auto-sync is off.", seconds);
    }

    // The scheduler refuses a delay of 0, so "off" (0) still schedules an hourly no-op.
    @Scheduled(initialDelayString = "#{${biometric.auto-sync-seconds:60} > 0 ? ${biometric.auto-sync-seconds:60} : 3600}",
               fixedDelayString = "#{${biometric.auto-sync-seconds:60} > 0 ? ${biometric.auto-sync-seconds:60} : 3600}",
               timeUnit = TimeUnit.SECONDS)
    public void run() {
        if (!enabled) {
            return;
        }
        try {
            Map<String, Object> result = syncService.sync();
            if (lastProblem != null) {
                log.info("Biometric auto-sync is working again.");
                lastProblem = null;
            }
            Object inserted = result.get("inserted");
            Object updated = result.get("updated_time_out");
            if (!"0".equals(String.valueOf(inserted)) || !"0".equals(String.valueOf(updated))) {
                log.info("Biometric auto-sync: {} new time-in(s), {} time-out(s) updated.", inserted, updated);
            }
        } catch (RuntimeException e) {
            String problem = e.getMessage();
            if (problem == null || !problem.equals(lastProblem)) {
                log.warn("Biometric auto-sync failed (will keep retrying): {}", problem);
            }
            lastProblem = problem == null ? "" : problem;
        }
    }
}
