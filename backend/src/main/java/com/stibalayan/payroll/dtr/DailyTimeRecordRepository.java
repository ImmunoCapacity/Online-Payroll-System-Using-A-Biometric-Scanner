package com.stibalayan.payroll.dtr;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyTimeRecordRepository extends JpaRepository<DailyTimeRecord, Integer> {

    Optional<DailyTimeRecord> findFirstByFacultyIdAndRecordDate(Integer facultyId, LocalDate recordDate);

    Optional<DailyTimeRecord> findFirstByAdminstaffIdAndRecordDate(Integer adminstaffId, LocalDate recordDate);

    List<DailyTimeRecord> findByRecordDate(LocalDate recordDate);

    List<DailyTimeRecord> findByRecordDateBetween(LocalDate from, LocalDate to);
}
