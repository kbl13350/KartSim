package api

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Password hashes keep the Java format "iterations:base64(salt):base64(hash)"
// (PBKDF2-HMAC-SHA256, 120000 iterations, 16-byte salt, 256-bit key), so
// migrated accounts keep working.
const (
	passwordIterations = 120_000
	passwordSaltBytes  = 16
	passwordKeyBytes   = 32
	// maxIterations guards verification against a corrupted stored value.
	maxIterations = 10_000_000
)

// pbkdf2Slots bounds concurrent password hashing (tens of milliseconds of
// CPU each, and logins need no authentication) to half the CPUs, so a login
// flood cannot starve the rest of the public API or the game nodes'
// heartbeats and claims on the internal listener.
var pbkdf2Slots = make(chan struct{}, max(1, runtime.GOMAXPROCS(0)/2))

// pbkdf2Wait is how long a request waits for a hashing slot before it is
// answered 503 SERVER_BUSY.
var pbkdf2Wait = 2 * time.Second

// withPasswordSlot runs fn, which hashes a password, while holding one of
// the pbkdf2Slots. A request that waits too long, or gives up, gets
// SERVER_BUSY without hashing.
func withPasswordSlot(ctx context.Context, fn func()) error {
	timer := time.NewTimer(pbkdf2Wait)
	defer timer.Stop()
	select {
	case pbkdf2Slots <- struct{}{}:
	case <-timer.C:
		return errServerBusy
	case <-ctx.Done():
		return errServerBusy
	}
	defer func() { <-pbkdf2Slots }()
	fn()
	return nil
}

// dummyPasswordHash is verified when a login names an unknown user, so the
// response time does not reveal which usernames exist.
var dummyPasswordHash = sync.OnceValue(func() string {
	hash, err := hashPassword("kartsim-timing-equalizer")
	if err != nil {
		panic(err)
	}
	return hash
})

func hashPassword(password string) (string, error) {
	salt := make([]byte, passwordSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, passwordIterations, passwordKeyBytes)
	if err != nil {
		return "", err
	}
	return strconv.Itoa(passwordIterations) + ":" + base64.StdEncoding.EncodeToString(salt) + ":" +
		base64.StdEncoding.EncodeToString(key), nil
}

// verifyPassword is Java Accounts.verifyPassword: any malformed stored value
// simply fails.
func verifyPassword(password, saved string) bool {
	parts := strings.Split(saved, ":")
	if len(parts) < 3 {
		return false
	}
	iterations, err := strconv.Atoi(parts[0])
	if err != nil || iterations <= 0 || iterations > maxIterations {
		return false
	}
	salt, err1 := decodeStdBase64(parts[1])
	expected, err2 := decodeStdBase64(parts[2])
	if err1 != nil || err2 != nil || len(expected) == 0 {
		return false
	}
	actual, err := pbkdf2.Key(sha256.New, password, salt, iterations, len(expected))
	return err == nil && subtle.ConstantTimeCompare(actual, expected) == 1
}

// decodeStdBase64 accepts standard base64 with or without padding, like
// java.util.Base64.getDecoder().
func decodeStdBase64(value string) ([]byte, error) {
	return base64.RawStdEncoding.DecodeString(strings.TrimRight(value, "="))
}

// randomCode returns n random bytes as unpadded base64url (Java randomCode):
// 32 bytes give the 43-character session token, 18 bytes an invite code.
func randomCode(n int) string {
	value := make([]byte, n)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(value)
}

// digest is the stored form of tokens, invites and profile keys:
// unpadded base64url SHA-256 of the UTF-8 text.
func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// newUUID returns a random (version 4) UUID string.
func newUUID() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		panic(err)
	}
	value[6] = value[6]&0x0f | 0x40
	value[8] = value[8]&0x3f | 0x80
	text := hex.EncodeToString(value[:])
	return text[0:8] + "-" + text[8:12] + "-" + text[12:16] + "-" + text[16:20] + "-" + text[20:32]
}
