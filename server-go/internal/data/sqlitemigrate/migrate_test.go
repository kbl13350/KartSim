package sqlitemigrate

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kartsim/internal/data/datatest"
)

// javaSchema is the DDL of the Java Database class.
var javaSchema = []string{
	`CREATE TABLE IF NOT EXISTS accounts (
	  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
	  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE,
	  password_hash TEXT NOT NULL, admin INTEGER NOT NULL DEFAULT 0,
	  created_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS sessions (
	  token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL,
	  expires_at INTEGER NOT NULL,
	  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
	)`,
	`CREATE TABLE IF NOT EXISTS invites (
	  code_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL,
	  used_by TEXT, FOREIGN KEY(used_by) REFERENCES accounts(id)
	)`,
	`CREATE TABLE IF NOT EXISTS owner_keys (
	  owner_id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL,
	  created_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS profiles (
	  owner_id TEXT PRIMARY KEY, json TEXT NOT NULL,
	  updated_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS records (
	  owner_id TEXT NOT NULL, record_id TEXT NOT NULL,
	  json TEXT NOT NULL, updated_at INTEGER NOT NULL,
	  PRIMARY KEY(owner_id, record_id)
	)`,
	`CREATE TABLE IF NOT EXISTS race_results (
	  id INTEGER PRIMARY KEY AUTOINCREMENT,
	  room_id TEXT NOT NULL, race_id TEXT NOT NULL,
	  player_id TEXT NOT NULL, name TEXT NOT NULL,
	  rank INTEGER NOT NULL, elapsed_ms INTEGER,
	  points INTEGER NOT NULL, created_at INTEGER NOT NULL,
	  UNIQUE(race_id, player_id)
	)`,
	`CREATE TABLE IF NOT EXISTS race_outcomes (
	  race_id TEXT PRIMARY KEY, room_id TEXT NOT NULL,
	  gameplay TEXT NOT NULL, track_id TEXT NOT NULL,
	  json TEXT NOT NULL, created_at INTEGER NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS room_rules (
	  room_id TEXT PRIMARY KEY, json TEXT NOT NULL,
	  updated_at INTEGER NOT NULL
	)`,
}

// Java-generated PBKDF2 hash of "correct horse battery" (see the api tests).
const javaHash = "120000:AwoRGB8mLTQ7QklQV15lbA==:ItnddrgVbI8ZaFWCHA0E4sLbai9JSSaCLK6DQwr/Wp8="

type fixture struct {
	path     string
	u        string
	accounts []string
	owners   []string
	races    []string
	rooms    []string
	invites  []string
	tokens   []string
}

// newFixture writes a Java-schema kart.db with a few rows per table,
// including one record whose JSON is broken.
func newFixture(t *testing.T, skip ...string) fixture {
	t.Helper()
	u := datatest.Unique()
	f := fixture{
		path:     filepath.Join(t.TempDir(), "kart.db"),
		u:        u,
		accounts: []string{"10000000-0000-4000-8000-" + u + "01", "10000000-0000-4000-8000-" + u + "02"},
		owners:   []string{"20000000-0000-4000-8000-" + u + "01", "20000000-0000-4000-8000-" + u + "02"},
		races:    []string{"race-a-" + u, "race-b-" + u},
		rooms:    []string{"room-a-" + u, "room-b-" + u},
		invites:  []string{"invite-hash-a-" + u, "invite-hash-b-" + u},
		tokens:   []string{"token-hash-a-" + u},
	}
	db, err := sql.Open("sqlite", "file:"+f.path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := db.Exec(query, args...); err != nil {
			t.Fatalf("%s: %v", query, err)
		}
	}
	exec("PRAGMA journal_mode=WAL")
	for _, statement := range javaSchema {
		if len(skip) > 0 && strings.Contains(statement, "EXISTS "+skip[0]+" (") {
			continue
		}
		exec(statement)
	}
	exec("INSERT INTO accounts VALUES(?, ?, ?, ?, 1, 1000)", f.accounts[0], "mig_a_"+u, "MigA"+u, javaHash)
	exec("INSERT INTO accounts VALUES(?, ?, ?, ?, 0, 2000)", f.accounts[1], "mig_b_"+u, "名字"+u, javaHash)
	exec("INSERT INTO sessions VALUES(?, ?, ?)", f.tokens[0], f.accounts[1], int64(4102444800000))
	exec("INSERT INTO invites VALUES(?, 10, ?)", f.invites[0], f.accounts[1])
	exec("INSERT INTO invites VALUES(?, 20, NULL)", f.invites[1])
	for i, owner := range f.owners {
		exec("INSERT INTO owner_keys VALUES(?, ?, ?)", owner, fmt.Sprintf("digest-%d-%s", i, u), 100+i)
		exec("INSERT INTO profiles VALUES(?, ?, ?)", owner, fmt.Sprintf(`{"name":"P%d","coins":%d}`, i, i), 200+i)
	}
	exec("INSERT INTO records VALUES(?, 'lap', '[1,2,3]', 300)", f.owners[0])
	exec("INSERT INTO records VALUES(?, 'broken', '{not json', 301)", f.owners[0])
	if len(skip) == 0 || skip[0] != "race_outcomes" {
		for i, race := range f.races {
			exec("INSERT INTO race_outcomes VALUES(?, ?, 'ordinary', 'village_R01', ?, ?)",
				race, f.rooms[0], fmt.Sprintf(`{"roomId":"%s","race":{"id":"%s"}}`, f.rooms[0], race), 500+i)
		}
	}
	exec("INSERT INTO race_results(room_id, race_id, player_id, name, rank, elapsed_ms, points, created_at) VALUES(?, ?, 'p1', 'Ann', 1, 61000, 10, 500)",
		f.rooms[0], f.races[0])
	exec("INSERT INTO race_results(room_id, race_id, player_id, name, rank, elapsed_ms, points, created_at) VALUES(?, ?, 'p2', 'Bob', 2, NULL, 0, 500)",
		f.rooms[0], f.races[0])
	exec("INSERT INTO race_results(room_id, race_id, player_id, name, rank, elapsed_ms, points, created_at) VALUES(?, ?, 'p1', 'Ann', 1, 59000, 10, 501)",
		f.rooms[0], f.races[1])
	for i, room := range f.rooms {
		exec("INSERT INTO room_rules VALUES(?, ?, ?)", room, `{"name":"Room","capacity":8}`, 600+i)
	}
	return f
}

func open(t *testing.T, path string) *sql.DB {
	t.Helper()
	db, err := OpenSQLite(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func reportsByTable(reports []TableReport) map[string]TableReport {
	byTable := map[string]TableReport{}
	for _, report := range reports {
		byTable[report.Table] = report
	}
	return byTable
}

func TestDryRunReadsJavaSchema(t *testing.T) {
	f := newFixture(t)
	var log bytes.Buffer
	reports, err := Migrate(context.Background(), open(t, f.path), nil, Options{DryRun: true, Log: &log})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int64{"accounts": 2, "sessions": 1, "invites": 2, "owner_keys": 2, "profiles": 2,
		"records": 2, "race_results": 3, "race_outcomes": 2, "room_rules": 2}
	byTable := reportsByTable(reports)
	for table, read := range want {
		if byTable[table].Read != read || byTable[table].Inserted != 0 {
			t.Errorf("%s: %+v, want %d read", table, byTable[table], read)
		}
	}
	if byTable["records"].Invalid != 1 || !strings.Contains(log.String(), "records: skipped row 1: json") {
		t.Fatalf("broken record not reported: %+v %q", byTable["records"], log.String())
	}
	var out bytes.Buffer
	WriteReport(&out, reports, true)
	if !strings.Contains(out.String(), "race_results") || !strings.Contains(out.String(), "to-copy") {
		t.Fatalf("report %s", out.String())
	}
}

// TestReadOnlyDirectory opens a WAL-mode kart.db whose directory the tool
// cannot write: mode=ro alone fails (SQLite cannot create the -shm file),
// so the file is read as immutable, unless a -wal file holds changes.
func TestReadOnlyDirectory(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root ignores directory permissions")
	}
	f := newFixture(t) // WAL mode; closing it checkpointed and removed the -wal file
	dir := filepath.Dir(f.path)
	ctx := context.Background()
	readOnly := func() {
		t.Helper()
		if err := os.Chmod(dir, 0o555); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { _ = os.Chmod(dir, 0o755) })

	readOnly()
	db, immutable, err := OpenSQLiteFile(ctx, f.path)
	if err != nil || !immutable {
		t.Fatalf("read-only directory: immutable %v, %v", immutable, err)
	}
	reports, err := Migrate(ctx, db, nil, Options{DryRun: true})
	db.Close()
	if err != nil || reportsByTable(reports)["accounts"].Read != 2 || reportsByTable(reports)["race_results"].Read != 3 {
		t.Fatalf("immutable read: %+v %v", reports, err)
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 1 {
		t.Fatalf("files were created next to the database: %v", entries)
	}

	// A writable directory opens normally (SQLite leaves -shm/-wal behind).
	if err := os.Chmod(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if db, immutable, err := OpenSQLiteFile(ctx, f.path); err != nil || immutable {
		t.Fatalf("writable directory: immutable %v, %v", immutable, err)
	} else {
		db.Close()
	}

	// Changes still in a -wal file would be invisible to an immutable read.
	_ = os.Remove(f.path + "-shm")
	if err := os.WriteFile(f.path+"-wal", []byte("uncheckpointed frames"), 0o600); err != nil {
		t.Fatal(err)
	}
	readOnly()
	if _, _, err := OpenSQLiteFile(ctx, f.path); err == nil || !strings.Contains(err.Error(), "-wal") {
		t.Fatalf("non-empty -wal in a read-only directory: %v", err)
	}
}

func TestMissingTablesAreReported(t *testing.T) {
	f := newFixture(t, "race_outcomes")
	reports, err := Migrate(context.Background(), open(t, f.path), nil, Options{DryRun: true})
	if err != nil {
		t.Fatal(err)
	}
	if !reportsByTable(reports)["race_outcomes"].Missing {
		t.Fatal("missing table not reported")
	}
}

func TestMigrateIntoMySQL(t *testing.T) {
	mysql := datatest.MySQL(t)
	f := newFixture(t)
	t.Cleanup(func() {
		for _, race := range f.races {
			datatest.Exec(t, mysql, "DELETE FROM race_results WHERE race_id = ?", race)
			datatest.Exec(t, mysql, "DELETE FROM race_outcomes WHERE race_id = ?", race)
		}
		for _, room := range f.rooms {
			datatest.Exec(t, mysql, "DELETE FROM room_rules WHERE room_id = ?", room)
		}
		for _, owner := range f.owners {
			datatest.Exec(t, mysql, "DELETE FROM records WHERE owner_id = ?", owner)
			datatest.Exec(t, mysql, "DELETE FROM profiles WHERE owner_id = ?", owner)
			datatest.Exec(t, mysql, "DELETE FROM owner_keys WHERE owner_id = ?", owner)
		}
		for _, invite := range f.invites {
			datatest.Exec(t, mysql, "DELETE FROM invites WHERE code_hash = ?", invite)
		}
		datatest.Exec(t, mysql, "DELETE FROM accounts WHERE id IN (?, ?, ?)", f.accounts[0], f.accounts[1], "conflict-"+f.u)
	})
	// An unrelated MySQL account already uses the first account's username.
	datatest.Exec(t, mysql, "INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at) VALUES(?, ?, ?, 'x', 0, 0)",
		"conflict-"+f.u, "MIG_A_"+f.u, "Conflict"+f.u)

	var log bytes.Buffer
	ctx := context.Background()
	reports, err := Migrate(ctx, open(t, f.path), mysql, Options{Log: &log, BatchRows: 2})
	if err != nil {
		t.Fatal(err)
	}
	byTable := reportsByTable(reports)
	expect := map[string][3]int64{ // inserted, existing, rejected
		"accounts": {1, 0, 1}, "sessions": {1, 0, 0}, "invites": {2, 0, 0}, "owner_keys": {2, 0, 0},
		"profiles": {2, 0, 0}, "records": {1, 0, 0}, "race_results": {3, 0, 0}, "race_outcomes": {2, 0, 0},
		"room_rules": {2, 0, 0},
	}
	for table, want := range expect {
		got := byTable[table]
		if [3]int64{got.Inserted, got.Existing, got.Rejected} != want {
			t.Errorf("%s: %+v, want inserted/existing/rejected %v", table, got, want)
		}
	}
	if !strings.Contains(log.String(), "accounts: MySQL Warning 1062") || !strings.Contains(log.String(), "uq_accounts_username") {
		t.Fatalf("conflict not logged: %q", log.String())
	}

	var hash, nickname string
	if err := mysql.QueryRow("SELECT password_hash, nickname FROM accounts WHERE id = ?", f.accounts[1]).Scan(&hash, &nickname); err != nil ||
		hash != javaHash || nickname != "名字"+f.u {
		t.Fatalf("account copied as %q %q %v", hash, nickname, err)
	}
	var usedBy sql.NullString
	if err := mysql.QueryRow("SELECT used_by FROM invites WHERE code_hash = ?", f.invites[0]).Scan(&usedBy); err != nil || usedBy.String != f.accounts[1] {
		t.Fatalf("invite used_by %v %v", usedBy, err)
	}
	rows, err := mysql.Query("SELECT race_id, player_id, elapsed_ms, account_id FROM race_results WHERE room_id = ? ORDER BY id", f.rooms[0])
	if err != nil {
		t.Fatal(err)
	}
	var order []string
	for rows.Next() {
		var race, player string
		var elapsed sql.NullInt64
		var account sql.NullString
		if err := rows.Scan(&race, &player, &elapsed, &account); err != nil {
			t.Fatal(err)
		}
		if account.Valid {
			t.Fatal("migrated result has an account id")
		}
		order = append(order, fmt.Sprintf("%s/%s/%v", race, player, elapsed.Valid))
	}
	rows.Close()
	if strings.Join(order, ",") != fmt.Sprintf("%s/p1/true,%s/p2/false,%s/p1/true", f.races[0], f.races[0], f.races[1]) {
		t.Fatalf("result order %v", order)
	}

	// A second run copies nothing new and reports the rows as existing.
	reports, err = Migrate(ctx, open(t, f.path), mysql, Options{Log: &log})
	if err != nil {
		t.Fatal(err)
	}
	for _, report := range reports {
		if report.Inserted != 0 || report.Existing+report.Rejected+report.Invalid != report.Read {
			t.Errorf("re-run %s: %+v", report.Table, report)
		}
	}
	if byTable := reportsByTable(reports); byTable["race_results"].Existing != 3 || byTable["profiles"].Existing != 2 {
		t.Fatalf("re-run counts %+v", reports)
	}
}

// collisionFixture writes a Java-schema kart.db whose nicknames Java's
// NOCASE kept apart but utf8mb4_0900_as_ci does not. It returns the path,
// the account ids (in creation order) and the session token hash of the
// second account.
func collisionFixture(t *testing.T, u string) (string, []string, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "kart.db")
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, statement := range javaSchema {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	ids := []string{
		"30000000-0000-4000-8000-" + u + "01", "30000000-0000-4000-8000-" + u + "02",
		"30000000-0000-4000-8000-" + u + "03", "30000000-0000-4000-8000-" + u + "04",
	}
	nicknames := []string{
		"Émile" + u, // registered first: kept
		"émile" + u, // same letters in another case: collides with the first
		"Emile" + u, // no accent: a different name (accent-sensitive)
		"Bob" + u,   // collides with an account already in MySQL
	}
	for i, id := range ids {
		if _, err := db.Exec("INSERT INTO accounts VALUES(?, ?, ?, ?, 0, ?)",
			id, fmt.Sprintf("col_%s_%d", u, i), nicknames[i], javaHash, 1000+i); err != nil {
			t.Fatal(err)
		}
	}
	token := "token-hash-col-" + u
	if _, err := db.Exec("INSERT INTO sessions VALUES(?, ?, ?)", token, ids[1], int64(4102444800000)); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec("INSERT INTO invites VALUES(?, 10, ?)", "invite-hash-col-"+u, ids[1]); err != nil {
		t.Fatal(err)
	}
	return path, ids, token
}

func TestCollationCollisionsAreReported(t *testing.T) {
	mysql := datatest.MySQL(t)
	u := datatest.Unique()
	path, ids, token := collisionFixture(t, u)
	existing := "conflict-" + u
	t.Cleanup(func() {
		datatest.Exec(t, mysql, "DELETE FROM sessions WHERE token_hash = ?", token)
		datatest.Exec(t, mysql, "DELETE FROM invites WHERE code_hash = ?", "invite-hash-col-"+u)
		datatest.Exec(t, mysql, "DELETE FROM accounts WHERE id IN (?, ?, ?, ?, ?)", ids[0], ids[1], ids[2], ids[3], existing)
	})
	datatest.Exec(t, mysql, "INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at) VALUES(?, ?, ?, 'x', 0, 0)",
		existing, "other_"+u, "ＢＯＢ"+u)
	ctx := context.Background()

	var log bytes.Buffer
	reports, err := Migrate(ctx, open(t, path), mysql, Options{DryRun: true, Log: &log})
	if err != nil {
		t.Fatal(err)
	}
	if got := reportsByTable(reports)["accounts"]; got.Conflicts != 2 || got.Inserted != 0 {
		t.Fatalf("dry run accounts %+v; log %s", got, log.String())
	}
	for _, want := range []string{ids[1], "same nickname as " + ids[0], ids[3], existing + ` (username "other_` + u} {
		if !strings.Contains(log.String(), want) {
			t.Fatalf("log lacks %q:\n%s", want, log.String())
		}
	}
	if strings.Contains(log.String(), ids[2]) {
		t.Fatalf("accent-different name reported:\n%s", log.String())
	}
	var out bytes.Buffer
	WriteReport(&out, reports, true)
	if !strings.Contains(out.String(), "accounts: 2 collide") {
		t.Fatalf("report %s", out.String())
	}
	var count int
	if err := mysql.QueryRow("SELECT COUNT(*) FROM accounts WHERE id IN (?, ?, ?, ?)", ids[0], ids[1], ids[2], ids[3]).Scan(&count); err != nil || count != 0 {
		t.Fatalf("dry run wrote %d accounts, %v", count, err)
	}

	log.Reset()
	reports, err = Migrate(ctx, open(t, path), mysql, Options{Log: &log})
	if err != nil {
		t.Fatal(err)
	}
	byTable := reportsByTable(reports)
	if got := byTable["accounts"]; got.Inserted != 2 || got.Rejected != 2 || got.Conflicts != 2 {
		t.Fatalf("accounts %+v", got)
	}
	if byTable["sessions"].Rejected != 1 || byTable["invites"].Rejected != 1 {
		t.Fatalf("dependent rows %+v %+v", byTable["sessions"], byTable["invites"])
	}
	if invalid, rejected, conflicts := Problems(reports); invalid != 0 || rejected != 4 || conflicts != 2 {
		t.Fatalf("problems %d %d %d", invalid, rejected, conflicts)
	}

	// Re-running counts the copied accounts as migrated, not as collisions.
	reports, err = Migrate(ctx, open(t, path), mysql, Options{DryRun: true, Log: &log})
	if err != nil || reportsByTable(reports)["accounts"].Conflicts != 2 {
		t.Fatalf("re-run %+v %v", reportsByTable(reports)["accounts"], err)
	}
}
