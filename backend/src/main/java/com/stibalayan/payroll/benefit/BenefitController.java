package com.stibalayan.payroll.benefit;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Benefits Table (Payroll Master).
 *
 * GET  /api/benefits                   benefits with the employees who receive them
 * POST /api/benefits                   { name, defaultAmount, active }
 * PUT  /api/benefits/{id}              { name, defaultAmount, active }
 * PUT  /api/benefits/{id}/employees    { employees: [ { employeeId, amount } ] }  replaces the list
 * PUT  /api/benefits/{id}/employees/{employeeId}   { amount }  give one employee the benefit
 * DELETE /api/benefits/{id}/employees/{employeeId}            take it away
 *
 * Payroll reads each employee's benefits through /api/payroll/benefits.
 */
@RestController
@RequestMapping("/api/benefits")
@RequireModule(SystemModule.MAINTENANCE)
public class BenefitController {

    private final BenefitService benefits;

    public BenefitController(BenefitService benefits) {
        this.benefits = benefits;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "benefits", benefits.list());
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody BenefitService.BenefitRequest request) {
        return Map.of("success", true, "benefit", benefits.save(null, request));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody BenefitService.BenefitRequest request) {
        return Map.of("success", true, "benefit", benefits.save(id, request));
    }

    public record AssignRequest(List<BenefitService.Assignment> employees) {
    }

    @PutMapping("/{id}/employees")
    public Map<String, Object> assign(@PathVariable int id, @RequestBody AssignRequest request) {
        return Map.of("success", true, "benefit", benefits.assign(id, request.employees()));
    }

    public record AmountRequest(BigDecimal amount) {
    }

    /** Gives one employee this benefit (or changes their amount). */
    @PutMapping("/{id}/employees/{employeeId}")
    public Map<String, Object> assignOne(@PathVariable int id, @PathVariable String employeeId, @RequestBody AmountRequest request) {
        return Map.of("success", true, "benefit", benefits.assignOne(id, employeeId, request.amount()));
    }

    @DeleteMapping("/{id}/employees/{employeeId}")
    public Map<String, Object> unassignOne(@PathVariable int id, @PathVariable String employeeId) {
        benefits.unassignOne(id, employeeId);
        return Map.of("success", true);
    }
}
