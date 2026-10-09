package admission

import (
	"errors"
	"testing"
	"time"

	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/ticket"
)

var secret = []byte("admission-test-secret-0123456789abcdef")

func code(t *testing.T, err error) string {
	t.Helper()
	var rejected *apierr.Error
	if !errors.As(err, &rejected) {
		t.Fatalf("not an API error: %v", err)
	}
	return rejected.Code
}

func TestAdmitChecksTicketNodeAndNonce(t *testing.T) {
	now := time.UnixMilli(1_800_000_000_000)
	tickets := New(secret, "game-1", "data-1").WithClock(func() time.Time { return now })
	sign := func(claims ticket.Claims, at time.Time) string {
		token, _ := ticket.Sign(secret, claims, at)
		return token
	}
	good := sign(ticket.Claims{NodeID: "game-1", DataNode: "data-1", AccountID: "a1",
		Nickname: "Racer"}, now)
	claims, err := tickets.Admit(good)
	if err != nil || claims.Nickname != "Racer" || claims.Guest {
		t.Fatalf("admit: %+v %v", claims, err)
	}
	if c := code(t, func() error { _, err := tickets.Admit(good); return err }()); c != "TICKET_REUSED" {
		t.Fatalf("reuse: %s", c)
	}
	for token, want := range map[string]string{
		"":     "TICKET_INVALID",
		"kt1.": "TICKET_INVALID",
		sign(ticket.Claims{NodeID: "game-1", DataNode: "data-1", Guest: true}, now.Add(-ticket.TTL)): "TICKET_EXPIRED",
		sign(ticket.Claims{NodeID: "game-2", DataNode: "data-1", Guest: true}, now):                  "TICKET_WRONG_NODE",
		sign(ticket.Claims{NodeID: "game-1", DataNode: "data-2", Guest: true}, now):                  "DATA_NODE_MISMATCH",
	} {
		_, err := tickets.Admit(token)
		if c := code(t, err); c != want {
			t.Errorf("got %s, want %s", c, want)
		}
	}
	// Nonces are forgotten once their ticket has expired.
	if tickets.Remembered() != 1 {
		t.Fatalf("remembered %d", tickets.Remembered())
	}
	now = now.Add(ticket.TTL + 2*time.Second)
	fresh := sign(ticket.Claims{NodeID: "game-1", DataNode: "data-1", Guest: true}, now)
	if _, err := tickets.Admit(fresh); err != nil {
		t.Fatal(err)
	}
	if tickets.Remembered() != 1 {
		t.Fatalf("expired nonce kept: %d", tickets.Remembered())
	}
}

// Nonces live only in memory, so a ticket issued before this process
// started may already have been used on the node's previous run.
func TestTicketsFromBeforeTheProcessStartAreRefused(t *testing.T) {
	now := time.UnixMilli(1_800_000_000_000)
	tickets := New(secret, "game-1", "data-1").WithClock(func() time.Time { return now })
	before, _ := ticket.Sign(secret, ticket.Claims{NodeID: "game-1", DataNode: "data-1", Guest: true},
		now.Add(-time.Second))
	if c := code(t, func() error { _, err := tickets.Admit(before); return err }()); c != "TICKET_EXPIRED" {
		t.Fatalf("pre-start ticket: %s", c)
	}
	at, _ := ticket.Sign(secret, ticket.Claims{NodeID: "game-1", DataNode: "data-1", Guest: true}, now)
	if _, err := tickets.Admit(at); err != nil {
		t.Fatal(err)
	}
}

func TestNonceStoreSweepsByExpiryAndIsCapped(t *testing.T) {
	now := time.UnixMilli(1_800_000_000_000)
	tickets := New(secret, "game-1", "data-1").WithClock(func() time.Time { return now })
	tickets.maxNonces = 3
	admit := func() error {
		token, _ := ticket.Sign(secret, ticket.Claims{NodeID: "game-1", DataNode: "data-1", Guest: true}, now)
		_, err := tickets.Admit(token)
		return err
	}
	for range 2 {
		if err := admit(); err != nil {
			t.Fatal(err)
		}
	}
	now = now.Add(30 * time.Second)
	if err := admit(); err != nil {
		t.Fatal(err)
	}
	var rejected *apierr.Error
	if err := admit(); !errors.As(err, &rejected) || rejected.Code != "SERVER_BUSY" || rejected.Status != 503 {
		t.Fatalf("over the cap: %v", err)
	}
	// The first two expire; the third is kept until its own expiry.
	now = now.Add(ticket.TTL - 29*time.Second)
	if err := admit(); err != nil {
		t.Fatal(err)
	}
	if n := tickets.Remembered(); n != 2 {
		t.Fatalf("remembered %d, want 2", n)
	}
	if len(tickets.expiring) != 2 {
		t.Fatalf("expiry buckets %v", tickets.expiring)
	}
}
