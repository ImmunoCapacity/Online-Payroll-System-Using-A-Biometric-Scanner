package com.stibalayan.payroll.biometric;

import com.stibalayan.payroll.common.ApiException;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Live sync: keeps one connection open to the K40 and checks its punch count
 * every couple of seconds (biometric.live-poll-millis). When someone scans,
 * the count changes and the new punches are recorded right away, so a
 * time-in shows in the DTR within seconds.
 *
 * One thread owns the device connection. The Sync Device button goes through
 * it as well (syncNow), so the server never opens two connections to the K40.
 * When the device can't be reached, it retries every 10 seconds and logs the
 * problem once, and again when it recovers.
 *
 * biometric.live-sync=false turns this off; Sync Device then connects on its own.
 */
@Component
public class BiometricLiveSync {

    private static final Logger log = LoggerFactory.getLogger(BiometricLiveSync.class);

    private static final long RETRY_MILLIS = 10_000;
    private static final long BUTTON_WAIT_SECONDS = 90;

    private final BiometricDevice biometricDevice;
    private final DeviceProperties deviceProperties;
    private final BiometricSyncService syncService;
    private final boolean enabled;
    private final long pollMillis;

    private final BlockingQueue<CompletableFuture<Map<String, Object>>> requests = new LinkedBlockingQueue<>();
    private Thread worker;
    private volatile boolean connected;

    // Used only on the worker thread.
    private BiometricDevice.Session session;
    private int lastCount = -1;
    private String lastProblem;

    public BiometricLiveSync(BiometricDevice biometricDevice, DeviceProperties deviceProperties,
                             BiometricSyncService syncService,
                             @Value("${biometric.live-sync:true}") boolean enabled,
                             @Value("${biometric.live-poll-millis:2000}") long pollMillis) {
        this.biometricDevice = biometricDevice;
        this.deviceProperties = deviceProperties;
        this.syncService = syncService;
        this.enabled = enabled;
        this.pollMillis = Math.max(500, pollMillis);
    }

    @PostConstruct
    void start() {
        if (!enabled) {
            log.info("Biometric live sync is off; use Sync Device.");
            return;
        }
        worker = new Thread(this::runLoop, "biometric-live-sync");
        worker.setDaemon(true);
        worker.start();
        log.info("Biometric live sync on: checking {}:{} every {} ms.",
                deviceProperties.ip(), deviceProperties.port(), pollMillis);
    }

    @PreDestroy
    void stop() throws InterruptedException {
        if (worker != null) {
            worker.interrupt();
            worker.join(5000);
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** True while the connection to the K40 is open. */
    public boolean isConnected() {
        return connected;
    }

    /** Sync Device: reads every punch now and returns the same result as before. */
    public Map<String, Object> syncNow() {
        if (!enabled) {
            return syncService.sync();
        }
        CompletableFuture<Map<String, Object>> request = new CompletableFuture<>();
        requests.add(request);
        try {
            return request.get(BUTTON_WAIT_SECONDS, TimeUnit.SECONDS);
        } catch (ExecutionException e) {
            if (e.getCause() instanceof RuntimeException runtime) {
                throw runtime;
            }
            throw new IllegalStateException(e.getCause());
        } catch (TimeoutException e) {
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "The biometric device took too long to answer. Try again.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "The server is shutting down.");
        }
    }

    private void runLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            CompletableFuture<Map<String, Object>> request;
            try {
                // Waiting for a button press doubles as the pause between checks.
                request = requests.poll(session != null ? pollMillis : RETRY_MILLIS, TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                break;
            }

            try {
                if (session == null) {
                    session = biometricDevice.open(deviceProperties);
                    connected = true;
                    lastCount = -1; // read everything once after (re)connecting
                    log.info("Biometric live sync connected to {}:{}.", deviceProperties.ip(), deviceProperties.port());
                }
                int count = session.recordCount();
                if (request != null) {
                    request.complete(pull(count));
                } else if (count != lastCount) {
                    pull(count);
                }
                if (lastProblem != null) {
                    log.info("Biometric live sync is working again.");
                    lastProblem = null;
                }
            } catch (RuntimeException e) {
                closeSession();
                String problem = e.getMessage() == null ? e.toString() : e.getMessage();
                if (!problem.equals(lastProblem)) {
                    log.warn("Biometric live sync failed (retrying every {} s): {}", RETRY_MILLIS / 1000, problem);
                }
                lastProblem = problem;
                if (request != null) {
                    request.completeExceptionally(e);
                }
            }
        }
        closeSession();
    }

    private Map<String, Object> pull(int count) {
        List<AttendanceLog> logs = session.readAttendanceLogs();
        Map<String, Object> result = syncService.record(logs);
        lastCount = count;

        Object inserted = result.get("inserted");
        Object updated = result.get("updated_time_out");
        if (!"0".equals(String.valueOf(inserted)) || !"0".equals(String.valueOf(updated))) {
            log.info("Biometric live sync: {} new time-in(s), {} time-out(s) updated.", inserted, updated);
        }
        return result;
    }

    private void closeSession() {
        connected = false;
        if (session != null) {
            try {
                session.close();
            } catch (RuntimeException e) {
                // Connection already gone.
            }
            session = null;
        }
    }
}
