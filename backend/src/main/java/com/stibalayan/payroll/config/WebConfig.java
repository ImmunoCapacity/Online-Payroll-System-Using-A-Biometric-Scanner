package com.stibalayan.payroll.config;

import com.stibalayan.payroll.auth.AuthInterceptor;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves the existing frontend from the repository root and guards the API.
 *
 * Only the frontend's own files are exposed (pages, css/, js/) so that
 * backend/ and database/ — including application.properties with the
 * database password — can never be downloaded through the browser.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;
    private final String frontendLocation;

    public WebConfig(AuthInterceptor authInterceptor, @Value("${frontend.dir}") String frontendDir) {
        this.authInterceptor = authInterceptor;
        this.frontendLocation = Path.of(frontendDir).toAbsolutePath().normalize().toUri().toString();
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Each folder needs its own handler: Spring strips the matched folder
        // ("/css/") from the request before looking the file up.
        registry.addResourceHandler("/*.html").addResourceLocations(frontendLocation);
        registry.addResourceHandler("/css/**").addResourceLocations(frontendLocation + "css/");
        registry.addResourceHandler("/js/**").addResourceLocations(frontendLocation + "js/");
        // Images kept in the project root, e.g. sti_logo.png.
        registry.addResourceHandler("/*.png", "/*.jpg", "/*.svg", "/*.ico").addResourceLocations(frontendLocation);
    }

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/").setViewName("forward:/index.html");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor).addPathPatterns("/api/**");
    }
}
