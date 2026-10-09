package com.stibalayan.payroll.biometric;

import java.util.List;

/** Reads attendance punches from a fingerprint scanner. */
public interface BiometricDevice {

    /**
     * @throws com.stibalayan.payroll.common.ApiException if the device or its
     *         SDK can't be reached
     */
    List<AttendanceLog> readAttendanceLogs(DeviceProperties device);
}
