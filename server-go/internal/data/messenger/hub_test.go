package messenger

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/shared/apierr"
)

// fakeBackend is an in-memory Backend: tokens are "token-<account>".
type fakeBackend struct {
	mu        sync.Mutex
	friends   map[string][]string
	invisible map[string]bool
	inGame    map[string]bool
	gameErr   error
	revoked   map[string]bool
	clientIDs map[string]Message
	nextID    int64
	hub       *Hub
}

func newFakeBackend() *fakeBackend {
	return &fakeBackend{friends: map[string][]string{}, invisible: map[string]bool{}, inGame: map[string]bool{},
		revoked: map[string]bool{}, clientIDs: map[string]Message{}}
}

func (b *fakeBackend) befriend(x, y string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.friends[x] = append(b.friends[x], y)
	b.friends[y] = append(b.friends[y], x)
}

func (b *fakeBackend) Authenticate(_ context.Context, token string) (Session, bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	id, ok := strings.CutPrefix(token, "token-")
	if !ok || b.revoked[token] {
		return Session{}, false, nil
	}
	return Session{AccountID: id, Key: "key-" + token}, true, nil
}

func (b *fakeBackend) Welcome(_ context.Context, accountID string) (any, error) {
	return map[string]string{"me": accountID}, nil
}

func (b *fakeBackend) Roster(_ context.Context, accountID string) (Roster, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	roster := Roster{Invisible: b.invisible[accountID]}
	for _, friend := range b.friends[accountID] {
		roster.Friends = append(roster.Friends, RosterFriend{AccountID: friend, Invisible: b.invisible[friend]})
	}
	return roster, nil
}

func (b *fakeBackend) InGame(_ context.Context, ids []string) (map[string]bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.gameErr != nil {
		return nil, b.gameErr
	}
	result := map[string]bool{}
	for _, id := range ids {
		if b.inGame[id] {
			result[id] = true
		}
	}
	return result, nil
}

func (b *fakeBackend) Send(_ context.Context, from, to, text, clientID string) (Message, bool, error) {
	if ok, mutedUntil := b.hub.AllowChat(from); !ok {
		return Message{}, false, &FloodError{MutedUntil: mutedUntil}
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if previous, ok := b.clientIDs[from+"|"+clientID]; ok {
		return previous, true, nil
	}
	friends := false
	for _, friend := range b.friends[from] {
		friends = friends || friend == to
	}
	if !friends {
		return Message{}, false, apierr.New(http.StatusForbidden, "NOT_FRIENDS")
	}
	b.nextID++
	message := Message{ID: b.nextID, From: from, To: to, Text: text, SentAt: 1, ClientID: clientID}
	b.clientIDs[from+"|"+clientID] = message
	return message, false, nil
}

func (b *fakeBackend) Read(context.Context, string, string, int64) error { return nil }

type testHub struct {
	t       *testing.T
	hub     *Hub
	backend *fakeBackend
	server  *httptest.Server
	url     string
}

func newTestHub(t *testing.T, opts Options) *testHub {
	t.Helper()
	backend := newFakeBackend()
	if opts.OfflineGrace == 0 {
		opts.OfflineGrace = 50 * time.Millisecond
	}
	opts.Logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := New(backend, opts)
	backend.hub = hub
	server := httptest.NewServer(hub)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := hub.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
		server.Close()
	})
	return &testHub{t: t, hub: hub, backend: backend, server: server, url: "ws" + strings.TrimPrefix(server.URL, "http")}
}

type client struct {
	t  *testing.T
	ws *websocket.Conn
}

func (h *testHub) dial() *client {
	h.t.Helper()
	ws, _, err := websocket.DefaultDialer.Dial(h.url, nil)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { ws.Close() })
	return &client{t: h.t, ws: ws}
}

// connect dials and says hello as accountID, returning after the welcome.
func (h *testHub) connect(accountID string) *client {
	h.t.Helper()
	c := h.dial()
	c.send(map[string]any{"type": "hello", "token": "token-" + accountID})
	if welcome := c.expect("welcome"); welcome["accountId"] != accountID {
		h.t.Fatalf("welcome %v", welcome)
	}
	return c
}

func (c *client) send(value any) {
	c.t.Helper()
	if err := c.ws.WriteJSON(value); err != nil {
		c.t.Fatal(err)
	}
}

func (c *client) read() (map[string]any, error) {
	_ = c.ws.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, data, err := c.ws.ReadMessage()
	if err != nil {
		return nil, err
	}
	var frame map[string]any
	if err := json.Unmarshal(data, &frame); err != nil {
		c.t.Fatalf("frame %s: %v", data, err)
	}
	return frame, nil
}

// expect reads the next frame and checks its type.
func (c *client) expect(kind string) map[string]any {
	c.t.Helper()
	frame, err := c.read()
	if err != nil {
		c.t.Fatalf("waiting for %s: %v", kind, err)
	}
	if frame["type"] != kind {
		c.t.Fatalf("frame %v, want type %s", frame, kind)
	}
	return frame
}

// expectClose reads until the socket closes and checks the code.
func (c *client) expectClose(code int) {
	c.t.Helper()
	for {
		_, err := c.read()
		if err == nil {
			continue
		}
		var closed *websocket.CloseError
		if !errors.As(err, &closed) || closed.Code != code {
			c.t.Fatalf("close %v, want %d", err, code)
		}
		return
	}
}

// quiet checks that nothing arrives for a moment.
func (c *client) quiet() {
	c.t.Helper()
	_ = c.ws.SetReadDeadline(time.Now().Add(150 * time.Millisecond))
	if _, data, err := c.ws.ReadMessage(); err == nil {
		c.t.Fatalf("unexpected frame %s", data)
	}
	// A read deadline breaks a gorilla connection; tests call quiet last.
}

func (c *client) expectPresence(accountID, presence string) {
	c.t.Helper()
	frame := c.expect("presence")
	if frame["accountId"] != accountID || frame["presence"] != presence {
		c.t.Fatalf("presence %v, want %s %s", frame, accountID, presence)
	}
}

func TestHelloAndLogin(t *testing.T) {
	h := newTestHub(t, Options{HelloTimeout: 200 * time.Millisecond})
	// A bad token, a missing token and a frame other than hello: LOGIN_REQUIRED, 4001.
	for _, hello := range []any{
		map[string]any{"type": "hello", "token": "bad"},
		map[string]any{"type": "hello"},
		map[string]any{"type": "ping"},
	} {
		c := h.dial()
		c.send(hello)
		if frame := c.expect("error"); frame["code"] != "LOGIN_REQUIRED" {
			t.Fatalf("error %v", frame)
		}
		c.expectClose(CloseSessionEnded)
	}
	// No hello in time.
	c := h.dial()
	if frame := c.expect("error"); frame["code"] != "LOGIN_REQUIRED" {
		t.Fatalf("error %v", frame)
	}
	c.expectClose(CloseSessionEnded)

	c = h.connect("a")
	c.send(map[string]any{"type": "ping", "requestId": "r1"})
	if pong := c.expect("pong"); pong["requestId"] != "r1" {
		t.Fatalf("pong %v", pong)
	}
	c.send(map[string]any{"type": "dance"})
	if frame := c.expect("error"); frame["code"] != "INVALID_REQUEST" {
		t.Fatalf("error %v", frame)
	}
	// Logout closes the session's sockets.
	h.hub.CloseSession("key-token-a")
	c.expectClose(CloseSessionEnded)
}

func TestPlainRequestsAndCapacity(t *testing.T) {
	h := newTestHub(t, Options{MaxConnections: 1})
	response, err := http.Get(h.server.URL)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("plain request: %d", response.StatusCode)
	}
	h.connect("a")
	if _, response, err := websocket.DefaultDialer.Dial(h.url, nil); err == nil || response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("socket over the cap: %v", err)
	}
}

func TestOldestSocketReplaced(t *testing.T) {
	h := newTestHub(t, Options{MaxPerAccount: 2})
	first := h.connect("a")
	h.connect("a")
	h.connect("a")
	first.expectClose(CloseReplaced)
}

func TestSessionRecheck(t *testing.T) {
	h := newTestHub(t, Options{SessionCheck: 50 * time.Millisecond})
	c := h.connect("a")
	h.backend.mu.Lock()
	h.backend.revoked["token-a"] = true
	h.backend.mu.Unlock()
	c.expectClose(CloseSessionEnded)
}

func TestPresence(t *testing.T) {
	h := newTestHub(t, Options{OfflineGrace: 300 * time.Millisecond})
	h.backend.befriend("a", "b")
	b := h.connect("b")
	a := h.connect("a")
	b.expectPresence("a", Online)
	if online := h.hub.Online([]string{"a", "b", "c"}); !online["a"] || !online["b"] || online["c"] {
		t.Fatalf("online %v", online)
	}

	// A second tab and its close change nothing; the last close goes
	// offline after the grace.
	extra := h.connect("a")
	extra.ws.Close()
	a.send(map[string]any{"type": "ping"})
	a.expect("pong")
	a.ws.Close()
	b.expectPresence("a", Offline)

	// A reload within the grace stays online.
	a = h.connect("a")
	b.expectPresence("a", Online)
	a.ws.Close()
	a = h.connect("a")

	// Invisible accounts are offline, also in game.
	h.hub.SettingsChanged("a", true)
	b.expectPresence("a", Offline)
	h.hub.SettingsChanged("a", false)
	b.expectPresence("a", Online)
	h.backend.mu.Lock()
	h.backend.inGame["a"] = true
	h.backend.mu.Unlock()
	h.hub.GameChanged("a")
	b.expectPresence("a", InGame)
	h.hub.SettingsChanged("a", true)
	b.expectPresence("a", Offline)
	h.hub.SettingsChanged("a", false)
	b.expectPresence("a", InGame)

	// The reconciliation notices a game node that vanished.
	h.backend.mu.Lock()
	h.backend.inGame["a"] = false
	h.backend.mu.Unlock()
	h.hub.Reconcile(context.Background())
	b.expectPresence("a", Online)
	// Without Redis the last known state stays.
	h.backend.mu.Lock()
	h.backend.inGame["a"] = true
	h.backend.gameErr = errors.New("redis down")
	h.backend.mu.Unlock()
	h.hub.Reconcile(context.Background())
	h.hub.GameChanged("a")
	a.send(map[string]any{"type": "ping"})
	a.expect("pong")
	b.quiet()
}

func TestFriendsChanged(t *testing.T) {
	h := newTestHub(t, Options{})
	a := h.connect("a")
	b := h.connect("b")
	// Not friends yet: b hears nothing about a.
	h.hub.SettingsChanged("a", true)
	h.hub.SettingsChanged("a", false)
	h.backend.befriend("a", "b")
	h.hub.FriendsChanged("a", "b")
	time.Sleep(100 * time.Millisecond)
	a.ws.Close()
	b.expectPresence("a", Offline)
}

func TestChatFlood(t *testing.T) {
	clock := &fakeClock{at: time.UnixMilli(1_000_000)}
	h := newTestHub(t, Options{Now: clock.now})
	for range 5 {
		if ok, _ := h.hub.AllowChat("a"); !ok {
			t.Fatal("burst refused")
		}
	}
	ok, mutedUntil := h.hub.AllowChat("a")
	if ok || mutedUntil != 1_010_000 {
		t.Fatalf("flood: %v until %d", ok, mutedUntil)
	}
	if ok, _ := h.hub.AllowChat("b"); !ok {
		t.Fatal("another account was muted")
	}
	clock.advance(9 * time.Second)
	if ok, until := h.hub.AllowChat("a"); ok || until != mutedUntil {
		t.Fatalf("mute not kept: %v %d", ok, until)
	}
	clock.advance(time.Second)
	if ok, _ := h.hub.AllowChat("a"); !ok {
		t.Fatal("still muted after 10 s")
	}
	// Idle limiters are forgotten.
	clock.advance(2 * time.Minute)
	h.hub.Reconcile(context.Background())
	h.hub.mu.Lock()
	left := len(h.hub.chat)
	h.hub.mu.Unlock()
	if left != 0 {
		t.Fatalf("%d chat limiters kept", left)
	}
}

func TestSendOverSocket(t *testing.T) {
	h := newTestHub(t, Options{})
	h.backend.befriend("a", "b")
	a := h.connect("a")
	other := h.connect("a")
	b := h.connect("b")
	a.expectPresence("b", Online)
	other.expectPresence("b", Online)

	a.send(map[string]any{"type": "send", "to": "b", "text": "hi", "clientId": "c1", "requestId": "s1"})
	sent := a.expect("sent")
	message := sent["message"].(map[string]any)
	if sent["requestId"] != "s1" || sent["duplicate"] != false || message["text"] != "hi" || message["from"] != "a" {
		t.Fatalf("sent %v", sent)
	}
	for _, c := range []*client{b, other} {
		if pushed := c.expect("message"); pushed["message"].(map[string]any)["id"] != message["id"] {
			t.Fatalf("pushed %v", pushed)
		}
	}
	// A resend is answered but not delivered again.
	a.send(map[string]any{"type": "send", "to": "b", "text": "hi", "clientId": "c1"})
	if sent := a.expect("sent"); sent["duplicate"] != true {
		t.Fatalf("resend %v", sent)
	}
	b.send(map[string]any{"type": "send", "to": "c", "text": "hi", "clientId": "c2", "requestId": "s2"})
	if frame := b.expect("error"); frame["code"] != "NOT_FRIENDS" || frame["requestId"] != "s2" {
		t.Fatalf("error %v", frame)
	}
	// read pushes sync to the reader's other sockets.
	a.send(map[string]any{"type": "read", "with": "b", "upTo": 1})
	other.expect("sync")
	a.send(map[string]any{"type": "read", "with": "b", "upTo": "x"})
	if frame := a.expect("error"); frame["code"] != "INVALID_REQUEST" {
		t.Fatalf("error %v", frame)
	}
	// Sync and notices reach every socket of the account.
	h.hub.Sync("b", "b")
	b.expect("sync")
	h.hub.Notice("b", NoticeFriendRequest, "a", "Ann")
	if notice := b.expect("notice"); notice["kind"] != NoticeFriendRequest || notice["nickname"] != "Ann" {
		t.Fatalf("notice %v", notice)
	}
	b.quiet()
}

func TestSocketChatFlood(t *testing.T) {
	h := newTestHub(t, Options{})
	h.backend.befriend("a", "b")
	a := h.connect("a")
	for i := range 6 {
		a.send(map[string]any{"type": "send", "to": "b", "text": "x", "clientId": string(rune('a' + i))})
	}
	for range 5 {
		a.expect("sent")
	}
	frame := a.expect("error")
	if frame["code"] != "CHAT_FLOOD" || frame["mutedUntil"].(float64) <= float64(time.Now().UnixMilli()) {
		t.Fatalf("flood %v", frame)
	}
}

func TestCommandFloodCloses(t *testing.T) {
	h := newTestHub(t, Options{CommandRate: 1, CommandBurst: 3})
	a := h.connect("a")
	for range 5 {
		a.send(map[string]any{"type": "ping"})
	}
	a.expectClose(websocket.ClosePolicyViolation)
}

func TestShutdownClosesSockets(t *testing.T) {
	h := newTestHub(t, Options{})
	a := h.connect("a")
	closed := make(chan struct{})
	var code atomic.Int64
	go func() {
		defer close(closed)
		for {
			if _, _, err := a.ws.ReadMessage(); err != nil {
				var closeErr *websocket.CloseError
				if errors.As(err, &closeErr) {
					code.Store(int64(closeErr.Code))
				}
				return
			}
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := h.hub.Shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	<-closed
	if code.Load() != websocket.CloseGoingAway {
		t.Fatalf("close code %d", code.Load())
	}
	if _, response, err := websocket.DefaultDialer.Dial(h.url, nil); err == nil || response.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("socket after shutdown: %v", err)
	}
}

func TestPresenceOf(t *testing.T) {
	cases := []struct {
		invisible, inGame, online bool
		want                      string
	}{
		{false, false, false, Offline}, {false, false, true, Online}, {false, true, false, InGame},
		{false, true, true, InGame}, {true, true, true, Offline}, {true, false, true, Offline},
	}
	for _, c := range cases {
		if got := PresenceOf(c.invisible, c.inGame, c.online); got != c.want {
			t.Errorf("PresenceOf(%v, %v, %v) = %s, want %s", c.invisible, c.inGame, c.online, got, c.want)
		}
	}
}

type fakeClock struct {
	mu sync.Mutex
	at time.Time
}

func (c *fakeClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.at
}

func (c *fakeClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.at = c.at.Add(d)
}
