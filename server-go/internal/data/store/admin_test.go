package store_test

import (
	"context"
	"database/sql"
	"slices"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// Registrations and logins are recorded in their transactions; a banned
// account gets no session, and a ban ends the sessions it had.
func TestLoginRecordsAndBans(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	u := datatest.Unique()
	id := "00000000-0000-4000-8000-" + u + "b0"
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", id) })
	// "Now" is in 1970, so pruning login records only reaches rows of this
	// test (and ones the server package's sweep test deletes anyway).
	now := time.Date(1970, 9, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
	// Sessions expire in real time: the sweep test removes older ones.
	expires := time.Now().Add(time.Hour).UnixMilli()
	if _, err := st.Register(ctx, store.Registration{ID: id, Username: "ban_" + u, Nickname: "Ban" + u,
		PasswordHash: "x", TokenHash: "token-a-" + u, SessionExpiresAt: now + 3_600_000, CreatedAt: now,
		IP: "203.0.113.5", UserAgent: "Agent/1"}); err != nil {
		t.Fatal(err)
	}
	var registerIP, lastIP string
	var lastAt int64
	if err := db.QueryRow("SELECT register_ip, last_login_at, last_login_ip FROM accounts WHERE id = ?", id).
		Scan(&registerIP, &lastAt, &lastIP); err != nil || registerIP != "203.0.113.5" || lastAt != now ||
		lastIP != "203.0.113.5" {
		t.Fatalf("registered %q %d %q, %v", registerIP, lastAt, lastIP, err)
	}
	login := store.LoginRecord{IP: "2001:db8::1", UserAgent: "Agent/2", At: now + 1000}
	ended, err := st.CreateExclusiveSession(ctx, "token-b-"+u, id, expires, login)
	if err != nil || !slices.Equal(ended, []string{"token-a-" + u}) {
		t.Fatalf("login ended %v, %v", ended, err)
	}
	if err := st.CreateSession(ctx, "token-c-"+u, id, expires, store.LoginRecord{At: now + 2000}); err != nil {
		t.Fatal(err)
	}
	logins, total, err := st.AdminLogins(ctx, store.AdminPage{Limit: 10, Desc: true}, store.LoginFilter{AccountID: id})
	if err != nil || total != 3 || len(logins) != 3 || logins[0].IP != "" || logins[1].IP != "2001:db8::1" ||
		logins[1].UserAgent != "Agent/2" || logins[2].Kind != store.LoginKindRegister || logins[2].Username != "ban_"+u {
		t.Fatalf("logins %+v (%d), %v", logins, total, err)
	}

	// A ban ends both sessions and refuses later logins with until and reason.
	until, reason := now+86_400_000, "外挂"
	before, ended, err := st.AdminUpdateAccount(ctx, id, store.AccountPatch{BannedUntil: &until, BanReason: &reason}, now)
	slices.Sort(ended)
	if err != nil || before.Username != "ban_"+u || !slices.Equal(ended, []string{"token-b-" + u, "token-c-" + u}) {
		t.Fatalf("ban %+v %v, %v", before, ended, err)
	}
	for _, attempt := range []func() error{
		func() error {
			return st.CreateSession(ctx, "token-d-"+u, id, expires, store.LoginRecord{At: now + 3000})
		},
		func() error {
			_, err := st.CreateExclusiveSession(ctx, "token-d-"+u, id, expires, store.LoginRecord{At: now + 3000})
			return err
		},
	} {
		rejected, ok := apierr.As(attempt())
		if !ok || rejected.Code != "ACCOUNT_BANNED" || rejected.Fields["until"] != until || rejected.Fields["reason"] != reason {
			t.Fatalf("banned login: %+v", rejected)
		}
	}
	var sessions int
	if err := db.QueryRow("SELECT COUNT(*) FROM sessions WHERE account_id = ?", id).Scan(&sessions); err != nil || sessions != 0 {
		t.Fatalf("%d sessions, %v", sessions, err)
	}
	row, _, err := st.AdminAccount(ctx, id, now)
	if err != nil || row.BannedUntil != until || row.BanReason != reason || row.LastLoginAt != now+2000 {
		t.Fatalf("banned row %+v, %v", row, err)
	}
	if list, total, err := st.AdminAccounts(ctx, store.AdminPage{Limit: 5, Query: "ban_" + u},
		store.AccountFilter{Banned: true}, now); err != nil || total != 1 || list[0].Account.ID != id {
		t.Fatalf("banned accounts %+v, %v", list, err)
	}
	// After the ban the login works again; a kick ends the session.
	if err := st.CreateSession(ctx, "token-e-"+u, id, expires, store.LoginRecord{At: until + 1}); err != nil {
		t.Fatal(err)
	}
	if ended, err := st.RevokeSessions(ctx, id); err != nil || !slices.Equal(ended, []string{"token-e-" + u}) {
		t.Fatalf("revoked %v, %v", ended, err)
	}
	if _, err := st.RevokeSessions(ctx, "00000000-0000-4000-8000-"+u+"ff"); err == nil {
		t.Fatal("revoking an unknown account")
	}
	// A nickname in use is refused; the patch changes nothing then.
	other := "00000000-0000-4000-8000-" + u + "b1"
	datatest.Exec(t, db, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
		VALUES(?, ?, ?, 'x', 0, 0)`, other, "other_"+u, "Other"+u)
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", other) })
	taken, admin := "OTHER"+u, true
	if _, _, err := st.AdminUpdateAccount(ctx, id, store.AccountPatch{Nickname: &taken, Admin: &admin}, now); err == nil {
		t.Fatal("taken nickname accepted")
	} else if rejected, ok := apierr.As(err); !ok || rejected.Code != "NICKNAME_TAKEN" {
		t.Fatal(err)
	}
	if row, _, _ := st.AdminAccount(ctx, id, now); row.Account.Admin || row.Account.Nickname != "Ban"+u {
		t.Fatalf("refused patch applied %+v", row.Account)
	}

	// Records older than the retention go.
	pruned, err := st.PruneLoginRecords(ctx, now+1500, 10_000)
	if err != nil || pruned < 2 {
		t.Fatalf("pruned %d, %v", pruned, err)
	}
	if _, total, _ := st.AdminLogins(ctx, store.AdminPage{Limit: 10}, store.LoginFilter{AccountID: id}); total != 2 {
		t.Fatalf("%d records left", total)
	}
}

// The ledger list merges wallet and exp rows in one order across pages.
func TestAdminLedgerMergesBothLedgers(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	u := datatest.Unique()
	id := "00000000-0000-4000-8000-" + u + "c0"
	datatest.Exec(t, db, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
		VALUES(?, ?, ?, 'x', 0, 0)`, id, "ledger_"+u, "Ledger"+u)
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", id) })
	for i, at := range []int64{100, 300, 500} {
		datatest.Exec(t, db, `INSERT INTO wallet_ledger(account_id, currency, delta, balance_after, reason, ref_id, note,
			created_at) VALUES(?, 'coupon', ?, 0, 'test', ?, '', ?)`, id, i+1, "w"+u+string(rune('0'+i)), at)
	}
	for i, at := range []int64{200, 400} {
		datatest.Exec(t, db, `INSERT INTO exp_ledger(account_id, delta, exp_after, reason, ref_id, note, created_at)
			VALUES(?, ?, 0, 'test', ?, '备注', ?)`, id, 10*(i+1), "e"+u+string(rune('0'+i)), at)
	}
	var times []int64
	for page := range 3 {
		rows, total, err := st.AdminLedger(ctx, store.AdminPage{Offset: page * 2, Limit: 2, Desc: true},
			store.LedgerFilter{AccountID: id})
		if err != nil || total != 5 {
			t.Fatalf("page %d: %d, %v", page, total, err)
		}
		for _, row := range rows {
			times = append(times, row.At)
			if row.Exp != (row.Currency == "exp") || row.Username != "ledger_"+u {
				t.Fatalf("row %+v", row)
			}
		}
	}
	if !slices.Equal(times, []int64{500, 400, 300, 200, 100}) {
		t.Fatalf("order %v", times)
	}
	rows, total, err := st.AdminLedger(ctx, store.AdminPage{Limit: 5, Sort: "delta", Query: "备注"},
		store.LedgerFilter{AccountID: id})
	if err != nil || total != 2 || rows[0].Delta != 10 || rows[1].Delta != 20 {
		t.Fatalf("exp rows by note %+v, %v", rows, err)
	}
	from, to := int64(150), int64(350)
	rows, total, err = st.AdminLedger(ctx, store.AdminPage{Limit: 5, From: &from, To: &to},
		store.LedgerFilter{AccountID: id, Currency: "coupon"})
	if err != nil || total != 1 || rows[0].At != 300 {
		t.Fatalf("coupon rows in range %+v, %v", rows, err)
	}
	// A query that is not ASCII never meets the ASCII ref column.
	if _, _, err := st.AdminLedger(ctx, store.AdminPage{Limit: 5, Query: "名"}, store.LedgerFilter{AccountID: id}); err != nil {
		t.Fatal(err)
	}
}

// The new columns and tables of the admin console exist after Migrate,
// and its migrations re-apply over a database that has them (a crash
// before the version was recorded, or the second-round columns of 121 on
// a database that applied the first 120).
func TestAdminSchema(t *testing.T) {
	db := datatest.MySQL(t)
	if _, err := db.Exec("DELETE FROM schema_migrations WHERE version = 121"); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(context.Background(), db, datatest.Logger()); err != nil {
		t.Fatalf("re-applying version 121: %v", err)
	}
	for _, column := range []string{"register_ip", "last_login_at", "last_login_ip", "banned_until", "ban_reason",
		"last_seen_at", "last_seen_ip"} {
		var name sql.NullString
		if err := db.QueryRow(`SELECT column_name FROM information_schema.columns
			WHERE table_schema = DATABASE() AND table_name = 'accounts' AND column_name = ?`, column).Scan(&name); err != nil {
			t.Fatalf("accounts.%s: %v", column, err)
		}
	}
	var indexes int
	if err := db.QueryRow(`SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics
		WHERE table_schema = DATABASE() AND table_name = 'login_records'`).Scan(&indexes); err != nil || indexes != 4 {
		t.Fatalf("login_records has %d indexes, %v", indexes, err) // the primary key and three keys
	}
}

// SeenActivity keeps the newest activity, and the first one of a Beijing
// day without another record that day writes one resume record.
func TestSeenActivity(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	u := datatest.Unique()
	id := "00000000-0000-4000-8000-" + u + "d0"
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", id) })
	// 1971, so the login record pruning of other tests leaves these alone.
	day := time.Date(1971, 5, 1, 0, 0, 0, 0, time.FixedZone("UTC+8", 8*60*60)).UnixMilli()
	if _, err := st.Register(ctx, store.Registration{ID: id, Username: "seen_" + u, Nickname: "Seen" + u,
		PasswordHash: "x", TokenHash: "token-s-" + u, SessionExpiresAt: time.Now().Add(time.Hour).UnixMilli(),
		CreatedAt: day + 1000, IP: "203.0.113.1"}); err != nil {
		t.Fatal(err)
	}
	seen := func() (int64, string) {
		t.Helper()
		row, _, err := st.AdminAccount(ctx, id, day)
		if err != nil {
			t.Fatal(err)
		}
		return row.LastSeenAt, row.LastSeenIP
	}
	if at, ip := seen(); at != day+1000 || ip != "203.0.113.1" {
		t.Fatalf("registered %d %q", at, ip)
	}
	// Same day: noted, no resume (the registration is that day's record).
	if resumed, err := st.SeenActivity(ctx, id, store.LoginRecord{IP: "203.0.113.2", At: day + 5000}, day); err != nil || resumed {
		t.Fatalf("same day %v, %v", resumed, err)
	}
	// An older activity never replaces a newer one.
	if _, err := st.SeenActivity(ctx, id, store.LoginRecord{IP: "203.0.113.3", At: day + 2000}, day); err != nil {
		t.Fatal(err)
	}
	if at, ip := seen(); at != day+5000 || ip != "203.0.113.2" {
		t.Fatalf("after an older activity %d %q", at, ip)
	}
	// The next day: one resume record, then none.
	next := day + 86_400_000
	for i, want := range []bool{true, false} {
		resumed, err := st.SeenActivity(ctx, id, store.LoginRecord{IP: "203.0.113.4", UserAgent: "UA", At: next + int64(i)},
			next)
		if err != nil || resumed != want {
			t.Fatalf("next day %d: %v, %v", i, resumed, err)
		}
	}
	logins, total, err := st.AdminLogins(ctx, store.AdminPage{Limit: 10, Desc: true},
		store.LoginFilter{AccountID: id, Kind: store.LoginKindResume})
	if err != nil || total != 1 || logins[0].At != next || logins[0].IP != "203.0.113.4" || logins[0].UserAgent != "UA" {
		t.Fatalf("resume records %+v, %v", logins, err)
	}
	// A day that already has a login gets no resume record.
	third := next + 86_400_000
	if err := st.CreateSession(ctx, "token-t-"+u, id, time.Now().Add(time.Hour).UnixMilli(),
		store.LoginRecord{At: third + 10}); err != nil {
		t.Fatal(err)
	}
	datatest.Exec(t, db, "UPDATE accounts SET last_seen_at = ? WHERE id = ?", next, id)
	if resumed, err := st.SeenActivity(ctx, id, store.LoginRecord{At: third + 20}, third); err != nil || resumed {
		t.Fatalf("a day with a login %v, %v", resumed, err)
	}
	// An unknown account is ignored.
	if resumed, err := st.SeenActivity(ctx, "00000000-0000-4000-8000-"+u+"ff", store.LoginRecord{At: third}, third); err != nil ||
		resumed {
		t.Fatalf("unknown account %v, %v", resumed, err)
	}
}
