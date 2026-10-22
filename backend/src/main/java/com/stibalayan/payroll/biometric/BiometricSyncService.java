package com.stibalayan.payroll.biometric;

import com.stibalayan.payroll.settings.SettingsService;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.device.Device;
import com.stibalayan.payroll.device.DeviceRepository;
import com.stibalayan.payroll.dtr.DailyTimeRecord;
import com.stibalayan.payroll.dtr.DailyTimeRecordRepository;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.FacultyStaffRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Pulls punches from the scanner and turns them into daily_time_record rows.
 *
 * Per employee per day: the earliest punch is time-in, the latest later
 * punch is time-out. Re-syncing the same log is safe — it produces the same
 * rows. Time-in after the standard start plus the grace period is "Late".
 */
@Service
public class BiometricSyncService {

    private final BiometricDevice biometricDevice;
    private final DeviceProperties deviceProperties;
    private final DeviceRepository devices;
    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;
    private final DailyTimeRecordRepository dtr;
    private final TransactionTemplate transaction;
    private final SettingsService settings;
    private final AtomicLong changes = new AtomicLong();

    public BiometricSyncService(BiometricDevice biometricDevice, DeviceProperties deviceProperties,
                                DeviceRepository devices, FacultyStaffRepository faculty, AdminStaffRepository admins,
                                DailyTimeRecordRepository dtr, TransactionTemplate transaction,
                                SettingsService settings) {
        this.biometricDevice = biometricDevice;
        this.deviceProperties = deviceProperties;
        this.devices = devices;
        this.faculty = faculty;
        this.admins = admins;
        this.dtr = dtr;
        this.transaction = transaction;
        this.settings = settings;
    }

    /** Connects to the K40, reads every punch, and records it. Used when live sync is off. */
    public Map<String, Object> sync() {
        // Talk to the device outside the database transaction — it can be slow.
        return record(biometricDevice.readAttendanceLogs(deviceProperties));
    }

    /**
     * Turns punches read from the K40 into DTR rows. Synchronized so two
     * reads never record at once.
     */
    public synchronized Map<String, Object> record(List<AttendanceLog> logs) {
        Device device = devices.findFirstByIpAddress(deviceProperties.ip())
                .orElseThrow(() -> new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "No row in the device table has ip_address = " + deviceProperties.ip()
                                + ". Add this scanner on the Biometric Devices page first."));

        Map<String, Object> result = transaction.execute(status -> record(logs, device.getId()));
        if (!"0".equals(String.valueOf(result.get("inserted")))
                || !"0".equals(String.valueOf(result.get("updated_time_out")))) {
            changes.incrementAndGet();
        }
        return result;
    }

    /** Goes up each time a sync adds or changes DTR rows; the DTR page reloads when it does. */
    public long changeCount() {
        return changes.get();
    }

    private Map<String, Object> record(List<AttendanceLog> logs, Integer deviceId) {
        Map<String, EmployeeRef> employeesByFingerprint = new HashMap<>();
        faculty.findByFingerprintIdIsNotNull().stream()
                .filter(f -> !f.getFingerprintId().isEmpty())
                .forEach(f -> employeesByFingerprint.put(f.getFingerprintId(), new EmployeeRef(true, f.getId())));
        admins.findByFingerprintIdIsNotNull().stream()
                .filter(a -> !a.getFingerprintId().isEmpty())
                .forEach(a -> employeesByFingerprint.put(a.getFingerprintId(), new EmployeeRef(false, a.getId())));

        int inserted = 0;
        int updated = 0;
        int skippedUnmapped = 0;
        int skippedInvalid = 0;

        // Oldest first, so the first punch seen for a day is the real time-in.
        List<AttendanceLog> ordered = logs.stream()
                .filter(log -> log.timestamp() != null && log.enrollNumber() != null && !log.enrollNumber().isEmpty())
                .sorted(Comparator.comparing(AttendanceLog::timestamp))
                .toList();
        skippedInvalid += logs.size() - ordered.size();

        for (AttendanceLog log : ordered) {
            EmployeeRef employee = employeesByFingerprint.get(log.enrollNumber());
            if (employee == null) {
                skippedUnmapped++;
                continue;
            }

            LocalDate date = log.timestamp().toLocalDate();
            LocalTime time = log.timestamp().toLocalTime().withNano(0);

            Optional<DailyTimeRecord> existing = employee.faculty()
                    ? dtr.findFirstByFacultyIdAndRecordDate(employee.id(), date)
                    : dtr.findFirstByAdminstaffIdAndRecordDate(employee.id(), date);

            if (existing.isPresent()) {
                DailyTimeRecord record = existing.get();
                boolean afterTimeIn = record.getTimeIn() != null && time.isAfter(record.getTimeIn());
                boolean laterThanTimeOut = record.getTimeOut() == null || time.isAfter(record.getTimeOut());
                if (afterTimeIn && laterThanTimeOut) {
                    record.setTimeOut(time);
                    updated++;
                }
                continue;
            }

            LocalDateTime graceEnd = date.atTime(settings.lateAfter());

            DailyTimeRecord record = new DailyTimeRecord();
            record.setFingerprintId(log.enrollNumber());
            record.setDeviceId(deviceId);
            record.setFacultyId(employee.faculty() ? employee.id() : null);
            record.setAdminstaffId(employee.faculty() ? null : employee.id());
            record.setRecordDate(date);
            record.setTimeIn(time);
            record.setStatus(log.timestamp().isAfter(graceEnd) ? "Late" : "Present");
            record.setManualEntry(false);
            dtr.save(record);
            inserted++;
        }

        // Keys match what js/system-admin-dashboard.js reads.
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("message", "Sync complete.");
        result.put("total_logs_from_device", logs.size());
        result.put("inserted", inserted);
        result.put("updated_time_out", updated);
        result.put("skipped_no_matching_employee", skippedUnmapped);
        result.put("skipped_invalid", skippedInvalid);
        return result;
    }

    private record EmployeeRef(boolean faculty, Integer id) {
    }
}
