package app

import (
	"net/http/httptest"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/api"
	"kartsim/internal/data/cache"
	"kartsim/internal/shared/ticket"
)

// A node that crashed (no NodeLeave) and restarts under the same node ID
// must admit its returning players at once. Without clearing the previous
// run's claims, its first heartbeat makes them look alive again and every
// reconnect is refused NICKNAME_TAKEN until the 30-second presence TTL.
func TestRestartClearsClaimsOfThePreviousRun(t *testing.T) {
	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	const prefix = "kt-restart-test:"
	data := api.New(api.Options{
		Cache:      cache.New(client, prefix, quiet),
		Cluster:    cache.NewCluster(client, prefix),
		Secret:     []byte(e2eSecret),
		DataNodeID: e2eDataNode,
		Logger:     quiet,
	})
	internal := httptest.NewServer(data.InternalHandler())
	defer internal.Close()

	accountTicket := func() string {
		return sign(t, ticket.Claims{AccountID: "acc-alice", Username: "alice", Nickname: "Alice"})
	}
	// Without equipment the hello needs no ownership check (this data
	// service has no store); the test is about presence claims.
	helloWithoutGear := func() map[string]any {
		value := hello("x", accountTicket())
		delete(value, "equipment")
		return value
	}
	first := startNode(t, internal.URL, nil)
	alice := dial(t, first.wsURL, nil)
	if reply := alice.request(helloWithoutGear()); reply["type"] != "welcome" {
		t.Fatalf("first run: %v", reply)
	}
	// The process dies: heartbeats stop and no NodeLeave is sent.
	first.app.agentCancel()
	<-first.app.agentDone
	if !mr.Exists(prefix + "presence:alice") {
		t.Fatal("claim missing before the restart")
	}

	second := startNode(t, internal.URL, nil)
	again := dial(t, second.wsURL, nil)
	if reply := again.request(helloWithoutGear()); reply["type"] != "welcome" {
		t.Fatalf("reconnect after restart: %v", reply)
	}
}
