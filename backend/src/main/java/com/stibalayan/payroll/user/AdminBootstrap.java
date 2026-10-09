package com.stibalayan.payroll.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the first System Administrator when the users table is empty,
 * using bootstrap.admin.email / bootstrap.admin.password from
 * application.properties. Without this nobody could log in to create
 * the other accounts.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final BCryptPasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public AdminBootstrap(UserRepository users, BCryptPasswordEncoder passwordEncoder,
                          @Value("${bootstrap.admin.email:}") String email,
                          @Value("${bootstrap.admin.password:}") String password) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank() || users.count() > 0) {
            return;
        }

        User admin = new User();
        admin.setFirstName("System");
        admin.setLastName("Administrator");
        admin.setEmail(email.trim());
        admin.setPassword(passwordEncoder.encode(password));
        admin.setRole("System Administrator");
        users.save(admin);

        log.warn("Created the first System Administrator account ({}). "
                + "Remove bootstrap.admin.* from application.properties now.", email);
    }
}
