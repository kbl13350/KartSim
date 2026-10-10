package cluster

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"
	"time"

	"kartsim/internal/game/itemmode"
	"kartsim/internal/shared/contract"
)

func TestOwnershipVerify(t *testing.T) {
	var mu sync.Mutex
	var answer struct {
		status int
		body   any
	}
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		mu.Lock()
		defer mu.Unlock()
		if path == contract.PathEquipmentVerify {
			return answer.status, answer.body
		}
		return 0, nil
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	ownership := NewOwnership(NewDataClient(server.URL, []byte(secret)))
	equipment := json.RawMessage(`{"itemIds":{"1":2,"3":387},"kartSerial":0}`)
	rentalEnds := int64(1_790_000_000_123)

	for _, tc := range []struct {
		name       string
		status     int
		body       any
		owned      bool
		validUntil time.Time
		failed     bool
	}{
		{"owned", http.StatusOK, contract.EquipmentVerifyResponse{OK: true}, true, time.Time{}, false},
		{"owned until a rental ends", http.StatusOK, contract.EquipmentVerifyResponse{OK: true,
			ValidUntil: &rentalEnds}, true, time.UnixMilli(rentalEnds), false},
		{"not owned", http.StatusConflict, map[string]any{"error": "ITEM_NOT_OWNED",
			"missing": []contract.EquipmentSlot{{Slot: 3, ItemID: 387}}}, false, time.Time{}, false},
		{"200 without ok", http.StatusOK, map[string]any{}, false, time.Time{}, false},
		{"unavailable", http.StatusServiceUnavailable, map[string]any{"error": "DATA_SERVICE_UNAVAILABLE"}, false, time.Time{}, true},
		{"old data service", http.StatusNotFound, map[string]any{"error": "NOT_FOUND"}, false, time.Time{}, true},
		{"other conflict", http.StatusConflict, map[string]any{"error": "SOMETHING_ELSE"}, false, time.Time{}, true},
		{"bad key", http.StatusUnauthorized, map[string]any{"error": "CLUSTER_KEY_INVALID"}, false, time.Time{}, true},
	} {
		mu.Lock()
		answer.status, answer.body = tc.status, tc.body
		mu.Unlock()
		got, err := ownership.VerifyEquipment(context.Background(), "acc-1", equipment)
		if got.Owned != tc.owned || !got.ValidUntil.Equal(tc.validUntil) || (err != nil) != tc.failed {
			t.Errorf("%s: answer %+v err %v", tc.name, got, err)
		}
	}
	// The changer cards: counts, and -1 for a voucher.
	mu.Lock()
	answer.status, answer.body = http.StatusOK, contract.EquipmentVerifyResponse{OK: true,
		Changers: &contract.Changers{Slot: 12, Item: -1, ItemUntil: &rentalEnds}}
	mu.Unlock()
	if got, err := ownership.VerifyEquipment(context.Background(), "acc-1", equipment); err != nil ||
		got.Changers == nil || *got.Changers != (itemmode.Changers{Slot: 12, Item: itemmode.Infinite}) {
		t.Errorf("changers: %+v %v", got, err)
	}
	data.mu.Lock()
	var sent contract.EquipmentVerifyRequest
	if err := json.Unmarshal(data.payloads[0], &sent); err != nil {
		t.Fatal(err)
	}
	data.mu.Unlock()
	if sent.AccountID != "acc-1" || string(sent.Equipment) != string(equipment) {
		t.Fatalf("request %+v", sent)
	}

	// An unreachable data service and a slow one are errors, not refusals.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	dead := "http://" + listener.Addr().String()
	listener.Close()
	if got, err := NewOwnership(NewDataClient(dead, []byte(secret))).VerifyEquipment(
		context.Background(), "acc-1", equipment); got.Owned || err == nil {
		t.Fatalf("unreachable: %+v %v", got, err)
	}
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(300 * time.Millisecond):
		case <-r.Context().Done():
		}
	}))
	defer slow.Close()
	impatient := NewOwnership(NewDataClient(slow.URL, []byte(secret)))
	impatient.timeout = 50 * time.Millisecond
	if got, err := impatient.VerifyEquipment(context.Background(), "acc-1", equipment); got.Owned || err == nil {
		t.Fatalf("slow: %+v %v", got, err)
	}
}

// The heartbeat hands the data service's Conflicts to the node, which
// disconnects those players.
func TestHeartbeatConflictsReachTheHandler(t *testing.T) {
	var mu sync.Mutex
	conflicts := []string{"p2", "p3"}
	data := &recorder{reply: func(path string, _ []byte) (int, any) {
		mu.Lock()
		defer mu.Unlock()
		if path != contract.PathHeartbeat {
			return 0, nil
		}
		resp := contract.HeartbeatResponse{Accepted: true, DataNode: "data-1", Conflicts: conflicts}
		conflicts = nil
		return http.StatusOK, resp
	}}
	server := httptest.NewServer(data)
	defer server.Close()
	agent := NewAgent(NewDataClient(server.URL, []byte(secret)), NodeInfo{NodeID: "game-1"}, 20*time.Millisecond, quiet)
	agent.SetSource(source{players: []contract.OnlinePlayer{{PlayerID: "p1", Name: "A"},
		{PlayerID: "p2", Name: "B"}, {PlayerID: "p3", Name: "C"}}})
	evicted := make(chan []string, 10)
	agent.SetConflictHandler(func(ids []string) { evicted <- slices.Clone(ids) })
	runAgent(t, agent)
	select {
	case ids := <-evicted:
		if !slices.Equal(ids, []string{"p2", "p3"}) {
			t.Fatalf("conflicts %v", ids)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("conflicts not handed over")
	}
	// Heartbeats without conflicts do not call the handler.
	waitUntil(t, "more heartbeats", func() bool {
		return len(slices.DeleteFunc(data.calls(), func(p string) bool { return p != contract.PathHeartbeat })) >= 4
	})
	if len(evicted) != 0 {
		t.Fatalf("handler called again: %v", <-evicted)
	}
}
