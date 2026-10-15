package com.stibalayan.payroll.contribution;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
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
 * Deduction Tables in Maintenance (Payroll Master). {table} is bir,
 * philhealth, pagibig or sss.
 *
 * GET    /api/contribution-tables                   every table, grouped by year
 * POST   /api/contribution-tables/{table}           { year, min, max, base|premium|share|msc, rate }
 * PUT    /api/contribution-tables/{table}/{id}      same body (the year can't change)
 * DELETE /api/contribution-tables/{table}/{id}
 * POST   /api/contribution-tables/{table}/years     { year }  start a year from a copy of the latest one
 *
 * Payroll reads the same tables through GET /api/payroll/contribution-tables.
 */
@RestController
@RequestMapping("/api/contribution-tables")
@RequireModule(SystemModule.DEDUCTION_TABLES)
public class ContributionTableController {

    private final ContributionTableService tables;

    public ContributionTableController(ContributionTableService tables) {
        this.tables = tables;
    }

    @GetMapping
    public Map<String, Object> all() {
        return Map.of("success", true, "tables", tables.all());
    }

    @PostMapping("/{table}")
    public Map<String, Object> create(@PathVariable String table, @RequestBody ContributionTableService.BracketRequest request,
                                      HttpServletRequest http) {
        return Map.of("success", true, "years", tables.save(table, null, request, AuthInterceptor.currentUser(http).id()));
    }

    @PutMapping("/{table}/{id}")
    public Map<String, Object> update(@PathVariable String table, @PathVariable int id,
                                      @RequestBody ContributionTableService.BracketRequest request, HttpServletRequest http) {
        return Map.of("success", true, "years", tables.save(table, id, request, AuthInterceptor.currentUser(http).id()));
    }

    @DeleteMapping("/{table}/{id}")
    public Map<String, Object> delete(@PathVariable String table, @PathVariable int id, HttpServletRequest http) {
        return Map.of("success", true, "years", tables.delete(table, id, AuthInterceptor.currentUser(http).id()));
    }

    public record YearRequest(Integer year) {
    }

    @PostMapping("/{table}/years")
    public Map<String, Object> addYear(@PathVariable String table, @RequestBody YearRequest request, HttpServletRequest http) {
        return Map.of("success", true, "years", tables.copyYear(table, request.year(), AuthInterceptor.currentUser(http).id()));
    }
}
