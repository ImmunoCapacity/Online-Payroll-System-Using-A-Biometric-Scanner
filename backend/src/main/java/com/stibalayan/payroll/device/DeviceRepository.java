package com.stibalayan.payroll.device;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceRepository extends JpaRepository<Device, Integer> {

    Optional<Device> findFirstByIpAddress(String ipAddress);
}
