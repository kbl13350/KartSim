package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"kartsim/internal/shared/ticket"
)

// Exercise the public WebSocket transport, including the binary slot masks.
// The data service is the existing HTTP fixture; no Lobby method is called.
func TestBraveFourWebSocketClientsRunTwoRaces(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	clients, ids := connectRacePeers(t, n, 4)
	room := clients[0].room(map[string]any{"type": "create", "name": "勇者联机验证", "capacity": 8,
		"gameplay": "brave", "channelName": "speedTeamCombine", "mode": "team", "speed": 7,
		"speedVersion": "国服"})
	roomID := room["roomId"].(string)
	if room["trackId"] != "village_R07" || room["resourceVersion"] != "p3553" {
		t.Fatalf("brave room defaults: %v", room)
	}
	if reply := clients[0].request(map[string]any{"type": "random-track", "roomId": roomID,
		"revision": room["revision"], "randomTrackCode": 0}); reply["code"] != "INVALID_TRACK" {
		t.Fatalf("brave random-track: %v", reply)
	}
	for i := 1; i < len(clients); i++ {
		room = clients[i].room(map[string]any{"type": "join", "roomId": roomID})
		room = clients[i].room(map[string]any{"type": "ready", "roomId": roomID,
			"revision": room["revision"], "ready": true})
		if i < 3 {
			reply := clients[0].request(map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
			if reply["code"] != "NOT_ENOUGH_PLAYERS" {
				t.Fatalf("start with %d peers: %v", i+1, reply)
			}
		}
	}
	// Capacity eight leaves room for an explicit 3v1 selection. Admission
	// must reject it, then accept the restored 2v2 without moving room seats.
	room = clients[1].room(map[string]any{"type": "team", "roomId": roomID, "revision": room["revision"], "team": 1})
	reply := clients[0].request(map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	if reply["code"] != "BRAVE_TEAMS_UNBALANCED" {
		t.Fatalf("unbalanced start: %v", reply)
	}
	room = clients[1].room(map[string]any{"type": "team", "roomId": roomID, "revision": room["revision"], "team": 2})

	previousRaceID := ""
	for round := 0; round < 2; round++ {
		if round > 0 {
			room = clients[0].room(map[string]any{"type": "random-team", "roomId": roomID,
				"revision": room["revision"], "enabled": true})
			for i := 1; i < len(clients); i++ {
				room = clients[i].room(map[string]any{"type": "ready", "roomId": roomID,
					"revision": room["revision"], "ready": true})
			}
		}
		room = clients[0].room(map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
		race := room["race"].(map[string]any)
		raceID := race["raceId"].(string)
		if room["phase"] != "loading" || raceID == previousRaceID || race["trackId"] != "village_R07" {
			t.Fatalf("round %d start: %v", round+1, room)
		}
		frozen := frozenBraveFields(t, race, ids)
		seats := roomMemberSlots(room)
		for _, c := range clients {
			room = c.room(map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
			assertFrozenBraveFields(t, room["race"].(map[string]any), frozen)
		}
		if room["phase"] != "countdown" {
			t.Fatalf("all four loaded: %v", room["phase"])
		}
		n.clock.Advance(7 * time.Second)
		for _, c := range clients {
			room = waitRacePhase(c, raceID, "racing")
			assertFrozenBraveFields(t, room["race"].(map[string]any), frozen)
		}
		assertMotionPeerRouting(t, clients, ids, race)

		teams := rosterTeams(race)
		enemy, teammate := "", ""
		for _, id := range ids[1:] {
			if teams[id] == teams[ids[0]] {
				teammate = id
			} else {
				enemy = id
			}
		}
		for _, invalid := range []struct{ race, target, code string }{
			{raceID, teammate, "INVALID_BRAVE_TARGET"},
			{raceID + "-other", enemy, "RACE_NOT_FOUND"},
		} {
			reply := clients[0].request(map[string]any{"type": "brave-collision", "roomId": roomID,
				"raceId": invalid.race, "targetId": invalid.target})
			if reply["code"] != invalid.code {
				t.Fatalf("invalid collision: %v", reply)
			}
		}
		if previousRaceID != "" {
			reply := clients[0].request(map[string]any{"type": "brave-collision", "roomId": roomID,
				"raceId": previousRaceID, "targetId": enemy})
			if reply["code"] != "RACE_NOT_FOUND" {
				t.Fatalf("prior race collision accepted: %v", reply)
			}
		}
		collision := clients[0].request(map[string]any{"type": "brave-collision", "roomId": roomID,
			"raceId": raceID, "targetId": enemy, "playerId": teammate})
		if collision["type"] != "brave-collision" || collision["playerId"] != ids[0] ||
			collision["targetId"] != enemy || collision["roomId"] != roomID || collision["raceId"] != raceID {
			t.Fatalf("collision sender must come from session: %v", collision)
		}
		delete(collision, "requestId")
		for _, c := range clients[1:] {
			event := c.waitFor(func(m map[string]any) bool { return m["type"] == "brave-collision" && m["raceId"] == raceID })
			if !reflect.DeepEqual(event, collision) {
				t.Fatalf("collision broadcast %v, want %v", event, collision)
			}
		}
		reply = clients[0].request(map[string]any{"type": "brave-collision", "roomId": roomID,
			"raceId": raceID, "targetId": enemy})
		if reply["code"] != "BRAVE_COLLISION_COOLDOWN" {
			t.Fatalf("collision cooldown: %v", reply)
		}

		n.clock.Advance(60 * time.Second)
		// Blue finishes first and second: ordinary rank points give 18 to 10.
		rank := 0
		for _, team := range []int{2, 1} {
			for i, id := range ids {
				if teams[id] == team {
					room = clients[i].room(map[string]any{"type": "finish", "roomId": roomID,
						"raceId": raceID, "elapsedMs": 60_000 + rank*100})
					rank++
				}
			}
		}
		race = room["race"].(map[string]any)
		if room["phase"] != "finished" || race["winningTeam"] != 2.0 ||
			!reflect.DeepEqual(race["teamScores"], map[string]any{"1": 10.0, "2": 18.0}) {
			t.Fatalf("team finish: %v", room)
		}
		assertFrozenBraveFields(t, race, frozen)
		eventually(t, "brave settlement", func() (ok bool) {
			data.read(func() { ok = len(data.races) == round+1 })
			return
		})
		data.read(func() {
			settlement := data.races[round]
			if settlement.Gameplay != "brave" || settlement.RaceID != raceID || len(settlement.Results) != 4 {
				t.Errorf("settlement: %+v", settlement)
			}
			var stored map[string]any
			if err := json.Unmarshal(settlement.Snapshot, &stored); err != nil {
				t.Fatal(err)
			}
			assertFrozenBraveFields(t, stored["race"].(map[string]any), frozen)
		})
		for _, c := range clients {
			room = c.room(map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
		}
		if room["phase"] != "open" || room["race"] != nil || !reflect.DeepEqual(roomMemberSlots(room), seats) {
			t.Fatalf("return must preserve room seats: %v", room)
		}
		previousRaceID = raceID
	}
}

func TestOrdinaryTeamWebSocketStillStartsWithTwoAndUsesRoomSlots(t *testing.T) {
	data := newFakeData()
	dataServer := httptest.NewServer(data)
	defer dataServer.Close()
	n := startNode(t, dataServer.URL, data)
	clients, ids := connectRacePeers(t, n, 2)
	room := clients[0].room(map[string]any{"type": "create", "name": "普通组队", "capacity": 2,
		"gameplay": "ordinary", "channelName": "speedTeamCombine", "mode": "team", "speed": 7,
		"speedVersion": "国服"})
	roomID := room["roomId"].(string)
	room = clients[1].room(map[string]any{"type": "join", "roomId": roomID})
	room = clients[1].room(map[string]any{"type": "ready", "roomId": roomID, "revision": room["revision"], "ready": true})
	room = clients[0].room(map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	race := room["race"].(map[string]any)
	raceID := race["raceId"].(string)
	if race["brave"] != nil || !reflect.DeepEqual(race["startSlots"], roomMemberSlots(room)) {
		t.Fatalf("ordinary slots changed: %v", race)
	}
	for _, c := range clients {
		c.room(map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	n.clock.Advance(7 * time.Second)
	for _, c := range clients {
		waitRacePhase(c, raceID, "racing")
	}
	assertMotionPeerRouting(t, clients, ids, race)
	reply := clients[0].request(map[string]any{"type": "brave-collision", "roomId": roomID,
		"raceId": raceID, "targetId": ids[1]})
	if reply["code"] != "BRAVE_REQUIRED" {
		t.Fatalf("ordinary collision accepted: %v", reply)
	}
	n.clock.Advance(60 * time.Second)
	for i, c := range clients {
		room = c.room(map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 60_000 + i*100})
	}
	if room["phase"] != "finished" || room["race"].(map[string]any)["winningTeam"] != 1.0 {
		t.Fatalf("ordinary finish: %v", room)
	}
	for _, c := range clients {
		room = c.room(map[string]any{"type": "return-room", "roomId": roomID, "raceId": raceID})
	}
	if room["phase"] != "open" || room["race"] != nil {
		t.Fatalf("ordinary return: %v", room)
	}
}

func connectRacePeers(t *testing.T, n *node, count int) ([]*wsClient, []string) {
	t.Helper()
	clients, ids := make([]*wsClient, count), make([]string, count)
	for i := range clients {
		clients[i] = dial(t, n.wsURL, nil)
		welcome := clients[i].request(hello(fmt.Sprintf("RacePeer%d", i), sign(t, ticket.Claims{Guest: true})))
		if welcome["type"] != "welcome" {
			t.Fatalf("hello: %v", welcome)
		}
		ids[i] = welcome["playerId"].(string)
	}
	return clients, ids
}

func roomMemberSlots(room map[string]any) map[string]any {
	slots := map[string]any{}
	for _, entry := range room["members"].([]any) {
		member := entry.(map[string]any)
		slots[member["playerId"].(string)] = member["slot"]
	}
	return slots
}

func rosterTeams(race map[string]any) map[string]int {
	teams := map[string]int{}
	for _, entry := range race["roster"].([]any) {
		member := entry.(map[string]any)
		teams[member["playerId"].(string)] = int(member["team"].(float64))
	}
	return teams
}

func frozenBraveFields(t *testing.T, race map[string]any, ids []string) map[string]any {
	t.Helper()
	brave, ok := race["brave"].(map[string]any)
	if !ok || brave["ruleset"] != "web-brave-v1" || (brave["forwardTeam"] != 1.0 && brave["forwardTeam"] != 2.0) {
		t.Fatalf("brave rules: %v", race["brave"])
	}
	slots := race["startSlots"].(map[string]any)
	teams := rosterTeams(race)
	if len(slots) != len(ids) || len(teams) != len(ids) {
		t.Fatalf("wrong frozen roster: %v", race)
	}
	used, counts := map[int]bool{}, map[int]int{}
	for _, id := range ids {
		slot := int(slots[id].(float64))
		team := teams[id]
		if (team != 1 && team != 2) || slot < (team-1)*4 || slot >= team*4 || used[slot] {
			t.Fatalf("invalid frozen slot %d for team %d: %v", slot, team, race)
		}
		used[slot], counts[team] = true, counts[team]+1
	}
	if counts[1] != 2 || counts[2] != 2 {
		t.Fatalf("unbalanced frozen roster: %v", teams)
	}
	for _, entry := range race["roster"].([]any) {
		member := entry.(map[string]any)
		if member["slot"] != slots[member["playerId"].(string)] {
			t.Fatalf("roster/startSlots disagree: %v", race)
		}
	}
	return map[string]any{"brave": brave, "roster": race["roster"], "startSlots": slots}
}

func assertFrozenBraveFields(t *testing.T, race, frozen map[string]any) {
	t.Helper()
	for field, want := range frozen {
		if !reflect.DeepEqual(race[field], want) {
			t.Fatalf("frozen %s changed: got %v, want %v", field, race[field], want)
		}
	}
}

func waitRacePhase(c *wsClient, raceID, phase string) map[string]any {
	c.t.Helper()
	return c.waitFor(func(m map[string]any) bool {
		room, ok := m["room"].(map[string]any)
		if !ok || room["phase"] != phase {
			return false
		}
		race, ok := room["race"].(map[string]any)
		return ok && race["raceId"] == raceID
	})["room"].(map[string]any)
}

func assertMotionPeerRouting(t *testing.T, clients []*wsClient, ids []string, race map[string]any) {
	t.Helper()
	slots := race["startSlots"].(map[string]any)
	for sender, c := range clients {
		target := (sender + 1) % len(clients)
		before := make([]int, len(clients))
		for i, peer := range clients {
			before[i] = len(peer.frames)
		}
		frame := motionFrame(race["raceId"].(string), uint32(sender+1), [3]float32{float32(sender), 0, 0}, 1)
		frame[1] = 1 << uint8(slots[ids[target]].(float64))
		frame[2] = 0xFE // The node must replace an untrusted sender slot.
		if err := c.conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
			t.Fatal(err)
		}
		// The sender's clock reply is a processing barrier. Each recipient's
		// subsequent reply drains earlier binary frames from its FIFO queue;
		// no socket timeout (which would poison the connection) is needed.
		c.request(map[string]any{"type": "clock", "clientTick": 1})
		for i, peer := range clients {
			peer.request(map[string]any{"type": "clock", "clientTick": 1})
			want := before[i]
			if i == target {
				want++
			}
			if len(peer.frames) != want {
				t.Fatalf("motion sender %s target %s delivered %d new frames to %s, want %d",
					ids[sender], ids[target], len(peer.frames)-before[i], ids[i], want-before[i])
			}
		}
		frame[2] = byte(slots[ids[sender]].(float64))
		if got := clients[target].frames[before[target]]; !bytes.Equal(got, frame) {
			t.Fatalf("sender %s frozen slot %v: relayed header %v, want %v", ids[sender], slots[ids[sender]], got[:8], frame[:8])
		}
	}
}
