package lobby

import (
	"cmp"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"math"
	"net/http"
	"slices"
	"time"

	"kartsim/internal/shared/rewards"
)

// These rules reconstruct the missing server logic. Only game type 58,
// createSpeed 1, the eight spawn poses and five maps come from p3553.
const (
	deathmatchTargetScore = 20
	deathmatchLimitMs = 180_000
	deathmatchRespawnMs = 3_000
	deathmatchProtectionMs = 2_000
	deathmatchAttributionMs = 5_000
	deathmatchMotionFreshMs = 750
	deathmatchContactDistance = 5.5
)

var deathmatchTrackIDs = []string{"ice_D01", "factory_D01", "god_D01", "northeu_D01", "wkc_D01"}

//go:embed deathmatch-tracks.json
var deathmatchTracksJSON []byte

type deathmatchVector struct { X float64 `json:"x"`; Y float64 `json:"y"`; Z float64 `json:"z"` }
type deathmatchSpawn struct {
	Slot int `json:"slot"`
	Position deathmatchVector `json:"position"`
	Forward deathmatchVector `json:"forward"`
}
type deathmatchTrack struct {
	ID string `json:"id"`
	FallY float64 `json:"fallY"`
	Spawns []deathmatchSpawn `json:"spawns"`
	ResetTriangles []deathmatchTriangle `json:"resetTriangles"`
}
type deathmatchTriangle struct { A deathmatchVector `json:"a"`; B deathmatchVector `json:"b"`; C deathmatchVector `json:"c"` }

var deathmatchTracks = func() []deathmatchTrack {
	var data struct { Tracks []deathmatchTrack `json:"tracks"` }
	if err := json.Unmarshal(deathmatchTracksJSON, &data); err != nil { panic(err) }
	if len(data.Tracks) != len(deathmatchTrackIDs) { panic("deathmatch: expected five original tracks") }
	seen := map[string]bool{}
	for _, track := range data.Tracks {
		if seen[track.ID] || !slices.Contains(deathmatchTrackIDs, track.ID) || len(track.Spawns) != 8 { panic("deathmatch: invalid original track") }
		seen[track.ID] = true
		for i, spawn := range track.Spawns {
			if spawn.Slot != i || spawn.Position.Y <= track.FallY { panic("deathmatch: invalid original spawn") }
		}
	}
	return data.Tracks
}()

func deathmatchTrackByID(id string) *deathmatchTrack {
	for i := range deathmatchTracks { if deathmatchTracks[i].ID == id { return &deathmatchTracks[i] } }
	return nil
}

type deathmatchMotion struct {
	position deathmatchVector
	velocity deathmatchVector
	at int64
	sequence uint32
}
type deathmatchPlayer struct {
	lifeSeq int
	alive bool
	spawnSlot int
	protectedUntil int64
	respawnAt *int64
	kills, deaths int
	contactID string
	contactLife int
	contactAt int64
	contactSequence int
	lastContactAt int64
	motion *deathmatchMotion
	// Motion sequences span all lives. A delayed pre-respawn frame must not
	// become the first movement of the new life.
	lastMotionSequence uint32
	motionSeen bool
	spawnPending bool
}
type deathmatchRace struct {
	track *deathmatchTrack
	players map[string]*deathmatchPlayer
	scores [2]int
	eventSequence int
	outcome obj
}

func validateDeathmatchStart(r *room) error {
	if r.gameplay != "deathmatch" { return nil }
	if err := validateCreation(r.gameplay, r.channelName, r.resourceVersion, r.capacity); err != nil { return err }
	if r.mode != "team" || r.speed != 7 { return fail(http.StatusBadRequest, "INVALID_CHANNEL") }
	if len(r.closedSlots) != 0 { return fail(http.StatusBadRequest, "DEATHMATCH_SLOTS_FIXED") }
	if r.randomTrackCode != nil {
		if *r.randomTrackCode != 0 || r.trackID != "" { return fail(http.StatusBadRequest, "INVALID_TRACK") }
	} else if deathmatchTrackByID(r.trackID) == nil { return fail(http.StatusBadRequest, "INVALID_TRACK") }
	if len(r.members) < 8 { return fail(http.StatusBadRequest, "NOT_ENOUGH_PLAYERS") }
	if len(r.members) != 8 { return fail(http.StatusBadRequest, "DEATHMATCH_TEAMS_UNBALANCED") }
	var teams [3]int
	var slots [8]bool
	for _, m := range r.members {
		if m.team != 1 && m.team != 2 { return fail(http.StatusBadRequest, "TEAM_REQUIRED") }
		if m.slot < 0 || m.slot >= 8 || slots[m.slot] || m.slot/4+1 != m.team { return fail(http.StatusBadRequest, "DEATHMATCH_TEAMS_UNBALANCED") }
		slots[m.slot] = true
		teams[m.team]++
	}
	if teams[1] != 4 || teams[2] != 4 { return fail(http.StatusBadRequest, "DEATHMATCH_TEAMS_UNBALANCED") }
	return nil
}

func freezeDeathmatchRace(rc *race) {
	d := &deathmatchRace{track: deathmatchTrackByID(rc.trackID), players: map[string]*deathmatchPlayer{}}
	var next [2]int
	for i, id := range rc.rosterIDs {
		team := rc.rosterTeams[id]-1
		slot := next[team]*2+team
		next[team]++
		rc.startSlots[i] = slot
		rc.roster[i] = rc.roster[i].with("slot", slot)
		d.players[id] = &deathmatchPlayer{alive: true, spawnSlot: slot, spawnPending: true}
	}
	rc.deathmatch = d
	rc.teamScores = &d.scores
}

func (d *deathmatchRace) snapshot(rc *race) obj {
	players := make(obj, 0, len(rc.rosterIDs))
	for _, id := range rc.rosterIDs {
		p := d.players[id]
		var respawn any
		if p.respawnAt != nil { respawn = *p.respawnAt }
		players = append(players, field{id, obj{{"lifeSeq", p.lifeSeq}, {"alive", p.alive},
			{"spawnSlot", p.spawnSlot}, {"protectedUntil", p.protectedUntil}, {"respawnAt", respawn},
			{"kills", p.kills}, {"deaths", p.deaths}}})
	}
	value := obj{{"ruleset", "web-deathmatch-v1"}, {"gameType", 58}, {"originalCreateSpeed", 1},
		{"targetScore", deathmatchTargetScore}, {"timeLimitMs", deathmatchLimitMs},
		{"respawnMs", deathmatchRespawnMs}, {"protectionMs", deathmatchProtectionMs},
		{"attributionMs", deathmatchAttributionMs}, {"contactDistance", deathmatchContactDistance},
		{"fallY", d.track.FallY}, {"spawns", d.track.Spawns}, {"resetTriangles", d.track.ResetTriangles},
		{"scores", obj{{"1", d.scores[0]}, {"2", d.scores[1]}}},
		{"players", players}, {"eventSequence", d.eventSequence}}
	if d.outcome != nil { value = append(value, field{"outcome", d.outcome}) }
	return value
}

func (l *Lobby) startDeathmatchCountdown(r *room) {
	rc := r.race
	deadline := *rc.startAt + deathmatchLimitMs
	rc.finishDeadline = &deadline
	for _, p := range rc.deathmatch.players { p.protectedUntil = *rc.startAt + deathmatchProtectionMs }
	roomID, raceID := r.id, rc.id
	l.schedule((deathmatchLimitMs + countdownLeadMs) * time.Millisecond, func() {
		r := l.rooms[roomID]
		if r == nil || r.race == nil || r.race.id != raceID || r.phase != "racing" { return }
		l.endDeathmatch(r, "timeout", deadline)
	})
}

func deathmatchDistance(a, b deathmatchVector) float64 { return math.Hypot(math.Hypot(a.X-b.X, a.Y-b.Y), a.Z-b.Z) }

// Original 리셋 faces are loss surfaces, not necessarily the lowest
// geometry: some arenas have playable platforms below an upper loss plane.
// The small vertical band keeps an upper plane from killing a lower racer.
func (track *deathmatchTrack) fallen(position deathmatchVector) bool {
	if position.Y <= track.FallY { return true }
	for _, triangle := range track.ResetTriangles {
		a, b, c := triangle.A, triangle.B, triangle.C
		denominator := (b.Z-c.Z)*(a.X-c.X)+(c.X-b.X)*(a.Z-c.Z)
		if math.Abs(denominator) < 1e-8 { continue }
		u := ((b.Z-c.Z)*(position.X-c.X)+(c.X-b.X)*(position.Z-c.Z))/denominator
		v := ((c.Z-a.Z)*(position.X-c.X)+(a.X-c.X)*(position.Z-c.Z))/denominator
		if u < -1e-6 || v < -1e-6 || u+v > 1+1e-6 { continue }
		height := u*a.Y+v*b.Y+(1-u-v)*c.Y
		if position.Y <= height+1 && position.Y >= height-10 { return true }
	}
	return false
}

// acceptDeathmatchMotion observes binary snapshots even with a zero relay
// mask (all peers connected directly). The authenticated sender supplies
// only motion, never an attacker, a score or a resurrection.
func (l *Lobby) acceptDeathmatchMotion(r *room, id string, frame []byte) bool {
	rc, now := r.race, l.clock.Now()
	d, p := rc.deathmatch, rc.deathmatch.players[id]
	if p == nil || !p.alive || int(frame[0]) < 2 { return false }
	sequence := binary.LittleEndian.Uint32(frame[4:])
	if p.motionSeen && int32(sequence-p.lastMotionSequence) <= 0 { return false }
	b := frame[motionHeaderLength:]
	// Native motion is Z-up; original exported spawn geometry is web Y-up.
	position := deathmatchVector{float64(f32(b, 4)), float64(f32(b, 12)), -float64(f32(b, 8))}
	velocity := deathmatchVector{float64(f32(b, 32)), float64(f32(b, 40)), -float64(f32(b, 36))}
	if deathmatchDistance(velocity, deathmatchVector{}) > 200 { return false }
	if p.spawnPending {
		if deathmatchDistance(position, d.track.Spawns[p.spawnSlot].Position) > 10 { return false }
		p.spawnPending = false
	} else if p.motion != nil {
		// Ignore impossible jumps, including reset hints. Only a server
		// resurrection can clear this anchor and permit a spawn teleport.
		if deathmatchDistance(position, p.motion.position) > 4+160*float64(now-p.motion.at)/1000 { return false }
	}
	p.lastMotionSequence, p.motionSeen = sequence, true
	p.motion = &deathmatchMotion{position: position, velocity: velocity, at: now, sequence: sequence}
	if r.phase == "racing" && d.track.fallen(position) {
		l.downDeathmatchPlayer(r, id, now)
		return false // Peers freeze the downed racer from the authoritative snapshot.
	}
	return true
}

func (l *Lobby) deathmatchRoom(c *Client, in Request) (*room, error) {
	r, err := l.raceRoom(c, in)
	if err != nil { return nil, err }
	if r.gameplay != "deathmatch" { return nil, fail(http.StatusBadRequest, "DEATHMATCH_REQUIRED") }
	if r.phase != "racing" { return nil, fail(http.StatusBadRequest, "RACE_NOT_RUNNING") }
	if !r.race.isLoaded(c.playerID) { return nil, fail(http.StatusForbidden, "NOT_RACE_PARTICIPANT") }
	return r, nil
}

func (l *Lobby) deathmatchContact(c *Client, in Request) (obj, error) {
	r, err := l.deathmatchRoom(c, in)
	if err != nil { return nil, err }
	rc, now := r.race, l.clock.Now()
	d := rc.deathmatch
	sequence, err := in.integer("sequence", 1, math.MaxInt32)
	if err != nil { return nil, err }
	p := d.players[c.playerID]
	if sequence <= p.contactSequence { return nil, fail(http.StatusBadRequest, "INVALID_DEATHMATCH_SEQUENCE") }
	target, err := in.text("targetId", 1, 64)
	if err != nil { return nil, err }
	life, err := in.integer("lifeSeq", 0, math.MaxInt32)
	if err != nil { return nil, err }
	targetLife, err := in.integer("targetLifeSeq", 0, math.MaxInt32)
	if err != nil { return nil, err }
	q := d.players[target]
	if q == nil || target == c.playerID || rc.isOut(target) || !rc.isLoaded(target) ||
		rc.rosterTeams[target] == rc.rosterTeams[c.playerID] || !p.alive || !q.alive ||
		p.lifeSeq != life || q.lifeSeq != targetLife || now < p.protectedUntil || now < q.protectedUntil {
		return nil, fail(http.StatusBadRequest, "INVALID_DEATHMATCH_TARGET")
	}
	if p.motion == nil || q.motion == nil || now-p.motion.at > deathmatchMotionFreshMs || now-q.motion.at > deathmatchMotionFreshMs {
		return nil, fail(http.StatusBadRequest, "DEATHMATCH_POSITION_UNAVAILABLE")
	}
	if deathmatchDistance(p.motion.position, q.motion.position) > deathmatchContactDistance ||
		deathmatchDistance(p.motion.velocity, q.motion.velocity) < 1 {
		return nil, fail(http.StatusBadRequest, "INVALID_DEATHMATCH_TARGET")
	}
	if p.lastContactAt != 0 && now-p.lastContactAt < 150 { return nil, fail(http.StatusTooManyRequests, "DEATHMATCH_CONTACT_COOLDOWN") }
	p.contactSequence, p.lastContactAt = sequence, now
	// A real opposing contact gives each side reciprocal attribution. The
	// victim's later fall determines the scorer; caller-supplied score,
	// attackerId/playerId or team fields have no effect.
	p.contactID, p.contactLife, p.contactAt = target, q.lifeSeq, now
	q.contactID, q.contactLife, q.contactAt = c.playerID, p.lifeSeq, now
	return obj{{"type", "deathmatch-accepted"}, {"roomId", r.id}, {"raceId", rc.id}, {"sequence", sequence}}, nil
}

func (l *Lobby) deathmatchFallHint(c *Client, in Request) (obj, error) {
	r, err := l.deathmatchRoom(c, in)
	if err != nil { return nil, err }
	life, err := in.integer("lifeSeq", 0, math.MaxInt32)
	if err != nil { return nil, err }
	p := r.race.deathmatch.players[c.playerID]
	if p.lifeSeq != life { return nil, fail(http.StatusBadRequest, "INVALID_DEATHMATCH_SEQUENCE") }
	if p.alive {
		if p.motion == nil || l.clock.Now()-p.motion.at > deathmatchMotionFreshMs || !r.race.deathmatch.track.fallen(p.motion.position) {
			return nil, fail(http.StatusBadRequest, "DEATHMATCH_NOT_FALLEN")
		}
		l.downDeathmatchPlayer(r, c.playerID, l.clock.Now())
	}
	return obj{{"type", "deathmatch-accepted"}, {"roomId", r.id}, {"raceId", r.race.id}, {"lifeSeq", life}}, nil
}

func (l *Lobby) downDeathmatchPlayer(r *room, id string, now int64) {
	rc, d := r.race, r.race.deathmatch
	p := d.players[id]
	if !p.alive || r.phase != "racing" { return }
	p.alive, p.deaths = false, p.deaths+1
	respawnAt := now + deathmatchRespawnMs
	p.respawnAt = &respawnAt
	if p.contactID != "" && now-p.contactAt <= deathmatchAttributionMs && now >= p.protectedUntil {
		attacker := d.players[p.contactID]
		if attacker != nil && attacker.lifeSeq == p.contactLife && !rc.isOut(p.contactID) &&
			rc.rosterTeams[p.contactID] != rc.rosterTeams[id] {
			attacker.kills++
			d.scores[rc.rosterTeams[p.contactID]-1]++
		}
	}
	p.contactID = ""
	d.eventSequence++
	if max(d.scores[0], d.scores[1]) >= deathmatchTargetScore {
		l.endDeathmatch(r, "target-score", now)
		return
	}
	roomID, raceID, life := r.id, rc.id, p.lifeSeq
	l.schedule(deathmatchRespawnMs*time.Millisecond, func() { l.respawnDeathmatchPlayer(roomID, raceID, id, life) })
	r.revision++
	l.broadcastRoom(r, nil)
}

func (l *Lobby) respawnDeathmatchPlayer(roomID, raceID, id string, life int) {
	r := l.rooms[roomID]
	if r == nil || r.race == nil || r.race.id != raceID || r.phase != "racing" || r.race.isOut(id) { return }
	d := r.race.deathmatch
	p := d.players[id]
	if p.alive || p.lifeSeq != life || p.respawnAt == nil || l.clock.Now() < *p.respawnAt { return }
	p.lifeSeq++
	p.alive, p.spawnPending, p.respawnAt, p.motion = true, true, nil, nil
	p.protectedUntil, p.contactID = l.clock.Now()+deathmatchProtectionMs, ""
	// Contacts from a previous life can never earn points after resurrection.
	for _, other := range d.players { if other.contactID == id { other.contactID = "" } }
	d.eventSequence++
	r.revision++
	l.broadcastRoom(r, nil)
}

func (d *deathmatchRace) removePlayer(id string) {
	if p := d.players[id]; p != nil { p.alive, p.respawnAt, p.motion, p.contactID = false, nil, nil, "" }
	for _, p := range d.players { if p.contactID == id { p.contactID = "" } }
	d.eventSequence++
}

func deathmatchTeamGone(r *room) bool {
	var counts [3]int
	for _, id := range racers(r) { counts[r.race.rosterTeams[id]]++ }
	return counts[1] == 0 || counts[2] == 0
}

func (l *Lobby) endDeathmatch(r *room, reason string, at int64) {
	rc, d := r.race, r.race.deathmatch
	if r.phase != "racing" || rc.resultsSet { return }
	endedAt := max(*rc.startAt, min(at, *rc.finishDeadline))
	winner := 0
	if d.scores[0] > d.scores[1] { winner = 1 } else if d.scores[1] > d.scores[0] { winner = 2 }
	if reason == "team-left" {
		var remaining [3]int
		for _, id := range racers(r) { remaining[rc.rosterTeams[id]]++ }
		if remaining[1] > 0 { winner = 1 } else if remaining[2] > 0 { winner = 2 } else { winner = 0 }
	}
	d.eventSequence++
	d.outcome = obj{{"reason", reason}, {"winningTeam", winner}, {"endedAt", endedAt}}
	rc.winningTeam, rc.finishDeadline = winner, &endedAt
	raceOverAt := endedAt + 3_000
	rc.raceOverAt = &raceOverAt
	order := slices.Clone(rc.rosterIDs)
	slices.SortStableFunc(order, func(a,b string) int {
		return cmp.Or(compareBool(rc.isOut(a), rc.isOut(b)), compareBool(winner != 0 && rc.rosterTeams[a] != winner, winner != 0 && rc.rosterTeams[b] != winner),
			cmp.Compare(d.players[b].kills, d.players[a].kills), cmp.Compare(d.players[a].deaths, d.players[b].deaths))
	})
	rc.results = make([]resultRow, 0, len(order))
	counted, in := firstSeatOfAccount(rc), rewards.RaceInput{}
	for i, id := range order {
		rc.results = append(rc.results, resultRow{playerID: id, rank: i+1, points: d.players[id].kills})
		if counted(id) { in.Racers = append(in.Racers, rewards.Racer{PlayerID: id, Team: rc.rosterTeams[id], Rank: i+1,
			Finished: !rc.isOut(id) && endedAt-*rc.startAt >= minRewardedRaceMs}) }
		d.players[id].respawnAt = nil
	}
	rc.resultsSet = true
	l.setRewards(r, in, rc.outIDs)
	r.phase = "finished"
	r.revision++
	l.saveResults(r)
	l.broadcastRoom(r, nil)
}
