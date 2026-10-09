package com.stibalayan.payroll.fingerprint;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/fingerprints        employees with their device User IDs, plus the next free one
 * PUT    /api/fingerprints/{id}   assign a device User ID — body { "fingerprintId": "12" }
 * DELETE /api/fingerprints/{id}   remove the registration
 */
@RestController
@RequestMapping("/api/fingerprints")
@RequireModule(SystemModule.FINGERPRINT_REGISTRATION)
public class FingerprintController {

    private final FingerprintService fingerprints;

    public FingerprintController(FingerprintService fingerprints) {
        this.fingerprints = fingerprints;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of(
                "success", true,
                "employees", fingerprints.listAll(),
                "nextDeviceUserId", fingerprints.nextFreeDeviceUserId());
    }

    @PutMapping("/{id}")
    public Map<String, Object> assign(@PathVariable String id, @RequestBody Map<String, String> body) {
        return Map.of("success", true, "employee", fingerprints.assign(id, body.get("fingerprintId")));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> remove(@PathVariable String id) {
        fingerprints.remove(id);
        return Map.of("success", true);
    }
}
