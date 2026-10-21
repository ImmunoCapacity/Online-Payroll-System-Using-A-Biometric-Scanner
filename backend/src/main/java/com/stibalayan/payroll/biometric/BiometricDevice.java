package com.stibalayan.payroll.biometric;

import java.util.List;

/** Reads attendance punches from a fingerprint scanner. */
public interface BiometricDevice {

    /**
     * Connects, reads every punch, and disconnects.
     *
     * @throws com.stibalayan.payroll.common.ApiException if the device or its
     *         SDK can't be reached
     */
    List<AttendanceLog> readAttendanceLogs(DeviceProperties device);

    /**
     * Opens a connection that stays open until closed (used by
     * BiometricLiveSync). Use it only from the thread that opened it.
     *
     * @throws com.stibalayan.payroll.common.ApiException if the device or its
     *         SDK can't be reached
     */
    Session open(DeviceProperties device);

    /** An open connection to the scanner. Methods throw ApiException when the connection is lost. */
    interface Session extends AutoCloseable {

        /** How many attendance punches the device has stored; changes when someone scans. */
        int recordCount();

        List<AttendanceLog> readAttendanceLogs();

        @Override
        void close();
    }
}
