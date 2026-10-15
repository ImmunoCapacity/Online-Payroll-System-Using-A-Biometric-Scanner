package com.stibalayan.payroll.employee;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Looks employees up by the "F3" / "A5" ids the frontend uses, for records
 * that point at either staff table (leave, loans, ...).
 */
@Component
public class EmployeeDirectory {

    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;

    public EmployeeDirectory(FacultyStaffRepository faculty, AdminStaffRepository admins) {
        this.faculty = faculty;
        this.admins = admins;
    }

    /** Every employee by id, faculty first, each in name order. */
    public Map<String, StaffMember> all() {
        Map<String, StaffMember> result = new LinkedHashMap<>();
        faculty.findAllByOrderByFirstnameAsc().forEach(f -> result.put(EmployeeId.faculty(f.getId()), f));
        admins.findAllByOrderByFirstnameAsc().forEach(a -> result.put(EmployeeId.admin(a.getId()), a));
        return result;
    }

    /** The employee with this id; 422 when blank, 404 when unknown. */
    public StaffMember require(String employeeIdText) {
        if (employeeIdText == null || employeeIdText.isBlank()) {
            throw Validation.invalid("employeeId", "Select an employee.");
        }
        EmployeeId id = EmployeeId.parse(employeeIdText);
        return (id.isFaculty() ? faculty.findById(id.number()).map(s -> (StaffMember) s)
                : admins.findById(id.number()).map(s -> (StaffMember) s))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Employee not found."));
    }

    /** The "F3" / "A5" id for a row that has either a faculty_id or an adminstaff_id. */
    public static String idOf(Integer facultyId, Integer adminstaffId) {
        return facultyId != null ? EmployeeId.faculty(facultyId) : EmployeeId.admin(adminstaffId);
    }
}
