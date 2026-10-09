package com.stibalayan.payroll.schedule;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
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
 * Faculty Schedule module (planned classes).
 *
 * GET  /api/faculty-schedule/teachers               teaching employees
 * GET  /api/faculty-schedule/classes?from=&to=[&employeeId=]
 * GET  /api/faculty-schedule/classes/{id}/history   change history
 * POST /api/faculty-schedule/classes                add (optionally weekly)   — Payroll Master
 * PUT  /api/faculty-schedule/classes/{id}           edit                      — Payroll Master
 * POST /api/faculty-schedule/classes/{id}/cancel    { reason }                — Payroll Master
 * POST /api/faculty-schedule/classes/{id}/restore                             — Payroll Master
 */
@RestController
@RequestMapping("/api/faculty-schedule")
public class FacultyScheduleController {

    private final FacultyScheduleService schedule;

    public FacultyScheduleController(FacultyScheduleService schedule) {
        this.schedule = schedule;
    }

    @GetMapping("/teachers")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> teachers() {
        return Map.of("success", true, "teachers", schedule.teacherChoices());
    }

    @GetMapping("/classes")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> list(@RequestParam String from, @RequestParam String to,
                                    @RequestParam(required = false) String employeeId) {
        return Map.of("success", true, "classes", schedule.list(from, to, employeeId));
    }

    @GetMapping("/classes/{id}/history")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> history(@PathVariable int id) {
        return Map.of("success", true, "history", schedule.history(id));
    }

    @PostMapping("/classes")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> create(@RequestBody ClassRequest request, HttpServletRequest http) {
        Map<String, Object> result = new HashMap<>(schedule.create(request, userId(http)));
        result.put("success", true);
        return result;
    }

    @PutMapping("/classes/{id}")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> update(@PathVariable int id, @RequestBody ClassRequest request, HttpServletRequest http) {
        return Map.of("success", true, "class", schedule.update(id, request, userId(http)));
    }

    @PostMapping("/classes/{id}/cancel")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> cancel(@PathVariable int id, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "class", schedule.cancel(id, body.get("reason"), userId(http)));
    }

    @PostMapping("/classes/{id}/restore")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> restore(@PathVariable int id, HttpServletRequest http) {
        return Map.of("success", true, "class", schedule.restore(id, userId(http)));
    }

    private static int userId(HttpServletRequest http) {
        return AuthInterceptor.currentUser(http).id();
    }
}
