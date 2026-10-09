package com.stibalayan.payroll.user;

import com.stibalayan.payroll.auth.AuthInterceptor;
import com.stibalayan.payroll.auth.RequireModule;
import com.stibalayan.payroll.auth.SystemModule;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET    /api/users        list system accounts
 * POST   /api/users        create
 * PUT    /api/users/{id}   update (empty password = keep current)
 * DELETE /api/users/{id}   delete
 */
@RestController
@RequestMapping("/api/users")
@RequireModule(SystemModule.UTILITY)
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("success", true, "users", userService.listAll());
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody UserRequest request) {
        return Map.of("success", true, "user", userService.create(request));
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@PathVariable int id, @RequestBody UserRequest request, HttpServletRequest http) {
        return Map.of("success", true, "user", userService.update(id, request, AuthInterceptor.currentUser(http).id()));
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable int id, HttpServletRequest http) {
        userService.delete(id, AuthInterceptor.currentUser(http).id());
        return Map.of("success", true);
    }
}
