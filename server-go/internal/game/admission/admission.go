// Package admission checks the signed entry tickets players bring to a game
// node: signature and expiry (ticket.Verify), the target node, the data node,
// and one-time use of the nonce.
package admission

import (
	"errors"
	"net/http"
	"sync"
	"time"

	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/ticket"
)

// Tickets admits tickets for one node. Nonces are remembered until their
// ticket expires, so a ticket can be used once on this node. Tickets issued
// before this process started are refused: their nonces may have been used
// by the previous process, which this one cannot know.
type Tickets struct {
	secret    []byte
	nodeID    string
	dataNode  string
	now       func() time.Time
	notBefore int64 // Unix ms; tickets issued earlier predate this process
	maxNonces int

	mu        sync.Mutex
	used      map[string]struct{}
	expiring  map[int64][]string // expiry second → nonces, so a sweep only visits expired ones
	lastSweep int64
}

// defaultMaxNonces bounds the remembered nonces (about 30 hellos per second
// for the whole ticket lifetime); beyond it hello answers 503 SERVER_BUSY.
const defaultMaxNonces = 200_000

// New returns a verifier for tickets addressed to nodeID and issued by dataNode.
func New(secret []byte, nodeID, dataNode string) *Tickets {
	now := time.Now
	return &Tickets{secret: secret, nodeID: nodeID, dataNode: dataNode, now: now,
		notBefore: now().UnixMilli(), maxNonces: defaultMaxNonces,
		used: map[string]struct{}{}, expiring: map[int64][]string{}}
}

// WithClock replaces the wall clock (tests); the process start moves with it.
func (t *Tickets) WithClock(now func() time.Time) *Tickets {
	t.now = now
	t.notBefore = now().UnixMilli()
	return t
}

// Admit verifies token and consumes its nonce. Rejections are 401
// TICKET_INVALID / TICKET_EXPIRED / TICKET_REUSED, 403 TICKET_WRONG_NODE /
// DATA_NODE_MISMATCH, and 503 SERVER_BUSY when too many nonces are held.
func (t *Tickets) Admit(token string) (ticket.Claims, error) {
	now := t.now()
	claims, err := ticket.Verify(t.secret, token, now)
	if err != nil {
		if errors.Is(err, ticket.ErrExpired) {
			return ticket.Claims{}, apierr.New(http.StatusUnauthorized, "TICKET_EXPIRED")
		}
		return ticket.Claims{}, apierr.New(http.StatusUnauthorized, "TICKET_INVALID")
	}
	if claims.NodeID != t.nodeID {
		return ticket.Claims{}, apierr.New(http.StatusForbidden, "TICKET_WRONG_NODE")
	}
	if claims.DataNode != t.dataNode {
		return ticket.Claims{}, apierr.New(http.StatusForbidden, "DATA_NODE_MISMATCH")
	}
	if claims.IssuedAt < t.notBefore {
		// A replay across a restart: the nonce store starts empty.
		return ticket.Claims{}, apierr.New(http.StatusUnauthorized, "TICKET_EXPIRED")
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.sweep(now.UnixMilli())
	if _, reused := t.used[claims.Nonce]; reused {
		return ticket.Claims{}, apierr.New(http.StatusUnauthorized, "TICKET_REUSED")
	}
	if len(t.used) >= t.maxNonces {
		return ticket.Claims{}, apierr.New(http.StatusServiceUnavailable, "SERVER_BUSY")
	}
	t.used[claims.Nonce] = struct{}{}
	second := expirySecond(claims.ExpiresAt)
	t.expiring[second] = append(t.expiring[second], claims.Nonce)
	return claims, nil
}

// expirySecond is the first whole second at or after expiresAt (Unix ms),
// so a nonce is never forgotten before its ticket expires.
func expirySecond(expiresAt int64) int64 { return (expiresAt + 999) / 1000 }

// sweep forgets nonces of expired tickets at most once per second; an
// expired ticket is rejected by Verify before the nonce matters. It visits
// only the expiry buckets (about one per second of ticket lifetime) and the
// nonces that expired.
func (t *Tickets) sweep(nowMs int64) {
	if nowMs-t.lastSweep < 1_000 {
		return
	}
	t.lastSweep = nowMs
	for second, nonces := range t.expiring {
		if second*1000 <= nowMs {
			for _, nonce := range nonces {
				delete(t.used, nonce)
			}
			delete(t.expiring, second)
		}
	}
}

// Remembered reports how many nonces are held (tests and diagnostics).
func (t *Tickets) Remembered() int {
	t.mu.Lock()
	defer t.mu.Unlock()
	return len(t.used)
}
