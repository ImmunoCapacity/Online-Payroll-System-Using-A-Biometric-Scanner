package com.stibalayan.payroll.fingerprint;

import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.employee.AdminStaff;
import com.stibalayan.payroll.employee.AdminStaffRepository;
import com.stibalayan.payroll.employee.EmployeeId;
import com.stibalayan.payroll.employee.FacultyStaff;
import com.stibalayan.payroll.employee.FacultyStaffRepository;
import com.stibalayan.payroll.employee.StaffMember;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fingerprint Registration (paper, module 1.0).
 *
 * The fingerprint itself is captured and stored on the ZKTeco K40. What the
 * system keeps is the device "User ID" of each enrolled person, in
 * fingerprint_id. Every punch the device records carries that User ID, which
 * is how a sync matches it back to the employee.
 */
@Service
public class FingerprintService {

    // The K40 accepts numeric User IDs of up to 9 digits.
    private static final String DEVICE_USER_ID = "\\d{1,9}";

    private final FacultyStaffRepository faculty;
    private final AdminStaffRepository admins;

    public FingerprintService(FacultyStaffRepository faculty, AdminStaffRepository admins) {
        this.faculty = faculty;
        this.admins = admins;
    }

    @Transactional(readOnly = true)
    public List<FingerprintEmployee> listAll() {
        List<FingerprintEmployee> result = new ArrayList<>();
        faculty.findAll().forEach(f -> result.add(row(EmployeeId.faculty(f.getId()), f)));
        admins.findAll().forEach(a -> result.add(row(EmployeeId.admin(a.getId()), a)));
        result.sort(Comparator.comparing(FingerprintEmployee::displayName, String.CASE_INSENSITIVE_ORDER));
        return result;
    }

    /** The lowest device User ID not yet assigned to anyone, as a suggestion. */
    @Transactional(readOnly = true)
    public String nextFreeDeviceUserId() {
        List<Long> used = Stream.concat(
                        faculty.findByFingerprintIdIsNotNull().stream().map(StaffMember::getFingerprintId),
                        admins.findByFingerprintIdIsNotNull().stream().map(StaffMember::getFingerprintId))
                .filter(id -> id.matches(DEVICE_USER_ID))
                .map(Long::parseLong)
                .sorted()
                .toList();
        long next = 1;
        for (long id : used) {
            if (id == next) {
                next++;
            } else if (id > next) {
                break;
            }
        }
        return Long.toString(next);
    }

    @Transactional
    public FingerprintEmployee assign(String employeeId, String deviceUserId) {
        String value = deviceUserId == null ? "" : deviceUserId.trim();
        if (!value.matches(DEVICE_USER_ID)) {
            throw unprocessable("The device User ID must be a number of up to 9 digits.");
        }
        // Strip leading zeros so "007" and "7" are recognised as the same device user.
        value = Long.toString(Long.parseLong(value));
        if (value.equals("0")) {
            throw unprocessable("The device User ID must be greater than 0.");
        }

        EmployeeId id = EmployeeId.parse(employeeId);
        boolean taken = id.isFaculty()
                ? faculty.existsByFingerprintIdAndIdNot(value, id.number()) || admins.existsByFingerprintId(value)
                : admins.existsByFingerprintIdAndIdNot(value, id.number()) || faculty.existsByFingerprintId(value);
        if (taken) {
            throw unprocessable("Device User ID " + value + " is already assigned to another employee.");
        }

        if (id.isFaculty()) {
            FacultyStaff f = faculty.findById(id.number()).orElseThrow(FingerprintService::notFound);
            f.setFingerprintId(value);
            return row(employeeId, f);
        }
        AdminStaff a = admins.findById(id.number()).orElseThrow(FingerprintService::notFound);
        a.setFingerprintId(value);
        return row(employeeId, a);
    }

    @Transactional
    public void remove(String employeeId) {
        EmployeeId id = EmployeeId.parse(employeeId);
        StaffMember staff = id.isFaculty()
                ? faculty.findById(id.number()).orElseThrow(FingerprintService::notFound)
                : admins.findById(id.number()).orElseThrow(FingerprintService::notFound);
        staff.setFingerprintId(null);
    }

    private static FingerprintEmployee row(String id, StaffMember s) {
        String fingerprintId = s.getFingerprintId() == null || s.getFingerprintId().isEmpty() ? null : s.getFingerprintId();
        return new FingerprintEmployee(id, s.getEmployeeNumber(), s.getFullName(), s.staffType(), s.getEmploymentStatus(), fingerprintId);
    }

    private static ApiException unprocessable(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Employee not found.");
    }
}
