package lobby

import (
	"bytes"
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"
)

// keysOf returns the keys of a JSON object in wire order.
func keysOf(t *testing.T, raw []byte) []string {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(raw))
	if tok, err := dec.Token(); err != nil || tok != json.Delim('{') {
		t.Fatalf("not an object: %s", raw)
	}
	var keys []string
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			t.Fatal(err)
		}
		keys = append(keys, tok.(string))
		var skip json.RawMessage
		if err := dec.Decode(&skip); err != nil {
			t.Fatal(err)
		}
	}
	return keys
}

func rawField(t *testing.T, raw []byte, key string) []byte {
	t.Helper()
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		t.Fatal(err)
	}
	return fields[key]
}

func TestRoomSnapshotShape(t *testing.T) {
	h := newHarness(t)
	alice := h.connect("Alice")
	reply, err := h.replyBytes(alice, `{"type":"create","name":"Shape","capacity":3,"channelName":"speedIndiCombine","mode":"individual","speed":7,"speedVersion":"国服"}`)
	if err != nil {
		t.Fatal(err)
	}
	assertEqual(t, keysOf(t, []byte(reply)), []string{"type", "room"})
	room := rawField(t, []byte(reply), "room")
	// LinkedHashMap order; chat, closedSlots, raceError, kickVote and race
	// are omitted while empty or null.
	assertEqual(t, keysOf(t, room), []string{"roomId", "revision", "name", "mode",
		"capacity", "speedVersion", "channelName", "speed", "gameplay",
		"resourceVersion", "hostId", "phase", "trackId", "locked", "members"})
	members := rawField(t, room, "members")
	var memberList []json.RawMessage
	if err := json.Unmarshal(members, &memberList); err != nil {
		t.Fatal(err)
	}
	// team is present as null in individual mode; initial "" is present;
	// changing is omitted while false.
	assertEqual(t, keysOf(t, memberList[0]), []string{"playerId", "name", "slot",
		"ready", "team", "equipment", "initial"})
	if !bytes.Contains(memberList[0], []byte(`"team":null`)) || !bytes.Contains(memberList[0], []byte(`"initial":""`)) {
		t.Fatalf("member %s", memberList[0])
	}

	// A hello without initial or valid equipment omits both.
	bob := h.newClient()
	hello := helloRequest("Bob", h.guestTicket())
	delete(hello, "initial")
	hello["equipment"] = map[string]any{"itemIds": map[string]any{}}
	h.must(bob, hello)
	roomID := object(decodeObject(t, []byte(reply))["room"])["roomId"].(string)
	joined, err := h.replyBytes(bob, `{"type":"join","roomId":"`+roomID+`"}`)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(rawField(t, rawField(t, []byte(joined), "room"), "members"), &memberList); err != nil {
		t.Fatal(err)
	}
	assertEqual(t, keysOf(t, memberList[1]), []string{"playerId", "name", "slot", "ready", "team"})

	// Optional room fields appear once set.
	closedRoom := h.command(alice, map[string]any{"type": "slot", "roomId": roomID, "slot": 2, "closed": true})
	assertEqual(t, closedRoom["closedSlots"], []int{2})
	h.must(alice, map[string]any{"type": "slot", "roomId": roomID, "slot": 2, "closed": false})
	h.must(alice, map[string]any{"type": "chat", "roomId": roomID, "text": "hi <b>"})
	listed, err := h.replyBytes(alice, `{"type":"list-ordinary","page":0}`)
	if err != nil {
		t.Fatal(err)
	}
	assertEqual(t, keysOf(t, []byte(listed)), []string{"type", "page", "total", "rooms"})
	var rooms []json.RawMessage
	if err := json.Unmarshal(rawField(t, []byte(listed), "rooms"), &rooms); err != nil {
		t.Fatal(err)
	}
	assertEqual(t, keysOf(t, rooms[0]), []string{"roomId", "name", "mode", "capacity",
		"speedVersion", "channelName", "speed", "gameplay", "resourceVersion", "count",
		"locked", "gaming", "trackId"})
	settings := h.must(alice, map[string]any{"type": "get-room-settings", "roomId": roomID})
	assertEqual(t, settings, map[string]any{"type": "room-settings", "roomId": roomID,
		"revision": settings["revision"], "name": "Shape", "password": ""})
	chatRoom := h.command(alice, map[string]any{"type": "changing", "roomId": roomID, "changing": false})
	assertEqual(t, list(chatRoom["chat"]), []any{map[string]any{"sequence": 1,
		"playerId": alice.playerID, "name": "Alice", "text": "hi <b>"}})
	if _, ok := chatRoom["closedSlots"]; ok {
		t.Fatal("reopened slot still listed")
	}
	// An empty gameplay page is an empty list, not null.
	empty, err := h.replyBytes(alice, `{"type":"list-gameplay","page":3,"gameplay":"giant"}`)
	if err != nil || !strings.Contains(empty, `"rooms":[]`) {
		t.Fatalf("empty page %s %v", empty, err)
	}
}

func TestRaceSnapshotShapeAndTeamSettlement(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedTeamCombine", 4))
	roomID := room["roomId"].(string)
	started, err := h.replyBytes(players[0], `{"type":"start","roomId":"`+roomID+`","revision":`+jsonNumber(room["revision"])+`}`)
	if err != nil {
		t.Fatal(err)
	}
	raceRaw := rawField(t, rawField(t, []byte(started), "room"), "race")
	assertEqual(t, keysOf(t, raceRaw), []string{"raceId", "channelName", "gameplay",
		"trackId", "loadingDeadline", "roster", "startSlots", "loadedIds"})
	if !bytes.Contains(raceRaw, []byte(`"loadedIds":[]`)) {
		t.Fatalf("loadedIds not an empty list: %s", raceRaw)
	}
	raceID := object(decodeObject(t, []byte(started))["room"])["race"].(map[string]any)["raceId"]
	assertEqual(t, raceOf(object(decodeObject(t, []byte(started))["room"]))["loadingDeadline"], 1_000_000+30_000)
	for _, p := range players {
		h.must(p, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	h.clock.Advance(3 * time.Second)
	// Team 1 = players 0 and 2, team 2 = players 1 and 3. Player 3 never finishes.
	for i, p := range players[:3] {
		h.must(p, map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID,
			"elapsedMs": 60_000 + i*1_000})
	}
	h.clock.Advance(10 * time.Second)
	finished := object(h.sink(players[0]).last(t)["room"])
	assertEqual(t, finished["phase"], "finished")
	rc := raceOf(finished)
	assertEqual(t, rc["finishWindowMs"], 10_000)
	assertEqual(t, rc["teamScores"], map[string]any{"1": 10 + 6, "2": 8 + 0})
	assertEqual(t, rc["winningTeam"], 1)
	results := list(rc["results"])
	assertEqual(t, results[3], map[string]any{"playerId": players[3].playerID,
		"rank": 4, "elapsedMs": nil, "points": 0})
	assertEqual(t, results[0], map[string]any{"playerId": players[0].playerID,
		"rank": 1, "elapsedMs": 60_000, "points": 10})

	settlements := h.recorder.settlements()
	if len(settlements) != 1 {
		t.Fatalf("settlements %d", len(settlements))
	}
	s := settlements[0]
	if s.NodeID != testNodeID || s.RoomID != roomID || s.RaceID != raceID || s.Mode != "team" ||
		s.Gameplay != "ordinary" || s.TrackID != rc["trackId"] || len(s.Results) != 4 {
		t.Fatalf("settlement %+v", s)
	}
	if s.Results[3].ElapsedMs != nil || s.Results[3].Name != "Player3" || s.Results[0].Points != 10 {
		t.Fatalf("results %+v", s.Results)
	}
	assertEqual(t, keysOf(t, s.Snapshot), []string{"roomId", "mode", "gameplay", "race"})
	raw := rawField(t, s.Snapshot, "race")
	if !bytes.Contains(raw, []byte(`"teamScores":{"1":16,"2":8}`)) ||
		!bytes.Contains(raw, []byte(`"elapsedMs":null`)) {
		t.Fatalf("snapshot race %s", raw)
	}
}

func jsonNumber(value any) string {
	data, _ := json.Marshal(value)
	return string(data)
}

func TestRoomRulesDocument(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(1)
	room := h.create(players, "roadblock", "speedIndiCombine", 5)
	rules := h.recorder.rules[len(h.recorder.rules)-1]
	if rules.NodeID != testNodeID || rules.RoomID != room["roomId"] || rules.UpdatedAt <= 0 {
		t.Fatalf("rules %+v", rules)
	}
	assertEqual(t, keysOf(t, rules.Rules), []string{"name", "channelName", "mode",
		"capacity", "speed", "gameplay", "resourceVersion", "randomTrackCode"})
	if !bytes.Contains(rules.Rules, []byte(`"randomTrackCode":0`)) {
		t.Fatalf("rules %s", rules.Rules)
	}
}

func TestKickVoteSnapshotAndTimeout(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(3)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 3))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "kick", "roomId": roomID,
		"playerId": players[1].playerID})
	vote := object(room["kickVote"])
	assertEqual(t, vote, map[string]any{
		"voteId":      vote["voteId"],
		"targetId":    players[1].playerID,
		"eligibleIds": []string{players[0].playerID, players[2].playerID},
		"yesIds":      []string{players[0].playerID},
		"noIds":       []string{},
		"deadline":    1_000_000 + 20_000,
	})
	revision := room["revision"].(float64)
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "kick-vote", "roomId": roomID,
		"voteId": vote["voteId"], "approve": true}), "VOTE_NOT_FOUND")
	h.clock.Advance(20 * time.Second)
	after := object(h.sink(players[2]).last(t)["room"])
	if _, ok := after["kickVote"]; ok {
		t.Fatal("vote survived its deadline")
	}
	assertEqual(t, after["revision"], revision+1)
	assertEqual(t, len(list(after["members"])), 3)

	// A two-member room kicks at once: the only other voter is the host.
	h2 := newHarness(t)
	pair := h2.connectN(2)
	pairRoom := h2.joinAndReady(pair, h2.create(pair, "ordinary", "speedIndiCombine", 2))
	pairRoom = h2.command(pair[0], map[string]any{"type": "kick", "roomId": pairRoom["roomId"],
		"playerId": pair[1].playerID})
	assertEqual(t, len(list(pairRoom["members"])), 1)
	assertEqual(t, h2.sink(pair[1]).last(t), map[string]any{"type": "left", "roomId": pairRoom["roomId"]})
	if h2.clock.pending() != 0 {
		t.Fatal("immediate kick scheduled a vote timeout")
	}
}

func TestSpecialModesWaitNinetySecondsForLoading(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	room := h.joinAndReady(players, h.create(players, "giant", "speedIndiCombine", 2))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	assertEqual(t, raceOf(room)["loadingDeadline"], 1_000_000+90_000)
	h.clock.Advance(89 * time.Second)
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "changing", "roomId": roomID,
		"changing": true}), "ROOM_NOT_OPEN")
	h.clock.Advance(time.Second)
	latest := object(h.sink(players[1]).last(t)["room"])
	assertEqual(t, latest["phase"], "open")
	assertEqual(t, latest["raceError"], "LOAD_TIMEOUT")
}

func TestStaleLoadingTimerLeavesTheNextRaceAlone(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 2))
	roomID := room["roomId"]
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	firstRace := raceOf(room)["raceId"]
	h.clock.Advance(10 * time.Second)
	h.must(players[0], map[string]any{"type": "load-failed", "roomId": roomID, "raceId": firstRace})
	room = h.command(players[1], map[string]any{"type": "load-failed", "roomId": roomID, "raceId": firstRace})
	assertEqual(t, room["raceError"], "LOAD_FAILED")
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	secondRace := raceOf(room)["raceId"]
	h.must(players[0], map[string]any{"type": "loaded", "roomId": roomID, "raceId": secondRace})
	// The first race's timer fires during the second race and must not touch it.
	h.clock.Advance(20*time.Second + 500*time.Millisecond)
	latest := object(h.sink(players[1]).last(t)["room"])
	assertEqual(t, latest["phase"], "loading")
	// Not in Java (which cancelled the race, LOAD_TIMEOUT): the racer who has
	// not loaded drops out and the other starts.
	h.clock.Advance(10 * time.Second)
	latest = object(h.sink(players[1]).last(t)["room"])
	assertEqual(t, latest["phase"], "countdown")
	assertEqual(t, raceOf(latest)["raceId"], secondRace)
	assertEqual(t, raceOf(latest)["loadedIds"], []any{players[0].playerID})
	if _, ok := latest["raceError"]; ok {
		t.Fatal("started race carries a race error")
	}
	assertEqual(t, h.errorCode(players[1], map[string]any{"type": "loaded", "roomId": roomID,
		"raceId": secondRace}), "NOT_RACE_PARTICIPANT")
}

func TestBroadcastRecipients(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(3)
	room := h.joinAndReady(players, h.create(players, "ordinary", "speedIndiCombine", 3))
	roomID := room["roomId"]
	counts := func() []int {
		var out []int
		for _, p := range players {
			out = append(out, len(h.sink(p).events(t)))
		}
		return out
	}
	before := counts()
	// A mutation is broadcast to everyone but the sender.
	h.must(players[1], map[string]any{"type": "changing", "roomId": roomID, "changing": true})
	after := counts()
	if !slices.Equal([]int{after[0] - before[0], after[1] - before[1], after[2] - before[2]}, []int{1, 0, 1}) {
		t.Fatalf("mutation recipients %v → %v", before, after)
	}
	// Leaving is broadcast to the remaining members (sender already gone).
	before = after
	h.must(players[2], map[string]any{"type": "leave", "roomId": roomID})
	after = counts()
	if !slices.Equal([]int{after[0] - before[0], after[1] - before[1], after[2] - before[2]}, []int{1, 1, 0}) {
		t.Fatalf("leave recipients %v → %v", before, after)
	}
}

// snapshotSink also records which room each pushed snapshot belongs to.
type snapshotSink struct {
	recordingSink
	rooms []string
}

func (s *snapshotSink) Snapshot(roomID string, payload []byte) {
	s.mu.Lock()
	s.rooms = append(s.rooms, roomID)
	s.mu.Unlock()
	s.Text(payload)
}

// Room snapshots pushed to members go through SnapshotSink (so a lagging
// connection can keep only the newest one); replies and peer events do not.
func TestRoomPushesUseTheSnapshotSink(t *testing.T) {
	h := newHarness(t)
	host := h.connect("Host")
	sink := &snapshotSink{}
	guest := NewClient(sink)
	h.must(guest, helloRequest("Guest", h.guestTicket()))
	room := h.create([]*Client{host}, "ordinary", "speedIndiCombine", 2)
	roomID := room["roomId"].(string)
	h.command(guest, map[string]any{"type": "join", "roomId": roomID})
	h.must(host, map[string]any{"type": "chat", "roomId": roomID, "text": "hi"})
	h.must(host, map[string]any{"type": "track", "roomId": roomID, "trackId": "village_R01"})
	if !slices.Equal(sink.rooms, []string{roomID}) {
		t.Fatalf("snapshots %v", sink.rooms)
	}
	events := sink.events(t)
	if len(events) != 2 || events[0]["type"] != "chat" || events[1]["type"] != "room" {
		t.Fatalf("events %v", events)
	}
}
