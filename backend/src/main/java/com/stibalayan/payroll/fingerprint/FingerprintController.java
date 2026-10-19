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
 *                                 (a new registration also emails the employee a Data Privacy notice;
 *                                 the reply's "notice" says whether it was sent)
 * DELETE /api/fingerprints/{id}   remove the registration
 */
@RestController
@RequestMapping("/api/fingerprints")
@RequireModule(SystemModule.FINGERPRINT_REGISTRATION)
public class FingerprintController {

    private final FingerprintService fingerprints;
    private final FingerprintNoticeService notices;

    public FingerprintController(FingerprintService fingerprints, FingerprintNoticeService notices) {
        this.fingerprints = fingerprints;
        this.notices = notices;
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
        boolean newRegistration = !fingerprints.isRegistered(id);
        FingerprintEmployee employee = fingerprints.assign(id, body.get("fingerprintId"));
        // Sent after the registration is saved; a mail problem never undoes it.
        if (newRegistration) {
            return Map.of("success", true, "employee", employee, "notice", notices.sendRegistered(id));
        }
        return Map.of("success", true, "employee", employee);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> remove(@PathVariable String id) {
        fingerprints.remove(id);
        return Map.of("success", true);
    }
}
