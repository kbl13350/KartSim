package lobby

import (
	"context"
	"encoding/json"
	"strconv"
	"sync"
	"testing"
	"time"
)

// slowOwnership takes a millisecond per check and owns every other
// document length, so commands mix answers, cache hits and refusals.
type slowOwnership struct{}

func (slowOwnership) VerifyEquipment(_ context.Context, _ string, equipment json.RawMessage) (OwnershipAnswer, error) {
	time.Sleep(time.Millisecond)
	return OwnershipAnswer{Owned: len(equipment)%2 == 0}, nil
}

// Many sessions (several per account) say hello, create, change gear,
// ready, start, join and leave while heartbeat conflicts evict some of
// them, all with checks running without the lobby lock (run with -race).
// Nothing stays reserved, every account has at most one session, every
// room member is a live session, and every check slot is returned.
func TestOwnershipChecksUnderConcurrency(t *testing.T) {
	h := newHarness(t)
	h.lobby.ownership = slowOwnership{}
	clients := make([]*Client, 40)
	for i := range clients {
		clients[i] = h.newClient()
	}
	var wg sync.WaitGroup
	stop := make(chan struct{})
	wg.Go(func() {
		for {
			select {
			case <-stop:
				return
			default:
			}
			players, _ := h.lobby.Online()
			var ids []string
			for i, p := range players {
				if i%3 == 0 {
					ids = append(ids, p.PlayerID)
				}
			}
			h.lobby.Evict(ids)
			h.lobby.mu.Lock()
			checkSessions(t, h.lobby)
			h.lobby.mu.Unlock()
			time.Sleep(time.Millisecond)
		}
	})
	var workers sync.WaitGroup
	for i, c := range clients {
		token := accountHello(h, "P"+strconv.Itoa(i), "acc-"+strconv.Itoa(i%10), gear(387+i%3))
		workers.Go(func() {
			run := func(request map[string]any) {
				payload, _ := json.Marshal(request)
				in, _ := ParseRequest(payload)
				_, _ = h.lobby.Handle(context.Background(), c, in)
			}
			run(token)
			if !h.lobby.Admitted(c) {
				return
			}
			for j := range 24 {
				roomID := h.lobby.clientRoom(c)
				switch j % 6 {
				case 0:
					run(createRequest(map[string]any{"capacity": 4, "equipment": gear(380 + j)}))
				case 1:
					run(map[string]any{"type": "equipment", "roomId": roomID, "equipment": gear(390 + j)})
				case 2:
					run(map[string]any{"type": "ready", "roomId": roomID, "ready": true})
				case 3:
					run(map[string]any{"type": "start", "roomId": roomID, "revision": 1})
				case 4:
					run(map[string]any{"type": "leave", "roomId": roomID})
				case 5:
					players, _ := h.lobby.Online()
					run(map[string]any{"type": "join", "roomId": "x" + strconv.Itoa(len(players)), "equipment": gear(1)})
				}
			}
			h.lobby.Disconnect(c)
		})
	}
	workers.Wait()
	close(stop)
	wg.Wait()
	h.lobby.mu.Lock()
	defer h.lobby.mu.Unlock()
	if len(h.lobby.pending) != 0 || len(h.lobby.clients) != 0 || len(h.lobby.rooms) != 0 {
		t.Fatalf("left behind: pending %v clients %d rooms %d", h.lobby.pending, len(h.lobby.clients), len(h.lobby.rooms))
	}
	if len(h.lobby.verifySlots) != 0 {
		t.Fatalf("%d check slots never returned", len(h.lobby.verifySlots))
	}
}

// checkSessions asserts the session invariants; the lobby lock is held.
func checkSessions(t *testing.T, l *Lobby) {
	accounts := map[string]bool{}
	for _, c := range l.clients {
		if c.accountID != "" && accounts[c.accountID] {
			t.Errorf("account %s has two sessions", c.accountID)
		}
		accounts[c.accountID] = true
	}
	for _, p := range l.pending {
		if p.accountID != "" && accounts[p.accountID] {
			t.Errorf("account %s is pending while online", p.accountID)
		}
	}
	for _, r := range l.rooms {
		for _, m := range r.members {
			if l.clients[m.playerID] == nil {
				t.Errorf("room %s keeps a member without a session", r.id)
			}
		}
	}
}
