package store

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"kartsim/internal/data/career"
	"kartsim/internal/data/economy"
	"kartsim/internal/shared/apierr"
)

// The 道具图鉴 (item dictionary). An item is collected once the account has
// ever had it (inventory_items keeps expired rows); account_dictionary
// remembers how many collected items were already rewarded, so each item
// pays its reward (the original rewardItem, 1 K币) once.

// ReasonDictionary is the ledger reason of a dictionary reward; ref is the
// account's rewarded count after the claim, which only grows.
const ReasonDictionary = "dictionary"

// The dictionary's rewardItem 56:1 is the K币 (koin) currency.
const koinRewardCategory, koinRewardItem = 56, 1

var errNothingToClaim = apierr.New(http.StatusConflict, "NOTHING_TO_CLAIM")

// DictionaryState is an account's collection.
type DictionaryState struct {
	// Collected lists the collected items by category, in display order.
	Collected map[int][]int
	Total     int // listed items collected
	Rewarded  int // collected items already rewarded
	Claimable int // collected items not rewarded yet
}

// DictionaryState reads an account's collection.
func (s *Store) DictionaryState(ctx context.Context, dictionary *career.Dictionary, accountID string,
	now int64) (DictionaryState, error) {
	if found, err := exists(ctx, s.db, "SELECT 1 FROM accounts WHERE id = ?", accountID); err != nil {
		return DictionaryState{}, err
	} else if !found {
		return DictionaryState{}, errAccountNotFound
	}
	return dictionaryState(ctx, s.db, dictionary, accountID, now)
}

func dictionaryState(ctx context.Context, q rowsQueryer, dictionary *career.Dictionary, accountID string,
	now int64) (DictionaryState, error) {
	rows, err := q.QueryContext(ctx, "SELECT category, item_id FROM inventory_items WHERE account_id = ?", accountID)
	if err != nil {
		return DictionaryState{}, err
	}
	defer rows.Close()
	owned := map[int]map[int]bool{}
	for rows.Next() {
		var category, item int
		if err := rows.Scan(&category, &item); err != nil {
			return DictionaryState{}, err
		}
		if owned[category] == nil {
			owned[category] = map[int]bool{}
		}
		owned[category][item] = true
	}
	if err := rows.Err(); err != nil {
		return DictionaryState{}, err
	}
	state := DictionaryState{Collected: dictionary.Collected(owned, now)}
	for _, ids := range state.Collected {
		state.Total += len(ids)
	}
	err = q.QueryRowContext(ctx, "SELECT rewarded FROM account_dictionary WHERE account_id = ?",
		accountID).Scan(&state.Rewarded)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return DictionaryState{}, err
	}
	state.Claimable = max(state.Total-state.Rewarded, 0)
	return state, nil
}

// DictionaryClaim is what claiming the dictionary reward granted.
type DictionaryClaim struct {
	Items  int   // newly rewarded items
	Koin   int64 // K币 credited (MaxBalance may cut it)
	State  DictionaryState
	Wallet Wallet
}

// ClaimDictionaryReward pays the reward of every collected item not
// rewarded yet. The wallet row lock serializes it with purchases (which add
// inventory) and other claims of the account.
func (s *Store) ClaimDictionaryReward(ctx context.Context, dictionary *career.Dictionary, accountID string,
	now int64) (DictionaryClaim, error) {
	if dictionary.Reward.Category != koinRewardCategory || dictionary.Reward.Item != koinRewardItem {
		return DictionaryClaim{}, errors.New("dictionary reward is not K币")
	}
	var claim DictionaryClaim
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		claim = DictionaryClaim{}
		l, err := s.lockLedger(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		state, err := dictionaryState(ctx, tx, dictionary, accountID, now)
		if err != nil {
			return err
		}
		if state.Claimable == 0 {
			return errNothingToClaim
		}
		rewarded := state.Rewarded + state.Claimable
		before := l.wallet.Koin
		if _, err := l.add(economy.Koin, int64(state.Claimable)*int64(dictionary.Reward.Count), ReasonDictionary,
			strconv.Itoa(rewarded), ""); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO account_dictionary(account_id, rewarded, updated_at)
			VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE rewarded = VALUES(rewarded), updated_at = VALUES(updated_at)`,
			accountID, rewarded, now); err != nil {
			return err
		}
		claim.Items, claim.Koin = state.Claimable, l.wallet.Koin-before
		state.Rewarded, state.Claimable = rewarded, 0
		claim.State, claim.Wallet = state, l.wallet
		return nil
	})
	return claim, err
}
