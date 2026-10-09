package cluster

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/api"
	"kartsim/internal/data/cache"
	"kartsim/internal/game/admission"
	"kartsim/internal/game/lobby"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

type discardSink struct{}

func (discardSink) Text([]byte)   {}
func (discardSink) Binary([]byte) {}

// The data service runs the claim script but its answer arrives after the
// node gave up. The player's immediate retry (new ticket, new player ID)
// must be admitted, not refused NICKNAME_TAKEN until the stale claim's
// 30-second TTL runs out (a failed Java hello never reserved anything).
func TestHelloRetryAfterALateClaimAnswerIsAdmitted(t *testing.T) {
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	const prefix = "kt-game-test:"
	data := api.New(api.Options{
		Cache:      cache.New(client, prefix, quiet),
		Cluster:    cache.NewCluster(client, prefix),
		Secret:     []byte(secret),
		DataNodeID: "data-1",
		Logger:     quiet,
	})
	internal := data.InternalHandler()
	var slowClaims atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != contract.PathPresenceClaim || !slowClaims.Load() {
			internal.ServeHTTP(w, r)
			return
		}
		// The claim is applied now; the answer leaves after the node's timeout.
		recorded := httptest.NewRecorder()
		internal.ServeHTTP(recorded, r)
		time.Sleep(400 * time.Millisecond)
		for key, values := range recorded.Header() {
			w.Header()[key] = values
		}
		w.WriteHeader(recorded.Code)
		_, _ = w.Write(recorded.Body.Bytes())
	}))
	defer server.Close()

	agent := NewAgent(NewDataClient(server.URL, []byte(secret)),
		NodeInfo{NodeID: "game-1", Name: "game-1", Capacity: 10}, 50*time.Millisecond, quiet)
	agent.timeout = 100 * time.Millisecond
	tickets := admission.New([]byte(secret), "game-1", "data-1")
	rooms := lobby.New(lobby.Options{NodeID: "game-1", Presence: agent, Tickets: tickets, Logger: quiet})
	agent.SetSource(rooms)
	runAgent(t, agent)
	waitUntil(t, "registration", func() bool { return mr.Exists(prefix + "node:game-1") })

	hello := func() (lobby.Reply, error) {
		token, _ := ticket.Sign([]byte(secret), ticket.Claims{NodeID: "game-1", DataNode: "data-1",
			AccountID: "acc-alice", Username: "alice", Nickname: "Alice"}, time.Now())
		payload, _ := json.Marshal(map[string]any{"type": "hello", "protocolVersion": contract.ProtocolVersion,
			"ruleset": contract.Ruleset, "resourceVersion": "p3553", "name": "Alice", "ticket": token})
		request, err := lobby.ParseRequest(payload)
		if err != nil {
			t.Fatal(err)
		}
		return rooms.Handle(context.Background(), lobby.NewClient(discardSink{}), request)
	}

	slowClaims.Store(true)
	_, err := hello()
	if rejected, ok := apierr.As(err); !ok || rejected.Code != "DATA_SERVICE_UNAVAILABLE" {
		t.Fatalf("first hello: %v", err)
	}
	if !mr.Exists(prefix + "presence:alice") {
		t.Fatal("the late claim was not applied; the test does not reproduce the race")
	}
	slowClaims.Store(false)
	if _, err := hello(); err != nil {
		t.Fatalf("retry right after the failed hello: %v", err)
	}
	if players, _ := rooms.Online(); len(players) != 1 || players[0].Name != "Alice" {
		t.Fatalf("online %+v", players)
	}
}
