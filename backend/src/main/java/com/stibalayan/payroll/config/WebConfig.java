package com.stibalayan.payroll.config;

import com.stibalayan.payroll.auth.AuthInterceptor;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves the existing frontend from the repository root and guards the API.
 *
 * Only the frontend's own files are exposed (pages, css/, js/, vendor/) so that
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
        // Pages, CSS and JS are revalidated on every load ("no-cache" = ask the
        // server first; an unchanged file costs only a 304), so browsers never
        // keep running an old version after an update.
        CacheControl revalidate = CacheControl.noCache();
        registry.addResourceHandler("/*.html").addResourceLocations(frontendLocation).setCacheControl(revalidate);
        registry.addResourceHandler("/css/**").addResourceLocations(frontendLocation + "css/").setCacheControl(revalidate);
        registry.addResourceHandler("/js/**").addResourceLocations(frontendLocation + "js/").setCacheControl(revalidate);
        // Bootstrap and Bootstrap Icons, kept locally so the system works without internet.
        registry.addResourceHandler("/vendor/**").addResourceLocations(frontendLocation + "vendor/");
        // Images kept in the project root, e.g. sti_logo.png (revalidated too, so a replaced logo shows at once).
        registry.addResourceHandler("/*.png", "/*.jpg", "/*.svg", "/*.ico").addResourceLocations(frontendLocation)
                .setCacheControl(revalidate);
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
