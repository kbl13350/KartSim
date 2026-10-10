package api

import (
	"context"
	"net/http"
	"sync"
	"time"

	"kartsim/internal/shared/rewards"
)

// Account activity (ADMIN.md 5): every request that succeeds with a session
// token notes when and from where the account was last active
// (accounts.last_seen_at and last_seen_ip), at most once per account every
// activityEvery, and the first activity of a Beijing day with a remembered
// token writes a "resume" login record (store.SeenActivity).

const (
	// activityEvery is how often one account's activity is written at most.
	activityEvery = 5 * time.Minute
	// activityTimeout bounds the write, which runs after the handler and must
	// not be cut short by a client that already went away.
	activityTimeout = 2 * time.Second
	// maxLocalThrottle bounds the accounts the in-process throttle remembers.
	maxLocalThrottle = 100_000
)

// activityKey carries the *requestActivity of a request served by serve.
type activityKey struct{}

// requestActivity is the account a request's session token resolved to.
type requestActivity struct{ accountID string }

// withActivity prepares a request context to learn its account.
func withActivity(ctx context.Context) (context.Context, *requestActivity) {
	seen := &requestActivity{}
	return context.WithValue(ctx, activityKey{}, seen), seen
}

// sawAccount tells the request's activity record which account its token
// resolved to (requireAccount).
func sawAccount(ctx context.Context, accountID string) {
	if seen, ok := ctx.Value(activityKey{}).(*requestActivity); ok {
		seen.accountID = accountID
	}
}

// localThrottle is the in-process throttle used without Redis: when each
// key may fire again.
type localThrottle struct {
	mu   sync.Mutex
	next map[string]time.Time
}

// once reports whether key may fire at now, and if so blocks it for window.
func (t *localThrottle) once(key string, now time.Time, window time.Duration) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	if until, ok := t.next[key]; ok && now.Before(until) {
		return false
	}
	if t.next == nil {
		t.next = map[string]time.Time{}
	}
	if len(t.next) >= maxLocalThrottle {
		for name, until := range t.next {
			if !now.Before(until) {
				delete(t.next, name)
			}
		}
	}
	t.next[key] = now.Add(window)
	return true
}

// noteActivity writes an account's activity after a successful request,
// throttled per account and Beijing day (the first request after midnight
// is never held back, so the day's resume record is not missed): through
// Redis (SET NX EX), else in this process.
func (a *API) noteActivity(ctx context.Context, r *http.Request, accountID string) {
	if a.store == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), activityTimeout)
	defer cancel()
	clock := a.now()
	key := "seen:" + accountID + ":" + rewards.BeijingDay(clock)
	due := false
	if a.limiter != nil {
		first, err := a.limiter.Once(ctx, key, activityEvery)
		if err == nil {
			due = first
		} else {
			due = a.seenLocal.once(key, clock, activityEvery)
		}
	} else {
		due = a.seenLocal.once(key, clock, activityEvery)
	}
	if !due {
		return
	}
	resumed, err := a.store.SeenActivity(ctx, accountID, a.loginRecord(r, clock.UnixMilli()), beijingMidnight(clock))
	if err != nil {
		a.log.Warn("account activity not stored", "account", accountID, "error", err)
		return
	}
	if resumed {
		a.log.Debug("remembered session resumed", "account", accountID)
	}
}
