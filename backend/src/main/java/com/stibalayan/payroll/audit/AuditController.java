package com.stibalayan.payroll.audit;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.Validation;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/audit?limit=8                  recent activity (System Administrator)
 * GET /api/audit/latest?modules=A,B       the last change of each Maintenance table (Payroll Master)
 */
@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    @RequireModule(SystemModule.UTILITY)
    public Map<String, Object> recent(@RequestParam(defaultValue = "20") int limit) {
        return Map.of("success", true, "entries", audit.recent(null, Math.max(1, Math.min(limit, 200))));
    }

    /** Audit Trail page: search by date range, module, user and text (at most 1000 rows per request). */
    @GetMapping("/search")
    @RequireModule(SystemModule.UTILITY)
    public Map<String, Object> search(@RequestParam String from, @RequestParam String to,
                                      @RequestParam(required = false) String module,
                                      @RequestParam(required = false) Integer userId,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(defaultValue = "500") int limit) {
        LocalDate start = Validation.date(from, "from", "Start date", true);
        LocalDate end = Validation.date(to, "to", "End date", true);
        if (end.isBefore(start)) {
            throw Validation.invalid("to", "The end date can't be before the start date.");
        }
        Map<String, Object> result = new LinkedHashMap<>(audit.search(start, end, module, userId, q, Math.max(1, Math.min(limit, 1000))));
        result.put("success", true);
        return result;
    }

    @GetMapping("/filters")
    @RequireModule(SystemModule.UTILITY)
    public Map<String, Object> filters() {
        Map<String, Object> result = new LinkedHashMap<>(audit.filters());
        result.put("success", true);
        return result;
    }

    /** Dashboard → Recent Activity: the latest payroll, attendance, leave, loan and employee record changes. */
    @GetMapping("/activity")
    @RequireModule(SystemModule.DASHBOARD)
    public Map<String, Object> activity(@RequestParam(defaultValue = "8") int limit) {
        return Map.of("success", true, "entries", audit.activity(Math.max(1, Math.min(limit, 50))));
    }

    @GetMapping("/latest")
    @RequireModule(SystemModule.MAINTENANCE)
    public Map<String, Object> latest(@RequestParam String modules) {
        return Map.of("success", true, "latest", audit.latest(
                Arrays.stream(modules.split(",")).map(String::trim).filter(s -> !s.isEmpty()).limit(20).toList()));
    }
}
