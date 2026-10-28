package lobby

import (
	"encoding/binary"
	"math"
	"testing"
	"time"
)

func TestBraveCollisionOnlyReportsRacingOpponents(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	roomID, raceID := h.startRace(players, "brave", "speedTeamCombine", 8)
	request := func(target string) map[string]any {
		return map[string]any{"type": "brave-collision", "roomId": roomID, "raceId": raceID, "targetId": target}
	}
	assertEqual(t, h.errorCode(players[0], request(players[2].playerID)), "INVALID_BRAVE_TARGET")
	assertEqual(t, h.errorCode(players[0], request(players[0].playerID)), "INVALID_BRAVE_TARGET")
	otherRace := request(players[1].playerID)
	otherRace["raceId"] = "another-race"
	assertEqual(t, h.errorCode(players[0], otherRace), "RACE_NOT_FOUND")
	late := h.connect("Late")
	h.command(late, map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, h.errorCode(players[0], request(late.playerID)), "INVALID_BRAVE_TARGET")
	assertEqual(t, h.errorCode(late, request(players[0].playerID)), "NOT_RACE_PARTICIPANT")

	spoof := request(players[1].playerID)
	spoof["playerId"] = players[3].playerID
	event := h.must(players[0], spoof)
	assertEqual(t, event, map[string]any{"type": "brave-collision", "roomId": roomID, "raceId": raceID,
		"playerId": players[0].playerID, "targetId": players[1].playerID})
	if !containsEvent(h.sink(players[2]).events(t), event) {
		t.Fatal("teammate missed collision warning")
	}
	assertEqual(t, h.errorCode(players[0], request(players[3].playerID)), "BRAVE_COLLISION_COOLDOWN")
	h.clock.Advance(300 * time.Millisecond)
	h.must(players[0], request(players[3].playerID))
	h.must(players[1], leaveRequest(roomID))
	assertEqual(t, h.errorCode(players[0], request(players[1].playerID)), "INVALID_BRAVE_TARGET")
	h.clock.Advance(30 * time.Second)
	h.must(players[3], finishRequest(roomID, raceID, 30_300))
	assertEqual(t, h.errorCode(players[0], request(players[3].playerID)), "INVALID_BRAVE_TARGET")
	assertEqual(t, h.errorCode(players[3], request(players[0].playerID)), "NOT_RACE_PARTICIPANT")
	assertEqual(t, len(h.recorder.settlements()), 0)
}

func TestBraveCollisionRejectsWrongModeAndBeforeRace(t *testing.T) {
	for _, gameplay := range []string{"ordinary", "brave"} {
		t.Run(gameplay, func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(4)
			room := h.joinAndReady(players, h.create(players, gameplay, "speedTeamCombine", 4))
			room = h.command(players[0], map[string]any{"type": "start", "roomId": room["roomId"], "revision": room["revision"]})
			want := "RACE_NOT_RUNNING"
			if gameplay == "ordinary" {
				want = "BRAVE_REQUIRED"
			}
			assertEqual(t, h.errorCode(players[0], map[string]any{"type": "brave-collision", "roomId": room["roomId"],
				"raceId": raceOf(room)["raceId"], "targetId": players[1].playerID}), want)
		})
	}
}

func TestBraveMotionUsesFrozenGridAndBoundsCollisionHints(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	roomID, raceID := h.startRace(players, "brave", "speedTeamCombine", 4)
	r := h.lobby.rooms[roomID]
	// A deterministic non-room order exercises both mask lookup and the
	// authoritative sender stamp regardless of the actual random draw.
	r.race.startSlots = []int{3, 7, 2, 6}
	frameAt := func(x float32, mask byte) []byte {
		frame := motionFrame(raceID, 0, mask, motionHeaderLength+80)
		binary.LittleEndian.PutUint32(frame[motionHeaderLength+4:], math.Float32bits(x))
		return frame
	}
	h.lobby.RelayMotion(players[0], frameAt(0, 1<<7))
	assertEqual(t, h.sink(players[1]).frameCount(), 1)
	assertEqual(t, h.sink(players[2]).frameCount(), 0)
	assertEqual(t, h.sink(players[3]).frameCount(), 0)
	assertEqual(t, int(h.sink(players[1]).frames[0][motionSlotOffset]), 3)
	h.lobby.RelayMotion(players[1], frameAt(100, 0))
	request := map[string]any{"type": "brave-collision", "roomId": roomID, "raceId": raceID,
		"targetId": players[1].playerID}
	assertEqual(t, h.errorCode(players[0], request), "INVALID_BRAVE_TARGET")
	h.lobby.RelayMotion(players[1], frameAt(10, 0))
	h.must(players[0], request)
	h.clock.Advance(501 * time.Millisecond)
	// An old position does not reject a newer collision in a P2P session.
	h.lobby.RelayMotion(players[1], frameAt(100, 0))
	h.must(players[0], request)
}
