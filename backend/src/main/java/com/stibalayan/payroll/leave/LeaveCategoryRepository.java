package com.stibalayan.payroll.leave;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveCategoryRepository extends JpaRepository<LeaveCategory, Integer> {

    List<LeaveCategory> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Integer id);
}
