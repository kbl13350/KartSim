package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/shared/contract"
)

// The messenger socket tests dial the public httptest server and need MySQL.

type socket struct {
	t  *testing.T
	ws *websocket.Conn
}

func (h *harness) dialMessenger() *socket {
	h.t.Helper()
	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(h.public.URL, "http")+"/api/messenger/ws", nil)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { ws.Close() })
	return &socket{t: h.t, ws: ws}
}

// openMessenger dials and says hello; it returns the socket and its welcome.
func (h *harness) openMessenger(token string) (*socket, map[string]any) {
	h.t.Helper()
	s := h.dialMessenger()
	s.send(map[string]any{"type": "hello", "token": token})
	return s, s.expect("welcome")
}

func (s *socket) send(value any) {
	s.t.Helper()
	if err := s.ws.WriteJSON(value); err != nil {
		s.t.Fatal(err)
	}
}

func (s *socket) read() (map[string]any, error) {
	_ = s.ws.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := s.ws.ReadMessage()
	if err != nil {
		return nil, err
	}
	var frame map[string]any
	if err := json.Unmarshal(data, &frame); err != nil {
		s.t.Fatalf("frame %s: %v", data, err)
	}
	return frame, nil
}

func (s *socket) expect(kind string) map[string]any {
	s.t.Helper()
	frame, err := s.read()
	if err != nil {
		s.t.Fatalf("waiting for %s: %v", kind, err)
	}
	if frame["type"] != kind {
		s.t.Fatalf("frame %v, want type %s", frame, kind)
	}
	return frame
}

// expectAll reads len(kinds) frames and checks their types in any order.
func (s *socket) expectAll(kinds ...string) map[string]map[string]any {
	s.t.Helper()
	frames := map[string]map[string]any{}
	for range kinds {
		frame, err := s.read()
		if err != nil {
			s.t.Fatalf("waiting for %v: %v", kinds, err)
		}
		frames[frame["type"].(string)] = frame
	}
	for _, kind := range kinds {
		if frames[kind] == nil {
			s.t.Fatalf("frames %v, want %v", frames, kinds)
		}
	}
	return frames
}

func (s *socket) expectClose(code int) {
	s.t.Helper()
	for {
		_, err := s.read()
		if err == nil {
			continue
		}
		var closed *websocket.CloseError
		if !errors.As(err, &closed) || closed.Code != code {
			s.t.Fatalf("close %v, want %d", err, code)
		}
		return
	}
}

func (s *socket) expectPresence(accountID, presence string) {
	s.t.Helper()
	frame := s.expect("presence")
	if frame["accountId"] != accountID || frame["presence"] != presence {
		s.t.Fatalf("presence %v, want %s %s", frame, accountID, presence)
	}
}

func (s *socket) roundTrip() {
	s.t.Helper()
	s.send(map[string]any{"type": "ping"})
	s.expect("pong")
}

func TestMessengerSocketHello(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	idA, nickA, tokenA := h.messengerUser()

	bad := h.dialMessenger()
	bad.send(map[string]any{"type": "hello", "token": randomCode(32)})
	if frame := bad.expect("error"); frame["code"] != "LOGIN_REQUIRED" {
		t.Fatalf("error %v", frame)
	}
	bad.expectClose(4001)

	s, welcome := h.openMessenger(tokenA)
	state := welcome["state"].(map[string]any)
	me := state["me"].(map[string]any)
	if welcome["accountId"] != idA || welcome["serverTime"].(float64) == 0 || me["accountId"] != idA ||
		me["nickname"] != nickA || state["limits"].(map[string]any)["messageLength"].(float64) != 30 {
		t.Fatalf("welcome %v", welcome)
	}
	s.roundTrip()
	// Logging out closes the session's sockets.
	h.post("/multiplayer/auth/logout", nil, bearerHeader(tokenA)).expect(t, http.StatusOK, "")
	s.expectClose(4001)
}

func TestMessengerSocketMessages(t *testing.T) {
	clock := newFakeClock(time.Now())
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	idA, _, tokenA := h.messengerUser()
	idB, nickB, tokenB := h.messengerUser()
	idC, _, _ := h.messengerUser()
	h.befriend(tokenA, idA, nickB, tokenB)
	a, _ := h.openMessenger(tokenA)
	other, _ := h.openMessenger(tokenA)
	b, _ := h.openMessenger(tokenB)
	a.expectPresence(idB, "online")
	other.expectPresence(idB, "online")
	clientID := func(i int) string { return fmt.Sprintf("50000000-0000-4000-8000-%012d", i) }

	a.send(map[string]any{"type": "send", "to": idB, "text": " 你好 ", "clientId": clientID(1), "requestId": "r1"})
	sent := a.expect("sent")
	message := sent["message"].(map[string]any)
	if sent["requestId"] != "r1" || sent["duplicate"] != false || message["from"] != idA || message["to"] != idB ||
		message["text"] != "你好" || message["clientId"] != clientID(1) {
		t.Fatalf("sent %v", sent)
	}
	for _, s := range []*socket{b, other} {
		if pushed := s.expect("message"); pushed["message"].(map[string]any)["id"] != message["id"] {
			t.Fatalf("pushed %v", pushed)
		}
	}
	a.send(map[string]any{"type": "send", "to": idC, "text": "hi", "clientId": clientID(2), "requestId": "r2"})
	if frame := a.expect("error"); frame["code"] != "NOT_FRIENDS" || frame["requestId"] != "r2" {
		t.Fatalf("error %v", frame)
	}
	a.send(map[string]any{"type": "send", "to": idB, "text": "", "clientId": clientID(3)})
	if frame := a.expect("error"); frame["code"] != "INVALID_MESSAGE" {
		t.Fatalf("error %v", frame)
	}

	// A message sent over HTTP reaches every socket of both accounts.
	h.post("/api/messenger/messages", map[string]string{"to": idA, "text": "yo", "clientId": clientID(4)},
		bearerHeader(tokenB)).expect(t, http.StatusOK, "")
	for _, s := range []*socket{a, other, b} {
		if pushed := s.expect("message"); pushed["message"].(map[string]any)["text"] != "yo" {
			t.Fatalf("pushed %v", pushed)
		}
	}

	// Reading over the socket tells the reader's other sockets to sync.
	a.send(map[string]any{"type": "read", "with": idB, "upTo": message["id"]})
	other.expect("sync")

	// The flood limit counts every message of the account: two went out
	// (the NOT_FRIENDS attempt counted too), so three more are allowed.
	for i := 5; i <= 7; i++ {
		a.send(map[string]any{"type": "send", "to": idB, "text": "x", "clientId": clientID(i)})
		a.expect("sent")
	}
	a.send(map[string]any{"type": "send", "to": idB, "text": "x", "clientId": clientID(8), "requestId": "r8"})
	frame := a.expect("error")
	if frame["code"] != "CHAT_FLOOD" || frame["requestId"] != "r8" || int64(frame["mutedUntil"].(float64)) != clock.millis()+10_000 {
		t.Fatalf("flood %v", frame)
	}
}

func TestMessengerSocketPresence(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	idA, nickA, tokenA := h.messengerUser()
	_, nickB, tokenB := h.messengerUser()
	h.befriend(tokenA, idA, nickB, tokenB)
	b, _ := h.openMessenger(tokenB)
	a, welcome := h.openMessenger(tokenA)
	b.expectPresence(idA, "online")
	friends := welcome["state"].(map[string]any)["friends"].([]any)
	if len(friends) != 1 || friends[0].(map[string]any)["presence"] != "online" {
		t.Fatalf("friends in welcome %v", friends)
	}

	// A game node claims and releases a's presence.
	h.heartbeat("game-m", "Messenger", "", 10)
	claim := contract.PresenceClaimRequest{NodeID: "game-m", PlayerID: "p-a", Name: nickA, AccountID: idA}
	h.call(contract.PathPresenceClaim, claim).expect(t, http.StatusOK, "")
	b.expectPresence(idA, "inGame")
	if state := h.messengerState(tokenB); state.Friends[0].Presence != "inGame" {
		t.Fatalf("presence in state %+v", state.Friends)
	}
	// Invisible: offline even in game.
	h.put("/api/messenger/settings", map[string]bool{"blockFriendRequests": false, "blockGameInvites": false,
		"invisible": true}, bearerHeader(tokenA)).expect(t, http.StatusOK, "")
	b.expectPresence(idA, "offline")
	a.expect("sync")
	if state := h.messengerState(tokenB); state.Friends[0].Presence != "offline" {
		t.Fatalf("invisible presence in state %+v", state.Friends)
	}
	h.put("/api/messenger/settings", map[string]bool{"blockFriendRequests": false, "blockGameInvites": false,
		"invisible": false}, bearerHeader(tokenA)).expect(t, http.StatusOK, "")
	b.expectPresence(idA, "inGame")
	h.call(contract.PathPresenceRelease, contract.PresenceReleaseRequest{NodeID: "game-m", PlayerID: "p-a",
		Name: nickA, AccountID: idA}).expect(t, http.StatusOK, "")
	b.expectPresence(idA, "online")

	// The last socket gone: offline after the grace.
	a.ws.Close()
	b.expectPresence(idA, "offline")
}

func TestMessengerSocketSync(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	idA, nickA, tokenA := h.messengerUser()
	idB, nickB, tokenB := h.messengerUser()
	a, _ := h.openMessenger(tokenA)
	b, _ := h.openMessenger(tokenB)

	h.post("/api/messenger/friends/request", map[string]string{"nickname": nickB}, bearerHeader(tokenA)).
		expect(t, http.StatusOK, "")
	a.expect("sync")
	frames := b.expectAll("sync", "notice")
	if notice := frames["notice"]; notice["kind"] != "friend-request" || notice["accountId"] != idA || notice["nickname"] != nickA {
		t.Fatalf("notice %v", notice)
	}

	h.post("/api/messenger/friends/respond", map[string]any{"accountId": idA, "accept": true}, bearerHeader(tokenB)).
		expect(t, http.StatusOK, "")
	b.expect("sync")
	frames = a.expectAll("sync", "notice")
	if notice := frames["notice"]; notice["kind"] != "friend-accepted" || notice["accountId"] != idB || notice["nickname"] != nickB {
		t.Fatalf("notice %v", notice)
	}

	// A rename tells the friends to reload.
	h.post("/multiplayer/auth/nickname", map[string]string{"nickname": "R" + nickA[2:]}, bearerHeader(tokenA)).
		expect(t, http.StatusOK, "")
	a.expect("sync")
	b.expect("sync")

	// Now friends, b sees a go offline.
	time.Sleep(100 * time.Millisecond) // the friend lists reload in the background
	a.ws.Close()
	b.expectPresence(idA, "offline")

	// Removing the friend: both sides sync.
	h.post("/api/messenger/friends/remove", map[string]string{"accountId": idA}, bearerHeader(tokenB)).
		expect(t, http.StatusOK, "")
	b.expect("sync")
	b.roundTrip()
}

// TestMessengerWithoutRedis: sessions fall back to MySQL and nobody is in
// game, but online and offline still work.
func TestMessengerWithoutRedis(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	idA, _, tokenA := h.messengerUser()
	_, nickB, tokenB := h.messengerUser()
	h.befriend(tokenA, idA, nickB, tokenB)
	h.redis.SetError("ERR down")
	b, _ := h.openMessenger(tokenB)
	a, _ := h.openMessenger(tokenA)
	b.expectPresence(idA, "online")
	if state := h.messengerState(tokenB); len(state.Friends) != 1 || state.Friends[0].Presence != "online" {
		t.Fatalf("friends without Redis %+v", state.Friends)
	}
	a.ws.Close()
	b.expectPresence(idA, "offline")
}
