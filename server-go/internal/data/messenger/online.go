package messenger

// Visible lists up to limit accounts that have a messenger socket and do
// not appear offline (invisible), in no particular order: the online
// riders a My Room random visit may pick.
func (h *Hub) Visible(limit int) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	ids := make([]string, 0, min(limit, len(h.accounts)))
	for id := range h.accounts {
		if len(ids) >= limit {
			break
		}
		if p := h.peers[id]; p != nil && p.invisible {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}
