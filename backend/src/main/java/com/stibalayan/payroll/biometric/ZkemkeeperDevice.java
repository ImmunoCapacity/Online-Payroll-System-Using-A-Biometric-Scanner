package com.stibalayan.payroll.biometric;

import com.jacob.activeX.ActiveXComponent;
import com.jacob.com.ComFailException;
import com.jacob.com.ComThread;
import com.jacob.com.Dispatch;
import com.jacob.com.Variant;
import com.stibalayan.payroll.common.ApiException;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Talks to the ZKTeco K40 through the ZKTeco Standalone SDK's COM object
 * (zkemkeeper.ZKEM) using JACOB, as described in the paper's Technical
 * Background.
 *
 * Requirements on the machine running the backend (Windows only):
 *   1. ZKTeco Standalone SDK installed, zkemkeeper.dll registered (regsvr32).
 *   2. jacob-1.21-x64.dll (or -x86) in backend/lib/, matching the JVM and SDK bitness.
 *
 * Uses the SSR_* log functions, which K40 firmware supports. Older
 * black-and-white firmware may need GetGeneralLogData instead.
 */
@Component
public class ZkemkeeperDevice implements BiometricDevice {

    private static final String PROG_ID = "zkemkeeper.ZKEM.1";

    // ZKTeco SDK GetLastError code meaning "no data", i.e. the log is empty.
    private static final int ERR_NO_DATA = 0;

    @Override
    public List<AttendanceLog> readAttendanceLogs(DeviceProperties device) {
        try {
            ComThread.InitSTA();
        } catch (UnsatisfiedLinkError | NoClassDefFoundError e) {
            throw unavailable("JACOB is not set up on the server (jacob DLL not found in backend/lib). See backend/README.md.");
        }

        try {
            ActiveXComponent zk;
            try {
                zk = new ActiveXComponent(PROG_ID);
            } catch (ComFailException e) {
                throw unavailable("The ZKTeco SDK (zkemkeeper.dll) is not installed or registered on the server. See backend/README.md.");
            }

            if (device.commKey() != 0) {
                Dispatch.call(zk, "SetCommPassword", device.commKey());
            }

            boolean connected = Dispatch.call(zk, "Connect_Net", device.ip(), device.port()).getBoolean();
            if (!connected) {
                throw unavailable("Could not reach the biometric device at " + device.ip() + ":" + device.port()
                        + ". Check that it is powered on, on the same network, and that device.ip and"
                        + " device.comm-key in application.properties are correct.");
            }

            try {
                // Lock the keypad/scanner while reading so the log doesn't change underneath us.
                Dispatch.call(zk, "EnableDevice", device.machineNumber(), false);
                return readLogs(zk, device.machineNumber());
            } finally {
                Dispatch.call(zk, "EnableDevice", device.machineNumber(), true);
                Dispatch.call(zk, "Disconnect");
            }
        } catch (ComFailException e) {
            throw unavailable("The biometric device reported an error: " + e.getMessage());
        } finally {
            ComThread.Release();
        }
    }

    private static List<AttendanceLog> readLogs(ActiveXComponent zk, int machineNumber) {
        if (!Dispatch.call(zk, "ReadGeneralLogData", machineNumber).getBoolean()) {
            Variant errorCode = new Variant(0, true);
            Dispatch.call(zk, "GetLastError", errorCode);
            if (errorCode.getIntRef() == ERR_NO_DATA) {
                return List.of();
            }
            throw unavailable("Connected to the device, but reading the attendance log failed (error code "
                    + errorCode.getIntRef() + ").");
        }

        // Output parameters are passed by reference and filled in on each call.
        Variant enrollNumber = new Variant("", true);
        Variant verifyMode = new Variant(0, true);
        Variant inOutMode = new Variant(0, true);
        Variant year = new Variant(0, true);
        Variant month = new Variant(0, true);
        Variant day = new Variant(0, true);
        Variant hour = new Variant(0, true);
        Variant minute = new Variant(0, true);
        Variant second = new Variant(0, true);
        Variant workCode = new Variant(0, true);

        List<AttendanceLog> logs = new ArrayList<>();
        while (Dispatch.callN(zk, "SSR_GetGeneralLogData", new Object[] {
                machineNumber, enrollNumber, verifyMode, inOutMode,
                year, month, day, hour, minute, second, workCode}).getBoolean()) {
            try {
                logs.add(new AttendanceLog(
                        enrollNumber.getStringRef().trim(),
                        LocalDateTime.of(year.getIntRef(), month.getIntRef(), day.getIntRef(),
                                hour.getIntRef(), minute.getIntRef(), second.getIntRef())));
            } catch (DateTimeException e) {
                logs.add(new AttendanceLog(enrollNumber.getStringRef().trim(), null)); // counted as invalid
            }
        }
        return logs;
    }

    private static ApiException unavailable(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, message);
    }
}
