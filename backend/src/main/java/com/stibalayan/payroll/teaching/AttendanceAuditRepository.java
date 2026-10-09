package com.stibalayan.payroll.teaching;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceAuditRepository extends JpaRepository<AttendanceAudit, Integer> {

    List<AttendanceAudit> findByAttendanceIdOrderByIdDesc(Integer attendanceId);
}
