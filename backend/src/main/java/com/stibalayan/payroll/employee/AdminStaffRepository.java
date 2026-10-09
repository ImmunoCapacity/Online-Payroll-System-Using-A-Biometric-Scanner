package com.stibalayan.payroll.employee;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminStaffRepository extends JpaRepository<AdminStaff, Integer> {

    List<AdminStaff> findAllByOrderByFirstnameAsc();

    List<AdminStaff> findByFingerprintIdIsNotNull();

    boolean existsByFingerprintId(String fingerprintId);

    boolean existsByFingerprintIdAndIdNot(String fingerprintId, Integer id);

    boolean existsByEmployeeNumber(String employeeNumber);

    boolean existsByEmployeeNumberAndIdNot(String employeeNumber, Integer id);

    boolean existsByEmailAddressIgnoreCase(String emailAddress);

    boolean existsByEmailAddressIgnoreCaseAndIdNot(String emailAddress, Integer id);
}
