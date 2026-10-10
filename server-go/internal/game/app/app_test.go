package app

import (
	"context"
	"crypto/subtle"
	"encoding/binary"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"net"
	"net/http"
	"net/http/httptest"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/game/anticheat"
	"kartsim/internal/game/config"
	"kartsim/internal/game/outbox"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/ticket"
)

const (
	e2eSecret   = "e2e-cluster-secret-0123456789abcdefgh"
	e2eNode     = "game-e2e"
	e2eDataNode = "data-e2e"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// fakeData implements the data service's internal API in memory.
type fakeData struct {
	mu         sync.Mutex
	paths      []string // every authorized call, in arrival order
	heartbeats []contract.HeartbeatRequest
	leaves     []contract.NodeLeaveRequest
	claims     []contract.PresenceClaimRequest
	releases   []contract.PresenceReleaseRequest
	rules      []contract.RoomRulesRequest
	races      []contract.RaceSettlement
	cheats     []contract.AntiCheatReport
	presence   map[string]string // lower(name) → nodeId|playerId
	badKeys    int
	rulesDown  bool // answer room-rules saves with 503

	verifies   []contract.EquipmentVerifyRequest
	unowned    map[int]bool  // item IDs no account owns
	rentals    map[int]int64 // item ID → rental end (Unix ms), reported as validUntil
	verifyDown bool          // answer equipment checks with 503
	conflicts  []string      // returned (once) by the next heartbeat
}

func newFakeData() *fakeData {
	return &fakeData{presence: map[string]string{}, unowned: map[int]bool{}, rentals: map[int]int64{}}
}

func (f *fakeData) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		apierr.WriteError(w, apierr.New(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED"))
		return
	}
	if subtle.ConstantTimeCompare([]byte(r.Header.Get(contract.ClusterKeyHeader)), []byte(e2eSecret)) != 1 {
		f.mu.Lock()
		f.badKeys++
		f.mu.Unlock()
		apierr.WriteError(w, apierr.New(http.StatusUnauthorized, "CLUSTER_KEY_INVALID"))
		return
	}
	body, _ := io.ReadAll(r.Body)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.paths = append(f.paths, r.URL.Path)
	decode := func(target any) bool {
		if err := json.Unmarshal(body, target); err != nil {
			apierr.WriteError(w, apierr.New(http.StatusBadRequest, "INVALID_REQUEST"))
			return false
		}
		return true
	}
	switch r.URL.Path {
	case contract.PathHeartbeat:
		var req contract.HeartbeatRequest
		if decode(&req) {
			f.heartbeats = append(f.heartbeats, req)
			apierr.WriteJSON(w, http.StatusOK, contract.HeartbeatResponse{Accepted: true,
				DataNode: e2eDataNode, ServerTime: time.Now().UnixMilli(), Conflicts: f.conflicts})
			f.conflicts = nil
		}
	case contract.PathNodeLeave:
		var req contract.NodeLeaveRequest
		if decode(&req) {
			f.leaves = append(f.leaves, req)
			apierr.WriteJSON(w, http.StatusOK, contract.OK{OK: true})
		}
	case contract.PathPresenceClaim:
		var req contract.PresenceClaimRequest
		if !decode(&req) {
			return
		}
		key, value := strings.ToLower(req.Name), req.NodeID+"|"+req.PlayerID
		if current, ok := f.presence[key]; ok && current != value {
			apierr.WriteError(w, apierr.New(http.StatusConflict, "NICKNAME_TAKEN"))
			return
		}
		f.presence[key] = value
		f.claims = append(f.claims, req)
		apierr.WriteJSON(w, http.StatusOK, contract.OK{OK: true})
	case contract.PathPresenceRelease:
		var req contract.PresenceReleaseRequest
		if decode(&req) {
			key := strings.ToLower(req.Name)
			if f.presence[key] == req.NodeID+"|"+req.PlayerID {
				delete(f.presence, key)
			}
			f.releases = append(f.releases, req)
			apierr.WriteJSON(w, http.StatusOK, contract.OK{OK: true})
		}
	case contract.PathRoomRules:
		if f.rulesDown {
			apierr.WriteError(w, apierr.New(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE"))
			return
		}
		var req contract.RoomRulesRequest
		if decode(&req) {
			f.rules = append(f.rules, req)
			apierr.WriteJSON(w, http.StatusOK, contract.OK{OK: true})
		}
	case contract.PathRaces:
		var req contract.RaceSettlement
		if decode(&req) {
			f.races = append(f.races, req)
			apierr.WriteJSON(w, http.StatusOK, contract.RaceSettlementResponse{Stored: true})
		}
	case contract.PathAntiCheat:
		var req contract.AntiCheatReport
		if decode(&req) {
			f.cheats = append(f.cheats, req)
			apierr.WriteJSON(w, http.StatusOK, contract.OK{OK: true})
		}
	case contract.PathEquipmentVerify:
		if f.verifyDown {
			apierr.WriteError(w, apierr.New(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE"))
			return
		}
		var req contract.EquipmentVerifyRequest
		if !decode(&req) {
			return
		}
		f.verifies = append(f.verifies, req)
		var equipment struct {
			ItemIDs map[string]int `json:"itemIds"`
		}
		if req.AccountID == "" || json.Unmarshal(req.Equipment, &equipment) != nil {
			apierr.WriteError(w, apierr.New(http.StatusBadRequest, "INVALID_REQUEST"))
			return
		}
		var missing []contract.EquipmentSlot
		for slot, item := range equipment.ItemIDs {
			if f.unowned[item] {
				number, _ := strconv.Atoi(slot)
				missing = append(missing, contract.EquipmentSlot{Slot: number, ItemID: item})
			}
		}
		if len(missing) > 0 {
			apierr.WriteJSON(w, http.StatusConflict, struct {
				Error string `json:"error"`
				contract.EquipmentVerifyResponse
			}{"ITEM_NOT_OWNED", contract.EquipmentVerifyResponse{Missing: missing}})
			return
		}
		answer := contract.EquipmentVerifyResponse{OK: true}
		for _, item := range equipment.ItemIDs {
			if until, ok := f.rentals[item]; ok && (answer.ValidUntil == nil || until < *answer.ValidUntil) {
				answer.ValidUntil = &until
			}
		}
		apierr.WriteJSON(w, http.StatusOK, answer)
	default:
		apierr.WriteError(w, apierr.New(http.StatusNotFound, "NOT_FOUND"))
	}
}

func (f *fakeData) read(fn func()) {
	f.mu.Lock()
	defer f.mu.Unlock()
	fn()
}

// manualClock drives the race timers from the test.
type manualClock struct {
	mu     sync.Mutex
	now    int64
	timers []manualTimer
}

type manualTimer struct {
	at int64
	f  func()
}

func (c *manualClock) Now() int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *manualClock) AfterFunc(d time.Duration, f func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.timers = append(c.timers, manualTimer{c.now + d.Milliseconds(), f})
}

func (c *manualClock) Advance(d time.Duration) {
	c.mu.Lock()
	c.now += d.Milliseconds()
	var due []manualTimer
	c.timers = slices.DeleteFunc(c.timers, func(t manualTimer) bool {
		if t.at <= c.now {
			due = append(due, t)
			return true
		}
		return false
	})
	c.mu.Unlock()
	for _, t := range due {
		t.f()
	}
}

type node struct {
	app    *App
	server *httptest.Server
	data   *fakeData
	clock  *manualClock
	wsURL  string
}

func startNode(t *testing.T, dataURL string, data *fakeData) *node {
	t.Helper()
	return startNodeWith(t, dataURL, data, nil)
}

// startNodeWith lets the test adjust the configuration before the node starts.
func startNodeWith(t *testing.T, dataURL string, data *fakeData, adjust func(*config.Config)) *node {
	t.Helper()
	cfg := config.Config{
		Addr: "127.0.0.1", Port: 18799, NodeID: e2eNode, NodeName: "测试节点",
		PublicOrigin: "http://127.0.0.1:18799", DataInternalURL: dataURL,
		DataNodeID: e2eDataNode, Secret: []byte(e2eSecret), MaxPlayers: 10,
		OutboxDir: t.TempDir(), Network: netcfg.New(""), HeartbeatInterval: 40 * time.Millisecond,
		AllowGuests: true,
		// The end-to-end race finishes without driving; TestAntiCheatKick
		// turns the anti-cheat on.
		AntiCheat: anticheat.ModeOff,
	}
	if adjust != nil {
		adjust(&cfg)
	}
	clock := &manualClock{}
	a, err := New(cfg, quiet, Options{
		Outbox: outbox.Options{MinBackoff: 10 * time.Millisecond, MaxBackoff: 50 * time.Millisecond},
		Clock:  clock,
	})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(a.Handler())
	a.Start()
	n := &node{app: a, server: server, data: data, clock: clock,
		wsURL: "ws" + strings.TrimPrefix(server.URL, "http") + "/multiplayer/ws"}
	t.Cleanup(func() {
		_ = a.Shutdown(context.Background())
		server.Close()
	})
	return n
}

func sign(t *testing.T, claims ticket.Claims) string {
	t.Helper()
	if claims.NodeID == "" {
		claims.NodeID = e2eNode
	}
	if claims.DataNode == "" {
		claims.DataNode = e2eDataNode
	}
	token, _ := ticket.Sign([]byte(e2eSecret), claims, time.Now())
	return token
}

// wsClient is a test WebSocket peer that keeps unrelated messages.
type wsClient struct {
	t       *testing.T
	conn    *websocket.Conn
	backlog []map[string]any
	frames  [][]byte
	nextID  int
}

func dial(t *testing.T, url string, header http.Header) *wsClient {
	t.Helper()
	conn, resp, err := websocket.DefaultDialer.Dial(url, header)
	if err != nil {
		status := 0
		if resp != nil {
			status = resp.StatusCode
		}
		t.Fatalf("dial: %v (status %d)", err, status)
	}
	c := &wsClient{t: t, conn: conn}
	t.Cleanup(func() { _ = conn.Close() })
	return c
}

func (c *wsClient) sendRaw(payload string) {
	c.t.Helper()
	if err := c.conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		c.t.Fatal(err)
	}
}

func (c *wsClient) send(value map[string]any) {
	c.t.Helper()
	data, _ := json.Marshal(value)
	c.sendRaw(string(data))
}

// read returns the next message: a decoded object, or nil for a binary frame.
func (c *wsClient) read() (map[string]any, error) {
	c.t.Helper()
	_ = c.conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	kind, data, err := c.conn.ReadMessage()
	if err != nil {
		return nil, err
	}
	if kind == websocket.BinaryMessage {
		c.frames = append(c.frames, data)
		return nil, nil
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		c.t.Fatalf("decode %s: %v", data, err)
	}
	return value, nil
}

// waitFor returns the first message (from the backlog or the socket) that
// matches, keeping the others.
func (c *wsClient) waitFor(match func(map[string]any) bool) map[string]any {
	c.t.Helper()
	for i, m := range c.backlog {
		if match(m) {
			c.backlog = slices.Delete(c.backlog, i, i+1)
			return m
		}
	}
	for {
		m, err := c.read()
		if err != nil {
			c.t.Fatalf("read: %v", err)
		}
		if m == nil {
			continue
		}
		if match(m) {
			return m
		}
		c.backlog = append(c.backlog, m)
	}
}

func (c *wsClient) request(value map[string]any) map[string]any {
	c.t.Helper()
	c.nextID++
	id := "r" + strconv.Itoa(c.nextID)
	value["requestId"] = id
	c.send(value)
	return c.waitFor(func(m map[string]any) bool { return m["requestId"] == id })
}

func (c *wsClient) room(value map[string]any) map[string]any {
	c.t.Helper()
	reply := c.request(value)
	if reply["type"] != "room" {
		c.t.Fatalf("%v: %v", value["type"], reply)
	}
	return reply["room"].(map[string]any)
}

func equipment() map[string]any {
	slots := []int{1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
		32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78}
	ids := map[string]any{}
	for _, slot := range slots {
		value := 0
		if slot == 1 || slot == 3 {
			value = 1
		}
		ids[strconv.Itoa(slot)] = value
	}
	return map[string]any{"itemIds": ids, "kartSerial": 0, "valueAt3E": 0, "exceedType": 0}
}

func hello(name, token string) map[string]any {
	value := map[string]any{"type": "hello", "protocolVersion": 40,
		"ruleset": "launcher-room-v1", "resourceVersion": "p3553", "name": name,
		"initial": "", "equipment": equipment(), "token": "legacy-session-token-is-ignored"}
	if token != "" {
		value["ticket"] = token
	}
	return value
}

func eventually(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestEndToEnd(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)

	// Registration happens at start.
	eventually(t, "first heartbeat", func() (ok bool) {
		data.read(func() { ok = len(data.heartbeats) > 0 })
		return
	})
	data.read(func() {
		// Claims a previous run of this node ID left behind are cleared
		// before the first heartbeat makes the node look alive again.
		if len(data.paths) < 2 || data.paths[0] != contract.PathNodeLeave || data.paths[1] != contract.PathHeartbeat {
			t.Errorf("startup calls %v", data.paths)
		}
		hb := data.heartbeats[0]
		if hb.NodeID != e2eNode || hb.Name != "测试节点" || hb.Origin != "http://127.0.0.1:18799" ||
			hb.Capacity != 10 || hb.ProtocolVersion != contract.ProtocolVersion || hb.Players == nil || hb.StartedAt <= 0 {
			t.Errorf("heartbeat %+v", hb)
		}
	})

	// HTTP surface.
	resp, err := http.Get(n.server.URL + "/multiplayer/healthz")
	if err != nil {
		t.Fatal(err)
	}
	health, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	// heapMB varies; the other load figures are zero on an idle node.
	healthPrefix := `{"protocolVersion":40,"ruleset":"launcher-room-v1","transport":"websocket","service":"game",` +
		`"nodeId":"game-e2e","connections":0,"players":0,"rooms":0,"heapMB":`
	if !strings.HasPrefix(string(health), healthPrefix) ||
		!strings.HasSuffix(string(health), `,"outboxPending":0,"outboxWriteFailing":false,"webrtc":false}`) {
		t.Fatalf("healthz %s", health)
	}
	resp, err = http.Get(n.server.URL + "/multiplayer/auth/config")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown path status %d", resp.StatusCode)
	}
	_, resp, err = websocket.DefaultDialer.Dial(n.wsURL, http.Header{"Origin": {"http://evil.example"}})
	if err == nil || resp == nil || resp.StatusCode != http.StatusForbidden {
		t.Fatalf("untrusted origin accepted: %v", err)
	}

	// Admission: a guest and an account; the session token field is ignored.
	alice := dial(t, n.wsURL, http.Header{"Origin": {"http://localhost:5173"}})
	welcome := alice.request(hello("Alice", sign(t, ticket.Claims{Guest: true})))
	if welcome["type"] != "welcome" || welcome["protocolVersion"] != 40.0 {
		t.Fatalf("welcome %v", welcome)
	}
	aliceID := welcome["playerId"].(string)
	bob := dial(t, n.wsURL, nil)
	bobWelcome := bob.request(hello("whatever", sign(t, ticket.Claims{AccountID: "acc-bob",
		Username: "bob", Nickname: "Bob"})))
	bobID := bobWelcome["playerId"].(string)
	data.read(func() {
		if len(data.claims) != 2 || data.claims[0].Name != "Alice" || !data.claims[0].Guest ||
			data.claims[1].Name != "Bob" || data.claims[1].Guest || data.claims[1].PlayerID != bobID {
			t.Errorf("claims %+v", data.claims)
		}
	})
	// A name held on another node is refused by the data service.
	data.read(func() { data.presence["carol"] = "game-other|p" })
	carol := dial(t, n.wsURL, nil)
	if reply := carol.request(hello("Carol", sign(t, ticket.Claims{Guest: true}))); reply["code"] != "NICKNAME_TAKEN" {
		t.Fatalf("remote name: %v", reply)
	}
	if reply := carol.request(hello("Carol2", sign(t, ticket.Claims{NodeID: "game-other", Guest: true}))); reply["code"] != "TICKET_WRONG_NODE" {
		t.Fatalf("wrong node: %v", reply)
	}
	if reply := carol.request(hello("Carol2", "")); reply["code"] != "TICKET_REQUIRED" {
		t.Fatalf("missing ticket: %v", reply)
	}

	eventually(t, "heartbeat with players", func() (ok bool) {
		data.read(func() {
			last := data.heartbeats[len(data.heartbeats)-1]
			ok = len(last.Players) == 2
		})
		return
	})

	// Protocol envelope rules.
	alice.sendRaw(`{not json`)
	if m := alice.waitFor(func(map[string]any) bool { return true }); m["code"] != "INVALID_REQUEST" || m["requestId"] != nil {
		t.Fatalf("invalid json: %v", m)
	}
	alice.sendRaw(`{"type":"clock","clientTick":1,"requestId":"   "}`)
	if m := alice.waitFor(func(map[string]any) bool { return true }); m["code"] != "INVALID_REQUEST_ID" {
		t.Fatalf("blank request id: %v", m)
	}
	alice.sendRaw(`{"type":"clock","clientTick":1}`) // success without requestId: no reply
	if m := alice.request(map[string]any{"type": "dance"}); m["code"] != "UNSUPPORTED_COMMAND" || m["type"] != "error" {
		t.Fatalf("unknown command: %v", m)
	}
	if len(alice.backlog) != 0 {
		t.Fatalf("unexpected messages: %v", alice.backlog)
	}
	clock := alice.request(map[string]any{"type": "clock", "clientTick": 5})
	if clock["clientTick"] != 5.0 || clock["type"] != "clock" {
		t.Fatalf("clock %v", clock)
	}

	// Room flow with broadcasts.
	room := alice.room(map[string]any{"type": "create", "name": "E2E", "capacity": 2,
		"channelName": "speedIndiCombine", "mode": "individual", "speed": 7, "speedVersion": "国服"})
	roomID := room["roomId"].(string)
	room = bob.room(map[string]any{"type": "join", "roomId": roomID})
	pushed := alice.waitFor(func(m map[string]any) bool { return m["type"] == "room" && m["requestId"] == nil })
	if len(pushed["room"].(map[string]any)["members"].([]any)) != 2 {
		t.Fatalf("join broadcast %v", pushed)
	}
	room = bob.room(map[string]any{"type": "ready", "roomId": roomID, "revision": room["revision"], "ready": true})
	room = alice.room(map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := room["race"].(map[string]any)["raceId"].(string)
	alice.room(map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	bob.room(map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})

	// Motion frames reach the other loaded racer as binary messages
	// (protocol 40: kind, recipient mask, slot, race tag, sequence, payload),
	// with the sender's slot stamped by the node.
	frame := make([]byte, 8+80)
	tag, _ := strconv.ParseUint(raceID[:2], 16, 8)
	frame[0], frame[1], frame[2], frame[3] = 2, 0xFF, 5, byte(tag)
	// An identity quaternion: the node relays only payloads browsers decode.
	binary.LittleEndian.PutUint32(frame[8+16:], math.Float32bits(1))
	if err := alice.conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
		t.Fatal(err)
	}
	for len(bob.frames) == 0 {
		if m, err := bob.read(); err != nil {
			t.Fatal(err)
		} else if m != nil {
			bob.backlog = append(bob.backlog, m)
		}
	}
	frame[2] = 0 // alice, the host, holds slot 0
	if string(bob.frames[0]) != string(frame) {
		t.Fatalf("relayed frame %v", bob.frames[0][:8])
	}

	n.clock.Advance(3 * time.Second)
	alice.waitFor(func(m map[string]any) bool {
		return m["type"] == "room" && m["room"].(map[string]any)["phase"] == "racing"
	})
	// Rewards count a finish only after the server saw the race run that
	// long (within 3 s).
	n.clock.Advance(60 * time.Second)
	alice.room(map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 61_000})
	finished := bob.room(map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 60_000})
	if finished["phase"] != "finished" {
		t.Fatalf("phase %v", finished["phase"])
	}
	wantRewards := map[string]any{bobID: map[string]any{"exp": 88.0, "lucci": 120.0},
		aliceID: map[string]any{"exp": 33.0, "lucci": 40.0}}
	if got := finished["race"].(map[string]any)["rewards"]; !reflect.DeepEqual(got, wantRewards) {
		t.Fatalf("race.rewards %v", got)
	}

	// The outbox delivers rules and the settlement to the data service.
	eventually(t, "settlement", func() (ok bool) {
		data.read(func() { ok = len(data.races) == 1 && len(data.rules) == 1 })
		return
	})
	data.read(func() {
		s := data.races[0]
		if s.NodeID != e2eNode || s.RaceID != raceID || s.RoomID != roomID || len(s.Results) != 2 ||
			s.Results[0].PlayerID != bobID || s.Results[0].AccountID != "acc-bob" || s.Results[0].Name != "Bob" ||
			s.Results[0].Points != 10 || s.Results[1].AccountID != "" || s.Results[1].Name != "Alice" {
			t.Errorf("settlement %+v", s)
		}
		var snapshot map[string]any
		if err := json.Unmarshal(s.Snapshot, &snapshot); err != nil || snapshot["roomId"] != roomID {
			t.Errorf("snapshot %s", s.Snapshot)
		}
		// Two racers in speedIndiCombine: 1st (30+50) x1.1 / 40+80, 2nd 30 x1.1 / 40.
		want := []contract.RaceReward{{PlayerID: bobID, AccountID: "acc-bob", Exp: 88, Lucci: 120},
			{PlayerID: aliceID, Exp: 33, Lucci: 40}}
		if !slices.Equal(s.Rewards, want) {
			t.Errorf("rewards %+v, want %+v", s.Rewards, want)
		}
		// Shown with the default rates (this data service reports none).
		if s.ExpRate == nil || *s.ExpRate != 1 || s.LucciRate == nil || *s.LucciRate != 1 {
			t.Errorf("settlement rates %v %v", s.ExpRate, s.LucciRate)
		}
		if data.rules[0].RoomID != roomID || !strings.Contains(string(data.rules[0].Rules), `"name":"E2E"`) {
			t.Errorf("rules %+v", data.rules[0])
		}
	})

	// Closing Bob's socket releases his room seat and his live name.
	_ = bob.conn.Close()
	alice.waitFor(func(m map[string]any) bool {
		return m["type"] == "room" && len(m["room"].(map[string]any)["members"].([]any)) == 1
	})
	eventually(t, "presence release", func() (ok bool) {
		data.read(func() {
			ok = len(data.releases) == 1 && data.releases[0].PlayerID == bobID && data.releases[0].Name == "Bob"
		})
		return
	})
	// The name is free again for a new connection on this node.
	again := dial(t, n.wsURL, nil)
	if reply := again.request(hello("x", sign(t, ticket.Claims{AccountID: "acc-bob", Nickname: "Bob"}))); reply["type"] != "welcome" {
		t.Fatalf("reconnect: %v", reply)
	}

	// Graceful shutdown: close 1001, leave the cluster.
	if err := n.app.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	for {
		_, err := alice.read()
		if err != nil {
			if !websocket.IsCloseError(err, websocket.CloseGoingAway) {
				t.Fatalf("close: %v", err)
			}
			break
		}
	}
	data.read(func() {
		// One leave at startup, one at shutdown.
		if len(data.leaves) != 2 || data.leaves[1].NodeID != e2eNode || data.badKeys != 0 {
			t.Errorf("leaves %+v bad keys %d", data.leaves, data.badKeys)
		}
	})
	if _, _, err := websocket.DefaultDialer.Dial(n.wsURL, nil); err == nil {
		t.Fatal("connection accepted after shutdown")
	}
}

func TestDataServiceDown(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	deadURL := "http://" + listener.Addr().String()
	listener.Close()
	n := startNode(t, deadURL, nil)
	c := dial(t, n.wsURL, nil)
	if reply := c.request(hello("Alice", sign(t, ticket.Claims{Guest: true}))); reply["code"] != "DATA_SERVICE_UNAVAILABLE" {
		t.Fatalf("data service down: %v", reply)
	}
	// The connection stays usable; a new ticket works once the service is back.
	if reply := c.request(map[string]any{"type": "clock", "clientTick": 1}); reply["code"] != "HELLO_REQUIRED" {
		t.Fatalf("after failed hello: %v", reply)
	}
}

func TestSettlementsSurviveRestart(t *testing.T) {
	// Records queued while the data service is down are delivered by the next
	// process from the same outbox directory.
	dir := t.TempDir()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	deadURL := "http://" + listener.Addr().String()
	listener.Close()
	cfg := config.Config{Addr: "127.0.0.1", Port: 18798, NodeID: e2eNode, NodeName: e2eNode,
		DataInternalURL: deadURL, DataNodeID: e2eDataNode, Secret: []byte(e2eSecret),
		MaxPlayers: 10, OutboxDir: dir, Network: netcfg.New(""), HeartbeatInterval: time.Hour}
	opts := Options{Outbox: outbox.Options{MinBackoff: 10 * time.Millisecond, MaxBackoff: 20 * time.Millisecond}}
	first, err := New(cfg, quiet, opts)
	if err != nil {
		t.Fatal(err)
	}
	first.Start()
	first.recorderForTest().SaveRules(contract.RoomRulesRequest{NodeID: e2eNode, RoomID: "room-1",
		Rules: json.RawMessage(`{"name":"A"}`), UpdatedAt: 1})
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	_ = first.Shutdown(ctx)

	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	cfg.DataInternalURL = dataServer.URL
	second, err := New(cfg, quiet, opts)
	if err != nil {
		t.Fatal(err)
	}
	second.Start()
	defer second.Shutdown(context.Background())
	eventually(t, "resumed delivery", func() (ok bool) {
		data.read(func() { ok = len(data.rules) == 1 && data.rules[0].RoomID == "room-1" })
		return
	})
}

func (a *App) recorderForTest() recorder { return recorder{box: a.outbox, log: a.log} }
