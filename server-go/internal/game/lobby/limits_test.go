package lobby

import (
	"net/http"
	"testing"

	"kartsim/internal/shared/apierr"
)

// DESIGN.md 4.5: the room cap and memory pressure refuse new work with 503
// while rooms and players already on the node are unaffected.

func TestRoomLimitReached(t *testing.T) {
	h := newHarness(t)
	h.lobby.maxRooms = 1
	players := h.connectN(3)
	room := h.create(players[:1], "ordinary", "speedIndiCombine", 2)
	createRequest := map[string]any{
		"type": "create", "name": "Second", "capacity": 2, "password": "",
		"channelName": "speedIndiCombine", "mode": "individual", "speed": 7, "speedVersion": "国服"}
	// Validation errors still come first.
	invalid := map[string]any{}
	for key, value := range createRequest {
		invalid[key] = value
	}
	invalid["channelName"] = "nope"
	assertEqual(t, h.errorCode(players[1], invalid), "INVALID_CHANNEL")
	_, err := h.raw(players[1], createRequest)
	assertEqual(t, codeOf(t, err), "ROOM_LIMIT_REACHED")
	assertEqual(t, statusOf(t, err), http.StatusServiceUnavailable)
	// Joining the existing room still works, and a freed slot can be reused.
	h.command(players[2], map[string]any{"type": "join", "roomId": room["roomId"]})
	h.must(players[0], map[string]any{"type": "leave", "roomId": room["roomId"]})
	h.must(players[2], map[string]any{"type": "leave", "roomId": room["roomId"]})
	assertEqual(t, h.command(players[1], createRequest)["name"], "Second")
}

func statusOf(t *testing.T, err error) int {
	t.Helper()
	rejected, ok := apierr.As(err)
	if !ok {
		t.Fatalf("not an API error: %v", err)
	}
	return rejected.Status
}

func TestHelloServerBusyKeepsTheTicket(t *testing.T) {
	h := newHarness(t)
	h.connect("Alice")
	busy := true
	h.lobby.busy = func() bool { return busy }
	token := h.guestTicket()
	c := h.newClient()
	_, err := h.raw(c, helloRequest("Bob", token))
	assertEqual(t, codeOf(t, err), "SERVER_BUSY")
	assertEqual(t, statusOf(t, err), http.StatusServiceUnavailable)
	// The rejected hello did not consume the ticket.
	busy = false
	h.command(c, helloRequest("Bob", token))
	players, _ := h.lobby.Counts()
	assertEqual(t, players, 2)
}
