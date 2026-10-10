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
// statement must be safe to re-run after a partial failure; columns and
// indexes added to existing tables (MySQL has no ADD COLUMN IF NOT EXISTS
// or CREATE INDEX IF NOT EXISTS) are created only when information_schema
// does not list them yet. Columns come before indexes.
type migration struct {
	version    int
	statements []string
	columns    []tableColumn
	indexes    []tableIndex
}

// tableColumn is a column added to an existing table.
type tableColumn struct {
	table, name, definition string
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
	// Version 4: friends and private chat (DESIGN.md 9). Each side of a
	// friendship has its own row (favorite belongs to the owner).
	// friend_requests keeps the accepted/refused result of a request for the
	// sender's outbox until expires_at. Every account column cascades, and
	// MySQL refuses CHECK constraints on cascading foreign key columns
	// (error 3823): "not yourself" and low_id < high_id are rules of the code.
	// private_messages.sender_id is always low_id or high_id, so it needs no
	// foreign key of its own.
	{version: 4, statements: []string{
		`CREATE TABLE IF NOT EXISTS messenger_settings (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			block_friend_requests TINYINT NOT NULL DEFAULT 0,
			block_game_invites TINYINT NOT NULL DEFAULT 0,
			invisible TINYINT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_messenger_settings_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS friendships (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			friend_id CHAR(36) ` + idColumn + ` NOT NULL,
			favorite TINYINT NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, friend_id),
			KEY idx_friendships_friend (friend_id),
			CONSTRAINT fk_friendships_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS friend_requests (
			from_id CHAR(36) ` + idColumn + ` NOT NULL,
			to_id CHAR(36) ` + idColumn + ` NOT NULL,
			state VARCHAR(8) ` + idColumn + ` NOT NULL,
			created_at BIGINT NOT NULL,
			resolved_at BIGINT NULL,
			expires_at BIGINT NOT NULL,
			sender_hidden TINYINT NOT NULL DEFAULT 0,
			PRIMARY KEY (from_id, to_id),
			KEY idx_friend_requests_to (to_id, state),
			KEY idx_friend_requests_expires (state, expires_at),
			CONSTRAINT chk_friend_requests_state CHECK (state IN ('pending', 'accepted', 'refused')),
			CONSTRAINT fk_friend_requests_from FOREIGN KEY (from_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_friend_requests_to FOREIGN KEY (to_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS account_blocks (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			blocked_id CHAR(36) ` + idColumn + ` NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, blocked_id),
			KEY idx_account_blocks_blocked (blocked_id),
			CONSTRAINT fk_account_blocks_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_account_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// body is wider than the 30 code points the API accepts, so the
		// limit can grow without a migration.
		`CREATE TABLE IF NOT EXISTS private_messages (
			id BIGINT NOT NULL AUTO_INCREMENT,
			low_id CHAR(36) ` + idColumn + ` NOT NULL,
			high_id CHAR(36) ` + idColumn + ` NOT NULL,
			sender_id CHAR(36) ` + idColumn + ` NOT NULL,
			client_id CHAR(36) ` + idColumn + ` NOT NULL,
			body VARCHAR(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_private_messages_client (sender_id, client_id),
			KEY idx_private_messages_pair (low_id, high_id, id),
			KEY idx_private_messages_high (high_id),
			KEY idx_private_messages_created (created_at),
			CONSTRAINT fk_private_messages_low FOREIGN KEY (low_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_private_messages_high FOREIGN KEY (high_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS private_conversations (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			peer_id CHAR(36) ` + idColumn + ` NOT NULL,
			last_message_id BIGINT NOT NULL DEFAULT 0,
			last_message_at BIGINT NOT NULL DEFAULT 0,
			last_read_id BIGINT NOT NULL DEFAULT 0,
			unread INT NOT NULL DEFAULT 0,
			cleared_up_to BIGINT NOT NULL DEFAULT 0,
			hidden TINYINT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, peer_id),
			KEY idx_private_conversations_recent (account_id, hidden, last_message_at),
			KEY idx_private_conversations_peer (peer_id),
			KEY idx_private_conversations_last (last_message_at),
			CONSTRAINT chk_private_conversations_unread CHECK (unread >= 0),
			CONSTRAINT fk_private_conversations_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_private_conversations_peer FOREIGN KEY (peer_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// My Room careers and emblems.
	{version: 5, statements: []string{
		// Race and time-attack tallies the careers count (career.RaceCounter).
		`CREATE TABLE IF NOT EXISTS account_counters (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			counter VARCHAR(48) ` + idColumn + ` NOT NULL,
			value BIGINT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, counter),
			CONSTRAINT fk_account_counters_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Beijing days ("YYYY-MM-DD") an account signed in on (date careers).
		`CREATE TABLE IF NOT EXISTS account_login_days (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			day CHAR(10) ` + idColumn + ` NOT NULL,
			PRIMARY KEY (account_id, day),
			CONSTRAINT fk_account_login_days_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS account_careers (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			career_id INT NOT NULL,
			completed_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, career_id),
			KEY idx_account_careers_recent (account_id, completed_at),
			CONSTRAINT fk_account_careers_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// main_slot is the representative slot (0, 1) or NULL; MySQL lets
		// several rows share NULL in the unique key.
		`CREATE TABLE IF NOT EXISTS account_emblems (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			emblem_id INT NOT NULL,
			source VARCHAR(16) ` + idColumn + ` NOT NULL,
			ref INT NOT NULL DEFAULT 0,
			created_at BIGINT NOT NULL,
			main_slot TINYINT NULL,
			PRIMARY KEY (account_id, emblem_id),
			UNIQUE KEY uq_account_emblems_slot (account_id, main_slot),
			CONSTRAINT fk_account_emblems_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// 道具图鉴 rewards: how many collected dictionary items were rewarded.
	{version: 6, statements: []string{
		`CREATE TABLE IF NOT EXISTS account_dictionary (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			rewarded INT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT chk_account_dictionary_rewarded CHECK (rewarded >= 0),
			CONSTRAINT fk_account_dictionary_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// Box openings and the 赛车探险队.
	{version: 7, statements: []string{
		// One row per opened box: the request id makes a retry return the
		// same draw.
		`CREATE TABLE IF NOT EXISTS box_openings (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			request_id CHAR(36) ` + idColumn + ` NOT NULL,
			box_id INT NOT NULL,
			stock_id INT NOT NULL,
			result_json TEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, request_id),
			KEY idx_box_openings_created (created_at),
			CONSTRAINT fk_box_openings_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// The account's expedition week (expedition.State as JSON).
		`CREATE TABLE IF NOT EXISTS account_expedition (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			state_json TEXT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_account_expedition_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// Lotteries (LOTTERY.md): 寻宝 and 精品道具场 draws, their 保底 counters,
	// the daily free materials and the admin's activity settings.
	{version: 8, statements: []string{
		// One row per draw request: the idempotency key and the stored answer.
		`CREATE TABLE IF NOT EXISTS lottery_draws (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			request_id CHAR(36) ` + idColumn + ` NOT NULL,
			kind VARCHAR(16) ` + idColumn + ` NOT NULL,
			ref INT NOT NULL,
			count INT NOT NULL,
			result_json MEDIUMTEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, request_id),
			KEY idx_lottery_draws_recent (account_id, created_at),
			CONSTRAINT fk_lottery_draws_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// 保底 state: treasure-hunt counted draws per 保底 reward
		// ("hunt:<id>:<stockId>") and lottery mileage points ("mileage:<itemId>").
		`CREATE TABLE IF NOT EXISTS lottery_counters (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			counter VARCHAR(48) ` + idColumn + ` NOT NULL,
			value BIGINT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, counter),
			CONSTRAINT fk_lottery_counters_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Daily free materials claimed, per activity and Beijing day.
		`CREATE TABLE IF NOT EXISTS lottery_daily (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			activity VARCHAR(40) ` + idColumn + ` NOT NULL,
			day CHAR(10) ` + idColumn + ` NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, activity, day),
			CONSTRAINT fk_lottery_daily_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Admin settings of an activity ("treasureHunt", "gacha", "lottery:<itemId>");
		// without a row the activity is open with the built-in daily items.
		`CREATE TABLE IF NOT EXISTS lottery_activities (
			activity VARCHAR(40) ` + idColumn + ` NOT NULL,
			enabled TINYINT NOT NULL,
			start_at BIGINT NULL,
			end_at BIGINT NULL,
			daily_json TEXT NULL,
			updated_by VARCHAR(64) NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (activity)
		) ` + tableTail,
	}},
	// Version 9: 驾照考试 (RIDER_SCHOOL.md).
	{version: 9, statements: []string{
		// The licenses taken: level is the highest of 新手 (1) to L1 (5); a
		// PRO license lasts until pro_until and was taken in pro_period.
		`CREATE TABLE IF NOT EXISTS license_state (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			level TINYINT NOT NULL DEFAULT 0,
			pro_until BIGINT NOT NULL DEFAULT 0,
			pro_period CHAR(7) ` + idColumn + ` NOT NULL DEFAULT '',
			pro_count INT NOT NULL DEFAULT 0,
			last_run_at BIGINT NOT NULL DEFAULT 0,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_license_state_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Cleared steps; PRO steps are kept per mission period ("2026-09").
		`CREATE TABLE IF NOT EXISTS license_clears (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			step INT NOT NULL,
			period CHAR(7) ` + idColumn + ` NOT NULL DEFAULT '',
			best_ms INT NOT NULL,
			cleared_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, step, period),
			CONSTRAINT fk_license_clears_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Best times on the PRO qualification tracks.
		`CREATE TABLE IF NOT EXISTS license_records (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			track_id VARCHAR(40) ` + idColumn + ` NOT NULL,
			best_ms INT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, track_id),
			CONSTRAINT fk_license_records_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// One row per run request: the idempotency key and the stored answer.
		`CREATE TABLE IF NOT EXISTS license_runs (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			request_id CHAR(36) ` + idColumn + ` NOT NULL,
			kind VARCHAR(8) ` + idColumn + ` NOT NULL,
			ref INT NOT NULL,
			result_json TEXT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, request_id),
			KEY idx_license_runs_created (created_at),
			CONSTRAINT fk_license_runs_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// Version 10: 俱乐部 (CLUB.md).
	{version: 10, statements: []string{
		// facility levels hq/racing/rider/bank 1-5; cs is the activity points
		// upgrades spend, cs_week those of the week starting on week; a club
		// with break_at is disbanded once that time passes.
		`CREATE TABLE IF NOT EXISTS clubs (
			id BIGINT NOT NULL AUTO_INCREMENT,
			name VARCHAR(40) NOT NULL,
			intro VARCHAR(1000) NOT NULL,
			mark INT NOT NULL,
			frame INT NOT NULL,
			master_id CHAR(36) ` + idColumn + ` NOT NULL,
			hq TINYINT NOT NULL DEFAULT 1,
			racing TINYINT NOT NULL DEFAULT 1,
			rider TINYINT NOT NULL DEFAULT 1,
			bank TINYINT NOT NULL DEFAULT 1,
			budget BIGINT NOT NULL DEFAULT 0,
			cs BIGINT NOT NULL DEFAULT 0,
			cs_week BIGINT NOT NULL DEFAULT 0,
			week CHAR(10) ` + idColumn + ` NOT NULL DEFAULT '',
			auto_join TINYINT NOT NULL DEFAULT 0,
			break_at BIGINT NULL,
			created_at BIGINT NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uq_clubs_name (name),
			KEY idx_clubs_cs (cs),
			KEY idx_clubs_break (break_at),
			CONSTRAINT chk_clubs_budget CHECK (budget >= 0),
			CONSTRAINT chk_clubs_cs CHECK (cs >= 0)
		) ` + tableTail,
		// One club per account; grade 1 会长, 2 管理层, 3 优秀会员, 4 会员.
		`CREATE TABLE IF NOT EXISTS club_members (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			club_id BIGINT NOT NULL,
			grade TINYINT NOT NULL,
			joined_at BIGINT NOT NULL,
			cs_week BIGINT NOT NULL DEFAULT 0,
			week CHAR(10) ` + idColumn + ` NOT NULL DEFAULT '',
			cs_total BIGINT NOT NULL DEFAULT 0,
			donated_total BIGINT NOT NULL DEFAULT 0,
			donated_day CHAR(10) ` + idColumn + ` NOT NULL DEFAULT '',
			PRIMARY KEY (account_id),
			KEY idx_club_members_club (club_id, grade),
			CONSTRAINT fk_club_members_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_club_members_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE
		) ` + tableTail,
		// One pending application per account.
		`CREATE TABLE IF NOT EXISTS club_applications (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			club_id BIGINT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			KEY idx_club_applications_club (club_id, created_at),
			CONSTRAINT fk_club_applications_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE,
			CONSTRAINT fk_club_applications_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE
		) ` + tableTail,
		// When an account last left a club (the 24-hour rejoin cooldown).
		`CREATE TABLE IF NOT EXISTS club_leaves (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			left_at BIGINT NOT NULL,
			PRIMARY KEY (account_id),
			CONSTRAINT fk_club_leaves_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		`CREATE TABLE IF NOT EXISTS club_donations (
			id BIGINT NOT NULL AUTO_INCREMENT,
			club_id BIGINT NOT NULL,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			amount BIGINT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (id),
			KEY idx_club_donations_club (club_id, id),
			CONSTRAINT fk_club_donations_club FOREIGN KEY (club_id) REFERENCES clubs (id) ON DELETE CASCADE,
			CONSTRAINT fk_club_donations_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// 赛事中心 welfare taken, per Beijing day and slot.
		`CREATE TABLE IF NOT EXISTS club_welfare (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			day CHAR(10) ` + idColumn + ` NOT NULL,
			slot TINYINT NOT NULL,
			created_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, day, slot),
			CONSTRAINT fk_club_welfare_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}},
	// Version 11: 奖励箱, quests and notices (MENUS.md 1 to 3).
	{version: 11, statements: []string{
		// Waiting rewards: an item (category/item_id/count/days) or a
		// currency amount (currency + count); claimed_at once taken.
		`CREATE TABLE IF NOT EXISTS reward_box (
			id BIGINT NOT NULL AUTO_INCREMENT,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			source VARCHAR(16) ` + idColumn + ` NOT NULL,
			message VARCHAR(200) NOT NULL,
			name VARCHAR(100) NOT NULL,
			category INT NOT NULL DEFAULT 0,
			item_id INT NOT NULL DEFAULT 0,
			count INT NOT NULL,
			days INT NOT NULL DEFAULT 0,
			currency VARCHAR(8) ` + idColumn + ` NOT NULL DEFAULT '',
			created_at BIGINT NOT NULL,
			expires_at BIGINT NOT NULL,
			claimed_at BIGINT NULL,
			PRIMARY KEY (id),
			KEY idx_reward_box_account (account_id, claimed_at, expires_at),
			KEY idx_reward_box_expires (expires_at),
			CONSTRAINT fk_reward_box_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Quest progress per period ("" for quests that never reset);
		// completed_at once the target was reached and the reward filed.
		`CREATE TABLE IF NOT EXISTS quest_progress (
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			quest_id INT NOT NULL,
			period CHAR(10) ` + idColumn + ` NOT NULL DEFAULT '',
			value BIGINT NOT NULL DEFAULT 0,
			completed_at BIGINT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (account_id, quest_id, period),
			CONSTRAINT fk_quest_progress_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
		// Admin notices for the 迷你提示窗, shown between start_at and end_at.
		`CREATE TABLE IF NOT EXISTS notices (
			id BIGINT NOT NULL AUTO_INCREMENT,
			title VARCHAR(40) NOT NULL,
			message VARCHAR(400) NOT NULL,
			start_at BIGINT NULL,
			end_at BIGINT NULL,
			updated_by VARCHAR(64) NOT NULL,
			updated_at BIGINT NOT NULL,
			PRIMARY KEY (id)
		) ` + tableTail,
	}},
	// Version 12: the admin console (ADMIN.md 2). Registers and logins with
	// the client address and browser (kept 180 days), each account's
	// register and latest login address and its ban, and indexes for the
	// admin lists, which page by time or filter by account.
	{version: 12, statements: []string{
		`CREATE TABLE IF NOT EXISTS login_records (
			id BIGINT NOT NULL AUTO_INCREMENT,
			account_id CHAR(36) ` + idColumn + ` NOT NULL,
			kind VARCHAR(8) ` + idColumn + ` NOT NULL,
			ip VARCHAR(45) NOT NULL DEFAULT '',
			user_agent VARCHAR(255) NOT NULL DEFAULT '',
			at BIGINT NOT NULL,
			PRIMARY KEY (id),
			KEY idx_login_records_account (account_id, at),
			KEY idx_login_records_at (at),
			KEY idx_login_records_ip (ip),
			CONSTRAINT fk_login_records_account FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE CASCADE
		) ` + tableTail,
	}, columns: []tableColumn{
		{table: "accounts", name: "register_ip", definition: "VARCHAR(45) NOT NULL DEFAULT ''"},
		{table: "accounts", name: "last_login_at", definition: "BIGINT NOT NULL DEFAULT 0"},
		{table: "accounts", name: "last_login_ip", definition: "VARCHAR(45) NOT NULL DEFAULT ''"},
		{table: "accounts", name: "banned_until", definition: "BIGINT NOT NULL DEFAULT 0"},
		{table: "accounts", name: "ban_reason", definition: "VARCHAR(200) NOT NULL DEFAULT ''"},
	}, indexes: []tableIndex{
		{table: "accounts", name: "idx_accounts_created", columns: "created_at"},
		{table: "accounts", name: "idx_accounts_last_login", columns: "last_login_at"},
		{table: "wallet_ledger", name: "idx_wallet_ledger_created", columns: "created_at"},
		{table: "exp_ledger", name: "idx_exp_ledger_created", columns: "created_at"},
		{table: "admin_grants", name: "idx_admin_grants_created", columns: "created_at"},
		{table: "purchases", name: "idx_purchases_created", columns: "created_at"},
		{table: "lottery_draws", name: "idx_lottery_draws_created", columns: "created_at"},
		{table: "race_results", name: "idx_race_results_account", columns: "account_id, created_at"},
	}},
	// Version 13: the admin console's second round (ADMIN.md 5): when and
	// from where each account was last active with a session token (written
	// at most every 5 minutes), sortable, and the reward-box list's time
	// index.
	{version: 13, columns: []tableColumn{
		{table: "accounts", name: "last_seen_at", definition: "BIGINT NOT NULL DEFAULT 0"},
		{table: "accounts", name: "last_seen_ip", definition: "VARCHAR(45) NOT NULL DEFAULT ''"},
	}, indexes: []tableIndex{
		{table: "accounts", name: "idx_accounts_last_seen", columns: "last_seen_at"},
		// The admin reward-box list sorts and filters by when an entry came.
		{table: "reward_box", name: "idx_reward_box_created", columns: "created_at"},
	}},
	// Version 14: the game nodes' anti-cheat records (ANTICHEAT.md 4), one
	// row per racer kicked (or, in log mode, noted), kept 180 days. Guests
	// have no account, so the account is not a foreign key.
	{version: 14, statements: []string{
		`CREATE TABLE IF NOT EXISTS anti_cheat_events (
			id BIGINT NOT NULL AUTO_INCREMENT,
			event_id CHAR(36) ` + idColumn + ` NOT NULL,
			node_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			account_id VARCHAR(36) ` + idColumn + ` NOT NULL DEFAULT '',
			player_id VARCHAR(64) ` + idColumn + ` NOT NULL,
			name VARCHAR(64) NOT NULL,
			room_id VARCHAR(64) ` + idColumn + ` NOT NULL DEFAULT '',
			race_id VARCHAR(64) ` + idColumn + ` NOT NULL DEFAULT '',
			track_id VARCHAR(64) ` + idColumn + ` NOT NULL DEFAULT '',
			gameplay VARCHAR(16) ` + idColumn + ` NOT NULL DEFAULT '',
			code VARCHAR(32) ` + idColumn + ` NOT NULL,
			detail VARCHAR(255) NOT NULL DEFAULT '',
			action VARCHAR(8) ` + idColumn + ` NOT NULL,
			at BIGINT NOT NULL,
			PRIMARY KEY (id),
			UNIQUE KEY uk_anti_cheat_events_event (event_id),
			KEY idx_anti_cheat_events_at (at),
			KEY idx_anti_cheat_events_account (account_id, at)
		) ` + tableTail,
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
			for _, column := range step.columns {
				if err := ensureColumn(ctx, conn, column); err != nil {
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

// ensureColumn adds column unless the table already has a column of that name.
func ensureColumn(ctx context.Context, conn *sql.Conn, column tableColumn) error {
	var present int
	if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.columns
		WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, column.table, column.name).Scan(&present); err != nil {
		return err
	}
	if present > 0 {
		return nil
	}
	// The names and definitions are constants of this file, never input.
	_, err := conn.ExecContext(ctx, "ALTER TABLE "+column.table+" ADD COLUMN "+column.name+" "+column.definition)
	return err
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
