package lobby

import (
	"encoding/binary"
	"math"
	"slices"
	"strconv"
)

// Motion frames are the binary race channel. Protocol 40 (client motion.ts)
// has an 8-byte header — payload kind, recipient slot mask, the sender's
// room slot, the race tag (the first byte of the race UUID) and a uint32
// sequence — plus an 80–163 byte payload. The release's 56-byte header named
// the room, race and player by UUID instead; the node knows the sender's
// room from its connection and stamps its slot, so neither is trusted from
// the frame.
const (
	motionHeaderLength  = 8
	motionMinLength     = motionHeaderLength + 80
	motionMaxLength     = motionHeaderLength + 163
	motionMaskOffset    = 1
	motionSlotOffset    = 2
	motionRaceTagOffset = 3
)

// motionRaceTag is the race tag motion frames carry.
func motionRaceTag(raceID string) byte {
	tag, _ := strconv.ParseUint(raceID[:2], 16, 8)
	return byte(tag)
}

// RelayMotion forwards a racer's motion frame to the loaded racers named by
// the recipient mask (Java relayMotion). Invalid frames, and frames tagged
// with another race (sent before this one started), are dropped silently.
// Not in Java: a frame whose payload the browsers cannot decode is never
// relayed (one would drop each receiver's connection), and while racing the
// anti-cheat checks each frame (ANTICHEAT.md); the frame that fails a check
// is not relayed either.
func (l *Lobby) RelayMotion(c *Client, frame []byte) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if c.roomID == "" || c.kicked || len(frame) < motionMinLength || len(frame) > motionMaxLength ||
		frame[0] < 1 || frame[0] > 10 {
		return
	}
	r := l.rooms[c.roomID]
	if r == nil || r.race == nil ||
		(r.phase != "loading" && r.phase != "countdown" && r.phase != "racing") ||
		frame[motionRaceTagOffset] != motionRaceTag(r.race.id) ||
		!slices.Contains(r.race.loadedIDs, c.playerID) || r.race.isOut(c.playerID) {
		return
	}
	sender := r.member(c.playerID)
	if sender == nil {
		return
	}
	kind, payload := int(frame[0]), frame[motionHeaderLength:]
	valid := validPayload(kind, payload)
	if g := l.guard(r, c.playerID); g != nil && (!valid || (r.phase == "racing" && !r.race.hasFinished(c.playerID))) {
		if l.cheated(r, c, g.Motion(kind, valid, l.clock.Now(), payload)) {
			return
		}
	}
	if !valid {
		return
	}
	if r.phase == "racing" {
		r.race.recordProgress(c.playerID, frame, l.clock.Now(), r.race.progressCap)
	}
	// Receivers name the sender by this slot.
	frame[motionSlotOffset] = byte(sender.slot)
	recipientMask := int(frame[motionMaskOffset])
	for _, m := range r.members {
		if m.playerID == c.playerID || recipientMask&(1<<m.slot) == 0 ||
			!slices.Contains(r.race.loadedIDs, m.playerID) || r.race.isOut(m.playerID) {
			continue
		}
		if recipient := l.clients[m.playerID]; recipient != nil {
			recipient.sink.Binary(frame)
		}
	}
}

// Race progress: the kinematic kinds 4..10 (client payload.ts) carry the
// racer's route distance as a little-endian float64, in meters, at payload
// offset 108, and its lap as a little-endian uint32 at 116.
const (
	progressOffset = motionHeaderLength + 108
	lapOffset      = motionHeaderLength + 116
)

// Without the anti-cheat plugin's opinion (cheat.Race.ProgressCap), a
// reported distance is capped at what 500 km/h since the start (plus a
// little slack) could cover.
const (
	maxRaceSpeed  = 140.0 // m/s
	progressSlack = 100.0 // m
)

// progressCap bounds the route distance a racer may have reached racedMs
// after the start at the lap it reports: the plugin's cap (which knows the
// track's warps), or maxRaceSpeed since the start plus progressSlack.
func (rc *race) progressCap(lap int, racedMs int64) float64 {
	if rc.cheat != nil {
		if limit, ok := rc.cheat.ProgressCap(lap, racedMs); ok {
			return limit
		}
	}
	return float64(racedMs)/1000*maxRaceSpeed + progressSlack
}

// recordProgress keeps the furthest route distance a racer reported while
// racing and before its finish, and its latest distance and lap (the live
// order of an item race). Frames of another length than their kind implies,
// non-finite or non-positive distances are ignored; distances are capped by
// limit (progressCap).
func (rc *race) recordProgress(playerID string, frame []byte, now int64, limit func(lap int, racedMs int64) float64) {
	kind := int(frame[0])
	if kind < 4 || len(frame) != motionHeaderLength+kinematicPayloadLength(kind) ||
		rc.startAt == nil || now <= *rc.startAt {
		return
	}
	for _, finished := range rc.finishes {
		if finished.playerID == playerID {
			return
		}
	}
	distance := math.Float64frombits(binary.LittleEndian.Uint64(frame[progressOffset:]))
	if math.IsNaN(distance) || math.IsInf(distance, 0) || distance <= 0 {
		return
	}
	lap := int(binary.LittleEndian.Uint32(frame[lapOffset:]))
	distance = min(distance, limit(lap, now-*rc.startAt))
	previous, seen := rc.current[playerID]
	sample := routeSample{distance: distance, lap: lap}
	rc.current[playerID] = sample
	if distance > rc.progress[playerID] {
		rc.progress[playerID] = distance
	}
	if rc.items != nil && seen && sample.lap > previous.lap && !rc.leads(playerID) {
		// Crossed the line while not leading: no 唯我独尊 (ITEM_MODE.md C.9).
		rc.lapTrailed[playerID] = true
	}
}

// leads reports whether a racer leads the live order: nobody has finished
// and no other racer still in the race is further along the route.
func (rc *race) leads(playerID string) bool {
	if len(rc.finishes) > 0 {
		return false
	}
	distance := rc.current[playerID].distance
	for _, id := range rc.loadedIDs {
		if id != playerID && !rc.isOut(id) && rc.current[id].distance > distance {
			return false
		}
	}
	return true
}
