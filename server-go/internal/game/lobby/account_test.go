package lobby

import (
	"net/http"
	"testing"
	"time"

	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

// One account has one session: a second hello of the same account (here
// after a rename, so the nickname check does not catch it) is 409
// ACCOUNT_ONLINE, also while the first hello is still claiming presence.
// Claims and releases carry the account ID so the data service enforces it
// cluster-wide.
func TestOneSessionPerAccount(t *testing.T) {
	h := newHarness(t)
	first := h.connectAccount("OldName", "acc-same")
	assertEqual(t, h.presence.claims[0], contract.PresenceClaimRequest{NodeID: testNodeID,
		PlayerID: first.playerID, Name: "OldName", AccountID: "acc-same"})

	renamed := h.newClient()
	_, err := h.raw(renamed, helloRequest("x", h.sign(ticket.Claims{AccountID: "acc-same", Nickname: "NewName"})))
	assertEqual(t, codeOf(t, err), "ACCOUNT_ONLINE")
	assertEqual(t, statusOf(t, err), http.StatusConflict)
	if renamed.playerID != "" || len(h.lobby.pending) != 0 || len(h.presence.claims) != 1 {
		t.Fatalf("refused hello admitted %q, pending %v, claims %v", renamed.playerID, h.lobby.pending, h.presence.claims)
	}
	// The nickname check keeps its Java place: the same name is NICKNAME_TAKEN.
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("x", h.sign(ticket.Claims{AccountID: "acc-same",
		Nickname: "OldName"}))), "NICKNAME_TAKEN")
	// Guests have no account.
	h.connect("GuestA")
	h.connect("GuestB")

	// Disconnecting releases the name and the account; the account may
	// then come back under its new name.
	h.lobby.Disconnect(first)
	assertEqual(t, h.presence.releases, []contract.PresenceReleaseRequest{{NodeID: testNodeID,
		PlayerID: first.playerID, Name: "OldName", AccountID: "acc-same"}})
	h.must(renamed, helloRequest("x", h.sign(ticket.Claims{AccountID: "acc-same", Nickname: "NewName"})))

	// A hello still claiming presence holds its account too.
	presence := &blockingPresence{block: "Racer", entered: make(chan struct{}), proceed: make(chan struct{})}
	h.lobby.presence = presence
	pendingClient := h.newClient()
	token := h.sign(ticket.Claims{AccountID: "acc-racer", Nickname: "Racer"})
	done := make(chan error, 1)
	go func() {
		_, err := h.raw(pendingClient, helloRequest("x", token))
		done <- err
	}()
	<-presence.entered
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("x", h.sign(ticket.Claims{AccountID: "acc-racer",
		Nickname: "Other"}))), "ACCOUNT_ONLINE")
	close(presence.proceed)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if pendingClient.accountID != "acc-racer" {
		t.Fatalf("account %q", pendingClient.accountID)
	}
}

// The data service's cluster-wide answer reaches the client unchanged.
func TestAccountOnlineElsewhereIsRefused(t *testing.T) {
	h := newHarness(t)
	h.presence.setErr(apierr.New(http.StatusConflict, "ACCOUNT_ONLINE"))
	c := h.newClient()
	_, err := h.raw(c, helloRequest("x", h.sign(ticket.Claims{AccountID: "acc-1", Nickname: "Racer"})))
	assertEqual(t, codeOf(t, err), "ACCOUNT_ONLINE")
	if c.playerID != "" || len(h.lobby.pending) != 0 {
		t.Fatal("refused hello was admitted")
	}
}

// Should two seats of one account ever share a room, start refuses (409
// ACCOUNT_ONLINE, after the Java checks), and a race rewards each account
// once, at its best-placed seat, with N counting distinct accounts.
func TestOneSeatPerAccountInRaces(t *testing.T) {
	h := newHarness(t)
	a1 := h.connectAccount("A1", "acc-1")
	a2 := h.connectAccount("A2", "acc-2")
	guest := h.connect("Guest")
	players := []*Client{a1, a2, guest}
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 3))
	roomID := room["roomId"].(string)
	alias := func() {
		h.lobby.mu.Lock()
		defer h.lobby.mu.Unlock()
		a2.accountID = "acc-1"
		h.lobby.rooms[roomID].member(a2.playerID).accountID = "acc-1"
	}
	alias()
	start := map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]}
	_, err := h.raw(a1, start)
	assertEqual(t, codeOf(t, err), "ACCOUNT_ONLINE")
	assertEqual(t, statusOf(t, err), http.StatusConflict)
	stale := map[string]any{"type": "start", "roomId": roomID, "revision": 1}
	assertEqual(t, h.errorCode(a1, stale), "STALE_REVISION") // Java checks first
	if h.lobby.rooms[roomID].phase != "open" {
		t.Fatal("refused start changed the phase")
	}

	// Rewards: the duplicate seat is left out even if it gets into a race.
	h.lobby.mu.Lock()
	a2.accountID = "acc-2"
	h.lobby.rooms[roomID].member(a2.playerID).accountID = "acc-2"
	h.lobby.mu.Unlock()
	raceID := raceOf(h.command(a1, start))["raceId"].(string)
	h.lobby.mu.Lock()
	h.lobby.rooms[roomID].race.rosterAccounts[a2.playerID] = "acc-1"
	h.lobby.mu.Unlock()
	for _, p := range players {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3 * time.Second)
	h.clock.Advance(60 * time.Second)
	for i, p := range []*Client{a2, a1, guest} {
		h.must(p, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 60_000 + i})
	}
	rc := raceOf(object(h.sink(guest).last(t)["room"]))
	// Results stay Java's: three ranked rows.
	assertEqual(t, len(list(rc["results"])), 3)
	// N = 2 (acc-1 and the guest): A2 (acc-1's best seat) is 1st, the guest
	// 2nd; A1 earns nothing.
	assertEqual(t, rc["rewards"], map[string]any{a2.playerID: reward(88, 120), guest.playerID: reward(33, 40)})
	assertEqual(t, h.recorder.settlements()[0].Rewards, []contract.RaceReward{
		{PlayerID: a2.playerID, AccountID: "acc-1", Exp: 88, Lucci: 120},
		{PlayerID: guest.playerID, Exp: 33, Lucci: 40},
	})
}
