package com.stibalayan.payroll.teaching;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Faculty Teaching Hours module (manual classroom checks).
 *
 * GET  /api/teaching-hours/classes?from=&to=[&employeeId=][&status=]
 * GET  /api/teaching-hours/classes/{classId}/audit
 * POST /api/teaching-hours/classes/{classId}/checks    { check, time, status, remarks, reason }
 * POST /api/teaching-hours/classes/{classId}/approve   { note }   — Payroll Master
 * POST /api/teaching-hours/classes/{classId}/reject    { note }   — Payroll Master
 */
@RestController
@RequestMapping("/api/teaching-hours")
public class TeachingHoursController {

    private final TeachingHoursService teaching;

    public TeachingHoursController(TeachingHoursService teaching) {
        this.teaching = teaching;
    }

    @GetMapping("/classes")
    @RequireModule(SystemModule.FACULTY_TEACHING_HOURS)
    public Map<String, Object> list(@RequestParam String from, @RequestParam String to,
                                    @RequestParam(required = false) String employeeId,
                                    @RequestParam(required = false) String status) {
        return Map.of("success", true, "classes", teaching.list(from, to, employeeId, status));
    }

    @GetMapping("/classes/{classId}/audit")
    @RequireModule(SystemModule.FACULTY_TEACHING_HOURS)
    public Map<String, Object> audit(@PathVariable int classId) {
        return Map.of("success", true, "audit", teaching.auditHistory(classId));
    }

    @PostMapping("/classes/{classId}/checks")
    @RequireModule(SystemModule.FACULTY_TEACHING_HOURS)
    public Map<String, Object> check(@PathVariable int classId, @RequestBody CheckRequest request, HttpServletRequest http) {
        return Map.of("success", true, "class", teaching.recordCheck(classId, request, userId(http)));
    }

    @PostMapping("/classes/{classId}/approve")
    @RequireModule(SystemModule.FACULTY_TEACHING_APPROVAL)
    public Map<String, Object> approve(@PathVariable int classId, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "class", teaching.approve(classId, body.get("note"), userId(http)));
    }

    @PostMapping("/classes/{classId}/reject")
    @RequireModule(SystemModule.FACULTY_TEACHING_APPROVAL)
    public Map<String, Object> reject(@PathVariable int classId, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "class", teaching.reject(classId, body.get("note"), userId(http)));
    }

    private static int userId(HttpServletRequest http) {
        return AuthInterceptor.currentUser(http).id();
    }
}
