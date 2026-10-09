// Package ticket signs and verifies the short-lived entry ticket the data
// service hands a player for one game node. The ticket carries the data node
// identity and the player's personal information, so a game node can admit a
// player without a database or a session token.
//
// Wire format: "kt1." + base64url(JSON claims) + "." + base64url(HMAC-SHA256).
package ticket

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const (
	prefix = "kt1."
	// TTL is how long a freshly issued ticket stays valid.
	TTL = 2 * time.Minute
	// MaxLength bounds the encoded ticket accepted from a client.
	MaxLength = 2048
	// MinSecretLength is the minimum KART_CLUSTER_SECRET length.
	MinSecretLength = 32
)

var (
	ErrMalformed = errors.New("TICKET_INVALID")
	ErrSignature = errors.New("TICKET_INVALID")
	ErrExpired   = errors.New("TICKET_EXPIRED")
)

// Claims is the signed content of a ticket.
type Claims struct {
	Version   int    `json:"v"`
	NodeID    string `json:"node"`
	DataNode  string `json:"data"`
	Nonce     string `json:"nonce"`
	IssuedAt  int64  `json:"iat"` // Unix milliseconds
	ExpiresAt int64  `json:"exp"` // Unix milliseconds
	Guest     bool   `json:"guest"`
	AccountID string `json:"aid,omitempty"`
	Username  string `json:"usr,omitempty"`
	Nickname  string `json:"nick,omitempty"`
	Admin     bool   `json:"adm,omitempty"`
}

// NewNonce returns 16 random bytes encoded as base64url.
func NewNonce() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(value)
}

// Sign encodes and signs claims. Version, Nonce, IssuedAt and ExpiresAt are
// filled in when zero.
func Sign(secret []byte, claims Claims, now time.Time) (string, Claims) {
	if claims.Version == 0 {
		claims.Version = 1
	}
	if claims.Nonce == "" {
		claims.Nonce = NewNonce()
	}
	if claims.IssuedAt == 0 {
		claims.IssuedAt = now.UnixMilli()
	}
	if claims.ExpiresAt == 0 {
		claims.ExpiresAt = now.Add(TTL).UnixMilli()
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		panic(err)
	}
	body := base64.RawURLEncoding.EncodeToString(payload)
	return prefix + body + "." + signature(secret, body), claims
}

// Verify checks the signature and expiry and returns the claims. It does not
// check NodeID, DataNode or nonce reuse; the game node does that.
func Verify(secret []byte, token string, now time.Time) (Claims, error) {
	var claims Claims
	if len(token) > MaxLength || !strings.HasPrefix(token, prefix) {
		return claims, ErrMalformed
	}
	body, sig, ok := strings.Cut(token[len(prefix):], ".")
	if !ok || body == "" || sig == "" {
		return claims, ErrMalformed
	}
	if !hmac.Equal([]byte(sig), []byte(signature(secret, body))) {
		return claims, ErrSignature
	}
	payload, err := base64.RawURLEncoding.DecodeString(body)
	if err != nil {
		return claims, ErrMalformed
	}
	if err := json.Unmarshal(payload, &claims); err != nil || claims.Version != 1 ||
		claims.NodeID == "" || claims.DataNode == "" || claims.Nonce == "" {
		return Claims{}, ErrMalformed
	}
	if now.UnixMilli() >= claims.ExpiresAt {
		return Claims{}, ErrExpired
	}
	if !claims.Guest && (claims.AccountID == "" || claims.Nickname == "") {
		return Claims{}, ErrMalformed
	}
	return claims, nil
}

func signature(secret []byte, body string) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(prefix))
	mac.Write([]byte(body))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
