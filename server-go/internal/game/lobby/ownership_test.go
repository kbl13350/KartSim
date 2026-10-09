package lobby

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

// fakeOwnership answers equipment checks: every item is owned except the
// item IDs in unowned; rentals are owned until the given time (the answer
// carries the earliest as ValidUntil); err makes the data service
// unreachable.
type fakeOwnership struct {
	mu      sync.Mutex
	unowned map[int]bool
	rentals map[int]time.Time
	err     error
	calls   []string // accountID + " " + equipment
	block   chan struct{}
	entered chan struct{}
}

func (o *fakeOwnership) VerifyEquipment(_ context.Context, accountID string, equipment json.RawMessage) (OwnershipAnswer, error) {
	if o.block != nil {
		o.entered <- struct{}{}
		<-o.block
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	o.calls = append(o.calls, accountID+" "+string(equipment))
	if o.err != nil {
		return OwnershipAnswer{}, o.err
	}
	var value struct {
		ItemIDs map[string]int `json:"itemIds"`
	}
	if err := json.Unmarshal(equipment, &value); err != nil {
		return OwnershipAnswer{}, err
	}
	answer := OwnershipAnswer{Owned: true}
	for _, item := range value.ItemIDs {
		if o.unowned[item] {
			return OwnershipAnswer{}, nil
		}
		if until, ok := o.rentals[item]; ok && (answer.ValidUntil.IsZero() || until.Before(answer.ValidUntil)) {
			answer.ValidUntil = until
		}
	}
	return answer, nil
}

// rent makes item a rental that ends at until.
func (o *fakeOwnership) rent(item int, until time.Time) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.rentals == nil {
		o.rentals = map[int]time.Time{}
	}
	o.rentals[item] = until
}

func (o *fakeOwnership) callCount() int {
	o.mu.Lock()
	defer o.mu.Unlock()
	return len(o.calls)
}

func (o *fakeOwnership) set(unowned []int, err error) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.unowned = map[int]bool{}
	for _, item := range unowned {
		o.unowned[item] = true
	}
	o.err = err
}

func withOwnership(h *harness) *fakeOwnership {
	o := &fakeOwnership{unowned: map[int]bool{}}
	h.lobby.ownership = o
	return o
}

// gear is the test equipment with the kart (slot 3) replaced.
func gear(kart int) map[string]any {
	value := equipment()
	value["itemIds"].(map[string]any)["3"] = kart
	return value
}

func accountHello(h *harness, nickname, accountID string, equipment any) map[string]any {
	request := helloRequest("ignored", h.sign(ticket.Claims{AccountID: accountID, Nickname: nickname}))
	request["equipment"] = equipment
	return request
}

func compactGear(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(compactJSON(raw))
}

// hello with equipment the account does not own is refused with 403
// ITEM_NOT_OWNED (the browser repairs its gear and says hello again); the
// connection stays usable and nothing is reserved.
func TestHelloRefusesUnownedEquipment(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	o.set([]int{900}, nil)
	owner := h.newClient()
	h.must(owner, accountHello(h, "Owner", "acc-owner", gear(387)))
	assertEqual(t, o.calls, []string{"acc-owner " + compactGear(t, gear(387))})
	if owner.equipment == nil {
		t.Fatal("owned equipment dropped")
	}
	borrower := h.newClient()
	_, err := h.raw(borrower, accountHello(h, "Borrower", "acc-borrower", gear(900)))
	assertEqual(t, codeOf(t, err), "ITEM_NOT_OWNED")
	assertEqual(t, statusOf(t, err), http.StatusForbidden)
	if borrower.playerID != "" || len(h.lobby.pending) != 0 || len(h.presence.claims) != 1 {
		t.Fatalf("refused hello admitted %q, pending %v, claims %v", borrower.playerID, h.lobby.pending, h.presence.claims)
	}
	// The same connection retries with owned gear.
	h.must(borrower, accountHello(h, "Borrower", "acc-borrower", gear(387)))
	room := h.create([]*Client{owner}, "ordinary", "speedIndiCombine", 2)
	room = h.command(borrower, map[string]any{"type": "join", "roomId": room["roomId"]})
	assertEqual(t, object(memberOf(t, room, borrower.playerID)["equipment"])["itemIds"].(map[string]any)["3"], 387)
	// Guests have no inventory to check.
	calls := o.callCount()
	guest := h.newClient()
	request := helloRequest("Guest", h.guestTicket())
	request["equipment"] = gear(900)
	h.must(guest, request)
	if guest.equipment == nil || o.callCount() != calls {
		t.Fatal("guest equipment was checked")
	}
	// Invalid equipment is never sent to the data service.
	h.must(h.newClient(), accountHello(h, "Plain", "acc-plain", map[string]any{"itemIds": map[string]any{}}))
	if o.callCount() != calls {
		t.Fatal("invalid equipment was checked")
	}
}

func TestHelloWithUnreachableDataServiceIsUnavailable(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	o.set(nil, errors.New("dial tcp: connection refused"))
	c := h.newClient()
	_, err := h.raw(c, accountHello(h, "Alice", "acc-alice", gear(387)))
	assertEqual(t, codeOf(t, err), "DATA_SERVICE_UNAVAILABLE")
	assertEqual(t, statusOf(t, err), http.StatusServiceUnavailable)
	if c.playerID != "" || len(h.lobby.pending) != 0 || len(h.presence.claims) != 0 {
		t.Fatalf("player %q pending %v claims %v", c.playerID, h.lobby.pending, h.presence.claims)
	}
	o.set(nil, nil)
	h.must(c, accountHello(h, "Alice", "acc-alice", gear(387)))
}

// create, join and equipment refuse unowned equipment with 403
// ITEM_NOT_OWNED at the point Java applies the equipment: every other
// validation keeps the Java order, and nothing changes.
func TestCommandsRefuseUnownedEquipment(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	o.set([]int{900}, nil)
	host := h.connectAccount("Host", "acc-host")
	player := h.connectAccount("Player", "acc-player")

	unownedCreate := createRequest(map[string]any{"capacity": 2, "equipment": gear(900)})
	_, err := h.raw(host, unownedCreate)
	assertEqual(t, codeOf(t, err), "ITEM_NOT_OWNED")
	assertEqual(t, statusOf(t, err), http.StatusForbidden)
	assertEqual(t, h.errorCode(host, createRequest(map[string]any{"channelName": "nope",
		"equipment": gear(900)})), "INVALID_CHANNEL")
	if len(h.lobby.rooms) != 0 || host.roomID != "" || len(h.recorder.rules) != 0 {
		t.Fatal("refused create made a room")
	}
	room := h.command(host, createRequest(map[string]any{"capacity": 2, "password": "pw"}))
	roomID := room["roomId"].(string)

	assertEqual(t, h.errorCode(player, map[string]any{"type": "join", "roomId": roomID,
		"password": "wrong", "equipment": gear(900)}), "INVALID_PASSWORD")
	hostEvents := len(h.sink(host).events(t))
	assertEqual(t, h.errorCode(player, map[string]any{"type": "join", "roomId": roomID,
		"password": "pw", "equipment": gear(900)}), "ITEM_NOT_OWNED")
	if player.roomID != "" || len(h.lobby.rooms[roomID].members) != 1 || h.lobby.rooms[roomID].revision != 1 ||
		len(h.sink(host).events(t)) != hostEvents {
		t.Fatal("refused join changed the room")
	}
	room = h.command(player, map[string]any{"type": "join", "roomId": roomID, "password": "pw",
		"equipment": gear(387)})
	room = h.command(player, map[string]any{"type": "ready", "roomId": roomID,
		"revision": room["revision"], "ready": true})
	before := memberOf(t, room, player.playerID)

	equipmentCommand := func(value any) map[string]any {
		return map[string]any{"type": "equipment", "roomId": roomID, "revision": room["revision"], "equipment": value}
	}
	calls := o.callCount()
	assertEqual(t, h.errorCode(player, equipmentCommand(map[string]any{})), "INVALID_EQUIPMENT")
	if o.callCount() != calls {
		t.Fatal("invalid equipment was checked")
	}
	stale := equipmentCommand(gear(900))
	stale["revision"] = 1
	assertEqual(t, h.errorCode(player, stale), "STALE_REVISION")
	_, err = h.raw(player, equipmentCommand(gear(900)))
	assertEqual(t, codeOf(t, err), "ITEM_NOT_OWNED")
	assertEqual(t, statusOf(t, err), http.StatusForbidden)
	after := h.lobby.rooms[roomID]
	if after.revision != int(room["revision"].(float64)) {
		t.Fatal("refused equipment bumped the revision")
	}
	memberNow := func() map[string]any { return decodeObject(t, encode(after.member(player.playerID).snapshot())) }
	assertEqual(t, memberNow(), before)
	assertEqual(t, player.equipment, json.RawMessage(compactGear(t, gear(387))))

	// The data service being down is 503, and changes nothing either.
	o.set(nil, errors.New("timeout"))
	_, err = h.raw(player, equipmentCommand(gear(1637)))
	assertEqual(t, codeOf(t, err), "DATA_SERVICE_UNAVAILABLE")
	assertEqual(t, statusOf(t, err), http.StatusServiceUnavailable)
	assertEqual(t, memberNow(), before)
	o.set(nil, nil)
	room = h.command(player, equipmentCommand(gear(1637)))
	assertEqual(t, object(object(memberOf(t, room, player.playerID)["equipment"])["itemIds"])["3"], 1637)
}

// Only the last confirmed equipment of the session is cached; refusals are
// cached for 10 seconds per account and equipment, so repeating a refused
// command costs the data service nothing (a player who buys the item can
// use it once that passes).
func TestEquipmentChecksAreCachedPerSession(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host") // equipment() checked at hello
	assertEqual(t, o.callCount(), 1)
	room := h.command(host, createRequest(map[string]any{"capacity": 2, "equipment": equipment()}))
	roomID := room["roomId"].(string)
	assertEqual(t, o.callCount(), 1)
	// The same document with other whitespace is the same equipment.
	payload, _ := json.MarshalIndent(map[string]any{"type": "equipment", "roomId": roomID,
		"equipment": equipment()}, "", "  ")
	if _, err := h.rawJSON(host, string(payload)); err != nil {
		t.Fatal(err)
	}
	assertEqual(t, o.callCount(), 1)

	change := func(value any) error {
		_, err := h.raw(host, map[string]any{"type": "equipment", "roomId": roomID, "equipment": value})
		return err
	}
	if err := change(gear(387)); err != nil {
		t.Fatal(err)
	}
	if err := change(gear(387)); err != nil {
		t.Fatal(err)
	}
	assertEqual(t, o.callCount(), 2)
	if err := change(equipment()); err != nil { // only the latest is remembered
		t.Fatal(err)
	}
	assertEqual(t, o.callCount(), 3)

	o.set([]int{900}, nil)
	for range 2 {
		assertEqual(t, codeOf(t, change(gear(900))), "ITEM_NOT_OWNED")
	}
	assertEqual(t, o.callCount(), 4)
	o.set(nil, nil) // bought
	assertEqual(t, codeOf(t, change(gear(900))), "ITEM_NOT_OWNED")
	assertEqual(t, o.callCount(), 4)
	h.advanceWall(refusedTTL)
	if err := change(gear(900)); err != nil {
		t.Fatal(err)
	}
	assertEqual(t, o.callCount(), 5)

	// The cache belongs to the session's account; another session asks again.
	other := h.connectAccount("Other", "acc-other")
	assertEqual(t, o.callCount(), 6)
	h.command(other, map[string]any{"type": "join", "roomId": roomID, "equipment": gear(900)})
	assertEqual(t, o.callCount(), 7)
	// Commands without hello never reach the data service.
	assertEqual(t, h.errorCode(h.newClient(), createRequest(map[string]any{"equipment": gear(5)})), "HELLO_REQUIRED")
	assertEqual(t, o.callCount(), 7)
}

// The data service call runs without the lobby lock: other players keep
// playing while one check is slow.
func TestEquipmentCheckDoesNotHoldTheLobbyLock(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host")
	carol := h.connect("Carol")
	o.block, o.entered = make(chan struct{}), make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, err := h.raw(host, createRequest(map[string]any{"equipment": gear(387)}))
		done <- err
	}()
	<-o.entered
	h.must(carol, map[string]any{"type": "clock", "clientTick": 1})
	h.command(carol, createRequest(nil))
	close(o.block)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if len(h.lobby.rooms) != 2 {
		t.Fatalf("rooms %d", len(h.lobby.rooms))
	}
}

// KART_ALLOW_GUESTS=false (the default): a guest ticket is 401
// LOGIN_REQUIRED once the ticket checks pass; accounts are unaffected.
func TestHelloRefusesGuestsByDefault(t *testing.T) {
	h := newHarness(t)
	h.lobby.allowGuests = false
	c := h.newClient()
	_, err := h.raw(c, helloRequest("Guest", h.guestTicket()))
	assertEqual(t, codeOf(t, err), "LOGIN_REQUIRED")
	assertEqual(t, statusOf(t, err), http.StatusUnauthorized)
	// The ticket checks and the Java checks before them come first.
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("Guest", "bad")), "TICKET_INVALID")
	bad := helloRequest("Guest", h.guestTicket())
	bad["protocolVersion"] = 38
	assertEqual(t, h.errorCode(h.newClient(), bad), "PROTOCOL_MISMATCH")
	assertEqual(t, h.errorCode(h.newClient(), helloRequest("<b>", h.guestTicket())), "LOGIN_REQUIRED")
	if c.playerID != "" || len(h.presence.claims) != 0 || len(h.lobby.pending) != 0 {
		t.Fatal("refused guest was admitted")
	}
	h.must(c, accountHello(h, "Member", "acc-member", equipment()))
	assertEqual(t, h.presence.claims, []contract.PresenceClaimRequest{{NodeID: testNodeID,
		PlayerID: c.playerID, Name: "Member", AccountID: "acc-member"}})
}

// closingSink records the close requests of Evict.
type closingSink struct {
	recordingSink
	closes []string
}

func (s *closingSink) Close(code int, reason string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closes = append(s.closes, jsonNumber(code)+" "+reason)
}

// Heartbeat conflicts close exactly the listed sessions; the connection's
// disconnect then frees the room seat as usual.
func TestEvictClosesConflictingSessions(t *testing.T) {
	h := newHarness(t)
	host := h.connect("Host")
	sink := &closingSink{}
	evicted := NewClient(sink)
	h.must(evicted, helloRequest("Taken", h.guestTicket()))
	bystander := &closingSink{}
	kept := NewClient(bystander)
	h.must(kept, helloRequest("Kept", h.guestTicket()))
	room := h.create([]*Client{host}, "ordinary", "speedIndiCombine", 3)
	roomID := room["roomId"].(string)
	h.command(evicted, map[string]any{"type": "join", "roomId": roomID})

	if n := h.lobby.Evict([]string{evicted.playerID, "unknown", host.playerID}); n != 1 {
		t.Fatalf("evicted %d (the host's sink cannot close)", n)
	}
	assertEqual(t, sink.closes, []string{"1008 nickname taken elsewhere"})
	if len(bystander.closes) != 0 {
		t.Fatal("bystander closed")
	}
	// The WebSocket layer disconnects the closed connection.
	h.lobby.Disconnect(evicted)
	latest := object(h.sink(host).last(t)["room"])
	assertEqual(t, len(list(latest["members"])), 1)
	if !slices.ContainsFunc(h.presence.releases, func(r contract.PresenceReleaseRequest) bool {
		return r.PlayerID == evicted.playerID
	}) {
		t.Fatal("evicted player's name not released")
	}
	players, _ := h.lobby.Counts()
	assertEqual(t, players, 2)
}

// An item that expires (or is taken away) after it was confirmed does not
// stay usable for the session: a confirmation is reused only until the
// rental's ValidUntil, and never longer than ownedTTL. create and join
// that keep the session's equipment check it again too.
func TestStaleOwnershipIsCheckedAgain(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host")
	o.rent(387, h.now().Add(5*time.Minute))
	renter := h.newClient()
	h.must(renter, accountHello(h, "Renter", "acc-renter", gear(387)))
	calls := o.callCount()

	// Within the rental the confirmation is reused.
	room := h.command(renter, createRequest(map[string]any{"capacity": 2, "equipment": gear(387)}))
	h.must(renter, map[string]any{"type": "leave", "roomId": room["roomId"]})
	assertEqual(t, o.callCount(), calls)

	// The rental ends: the data service no longer confirms the kart.
	h.advanceWall(5 * time.Minute)
	o.set([]int{387}, nil)
	assertEqual(t, h.errorCode(renter, createRequest(map[string]any{"capacity": 2, "equipment": gear(387)})),
		"ITEM_NOT_OWNED")
	assertEqual(t, o.callCount(), calls+1)
	room = h.command(host, createRequest(map[string]any{"capacity": 2}))
	roomID := room["roomId"].(string)
	// join without equipment keeps the session's (expired) gear: refused
	// (the refusal is remembered, so no new call), and create the same.
	assertEqual(t, h.errorCode(renter, map[string]any{"type": "join", "roomId": roomID}), "ITEM_NOT_OWNED")
	assertEqual(t, h.errorCode(renter, createRequest(map[string]any{"capacity": 2})), "ITEM_NOT_OWNED")
	assertEqual(t, o.callCount(), calls+1)
	if renter.roomID != "" || len(h.lobby.rooms[roomID].members) != 1 {
		t.Fatal("refused join took a seat")
	}
	// The browser falls back to owned gear.
	room = h.command(renter, map[string]any{"type": "join", "roomId": roomID, "equipment": gear(1637)})
	assertEqual(t, object(object(memberOf(t, room, renter.playerID)["equipment"])["itemIds"])["3"], 1637)

	// Permanent items are confirmed again after ownedTTL (an administrator
	// may have taken one away).
	keeper := h.connectAccount("Keeper", "acc-keeper")
	calls = o.callCount()
	room = h.command(keeper, createRequest(map[string]any{"capacity": 2}))
	h.must(keeper, map[string]any{"type": "leave", "roomId": room["roomId"]})
	assertEqual(t, o.callCount(), calls)
	h.advanceWall(ownedTTL)
	room = h.command(keeper, createRequest(map[string]any{"capacity": 2}))
	assertEqual(t, o.callCount(), calls+1)
	h.must(keeper, map[string]any{"type": "leave", "roomId": room["roomId"]})
	o.set([]int{1}, nil) // every test gear has item 1 in slot 1
	h.advanceWall(ownedTTL)
	assertEqual(t, h.errorCode(keeper, createRequest(map[string]any{"capacity": 2})), "ITEM_NOT_OWNED")
}

// ready checks the sender's own equipment again once its confirmation has
// lapsed; un-readying never needs a check.
func TestReadyNeedsOwnedEquipment(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host")
	o.rent(387, h.now().Add(time.Minute))
	member := h.newClient()
	h.must(member, accountHello(h, "Member", "acc-member", gear(387)))
	room := h.command(host, createRequest(map[string]any{"capacity": 2}))
	roomID := room["roomId"].(string)
	room = h.command(member, map[string]any{"type": "join", "roomId": roomID})
	ready := func(value bool) map[string]any {
		return map[string]any{"type": "ready", "roomId": roomID, "revision": room["revision"], "ready": value}
	}
	calls := o.callCount()
	room = h.command(member, ready(true))
	room = h.command(member, ready(false))
	assertEqual(t, o.callCount(), calls) // still within the rental

	h.advanceWall(time.Minute)
	o.set([]int{387}, nil)
	// Java errors keep their order and cost no call.
	assertEqual(t, h.errorCode(host, ready(true)), "HOST_CANNOT_READY")
	stale := ready(true)
	stale["revision"] = 1
	assertEqual(t, h.errorCode(member, stale), "STALE_REVISION")
	assertEqual(t, o.callCount(), calls)
	revision := h.lobby.rooms[roomID].revision
	_, err := h.raw(member, ready(true))
	assertEqual(t, codeOf(t, err), "ITEM_NOT_OWNED")
	assertEqual(t, statusOf(t, err), http.StatusForbidden)
	assertEqual(t, o.callCount(), calls+1)
	if r := h.lobby.rooms[roomID]; r.revision != revision || r.member(member.playerID).ready {
		t.Fatal("refused ready changed the room")
	}
	room = h.command(member, ready(false)) // no check
	assertEqual(t, o.callCount(), calls+1)
	room = h.command(member, map[string]any{"type": "equipment", "roomId": roomID, "equipment": gear(1637)})
	h.command(member, ready(true))
}

// start checks every member whose confirmation lapsed, all without the
// lobby lock. A member whose gear is no longer owned is un-readied (a new
// revision tells the room) and the start fails with ITEM_NOT_OWNED,
// naming nothing; the race starts once that member equips owned gear.
func TestStartChecksLapsedEquipment(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host")
	keeper := h.connectAccount("Keeper", "acc-keeper")
	o.rent(387, h.now().Add(time.Minute))
	renter := h.newClient()
	h.must(renter, accountHello(h, "Renter", "acc-renter", gear(387)))
	guest := h.connect("Guest")
	players := []*Client{host, keeper, renter, guest}
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 4))
	roomID := room["roomId"].(string)
	start := func() map[string]any {
		return map[string]any{"type": "start", "roomId": roomID, "revision": h.lobby.rooms[roomID].revision}
	}

	h.advanceWall(ownedTTL)
	o.set([]int{387}, nil)
	calls := o.callCount()
	// Java errors come first and cost no call.
	assertEqual(t, h.errorCode(host, map[string]any{"type": "start", "roomId": roomID, "revision": 1}), "STALE_REVISION")
	assertEqual(t, h.errorCode(keeper, start()), "HOST_REQUIRED")
	assertEqual(t, o.callCount(), calls)

	// The data service being down fails the start and changes nothing.
	o.set([]int{387}, errors.New("timeout"))
	revision := h.lobby.rooms[roomID].revision
	assertEqual(t, h.errorCode(host, start()), "DATA_SERVICE_UNAVAILABLE")
	if h.lobby.rooms[roomID].revision != revision || !h.lobby.rooms[roomID].member(renter.playerID).ready {
		t.Fatal("unavailable check changed the room")
	}
	o.set([]int{387}, nil)

	calls = o.callCount()
	keeperEvents := len(h.sink(keeper).events(t))
	_, err := h.raw(host, start())
	assertEqual(t, codeOf(t, err), "ITEM_NOT_OWNED")
	assertEqual(t, statusOf(t, err), http.StatusForbidden)
	// Host, keeper and renter were asked (the guest has no inventory).
	assertEqual(t, o.callCount(), calls+3)
	r := h.lobby.rooms[roomID]
	if r.phase != "open" || r.race != nil || r.revision != revision+1 {
		t.Fatalf("phase %s race %v revision %d", r.phase, r.race, r.revision)
	}
	pushed := object(h.sink(keeper).last(t)["room"])
	if len(h.sink(keeper).events(t)) != keeperEvents+1 || memberOf(t, pushed, renter.playerID)["ready"] != false ||
		memberOf(t, pushed, keeper.playerID)["ready"] != true || memberOf(t, pushed, guest.playerID)["ready"] != true {
		t.Fatalf("room pushed %v", pushed)
	}
	assertEqual(t, object(h.sink(host).last(t)["room"])["revision"], revision+1) // the host sees it too
	// The renter cannot ready again with the expired kart (remembered: no call).
	assertEqual(t, h.errorCode(renter, map[string]any{"type": "ready", "roomId": roomID, "ready": true}), "ITEM_NOT_OWNED")
	assertEqual(t, o.callCount(), calls+3)
	h.command(renter, map[string]any{"type": "equipment", "roomId": roomID, "equipment": gear(1637)})
	h.command(renter, map[string]any{"type": "ready", "roomId": roomID, "ready": true})
	room = h.command(host, start())
	assertEqual(t, room["phase"], "loading")
	assertEqual(t, o.callCount(), calls+4) // only the renter's new gear
}

// Commands that fail anyway never reach the data service: the Java
// validation runs first, under the lobby lock, and only a command that
// would succeed asks (then runs again with the answer).
func TestEquipmentChecksSkipCommandsThatFailAnyway(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host")
	c := h.connectAccount("Spammer", "acc-spam")
	full := h.connectAccount("Third", "acc-third")
	room := h.command(host, createRequest(map[string]any{"capacity": 2, "password": "pw"}))
	roomID := room["roomId"].(string)
	base := o.callCount()
	for i := range 10 {
		g := gear(900)
		g["kartSerial"] = i
		assertEqual(t, h.errorCode(c, map[string]any{"type": "equipment", "roomId": "nope", "equipment": g}), "ROOM_NOT_FOUND")
		assertEqual(t, h.errorCode(c, map[string]any{"type": "equipment", "roomId": roomID, "equipment": g}), "NOT_ROOM_MEMBER")
		assertEqual(t, h.errorCode(c, map[string]any{"type": "join", "roomId": "missing", "equipment": g}), "ROOM_NOT_FOUND")
		assertEqual(t, h.errorCode(c, map[string]any{"type": "join", "roomId": roomID, "equipment": g}), "INVALID_PASSWORD")
		assertEqual(t, h.errorCode(host, createRequest(map[string]any{"equipment": g})), "ALREADY_IN_ROOM")
		assertEqual(t, h.errorCode(c, createRequest(map[string]any{"channelName": "x", "equipment": g})), "INVALID_CHANNEL")
	}
	h.command(c, map[string]any{"type": "join", "roomId": roomID, "password": "pw"})
	g := gear(5)
	assertEqual(t, h.errorCode(full, map[string]any{"type": "join", "roomId": roomID, "password": "pw", "equipment": g}), "ROOM_FULL")
	assertEqual(t, o.callCount(), base)
}

// The re-run after a call sees the room as it is then: a join whose room
// filled up meanwhile is ROOM_FULL, and nothing was changed before.
func TestCommandsRunAgainAfterTheCheck(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	host := h.connectAccount("Host", "acc-host")
	slow := h.connectAccount("Slow", "acc-slow")
	quick := h.connect("Quick")
	room := h.command(host, createRequest(map[string]any{"capacity": 2}))
	roomID := room["roomId"].(string)
	o.block, o.entered = make(chan struct{}), make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, err := h.raw(slow, map[string]any{"type": "join", "roomId": roomID, "equipment": gear(387)})
		done <- err
	}()
	<-o.entered
	h.command(quick, map[string]any{"type": "join", "roomId": roomID})
	close(o.block)
	assertEqual(t, codeOf(t, <-done), "ROOM_FULL")
	if slow.roomID != "" || len(h.lobby.rooms[roomID].members) != 2 {
		t.Fatal("join after the room filled took a seat")
	}
	o.block = nil
	// The answer was kept: joining another room with that gear needs no call.
	calls := o.callCount()
	h.must(quick, map[string]any{"type": "leave", "roomId": roomID})
	h.command(slow, map[string]any{"type": "join", "roomId": roomID, "equipment": gear(387)})
	assertEqual(t, o.callCount(), calls)
}

// A connection may cause at most verifyBurst checks at once, then
// verifyRate per second (429 RATE_LIMITED, no call); answers from the
// cache are free.
func TestEquipmentChecksAreRateLimited(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	c := h.connectAccount("Changer", "acc-changer") // the hello used one token
	room := h.command(c, createRequest(map[string]any{"capacity": 2}))
	roomID := room["roomId"].(string)
	change := func(serial int) error {
		g := gear(387)
		g["kartSerial"] = serial
		_, err := h.raw(c, map[string]any{"type": "equipment", "roomId": roomID, "equipment": g})
		return err
	}
	for serial := range verifyBurst - 1 {
		if err := change(serial); err != nil {
			t.Fatal(err)
		}
	}
	calls := o.callCount()
	err := change(100)
	assertEqual(t, codeOf(t, err), "RATE_LIMITED")
	assertEqual(t, statusOf(t, err), http.StatusTooManyRequests)
	assertEqual(t, o.callCount(), calls)
	if err := change(verifyBurst - 2); err != nil { // the confirmed gear: cached
		t.Fatal(err)
	}
	h.advanceWall(time.Second / verifyRate)
	if err := change(100); err != nil {
		t.Fatal(err)
	}
	assertEqual(t, codeOf(t, change(101)), "RATE_LIMITED")
	assertEqual(t, o.callCount(), calls+1)
	// Other connections have their own budget.
	h.command(h.connectAccount("Other", "acc-other"), createRequest(map[string]any{"equipment": gear(5)}))
}

// The checks in flight on the node are bounded: beyond the limit a command
// fails fast with 503 DATA_SERVICE_UNAVAILABLE instead of queueing.
func TestConcurrentEquipmentChecksAreBounded(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	first := h.connectAccount("First", "acc-first")
	second := h.connectAccount("Second", "acc-second")
	h.lobby.verifySlots = make(chan struct{}, 1)
	o.block, o.entered = make(chan struct{}), make(chan struct{})
	done := make(chan error, 1)
	go func() {
		_, err := h.raw(first, createRequest(map[string]any{"equipment": gear(387)}))
		done <- err
	}()
	<-o.entered
	calls := o.callCount()
	_, err := h.raw(second, createRequest(map[string]any{"equipment": gear(387)}))
	assertEqual(t, codeOf(t, err), "DATA_SERVICE_UNAVAILABLE")
	assertEqual(t, statusOf(t, err), http.StatusServiceUnavailable)
	close(o.block)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	o.block = nil
	if o.callCount() != calls+1 || second.roomID != "" {
		t.Fatalf("calls %d room %q", o.callCount(), second.roomID)
	}
	h.command(second, createRequest(map[string]any{"equipment": gear(387)}))
}

// The host's own lapsed equipment fails the start too; with nobody to
// un-ready the room is left as it was.
func TestStartChecksTheHostsEquipment(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	o.rent(1, h.now().Add(time.Minute)) // the test gear's slot-1 item
	host := h.connectAccount("Host", "acc-host")
	o.set(nil, nil)
	guest := h.connect("Guest")
	players := []*Client{host, guest}
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 2))
	roomID := room["roomId"].(string)
	h.advanceWall(time.Minute)
	o.set([]int{1}, nil)
	events := len(h.sink(guest).events(t))
	assertEqual(t, h.errorCode(host, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]}),
		"ITEM_NOT_OWNED")
	r := h.lobby.rooms[roomID]
	if r.phase != "open" || r.revision != int(room["revision"].(float64)) || len(h.sink(guest).events(t)) != events ||
		!r.member(guest.playerID).ready {
		t.Fatal("refused start changed the room")
	}
}
