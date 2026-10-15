package com.stibalayan.payroll.leave;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeLeaveRepository extends JpaRepository<EmployeeLeave, Integer> {

    List<EmployeeLeave> findAllByOrderByDateFromDescIdDesc();

    List<EmployeeLeave> findByFacultyId(Integer facultyId);

    List<EmployeeLeave> findByAdminstaffId(Integer adminstaffId);

    /** Leave with this status overlapping [from, to]. */
    List<EmployeeLeave> findByStatusAndDateFromLessThanEqualAndDateToGreaterThanEqual(String status, LocalDate to, LocalDate from);
}
