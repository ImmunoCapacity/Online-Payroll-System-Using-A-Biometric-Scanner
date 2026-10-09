package com.stibalayan.payroll.teaching;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeachingAttendanceRepository extends JpaRepository<TeachingAttendance, Integer> {

    Optional<TeachingAttendance> findByClassScheduleId(Integer classScheduleId);

    List<TeachingAttendance> findByClassScheduleIdIn(Collection<Integer> classScheduleIds);
}
