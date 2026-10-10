package lobby

import (
	"testing"
	"time"

	"kartsim/internal/shared/contract"
)

// Not in Java (which cancelled the race with MEMBER_LEFT, LOAD_FAILED or
// LOAD_TIMEOUT): these tests cover a racer dropping out of a loading or
// running race by leaving the room or failing to load, while the others
// race on.

func leaveRequest(roomID string) map[string]any {
	return map[string]any{"type": "leave", "roomId": roomID}
}

func rewardIDs(rc map[string]any) map[string]bool {
	ids := map[string]bool{}
	for id := range object(rc["rewards"]) {
		ids[id] = true
	}
	return ids
}

// A racer who leaves mid-race does not stop the race: the others race on
// and the race finalizes once they have all finished, without waiting for
// the finish window. The leaver is an unfinished last place without reward.
func TestRacerLeavingMidRaceKeepsRaceForOthers(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.connectAccount("Alice", "acc-alice"), h.connectAccount("Bob", "acc-bob")
	carol := h.connectAccount("Carol", "acc-carol")
	roomID, raceID := h.startRace([]*Client{alice, bob, carol}, "ordinary", "speedIndiCombine", 3)
	h.clock.Advance(20 * time.Second)

	h.must(carol, leaveRequest(roomID))
	room := object(h.sink(alice).last(t)["room"])
	assertEqual(t, room["phase"], "racing")
	assertEqual(t, raceOf(room)["raceId"], raceID)
	assertEqual(t, len(list(room["members"])), 2)

	room = h.command(alice, finishRequest(roomID, raceID, 40_000))
	assertEqual(t, room["phase"], "racing")
	h.clock.Advance(2 * time.Second)
	room = h.command(bob, finishRequest(roomID, raceID, 42_000))
	assertEqual(t, room["phase"], "finished")
	rc := raceOf(room)
	results := list(rc["results"])
	assertEqual(t, len(results), 3)
	assertEqual(t, object(results[0])["playerId"], alice.playerID)
	assertEqual(t, object(results[1])["playerId"], bob.playerID)
	assertEqual(t, object(results[2])["playerId"], carol.playerID)
	assertEqual(t, object(results[2])["elapsedMs"], nil)
	assertEqual(t, rewardIDs(rc), map[string]bool{alice.playerID: true, bob.playerID: true})

	settlement := h.recorder.settlements()[0]
	assertEqual(t, settlement.Results[2].Name, "Carol")
	assertEqual(t, settlement.Results[2].AccountID, "acc-carol")
	if len(settlement.Rewards) != 2 {
		t.Fatalf("settlement rewards %+v", settlement.Rewards)
	}

	// The podium closes once the racers still in the room return.
	h.must(alice, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	room = h.command(bob, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "open")
}

// The last racer still racing leaving ends the race at once; a racer who
// finished before leaving keeps its place and reward.
func TestLastUnfinishedRacerLeavingFinalizes(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	roomID, raceID := h.startRace([]*Client{alice, bob, carol}, "ordinary", "speedIndiCombine", 3)
	h.clock.Advance(30 * time.Second)
	h.must(alice, finishRequest(roomID, raceID, 30_000))
	h.must(alice, leaveRequest(roomID))
	h.must(bob, finishRequest(roomID, raceID, 30_500))
	assertEqual(t, object(h.sink(bob).last(t)["room"])["phase"], "racing")

	h.must(carol, leaveRequest(roomID))
	room := object(h.sink(bob).last(t)["room"])
	assertEqual(t, room["phase"], "finished")
	rc := raceOf(room)
	assertEqual(t, object(list(rc["results"])[0])["playerId"], alice.playerID)
	assertEqual(t, rewardIDs(rc), map[string]bool{alice.playerID: true, bob.playerID: true})
}

// A team racer who finished and then left still scores for its team.
func TestFinishedTeamRacerWhoLeftStillScores(t *testing.T) {
	h := newHarness(t)
	players := []*Client{h.connect("A"), h.connect("B"), h.connect("C"), h.connect("D")}
	roomID, raceID := h.startRace(players, "ordinary", "speedTeamInfinit", 4)
	h.clock.Advance(60 * time.Second)
	// Team 1 = players 0 and 2, team 2 = players 1 and 3.
	h.must(players[0], finishRequest(roomID, raceID, 60_000))
	h.must(players[0], leaveRequest(roomID))
	for i, idx := range []int{1, 2, 3} {
		h.must(players[idx], finishRequest(roomID, raceID, 60_001+i))
	}
	rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
	assertEqual(t, rc["teamScores"], map[string]any{"1": 16, "2": 12})
	assertEqual(t, rc["winningTeam"], 1)
}

// A racer leaving while the others load starts the countdown once they
// have; it never loaded, so it is not in the results.
func TestRacerLeavingDuringLoadingStartsOthers(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	room := h.joinAndReady([]*Client{alice, bob, carol},
		h.create([]*Client{alice, bob, carol}, "ordinary", "speedIndiCombine", 3))
	roomID := room["roomId"].(string)
	room = h.command(alice, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"].(string)
	h.must(alice, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	h.must(bob, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	assertEqual(t, object(h.sink(alice).last(t)["room"])["phase"], "loading")

	h.must(carol, leaveRequest(roomID))
	assertEqual(t, object(h.sink(alice).last(t)["room"])["phase"], "countdown")
	h.clock.Advance(3 * time.Second)
	assertEqual(t, object(h.sink(alice).last(t)["room"])["phase"], "racing")
	h.clock.Advance(20 * time.Second)
	h.must(alice, finishRequest(roomID, raceID, 20_000))
	room = h.command(bob, finishRequest(roomID, raceID, 20_100))
	assertEqual(t, room["phase"], "finished")
	assertEqual(t, len(list(raceOf(room)["results"])), 2)
}

// Late joiners wait in the room: one leaving changes nothing for the race.
func TestLateJoinerLeavingKeepsRace(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.connect("Alice"), h.connect("Bob")
	roomID, raceID := h.startRace([]*Client{alice, bob}, "ordinary", "speedIndiCombine", 3)
	dave := h.connect("Dave")
	h.command(dave, map[string]any{"type": "join", "roomId": roomID})
	h.must(dave, leaveRequest(roomID))
	room := object(h.sink(alice).last(t)["room"])
	assertEqual(t, room["phase"], "racing")
	assertEqual(t, raceOf(room)["raceId"], raceID)
}

// A racer who left and came back waits like a late joiner: it cannot race
// and nobody waits for it, neither to finish nor to return.
func TestRejoinedLeaverIsOutOfRace(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	roomID, raceID := h.startRace([]*Client{alice, bob, carol}, "ordinary", "speedIndiCombine", 3)
	h.clock.Advance(20 * time.Second)
	h.must(carol, leaveRequest(roomID))
	h.command(carol, map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, h.errorCode(carol, finishRequest(roomID, raceID, 20_000)), "NOT_RACE_PARTICIPANT")

	h.must(alice, finishRequest(roomID, raceID, 20_000))
	room := h.command(bob, finishRequest(roomID, raceID, 20_100))
	assertEqual(t, room["phase"], "finished")
	assertEqual(t, h.errorCode(carol, map[string]any{"type": "return-room", "roomId": roomID,
		"raceId": raceID}), "NOT_RACE_PARTICIPANT")
	h.must(alice, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	room = h.command(bob, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "open")
	assertEqual(t, len(list(room["members"])), 3)
}

// When every racer is gone, the late joiners left in the room get it back:
// settled if someone had finished, cancelled otherwise.
func TestRaceWithoutRacersReopensRoom(t *testing.T) {
	for _, finished := range []bool{true, false} {
		h := newHarness(t)
		alice, bob := h.connect("Alice"), h.connect("Bob")
		roomID, raceID := h.startRace([]*Client{alice, bob}, "ordinary", "speedIndiCombine", 3)
		dave := h.connect("Dave")
		h.command(dave, map[string]any{"type": "join", "roomId": roomID})
		h.clock.Advance(20 * time.Second)
		if finished {
			h.must(alice, finishRequest(roomID, raceID, 20_000))
		}
		h.must(alice, leaveRequest(roomID))
		h.must(bob, leaveRequest(roomID))
		room := object(h.sink(dave).last(t)["room"])
		assertEqual(t, room["phase"], "open")
		if _, ok := room["race"]; ok {
			t.Fatal("reopened room still has a race")
		}
		if _, ok := room["raceError"]; ok {
			t.Fatal("reopened room has a race error")
		}
		assertEqual(t, len(h.recorder.settlements()), map[bool]int{true: 1, false: 0}[finished])
	}
}

// Roadblock: the runner leaving during the countdown ends the race
// (runner-left) as it does while racing; a blocker leaving while loading
// cancels the start only when five racers can no longer load.
func TestRoadblockRacerLeavingBeforeTheStart(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(5)
	room := h.joinAndReady(players, h.create(players, "roadblock", "speedIndiCombine", 6))
	roomID := room["roomId"].(string)
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"].(string)
	for _, p := range players {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	assertEqual(t, object(h.sink(players[1]).last(t)["room"])["phase"], "countdown")
	h.must(players[2], leaveRequest(roomID))
	assertEqual(t, object(h.sink(players[1]).last(t)["room"])["phase"], "countdown")
	h.must(players[0], leaveRequest(roomID))
	room = object(h.sink(players[1]).last(t)["room"])
	assertEqual(t, room["phase"], "finished")
	assertEqual(t, object(raceOf(room)["roadblockOutcome"])["reason"], "runner-left")

	h = newHarness(t)
	players = h.connectN(5)
	room = h.joinAndReady(players, h.create(players, "roadblock", "speedIndiCombine", 6))
	roomID = room["roomId"].(string)
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID = raceOf(room)["raceId"].(string)
	for _, p := range players[:4] {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.must(players[4], leaveRequest(roomID))
	room = object(h.sink(players[1]).last(t)["room"])
	assertEqual(t, room["phase"], "open")
	assertEqual(t, room["raceError"], "MEMBER_LEFT")
}

func loadedRequest(roomID, raceID string) map[string]any {
	return map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID}
}

func loadFailedRequest(roomID, raceID string) map[string]any {
	return map[string]any{"type": "load-failed", "roomId": roomID, "raceId": raceID}
}

// startLoading starts a race and returns it while everyone is loading.
func (h *harness) startLoading(players []*Client, gameplay string, capacity int) (string, string) {
	h.t.Helper()
	room := h.joinAndReady(players, h.create(players, gameplay, "speedIndiCombine", capacity))
	roomID := room["roomId"].(string)
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	return roomID, raceOf(room)["raceId"].(string)
}

// A racer whose loading fails drops out alone: the others start without
// it, and it waits in the room, out of the race, for the next one.
func TestLoadFailureDropsOnlyThatRacer(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	roomID, raceID := h.startLoading([]*Client{alice, bob, carol}, "ordinary", 3)
	h.must(alice, loadedRequest(roomID, raceID))
	h.must(bob, loadedRequest(roomID, raceID))
	room := h.command(carol, loadFailedRequest(roomID, raceID))
	assertEqual(t, room["phase"], "countdown")
	assertEqual(t, len(list(room["members"])), 3)
	assertEqual(t, raceOf(room)["loadedIds"], []any{alice.playerID, bob.playerID})
	if _, ok := room["raceError"]; ok {
		t.Fatal("started race carries a race error")
	}
	assertEqual(t, h.errorCode(carol, loadedRequest(roomID, raceID)), "NOT_RACE_PARTICIPANT")

	h.clock.Advance(23 * time.Second)
	h.must(alice, finishRequest(roomID, raceID, 20_000))
	room = h.command(bob, finishRequest(roomID, raceID, 20_100))
	assertEqual(t, room["phase"], "finished")
	assertEqual(t, len(list(raceOf(room)["results"])), 2)
	assertEqual(t, rewardIDs(raceOf(room)), map[string]bool{alice.playerID: true, bob.playerID: true})
	h.must(alice, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	room = h.command(bob, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "open")
}

// A racer that reported loaded and then failed is no longer loaded: it is
// left out of the results.
func TestLoadedRacerReportingFailureDropsOut(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	roomID, raceID := h.startLoading([]*Client{alice, bob, carol}, "ordinary", 3)
	h.must(alice, loadedRequest(roomID, raceID))
	room := h.command(alice, loadFailedRequest(roomID, raceID))
	assertEqual(t, room["phase"], "loading")
	h.must(bob, loadedRequest(roomID, raceID))
	room = h.command(carol, loadedRequest(roomID, raceID))
	assertEqual(t, room["phase"], "countdown")
	assertEqual(t, raceOf(room)["loadedIds"], []any{bob.playerID, carol.playerID})
}

// Racers who have not loaded by the deadline drop out and the others start;
// the race is cancelled only when nobody loaded.
func TestLoadTimeoutDropsOnlySlowRacers(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	roomID, raceID := h.startLoading([]*Client{alice, bob, carol}, "ordinary", 3)
	h.must(alice, loadedRequest(roomID, raceID))
	h.must(bob, loadedRequest(roomID, raceID))
	h.clock.Advance(30 * time.Second)
	room := object(h.sink(carol).last(t)["room"])
	assertEqual(t, room["phase"], "countdown")
	assertEqual(t, raceOf(room)["loadedIds"], []any{alice.playerID, bob.playerID})
	assertEqual(t, h.errorCode(carol, loadedRequest(roomID, raceID)), "NOT_RACE_PARTICIPANT")
	h.clock.Advance(3 * time.Second)
	assertEqual(t, object(h.sink(carol).last(t)["room"])["phase"], "racing")
}

// Roadblock: a load failure or timeout cancels the start only when the
// runner drops out or five racers can no longer load.
func TestRoadblockLoadFailures(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(6)
	roomID, raceID := h.startLoading(players, "roadblock", 6)
	room := h.command(players[5], loadFailedRequest(roomID, raceID))
	assertEqual(t, room["phase"], "loading")
	for _, p := range players[1:5] {
		h.must(p, loadedRequest(roomID, raceID))
	}
	room = h.command(players[0], loadedRequest(roomID, raceID))
	assertEqual(t, room["phase"], "countdown")

	h = newHarness(t)
	players = h.connectN(5)
	roomID, raceID = h.startLoading(players, "roadblock", 6)
	room = h.command(players[0], loadFailedRequest(roomID, raceID))
	assertEqual(t, room["phase"], "open")
	assertEqual(t, room["raceError"], "LOAD_FAILED")

	h = newHarness(t)
	players = h.connectN(5)
	roomID, raceID = h.startLoading(players, "roadblock", 6)
	for _, p := range players[:4] {
		h.must(p, loadedRequest(roomID, raceID))
	}
	h.clock.Advance(90 * time.Second)
	room = object(h.sink(players[0]).last(t)["room"])
	assertEqual(t, room["phase"], "open")
	assertEqual(t, room["raceError"], "LOAD_TIMEOUT")
}

// The heartbeat lists each player's room, and the stats count the rooms
// whose race is under way.
func TestOnlineRoomsAndRacing(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	h.create([]*Client{carol}, "ordinary", "speedIndiCombine", 2)
	if h.lobby.Racing() != 0 {
		t.Fatal("an open room counts as racing")
	}
	h.startLoading([]*Client{alice, bob}, "ordinary", 2)
	if racing := h.lobby.Racing(); racing != 1 {
		t.Fatalf("racing %d", racing)
	}
	players, rooms := h.lobby.Online()
	if rooms != 2 || len(players) != 3 {
		t.Fatalf("online %v rooms %d", players, rooms)
	}
	for _, player := range players {
		if player.Room != "Special Race" {
			t.Fatalf("player %+v", player)
		}
	}
	h.lobby.Disconnect(carol)
	h.connect("Dave")
	for _, player := range onlinePlayers(h.lobby.Online()) {
		if (player.Name == "Dave") != (player.Room == "") {
			t.Fatalf("player %+v", player)
		}
	}
}

func onlinePlayers(players []contract.OnlinePlayer, _ int) []contract.OnlinePlayer { return players }
