package cache

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/datatest"
)

func newTestCache(t *testing.T) (*Cache, *miniredis.Miniredis) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	return New(client, "kt:", datatest.Logger()), server
}

// recoverForTest ends a simulated outage window so the next call reaches Redis.
func (c *Cache) recoverForTest() { c.downUntil.Store(0) }

func TestReadersFillOnlyEmptyKeys(t *testing.T) {
	cache, server := newTestCache(t)
	ctx := context.Background()

	if _, ok := cache.Get(ctx, "profile:a"); ok {
		t.Fatal("hit on empty cache")
	}
	cache.Fill(ctx, "profile:a", `{"v":1}`, time.Minute)
	if value, ok := cache.Get(ctx, "profile:a"); !ok || value != `{"v":1}` {
		t.Fatalf("got %q, %v", value, ok)
	}
	if !server.Exists("kt:profile:a") {
		t.Fatal("prefix not applied")
	}
	// A writer's value is never replaced by a fill computed from an older read.
	cache.Put(ctx, "profile:a", `{"v":2}`, time.Minute)
	cache.Fill(ctx, "profile:a", `{"v":1}`, time.Minute)
	if value, _ := cache.Get(ctx, "profile:a"); value != `{"v":2}` {
		t.Fatalf("stale fill replaced the write: %q", value)
	}
	if ttl := server.TTL("kt:profile:a"); ttl != time.Minute {
		t.Fatalf("ttl = %s", ttl)
	}
}

func TestInvalidateBlocksStaleFills(t *testing.T) {
	cache, server := newTestCache(t)
	ctx := context.Background()

	cache.Fill(ctx, "account:1", "old", time.Minute)
	cache.Invalidate(ctx, "account:1")
	if _, ok := cache.Get(ctx, "account:1"); ok {
		t.Fatal("marker read as a value")
	}
	cache.Fill(ctx, "account:1", "old", time.Minute)
	if _, ok := cache.Get(ctx, "account:1"); ok {
		t.Fatal("fill replaced the marker")
	}
	server.FastForward(markerTTL + time.Second)
	cache.Fill(ctx, "account:1", "new", time.Minute)
	if value, ok := cache.Get(ctx, "account:1"); !ok || value != "new" {
		t.Fatalf("got %q, %v after the marker expired", value, ok)
	}
}

func TestOutageRemembersWritesUntilRepaired(t *testing.T) {
	cache, server := newTestCache(t)
	ctx := context.Background()

	cache.Fill(ctx, "profile:o", "v1", time.Minute)
	cache.Fill(ctx, "profile:other", "x", time.Minute)
	server.SetError("ERR simulated outage")
	cache.Put(ctx, "profile:o", "v2", time.Minute) // MySQL committed v2; Redis missed it
	cache.BumpHistory(ctx)
	if _, ok := cache.Get(ctx, "profile:other"); ok {
		t.Fatal("cache used during the outage window")
	}

	server.SetError("")
	cache.recoverForTest()
	// Redis is back but still holds v1: the remembered key must bypass it.
	if _, ok := cache.Get(ctx, "profile:o"); ok {
		t.Fatal("stale value served after the outage")
	}
	cache.Fill(ctx, "profile:o", "v2", time.Minute)
	if got, _ := server.Get("kt:profile:o"); got != "v1" {
		t.Fatalf("fill touched a remembered key: %q", got)
	}
	if _, ok := cache.HistoryGen(ctx); ok {
		t.Fatal("history cache used before its generation was bumped")
	}
	if value, ok := cache.Get(ctx, "profile:other"); !ok || value != "x" {
		t.Fatal("unaffected key not served after the outage")
	}

	cache.Repair(ctx)
	if got, _ := server.Get("kt:profile:o"); got != marker {
		t.Fatalf("repair stored %q", got)
	}
	if gen, ok := cache.HistoryGen(ctx); !ok || gen != "1" {
		t.Fatalf("history generation after repair = %q, %v", gen, ok)
	}
	server.FastForward(markerTTL + time.Second)
	cache.Fill(ctx, "profile:o", "v2", time.Minute)
	if value, ok := cache.Get(ctx, "profile:o"); !ok || value != "v2" {
		t.Fatalf("got %q, %v", value, ok)
	}
}

func TestSuccessfulPutClearsRememberedKey(t *testing.T) {
	cache, server := newTestCache(t)
	ctx := context.Background()
	server.SetError("ERR down")
	cache.Put(ctx, "record:a:b", "v1", time.Minute)
	server.SetError("")
	cache.recoverForTest()
	cache.Put(ctx, "record:a:b", "v2", time.Minute)
	if value, ok := cache.Get(ctx, "record:a:b"); !ok || value != "v2" {
		t.Fatalf("got %q, %v", value, ok)
	}
}

func TestOverflowFlushesNamespaces(t *testing.T) {
	cache, server := newTestCache(t)
	ctx := context.Background()
	cache.Fill(ctx, "session:a", "1", time.Minute)
	cache.Fill(ctx, "profile:b", "2", time.Minute)
	cache.Fill(ctx, "ownerkey:c", "3", time.Minute)
	if err := server.Set("other:d", "4"); err != nil {
		t.Fatal(err)
	}

	cache.mu.Lock()
	cache.flushAll = true
	cache.mu.Unlock()
	if _, ok := cache.Get(ctx, "ownerkey:c"); ok {
		t.Fatal("cache used while a flush is pending")
	}
	cache.Repair(ctx)
	if server.Exists("kt:session:a") || server.Exists("kt:profile:b") {
		t.Fatal("namespaces not flushed")
	}
	if !server.Exists("kt:ownerkey:c") || !server.Exists("other:d") {
		t.Fatal("flush removed immutable or foreign keys")
	}
	if value, ok := cache.Get(ctx, "ownerkey:c"); !ok || value != "3" {
		t.Fatal("cache not usable after the flush")
	}
}

func TestHistoryGeneration(t *testing.T) {
	cache, _ := newTestCache(t)
	ctx := context.Background()
	if gen, ok := cache.HistoryGen(ctx); !ok || gen != "0" {
		t.Fatalf("initial generation %q, %v", gen, ok)
	}
	cache.BumpHistory(ctx)
	cache.BumpHistory(ctx)
	if gen, ok := cache.HistoryGen(ctx); !ok || gen != "2" {
		t.Fatalf("generation %q, %v", gen, ok)
	}
}

func TestEscapeGlob(t *testing.T) {
	if got := escapeGlob("a*b?[c]-^\\"); got != `a\*b\?\[c\]\-\^\\` {
		t.Fatalf("escapeGlob = %q", got)
	}
}

func TestNewProcessDistrustsLeftoverValues(t *testing.T) {
	previous, server := newTestCache(t)
	ctx := context.Background()
	previous.Fill(ctx, "session:h", "account-1", time.Minute)
	previous.Fill(ctx, "ownerkey:o", "digest", time.Minute)
	if err := server.Set("kt:"+historyGenKey, "5"); err != nil {
		t.Fatal(err)
	}
	// Logout: the session row is gone, but the invalidation misses Redis and
	// is remembered only by the process, which then exits.
	server.SetError("ERR unreachable")
	previous.Invalidate(ctx, "session:h")
	server.SetError("")

	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	restarted := New(client, "kt:", datatest.Logger())
	restarted.DistrustExisting()
	if _, ok := restarted.Get(ctx, "session:h"); ok {
		t.Fatal("logged-out session served from a previous process's cache")
	}
	if _, ok := restarted.HistoryGen(ctx); ok {
		t.Fatal("history cache trusted before a new generation")
	}
	restarted.Fill(ctx, "profile:p", "unverified", time.Minute)
	if server.Exists("kt:profile:p") {
		t.Fatal("filled before the flush")
	}

	restarted.Repair(ctx)
	if server.Exists("kt:session:h") {
		t.Fatal("leftover session not flushed")
	}
	if !server.Exists("kt:ownerkey:o") {
		t.Fatal("immutable owner keys flushed")
	}
	if gen, ok := restarted.HistoryGen(ctx); !ok || gen != "6" {
		t.Fatalf("history generation %q, %v after repair", gen, ok)
	}
	restarted.Fill(ctx, "session:h", "account-2", time.Minute)
	if value, ok := restarted.Get(ctx, "session:h"); !ok || value != "account-2" {
		t.Fatalf("cache unusable after the startup flush: %q %v", value, ok)
	}
}
