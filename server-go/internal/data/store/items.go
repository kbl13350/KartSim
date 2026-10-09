package store

import (
	"context"
	"database/sql"
	"errors"
	"net/http"

	"kartsim/internal/shared/apierr"
)

// Items given or used outside the shop: box rewards (开箱), the 赛车探险队
// rewards and its 探险币. Counted items stack in inventory_items.quantity;
// using one lowers the pile, which stays (at 0) so the dictionary and the
// careers still know the account had it.

// Inventory sources besides the shop and the starter pack.
const (
	SourceExpedition = "expedition" // 赛车探险队 rewards and the weekly 探险币
	SourceLottery    = "lottery"    // drawn from a box
)

var errNotEnoughItems = apierr.New(http.StatusConflict, "ITEM_NOT_ENOUGH")

// countedCategories stack whatever the stock: boxes (24), materials such
// as the 探险币 (34), 56, 62 and parts fragments (67).
var countedCategories = map[int]bool{24: true, 34: true, 56: true, 62: true, 67: true}

// ItemGrant is one item given to an account: Count of it (counted items),
// for Days (0: permanent).
type ItemGrant struct {
	Category int `json:"category"`
	ItemID   int `json:"itemId"`
	Count    int `json:"count"`
	Days     int `json:"days"`
}

// Counted reports whether an item stacks: the counted categories and the
// shop's count items (isAdditional, the balloons).
func (s *Store) Counted(category, itemID int) bool {
	if countedCategories[category] {
		return true
	}
	if data := s.rules.Data; data != nil && data.Catalog != nil {
		if item, ok := data.Catalog.ItemByKey(category, itemID); ok && item.IsAdditional {
			return true
		}
	}
	return false
}

// grantItem gives one item inside an economy transaction (the caller holds
// the account's wallet lock): a counted item adds Count to its pile (an
// expired pile starts again from 0); a rental extends from max(now,
// expiry) and leaves a permanently owned item permanent; a permanent grant
// makes the item permanent. It returns the item's row afterwards.
func (s *Store) grantItem(ctx context.Context, tx *sql.Tx, accountID string, g ItemGrant, source string,
	now int64) (InventoryItem, error) {
	var (
		quantity int
		expires  sql.NullInt64
	)
	err := tx.QueryRowContext(ctx, `SELECT quantity, expires_at FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = '' FOR UPDATE`,
		accountID, g.Category, g.ItemID).Scan(&quantity, &expires)
	owned := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return InventoryItem{}, err
	}
	active := owned && (!expires.Valid || expires.Int64 > now)
	item := InventoryItem{Category: g.Category, ItemID: g.ItemID, Quantity: 1, Source: source}
	if s.Counted(g.Category, g.ItemID) {
		item.Quantity = max(g.Count, 1)
		if active {
			item.Quantity = min(item.Quantity+quantity, MaxQuantity)
		}
	} else if active {
		item.Quantity = max(quantity, 1)
	}
	if g.Days > 0 && !(active && !expires.Valid) {
		base := now
		if active {
			base = max(base, expires.Int64)
		}
		until := base + int64(g.Days)*dayMillis
		item.ExpiresAt = &until
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO inventory_items
		(account_id, category, item_id, system_key, quantity, expires_at, source, created_at, updated_at)
		VALUES(?, ?, ?, '', ?, ?, ?, ?, ?) AS incoming
		ON DUPLICATE KEY UPDATE quantity = incoming.quantity, expires_at = incoming.expires_at,
			source = incoming.source, updated_at = incoming.updated_at`,
		accountID, item.Category, item.ItemID, item.Quantity, item.ExpiresAt, item.Source, now, now)
	return item, err
}

// itemCount is how many of a counted item the account holds (0 when none
// or expired), locking its row.
func itemCount(ctx context.Context, tx *sql.Tx, accountID string, category, itemID int, now int64) (int, error) {
	var (
		quantity int
		expires  sql.NullInt64
	)
	err := tx.QueryRowContext(ctx, `SELECT quantity, expires_at FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = '' FOR UPDATE`,
		accountID, category, itemID).Scan(&quantity, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	} else if err != nil {
		return 0, err
	}
	if expires.Valid && expires.Int64 <= now {
		return 0, nil
	}
	return quantity, nil
}

// consumeItem uses count of a counted item; ITEM_NOT_ENOUGH when the
// account holds fewer. It returns how many are left.
func consumeItem(ctx context.Context, tx *sql.Tx, accountID string, category, itemID, count int,
	now int64) (int, error) {
	held, err := itemCount(ctx, tx, accountID, category, itemID, now)
	if err != nil {
		return 0, err
	}
	if count <= 0 || held < count {
		return held, errNotEnoughItems
	}
	_, err = tx.ExecContext(ctx, `UPDATE inventory_items SET quantity = quantity - ?, updated_at = ?
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = ''`,
		count, now, accountID, category, itemID)
	return held - count, err
}

// inventoryRow reads one item's row (the empty system key).
func inventoryRow(ctx context.Context, q queryer, accountID string, category, itemID int) (InventoryItem, error) {
	item := InventoryItem{Category: category, ItemID: itemID}
	var expires sql.NullInt64
	err := q.QueryRowContext(ctx, `SELECT quantity, expires_at, source FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = ''`,
		accountID, category, itemID).Scan(&item.Quantity, &expires, &item.Source)
	if expires.Valid {
		item.ExpiresAt = &expires.Int64
	}
	return item, err
}
