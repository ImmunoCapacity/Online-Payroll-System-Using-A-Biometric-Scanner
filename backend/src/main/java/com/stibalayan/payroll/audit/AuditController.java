package com.stibalayan.payroll.audit;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.util.Arrays;
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

    @GetMapping("/latest")
    @RequireModule(SystemModule.MAINTENANCE)
    public Map<String, Object> latest(@RequestParam String modules) {
        return Map.of("success", true, "latest", audit.latest(
                Arrays.stream(modules.split(",")).map(String::trim).filter(s -> !s.isEmpty()).limit(20).toList()));
    }
}
