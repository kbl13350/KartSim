package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"

	"kartsim/internal/data/lottery"
	"kartsim/internal/shared/apierr"
)

// Opening boxes (开箱): a category-24 item is used up and one reward stock
// of its lottery is drawn by weight and given. box_openings keeps each
// opening by request id, so a retried request gets the same result.

var (
	errNotABox        = apierr.New(http.StatusNotFound, "NOT_A_BOX")
	errBoxNotInPeriod = apierr.New(http.StatusConflict, "LOTTERY_NOT_IN_PERIOD")
	errBoxRpLimit     = apierr.New(http.StatusForbidden, "LOTTERY_UNDER_RP_LIMIT")
	errNeedOtherItem  = apierr.New(http.StatusConflict, "NEED_OTHER_ITEM")
)

// BoxReward is one item a box gave.
type BoxReward struct {
	Category int    `json:"category"`
	ItemID   int    `json:"itemId"`
	Count    int    `json:"count"`
	Days     int    `json:"days"` // 0: permanent
	Name     string `json:"name"`
}

// BoxOpening is what opening a box did.
type BoxOpening struct {
	Box     int             `json:"box"`
	StockID int             `json:"stockId"`
	Rewards []BoxReward     `json:"rewards"`
	Left    int             `json:"left"`  // boxes of this kind left
	Items   []InventoryItem `json:"items"` // the inventory rows changed
}

// OpenBox opens one box (category 24, item boxID); roll draws uniform
// integers in [0, n). The same request id returns the first result
// (REQUEST_ID_CONFLICT for another box).
func (s *Store) OpenBox(ctx context.Context, data *lottery.Data, accountID string, boxID int, requestID string,
	now int64, roll func(n int) int) (BoxOpening, error) {
	box, ok := data.Lottery(boxID)
	if !ok {
		return BoxOpening{}, errNotABox
	}
	var result BoxOpening
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = BoxOpening{}
		l, err := s.lockLedger(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		var stored string
		var storedBox int
		err = tx.QueryRowContext(ctx, "SELECT box_id, result_json FROM box_openings WHERE account_id = ? AND request_id = ?",
			accountID, requestID).Scan(&storedBox, &stored)
		if err == nil {
			if storedBox != boxID {
				return errRequestIDReuse
			}
			return json.Unmarshal([]byte(stored), &result)
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		rewards := data.Rewards(box, now)
		if len(rewards) == 0 {
			return errBoxNotInPeriod
		}
		if box.RpLimit > 0 && l.exp < int64(box.RpLimit) {
			return errBoxRpLimit
		}
		if box.NeedOther > 0 {
			if _, err := consumeItem(ctx, tx, accountID, lottery.Category, box.NeedOther, 1, now); err != nil {
				if errors.Is(err, errNotEnoughItems) {
					return errNeedOtherItem
				}
				return err
			}
		}
		if result.Left, err = consumeItem(ctx, tx, accountID, lottery.Category, boxID, 1, now); err != nil {
			return err
		}
		reward, ok := lottery.Draw(rewards, roll)
		// retryCount: draw again while the prize is one item already owned for good.
		for retry := 0; ok && retry < box.Retry; retry++ {
			if owned, err := s.ownsForGood(ctx, tx, accountID, data.Stock(reward.StockID), now); err != nil {
				return err
			} else if !owned {
				break
			}
			reward, ok = lottery.Draw(rewards, roll)
		}
		if !ok {
			return errBoxNotInPeriod
		}
		result.Box, result.StockID = boxID, reward.StockID
		for _, item := range data.Stock(reward.StockID) {
			row, err := s.grantItem(ctx, tx, accountID, ItemGrant{Category: item.Category, ItemID: item.ItemID,
				Count: item.Count, Days: item.Days}, SourceLottery, now)
			if err != nil {
				return err
			}
			result.Rewards = append(result.Rewards, BoxReward{Category: item.Category, ItemID: item.ItemID,
				Count: item.Count, Days: item.Days, Name: data.Name(item.Category, item.ItemID)})
			result.Items = append(result.Items, row)
		}
		left, err := inventoryRow(ctx, tx, accountID, lottery.Category, boxID)
		if err != nil {
			return err
		}
		result.Items = append(result.Items, left)
		encoded, err := json.Marshal(result)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO box_openings(account_id, request_id, box_id, stock_id, result_json,
			created_at) VALUES(?, ?, ?, ?, ?, ?)`, accountID, requestID, boxID, reward.StockID, string(encoded), now)
		return err
	})
	return result, err
}

// ownsForGood reports whether a stock is one non-counted item the account
// already owns permanently.
func (s *Store) ownsForGood(ctx context.Context, tx *sql.Tx, accountID string, items []lottery.Item,
	now int64) (bool, error) {
	if len(items) != 1 || s.Counted(items[0].Category, items[0].ItemID) {
		return false, nil
	}
	var expires sql.NullInt64
	err := tx.QueryRowContext(ctx, `SELECT expires_at FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = ''`,
		accountID, items[0].Category, items[0].ItemID).Scan(&expires)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil && !expires.Valid, err
}
