package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/netip"
	"sync/atomic"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/economy"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

// These tests need no MySQL.

func TestShopCatalogCaching(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	data, err := economy.Default()
	if err != nil {
		t.Fatal(err)
	}
	etag := `"` + data.Catalog.Version + `"`
	plain := h.get("/api/shop/catalog", nil).expect(t, http.StatusOK, "")
	if !bytes.Equal(plain.body, data.Catalog.JSON()) || plain.header.Get("ETag") != etag ||
		plain.header.Get("Content-Encoding") != "" || plain.header.Get("Cache-Control") == "" {
		t.Fatalf("plain catalog: %d bytes, headers %v", len(plain.body), plain.header)
	}
	for _, match := range []string{etag, "W/" + etag, `"other", ` + etag, "*"} {
		cached := h.get("/api/shop/catalog", map[string]string{"If-None-Match": match})
		if cached.status != http.StatusNotModified || len(cached.body) != 0 || cached.header.Get("ETag") != etag {
			t.Fatalf("If-None-Match %s: %d %v", match, cached.status, cached.header)
		}
	}
	h.get("/api/shop/catalog", map[string]string{"If-None-Match": `"stale"`}).expect(t, http.StatusOK, "")

	// The default client would decompress transparently; ask explicitly.
	request, _ := http.NewRequest(http.MethodGet, h.public.URL+"/api/shop/catalog", nil)
	request.Header.Set("Accept-Encoding", "br;q=1, gzip;q=0.8")
	result, err := (&http.Client{Transport: &http.Transport{DisableCompression: true}}).Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer result.Body.Close()
	compressed, _ := io.ReadAll(result.Body)
	reader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil || result.Header.Get("Content-Encoding") != "gzip" || len(compressed) >= len(plain.body)/3 {
		t.Fatalf("gzip catalog: %v %v, %d bytes", err, result.Header, len(compressed))
	}
	inflated, err := io.ReadAll(reader)
	if err != nil || !bytes.Equal(inflated, data.Catalog.JSON()) {
		t.Fatalf("gzip body differs: %v", err)
	}
	if acceptsGzip([]string{"gzip;q=0"}) || !acceptsGzip([]string{"deflate, *"}) || acceptsGzip([]string{"identity"}) {
		t.Fatal("Accept-Encoding parsing")
	}
}

func TestClientIP(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("127.0.0.0/8"), netip.MustParsePrefix("10.0.0.0/8")}
	a := New(Options{TrustedProxies: trusted, Logger: nil})
	ip := func(remote string, forwarded ...string) string {
		request, _ := http.NewRequest(http.MethodGet, "http://x/", nil)
		request.RemoteAddr = remote
		for _, value := range forwarded {
			request.Header.Add("X-Forwarded-For", value)
		}
		return ipKey(a.clientIP(request))
	}
	for _, check := range []struct{ got, want string }{
		{ip("203.0.113.9:5000"), "203.0.113.9"},
		{ip("203.0.113.9:5000", "198.51.100.1"), "203.0.113.9"},                   // untrusted peer: header ignored
		{ip("127.0.0.1:5000", "198.51.100.1"), "198.51.100.1"},                    // trusted proxy
		{ip("127.0.0.1:5000", "6.6.6.6, 198.51.100.1, 10.1.2.3"), "198.51.100.1"}, // forged left part skipped
		{ip("127.0.0.1:5000", "6.6.6.6", "198.51.100.1:443"), "198.51.100.1"},
		{ip("127.0.0.1:5000", "garbage, 198.51.100.1"), "198.51.100.1"},
		{ip("127.0.0.1:5000", "10.0.0.1, garbage"), "127.0.0.1"},
		{ip("127.0.0.1:5000"), "127.0.0.1"},
		{ip("[::ffff:203.0.113.9]:5000"), "203.0.113.9"},
		{ip("[2001:db8:1:2:3:4:5:6]:5000"), "2001:db8:1:2::/64"},
		{ip("127.0.0.1:5000", "2001:db8:1:2::99"), "2001:db8:1:2::/64"},
		{ip("bogus"), "unknown"},
	} {
		if check.got != check.want {
			t.Errorf("client %s, want %s", check.got, check.want)
		}
	}
	none := New(Options{TrustedProxies: []netip.Prefix{}})
	request, _ := http.NewRequest(http.MethodGet, "http://x/", nil)
	request.RemoteAddr = "127.0.0.1:1"
	request.Header.Set("X-Forwarded-For", "198.51.100.1")
	if got := none.clientIP(request).String(); got != "127.0.0.1" {
		t.Fatalf("no trusted proxies: %s", got)
	}
}

func TestGuestTicketsNeedConfiguration(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.heartbeat("game-g", "G", "", 5)
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-g"}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-g"}, map[string]string{"Authorization": "Basic x"}).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	guests := newHarness(t, harnessOptions{allowGuests: true})
	guests.heartbeat("game-g", "G", "", 5)
	guests.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-g"}, nil).expect(t, http.StatusOK, "")
}

func TestHeartbeatReportsConflicts(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.heartbeat("game-a", "A", "", 10)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-a", PlayerID: "p1", Name: "Winde"}).
		expect(t, http.StatusOK, "")
	var response contract.HeartbeatResponse
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "game-b", Name: "B", Capacity: 10,
		Players: []contract.OnlinePlayer{{PlayerID: "p7", Name: "WINDE"}, {PlayerID: "p8", Name: "Free"}}}).
		expect(t, http.StatusOK, "").json(t, &response)
	if !response.Accepted || len(response.Conflicts) != 1 || response.Conflicts[0] != "p7" {
		t.Fatalf("heartbeat %+v", response)
	}
	if body := string(h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "game-a", Capacity: 10,
		Players: []contract.OnlinePlayer{{PlayerID: "p1", Name: "Winde"}}}).body); bytes.Contains([]byte(body), []byte("conflicts")) {
		t.Fatalf("no conflicts must omit the field: %s", body)
	}
}

// TestHeartbeatReportsRates: game nodes scale the race.rewards they show by
// the rates the data service credits with.
func TestHeartbeatReportsRates(t *testing.T) {
	for _, rates := range []rewards.Rates{rewards.DefaultRates(), {Exp: 1.5, Lucci: 0}} {
		h := newHarness(t, harnessOptions{rates: &rates})
		var response contract.HeartbeatResponse
		h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "game-r", Name: "R", Capacity: 10}).
			expect(t, http.StatusOK, "").json(t, &response)
		if response.ExpRate == nil || response.LucciRate == nil ||
			*response.ExpRate != rates.Exp || *response.LucciRate != rates.Lucci {
			t.Fatalf("rates %+v: heartbeat answered expRate %v lucciRate %v", rates, response.ExpRate, response.LucciRate)
		}
	}
}

// stallAfterScript holds the first successful script reply once armed until
// the request gives up, as a slow Redis would.
type stallAfterScript struct {
	armed  atomic.Bool
	landed atomic.Bool
	check  func() bool
}

func (s *stallAfterScript) DialHook(next redis.DialHook) redis.DialHook { return next }
func (s *stallAfterScript) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (s *stallAfterScript) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		err := next(ctx, cmd)
		if (cmd.Name() == "evalsha" || cmd.Name() == "eval") && err == nil && s.armed.CompareAndSwap(true, false) {
			s.landed.Store(s.check())
			select {
			case <-ctx.Done():
			case <-time.After(5 * time.Second):
			}
		}
		return err
	}
}

func TestLateClaimIsReleased(t *testing.T) {
	hook := &stallAfterScript{}
	h := newHarness(t, harnessOptions{redisHook: hook})
	key := h.prefix + "presence:" + cache.FoldName("Latecomer")
	hook.check = func() bool { return h.redis.Exists(key) }
	h.heartbeat("game-a", "A", "", 10)

	hook.armed.Store(true)
	body, _ := json.Marshal(contract.PresenceClaimRequest{NodeID: "game-a", PlayerID: "p1", Name: "Latecomer"})
	request, _ := http.NewRequest(http.MethodPost, h.internal.URL+contract.PathPresenceClaim, bytes.NewReader(body))
	request.Header.Set(contract.ClusterKeyHeader, testSecret)
	if _, err := (&http.Client{Timeout: 300 * time.Millisecond}).Do(request); err == nil {
		t.Fatal("the stalled claim answered")
	}
	deadline := time.Now().Add(5 * time.Second)
	for h.redis.Exists(key) && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if !hook.landed.Load() {
		t.Fatal("the claim never landed; the test proves nothing")
	}
	if h.redis.Exists(key) {
		t.Fatal("a claim whose request was canceled stayed in Redis")
	}
	// The name is free for the player's retry under a new player id.
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-a", PlayerID: "p2", Name: "Latecomer"}).
		expect(t, http.StatusOK, "")
}
