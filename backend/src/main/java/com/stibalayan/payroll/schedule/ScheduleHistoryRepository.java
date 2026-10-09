package com.stibalayan.payroll.schedule;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleHistoryRepository extends JpaRepository<ScheduleHistory, Integer> {

    List<ScheduleHistory> findByClassScheduleIdOrderByIdDesc(Integer classScheduleId);
}
