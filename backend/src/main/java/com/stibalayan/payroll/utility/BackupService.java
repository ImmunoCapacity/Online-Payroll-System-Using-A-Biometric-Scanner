package com.stibalayan.payroll.utility;

import com.stibalayan.payroll.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Backup & Restore (Utility, System Administrator).
 *
 * A backup is a complete SQL dump of the payroll database, made with the
 * database's own mysqldump tool into the backups folder (backup.dir, next to
 * the project; never uploaded to GitHub). Backups are made only on request.
 *
 * Restoring replaces the database with a backup's contents. A backup of the
 * current data ("before-restore") is always made first, so a restore can be
 * undone. Uploaded files must look like a MySQL / MariaDB dump.
 *
 * File names: payroll-backup_YYYY-MM-DD_HHMMSS.sql, payroll-before-restore_...,
 * payroll-upload_...; only these names are accepted (no paths).
 */
@Service
public class BackupService {

    private static final Logger log = LoggerFactory.getLogger(BackupService.class);
    private static final Pattern NAME = Pattern.compile("^payroll-(backup|before-restore|upload)_(\\d{4}-\\d{2}-\\d{2})_(\\d{2})(\\d{2})(\\d{2})\\.sql$");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss");
    private static final Pattern JDBC = Pattern.compile("^jdbc:(?:mysql|mariadb)://([^:/?]+)(?::(\\d+))?/([^?]+).*$");
    private static final long TIMEOUT_MINUTES = 10;

    private final Path dir;
    private final String mysqldump;
    private final String mysql;
    private final String host;
    private final String port;
    private final String database;
    private final String username;
    private final String password;

    public BackupService(@Value("${backup.dir:../backups}") String dir,
                         @Value("${backup.mysqldump:C:/xampp/mysql/bin/mysqldump.exe}") String mysqldump,
                         @Value("${backup.mysql:C:/xampp/mysql/bin/mysql.exe}") String mysql,
                         @Value("${spring.datasource.url}") String url,
                         @Value("${spring.datasource.username}") String username,
                         @Value("${spring.datasource.password:}") String password) {
        this.dir = Path.of(dir).toAbsolutePath().normalize();
        this.mysqldump = mysqldump;
        this.mysql = mysql;
        Matcher m = JDBC.matcher(url);
        if (!m.matches()) {
            throw new IllegalStateException("Can't read the database address from spring.datasource.url: " + url);
        }
        this.host = m.group(1);
        this.port = m.group(2) == null ? "3306" : m.group(2);
        this.database = m.group(3);
        this.username = username;
        this.password = password;
    }

    /** Every backup, newest first: { name, kind, createdAt, size }. */
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> result = new ArrayList<>();
        if (!Files.isDirectory(dir)) return result;
        try (Stream<Path> files = Files.list(dir)) {
            files.filter(p -> NAME.matcher(p.getFileName().toString()).matches()).forEach(p -> result.add(info(p)));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read the backups folder.");
        }
        result.sort((a, b) -> String.valueOf(b.get("createdAt")).compareTo(String.valueOf(a.get("createdAt"))));
        return result;
    }

    /** Back Up Now. */
    public synchronized Map<String, Object> create() {
        return dump("backup");
    }

    /** Replaces the database with a backup; returns the "before-restore" backup that was made first. */
    public synchronized Map<String, Object> restore(String name) {
        Path file = existing(name);
        Map<String, Object> safety = dump("before-restore");
        log.warn("Restoring the database from {}", file.getFileName());
        run(List.of(mysql, "-h", host, "-P", port, "-u", username, "--default-character-set=utf8mb4", database), file, null,
                "Restoring the backup failed. The data from just before the restore is in " + safety.get("name") + ".");
        return safety;
    }

    /** Saves an uploaded dump into the backups folder (it can then be restored). */
    public synchronized Map<String, Object> upload(InputStream in, String originalName) throws IOException {
        Files.createDirectories(dir);
        Path target = dir.resolve(fileName("upload"));
        Path temp = Files.createTempFile(dir, "upload-", ".part");
        try {
            Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
            if (!looksLikeDump(temp)) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "\"" + originalName + "\" is not a payroll backup (a .sql file made by Back Up Now).");
            }
            Files.move(temp, target);
        } finally {
            Files.deleteIfExists(temp);
        }
        return info(target);
    }

    public Path file(String name) {
        return existing(name);
    }

    public synchronized void delete(String name) {
        try {
            Files.delete(existing(name));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not delete the backup.");
        }
    }

    // ---------------------------------------------------------------

    private Map<String, Object> dump(String kind) {
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not create the backups folder " + dir + ".");
        }
        Path target = dir.resolve(fileName(kind));
        Path temp = target.resolveSibling(target.getFileName() + ".part");
        run(List.of(mysqldump, "-h", host, "-P", port, "-u", username, "--single-transaction", "--routines", "--triggers",
                        "--add-drop-table", "--default-character-set=utf8mb4", "--result-file=" + temp, database),
                null, temp, "Making the backup failed.");
        try {
            Files.move(temp, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save the backup file.");
        }
        return info(target);
    }

    /** Runs a database tool; the password goes in MYSQL_PWD, never on the command line. */
    private void run(List<String> command, Path input, Path cleanupOnFailure, String failure) {
        if (!Files.isRegularFile(Path.of(command.get(0)))) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    failure + " The database tool was not found at " + command.get(0) + " (backup.mysqldump / backup.mysql).");
        }
        ProcessBuilder pb = new ProcessBuilder(command).redirectErrorStream(true);
        if (!password.isEmpty()) pb.environment().put("MYSQL_PWD", password);
        if (input != null) pb.redirectInput(input.toFile());
        try {
            Process p = pb.start();
            String output = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            if (!p.waitFor(TIMEOUT_MINUTES, TimeUnit.MINUTES)) {
                p.destroyForcibly();
                throw new IOException("timed out");
            }
            if (p.exitValue() != 0) {
                throw new IOException("exit " + p.exitValue() + ": " + output);
            }
        } catch (IOException | InterruptedException e) {
            log.error("{} ({})", failure, e.getMessage());
            if (cleanupOnFailure != null) {
                try { Files.deleteIfExists(cleanupOnFailure); } catch (IOException ignored) { }
            }
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, failure + " Check that MySQL is running.");
        }
    }

    private static boolean looksLikeDump(Path file) throws IOException {
        byte[] head = new byte[4096];
        int read;
        try (InputStream in = Files.newInputStream(file)) {
            read = in.readNBytes(head, 0, head.length);
        }
        String text = new String(head, 0, read, StandardCharsets.UTF_8);
        return (text.contains("MySQL dump") || text.contains("MariaDB dump")) && text.contains("Database:");
    }

    private static String fileName(String kind) {
        return "payroll-" + kind + "_" + LocalDateTime.now(ZoneId.systemDefault()).format(STAMP) + ".sql";
    }

    private Path existing(String name) {
        if (name == null || !NAME.matcher(name).matches()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Backup not found.");
        }
        Path file = dir.resolve(name).normalize();
        if (!file.getParent().equals(dir) || !Files.isRegularFile(file)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Backup not found.");
        }
        return file;
    }

    private static Map<String, Object> info(Path p) {
        String name = p.getFileName().toString();
        Matcher m = NAME.matcher(name);
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("name", name);
        if (m.matches()) {
            info.put("kind", m.group(1));
            info.put("createdAt", m.group(2) + "T" + m.group(3) + ":" + m.group(4) + ":" + m.group(5));
        }
        try {
            info.put("size", Files.size(p));
        } catch (IOException e) {
            info.put("size", 0);
        }
        return info;
    }
}
