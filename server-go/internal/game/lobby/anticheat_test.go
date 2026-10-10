package lobby

import (
	"encoding/binary"
	"math"
	"testing"
	"time"

	"kartsim/internal/game/anticheat"
	"kartsim/internal/shared/contract"
)

// cheatHarness runs the lobby with the anti-cheat in mode.
func cheatHarness(t *testing.T, mode anticheat.Mode) *harness {
	t.Helper()
	return newHarnessWith(t, func(opts *Options) { opts.AntiCheat = mode })
}

// connectClosing is connect with a sink that records close requests.
func (h *harness) connectClosing(name string) (*Client, *closingSink) {
	h.t.Helper()
	sink := &closingSink{}
	c := NewClient(sink)
	h.sinks[c] = &sink.recordingSink
	h.must(c, helloRequest(name, h.guestTicket()))
	return c, sink
}

// kartFrame is c's kind 10 frame at x meters east with route distance and
// lap, ticked with the lobby clock.
func (h *harness) kartFrame(roomID, raceID string, c *Client, x, distance float64, lap int) []byte {
	frame := progressFrame(roomID, raceID, c.playerID, 10, distance)
	payload := frame[motionHeaderLength:]
	binary.LittleEndian.PutUint32(payload, uint32(h.clock.Now()))
	binary.LittleEndian.PutUint32(payload[4:], math.Float32bits(float32(x)))
	binary.LittleEndian.PutUint32(frame[lapOffset:], uint32(lap))
	return frame
}

func (h *harness) cheatReports() []contract.AntiCheatReport { return h.recorder.antiCheatReports() }

// A racer whose kart jumps 2 km is told why, leaves the race at once and
// is closed; nobody receives the jump, its later commands and frames are
// refused, and it ranks as retired without a reward.
func TestAntiCheatKicksATeleport(t *testing.T) {
	h := cheatHarness(t, anticheat.ModeKick)
	cheater, sink := h.connectClosing("Cheater")
	honest, _ := h.connectClosing("Honest")
	roomID, raceID := h.startRace([]*Client{cheater, honest}, "ordinary", "speedIndiCombine", 2)

	h.lobby.RelayMotion(cheater, h.kartFrame(roomID, raceID, cheater, 0, 10, 1))
	h.clock.Advance(64 * time.Millisecond)
	h.lobby.RelayMotion(cheater, h.kartFrame(roomID, raceID, cheater, 2_000, 14, 1))
	if got := h.sink(honest).frameCount(); got != 1 {
		t.Fatalf("honest racer got %d frames, want only the first", got)
	}
	kick := h.sink(cheater).last(t)
	if kick["type"] != "error" || kick["code"] != "CHEAT_DETECTED" || kick["check"] != "TELEPORT" {
		t.Fatalf("kick %v", kick)
	}
	assertEqual(t, sink.closes, []string{"1008 anti-cheat"})
	reports := h.cheatReports()
	if len(reports) != 1 || reports[0].Code != "TELEPORT" || reports[0].Action != contract.AntiCheatKick ||
		reports[0].PlayerID != cheater.playerID || reports[0].RaceID != raceID || reports[0].TrackID != "village_R01" ||
		reports[0].NodeID != testNodeID || len(reports[0].EventID) != 36 {
		t.Fatalf("reports %+v", reports)
	}
	room := object(h.sink(honest).last(t)["room"])
	assertEqual(t, len(list(room["members"])), 1)
	assertEqual(t, room["phase"], "racing")

	// Until its connection closes, nothing it sends counts.
	if code := h.errorCode(cheater, map[string]any{"type": "clock", "clientTick": 1}); code != "CHEAT_DETECTED" {
		t.Fatalf("command after the kick: %s", code)
	}
	h.lobby.RelayMotion(cheater, h.kartFrame(roomID, raceID, cheater, 2_000, 20, 1))
	if got := h.sink(honest).frameCount(); got != 1 {
		t.Fatalf("a kicked racer's frame was relayed")
	}
	h.lobby.Disconnect(cheater)

	// The honest racer finishes; the cheater ranks last, without a reward.
	h.clock.Advance(100 * time.Second)
	h.lobby.RelayMotion(honest, h.kartFrame(roomID, raceID, honest, 0, 6_900, 3))
	h.must(honest, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 100_000})
	settlement := h.recorder.settlements()[0]
	if len(settlement.Results) != 2 || settlement.Results[0].PlayerID != honest.playerID ||
		settlement.Results[1].PlayerID != cheater.playerID || settlement.Results[1].ElapsedMs != nil {
		t.Fatalf("results %+v", settlement.Results)
	}
	for _, reward := range settlement.Rewards {
		if reward.PlayerID == cheater.playerID {
			t.Fatalf("the cheater was rewarded: %+v", reward)
		}
	}
}

// Honest racers driving the track's laps at a fast but possible pace
// finish without a violation.
func TestAntiCheatPassesAnHonestRace(t *testing.T) {
	h := cheatHarness(t, anticheat.ModeKick)
	a, aSink := h.connectClosing("A")
	b, bSink := h.connectClosing("B")
	roomID, raceID := h.startRace([]*Client{a, b}, "ordinary", "speedIndiCombine", 2)
	start := h.clock.Now()
	track := anticheat.TrackByID("village_R01")
	total := float64(track.Laps) * track.Lap
	// 90 m/s of route, 80 m/s straight east (corners), a frame every 256 ms.
	distance, x, lap := -20.0, 0.0, 0
	for distance < total+30 {
		h.clock.Advance(256 * time.Millisecond)
		distance += 90 * 0.256
		x += 80 * 0.256
		if distance >= float64(lap)*track.Lap {
			lap++
		}
		h.lobby.RelayMotion(a, h.kartFrame(roomID, raceID, a, x, distance, lap))
		h.lobby.RelayMotion(b, h.kartFrame(roomID, raceID, b, x+3, distance-5, lap))
	}
	elapsed := h.clock.Now() - start
	h.must(a, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": elapsed})
	h.must(b, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": elapsed + 100})
	if reports := h.cheatReports(); len(reports) != 0 || len(aSink.closes) != 0 || len(bSink.closes) != 0 {
		t.Fatalf("honest race: %+v", reports)
	}
	if len(h.recorder.settlements()) != 1 {
		t.Fatal("race not settled")
	}
}

// A finish without the route behind it is refused with a kick; the other
// racer, alone in the race then, finishes as before (nobody received its
// frames, so its progress is not checked).
func TestAntiCheatRefusesAFinishWithoutDriving(t *testing.T) {
	h := cheatHarness(t, anticheat.ModeKick)
	a, aSink := h.connectClosing("A")
	b, _ := h.connectClosing("B")
	roomID, raceID := h.startRace([]*Client{a, b}, "ordinary", "speedIndiCombine", 2)
	h.clock.Advance(80 * time.Second)
	if code := h.errorCode(a, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID,
		"elapsedMs": 80_000}); code != "CHEAT_DETECTED" {
		t.Fatalf("finish without driving: %s", code)
	}
	assertEqual(t, aSink.closes, []string{"1008 anti-cheat"})
	if reports := h.cheatReports(); len(reports) != 1 || reports[0].Code != "FINISH_EARLY" {
		t.Fatalf("reports %+v", reports)
	}
	h.must(b, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 80_000})
	assertEqual(t, len(h.cheatReports()), 1)
}

// A finish faster than the track can be driven, or reporting far less time
// than the server saw, is refused.
func TestAntiCheatRefusesImpossibleFinishTimes(t *testing.T) {
	for name, tc := range map[string]struct {
		raced   time.Duration
		elapsed int
		check   string
	}{
		"too fast":       {20 * time.Second, 20_000, "FINISH_FAST"},
		"time too short": {120 * time.Second, 60_000, "FINISH_TIME"},
	} {
		t.Run(name, func(t *testing.T) {
			h := cheatHarness(t, anticheat.ModeKick)
			a, _ := h.connectClosing("A")
			b, _ := h.connectClosing("B")
			roomID, raceID := h.startRace([]*Client{a, b}, "ordinary", "speedIndiCombine", 2)
			h.clock.Advance(tc.raced)
			code := h.errorCode(a, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID,
				"elapsedMs": tc.elapsed})
			if reports := h.cheatReports(); code != "CHEAT_DETECTED" || len(reports) != 1 || reports[0].Code != tc.check {
				t.Fatalf("%s: %+v", code, reports)
			}
		})
	}
}

// A payload the browsers cannot decode is never relayed: in kick mode its
// sender is kicked, with the anti-cheat off it is only dropped.
func TestBadFramesAreNeverRelayed(t *testing.T) {
	for _, mode := range []anticheat.Mode{anticheat.ModeKick, anticheat.ModeOff} {
		h := cheatHarness(t, mode)
		a, aSink := h.connectClosing("A")
		b, _ := h.connectClosing("B")
		room := h.joinAndReady([]*Client{a, b}, h.create([]*Client{a, b}, "ordinary", "speedIndiCombine", 2))
		roomID := room["roomId"].(string)
		room = h.command(a, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
		raceID := raceOf(room)["raceId"].(string)
		h.must(a, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
		h.must(b, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
		frame := motionFrame(roomID, raceID, a.playerID, 0xFF, 234)
		binary.LittleEndian.PutUint32(frame[motionHeaderLength+16:], 0) // a zero quaternion
		h.lobby.RelayMotion(a, frame)
		if got := h.sink(b).frameCount(); got != 0 {
			t.Fatalf("%v: a bad frame was relayed", mode)
		}
		if mode == anticheat.ModeKick {
			if reports := h.cheatReports(); len(reports) != 1 || reports[0].Code != "BAD_FRAME" || len(aSink.closes) != 1 {
				t.Fatalf("kick mode: %+v %v", reports, aSink.closes)
			}
		} else if len(h.cheatReports()) != 0 || len(aSink.closes) != 0 {
			t.Fatal("anti-cheat off acted")
		}
	}
}

// Log mode records each check of a racer once per race and kicks nobody;
// the frames still go out.
func TestAntiCheatLogMode(t *testing.T) {
	h := cheatHarness(t, anticheat.ModeLog)
	a, aSink := h.connectClosing("A")
	b, _ := h.connectClosing("B")
	roomID, raceID := h.startRace([]*Client{a, b}, "ordinary", "speedIndiCombine", 2)
	for i := range 4 {
		h.clock.Advance(64 * time.Millisecond)
		h.lobby.RelayMotion(a, h.kartFrame(roomID, raceID, a, float64(i)*2_000, 10, 1))
	}
	reports := h.cheatReports()
	if len(reports) != 1 || reports[0].Code != "TELEPORT" || reports[0].Action != contract.AntiCheatLog {
		t.Fatalf("reports %+v", reports)
	}
	if len(aSink.closes) != 0 || h.sink(b).frameCount() != 4 {
		t.Fatalf("log mode kicked or dropped: %v, %d frames", aSink.closes, h.sink(b).frameCount())
	}
}

// Eating more distinct cubes than a track lays out in the window kicks.
func TestAntiCheatCubeRate(t *testing.T) {
	h := cheatHarness(t, anticheat.ModeKick)
	players := []*Client{}
	a, aSink := h.connectClosing("A")
	b, _ := h.connectClosing("B")
	players = append(players, a, b)
	ir := h.startItemRace(players, "itemIndiCombine")
	limit := anticheat.DefaultLimits().CubeMax
	for i := range limit {
		ir.random.values = append(ir.random.values, 0)
		if reply := ir.rawReply(a, "cube", map[string]any{"cubeId": i + 1, "capacity": 2}); reply == "" {
			t.Fatal("no reply")
		}
		h.clock.Advance(100 * time.Millisecond)
	}
	if code := ir.reject(a, "cube", map[string]any{"cubeId": limit + 1, "capacity": 2}); code != "CHEAT_DETECTED" {
		t.Fatalf("cube %d: %s", limit+1, code)
	}
	if reports := h.cheatReports(); len(reports) != 1 || reports[0].Code != "CUBE_RATE" || len(aSink.closes) != 1 {
		t.Fatalf("reports %+v", reports)
	}
}
