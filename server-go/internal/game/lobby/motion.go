package lobby

import (
	"encoding/binary"
	"math"
	"slices"
)

// Motion frames are the binary race channel: a 56-byte header (little-endian
// magic 19277, payload type, recipient slot mask, room/race/player UUIDs and
// a sequence) plus an 80–178 byte payload.
const (
	motionMagic     = 19_277
	motionMinLength = 136
	motionMaxLength = 234
)

// RelayMotion forwards a racer's motion frame to the loaded racers named by
// the recipient mask (Java relayMotion). Invalid frames are dropped silently.
func (l *Lobby) RelayMotion(c *Client, frame []byte) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if c.roomID == "" || len(frame) < motionMinLength || len(frame) > motionMaxLength {
		return
	}
	if binary.LittleEndian.Uint16(frame) != motionMagic || int8(frame[2]) < 1 || int8(frame[2]) > 10 {
		return
	}
	r := l.rooms[c.roomID]
	if r == nil || r.race == nil ||
		(r.phase != "loading" && r.phase != "countdown" && r.phase != "racing") ||
		formatUUID(frame[4:20]) != r.id || formatUUID(frame[20:36]) != r.race.id ||
		formatUUID(frame[36:52]) != c.playerID || !slices.Contains(r.race.loadedIDs, c.playerID) ||
		r.race.isOut(c.playerID) {
		return
	}
	if r.phase == "racing" {
		r.race.recordProgress(c.playerID, frame, l.clock.Now())
	}
	recipientMask := int(frame[3])
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

// Race progress: the kinematic kinds 4..10 (rewrite payload.ts) carry the
// racer's route distance as a little-endian float64, in meters, at payload
// offset 108, and its lap as a little-endian uint32 at 116.
const (
	motionHeaderLength = 56
	progressOffset     = motionHeaderLength + 108
	lapOffset          = motionHeaderLength + 116
	// A reported distance is capped at what 500 km/h since the start (plus
	// a little slack) could cover.
	maxRaceSpeed  = 140.0 // m/s
	progressSlack = 100.0 // m
)

// kinematicPayloadLength is the payload length of a kinematic motion kind
// (payload.ts decodeKinematicSample), or 0 for kind 1.
func kinematicPayloadLength(kind int) int {
	var length int
	switch {
	case kind < 2 || kind > 10:
		return 0
	case kind == 8 || kind == 10:
		length = 166
	case kind >= 7:
		length = 149
	case kind == 6:
		length = 137
	case kind == 5:
		length = 128
	case kind == 4:
		length = 124
	case kind == 3:
		length = 108
	default:
		length = 80
	}
	if kind >= 9 {
		length += 12
	}
	return length
}

// recordProgress keeps the furthest route distance a racer reported while
// racing and before its finish, and its latest distance and lap (the live
// order of an item race). Frames of another length than their kind implies,
// non-finite or non-positive distances are ignored.
func (rc *race) recordProgress(playerID string, frame []byte, now int64) {
	kind := int(frame[2])
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
	distance = min(distance, float64(now-*rc.startAt)/1000*maxRaceSpeed+progressSlack)
	previous, seen := rc.current[playerID]
	sample := routeSample{distance: distance, lap: int(binary.LittleEndian.Uint32(frame[lapOffset:]))}
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
