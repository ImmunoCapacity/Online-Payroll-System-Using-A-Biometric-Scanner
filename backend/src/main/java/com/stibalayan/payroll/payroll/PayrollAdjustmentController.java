package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Payroll Processing → Payroll Adjustment (a grid per cut-off).
 *
 * GET /api/payroll/adjustments/grid?from=&to=     one row per employee, with any saved adjustment
 * PUT /api/payroll/adjustments/grid               { applyStart, applyEnd, rows: [{ employeeId, dateFrom, dateTo,
 *                                                   addHours, deductHours, reason }] }  (empty hours = remove)
 * GET /api/payroll/adjustments/period?from=&to=   earnings lines per employee (Payroll Computation)
 */
@RestController
@RequestMapping("/api/payroll/adjustments")
@RequireModule(SystemModule.PAYROLL)
public class PayrollAdjustmentController {

    private final PayrollAdjustmentService adjustments;
    private final AuditService audit;

    public PayrollAdjustmentController(PayrollAdjustmentService adjustments, AuditService audit) {
        this.adjustments = adjustments;
        this.audit = audit;
    }

    @GetMapping("/grid")
    public Map<String, Object> grid(@RequestParam String from, @RequestParam String to) {
        return Map.of("success", true, "grid", adjustments.grid(from, to));
    }

    @PutMapping("/grid")
    public Map<String, Object> save(@RequestBody PayrollAdjustmentService.GridRequest request, HttpServletRequest http) {
        int userId = AuthInterceptor.currentUser(http).id();
        Map<String, Integer> result = adjustments.saveGrid(request, userId);
        audit.log(userId, "Payroll Adjustment", "Saved adjustments", "Cut-off " + request.applyStart() + " to " + request.applyEnd()
                + " · " + result.get("saved") + " employee(s) adjusted, " + result.get("removed") + " removed");
        return Map.of("success", true, "result", result,
                "grid", adjustments.grid(request.applyStart(), request.applyEnd()));
    }

    @GetMapping("/period")
    public Map<String, Object> period(@RequestParam String from, @RequestParam String to) {
        return Map.of("success", true, "adjustments", adjustments.forPeriod(from, to));
    }
}
