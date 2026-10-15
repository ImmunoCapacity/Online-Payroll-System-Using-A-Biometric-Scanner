package com.stibalayan.payroll.loan;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoanPaymentRepository extends JpaRepository<LoanPayment, Integer> {

    List<LoanPayment> findByLoanIdOrderByPeriodFromAsc(Integer loanId);

    Optional<LoanPayment> findByLoanIdAndPeriodFrom(Integer loanId, LocalDate periodFrom);
}
