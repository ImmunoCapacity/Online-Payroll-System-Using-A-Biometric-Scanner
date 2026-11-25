package com.stibalayan.payroll.leave;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeLeaveCreditRepository extends JpaRepository<EmployeeLeaveCredit, Integer> {

    List<EmployeeLeaveCredit> findAllByYear(Integer year);

    Optional<EmployeeLeaveCredit> findByAdminstaffIdAndCategoryIdAndYear(Integer adminstaffId, Integer categoryId, Integer year);
}
