package cluster

import (
	"kartsim/internal/shared/contract"
	"testing"
)

func TestTrackSettingsHeartbeatSnapshot(t *testing.T) {
	a := &Agent{}
	if !a.TrackEnabled("map") {
		t.Fatal("default disabled")
	}
	ids := []string{"map", "alias"}
	a.updateTrackSettings(contract.HeartbeatResponse{DisabledTrackIDs: &ids})
	ids[0] = "other" // the snapshot owns its data
	if a.TrackEnabled("map") || a.TrackEnabled("alias") || !a.TrackEnabled("other") {
		t.Fatal("snapshot wrong")
	}
	a.updateTrackSettings(contract.HeartbeatResponse{})
	if a.TrackEnabled("map") {
		t.Fatal("missing settings reset successful snapshot")
	}
	empty := []string{}
	a.updateTrackSettings(contract.HeartbeatResponse{DisabledTrackIDs: &empty})
	if !a.TrackEnabled("map") {
		t.Fatal("explicit empty did not re-enable")
	}
}
