package lobby

import (
	"encoding/binary"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Exercise the actual request and binary-motion boundary, not direct mutations
// of the score or life state that browser clients are forbidden to publish.
func TestDeathmatchEightPlayerFallRespawnAndTimeoutSnapshots(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(8)
	room := h.joinAndReady(players, h.create(players, "deathmatch", "speedTeamCombine", 8))
	roomID := room["roomId"].(string)
	room = h.command(players[0], map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	raceID := raceOf(room)["raceId"].(string)
	assertEqual(t, room["phase"], "loading")
	assertEqual(t, teamCounts(room), map[string]int{"1": 4, "2": 4})
	loading := room
	frozen := object(raceOf(room)["deathmatch"])
	assertEqual(t, frozen["ruleset"], "web-deathmatch-v1")
	assertEqual(t, frozen["gameType"], 58)
	assertEqual(t, frozen["originalCreateSpeed"], 1)
	assertEqual(t, len(object(frozen["players"])), 8)
	assertEqual(t, len(list(frozen["spawns"])), 8)
	assertEqual(t, len(list(frozen["resetTriangles"])), 4)
	if len(list(raceOf(room)["results"])) != 0 {
		t.Fatal("loading snapshot contains a fabricated result")
	}
	startSlots := object(raceOf(room)["startSlots"])
	for _, raw := range list(raceOf(room)["roster"]) {
		row := object(raw)
		assertEqual(t, startSlots[row["playerId"].(string)], row["slot"])
	}
	for _, player := range players {
		room = h.command(player, map[string]any{"type": "loaded", "roomId": roomID, "raceId": raceID})
	}
	assertEqual(t, room["phase"], "countdown")
	assertEqual(t, len(list(raceOf(room)["loadedIds"])), 8)
	assertEqual(t, raceOf(room)["startSlots"], startSlots)
	countdownRoom := room
	h.clock.Advance(countdown)
	room = object(h.sink(players[0]).last(t)["room"])
	assertEqual(t, room["phase"], "racing")
	racing := room
	startAt := int64(raceOf(room)["startAt"].(float64))

	sequences := make(map[*Client]uint32)
	send := func(player *Client, position, velocity deathmatchVector) {
		t.Helper()
		sequences[player]++
		frame := motionFrame(raceID, 0, 0, motionHeaderLength+kinematicPayloadLength(2))
		binary.LittleEndian.PutUint32(frame[4:], sequences[player])
		payload := frame[motionHeaderLength:]
		put := func(offset int, value float64) {
			binary.LittleEndian.PutUint32(payload[offset:], math.Float32bits(float32(value)))
		}
		put(4, position.X)
		put(8, -position.Z)
		put(12, position.Y)
		put(32, velocity.X)
		put(36, -velocity.Z)
		put(40, velocity.Y)
		h.lobby.RelayMotion(player, frame)
	}
	track := deathmatchTrackByID(raceOf(room)["trackId"].(string))
	for _, player := range players {
		slot := int(startSlots[player.playerID].(float64))
		send(player, track.Spawns[slot].Position, deathmatchVector{})
	}
	// Protection expires before a real opposing contact can be attributed.
	h.clock.Advance(3 * time.Second)
	attacker := players[0]
	var victim *Client
	for _, player := range players[1:] {
		if memberOf(t, room, player.playerID)["team"] != memberOf(t, room, attacker.playerID)["team"] {
			victim = player
			break
		}
	}
	if victim == nil {
		t.Fatal("eight-player team room has no opposing racer")
	}
	contact := deathmatchVector{282, track.Spawns[0].Position.Y, -280.84942626953125}
	send(attacker, deathmatchVector{contact.X - 2, contact.Y, contact.Z}, deathmatchVector{20, 0, 0})
	send(victim, contact, deathmatchVector{-20, 0, 0})
	h.must(attacker, map[string]any{"type": "deathmatch-contact", "roomId": roomID, "raceId": raceID,
		"targetId": victim.playerID, "sequence": 1, "lifeSeq": 0, "targetLifeSeq": 0})
	h.clock.Advance(100 * time.Millisecond)
	fallenPosition := contact
	fallenPosition.Y = track.ResetTriangles[0].A.Y
	send(victim, fallenPosition, deathmatchVector{0, -15, 0})
	room = object(h.sink(attacker).last(t)["room"])
	assertEqual(t, room["phase"], "racing")
	fallen := room
	d := object(raceOf(room)["deathmatch"])
	victimState := object(object(d["players"])[victim.playerID])
	assertEqual(t, victimState["alive"], false)
	assertEqual(t, victimState["deaths"], 1)
	assertEqual(t, victimState["lifeSeq"], 0)
	assertEqual(t, object(object(d["players"])[attacker.playerID])["kills"], 1)
	attackingTeam := jsonNumber(memberOf(t, room, attacker.playerID)["team"])
	assertEqual(t, object(d["scores"])[attackingTeam], 1)
	if victimState["respawnAt"] == nil {
		t.Fatal("fallen player lacks authoritative respawn deadline")
	}
	h.clock.Advance(time.Duration(deathmatchRespawnMs) * time.Millisecond)
	room = object(h.sink(attacker).last(t)["room"])
	respawned := room
	victimState = object(object(object(raceOf(room)["deathmatch"])["players"])[victim.playerID])
	assertEqual(t, victimState["alive"], true)
	assertEqual(t, victimState["lifeSeq"], 1)
	assertEqual(t, victimState["respawnAt"], nil)
	assertEqual(t, victimState["protectedUntil"], h.clock.Now()+deathmatchProtectionMs)
	// A late contact from the previous life is refused after resurrection.
	assertEqual(t, h.errorCode(attacker, map[string]any{"type": "deathmatch-contact", "roomId": roomID,
		"raceId": raceID, "targetId": victim.playerID, "sequence": 2, "lifeSeq": 0, "targetLifeSeq": 0}),
		"INVALID_DEATHMATCH_TARGET")
	remaining := startAt + deathmatchLimitMs - h.clock.Now()
	h.clock.Advance(time.Duration(remaining) * time.Millisecond)
	room = object(h.sink(attacker).last(t)["room"])
	assertEqual(t, room["phase"], "finished")
	rc := raceOf(room)
	d = object(rc["deathmatch"])
	outcome := object(d["outcome"])
	assertEqual(t, outcome["reason"], "timeout")
	assertEqual(t, outcome["winningTeam"], memberOf(t, room, attacker.playerID)["team"])
	assertEqual(t, outcome["endedAt"], startAt+deathmatchLimitMs)
	results := list(rc["results"])
	assertEqual(t, len(results), 8)
	seen := make(map[string]bool)
	for _, raw := range results {
		row := object(raw)
		id := row["playerId"].(string)
		if seen[id] {
			t.Fatalf("result contains duplicate racer %s", id)
		}
		seen[id] = true
		assertEqual(t, row["points"], object(object(d["players"])[id])["kills"])
		assertEqual(t, row["elapsedMs"], nil)
	}
	assertEqual(t, object(results[0])["playerId"], attacker.playerID)
	assertEqual(t, object(results[0])["points"], 1)
	assertEqual(t, len(h.recorder.settlements()), 1)
	assertEqual(t, len(h.recorder.settlements()[0].Results), 8)
	// Optional fixture export is consumed by the client protocol tests during
	// release validation. Ordinary unit tests do not write into the checkout.
	if output := os.Getenv("KART_DEATHMATCH_SNAPSHOT_OUTPUT"); output != "" {
		payload, err := json.MarshalIndent(map[string]any{"loading": loading, "countdown": countdownRoom,
			"racing": racing, "fallen": fallen, "respawned": respawned, "finished": room}, "", "  ")
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Dir(output), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(output, append(payload, '\n'), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}
