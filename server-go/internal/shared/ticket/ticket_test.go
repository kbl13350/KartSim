package ticket

import (
	"strings"
	"testing"
	"time"
)

var secret = []byte("0123456789abcdef0123456789abcdef")

func TestRoundTrip(t *testing.T) {
	now := time.UnixMilli(1_700_000_000_000)
	token, issued := Sign(secret, Claims{NodeID: "game-1", DataNode: "data-1",
		AccountID: "a", Nickname: "Alice"}, now)
	claims, err := Verify(secret, token, now.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if claims != issued || claims.Nickname != "Alice" || claims.ExpiresAt != now.Add(TTL).UnixMilli() {
		t.Fatalf("claims changed: %+v", claims)
	}
}

func TestRejectsTamperingExpiryAndWrongSecret(t *testing.T) {
	now := time.UnixMilli(1_700_000_000_000)
	token, _ := Sign(secret, Claims{NodeID: "game-1", DataNode: "data-1", Guest: true}, now)
	if _, err := Verify(secret, token, now.Add(TTL)); err != ErrExpired {
		t.Fatalf("expired ticket accepted: %v", err)
	}
	if _, err := Verify([]byte("another-secret-another-secret-xx"), token, now); err == nil {
		t.Fatal("wrong secret accepted")
	}
	parts := strings.Split(token, ".")
	forged, _ := Sign(secret, Claims{NodeID: "game-2", DataNode: "data-1", Guest: true}, now)
	mixed := parts[0] + "." + strings.Split(forged, ".")[1] + "." + parts[2]
	if _, err := Verify(secret, mixed, now); err == nil {
		t.Fatal("tampered body accepted")
	}
	if _, err := Verify(secret, "kt1.only", now); err == nil {
		t.Fatal("malformed ticket accepted")
	}
	account, _ := Sign(secret, Claims{NodeID: "game-1", DataNode: "data-1"}, now)
	if _, err := Verify(secret, account, now); err == nil {
		t.Fatal("account ticket without account accepted")
	}
}
