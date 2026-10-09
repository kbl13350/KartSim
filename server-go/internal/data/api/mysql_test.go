package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode"
	"unicode/utf8"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

// These tests need KART_TEST_MYSQL_DSN; they skip otherwise.

const password = "a-local-password-123"

func TestAccountLifecycle(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true, registration: "invite"})
	u := datatest.Unique()
	// An existing account guarantees the new ones are not the first (admin).
	h.account("seed_"+u, "Seed"+u, password, false)

	user, nick := "user_"+u, "Nick"+u
	register := func(fields map[string]any) response {
		return h.post("/multiplayer/auth/register", fields, nil)
	}
	invite := h.invite()
	valid := func() map[string]any {
		return map[string]any{"username": user, "nickname": nick, "password": password, "invite": invite}
	}
	with := func(key string, value any) map[string]any {
		fields := valid()
		fields[key] = value
		return fields
	}
	register(with("username", "ab")).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("username", "bad-name")).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("nickname", "a<b")).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("nickname", strings.Repeat("名", 17))).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("password", "short")).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("password", "seven77")).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("password", strings.Repeat("p", 129))).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("password", nil)).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	register(with("invite", nil)).expect(t, http.StatusBadRequest, "INVALID_INVITE")
	register(with("invite", strings.Repeat("i", 129))).expect(t, http.StatusBadRequest, "INVALID_INVITE")
	register(with("invite", "no-such-invite-"+u)).expect(t, http.StatusBadRequest, "INVALID_INVITE")

	var created struct {
		Account publicAccount
		Token   string
	}
	register(valid()).expect(t, http.StatusOK, "").json(t, &created)
	id := h.accountID(user)
	if created.Account != (publicAccount{Nickname: nick, Admin: false, Username: user}) || !validToken(created.Token) {
		t.Fatalf("account %+v", created)
	}
	// Registration logs the player in.
	h.get("/multiplayer/auth/me", bearerHeader(created.Token)).expect(t, http.StatusOK, "")
	var usedBy string
	if err := h.db.QueryRow("SELECT used_by FROM invites WHERE code_hash = ?", digest(invite)).Scan(&usedBy); err != nil || usedBy != id {
		t.Fatalf("invite not consumed: %q %v", usedBy, err)
	}
	register(valid()).expect(t, http.StatusBadRequest, "INVALID_INVITE")
	second := h.invite()
	register(map[string]any{"username": strings.ToUpper(user), "nickname": "Other" + u, "password": password, "invite": second}).
		expect(t, http.StatusConflict, "USERNAME_TAKEN")
	register(map[string]any{"username": "other_" + u, "nickname": strings.ToLower(nick), "password": password, "invite": second}).
		expect(t, http.StatusConflict, "NICKNAME_TAKEN")

	// The stored hash keeps the Java format.
	var hash string
	if err := h.db.QueryRow("SELECT password_hash FROM accounts WHERE id = ?", id).Scan(&hash); err != nil ||
		!strings.HasPrefix(hash, "120000:") || !verifyPassword(password, hash) {
		t.Fatalf("hash %q %v", hash, err)
	}

	login := func(username, secret any) response {
		return h.post("/multiplayer/auth/login", map[string]any{"username": username, "password": secret}, nil)
	}
	login(user, "wrong-password-123").expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	login("nobody_"+u, password).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	login(nil, password).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	var session struct {
		Account publicAccount
		Token   string
	}
	login(strings.ToUpper(user), password).expect(t, http.StatusOK, "").json(t, &session)
	if !validToken(session.Token) || session.Account.Username != user {
		t.Fatalf("login %+v", session)
	}
	var expiresAt int64
	if err := h.db.QueryRow("SELECT expires_at FROM sessions WHERE token_hash = ?", digest(session.Token)).Scan(&expiresAt); err != nil {
		t.Fatal(err)
	}
	if lifetime := time.Until(time.UnixMilli(expiresAt)); lifetime < sessionLifetime-time.Minute || lifetime > sessionLifetime {
		t.Fatalf("session lifetime %s", lifetime)
	}

	me := func(token string) response { return h.get("/multiplayer/auth/me", bearerHeader(token)) }
	for range 2 { // the second answer comes from the session and account caches
		var body struct{ Account publicAccount }
		me(session.Token).expect(t, http.StatusOK, "").json(t, &body)
		if body.Account.Nickname != nick {
			t.Fatalf("me %+v", body)
		}
	}
	h.get("/multiplayer/auth/me", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	me(strings.Repeat("A", 43)).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")

	rename := func(token string, nickname any) response {
		return h.post("/multiplayer/auth/nickname", map[string]any{"nickname": nickname}, bearerHeader(token))
	}
	rename("x", "Bad<Name").expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	rename("x", "Fine"+u).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	rename(session.Token, "SEED"+u).expect(t, http.StatusConflict, "NICKNAME_TAKEN")
	var renamed struct{ Account publicAccount }
	rename(session.Token, "Ren"+u).expect(t, http.StatusOK, "").json(t, &renamed)
	if renamed.Account.Nickname != "Ren"+u {
		t.Fatalf("rename %+v", renamed)
	}
	rename(session.Token, strings.ToUpper("Ren"+u)).expect(t, http.StatusOK, "") // own name, other case
	var after struct{ Account publicAccount }
	me(session.Token).expect(t, http.StatusOK, "").json(t, &after)
	if after.Account.Nickname != strings.ToUpper("Ren"+u) {
		t.Fatalf("me after rename %+v (stale cache?)", after)
	}

	// Only admins create invitations.
	h.post("/multiplayer/admin/invites", nil, bearerHeader(session.Token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.post("/multiplayer/admin/invites", nil, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.account("admin_"+u, "Admin"+u, password, true)
	adminToken := h.login("admin_"+u, password)
	var newInvite struct{ Invite string }
	h.post("/multiplayer/admin/invites", nil, bearerHeader(adminToken)).expect(t, http.StatusOK, "").json(t, &newInvite)
	if len(newInvite.Invite) != 24 {
		t.Fatalf("invite %q", newInvite.Invite)
	}
	h.cleanup("DELETE FROM invites WHERE code_hash = ?", digest(newInvite.Invite))
	register(map[string]any{"username": "third_" + u, "nickname": "Third" + u, "password": password, "invite": newInvite.Invite}).
		expect(t, http.StatusOK, "")
	h.accountID("third_" + u)

	// Logout ends the session even though /me cached it.
	h.post("/multiplayer/auth/logout", nil, bearerHeader(session.Token)).expect(t, http.StatusOK, "")
	me(session.Token).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	if body := string(h.post("/multiplayer/auth/logout", nil, nil).expect(t, http.StatusOK, "").body); body != `{"ok":true}` {
		t.Fatalf("logout body %s", body)
	}
}

func TestProfileAndRecordOwnership(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	owner, key, otherKey := newUUID(), randomCode(32), randomCode(32)
	h.cleanup("DELETE FROM owner_keys WHERE owner_id = ?", owner)
	h.cleanup("DELETE FROM profiles WHERE owner_id = ?", owner)
	h.cleanup("DELETE FROM records WHERE owner_id = ?", owner)
	withKey := func(value string) map[string]string { return map[string]string{"X-Profile-Key": value} }
	profilePath := "/api/profile/" + owner

	h.get(profilePath, nil).expect(t, http.StatusForbidden, "PROFILE_KEY_REQUIRED")
	h.get(profilePath, withKey("short")).expect(t, http.StatusForbidden, "PROFILE_KEY_REQUIRED")
	h.get(profilePath, withKey(key)).expect(t, http.StatusNotFound, "PROFILE_NOT_FOUND")
	h.get("/api/records/"+owner, withKey(key)).expect(t, http.StatusNotFound, "PROFILE_NOT_FOUND")
	h.put(profilePath, "[1]", withKey(key)).expect(t, http.StatusBadRequest, "INVALID_DOCUMENT")
	h.put(profilePath, "{nope", withKey(key)).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.put(profilePath, "{}", nil).expect(t, http.StatusForbidden, "PROFILE_KEY_REQUIRED")
	h.put("/api/profile/nope", "{}", withKey(key)).expect(t, http.StatusBadRequest, "INVALID_OWNER_ID")

	// The first save (a record here) binds the owner to the key.
	recordPath := "/api/records/" + owner + "/best-lap"
	if body := string(h.put(recordPath, "[1, 2, {\"t\": 3}]", withKey(key)).expect(t, http.StatusOK, "").body); body != `[1,2,{"t":3}]` {
		t.Fatalf("record echo %s", body)
	}
	// The owner exists but has no profile yet: 404 with an empty body.
	if missing := h.get(profilePath, withKey(key)).expect(t, http.StatusNotFound, ""); len(missing.body) != 0 {
		t.Fatalf("missing profile body %q", missing.body)
	}
	if missing := h.get("/api/records/"+owner+"/other", withKey(key)).expect(t, http.StatusNotFound, ""); len(missing.body) != 0 {
		t.Fatalf("missing record body %q", missing.body)
	}

	h.put(profilePath, "{\n  \"name\": \"Ann\",\n  \"coins\": 5\n}", withKey(key)).expect(t, http.StatusOK, "")
	if body := string(h.get(profilePath, withKey(key)).expect(t, http.StatusOK, "").body); body != `{"name":"Ann","coins":5}` {
		t.Fatalf("profile %s", body)
	}
	h.put(profilePath, `{"name":"Mallory"}`, withKey(otherKey)).expect(t, http.StatusForbidden, "PROFILE_KEY_INVALID")
	h.get(profilePath, withKey(otherKey)).expect(t, http.StatusForbidden, "PROFILE_KEY_INVALID")
	h.get("/api/records/"+owner, withKey(otherKey)).expect(t, http.StatusForbidden, "PROFILE_KEY_INVALID")
	h.put(profilePath, `{"name":"Ann","coins":6}`, withKey(key)).expect(t, http.StatusOK, "")
	if body := string(h.get(profilePath, withKey(key)).body); body != `{"name":"Ann","coins":6}` {
		t.Fatalf("profile after update %s (stale cache?)", body)
	}
	if cached, _ := h.redis.Get(h.prefix + "profile:" + owner); cached != `{"name":"Ann","coins":6}` {
		t.Fatalf("write-through cache holds %q", cached)
	}

	// Size limits count UTF-16 units of the compact document.
	exact := `{"p":"` + strings.Repeat("x", maxProfileChars-8) + `"}`
	h.put(profilePath, exact, withKey(key)).expect(t, http.StatusOK, "")
	h.put(profilePath, `{"p":"`+strings.Repeat("x", maxProfileChars-7)+`"}`, withKey(key)).
		expect(t, http.StatusBadRequest, "INVALID_DOCUMENT")

	time.Sleep(5 * time.Millisecond)
	h.put("/api/records/"+owner+"/newest", `{"lap":1}`, withKey(key)).expect(t, http.StatusOK, "")
	h.put("/api/records/"+owner+"/bad.id", `{}`, withKey(key)).expect(t, http.StatusBadRequest, "INVALID_RECORD_ID")
	h.put("/api/records/"+owner+"/scalar", `5`, withKey(key)).expect(t, http.StatusBadRequest, "INVALID_DOCUMENT")
	var records []struct {
		RecordID  string
		Record    json.RawMessage
		UpdatedAt int64
	}
	h.get("/api/records/"+owner, withKey(key)).expect(t, http.StatusOK, "").json(t, &records)
	if len(records) != 2 || records[0].RecordID != "newest" || records[1].RecordID != "best-lap" ||
		string(records[1].Record) != `[1,2,{"t":3}]` || records[0].UpdatedAt < records[1].UpdatedAt {
		t.Fatalf("records %+v", records)
	}
	if body := string(h.get(recordPath, withKey(key)).expect(t, http.StatusOK, "").body); body != `[1,2,{"t":3}]` {
		t.Fatalf("record %s", body)
	}
	// Large records are stored but not cached.
	large := `{"g":"` + strings.Repeat("y", maxCachedRecord) + `"}`
	h.put("/api/records/"+owner+"/large", large, withKey(key)).expect(t, http.StatusOK, "")
	if body := h.get("/api/records/"+owner+"/large", withKey(key)).expect(t, http.StatusOK, "").body; string(body) != large {
		t.Fatal("large record round trip")
	}
	if cached, _ := h.redis.Get(h.prefix + "record:" + owner + ":large"); cached != "!" { // the cache marker
		t.Fatalf("large record cached: %d bytes", len(cached))
	}
}

// settle posts a settlement through the internal API.
func (h *harness) settle(settlement contract.RaceSettlement) contract.RaceSettlementResponse {
	h.t.Helper()
	h.cleanup("DELETE FROM race_results WHERE race_id = ?", settlement.RaceID)
	h.cleanup("DELETE FROM race_outcomes WHERE race_id = ?", settlement.RaceID)
	var result contract.RaceSettlementResponse
	h.call(contract.PathRaces, settlement).expect(h.t, http.StatusOK, "").json(h.t, &result)
	return result
}

func elapsed(ms int) *int { return &ms }

func TestSettlementIdempotencyAndStats(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	accountID := h.account("racer_"+u, "Racer"+u, password, false)
	race := func(raceID string, rank int, elapsedMs *int, points int) contract.RaceSettlement {
		return contract.RaceSettlement{
			NodeID: "game-1", RaceID: raceID, RoomID: "room-" + u, Mode: "individual", Gameplay: "ordinary",
			TrackID: "village_R01", Snapshot: json.RawMessage(`{"roomId":"room-` + u + `","race":{"id":"` + raceID + `"}}`),
			FinishedAt: time.Now().UnixMilli(),
			Results: []contract.RaceResult{
				{PlayerID: "p-acct-" + u, AccountID: accountID, Name: "Racer" + u, Rank: rank, ElapsedMs: elapsedMs, Points: points},
				{PlayerID: "p-guest-" + u, Name: "Guest" + u, Rank: 9, ElapsedMs: nil, Points: 0},
			},
		}
	}
	stats := func() map[string]any {
		var body map[string]any
		h.get("/api/player-stats?name="+url.QueryEscape(strings.ToUpper("Racer"+u)), nil).expect(t, http.StatusOK, "").json(t, &body)
		return body
	}
	expectStats := func(races, wins, podiums, points float64) {
		t.Helper()
		got := stats()
		if got["races"] != races || got["wins"] != wins || got["podiums"] != podiums || got["points"] != points ||
			got["nickname"] != "Racer"+u {
			t.Fatalf("stats %v, want races %v wins %v podiums %v points %v", got, races, wins, podiums, points)
		}
	}
	if got := stats(); got["races"] != float64(0) || got["updatedAt"] != float64(0) {
		t.Fatalf("stats before racing %v", got)
	}

	first := race("race-1-"+u, 1, elapsed(61_000), 10)
	if result := h.settle(first); !result.Stored || result.Duplicate {
		t.Fatalf("first settlement %+v", result)
	}
	expectStats(1, 1, 1, 10)
	if result := h.settle(first); !result.Stored || !result.Duplicate {
		t.Fatalf("repeat settlement %+v", result)
	}
	expectStats(1, 1, 1, 10)
	var rows int
	var storedAccount string
	if err := h.db.QueryRow("SELECT COUNT(*) FROM race_results WHERE race_id = ?", first.RaceID).Scan(&rows); err != nil || rows != 2 {
		t.Fatalf("result rows %d %v", rows, err)
	}
	if err := h.db.QueryRow("SELECT account_id FROM race_results WHERE race_id = ? AND player_id = ?",
		first.RaceID, "p-acct-"+u).Scan(&storedAccount); err != nil || storedAccount != accountID {
		t.Fatalf("account id %q %v", storedAccount, err)
	}

	h.settle(race("race-2-"+u, 3, nil, 5)) // did not finish: counts as a race only
	expectStats(2, 1, 1, 10)
	h.settle(race("race-3-"+u, 2, elapsed(70_000), 7))
	expectStats(3, 1, 2, 17)
	if got := stats(); got["updatedAt"].(float64) <= 0 {
		t.Fatalf("updatedAt %v", got)
	}

	// An unknown account id is stored with the result but has no stats.
	ghost := race("race-4-"+u, 1, elapsed(1), 1)
	ghost.Results[0].AccountID = newUUID()
	h.settle(ghost)
	expectStats(3, 1, 2, 17)

	h.get("/api/player-stats?name=Nobody"+u, nil).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
	h.get("/api/player-stats?name=Guest"+u, nil).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")

	invalid := race("race-5-"+u, 1, nil, 0)
	invalid.Snapshot = json.RawMessage(`[1]`)
	h.call(contract.PathRaces, invalid).expect(t, http.StatusBadRequest, "INVALID_SETTLEMENT")
	invalid = race("race-5-"+u, 1, nil, 0)
	invalid.Results[0].PlayerID = ""
	h.call(contract.PathRaces, invalid).expect(t, http.StatusBadRequest, "INVALID_SETTLEMENT")
}

func TestHistoryQueries(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	name := "Hist" + u

	// Cached empty answer first; a settlement must make it visible at once.
	var results []map[string]any
	h.get("/api/race-results?name="+name, nil).expect(t, http.StatusOK, "").json(t, &results)
	if len(results) != 0 {
		t.Fatalf("unexpected results %v", results)
	}
	base := time.Now().UnixMilli()
	for i, gameplay := range []string{"roadblock", "ordinary"} {
		h.settle(contract.RaceSettlement{
			NodeID: "game-1", RaceID: fmt.Sprintf("hist-%d-%s", i, u), RoomID: "room-" + u, Gameplay: gameplay,
			TrackID: "track", Snapshot: json.RawMessage(`{"n":` + fmt.Sprint(i) + `}`), FinishedAt: base + int64(i),
			Results: []contract.RaceResult{{PlayerID: "player-" + u, Name: name, Rank: 1, ElapsedMs: elapsed(5), Points: 3}},
		})
	}
	h.get("/api/race-results?name="+strings.ToLower(name), nil).expect(t, http.StatusOK, "").json(t, &results)
	if len(results) != 2 || results[0]["raceId"] != "hist-1-"+u || results[0]["elapsedMs"] != float64(5) ||
		results[0]["roomId"] != "room-"+u || results[0]["createdAt"] != float64(base+1) {
		t.Fatalf("results %v", results)
	}

	// LIMIT 100, newest first, ties broken by insertion order.
	for i := range 105 {
		datatest.Exec(t, h.db, "INSERT INTO race_results(room_id, race_id, player_id, name, `rank`, elapsed_ms, points, created_at)"+
			" VALUES(?, ?, ?, ?, 1, NULL, 0, ?)", "room-"+u, fmt.Sprintf("bulk-%03d-%s", i, u), "p", "Bulk"+u, base+int64(i/2))
	}
	h.cleanup("DELETE FROM race_results WHERE name = ?", "Bulk"+u)
	h.get("/api/race-results?name=Bulk"+u, nil).expect(t, http.StatusOK, "").json(t, &results)
	if len(results) != 100 || results[0]["raceId"] != "bulk-104-"+u || results[1]["raceId"] != "bulk-103-"+u ||
		results[0]["elapsedMs"] != nil || results[99]["raceId"] != "bulk-005-"+u {
		t.Fatalf("bulk results: %d, first %v, last %v", len(results), results[0], results[len(results)-1])
	}
	if raw := string(h.get("/api/race-results?name=Bulk"+u, nil).body); !strings.Contains(raw, `"elapsedMs":null`) {
		t.Fatal("elapsedMs must be present as null")
	}

	var outcomes []struct {
		RaceID, RoomID, Gameplay, TrackID string
		Snapshot                          json.RawMessage
		CreatedAt                         int64
	}
	h.get("/api/race-outcomes?gameplay=roadblock", nil).expect(t, http.StatusOK, "").json(t, &outcomes)
	found := false
	for _, outcome := range outcomes {
		if outcome.RaceID == "hist-0-"+u {
			found = outcome.Gameplay == "roadblock" && string(outcome.Snapshot) == `{"n":0}` && outcome.TrackID == "track"
		}
		if outcome.Gameplay != "roadblock" {
			t.Fatalf("gameplay filter leaked %+v", outcome)
		}
	}
	if !found {
		t.Fatal("roadblock outcome missing")
	}
	h.get("/api/race-outcomes", nil).expect(t, http.StatusOK, "").json(t, &outcomes)
	if len(outcomes) == 0 || len(outcomes) > 100 {
		t.Fatalf("outcomes %d", len(outcomes))
	}
}

// saveRoomRules posts room rules through the internal API.
func (h *harness) saveRoomRules(room, name string, at int64) {
	h.t.Helper()
	h.call(contract.PathRoomRules, contract.RoomRulesRequest{
		NodeID: "game-1", RoomID: room, Rules: json.RawMessage(`{"name":"` + name + `","capacity":8}`), UpdatedAt: at,
	}).expect(h.t, http.StatusOK, "")
}

// roomRules returns the listed settings and update time of room.
func (h *harness) roomRules(room string) (string, int64) {
	h.t.Helper()
	var rules []struct {
		RoomID    string
		Settings  json.RawMessage
		UpdatedAt int64
	}
	h.get("/api/room-rules", nil).expect(h.t, http.StatusOK, "").json(h.t, &rules)
	for _, rule := range rules {
		if rule.RoomID == room {
			return string(rule.Settings), rule.UpdatedAt
		}
	}
	return "", 0
}

func TestRoomRulesOrdering(t *testing.T) {
	// A clock ahead of real time keeps this room among the newest 100.
	clock := newFakeClock(time.Now().Add(time.Hour))
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	room := "room-rules-" + datatest.Unique()
	h.cleanup("DELETE FROM room_rules WHERE room_id = ?", room)
	save := func(name string, at int64) { h.saveRoomRules(room, name, at) }
	stored := func() (string, int64) { return h.roomRules(room) }
	base := clock.millis() - 10
	save("v1", base)
	if settings, at := stored(); settings != `{"name":"v1","capacity":8}` || at != base {
		t.Fatalf("v1: %s %d", settings, at)
	}
	save("v2", base+2)
	save("stale", base+1)
	if settings, at := stored(); settings != `{"name":"v2","capacity":8}` || at != base+2 {
		t.Fatalf("an older update overwrote a newer one: %s %d", settings, at)
	}
	save("v3", base+2)
	if settings, _ := stored(); settings != `{"name":"v3","capacity":8}` {
		t.Fatalf("equal timestamps must overwrite: %s", settings)
	}
	h.call(contract.PathRoomRules, contract.RoomRulesRequest{NodeID: "game-1", RoomID: room, Rules: json.RawMessage(`[]`), UpdatedAt: base}).
		expect(t, http.StatusBadRequest, "INVALID_ROOM_RULES")
	h.call(contract.PathRoomRules, contract.RoomRulesRequest{NodeID: "game-1", RoomID: room, Rules: json.RawMessage(`{}`)}).
		expect(t, http.StatusBadRequest, "INVALID_ROOM_RULES")
}

func TestAccountTickets(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	accountID := h.account("tick_"+u, "Tick"+u, password, true)
	token := h.login("tick_"+u, password)
	h.heartbeat("game-t", "T", "https://game.example", 5)

	// Guests are off by default: no Bearer, no ticket.
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-t"}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	// An account enters only after claiming the starter gift.
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-t"}, bearerHeader(token)).
		expect(t, http.StatusForbidden, "ONBOARDING_REQUIRED")
	h.claimStarter(token, 3, 6, 7)

	var issued contract.TicketResponse
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-t"}, bearerHeader(token)).
		expect(t, http.StatusOK, "").json(t, &issued)
	claims, err := ticket.Verify([]byte(testSecret), issued.Ticket, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if claims.Guest || claims.AccountID != accountID || claims.Username != "tick_"+u || claims.Nickname != "Tick"+u ||
		!claims.Admin || claims.NodeID != "game-t" || claims.DataNode != "data-test" {
		t.Fatalf("claims %+v", claims)
	}
	// An invalid session is rejected rather than downgraded to a guest ticket.
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "game-t"}, bearerHeader(randomCode(32))).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/multiplayer/game-servers/ticket", contract.TicketRequest{NodeID: "missing"}, bearerHeader(token)).
		expect(t, http.StatusNotFound, "GAME_SERVER_NOT_FOUND")
}

func TestGuestNameConsidersAccountsAndPresence(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	h.account("acct_"+u, "Owner"+u, password, false)
	available := func(name string) bool {
		var body struct{ Available bool }
		h.post("/multiplayer/auth/guest-name", map[string]string{"name": name}, nil).expect(t, http.StatusOK, "").json(t, &body)
		return body.Available
	}
	if available("OWNER" + u) {
		t.Fatal("account nickname offered to a guest")
	}
	guest := "Guest" + u
	if !available(guest) {
		t.Fatal("free name not available")
	}
	h.heartbeat("game-g", "G", "", 10)
	claim := func(request contract.PresenceClaimRequest) response {
		return h.call(contract.PathPresenceClaim, request)
	}
	claim(contract.PresenceClaimRequest{NodeID: "game-g", PlayerID: "p1", Name: guest, Guest: true}).expect(t, http.StatusOK, "")
	if available(strings.ToUpper(guest)) {
		t.Fatal("live name offered")
	}
	h.call(contract.PathPresenceRelease, contract.PresenceReleaseRequest{NodeID: "game-g", PlayerID: "p1", Name: guest}).
		expect(t, http.StatusOK, "")
	if !available(guest) {
		t.Fatal("released name still taken")
	}
	claim(contract.PresenceClaimRequest{NodeID: "game-g", PlayerID: "p1", Name: guest, Guest: true}).expect(t, http.StatusOK, "")
	h.redis.FastForward(16 * time.Second) // game-g stops heartbeating
	if !available(guest) {
		t.Fatal("name of a vanished node still taken")
	}

	claim(contract.PresenceClaimRequest{NodeID: "game-g", PlayerID: "p2", Name: " bad", Guest: true}).
		expect(t, http.StatusBadRequest, "INVALID_GUEST_NAME")
	claim(contract.PresenceClaimRequest{NodeID: "game-g", PlayerID: "p2", Name: "owner" + u, Guest: true}).
		expect(t, http.StatusConflict, "NICKNAME_TAKEN")
	// The account itself claims its nickname as a non-guest.
	claim(contract.PresenceClaimRequest{NodeID: "game-g", PlayerID: "p3", Name: "Owner" + u}).expect(t, http.StatusOK, "")
}

// TestFoldNameAgreesWithMySQL checks every letter FoldName changes against
// the nickname collation. A fold that merged two letters MySQL keeps apart
// would let a guest name pass the account check and still take the
// account's presence key. It catches Go Unicode table upgrades.
func TestFoldNameAgreesWithMySQL(t *testing.T) {
	db := datatest.MySQL(t)
	var selects []string
	for r := rune(0x20); r <= unicode.MaxRune; r++ {
		if !utf8.ValidRune(r) {
			continue
		}
		folded := cache.FoldName(string(r))
		if folded == string(r) {
			continue
		}
		selects = append(selects, fmt.Sprintf(
			"SELECT %d AS r, CONVERT(X'%x' USING utf8mb4) COLLATE utf8mb4_0900_as_ci = CONVERT(X'%x' USING utf8mb4) AS same",
			r, string(r), folded))
	}
	if len(selects) < 1000 {
		t.Fatalf("only %d folded letters", len(selects))
	}
	rows, err := db.Query("SELECT r FROM (" + strings.Join(selects, " UNION ALL ") + ") AS letters WHERE NOT (same <=> 1) ORDER BY r")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var distinct []string
	for rows.Next() {
		var r rune
		if err := rows.Scan(&r); err != nil {
			t.Fatal(err)
		}
		distinct = append(distinct, fmt.Sprintf("U+%04X", r))
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if len(distinct) > 0 {
		t.Fatalf("FoldName merges letters utf8mb4_0900_as_ci keeps apart (add them to collationDistinct): %v", distinct)
	}
}

func TestGuestLookalikesCannotLockOutAccounts(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	h.heartbeat("game-a", "A", "", 10)
	h.heartbeat("game-b", "B", "", 10)
	// Each guest name differs from the account nickname under the collation
	// (so the account check lets it through) but not under plain Unicode
	// case folding; the last pair is the reverse direction.
	pairs := []struct{ account, guest string }{
		{"Iz" + u, "İz" + u}, {"Si" + u, "Sı" + u}, {"sa" + u, "ſa" + u}, {"ლa" + u, "Ლa" + u},
		{"İzmir" + u, "Izmir" + u},
	}
	for i, pair := range pairs {
		h.account(fmt.Sprintf("look_%s_%d", u, i), pair.account, password, false)
		var body struct{ Available bool }
		h.post("/multiplayer/auth/guest-name", map[string]string{"name": pair.guest}, nil).
			expect(t, http.StatusOK, "").json(t, &body)
		if !body.Available {
			t.Fatalf("guest name %q not available", pair.guest)
		}
		h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{
			NodeID: "game-a", PlayerID: fmt.Sprintf("guest-%d", i), Name: pair.guest, Guest: true,
		}).expect(t, http.StatusOK, "")
		// The account still enters another node under its own nickname.
		h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{
			NodeID: "game-b", PlayerID: fmt.Sprintf("account-%d", i), Name: pair.account,
		}).expect(t, http.StatusOK, "")
	}
}

func TestRecordQuotaAndList(t *testing.T) {
	clock := newFakeClock(time.Now())
	quota := store.RecordQuota{Records: 3, Bytes: 64}
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now, recordQuota: &quota})
	owner, key := newUUID(), randomCode(32)
	h.cleanup("DELETE FROM owner_keys WHERE owner_id = ?", owner)
	h.cleanup("DELETE FROM profiles WHERE owner_id = ?", owner)
	h.cleanup("DELETE FROM records WHERE owner_id = ?", owner)
	withKey := map[string]string{"X-Profile-Key": key}
	path := func(id string) string { return "/api/records/" + owner + "/" + id }
	put := func(id, doc string) response {
		clock.advance(time.Millisecond) // distinct updatedAt values keep the list order fixed
		return h.put(path(id), doc, withKey)
	}

	h.put("/api/profile/"+owner, `{"profile":"not counted"}`, withKey).expect(t, http.StatusOK, "")
	if body := string(h.get("/api/records/"+owner, withKey).expect(t, http.StatusOK, "").body); body != "[]" {
		t.Fatalf("empty list %s", body)
	}
	put("r1", `{"n":1}`).expect(t, http.StatusOK, "")
	put("r2", `[1, 2]`).expect(t, http.StatusOK, "")
	put("r3", `{"n":3}`).expect(t, http.StatusOK, "")
	put("r4", `{}`).expect(t, http.StatusRequestEntityTooLarge, "STORAGE_QUOTA_EXCEEDED")
	put("r3", `{"n":33}`).expect(t, http.StatusOK, "") // replacing at the count limit
	// 7 + 5 bytes stay; r3 may grow to 52 bytes but not to 53.
	put("r3", `{"s":"`+strings.Repeat("x", 44)+`"}`).expect(t, http.StatusOK, "")
	put("r3", `{"s":"`+strings.Repeat("x", 45)+`"}`).expect(t, http.StatusRequestEntityTooLarge, "STORAGE_QUOTA_EXCEEDED")
	if body := string(h.get(path("r3"), withKey).expect(t, http.StatusOK, "").body); body != `{"s":"`+strings.Repeat("x", 44)+`"}` {
		t.Fatalf("rejected write visible: %s", body)
	}
	if body := h.get(path("r4"), withKey); body.status != http.StatusNotFound {
		t.Fatalf("rejected record stored: %d %s", body.status, body.body)
	}

	// The streamed list is byte-for-byte what the buffered one was.
	rows, err := h.db.Query("SELECT record_id, json, updated_at FROM records WHERE owner_id = ? ORDER BY updated_at DESC", owner)
	if err != nil {
		t.Fatal(err)
	}
	var items []recordItem
	for rows.Next() {
		var item recordItem
		var doc string
		if err := rows.Scan(&item.RecordID, &doc, &item.UpdatedAt); err != nil {
			t.Fatal(err)
		}
		item.Record = json.RawMessage(doc)
		items = append(items, item)
	}
	rows.Close()
	want, err := marshalJSON(items)
	if err != nil {
		t.Fatal(err)
	}
	list := h.get("/api/records/"+owner, withKey).expect(t, http.StatusOK, "")
	if string(list.body) != string(want) || list.header.Get("Content-Type") != "application/json" {
		t.Fatalf("list %s (%s), want %s", list.body, list.header.Get("Content-Type"), want)
	}
	if len(items) != 3 || items[0].RecordID != "r3" || items[1].RecordID != "r2" || string(items[1].Record) != "[1,2]" {
		t.Fatalf("records %s", want)
	}
}

func TestRecordQuotaHoldsUnderConcurrentSaves(t *testing.T) {
	quota := store.RecordQuota{Records: 5, Bytes: 1 << 20}
	h := newHarness(t, harnessOptions{mysql: true, recordQuota: &quota})
	owner, key := newUUID(), randomCode(32)
	h.cleanup("DELETE FROM owner_keys WHERE owner_id = ?", owner)
	h.cleanup("DELETE FROM records WHERE owner_id = ?", owner)
	h.put("/api/records/"+owner+"/first", `{}`, map[string]string{"X-Profile-Key": key}).expect(t, http.StatusOK, "")

	const writers = 12
	statuses := make(chan int, writers)
	var wg sync.WaitGroup
	for i := range writers {
		wg.Go(func() {
			request, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/records/%s/c%d", h.public.URL, owner, i), strings.NewReader(`{}`))
			request.Header.Set("X-Profile-Key", key)
			result, err := http.DefaultClient.Do(request)
			if err != nil {
				statuses <- 0
				return
			}
			_, _ = io.Copy(io.Discard, result.Body)
			result.Body.Close()
			statuses <- result.StatusCode
		})
	}
	wg.Wait()
	close(statuses)
	counts := map[int]int{}
	for status := range statuses {
		counts[status]++
	}
	if counts[http.StatusOK] != quota.Records-1 || counts[http.StatusRequestEntityTooLarge] != writers-(quota.Records-1) {
		t.Fatalf("statuses %v", counts)
	}
	var stored int
	if err := h.db.QueryRow("SELECT COUNT(*) FROM records WHERE owner_id = ?", owner).Scan(&stored); err != nil || stored != quota.Records {
		t.Fatalf("%d records stored, %v", stored, err)
	}
}

func TestPasswordHashingBusyKeepsInternalAPIResponsive(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	saved := pbkdf2Wait
	pbkdf2Wait = 100 * time.Millisecond
	release := func() {
		for len(pbkdf2Slots) > 0 {
			<-pbkdf2Slots
		}
	}
	t.Cleanup(func() {
		release()
		pbkdf2Wait = saved
	})
	for range cap(pbkdf2Slots) { // a login flood holds every hashing slot
		pbkdf2Slots <- struct{}{}
	}
	login := map[string]string{"username": "nobody_" + u, "password": password}
	h.post("/multiplayer/auth/login", login, nil).expect(t, http.StatusServiceUnavailable, "SERVER_BUSY")
	invite := h.invite()
	h.post("/multiplayer/auth/register", map[string]string{
		"username": "busy_" + u, "nickname": "Busy" + u, "password": password, "invite": invite,
	}, nil).expect(t, http.StatusServiceUnavailable, "SERVER_BUSY")
	var used sql.NullString
	if err := h.db.QueryRow("SELECT used_by FROM invites WHERE code_hash = ?", digest(invite)).Scan(&used); err != nil || used.Valid {
		t.Fatalf("invite consumed by a failed registration: %v %v", used, err)
	}
	// Game nodes' internal calls never wait for hashing.
	h.heartbeat("game-busy", "Busy", "", 5)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-busy", PlayerID: "p1", Name: "Busy" + u}).
		expect(t, http.StatusOK, "")

	release()
	h.post("/multiplayer/auth/login", login, nil).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
}

func TestPlayerStatsForAstralNicknames(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	nickname := strings.Repeat("🏁", 6) + u // 16 code points, 22 UTF-16 units
	accountID := h.account("flag_"+u, nickname, password, false)
	h.settle(contract.RaceSettlement{
		NodeID: "game-1", RaceID: "flag-race-" + u, RoomID: "room-" + u, Gameplay: "ordinary", TrackID: "track",
		Snapshot: json.RawMessage(`{}`), FinishedAt: time.Now().UnixMilli(),
		Results: []contract.RaceResult{{PlayerID: "p-" + u, AccountID: accountID, Name: nickname, Rank: 1, ElapsedMs: elapsed(1), Points: 10}},
	})
	var stats map[string]any
	h.get("/api/player-stats?name="+url.QueryEscape(nickname), nil).expect(t, http.StatusOK, "").json(t, &stats)
	if stats["nickname"] != nickname || stats["races"] != float64(1) || stats["wins"] != float64(1) {
		t.Fatalf("stats %v", stats)
	}
	h.get("/api/player-stats?name="+strings.Repeat("a", 19)+u, nil).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
}

func TestNodeTimestampsAreClampedToTheDataServiceClock(t *testing.T) {
	clock := newFakeClock(time.Now().Add(time.Hour)) // also keeps the room among the newest 100
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	now := clock.millis()
	const ahead = 20 * 60_000
	createdAt := func(raceID string) (int64, int64) {
		t.Helper()
		var outcome, result int64
		if err := h.db.QueryRow(`SELECT o.created_at, r.created_at FROM race_outcomes o
			JOIN race_results r ON r.race_id = o.race_id WHERE o.race_id = ?`, raceID).Scan(&outcome, &result); err != nil {
			t.Fatal(err)
		}
		return outcome, result
	}
	race := func(raceID string, finishedAt int64) contract.RaceSettlement {
		return contract.RaceSettlement{
			NodeID: "game-1", RaceID: raceID, RoomID: "room-" + u, Gameplay: "ordinary", TrackID: "track",
			Snapshot: json.RawMessage(`{}`), FinishedAt: finishedAt,
			Results: []contract.RaceResult{{PlayerID: "p-" + u, Name: "Clock" + u, Rank: 1, ElapsedMs: elapsed(5), Points: 1}},
		}
	}
	h.settle(race("ahead-"+u, now+ahead))
	if outcome, result := createdAt("ahead-" + u); outcome != now || result != now {
		t.Fatalf("future finish stored as %d/%d, want %d", outcome, result, now)
	}
	h.settle(race("late-"+u, now-60_000)) // a delayed outbox delivery keeps its time
	if outcome, _ := createdAt("late-" + u); outcome != now-60_000 {
		t.Fatalf("delayed finish stored as %d", outcome)
	}

	room := "room-clock-" + u
	h.cleanup("DELETE FROM room_rules WHERE room_id = ?", room)
	h.saveRoomRules(room, "ahead", now+ahead)
	if settings, at := h.roomRules(room); settings != `{"name":"ahead","capacity":8}` || at != now {
		t.Fatalf("future rules stored as %s at %d", settings, at)
	}
	// The node's clock is corrected: its next update must not be ignored.
	clock.advance(time.Millisecond)
	h.saveRoomRules(room, "next", now+1)
	if settings, at := h.roomRules(room); settings != `{"name":"next","capacity":8}` || at != now+1 {
		t.Fatalf("update after a clock correction: %s at %d", settings, at)
	}
	h.saveRoomRules(room, "stale", now)
	if settings, _ := h.roomRules(room); settings != `{"name":"next","capacity":8}` {
		t.Fatalf("an older update overwrote a newer one: %s", settings)
	}
}

func TestCachesDegradeWhenRedisFails(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	h.account("deg_"+u, "Deg"+u, password, false)
	owner, key := newUUID(), randomCode(32)
	h.cleanup("DELETE FROM owner_keys WHERE owner_id = ?", owner)
	h.cleanup("DELETE FROM profiles WHERE owner_id = ?", owner)
	withKey := map[string]string{"X-Profile-Key": key}
	h.put("/api/profile/"+owner, `{"v":1}`, withKey).expect(t, http.StatusOK, "")
	h.get("/api/profile/"+owner, withKey).expect(t, http.StatusOK, "")

	h.redis.SetError("ERR down")
	token := h.login("deg_"+u, password)
	h.get("/multiplayer/auth/me", bearerHeader(token)).expect(t, http.StatusOK, "")
	h.put("/api/profile/"+owner, `{"v":2}`, withKey).expect(t, http.StatusOK, "")
	if body := string(h.get("/api/profile/"+owner, withKey).expect(t, http.StatusOK, "").body); body != `{"v":2}` {
		t.Fatalf("degraded read %s", body)
	}
	h.get("/api/room-rules", nil).expect(t, http.StatusOK, "")
	h.post("/multiplayer/auth/guest-name", map[string]string{"name": "Free" + u}, nil).
		expect(t, http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")

	// Redis returns with the pre-outage profile still cached: never served.
	h.redis.SetError("")
	h.api.cache.Repair(context.Background()) // no-op while the outage window lasts
	if body := string(h.get("/api/profile/"+owner, withKey).body); body != `{"v":2}` {
		t.Fatalf("stale profile after the outage: %s", body)
	}
}

func TestBootstrapInvite(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true, registration: "invite"})
	code := "bootstrap-" + datatest.Unique()
	if err := h.api.Bootstrap(context.Background(), code); err != nil {
		t.Fatal(err)
	}
	var created, invites, accounts int
	if err := h.db.QueryRow("SELECT COUNT(*) FROM invites WHERE code_hash = ?", digest(code)).Scan(&created); err != nil {
		t.Fatal(err)
	}
	if created == 1 {
		// The database was empty: the configured code became the first invite.
		datatest.Exec(t, h.db, "DELETE FROM invites WHERE code_hash = ?", digest(code))
		return
	}
	// Otherwise invites or accounts existed, and nothing may have been added.
	if err := h.db.QueryRow("SELECT (SELECT COUNT(*) FROM invites), (SELECT COUNT(*) FROM accounts)").Scan(&invites, &accounts); err != nil {
		t.Fatal(err)
	}
	if invites+accounts == 0 {
		t.Fatal("empty database but no bootstrap invite")
	}
}
