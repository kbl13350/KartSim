package api

import "context"

func (h *lobbyHome) trackEnabled(id string) bool {
	if disabled := h.disabledTracks.Load(); disabled != nil {
		return !(*disabled)[id]
	}
	return true
}

func (h *lobbyHome) setTrackSettings(ids []string) {
	next := make(map[string]bool, len(ids))
	for _, id := range ids {
		next[id] = true
	}
	h.disabledTracks.Store(&next)
}

func (h *lobbyHome) refreshTrackSettings(ctx context.Context) {
	ids, err := h.a.disabledBuiltinTrackIDs(ctx)
	if err != nil {
		// Keep the last successful snapshot on database outages.
		h.a.log.Warn("built-in track settings refresh failed", "error", err)
		return
	}
	h.setTrackSettings(ids)
}
