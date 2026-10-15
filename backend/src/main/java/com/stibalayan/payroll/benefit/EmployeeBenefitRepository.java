package com.stibalayan.payroll.benefit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeBenefitRepository extends JpaRepository<EmployeeBenefit, Integer> {

    List<EmployeeBenefit> findByBenefitId(Integer benefitId);

    void deleteByBenefitId(Integer benefitId);
}
