package com.stibalayan.payroll.employee;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacultyStaffRepository extends JpaRepository<FacultyStaff, Integer> {

    List<FacultyStaff> findAllByOrderByFirstnameAsc();

    List<FacultyStaff> findByFingerprintIdIsNotNull();

    boolean existsByFingerprintId(String fingerprintId);

    boolean existsByFingerprintIdAndIdNot(String fingerprintId, Integer id);

    boolean existsByEmployeeNumber(String employeeNumber);

    boolean existsByEmployeeNumberAndIdNot(String employeeNumber, Integer id);

    boolean existsByEmailAddressIgnoreCase(String emailAddress);

    boolean existsByEmailAddressIgnoreCaseAndIdNot(String emailAddress, Integer id);
}
