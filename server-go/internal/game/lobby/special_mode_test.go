package lobby

import (
	"regexp"
	"slices"
	"testing"
	"time"
)

// Ported from SpecialModeTest.java: same scenarios and assertions.

func TestLateJoinerWaitsWithoutBlockingTheRace(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(3)
	racers, late := players[:2], players[2]
	room := h.joinAndReady(racers, h.create(racers, "ordinary", "speedIndiCombine", 8))
	roomID := room["roomId"]
	room = h.command(racers[0], map[string]any{"type": "start",
		"roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"]

	room = h.command(late, map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, len(list(room["members"])), 3)
	assertEqual(t, h.errorCode(late, map[string]any{"type": "loaded",
		"roomId": roomID, "raceId": raceID}), "NOT_RACE_PARTICIPANT")
	for _, racer := range racers {
		room = h.command(racer, map[string]any{"type": "loaded",
			"roomId": roomID, "raceId": raceID})
	}
	assertEqual(t, room["phase"], "countdown")
}

func TestRoadblockUsesRunnerDeadlineAndPersistsAnOutcome(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(5)
	room := h.create(players, "roadblock", "speedIndiCombine", 5)
	roomID := room["roomId"]
	assertEqual(t, room["randomTrackCode"], 0)
	if _, ok := room["trackId"]; ok {
		t.Fatal("roadblock room has a fixed track")
	}
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "track",
		"roomId": roomID, "trackId": "village_R01"}), "TRACK_FIXED_TO_RANDOM")

	room = h.joinAndReady(players, room)
	room = h.command(players[0], map[string]any{"type": "start",
		"roomId": roomID, "revision": room["revision"]})
	rc := raceOf(room)
	raceID := rc["raceId"]
	startSlots := object(rc["startSlots"])
	assertEqual(t, len(startSlots), len(players))
	for index, player := range players {
		assertEqual(t, startSlots[player.playerID], index)
	}
	if !slices.Contains(roadblockTracks, rc["trackId"].(string)) {
		t.Fatalf("track %v is not a roadblock track", rc["trackId"])
	}
	assertEqual(t, rc["roadblock"], map[string]any{"ruleset": "web-roadblock-v1",
		"runnerId": players[0].playerID, "limitMs": 180_000, "noRunnerManualReset": true})
	if _, ok := rc["finishDeadline"]; ok {
		t.Fatal("finishDeadline before loading finished")
	}

	for _, player := range players {
		room = h.command(player, map[string]any{"type": "loaded",
			"roomId": roomID, "raceId": raceID})
	}
	rc = raceOf(room)
	assertEqual(t, room["phase"], "countdown")
	assertEqual(t, rc["finishDeadline"], rc["startAt"].(float64)+180_000)
	if _, ok := rc["finishWindowMs"]; ok {
		t.Fatal("roadblock race has a finish window")
	}
	h.clock.Advance(3_100 * time.Millisecond)
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "finish",
		"roomId": roomID, "raceId": raceID, "elapsedMs": 1_000}), "RUNNER_REQUIRED")
	room = h.command(players[0], map[string]any{"type": "finish",
		"roomId": roomID, "raceId": raceID, "elapsedMs": 1_000})
	rc = raceOf(room)
	assertEqual(t, room["phase"], "finished")
	assertEqual(t, rc["startSlots"], startSlots)
	assertEqual(t, rc["results"], []any{})
	outcome := object(rc["roadblockOutcome"])
	assertEqual(t, outcome["runnerWon"], true)
	assertEqual(t, outcome["reason"], "finish")
	assertEqual(t, rc["raceOverAt"], outcome["endAt"].(float64)+3_000)
	finish := object(list(rc["finishes"])[0])
	assertEqual(t, finish["elapsedMs"], outcome["endAt"].(float64)-rc["startAt"].(float64))
	assertEqual(t, h.recorder.savedOutcomeCount(t, raceID.(string), "finish"), 1)
}

func TestRoadblockRunnerLeaveAndTimeoutGiveBlockersTheWin(t *testing.T) {
	for _, reason := range []string{"runner-left", "timeout"} {
		t.Run(reason, func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(5)
			room := h.joinAndReady(players, h.create(players, "roadblock", "speedIndiCombine", 5))
			roomID := room["roomId"].(string)
			room = h.command(players[0], map[string]any{"type": "start",
				"roomId": roomID, "revision": room["revision"]})
			raceID := raceOf(room)["raceId"].(string)
			for _, player := range players {
				h.command(player, map[string]any{"type": "loaded",
					"roomId": roomID, "raceId": raceID})
			}
			h.clock.Advance(3_100 * time.Millisecond)
			if reason == "runner-left" {
				h.must(players[0], map[string]any{"type": "leave", "roomId": roomID})
			} else {
				h.lobby.mu.Lock()
				h.lobby.roadblockTimeout(roomID, raceID)
				h.lobby.mu.Unlock()
			}
			room = object(h.sink(players[1]).last(t)["room"])
			assertEqual(t, room["phase"], "finished")
			wantHost := players[0].playerID
			if reason == "runner-left" {
				wantHost = players[1].playerID
			}
			assertEqual(t, room["hostId"], wantHost)
			rc := raceOf(room)
			outcome := object(rc["roadblockOutcome"])
			assertEqual(t, outcome["runnerWon"], false)
			assertEqual(t, outcome["reason"], reason)
			if _, ok := rc["finishes"]; ok {
				t.Fatal("blocker win recorded a finish")
			}
			assertEqual(t, rc["results"], []any{})
			assertEqual(t, h.recorder.savedOutcomeCount(t, raceID, reason), 1)
		})
	}
}

func TestGiantRelaysOnlyOrderedLegalStateChanges(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	room := h.joinAndReady(players, h.create(players, "giant", "speedIndiCombine", 2))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "start",
		"roomId": roomID, "revision": room["revision"]})
	rc := raceOf(room)
	raceID := rc["raceId"]
	if !slices.Contains(giantTracks, rc["trackId"].(string)) {
		t.Fatalf("track %v is not a giant track", rc["trackId"])
	}
	assertEqual(t, rc["giant"], map[string]any{"ruleset": "p948-giant-p3553-web-v1"})
	for _, player := range players {
		h.command(player, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3_100 * time.Millisecond)
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "giant-state",
		"roomId": roomID, "raceId": raceID, "sequence": 1, "main": 0,
		"extra": 0, "status": 0}), "INVALID_GIANT_STATE")
	state := h.must(players[0], map[string]any{"type": "giant-state",
		"roomId": roomID, "raceId": raceID, "sequence": 1, "main": 1,
		"extra": 0, "status": 0})
	assertEqual(t, state["playerId"], players[0].playerID)
	if !containsEvent(h.sink(players[1]).events(t), state) {
		t.Fatal("peer did not receive the giant state")
	}
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "giant-state",
		"roomId": roomID, "raceId": raceID, "sequence": 3, "main": 2,
		"extra": 0, "status": 0}), "INVALID_SEQUENCE")
	h.must(players[0], map[string]any{"type": "giant-state",
		"roomId": roomID, "raceId": raceID, "sequence": 2, "main": 1,
		"extra": 0, "status": 1})
}

func TestTeamChargeBroadcastsMeterAndAwardMotionToPeers(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedTeamCombine", 4))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "start",
		"roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"]
	slots := object(raceOf(room)["startSlots"])
	var order []any
	for _, player := range players {
		order = append(order, slots[player.playerID])
	}
	assertEqual(t, order, []int{0, 4, 1, 5})
	for _, player := range players {
		h.command(player, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3_100 * time.Millisecond)
	host := players[0]
	half := h.must(host, map[string]any{"type": "team-charge",
		"roomId": roomID, "raceId": raceID, "sequence": 1, "charge": 4_000})
	assertEqual(t, half["team"], 1)
	assertEqual(t, half["sequence"], 1)
	assertEqual(t, half["target"], 0.5)
	if !containsEvent(h.sink(players[2]).events(t), half) {
		t.Fatal("team mate did not receive the gauge")
	}
	full := h.must(host, map[string]any{"type": "team-charge",
		"roomId": roomID, "raceId": raceID, "sequence": 2, "charge": 4_000})
	assertEqual(t, full["target"], 1.0)
	reset := h.must(players[2], map[string]any{"type": "team-charge",
		"roomId": roomID, "raceId": raceID, "sequence": 1, "charge": 800})
	assertEqual(t, reset["sequence"], 3)
	assertEqual(t, reset["target"], 0.1)
	assertEqual(t, h.errorCode(host, map[string]any{"type": "team-charge",
		"roomId": roomID, "raceId": raceID, "sequence": 4, "charge": 100}), "INVALID_SEQUENCE")
	award := h.must(host, map[string]any{"type": "award-motion",
		"roomId": roomID, "raceId": raceID, "motion": 12})
	assertEqual(t, award["playerId"], host.playerID)
	if !containsEvent(h.sink(players[1]).events(t), award) {
		t.Fatal("peer did not receive the award motion")
	}
}

func TestRpAndLtePublishModeDataAndCompatibleTracks(t *testing.T) {
	for _, gameplay := range []string{"rp", "lte"} {
		t.Run(gameplay, func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(2)
			channel := "speedIndiCombine"
			if gameplay == "rp" {
				channel = "speedIndiInfinit"
			}
			room := h.create(players, gameplay, channel, 2)
			if gameplay == "lte" {
				assertEqual(t, room["randomTrackCode"], 0)
				if _, ok := room["trackId"]; ok {
					t.Fatal("lte room has a fixed track")
				}
			}
			room = h.joinAndReady(players, room)
			room = h.command(players[0], map[string]any{"type": "start",
				"roomId": room["roomId"], "revision": room["revision"]})
			rc := raceOf(room)
			if gameplay == "lte" {
				if !slices.Contains(lteTracks, rc["trackId"].(string)) {
					t.Fatalf("track %v is not an lte track", rc["trackId"])
				}
				assertEqual(t, rc["lte"], map[string]any{"ruleset": "web-lte-v1",
					"featureSet": "dodge-trial"})
				return
			}
			rp := object(rc["rp"])
			assertEqual(t, rp["ruleset"], "web-rp-speed-v1")
			if !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(rp["poolRevision"].(string)) {
				t.Fatalf("poolRevision %v", rp["poolRevision"])
			}
			draws := object(rp["draws"])
			assertEqual(t, len(draws), 2)
			for _, player := range players {
				draw := object(draws[player.playerID])
				if draw == nil {
					t.Fatal("missing draw")
				}
				if !slices.Contains([]float64{387, 390, 378, 361}, draw["kartId"].(float64)) {
					t.Fatalf("kart %v not in the pool", draw["kartId"])
				}
				assertEqual(t, draw["flyingPetId"], 0)
			}
		})
	}
}

func containsEvent(events []map[string]any, want map[string]any) bool {
	for _, event := range events {
		if jsonEqual(event, want) {
			return true
		}
	}
	return false
}
