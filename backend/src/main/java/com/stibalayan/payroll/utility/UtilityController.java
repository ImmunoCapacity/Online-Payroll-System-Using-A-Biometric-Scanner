package com.stibalayan.payroll.utility;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.employee.EmployeeDirectory;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Utility (System Administrator): Backup & Restore and the Archive list.
 *
 * GET    /api/utility/backups                    every backup
 * POST   /api/utility/backups                    Back Up Now
 * POST   /api/utility/backups/upload             upload a backup file (multipart "file")
 * GET    /api/utility/backups/{name}/download    download one
 * POST   /api/utility/backups/{name}/restore     { confirm: "RESTORE" }  replace the database (a backup is made first)
 * DELETE /api/utility/backups/{name}
 * GET    /api/utility/archive                    archived employees (read-only)
 */
@RestController
@RequestMapping("/api/utility")
@RequireModule(SystemModule.UTILITY)
public class UtilityController {

    private final BackupService backups;
    private final EmployeeDirectory employees;
    private final AuditService audit;

    public UtilityController(BackupService backups, EmployeeDirectory employees, AuditService audit) {
        this.backups = backups;
        this.employees = employees;
        this.audit = audit;
    }

    @GetMapping("/backups")
    public Map<String, Object> list() {
        return Map.of("success", true, "backups", backups.list());
    }

    @PostMapping("/backups")
    public Map<String, Object> create(HttpServletRequest http) {
        Map<String, Object> made = backups.create();
        audit.log(AuthInterceptor.currentUser(http).id(), "Backup & Restore", "Backup created", String.valueOf(made.get("name")));
        return Map.of("success", true, "backup", made, "backups", backups.list());
    }

    @PostMapping("/backups/upload")
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file, HttpServletRequest http) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Choose a backup file (.sql) to upload.");
        }
        Map<String, Object> saved = backups.upload(file.getInputStream(), String.valueOf(file.getOriginalFilename()));
        audit.log(AuthInterceptor.currentUser(http).id(), "Backup & Restore", "Backup uploaded",
                file.getOriginalFilename() + " → " + saved.get("name"));
        return Map.of("success", true, "backup", saved, "backups", backups.list());
    }

    @GetMapping("/backups/{name}/download")
    public ResponseEntity<Resource> download(@PathVariable String name) {
        Path file = backups.file(name);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(name).build().toString())
                .body(new FileSystemResource(file));
    }

    public record RestoreRequest(String confirm) {
    }

    @PostMapping("/backups/{name}/restore")
    public Map<String, Object> restore(@PathVariable String name, @RequestBody RestoreRequest request, HttpServletRequest http) {
        if (request == null || !"RESTORE".equals(request.confirm())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Type RESTORE to confirm.");
        }
        int userId = AuthInterceptor.currentUser(http).id();
        Map<String, Object> safety = backups.restore(name);
        // Logged after the restore, so the entry is in the restored data.
        audit.log(userId, "Backup & Restore", "Database restored", name + " (previous data saved as " + safety.get("name") + ")");
        return Map.of("success", true, "restored", name, "safetyBackup", safety);
    }

    @DeleteMapping("/backups/{name}")
    public Map<String, Object> delete(@PathVariable String name, HttpServletRequest http) {
        backups.delete(name);
        audit.log(AuthInterceptor.currentUser(http).id(), "Backup & Restore", "Backup deleted", name);
        return Map.of("success", true, "backups", backups.list());
    }

    /** Archived employees, read-only (restoring them is done by the Payroll Master in Employee Records). */
    @GetMapping("/archive")
    public Map<String, Object> archive() {
        List<Map<String, Object>> list = new ArrayList<>();
        employees.all().forEach((id, s) -> {
            if (!s.isArchived()) return;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("employeeId", id);
            m.put("employeeNumber", s.getEmployeeNumber());
            m.put("name", s.getFullName());
            m.put("type", s.staffType());
            m.put("status", s.getEmploymentStatus());
            m.put("dateHired", s.getDateHired() == null ? null : s.getDateHired().toString());
            m.put("archivedAt", s.getArchivedAt() == null ? null : s.getArchivedAt().toString());
            list.add(m);
        });
        list.sort((a, b) -> String.valueOf(b.get("archivedAt")).compareTo(String.valueOf(a.get("archivedAt"))));
        return Map.of("success", true, "employees", list);
    }
}
