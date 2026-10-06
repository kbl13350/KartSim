package local.kartsim.server;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Starts the local-only HTTP and WebSocket server. */
@SpringBootApplication
public class KartServer {
    public static void main(String[] args) {
        SpringApplication.run(KartServer.class, args);
    }
}
