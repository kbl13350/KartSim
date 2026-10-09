package lobby

import (
	"encoding/binary"
	"encoding/hex"
	"strings"
	"testing"
	"time"
)

func uuidBytes(id string) []byte {
	b, err := hex.DecodeString(strings.ReplaceAll(id, "-", ""))
	if err != nil || len(b) != 16 {
		panic("bad uuid " + id)
	}
	return b
}

func motionFrame(roomID, raceID, playerID string, mask byte, length int) []byte {
	frame := make([]byte, length)
	binary.LittleEndian.PutUint16(frame, motionMagic)
	frame[2] = 1
	frame[3] = mask
	copy(frame[4:20], uuidBytes(roomID))
	copy(frame[20:36], uuidBytes(raceID))
	copy(frame[36:52], uuidBytes(playerID))
	return frame
}

func TestMotionRelayFiltering(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	racers, late := players[:3], players[3]
	room := h.joinAndReady(racers, h.create(racers, "ordinary", "speedIndiCombine", 4))
	roomID := room["roomId"].(string)

	a, b, c := racers[0], racers[1], racers[2]
	// No race yet: nothing is relayed.
	h.lobby.RelayMotion(a, motionFrame(roomID, roomID, a.playerID, 0xFF, 136))

	room = h.command(a, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"].(string)
	h.command(late, map[string]any{"type": "join", "roomId": roomID})
	h.must(a, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	h.must(b, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})

	counts := func() [4]int {
		return [4]int{h.sink(a).frameCount(), h.sink(b).frameCount(),
			h.sink(c).frameCount(), h.sink(late).frameCount()}
	}
	expect := func(step string, want [4]int) {
		t.Helper()
		if got := counts(); got != want {
			t.Fatalf("%s: frames %v, want %v", step, got, want)
		}
	}
	expect("before race", [4]int{})

	// Loading: only loaded racers named by the mask receive, never the sender.
	h.lobby.RelayMotion(a, motionFrame(roomID, raceID, a.playerID, 0xFF, 136))
	expect("loaded peer", [4]int{0, 1, 0, 0})
	// The recipient mask is by slot: slot 1 (b) cleared.
	h.lobby.RelayMotion(a, motionFrame(roomID, raceID, a.playerID, 0xFD, 136))
	expect("mask without b", [4]int{0, 1, 0, 0})
	// A racer that has not loaded cannot send.
	h.lobby.RelayMotion(c, motionFrame(roomID, raceID, c.playerID, 0xFF, 136))
	expect("unloaded sender", [4]int{0, 1, 0, 0})

	dropped := map[string][]byte{
		"spoofed player": motionFrame(roomID, raceID, a.playerID, 0xFF, 136),
		"wrong room":     motionFrame(raceID, raceID, b.playerID, 0xFF, 136),
		"wrong race":     motionFrame(roomID, roomID, b.playerID, 0xFF, 136),
		"too short":      motionFrame(roomID, raceID, b.playerID, 0xFF, 135),
		"too long":       motionFrame(roomID, raceID, b.playerID, 0xFF, 235),
	}
	badMagic := motionFrame(roomID, raceID, b.playerID, 0xFF, 136)
	badMagic[0] ^= 1
	dropped["bad magic"] = badMagic
	for _, kind := range []byte{0, 11, 0x80} {
		frame := motionFrame(roomID, raceID, b.playerID, 0xFF, 136)
		frame[2] = kind
		dropped["payload type "+hex.EncodeToString([]byte{kind})] = frame
	}
	for name, frame := range dropped {
		h.lobby.RelayMotion(b, frame)
		expect(name, [4]int{0, 1, 0, 0})
	}
	h.lobby.RelayMotion(b, motionFrame(roomID, raceID, b.playerID, 0xFF, 234))
	expect("max length", [4]int{1, 1, 0, 0})

	// Countdown and racing relay to every loaded racer.
	h.must(c, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	h.lobby.RelayMotion(a, motionFrame(roomID, raceID, a.playerID, 0xFF, 200))
	expect("countdown", [4]int{1, 2, 1, 0})
	h.clock.Advance(3 * time.Second)
	h.lobby.RelayMotion(c, motionFrame(roomID, raceID, c.playerID, 0xFF, 200))
	expect("racing", [4]int{2, 3, 1, 0})

	// A finished race relays nothing.
	for _, p := range racers {
		h.must(p, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 1})
	}
	h.lobby.RelayMotion(a, motionFrame(roomID, raceID, a.playerID, 0xFF, 200))
	expect("finished", [4]int{2, 3, 1, 0})
	// Clients outside any room are ignored.
	h.lobby.RelayMotion(h.newClient(), motionFrame(roomID, raceID, a.playerID, 0xFF, 200))
}
