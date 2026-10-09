package store_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

func TestNormalizeDSN(t *testing.T) {
	cfg, err := store.NormalizeDSN("kart:kart@tcp(127.0.0.1:3306)/kartsim?charset=utf8mb4&collation=utf8mb4_0900_as_ci&parseTime=true")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ParseTime || cfg.Collation != "utf8mb4_0900_ai_ci" || cfg.Params["collation_connection"] != "utf8mb4_0900_as_ci" ||
		cfg.Timeout == 0 || cfg.ReadTimeout == 0 {
		t.Fatalf("normalized config %+v", cfg)
	}
	if _, err := store.NormalizeDSN("not a dsn"); err == nil {
		t.Fatal("bad DSN accepted")
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	db := datatest.MySQL(t) // runs Migrate once
	ctx := context.Background()
	var wg sync.WaitGroup
	errs := make(chan error, 3)
	for range 3 { // concurrent starters serialize on GET_LOCK
		wg.Go(func() { errs <- store.Migrate(ctx, db, datatest.Logger()) })
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	version, err := store.SchemaVersion(ctx, db)
	if err != nil || version != store.LatestSchemaVersion() {
		t.Fatalf("schema version %d, %v", version, err)
	}
	var collation string
	if err := db.QueryRow("SELECT @@collation_connection").Scan(&collation); err != nil || collation != "utf8mb4_0900_as_ci" {
		t.Fatalf("connection collation %q, %v", collation, err)
	}
	if err := db.QueryRow(`SELECT COLLATION_NAME FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND COLUMN_NAME = 'nickname'`).Scan(&collation); err != nil ||
		collation != "utf8mb4_0900_as_ci" {
		t.Fatalf("nickname collation %q, %v", collation, err)
	}
}

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func TestRegisterSerializesOnInvite(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	u := datatest.Unique()
	invite := digest("invite-" + u)
	datatest.Exec(t, db, "INSERT INTO invites(code_hash, created_at) VALUES(?, ?)", invite, time.Now().UnixMilli())
	t.Cleanup(func() {
		datatest.Exec(t, db, "DELETE FROM invites WHERE code_hash = ?", invite)
		datatest.Exec(t, db, "DELETE FROM accounts WHERE username LIKE ?", "%"+u)
	})

	const racers = 4
	var wg sync.WaitGroup
	results := make(chan error, racers)
	for i := range racers {
		wg.Go(func() {
			_, err := st.Register(ctx, store.Registration{
				ID:               "00000000-0000-4000-8000-" + u + string(rune('a'+i)) + "0",
				Username:         "r" + string(rune('a'+i)) + "_" + u,
				Nickname:         "R" + string(rune('a'+i)) + u,
				PasswordHash:     "120000:AA==:AA==",
				InviteHash:       invite,
				InviteMode:       i%2 == 0, // open-mode registrations may use invites too
				TokenHash:        "token-" + u + string(rune('a'+i)),
				SessionExpiresAt: time.Now().Add(time.Hour).UnixMilli(),
				CreatedAt:        time.Now().UnixMilli(),
			})
			results <- err
		})
	}
	wg.Wait()
	close(results)
	succeeded := 0
	for err := range results {
		if err == nil {
			succeeded++
			continue
		}
		if rejected, ok := apierr.As(err); !ok || rejected.Code != "INVALID_INVITE" {
			t.Fatalf("unexpected error %v", err)
		}
	}
	if succeeded != 1 {
		t.Fatalf("%d registrations used one invite", succeeded)
	}
}

func TestDuplicateNicknameMapsToConflict(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	u := datatest.Unique()
	first, second := "00000000-0000-4000-8000-"+u+"01", "00000000-0000-4000-8000-"+u+"02"
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE id IN (?, ?)", first, second) })
	for _, row := range [][]any{{first, "a_" + u, "Ä" + u}, {second, "b_" + u, "B" + u}} {
		datatest.Exec(t, db, "INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at) VALUES(?, ?, ?, 'x', 0, 0)", row...)
	}
	// Case-insensitive but accent-sensitive, like the Java NOCASE checks.
	err := st.Rename(ctx, second, "ä"+u)
	if rejected, ok := apierr.As(err); !ok || rejected.Code != "NICKNAME_TAKEN" {
		t.Fatalf("rename to another case: %v", err)
	}
	if err := st.Rename(ctx, second, "A"+u); err != nil {
		t.Fatalf("accent-different name refused: %v", err)
	}
	taken, err := st.NicknameTaken(ctx, "ä"+u)
	if err != nil || !taken {
		t.Fatal("case-insensitive lookup failed")
	}
	if err := st.Rename(ctx, first, "ä"+u); err != nil {
		t.Fatalf("own name in another case: %v", err)
	}
}
