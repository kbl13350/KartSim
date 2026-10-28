package lobby

import (
	"fmt"
	"testing"
	"time"

	"kartsim/internal/shared/contract"
)

func TestBraveAdmissionAndFixedTrack(t *testing.T) {
	for _, test := range []struct {
		channel, version string
		capacity         int
		code             string
	}{
		{"speedIndiCombine", "p3553", 4, "INVALID_CHANNEL"},
		{"speedTeamInfinit", "p3553", 4, "INVALID_CHANNEL"},
		{"itemTeamCombine", "p3553", 4, "INVALID_CHANNEL"},
		{"speedTeamCombine", "p3543", 4, "RESOURCE_VERSION_UNSUPPORTED"},
		{"speedTeamCombine", "p3553", 2, "INVALID_CAPACITY"},
		{"speedTeamCombine", "p3553", 5, "INVALID_CAPACITY"},
		{"speedTeamCombine", "p3553", 10, "INVALID_CAPACITY"},
	} {
		t.Run(fmt.Sprint(test), func(t *testing.T) {
			assertEqual(t, codeOf(t, validateCreation("brave", test.channel, test.version, test.capacity)), test.code)
		})
	}
	for _, capacity := range []int{4, 6, 8} {
		if err := validateCreation("brave", "speedTeamCombine", "p3553", capacity); err != nil {
			t.Fatal(err)
		}
	}
	h := newHarness(t)
	players := h.connectN(4)
	room := h.create(players, "brave", "speedTeamCombine", 4)
	assertEqual(t, room["trackId"], braveTrack)
	listed := h.must(players[1], map[string]any{"type": "list-gameplay", "gameplay": "brave", "page": 0})
	assertEqual(t, listed["total"], 1)
	assertEqual(t, object(list(listed["rooms"])[0])["gameplay"], "brave")
	for _, track := range []string{"village_R01", "village_R07_rvs", "forest_R01"} {
		assertEqual(t, h.errorCode(players[0], map[string]any{"type": "track", "roomId": room["roomId"],
			"revision": room["revision"], "trackId": track}), "INVALID_TRACK")
	}
	for _, code := range []int{0, 40} {
		assertEqual(t, h.errorCode(players[0], map[string]any{"type": "random-track", "roomId": room["roomId"],
			"revision": room["revision"], "randomTrackCode": code}), "INVALID_TRACK")
	}
	room = h.joinAndReady(players, room)
	room = h.command(players[0], map[string]any{"type": "start", "roomId": room["roomId"], "revision": room["revision"]})
	assertEqual(t, raceOf(room)["trackId"], braveTrack)
	assertEqual(t, room["trackId"], braveTrack)
	assertEqual(t, room["randomTrackCode"], nil)
}

func TestBraveStartRequiresFourAndBalancedTeams(t *testing.T) {
	for _, count := range []int{2, 3, 5} {
		for _, random := range []bool{false, true} {
			t.Run(fmt.Sprintf("count-%d-random-%v", count, random), func(t *testing.T) {
				h := newHarness(t)
				players := h.connectN(count)
				room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", 8))
				room = h.command(players[0], map[string]any{"type": "random-team", "roomId": room["roomId"],
					"revision": room["revision"], "enabled": random})
				want := "BRAVE_TEAMS_UNBALANCED"
				if count < 4 {
					want = "NOT_ENOUGH_PLAYERS"
				}
				assertEqual(t, h.errorCode(players[0], map[string]any{"type": "start", "roomId": room["roomId"],
					"revision": room["revision"]}), want)
			})
		}
	}
	h := newHarness(t)
	players := h.connectN(4)
	room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", 8))
	room = h.command(players[1], map[string]any{"type": "team", "roomId": room["roomId"],
		"revision": room["revision"], "team": 1})
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "start", "roomId": room["roomId"],
		"revision": room["revision"]}), "BRAVE_TEAMS_UNBALANCED")
	room = h.command(players[0], map[string]any{"type": "random-team", "roomId": room["roomId"],
		"revision": room["revision"], "enabled": true})
	room = h.command(players[0], map[string]any{"type": "start", "roomId": room["roomId"], "revision": room["revision"]})
	assertEqual(t, room["phase"], "loading")
	assertEqual(t, teamCounts(room), map[string]int{"1": 2, "2": 2})
}

func TestBraveFreezesDirectionAndTeamGridWithoutMovingRoomSeats(t *testing.T) {
	for _, count := range []int{4, 6, 8} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(count)
			room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", count))
			seats := room["members"]
			room = h.command(players[0], map[string]any{"type": "start", "roomId": room["roomId"], "revision": room["revision"]})
			assertEqual(t, room["members"], seats)
			race := raceOf(room)
			brave := object(race["brave"])
			assertEqual(t, brave["ruleset"], "web-brave-v1")
			if brave["forwardTeam"] != float64(1) && brave["forwardTeam"] != float64(2) {
				t.Fatalf("bad forward team: %v", brave)
			}
			assertSeatedByTeam(t, map[string]any{"members": race["roster"]})
			for _, raw := range list(race["roster"]) {
				m := object(raw)
				assertEqual(t, object(race["startSlots"])[m["playerId"].(string)], m["slot"])
			}
			for _, p := range players {
				room = h.command(p, map[string]any{"type": "loaded", "roomId": room["roomId"], "raceId": race["raceId"]})
			}
			assertEqual(t, room["phase"], "countdown")
			assertEqual(t, raceOf(room)["brave"], brave)
			assertEqual(t, raceOf(room)["startSlots"], race["startSlots"])
		})
	}
}

func TestBravePreStartDropoutCancelsUnbalancedRace(t *testing.T) {
	for _, reason := range []string{"loading-left", "disconnect", "failed", "timeout", "countdown-left"} {
		t.Run(reason, func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(4)
			room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", 8))
			roomID := room["roomId"].(string)
			room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
			raceID := raceOf(room)["raceId"]
			for _, p := range players[:3] {
				h.command(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
			}
			want := "MEMBER_LEFT"
			switch reason {
			case "loading-left":
				h.must(players[3], leaveRequest(roomID))
			case "disconnect":
				h.lobby.Disconnect(players[3])
			case "failed":
				h.must(players[3], map[string]any{"type": "load-failed", "roomId": roomID, "raceId": raceID})
				want = "LOAD_FAILED"
			case "timeout":
				h.clock.Advance(90 * time.Second)
				want = "LOAD_TIMEOUT"
			case "countdown-left":
				h.command(players[3], map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
				h.must(players[3], leaveRequest(roomID))
			}
			room = object(h.sink(players[0]).last(t)["room"])
			assertEqual(t, room["phase"], "open")
			assertEqual(t, room["raceError"], want)
			assertEqual(t, room["race"], nil)
			h.clock.Advance(100 * time.Second)
			assertEqual(t, len(h.recorder.settlements()), 0)
			assertEqual(t, h.errorCode(players[0], map[string]any{"type": "loaded", "roomId": roomID,
				"raceId": raceID}), "RACE_NOT_FOUND")
		})
	}
}

func TestBraveTimeoutMayKeepFourBalancedLoadedRacers(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(6)
	room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", 6))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"]
	for _, p := range players[:4] {
		h.command(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(90 * time.Second)
	room = object(h.sink(players[0]).last(t)["room"])
	assertEqual(t, room["phase"], "countdown")
	assertEqual(t, len(list(raceOf(room)["loadedIds"])), 4)
	h.clock.Advance(countdown)
	assertEqual(t, object(h.sink(players[0]).last(t)["room"])["phase"], "racing")
}

func TestBraveTeamDepartureCannotLeaveRaceHanging(t *testing.T) {
	for _, finished := range []bool{false, true} {
		t.Run(fmt.Sprint(finished), func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(4)
			roomID, raceID := h.startRace(players, "brave", "speedTeamCombine", 8)
			h.clock.Advance(30 * time.Second)
			if finished {
				h.must(players[0], finishRequest(roomID, raceID, 30_000))
			}
			h.must(players[1], leaveRequest(roomID))
			assertEqual(t, object(h.sink(players[0]).last(t)["room"])["phase"], "racing")
			// A late joiner does not replace a departed racer in the frozen team.
			late := h.connect("Late")
			h.command(late, map[string]any{"type": "join", "roomId": roomID})
			h.must(players[3], leaveRequest(roomID))
			room := object(h.sink(players[0]).last(t)["room"])
			if !finished {
				assertEqual(t, room["phase"], "open")
				assertEqual(t, room["raceError"], "MEMBER_LEFT")
				assertEqual(t, len(h.recorder.settlements()), 0)
				return
			}
			assertEqual(t, room["phase"], "finished")
			assertEqual(t, raceOf(room)["winningTeam"], 1)
			assertEqual(t, object(raceOf(room)["teamScores"]), map[string]any{"1": 10, "2": 0})
			settlements := h.recorder.settlements()
			assertEqual(t, len(settlements), 1)
			assertEqual(t, settlements[0].Gameplay, "brave")
			assertEqual(t, raceOf(decodeObject(t, settlements[0].Snapshot))["brave"], raceOf(room)["brave"])
		})
	}
}

func TestBraveHandoffChecksStartRules(t *testing.T) {
	for _, invalid := range []string{"track", "random-track", "capacity", "unbalanced", "random-odd"} {
		t.Run(invalid, func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(4)
			room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", 8))
			r := h.lobby.rooms[room["roomId"].(string)]
			state := exportRoom(r)
			switch invalid {
			case "track":
				state.TrackID = "village_R01"
			case "random-track":
				code := 0
				state.TrackID, state.RandomTrackCode = "", &code
			case "capacity":
				state.Capacity = 2
			case "unbalanced":
				state.Members[1].Team = 1
			case "random-odd":
				state.RandomTeam = true
				state.Members = state.Members[:3]
			}
			node := newHarness(t)
			err := node.lobby.importHandoff(contract.RoomHandoff{HandoffID: "brave-handoff", Room: state})
			assertEqual(t, codeOf(t, err), "INVALID_HANDOFF")
			assertEqual(t, len(node.lobby.rooms), 0)
		})
	}
}

func TestBraveHandoffFreezesRulesOnGameNode(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	room := h.joinAndReady(players, h.create(players, "brave", "speedTeamCombine", 4))
	r := h.lobby.rooms[room["roomId"].(string)]
	node := newHarness(t)
	if err := node.lobby.importHandoff(contract.RoomHandoff{HandoffID: "brave-handoff", Room: exportRoom(r)}); err != nil {
		t.Fatal(err)
	}
	imported := node.lobby.rooms[r.id]
	assertEqual(t, imported.phase, "loading")
	snapshot := decodeObject(t, encode(imported.snapshot()))
	assertEqual(t, object(raceOf(snapshot)["brave"])["ruleset"], "web-brave-v1")
	assertEqual(t, raceOf(snapshot)["trackId"], braveTrack)
	assertSeatedByTeam(t, map[string]any{"members": raceOf(snapshot)["roster"]})
}

func TestBraveNormalFinishKeepsTeamScoreAndFrozenRulesInHistory(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	roomID, raceID := h.startRace(players, "brave", "speedTeamCombine", 4)
	h.clock.Advance(60 * time.Second)
	var room map[string]any
	// Blue takes first and second; finish rank points determine the winner.
	for i, index := range []int{1, 3, 0, 2} {
		room = h.command(players[index], finishRequest(roomID, raceID, 60_000+i))
	}
	assertEqual(t, room["phase"], "finished")
	assertEqual(t, raceOf(room)["winningTeam"], 2)
	assertEqual(t, object(raceOf(room)["teamScores"]), map[string]any{"1": 10, "2": 18})
	settlements := h.recorder.settlements()
	assertEqual(t, len(settlements), 1)
	assertEqual(t, settlements[0].Gameplay, "brave")
	stored := decodeObject(t, settlements[0].Snapshot)
	assertEqual(t, stored["gameplay"], "brave")
	assertEqual(t, raceOf(stored)["brave"], raceOf(room)["brave"])
	assertEqual(t, raceOf(stored)["startSlots"], raceOf(room)["startSlots"])
}
