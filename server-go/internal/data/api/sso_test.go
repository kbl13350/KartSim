package api

import (
	"net/http"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/shared/contract"
)

// A new login ends the account's other sessions: their tokens answer
// SESSION_REPLACED, and the game node serving the account is told to
// disconnect it at its next heartbeat.
func TestLoginReplacesOtherSessions(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	name := "sso" + datatest.Unique()[:8]
	nickname := "单点" + datatest.Unique()[:6]
	id := h.account(name, nickname, "password-1", false)
	first := h.login(name, "password-1")
	h.get("/api/account", bearerHeader(first)).expect(t, http.StatusOK, "")

	// The first login is playing on a game node.
	h.heartbeat("node-a", "A", "", 10)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "node-a", PlayerID: "p-first",
		Name: nickname, AccountID: id}).expect(t, http.StatusOK, "")
	h.heartbeat("node-a", "A", "", 10, contract.OnlinePlayer{PlayerID: "p-first", Name: nickname})

	second := h.login(name, "password-1")
	h.get("/api/account", bearerHeader(first)).expect(t, http.StatusUnauthorized, "SESSION_REPLACED")
	h.get("/api/account", bearerHeader(second)).expect(t, http.StatusOK, "")

	// The node learns at its next heartbeat; the new login can claim at once.
	var beat contract.HeartbeatResponse
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "node-a", Name: "A", Capacity: 10,
		Players:         []contract.OnlinePlayer{{PlayerID: "p-first", Name: nickname}},
		ProtocolVersion: contract.ProtocolVersion}).expect(t, http.StatusOK, "").json(t, &beat)
	if len(beat.Conflicts) != 1 || beat.Conflicts[0] != "p-first" {
		t.Fatalf("conflicts %v", beat.Conflicts)
	}
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "node-b", PlayerID: "p-second",
		Name: nickname, AccountID: id}).expect(t, http.StatusOK, "")

	// Logging out the old token is harmless; an unknown token stays LOGIN_REQUIRED.
	h.post("/multiplayer/auth/logout", nil, bearerHeader(first)).expect(t, http.StatusOK, "")
	h.get("/api/account", bearerHeader(second)).expect(t, http.StatusOK, "")
	h.get("/api/account", bearerHeader("x"+first[1:])).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}

// An admin opening the console keeps its game login.
func TestConsoleLoginKeepsTheGameSession(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	name := "ssoadm" + datatest.Unique()[:8]
	h.account(name, "管理"+datatest.Unique()[:6], "password-1", true)
	game := h.login(name, "password-1")
	var console struct{ Token string }
	h.post("/multiplayer/auth/login", map[string]any{"username": name, "password": "password-1", "console": true}, nil).
		expect(t, http.StatusOK, "").json(t, &console)
	h.get("/api/account", bearerHeader(game)).expect(t, http.StatusOK, "")
	h.get("/api/account", bearerHeader(console.Token)).expect(t, http.StatusOK, "")

	// A player's "console" login is an ordinary one.
	player := "ssoply" + datatest.Unique()[:8]
	h.account(player, "玩家"+datatest.Unique()[:6], "password-1", false)
	first := h.login(player, "password-1")
	h.post("/multiplayer/auth/login", map[string]any{"username": player, "password": "password-1", "console": true}, nil).
		expect(t, http.StatusOK, "")
	h.get("/api/account", bearerHeader(first)).expect(t, http.StatusUnauthorized, "SESSION_REPLACED")
}
