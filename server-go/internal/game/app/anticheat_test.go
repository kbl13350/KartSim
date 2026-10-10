package app

import (
	"encoding/binary"
	"math"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/game/anticheat"
	"kartsim/internal/game/config"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

// motionFrame is a protocol 40 kind 2 frame (the smallest the browsers
// accept) of raceID with sequence, at pos (wire axes) with tick; the node
// stamps the sender's slot.
func motionFrame(raceID string, sequence uint32, pos [3]float32, tick uint32) []byte {
	frame := make([]byte, 8+80)
	tag, _ := strconv.ParseUint(raceID[:2], 16, 8)
	frame[0], frame[1], frame[3] = 2, 0xFF, byte(tag)
	binary.LittleEndian.PutUint32(frame[4:], sequence)
	payload := frame[8:]
	binary.LittleEndian.PutUint32(payload, tick)
	for i, v := range pos {
		binary.LittleEndian.PutUint32(payload[4+4*i:], math.Float32bits(v))
	}
	binary.LittleEndian.PutUint32(payload[16:], math.Float32bits(1)) // quaternion w
	return frame
}

// A racer whose kart jumps 2 km between two frames is told why, taken out
// of the race, disconnected with 1008, and the data service gets the
// record; the other racer keeps racing and never sees the jump.
func TestAntiCheatKick(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNodeWith(t, dataServer.URL, data, func(cfg *config.Config) { cfg.AntiCheat = anticheat.ModeKick })

	alice := dial(t, n.wsURL, nil)
	aliceID := alice.request(hello("Alice", sign(t, ticket.Claims{AccountID: "acc-alice", Username: "alice",
		Nickname: "Alice"})))["playerId"].(string)
	bob := dial(t, n.wsURL, nil)
	bob.request(hello("Bob", sign(t, ticket.Claims{Guest: true})))

	room := alice.room(map[string]any{"type": "create", "name": "AC", "capacity": 2,
		"channelName": "speedIndiCombine", "mode": "individual", "speed": 7, "speedVersion": "国服"})
	roomID := room["roomId"].(string)
	room = bob.room(map[string]any{"type": "join", "roomId": roomID})
	room = bob.room(map[string]any{"type": "ready", "roomId": roomID, "revision": room["revision"], "ready": true})
	room = alice.room(map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := room["race"].(map[string]any)["raceId"].(string)
	alice.room(map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	bob.room(map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	n.clock.Advance(3 * time.Second)
	alice.waitFor(func(m map[string]any) bool {
		return m["type"] == "room" && m["room"].(map[string]any)["phase"] == "racing"
	})
	now := uint32(n.clock.Now())

	send := func(frame []byte) {
		if err := alice.conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
			t.Fatal(err)
		}
	}
	send(motionFrame(raceID, 1, [3]float32{0, 0, 0}, now))
	for len(bob.frames) == 0 {
		if m, err := bob.read(); err != nil {
			t.Fatal(err)
		} else if m != nil {
			bob.backlog = append(bob.backlog, m)
		}
	}
	n.clock.Advance(64 * time.Millisecond)
	send(motionFrame(raceID, 2, [3]float32{2_000, 0, 0}, now+64))

	kicked := alice.waitFor(func(m map[string]any) bool { return m["type"] == "error" })
	if kicked["code"] != "CHEAT_DETECTED" || kicked["check"] != "TELEPORT" || kicked["requestId"] != nil {
		t.Fatalf("kick event %v", kicked)
	}
	for {
		if _, err := alice.read(); err != nil {
			if !websocket.IsCloseError(err, websocket.ClosePolicyViolation) {
				t.Fatalf("kicked connection: %v, want close 1008", err)
			}
			break
		}
	}
	// Bob's room no longer has Alice; he got only the first frame.
	left := bob.waitFor(func(m map[string]any) bool {
		return m["type"] == "room" && len(m["room"].(map[string]any)["members"].([]any)) == 1
	})
	if left["room"].(map[string]any)["phase"] != "racing" || len(bob.frames) != 1 {
		t.Fatalf("after the kick: %v, %d frames", left["room"], len(bob.frames))
	}
	eventually(t, "anti-cheat record", func() (ok bool) {
		data.read(func() { ok = len(data.cheats) == 1 })
		return
	})
	data.read(func() {
		r := data.cheats[0]
		if r.NodeID != e2eNode || r.PlayerID != aliceID || r.AccountID != "acc-alice" || r.Name != "Alice" ||
			r.RoomID != roomID || r.RaceID != raceID || r.TrackID != "village_R01" || r.Gameplay != "ordinary" ||
			r.Code != "TELEPORT" || r.Action != contract.AntiCheatKick || r.Detail == "" || len(r.EventID) != 36 ||
			r.At <= 0 {
			t.Errorf("record %+v", r)
		}
	})
}
