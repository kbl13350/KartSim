package store

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"
)

// Names (username, nickname, race result name) compare case-insensitively
// but accent-sensitively, matching the Java service's NOCASE checks; IDs and
// digests are case-sensitive ASCII.
const (
	nameColumn = "CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci"
	idColumn   = "CHARACTER SET ascii COLLATE ascii_bin"
	tableTail  = "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci"
)

// migration is one schema version. DDL auto-commits in MySQL, so every
// statement must be safe to re-run after a partial failure; indexes on
// existing tables (CREATE INDEX has no IF NOT EXISTS) are created only when
// information_schema does not list them yet.
type migration struct {
	version    int
	statements []string
	indexes    []tableIndex
}

// tableIndex is a secondary index added to an existing table.
type tableIndex struct {
	table, name, columns string
}

var migrations = []migration{
	{version: 1, statements: []string{
		`CREATE TABLE IF NOT EXISTS accounts (
			id CHAR(36) ` + idColumn + ` NOT NULL,
			username VARCHAR(24) ` + nameColumn + ` NOT NULL,
			nickname VARCHAR(64) ` + nameColumn + ` NOT NULL,
			password_hash VARCHAR(255) ` + idColumn + ` NOT NULL,
			admin TINYINT NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_accounts_username (username),
			UNIQUE KEY uq_accounts_nickname (nickname)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS sessions (
			token_hash VARCHAR(64) ` + idColumn + ` NOT NULL,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			expires_at BIGINT NOT NULL,
			PRIMARY KEY (token_hash),
			KEY idx_sessions_account (account_id),
			KEY idx_sessions_expires (expires_at),
			CONSTRAINT fk_sessions_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS invites (
			code_hash VARCHAR(64) ` + idColumn + ` NOT NULL,
			created_at BIGINT NOT NULL,
			used_by CHAR(36) ` + idColumn + ` NULL,
			PRIMARY KEY (code_hash),
			CONSTRAINT fk_invites_used_by FOREIGN KEY (used_by) REFERENCES accounts (id)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS owner_keys (
			owner_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			secret_hash VARCHAR(64) ` + idColumn + ` NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (owner_id)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS profiles (
			owner_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			json LONGTEXT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (owner_id)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS records (
			owner_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			record_id VARCHAR(100) ` + idColumn + ` NOT NULL,
			json LONGTEXT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (owner_id, record_id),
			KEY idx_records_owner_updated (owner_id, updated_at)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS race_results (
			id BIGINT NOT NULL AUTO_INCREMENT,
			room_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			race_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			player_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			account_id CHAR(36) ` + idColumn + ` NULL,
			name VARCHAR(64) ` + nameColumn + ` NOT NULL,
			` + "`rank`" + ` INT NOT NULL,
			elapsed_ms INT NULL,
			points INT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_race_results_player (race_id, player_id),
			KEY idx_race_results_created (created_at),
			KEY idx_race_results_name (name, created_at)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS race_outcomes (
			race_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			room_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			gameplay VARCHAR(20) ` + idColumn + ` NOT NULL,
			track_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
			json LONGTEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (race_id),
			KEY idx_race_outcomes_created (created_at),
			KEY idx_race_outcomes_gameplay (gameplay, created_at)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS room_rules (
			room_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			json TEXT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (room_id),
			KEY idx_room_rules_updated (updated_at)
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS player_stats (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			races INT NOT NULL DEFAULT 0,
			wins INT NOT NULL DEFAULT 0,
			podiums INT NOT NULL DEFAULT 0,
			points INT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_player_stats_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// Version 2: the account economy (ECONOMY.md 5). Every table belongs to
	// one account and goes with it. Balances, exp and quantities can never be
	// negative: the code checks before writing and the CHECK constraints
	// back it up. Ledger unique keys make every credit idempotent.
	{version: 2, statements: []string{
		`CREATE TABLE IF NOT EXISTS account_progress (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			exp BIGINT NOT NULL DEFAULT 0,
			level INT NOT NULL DEFAULT 1,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT chk_account_progress_exp CHECK (exp >= 0),
			CONSTRAINT fk_account_progress_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS wallets (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			coupon BIGINT NOT NULL DEFAULT 0,
			lucci BIGINT NOT NULL DEFAULT 0,
			koin BIGINT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT chk_wallets_balance CHECK (coupon >= 0 AND lucci >= 0 AND koin >= 0),
			CONSTRAINT fk_wallets_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS wallet_ledger (
			id BIGINT NOT NULL AUTO_INCREMENT,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			currency VARCHAR(8) ` + idColumn + ` NOT NULL,
			delta BIGINT NOT NULL,
			balance_after BIGINT NOT NULL,
			reason VARCHAR(24) ` + idColumn + ` NOT NULL,
			ref_id VARCHAR(80) ` + idColumn + ` NOT NULL,
			note VARCHAR(200) NOT NULL DEFAULT '',
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_wallet_ledger_ref (account_id, reason, ref_id, currency),
			KEY idx_wallet_ledger_account (account_id, created_at),
			CONSTRAINT fk_wallet_ledger_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS exp_ledger (
			id BIGINT NOT NULL AUTO_INCREMENT,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			delta BIGINT NOT NULL,
			exp_after BIGINT NOT NULL,
			reason VARCHAR(24) ` + idColumn + ` NOT NULL,
			ref_id VARCHAR(80) ` + idColumn + ` NOT NULL,
			note VARCHAR(200) NOT NULL DEFAULT '',
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_exp_ledger_ref (account_id, reason, ref_id),
			KEY idx_exp_ledger_account (account_id, created_at),
			CONSTRAINT fk_exp_ledger_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS inventory_items (
			id BIGINT NOT NULL AUTO_INCREMENT,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			category INT NOT NULL,
			item_id INT NOT NULL,
			system_key VARCHAR(64) ` + idColumn + ` NOT NULL DEFAULT '',
			quantity INT NOT NULL DEFAULT 1,
			expires_at BIGINT NULL,
			source VARCHAR(24) ` + idColumn + ` NOT NULL,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_inventory_items_item (account_id, category, item_id, system_key),
			CONSTRAINT chk_inventory_items_quantity CHECK (quantity >= 0),
			CONSTRAINT fk_inventory_items_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS purchases (
			id BIGINT NOT NULL AUTO_INCREMENT,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			request_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			offer_id VARCHAR(40) ` + idColumn + ` NOT NULL,
			category INT NOT NULL,
			item_id INT NOT NULL,
			currency VARCHAR(8) ` + idColumn + ` NOT NULL,
			price BIGINT NOT NULL,
			days INT NOT NULL,
			count INT NOT NULL,
			catalog_version CHAR(64) ` + idColumn + ` NOT NULL,
			result_json TEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_purchases_request (account_id, request_id),
			KEY idx_purchases_account (account_id, created_at),
			CONSTRAINT fk_purchases_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS account_onboarding (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			character_id INT NOT NULL,
			paint_id INT NOT NULL,
			dye_id INT NOT NULL,
			claimed_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_account_onboarding_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS account_profiles (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			json LONGTEXT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_account_profiles_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS timeattack_bests (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			track_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
			best_ms INT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, track_id),
			CONSTRAINT fk_timeattack_bests_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// timeattack_runs makes POST /api/timeattack/settle idempotent by
		// requestId and lets a retried request get its original answer.
		`CREATE TABLE IF NOT EXISTS timeattack_runs (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			request_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			track_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
			elapsed_ms INT NOT NULL,
			result_json TEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, request_id),
			CONSTRAINT fk_timeattack_runs_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS daily_rewards (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			day CHAR(10) ` + idColumn + ` NOT NULL,
			kind VARCHAR(16) ` + idColumn + ` NOT NULL,
			count INT NOT NULL DEFAULT 0,
			exp BIGINT NOT NULL DEFAULT 0,
			lucci BIGINT NOT NULL DEFAULT 0,
			PRIMARY KEY (account_id, day, kind),
			CONSTRAINT fk_daily_rewards_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// Version 3: economy hardening. admin_grants makes an admin's request id
	// stand for one grant (a reuse with other parameters is refused).
	// timeattack_state is the per-account time-attack limiter and remembers
	// the latest settled run (also unrewarded ones, which timeattack_runs no
	// longer stores) so a retry gets its original answer. The indexes serve
	// the hourly pruning of old runs and daily counters.
	{version: 3, statements: []string{
		`CREATE TABLE IF NOT EXISTS admin_grants (
			admin VARCHAR(24) ` + nameColumn + ` NOT NULL,
			request_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			currency VARCHAR(8) ` + idColumn + ` NOT NULL,
			amount BIGINT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (admin, request_id),
			KEY idx_admin_grants_account (account_id),
			CONSTRAINT fk_admin_grants_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS timeattack_state (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			last_settle_at BIGINT NOT NULL,
			last_request_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			last_track_id VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
			last_elapsed_ms INT NOT NULL,
			last_result_json TEXT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_timeattack_state_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}, indexes: []tableIndex{
		{table: "timeattack_runs", name: "idx_timeattack_runs_created", columns: "created_at"},
		{table: "daily_rewards", name: "idx_daily_rewards_day", columns: "day"},
	}},
}

// LatestSchemaVersion is the version Migrate brings a database to.
func LatestSchemaVersion() int { return migrations[len(migrations)-1].version }

// Migrate creates or upgrades the schema. Concurrent starters serialize on
// GET_LOCK('kartsim_schema'), so only one applies each version.
func Migrate(ctx context.Context, db *sql.DB, logger *slog.Logger) error {
	return withNamedLock(ctx, db, "kartsim_schema", 60*time.Second, func(conn *sql.Conn) error {
		if _, err := conn.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
			version INT NOT NULL,
			applied_at BIGINT NOT NULL,
			PRIMARY KEY (version)
		) `+tableTail); err != nil {
			return fmt.Errorf("create schema_migrations: %w", err)
		}
		applied := map[int]bool{}
		rows, err := conn.QueryContext(ctx, "SELECT version FROM schema_migrations")
		if err != nil {
			return err
		}
		for rows.Next() {
			var version int
			if err := rows.Scan(&version); err != nil {
				rows.Close()
				return err
			}
			applied[version] = true
		}
		if err := rows.Close(); err != nil {
			return err
		}
		for _, step := range migrations {
			if applied[step.version] {
				continue
			}
			for _, statement := range step.statements {
				if _, err := conn.ExecContext(ctx, statement); err != nil {
					return fmt.Errorf("schema version %d: %w", step.version, err)
				}
			}
			for _, index := range step.indexes {
				if err := ensureIndex(ctx, conn, index); err != nil {
					return fmt.Errorf("schema version %d: %w", step.version, err)
				}
			}
			if _, err := conn.ExecContext(ctx,
				"INSERT INTO schema_migrations(version, applied_at) VALUES(?, ?)",
				step.version, time.Now().UnixMilli()); err != nil {
				return fmt.Errorf("record schema version %d: %w", step.version, err)
			}
			logger.Info("applied schema migration", "version", step.version)
		}
		return nil
	})
}

// ensureIndex creates index unless the table already has an index of that name.
func ensureIndex(ctx context.Context, conn *sql.Conn, index tableIndex) error {
	var present int
	if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.statistics
		WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, index.table, index.name).Scan(&present); err != nil {
		return err
	}
	if present > 0 {
		return nil
	}
	// The names are constants of this file, never input.
	_, err := conn.ExecContext(ctx, "CREATE INDEX "+index.name+" ON "+index.table+" ("+index.columns+")")
	return err
}

// SchemaVersion returns the highest applied version, or 0 when the schema
// has never been created. It never writes.
func SchemaVersion(ctx context.Context, db *sql.DB) (int, error) {
	var exists int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.tables
		WHERE table_schema = DATABASE() AND table_name = 'schema_migrations'`).Scan(&exists); err != nil {
		return 0, err
	}
	if exists == 0 {
		return 0, nil
	}
	var version sql.NullInt64
	if err := db.QueryRowContext(ctx, "SELECT MAX(version) FROM schema_migrations").Scan(&version); err != nil {
		return 0, err
	}
	return int(version.Int64), nil
}
