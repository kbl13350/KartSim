package lobby

import (
	"encoding/binary"
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
		formatUUID(frame[36:52]) != c.playerID || !slices.Contains(r.race.loadedIDs, c.playerID) {
		return
	}
	recipientMask := int(frame[3])
	for _, m := range r.members {
		if m.playerID == c.playerID || recipientMask&(1<<m.slot) == 0 ||
			!slices.Contains(r.race.loadedIDs, m.playerID) {
			continue
		}
		if recipient := l.clients[m.playerID]; recipient != nil {
			recipient.sink.Binary(frame)
		}
	}
}
