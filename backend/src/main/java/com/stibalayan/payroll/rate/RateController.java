package com.stibalayan.payroll.rate;

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
 * Employee Rates in Maintenance (Payroll Master).
 *
 * GET  /api/rates    { rates: history, employees: [ { id, name, kinds } ] }
 * POST /api/rates    { employeeId, kind: Office|Teaching, amount, effectiveDate }
 *
 * Payroll reads the rates in effect for a period through GET /api/payroll/rates?date=.
 */
@RestController
@RequestMapping("/api/rates")
@RequireModule(SystemModule.MAINTENANCE)
public class RateController {

    private final RateService rates;

    public RateController(RateService rates) {
        this.rates = rates;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "rates", rates.history(), "employees", rates.employeeOptions());
    }

    @PostMapping
    public Map<String, Object> add(@RequestBody RateService.RateRequest request, HttpServletRequest http) {
        rates.add(request, AuthInterceptor.currentUser(http).id());
        return Map.of("success", true, "rates", rates.history());
    }
}
