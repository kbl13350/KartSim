package lobby

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"sync"
	"time"
)

// Ownership asks the data service whether an account owns every item of an
// equipment document (contract.PathEquipmentVerify, ECONOMY.md 6). It is
// called on a connection goroutine without the lobby lock. It returns
// Owned=true when every item is owned, Owned=false when the data service
// answers ITEM_NOT_OWNED, and an error when it cannot answer.
type Ownership interface {
	VerifyEquipment(ctx context.Context, accountID string, equipment json.RawMessage) (OwnershipAnswer, error)
}

// OwnershipAnswer is the data service's verdict on one equipment document.
type OwnershipAnswer struct {
	Owned bool
	// ValidUntil is the earliest expiry among the rented items checked
	// (contract.EquipmentVerifyResponse.ValidUntil); zero when every item is
	// permanent. A positive answer is never reused after it.
	ValidUntil time.Time
}

// Limits of the equipment checks (ECONOMY.md 6). The data service call is
// the only expensive part of a command, so the lobby makes it only when the
// command would otherwise succeed, remembers answers, and bounds the calls a
// connection and the whole node can cause.
const (
	// ownedTTL is the longest a positive answer is reused (a rental's
	// ValidUntil shortens it), so an item an administrator removes stops
	// counting within this time.
	ownedTTL = 10 * time.Minute
	// refusedTTL is how long an ITEM_NOT_OWNED answer is reused for the same
	// account and equipment, so repeating a refused command costs nothing.
	refusedTTL = 10 * time.Second
	// maxRefusals bounds the refusals remembered per session.
	maxRefusals = 8
	// verifyRate and verifyBurst are a connection's token bucket for
	// commands that need a data service call (one token per command,
	// whatever the number of items it verifies); beyond it the command is
	// 429 RATE_LIMITED.
	verifyRate  = 2.0
	verifyBurst = 10
	// maxConcurrentVerifies bounds the data service calls in flight on the
	// node; a command needing more fails fast with 503
	// DATA_SERVICE_UNAVAILABLE instead of queueing.
	maxConcurrentVerifies = 32
	// maxVerifyRounds bounds how often one command waits for calls: it is
	// re-run after each round and may need another when the room changed
	// meanwhile.
	maxVerifyRounds = 3
)

// verifyOutcome is what one command learned about one equipment document.
type verifyOutcome int

const (
	outcomeOwned verifyOutcome = iota
	outcomeNotOwned
	outcomeUnavailable
	outcomeRateLimited
)

func (o verifyOutcome) err() error {
	switch o {
	case outcomeNotOwned:
		return errNotOwned()
	case outcomeUnavailable:
		return fail(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	case outcomeRateLimited:
		return fail(http.StatusTooManyRequests, "RATE_LIMITED")
	}
	return nil
}

// errNotOwned names nothing: which item (or, at start, whose) is not said.
func errNotOwned() error { return fail(http.StatusForbidden, "ITEM_NOT_OWNED") }

type verifyKey struct{ account, equipment string }

// ownershipCheck carries one command's own answers across its re-runs.
type ownershipCheck struct {
	answers map[verifyKey]verifyOutcome
}

func (k *ownershipCheck) set(item verifyItem, outcome verifyOutcome) {
	if k.answers == nil {
		k.answers = map[verifyKey]verifyOutcome{}
	}
	k.answers[verifyKey{item.account, string(item.equipment)}] = outcome
}

// verifyItem is one equipment document a command needs verified; client is
// the session whose cache keeps the answer.
type verifyItem struct {
	client    *Client
	account   string
	equipment json.RawMessage
}

// verifyNeeded is returned by a command, under the lobby lock and before it
// changes anything, when it reaches the point where Java applies equipment
// that has no fresh answer. Handle then makes the calls without the lock
// and runs the command again, so every other validation keeps the Java
// order and a command that fails anyway never reaches the data service.
type verifyNeeded struct{ items []verifyItem }

func (*verifyNeeded) Error() string { return "equipment ownership must be verified" }

// sessionOwnership is a session's remembered answers and its call budget.
// It is guarded by the lobby lock.
type sessionOwnership struct {
	// account owns the entries below; a hello with another account on the
	// same connection starts afresh.
	account string
	// owned is the last equipment (compacted JSON) the data service
	// confirmed, reusable until ownedUntil.
	owned      []byte
	ownedUntil time.Time
	refused    []refusal
	tokens     float64
	refilled   time.Time
}

type refusal struct {
	equipment []byte
	until     time.Time
}

type cached int

const (
	cacheMiss cached = iota
	cacheOwned
	cacheRefused
)

func (s *sessionOwnership) lookup(account string, equipment []byte, now time.Time) cached {
	if account != s.account {
		return cacheMiss
	}
	if s.owned != nil && now.Before(s.ownedUntil) && string(s.owned) == string(equipment) {
		return cacheOwned
	}
	for _, r := range s.refused {
		if now.Before(r.until) && string(r.equipment) == string(equipment) {
			return cacheRefused
		}
	}
	return cacheMiss
}

func (s *sessionOwnership) remember(account string, equipment []byte, answer OwnershipAnswer, now time.Time) {
	if account != s.account {
		*s = sessionOwnership{account: account, tokens: s.tokens, refilled: s.refilled}
	}
	s.refused = slices.DeleteFunc(s.refused, func(r refusal) bool {
		return !now.Before(r.until) || string(r.equipment) == string(equipment)
	})
	if !answer.Owned {
		if len(s.refused) >= maxRefusals {
			s.refused = slices.Delete(s.refused, 0, 1)
		}
		s.refused = append(s.refused, refusal{equipment: slices.Clone(equipment), until: now.Add(refusedTTL)})
		if string(s.owned) == string(equipment) {
			s.owned = nil
		}
		return
	}
	until := now.Add(ownedTTL)
	if !answer.ValidUntil.IsZero() && answer.ValidUntil.Before(until) {
		until = answer.ValidUntil
	}
	s.owned, s.ownedUntil = slices.Clone(equipment), until
}

// take spends one token of the connection's verification bucket.
func (s *sessionOwnership) take(now time.Time) bool {
	if s.refilled.IsZero() {
		s.tokens = verifyBurst
	} else if elapsed := now.Sub(s.refilled); elapsed > 0 {
		s.tokens = min(verifyBurst, s.tokens+elapsed.Seconds()*verifyRate)
	}
	s.refilled = now
	if s.tokens < 1 {
		return false
	}
	s.tokens--
	return true
}

// owns runs under the lobby lock at the point where a command applies
// equipment: nil when account owns it (or there is nothing to check: no
// verifier, a guest, no equipment), else ITEM_NOT_OWNED, 503
// DATA_SERVICE_UNAVAILABLE, 429 RATE_LIMITED, or a *verifyNeeded.
func (l *Lobby) owns(check *ownershipCheck, c *Client, account string, equipment json.RawMessage) error {
	if l.ownership == nil || account == "" || equipment == nil {
		return nil
	}
	if check != nil {
		if outcome, ok := check.answers[verifyKey{account, string(equipment)}]; ok {
			return outcome.err()
		}
	}
	switch c.ownership.lookup(account, equipment, l.wall()) {
	case cacheOwned:
		return nil
	case cacheRefused:
		return errNotOwned()
	}
	return &verifyNeeded{items: []verifyItem{{client: c, account: account, equipment: equipment}}}
}

// verify asks the data service about items for the command of c. It is
// called and returns with the lobby lock held, releasing it during the
// calls. Every item gets an outcome in check, and answers are remembered
// in the sessions' caches.
func (l *Lobby) verify(ctx context.Context, c *Client, check *ownershipCheck, items []verifyItem) {
	if !c.ownership.take(l.wall()) {
		for _, item := range items {
			check.set(item, outcomeRateLimited)
		}
		return
	}
	if !l.acquireVerifies(len(items)) {
		l.log.Warn("too many equipment checks in flight", "limit", cap(l.verifySlots))
		for _, item := range items {
			check.set(item, outcomeUnavailable)
		}
		return
	}
	answers := make([]OwnershipAnswer, len(items))
	errs := make([]error, len(items))
	l.mu.Unlock()
	if len(items) == 1 {
		answers[0], errs[0] = l.callVerify(ctx, items[0])
	} else {
		var wg sync.WaitGroup
		for i, item := range items {
			wg.Go(func() { answers[i], errs[i] = l.callVerify(ctx, item) })
		}
		wg.Wait()
	}
	l.releaseVerifies(len(items))
	l.mu.Lock()
	now := l.wall()
	for i, item := range items {
		if errs[i] != nil {
			l.log.Warn("equipment verification failed", "error", errs[i])
			check.set(item, outcomeUnavailable)
			continue
		}
		item.client.ownership.remember(item.account, item.equipment, answers[i], now)
		if answers[i].Owned {
			check.set(item, outcomeOwned)
		} else {
			check.set(item, outcomeNotOwned)
		}
	}
}

// callVerify makes one call; a panic becomes an error, so the lobby lock
// is always taken back.
func (l *Lobby) callVerify(ctx context.Context, item verifyItem) (answer OwnershipAnswer, err error) {
	defer func() {
		if p := recover(); p != nil {
			answer, err = OwnershipAnswer{}, fmt.Errorf("equipment check panicked: %v", p)
		}
	}()
	return l.ownership.VerifyEquipment(ctx, item.account, item.equipment)
}

// acquireVerifies takes n call slots without waiting, or none.
func (l *Lobby) acquireVerifies(n int) bool {
	for i := range n {
		select {
		case l.verifySlots <- struct{}{}:
		default:
			l.releaseVerifies(i)
			return false
		}
	}
	return true
}

func (l *Lobby) releaseVerifies(n int) {
	for range n {
		<-l.verifySlots
	}
}

// runVerified runs a command under the lobby lock (held on entry and on
// return), verifying equipment without the lock whenever the command asks
// for it, then running it again.
func (l *Lobby) runVerified(ctx context.Context, c *Client, run func(*ownershipCheck) (obj, error)) (obj, error) {
	check := &ownershipCheck{}
	for round := 0; ; round++ {
		body, err := run(check)
		var need *verifyNeeded
		if !errors.As(err, &need) {
			return body, err
		}
		if round == maxVerifyRounds {
			l.log.Warn("equipment checks kept changing; giving up", "rounds", round)
			return nil, outcomeUnavailable.err()
		}
		l.verify(ctx, c, check, need.items)
	}
}

// appliedEquipment is the equipment create and join give the member (Java
// refreshEquipment): gear can change outside a room (lobby 我的物品, garage,
// single player), so the commands carry the client's current equipment;
// without a valid one the session's current equipment is kept, and must
// still be owned too. The race roster is frozen from it.
func appliedEquipment(c *Client, in Request) json.RawMessage {
	if raw, present := in.get("equipment"); validEquipment(raw, present) {
		return compactJSON(raw)
	}
	return c.equipment
}
