package lobby

import (
	"testing"
	"time"
)

// Ported from LobbyServiceTest.java: same scenarios and assertions.

func TestTransferCannotMakeKickTargetTheHost(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	created := h.must(alice, map[string]any{
		"type": "create", "name": "Test Room", "capacity": 3,
		"password": "", "channelName": "speedIndiCombine",
		"gameplay": "ordinary", "mode": "individual",
		"speed": 7, "speedVersion": "国服"})
	room := object(created["room"])
	roomID := room["roomId"]
	h.must(bob, map[string]any{"type": "join", "roomId": roomID})
	joined := h.must(carol, map[string]any{"type": "join", "roomId": roomID})
	room = object(joined["room"])

	kicked := h.must(alice, map[string]any{
		"type": "kick", "roomId": roomID, "revision": room["revision"],
		"playerId": bob.playerID})
	room = object(kicked["room"])
	vote := object(room["kickVote"])
	assertEqual(t, room["hostId"], alice.playerID)

	revision := room["revision"]
	code := h.errorCode(alice, map[string]any{
		"type": "transfer-host", "roomId": roomID,
		"revision": revision, "playerId": bob.playerID})
	assertEqual(t, code, "VOTE_IN_PROGRESS")

	approved := h.must(carol, map[string]any{
		"type": "kick-vote", "roomId": roomID, "revision": revision,
		"voteId": vote["voteId"], "approve": true})
	room = object(approved["room"])
	hostID := room["hostId"]
	assertEqual(t, hostID, alice.playerID)
	hostIsMember, bobIsMember := false, false
	for _, m := range list(room["members"]) {
		hostIsMember = hostIsMember || object(m)["playerId"] == hostID
		bobIsMember = bobIsMember || object(m)["playerId"] == bob.playerID
	}
	if !hostIsMember || bobIsMember {
		t.Fatalf("host member %v, kicked member still present %v", hostIsMember, bobIsMember)
	}
}

func TestLoadFailureIsLimitedToLoadingAndRaceLeaveKeepsRace(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.connect("Alice"), h.connect("Bob")
	created := h.must(alice, map[string]any{
		"type": "create", "name": "Race Room", "capacity": 2,
		"password": "", "channelName": "speedIndiCombine",
		"gameplay": "ordinary", "mode": "individual",
		"speed": 7, "speedVersion": "国服"})
	room := object(created["room"])
	roomID := room["roomId"].(string)
	room = h.command(bob, map[string]any{"type": "join", "roomId": roomID})
	room = h.command(alice, map[string]any{
		"type": "track", "roomId": roomID, "revision": room["revision"],
		"trackId": "desert_I01"})
	assertEqual(t, h.recorder.savedRules(t, roomID)["trackId"], "desert_I01")
	room = h.command(alice, map[string]any{
		"type": "random-track", "roomId": roomID,
		"revision": room["revision"], "randomTrackCode": 3})
	assertEqual(t, h.recorder.savedRules(t, roomID)["randomTrackCode"], 3)
	if _, ok := h.recorder.savedRules(t, roomID)["trackId"]; ok {
		t.Fatal("random track rules still carry trackId")
	}
	room = h.command(alice, map[string]any{
		"type": "track", "roomId": roomID, "revision": room["revision"],
		"trackId": "forest_I01"})
	assertEqual(t, h.recorder.savedRules(t, roomID)["trackId"], "forest_I01")
	room = h.command(bob, map[string]any{
		"type": "ready", "roomId": roomID,
		"revision": room["revision"], "ready": true})
	room = h.command(alice, map[string]any{
		"type": "start", "roomId": roomID, "revision": room["revision"]})
	assertEqual(t, room["phase"], "loading")
	firstRace := raceOf(room)
	assertEqual(t, firstRace["startSlots"], map[string]any{alice.playerID: 0, bob.playerID: 1})
	raceID := firstRace["raceId"]
	// Not in Java: a load failure drops only that racer (even one that had
	// loaded); the race is cancelled once no racer is left to start it.
	h.must(alice, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	room = h.command(alice, map[string]any{"type": "load-failed", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "loading")
	assertEqual(t, raceOf(room)["loadedIds"], []any{})
	room = h.command(bob, map[string]any{"type": "load-failed", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "open")
	assertEqual(t, room["raceError"], "LOAD_FAILED")
	room = h.command(alice, map[string]any{
		"type": "start", "roomId": roomID, "revision": room["revision"]})
	secondRaceID := raceOf(room)["raceId"]
	h.must(alice, map[string]any{"type": "loaded", "roomId": roomID, "raceId": secondRaceID})
	countdown := h.command(bob, map[string]any{"type": "loaded", "roomId": roomID, "raceId": secondRaceID})
	assertEqual(t, countdown["phase"], "countdown")
	tooLate := h.errorCode(bob, map[string]any{
		"type": "load-failed", "roomId": roomID, "raceId": secondRaceID})
	assertEqual(t, tooLate, "RACE_NOT_LOADING")

	// Not in Java (which cancelled the race, MEMBER_LEFT): the race goes on
	// for the racer left in the room.
	left := h.must(bob, map[string]any{"type": "leave", "roomId": roomID})
	assertEqual(t, left["type"], "left")
	kept := object(h.sink(alice).last(t)["room"])
	assertEqual(t, kept["phase"], "countdown")
	assertEqual(t, raceOf(kept)["raceId"], secondRaceID)
	if _, ok := kept["raceError"]; ok {
		t.Fatal("race kept with a race error")
	}
	assertEqual(t, len(list(kept["members"])), 1)
}

func TestDepartedReturnDoesNotEndPodiumForRemainingPlayers(t *testing.T) {
	h := newHarness(t)
	alice, bob, carol := h.connect("Alice"), h.connect("Bob"), h.connect("Carol")
	room := h.command(alice, map[string]any{
		"type": "create", "name": "Three Racers", "capacity": 3,
		"password": "", "channelName": "speedIndiCombine",
		"gameplay": "ordinary", "mode": "individual",
		"speed": 7, "speedVersion": "国服"})
	roomID := room["roomId"]
	room = h.command(bob, map[string]any{"type": "join", "roomId": roomID})
	room = h.command(carol, map[string]any{"type": "join", "roomId": roomID})
	room = h.command(bob, map[string]any{"type": "ready", "roomId": roomID,
		"revision": room["revision"], "ready": true})
	room = h.command(carol, map[string]any{"type": "ready", "roomId": roomID,
		"revision": room["revision"], "ready": true})
	room = h.command(alice, map[string]any{"type": "start", "roomId": roomID,
		"revision": room["revision"]})
	raceID := raceOf(room)["raceId"]
	players := []*Client{alice, bob, carol}
	for _, player := range players {
		h.must(player, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3_200 * time.Millisecond)
	for index, player := range players {
		room = h.command(player, map[string]any{"type": "finish", "roomId": roomID,
			"raceId": raceID, "elapsedMs": 10_000 + index*1_000})
	}
	assertEqual(t, room["phase"], "finished")
	h.must(alice, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	h.must(alice, map[string]any{"type": "leave", "roomId": roomID})
	room = h.command(bob, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "finished")
	room = h.command(carol, map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	assertEqual(t, room["phase"], "open")
}

func TestRoomGearFollowsJoinAndEndsTheChangingState(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.connect("Alice"), h.connect("Bob")
	room := h.command(alice, map[string]any{
		"type": "create", "name": "Test Room", "capacity": 2,
		"password": "", "channelName": "speedIndiCombine",
		"gameplay": "ordinary", "mode": "individual",
		"speed": 7, "speedVersion": "国服"})
	roomID := room["roomId"]
	// Gear picked outside the room after hello replaces the connection's copy.
	newKart := equipment()
	newKart["itemIds"].(map[string]any)["3"] = 1637
	room = h.command(bob, map[string]any{"type": "join", "roomId": roomID, "equipment": newKart})
	bobGear := object(memberOf(t, room, bob.playerID)["equipment"])
	assertEqual(t, object(bobGear["itemIds"])["3"], 1637)
	room = h.command(bob, map[string]any{"type": "changing", "roomId": roomID, "changing": true})
	assertEqual(t, memberOf(t, room, bob.playerID)["changing"], true)

	room = h.command(bob, map[string]any{"type": "equipment", "roomId": roomID, "equipment": equipment()})
	if _, ok := memberOf(t, room, bob.playerID)["changing"]; ok {
		t.Fatal("equipment confirmation left the member changing")
	}
}
