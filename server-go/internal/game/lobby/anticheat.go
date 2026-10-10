package lobby

import (
	"net/http"
	"slices"

	"kartsim/internal/game/cheat"
	"kartsim/internal/shared/contract"
)

// The anti-cheat kick (ANTICHEAT.md): the racer gets the unsolicited error
// CHEAT_DETECTED (with "check": the failed check), leaves its room and race
// at once, and its connection closes once that error is written, with 1008
// policy violation. Its later commands answer CHEAT_DETECTED and its motion
// frames are dropped until then.
const (
	CheatCloseCode   = 1008
	CheatCloseReason = "anti-cheat"
	cheatCode        = "CHEAT_DETECTED"
)

// startCheatRace registers a race that starts counting down with the
// anti-cheat plugin (Options.AntiCheat).
func (l *Lobby) startCheatRace(r *room) {
	rc := r.race
	if l.antiCheat == nil || rc.startAt == nil || rc.cheat != nil {
		return
	}
	rc.cheat = l.antiCheat.StartRace(cheat.RaceInfo{TrackID: rc.trackID, Gameplay: r.gameplay, Mode: r.mode,
		ResourceVersion: r.resourceVersion, Speed: r.speed, StartAt: *rc.startAt}, l.clock.Now())
}

// endCheat tells the plugin a race is over (it is dropped from its room).
func (rc *race) endCheat() {
	if rc != nil && rc.cheat != nil {
		rc.cheat.End()
		rc.cheat = nil
	}
}

// guard is a racer's anti-cheat state in the room's race, nil without a
// plugin or before the race counts down.
func (l *Lobby) guard(r *room, playerID string) cheat.Racer {
	rc := r.race
	if rc == nil || rc.cheat == nil {
		return nil
	}
	if rc.guards == nil {
		rc.guards = map[string]cheat.Racer{}
	}
	g := rc.guards[playerID]
	if g == nil {
		g = rc.cheat.Racer(playerID, racerKart(rc, playerID))
		rc.guards[playerID] = g
	}
	return g
}

// racerKart is the kart a racer brought to the race (its frozen
// equipment; 0, the practice kart, without one).
func racerKart(rc *race, playerID string) int {
	if i := slices.Index(rc.rosterIDs, playerID); i >= 0 && i < len(rc.rosterEquipment) {
		return equipmentOf(rc.rosterEquipment[i]).Kart
	}
	return 0
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

// cheated acts on a violation the plugin reported for c in r's race: it
// records it (contract.AntiCheatReport through the recorder) and logs it,
// then, when the plugin asks to kick, kicks c and reports true.
func (l *Lobby) cheated(r *room, c *Client, v *cheat.Violation) bool {
	if v == nil {
		return false
	}
	rc := r.race
	action := contract.AntiCheatLog
	if v.Action == cheat.ActionKick {
		action = contract.AntiCheatKick
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

// logCheatStats logs the fields the plugin returned with a finish (its
// accounting, for calibrating its limits).
func (l *Lobby) logCheatStats(r *room, c *Client, stats map[string]any) {
	if len(stats) == 0 {
		return
	}
	args := []any{"player", c.playerID, "account", c.accountID, "name", c.name, "race", r.race.id,
		"track", r.race.trackID, "mode", r.mode}
	keys := make([]string, 0, len(stats))
	for key := range stats {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	for _, key := range keys {
		args = append(args, key, stats[key])
	}
	l.log.Info("anti-cheat stats", args...)
}

// errCheatDetected answers the commands of a kicked racer, and the command
// that got it kicked.
func errCheatDetected() error { return fail(http.StatusForbidden, cheatCode) }
