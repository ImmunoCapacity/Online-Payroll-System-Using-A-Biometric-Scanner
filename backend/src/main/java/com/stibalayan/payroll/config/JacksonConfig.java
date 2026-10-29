package com.stibalayan.payroll.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * By default Jackson silently truncates a fractional JSON number sent for an
 * Integer field (e.g. "dependents": 2.5 -> 2) instead of rejecting it, which
 * would let bad data past Validation/EmployeeService before they ever see it.
 * Requests like that now fail with the same "not valid JSON" 400 that any
 * other type mismatch gets (see GlobalExceptionHandler).
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer rejectFractionalIntegers() {
        return builder -> builder.featuresToDisable(DeserializationFeature.ACCEPT_FLOAT_AS_INT);
    }
}
