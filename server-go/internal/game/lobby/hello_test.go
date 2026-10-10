package lobby

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

func TestHelloTicketAdmission(t *testing.T) {
	h := newHarness(t)
	reused := h.guestTicket()
	h.must(h.newClient(), helloRequest("First", reused))
	expired, _ := ticket.Sign([]byte(testSecret), ticket.Claims{NodeID: testNodeID,
		DataNode: testDataNode, Guest: true}, h.now().Add(-3*time.Minute))
	forged, _ := ticket.Sign([]byte("another-secret-another-secret-0123"), ticket.Claims{
		NodeID: testNodeID, DataNode: testDataNode, Guest: true}, h.now())

	for _, tc := range []struct {
		name   string
		ticket any
		code   string
	}{
		{"missing", nil, "TICKET_REQUIRED"},
		{"null", "null", "TICKET_REQUIRED"},
		{"number", 5, "TICKET_INVALID"},
		{"garbage", "kt1.nope", "TICKET_INVALID"},
		{"empty", "", "TICKET_INVALID"},
		{"forged", forged, "TICKET_INVALID"},
		{"expired", expired, "TICKET_EXPIRED"},
		{"wrong node", h.sign(ticket.Claims{NodeID: "game-other", Guest: true}), "TICKET_WRONG_NODE"},
		{"wrong data node", h.sign(ticket.Claims{DataNode: "data-other", Guest: true}), "DATA_NODE_MISMATCH"},
		{"reused", reused, "TICKET_REUSED"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := helloRequest("Second", "")
			switch tc.ticket {
			case nil:
				delete(request, "ticket")
			case "null":
				request["ticket"] = nil
			default:
				request["ticket"] = tc.ticket
			}
			c := h.newClient()
			if code := h.errorCode(c, request); code != tc.code {
				t.Fatalf("got %s, want %s", code, tc.code)
			}
			if c.playerID != "" {
				t.Fatal("rejected hello connected the client")
			}
		})
	}
}

func TestHelloStatusCodes(t *testing.T) {
	h := newHarness(t)
	_, err := h.raw(h.newClient(), helloRequest("A", h.sign(ticket.Claims{NodeID: "x", Guest: true})))
	var rejected *apierr.Error
	if !errors.As(err, &rejected) || rejected.Status != http.StatusForbidden {
		t.Fatalf("wrong node status: %v", err)
	}
	_, err = h.raw(h.newClient(), helloRequest("A", "bad"))
	if !errors.As(err, &rejected) || rejected.Status != http.StatusUnauthorized {
		t.Fatalf("invalid ticket status: %v", err)
	}
}

func TestHelloValidationOrderMatchesJava(t *testing.T) {
	h := newHarness(t)
	request := func(mutate func(map[string]any)) map[string]any {
		r := helloRequest("Alice", "")
		delete(r, "ticket")
		mutate(r)
		return r
	}
	for _, tc := range []struct {
		name   string
		mutate func(map[string]any)
		code   string
	}{
		{"protocol before ticket", func(r map[string]any) { r["protocolVersion"] = 38 }, "PROTOCOL_MISMATCH"},
		{"protocol type", func(r map[string]any) { r["protocolVersion"] = 40.0 + 0.5 }, "INVALID_PROTOCOLVERSION"},
		{"ruleset", func(r map[string]any) { r["ruleset"] = "other" }, "PROTOCOL_MISMATCH"},
		{"resource version", func(r map[string]any) { r["resourceVersion"] = "p9999" }, "RESOURCE_VERSION_UNSUPPORTED"},
		{"name", func(r map[string]any) { r["name"] = "" }, "INVALID_NAME"},
		{"ticket last", func(map[string]any) {}, "TICKET_REQUIRED"},
	} {
		if code := h.errorCode(h.newClient(), request(tc.mutate)); code != tc.code {
			t.Errorf("%s: got %s, want %s", tc.name, code, tc.code)
		}
	}
	// A guest name must also pass the account rules (validName).
	for _, name := range []string{"<b>", " Alice", "Alice ", "a>b"} {
		if code := h.errorCode(h.newClient(), helloRequest(name, h.guestTicket())); code != "INVALID_GUEST_NAME" {
			t.Errorf("guest name %q: %s", name, code)
		}
	}
	// Invalid initial is rejected before the presence claim.
	r := helloRequest("Alice", h.guestTicket())
	r["initial"] = 5
	if code := h.errorCode(h.newClient(), r); code != "INVALID_INITIAL" {
		t.Fatalf("initial: %s", code)
	}
	if len(h.presence.claims) != 0 {
		t.Fatal("rejected hellos claimed presence")
	}
}

func TestHelloNamesAndPresence(t *testing.T) {
	h := newHarness(t)
	alice := h.newClient()
	welcome := h.must(alice, helloRequest("Alice", h.guestTicket()))
	assertEqual(t, welcome, map[string]any{"type": "welcome", "playerId": alice.playerID,
		"protocolVersion": 40, "ruleset": "launcher-room-v1", "capabilities": []any{}})
	assertEqual(t, h.presence.claims, []contract.PresenceClaimRequest{{NodeID: testNodeID,
		PlayerID: alice.playerID, Name: "Alice", Guest: true}})
	assertEqual(t, h.errorCode(alice, helloRequest("Other", h.guestTicket())), "ALREADY_CONNECTED")
	// Names are unique on the node regardless of case.
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("ALICE", h.guestTicket())), "NICKNAME_TAKEN")

	// An account uses the ticket's nickname and carries its account ID.
	account := h.newClient()
	h.must(account, helloRequest("ignored", h.sign(ticket.Claims{AccountID: "acc-1",
		Username: "racer", Nickname: "Racer"})))
	if account.name != "Racer" || account.accountID != "acc-1" {
		t.Fatalf("account client %q %q", account.name, account.accountID)
	}
	last := h.presence.claims[len(h.presence.claims)-1]
	if last.Name != "Racer" || last.Guest {
		t.Fatalf("account claim %+v", last)
	}

	// The data service decides cluster-wide names.
	h.presence.setErr(apierr.New(http.StatusConflict, "NICKNAME_TAKEN"))
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("Bob", h.guestTicket())), "NICKNAME_TAKEN")
	h.presence.setErr(errors.New("dial tcp: connection refused"))
	bob := h.newClient()
	assertEqual(t, h.errorCode(bob, helloRequest("Bob", h.guestTicket())), "DATA_SERVICE_UNAVAILABLE")
	h.presence.setErr(nil)
	// The failed hello left nothing reserved: the same connection can retry.
	h.must(bob, helloRequest("Bob", h.guestTicket()))

	// Disconnect releases the room and the live name.
	h.lobby.Disconnect(alice)
	assertEqual(t, h.presence.releases, []contract.PresenceReleaseRequest{{NodeID: testNodeID,
		PlayerID: alice.playerID, Name: "Alice"}})
	h.must(h.newClient(), helloRequest("alice", h.guestTicket()))
	players, rooms := h.lobby.Online()
	if len(players) != 3 || rooms != 0 {
		t.Fatalf("online %v rooms %d", players, rooms)
	}
}

func TestHelloServerFull(t *testing.T) {
	h := newHarness(t)
	h.lobby.maxPlayers = 1
	h.connect("Alice")
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("Bob", h.guestTicket())), "SERVER_FULL")
}

// blockingPresence holds the claim of one name until proceed is closed.
type blockingPresence struct {
	fakePresence
	block   string
	entered chan struct{}
	proceed chan struct{}
}

func (p *blockingPresence) Claim(ctx context.Context, req contract.PresenceClaimRequest) error {
	if req.Name == p.block {
		p.entered <- struct{}{}
		<-p.proceed
	}
	return p.fakePresence.Claim(ctx, req)
}

func TestHelloReservesTheNameWhileClaiming(t *testing.T) {
	h := newHarness(t)
	presence := &blockingPresence{block: "Alice", entered: make(chan struct{}),
		proceed: make(chan struct{})}
	h.lobby.presence = presence
	first := h.newClient()
	firstTicket := h.guestTicket()
	var wg sync.WaitGroup
	wg.Add(1)
	var firstErr error
	go func() {
		defer wg.Done()
		_, firstErr = h.raw(first, helloRequest("Alice", firstTicket))
	}()
	<-presence.entered
	// The lobby lock is free during the claim: other players keep going,
	// and a second hello for the same name is refused locally.
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("alice", h.guestTicket())), "NICKNAME_TAKEN")
	carol := h.connect("Carol")
	h.must(carol, map[string]any{"type": "clock", "clientTick": 1})
	close(presence.proceed)
	wg.Wait()
	if firstErr != nil || first.playerID == "" {
		t.Fatalf("first hello: %v", firstErr)
	}
}

func TestSettlementCarriesAccountIDs(t *testing.T) {
	h := newHarness(t)
	guest := h.connect("Guest")
	account := h.newClient()
	h.must(account, helloRequest("x", h.sign(ticket.Claims{AccountID: "acc-7", Nickname: "Pro"})))
	players := []*Client{account, guest}
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 2))
	roomID := room["roomId"]
	room = h.command(account, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"]
	for _, p := range players {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3 * time.Second)
	h.must(guest, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 50_000})
	h.must(account, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 51_000})
	settlements := h.recorder.settlements()
	if len(settlements) != 1 {
		t.Fatalf("settlements: %d", len(settlements))
	}
	results := settlements[0].Results
	fifty, fiftyOne := 50_000, 51_000
	assertEqual(t, results, []contract.RaceResult{
		{PlayerID: guest.playerID, Name: "Guest", Rank: 1, ElapsedMs: &fifty, Points: 10},
		{PlayerID: account.playerID, AccountID: "acc-7", Name: "Pro", Rank: 2, ElapsedMs: &fiftyOne, Points: 8},
	})
}

// hello refuses a name that folds (names.Fold, the data service's presence
// rule) to a live one, including names still being claimed. Letters the
// nickname collation keeps apart (İ, ı) do not collide, unlike Java's
// equalsIgnoreCase, so a look-alike guest can never block an account.
func TestHelloNameFoldMatchesPresenceRule(t *testing.T) {
	h := newHarness(t)
	h.connect("Istanbul")
	for _, name := range []string{"istanbul", "ISTANBUL"} {
		assertEqual(t, h.errorCode(h.newClient(), helloRequest(name, h.guestTicket())), "NICKNAME_TAKEN")
	}
	h.must(h.newClient(), helloRequest("İstanbul", h.guestTicket()))
	h.connect("Straße")
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("STRAẞE", h.guestTicket())), "NICKNAME_TAKEN")

	// The same rule applies to a name reserved by a hello still claiming it.
	presence := &blockingPresence{block: "Irmak", entered: make(chan struct{}),
		proceed: make(chan struct{})}
	h.lobby.presence = presence
	first := h.newClient()
	firstTicket := h.guestTicket()
	done := make(chan error, 1)
	go func() {
		_, err := h.raw(first, helloRequest("Irmak", firstTicket))
		done <- err
	}()
	<-presence.entered
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("irmak", h.guestTicket())), "NICKNAME_TAKEN")
	close(presence.proceed)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("IRMAK", h.guestTicket())), "NICKNAME_TAKEN")
}

// An uncertain claim failure is undone by the presence agent (it knows the
// exact value it may have written); the lobby itself releases nothing and
// keeps nothing reserved.
func TestHelloUnavailableDataServiceReservesNothing(t *testing.T) {
	h := newHarness(t)
	h.presence.setErr(apierr.New(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE"))
	c := h.newClient()
	assertEqual(t, h.errorCode(c, helloRequest("Alice", h.guestTicket())), "DATA_SERVICE_UNAVAILABLE")
	if len(h.presence.releases) != 0 || len(h.lobby.pending) != 0 || c.playerID != "" {
		t.Fatalf("releases %v pending %v player %q", h.presence.releases, h.lobby.pending, c.playerID)
	}
	h.presence.setErr(nil)
	h.must(h.newClient(), helloRequest("alice", h.guestTicket()))
}
