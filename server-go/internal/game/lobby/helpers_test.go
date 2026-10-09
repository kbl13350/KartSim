package lobby

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"kartsim/internal/game/admission"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

const (
	testSecret   = "test-cluster-secret-0123456789abcdef"
	testNodeID   = "game-test"
	testDataNode = "data-test"
)

// fakeClock is a manual clock: timers fire only inside Advance, in due order.
type fakeClock struct {
	mu     sync.Mutex
	now    int64
	seq    int
	timers []fakeTimer
}

type fakeTimer struct {
	at  int64
	seq int
	f   func()
}

func (c *fakeClock) Now() int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) AfterFunc(d time.Duration, f func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.seq++
	c.timers = append(c.timers, fakeTimer{at: c.now + d.Milliseconds(), seq: c.seq, f: f})
}

// Advance moves time forward by d, running every timer that falls due.
func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	target := c.now + d.Milliseconds()
	c.mu.Unlock()
	for {
		c.mu.Lock()
		next := -1
		for i, t := range c.timers {
			if t.at <= target && (next < 0 || t.at < c.timers[next].at ||
				(t.at == c.timers[next].at && t.seq < c.timers[next].seq)) {
				next = i
			}
		}
		if next < 0 {
			c.now = target
			c.mu.Unlock()
			return
		}
		timer := c.timers[next]
		c.timers = slices.Delete(c.timers, next, next+1)
		c.now = timer.at
		c.mu.Unlock()
		timer.f()
	}
}

func (c *fakeClock) pending() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.timers)
}

// recordingSink keeps everything sent to one connection.
type recordingSink struct {
	mu     sync.Mutex
	texts  [][]byte
	frames [][]byte
}

func (s *recordingSink) Text(payload []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.texts = append(s.texts, payload)
}

func (s *recordingSink) Binary(frame []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.frames = append(s.frames, frame)
}

func (s *recordingSink) events(t *testing.T) []map[string]any {
	t.Helper()
	s.mu.Lock()
	defer s.mu.Unlock()
	events := make([]map[string]any, len(s.texts))
	for i, text := range s.texts {
		events[i] = decodeObject(t, text)
	}
	return events
}

func (s *recordingSink) last(t *testing.T) map[string]any {
	t.Helper()
	events := s.events(t)
	if len(events) == 0 {
		t.Fatal("no events received")
	}
	return events[len(events)-1]
}

func (s *recordingSink) frameCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.frames)
}

// fakeRecorder replaces the outbox: it keeps what saveRules/saveResults sent.
type fakeRecorder struct {
	mu    sync.Mutex
	rules []contract.RoomRulesRequest
	races []contract.RaceSettlement
}

func (r *fakeRecorder) SaveRules(req contract.RoomRulesRequest) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rules = append(r.rules, req)
}

func (r *fakeRecorder) SaveRace(req contract.RaceSettlement) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.races = append(r.races, req)
}

// savedRules is the latest rules document of a room (the Java room_rules row).
func (r *fakeRecorder) savedRules(t *testing.T, roomID string) map[string]any {
	t.Helper()
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := len(r.rules) - 1; i >= 0; i-- {
		if r.rules[i].RoomID == roomID {
			return decodeObject(t, r.rules[i].Rules)
		}
	}
	t.Fatal("room rules not saved")
	return nil
}

// savedOutcomeCount mirrors the Java fixture: 1 when an outcome for raceID
// exists (asserting its roadblock reason), else 0.
func (r *fakeRecorder) savedOutcomeCount(t *testing.T, raceID, reason string) int {
	t.Helper()
	r.mu.Lock()
	defer r.mu.Unlock()
	count := 0
	for _, race := range r.races {
		if race.RaceID != raceID {
			continue
		}
		stored := decodeObject(t, race.Snapshot)
		outcome := object(object(stored["race"])["roadblockOutcome"])
		if outcome["reason"] != reason {
			t.Fatalf("saved reason = %v, want %s", outcome["reason"], reason)
		}
		count++
	}
	return count
}

func (r *fakeRecorder) settlements() []contract.RaceSettlement {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.races)
}

// fakePresence accepts every claim unless err is set.
type fakePresence struct {
	mu       sync.Mutex
	err      error
	claims   []contract.PresenceClaimRequest
	releases []contract.PresenceReleaseRequest
}

func (p *fakePresence) Claim(_ context.Context, req contract.PresenceClaimRequest) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.err != nil {
		return p.err
	}
	p.claims = append(p.claims, req)
	return nil
}

func (p *fakePresence) Release(req contract.PresenceReleaseRequest) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.releases = append(p.releases, req)
}

func (p *fakePresence) setErr(err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.err = err
}

// harness is the Go counterpart of the Java test fixtures.
type harness struct {
	t        *testing.T
	lobby    *Lobby
	clock    *fakeClock
	recorder *fakeRecorder
	presence *fakePresence
	tickets  *admission.Tickets
	sinks    map[*Client]*recordingSink

	wallMu sync.Mutex
	wall   time.Time // tickets and the lobby's wall clock (equipment checks)
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	h := &harness{
		t:        t,
		clock:    &fakeClock{now: 1_000_000},
		recorder: &fakeRecorder{},
		presence: &fakePresence{},
		wall:     time.Now(),
		sinks:    map[*Client]*recordingSink{},
	}
	h.tickets = admission.New([]byte(testSecret), testNodeID, testDataNode).WithClock(h.now)
	h.lobby = New(Options{
		NodeID:    testNodeID,
		Clock:     h.clock,
		Presence:  h.presence,
		Tickets:   h.tickets,
		Recorder:  h.recorder,
		WallClock: h.now,
		// The Java fixtures connect guests; TestHelloRefusesGuests covers
		// the default.
		AllowGuests: true,
	})
	t.Cleanup(h.lobby.Close)
	return h
}

// now is the harness wall clock.
func (h *harness) now() time.Time {
	h.wallMu.Lock()
	defer h.wallMu.Unlock()
	return h.wall
}

// advanceWall moves the wall clock (not the room clock) forward.
func (h *harness) advanceWall(d time.Duration) {
	h.wallMu.Lock()
	defer h.wallMu.Unlock()
	h.wall = h.wall.Add(d)
}

func (h *harness) sign(claims ticket.Claims) string {
	if claims.NodeID == "" {
		claims.NodeID = testNodeID
	}
	if claims.DataNode == "" {
		claims.DataNode = testDataNode
	}
	token, _ := ticket.Sign([]byte(testSecret), claims, h.now())
	return token
}

func (h *harness) guestTicket() string { return h.sign(ticket.Claims{Guest: true}) }

func (h *harness) newClient() *Client {
	sink := &recordingSink{}
	c := NewClient(sink)
	h.sinks[c] = sink
	return c
}

func (h *harness) sink(c *Client) *recordingSink { return h.sinks[c] }

func helloRequest(name, token string) map[string]any {
	return map[string]any{"type": "hello",
		"protocolVersion": 39, "ruleset": "launcher-room-v1",
		"resourceVersion": "p3553", "name": name, "initial": "",
		"raceRuntime": true, "equipment": equipment(), "ticket": token}
}

// connect says hello as a guest, like the Java connect(lobby, name).
func (h *harness) connect(name string) *Client {
	h.t.Helper()
	c := h.newClient()
	h.must(c, helloRequest(name, h.guestTicket()))
	return c
}

func (h *harness) connectN(count int) []*Client {
	h.t.Helper()
	players := make([]*Client, count)
	for i := range players {
		players[i] = h.connect("Player" + strconv.Itoa(i))
	}
	return players
}

// raw runs one command through ParseRequest and Handle and decodes the reply.
func (h *harness) raw(c *Client, request map[string]any) (map[string]any, error) {
	h.t.Helper()
	payload, err := json.Marshal(request)
	if err != nil {
		h.t.Fatal(err)
	}
	return h.rawJSON(c, string(payload))
}

func (h *harness) rawJSON(c *Client, payload string) (map[string]any, error) {
	h.t.Helper()
	in, err := ParseRequest([]byte(payload))
	if err != nil {
		return nil, err
	}
	reply, err := h.lobby.Handle(context.Background(), c, in)
	if err != nil {
		if _, ok := apierr.As(err); !ok {
			h.t.Fatalf("non-API error: %v", err)
		}
		return nil, err
	}
	return decodeObject(h.t, reply.Encode("")), nil
}

func (h *harness) must(c *Client, request map[string]any) map[string]any {
	h.t.Helper()
	reply, err := h.raw(c, request)
	if err != nil {
		h.t.Fatalf("%v failed: %v", request["type"], err)
	}
	return reply
}

// command returns the "room" of a room reply.
func (h *harness) command(c *Client, request map[string]any) map[string]any {
	h.t.Helper()
	return object(h.must(c, request)["room"])
}

// errorCode expects a rejection and returns its code.
func (h *harness) errorCode(c *Client, request map[string]any) string {
	h.t.Helper()
	_, err := h.raw(c, request)
	return codeOf(h.t, err)
}

func codeOf(t *testing.T, err error) string {
	t.Helper()
	if err == nil {
		t.Fatal("expected an error")
	}
	var rejected *apierr.Error
	if !errors.As(err, &rejected) {
		t.Fatalf("not an API error: %v", err)
	}
	return rejected.Code
}

// create mirrors the Java Fixture.create.
func (h *harness) create(players []*Client, gameplay, channel string, capacity int) map[string]any {
	h.t.Helper()
	mode := "individual"
	if strings.Contains(channel, "Team") {
		mode = "team"
	}
	speed := 7
	if strings.HasSuffix(channel, "Infinit") {
		speed = 4
	}
	return h.command(players[0], map[string]any{
		"type": "create", "name": "Special Race", "capacity": capacity,
		"password": "", "channelName": channel, "gameplay": gameplay,
		"mode": mode, "speed": speed, "speedVersion": "国服"})
}

// joinAndReady mirrors the Java Fixture.joinAndReady.
func (h *harness) joinAndReady(players []*Client, room map[string]any) map[string]any {
	h.t.Helper()
	roomID := room["roomId"]
	for _, p := range players[1:] {
		room = h.command(p, map[string]any{"type": "join", "roomId": roomID})
	}
	for _, p := range players[1:] {
		room = h.command(p, map[string]any{"type": "ready", "roomId": roomID,
			"revision": room["revision"], "ready": true})
	}
	return room
}

// equipment is the Java test equipment: every slot 0 except 1 and 3.
func equipment() map[string]any {
	ids := map[string]any{}
	for _, slot := range equipmentSlots {
		value := 0
		if slot == 1 || slot == 3 {
			value = 1
		}
		ids[strconv.Itoa(slot)] = value
	}
	return map[string]any{"itemIds": ids, "kartSerial": 0, "valueAt3E": 0, "exceedType": 0}
}

func decodeObject(t *testing.T, data []byte) map[string]any {
	t.Helper()
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatalf("decode %s: %v", data, err)
	}
	return value
}

func object(value any) map[string]any {
	m, _ := value.(map[string]any)
	return m
}

func list(value any) []any {
	l, _ := value.([]any)
	return l
}

func raceOf(room map[string]any) map[string]any { return object(room["race"]) }

func memberOf(t *testing.T, room map[string]any, playerID string) map[string]any {
	t.Helper()
	for _, m := range list(room["members"]) {
		if object(m)["playerId"] == playerID {
			return object(m)
		}
	}
	t.Fatalf("member %s not found", playerID)
	return nil
}

// assertEqual compares JSON forms, so decoded numbers (float64) equal ints.
func assertEqual(t *testing.T, got, want any) {
	t.Helper()
	if !jsonEqual(got, want) {
		gotJSON, _ := json.Marshal(got)
		wantJSON, _ := json.Marshal(want)
		t.Fatalf("got %s, want %s", gotJSON, wantJSON)
	}
}

func jsonEqual(a, b any) bool {
	aJSON, errA := json.Marshal(a)
	bJSON, errB := json.Marshal(b)
	return errA == nil && errB == nil && string(aJSON) == string(bJSON)
}

// clientRoom is the room c is in ("" for none).
func (l *Lobby) clientRoom(c *Client) string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return c.roomID
}
