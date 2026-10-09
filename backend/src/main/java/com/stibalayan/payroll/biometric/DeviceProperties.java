package com.stibalayan.payroll.biometric;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** device.* in application.properties — the ZKTeco K40's network settings. */
@ConfigurationProperties("device")
public record DeviceProperties(String ip, int port, int commKey, int machineNumber) {
}
