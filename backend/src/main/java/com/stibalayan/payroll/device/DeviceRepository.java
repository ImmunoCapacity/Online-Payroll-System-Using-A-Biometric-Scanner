package com.stibalayan.payroll.device;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeviceRepository extends JpaRepository<Device, Integer> {

    Optional<Device> findFirstByIpAddress(String ipAddress);

    List<Device> findAllByOrderByDateAddedDesc();

    boolean existsByDeviceNameIgnoreCaseAndIdNot(String deviceName, Integer id);

    boolean existsByIpAddressAndIdNot(String ipAddress, Integer id);
}
