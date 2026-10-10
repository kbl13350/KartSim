package lobby

import (
	"encoding/binary"
	"encoding/json"
	"math/rand/v2"
	"slices"
	"strings"
	"testing"
	"time"

	"kartsim/internal/game/itemmode"
)

// scriptedRandom returns its values in turn (modulo n), then 0.
type scriptedRandom struct{ values []int }

func (s *scriptedRandom) IntN(n int) int {
	if len(s.values) == 0 {
		return 0
	}
	value := s.values[0]
	s.values = s.values[1:]
	return value % n
}

func itemData(t *testing.T) *itemmode.Data {
	t.Helper()
	data, err := itemmode.Default()
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// pickFor is the draw value that lands on idx in a group of a table.
func pickFor(t *testing.T, kind string, group itemmode.Group, idx int) int {
	t.Helper()
	pick := 0
	for _, entry := range itemData(t).Table(kind).Entries {
		if entry.Idx == idx {
			if entry.Weight(group) == 0 {
				t.Fatalf("%d has no weight in %s", idx, group)
			}
			return pick
		}
		pick += entry.Weight(group)
	}
	t.Fatalf("%d not in %s", idx, kind)
	return 0
}

// itemRace is a running item race with a scripted random source.
type itemRace struct {
	t              *testing.T
	h              *harness
	roomID, raceID string
	kind           string
	random         *scriptedRandom
	sequences      map[*Client]int
}

// startItemRace starts an item race of players (players[0] hosts) with a
// scripted random source and lets it run 10 s, so motion frames can report
// up to 1500 m.
func (h *harness) startItemRace(players []*Client, channel string) *itemRace {
	h.t.Helper()
	random := &scriptedRandom{}
	ir := h.startItemRaceWith(players, channel, random)
	ir.random = random
	return ir
}

func (h *harness) startItemRaceWith(players []*Client, channel string, random itemmode.Random) *itemRace {
	h.t.Helper()
	h.lobby.itemRandom = func() itemmode.Random { return random }
	roomID, raceID := h.startRace(players, "item", channel, len(players))
	h.clock.Advance(10 * time.Second)
	kind := itemmode.TableIndividual
	if channel == "itemTeamCombine" {
		kind = itemmode.TableTeam
	}
	return &itemRace{t: h.t, h: h, roomID: roomID, raceID: raceID, kind: kind, sequences: map[*Client]int{}}
}

// request is an item request of c with c's next sequence.
func (ir *itemRace) request(c *Client, action string, fields map[string]any) map[string]any {
	ir.sequences[c]++
	request := map[string]any{"type": "item", "roomId": ir.roomID, "raceId": ir.raceID,
		"sequence": ir.sequences[c], "action": action}
	for key, value := range fields {
		request[key] = value
	}
	return request
}

// rawReply sends a request and returns the reply as JSON text.
func (ir *itemRace) rawReply(c *Client, action string, fields map[string]any) string {
	ir.t.Helper()
	payload, err := json.Marshal(ir.request(c, action, fields))
	if err != nil {
		ir.t.Fatal(err)
	}
	reply, err := ir.h.replyBytes(c, string(payload))
	if err != nil {
		ir.t.Fatal(err)
	}
	return reply
}

func (ir *itemRace) send(c *Client, action string, fields map[string]any) map[string]any {
	ir.t.Helper()
	return ir.h.must(c, ir.request(c, action, fields))
}

// reject sends a request the server rejects after accepting its sequence.
func (ir *itemRace) reject(c *Client, action string, fields map[string]any) string {
	ir.t.Helper()
	return ir.h.errorCode(c, ir.request(c, action, fields))
}

// at reports c's route distance (and lap) in a motion frame.
func (ir *itemRace) at(c *Client, distance float64, lap uint32) {
	frame := progressFrame(ir.roomID, ir.raceID, c.playerID, 10, distance)
	binary.LittleEndian.PutUint32(frame[lapOffset:], lap)
	ir.h.lobby.RelayMotion(c, frame)
}

// grant eats cube cubeID and scripts the draw to land on idx in group.
func (ir *itemRace) grant(c *Client, cubeID int, group itemmode.Group, idx int) map[string]any {
	ir.t.Helper()
	ir.random.values = append(ir.random.values, pickFor(ir.t, ir.kind, group, idx))
	reply := ir.send(c, "cube", map[string]any{"cubeId": cubeID, "capacity": 2})
	if reply["itemId"] != float64(idx) {
		ir.t.Fatalf("cube granted %v, want %d", reply["itemId"], idx)
	}
	return reply
}

// isStartPush reports whether an item event is the race start's slots push
// (it has no sequence: no request asked for it).
func isStartPush(event map[string]any) bool {
	_, replied := event["sequence"]
	return event["action"] == "slots" && !replied && (event["reason"] == nil || event["reason"] == "start")
}

// itemEvents are the item events c received, but the race start's slots
// push (startPushes).
func itemEvents(t *testing.T, h *harness, c *Client) []map[string]any {
	t.Helper()
	var events []map[string]any
	for _, event := range h.sink(c).events(t) {
		if event["type"] == "item" && !isStartPush(event) {
			events = append(events, event)
		}
	}
	return events
}

// startPushes are the race start's slots pushes c received.
func startPushes(t *testing.T, h *harness, c *Client) []map[string]any {
	t.Helper()
	var events []map[string]any
	for _, event := range h.sink(c).events(t) {
		if event["type"] == "item" && isStartPush(event) {
			events = append(events, event)
		}
	}
	return events
}

// without returns event minus the reply-only keys.
func without(event map[string]any, keys ...string) map[string]any {
	out := map[string]any{}
	for key, value := range event {
		if !slices.Contains(keys, key) {
			out[key] = value
		}
	}
	return out
}

func TestItemRoomCreation(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.connect("Alice"), h.connect("Bob")
	room := h.command(alice, createRequest(map[string]any{"channelName": "itemIndiCombine", "gameplay": "item"}))
	assertEqual(t, []any{room["mode"], room["speed"], room["channelName"], room["gameplay"], room["trackId"]},
		[]any{"individual", 7, "itemIndiCombine", "item", itemData(t).DefaultTrack})
	for _, tc := range []struct {
		overrides map[string]any
		code      string
	}{
		{map[string]any{"gameplay": "item"}, "INVALID_CHANNEL"},                                // speed channel
		{map[string]any{"channelName": "itemIndiCombine"}, "INVALID_CHANNEL"},                  // ordinary gameplay
		{map[string]any{"channelName": "itemIndiCombine", "gameplay": nil}, "INVALID_CHANNEL"}, // defaults to ordinary
		{map[string]any{"channelName": "itemIndiCombine", "gameplay": "roadblock", "capacity": 5}, "INVALID_CHANNEL"},
		{map[string]any{"channelName": "itemIndiCombine", "gameplay": "grip"}, "INVALID_CHANNEL"},
		{map[string]any{"channelName": "itemTeamCombine", "gameplay": "item"}, "INVALID_CHANNEL"}, // mode individual
		{map[string]any{"channelName": "itemTeamCombine", "gameplay": "item", "mode": "team", "capacity": 3}, "INVALID_CAPACITY"},
		{map[string]any{"channelName": "itemIndiCombine", "gameplay": "item", "speed": 4}, "INVALID_CHANNEL"},
		{map[string]any{"channelName": "itemIndiInfinit", "gameplay": "item"}, "INVALID_CHANNEL"},
	} {
		if code := h.errorCode(bob, createRequest(tc.overrides)); code != tc.code {
			t.Errorf("%v: got %s, want %s", tc.overrides, code, tc.code)
		}
	}
	team := h.command(h.connect("Carol"), createRequest(map[string]any{"channelName": "itemTeamCombine",
		"gameplay": "item", "mode": "team"}))
	assertEqual(t, []any{team["mode"], team["speed"]}, []any{"team", 7})

	// Item rooms need the p3553 resources like every special gameplay.
	old := h.newClient()
	hello := helloRequest("Old", h.guestTicket())
	hello["resourceVersion"] = "p3528"
	h.must(old, hello)
	assertEqual(t, h.errorCode(old, createRequest(map[string]any{"channelName": "itemIndiCombine",
		"gameplay": "item"})), "RESOURCE_VERSION_UNSUPPORTED")

	// The item lobby lists item rooms; the ordinary list does not.
	listed := h.must(alice, map[string]any{"type": "list-gameplay", "page": 0, "gameplay": "item"})
	assertEqual(t, listed["total"], 2)
	ordinary := h.must(alice, map[string]any{"type": "list-ordinary", "page": 0})
	assertEqual(t, ordinary["total"], 0)

	// A node without item data refuses item rooms.
	h.lobby.items = nil
	assertEqual(t, h.errorCode(h.connect("Dave"), createRequest(map[string]any{"channelName": "itemIndiCombine",
		"gameplay": "item"})), "INVALID_GAMEPLAY")
}

func TestItemRoomTracks(t *testing.T) {
	h := newHarness(t)
	data := itemData(t)
	players := h.connectN(2)
	room := h.create(players, "item", "itemIndiCombine", 2)
	roomID := room["roomId"]
	host := players[0]
	track := func(id string) string {
		_, err := h.raw(host, map[string]any{"type": "track", "roomId": roomID, "trackId": id})
		if err == nil {
			return ""
		}
		return codeOf(t, err)
	}
	for _, id := range []string{"village_R01", "tomb_I05", "ice_I01", "forest_I03_rvs", "desert_I03_rvs", "nowhere_I01"} {
		assertEqual(t, track(id), "TRACK_NOT_ITEM")
	}
	for _, id := range []string{"desert_I03", "village_C01", "forest_I01_rvs", "nemo_C02"} {
		assertEqual(t, track(id), "")
	}
	assertEqual(t, h.recorder.savedRules(t, roomID.(string))["trackId"], "nemo_C02")
	random := func(code int) string {
		_, err := h.raw(host, map[string]any{"type": "random-track", "roomId": roomID, "randomTrackCode": code})
		if err == nil {
			return ""
		}
		return codeOf(t, err)
	}
	assertEqual(t, random(40), "INVALID_TRACK") // speed only
	for _, code := range itemmode.RandomCodes {
		assertEqual(t, random(code), "")
	}
	// The race draws from the code's item pool.
	h.lobby.mu.Lock()
	r := h.lobby.rooms[roomID.(string)]
	for _, code := range itemmode.RandomCodes {
		r.randomTrackCode = &code
		for range 20 {
			if id := h.lobby.chooseTrack(r); !slices.Contains(data.Pool(code), id) {
				t.Errorf("code %d chose %s", code, id)
			}
		}
	}
	h.lobby.mu.Unlock()
	random(30)
	room = h.joinAndReady(players, h.command(host, map[string]any{"type": "changing", "roomId": roomID, "changing": false}))
	room = h.command(host, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	if id := raceOf(room)["trackId"].(string); !slices.Contains(data.Pool(30), id) {
		t.Fatalf("reverse random chose %s", id)
	}

	// Speed rooms keep their rules.
	speed := []*Client{h.connect("Speedy")}
	speedRoom := h.create(speed, "ordinary", "speedIndiCombine", 2)
	h.must(speed[0], map[string]any{"type": "track", "roomId": speedRoom["roomId"], "trackId": "village_R01"})
	h.must(speed[0], map[string]any{"type": "random-track", "roomId": speedRoom["roomId"], "randomTrackCode": 40})
}

func TestItemRaceSnapshotAndSettlement(t *testing.T) {
	for _, channel := range []string{"itemIndiCombine", "itemTeamCombine"} {
		t.Run(channel, func(t *testing.T) {
			h := newHarness(t)
			players := h.connectN(2)
			room := h.joinAndReady(players, h.create(players, "item", channel, 2))
			roomID := room["roomId"].(string)
			started, err := h.replyBytes(players[0], `{"type":"start","roomId":"`+roomID+`","revision":`+
				jsonNumber(room["revision"])+`}`)
			if err != nil {
				t.Fatal(err)
			}
			raceRaw := rawField(t, rawField(t, []byte(started), "room"), "race")
			assertEqual(t, keysOf(t, raceRaw), []string{"raceId", "channelName", "gameplay", "trackId",
				"loadingDeadline", "roster", "startSlots", "loadedIds", "item"})
			table := "indi"
			if channel == "itemTeamCombine" {
				table = "team"
			}
			if got := string(rawField(t, raceRaw, "item")); got != `{"ruleset":"web-item-v1","table":"`+table+`"}` {
				t.Fatalf("race.item %s", got)
			}
			rc := raceOf(object(decodeObject(t, []byte(started))["room"]))
			// Item races load in the 90 s window of the special modes.
			assertEqual(t, rc["loadingDeadline"], 1_000_000+90_000)
			raceID := rc["raceId"].(string)
			for _, p := range players {
				h.must(p, loadedRequest(roomID, raceID))
			}
			h.clock.Advance(63 * time.Second)
			for i, p := range players {
				h.must(p, finishRequest(roomID, raceID, 60_000+i))
			}
			settlement := h.recorder.settlements()[0]
			if settlement.Gameplay != "item" {
				t.Fatalf("settlement gameplay %s", settlement.Gameplay)
			}
			stored := rawField(t, settlement.Snapshot, "race")
			keys := keysOf(t, stored)
			if keys[len(keys)-1] != "item" || !slices.Contains(keys, "rewards") {
				t.Fatalf("settled race keys %v", keys)
			}
		})
	}
}

func TestItemRequestChecksAndSequence(t *testing.T) {
	h := newHarness(t)
	// Not an item race.
	plain := []*Client{h.connect("Plain0"), h.connect("Plain1")}
	roomID, raceID := h.startRace(plain, "ordinary", "speedIndiCombine", 2)
	assertEqual(t, h.errorCode(plain[0], map[string]any{"type": "item", "roomId": roomID, "raceId": raceID,
		"sequence": 1, "action": "swap"}), "ITEM_UNAVAILABLE")

	players := h.connectN(3)
	racers, late := players[:2], players[2]
	room := h.joinAndReady(racers, h.create(racers, "item", "itemIndiCombine", 3))
	roomID = room["roomId"].(string)
	room = h.command(racers[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID = raceOf(room)["raceId"].(string)
	ir := &itemRace{t: t, h: h, roomID: roomID, raceID: raceID, kind: itemmode.TableIndividual,
		random: &scriptedRandom{}, sequences: map[*Client]int{}}
	a, b := racers[0], racers[1]
	// Not loaded: refused before the sequence.
	assertEqual(t, h.errorCode(a, map[string]any{"type": "item", "roomId": roomID, "raceId": raceID,
		"sequence": 1, "action": "swap"}), "RACE_NOT_RUNNING")
	for _, p := range racers {
		h.must(p, loadedRequest(roomID, raceID))
	}
	// Countdown: the sequence is used up although the race is not running.
	assertEqual(t, ir.reject(a, "swap", nil), "RACE_NOT_RUNNING")
	h.clock.Advance(3 * time.Second)
	ir.sequences[a] = 0
	assertEqual(t, ir.reject(a, "swap", nil), "INVALID_SEQUENCE")
	ir.sequences[a] = 1
	assertEqual(t, ir.reject(a, "swap", nil), "ITEM_CHANGER_UNAVAILABLE") // no card
	// From startAt the race runs even before the phase timer fires.
	setPhase := func(phase string) {
		h.lobby.mu.Lock()
		defer h.lobby.mu.Unlock()
		h.lobby.rooms[roomID].phase = phase
	}
	setPhase("countdown")
	assertEqual(t, ir.reject(a, "swap", nil), "ITEM_CHANGER_UNAVAILABLE")
	setPhase("racing")
	ir.sequences[a] = 5
	assertEqual(t, ir.reject(a, "swap", nil), "INVALID_SEQUENCE")
	ir.sequences[a] = 3
	assertEqual(t, ir.reject(a, "dance", nil), "INVALID_ACTION")
	assertEqual(t, ir.reject(a, "change", nil), "ITEM_CHANGER_UNAVAILABLE")
	assertEqual(t, ir.reject(a, "cube", map[string]any{"capacity": 2}), "INVALID_CUBEID")
	assertEqual(t, ir.reject(a, "cube", map[string]any{"cubeId": 0, "capacity": 2}), "INVALID_CUBEID")
	assertEqual(t, ir.reject(a, "cube", map[string]any{"cubeId": 4097, "capacity": 2}), "INVALID_CUBEID")
	assertEqual(t, ir.reject(a, "cube", map[string]any{"cubeId": 1}), "INVALID_CAPACITY")
	assertEqual(t, ir.reject(a, "use", map[string]any{}), "INVALID_ITEMID")
	assertEqual(t, ir.reject(a, "use", map[string]any{"itemId": 8, "point": map[string]any{"x": 1, "y": 2}}), "INVALID_POINT")
	assertEqual(t, ir.reject(a, "use", map[string]any{"itemId": 8, "point": map[string]any{"x": 1, "y": 2, "z": 2e6}}), "INVALID_POINT")
	assertEqual(t, ir.reject(a, "use", map[string]any{"itemId": 8, "point": []any{1, 2, 3}}), "INVALID_POINT")
	assertEqual(t, ir.reject(a, "use", map[string]any{"itemId": 8, "targetId": 5}), "INVALID_TARGETID")
	assertEqual(t, ir.reject(a, "use", map[string]any{"itemId": 8}), "ITEM_NOT_HELD")
	assertEqual(t, ir.reject(a, "place", map[string]any{"useId": 1}), "INVALID_POINT")
	assertEqual(t, ir.reject(a, "place", map[string]any{"useId": 1, "point": map[string]any{"x": 0, "y": 0, "z": 0}}), "INVALID_USE")
	hit := func(fields map[string]any) map[string]any {
		request := map[string]any{"useId": 1, "itemId": 8, "result": "hit"}
		for key, value := range fields {
			if value == nil {
				delete(request, key)
			} else {
				request[key] = value
			}
		}
		return request
	}
	assertEqual(t, ir.reject(a, "hit", hit(map[string]any{"result": "miss"})), "INVALID_RESULT")
	assertEqual(t, ir.reject(a, "hit", hit(map[string]any{"by": "luck"})), "INVALID_BY")
	assertEqual(t, ir.reject(a, "hit", hit(map[string]any{"itemId": nil})), "INVALID_ITEMID")
	assertEqual(t, ir.reject(a, "hit", hit(nil)), "INVALID_USE") // no such use
	assertEqual(t, ir.reject(a, "hit", hit(map[string]any{"useId": 0})), "INVALID_HAZARDID")
	assertEqual(t, ir.reject(a, "hit", hit(map[string]any{"useId": 0, "itemId": 7, "hazardId": 2})), "INVALID_USE")

	// A track hazard: broadcast with no user, repeated within 3 s only to
	// the reporter.
	hazard := ir.send(a, "hit", hit(map[string]any{"useId": 0, "itemId": 37, "hazardId": 2, "result": "blocked", "by": "shield"}))
	want := map[string]any{"type": "item", "roomId": roomID, "raceId": raceID, "action": "hit",
		"playerId": a.playerID, "useId": 0, "itemId": 37, "result": "blocked", "by": "shield", "hazardId": 2}
	assertEqual(t, without(hazard, "sequence"), want)
	assertEqual(t, hazard["sequence"], ir.sequences[a])
	ir.send(a, "hit", hit(map[string]any{"useId": 0, "itemId": 37, "hazardId": 2}))
	assertEqual(t, itemEvents(t, h, b), []map[string]any{want})

	// Racers out of the race and late joiners cannot send item requests.
	h.command(late, map[string]any{"type": "join", "roomId": roomID})
	assertEqual(t, h.errorCode(late, map[string]any{"type": "item", "roomId": roomID, "raceId": raceID,
		"sequence": 1, "action": "swap"}), "NOT_RACE_PARTICIPANT")
}

// teamItemRace starts an item team race of a1, b1, a2, b2 (players 0..3;
// a = team 1) placed b1, a1, b2, a2 by their motion frames.
func teamItemRace(t *testing.T, setup ...func(*harness)) (*harness, *itemRace, []*Client) {
	t.Helper()
	h := newHarness(t)
	for _, f := range setup {
		f(h)
	}
	players := h.connectN(4)
	ir := h.startItemRace(players, "itemTeamCombine")
	for i, p := range []*Client{players[1], players[0], players[3], players[2]} {
		ir.at(p, float64(1000-100*i), 1)
	}
	return h, ir, players
}

func TestItemGrantsByLiveRank(t *testing.T) {
	h, ir, players := teamItemRace(t)
	a1, b1, a2, b2 := players[0], players[1], players[2], players[3]
	// With draws of 0 each group grants its first item with weight: top
	// and high the banana, mid the EMP, low the devil.
	reply := ir.rawReply(b1, "cube", map[string]any{"cubeId": 3, "capacity": 2})
	assertEqual(t, keysOf(t, []byte(reply)), []string{"type", "roomId", "raceId", "action", "sequence",
		"cubeId", "itemId", "slots", "changers"})
	assertEqual(t, decodeObject(t, []byte(reply)), map[string]any{"type": "item", "roomId": ir.roomID,
		"raceId": ir.raceID, "action": "grant", "sequence": 1, "cubeId": 3, "itemId": 8, "slots": []int{8, -1},
		"changers": map[string]any{"slot": 0, "item": 0, "itemArmed": true}})
	for _, c := range []struct {
		racer *Client
		want  int
	}{{a1, 8}, {b2, 12}, {a2, 2}} {
		if got := ir.send(c.racer, "cube", map[string]any{"cubeId": 3, "capacity": 2})["itemId"]; got != float64(c.want) {
			t.Errorf("%s got %v, want %d", c.racer.name, got, c.want)
		}
	}
	// The rank is the latest route distance, not the furthest: a1 falls to
	// last and draws from low.
	ir.at(a1, 100, 2)
	assertEqual(t, ir.send(a1, "cube", map[string]any{"cubeId": 4, "capacity": 2})["slots"], []int{8, 2})
	h.lobby.mu.Lock()
	rc := h.lobby.rooms[ir.roomID].race
	sample, furthest := rc.current[a1.playerID], rc.progress[a1.playerID]
	h.lobby.mu.Unlock()
	if sample != (routeSample{distance: 100, lap: 2}) || furthest != 900 {
		t.Fatalf("a1 progress %+v, furthest %v", sample, furthest)
	}
	// Grants are private: nobody else hears of them.
	for _, p := range players {
		if events := itemEvents(t, h, p); len(events) != 0 {
			t.Fatalf("%s heard %v", p.name, events)
		}
	}
}

func TestItemGrantsWithASeededSource(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(4)
	ir := h.startItemRaceWith(players, "itemIndiCombine", rand.New(rand.NewPCG(11, 12)))
	table := itemData(t).Table(itemmode.TableIndividual)
	for i, p := range players {
		ir.at(p, float64(1000-100*i), 1)
	}
	for round := range 2 {
		for i, p := range players {
			group := itemmode.GroupOf(i+1, len(players))
			reply := ir.send(p, "cube", map[string]any{"cubeId": 10 + round, "capacity": 2})
			idx := int(reply["itemId"].(float64))
			entry := table.Entries[slices.IndexFunc(table.Entries, func(e itemmode.Entry) bool { return e.Idx == idx })]
			if entry.Weight(group) == 0 {
				t.Errorf("rank %d (%s) got %s", i+1, group, entry.Name)
			}
			assertEqual(t, list(reply["slots"])[round], idx)
		}
	}
}

func TestItemCubeAbuseAndFullSlots(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	ir := h.startItemRace(players, "itemIndiCombine")
	p0, p1 := players[0], players[1]
	ir.at(p0, 500, 1)
	ir.at(p1, 400, 1)
	ir.send(p0, "cube", map[string]any{"cubeId": 5, "capacity": 2})
	// The same cube again: nothing, whatever capacity it claims now.
	abusing := ir.rawReply(p0, "cube", map[string]any{"cubeId": 5, "capacity": 3})
	assertEqual(t, keysOf(t, []byte(abusing)), []string{"type", "roomId", "raceId", "action", "sequence",
		"cubeId", "itemId", "reason", "slots", "changers"})
	assertEqual(t, decodeObject(t, []byte(abusing)), map[string]any{"type": "item", "roomId": ir.roomID,
		"raceId": ir.raceID, "action": "grant", "sequence": 2, "cubeId": 5, "itemId": nil,
		"reason": "abusing", "slots": []int{8, -1}, "changers": map[string]any{"slot": 0, "item": 0, "itemArmed": true}})
	assertEqual(t, ir.send(p0, "cube", map[string]any{"cubeId": 6, "capacity": 2})["slots"], []int{8, 8})
	full := ir.send(p0, "cube", map[string]any{"cubeId": 7, "capacity": 2})
	assertEqual(t, []any{full["itemId"], full["reason"], full["slots"]}, []any{nil, "full", []int{8, 8}})
	h.clock.Advance(10 * time.Second)
	assertEqual(t, ir.send(p0, "cube", map[string]any{"cubeId": 7, "capacity": 2})["reason"], "full")
	// A kart with three slots reports it with its first cube.
	assertEqual(t, len(list(ir.send(p1, "cube", map[string]any{"cubeId": 1, "capacity": 3})["slots"])), 3)
}

func TestItemUseTargetsHitsAndBroadcasts(t *testing.T) {
	h, ir, players := teamItemRace(t)
	a1, b1, a2, b2 := players[0], players[1], players[2], players[3]
	ir.grant(a2, 1, itemmode.GroupLow, itemmode.GuideRocket)
	used := ir.send(a2, "use", map[string]any{"itemId": itemmode.GuideRocket, "targetId": b2.playerID})
	event := map[string]any{"type": "item", "roomId": ir.roomID, "raceId": ir.raceID, "action": "used",
		"playerId": a2.playerID, "useId": 1, "itemId": 33, "targets": []string{b1.playerID},
		"startAt": h.clock.Now(), "etaMs": 1500} // 300 m at 100 m/s, capped by Use 1500
	assertEqual(t, without(used, "sequence", "slots", "changers"), event)
	assertEqual(t, []any{used["sequence"], used["slots"]}, []any{2, []int{-1, -1}})
	for _, peer := range []*Client{a1, b1, b2} {
		assertEqual(t, itemEvents(t, h, peer), []map[string]any{event})
	}
	if len(itemEvents(t, h, a2)) != 0 {
		t.Fatal("the user heard its own use")
	}
	ir.grant(b2, 1, itemmode.GroupMid, itemmode.WaterFly)
	fly := ir.send(b2, "use", map[string]any{"itemId": itemmode.WaterFly})
	assertEqual(t, []any{fly["targets"], fly["etaMs"]}, []any{[]string{a1.playerID}, 1667}) // 100 m at 60 m/s
	ir.grant(a1, 1, itemmode.GroupHigh, itemmode.Rocket)
	assertEqual(t, ir.reject(a1, "use", map[string]any{"itemId": 7, "targetId": a2.playerID}), "INVALID_TARGET")
	rocket := ir.send(a1, "use", map[string]any{"itemId": 7, "targetId": b1.playerID})
	assertEqual(t, []any{rocket["useId"], rocket["targets"], rocket["etaMs"]}, []any{3, []string{b1.playerID}, 1000})
	assertEqual(t, ir.reject(a1, "use", map[string]any{"itemId": 7}), "ITEM_NOT_HELD")

	// Victims report hits; each victim once per use.
	hit := ir.send(b1, "hit", map[string]any{"useId": 1, "itemId": 33, "result": "hit"})
	hitEvent := map[string]any{"type": "item", "roomId": ir.roomID, "raceId": ir.raceID, "action": "hit",
		"playerId": b1.playerID, "useId": 1, "itemId": 33, "userId": a2.playerID, "result": "hit"}
	assertEqual(t, without(hit, "sequence"), hitEvent)
	events := itemEvents(t, h, a2)
	assertEqual(t, events[len(events)-1], hitEvent)
	repeat := ir.send(b1, "hit", map[string]any{"useId": 1, "itemId": 33, "result": "blocked", "by": "shield"})
	assertEqual(t, without(repeat, "sequence"), hitEvent)
	if len(itemEvents(t, h, a2)) != len(events) {
		t.Fatal("a repeated hit was broadcast")
	}
	assertEqual(t, ir.reject(b2, "hit", map[string]any{"useId": 1, "itemId": 33, "result": "hit"}), "INVALID_TARGET")
	assertEqual(t, ir.reject(a1, "hit", map[string]any{"useId": 2, "itemId": 4, "result": "blocked", "by": "emp"}),
		"INVALID_BY")
	blocked := ir.send(a1, "hit", map[string]any{"useId": 2, "itemId": 4, "result": "blocked", "by": "angel"})
	assertEqual(t, []any{blocked["userId"], blocked["by"]}, []any{b2.playerID, "angel"})
}

func TestItemSlotLock(t *testing.T) {
	// KART_ITEM_CHANGERS=infinite: everyone may swap.
	h, ir, players := teamItemRace(t, func(h *harness) { h.lobby.itemChangers = true })
	a1, b2 := players[0], players[3]
	ir.grant(b2, 1, itemmode.GroupMid, itemmode.SlotLock)
	ir.grant(a1, 1, itemmode.GroupHigh, itemmode.Rocket)
	ir.grant(a1, 2, itemmode.GroupHigh, itemmode.Angel)
	lock := ir.send(b2, "use", map[string]any{"itemId": itemmode.SlotLock})
	assertEqual(t, lock["targets"], []string{a1.playerID, players[2].playerID})
	// Use 2000 ms, then locked for Affect 1000 + Postaffect 2000.
	h.clock.Advance(1_999 * time.Millisecond)
	h.lobby.mu.Lock()
	items := h.lobby.rooms[ir.roomID].race.items
	if items.Locked(a1.playerID, h.clock.Now()) || !items.Locked(a1.playerID, h.clock.Now()+1) ||
		!items.Locked(a1.playerID, h.clock.Now()+3_000) || items.Locked(a1.playerID, h.clock.Now()+3_001) {
		t.Error("lock window")
	}
	h.lobby.mu.Unlock()
	h.clock.Advance(time.Millisecond)
	assertEqual(t, ir.reject(a1, "use", map[string]any{"itemId": 11}), "ITEM_NOT_HELD")
	assertEqual(t, ir.reject(a1, "use", map[string]any{"itemId": 7}), "ITEM_LOCKED")
	swapped := ir.send(a1, "swap", nil)
	assertEqual(t, without(swapped, "sequence"), map[string]any{"type": "item", "roomId": ir.roomID,
		"raceId": ir.raceID, "action": "slots", "slots": []int{11, 7},
		"changers": map[string]any{"slot": -1, "item": -1, "itemArmed": true}})
	angel := ir.send(a1, "use", map[string]any{"itemId": 11})
	assertEqual(t, angel["targets"], []string{a1.playerID, players[2].playerID})
	assertEqual(t, ir.reject(a1, "use", map[string]any{"itemId": 7}), "ITEM_LOCKED")
	h.clock.Advance(3 * time.Second)
	misfire := ir.send(a1, "use", map[string]any{"itemId": 7})
	assertEqual(t, []any{misfire["targets"], misfire["etaMs"], misfire["slots"]}, []any{[]string{}, 0, []int{-1, -1}})
}

func TestItemScanShowsOpponentSlots(t *testing.T) {
	h, ir, players := teamItemRace(t)
	a1, b1, a2, b2 := players[0], players[1], players[2], players[3]
	ir.grant(a1, 1, itemmode.GroupHigh, itemmode.Shield)
	ir.grant(b1, 1, itemmode.GroupTop, itemmode.Scanning)
	start := h.clock.Now()
	used := ir.send(b1, "use", map[string]any{"itemId": itemmode.Scanning})
	assertEqual(t, used["targets"], []string{b1.playerID, b2.playerID})
	scan := func(subject *Client, slots []int) map[string]any {
		return map[string]any{"type": "item", "roomId": ir.roomID, "raceId": ir.raceID, "action": "scan",
			"playerId": subject.playerID, "slots": slots, "until": start + 8_500} // Use 500 + Affect 8000
	}
	scans := func(c *Client) []map[string]any {
		var out []map[string]any
		for _, event := range itemEvents(t, h, c) {
			if event["action"] == "scan" {
				out = append(out, event)
			}
		}
		return out
	}
	want := []map[string]any{scan(a1, []int{10, -1}), scan(a2, []int{-1, -1})}
	assertEqual(t, scans(b1), want)
	assertEqual(t, scans(b2), want)
	h.clock.Advance(time.Second)
	ir.grant(a2, 1, itemmode.GroupLow, itemmode.Booster)
	want = append(want, scan(a2, []int{6, -1}))
	assertEqual(t, scans(b1), want)
	assertEqual(t, scans(b2), want)
	for _, p := range []*Client{a1, a2} {
		if len(scans(p)) != 0 {
			t.Fatalf("%s was shown scans", p.name)
		}
	}
	h.clock.Advance(7500 * time.Millisecond)
	ir.grant(a2, 2, itemmode.GroupLow, itemmode.Booster)
	assertEqual(t, len(scans(b1)), 3)
}

func TestItemPlaceAndBanana(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(3)
	ir := h.startItemRace(players, "itemIndiCombine")
	p0, p1, p2 := players[0], players[1], players[2]
	for i, p := range players {
		ir.at(p, float64(1000-100*i), 1)
	}
	ir.grant(p0, 1, itemmode.GroupTop, itemmode.Banana)
	assertEqual(t, ir.reject(p0, "use", map[string]any{"itemId": 8}), "INVALID_POINT")
	banana := ir.send(p0, "use", map[string]any{"itemId": 8, "point": map[string]any{"x": 1.5, "y": -2, "z": 3}})
	assertEqual(t, []any{banana["targets"], banana["point"]},
		[]any{[]string{}, map[string]any{"x": 1.5, "y": -2, "z": 3}})
	h.sink(p1).mu.Lock()
	pushed := string(h.sink(p1).texts[len(h.sink(p1).texts)-1])
	h.sink(p1).mu.Unlock()
	if !strings.Contains(pushed, `"point":{"x":1.5,"y":-2.0,"z":3.0}`) {
		t.Fatalf("used event %s", pushed)
	}
	// The first racer to run over the banana removes it.
	gone := ir.send(p1, "hit", map[string]any{"useId": 1, "itemId": 8, "result": "hit"})
	assertEqual(t, gone["removed"], true)
	assertEqual(t, ir.reject(p2, "hit", map[string]any{"useId": 1, "itemId": 8, "result": "hit"}), "INVALID_USE")

	// The barricade lands where its target, the leader, says.
	ir.grant(p2, 1, itemmode.GroupMid, itemmode.Barricade)
	barricade := ir.send(p2, "use", map[string]any{"itemId": itemmode.Barricade})
	assertEqual(t, barricade["targets"], []string{p0.playerID})
	point := map[string]any{"x": 10, "y": 20, "z": 30}
	assertEqual(t, ir.reject(p2, "place", map[string]any{"useId": 2, "point": point}), "INVALID_USE")
	placed := ir.send(p0, "place", map[string]any{"useId": 2, "point": point})
	event := map[string]any{"type": "item", "roomId": ir.roomID, "raceId": ir.raceID, "action": "placed",
		"useId": 2, "itemId": 113, "playerId": p2.playerID, "point": point}
	assertEqual(t, without(placed, "sequence"), event)
	for _, peer := range []*Client{p1, p2} {
		events := itemEvents(t, h, peer)
		assertEqual(t, events[len(events)-1], event)
	}
	assertEqual(t, ir.reject(p0, "place", map[string]any{"useId": 2, "point": point}), "INVALID_USE")
	ir.send(p1, "hit", map[string]any{"useId": 2, "itemId": 113, "result": "blocked", "by": "shield"})
	// A use takes reports for a minute.
	h.clock.Advance(61 * time.Second)
	assertEqual(t, ir.reject(p0, "hit", map[string]any{"useId": 2, "itemId": 113, "result": "hit"}), "INVALID_USE")
}

// A trapped racer that leaves its bubble early tells the others, once per
// hit; the slots request answers the racer's slots without changing them.
func TestItemEscapeAndSlots(t *testing.T) {
	h, ir, players := teamItemRace(t)
	a1, b1, a2, b2 := players[0], players[1], players[2], players[3]
	ir.grant(b2, 1, itemmode.GroupMid, itemmode.WaterFly)
	ir.grant(b2, 2, itemmode.GroupMid, itemmode.Booster)
	slots := ir.send(b2, "slots", nil)
	assertEqual(t, without(slots, "sequence"), map[string]any{"type": "item", "roomId": ir.roomID,
		"raceId": ir.raceID, "action": "slots", "slots": []int{itemmode.WaterFly, itemmode.Booster},
		"changers": map[string]any{"slot": 0, "item": 0, "itemArmed": true}})
	assertEqual(t, slots["sequence"], ir.sequences[b2])
	fly := ir.send(b2, "use", map[string]any{"itemId": itemmode.WaterFly})
	assertEqual(t, fly["targets"], []string{a1.playerID})
	useID := fly["useId"]
	assertEqual(t, ir.reject(a1, "escape", map[string]any{"useId": useID}), "INVALID_USE") // not hit yet
	ir.send(a1, "hit", map[string]any{"useId": useID, "itemId": itemmode.WaterFly, "result": "hit"})
	before := map[*Client]int{}
	for _, peer := range []*Client{b1, a2, b2} {
		before[peer] = len(itemEvents(t, h, peer))
	}
	escaped := ir.send(a1, "escape", map[string]any{"useId": useID})
	event := map[string]any{"type": "item", "roomId": ir.roomID, "raceId": ir.raceID, "action": "escaped",
		"playerId": a1.playerID, "useId": useID, "itemId": itemmode.WaterFly}
	assertEqual(t, without(escaped, "sequence"), event)
	for _, peer := range []*Client{b1, a2, b2} {
		events := itemEvents(t, h, peer)
		assertEqual(t, events[before[peer]:], []map[string]any{event})
	}
	// A repeat answers again without telling the others twice.
	repeat := ir.send(a1, "escape", map[string]any{"useId": useID})
	assertEqual(t, without(repeat, "sequence"), event)
	assertEqual(t, len(itemEvents(t, h, b2)), before[b2]+1)
	assertEqual(t, ir.reject(a1, "escape", nil), "INVALID_USEID")
	assertEqual(t, ir.reject(a1, "escape", map[string]any{"useId": 0}), "INVALID_HAZARDID")
	assertEqual(t, ir.reject(a1, "escape", map[string]any{"useId": 0, "hazardId": 2}), "INVALID_USE")
	// A water mine on the track escapes with its hazard id.
	ir.send(b1, "hit", map[string]any{"useId": 0, "itemId": 37, "hazardId": 2, "result": "hit"})
	mine := ir.send(b1, "escape", map[string]any{"useId": 0, "hazardId": 2})
	assertEqual(t, without(mine, "sequence"), map[string]any{"type": "item", "roomId": ir.roomID,
		"raceId": ir.raceID, "action": "escaped", "playerId": b1.playerID, "useId": 0, "itemId": 37,
		"hazardId": 2})
	// The slots request changes nothing.
	assertEqual(t, ir.send(b2, "slots", nil)["slots"], []int{itemmode.Booster, -1})
	assertEqual(t, ir.send(b2, "slots", nil)["slots"], []int{itemmode.Booster, -1})
}

// Item team races: the first finisher's team wins, whatever the scores,
// and earns the team bonus even when the scores tie.
func TestItemTeamResult(t *testing.T) {
	t.Run("first finisher", func(t *testing.T) {
		h := newHarness(t)
		players := h.connectN(4)
		ir := h.startItemRace(players, "itemTeamCombine")
		assertEqual(t, h.errorCode(players[0], map[string]any{"type": "team-charge", "roomId": ir.roomID,
			"raceId": ir.raceID, "sequence": 1, "charge": 100}), "TEAM_GAUGE_UNAVAILABLE")
		h.clock.Advance(50 * time.Second)
		// Team 1 = players 0 and 2: 10; team 2 = players 1 and 3: 8 + 6.
		for i, idx := range []int{0, 1, 3} {
			h.must(players[idx], finishRequest(ir.roomID, ir.raceID, 60_000+i))
		}
		assertEqual(t, ir.reject(players[0], "cube", map[string]any{"cubeId": 1, "capacity": 2}), "INVALID_USE")
		h.clock.Advance(10 * time.Second)
		rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
		assertEqual(t, rc["teamScores"], map[string]any{"1": 10, "2": 14})
		assertEqual(t, rc["winningTeam"], 1)
	})
	t.Run("tie", func(t *testing.T) {
		h := newHarness(t)
		players := h.connectN(4)
		ir := h.startItemRace(players, "itemTeamCombine")
		h.clock.Advance(50 * time.Second)
		// Player 1 (team 2) first: 10 + 4 to 8 + 6.
		for i, idx := range []int{1, 0, 2, 3} {
			h.must(players[idx], finishRequest(ir.roomID, ir.raceID, 60_000+i))
		}
		rc := raceOf(object(h.sink(players[1]).last(t)["room"]))
		assertEqual(t, rc["teamScores"], map[string]any{"1": 14, "2": 14})
		assertEqual(t, rc["winningTeam"], 2)
		// N = 4, p = 1, 2/3, 1/3, 0: exp (30+50p+10) x1.1, lucci 40+80p+20,
		// both x1.2 for team 2.
		assertEqual(t, rc["rewards"], map[string]any{
			players[1].playerID: reward(119, 168),
			players[0].playerID: reward(81, 113),
			players[2].playerID: reward(62, 87),
			players[3].playerID: reward(53, 72),
		})
	})
}

func TestItemTestGrants(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	ir := h.startItemRace(players, "itemIndiCombine")
	p0, p1 := players[0], players[1]
	ir.at(p0, 500, 1)
	ir.at(p1, 400, 1)
	// Off by default: a cube that names its item is refused (its sequence is used).
	assertEqual(t, ir.reject(p0, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": 7}),
		"ITEM_TEST_GRANTS_DISABLED")
	// With KART_ITEM_TEST_GRANTS the leader gets the rocket it could never draw.
	h.lobby.itemTests = true
	grant := ir.send(p0, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": 7})
	assertEqual(t, []any{grant["itemId"], grant["reason"], grant["slots"]}, []any{float64(7), nil, []int{7, -1}})
	abusing := ir.send(p0, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": 2})
	assertEqual(t, []any{abusing["itemId"], abusing["reason"]}, []any{nil, "abusing"})
	assertEqual(t, ir.reject(p0, "cube", map[string]any{"cubeId": 2, "capacity": 2, "testItemId": 200}),
		"INVALID_TESTITEMID") // no such race item
	assertEqual(t, ir.reject(p0, "cube", map[string]any{"cubeId": 2, "capacity": 2, "testItemId": "rocket"}),
		"INVALID_TESTITEMID")
	used := ir.send(p0, "use", map[string]any{"itemId": 7, "targetId": p1.playerID})
	assertEqual(t, used["targets"], []any{p1.playerID})
}
