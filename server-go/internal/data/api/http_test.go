package api

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/ticket"
)

// These tests need no MySQL: they cover routes that touch only Redis or nothing.

func TestHealthIceOffer(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	var health map[string]any
	h.get("/multiplayer/healthz", nil).expect(t, http.StatusOK, "").json(t, &health)
	if health["protocolVersion"] != float64(40) || health["ruleset"] != "launcher-room-v1" ||
		health["transport"] != "websocket" || health["service"] != "data" || health["dataNode"] != "data-test" {
		t.Fatalf("health %v", health)
	}
	if body := string(h.get("/multiplayer/ice", nil).expect(t, http.StatusOK, "").body); body != `{"iceServers":[]}` {
		t.Fatalf("ice %s", body)
	}
	h.post("/multiplayer/offer", "{}", nil).expect(t, http.StatusNotImplemented, "USE_LOCAL_WEBSOCKET")
	h.get("/multiplayer/nope", nil).expect(t, http.StatusNotFound, "NOT_FOUND")
	h.post("/multiplayer/healthz", "{}", nil).expect(t, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED")
}

func TestAuthConfig(t *testing.T) {
	h := newHarness(t, harnessOptions{network: netcfg.New("192.168.1.8")})
	address := h.public.Listener.Addr().String()
	port := address[strings.LastIndex(address, ":")+1:]
	config := func(host string, headers map[string]string) response {
		request, _ := http.NewRequest(http.MethodGet, h.public.URL+"/multiplayer/auth/config", nil)
		request.Host = host
		for name, value := range headers {
			request.Header.Set(name, value)
		}
		result, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer result.Body.Close()
		data, err := io.ReadAll(result.Body)
		if err != nil {
			t.Fatal(err)
		}
		return response{status: result.StatusCode, body: data}
	}
	const accounts = `,"registration":"open","guests":false}`
	for _, host := range []string{"localhost", "127.0.0.1", "192.168.1.8", "LOCALHOST:5173"} {
		got := string(config(host, nil).expect(t, http.StatusOK, "").body)
		want := `{"loginRequired":true,"backendOrigin":"http://` + strings.ToLower(strings.Split(host, ":")[0]) + ":" + port + `"` + accounts
		if got != want {
			t.Fatalf("host %s: %s, want %s", host, got, want)
		}
	}
	config("example.com", nil).expect(t, http.StatusBadRequest, "INVALID_HOST")
	if got := string(config("example.com", map[string]string{"X-Forwarded-Host": "192.168.1.8:8780, proxy"}).
		expect(t, http.StatusOK, "").body); got != `{"loginRequired":true,"backendOrigin":null`+accounts {
		t.Fatalf("forwarded: %s", got)
	}
	config("localhost", map[string]string{"X-Forwarded-Host": "evil.example"}).expect(t, http.StatusBadRequest, "INVALID_HOST")

	// IPv6 literals keep their brackets (Java getServerName did).
	anyHost := newHarness(t, harnessOptions{network: netcfg.New("*"), registration: "invite", allowGuests: true})
	anyAddress := anyHost.public.Listener.Addr().String()
	anyPort := anyAddress[strings.LastIndex(anyAddress, ":")+1:]
	request, _ := http.NewRequest(http.MethodGet, anyHost.public.URL+"/multiplayer/auth/config", nil)
	request.Host = "[FE80::1]:8787"
	result, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	ipv6, _ := io.ReadAll(result.Body)
	result.Body.Close()
	if want := `{"loginRequired":true,"backendOrigin":"http://[fe80::1]:` + anyPort + `","registration":"invite","guests":true}`; string(ipv6) != want {
		t.Fatalf("IPv6 host: %s, want %s", ipv6, want)
	}
	if _, err := url.Parse("http://[fe80::1]:" + anyPort); err != nil {
		t.Fatal(err)
	}

	withOrigin := newHarness(t, harnessOptions{publicOrigin: "https://kart.example.com", registration: "closed"})
	request, _ = http.NewRequest(http.MethodGet, withOrigin.public.URL+"/multiplayer/auth/config", nil)
	request.Host = "anything.example"
	result, err = http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	fixed, _ := io.ReadAll(result.Body)
	result.Body.Close()
	if want := `{"loginRequired":true,"backendOrigin":"https://kart.example.com","registration":"closed","guests":false}`; result.StatusCode != http.StatusOK || string(fixed) != want {
		t.Fatalf("public origin config %d %s, want %s", result.StatusCode, fixed, want)
	}
}

func TestCORS(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	preflight := send(t, http.MethodOptions, h.public.URL+"/api/profile/x", nil, map[string]string{
		"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PUT",
		"Access-Control-Request-Headers": "content-type, x-profile-key",
	})
	if preflight.status != http.StatusOK || preflight.header.Get("Access-Control-Allow-Origin") != "http://localhost:5173" ||
		preflight.header.Get("Access-Control-Allow-Headers") != "Content-Type,X-Profile-Key" {
		t.Fatalf("preflight %d %v", preflight.status, preflight.header)
	}
	if got := h.get("/multiplayer/healthz", map[string]string{"Origin": "http://evil.example"}); got.status != http.StatusForbidden {
		t.Fatalf("untrusted origin status %d", got.status)
	}
	if got := h.get("/multiplayer/healthz", map[string]string{"Origin": "http://127.0.0.1:5173"}); got.status != http.StatusOK ||
		got.header.Get("Access-Control-Allow-Origin") != "http://127.0.0.1:5173" {
		t.Fatalf("trusted origin %d %v", got.status, got.header)
	}
}

func TestInternalAuth(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	body := contract.NodeLeaveRequest{NodeID: "game-1"}
	send(t, http.MethodPost, h.internal.URL+contract.PathNodeLeave, body, nil).expect(t, http.StatusUnauthorized, "CLUSTER_KEY_INVALID")
	send(t, http.MethodPost, h.internal.URL+contract.PathNodeLeave, body,
		map[string]string{contract.ClusterKeyHeader: testSecret + "x"}).expect(t, http.StatusUnauthorized, "CLUSTER_KEY_INVALID")
	h.call(contract.PathNodeLeave, body).expect(t, http.StatusOK, "")
	h.call("/internal/v1/unknown", body).expect(t, http.StatusNotFound, "NOT_FOUND")
	send(t, http.MethodGet, h.internal.URL+contract.PathHeartbeat, nil,
		map[string]string{contract.ClusterKeyHeader: testSecret}).expect(t, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED")
	h.call(contract.PathHeartbeat, "not json").expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "bad id"}).expect(t, http.StatusBadRequest, "INVALID_NODE_ID")
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "game-1", Origin: "ftp://x"}).
		expect(t, http.StatusBadRequest, "INVALID_HEARTBEAT")
}

func TestGameServersAndGuestTickets(t *testing.T) {
	h := newHarness(t, harnessOptions{allowGuests: true})
	var list contract.GameServerList
	h.get("/multiplayer/game-servers", nil).expect(t, http.StatusOK, "").json(t, &list)
	if list.DataNode != "data-test" || list.Servers == nil || len(list.Servers) != 0 {
		t.Fatalf("empty list %+v", list)
	}
	if body := string(h.get("/multiplayer/game-servers", nil).body); !strings.Contains(body, `"servers":[]`) {
		t.Fatalf("empty servers must be [] not null: %s", body)
	}
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-x"}, nil).
		expect(t, http.StatusNotFound, "GAME_SERVER_NOT_FOUND")
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "../x"}, nil).
		expect(t, http.StatusNotFound, "GAME_SERVER_NOT_FOUND")
	h.post("/multiplayer/game-servers/ticket", "[]", nil).expect(t, http.StatusBadRequest, "INVALID_REQUEST")

	h.heartbeat("game-b", "Beta", "http://127.0.0.1:8788/", 2, contract.OnlinePlayer{PlayerID: "p1", Name: "Ann"})
	h.heartbeat("game-a", "Alpha", "", 1, contract.OnlinePlayer{PlayerID: "p2", Name: "Ben"})
	h.get("/multiplayer/game-servers", nil).expect(t, http.StatusOK, "").json(t, &list)
	if len(list.Servers) != 2 {
		t.Fatalf("servers %+v", list.Servers)
	}
	alpha, beta := list.Servers[0], list.Servers[1]
	if alpha.NodeID != "game-a" || alpha.Origin != nil || !alpha.Full || alpha.Players != 1 || alpha.Capacity != 1 {
		t.Fatalf("alpha %+v", alpha)
	}
	if beta.NodeID != "game-b" || beta.Origin == nil || *beta.Origin != "http://127.0.0.1:8788" || beta.Full {
		t.Fatalf("beta %+v", beta)
	}

	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-a"}, nil).
		expect(t, http.StatusServiceUnavailable, "GAME_SERVER_FULL")
	var issued contract.TicketResponse
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-b"}, nil).
		expect(t, http.StatusOK, "").json(t, &issued)
	claims, err := ticket.Verify([]byte(testSecret), issued.Ticket, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if !claims.Guest || claims.NodeID != "game-b" || claims.DataNode != "data-test" || claims.AccountID != "" ||
		claims.ExpiresAt != issued.ExpiresAt || issued.NodeID != "game-b" || issued.DataNode != "data-test" ||
		issued.Origin == nil || *issued.Origin != "http://127.0.0.1:8788" {
		t.Fatalf("ticket %+v claims %+v", issued, claims)
	}
	if ttl := time.Until(time.UnixMilli(issued.ExpiresAt)); ttl > ticket.TTL || ttl < ticket.TTL-time.Minute {
		t.Fatalf("ticket lifetime %s", ttl)
	}
	var second contract.TicketResponse
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-b"}, nil).json(t, &second)
	if second.Ticket == issued.Ticket {
		t.Fatal("tickets must be one-time (distinct nonces)")
	}
	// A Bearer header requires a valid session; malformed tokens fail before MySQL.
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-b"}, bearerHeader("short")).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	// Other schemes (and a bare "Bearer", whose trailing space HTTP trims) are not a Bearer token.
	for _, value := range []string{"Basic abc", "Bearer "} {
		var guest contract.TicketResponse
		h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-b"}, map[string]string{"Authorization": value}).
			expect(t, http.StatusOK, "").json(t, &guest)
		if claims, err := ticket.Verify([]byte(testSecret), guest.Ticket, time.Now()); err != nil || !claims.Guest {
			t.Fatalf("%q: %+v %v", value, claims, err)
		}
	}

	// The node expires without heartbeats.
	h.redis.FastForward(16 * time.Second)
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-b"}, nil).
		expect(t, http.StatusNotFound, "GAME_SERVER_NOT_FOUND")
}

func TestAccountPresenceClaims(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.heartbeat("game-a", "A", "", 10)
	h.heartbeat("game-b", "B", "", 10)
	claim := contract.PresenceClaimRequest{NodeID: "game-a", PlayerID: "p1", Name: "Winde"}
	h.call(contract.PathPresenceClaim, claim).expect(t, http.StatusOK, "")
	h.call(contract.PathPresenceClaim, claim).expect(t, http.StatusOK, "")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-b", PlayerID: "p2", Name: "WINDE"}).
		expect(t, http.StatusConflict, "NICKNAME_TAKEN")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-b", PlayerID: "", Name: "x"}).
		expect(t, http.StatusBadRequest, "INVALID_PLAYER_ID")
	h.call(contract.PathPresenceRelease, contract.PresenceReleaseRequest{NodeID: "game-a", PlayerID: "p1", Name: "winde"}).
		expect(t, http.StatusOK, "")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-b", PlayerID: "p2", Name: "WINDE"}).
		expect(t, http.StatusOK, "")
	// Leaving frees the node's names immediately.
	h.call(contract.PathNodeLeave, contract.NodeLeaveRequest{NodeID: "game-b"}).expect(t, http.StatusOK, "")
	h.call(contract.PathPresenceClaim, claim).expect(t, http.StatusOK, "")
}

func TestClusterEndpointsNeedRedis(t *testing.T) {
	h := newHarness(t, harnessOptions{allowGuests: true})
	h.redis.SetError("ERR down")
	h.get("/multiplayer/game-servers", nil).expect(t, http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-a"}, nil).
		expect(t, http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "game-a", Capacity: 1}).
		expect(t, http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-a", PlayerID: "p", Name: "n"}).
		expect(t, http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
}

func TestRequestLimits(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	huge := `{"name":"` + strings.Repeat("a", maxBodyBytes) + `"}`
	h.post("/multiplayer/auth/guest-name", huge, nil).expect(t, http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE")
	h.post("/multiplayer/auth/guest-name", "{", nil).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post("/multiplayer/auth/guest-name", "null", nil).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post("/multiplayer/auth/guest-name", `{"name":{"a":1}}`, nil).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post("/multiplayer/auth/guest-name", "{\"name\":\"\xff\"}", nil).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post("/multiplayer/auth/guest-name", `{"name":" padded"}`, nil).expect(t, http.StatusBadRequest, "INVALID_GUEST_NAME")
	h.post("/multiplayer/auth/guest-name", `{}`, nil).expect(t, http.StatusBadRequest, "INVALID_GUEST_NAME")
	// Path validation runs before any storage access.
	h.get("/api/profile/not-a-uuid", nil).expect(t, http.StatusBadRequest, "INVALID_OWNER_ID")
	h.get("/api/records/1-2-3-4-5/bad.id", nil).expect(t, http.StatusBadRequest, "INVALID_RECORD_ID")
	h.get("/api/profile/1-2-3-4-5", nil).expect(t, http.StatusForbidden, "PROFILE_KEY_REQUIRED")
	h.get("/api/race-results?name=%20", nil).expect(t, http.StatusBadRequest, "INVALID_NAME")
	h.get("/api/race-results?name="+url.QueryEscape(strings.Repeat("a", 19)), nil).expect(t, http.StatusBadRequest, "INVALID_NAME")
	h.get("/api/race-outcomes?gameplay=chess", nil).expect(t, http.StatusBadRequest, "INVALID_GAMEPLAY")
	h.get("/api/player-stats", nil).expect(t, http.StatusBadRequest, "INVALID_NAME")
	h.get("/api/player-stats?name=%20%20", nil).expect(t, http.StatusBadRequest, "INVALID_NAME")
	h.get("/api/player-stats?name=a%07b", nil).expect(t, http.StatusBadRequest, "INVALID_NAME")
	h.get("/api/player-stats?name=%FF", nil).expect(t, http.StatusBadRequest, "INVALID_NAME")
	// Longer than any nickname column value: no account can have it (no MySQL query).
	h.get("/api/player-stats?name="+url.QueryEscape(strings.Repeat("名", 65)), nil).
		expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
}

func TestPasswordHashingIsBounded(t *testing.T) {
	saved := pbkdf2Wait
	pbkdf2Wait = 50 * time.Millisecond
	t.Cleanup(func() { pbkdf2Wait = saved })
	for range cap(pbkdf2Slots) {
		pbkdf2Slots <- struct{}{}
	}
	ran := false
	started := time.Now()
	if err := withPasswordSlot(context.Background(), func() { ran = true }); err != errServerBusy || ran {
		t.Fatalf("saturated: %v, ran %v", err, ran)
	}
	if waited := time.Since(started); waited < pbkdf2Wait || waited > 5*time.Second {
		t.Fatalf("waited %s", waited)
	}
	canceled, cancel := context.WithCancel(context.Background())
	cancel()
	if err := withPasswordSlot(canceled, func() { ran = true }); err != errServerBusy || ran {
		t.Fatalf("canceled: %v, ran %v", err, ran)
	}
	<-pbkdf2Slots
	if err := withPasswordSlot(context.Background(), func() { ran = true }); err != nil || !ran {
		t.Fatalf("free slot: %v, ran %v", err, ran)
	}
	for range cap(pbkdf2Slots) - 1 {
		<-pbkdf2Slots
	}
	if len(pbkdf2Slots) != 0 {
		t.Fatalf("%d slots still held", len(pbkdf2Slots))
	}
}
