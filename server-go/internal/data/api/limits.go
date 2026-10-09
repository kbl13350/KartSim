package api

import (
	"context"
	"net"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"kartsim/internal/shared/apierr"
)

var errTooManyAttempts = apierr.New(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")

// RateLimits are the fixed-window limits of the public write endpoints.
// A limit of 0 disables that check.
type RateLimits struct {
	// Registrations per client IP (IPv6: per /64), per IPv6 /56 (one home
	// connection usually gets a /56, i.e. 256 /64s) within the same window,
	// and for the whole service. Only registrations that pass the cheap
	// checks and the invite/username/nickname precheck count against the
	// global limit, so doomed requests cannot use it up. Registration fails
	// closed: without Redis nobody registers.
	RegisterPerIP        int
	RegisterPerIPv6Site  int
	RegisterPerIPWindow  time.Duration
	RegisterGlobal       int
	RegisterGlobalWindow time.Duration
	// Login attempts per client IP, and failed logins per username from one
	// client network (IPv4 /24, IPv6 /64): failures elsewhere never lock a
	// username out for other clients. Both are checked before the password
	// hash and fail open (a Redis outage must not lock everybody out).
	LoginPerIP          int
	LoginPerIPWindow    time.Duration
	LoginFailures       int
	LoginFailuresWindow time.Duration
	// Economy writes (starter, purchase, time attack, profile) per account;
	// a bound against floods, far above what a player does. Fails open.
	AccountWrites       int
	AccountWritesWindow time.Duration
}

// DefaultRateLimits are the production limits (ECONOMY.md 6).
func DefaultRateLimits() RateLimits {
	return RateLimits{
		RegisterPerIP: 5, RegisterPerIPv6Site: 10, RegisterPerIPWindow: time.Hour,
		RegisterGlobal: 60, RegisterGlobalWindow: time.Minute,
		LoginPerIP: 20, LoginPerIPWindow: 5 * time.Minute,
		LoginFailures: 10, LoginFailuresWindow: 15 * time.Minute,
		AccountWrites: 300, AccountWritesWindow: time.Minute,
	}
}

// hit counts one event against key and rejects it with TOO_MANY_ATTEMPTS
// past limit. When Redis fails, failClosed answers DATA_SERVICE_UNAVAILABLE;
// otherwise the request goes through.
func (a *API) hit(ctx context.Context, key string, limit int, window time.Duration, failClosed bool) error {
	if a.limiter == nil || limit <= 0 {
		return nil
	}
	count, err := a.limiter.Hit(ctx, key, window)
	if err != nil {
		if failClosed {
			a.log.Warn("rate limiter unavailable; request refused", "key", key, "error", err)
			return errServiceUnavailable
		}
		a.log.Debug("rate limiter unavailable; request allowed", "key", key, "error", err)
		return nil
	}
	if count > int64(limit) {
		return errTooManyAttempts
	}
	return nil
}

// exceeded reports whether key already counted limit events (fail open).
func (a *API) exceeded(ctx context.Context, key string, limit int) bool {
	if a.limiter == nil || limit <= 0 {
		return false
	}
	count, err := a.limiter.Count(ctx, key)
	if err != nil {
		a.log.Debug("rate limiter unavailable; request allowed", "key", key, "error", err)
		return false
	}
	return count >= int64(limit)
}

// record counts one event against key without rejecting anything (fail
// open); exceeded checks the count later.
func (a *API) record(ctx context.Context, key string, limit int, window time.Duration) {
	if a.limiter == nil || limit <= 0 {
		return
	}
	if _, err := a.limiter.Hit(ctx, key, window); err != nil {
		a.log.Debug("rate limiter unavailable; event not counted", "key", key, "error", err)
	}
}

// accountWrite applies the per-account economy write limit.
func (a *API) accountWrite(ctx context.Context, accountID string) error {
	return a.hit(ctx, "write:"+accountID, a.limits.AccountWrites, a.limits.AccountWritesWindow, false)
}

// clientIP is the address rate limits count against: the TCP peer, or,
// when the peer is a trusted proxy, the nearest X-Forwarded-For hop that is
// not itself a trusted proxy (hops are read right to left, since everything
// left of the first untrusted hop can be forged by the client).
func (a *API) clientIP(r *http.Request) netip.Addr {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	client, err := netip.ParseAddr(host)
	if err != nil {
		return netip.Addr{}
	}
	client = client.Unmap().WithZone("")
	if !a.trustedProxy(client) {
		return client
	}
	var hops []string
	for _, value := range r.Header.Values("X-Forwarded-For") {
		hops = append(hops, strings.Split(value, ",")...)
	}
	for i := len(hops) - 1; i >= 0; i-- {
		hop, ok := parseHop(hops[i])
		if !ok {
			break
		}
		client = hop
		if !a.trustedProxy(hop) {
			break
		}
	}
	return client
}

// parseHop reads one X-Forwarded-For entry: an IP, optionally with a port.
func parseHop(value string) (netip.Addr, bool) {
	value = strings.TrimSpace(value)
	addr, err := netip.ParseAddr(value)
	if err != nil {
		addrPort, portErr := netip.ParseAddrPort(value)
		if portErr != nil {
			return netip.Addr{}, false
		}
		addr = addrPort.Addr()
	}
	return addr.Unmap().WithZone(""), true
}

func (a *API) trustedProxy(addr netip.Addr) bool {
	for _, prefix := range a.trustedProxies {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

// ipKey is the rate-limit key of a client address. IPv6 clients usually
// own a whole /64, so they are counted per /64.
func ipKey(addr netip.Addr) string { return prefixKey(addr, 32, 64) }

// networkKey is the client network of a login-failure count: the IPv4 /24
// or the IPv6 /64.
func networkKey(addr netip.Addr) string { return prefixKey(addr, 24, 64) }

// ipv6SiteKey is the IPv6 /56 of a client, or "" for an IPv4 client.
func ipv6SiteKey(addr netip.Addr) string {
	if !addr.IsValid() || addr.Is4() {
		return ""
	}
	return prefixKey(addr, 32, 56)
}

// prefixKey names the IPv4 /bits4 or IPv6 /bits6 network of addr.
func prefixKey(addr netip.Addr, bits4, bits6 int) string {
	bits := bits6
	switch {
	case !addr.IsValid():
		return "unknown"
	case addr.Is4():
		if bits4 == 32 {
			return addr.String()
		}
		bits = bits4
	}
	prefix, err := addr.Prefix(bits)
	if err != nil {
		return addr.String()
	}
	return prefix.String()
}
