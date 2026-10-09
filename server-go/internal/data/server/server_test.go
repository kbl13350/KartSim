package server

import (
	"context"
	"fmt"
	"slices"
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

func TestSweepPrunesMessenger(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	u := datatest.Unique()
	ids := make([]string, 4)
	for i := range ids {
		ids[i] = fmt.Sprintf("00000000-0000-4000-8000-%s%02x", u, 0x10+i)
		datatest.Exec(t, db, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
			VALUES(?, ?, ?, 'x', 0, 0)`, ids[i], fmt.Sprintf("swm_%s_%d", u, i), fmt.Sprintf("Swm%s%d", u, i))
	}
	t.Cleanup(func() {
		for _, id := range ids {
			datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", id)
		}
	})
	a, b, c, d := ids[0], ids[1], ids[2], ids[3]
	// "Now" is in 1971, so the cutoffs only reach rows of these tests.
	now := time.Date(1971, 2, 1, 4, 0, 0, 0, time.UTC)
	ms := func(offset time.Duration) int64 { return now.Add(offset).UnixMilli() }
	day := 24 * time.Hour
	request := func(from, to, state string, resolved any, expires int64) {
		datatest.Exec(t, db, `INSERT INTO friend_requests(from_id, to_id, state, created_at, resolved_at, expires_at)
			VALUES(?, ?, ?, ?, ?, ?)`, from, to, state, ms(-8*day), resolved, expires)
	}
	request(a, b, "pending", nil, ms(-day))               // expired: refused at its expiry
	request(b, a, "pending", nil, ms(day))                // still waiting
	request(a, c, "accepted", ms(-8*day), ms(-time.Hour)) // past its outbox time: deleted
	request(c, a, "refused", ms(-6*day), ms(time.Hour))   // kept
	request(a, d, "pending", nil, ms(-8*day))             // refused and already past its outbox time
	low, high := min(a, b), max(a, b)
	for client, at := range map[string]int64{"old": ms(-31 * day), "recent": ms(-29 * day)} {
		datatest.Exec(t, db, `INSERT INTO private_messages(low_id, high_id, sender_id, client_id, body, created_at)
			VALUES(?, ?, ?, ?, 'hi', ?)`, low, high, a, client, at)
	}
	for owner, at := range map[string]int64{a: ms(-31 * day), b: ms(-29 * day)} {
		peer := b
		if owner == b {
			peer = a
		}
		datatest.Exec(t, db, `INSERT INTO private_conversations(account_id, peer_id, last_message_id, last_message_at, updated_at)
			VALUES(?, ?, 1, ?, ?)`, owner, peer, at, at)
	}

	sweepOnce(context.Background(), st, datatest.Logger(), now)

	rows, err := db.Query(`SELECT from_id, to_id, state, COALESCE(resolved_at, 0), expires_at FROM friend_requests
		WHERE from_id IN (?, ?, ?, ?) ORDER BY from_id, to_id`, a, b, c, d)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var got []string
	for rows.Next() {
		var from, to, state string
		var resolved, expires int64
		if err := rows.Scan(&from, &to, &state, &resolved, &expires); err != nil {
			t.Fatal(err)
		}
		got = append(got, fmt.Sprintf("%s>%s %s %d %d", from[len(from)-1:], to[len(to)-1:], state, resolved, expires))
	}
	want := []string{
		fmt.Sprintf("%s>%s refused %d %d", a[len(a)-1:], b[len(b)-1:], ms(-day), ms(6*day)),
		fmt.Sprintf("%s>%s pending 0 %d", b[len(b)-1:], a[len(a)-1:], ms(day)),
		fmt.Sprintf("%s>%s refused %d %d", c[len(c)-1:], a[len(a)-1:], ms(-6*day), ms(time.Hour)),
	}
	slices.Sort(got)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Fatalf("requests left:\n%v\nwant\n%v", got, want)
	}
	var message string
	if err := db.QueryRow("SELECT GROUP_CONCAT(client_id) FROM private_messages WHERE low_id = ? AND high_id = ?",
		low, high).Scan(&message); err != nil || message != "recent" {
		t.Fatalf("messages left: %q, %v", message, err)
	}
	var owner string
	if err := db.QueryRow("SELECT GROUP_CONCAT(account_id) FROM private_conversations WHERE account_id IN (?, ?)",
		a, b).Scan(&owner); err != nil || owner != b {
		t.Fatalf("conversations left: %q, %v", owner, err)
	}
}
