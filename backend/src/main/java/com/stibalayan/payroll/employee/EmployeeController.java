package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/employees        list faculty + admin staff
 * POST   /api/employees        create
 * PUT    /api/employees/{id}   update ("F3" / "A5")
 * DELETE /api/employees/{id}   delete
 */
@RestController
@RequestMapping("/api/employees")
@RequireModule(SystemModule.EMPLOYEE_RECORD_MANAGEMENT)
public class EmployeeController {

    private final EmployeeService employees;

    public EmployeeController(EmployeeService employees) {
        this.employees = employees;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "employees", employees.listAll());
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody EmployeeRequest request) {
        return Map.of("success", true, "id", employees.create(request));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable String id, @RequestBody EmployeeRequest request) {
        employees.update(id, request);
        return Map.of("success", true);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable String id) {
        employees.delete(id);
        return Map.of("success", true);
    }
}
