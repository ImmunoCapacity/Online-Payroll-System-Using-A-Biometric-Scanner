package com.stibalayan.payroll.payroll;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET  /api/payroll/hours?from=&to=   office (biometric) and approved teaching
 *                                     hours per employee for a pay period
 * POST /api/payroll/payslips/email    "Distribute Payslips": email each
 *                                     employee their payslip for the released pay period
 */
@RestController
@RequestMapping("/api/payroll")
@RequireModule(SystemModule.PAYROLL)
public class PayrollController {

    private final PayslipMailService payslipMail;
    private final PayrollHoursService payrollHours;

    public PayrollController(PayslipMailService payslipMail, PayrollHoursService payrollHours) {
        this.payslipMail = payslipMail;
        this.payrollHours = payrollHours;
    }

    @GetMapping("/hours")
    public Map<String, Object> hours(@RequestParam String from, @RequestParam String to) {
        return Map.of("success", true, "hours", payrollHours.hours(from, to));
    }

    @PostMapping("/payslips/email")
    public Map<String, Object> emailPayslips(@RequestBody PayslipRequest request) {
        List<Map<String, String>> results = payslipMail.send(request);
        long sent = results.stream().filter(r -> "sent".equals(r.get("status"))).count();
        return Map.of("success", true, "sent", sent, "total", results.size(), "results", results);
    }
}
