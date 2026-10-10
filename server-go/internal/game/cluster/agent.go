package cluster

import (
	"context"
	"log/slog"
	"math"
	"net/http"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"kartsim/internal/game/names"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

// Source reports the node's live players and room count.
type Source interface {
	Online() ([]contract.OnlinePlayer, int)
}

// NodeInfo describes this node in heartbeats.
type NodeInfo struct {
	NodeID   string
	Name     string
	Origin   string // "" means same origin as the data service
	Capacity int
	DataNode string // expected data node identity, for diagnostics
}

// Agent keeps the node registered (heartbeat) and its players' nicknames
// reserved. Heartbeats and releases run on one goroutine, in order, so a
// heartbeat listing a player can never land after that player's release and
// revive a stale claim. Releases are drained between heartbeats but never
// hold one back past its due time, so a slow data service cannot let the
// node's registration lapse.
type Agent struct {
	data           *DataClient
	info           NodeInfo
	interval       time.Duration
	timeout        time.Duration // claim, heartbeat and leave calls
	releaseTimeout time.Duration // one release call
	waitBudget     time.Duration // how long a claim waits for an earlier release
	startedAt      int64
	log            *slog.Logger

	mu          sync.Mutex
	source      Source
	stats       func() *contract.NodeStats
	onConflicts func(playerIDs []string)
	queue       []queuedRelease
	retries     []queuedRelease            // failed releases, resent at the next tick
	releasing   map[string]*pendingRelease // releaseKeys → releases not yet finished
	awaited     map[string]int             // releaseKeys claims are waiting for
	wake        chan struct{}
	healthy     bool
	reported    bool
	stopped     bool

	// rates are the data service's reward rates from the latest heartbeat
	// response (nil until one reported them).
	rates atomic.Pointer[rewards.Rates]
}

type queuedRelease struct {
	req      contract.PresenceReleaseRequest
	attempts int
}

// maxReleaseAttempts bounds how often a failed release is resent; after
// that the claim lapses on its own once heartbeats stop renewing it.
const maxReleaseAttempts = 3

type pendingRelease struct {
	count int
	done  chan struct{}
}

// NewAgent returns an agent; call SetSource before Run.
func NewAgent(data *DataClient, info NodeInfo, interval time.Duration, log *slog.Logger) *Agent {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &Agent{
		data:           data,
		info:           info,
		interval:       interval,
		timeout:        5 * time.Second,
		releaseTimeout: 2 * time.Second,
		waitBudget:     2 * time.Second,
		startedAt:      time.Now().UnixMilli(),
		log:            log,
		releasing:      map[string]*pendingRelease{},
		awaited:        map[string]int{},
		wake:           make(chan struct{}, 1),
	}
}

// SetSource sets where heartbeats read the live players from.
func (a *Agent) SetSource(source Source) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.source = source
}

// SetStats sets where heartbeats read the node's load figures from (the
// admin console's node page); heartbeats carry none without it.
func (a *Agent) SetStats(stats func() *contract.NodeStats) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.stats = stats
}

// SetConflictHandler sets what receives the heartbeat's Conflicts: the
// player IDs whose nickname claim another node now holds. It runs on the
// heartbeat goroutine and must not block for long; the node disconnects
// those sessions.
func (a *Agent) SetConflictHandler(handler func(playerIDs []string)) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.onConflicts = handler
}

// Claim reserves a nickname, and an account player's account, cluster-wide.
// It first waits (briefly) for an earlier release of the same name or
// account from this node (a quick reconnect, possibly after a rename), then
// calls the data service. INVALID_GUEST_NAME, NICKNAME_TAKEN and
// ACCOUNT_ONLINE pass through; every other failure is 503
// DATA_SERVICE_UNAVAILABLE.
func (a *Agent) Claim(ctx context.Context, req contract.PresenceClaimRequest) error {
	a.waitReleased(ctx, releaseKeys(req.Name, req.AccountID))
	callCtx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	err := a.data.Call(callCtx, contract.PathPresenceClaim, req, nil)
	if err == nil {
		return nil
	}
	if rejected, ok := apierr.As(err); ok && (rejected.Code == "INVALID_GUEST_NAME" ||
		rejected.Code == "NICKNAME_TAKEN" || rejected.Code == "ACCOUNT_ONLINE") {
		return rejected
	}
	// The data service may have stored the claim and then answered late or
	// not at all. Undo exactly that value (the release compares before it
	// deletes, so it is a no-op when the claim never landed); otherwise the
	// player's retry, with a new player ID, is refused NICKNAME_TAKEN (or
	// ACCOUNT_ONLINE) until the claim expires. The retry's own Claim waits
	// for this release.
	a.Release(contract.PresenceReleaseRequest{NodeID: req.NodeID, PlayerID: req.PlayerID, Name: req.Name,
		AccountID: req.AccountID})
	a.log.Warn("presence claim failed", "name", req.Name, "error", err)
	return apierr.New(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
}

// releaseKeys are the reservations a claim or release concerns: the folded
// nickname and, for an account player, the account.
func releaseKeys(name, accountID string) []string {
	keys := []string{"name:" + names.Fold(name)}
	if accountID != "" {
		keys = append(keys, "account:"+accountID)
	}
	return keys
}

// Release queues a nickname (and account) release; it never blocks.
func (a *Agent) Release(req contract.PresenceReleaseRequest) {
	a.mu.Lock()
	if a.stopped {
		a.mu.Unlock()
		return
	}
	for _, key := range releaseKeys(req.Name, req.AccountID) {
		p := a.releasing[key]
		if p == nil {
			p = &pendingRelease{done: make(chan struct{})}
			a.releasing[key] = p
		}
		p.count++
	}
	a.queue = append(a.queue, queuedRelease{req: req})
	a.mu.Unlock()
	a.notify()
}

func (a *Agent) notify() {
	select {
	case a.wake <- struct{}{}:
	default:
	}
}

// waitReleased waits up to waitBudget for this node's queued releases of
// any of keys (releaseKeys), which it moves to the front of the queue. The
// claim then gets its own full timeout.
func (a *Agent) waitReleased(ctx context.Context, keys []string) {
	var waits []*pendingRelease
	a.mu.Lock()
	for _, key := range keys {
		if p := a.releasing[key]; p != nil {
			waits = append(waits, p)
		}
	}
	if len(waits) > 0 {
		a.prioritizeLocked(keys)
		for _, key := range keys {
			a.awaited[key]++
		}
	}
	a.mu.Unlock()
	if len(waits) == 0 {
		return
	}
	defer func() {
		a.mu.Lock()
		defer a.mu.Unlock()
		for _, key := range keys {
			if a.awaited[key]--; a.awaited[key] <= 0 {
				delete(a.awaited, key)
			}
		}
	}()
	a.notify()
	timer := time.NewTimer(a.waitBudget)
	defer timer.Stop()
	for _, p := range waits {
		select {
		case <-p.done:
		case <-ctx.Done():
			return
		case <-timer.C:
			return
		}
	}
}

// prioritizeLocked moves the queued (and failed, awaiting retry) releases
// that concern any of keys to the front of the queue. Releases of different
// players are independent, so reordering them is safe.
func (a *Agent) prioritizeLocked(keys []string) {
	matches := func(q queuedRelease) bool {
		return slices.ContainsFunc(releaseKeys(q.req.Name, q.req.AccountID),
			func(key string) bool { return slices.Contains(keys, key) })
	}
	var first []queuedRelease
	for _, list := range [][]queuedRelease{a.retries, a.queue} {
		for _, q := range list {
			if matches(q) {
				first = append(first, q)
			}
		}
	}
	if len(first) == 0 {
		return
	}
	a.retries = slices.DeleteFunc(a.retries, matches)
	a.queue = append(first, slices.DeleteFunc(a.queue, matches)...)
}

// Run registers the node immediately, then heartbeats every interval and
// sends queued releases until ctx ends.
func (a *Agent) Run(ctx context.Context) {
	a.heartbeat(ctx)
	lastBeat := time.Now()
	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()
	for {
		tick := false
		select {
		case <-ctx.Done():
			a.abandonReleases()
			return
		case <-a.wake:
		case <-ticker.C:
			tick = true
			a.retryFailedReleases()
		}
		for {
			idle := a.drainReleases(ctx, lastBeat.Add(a.interval))
			if ctx.Err() != nil {
				break
			}
			// A tick sends the heartbeat unless one went out recently (while
			// draining); a long drain sends it as soon as it falls due.
			if since := time.Since(lastBeat); since >= a.interval || (tick && since >= a.interval/2) {
				a.heartbeat(ctx)
				lastBeat = time.Now()
			}
			tick = false
			if idle {
				break
			}
		}
	}
}

// drainReleases sends queued releases until the queue is empty (true) or
// the next heartbeat is due (false). A failed release is resent at a later
// tick, at most maxReleaseAttempts times.
func (a *Agent) drainReleases(ctx context.Context, heartbeatDue time.Time) bool {
	for {
		a.mu.Lock()
		if len(a.queue) == 0 {
			a.mu.Unlock()
			return true
		}
		if ctx.Err() != nil || !time.Now().Before(heartbeatDue) {
			a.mu.Unlock()
			return false
		}
		next := a.queue[0]
		a.queue = a.queue[1:]
		a.mu.Unlock()

		callCtx, cancel := context.WithTimeout(ctx, a.releaseTimeout)
		err := a.data.Call(callCtx, contract.PathPresenceRelease, next.req, nil)
		cancel()
		if err == nil || ctx.Err() != nil {
			a.finishRelease(next.req)
			continue
		}
		next.attempts++
		if next.attempts >= maxReleaseAttempts || !retryable(err) {
			// The claim expires on its own once heartbeats stop renewing it.
			a.log.Warn("presence release failed", "name", next.req.Name, "error", err)
			a.finishRelease(next.req)
			continue
		}
		a.log.Info("presence release failed; retrying", "name", next.req.Name, "error", err)
		a.mu.Lock()
		switch {
		case a.stopped:
		case slices.ContainsFunc(releaseKeys(next.req.Name, next.req.AccountID),
			func(key string) bool { return a.awaited[key] > 0 }):
			// A claim is waiting for it (it failed while in flight, so the
			// claim could not move it forward): resend it now.
			a.queue = append([]queuedRelease{next}, a.queue...)
		default:
			a.retries = append(a.retries, next)
		}
		a.mu.Unlock()
	}
}

// retryable reports whether a failed call may succeed when repeated: a
// network failure, a timeout, 5xx, 408, 429, or 401 (a cluster key being
// rotated). Any other 4xx is the data service's final answer.
func retryable(err error) bool {
	rejected, ok := apierr.As(err)
	if !ok || rejected.Status < 400 || rejected.Status > 499 {
		return true
	}
	switch rejected.Status {
	case http.StatusUnauthorized, http.StatusRequestTimeout, http.StatusTooManyRequests:
		return true
	}
	return false
}

// retryFailedReleases puts the failed releases back in the queue.
func (a *Agent) retryFailedReleases() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.queue = append(a.queue, a.retries...)
	a.retries = nil
}

func (a *Agent) finishRelease(req contract.PresenceReleaseRequest) {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, key := range releaseKeys(req.Name, req.AccountID) {
		if p := a.releasing[key]; p != nil {
			p.count--
			if p.count <= 0 {
				close(p.done)
				delete(a.releasing, key)
			}
		}
	}
}

// abandonReleases unblocks waiting claims at shutdown; NodeLeave removes
// every claim of the node anyway.
func (a *Agent) abandonReleases() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.stopped = true
	a.queue = nil
	a.retries = nil
	for key, p := range a.releasing {
		close(p.done)
		delete(a.releasing, key)
	}
}

func (a *Agent) heartbeat(ctx context.Context) {
	a.mu.Lock()
	source, stats := a.source, a.stats
	a.mu.Unlock()
	players, rooms := []contract.OnlinePlayer{}, 0
	if source != nil {
		players, rooms = source.Online()
	}
	req := contract.HeartbeatRequest{
		NodeID:          a.info.NodeID,
		Name:            a.info.Name,
		Origin:          a.info.Origin,
		Capacity:        a.info.Capacity,
		Rooms:           rooms,
		Players:         players,
		StartedAt:       a.startedAt,
		ProtocolVersion: contract.ProtocolVersion,
	}
	if stats != nil {
		req.Stats = stats()
	}
	callCtx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	var resp contract.HeartbeatResponse
	err := a.data.Call(callCtx, contract.PathHeartbeat, req, &resp)
	if err == nil && !resp.Accepted {
		err = apierr.New(http.StatusConflict, "HEARTBEAT_REJECTED")
	}
	if err == nil {
		a.updateRates(resp)
	}
	a.mu.Lock()
	wasHealthy, reported := a.healthy, a.reported
	a.healthy, a.reported = err == nil, true
	onConflicts := a.onConflicts
	a.mu.Unlock()
	if err == nil && len(resp.Conflicts) > 0 {
		a.log.Warn("data service reports nicknames taken over by another node; disconnecting",
			"players", len(resp.Conflicts))
		if onConflicts != nil {
			onConflicts(resp.Conflicts)
		}
	}
	switch {
	case err != nil && ctx.Err() != nil:
	case err != nil && (wasHealthy || !reported):
		a.log.Warn("heartbeat to data service failed", "error", err)
	case err == nil && (!wasHealthy || !reported):
		a.log.Info("registered with data service", "node", a.info.NodeID, "dataNode", resp.DataNode)
		if a.info.DataNode != "" && resp.DataNode != "" && resp.DataNode != a.info.DataNode {
			a.log.Warn("data service reports a different data node",
				"expected", a.info.DataNode, "actual", resp.DataNode)
		}
	}
}

// Rates returns the reward rates (KART_EXP_RATE, KART_LUCCI_RATE) the data
// service reported in its latest heartbeat response, or 1/1 before any. The
// lobby scales the race.rewards it shows with them; settlements carry the
// base amounts. Safe to call with any lock held.
func (a *Agent) Rates() rewards.Rates {
	if rates := a.rates.Load(); rates != nil {
		return *rates
	}
	return rewards.DefaultRates()
}

// updateRates keeps the rates of a heartbeat response. A missing or
// invalid value keeps the previous one.
func (a *Agent) updateRates(resp contract.HeartbeatResponse) {
	if resp.ExpRate == nil && resp.LucciRate == nil {
		return
	}
	previous := a.Rates()
	next := previous
	valid := func(value *float64) bool {
		return value != nil && !math.IsNaN(*value) && !math.IsInf(*value, 0) && *value >= 0
	}
	if valid(resp.ExpRate) {
		next.Exp = *resp.ExpRate
	}
	if valid(resp.LucciRate) {
		next.Lucci = *resp.LucciRate
	}
	if a.rates.Swap(&next) == nil || next != previous {
		a.log.Info("reward rates from the data service", "expRate", next.Exp, "lucciRate", next.Lucci)
	}
}

// Leave removes the node and all its nickname claims (graceful shutdown).
func (a *Agent) Leave(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	return a.data.Call(ctx, contract.PathNodeLeave, contract.NodeLeaveRequest{NodeID: a.info.NodeID}, nil)
}
