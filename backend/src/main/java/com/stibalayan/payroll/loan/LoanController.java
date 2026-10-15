package com.stibalayan.payroll.loan;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Loan Management (Deduction Tables → Loans, Payroll Master).
 *
 * GET  /api/loans   loans with their deduction history and balance
 * POST /api/loans   record an approved loan
 *
 * Payroll reads deductions and records payments through /api/payroll.
 */
@RestController
@RequestMapping("/api/loans")
@RequireModule(SystemModule.DEDUCTION_TABLES)
public class LoanController {

    private final LoanService loans;

    public LoanController(LoanService loans) {
        this.loans = loans;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "loans", loans.list());
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody LoanService.LoanRequest request, HttpServletRequest http) {
        return Map.of("success", true, "loan", loans.create(request, AuthInterceptor.currentUser(http).id()));
    }
}
