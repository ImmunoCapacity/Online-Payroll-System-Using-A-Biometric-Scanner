package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.rate.RateService;
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
 * GET    /api/employees        list faculty + admin staff
 * POST   /api/employees        create
 * GET    /api/employees/next-id  the ID the next new employee gets (STIBLN-####, before M/F)
 * PUT    /api/employees/{id}   update ("F3" / "A5"); status: "Archived" archives (never
 *                               deleted, just hidden), any other status un-archives
 * GET    /api/employees?archived=true    include archived employees
 *
 * A new or changed rate is also written to the rate history (Employee Rates).
 */
@RestController
@RequestMapping("/api/employees")
@RequireModule(SystemModule.EMPLOYEE_RECORD_MANAGEMENT)
public class EmployeeController {

    private final EmployeeService employees;
    private final RateService rates;
    private final AuditService audit;

    public EmployeeController(EmployeeService employees, RateService rates, AuditService audit) {
        this.employees = employees;
        this.rates = rates;
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> list(@RequestParam(defaultValue = "false") boolean archived) {
        return Map.of("success", true, "employees", employees.listAll(archived));
    }

    @GetMapping("/next-id")
    public Map<String, Object> nextId() {
        return Map.of("success", true, "nextId", employees.previewNextId());
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody EmployeeRequest request, HttpServletRequest http) {
        String id = employees.create(request);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Records", "Added employee",
                request.firstName() + " " + request.lastName() + " · " + employees.employeeNumberOf(id));
        rates.syncEmployee(id, AuthInterceptor.currentUser(http).id());
        return Map.of("success", true, "id", id, "employeeNumber", employees.employeeNumberOf(id));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @RequestBody EmployeeRequest request, HttpServletRequest http) {
        employees.update(id, request);
        audit.log(AuthInterceptor.currentUser(http).id(), "Employee Records", "Updated employee",
                request.firstName() + " " + request.lastName() + " · " + employees.employeeNumberOf(id));
        rates.syncEmployee(id, AuthInterceptor.currentUser(http).id());
        return Map.of("success", true);
    }
}
