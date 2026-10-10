// Package anticheat is the game node's check of what racers report
// (ANTICHEAT.md). The node only relays motion frames and trusts each
// client's own physics, so it cannot know where a kart really is; what it
// can do is refuse reports no honest client sends: a motion frame the
// browsers cannot decode, a kart moving faster than any kart can, a
// position jump that is neither a reset nor one of the track's warps, a
// motion clock running ahead of the server's, route progress gained faster
// than driving allows, laps skipped, a finish the server's own timing or
// the track's length contradicts, item cubes eaten faster than a track lays
// them out.
//
// A Racer holds one racer's state for one race. It is plain data: the
// lobby calls it under its lock with the node's monotonic clock and acts
// on the violation it returns. The limits are generous on purpose — a
// false kick costs an honest player a race, so each check only fires on
// what physics or the track rules out, not on what is merely unusual.
package anticheat

import (
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"strings"
)

// Mode is what the node does about a violation (KART_ANTICHEAT).
type Mode int

const (
	// ModeKick records the violation and kicks the racer (the default).
	ModeKick Mode = iota
	// ModeLog only records it (and logs it), once per check and racer and
	// race: for tuning the limits on a live node.
	ModeLog
	// ModeOff checks nothing.
	ModeOff
)

// ParseMode reads KART_ANTICHEAT: kick (or empty), log, off.
func ParseMode(value string) (Mode, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "kick":
		return ModeKick, nil
	case "log":
		return ModeLog, nil
	case "off":
		return ModeOff, nil
	}
	return ModeKick, errors.New("KART_ANTICHEAT 只能是 kick、log 或 off")
}

func (m Mode) String() string {
	switch m {
	case ModeLog:
		return "log"
	case ModeOff:
		return "off"
	}
	return "kick"
}

// The checks (contract.AntiCheatCodes; CodeBadFrame is in validate.go).
const (
	CodeTeleport    = "TELEPORT"     // a position jump that is neither a reset nor a warp
	CodeSpeed       = "SPEED"        // faster than MaxSpeed over a window
	CodeClock       = "CLOCK"        // motion ticks ahead of the server clock
	CodeProgress    = "PROGRESS"     // route distance gained faster than driving
	CodeLap         = "LAP"          // laps skipped
	CodeFinishTime  = "FINISH_TIME"  // a finish time far below the server's timing
	CodeFinishEarly = "FINISH_EARLY" // a finish with too little route behind it
	CodeFinishFast  = "FINISH_FAST"  // a finish faster than the track can be driven
	CodeCubeRate    = "CUBE_RATE"    // item cubes eaten too fast
)

// Violation is a failed check: its code and the measured values.
type Violation struct {
	Code   string
	Detail string
}

func violation(code, format string, args ...any) *Violation {
	return &Violation{Code: code, Detail: fmt.Sprintf(format, args...)}
}

// Limits are the thresholds of the checks.
type Limits struct {
	// MaxSpeed bounds a kart's horizontal speed (m/s). Engine, boosters,
	// draft and dual stack to about 131 m/s, but track jump pads (the JM
	// and DJ roads) may set up to about 198 m/s for a moment: 200 m/s.
	// Height is left out: falls under 6 g and jump pads move karts up and
	// down far faster, and a vertical jump gains a racer nothing.
	MaxSpeed float64
	// TeleportSlack is the jump (m) allowed between two frames on top of
	// what MaxSpeed covers in the time between them.
	TeleportSlack float64
	// SpeedWindowMs is the span over which the straight-line distance
	// driven must stay within MaxSpeed (plus SpeedSlack meters).
	SpeedWindowMs int64
	SpeedSlack    float64
	// ClockAheadMs bounds how far a frame's tick may run ahead of the
	// server clock it was synchronised with (the offset's error is half
	// the best round trip; receivers ignore frames 2 s in the future).
	ClockAheadMs int64
	// ProgressSpeed bounds the route distance a racer gains per second
	// (m/s), on top of one section's length per frame (the track's Jump: a
	// warp, a shortcut over a section, a rail landing) and ProgressSlack.
	// The race total may also gain the warp sections of each lap.
	ProgressSpeed float64
	ProgressSlack float64
	// WarpRadius is how close (m, horizontally, plus what MaxSpeed covers
	// since the previous frame) a jump must land to one of the track's
	// warp exits to count as that warp; WarpsPerMinute bounds the warps.
	// On a track without data (another resource version) a jump counts as
	// a warp when the route distance stays within UnknownJump across it.
	WarpRadius     float64
	WarpsPerMinute int
	UnknownJump    float64
	// ResetMaxMs is how long a reset may last (its frames are exempt from
	// the jump checks; the browser sends them for 2 s); ResetGapMs the
	// least time between the starts of two resets.
	ResetMaxMs int64
	ResetGapMs int64
	// FinishSlackMs is how much shorter than the server's own timing a
	// finish time may be (latency, the clock offset's error).
	FinishSlackMs int64
	// FinishLapShare is the share of laps × the track's shortest lap a
	// finisher's route progress must reach (FinishProgressSlack meters
	// less: frames trail the finish by up to half a second); a racer on a
	// track without data must have gained at least MinAverageSpeed of
	// route per second raced.
	FinishLapShare      float64
	FinishProgressSlack float64
	MinAverageSpeed     float64
	// FinishSpeed bounds the average speed of a finish over the drivable
	// distance (laps × the track's Drive, warps left out), FinishShare of
	// it allowed for shortcuts the route does not model.
	FinishSpeed float64
	FinishShare float64
	// CubeWindowMs and CubeMax bound the distinct item cubes eaten in a
	// window. Cube rows hold 5 to 8 cubes 4 m apart and lie as close as
	// 23 m (village_C01: 42 m apart on average), so a fast kart passes up to
	// 7 rows a second and may touch two cubes of one: only spamming (more
	// than 15 cubes in 2 s) is refused.
	CubeWindowMs int64
	CubeMax      int
}

// DefaultLimits are the limits a node runs with.
func DefaultLimits() Limits {
	return Limits{
		MaxSpeed:            200,
		TeleportSlack:       50,
		SpeedWindowMs:       3_000,
		SpeedSlack:          30,
		ClockAheadMs:        5_000,
		ProgressSpeed:       140,
		ProgressSlack:       100,
		WarpRadius:          60,
		WarpsPerMinute:      6,
		UnknownJump:         3_500,
		ResetMaxMs:          2_500,
		ResetGapMs:          1_500,
		FinishSlackMs:       20_000,
		FinishLapShare:      0.9,
		FinishProgressSlack: 200,
		MinAverageSpeed:     15,
		FinishSpeed:         140,
		FinishShare:         0.9,
		CubeWindowMs:        2_000,
		CubeMax:             15,
	}
}

// ProgressCap is the most route distance a racer may have reached racedMs
// after the start at lap: driving at ProgressSpeed from the start plus
// ProgressSlack, and on a track with data the warp sections of each lap
// begun (Warp: route gained without driving) and one section more (Jump: a
// shortcut over a section, a rail landing).
func (lim Limits) ProgressCap(track *Track, lap int, racedMs int64) float64 {
	allowed := lim.ProgressSpeed*float64(max(racedMs, 0))/1000 + lim.ProgressSlack
	if track != nil && track.Lap > 0 {
		laps := float64(min(max(lap, 1), track.Laps))
		allowed += laps*track.Warp + track.Jump
	}
	return allowed
}

// Motion payload layout (rewrite/src/multiplayer/payload.ts), offsets
// within the payload after the frame header.
const (
	kinematicPositionOffset = 4   // float32 x, y, z (meters, wire axes: z is up)
	drivingPositionOffset   = 7   // kind 1: tick, three flag bytes, then the position
	progressDistanceOffset  = 108 // float64 route distance (m), kinds 4..10
	progressLapOffset       = 116 // uint32 lap
	resetStartOffset        = 124 // uint32 reset start tick, kind 5 and collision flag bit 1
	collisionFlagsOffset    = 136 // kinds 6..10: bit 0 collision, bit 1 resetting
)

// Sample is what one motion frame says about its sender.
type Sample struct {
	Tick uint32 // the sender's clock, synchronised with the server's (ms)
	// Pos is the position in wire axes: x and y horizontal, z up (m).
	Pos [3]float64
	// Resetting: the kart is in a reset (resetStartedAt is set); ResetAt
	// is its start tick.
	Resetting bool
	ResetAt   uint32
	// HasProgress: kinds 4..10 carry the route distance and lap.
	HasProgress bool
	Distance    float64
	Lap         int
}

// ParseSample reads a payload of kind (1..10) that ValidPayload accepted.
// It reports false for one too short for its kind or with a non-finite
// position.
func ParseSample(kind int, payload []byte) (Sample, bool) {
	var s Sample
	offset := kinematicPositionOffset
	if kind == 1 {
		offset = drivingPositionOffset
	}
	if kind < 1 || kind > 10 || len(payload) < offset+12 {
		return s, false
	}
	s.Tick = binary.LittleEndian.Uint32(payload)
	for i := range s.Pos {
		value := float64(math.Float32frombits(binary.LittleEndian.Uint32(payload[offset+4*i:])))
		if math.IsNaN(value) || math.IsInf(value, 0) {
			return s, false
		}
		s.Pos[i] = value
	}
	if kind < 4 {
		return s, true
	}
	if len(payload) < progressLapOffset+4 {
		return s, false
	}
	distance := math.Float64frombits(binary.LittleEndian.Uint64(payload[progressDistanceOffset:]))
	if !math.IsNaN(distance) && !math.IsInf(distance, 0) {
		s.HasProgress = true
		s.Distance = distance
		s.Lap = int(binary.LittleEndian.Uint32(payload[progressLapOffset:]))
	}
	switch {
	case kind == 5 && len(payload) >= resetStartOffset+4:
		s.Resetting = true
	case kind >= 6 && len(payload) > collisionFlagsOffset:
		s.Resetting = payload[collisionFlagsOffset]&2 != 0
	}
	if s.Resetting {
		s.ResetAt = binary.LittleEndian.Uint32(payload[resetStartOffset:])
	}
	return s, true
}

// ticksBetween is b - a in ms on the wrapping uint32 tick clock.
func ticksBetween(a, b uint32) int64 { return int64(int32(b - a)) }

// horizontal is the horizontal distance between two wire positions.
func horizontal(a, b [3]float64) float64 { return math.Hypot(a[0]-b[0], a[1]-b[1]) }

// point is one accepted position.
type point struct {
	tick uint32
	pos  [3]float64
}

// Racer is one racer's anti-cheat state in one race.
type Racer struct {
	limits Limits
	// track is the race's track (nil without data); startAt the race
	// start on the server clock.
	track   *Track
	startAt int64

	// last is the latest accepted frame (in tick order); window the
	// positions since the latest reset or warp, for the speed check.
	last   *Sample
	window []point
	// progress is the latest frame with route progress.
	progress *Sample
	// resetAt is the start tick of the latest reset seen (resetSeen: one
	// was seen).
	resetAt   uint32
	resetSeen bool
	// warps are the ticks of the warps taken in the last minute.
	warps []uint32
	// cubes are the server times of the cubes eaten in the cube window,
	// lastCube the latest cube.
	cubes    []int64
	lastCube int
	// frames counts the frames checked.
	frames int
}

// NewRacer returns a racer with no history in a race on track (nil when
// the node has no data for it) that started at startAt (server clock, ms).
func NewRacer(limits Limits, track *Track, startAt int64) *Racer {
	return &Racer{limits: limits, track: track, startAt: startAt}
}

// Frames is how many motion frames were checked.
func (r *Racer) Frames() int { return r.frames }

// jump is the most route distance one frame may add on top of driving.
func (r *Racer) jump() float64 {
	if r.track != nil {
		return r.track.Jump
	}
	return r.limits.UnknownJump
}

// Motion checks one motion frame received at now (the server clock, ms,
// the clock the sender's ticks are synchronised with) while racing.
func (r *Racer) Motion(s Sample, now int64) *Violation {
	lim := r.limits
	if ahead := ticksBetween(uint32(now), s.Tick); ahead > lim.ClockAheadMs {
		return violation(CodeClock, "运动帧时钟比服务器快 %d ms（上限 %d ms）", ahead, lim.ClockAheadMs)
	}
	if r.last != nil && ticksBetween(r.last.Tick, s.Tick) <= 0 {
		// Out of order (the WebRTC motion channel is unordered) or repeated:
		// the newer frame was checked already.
		return nil
	}
	r.frames++
	v := r.checkProgress(s, now)
	if v == nil {
		v = r.checkMovement(s)
	}
	if v != nil {
		// Later frames (log mode keeps checking) start over from this one.
		r.window = append(r.window[:0], point{tick: s.Tick, pos: s.Pos})
	}
	copied := s
	r.last = &copied
	if s.HasProgress {
		r.progress = &copied
	}
	return v
}

// checkProgress bounds the route distance gained since the previous frame
// with progress and since the start, and the laps.
func (r *Racer) checkProgress(s Sample, now int64) *Violation {
	if !s.HasProgress {
		return nil
	}
	lim := r.limits
	if r.track != nil && s.Lap > r.track.Laps+1 {
		return violation(CodeLap, "圈数 %d 超过本赛道 %d 圈", s.Lap, r.track.Laps)
	}
	if r.track != nil && r.track.Lap > 0 {
		if allowed := lim.ProgressCap(r.track, s.Lap, now-r.startAt); s.Distance > allowed {
			return violation(CodeProgress, "开赛 %.1f 秒路线进度 %.0f m（上限 %.0f m）",
				float64(now-r.startAt)/1000, s.Distance, allowed)
		}
	}
	previous := r.progress
	if previous == nil {
		return nil
	}
	seconds := float64(ticksBetween(previous.Tick, s.Tick)) / 1000
	if gained, allowed := s.Distance-previous.Distance, lim.ProgressSpeed*seconds+r.jump()+lim.ProgressSlack; gained > allowed {
		return violation(CodeProgress, "%.0f ms 内路线进度增加 %.0f m（上限 %.0f m）", seconds*1000, gained, allowed)
	}
	if s.Lap > previous.Lap+1 {
		return violation(CodeLap, "圈数从 %d 跳到 %d", previous.Lap, s.Lap)
	}
	return nil
}

// checkMovement bounds the horizontal position change: a jump between two
// frames and the straight-line speed over SpeedWindowMs. A reset (bounded
// in length and frequency) or one of the track's warps (bounded in
// frequency) starts over from the new position.
func (r *Racer) checkMovement(s Sample) *Violation {
	lim := r.limits
	here := point{tick: s.Tick, pos: s.Pos}
	previous := r.last
	if previous == nil || r.resetting(s) || r.resetting(*previous) {
		r.window = append(r.window[:0], here)
		return nil
	}
	seconds := float64(ticksBetween(previous.Tick, s.Tick)) / 1000
	moved, allowed := horizontal(previous.Pos, s.Pos), lim.MaxSpeed*seconds+lim.TeleportSlack
	if moved > allowed {
		if !r.warp(*previous, s) {
			return violation(CodeTeleport, "%.0f ms 内坐标移动 %.0f m（上限 %.0f m）", seconds*1000, moved, allowed)
		}
		r.window = append(r.window[:0], here)
		return nil
	}
	keep := 0
	for keep < len(r.window) && ticksBetween(r.window[keep].tick, s.Tick) > lim.SpeedWindowMs {
		keep++
	}
	r.window = append(r.window[keep:], here)
	// The oldest position within the window, once it spans half of it.
	if oldest := r.window[0]; ticksBetween(oldest.tick, s.Tick) >= lim.SpeedWindowMs/2 {
		span := float64(ticksBetween(oldest.tick, s.Tick)) / 1000
		if moved, allowed := horizontal(oldest.pos, s.Pos), lim.MaxSpeed*span+lim.SpeedSlack; moved > allowed {
			return violation(CodeSpeed, "%.0f ms 内直线移动 %.0f m，约 %.0f km/h（上限 %.0f km/h）",
				span*1000, moved, moved/span*3.6, lim.MaxSpeed*3.6)
		}
	}
	return nil
}

// resetting reports whether s is a frame of a reset that may move the
// kart: one that started at most ResetMaxMs before it and, if it is a new
// reset, at least ResetGapMs after the previous one (it is remembered).
func (r *Racer) resetting(s Sample) bool {
	if !s.Resetting {
		return false
	}
	if age := ticksBetween(s.ResetAt, s.Tick); age < 0 || age > r.limits.ResetMaxMs {
		return false
	}
	if r.resetSeen && s.ResetAt != r.resetAt {
		if ticksBetween(r.resetAt, s.ResetAt) < r.limits.ResetGapMs {
			return false
		}
	}
	r.resetSeen, r.resetAt = true, s.ResetAt
	return true
}

// warp reports whether a position jump from a to b is a track warp, and
// counts it: b lies near one of the track's warp exits (on a track without
// data: the route distance stays within UnknownJump across the jump), and
// the racer took fewer than WarpsPerMinute warps in the last minute.
func (r *Racer) warp(a, b Sample) bool {
	lim := r.limits
	seconds := float64(ticksBetween(a.Tick, b.Tick)) / 1000
	if r.track != nil {
		near := false
		for _, exit := range r.track.Warps {
			near = near || horizontal(exit, b.Pos) <= lim.WarpRadius+lim.MaxSpeed*seconds
		}
		if !near {
			return false
		}
	} else if !a.HasProgress || !b.HasProgress ||
		math.Abs(b.Distance-a.Distance) > lim.UnknownJump+lim.ProgressSpeed*seconds {
		return false
	}
	keep := 0
	for keep < len(r.warps) && ticksBetween(r.warps[keep], b.Tick) > 60_000 {
		keep++
	}
	r.warps = r.warps[keep:]
	if len(r.warps) >= lim.WarpsPerMinute {
		return false
	}
	r.warps = append(r.warps, b.Tick)
	return true
}

// Finish checks a finish reporting elapsedMs after the server saw racedMs
// of racing (finish received minus the start). progress is the furthest
// route distance the racer's frames reported (0 without any), and
// expectFrames whether its frames should have reached the server all race
// long (another racer still in the race received them).
func (r *Racer) Finish(elapsedMs int, racedMs int64, progress float64, expectFrames bool) *Violation {
	lim := r.limits
	if int64(elapsedMs)+lim.FinishSlackMs < racedMs {
		return violation(CodeFinishTime, "完赛用时 %d ms，服务器计时 %d ms（最多可短 %d ms）",
			elapsedMs, racedMs, lim.FinishSlackMs)
	}
	seconds := float64(min(int64(elapsedMs), racedMs)) / 1000
	if track := r.track; track != nil && track.Drive > 0 {
		least := float64(track.Laps) * track.Drive * lim.FinishShare / lim.FinishSpeed
		if float64(racedMs)/1000 < least {
			return violation(CodeFinishFast, "%.1f 秒完赛 %d 圈（本赛道至少 %.1f 秒）", float64(racedMs)/1000,
				track.Laps, least)
		}
	}
	if !expectFrames {
		return nil
	}
	if track := r.track; track != nil && track.Lap > 0 {
		least := float64(track.Laps)*track.Lap*lim.FinishLapShare - lim.FinishProgressSlack
		if progress < least {
			return violation(CodeFinishEarly, "完赛时路线进度 %.0f m（%d 圈至少 %.0f m）", progress, track.Laps, least)
		}
	} else if progress < lim.MinAverageSpeed*seconds {
		return violation(CodeFinishEarly, "完赛时路线进度只有 %.0f m（%.1f 秒至少 %.0f m）",
			progress, seconds, lim.MinAverageSpeed*seconds)
	}
	return nil
}

// Cube checks item cube cubeID eaten at now (the server clock, ms). The
// same cube again is not counted (the item rules grant nothing for it).
func (r *Racer) Cube(cubeID int, now int64) *Violation {
	lim := r.limits
	if cubeID == r.lastCube {
		return nil
	}
	r.lastCube = cubeID
	keep := 0
	for keep < len(r.cubes) && now-r.cubes[keep] >= lim.CubeWindowMs {
		keep++
	}
	r.cubes = append(r.cubes[keep:], now)
	if len(r.cubes) > lim.CubeMax {
		return violation(CodeCubeRate, "%d ms 内吃到 %d 个不同的道具箱（上限 %d 个）",
			lim.CubeWindowMs, len(r.cubes), lim.CubeMax)
	}
	return nil
}
