package com.stibalayan.payroll.leave;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveCreditRepository extends JpaRepository<LeaveCredit, Integer> {

    Optional<LeaveCredit> findByFacultyIdAndYear(Integer facultyId, Integer year);

    Optional<LeaveCredit> findByAdminstaffIdAndYear(Integer adminstaffId, Integer year);
}
