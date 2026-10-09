package myroom

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/shared/apierr"
)

// fakeBackend is an in-memory Backend: tokens are "token-<account>", the
// rider "<account>" has nickname "N<account>" and profile profiles[account].
type fakeBackend struct {
	mu       sync.Mutex
	profiles map[string]string
	blocks   map[string]bool // owner|visitor
	online   []string
	emblems  map[string][2]int
	guesses  map[string]int
}

func newFakeBackend() *fakeBackend {
	return &fakeBackend{profiles: map[string]string{}, blocks: map[string]bool{}, emblems: map[string][2]int{},
		guesses: map[string]int{}}
}

func (b *fakeBackend) Authenticate(_ context.Context, token string) (Session, bool, error) {
	id, ok := strings.CutPrefix(token, "token-")
	if !ok {
		return Session{}, false, nil
	}
	return Session{AccountID: id, Key: "key-" + token}, true, nil
}

func (b *fakeBackend) Rider(_ context.Context, accountID string) (Rider, bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if strings.HasPrefix(accountID, "ghost") {
		return Rider{}, false, nil
	}
	return Rider{AccountID: accountID, Nickname: "N" + accountID, Exp: 7,
		Profile: ParseProfile(b.profiles[accountID])}, true, nil
}

func (b *fakeBackend) RiderByNickname(ctx context.Context, nickname string) (Rider, bool, error) {
	id, ok := strings.CutPrefix(nickname, "N")
	if !ok {
		return Rider{}, false, nil
	}
	return b.Rider(ctx, id)
}

func (b *fakeBackend) MainEmblems(_ context.Context, accountID string) ([2]int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.emblems[accountID], nil
}

func (b *fakeBackend) Blocked(_ context.Context, owner, visitor string) (bool, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.blocks[owner+"|"+visitor], nil
}

func (b *fakeBackend) Online(limit int) []string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return append([]string(nil), b.online...)
}

func (b *fakeBackend) PasswordAttempt(_ context.Context, accountID string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.guesses[accountID]++
	if b.guesses[accountID] > 3 {
		return apierr.New(http.StatusTooManyRequests, "RATE_LIMITED")
	}
	return nil
}

func (b *fakeBackend) setProfile(id, profile string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.profiles[id] = profile
}

type testHub struct {
	t       *testing.T
	hub     *Hub
	backend *fakeBackend
	url     string
	now     time.Time
	nowMu   sync.Mutex
}

func newTestHub(t *testing.T) *testHub {
	t.Helper()
	backend := newFakeBackend()
	th := &testHub{t: t, backend: backend, now: time.UnixMilli(1_000_000)}
	hub := New(backend, Options{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Now: th.clock,
		ChatRate: 1000, ChatBurst: 1000})
	th.hub = hub
	server := httptest.NewServer(hub)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := hub.Shutdown(ctx); err != nil {
			t.Errorf("shutdown: %v", err)
		}
		server.Close()
	})
	th.url = "ws" + strings.TrimPrefix(server.URL, "http")
	return th
}

func (h *testHub) clock() time.Time {
	h.nowMu.Lock()
	defer h.nowMu.Unlock()
	return h.now
}

func (h *testHub) advance(d time.Duration) {
	h.nowMu.Lock()
	defer h.nowMu.Unlock()
	h.now = h.now.Add(d)
}

type wsClient struct {
	t  *testing.T
	ws *websocket.Conn
}

func (h *testHub) connect(accountID string) *wsClient {
	h.t.Helper()
	ws, _, err := websocket.DefaultDialer.Dial(h.url, nil)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { ws.Close() })
	c := &wsClient{t: h.t, ws: ws}
	c.send(map[string]any{"type": "hello", "token": "token-" + accountID})
	if welcome := c.expect("welcome"); welcome["accountId"] != accountID {
		h.t.Fatalf("welcome %v", welcome)
	}
	return c
}

func (c *wsClient) send(value any) {
	c.t.Helper()
	if err := c.ws.WriteJSON(value); err != nil {
		c.t.Fatal(err)
	}
}

func (c *wsClient) read() (map[string]any, error) {
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

func (c *wsClient) expect(kind string) map[string]any {
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

func (c *wsClient) expectError(code string) map[string]any {
	c.t.Helper()
	frame := c.expect("error")
	if frame["code"] != code {
		c.t.Fatalf("error %v, want %s", frame, code)
	}
	return frame
}

func (c *wsClient) enter(fields map[string]any) {
	c.t.Helper()
	frame := map[string]any{"type": "enter", "requestId": "r"}
	for key, value := range fields {
		frame[key] = value
	}
	c.send(frame)
}

func members(t *testing.T, frame map[string]any) []map[string]any {
	t.Helper()
	list, _ := frame["members"].([]any)
	out := make([]map[string]any, len(list))
	for i, item := range list {
		out[i], _ = item.(map[string]any)
	}
	return out
}

func TestHelloRequired(t *testing.T) {
	h := newTestHub(t)
	ws, _, err := websocket.DefaultDialer.Dial(h.url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	c := &wsClient{t: t, ws: ws}
	c.send(map[string]any{"type": "enter"})
	c.expectError(CodeLoginRequired)
	for {
		if _, err := c.read(); err != nil {
			var closed *websocket.CloseError
			if !errors.As(err, &closed) || closed.Code != CloseSessionEnded {
				t.Fatalf("close %v", err)
			}
			return
		}
	}
}

func TestOwnRoomVisitAndBroadcasts(t *testing.T) {
	h := newTestHub(t)
	h.backend.setProfile("owner", `{"equipment":{"itemIds":{"1":2,"3":7},"kartSerial":0},"initial":"A",
		"garage":{"version":1,"builds":{"7:0":{"x":1},"9:0":{"y":2}}},
		"myRoom":{"environmentId":20,"displayName":"Home","message":"hi","displayKarts":[{"kind":"kart","itemId":9}]}}`)
	h.backend.emblems["owner"] = [2]int{8196, 0}
	owner := h.connect("owner")
	owner.enter(nil)
	room := owner.expect("room")
	view := room["room"].(map[string]any)
	settings := view["settings"].(map[string]any)
	if view["ownerNickname"] != "Nowner" || settings["environmentId"] != 20.0 || settings["displayName"] != "Home" ||
		settings["locked"] != false || view["mainEmblems"].([]any)[0] != 8196.0 {
		t.Fatalf("room %v", room)
	}
	appearance := view["ownerAppearance"].(map[string]any)
	builds := appearance["garage"].(map[string]any)["builds"].(map[string]any)
	if len(builds) != 2 || appearance["initial"] != "A" {
		t.Fatalf("appearance %v", appearance)
	}
	if list := members(t, room); len(list) != 1 || list[0]["owner"] != true || list[0]["slot"] != 0.0 {
		t.Fatalf("members %v", list)
	}

	visitor := h.connect("v1")
	visitor.enter(map[string]any{"nickname": "Nowner"})
	joined := visitor.expect("room")
	if list := members(t, joined); len(list) != 2 || list[1]["accountId"] != "v1" || list[1]["slot"] != 1.0 ||
		list[1]["owner"] != false {
		t.Fatalf("visitor members %v", list)
	}
	if frame := owner.expect("joined"); frame["member"].(map[string]any)["nickname"] != "Nv1" {
		t.Fatalf("joined %v", frame)
	}
	visitor.enter(map[string]any{"nickname": "Nowner"})
	if frame := visitor.expectError(CodeAlreadyHere); frame["nickname"] != "Nowner" {
		t.Fatalf("already here %v", frame)
	}

	visitor.send(map[string]any{"type": "move", "x": 1.5, "y": 0, "z": -2, "yaw": 0.5, "moving": true})
	if moved := owner.expect("moved"); moved["accountId"] != "v1" || moved["x"] != 1.5 || moved["moving"] != true {
		t.Fatalf("moved %v", moved)
	}
	visitor.send(map[string]any{"type": "move", "x": "bad", "y": 0, "z": 0, "yaw": 0})
	visitor.send(map[string]any{"type": "chat", "text": "  你好  "})
	for _, c := range []*wsClient{owner, visitor} {
		if line := c.expect("chat"); line["text"] != "你好" || line["nickname"] != "Nv1" {
			t.Fatalf("chat %v", line)
		}
	}
	visitor.send(map[string]any{"type": "chat", "text": strings.Repeat("长", maxChat+1)})
	visitor.expectError(CodeInvalidRequest)

	// A newcomer sees the visitor's last pose.
	third := h.connect("v2")
	third.enter(map[string]any{"nickname": "Nowner"})
	list := members(t, third.expect("room"))
	if pose, _ := list[1]["pose"].(map[string]any); pose == nil || pose["z"] != -2.0 {
		t.Fatalf("members for newcomer %v", list)
	}
	owner.expect("joined")
	visitor.expect("joined")

	third.send(map[string]any{"type": "leave", "requestId": "x"})
	third.expect("left-room")
	for _, c := range []*wsClient{owner, visitor} {
		if left := c.expect("left"); left["accountId"] != "v2" {
			t.Fatalf("left %v", left)
		}
	}
}

func TestChatDisabledAndKick(t *testing.T) {
	h := newTestHub(t)
	h.backend.setProfile("owner", `{"myRoom":{"chatAllowed":false}}`)
	owner := h.connect("owner")
	owner.enter(nil)
	owner.expect("room")
	visitor := h.connect("v1")
	visitor.enter(map[string]any{"nickname": "Nowner"})
	visitor.expect("room")
	owner.expect("joined")

	visitor.send(map[string]any{"type": "chat", "text": "hello"})
	visitor.expectError(CodeChatDisabled)
	owner.send(map[string]any{"type": "chat", "text": "owner may"})
	owner.expect("chat")
	visitor.expect("chat")

	visitor.send(map[string]any{"type": "kick", "accountId": "owner"})
	visitor.expectError(CodeNotOwner)
	owner.send(map[string]any{"type": "kick", "accountId": "v1", "requestId": "k"})
	if kicked := visitor.expect("kicked"); kicked["ownerNickname"] != "Nowner" {
		t.Fatalf("kicked %v", kicked)
	}
	if left := owner.expect("left"); left["reason"] != "kicked" {
		t.Fatalf("left %v", left)
	}
	owner.expect("kicked-ok")
	visitor.enter(map[string]any{"nickname": "Nowner"})
	visitor.expectError(CodeKicked)
	h.advance(6 * time.Minute)
	visitor.enter(map[string]any{"nickname": "Nowner"})
	visitor.expect("room")
}

func TestPasswordBlockUnknownAndFull(t *testing.T) {
	h := newTestHub(t)
	h.backend.setProfile("owner", `{"myRoom":{"roomPassword":"secret","etcPassword":"x"}}`)
	visitor := h.connect("v1")
	visitor.enter(map[string]any{"nickname": "Nowner"})
	visitor.expectError(CodePasswordRequired)
	visitor.enter(map[string]any{"nickname": "Nowner", "password": "nope"})
	visitor.expectError(CodeWrongPassword)
	visitor.enter(map[string]any{"nickname": "Nowner", "password": "secret"})
	room := visitor.expect("room")
	settings := room["room"].(map[string]any)["settings"].(map[string]any)
	if settings["locked"] != true || settings["etcLocked"] != true {
		t.Fatalf("settings %v", settings)
	}
	if strings.Contains(fmt.Sprint(room), "secret") {
		t.Fatalf("password leaked: %v", room)
	}

	visitor.enter(map[string]any{"nickname": "Nghost"})
	visitor.expectError(CodeUnknownRider)

	h.backend.blocks["other|v1"] = true
	visitor.enter(map[string]any{"nickname": "Nother"})
	visitor.expectError(CodeCannotEnter)

	// Seven visitor cards; the eighth visitor finds the room full, the
	// owner still gets card 0.
	for i := 2; i <= 7; i++ {
		c := h.connect(fmt.Sprintf("v%d", i))
		c.enter(map[string]any{"nickname": "Nowner", "password": "secret"})
		c.expect("room")
	}
	late := h.connect("v8")
	late.enter(map[string]any{"nickname": "Nowner", "password": "secret"})
	late.expectError(CodeRoomFull)
	owner := h.connect("owner")
	owner.enter(nil)
	if list := members(t, owner.expect("room")); len(list) != 8 || list[0]["slot"] != 0.0 {
		t.Fatalf("full room %v", list)
	}
}

func TestRandomVisit(t *testing.T) {
	h := newTestHub(t)
	h.backend.setProfile("locked", `{"myRoom":{"roomPassword":"p"}}`)
	visitor := h.connect("v1")
	visitor.enter(map[string]any{"random": true})
	visitor.expectError(CodeRandomFailed)
	h.backend.mu.Lock()
	h.backend.online = []string{"v1", "locked", "open"}
	h.backend.mu.Unlock()
	visitor.enter(map[string]any{"random": true})
	room := visitor.expect("room")
	if owner := room["room"].(map[string]any)["ownerId"]; owner != "open" {
		t.Fatalf("random room of %v", owner)
	}
	// Already in the only open room: nothing else qualifies.
	visitor.enter(map[string]any{"random": true})
	visitor.expectError(CodeRandomFailed)
}

func TestOneRoomPerAccountAndRefresh(t *testing.T) {
	h := newTestHub(t)
	owner := h.connect("owner")
	owner.enter(nil)
	owner.expect("room")
	first := h.connect("v1")
	first.enter(map[string]any{"nickname": "Nowner"})
	first.expect("room")
	owner.expect("joined")
	second := h.connect("v1")
	second.enter(nil)
	second.expect("room")
	if frame := first.expect("left-room"); frame["reason"] != "replaced" {
		t.Fatalf("replaced %v", frame)
	}
	if left := owner.expect("left"); left["reason"] != "replaced" {
		t.Fatalf("left %v", left)
	}

	h.backend.setProfile("owner", `{"myRoom":{"environmentId":3}}`)
	h.hub.RefreshOwner("owner")
	settings := owner.expect("settings")["room"].(map[string]any)["settings"].(map[string]any)
	if settings["environmentId"] != 3.0 {
		t.Fatalf("refreshed %v", settings)
	}
	owner.expect("member")
}

func TestParseProfileDefaults(t *testing.T) {
	profile := ParseProfile("not json")
	if s := profile.Settings; s.EnvironmentID != DefaultEnvironment || !s.ChatAllowed || s.Locked || s.EtcLocked ||
		profile.Appearance != nil {
		t.Fatalf("default %+v", profile)
	}
	profile = ParseProfile(`{"equipment":{"itemIds":{"3":0},"kartSerial":0},"myRoom":{"displayName":"` +
		strings.Repeat("名", 40) + `","displayKarts":[{"kind":"kart","itemId":1},{"kind":"pet","itemId":2},
		{"kind":"kart","itemId":3},{"kind":"kart","itemId":4}],"etcPassword":"abc"}}`)
	s := profile.Settings
	if len([]rune(s.DisplayName)) != maxDisplayName || len(s.DisplayKarts) != 1 || !s.EtcLocked ||
		!s.EtcPasswordMatches("abc") || s.EtcPasswordMatches("abd") || !s.RoomPasswordMatches("") {
		t.Fatalf("parsed %+v", s)
	}
}
