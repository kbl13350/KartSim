package lobby

import (
	"math"
	"math/rand/v2"
	"net/http"
	"slices"
)

// 勇者组队竞速 (deadRacingTeam, game type 31): two equal teams race
// opposite ways on the same track. Direction and grid are frozen per race.
const braveTrack = "village_R07"

func validateBraveStart(r *room) error {
	if r.gameplay != "brave" {
		return nil
	}
	if err := validateCreation(r.gameplay, r.channelName, r.resourceVersion, r.capacity); err != nil {
		return err
	}
	if r.mode != "team" || r.speed != 7 {
		return fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	if r.randomTrackCode != nil || r.trackID != braveTrack {
		return fail(http.StatusBadRequest, "INVALID_TRACK")
	}
	if len(r.members) < 4 {
		return fail(http.StatusBadRequest, "NOT_ENOUGH_PLAYERS")
	}
	if len(r.members) > r.capacity || len(r.members)%2 != 0 {
		return fail(http.StatusBadRequest, "BRAVE_TEAMS_UNBALANCED")
	}
	var counts [3]int
	for _, member := range r.members {
		if member.team != 1 && member.team != 2 {
			return fail(http.StatusBadRequest, "TEAM_REQUIRED")
		}
		counts[member.team]++
	}
	// Random teams are dealt immediately after this check and always split an
	// even roster equally. Chosen teams must already have equal numbers.
	if !r.randomTeam && counts[1] != counts[2] {
		return fail(http.StatusBadRequest, "BRAVE_TEAMS_UNBALANCED")
	}
	return nil
}

func freezeBraveRace(rc *race) {
	rc.brave = obj{{"ruleset", "web-brave-v1"}, {"forwardTeam", rand.IntN(2) + 1}}
	rc.braveCollisionAt = map[string]int64{}
	rc.bravePositions = map[string]bravePosition{}
	grid := [2][]int{rand.Perm(4), rand.Perm(4)}
	var next [2]int
	for i, id := range rc.rosterIDs {
		team := rc.rosterTeams[id] - 1
		slot := team*4 + grid[team][next[team]]
		next[team]++
		rc.startSlots[i] = slot
		rc.roster[i] = rc.roster[i].with("slot", slot)
	}
}

// Brave race slots may differ from the room seats. Binary masks and sender
// identities must refer to the same frozen slots the clients received.
func raceMotionSlot(r *room, m *member) int {
	if r.race.brave != nil {
		if index := slices.Index(r.race.rosterIDs, m.playerID); index >= 0 {
			return r.race.startSlots[index]
		}
	}
	return m.slot
}

type bravePosition struct {
	x, y, z float64
	at      int64
}

func (rc *race) recordBravePosition(id string, kind int, payload []byte, now int64) {
	if rc.brave == nil || kind < 2 || rc.hasFinished(id) {
		return
	}
	rc.bravePositions[id] = bravePosition{float64(f32(payload, 4)), float64(f32(payload, 8)),
		float64(f32(payload, 12)), now}
}

// braveCollision is only a HUD cue. It does not change physics, ranking or
// rewards, and never accepts a caller-supplied sender identity.
func (l *Lobby) braveCollision(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.gameplay != "brave" {
		return nil, fail(http.StatusBadRequest, "BRAVE_REQUIRED")
	}
	if r.phase != "racing" {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_RUNNING")
	}
	rc := r.race
	if !rc.isLoaded(c.playerID) || rc.hasFinished(c.playerID) {
		return nil, fail(http.StatusForbidden, "NOT_RACE_PARTICIPANT")
	}
	target, err := in.text("targetId", 1, 64)
	if err != nil {
		return nil, err
	}
	if r.member(target) == nil || !rc.inRoster(target) || !rc.isLoaded(target) ||
		rc.isOut(target) || rc.hasFinished(target) || rc.rosterTeams[target] == rc.rosterTeams[c.playerID] {
		return nil, fail(http.StatusBadRequest, "INVALID_BRAVE_TARGET")
	}
	now := l.clock.Now()
	if at, sent := rc.braveCollisionAt[c.playerID]; sent && now-at < 300 {
		return nil, fail(http.StatusTooManyRequests, "BRAVE_COLLISION_COOLDOWN")
	}
	// Both positions must be recent. Direct P2P sessions may not provide both
	// samples, so missing/stale positions do not invent a spatial rejection.
	a, aOK := rc.bravePositions[c.playerID]
	b, bOK := rc.bravePositions[target]
	if aOK && bOK && now-a.at <= 500 && now-b.at <= 500 &&
		math.Hypot(math.Hypot(a.x-b.x, a.y-b.y), a.z-b.z) > 60 {
		return nil, fail(http.StatusBadRequest, "INVALID_BRAVE_TARGET")
	}
	rc.braveCollisionAt[c.playerID] = now
	event := obj{{"type", "brave-collision"}, {"roomId", r.id}, {"raceId", rc.id},
		{"playerId", c.playerID}, {"targetId", target}}
	l.broadcastPeerEvent(r, c, event)
	return event, nil
}

func braveRacerCounts(r *room) [3]int {
	var counts [3]int
	for _, id := range racers(r) {
		counts[r.race.rosterTeams[id]]++
	}
	return counts
}

func braveCanStart(r *room) bool {
	counts := braveRacerCounts(r)
	return counts[1] >= 2 && counts[1] == counts[2]
}

func braveTeamGone(r *room) bool {
	counts := braveRacerCounts(r)
	return counts[1] == 0 || counts[2] == 0
}

// A pre-start dropout must never turn this into an uneven race. If a whole
// team leaves after starting, cancel only when nobody has finished; otherwise
// the ordinary team scorer settles the recorded finishes without inventing
// a finish time or an undocumented forfeit score.
func cancelBraveRace(r *room, reason string) {
	r.race.endCheat()
	r.race = nil
	r.phase = "open"
	r.raceError = reason
}
