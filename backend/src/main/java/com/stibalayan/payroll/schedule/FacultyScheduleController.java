package com.stibalayan.payroll.schedule;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Faculty Schedule module (planned classes).
 *
 * GET  /api/faculty-schedule/teachers               teaching employees
 * GET  /api/faculty-schedule/classes?from=&to=[&employeeId=]
 * GET  /api/faculty-schedule/classes/{id}/history   change history
 * GET  /api/faculty-schedule/classes/{id}/series    the class's weekly pattern (day/date range), to prefill an edit
 * POST /api/faculty-schedule/classes                add a weekly series (day of week + date range) — Payroll Master
 * PUT  /api/faculty-schedule/classes/{id}           edit the whole series                            — Payroll Master
 * POST /api/faculty-schedule/classes/{id}/cancel    { reason }                — Payroll Master
 * POST /api/faculty-schedule/classes/{id}/restore                             — Payroll Master
 * DELETE /api/faculty-schedule/classes/{id}        permanently delete          — Attendance Monitoring Staff
 * POST /api/faculty-schedule/archive-all           archive every past class    — Attendance Monitoring Staff
 * POST /api/faculty-schedule/archive-employee/{id}  archive one faculty member's whole schedule — Attendance Monitoring Staff
 * POST /api/faculty-schedule/import                 bulk-add weekly series from a CSV (multipart "file") — Payroll Master
 */
@RestController
@RequestMapping("/api/faculty-schedule")
public class FacultyScheduleController {

    /** Header row detection: a real data row's first cell is an employee id ("F3", "A12"). */
    private static final Pattern EMPLOYEE_ID = Pattern.compile("^[FA]\\d+$");
    private static final int IMPORT_COLUMNS = 9;

    private final FacultyScheduleService schedule;

    public FacultyScheduleController(FacultyScheduleService schedule) {
        this.schedule = schedule;
    }

    @GetMapping("/teachers")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> teachers() {
        return Map.of("success", true, "teachers", schedule.teacherChoices());
    }

    @GetMapping("/classes")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> list(@RequestParam String from, @RequestParam String to,
                                    @RequestParam(required = false) String employeeId) {
        return Map.of("success", true, "classes", schedule.list(from, to, employeeId));
    }

    @GetMapping("/classes/{id}/history")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> history(@PathVariable int id) {
        return Map.of("success", true, "history", schedule.history(id));
    }

    @GetMapping("/classes/{id}/series")
    @RequireModule(SystemModule.FACULTY_SCHEDULE)
    public Map<String, Object> series(@PathVariable int id) {
        Map<String, Object> result = new HashMap<>(schedule.seriesInfo(id));
        result.put("success", true);
        return result;
    }

    @PostMapping("/classes")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> create(@RequestBody ClassRequest request, HttpServletRequest http) {
        Map<String, Object> result = new HashMap<>(schedule.create(request, userId(http)));
        result.put("success", true);
        return result;
    }

    @PutMapping("/classes/{id}")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> update(@PathVariable int id, @RequestBody ClassRequest request, HttpServletRequest http) {
        Map<String, Object> result = new HashMap<>(schedule.update(id, request, userId(http)));
        result.put("success", true);
        return result;
    }

    @PostMapping("/classes/{id}/cancel")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> cancel(@PathVariable int id, @RequestBody Map<String, String> body, HttpServletRequest http) {
        return Map.of("success", true, "class", schedule.cancel(id, body.get("reason"), userId(http)));
    }

    @PostMapping("/classes/{id}/restore")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> restore(@PathVariable int id, HttpServletRequest http) {
        return Map.of("success", true, "class", schedule.restore(id, userId(http)));
    }

    @DeleteMapping("/classes/{id}")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_DELETE)
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest http) {
        int deleted = schedule.delete(id, userId(http));
        return Map.of("success", true, "deleted", deleted);
    }

    @PostMapping("/archive-all")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_ARCHIVE)
    public Map<String, Object> archiveAll(HttpServletRequest http) {
        int archived = schedule.archiveAllPast(userId(http));
        return Map.of("success", true, "archived", archived);
    }

    @PostMapping("/archive-employee/{employeeId}")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_ARCHIVE)
    public Map<String, Object> archiveEmployee(@PathVariable String employeeId, HttpServletRequest http) {
        int archived = schedule.archiveForEmployee(employeeId, userId(http));
        return Map.of("success", true, "archived", archived);
    }

    /**
     * Bulk-adds weekly series from a CSV: one row per series — Employee Id,
     * Subject, Class/Section, Room, Day of Week, Scheduled Start, Scheduled
     * End, Valid From, Valid Until (same fields and rules as one Add Class).
     * A header row is optional (detected and skipped automatically). Rows
     * are independent: a bad or conflicting row is skipped and reported,
     * the rest of the file is still imported.
     */
    @PostMapping("/import")
    @RequireModule(SystemModule.FACULTY_SCHEDULE_MANAGEMENT)
    public Map<String, Object> importClasses(@RequestParam("file") MultipartFile file, HttpServletRequest http) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a CSV file to import.");
        }
        int userId = userId(http);
        List<Map<String, Object>> errors = new ArrayList<>();
        int imported = 0;
        int rowNum = 0;
        boolean firstRow = true;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                if (line.isBlank()) continue;
                List<String> cells = splitCsvLine(line);
                if (firstRow) {
                    firstRow = false;
                    if (cells.isEmpty() || !EMPLOYEE_ID.matcher(cells.get(0).trim()).matches()) {
                        continue;   // a header row, named or not
                    }
                }
                if (cells.size() < IMPORT_COLUMNS) {
                    errors.add(rowError(rowNum, "Expected " + IMPORT_COLUMNS + " columns (Employee ID, Subject, Class/Section, "
                            + "Room, Day of Week, Scheduled Start, Scheduled End, Valid From, Valid Until), found " + cells.size() + "."));
                    continue;
                }
                ClassRequest request = new ClassRequest(
                        cells.get(0).trim(), cells.get(1).trim(), cells.get(2).trim(), cells.get(3).trim(),
                        cells.get(4).trim(), cells.get(5).trim(), cells.get(6).trim(), cells.get(7).trim(), cells.get(8).trim());
                try {
                    schedule.create(request, userId);
                    imported++;
                } catch (ApiException e) {
                    errors.add(rowError(rowNum, e.getMessage()));
                } catch (RuntimeException e) {
                    errors.add(rowError(rowNum, "Could not import this row: " + e.getMessage()));
                }
            }
        }
        return Map.of("success", true, "imported", imported, "failed", errors.size(), "errors", errors);
    }

    private static Map<String, Object> rowError(int rowNum, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("row", rowNum);
        m.put("message", message);
        return m;
    }

    /** A minimal CSV line splitter: commas separate cells, "quoted,cells" and "" escapes are supported. */
    private static List<String> splitCsvLine(String line) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"') {
                    if (i + 1 < line.length() && line.charAt(i + 1) == '"') {
                        cur.append('"');
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == ',') {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }

    private static int userId(HttpServletRequest http) {
        return AuthInterceptor.currentUser(http).id();
    }
}
