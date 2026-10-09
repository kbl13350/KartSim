package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"
)

// openTestDB is datatest.MySQL for this package (datatest imports store).
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("KART_TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("KART_TEST_MYSQL_DSN is not set")
	}
	db, err := Open(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if err := Migrate(ctx, db, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	return db
}

// TestDuplicateKeyMapping triggers real 1062 errors, as a registration racing
// a rename would, and checks they map to the API conflict codes.
func TestDuplicateKeyMapping(t *testing.T) {
	db := openTestDB(t)
	suffix := make([]byte, 5)
	_, _ = rand.Read(suffix)
	u := hex.EncodeToString(suffix)
	id := "00000000-0000-4000-8000-" + u + "ff"
	insert := func(id, username, nickname string) error {
		_, err := db.ExecContext(context.Background(),
			"INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at) VALUES(?, ?, ?, 'x', 0, 0)",
			id, username, nickname)
		return err
	}
	if err := insert(id, "dup_"+u, "Dup"+u); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := db.Exec("DELETE FROM accounts WHERE id = ?", id); err != nil {
			t.Error(err)
		}
	})

	if err := accountConflict(insert("00000000-0000-4000-8000-"+u+"fe", "DUP_"+u, "Other"+u)); err != errUsernameTaken {
		t.Fatalf("username duplicate mapped to %v", err)
	}
	if err := accountConflict(insert("00000000-0000-4000-8000-"+u+"fe", "other_"+u, "dup"+u)); err != errNicknameTaken {
		t.Fatalf("nickname duplicate mapped to %v", err)
	}
	if key, ok := duplicateKey(insert(id, "x_"+u, "X"+u)); !ok || key != "accounts.PRIMARY" {
		t.Fatalf("primary key duplicate: %q %v", key, ok)
	}
}
