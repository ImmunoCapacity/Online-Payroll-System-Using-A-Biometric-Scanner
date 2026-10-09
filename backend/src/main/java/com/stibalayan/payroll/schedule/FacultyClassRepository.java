package com.stibalayan.payroll.schedule;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FacultyClassRepository extends JpaRepository<FacultyClass, Integer> {

    List<FacultyClass> findByClassDateBetweenOrderByClassDateAscScheduledStartAsc(LocalDate from, LocalDate to);

    List<FacultyClass> findByFacultyIdAndClassDate(Integer facultyId, LocalDate classDate);

    List<FacultyClass> findByAdminstaffIdAndClassDate(Integer adminstaffId, LocalDate classDate);
}
