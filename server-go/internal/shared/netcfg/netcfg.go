// Package netcfg decides which browser origins and Host names a service
// trusts. Loopback is always trusted; LAN and public deployments add hosts
// through KART_LAN_HOSTS (legacy: KART_LANHOSTS). "*" trusts any host.
package netcfg

import (
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
)

var hostPattern = regexp.MustCompile(`^[a-z0-9.-]+$`)

// Network is the set of trusted hosts.
type Network struct {
	hosts   map[string]bool
	anyHost bool
}

// New parses a comma-separated host list. Invalid entries are ignored.
func New(lanHosts string) *Network {
	network := &Network{hosts: map[string]bool{"127.0.0.1": true, "localhost": true}}
	for _, raw := range strings.Split(lanHosts, ",") {
		host := strings.ToLower(strings.TrimSpace(raw))
		if host == "*" {
			network.anyHost = true
		} else if hostPattern.MatchString(host) {
			network.hosts[host] = true
		}
	}
	return network
}

// FromEnv reads KART_LAN_HOSTS, falling back to KART_LANHOSTS.
func FromEnv() *Network {
	value := os.Getenv("KART_LAN_HOSTS")
	if value == "" {
		value = os.Getenv("KART_LANHOSTS")
	}
	return New(value)
}

// LoopbackOnly trusts only 127.0.0.1 and localhost.
func LoopbackOnly() *Network { return New("") }

// AllowsHost reports whether a bare host name (no port) is trusted.
func (n *Network) AllowsHost(host string) bool {
	return n.anyHost || n.hosts[strings.ToLower(host)]
}

// AllowsOrigin reports whether a browser Origin header value is trusted:
// http or https on any port of a trusted host.
func (n *Network) AllowsOrigin(origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") ||
		parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") ||
		parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Hostname() == "" {
		return false
	}
	return n.anyHost || n.hosts[strings.ToLower(parsed.Hostname())]
}

// SameOrigin reports whether the Origin header names the request's own host.
func SameOrigin(r *http.Request, origin string) bool {
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(parsed.Host, r.Host)
}

// CheckWebSocketOrigin is the upgrader origin policy: requests without an
// Origin header (non-browser clients) and same-origin pages are accepted.
func (n *Network) CheckWebSocketOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	return origin == "" || SameOrigin(r, origin) || n.AllowsOrigin(origin)
}

// RequestHost returns the Host header without its port.
func RequestHost(r *http.Request) string {
	host := r.Host
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		host = parsed
	}
	return strings.Trim(host, "[]")
}

const (
	allowMethods = "GET,PUT,POST,OPTIONS"
	maxAge       = "600"
)

var allowHeaders = map[string]string{
	"content-type":  "Content-Type",
	"authorization": "Authorization",
	"x-profile-key": "X-Profile-Key",
	"if-none-match": "If-None-Match",
}

// exposeHeaders lets cross-origin pages read the shop catalog's ETag.
const exposeHeaders = "ETag"

// CORS mirrors the Java service's policy: trusted origins on any port,
// methods GET/PUT/POST/OPTIONS, headers Content-Type, Authorization,
// X-Profile-Key and If-None-Match (ETag exposed), preflight cached for 600 s. Untrusted cross-origin requests
// receive 403 "Invalid CORS request".
func (n *Network) CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" || SameOrigin(r, origin) {
			next.ServeHTTP(w, r)
			return
		}
		header := w.Header()
		header.Add("Vary", "Origin")
		header.Add("Vary", "Access-Control-Request-Method")
		header.Add("Vary", "Access-Control-Request-Headers")
		if !n.AllowsOrigin(origin) {
			http.Error(w, "Invalid CORS request", http.StatusForbidden)
			return
		}
		preflight := r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != ""
		if preflight {
			method := strings.ToUpper(r.Header.Get("Access-Control-Request-Method"))
			if !strings.Contains(","+allowMethods+",", ","+method+",") {
				http.Error(w, "Invalid CORS request", http.StatusForbidden)
				return
			}
			var granted []string
			for _, raw := range strings.Split(r.Header.Get("Access-Control-Request-Headers"), ",") {
				name := strings.ToLower(strings.TrimSpace(raw))
				if name == "" {
					continue
				}
				canonical, ok := allowHeaders[name]
				if !ok {
					http.Error(w, "Invalid CORS request", http.StatusForbidden)
					return
				}
				granted = append(granted, canonical)
			}
			header.Set("Access-Control-Allow-Origin", origin)
			header.Set("Access-Control-Allow-Methods", allowMethods)
			if len(granted) > 0 {
				header.Set("Access-Control-Allow-Headers", strings.Join(granted, ","))
			}
			header.Set("Access-Control-Max-Age", maxAge)
			w.WriteHeader(http.StatusOK)
			return
		}
		header.Set("Access-Control-Allow-Origin", origin)
		header.Set("Access-Control-Expose-Headers", exposeHeaders)
		next.ServeHTTP(w, r)
	})
}
