package anticheat

import (
	"encoding/binary"
	"math"
	"testing"
)

var payloadLengths = map[int]int{1: 113, 2: 80, 3: 108, 4: 124, 5: 128, 6: 137, 7: 149, 8: 151, 9: 161, 10: 163}

// payload builds a valid payload of kind at pos (wire axes) with route
// distance and lap (kinds 4..10); resetAt marks a reset frame.
func payload(kind int, tick uint32, pos [3]float64, distance float64, lap int, resetAt *uint32) []byte {
	b := make([]byte, payloadLengths[kind])
	binary.LittleEndian.PutUint32(b, tick)
	offset := kinematicPositionOffset
	if kind == 1 {
		offset = drivingPositionOffset
	}
	for i, v := range pos {
		binary.LittleEndian.PutUint32(b[offset+4*i:], math.Float32bits(float32(v)))
	}
	// An identity quaternion (w first).
	binary.LittleEndian.PutUint32(b[offset+12:], math.Float32bits(1))
	if kind >= 4 {
		binary.LittleEndian.PutUint64(b[progressDistanceOffset:], math.Float64bits(distance))
		binary.LittleEndian.PutUint32(b[progressLapOffset:], uint32(lap))
		binary.LittleEndian.PutUint32(b[120:], math.MaxUint32)
	}
	if kind >= 6 {
		binary.LittleEndian.PutUint32(b[128:], math.Float32bits(1))
		binary.LittleEndian.PutUint32(b[132:], math.Float32bits(1))
	}
	if resetAt != nil {
		binary.LittleEndian.PutUint32(b[resetStartOffset:], *resetAt)
		if kind >= 6 {
			b[collisionFlagsOffset] |= 2
		}
	}
	return b
}

// sample is a frame at x meters east (and the given height) along the
// route distance.
func sample(t *testing.T, kind int, tick uint32, x, distance float64, lap int, resetAt *uint32) Sample {
	t.Helper()
	b := payload(kind, tick, [3]float64{x, 0, 5}, distance, lap, resetAt)
	if !ValidPayload(kind, b) {
		t.Fatalf("test payload of kind %d is not valid", kind)
	}
	s, ok := ParseSample(kind, b)
	if !ok {
		t.Fatalf("payload of kind %d did not parse", kind)
	}
	return s
}

func TestParseSample(t *testing.T) {
	reset := uint32(900)
	s := sample(t, 10, 1000, 12.5, 345.5, 2, &reset)
	if s.Tick != 1000 || s.Pos != [3]float64{12.5, 0, 5} || !s.HasProgress || s.Distance != 345.5 ||
		s.Lap != 2 || !s.Resetting || s.ResetAt != 900 {
		t.Fatalf("kind 10: %+v", s)
	}
	if s := sample(t, 5, 1000, 1, 2, 0, &reset); !s.Resetting || s.ResetAt != 900 {
		t.Fatalf("kind 5 is always a reset frame: %+v", s)
	}
	if s := sample(t, 6, 1000, 1, 2, 0, nil); s.Resetting {
		t.Fatalf("kind 6 without the reset flag: %+v", s)
	}
	if s := sample(t, 3, 1000, 1, 0, 0, nil); s.HasProgress {
		t.Fatalf("kind 3 has no progress: %+v", s)
	}
	if s := sample(t, 1, 1000, 7, 0, 0, nil); s.Pos[0] != 7 {
		t.Fatalf("kind 1 position: %+v", s)
	}
	// The start grid is behind the line: a negative route distance.
	if s := sample(t, 10, 1000, 1, -40, 0, nil); !s.HasProgress || s.Distance != -40 {
		t.Fatalf("negative distance: %+v", s)
	}
}

func TestValidPayload(t *testing.T) {
	for kind := 1; kind <= 10; kind++ {
		if !ValidPayload(kind, payload(kind, 1000, [3]float64{1, 2, 3}, 10, 1, nil)) {
			t.Fatalf("kind %d: a valid payload refused", kind)
		}
	}
	reset := uint32(500)
	for name, mutate := range map[string]func(b []byte){
		"NaN position":         func(b []byte) { binary.LittleEndian.PutUint32(b[4:], math.Float32bits(float32(math.NaN()))) },
		"infinite velocity":    func(b []byte) { binary.LittleEndian.PutUint32(b[32:], math.Float32bits(float32(math.Inf(1)))) },
		"zero quaternion":      func(b []byte) { binary.LittleEndian.PutUint32(b[16:], 0) },
		"lamp flags":           func(b []byte) { b[98] = 16 },
		"padding byte":         func(b []byte) { b[99] = 1 },
		"visual scale mode":    func(b []byte) { b[97] = 4 },
		"NaN distance":         func(b []byte) { binary.LittleEndian.PutUint64(b[108:], math.Float64bits(math.NaN())) },
		"lap":                  func(b []byte) { binary.LittleEndian.PutUint32(b[116:], 70_000) },
		"collision flags":      func(b []byte) { b[136] = 4 },
		"reset without flag":   func(b []byte) { binary.LittleEndian.PutUint32(b[124:], 5) },
		"old reset":            func(b []byte) { binary.LittleEndian.PutUint32(b[124:], reset); b[136] |= 2 },
		"zero collision scale": func(b []byte) { binary.LittleEndian.PutUint32(b[128:], 0) },
		"animation flags":      func(b []byte) { b[140] = 4 },
		"dual mode":            func(b []byte) { b[138] = 2 },
		"negative speed":       func(b []byte) { binary.LittleEndian.PutUint32(b[141:], math.Float32bits(-1)) },
		"motion mode":          func(b []byte) { b[149] = 4 },
		"observed slot":        func(b []byte) { b[150] = 8 },
		"NaN visual scale":     func(b []byte) { binary.LittleEndian.PutUint32(b[155:], math.Float32bits(float32(math.NaN()))) },
	} {
		b := payload(10, 3000, [3]float64{1, 2, 3}, 10, 1, nil)
		mutate(b)
		if ValidPayload(10, b) {
			t.Fatalf("%s: accepted", name)
		}
	}
	if ValidPayload(10, payload(9, 1000, [3]float64{}, 1, 1, nil)) || ValidPayload(4, make([]byte, 100)) ||
		ValidPayload(11, make([]byte, 178)) || ValidPayload(0, make([]byte, 80)) {
		t.Fatal("a payload of the wrong length or kind accepted")
	}
	// Kind 1: special motion flags, a length its flags do not imply.
	special := payload(1, 1000, [3]float64{}, 0, 0, nil)
	special[5] = 1
	if ValidPayload(1, special) {
		t.Fatal("kind 1 special motion accepted")
	}
	scalar := payload(1, 1000, [3]float64{}, 0, 0, nil)
	scalar[4] = 4
	if ValidPayload(1, scalar) {
		t.Fatal("kind 1 with a scalar flag but no scalar accepted")
	}
}

// drive feeds frames every 64 ms at speed (m/s) from tick start, with the
// server clock equal to the tick, and returns the first violation and the
// position reached.
func drive(r *Racer, t *testing.T, start uint32, frames int, x0, speed float64) (*Violation, float64) {
	t.Helper()
	x := x0
	for i := range frames {
		tick := start + uint32(i*64)
		if v := r.Motion(sample(t, 10, tick, x, x, 1, nil), int64(tick)); v != nil {
			return v, x
		}
		x += speed * 0.064
	}
	return nil, x
}

func expect(t *testing.T, v *Violation, code string) {
	t.Helper()
	if code == "" && v != nil {
		t.Fatalf("unexpected violation %s: %s", v.Code, v.Detail)
	}
	if code != "" && (v == nil || v.Code != code) {
		t.Fatalf("violation %v, want %s", v, code)
	}
}

func TestHonestDrivingPasses(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	// 3 minutes at 450 km/h.
	v, _ := drive(r, t, 10_000, 3*60*1000/64, 0, 450/3.6)
	expect(t, v, "")
	if r.Frames() == 0 {
		t.Fatal("no frame counted")
	}
}

func TestTeleport(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	_, x := drive(r, t, 10_000, 50, 0, 50)
	tick := uint32(10_000 + 50*64)
	// 500 m in one frame with the route distance left behind (an unknown
	// track's warp keeps it within UnknownJump): out of warps it is a
	// teleport.
	r.limits.WarpsPerMinute = 0
	expect(t, r.Motion(sample(t, 10, tick, x+500, x, 1, nil), int64(tick)), CodeTeleport)

	// Height is not checked.
	r = NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Motion(sample(t, 10, 10_000, 0, 0, 1, nil), 10_000), "")
	b := payload(10, 10_064, [3]float64{0, 0, 900}, 0, 1, nil)
	s, _ := ParseSample(10, b)
	expect(t, r.Motion(s, 10_064), "")
}

func TestProgressJump(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	_, x := drive(r, t, 10_000, 50, 0, 50)
	tick := uint32(10_000 + 50*64)
	// An unknown track allows UnknownJump of route in one frame.
	expect(t, r.Motion(sample(t, 10, tick, x+5, x+3_000, 1, nil), int64(tick)), "")
	tick += 64
	expect(t, r.Motion(sample(t, 10, tick, x+10, x+3_000+3_700, 1, nil), int64(tick)), CodeProgress)
}

func TestUnknownTrackWarp(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	_, x := drive(r, t, 10_000, 50, 0, 50)
	tick := uint32(10_000 + 50*64)
	// A warp: the position jumps 2 km, the route distance moves on a little.
	expect(t, r.Motion(sample(t, 10, tick, x+2_000, x+20, 1, nil), int64(tick)), "")
	for i := 1; i < 40; i++ {
		tick += 64
		expect(t, r.Motion(sample(t, 10, tick, x+2_000+float64(i)*3, x+20+float64(i)*3, 1, nil), int64(tick)), "")
	}
	// A jump without route progress (kind 3) is never a warp.
	tick += 64
	expect(t, r.Motion(sample(t, 3, tick, x+5_000, 0, 0, nil), int64(tick)), CodeTeleport)
}

func TestWarpsAreBounded(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	tick := uint32(10_000)
	x := 0.0
	expect(t, r.Motion(sample(t, 10, tick, x, 0, 1, nil), int64(tick)), "")
	for i := 0; i <= DefaultLimits().WarpsPerMinute; i++ {
		tick += 1_000
		x += 1_000
		v := r.Motion(sample(t, 10, tick, x, float64(i), 1, nil), int64(tick))
		if i < DefaultLimits().WarpsPerMinute {
			expect(t, v, "")
		} else {
			expect(t, v, CodeTeleport)
		}
	}
}

func TestKnownTrackWarpLandsAtAnExit(t *testing.T) {
	track := &Track{ID: "test", Laps: 2, Lap: 6_000, Drive: 4_000, Jump: 2_000,
		Warps: [][3]float64{{1_500, 0, 0}}}
	r := NewRacer(DefaultLimits(), track, 0)
	_, x := drive(r, t, 10_000, 50, 0, 50)
	tick := uint32(10_000 + 50*64)
	// Into the warp's exit, the route distance gaining its section.
	expect(t, r.Motion(sample(t, 10, tick, 1_520, x+1_900, 1, nil), int64(tick)), "")
	for i := 1; i < 20; i++ {
		tick += 64
		expect(t, r.Motion(sample(t, 10, tick, 1_520+float64(i)*3, x+1_900+float64(i)*3, 1, nil), int64(tick)), "")
	}
	// The same jump anywhere else is a teleport, route progress or not.
	tick += 64
	expect(t, r.Motion(sample(t, 10, tick, 3_000, x+1_960, 1, nil), int64(tick)), CodeTeleport)
}

func TestResetMayMoveTheKart(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	_, x := drive(r, t, 10_000, 50, 0, 50)
	r.limits.WarpsPerMinute = 0
	tick := uint32(10_000 + 50*64)
	resetAt := tick
	// The reset frames move the kart back 600 m along the route.
	expect(t, r.Motion(sample(t, 10, tick, x, x, 1, &resetAt), int64(tick)), "")
	tick += 64
	expect(t, r.Motion(sample(t, 10, tick, x-600, x-600, 1, &resetAt), int64(tick)), "")
	tick += 64
	// The first frame after the reset starts from where it put the kart.
	expect(t, r.Motion(sample(t, 10, tick, x-600, x-600, 1, nil), int64(tick)), "")
	tick += 64
	expect(t, r.Motion(sample(t, 10, tick, x-597, x-597, 1, nil), int64(tick)), "")
	// A reset frame claiming a reset older than ResetMaxMs is not a reset
	// (and not a valid payload either).
	old := tick - 3_000
	tick += 64
	frame := sample(t, 10, tick, x, x-590, 1, nil)
	frame.Resetting, frame.ResetAt, frame.Pos[0] = true, old, x+300
	expect(t, r.Motion(frame, int64(tick)), CodeTeleport)
}

func TestResetsAreBounded(t *testing.T) {
	limits := DefaultLimits()
	limits.WarpsPerMinute = 0
	r := NewRacer(limits, nil, 0)
	tick := uint32(10_000)
	first := tick
	expect(t, r.Motion(sample(t, 10, tick, 0, 0, 1, &first), int64(tick)), "")
	tick += 64
	expect(t, r.Motion(sample(t, 10, tick, 0, 0, 1, nil), int64(tick)), "")
	// A new reset 200 ms after the previous one started may not jump.
	tick += 136
	second := tick
	expect(t, r.Motion(sample(t, 10, tick, 500, 0, 1, &second), int64(tick)), CodeTeleport)
}

func TestSpeed(t *testing.T) {
	// 1000 km/h without route progress: each frame moves 18 m, under the
	// jump slack, but the window sees it.
	r := NewRacer(DefaultLimits(), nil, 0)
	x := 0.0
	var got *Violation
	for i := 0; i < 100 && got == nil; i++ {
		tick := uint32(10_000 + i*64)
		got = r.Motion(sample(t, 3, tick, x, 0, 0, nil), int64(tick))
		x += 1000 / 3.6 * 0.064
	}
	expect(t, got, CodeSpeed)
}

// After a violation (log mode goes on checking) the next frames are
// compared with the frame that failed, not with the one before it.
func TestViolationStartsOver(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	r.limits.WarpsPerMinute = 0
	expect(t, r.Motion(sample(t, 10, 10_000, 0, 0, 1, nil), 10_000), "")
	expect(t, r.Motion(sample(t, 10, 10_064, 5_000, 1, 1, nil), 10_064), CodeTeleport)
	for i := 1; i < 60; i++ {
		tick := uint32(10_064 + i*64)
		expect(t, r.Motion(sample(t, 10, tick, 5_000+float64(i)*3, 1+float64(i)*3, 1, nil), int64(tick)), "")
	}
}

func TestClockAhead(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Motion(sample(t, 10, 20_000, 0, 0, 1, nil), 16_000), "")
	expect(t, r.Motion(sample(t, 10, 22_000, 1, 1, 1, nil), 16_064), CodeClock)
	// Behind is lag, not a cheat.
	r = NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Motion(sample(t, 10, 1_000, 0, 0, 1, nil), 60_000), "")
	// The tick clock wraps.
	r = NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Motion(sample(t, 10, 10, 0, 0, 1, nil), int64(math.MaxUint32)-20), "")
}

func TestOutOfOrderFramesAreSkipped(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Motion(sample(t, 10, 10_128, 6, 6, 1, nil), 10_128), "")
	// An older frame arriving late is not compared with the newer one.
	expect(t, r.Motion(sample(t, 10, 10_064, 3, 3, 1, nil), 10_130), "")
	expect(t, r.Motion(sample(t, 10, 10_192, 9, 9, 1, nil), 10_192), "")
	if r.Frames() != 2 {
		t.Fatalf("frames %d, want 2", r.Frames())
	}
}

func TestLaps(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Motion(sample(t, 10, 10_000, 0, 1_000, 1, nil), 10_000), "")
	expect(t, r.Motion(sample(t, 10, 10_064, 1, 1_001, 2, nil), 10_064), "")
	expect(t, r.Motion(sample(t, 10, 10_128, 2, 1_002, 4, nil), 10_128), CodeLap)

	track := &Track{ID: "test", Laps: 2, Lap: 3_000, Drive: 3_000, Jump: 300}
	r = NewRacer(DefaultLimits(), track, 0)
	expect(t, r.Motion(sample(t, 10, 100_000, 0, 6_000, 3, nil), 100_000), "")
	r = NewRacer(DefaultLimits(), track, 0)
	expect(t, r.Motion(sample(t, 10, 100_000, 0, 6_000, 4, nil), 100_000), CodeLap)
}

func TestRaceProgressBound(t *testing.T) {
	// 2 laps of 6 km, 2 km of them warps: 20 s in, the route may reach
	// 140 m/s × 20 s + one lap's warps + one section + the slack.
	track := &Track{ID: "test", Laps: 2, Lap: 6_000, Drive: 4_000, Jump: 500, Warp: 2_000}
	r := NewRacer(DefaultLimits(), track, 10_000)
	allowed := 140.0*20 + 2_000 + 500 + 100
	expect(t, r.Motion(sample(t, 10, 30_000, 0, allowed-1, 1, nil), 30_000), "")
	r = NewRacer(DefaultLimits(), track, 10_000)
	expect(t, r.Motion(sample(t, 10, 30_000, 0, allowed+1, 1, nil), 30_000), CodeProgress)
}

func TestFinish(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	expect(t, r.Finish(118_000, 120_000, 5_000, true), "")
	expect(t, r.Finish(90_000, 120_000, 5_000, true), CodeFinishTime)
	// Under 15 m/s of route progress per second raced.
	expect(t, r.Finish(60_000, 60_500, 300, true), CodeFinishEarly)
	// Nobody received its frames: progress is unknown.
	expect(t, r.Finish(60_000, 60_500, 0, false), "")

	track := &Track{ID: "test", Laps: 2, Lap: 3_000, Drive: 2_800, Jump: 300}
	r = NewRacer(DefaultLimits(), track, 0)
	expect(t, r.Finish(100_000, 100_500, 5_900, true), "")
	// Less than 90% of two laps, less the slack.
	expect(t, r.Finish(100_000, 100_500, 2*3_000*0.9-201, true), CodeFinishEarly)
	// Faster than 2 × 2800 m × 0.9 at 140 m/s (36 s).
	expect(t, r.Finish(30_000, 30_500, 6_000, true), CodeFinishFast)
	expect(t, r.Finish(37_000, 37_000, 6_000, false), "")
}

func TestCubeRate(t *testing.T) {
	r := NewRacer(DefaultLimits(), nil, 0)
	now := int64(100_000)
	for i := range 20 {
		expect(t, r.Cube(1+i%2, now), "")
		now += 1_000
	}
	// The same cube again is not counted.
	for range 20 {
		expect(t, r.Cube(2, now), "")
	}
	now += 5_000
	for i := range DefaultLimits().CubeMax {
		expect(t, r.Cube(10+i, now), "")
		now += 100
	}
	expect(t, r.Cube(99, now), CodeCubeRate)
	// A cube a row on the densest layout at top speed is fine: 7 a second.
	r = NewRacer(DefaultLimits(), nil, 0)
	for i := range 200 {
		expect(t, r.Cube(i+1, now), "")
		now += 1_000 / 7
	}
}

func TestParseMode(t *testing.T) {
	for value, want := range map[string]Mode{"": ModeKick, "kick": ModeKick, " LOG ": ModeLog, "off": ModeOff} {
		if got, err := ParseMode(value); err != nil || got != want {
			t.Fatalf("ParseMode(%q) = %v, %v", value, got, err)
		}
	}
	if _, err := ParseMode("ban"); err == nil {
		t.Fatal("ParseMode accepted ban")
	}
}

func TestTracks(t *testing.T) {
	track := TrackByID("village_R01")
	if track == nil || track.Laps != 2 || track.Lap < 3_000 || track.Drive != track.Lap || len(track.Warps) != 0 {
		t.Fatalf("village_R01: %+v", track)
	}
	warp := TrackByID("world_R05")
	if warp == nil || len(warp.Warps) != 1 || warp.Drive >= warp.Lap || warp.Jump < 2_000 || warp.Warp < 2_000 {
		t.Fatalf("world_R05: %+v", warp)
	}
	// Reverse tracks have their own routes.
	if reverse := TrackByID("forest_I01_rvs"); reverse == nil || reverse.Laps != 3 {
		t.Fatalf("forest_I01_rvs: %+v", reverse)
	}
	if TrackByID("nowhere_R01") != nil {
		t.Fatal("an unknown track has data")
	}
	if len(tracks) < 300 {
		t.Fatalf("only %d tracks", len(tracks))
	}
}
