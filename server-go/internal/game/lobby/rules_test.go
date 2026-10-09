package lobby

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func createRequest(overrides map[string]any) map[string]any {
	request := map[string]any{"type": "create", "name": "Rules", "capacity": 4,
		"password": "", "channelName": "speedIndiCombine", "gameplay": "ordinary",
		"mode": "individual", "speed": 7, "speedVersion": "国服"}
	for key, value := range overrides {
		if value == nil {
			delete(request, key)
		} else {
			request[key] = value
		}
	}
	return request
}

func TestCreateValidationOrder(t *testing.T) {
	h := newHarness(t)
	alice := h.connect("Alice")
	for _, tc := range []struct {
		overrides map[string]any
		code      string
	}{
		{map[string]any{"channelName": "speedFoo"}, "INVALID_CHANNEL"},
		{map[string]any{"channelName": nil}, "INVALID_CHANNELNAME"},
		// mode mismatch wins before speed is even validated
		{map[string]any{"mode": "team", "speed": "x"}, "INVALID_CHANNEL"},
		{map[string]any{"mode": 1}, "INVALID_MODE"},
		{map[string]any{"speed": 4}, "INVALID_CHANNEL"},
		{map[string]any{"speed": 8}, "INVALID_SPEED"},
		{map[string]any{"speedVersion": "台服"}, "INVALID_CHANNEL"},
		{map[string]any{"gameplay": "unknown"}, "INVALID_GAMEPLAY"},
		{map[string]any{"name": ""}, "INVALID_NAME"},
		{map[string]any{"capacity": 9}, "INVALID_CAPACITY"},
		{map[string]any{"channelName": "speedTeamCombine", "mode": "team", "capacity": 3}, "INVALID_CAPACITY"},
		{map[string]any{"gameplay": "roadblock", "capacity": 4}, "NOT_ENOUGH_PLAYERS"},
		{map[string]any{"gameplay": "giant", "channelName": "speedIndiInfinit", "speed": 4}, "INVALID_CHANNEL"},
		{map[string]any{"gameplay": "grip", "channelName": "speedIndiInfinit", "speed": 4}, "INVALID_CHANNEL"},
		{map[string]any{"password": "1234567890123"}, "INVALID_PASSWORD"},
	} {
		if code := h.errorCode(alice, createRequest(tc.overrides)); code != tc.code {
			t.Errorf("%v: got %s, want %s", tc.overrides, code, tc.code)
		}
	}
	// Special gameplays need the p3553 resources.
	old := h.newClient()
	hello := helloRequest("Old", h.guestTicket())
	hello["resourceVersion"] = "p3528"
	h.must(old, hello)
	if code := h.errorCode(old, createRequest(map[string]any{"gameplay": "grip"})); code != "RESOURCE_VERSION_UNSUPPORTED" {
		t.Fatalf("old resources: %s", code)
	}
	room := h.command(old, createRequest(nil))
	if code := h.errorCode(old, map[string]any{"type": "random-track", "roomId": room["roomId"],
		"randomTrackCode": 3}); code != "RESOURCE_VERSION_UNSUPPORTED" {
		t.Fatalf("random track on p3528: %s", code)
	}
	if code := h.errorCode(alice, map[string]any{"type": "join", "roomId": room["roomId"]}); code != "RESOURCE_VERSION_MISMATCH" {
		t.Fatalf("join across resource versions: %s", code)
	}
	if code := h.errorCode(old, createRequest(nil)); code != "ALREADY_IN_ROOM" {
		t.Fatalf("second create: %s", code)
	}
}

func TestJoinRulesAndRoomLifecycle(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	host := players[0]
	room := h.command(host, createRequest(map[string]any{"capacity": 2, "password": "secret"}))
	roomID := room["roomId"]
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "join", "roomId": "missing"}), "ROOM_NOT_FOUND")
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "join", "roomId": roomID}), "INVALID_PASSWORD")
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "join", "roomId": roomID,
		"password": "wrong"}), "INVALID_PASSWORD")
	h.command(players[1], map[string]any{"type": "join", "roomId": roomID, "password": "secret"})
	assertEqual(t, h.errorCode(players[2], map[string]any{"type": "join", "roomId": roomID,
		"password": "secret"}), "ROOM_FULL")
	assertEqual(t, h.errorCode(players[2], map[string]any{"type": "leave", "roomId": roomID}), "NOT_ROOM_MEMBER")
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "get-room-settings", "roomId": roomID}), "HOST_REQUIRED")
	listed := h.must(players[3], map[string]any{"type": "list-ordinary", "page": 0})
	summary := object(list(listed["rooms"])[0])
	assertEqual(t, summary["locked"], true)
	assertEqual(t, summary["count"], 2)

	// Host migration: the first remaining member becomes host.
	h.must(host, map[string]any{"type": "leave", "roomId": roomID})
	room = object(h.sink(players[1]).last(t)["room"])
	assertEqual(t, room["hostId"], players[1].playerID)
	// The last member leaving deletes the room.
	h.must(players[1], map[string]any{"type": "leave", "roomId": roomID})
	listed = h.must(players[3], map[string]any{"type": "list-ordinary", "page": 0})
	assertEqual(t, listed["total"], 0)
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "join", "roomId": roomID}), "ROOM_NOT_FOUND")
}

func TestTeamSlotsAndStartChecks(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	room := h.command(players[0], createRequest(map[string]any{"channelName": "speedTeamCombine",
		"mode": "team", "capacity": 4}))
	roomID := room["roomId"]
	// Joiners balance the teams: slot 4 (team 2), then slot 1 (team 1).
	room = h.command(players[1], map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, memberOf(t, room, players[1].playerID)["team"], 2)
	assertEqual(t, memberOf(t, room, players[1].playerID)["slot"], 4)
	room = h.command(players[2], map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, memberOf(t, room, players[2].playerID)["slot"], 1)
	// Team 1 has two slots in a four-player team room and both are taken.
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "team", "roomId": roomID, "team": 1}), "TEAM_FULL")
	room = h.command(players[2], map[string]any{"type": "team", "roomId": roomID, "team": 2})
	assertEqual(t, memberOf(t, room, players[2].playerID)["slot"], 5)
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "slot", "roomId": roomID,
		"slot": 2, "closed": true}), "INVALID_SLOT")
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "slot", "roomId": roomID,
		"slot": 5, "closed": true}), "SLOT_OCCUPIED")

	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "start", "roomId": roomID,
		"revision": 1}), "HOST_REQUIRED")
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "start", "roomId": roomID,
		"revision": 1}), "STALE_REVISION")
	assertEqual(t, h.startError(players[0], roomID), "PLAYERS_NOT_READY")
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "ready", "roomId": roomID,
		"ready": true}), "HOST_CANNOT_READY")
	h.command(players[1], map[string]any{"type": "ready", "roomId": roomID, "ready": true})
	room = h.command(players[2], map[string]any{"type": "ready", "roomId": roomID, "ready": true})
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	assertEqual(t, room["phase"], "loading")
	// A late joiner may enter the loading room and lands on the smaller team.
	room = h.command(players[3], map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, memberOf(t, room, players[3].playerID)["slot"], 1)
}

// startError tries to start with the room's current revision.
func (h *harness) startError(host *Client, roomID any) string {
	h.t.Helper()
	latest := h.command(host, map[string]any{"type": "changing", "roomId": roomID, "changing": false})
	return h.errorCode(host, map[string]any{"type": "start", "roomId": roomID, "revision": latest["revision"]})
}

func TestStartRequirements(t *testing.T) {
	h := newHarness(t)
	host := h.connect("Host")
	room := h.command(host, createRequest(map[string]any{"channelName": "speedTeamCombine",
		"mode": "team", "capacity": 4}))
	roomID := room["roomId"]
	assertEqual(t, h.startError(host, roomID), "NOT_ENOUGH_PLAYERS")
	mate := h.connect("Mate")
	h.command(mate, map[string]any{"type": "join", "roomId": roomID})
	room = h.command(mate, map[string]any{"type": "team", "roomId": roomID, "team": 1})
	assertEqual(t, memberOf(t, room, mate.playerID)["slot"], 1)
	h.command(mate, map[string]any{"type": "ready", "roomId": roomID, "ready": true})
	assertEqual(t, h.startError(host, roomID), "TEAM_REQUIRED")
	bare := h.newClient()
	hello := helloRequest("Bare", h.guestTicket())
	delete(hello, "equipment")
	h.must(bare, hello)
	h.command(bare, map[string]any{"type": "join", "roomId": roomID})
	h.command(bare, map[string]any{"type": "ready", "roomId": roomID, "ready": true})
	assertEqual(t, h.startError(host, roomID), "EQUIPMENT_REQUIRED")
}

func TestEquipmentValidation(t *testing.T) {
	valid := func(mutate func(value map[string]any)) bool {
		value := equipment()
		mutate(value)
		raw, _ := json.Marshal(value)
		return validEquipment(raw, true)
	}
	ids := func(value map[string]any) map[string]any { return value["itemIds"].(map[string]any) }
	for name, tc := range map[string]struct {
		mutate func(map[string]any)
		want   bool
	}{
		"baseline system kart": {func(v map[string]any) { ids(v)["3"] = 0; v["systemKart"] = "kart_A1" }, true},
		"system kart variant":  {func(v map[string]any) { ids(v)["3"] = 0; v["systemKart"] = "k"; v["systemKartVariant"] = "v_2" }, true},
		"real kart":            {func(map[string]any) {}, true},
		"missing system kart":  {func(v map[string]any) { ids(v)["3"] = 0 }, false},
		"null variant":         {func(v map[string]any) { ids(v)["3"] = 0; v["systemKart"] = "k"; v["systemKartVariant"] = nil }, false},
		"bad system kart":      {func(v map[string]any) { ids(v)["3"] = 0; v["systemKart"] = "1kart" }, false},
		"kart with systemKart": {func(v map[string]any) { v["systemKart"] = "k" }, false},
		"kart with null field": {func(v map[string]any) { v["systemKartVariant"] = nil }, false},
		"no character":         {func(v map[string]any) { ids(v)["1"] = 0 }, false},
		"item too big":         {func(v map[string]any) { ids(v)["2"] = 65536 }, false},
		"item float":           {func(v map[string]any) { ids(v)["2"] = 1.5 }, false},
		"extra slot":           {func(v map[string]any) { ids(v)["5"] = 1 }, false},
		"missing slot":         {func(v map[string]any) { delete(ids(v), "78") }, false},
		"valueAt3E too big":    {func(v map[string]any) { v["valueAt3E"] = 256 }, false},
		"kartSerial missing":   {func(v map[string]any) { delete(v, "kartSerial") }, false},
		"exceedType negative":  {func(v map[string]any) { v["exceedType"] = -1 }, false},
	} {
		if got := valid(tc.mutate); got != tc.want {
			t.Errorf("%s: got %v, want %v", name, got, tc.want)
		}
	}
	if validEquipment(json.RawMessage(`null`), true) || validEquipment(nil, false) ||
		validEquipment(json.RawMessage(`[]`), true) || validEquipment(json.RawMessage(`{"itemIds":[]}`), true) {
		t.Fatal("non-object equipment accepted")
	}
	// Integral literals only: 1.0 is a double in Jackson.
	raw, _ := json.Marshal(equipment())
	floatKart := []byte(string(raw[:len(raw)-1]) + `,"kartSerial":1.0}`)
	if validEquipment(floatKart, true) {
		t.Fatal("1.0 accepted as an integer")
	}
}

func TestRaceChatAndAwardMotionRules(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 2))
	roomID := room["roomId"]
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "race-chat", "roomId": roomID,
		"text": "hi"}), "RACE_NOT_FOUND")
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"]
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "race-chat", "roomId": roomID,
		"raceId": "other", "text": "hi"}), "RACE_NOT_FOUND")
	event := h.must(players[0], map[string]any{"type": "race-chat", "roomId": roomID,
		"raceId": raceID, "text": "go"})
	assertEqual(t, event, map[string]any{"type": "race-chat", "roomId": roomID, "raceId": raceID,
		"message": map[string]any{"sequence": 1, "playerId": players[0].playerID, "name": "Player0", "text": "go"}})
	assertEqual(t, h.sink(players[1]).last(t), event)
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "award-motion", "roomId": roomID,
		"raceId": raceID, "motion": 3}), "RACE_NOT_RUNNING")
	for _, p := range players {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3 * time.Second)
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "award-motion", "roomId": roomID,
		"raceId": raceID, "motion": 6}), "INVALID_MOTION")
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "team-charge", "roomId": roomID,
		"raceId": raceID, "sequence": 1, "charge": 1}), "TEAM_GAUGE_UNAVAILABLE")
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "giant-state", "roomId": roomID,
		"raceId": raceID, "sequence": 1, "main": 1, "extra": 0, "status": 0}), "GIANT_STATE_UNAVAILABLE")
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "return-room", "roomId": roomID,
		"raceId": raceID}), "RACE_NOT_FINISHED")
	h.must(players[0], map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 9})
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "finish", "roomId": roomID,
		"raceId": raceID, "elapsedMs": 9}), "ALREADY_FINISHED")
	finished := h.command(players[1], map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 9})
	// Ties keep the loaded order (stable sort) and both score.
	results := list(raceOf(finished)["results"])
	assertEqual(t, object(results[0])["playerId"], players[0].playerID)
	assertEqual(t, object(results[1])["points"], 8)
	// Award motions are still relayed on the podium.
	award := h.must(players[1], map[string]any{"type": "award-motion", "roomId": roomID, "raceId": raceID, "motion": 4})
	assertEqual(t, h.sink(players[0]).last(t), award)
}

func TestKickVoteRejectedByMajority(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 4))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "kick", "roomId": roomID, "playerId": players[3].playerID})
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "kick", "roomId": roomID,
		"playerId": players[0].playerID}), "INVALID_TARGET")
	voteID := object(room["kickVote"])["voteId"]
	// Three eligible voters, majority two: one yes (host) and two no ends it.
	room = h.command(players[1], map[string]any{"type": "kick-vote", "roomId": roomID, "voteId": voteID, "approve": false})
	if _, ok := room["kickVote"]; !ok {
		t.Fatal("vote ended early")
	}
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "kick-vote", "roomId": roomID,
		"voteId": voteID, "approve": false}), "VOTE_NOT_FOUND")
	room = h.command(players[2], map[string]any{"type": "kick-vote", "roomId": roomID, "voteId": voteID, "approve": false})
	if _, ok := room["kickVote"]; ok {
		t.Fatal("rejected vote still running")
	}
	assertEqual(t, len(list(room["members"])), 4)
	// Transfer host works once no vote runs.
	room = h.command(players[0], map[string]any{"type": "transfer-host", "roomId": roomID, "playerId": players[2].playerID})
	assertEqual(t, room["hostId"], players[2].playerID)
}

// Deviation from Java: equipment repeats in every room snapshot sent to
// every member, so an object padded past maxEquipmentBytes is refused (the
// "equipment" command) or ignored (hello, create, join) like invalid gear.
func TestOversizedEquipmentIsRefused(t *testing.T) {
	padded := equipment()
	padded["junk"] = strings.Repeat("x", maxEquipmentBytes)
	modest := equipment()
	modest["note"] = strings.Repeat("x", 1000) // unknown keys are still kept
	raw, _ := json.Marshal(modest)
	if !validEquipment(raw, true) {
		t.Fatal("equipment with a small unknown key refused")
	}
	// Insignificant whitespace does not count against the cap.
	spaced := []byte(strings.Replace(string(raw), ",", ","+strings.Repeat(" ", maxEquipmentBytes), 1))
	if !validEquipment(spaced, true) {
		t.Fatal("whitespace counted against the cap")
	}

	h := newHarness(t)
	hello := helloRequest("Padded", h.guestTicket())
	hello["equipment"] = padded
	host := h.newClient()
	h.must(host, hello)
	if host.equipment != nil {
		t.Fatalf("hello kept %d bytes of equipment", len(host.equipment))
	}
	room := h.command(host, map[string]any{"type": "create", "name": "Room", "capacity": 2,
		"channelName": "speedIndiCombine", "mode": "individual", "speed": 7, "speedVersion": "国服",
		"equipment": padded})
	if memberOf(t, room, host.playerID)["equipment"] != nil {
		t.Fatal("create kept oversized equipment")
	}
	assertEqual(t, h.errorCode(host, map[string]any{"type": "equipment", "roomId": room["roomId"],
		"equipment": padded}), "INVALID_EQUIPMENT")
	room = h.command(host, map[string]any{"type": "equipment", "roomId": room["roomId"], "equipment": modest})
	assertEqual(t, object(memberOf(t, room, host.playerID)["equipment"])["note"], modest["note"])
}
