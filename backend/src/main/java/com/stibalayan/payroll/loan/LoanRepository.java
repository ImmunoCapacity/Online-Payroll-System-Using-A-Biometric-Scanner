package com.stibalayan.payroll.loan;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoanRepository extends JpaRepository<Loan, Integer> {

    List<Loan> findAllByOrderByIdDesc();

    boolean existsByReferenceIgnoreCase(String reference);
}
