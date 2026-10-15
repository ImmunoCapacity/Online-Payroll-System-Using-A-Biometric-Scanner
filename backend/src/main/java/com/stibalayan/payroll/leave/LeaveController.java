package com.stibalayan.payroll.leave;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SessionUser;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Leave Management and Leave Category Maintenance (Payroll Master).
 *
 * GET  /api/leave/categories                 POST /api/leave/categories        PUT /api/leave/categories/{id}
 * GET  /api/leave/requests                   POST /api/leave/requests          PUT /api/leave/requests/{id}
 * POST /api/leave/requests/{id}/approve | /reject | /cancel   { remarks }
 * GET  /api/leave/balance?employeeId=&year=  PUT /api/leave/credits  { employeeId, year, totalCredits }
 */
@RestController
@RequestMapping("/api/leave")
@RequireModule(SystemModule.MAINTENANCE)
public class LeaveController {

    private final LeaveService leave;
    private final AuditService audit;

    public LeaveController(LeaveService leave, AuditService audit) {
        this.leave = leave;
        this.audit = audit;
    }

    @GetMapping("/categories")
    public Map<String, Object> categories() {
        return Map.of("success", true, "categories", leave.categoryList());
    }

    @PostMapping("/categories")
    public Map<String, Object> addCategory(@RequestBody LeaveService.CategoryRequest request, HttpServletRequest http) {
        Map<String, Object> saved = leave.saveCategory(null, request);
        audit.log(user(http).id(), "Leave Categories", "Added", String.valueOf(saved.get("name")));
        return Map.of("success", true, "category", saved);
    }

    @PutMapping("/categories/{id}")
    public Map<String, Object> updateCategory(@PathVariable int id, @RequestBody LeaveService.CategoryRequest request,
                                              HttpServletRequest http) {
        Map<String, Object> saved = leave.saveCategory(id, request);
        audit.log(user(http).id(), "Leave Categories", Boolean.FALSE.equals(saved.get("active")) ? "Updated (inactive)" : "Updated",
                String.valueOf(saved.get("name")));
        return Map.of("success", true, "category", saved);
    }

    @GetMapping("/requests")
    public Map<String, Object> requests() {
        return Map.of("success", true, "requests", leave.requestList());
    }

    @PostMapping("/requests")
    public Map<String, Object> create(@RequestBody LeaveService.LeaveRequest request, HttpServletRequest http) {
        return Map.of("success", true, "request", leave.create(request, user(http).id()));
    }

    @PutMapping("/requests/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody LeaveService.LeaveRequest request) {
        return Map.of("success", true, "request", leave.update(id, request));
    }

    @PostMapping("/requests/{id}/approve")
    public Map<String, Object> approve(@PathVariable int id, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "request", leave.approve(id, body.get("remarks"), user(http).name()));
    }

    @PostMapping("/requests/{id}/reject")
    public Map<String, Object> reject(@PathVariable int id, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "request", leave.reject(id, body.get("remarks"), user(http).name()));
    }

    @PostMapping("/requests/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable int id, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "request", leave.cancel(id, body.get("remarks"), user(http).name()));
    }

    @GetMapping("/balance")
    public Map<String, Object> balance(@RequestParam String employeeId, @RequestParam int year) {
        return Map.of("success", true, "balance", leave.balance(employeeId, year));
    }

    public record CreditRequest(String employeeId, Integer year, Integer totalCredits) {
    }

    @PutMapping("/credits")
    public Map<String, Object> setCredits(@RequestBody CreditRequest request) {
        return Map.of("success", true, "balance", leave.setCredits(request.employeeId(), request.year(), request.totalCredits()));
    }

    private static SessionUser user(HttpServletRequest http) {
        return AuthInterceptor.currentUser(http);
    }
}
