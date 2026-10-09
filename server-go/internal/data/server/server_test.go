package server

import (
	"context"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

func TestSweepPrunesOldEconomyHistory(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	u := datatest.Unique()
	id := "00000000-0000-4000-8000-" + u + "03"
	datatest.Exec(t, db, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
		VALUES(?, ?, ?, 'x', 0, 0)`, id, "sw_"+u, "Sw"+u)
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", id) })
	// "Now" is in 1971, so the 30-day cutoff only reaches rows of this test.
	now := time.Date(1971, 2, 1, 4, 0, 0, 0, time.UTC)
	old, recent := now.Add(-31*24*time.Hour), now.Add(-29*24*time.Hour)
	for request, at := range map[string]time.Time{"old": old, "recent": recent} {
		datatest.Exec(t, db, `INSERT INTO timeattack_runs(account_id, request_id, track_id, elapsed_ms, result_json, created_at)
			VALUES(?, ?, 't', 20000, '{}', ?)`, id, request, at.UnixMilli())
	}
	for _, day := range []string{"1970-12-31", "1971-01-03"} {
		datatest.Exec(t, db, "INSERT INTO daily_rewards(account_id, day, kind) VALUES(?, ?, 'timeattack')", id, day)
	}
	sweepOnce(context.Background(), st, datatest.Logger(), now)
	var request, day string
	if err := db.QueryRow("SELECT GROUP_CONCAT(request_id) FROM timeattack_runs WHERE account_id = ?", id).Scan(&request); err != nil ||
		request != "recent" {
		t.Fatalf("runs left: %q, %v", request, err)
	}
	if err := db.QueryRow("SELECT GROUP_CONCAT(day) FROM daily_rewards WHERE account_id = ?", id).Scan(&day); err != nil ||
		day != "1971-01-03" {
		t.Fatalf("daily counters left: %q, %v", day, err)
	}
}
