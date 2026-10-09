package store_test

import (
	"context"
	"fmt"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// testAccount inserts an account and removes it (and its rows) afterwards.
func testAccount(t *testing.T, st *store.Store, suffix string) string {
	t.Helper()
	u := datatest.Unique()
	id := "00000000-0000-4000-8000-" + u + suffix
	datatest.Exec(t, st.DB(), `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
		VALUES(?, ?, ?, 'x', 0, 0)`, id, "h"+suffix+"_"+u, "H"+suffix+u)
	t.Cleanup(func() { datatest.Exec(t, st.DB(), "DELETE FROM accounts WHERE id = ?", id) })
	return id
}

func TestTimeAttackTrackLimit(t *testing.T) {
	st := store.New(datatest.MySQL(t))
	ctx := context.Background()
	id := testAccount(t, st, "01")
	at := int64(1_800_000_000_000)
	run := func(track string) error {
		at += 60_000
		_, err := st.SettleTimeAttack(ctx, store.TimeAttackRun{AccountID: id, RequestID: fmt.Sprintf("req-%d", at),
			TrackID: track, ElapsedMs: 20_000, Day: "2027-01-15", Now: at, MaxTracks: 2})
		return err
	}
	for _, track := range []string{"t1", "t2", "t1", "t2"} {
		if err := run(track); err != nil {
			t.Fatalf("%s: %v", track, err)
		}
	}
	if rejected, ok := apierr.As(run("t3")); !ok || rejected.Code != "INVALID_TRACK" {
		t.Fatalf("a third track: %v", rejected)
	}
	if err := run("t1"); err != nil {
		t.Fatalf("a known track after the refusal: %v", err)
	}
}

func TestPruneEconomyHistory(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	id := testAccount(t, st, "02")
	// Far in the past, so no other test's rows are older than the cutoff.
	for _, row := range []struct {
		request string
		at      int64
	}{{"old", 1_000}, {"keep", 5_000}} {
		datatest.Exec(t, db, `INSERT INTO timeattack_runs(account_id, request_id, track_id, elapsed_ms, result_json, created_at)
			VALUES(?, ?, 't', 20000, '{}', ?)`, id, row.request, row.at)
	}
	for _, day := range []string{"1971-01-01", "1971-01-03"} {
		datatest.Exec(t, db, "INSERT INTO daily_rewards(account_id, day, kind, count, exp, lucci) VALUES(?, ?, 'race', 1, 1, 1)", id, day)
	}
	runs, days, err := st.PruneEconomyHistory(ctx, 2_000, "1971-01-02", 10_000)
	if err != nil || runs < 1 || days < 1 {
		t.Fatalf("pruned %d runs, %d days, %v", runs, days, err)
	}
	var request, day string
	if err := db.QueryRow("SELECT request_id FROM timeattack_runs WHERE account_id = ?", id).Scan(&request); err != nil || request != "keep" {
		t.Fatalf("left run %q, %v", request, err)
	}
	if err := db.QueryRow("SELECT day FROM daily_rewards WHERE account_id = ?", id).Scan(&day); err != nil || day != "1971-01-03" {
		t.Fatalf("left day %q, %v", day, err)
	}
}

func TestSchemaVersion3(t *testing.T) {
	db := datatest.MySQL(t)
	for _, index := range [][2]string{{"timeattack_runs", "idx_timeattack_runs_created"}, {"daily_rewards", "idx_daily_rewards_day"}} {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.statistics
			WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, index[0], index[1]).Scan(&n); err != nil || n == 0 {
			t.Fatalf("index %s.%s missing: %v", index[0], index[1], err)
		}
	}
	for _, table := range []string{"admin_grants", "timeattack_state"} {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.tables
			WHERE table_schema = DATABASE() AND table_name = ?`, table).Scan(&n); err != nil || n != 1 {
			t.Fatalf("table %s missing: %v", table, err)
		}
	}
	// Re-applying version 3 (a crash after its DDL, before it was recorded)
	// must not fail on the existing indexes.
	if _, err := db.Exec("DELETE FROM schema_migrations WHERE version = 3"); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(context.Background(), db, datatest.Logger()); err != nil {
		t.Fatalf("re-applying version 3: %v", err)
	}
}
