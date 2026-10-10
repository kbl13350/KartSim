// Package cheat is the game node's side of the anti-cheat (ANTICHEAT.md):
// the events the lobby reports about each race and racer, and the
// violations it acts on. The checks themselves live in a separately built
// plugin (package plugin loads it); without one the node checks nothing
// beyond refusing to relay motion frames the browsers cannot decode.
//
// The lobby calls a Guard and everything it returns under its lock, one
// call at a time; none of them may block.
package cheat

// Actions the node takes about a violation.
const (
	// ActionKick: record the violation and kick the racer.
	ActionKick = "kick"
	// ActionLog: only record it.
	ActionLog = "log"
)

// Violation is a failed check: its code, the measured values and what
// the node should do about it.
type Violation struct {
	Code   string `json:"code"`
	Detail string `json:"detail"`
	Action string `json:"action"`
}

// RaceInfo describes a race once it counts down; StartAt is its start on
// the node clock (ms).
type RaceInfo struct {
	TrackID         string `json:"trackId"`
	Gameplay        string `json:"gameplay"`
	Mode            string `json:"mode"`
	ResourceVersion string `json:"resourceVersion"`
	Speed           int    `json:"speed"`
	StartAt         int64  `json:"startAt"`
}

// Finish is a racer's finish as the node saw it: the time it reported, the
// race time the node observed, the furthest route distance its frames
// reported and whether its frames should have reached the node all race
// long (another racer was still in the race to receive them).
type Finish struct {
	ElapsedMs    int     `json:"elapsedMs"`
	RacedMs      int64   `json:"racedMs"`
	Progress     float64 `json:"progress"`
	ExpectFrames bool    `json:"expectFrames"`
}

// Guard checks the races of one node.
type Guard interface {
	// StartRace registers a race at now (the node clock, ms).
	StartRace(info RaceInfo, now int64) Race
}

// Race is one race of a Guard.
type Race interface {
	// Racer registers a racer with the kart item it races with (0: the
	// practice kart).
	Racer(playerID string, kart int) Racer
	// ProgressCap is the most route distance a racer may have reached
	// racedMs after the start at lap (false: no opinion).
	ProgressCap(lap int, racedMs int64) (float64, bool)
	// End forgets the race.
	End()
}

// Racer is one racer of a Race.
type Racer interface {
	// Motion checks a motion frame's payload of kind received at now;
	// valid is false for one the browsers cannot decode (the node drops it
	// whatever the answer).
	Motion(kind int, valid bool, now int64, payload []byte) *Violation
	// Finish checks a finish; stats are fields for the node's log.
	Finish(f Finish) (v *Violation, stats map[string]any)
	// ItemUse reports an item use the node accepted.
	ItemUse(itemID int)
	// Cube checks an item cube eaten at now.
	Cube(cubeID int, now int64) *Violation
	// TeamCharge checks a team-charge report at now.
	TeamCharge(amount float64, now int64) *Violation
}
