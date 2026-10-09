package com.stibalayan.payroll.user;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Component;

/** Turns user ids (created_by, entered_by, approved_by, ...) into display names. */
@Component
public class UserNames {

    private final UserRepository users;

    public UserNames(UserRepository users) {
        this.users = users;
    }

    public Map<Integer, String> of(Collection<Integer> ids) {
        Map<Integer, String> names = new HashMap<>();
        users.findAllById(ids.stream().filter(Objects::nonNull).distinct().toList())
                .forEach(u -> names.put(u.getId(), u.getFirstName() + " " + u.getLastName()));
        return names;
    }
}
