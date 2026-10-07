package local.kartsim.server;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Accepts browser pages on loopback origins and on any configured LAN hosts. */
@Configuration
public class LocalCors implements WebMvcConfigurer {
    private final LocalNetwork network;

    public LocalCors(LocalNetwork network) {
        this.network = network;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOriginPatterns(network.originPatterns())
            .allowedMethods("GET", "PUT", "POST", "OPTIONS")
            .allowedHeaders("Content-Type", "Authorization", "X-Profile-Key")
            .maxAge(600);
    }
}
