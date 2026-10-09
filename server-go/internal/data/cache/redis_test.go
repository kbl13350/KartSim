package cache

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/datatest"
	"kartsim/internal/shared/contract"
)

// TestScriptsOnRealRedis runs the Lua scripts on a real Redis (miniredis
// embeds a different Lua engine). It needs KART_TEST_REDIS_ADDR and deletes
// its keys afterwards.
func TestScriptsOnRealRedis(t *testing.T) {
	addr := os.Getenv("KART_TEST_REDIS_ADDR")
	if addr == "" {
		t.Skip("KART_TEST_REDIS_ADDR is not set")
	}
	client := redis.NewClient(&redis.Options{Addr: addr})
	t.Cleanup(func() { client.Close() })
	ctx := context.Background()
	prefix := "kt-test-" + datatest.Unique() + ":"
	t.Cleanup(func() {
		keys, err := client.Keys(ctx, prefix+"*").Result()
		if err == nil && len(keys) > 0 {
			client.Del(ctx, keys...)
		}
	})
	cluster := NewCluster(client, prefix)

	if result, err := cluster.Heartbeat(ctx, Node{NodeID: "game-a", Name: "A", Capacity: 2, StartedAt: 1},
		[]contract.OnlinePlayer{{PlayerID: "p1", Name: "Ann"}}); err != nil || len(result.Conflicts) != 0 || result.Freed != 0 {
		t.Fatal(result, err)
	}
	if _, err := cluster.Heartbeat(ctx, Node{NodeID: "game-b", Name: "B", Capacity: 2}, nil); err != nil {
		t.Fatal(err)
	}
	if ok, err := cluster.Claim(ctx, "game-b", "p2", "ANN"); err != nil || ok {
		t.Fatalf("live name taken: %v %v", ok, err)
	}
	if ok, err := cluster.Claim(ctx, "game-b", "p2", "Bob"); err != nil || !ok {
		t.Fatalf("free name refused: %v %v", ok, err)
	}
	if result, err := cluster.Heartbeat(ctx, Node{NodeID: "game-a", Name: "A", Capacity: 2, StartedAt: 1},
		[]contract.OnlinePlayer{{PlayerID: "p1", Name: "Ann"}, {PlayerID: "p3", Name: "bob"}, {PlayerID: "p4", Name: "Cy"}}); err != nil ||
		len(result.Conflicts) != 1 || result.Conflicts[0] != "p3" || result.Freed != 0 {
		t.Fatalf("heartbeat %+v %v", result, err)
	}
	if ttl := client.PTTL(ctx, prefix+"presence:cy").Val(); ttl <= 0 || ttl > PresenceTTL {
		t.Fatalf("re-claimed presence ttl %s", ttl)
	}
	if online, err := cluster.NameOnline(ctx, "bob"); err != nil || !online {
		t.Fatal("bob not online", err)
	}
	if err := cluster.Release(ctx, "game-a", "p9", "Ann"); err != nil || client.Exists(ctx, prefix+"presence:ann").Val() != 1 {
		t.Fatal("release by a non-holder", err)
	}
	nodes, err := cluster.Nodes(ctx)
	if err != nil || len(nodes) != 2 || nodes[0].NodeID != "game-a" {
		t.Fatalf("nodes %+v %v", nodes, err)
	}
	// game-b restarts: its new process frees the old claim on Bob but keeps
	// its own early claim on Dee, which this heartbeat lists.
	if ok, err := cluster.Claim(ctx, "game-b", "p6", "Dee"); err != nil || !ok {
		t.Fatal(ok, err)
	}
	if result, err := cluster.Heartbeat(ctx, Node{NodeID: "game-b", Name: "B", Capacity: 2, StartedAt: 2},
		[]contract.OnlinePlayer{{PlayerID: "p6", Name: "Dee"}}); err != nil || result.Freed != 1 || len(result.Conflicts) != 0 {
		t.Fatalf("restart heartbeat %+v %v", result, err)
	}
	if client.Exists(ctx, prefix+"presence:bob").Val() != 0 || client.Get(ctx, prefix+"presence:dee").Val() != "game-b|p6" {
		t.Fatal("restart cleanup on real Redis")
	}
	if ok, err := cluster.Claim(ctx, "game-b", "p7", "Bob"); err != nil || !ok {
		t.Fatal("freed name not claimable", ok, err)
	}
	if err := cluster.Leave(ctx, "game-a"); err != nil {
		t.Fatal(err)
	}
	if client.Exists(ctx, prefix+"presence:ann", prefix+"presence:cy", prefix+"node:game-a").Val() != 0 ||
		client.Exists(ctx, prefix+"presence:bob").Val() != 1 {
		t.Fatal("leave removed the wrong keys")
	}
	// game-a is gone, so its stale claims could be taken over at once.
	if ok, err := cluster.Claim(ctx, "game-b", "p5", "Cy"); err != nil || !ok {
		t.Fatal(ok, err)
	}
	// Expired node ids are pruned from the set.
	client.SAdd(ctx, prefix+"nodes", "ghost")
	if nodes, err := cluster.Nodes(ctx); err != nil || len(nodes) != 1 || client.SIsMember(ctx, prefix+"nodes", "ghost").Val() {
		t.Fatalf("prune: %+v %v", nodes, err)
	}

	cache := New(client, prefix, datatest.Logger())
	cache.Put(ctx, "profile:x", "v2", time.Minute)
	cache.Fill(ctx, "profile:x", "v1", time.Minute)
	cache.Invalidate(ctx, "account:y")
	cache.Fill(ctx, "account:y", "stale", time.Minute)
	if value, ok := cache.Get(ctx, "profile:x"); !ok || value != "v2" {
		t.Fatal("put/fill order on real Redis")
	}
	if _, ok := cache.Get(ctx, "account:y"); ok {
		t.Fatal("marker overwritten on real Redis")
	}
	cache.mu.Lock()
	cache.flushAll = true
	cache.mu.Unlock()
	cache.Repair(ctx)
	if client.Exists(ctx, prefix+"profile:x").Val() != 0 {
		t.Fatal("flush with SCAN MATCH did not remove the profile key")
	}

	limiter := NewLimiter(client, prefix)
	for want := int64(1); want <= 2; want++ {
		if got, err := limiter.Hit(ctx, "register-all", time.Minute); err != nil || got != want {
			t.Fatalf("limiter hit %d: %d %v", want, got, err)
		}
	}
	if ttl := client.PTTL(ctx, prefix+"rl:register-all").Val(); ttl <= 0 || ttl > time.Minute {
		t.Fatalf("limiter ttl %s on real Redis", ttl)
	}
}
