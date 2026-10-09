package com.stibalayan.payroll.schedule;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaffRepository;
import com.stibalayan.payroll.employee.StaffMember;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * The employees who teach: Faculty staff and Faculty/Admin staff. Classes
 * point at them through faculty_id or adminstaff_id; the frontend uses the
 * usual "F3" / "A5" employee ids.
 */
@Component
public class Teachers {

    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;

    public Teachers(FacultyStaffRepository faculty, AdminStaffRepository admins) {
        this.faculty = faculty;
        this.admins = admins;
    }

    /** Every teaching employee by employee id, in name order. */
    public Map<String, StaffMember> all() {
        Map<String, StaffMember> result = new LinkedHashMap<>();
        faculty.findAllByOrderByFirstnameAsc().forEach(f -> result.put(EmployeeId.faculty(f.getId()), f));
        admins.findAllByOrderByFirstnameAsc().stream().filter(AdminStaff::isFaculty)
                .forEach(a -> result.put(EmployeeId.admin(a.getId()), a));
        return result;
    }

    /** The teaching employee with this id; 422 if they don't teach. */
    public StaffMember require(String employeeIdText) {
        if (employeeIdText == null || employeeIdText.isBlank()) {
            throw Validation.invalid("employeeId", "Select a faculty member.");
        }
        EmployeeId id = EmployeeId.parse(employeeIdText);
        if (id.isFaculty()) {
            return faculty.findById(id.number()).orElseThrow(Teachers::notFound);
        }
        AdminStaff admin = admins.findById(id.number()).orElseThrow(Teachers::notFound);
        if (!admin.isFaculty()) {
            throw Validation.invalid("employeeId", "Only Faculty and Faculty/Admin staff have teaching schedules.");
        }
        return admin;
    }

    /** The "F3" / "A5" id of a class's teacher. */
    public static String employeeIdOf(FacultyClass c) {
        return c.getFacultyId() != null ? EmployeeId.faculty(c.getFacultyId()) : EmployeeId.admin(c.getAdminstaffId());
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Employee not found.");
    }
}
