package com.stibalayan.payroll.benefit;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.StaffMember;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Benefits Table (Benefit Maintenance, paper 9.3): allowances such as rice
 * or transportation, each given to chosen employees with an amount paid
 * every payroll period. Payroll adds the active benefits of each employee.
 */
@Service
public class BenefitService {

    private static final BigDecimal MAX_AMOUNT = new BigDecimal("100000.00");

    private final BenefitRepository benefits;
    private final EmployeeBenefitRepository assigned;
    private final EmployeeDirectory employees;

    public BenefitService(BenefitRepository benefits, EmployeeBenefitRepository assigned, EmployeeDirectory employees) {
        this.benefits = benefits;
        this.assigned = assigned;
        this.employees = employees;
    }

    public record BenefitRequest(String name, BigDecimal defaultAmount, Boolean active) {
    }

    public record Assignment(String employeeId, BigDecimal amount) {
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        Map<String, StaffMember> people = employees.all();
        List<Map<String, Object>> result = new ArrayList<>();
        benefits.findAllByOrderByNameAsc().forEach(b -> result.add(view(b, people)));
        return result;
    }

    @Transactional
    public Map<String, Object> save(Integer id, BenefitRequest r) {
        Benefit b = id == null ? new Benefit()
                : benefits.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Benefit not found."));
        String name = Validation.requiredText(r.name(), "name", "Benefit name", 50);
        boolean taken = id == null ? benefits.existsByNameIgnoreCase(name) : benefits.existsByNameIgnoreCaseAndIdNot(name, id);
        if (taken) {
            throw Validation.invalid("name", "A benefit with this name already exists.");
        }
        BigDecimal amount = Validation.money(r.defaultAmount(), "defaultAmount", "Default amount", MAX_AMOUNT);
        if (amount == null) {
            throw Validation.invalid("defaultAmount", "Default amount is required.");
        }
        b.setName(name);
        b.setDefaultAmount(amount.setScale(2, RoundingMode.HALF_UP));
        b.setActive(r.active() == null || r.active());
        return view(benefits.saveAndFlush(b), employees.all());
    }

    /** Replaces the list of employees who receive this benefit. */
    @Transactional
    public Map<String, Object> assign(int id, List<Assignment> list) {
        Benefit b = benefits.findById(id).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Benefit not found."));
        List<EmployeeBenefit> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Assignment a : list == null ? List.<Assignment>of() : list) {
            employees.require(a.employeeId());
            if (!seen.add(a.employeeId())) {
                throw Validation.invalid("employeeId", "An employee is listed twice.");
            }
            BigDecimal amount = Validation.money(a.amount(), "amount", "Amount", MAX_AMOUNT);
            if (amount == null || amount.signum() <= 0) {
                throw Validation.invalid("amount", "Each employee's amount must be more than zero.");
            }
            EmployeeBenefit row = new EmployeeBenefit();
            row.setBenefitId(b.getId());
            EmployeeId eid = EmployeeId.parse(a.employeeId());
            if (eid.isFaculty()) {
                row.setFacultyId(eid.number());
            } else {
                row.setAdminstaffId(eid.number());
            }
            row.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
            rows.add(row);
        }
        assigned.deleteByBenefitId(b.getId());
        assigned.flush();
        assigned.saveAll(rows);
        assigned.flush();
        return view(b, employees.all());
    }

    /** Gives one employee a benefit, or changes their amount if they already have it. */
    @Transactional
    public Map<String, Object> assignOne(int benefitId, String employeeId, BigDecimal amountValue) {
        Benefit b = benefits.findById(benefitId).orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Benefit not found."));
        employees.require(employeeId);
        BigDecimal amount = Validation.money(amountValue, "amount", "Amount", MAX_AMOUNT);
        if (amount == null || amount.signum() <= 0) {
            throw Validation.invalid("amount", "The amount must be more than zero.");
        }
        EmployeeBenefit row = findAssignment(b.getId(), employeeId).orElseGet(() -> {
            EmployeeBenefit fresh = new EmployeeBenefit();
            fresh.setBenefitId(b.getId());
            EmployeeId eid = EmployeeId.parse(employeeId);
            if (eid.isFaculty()) fresh.setFacultyId(eid.number()); else fresh.setAdminstaffId(eid.number());
            return fresh;
        });
        row.setAmount(amount.setScale(2, RoundingMode.HALF_UP));
        assigned.saveAndFlush(row);
        return view(b, employees.all());
    }

    @Transactional
    public void unassignOne(int benefitId, String employeeId) {
        employees.require(employeeId);
        EmployeeBenefit row = findAssignment(benefitId, employeeId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "This employee doesn't have that benefit."));
        assigned.delete(row);
    }

    private java.util.Optional<EmployeeBenefit> findAssignment(int benefitId, String employeeId) {
        EmployeeId eid = EmployeeId.parse(employeeId);
        return assigned.findByBenefitId(benefitId).stream()
                .filter(r -> eid.isFaculty() ? Integer.valueOf(eid.number()).equals(r.getFacultyId())
                        : Integer.valueOf(eid.number()).equals(r.getAdminstaffId()))
                .findFirst();
    }

    /** For payroll: each employee's active benefits for one pay period. */
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> perEmployee() {
        Map<Integer, Benefit> active = new HashMap<>();
        benefits.findAll().stream().filter(Benefit::isActive).forEach(b -> active.put(b.getId(), b));
        Map<String, List<Map<String, Object>>> result = new HashMap<>();
        for (EmployeeBenefit row : assigned.findAll()) {
            Benefit b = active.get(row.getBenefitId());
            if (b == null) continue;
            Map<String, Object> m = new HashMap<>();
            m.put("name", b.getName());
            m.put("amount", row.getAmount());
            result.computeIfAbsent(EmployeeDirectory.idOf(row.getFacultyId(), row.getAdminstaffId()), k -> new ArrayList<>()).add(m);
        }
        result.values().forEach(l -> l.sort((x, y) -> String.valueOf(x.get("name")).compareTo(String.valueOf(y.get("name")))));
        return result;
    }

    private Map<String, Object> view(Benefit b, Map<String, StaffMember> people) {
        List<Map<String, Object>> who = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (EmployeeBenefit row : assigned.findByBenefitId(b.getId())) {
            String employeeId = EmployeeDirectory.idOf(row.getFacultyId(), row.getAdminstaffId());
            StaffMember s = people.get(employeeId);
            Map<String, Object> m = new HashMap<>();
            m.put("employeeId", employeeId);
            m.put("employeeNumber", s == null ? "" : s.getEmployeeNumber());
            m.put("employeeName", s == null ? "(removed employee)" : s.getFullName());
            m.put("employeeType", s == null ? "" : s.staffType());
            m.put("amount", row.getAmount());
            who.add(m);
            total = total.add(row.getAmount());
        }
        who.sort((x, y) -> String.valueOf(x.get("employeeName")).compareToIgnoreCase(String.valueOf(y.get("employeeName"))));
        Map<String, Object> m = new HashMap<>();
        m.put("id", b.getId());
        m.put("name", b.getName());
        m.put("defaultAmount", b.getDefaultAmount());
        m.put("active", b.isActive());
        m.put("employees", who);
        m.put("totalPerPeriod", total);
        return m;
    }
}
