package store

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/lottery"
	"kartsim/internal/shared/apierr"
)

// 奖励箱 (MENUS.md 1): rewards from quests, the club racing center and
// admins wait here until the rider takes them ("临时保管通过活动、任务等获得的
// 奖励道具空间"). An entry is an item (category, itemId, count, days) or a
// currency amount; it is deleted RewardBoxDays after it arrived.

// RewardBoxDays is how long an entry waits ("保管时间").
const RewardBoxDays = 30

// RewardBoxPage is how many entries one claim may take (8 cards a page).
const RewardBoxPage = 8

// Reward box sources (rewardMajorType: 任务, 俱乐部基地, 游戏活动).
const (
	BoxSourceQuest = "quest"
	BoxSourceClub  = "club"
	BoxSourceAdmin = "admin"
)

// ReasonRewardBox is the ledger reason of a claimed currency; ref "box:<id>".
const ReasonRewardBox = "rewardbox"

// SourceRewardBox is the inventory source of claimed items.
const SourceRewardBox = "rewardbox"

var errBoxEmpty = apierr.New(http.StatusNotFound, "REWARD_BOX_EMPTY")

// RewardBoxEntry is one waiting reward.
type RewardBoxEntry struct {
	ID        int64  `json:"id"`
	Source    string `json:"source"`
	Message   string `json:"message"`
	Name      string `json:"name"`
	Category  int    `json:"category"`
	ItemID    int    `json:"itemId"`
	Count     int    `json:"count"`
	Days      int    `json:"days"` // rental days of the item; 0 permanent
	Currency  string `json:"currency,omitempty"`
	CreatedAt int64  `json:"createdAt"`
	ExpiresAt int64  `json:"expiresAt"`
}

// addRewardBox files entries for an account inside a transaction.
func addRewardBox(ctx context.Context, e execer, accountID string, entries []RewardBoxEntry, now int64) error {
	for _, entry := range entries {
		if entry.Count <= 0 {
			continue
		}
		if _, err := e.ExecContext(ctx, `INSERT INTO reward_box(account_id, source, message, name, category, item_id,
			count, days, currency, created_at, expires_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			accountID, entry.Source, truncate(entry.Message, 200), truncate(entry.Name, 100), entry.Category, entry.ItemID,
			entry.Count, entry.Days, entry.Currency, now, now+RewardBoxDays*dayMillis); err != nil {
			if missingParent(err) {
				return errAccountNotFound
			}
			return err
		}
	}
	return nil
}

func truncate(text string, runes int) string {
	value := []rune(text)
	if len(value) > runes {
		return string(value[:runes])
	}
	return text
}

const rewardBoxColumns = `id, source, message, name, category, item_id, count, days, currency, created_at, expires_at`

func scanRewardBox(rows *sql.Rows) ([]RewardBoxEntry, error) {
	defer rows.Close()
	entries := []RewardBoxEntry{}
	for rows.Next() {
		var entry RewardBoxEntry
		if err := rows.Scan(&entry.ID, &entry.Source, &entry.Message, &entry.Name, &entry.Category, &entry.ItemID,
			&entry.Count, &entry.Days, &entry.Currency, &entry.CreatedAt, &entry.ExpiresAt); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

// RewardBox lists an account's waiting rewards, newest first.
func (s *Store) RewardBox(ctx context.Context, accountID string, now int64) ([]RewardBoxEntry, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+rewardBoxColumns+` FROM reward_box
		WHERE account_id = ? AND claimed_at IS NULL AND expires_at > ? ORDER BY id DESC`, accountID, now)
	if err != nil {
		return nil, err
	}
	return scanRewardBox(rows)
}

// RewardBoxCount is how many rewards wait (for the taskbar and notices).
func (s *Store) RewardBoxCount(ctx context.Context, accountID string, now int64) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM reward_box WHERE account_id = ? AND claimed_at IS NULL
		AND expires_at > ?`, accountID, now).Scan(&count)
	return count, err
}

// AddRewardBox files rewards for an account (admin gifts).
func (s *Store) AddRewardBox(ctx context.Context, accountID string, entries []RewardBoxEntry, now int64) error {
	return inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		return addRewardBox(ctx, tx, accountID, entries, now)
	})
}

// RewardBoxClaim is what a claim granted.
type RewardBoxClaim struct {
	Claimed []RewardBoxEntry `json:"claimed"`
	Items   []DrawnItem      `json:"items"`
	Wallet  Wallet           `json:"wallet"`
}

// ClaimRewardBox takes waiting rewards by id (at most RewardBoxPage):
// currencies to the wallet, items to the inventory the way lottery
// rewards are granted (stacks add up, rentals extend, an item owned for
// good stays as it is). Ids already taken or expired are skipped; none
// left is NOTHING_TO_CLAIM.
func (s *Store) ClaimRewardBox(ctx context.Context, data *lottery.Data, accountID string, ids []int64,
	now int64) (RewardBoxClaim, error) {
	var claim RewardBoxClaim
	if len(ids) == 0 || len(ids) > RewardBoxPage {
		return claim, errBoxEmpty
	}
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		claim = RewardBoxClaim{Claimed: []RewardBoxEntry{}, Items: []DrawnItem{}}
		l, err := s.lockLedger(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
		args := []any{accountID, now}
		for _, id := range ids {
			args = append(args, id)
		}
		rows, err := tx.QueryContext(ctx, "SELECT "+rewardBoxColumns+` FROM reward_box WHERE account_id = ?
			AND claimed_at IS NULL AND expires_at > ? AND id IN (`+placeholders+") ORDER BY id FOR UPDATE", args...)
		if err != nil {
			return err
		}
		entries, err := scanRewardBox(rows)
		if err != nil {
			return err
		}
		if len(entries) == 0 {
			return errBoxEmpty
		}
		grant := newLotteryTx(l, data)
		for _, entry := range entries {
			ref := fmt.Sprintf("box:%d", entry.ID)
			if entry.Currency != "" {
				currency := economy.Currency(entry.Currency)
				if !currency.Valid() {
					return fmt.Errorf("reward box %d: currency %q", entry.ID, entry.Currency)
				}
				if _, err := l.add(currency, int64(entry.Count), ReasonRewardBox, ref, ""); err != nil {
					return err
				}
				claim.Items = append(claim.Items, DrawnItem{Name: entry.Name, Count: entry.Count, Currency: entry.Currency})
			} else {
				items, err := grant.grant(&lottery.Stock{Name: entry.Name, Items: []lottery.StockItem{{
					Category: entry.Category, ItemID: entry.ItemID, Count: entry.Count, Days: entry.Days}}},
					SourceRewardBox, ReasonRewardBox, ref)
				if err != nil {
					return err
				}
				for i := range items {
					if items[i].Name == "" {
						items[i].Name = entry.Name
					}
				}
				claim.Items = append(claim.Items, items...)
			}
			if _, err := tx.ExecContext(ctx, "UPDATE reward_box SET claimed_at = ? WHERE id = ?", now, entry.ID); err != nil {
				return err
			}
			claim.Claimed = append(claim.Claimed, entry)
		}
		claim.Wallet = l.wallet
		return nil
	})
	return claim, err
}

// PruneRewardBox deletes entries taken or expired before a time, at most
// limit of them.
func (s *Store) PruneRewardBox(ctx context.Context, before int64, limit int) (int64, error) {
	result, err := s.db.ExecContext(ctx, `DELETE FROM reward_box WHERE (claimed_at IS NOT NULL AND claimed_at < ?)
		OR expires_at < ? LIMIT ?`, before, before, limit)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
