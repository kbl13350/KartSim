package cache

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestLimiterWindows(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	limiter := NewLimiter(client, "kt:")
	ctx := context.Background()
	for want := int64(1); want <= 3; want++ {
		if got, err := limiter.Hit(ctx, "k", time.Minute); err != nil || got != want {
			t.Fatalf("hit %d: %d %v", want, got, err)
		}
	}
	if got, err := limiter.Count(ctx, "k"); err != nil || got != 3 {
		t.Fatalf("count %d %v", got, err)
	}
	if ttl := server.TTL("kt:rl:k"); ttl <= 0 || ttl > time.Minute {
		t.Fatalf("ttl %s", ttl)
	}
	server.FastForward(time.Minute)
	if got, _ := limiter.Count(ctx, "k"); got != 0 {
		t.Fatalf("count after the window %d", got)
	}
	if got, _ := limiter.Hit(ctx, "k", time.Minute); got != 1 {
		t.Fatalf("new window %d", got)
	}
	// A counter without a TTL gets one.
	server.Set("kt:rl:stuck", "5")
	if got, _ := limiter.Hit(ctx, "stuck", time.Minute); got != 6 || server.TTL("kt:rl:stuck") <= 0 {
		t.Fatalf("stuck counter %d ttl %s", got, server.TTL("kt:rl:stuck"))
	}
	server.SetError("ERR down")
	if _, err := limiter.Hit(ctx, "k", time.Minute); err == nil {
		t.Fatal("no error while Redis fails")
	}
}
