package local.kartsim.server;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Loopback is always trusted. LAN play adds hosts through kart.lan-hosts;
 * "*" trusts any host, so the service answers on whatever address it is reached by.
 */
@Component
public class LocalNetwork {
    private static final List<String> LOOPBACK = List.of("127.0.0.1", "localhost");
    private final List<String> hosts;
    private final boolean anyHost;

    public LocalNetwork(@Value("${kart.lan-hosts:}") String lanHosts) {
        anyHost = Arrays.stream(lanHosts.split(",")).anyMatch(host -> host.trim().equals("*"));
        List<String> all = new ArrayList<>(LOOPBACK);
        Arrays.stream(lanHosts.split(","))
            .map(host -> host.trim().toLowerCase(Locale.ROOT))
            .filter(host -> host.matches("[a-z0-9.-]+") && !all.contains(host))
            .forEach(all::add);
        hosts = List.copyOf(all);
    }

    public static LocalNetwork loopbackOnly() {
        return new LocalNetwork("");
    }

    public boolean allowsHost(String host) {
        return anyHost || hosts.contains(host.toLowerCase(Locale.ROOT));
    }

    /** Browser page origins on any port of a trusted host; LAN pages use HTTPS. */
    public String[] originPatterns() {
        if (anyHost) return new String[] {"http://*:*", "https://*:*"};
        return hosts.stream().flatMap(host -> java.util.stream.Stream.of(
            "http://" + host + ":*", "https://" + host + ":*")).toArray(String[]::new);
    }
}
