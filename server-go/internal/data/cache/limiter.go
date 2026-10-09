package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Limiter counts events in fixed windows in Redis (INCR + PEXPIRE). The
// counters are shared by every request of the data service; callers decide
// whether a Redis failure lets the request through (fail open) or not.
type Limiter struct {
	rdb    *redis.Client
	prefix string
}

// NewLimiter returns a limiter whose keys live under prefix + "rl:".
func NewLimiter(rdb *redis.Client, prefix string) *Limiter {
	return &Limiter{rdb: rdb, prefix: prefix + "rl:"}
}

// hitScript increments a window counter and starts the window on the first
// hit. A counter left without a TTL (it cannot happen through this script,
// but a manual SET could do it) gets one, so no key ever blocks forever.
// KEYS: counter. ARGV: window ms.
var hitScript = redis.NewScript(`
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('PTTL', KEYS[1]) < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`)

// Hit counts one event against key and returns the count in the current
// window, including this one.
func (l *Limiter) Hit(ctx context.Context, key string, window time.Duration) (int64, error) {
	opCtx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	count, err := hitScript.Run(opCtx, l.rdb, []string{l.prefix + key}, window.Milliseconds()).Int64()
	if err != nil {
		return 0, fmt.Errorf("rate limit %s: %w", key, err)
	}
	return count, nil
}

// Count returns the events counted against key in the current window.
func (l *Limiter) Count(ctx context.Context, key string) (int64, error) {
	opCtx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	count, err := l.rdb.Get(opCtx, l.prefix+key).Int64()
	if err == redis.Nil {
		return 0, nil
	} else if err != nil {
		return 0, fmt.Errorf("rate limit %s: %w", key, err)
	}
	return count, nil
}
