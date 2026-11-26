package com.stibalayan.payroll.leave;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveConversionRepository extends JpaRepository<LeaveConversion, Integer> {

    Optional<LeaveConversion> findByAdminstaffIdAndCategoryIdAndCoveredYear(Integer adminstaffId, Integer categoryId, Integer coveredYear);
}
