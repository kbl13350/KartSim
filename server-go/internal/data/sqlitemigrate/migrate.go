// Package sqlitemigrate copies the Java service's SQLite kart.db into the
// MySQL schema of the data service. Rows are copied as they are (password
// hashes, token and key digests keep their format) with INSERT IGNORE, so a
// run can be repeated: rows already present are skipped and counted.
//
// The Java race_results table has no account column; migrated results
// therefore have account_id NULL and do not feed player_stats.
//
// MySQL compares usernames and nicknames with utf8mb4_0900_as_ci, which is
// stricter than Java's NOCASE (ASCII-only case folding): it also folds the
// case of other letters, matches compatibility forms such as fullwidth
// letters and ignores characters such as the soft hyphen. Accounts that
// collide under it are reported before anything is copied (also in a dry
// run); MySQL then rejects them together with their sessions and invites.
package sqlitemigrate

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	_ "modernc.org/sqlite" // registers the "sqlite" driver
)

// Options tune a migration run.
type Options struct {
	// DryRun reads and validates every row without writing to MySQL.
	DryRun bool
	// BatchRows and BatchBytes bound one multi-row INSERT.
	BatchRows  int
	BatchBytes int
	// Log receives row-level problems (invalid rows, MySQL warnings).
	Log io.Writer
}

// TableReport counts what happened to one table.
type TableReport struct {
	Table    string
	Missing  bool  // the SQLite file has no such table
	Read     int64 // rows read from SQLite
	Invalid  int64 // rows that cannot be stored in the MySQL schema
	Inserted int64 // rows inserted
	Existing int64 // rows skipped because their key is already in MySQL
	Rejected int64 // rows MySQL skipped for another reason (see the log)
	// Conflicts counts accounts whose username or nickname equals another
	// account's under the MySQL collation; MySQL rejects them (see the log).
	Conflicts int64
}

// Problems totals the rows a migration leaves behind: invalid rows, rows
// MySQL rejected and colliding accounts (which are also rejected in a real
// run, so an account can count twice).
func Problems(reports []TableReport) (invalid, rejected, conflicts int64) {
	for _, report := range reports {
		invalid += report.Invalid
		rejected += report.Rejected
		conflicts += report.Conflicts
	}
	return invalid, rejected, conflicts
}

// maxLoggedProblems limits the row-level lines printed per table.
const maxLoggedProblems = 20

// OpenSQLite opens path read-only. SQLite may create empty -shm/-wal files
// next to a WAL-mode database; run the tool on a copy or with the Java
// service stopped.
//
// A WAL-mode database cannot be opened read-only in a directory the process
// cannot write to (SQLite needs to create the -shm file). Then the file is
// opened with immutable=1, which reads it without any locking or shared
// memory; that is only correct while nothing writes it, and only when no
// -wal file holds changes not yet in the database file, so a non-empty
// -wal refuses instead.
func OpenSQLite(ctx context.Context, path string) (*sql.DB, error) {
	db, _, err := OpenSQLiteFile(ctx, path)
	return db, err
}

// OpenSQLiteFile is OpenSQLite that also reports whether the file had to be
// opened immutable.
func OpenSQLiteFile(ctx context.Context, path string) (db *sql.DB, immutable bool, err error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, false, err
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return nil, false, err
	}
	if !info.Mode().IsRegular() {
		return nil, false, fmt.Errorf("%s is not a regular file", absolute)
	}
	db, err = openSQLite(ctx, absolute, "mode=ro&_pragma=busy_timeout(5000)")
	if err == nil {
		return db, false, nil
	}
	if !readOnlyFailure(err) {
		return nil, false, fmt.Errorf("open %s: %w", absolute, err)
	}
	if wal, statErr := os.Stat(absolute + "-wal"); statErr == nil && wal.Size() > 0 {
		return nil, false, fmt.Errorf("open %s: %w; its -wal file holds changes and the directory is read-only, "+
			"so copy kart.db, kart.db-wal and kart.db-shm to a writable directory and migrate the copy", absolute, err)
	}
	db, immutableErr := openSQLite(ctx, absolute, "mode=ro&immutable=1")
	if immutableErr != nil {
		return nil, false, fmt.Errorf("open %s: %w (read-only: %v)", absolute, immutableErr, err)
	}
	return db, true, nil
}

func openSQLite(ctx context.Context, absolute, query string) (*sql.DB, error) {
	uri := (&url.URL{Scheme: "file", Path: absolute, RawQuery: query}).String()
	db, err := sql.Open("sqlite", uri)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	// Ping opens the file; the query makes SQLite read the schema (and set
	// up WAL shared memory), which is where a read-only directory fails.
	var tables int
	err = db.PingContext(ctx)
	if err == nil {
		err = db.QueryRowContext(ctx, "SELECT COUNT(*) FROM sqlite_master").Scan(&tables)
	}
	if err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// readOnlyFailure reports whether err is SQLite's SQLITE_READONLY family
// or SQLITE_CANTOPEN, which a WAL database in a read-only directory gives.
func readOnlyFailure(err error) bool {
	var coded interface{ Code() int }
	if errors.As(err, &coded) {
		primary := coded.Code() & 0xff
		return primary == 8 || primary == 14 // SQLITE_READONLY, SQLITE_CANTOPEN
	}
	message := err.Error()
	return strings.Contains(message, "readonly") || strings.Contains(message, "unable to open")
}

// column describes how one SQLite value is read and checked.
type column struct {
	name     string
	kind     columnKind
	max      int  // maximum length (bytes for ASCII, code points for text)
	nullable bool // NULL allowed
}

type columnKind int

const (
	asciiColumn  columnKind = iota // ascii_bin column
	textColumn                     // utf8mb4 text with a length limit
	jsonColumn                     // JSON document (LONGTEXT or TEXT)
	intColumn                      // INT (32-bit)
	bigintColumn                   // BIGINT
)

// table is one copied table: SQLite columns in order, the MySQL target
// columns (which may add constant ones), and the key whose duplicates mean
// "already migrated".
type table struct {
	name       string
	columns    []column
	orderBy    string
	target     string // MySQL column list
	extra      []any  // constant values appended to every row
	naturalKey string // MySQL key name, as in "Duplicate entry ... for key '<table>.<key>'"
}

var tables = []table{
	{name: "accounts", orderBy: "created_at, id", naturalKey: "PRIMARY", columns: []column{
		{name: "id", kind: asciiColumn, max: 36}, {name: "username", kind: textColumn, max: 24},
		{name: "nickname", kind: textColumn, max: 64}, {name: "password_hash", kind: asciiColumn, max: 255},
		{name: "admin", kind: intColumn}, {name: "created_at", kind: bigintColumn},
	}},
	{name: "sessions", orderBy: "token_hash", naturalKey: "PRIMARY", columns: []column{
		{name: "token_hash", kind: asciiColumn, max: 64}, {name: "account_id", kind: asciiColumn, max: 36},
		{name: "expires_at", kind: bigintColumn},
	}},
	{name: "invites", orderBy: "created_at, code_hash", naturalKey: "PRIMARY", columns: []column{
		{name: "code_hash", kind: asciiColumn, max: 64}, {name: "created_at", kind: bigintColumn},
		{name: "used_by", kind: asciiColumn, max: 36, nullable: true},
	}},
	{name: "owner_keys", orderBy: "owner_id", naturalKey: "PRIMARY", columns: []column{
		{name: "owner_id", kind: asciiColumn, max: 64}, {name: "secret_hash", kind: asciiColumn, max: 64},
		{name: "created_at", kind: bigintColumn},
	}},
	{name: "profiles", orderBy: "owner_id", naturalKey: "PRIMARY", columns: []column{
		{name: "owner_id", kind: asciiColumn, max: 64}, {name: "json", kind: jsonColumn, max: math.MaxInt32},
		{name: "updated_at", kind: bigintColumn},
	}},
	{name: "records", orderBy: "owner_id, record_id", naturalKey: "PRIMARY", columns: []column{
		{name: "owner_id", kind: asciiColumn, max: 64}, {name: "record_id", kind: asciiColumn, max: 100},
		{name: "json", kind: jsonColumn, max: math.MaxInt32}, {name: "updated_at", kind: bigintColumn},
	}},
	{name: "race_results", orderBy: "id", naturalKey: "uq_race_results_player",
		// The MySQL id is assigned anew in SQLite id order, which keeps the
		// (created_at DESC, id DESC) history order; account_id is unknown.
		target: "room_id, race_id, player_id, name, `rank`, elapsed_ms, points, created_at, account_id",
		extra:  []any{nil},
		columns: []column{
			{name: "room_id", kind: asciiColumn, max: 64}, {name: "race_id", kind: asciiColumn, max: 64},
			{name: "player_id", kind: asciiColumn, max: 64}, {name: "name", kind: textColumn, max: 64},
			{name: "rank", kind: intColumn}, {name: "elapsed_ms", kind: intColumn, nullable: true},
			{name: "points", kind: intColumn}, {name: "created_at", kind: bigintColumn},
		}},
	{name: "race_outcomes", orderBy: "created_at, race_id", naturalKey: "PRIMARY", columns: []column{
		{name: "race_id", kind: asciiColumn, max: 64}, {name: "room_id", kind: asciiColumn, max: 64},
		{name: "gameplay", kind: asciiColumn, max: 20}, {name: "track_id", kind: textColumn, max: 64},
		{name: "json", kind: jsonColumn, max: math.MaxInt32}, {name: "created_at", kind: bigintColumn},
	}},
	{name: "room_rules", orderBy: "updated_at, room_id", naturalKey: "PRIMARY", columns: []column{
		{name: "room_id", kind: asciiColumn, max: 64}, {name: "json", kind: jsonColumn, max: 65_535},
		{name: "updated_at", kind: bigintColumn},
	}},
}

// Migrate copies every table from src to dst in dependency order. dst may be
// nil in a dry run. The MySQL schema must already exist for a real run.
// Whenever dst is given, accounts that collide under the MySQL collation
// are reported to opts.Log first.
func Migrate(ctx context.Context, src, dst *sql.DB, opts Options) ([]TableReport, error) {
	if opts.BatchRows <= 0 {
		opts.BatchRows = 500
	}
	if opts.BatchBytes <= 0 {
		opts.BatchBytes = 4 << 20
	}
	if opts.Log == nil {
		opts.Log = io.Discard
	}
	if !opts.DryRun && dst == nil {
		return nil, errors.New("a MySQL connection is required unless dry-running")
	}
	var conn *sql.Conn
	if !opts.DryRun {
		var err error
		// One connection, so SHOW WARNINGS describes the preceding INSERT.
		if conn, err = dst.Conn(ctx); err != nil {
			return nil, err
		}
		defer conn.Close()
	}
	var conflicts int64
	if dst != nil {
		var err error
		if conflicts, err = accountConflicts(ctx, src, dst, opts.Log); err != nil {
			return nil, fmt.Errorf("accounts: collation check: %w", err)
		}
	}
	reports := make([]TableReport, 0, len(tables))
	for _, spec := range tables {
		report, err := copyTable(ctx, src, conn, spec, opts)
		if spec.name == "accounts" {
			report.Conflicts = conflicts
		}
		reports = append(reports, report)
		if err != nil {
			return reports, fmt.Errorf("%s: %w", spec.name, err)
		}
	}
	return reports, nil
}

func copyTable(ctx context.Context, src *sql.DB, conn *sql.Conn, spec table, opts Options) (TableReport, error) {
	report := TableReport{Table: spec.name}
	var present int
	if err := src.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?", spec.name).Scan(&present); err != nil {
		return report, err
	}
	if present == 0 {
		report.Missing = true
		return report, nil
	}

	names := make([]string, len(spec.columns))
	for i, col := range spec.columns {
		names[i] = `"` + col.name + `"`
	}
	rows, err := src.QueryContext(ctx, "SELECT "+strings.Join(names, ", ")+" FROM "+spec.name+" ORDER BY "+spec.orderBy)
	if err != nil {
		return report, err
	}
	defer rows.Close()

	target := spec.target
	if target == "" {
		quoted := make([]string, len(spec.columns))
		for i, col := range spec.columns {
			quoted[i] = "`" + col.name + "`"
		}
		target = strings.Join(quoted, ", ")
	}
	width := len(spec.columns) + len(spec.extra)
	placeholder := "(" + strings.TrimSuffix(strings.Repeat("?, ", width), ", ") + ")"
	batch := &insertBatch{
		conn:        conn,
		prefix:      "INSERT IGNORE INTO " + spec.name + " (" + target + ") VALUES ",
		placeholder: placeholder,
		naturalKey:  spec.name + "." + spec.naturalKey,
		report:      &report,
		log:         opts.Log,
	}
	problems := 0
	for rows.Next() {
		values, problem, err := scanRow(rows, spec.columns)
		if err != nil {
			return report, err
		}
		report.Read++
		if problem != "" {
			report.Invalid++
			if problems < maxLoggedProblems {
				fmt.Fprintf(opts.Log, "%s: skipped row %d: %s\n", spec.name, report.Read, problem)
			}
			problems++
			continue
		}
		if opts.DryRun {
			continue
		}
		batch.add(append(values, spec.extra...))
		if batch.count >= opts.BatchRows || batch.bytes >= opts.BatchBytes {
			if err := batch.flush(ctx); err != nil {
				return report, err
			}
		}
	}
	if err := rows.Err(); err != nil {
		return report, err
	}
	if !opts.DryRun {
		if err := batch.flush(ctx); err != nil {
			return report, err
		}
	}
	return report, nil
}

// scanRow reads one row and reports why it cannot be stored, if so.
func scanRow(rows *sql.Rows, columns []column) ([]any, string, error) {
	raw := make([]any, len(columns))
	targets := make([]any, len(columns))
	for i := range raw {
		targets[i] = &raw[i]
	}
	if err := rows.Scan(targets...); err != nil {
		return nil, "", err
	}
	values := make([]any, len(columns))
	for i, col := range columns {
		value, problem := convert(raw[i], col)
		if problem != "" {
			return nil, col.name + " " + problem, nil
		}
		values[i] = value
	}
	return values, "", nil
}

// convert normalizes a dynamically typed SQLite value for its MySQL column.
func convert(value any, col column) (any, string) {
	if value == nil {
		if col.nullable {
			return nil, ""
		}
		return nil, "is NULL"
	}
	switch col.kind {
	case intColumn, bigintColumn:
		number, ok := value.(int64)
		if !ok {
			return nil, fmt.Sprintf("is not an integer (%T)", value)
		}
		if col.kind == intColumn && (number < math.MinInt32 || number > math.MaxInt32) {
			return nil, "is out of INT range"
		}
		return number, ""
	}
	var text string
	switch typed := value.(type) {
	case string:
		text = typed
	case []byte:
		text = string(typed)
	default:
		return nil, fmt.Sprintf("is not text (%T)", value)
	}
	switch col.kind {
	case asciiColumn:
		if text == "" || len(text) > col.max {
			return nil, fmt.Sprintf("must have 1..%d characters", col.max)
		}
		for i := 0; i < len(text); i++ {
			if text[i] < 0x20 || text[i] >= 0x7F {
				return nil, "is not printable ASCII"
			}
		}
	case textColumn:
		if !utf8.ValidString(text) || utf8.RuneCountInString(text) > col.max {
			return nil, fmt.Sprintf("is not UTF-8 text of at most %d characters", col.max)
		}
	case jsonColumn:
		if !utf8.ValidString(text) || !json.Valid([]byte(text)) || len(text) > col.max {
			return nil, "is not a valid JSON document within the column size"
		}
	}
	return text, ""
}

// insertBatch accumulates rows for one multi-row INSERT IGNORE.
type insertBatch struct {
	conn        *sql.Conn
	prefix      string
	placeholder string
	naturalKey  string
	report      *TableReport
	log         io.Writer

	args     []any
	count    int
	bytes    int
	problems int
}

func (b *insertBatch) add(values []any) {
	b.args = append(b.args, values...)
	b.count++
	for _, value := range values {
		if text, ok := value.(string); ok {
			b.bytes += len(text)
		} else {
			b.bytes += 8
		}
	}
}

func (b *insertBatch) flush(ctx context.Context) error {
	if b.count == 0 {
		return nil
	}
	query := b.prefix + strings.TrimSuffix(strings.Repeat(b.placeholder+", ", b.count), ", ")
	result, err := b.conn.ExecContext(ctx, query, b.args...)
	if err != nil {
		return err
	}
	inserted, err := result.RowsAffected()
	if err != nil {
		return err
	}
	b.report.Inserted += inserted
	skipped := int64(b.count) - inserted

	// INSERT IGNORE turns every skipped row into a warning. Duplicates of the
	// natural key are rows migrated before; anything else is reported.
	var other int64
	if skipped > 0 {
		warnings, err := b.conn.QueryContext(ctx, "SHOW WARNINGS")
		if err != nil {
			return err
		}
		for warnings.Next() {
			var (
				level   string
				code    int
				message string
			)
			if err := warnings.Scan(&level, &code, &message); err != nil {
				warnings.Close()
				return err
			}
			if code == 1062 && strings.Contains(message, "for key '"+b.naturalKey+"'") {
				continue
			}
			other++
			if b.problems < maxLoggedProblems {
				fmt.Fprintf(b.log, "%s: MySQL %s %d: %s\n", b.report.Table, level, code, message)
			}
			b.problems++
		}
		if err := warnings.Close(); err != nil {
			return err
		}
	}
	other = min(other, skipped)
	b.report.Rejected += other
	b.report.Existing += skipped - other
	b.args, b.count, b.bytes = b.args[:0], 0, 0
	return nil
}

// targetCollation is the collation of the MySQL username and nickname
// columns; weightBatch bounds the names sent in one WEIGHT_STRING query.
const (
	targetCollation = "utf8mb4_0900_as_ci"
	weightBatch     = 200
)

// account identifies one account in a conflict report.
type account struct {
	id, username, nickname, source string
}

func (a account) String() string {
	return fmt.Sprintf("%s (username %q, nickname %q, %s)", a.id, a.username, a.nickname, a.source)
}

// accountConflicts reports the SQLite accounts that a MySQL unique key will
// reject although the Java service accepted them. Names are compared by
// their collation weight strings (equal exactly when the collation says the
// names are equal), in migration order, against the accounts already in
// MySQL and the SQLite accounts copied before them. Accounts whose id is
// already in MySQL were migrated earlier and are skipped.
func accountConflicts(ctx context.Context, src, dst *sql.DB, log io.Writer) (int64, error) {
	var present int
	if err := src.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'accounts'").Scan(&present); err != nil {
		return 0, err
	}
	if present == 0 {
		return 0, nil
	}
	accounts, err := sqliteAccounts(ctx, src)
	if err != nil {
		return 0, err
	}
	names := make([]string, 0, 2*len(accounts))
	for _, acct := range accounts {
		names = append(names, acct.username, acct.nickname)
	}
	weights, err := collationWeights(ctx, dst, names)
	if err != nil {
		return 0, err
	}

	byUsername, byNickname := map[string]account{}, map[string]account{}
	migrated := map[string]bool{}
	if err := mysqlAccounts(ctx, dst, func(acct account, username, nickname string) {
		migrated[acct.id] = true
		byUsername[username] = acct
		byNickname[nickname] = acct
	}); err != nil {
		return 0, err
	}

	var conflicts int64
	for i, acct := range accounts {
		if migrated[acct.id] {
			continue
		}
		username, nickname := weights[2*i], weights[2*i+1]
		other, field := account{}, ""
		if holder, taken := byUsername[username]; taken && holder.id != acct.id {
			other, field = holder, "username"
		} else if holder, taken := byNickname[nickname]; taken && holder.id != acct.id {
			other, field = holder, "nickname"
		}
		if field == "" {
			byUsername[username], byNickname[nickname] = acct, acct
			continue
		}
		if conflicts < maxLoggedProblems {
			fmt.Fprintf(log, "accounts: %s has the same %s as %s under %s; MySQL rejects it, its sessions and its invites\n",
				acct, field, other, targetCollation)
		}
		conflicts++
	}
	if conflicts > maxLoggedProblems {
		fmt.Fprintf(log, "accounts: %d more colliding accounts not listed\n", conflicts-maxLoggedProblems)
	}
	return conflicts, nil
}

// sqliteAccounts reads the storable SQLite accounts in migration order.
// Invalid rows are skipped here; copyTable reports them.
func sqliteAccounts(ctx context.Context, src *sql.DB) ([]account, error) {
	columns := []column{
		{name: "id", kind: asciiColumn, max: 36}, {name: "username", kind: textColumn, max: 24},
		{name: "nickname", kind: textColumn, max: 64},
	}
	rows, err := src.QueryContext(ctx, `SELECT "id", "username", "nickname" FROM accounts ORDER BY created_at, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var accounts []account
	for rows.Next() {
		values, problem, err := scanRow(rows, columns)
		if err != nil {
			return nil, err
		}
		if problem != "" {
			continue
		}
		accounts = append(accounts, account{
			id: values[0].(string), username: values[1].(string), nickname: values[2].(string), source: "in the SQLite file",
		})
	}
	return accounts, rows.Err()
}

// mysqlAccounts calls fn with every MySQL account and the weight strings of
// its username and nickname. A database without the accounts table (a dry
// run before the schema exists) has none.
func mysqlAccounts(ctx context.Context, dst *sql.DB, fn func(acct account, username, nickname string)) error {
	var present int
	if err := dst.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts'`).Scan(&present); err != nil {
		return err
	}
	if present == 0 {
		return nil
	}
	rows, err := dst.QueryContext(ctx, `SELECT id, username, nickname,
		WEIGHT_STRING(username COLLATE `+targetCollation+`), WEIGHT_STRING(nickname COLLATE `+targetCollation+`)
		FROM accounts`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		acct := account{source: "already in MySQL"}
		var username, nickname []byte
		if err := rows.Scan(&acct.id, &acct.username, &acct.nickname, &username, &nickname); err != nil {
			return err
		}
		fn(acct, string(username), string(nickname))
	}
	return rows.Err()
}

// collationWeights returns the weight string of each name under the target
// collation, computed by MySQL.
func collationWeights(ctx context.Context, dst *sql.DB, names []string) ([]string, error) {
	weights := make([]string, 0, len(names))
	expression := "WEIGHT_STRING(CONVERT(? USING utf8mb4) COLLATE " + targetCollation + ")"
	for start := 0; start < len(names); start += weightBatch {
		batch := names[start:min(start+weightBatch, len(names))]
		selects := make([]string, len(batch))
		args := make([]any, 0, 2*len(batch))
		for i, name := range batch {
			selects[i] = "SELECT ? AS n, " + expression + " AS w"
			args = append(args, i, name)
		}
		rows, err := dst.QueryContext(ctx, "SELECT w FROM ("+strings.Join(selects, " UNION ALL ")+") AS names ORDER BY n", args...)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var weight []byte
			if err := rows.Scan(&weight); err != nil {
				rows.Close()
				return nil, err
			}
			weights = append(weights, string(weight))
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, err
		}
	}
	if len(weights) != len(names) {
		return nil, fmt.Errorf("MySQL returned %d weight strings for %d names", len(weights), len(names))
	}
	return weights, nil
}

// WriteReport prints the per-table counts.
func WriteReport(out io.Writer, reports []TableReport, dryRun bool) {
	if dryRun {
		fmt.Fprintf(out, "%-14s %8s %8s %8s\n", "table", "read", "invalid", "to-copy")
	} else {
		fmt.Fprintf(out, "%-14s %8s %8s %8s %8s %8s\n", "table", "read", "invalid", "inserted", "existing", "rejected")
	}
	for _, report := range reports {
		switch {
		case report.Missing:
			fmt.Fprintf(out, "%-14s (not in the SQLite file)\n", report.Table)
		case dryRun:
			fmt.Fprintf(out, "%-14s %8d %8d %8d\n", report.Table, report.Read, report.Invalid, report.Read-report.Invalid)
		default:
			fmt.Fprintf(out, "%-14s %8d %8d %8d %8d %8d\n", report.Table, report.Read, report.Invalid,
				report.Inserted, report.Existing, report.Rejected)
		}
	}
	for _, report := range reports {
		if report.Conflicts > 0 {
			fmt.Fprintf(out, "%s: %d collide with another account under %s and are not copied (see the log)\n",
				report.Table, report.Conflicts, targetCollation)
		}
	}
}
