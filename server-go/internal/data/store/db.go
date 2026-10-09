// Package store is the MySQL boundary of the data service. It owns the
// schema and every SQL statement; callers above it decide about caching.
package store

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"kartsim/internal/data/economy"
)

const (
	connectionCharset   = "utf8mb4"
	handshakeCollation  = "utf8mb4_0900_ai_ci"
	connectionCollation = "utf8mb4_0900_as_ci"
	// lockWait bounds how long a request waits for a named MySQL lock.
	lockWait = 10 * time.Second
)

// Store runs the data service queries against one MySQL database.
type Store struct {
	db          *sql.DB
	recordQuota RecordQuota
	rules       EconomyRules
}

// New wraps an open database handle. The economy uses the embedded data
// and the default starting lucci until WithEconomy says otherwise.
func New(db *sql.DB) *Store {
	s := &Store{db: db, recordQuota: DefaultRecordQuota, rules: EconomyRules{StartingLucci: DefaultStartingLucci}}
	if data, err := economy.Default(); err == nil {
		s.rules.Data = data
	}
	return s
}

// WithEconomy returns a store that applies rules to accounts.
func (s *Store) WithEconomy(rules EconomyRules) *Store {
	configured := *s
	if rules.Data == nil {
		rules.Data = s.rules.Data
	}
	configured.rules = rules
	return &configured
}

// WithRecordQuota returns a store that enforces quota instead of
// DefaultRecordQuota.
func (s *Store) WithRecordQuota(quota RecordQuota) *Store {
	limited := *s
	limited.recordQuota = quota
	return &limited
}

// DB exposes the handle for maintenance tools.
func (s *Store) DB() *sql.DB { return s.db }

// NormalizeDSN parses a go-sql-driver DSN and forces the settings the schema
// relies on: utf8mb4 with the accent-sensitive, case-insensitive collation,
// integer timestamps (no parseTime) and bounded network timeouts.
//
// The driver only accepts collations from its built-in ID table in the
// handshake, and utf8mb4_0900_as_ci is not in it (a DSN with
// collation=utf8mb4_0900_as_ci fails with "unknown collation"). So the
// connection negotiates utf8mb4_0900_ai_ci and then sets collation_connection.
// Comparisons with table columns use the column collation either way.
func NormalizeDSN(dsn string) (*mysql.Config, error) {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse MySQL DSN: %w", err)
	}
	cfg.ParseTime = false
	if err := cfg.Apply(mysql.Charset(connectionCharset, handshakeCollation)); err != nil {
		return nil, err
	}
	if cfg.Params == nil {
		cfg.Params = map[string]string{}
	}
	cfg.Params["collation_connection"] = connectionCollation
	if cfg.Timeout == 0 {
		cfg.Timeout = 5 * time.Second
	}
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = 60 * time.Second
	}
	if cfg.WriteTimeout == 0 {
		cfg.WriteTimeout = 60 * time.Second
	}
	return cfg, nil
}

// Open returns a pooled handle for dsn. It does not contact the server.
func Open(dsn string) (*sql.DB, error) {
	cfg, err := NormalizeDSN(dsn)
	if err != nil {
		return nil, err
	}
	connector, err := mysql.NewConnector(cfg)
	if err != nil {
		return nil, fmt.Errorf("MySQL connector: %w", err)
	}
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(32)
	db.SetMaxIdleConns(16)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)
	return db, nil
}

// WaitReady pings db until it answers or timeout elapses.
func WaitReady(ctx context.Context, db *sql.DB, timeout time.Duration, logger *slog.Logger) error {
	deadline := time.Now().Add(timeout)
	for attempt := 1; ; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := db.PingContext(pingCtx)
		cancel()
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("MySQL not reachable after %s: %w", timeout, err)
		}
		logger.Warn("waiting for MySQL", "attempt", attempt, "error", err)
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Second):
		}
	}
}

// withNamedLock runs fn on a dedicated connection while holding the MySQL
// user lock name (GET_LOCK is per connection). If the lock cannot be released
// cleanly the connection is discarded, which also frees the lock.
func withNamedLock(ctx context.Context, db *sql.DB, name string, wait time.Duration, fn func(*sql.Conn) error) (err error) {
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	locked := false
	defer func() {
		if locked {
			// Release even if ctx was canceled, so the lock never outlives the call.
			releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			var released sql.NullInt64
			releaseErr := conn.QueryRowContext(releaseCtx, "SELECT RELEASE_LOCK(?)", name).Scan(&released)
			cancel()
			if releaseErr != nil || released.Int64 != 1 {
				_ = conn.Raw(func(any) error { return driver.ErrBadConn })
			}
		}
		_ = conn.Close()
	}()

	var got sql.NullInt64
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK(?, ?)", name, int(wait.Seconds())).Scan(&got); err != nil {
		return fmt.Errorf("GET_LOCK(%s): %w", name, err)
	}
	if !got.Valid || got.Int64 != 1 {
		return fmt.Errorf("GET_LOCK(%s): timed out after %s", name, wait)
	}
	locked = true
	return fn(conn)
}

// inTx runs fn in a transaction on conn (or a pooled connection when conn is nil).
func inTx(ctx context.Context, db *sql.DB, conn *sql.Conn, fn func(*sql.Tx) error) error {
	return inTxOptions(ctx, db, conn, nil, fn)
}

// readCommitted is the isolation of every transaction that changes an
// account's economy. Those transactions serialize per account on the
// wallet row lock, and under READ COMMITTED every later read sees what the
// previous holder committed; InnoDB also takes no gap locks, so locking
// reads of absent rows (no inventory item yet, no daily counter yet) of
// different accounts cannot deadlock each other.
var readCommitted = &sql.TxOptions{Isolation: sql.LevelReadCommitted}

// economyAttempts bounds the retries of a transaction that MySQL chose as
// a deadlock victim; it was rolled back completely, so retrying is safe.
const economyAttempts = 3

// inEconomyTx runs fn in a READ COMMITTED transaction (on conn when set)
// and retries it when it is rolled back as a deadlock victim. fn must not
// keep state across attempts.
func inEconomyTx(ctx context.Context, db *sql.DB, conn *sql.Conn, fn func(*sql.Tx) error) error {
	for attempt := 1; ; attempt++ {
		err := inTxOptions(ctx, db, conn, readCommitted, fn)
		if attempt < economyAttempts && mysqlErrorNumber(err) == errDeadlock && ctx.Err() == nil {
			continue
		}
		return err
	}
}

// MySQL error numbers the store reacts to.
const (
	errDuplicateEntry     = 1062
	errDeadlock           = 1213
	errNoReferencedRow    = 1452 // a foreign key names a missing row (the account is gone)
	errNoReferencedRowOld = 1216 // the same, from older server versions
)

// mysqlErrorNumber returns the MySQL error number of err, or 0.
func mysqlErrorNumber(err error) uint16 {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Number
	}
	return 0
}

// missingParent reports whether err is a foreign-key failure on insert.
func missingParent(err error) bool {
	number := mysqlErrorNumber(err)
	return number == errNoReferencedRow || number == errNoReferencedRowOld
}

func inTxOptions(ctx context.Context, db *sql.DB, conn *sql.Conn, options *sql.TxOptions, fn func(*sql.Tx) error) error {
	var (
		tx  *sql.Tx
		err error
	)
	if conn != nil {
		tx, err = conn.BeginTx(ctx, options)
	} else {
		tx, err = db.BeginTx(ctx, options)
	}
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// duplicateKey reports whether err is MySQL error 1062 and, if so, the
// violated key name (for example "accounts.uq_accounts_nickname").
func duplicateKey(err error) (string, bool) {
	var mysqlErr *mysql.MySQLError
	if !errors.As(err, &mysqlErr) || mysqlErr.Number != errDuplicateEntry {
		return "", false
	}
	message := mysqlErr.Message
	if index := strings.LastIndex(message, "for key '"); index >= 0 {
		return strings.TrimSuffix(message[index+len("for key '"):], "'"), true
	}
	return "", true
}
