package ws

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"maps"
	"net"
	"net/http/httptest"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/game/lobby"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/ticket"
)

type nopPresence struct{}

func (nopPresence) Claim(context.Context, contract.PresenceClaimRequest) error { return nil }
func (nopPresence) Release(contract.PresenceReleaseRequest)                    {}

type anyTickets struct{}

func (anyTickets) Admit(string) (ticket.Claims, error) { return ticket.Claims{Guest: true}, nil }

func start(t *testing.T, opts Options) (*Server, string) {
	t.Helper()
	opts.Logger = slog.New(slog.NewTextHandler(io.Discard, nil))
	l := lobby.New(lobby.Options{NodeID: "game-ws", Presence: nopPresence{}, Tickets: anyTickets{},
		AllowGuests: true})
	s := NewServer(l, netcfg.LoopbackOnly(), opts)
	server := httptest.NewServer(s)
	t.Cleanup(func() {
		_ = s.Shutdown(context.Background())
		server.Close()
	})
	return s, "ws" + strings.TrimPrefix(server.URL, "http")
}

func dial(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	return conn
}

func readUntilError(t *testing.T, conn *websocket.Conn) error {
	t.Helper()
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return err
		}
	}
}

func TestRepliesAndErrors(t *testing.T) {
	_, url := start(t, Options{})
	conn := dial(t, url)
	for payload, want := range map[string]string{
		`[]`:                                 `{"type":"error","code":"INVALID_REQUEST"}`,
		`{"type":"clock","requestId":7}`:     `{"type":"error","code":"INVALID_REQUEST_ID"}`,
		`{"type":"clock","requestId":"abc"}`: `{"type":"error","code":"HELLO_REQUIRED","requestId":"abc"}`,
	} {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
			t.Fatal(err)
		}
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, data, err := conn.ReadMessage()
		if err != nil || string(data) != want {
			t.Fatalf("%s → %s (%v), want %s", payload, data, err, want)
		}
	}
}

func TestReadLimitClosesTheConnection(t *testing.T) {
	_, url := start(t, Options{})
	conn := dial(t, url)
	big := `{"type":"clock","pad":"` + strings.Repeat("x", 64<<10) + `"}`
	if err := conn.WriteMessage(websocket.TextMessage, []byte(big)); err != nil {
		t.Fatal(err)
	}
	if err := readUntilError(t, conn); !websocket.IsCloseError(err, websocket.CloseMessageTooBig) &&
		!strings.Contains(err.Error(), "reset") && !strings.Contains(err.Error(), "EOF") {
		t.Fatalf("oversized message: %v", err)
	}
}

func TestIdleConnectionTimesOut(t *testing.T) {
	s, url := start(t, Options{ReadTimeout: 100 * time.Millisecond, PingInterval: time.Hour})
	conn := dial(t, url)
	began := time.Now()
	if err := readUntilError(t, conn); err == nil {
		t.Fatal("idle connection stayed open")
	}
	if elapsed := time.Since(began); elapsed > 3*time.Second {
		t.Fatalf("closed after %v", elapsed)
	}
	deadline := time.Now().Add(2 * time.Second)
	for s.Connections() != 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if s.Connections() != 0 {
		t.Fatal("server kept the connection")
	}
}

func TestPingsKeepAnswerableClientsAlive(t *testing.T) {
	_, url := start(t, Options{ReadTimeout: 300 * time.Millisecond, PingInterval: 50 * time.Millisecond})
	conn := dial(t, url)
	pings := make(chan struct{}, 100)
	conn.SetPingHandler(func(data string) error {
		pings <- struct{}{}
		return conn.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(time.Second))
	})
	done := make(chan error, 1)
	go func() { done <- readUntilError(t, conn) }()
	time.Sleep(700 * time.Millisecond) // longer than ReadTimeout: pongs extend it
	select {
	case err := <-done:
		t.Fatalf("connection closed despite pongs: %v", err)
	default:
	}
	if len(pings) < 3 {
		t.Fatalf("only %d pings", len(pings))
	}
}

func TestSlowPeerOverflowIsDisconnected(t *testing.T) {
	_, url := start(t, Options{SendBufferLimit: 10})
	conn := dial(t, url)
	if err := conn.WriteMessage(websocket.TextMessage, []byte(`nope`)); err != nil {
		t.Fatal(err)
	}
	if err := readUntilError(t, conn); !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatalf("overflowing connection: %v, want close 1008", err)
	}
}

func TestConnectionCapAnswers503BeforeUpgrade(t *testing.T) {
	s, url := start(t, Options{MaxConnections: 1})
	first := dial(t, url)
	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil || resp == nil || resp.StatusCode != 503 {
		t.Fatalf("second socket: %v %v", err, resp)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(body) != `{"error":"SERVER_FULL"}` {
		t.Fatalf("body %s", body)
	}
	_ = first.Close()
	deadline := time.Now().Add(2 * time.Second)
	for s.Connections() != 0 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	dial(t, url) // the slot is free again
}

func TestBusyRefusesNewSockets(t *testing.T) {
	_, url := start(t, Options{Busy: func() bool { return true }})
	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil || resp == nil || resp.StatusCode != 503 {
		t.Fatalf("busy dial: %v %v", err, resp)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if string(body) != `{"error":"SERVER_BUSY"}` {
		t.Fatalf("body %s", body)
	}
}

func TestHelloTimeoutClosesSilentSockets(t *testing.T) {
	_, url := start(t, Options{HelloTimeout: 100 * time.Millisecond})
	silent := dial(t, url)
	greeted := dial(t, url)
	hello := `{"type":"hello","requestId":"1","protocolVersion":39,"ruleset":"launcher-room-v1",` +
		`"resourceVersion":"p3553","name":"Greeter","ticket":"any"}`
	if err := greeted.WriteMessage(websocket.TextMessage, []byte(hello)); err != nil {
		t.Fatal(err)
	}
	_ = greeted.SetReadDeadline(time.Now().Add(5 * time.Second))
	if _, data, err := greeted.ReadMessage(); err != nil || !strings.Contains(string(data), `"welcome"`) {
		t.Fatalf("hello: %s %v", data, err)
	}
	if err := readUntilError(t, silent); !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatalf("silent socket: %v, want close 1008", err)
	}
	// The socket that said hello outlives the timeout.
	_ = greeted.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	if _, _, err := greeted.ReadMessage(); err == nil || websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatalf("greeted socket: %v", err)
	}
}

func TestShutdownSendsGoingAway(t *testing.T) {
	s, url := start(t, Options{})
	conn := dial(t, url)
	deadline := time.Now().Add(2 * time.Second)
	for s.Connections() != 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if err := s.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := readUntilError(t, conn); !websocket.IsCloseError(err, websocket.CloseGoingAway) {
		t.Fatalf("shutdown close: %v", err)
	}
	if _, resp, err := websocket.DefaultDialer.Dial(url, nil); err == nil || resp.StatusCode != 503 {
		t.Fatalf("dial after shutdown: %v", err)
	}
}

func TestMalformedUTF8ClosesWith1007(t *testing.T) {
	_, url := start(t, Options{})
	conn := dial(t, url)
	if err := conn.WriteMessage(websocket.TextMessage, []byte("{\"type\":\"\xff\"}")); err != nil {
		t.Fatal(err)
	}
	if err := readUntilError(t, conn); !websocket.IsCloseError(err, websocket.CloseInvalidFramePayloadData) {
		t.Fatalf("malformed UTF-8: %v", err)
	}
}

// readCodes reads until the socket fails, collecting error codes.
func readCodes(t *testing.T, conn *websocket.Conn) (map[string]int, error) {
	t.Helper()
	codes := map[string]int{}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			return codes, err
		}
		var m map[string]any
		if json.Unmarshal(data, &m) == nil {
			if code, ok := m["code"].(string); ok {
				codes[code]++
			}
		}
	}
}

// A client flooding commands is answered RATE_LIMITED, then disconnected
// with 1008; the burst a normal client needs passes untouched.
func TestFloodingClientIsLimitedThenClosed(t *testing.T) {
	_, url := start(t, Options{})
	conn := dial(t, url)
	for range 2_000 {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"clock","clientTick":1,"requestId":"x"}`)); err != nil {
			break // already closed
		}
	}
	codes, err := readCodes(t, conn)
	if !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatalf("flooder: %v, want close 1008", err)
	}
	// At most the burst of 60 (plus what refills meanwhile) is served, then
	// about 50 refusals; replies still queued may be cut off by the close.
	if served, refused := codes["HELLO_REQUIRED"], codes["RATE_LIMITED"]; served > 80 || refused > 60 {
		t.Fatalf("replies %v", codes)
	}
}

func TestRateLimitsRefillAndCoverRuleCommands(t *testing.T) {
	_, url := start(t, Options{TextRate: 20, TextBurst: 3, RulesRate: 20, RulesBurst: 1})
	conn := dial(t, url)
	send := func(typ string) string {
		t.Helper()
		if err := conn.WriteMessage(websocket.TextMessage,
			[]byte(`{"type":"`+typ+`","requestId":"r"}`)); err != nil {
			t.Fatal(err)
		}
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		var m map[string]any
		_ = json.Unmarshal(data, &m)
		return m["code"].(string)
	}
	// Rule changes have their own, tighter bucket on top of the text one.
	if got := []string{send("create"), send("track"), send("clock")}; !slices.Equal(got,
		[]string{"HELLO_REQUIRED", "RATE_LIMITED", "HELLO_REQUIRED"}) {
		t.Fatalf("got %v", got)
	}
	if got := send("clock"); got != "RATE_LIMITED" {
		t.Fatalf("over the text burst: %s", got)
	}
	time.Sleep(120 * time.Millisecond) // two tokens of each bucket
	if got := []string{send("room-settings"), send("clock")}; !slices.Equal(got,
		[]string{"HELLO_REQUIRED", "HELLO_REQUIRED"}) {
		t.Fatalf("after refill %v", got)
	}
}

func TestMotionFloodIsDroppedThenClosed(t *testing.T) {
	_, url := start(t, Options{})
	conn := dial(t, url)
	frame := make([]byte, 140)
	// The client's pace (one frame per 64 ms bucket) is far below the limit;
	// a burst of 400 is tolerated.
	for range 400 {
		if err := conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
			t.Fatal(err)
		}
	}
	if err := conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"clock","requestId":"a"}`)); err != nil {
		t.Fatal(err)
	}
	_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	if _, data, err := conn.ReadMessage(); err != nil || !strings.Contains(string(data), "HELLO_REQUIRED") {
		t.Fatalf("after a motion burst: %s %v", data, err)
	}
	for range 2_000 {
		if err := conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
			break
		}
	}
	if _, err := readCodes(t, conn); !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatalf("motion flooder: %v, want close 1008", err)
	}
}

// One member flooding cheap room commands must not get a slower member
// disconnected (each command broadcasts a full room snapshot to the others).
func TestFloodDoesNotDisconnectOtherMembers(t *testing.T) {
	s, url := start(t, Options{SendBufferLimit: 64 << 10})
	hello := func(conn *websocket.Conn, name string) {
		t.Helper()
		payload := `{"type":"hello","requestId":"h","protocolVersion":39,"ruleset":"launcher-room-v1",` +
			`"resourceVersion":"p3553","name":"` + name + `","ticket":"any"}`
		if err := conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
			t.Fatal(err)
		}
	}
	request := func(conn *websocket.Conn, payload string) map[string]any {
		t.Helper()
		if err := conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
			t.Fatal(err)
		}
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				t.Fatal(err)
			}
			var m map[string]any
			_ = json.Unmarshal(data, &m)
			if m["requestId"] == "q" {
				return m
			}
		}
	}
	attacker, victim := dial(t, url), dial(t, url)
	hello(attacker, "Attacker")
	hello(victim, "Victim")
	created := request(attacker, `{"type":"create","requestId":"q","name":"R","capacity":2,`+
		`"channelName":"speedIndiCombine","mode":"individual","speed":7,"speedVersion":"国服"}`)
	if created["type"] != "room" {
		t.Fatalf("create: %v", created)
	}
	roomID := created["room"].(map[string]any)["roomId"].(string)
	if joined := request(victim, `{"type":"join","requestId":"q","roomId":"`+roomID+`"}`); joined["type"] != "room" {
		t.Fatalf("join: %v", joined)
	}

	// The victim stops reading while the attacker floods toggles.
	for i := range 5_000 {
		toggle := `{"type":"changing","roomId":"` + roomID + `","changing":` + strconv.FormatBool(i%2 == 0) + `}`
		if err := attacker.WriteMessage(websocket.TextMessage, []byte(toggle)); err != nil {
			break
		}
	}
	// The attacker is refused, then closed (its queued RATE_LIMITED replies
	// may be cut off by the close).
	if codes, err := readCodes(t, attacker); !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
		t.Fatalf("attacker: %v %v", codes, err)
	}
	// The victim is still connected and usable.
	if reply := request(victim, `{"type":"clock","clientTick":1,"requestId":"q"}`); reply["type"] != "clock" {
		t.Fatalf("victim: %v", reply)
	}
	if s.Connections() != 1 {
		t.Fatalf("connections %d", s.Connections())
	}
}

// While a peer lags, a newer snapshot of a room replaces the unsent older
// ones; a peer that keeps up gets every snapshot.
func TestLaggingPeerKeepsTheNewestSnapshotOnly(t *testing.T) {
	c := &conn{opts: Options{SendBufferLimit: 1000}, log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		wake: make(chan struct{}, 1), done: make(chan struct{})}
	payload := func(tag string, size int) []byte { return []byte(tag + strings.Repeat(".", size-len(tag))) }
	c.Snapshot("A", payload("a1", 100))
	c.Snapshot("A", payload("a2", 100))
	if len(c.queue) != 2 {
		t.Fatalf("a peer that keeps up lost snapshots: %d queued", len(c.queue))
	}
	c.Text(payload("event", 100)) // 300 bytes queued: over a quarter of the limit
	c.Snapshot("B", payload("b1", 100))
	c.Snapshot("A", payload("a3", 100))
	c.Snapshot("A", payload("a4", 100))
	var tags []string
	for _, f := range c.queue {
		tags = append(tags, strings.TrimRight(string(f.data), "."))
	}
	if !slices.Equal(tags, []string{"event", "b1", "a4"}) || c.queued != 300 {
		t.Fatalf("queue %v (%d bytes)", tags, c.queued)
	}
	for range 20 { // a flood of snapshots no longer overflows the buffer
		c.Snapshot("A", payload("a", 100))
	}
	if c.closed || c.queued != 300 {
		t.Fatalf("closed %v, %d bytes queued", c.closed, c.queued)
	}
}

// Close frames go out concurrently: peers that stopped reading (each close
// frame waits up to a second behind a stuck write) must not add up past the
// shutdown budget, and every cleanup has run when Shutdown returns.
func TestShutdownClosesStuckPeersConcurrently(t *testing.T) {
	s, url := start(t, Options{SendBufferLimit: 16 << 20, PingInterval: time.Hour})
	dialer := websocket.Dialer{NetDialContext: (&net.Dialer{Control: func(_, _ string, raw syscall.RawConn) error {
		return raw.Control(func(fd uintptr) {
			_ = syscall.SetsockoptInt(int(fd), syscall.SOL_SOCKET, syscall.SO_RCVBUF, 2048)
		})
	}}).DialContext}
	for range 6 {
		conn, _, err := dialer.Dial(url, nil)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = conn.Close() })
	}
	deadline := time.Now().Add(2 * time.Second)
	for s.Connections() != 6 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	s.mu.Lock()
	conns := slices.Collect(maps.Keys(s.conns))
	s.mu.Unlock()
	chunk := []byte(strings.Repeat("x", 100<<10))
	for _, c := range conns {
		for range 60 { // 6 MB the peer never reads
			c.Text(chunk)
		}
	}
	time.Sleep(200 * time.Millisecond) // the writers are now stuck
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	began := time.Now()
	_ = s.Shutdown(ctx)
	if elapsed := time.Since(began); elapsed > 2*time.Second {
		t.Fatalf("Shutdown took %v", elapsed)
	}
	if n := s.Connections(); n != 0 {
		t.Fatalf("%d connections left after Shutdown", n)
	}
}

// Evicting a session (heartbeat conflicts) closes its socket with 1008
// "nickname taken elsewhere", and the disconnect frees its room seat.
func TestEvictClosesTheSocketAndFreesTheSeat(t *testing.T) {
	s, url := start(t, Options{})
	request := func(conn *websocket.Conn, payload string) map[string]any {
		t.Helper()
		if err := conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
			t.Fatal(err)
		}
		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				t.Fatal(err)
			}
			var m map[string]any
			_ = json.Unmarshal(data, &m)
			if m["requestId"] == "q" {
				return m
			}
		}
	}
	hello := func(conn *websocket.Conn, name string) string {
		t.Helper()
		welcome := request(conn, `{"type":"hello","requestId":"q","protocolVersion":39,"ruleset":"launcher-room-v1",`+
			`"resourceVersion":"p3553","name":"`+name+`","ticket":"any"}`)
		id, _ := welcome["playerId"].(string)
		if id == "" {
			t.Fatalf("hello: %v", welcome)
		}
		return id
	}
	host, taken := dial(t, url), dial(t, url)
	hello(host, "Host")
	takenID := hello(taken, "Taken")
	created := request(host, `{"type":"create","requestId":"q","name":"R","capacity":2,`+
		`"channelName":"speedIndiCombine","mode":"individual","speed":7,"speedVersion":"国服"}`)
	roomID := created["room"].(map[string]any)["roomId"].(string)
	if joined := request(taken, `{"type":"join","requestId":"q","roomId":"`+roomID+`"}`); joined["type"] != "room" {
		t.Fatalf("join: %v", joined)
	}

	if n := s.lobby.Evict([]string{takenID}); n != 1 {
		t.Fatalf("evicted %d", n)
	}
	err := readUntilError(t, taken)
	var closeErr *websocket.CloseError
	if !errors.As(err, &closeErr) || closeErr.Code != websocket.ClosePolicyViolation ||
		closeErr.Text != "nickname taken elsewhere" {
		t.Fatalf("evicted socket: %v", err)
	}
	// The host sees the seat freed.
	_ = host.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		_, data, err := host.ReadMessage()
		if err != nil {
			t.Fatal(err)
		}
		var m map[string]any
		_ = json.Unmarshal(data, &m)
		if room, ok := m["room"].(map[string]any); ok && len(room["members"].([]any)) == 1 {
			break
		}
	}
	if players, _ := s.lobby.Counts(); players != 1 {
		t.Fatalf("players %d", players)
	}
}
