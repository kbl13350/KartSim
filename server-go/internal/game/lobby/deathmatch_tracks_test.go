package lobby

import (
	"math"
	"testing"
)

func TestDeathmatchOriginalArenaGeometry(t *testing.T) {
	// sp00 values from the original p3553 track.1s ToDummy transforms,
	// converted from native Z-up into the runtime's Y-up coordinates.
	want := map[string]deathmatchVector{
		"ice_D01":     {240.0755615234375, 66.84056091308594, -280.84942626953125},
		"factory_D01": {104, 100.340087890625, -148},
		"god_D01":     {161.62808227539062, 43.27314376831055, -206.0924835205078},
		"northeu_D01": {542.1883544921875, 175.40557861328125, -746.547119140625},
		"wkc_D01":     {316.19464111328125, 116.97412109375, -366.4625549316406},
	}
	if len(deathmatchTracks) != len(want) {
		t.Fatalf("got %d arenas, want %d", len(deathmatchTracks), len(want))
	}
	for id, position := range want {
		t.Run(id, func(t *testing.T) {
			track := deathmatchTrackByID(id)
			if track == nil || len(track.Spawns) != 8 || len(track.ResetTriangles) == 0 {
				t.Fatal("original arena geometry is incomplete")
			}
			if track.Spawns[0].Position != position {
				t.Fatalf("sp00 = %#v, want %#v", track.Spawns[0].Position, position)
			}
			for slot, spawn := range track.Spawns {
				if spawn.Slot != slot || track.fallen(spawn.Position) {
					t.Fatalf("spawn %d is invalid or inside a loss surface", slot)
				}
				if length := deathmatchDistance(spawn.Forward, deathmatchVector{}); math.Abs(length-1) > 1e-6 {
					t.Fatalf("spawn %d direction is not normalized: %v", slot, length)
				}
			}
		})
	}
	if deathmatchTrackByID("village_R01") != nil {
		t.Fatal("normal tracks must not acquire a fabricated arena")
	}
}

func TestDeathmatchLossSurfacesKeepLowerPlatformsPlayable(t *testing.T) {
	track := deathmatchTrack{FallY: -100, ResetTriangles: []deathmatchTriangle{{
		A: deathmatchVector{0, 10, 0}, B: deathmatchVector{10, 10, 0}, C: deathmatchVector{0, 10, 10},
	}}}
	for _, sample := range []struct {
		position deathmatchVector
		fallen   bool
	}{
		{deathmatchVector{2, 10.5, 2}, true},
		{deathmatchVector{2, 15, 2}, false},
		{deathmatchVector{2, -5, 2}, false}, // Below a loss plane, on a lower platform.
		{deathmatchVector{20, 10, 20}, false},
		{deathmatchVector{20, -100, 20}, true}, // Outside all arena geometry.
	} {
		if got := track.fallen(sample.position); got != sample.fallen {
			t.Errorf("fallen(%#v) = %v, want %v", sample.position, got, sample.fallen)
		}
	}
}
