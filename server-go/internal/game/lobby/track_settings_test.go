package lobby

import (
	"kartsim/internal/game/itemmode"
	"kartsim/internal/shared/contract"
	"testing"
)

func TestRandomTrackSelectionRespectsVisibility(t *testing.T) {
	items, err := itemmode.Default()
	if err != nil {
		t.Fatal(err)
	}
	code := 0
	for _, gameplay := range []string{"ordinary", "roadblock", "lte", "giant", "brawl", "item"} {
		t.Run(gameplay, func(t *testing.T) {
			r := &room{gameplay: gameplay, randomTrackCode: &code}
			l := New(Options{ItemMode: items})
			chosen := l.chooseTrack(r)
			if chosen == "" {
				t.Fatal("empty baseline pool")
			}
			l.trackEnabled = func(id string) bool { return id == chosen }
			for range 50 {
				if got := l.chooseTrack(r); got != chosen {
					t.Fatalf("disabled selection %s", got)
				}
			}
			l.trackEnabled = func(string) bool { return false }
			if got := l.chooseTrack(r); got != "" {
				t.Fatalf("disabled fallback %s", got)
			}
			r.trackID = chosen
			if got := l.chooseTrack(r); got != chosen {
				t.Fatal("fixed historical selection was changed")
			}
		})
	}
}

func TestRandomTrackAllDisabledRefusesNewRace(t *testing.T) {
	h := newHarnessWith(t, func(opts *Options) { opts.TrackEnabled = func(string) bool { return false } })
	players := h.connectN(2)
	r := h.create(players, "ordinary", "speedIndiCombine", 2)
	r = h.command(players[0], map[string]any{"type": "random-track", "roomId": r["roomId"], "randomTrackCode": 0})
	r = h.joinAndReady(players, r)
	assertEqual(t, h.errorCode(players[0], map[string]any{"type": "start", "roomId": r["roomId"], "revision": r["revision"]}), "NO_ENABLED_TRACKS")
	h.lobby.mu.Lock()
	defer h.lobby.mu.Unlock()
	if room := h.lobby.rooms[r["roomId"].(string)]; room.race != nil || room.phase != "open" {
		t.Fatal("empty random pool mutated room into a race")
	}
}

func TestRandomTrackDisabledDuringHandoffReturnsRoom(t *testing.T) {
	g := newGlobalLobby(t)
	players := g.home.connectN(2)
	view := g.home.create(players, "ordinary", "speedIndiCombine", 2)
	view = g.home.command(players[0], map[string]any{"type": "random-track", "roomId": view["roomId"], "randomTrackCode": 0})
	id := view["roomId"].(string)
	g.home.lobby.mu.Lock()
	state := exportRoom(g.home.lobby.rooms[id])
	g.home.lobby.mu.Unlock()
	g.node.lobby.mu.Lock()
	defer g.node.lobby.mu.Unlock()
	g.node.lobby.trackEnabled = func(string) bool { return false }
	err := g.node.lobby.importHandoff(contract.RoomHandoff{HandoffID: "disabled-handoff", Room: state})
	if err == nil || codeOf(t, err) != "NO_ENABLED_TRACKS" {
		t.Fatalf("handoff error %v", err)
	}
	if g.node.lobby.rooms[id] != nil || len(g.node.lobby.handoffs) != 0 {
		t.Fatal("failed handoff left a stranded room")
	}
	returned := g.fakes.returned()
	if len(returned) != 1 || returned[0].Room == nil || returned[0].Room.RaceError != "NO_ENABLED_TRACKS" {
		t.Fatalf("room was not returned: %+v", returned)
	}
}
