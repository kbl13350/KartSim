package local.kartsim.server;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Small HTTP surface used by the local frontend before opening WebSocket. */
@RestController
@RequestMapping("/multiplayer")
public class HttpApi {
    private final Accounts accounts;
    private final LobbyService lobby;

    public HttpApi(Accounts accounts, LobbyService lobby) {
        this.accounts = accounts;
        this.lobby = lobby;
    }

    @GetMapping("/healthz")
    public Map<String, Object> health() {
        return Map.of("protocolVersion", 39, "ruleset", "launcher-room-v1", "transport", "websocket");
    }

    @GetMapping("/auth/config")
    public Map<String, Object> config(HttpServletRequest request) {
        return Map.of("loginRequired", false,
            "backendOrigin", "http://127.0.0.1:" + request.getLocalPort());
    }

    @PostMapping("/auth/guest-name")
    public Map<String, Boolean> guestName(@RequestBody Map<String, String> input) {
        String name = input.get("name");
        return Map.of("available", accounts.guestNameAvailable(name) &&
            lobby.liveNameAvailable(name));
    }

    @PostMapping("/auth/register")
    public Map<String, Object> register(@RequestBody Map<String, String> input) {
        return Map.of("account", accounts.register(input.get("username"),
            input.get("nickname"), input.get("password"), input.get("invite")).publicView());
    }

    @PostMapping("/auth/login")
    public Map<String, Object> login(@RequestBody Map<String, String> input) {
        Accounts.Login login = accounts.login(input.get("username"), input.get("password"));
        return Map.of("account", login.account().publicView(), "token", login.token());
    }

    @GetMapping("/auth/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String header) {
        return Map.of("account", accounts.require(bearer(header)).publicView());
    }

    @PostMapping("/auth/nickname")
    public Map<String, Object> nickname(
        @RequestHeader(value = "Authorization", required = false) String header,
        @RequestBody Map<String, String> input) {
        return Map.of("account", accounts.rename(bearer(header), input.get("nickname")).publicView());
    }

    @PostMapping("/auth/logout")
    public Map<String, Boolean> logout(
        @RequestHeader(value = "Authorization", required = false) String header) {
        accounts.logout(bearer(header));
        return Map.of("ok", true);
    }

    @PostMapping("/admin/invites")
    public Map<String, String> createInvite(
        @RequestHeader(value = "Authorization", required = false) String header) {
        return Map.of("invite", accounts.createInvite(bearer(header)));
    }

    @GetMapping("/ice")
    public Map<String, Object> ice() { return Map.of("iceServers", new Object[0]); }

    @PostMapping("/offer")
    public ResponseEntity<Map<String, String>> oldTransport() {
        return ResponseEntity.status(501).body(Map.of("error", "USE_LOCAL_WEBSOCKET"));
    }

    private static String bearer(String header) {
        return header != null && header.startsWith("Bearer ") ? header.substring(7) : null;
    }
}
