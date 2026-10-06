package local.kartsim.server;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** The server binds to loopback and accepts browser pages on loopback origins. */
@Configuration
public class LocalCors implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns("http://127.0.0.1:*", "http://localhost:*")
            .allowedMethods("GET", "PUT", "POST", "OPTIONS")
            .allowedHeaders("Content-Type", "Authorization", "X-Profile-Key")
            .maxAge(600);
    }
}
