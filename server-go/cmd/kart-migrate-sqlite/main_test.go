package main

import (
	"bytes"
	"context"
	"database/sql"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kartsim/internal/data/datatest"
)

func TestOptionsTakeTheDSNFromTheEnvironment(t *testing.T) {
	env := func(values map[string]string) func(string) string {
		return func(name string) string { return values[name] }
	}
	const dsn = "kart:secret@tcp(127.0.0.1:3306)/kartsim"
	opts, err := parseOptions([]string{"-sqlite", "kart.db"}, env(map[string]string{"KART_MYSQL_DSN": dsn}), io.Discard)
	if err != nil || opts.mysqlDSN != dsn || opts.sqlitePath != "kart.db" || opts.dryRun {
		t.Fatalf("env DSN: %+v %v", opts, err)
	}
	opts, err = parseOptions([]string{"-sqlite", "kart.db", "-mysql", "other"}, env(map[string]string{"KART_MYSQL_DSN": dsn}), io.Discard)
	if err != nil || opts.mysqlDSN != "other" {
		t.Fatalf("-mysql overrides: %+v %v", opts, err)
	}
	if _, err := parseOptions([]string{"-sqlite", "kart.db"}, env(nil), io.Discard); err == nil {
		t.Fatal("no DSN accepted without -dry-run")
	}
	if opts, err := parseOptions([]string{"-sqlite", "kart.db", "-dry-run"}, env(nil), io.Discard); err != nil || opts.mysqlDSN != "" {
		t.Fatalf("dry run without MySQL: %+v %v", opts, err)
	}
	if _, err := parseOptions([]string{"-mysql", dsn}, env(nil), io.Discard); err == nil {
		t.Fatal("missing -sqlite accepted")
	}
}

// TestRejectedRowsFailTheRun needs KART_TEST_MYSQL_DSN: two Java accounts
// whose nicknames differ only in the case of a non-ASCII letter collide in
// MySQL, and the tool must not report success unless told to.
func TestRejectedRowsFailTheRun(t *testing.T) {
	mysql := datatest.MySQL(t)
	dsn := os.Getenv("KART_TEST_MYSQL_DSN")
	u := datatest.Unique()
	ids := []string{"40000000-0000-4000-8000-" + u + "01", "40000000-0000-4000-8000-" + u + "02"}
	token := "token-hash-cmd-" + u
	t.Cleanup(func() {
		datatest.Exec(t, mysql, "DELETE FROM sessions WHERE token_hash = ?", token)
		datatest.Exec(t, mysql, "DELETE FROM accounts WHERE id IN (?, ?)", ids[0], ids[1])
	})
	path := filepath.Join(t.TempDir(), "kart.db")
	src, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	for _, statement := range []string{
		`CREATE TABLE accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
		  nickname TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT NOT NULL,
		  admin INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
		`CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
	} {
		if _, err := src.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	for i, nickname := range []string{"Émile" + u, "émile" + u} {
		if _, err := src.Exec("INSERT INTO accounts VALUES(?, ?, ?, 'x', 0, ?)", ids[i], "cmd_"+u+string(rune('a'+i)), nickname, i); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := src.Exec("INSERT INTO sessions VALUES(?, ?, 4102444800000)", token, ids[1]); err != nil {
		t.Fatal(err)
	}
	src.Close()

	ctx := context.Background()
	migrate := func(dryRun, allowRejected bool) (string, error) {
		var out, problems bytes.Buffer
		err := run(ctx, runOptions{sqlitePath: path, mysqlDSN: dsn, dryRun: dryRun, allowRejected: allowRejected},
			&out, &problems, datatest.Logger())
		return out.String() + problems.String(), err
	}
	if output, err := migrate(true, false); err == nil || !strings.Contains(err.Error(), "1 colliding") ||
		!strings.Contains(output, "same nickname") {
		t.Fatalf("dry run: %v\n%s", err, output)
	}
	if output, err := migrate(true, true); err != nil {
		t.Fatalf("dry run with -allow-rejected: %v\n%s", err, output)
	}
	if output, err := migrate(false, false); err == nil || !strings.Contains(err.Error(), "2 rejected") {
		t.Fatalf("run: %v\n%s", err, output)
	}
	var copied int
	if err := mysql.QueryRow("SELECT COUNT(*) FROM accounts WHERE id IN (?, ?)", ids[0], ids[1]).Scan(&copied); err != nil || copied != 1 {
		t.Fatalf("%d accounts copied, %v", copied, err)
	}
	if output, err := migrate(false, true); err != nil {
		t.Fatalf("re-run with -allow-rejected: %v\n%s", err, output)
	}
}
