// Package cache holds the data service's Redis state: a cache-aside layer
// in front of MySQL that degrades to MySQL when Redis fails, and the
// cluster registry (game nodes and live nicknames), which has no fallback.
//
// Cache protocol (single data service instance):
//   - Readers Fill with SET NX, so a value computed from an older MySQL read
//     never replaces one a writer stored.
//   - Writers Put the new value while still holding the MySQL row lock, so
//     concurrent writers reach Redis in commit order; or they Invalidate,
//     which stores a short-lived marker that reads treat as a miss and that
//     blocks stale fills from requests that read MySQL before the write.
//   - When Redis cannot be updated, the key is remembered in memory and
//     bypassed until a background repair stores the marker, so a Redis
//     outage never leaves a stale value behind once Redis returns.
//   - That memory dies with the process, so a new data service process
//     trusts nothing it finds (DistrustExisting): it bypasses Redis until
//     the stale-prone namespaces are flushed and the history generation is
//     bumped. A restart during an outage therefore cannot bring back a value
//     whose invalidation was still pending, or one written before a commit
//     that never happened.
package cache

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// marker replaces a value that was just written; no cached document
	// (JSON, UUID or base64url digest) starts with "!". It must outlive any
	// request that read MySQL before the write (requests are bounded to 20 s).
	marker    = "!"
	markerTTL = 30 * time.Second
	// opTimeout bounds one cache operation so a slow Redis only adds latency.
	opTimeout = 500 * time.Millisecond
	// outageBackoff is how long cache reads skip Redis after an error.
	outageBackoff = 3 * time.Second
	// maxPending bounds the remembered keys; past it every cache namespace is
	// bypassed and flushed once Redis is back.
	maxPending = 100_000

	historyGenKey = "history:gen"
)

// flushNamespaces are the key prefixes whose values can go stale.
var flushNamespaces = []string{"session:", "account:", "profile:", "record:"}

// Cache is the degradable cache-aside layer.
type Cache struct {
	rdb    *redis.Client
	prefix string
	log    *slog.Logger

	downUntil atomic.Int64 // UnixNano until which Redis is skipped
	outage    atomic.Bool  // an outage was logged and not yet recovered

	mu           sync.Mutex
	pending      map[string]struct{} // keys whose last write did not reach Redis
	flushAll     bool                // pending overflowed
	historyStale bool                // a history generation bump did not reach Redis
}

// New returns a cache using rdb with every key under prefix.
func New(rdb *redis.Client, prefix string, logger *slog.Logger) *Cache {
	return &Cache{rdb: rdb, prefix: prefix, log: logger, pending: map[string]struct{}{}}
}

// DistrustExisting makes the cache ignore whatever Redis holds until the
// next successful Repair has flushed the session, account, profile and
// record namespaces and started a new history generation. The data service
// calls it at startup: an earlier process may have exited with
// invalidations that never reached Redis.
func (c *Cache) DistrustExisting() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.flushAll = true
	c.historyStale = true
	c.pending = map[string]struct{}{}
}

// Get returns a cached value. Misses, markers, bypassed keys and Redis
// errors all report false; the caller then reads MySQL.
func (c *Cache) Get(ctx context.Context, key string) (string, bool) {
	if !c.usable(key) {
		return "", false
	}
	opCtx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	value, err := c.rdb.Get(opCtx, c.prefix+key).Result()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			c.fail(ctx, "get", err)
		}
		return "", false
	}
	c.ok()
	if value == marker {
		return "", false
	}
	return value, true
}

// Fill caches a value read from MySQL unless the key already holds a value
// or marker (SET NX).
func (c *Cache) Fill(ctx context.Context, key, value string, ttl time.Duration) {
	if ttl <= 0 || !c.usable(key) {
		return
	}
	opCtx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	if err := c.rdb.SetArgs(opCtx, c.prefix+key, value, redis.SetArgs{Mode: "NX", TTL: ttl}).Err(); err != nil &&
		!errors.Is(err, redis.Nil) {
		c.fail(ctx, "fill", err)
		return
	}
	c.ok()
}

// Put stores a freshly written value, replacing whatever is cached.
func (c *Cache) Put(ctx context.Context, key, value string, ttl time.Duration) {
	c.write(ctx, key, value, ttl)
}

// Invalidate replaces the cached value with a marker so the next reads go
// to MySQL and older in-flight reads cannot refill a stale value.
func (c *Cache) Invalidate(ctx context.Context, key string) {
	c.write(ctx, key, marker, markerTTL)
}

func (c *Cache) write(ctx context.Context, key, value string, ttl time.Duration) {
	if c.down() {
		c.remember(key)
		return
	}
	// Writes use a context that survives the request's cancellation: a
	// committed MySQL write must reach the cache or be remembered.
	base := context.WithoutCancel(ctx)
	opCtx, cancel := context.WithTimeout(base, opTimeout)
	defer cancel()
	if err := c.rdb.Set(opCtx, c.prefix+key, value, ttl).Err(); err != nil {
		c.fail(base, "write", err)
		c.remember(key)
		return
	}
	c.ok()
	c.mu.Lock()
	delete(c.pending, key)
	c.mu.Unlock()
}

// HistoryGen returns the current history cache generation, or false when
// history responses must not be cached right now.
func (c *Cache) HistoryGen(ctx context.Context) (string, bool) {
	c.mu.Lock()
	stale := c.historyStale || c.flushAll
	c.mu.Unlock()
	if stale || c.down() {
		return "", false
	}
	opCtx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	gen, err := c.rdb.Get(opCtx, c.prefix+historyGenKey).Result()
	switch {
	case errors.Is(err, redis.Nil):
		return "0", true
	case err != nil:
		c.fail(ctx, "history generation", err)
		return "", false
	}
	c.ok()
	return gen, true
}

// BumpHistory starts a new history generation after a committed write.
func (c *Cache) BumpHistory(ctx context.Context) {
	if !c.down() {
		base := context.WithoutCancel(ctx)
		opCtx, cancel := context.WithTimeout(base, opTimeout)
		err := c.rdb.Incr(opCtx, c.prefix+historyGenKey).Err()
		cancel()
		if err == nil {
			c.ok()
			return
		}
		c.fail(base, "history bump", err)
	}
	c.mu.Lock()
	c.historyStale = true
	c.mu.Unlock()
}

// Run repairs remembered keys every second until ctx ends.
func (c *Cache) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.Repair(ctx)
		}
	}
}

// Repair stores markers for remembered keys and redoes a failed history
// bump. Keys stay bypassed until their repair succeeds.
func (c *Cache) Repair(ctx context.Context) {
	if c.down() {
		return
	}
	c.mu.Lock()
	flushAll, historyStale := c.flushAll, c.historyStale
	keys := make([]string, 0, min(len(c.pending), 1000))
	for key := range c.pending {
		if len(keys) == cap(keys) {
			break
		}
		keys = append(keys, key)
	}
	c.mu.Unlock()
	if !flushAll && !historyStale && len(keys) == 0 {
		return
	}

	opCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if flushAll {
		if err := c.flushNamespaces(opCtx); err != nil {
			c.fail(ctx, "flush", err)
			return
		}
		c.mu.Lock()
		c.flushAll = false
		c.pending = map[string]struct{}{}
		c.mu.Unlock()
		keys = nil
		historyStale = true
		c.log.Info("Redis cache flushed; earlier cached values are no longer used")
	}
	if len(keys) > 0 {
		_, err := c.rdb.Pipelined(opCtx, func(pipe redis.Pipeliner) error {
			for _, key := range keys {
				pipe.Set(opCtx, c.prefix+key, marker, markerTTL)
			}
			return nil
		})
		if err != nil {
			c.fail(ctx, "repair", err)
			return
		}
		c.mu.Lock()
		for _, key := range keys {
			delete(c.pending, key)
		}
		c.mu.Unlock()
	}
	if historyStale {
		if err := c.rdb.Incr(opCtx, c.prefix+historyGenKey).Err(); err != nil {
			c.fail(ctx, "history repair", err)
			return
		}
		c.mu.Lock()
		c.historyStale = false
		c.mu.Unlock()
	}
	c.ok()
}

func (c *Cache) flushNamespaces(ctx context.Context) error {
	for _, namespace := range flushNamespaces {
		iter := c.rdb.Scan(ctx, 0, escapeGlob(c.prefix+namespace)+"*", 1000).Iterator()
		var batch []string
		for iter.Next(ctx) {
			batch = append(batch, iter.Val())
			if len(batch) == 1000 {
				if err := c.rdb.Unlink(ctx, batch...).Err(); err != nil {
					return err
				}
				batch = batch[:0]
			}
		}
		if err := iter.Err(); err != nil {
			return err
		}
		if len(batch) > 0 {
			if err := c.rdb.Unlink(ctx, batch...).Err(); err != nil {
				return err
			}
		}
	}
	return nil
}

// usable reports whether key may be read from or filled into Redis now.
func (c *Cache) usable(key string) bool {
	if c.down() {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.flushAll {
		return false
	}
	_, pending := c.pending[key]
	return !pending
}

func (c *Cache) remember(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.flushAll {
		return
	}
	if len(c.pending) >= maxPending {
		c.flushAll = true
		c.pending = map[string]struct{}{}
		return
	}
	c.pending[key] = struct{}{}
}

func (c *Cache) down() bool { return time.Now().UnixNano() < c.downUntil.Load() }

// fail starts an outage window. Errors caused by the caller giving up
// (request canceled) do not count.
func (c *Cache) fail(ctx context.Context, op string, err error) {
	if ctx.Err() != nil {
		return
	}
	c.downUntil.Store(time.Now().Add(outageBackoff).UnixNano())
	if c.outage.CompareAndSwap(false, true) {
		c.log.Warn("Redis cache unavailable; falling back to MySQL", "op", op, "error", err)
	}
}

func (c *Cache) ok() {
	if c.outage.Load() && c.outage.CompareAndSwap(true, false) {
		c.log.Info("Redis cache available again")
	}
}

// escapeGlob quotes the SCAN MATCH metacharacters of a literal prefix.
func escapeGlob(value string) string {
	var builder strings.Builder
	for _, r := range value {
		switch r {
		case '*', '?', '[', ']', '\\', '^', '-':
			builder.WriteByte('\\')
		}
		builder.WriteRune(r)
	}
	return builder.String()
}
