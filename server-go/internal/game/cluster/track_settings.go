package cluster

import "kartsim/internal/shared/contract"

// TrackEnabled is a nonblocking snapshot for random map selection. In-progress
// races and fixed/historical IDs are not revalidated when this snapshot changes.
func (a *Agent) TrackEnabled(id string) bool {
	if disabled := a.disabledTracks.Load(); disabled != nil {
		return !(*disabled)[id]
	}
	return true
}

func (a *Agent) updateTrackSettings(response contract.HeartbeatResponse) {
	if response.DisabledTrackIDs == nil {
		return
	}
	next := make(map[string]bool, len(*response.DisabledTrackIDs))
	for _, id := range *response.DisabledTrackIDs {
		next[id] = true
	}
	a.disabledTracks.Store(&next)
}
