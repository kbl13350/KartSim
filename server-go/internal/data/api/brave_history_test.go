package api

import (
	"context"
	"net/http"
	"testing"
)

// A cache hit exercises the public gameplay filter and preserves the frozen
// rules document without needing an external MySQL service.
func TestBraveRaceHistoryAcceptsGameplayAndPreservesRules(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	ctx := context.Background()
	gen, ok := h.api.cache.HistoryGen(ctx)
	if !ok {
		t.Fatal("history cache unavailable")
	}
	const body = `[{"raceId":"brave-history","roomId":"room-brave","gameplay":"brave","trackId":"village_R07","snapshot":{"gameplay":"brave","race":{"brave":{"ruleset":"web-brave-v1","forwardTeam":2}}},"createdAt":1000}]`
	h.api.cache.Fill(ctx, "history:"+gen+":outcomes:brave", body, historyCacheTTL)
	response := h.get("/api/race-outcomes?gameplay=brave", nil).expect(t, http.StatusOK, "")
	if string(response.body) != body {
		t.Fatalf("brave rules changed in history response: %s", response.body)
	}
}
