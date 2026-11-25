package com.stibalayan.payroll.room;

import com.stibalayan.payroll.audit.AuditService;
import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import com.stibalayan.payroll.common.ApiException;
import com.stibalayan.payroll.common.Validation;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Room Maintenance (table room) — Daily Time Record menu, Attendance
 * Monitoring Staff and Payroll Master. The rooms offered as a class's Room
 * in Faculty Schedule, and how Faculty Teaching Hours groups classes by
 * floor level.
 *
 * GET    /api/rooms          [{ id, name, floorLevel, used }] (used = scheduled classes with this room)
 * POST   /api/rooms          { name, floorLevel }  add a room
 * PUT    /api/rooms/{id}     { name, floorLevel }  rename/move; classes with the old room name follow it
 * DELETE /api/rooms/{id}     remove a room no scheduled class uses
 */
@RestController
@RequestMapping("/api/rooms")
@RequireModule(SystemModule.ROOM_MANAGEMENT)
public class RoomController {

    private static final String USAGE = "(SELECT COUNT(*) FROM faculty_class_schedule s WHERE s.room = r.room_name)";

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public RoomController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "rooms", rooms());
    }

    @PostMapping
    @Transactional
    public Map<String, Object> add(@RequestBody Map<String, Object> body, HttpServletRequest http) {
        String name = name(str(body.get("name")), null);
        String floor = floor(str(body.get("floorLevel")));
        jdbc.update("INSERT INTO room (room_name, floor_level) VALUES (?, ?)", name, floor);
        audit.log(AuthInterceptor.currentUser(http).id(), "Room Maintenance", "Added", name + " (" + floor + ")");
        return Map.of("success", true, "rooms", rooms());
    }

    @PutMapping("/{id}")
    @Transactional
    public Map<String, Object> rename(@PathVariable int id, @RequestBody Map<String, Object> body, HttpServletRequest http) {
        String old = find(id);
        String name = name(str(body.get("name")), id);
        String floor = floor(str(body.get("floorLevel")));
        jdbc.update("UPDATE room SET room_name = ?, floor_level = ? WHERE room_id = ?", name, floor, id);
        // Scheduled classes store the room by name, so they follow the rename.
        jdbc.update("UPDATE faculty_class_schedule SET room = ? WHERE room = ?", name, old);
        audit.log(AuthInterceptor.currentUser(http).id(), "Room Maintenance", "Updated", old + " → " + name + " (" + floor + ")");
        return Map.of("success", true, "rooms", rooms());
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> remove(@PathVariable int id, HttpServletRequest http) {
        String name = find(id);
        Integer used = jdbc.queryForObject("SELECT " + USAGE + " FROM room r WHERE r.room_id = ?", Integer.class, id);
        if (used != null && used > 0) {
            throw new ApiException(HttpStatus.CONFLICT, name + " can't be removed: " + used + " scheduled class"
                    + (used == 1 ? "" : "es") + " use" + (used == 1 ? "s" : "") + " it. Change their room in Faculty Schedule first.");
        }
        jdbc.update("DELETE FROM room WHERE room_id = ?", id);
        audit.log(AuthInterceptor.currentUser(http).id(), "Room Maintenance", "Removed", name);
        return Map.of("success", true, "rooms", rooms());
    }

    // ---------------------------------------------------------------

    private List<Map<String, Object>> rooms() {
        return jdbc.query("SELECT r.room_id, r.room_name, r.floor_level, " + USAGE + " AS used FROM room r "
                        + "ORDER BY r.floor_level, r.room_name",
                (rs, i) -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", rs.getInt("room_id"));
                    m.put("name", rs.getString("room_name"));
                    m.put("floorLevel", rs.getString("floor_level"));
                    m.put("used", rs.getInt("used"));
                    return m;
                });
    }

    private String find(int id) {
        List<String> names = jdbc.queryForList("SELECT room_name FROM room WHERE room_id = ?", String.class, id);
        if (names.isEmpty()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Room not found.");
        }
        return names.get(0);
    }

    /** 1–50 characters (the column size), unique ignoring case. */
    private String name(String value, Integer currentId) {
        String name = Validation.requiredText(value, "name", "Room name", 50).replaceAll("\\s+", " ");
        Integer taken = jdbc.queryForObject("SELECT COUNT(*) FROM room WHERE LOWER(room_name) = LOWER(?)"
                + (currentId == null ? "" : " AND room_id <> " + currentId), Integer.class, name);
        if (taken != null && taken > 0) {
            throw Validation.invalid("name", name + " already exists.");
        }
        return name;
    }

    private String floor(String value) {
        return Validation.requiredText(value, "floorLevel", "Floor level", 20).replaceAll("\\s+", " ");
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
