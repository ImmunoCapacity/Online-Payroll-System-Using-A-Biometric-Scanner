package com.stibalayan.payroll.dtr;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET  /api/dtr?date=YYYY-MM-DD   attendance for a day (Daily Time Record)
 * GET  /api/dtr/hours?from=&to=   hours worked per employee in a pay period (Payroll)
 * GET  /api/dtr/employees         employees that can be picked for a manual entry
 * POST /api/dtr/manual            save a manual entry (Attendance Recording)
 */
@RestController
@RequestMapping("/api/dtr")
public class DtrController {

    private final DtrService dtrService;

    public DtrController(DtrService dtrService) {
        this.dtrService = dtrService;
    }

    @GetMapping
    @RequireModule(SystemModule.DAILY_TIME_RECORD)
    public Map<String, Object> forDate(@RequestParam(required = false) String date) {
        String day = date == null || date.isBlank() ? LocalDate.now().toString() : date;
        return Map.of("success", true, "date", day, "records", dtrService.forDate(day));
    }

    /** Hours worked per employee between two dates — used to compute payroll. */
    @GetMapping("/hours")
    @RequireModule(SystemModule.PAYROLL)
    public Map<String, Object> hoursWorked(@RequestParam String from, @RequestParam String to) {
        return Map.of("success", true, "hours", dtrService.hoursWorked(from, to));
    }

    @GetMapping("/employees")
    @RequireModule(SystemModule.ATTENDANCE_RECORDING)
    public Map<String, Object> employees() {
        return Map.of("success", true, "employees", dtrService.employees());
    }

    @PostMapping("/manual")
    @RequireModule(SystemModule.ATTENDANCE_RECORDING)
    public Map<String, Object> manualEntry(@RequestBody ManualEntryRequest request, HttpServletRequest http) {
        int userId = AuthInterceptor.currentUser(http).id();
        return Map.of("success", true, "record", dtrService.saveManualEntry(request, userId));
    }
}
