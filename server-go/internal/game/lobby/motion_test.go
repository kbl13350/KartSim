package lobby

import (
	"encoding/binary"
	"encoding/hex"
	"math"
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

// motionFrame is a frame of length: the kinematic kind of that payload
// length with a payload the browsers accept (an identity quaternion, unit
// collision scales, at the origin), or kind 1 with a zero payload, which
// they refuse, for any other length.
func motionFrame(roomID, raceID, playerID string, mask byte, length int) []byte {
	frame := make([]byte, length)
	binary.LittleEndian.PutUint16(frame, motionMagic)
	frame[2] = 1
	frame[3] = mask
	copy(frame[4:20], uuidBytes(roomID))
	copy(frame[20:36], uuidBytes(raceID))
	copy(frame[36:52], uuidBytes(playerID))
	for kind := 2; kind <= 10; kind++ {
		if length != motionHeaderLength+kinematicPayloadLength(kind) {
			continue
		}
		frame[2] = byte(kind)
		payload := frame[motionHeaderLength:]
		binary.LittleEndian.PutUint32(payload[16:], math.Float32bits(1))
		if kind >= 6 {
			binary.LittleEndian.PutUint32(payload[128:], math.Float32bits(1))
			binary.LittleEndian.PutUint32(payload[132:], math.Float32bits(1))
		}
	}
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
	h.lobby.RelayMotion(a, motionFrame(roomID, raceID, a.playerID, 0xFF, 234))
	expect("countdown", [4]int{1, 2, 1, 0})
	h.clock.Advance(3 * time.Second)
	h.lobby.RelayMotion(c, motionFrame(roomID, raceID, c.playerID, 0xFF, 234))
	expect("racing", [4]int{2, 3, 1, 0})

	// A finished race relays nothing.
	for _, p := range racers {
		h.must(p, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 1})
	}
	h.lobby.RelayMotion(a, motionFrame(roomID, raceID, a.playerID, 0xFF, 234))
	expect("finished", [4]int{2, 3, 1, 0})
	// Clients outside any room are ignored.
	h.lobby.RelayMotion(h.newClient(), motionFrame(roomID, raceID, a.playerID, 0xFF, 234))
}

// progressFrame is a kinematic frame of kind whose route distance is distance.
func progressFrame(roomID, raceID, playerID string, kind int, distance float64) []byte {
	frame := motionFrame(roomID, raceID, playerID, 0xFF, motionHeaderLength+kinematicPayloadLength(kind))
	frame[2] = byte(kind)
	if len(frame) >= progressOffset+8 { // kinds 2 and 3 have no progress section
		binary.LittleEndian.PutUint64(frame[progressOffset:], math.Float64bits(distance))
	}
	return frame
}

func TestKinematicPayloadLengths(t *testing.T) {
	// payload.ts decodeKinematicSample base lengths, plus 12 for visual scale (9, 10).
	want := map[int]int{1: 0, 2: 80, 3: 108, 4: 124, 5: 128, 6: 137, 7: 149, 8: 166, 9: 161, 10: 178, 11: 0}
	for kind, length := range want {
		if got := kinematicPayloadLength(kind); got != length {
			t.Errorf("kind %d: %d, want %d", kind, got, length)
		}
	}
}

// The settlement carries each racer's furthest route progress while racing,
// capped by 500 km/h since the start (plus the track's warps and longest
// section, anticheat.Limits.ProgressCap); later, shorter, malformed,
// non-finite and post-finish reports do not count.
func TestRaceProgressDistance(t *testing.T) {
	h := newHarness(t)
	a, b := h.connect("A"), h.connect("B")
	roomID, raceID := h.startRace([]*Client{a, b}, "ordinary", "speedIndiCombine", 2)
	send := func(c *Client, kind int, distance float64) {
		h.lobby.RelayMotion(c, progressFrame(roomID, raceID, c.playerID, kind, distance))
	}
	send(a, 10, 50) // no time since the start yet
	h.clock.Advance(20 * time.Second)
	send(a, 10, 1500)
	send(a, 10, 1200) // backwards keeps the furthest
	send(a, 4, 1800)  // kind 4 carries progress too
	short := progressFrame(roomID, raceID, a.playerID, 10, 2600)
	h.lobby.RelayMotion(a, short[:len(short)-1])
	send(a, 3, 2700) // no progress section
	send(b, 10, 1e7) // capped: 20 s x 140 m/s + 100 m + village_R01's longest section (429 m)
	send(b, 10, math.NaN())
	h.must(a, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 20_000})
	send(a, 10, 2500) // after its finish
	h.must(b, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 21_000})

	settlements := h.recorder.settlements()
	if len(settlements) != 1 {
		t.Fatalf("settlements %d", len(settlements))
	}
	distances := map[string]int{}
	for _, result := range settlements[0].Results {
		distances[result.PlayerID] = result.DistanceMeters
	}
	if distances[a.playerID] != 1800 || distances[b.playerID] != 2900+429 {
		t.Fatalf("distances %v", distances)
	}
}
