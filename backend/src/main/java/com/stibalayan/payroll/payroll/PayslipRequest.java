package com.stibalayan.payroll.payroll;

import java.math.BigDecimal;
import java.util.List;

/**
 * The payslips of one released pay period, built from the stored payroll
 * (PayrollRunService.payslips) and emailed by POST /api/payroll/runs/{id}/email.
 * preparedBy is the Payroll Master who released the period (signs the payslip).
 */
public record PayslipRequest(String periodLabel, String payDate, String preparedBy, List<Payslip> payslips) {

    /** One employee's payslip. employeeId is "F3" / "A5". */
    public record Payslip(
            String employeeId,
            BigDecimal hours,
            BigDecimal rate,
            BigDecimal gross,
            List<Benefit> benefits,
            Deductions deductions,
            List<Earning> earnings) {
    }

    /**
     * One line of earnings, e.g. office hours at the admin rate and approved
     * teaching hours at the faculty rate. Optional; without it the payslip
     * shows hours × rate.
     */
    public record Earning(String label, BigDecimal hours, BigDecimal rate, BigDecimal amount) {
    }

    public record Benefit(String name, BigDecimal amount) {
    }

    public record Deductions(
            BigDecimal sss,
            BigDecimal philhealth,
            BigDecimal pagibig,
            BigDecimal bir,
            BigDecimal sssLoan,
            BigDecimal pagibigLoan,
            BigDecimal other) {

        public static Deductions none() {
            return new Deductions(null, null, null, null, null, null, null);
        }
    }
}
