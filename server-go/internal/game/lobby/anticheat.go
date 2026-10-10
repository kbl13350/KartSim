package lobby

import (
	"net/http"

	"kartsim/internal/game/anticheat"
	"kartsim/internal/shared/contract"
)

// The anti-cheat kick (ANTICHEAT.md 3): the racer gets the unsolicited
// error CHEAT_DETECTED (with "check": the failed check), leaves its room
// and race at once, and its connection closes once that error is written,
// with 1008 policy violation. Its later commands answer CHEAT_DETECTED and
// its motion frames are dropped until then.
const (
	CheatCloseCode   = 1008
	CheatCloseReason = "anti-cheat"
	cheatCode        = "CHEAT_DETECTED"
)

// cheatTrack is what the checks know about the race's track: nil for
// another resource version than the exported p3553 data, and one lap for
// an LTE race (the browser races LTE maps over a single lap).
func cheatTrack(r *room) *anticheat.Track {
	if r.resourceVersion != "p3553" || r.race == nil {
		return nil
	}
	track := anticheat.TrackByID(r.race.trackID)
	if track != nil && r.gameplay == "lte" {
		single := *track
		single.Laps = 1
		return &single
	}
	return track
}

// guard is a racer's anti-cheat state in the room's race, created with the
// race's start once the race is counting down.
func (l *Lobby) guard(r *room, playerID string) *anticheat.Racer {
	rc := r.race
	if rc.guards == nil {
		rc.guards = map[string]*anticheat.Racer{}
	}
	g := rc.guards[playerID]
	if g == nil {
		var startAt int64
		if rc.startAt != nil {
			startAt = *rc.startAt
		}
		g = anticheat.NewRacer(l.cheatLimits, cheatTrack(r), startAt)
		rc.guards[playerID] = g
	}
	return g
}

// othersRacing reports whether a racer other than playerID is still in the
// race (loaded, not out): it receives playerID's motion frames, so they
// reach the server all race long.
func othersRacing(rc *race, playerID string) bool {
	for _, id := range rc.loadedIDs {
		if id != playerID && !rc.isOut(id) {
			return true
		}
	}
	return false
}

// cheated acts on a failed check of c in r's race: it records the
// violation (contract.AntiCheatReport through the recorder) and logs it,
// then kicks c in kick mode and reports true. In log mode it reports false
// and records each check of a racer once per race.
func (l *Lobby) cheated(r *room, c *Client, v *anticheat.Violation) bool {
	rc := r.race
	action := contract.AntiCheatKick
	if l.cheatMode == anticheat.ModeLog {
		action = contract.AntiCheatLog
		key := c.playerID + "|" + v.Code
		if rc.cheatLogged == nil {
			rc.cheatLogged = map[string]bool{}
		}
		if rc.cheatLogged[key] {
			return false
		}
		rc.cheatLogged[key] = true
	}
	l.log.Warn("anti-cheat", "action", action, "check", v.Code, "detail", v.Detail, "player", c.playerID,
		"account", c.accountID, "name", c.name, "room", r.id, "race", rc.id, "track", rc.trackID,
		"gameplay", r.gameplay)
	l.recorder.SaveAntiCheat(contract.AntiCheatReport{
		NodeID: l.nodeID, EventID: newUUID(), PlayerID: c.playerID, AccountID: c.accountID, Name: c.name,
		RoomID: r.id, RaceID: rc.id, TrackID: rc.trackID, Gameplay: r.gameplay, Code: v.Code,
		Detail: v.Detail, Action: action, At: l.wall().UnixMilli()})
	if action != contract.AntiCheatKick {
		return false
	}
	c.kicked = true
	c.emit(ErrorMessage(cheatCode, map[string]any{"check": v.Code}, ""))
	l.leaveInternal(c, r)
	if closer, ok := c.sink.(Closer); ok {
		closer.Close(CheatCloseCode, CheatCloseReason)
	} else {
		l.log.Warn("cannot close a kicked session", "player", c.playerID)
	}
	return true
}

// errCheatDetected answers the commands of a kicked racer, and the command
// that got it kicked.
func errCheatDetected() error { return fail(http.StatusForbidden, cheatCode) }
