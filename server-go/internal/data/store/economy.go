package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"kartsim/internal/data/career"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/quest"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/rewards"
)

// Inventory sources (inventory_items.source).
const (
	SourceStarter = "starter"
	SourceShop    = "shop"
)

const (
	dayMillis = 24 * 60 * 60 * 1000
	// MaxQuantity bounds a count item (balloon packs, boxes and the
	// 探险币; items.go uses some of them up).
	MaxQuantity = 1_000_000
)

var (
	errAlreadyOwned   = apierr.New(http.StatusConflict, "ALREADY_OWNED")
	errExpRequired    = apierr.New(http.StatusForbidden, "EXP_REQUIRED")
	errQuantityLimit  = apierr.New(http.StatusConflict, "QUANTITY_LIMIT")
	errRequestIDReuse = apierr.New(http.StatusConflict, "REQUEST_ID_CONFLICT")
	errPriceChanged   = apierr.New(http.StatusConflict, "PRICE_CHANGED")
	// errTimeAttackTooSoon refuses a run that cannot have been driven since
	// the account's previous settled run.
	errTimeAttackTooSoon = apierr.New(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	errInvalidTrack      = apierr.New(http.StatusBadRequest, "INVALID_TRACK")
)

// ItemRef identifies an inventory item: a catalog item, or a system kart
// (category 3, item 0) named by its system key.
type ItemRef struct {
	Category  int
	ItemID    int
	SystemKey string
}

// InventoryItem is one owned item (ECONOMY.md 8 InventoryItem).
type InventoryItem struct {
	Category  int    `json:"category"`
	ItemID    int    `json:"itemId"`
	SystemKey string `json:"systemKey,omitempty"`
	Quantity  int    `json:"quantity"`
	ExpiresAt *int64 `json:"expiresAt"` // null: permanent
	Source    string `json:"source"`
}

// SummaryStats are the account's race statistics.
type SummaryStats struct {
	Races   int `json:"races"`
	Wins    int `json:"wins"`
	Podiums int `json:"podiums"`
	Points  int `json:"points"`
}

// AccountSummary is what GET /api/account reports, read fresh from MySQL
// (balances are never cached).
type AccountSummary struct {
	Account   Account
	CreatedAt int64
	Wallet    Wallet
	Exp       int64
	Stats     SummaryStats
	Onboarded bool
	// License is the highest of 新手..L1 taken and ProUntil the end of the
	// PRO license (RIDER_SCHOOL.md).
	License  int
	ProUntil int64
}

// StarterChoice is the new-rider gift selection (ECONOMY.md 4).
type StarterChoice struct {
	Character int
	Paint     int
	Dye       int
}

// AccountSummary returns the account's summary, creating its wallet and
// progress rows (with the starting lucci) when they do not exist yet.
func (s *Store) AccountSummary(ctx context.Context, accountID string, now int64) (AccountSummary, bool, error) {
	for attempt := 0; ; attempt++ {
		summary, found, complete, err := readSummary(ctx, s.db, accountID)
		if err != nil || !found || complete || attempt > 0 {
			return summary, found, err
		}
		err = inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
			_, err := s.lockLedger(ctx, tx, accountID, now)
			return err
		})
		if errors.Is(err, errAccountNotFound) {
			return AccountSummary{}, false, nil
		} else if err != nil {
			return AccountSummary{}, false, err
		}
	}
}

// readSummary reads a summary; complete is false while the account has no
// wallet or progress row.
func readSummary(ctx context.Context, q queryer, accountID string) (summary AccountSummary, found, complete bool, err error) {
	var (
		coupon, lucci, koin, exp sql.NullInt64
	)
	err = q.QueryRowContext(ctx, `SELECT a.id, a.username, a.nickname, a.admin, a.created_at,
			w.coupon, w.lucci, w.koin, p.exp,
			COALESCE(s.races, 0), COALESCE(s.wins, 0), COALESCE(s.podiums, 0), COALESCE(s.points, 0),
			o.account_id IS NOT NULL, COALESCE(ls.level, 0), COALESCE(ls.pro_until, 0)
		FROM accounts a
		LEFT JOIN wallets w ON w.account_id = a.id
		LEFT JOIN account_progress p ON p.account_id = a.id
		LEFT JOIN player_stats s ON s.account_id = a.id
		LEFT JOIN account_onboarding o ON o.account_id = a.id
		LEFT JOIN license_state ls ON ls.account_id = a.id
		WHERE a.id = ?`, accountID).Scan(&summary.Account.ID, &summary.Account.Username, &summary.Account.Nickname,
		&summary.Account.Admin, &summary.CreatedAt, &coupon, &lucci, &koin, &exp,
		&summary.Stats.Races, &summary.Stats.Wins, &summary.Stats.Podiums, &summary.Stats.Points, &summary.Onboarded,
		&summary.License, &summary.ProUntil)
	if errors.Is(err, sql.ErrNoRows) {
		return AccountSummary{}, false, false, nil
	} else if err != nil {
		return AccountSummary{}, false, false, err
	}
	summary.Wallet = Wallet{Coupon: coupon.Int64, Lucci: lucci.Int64, Koin: koin.Int64}
	summary.Exp = exp.Int64
	return summary, true, coupon.Valid && exp.Valid, nil
}

// Inventory lists the account's unexpired items. A used-up stack (quantity
// 0: lottery materials) stays in the table for the 道具图鉴 but is not listed.
func (s *Store) Inventory(ctx context.Context, accountID string, now int64) ([]InventoryItem, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT category, item_id, system_key, quantity, expires_at, source
		FROM inventory_items WHERE account_id = ? AND quantity > 0 AND (expires_at IS NULL OR expires_at > ?)
		ORDER BY category, item_id, system_key`, accountID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []InventoryItem{}
	for rows.Next() {
		var (
			item    InventoryItem
			expires sql.NullInt64
		)
		if err := rows.Scan(&item.Category, &item.ItemID, &item.SystemKey, &item.Quantity, &expires, &item.Source); err != nil {
			return nil, err
		}
		if expires.Valid {
			item.ExpiresAt = &expires.Int64
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// Ownership is one owned, unexpired inventory item.
type Ownership struct {
	ExpiresAt *int64 // nil: permanent
}

// OwnedAmong reports which of refs the account owns unexpired, with each
// owned item's expiry.
func (s *Store) OwnedAmong(ctx context.Context, accountID string, refs []ItemRef, now int64) (map[ItemRef]Ownership, error) {
	owned := make(map[ItemRef]Ownership, len(refs))
	if len(refs) == 0 {
		return owned, nil
	}
	tuples := make([]string, len(refs))
	args := []any{accountID, now}
	for i, ref := range refs {
		tuples[i] = "(?, ?, ?)"
		args = append(args, ref.Category, ref.ItemID, ref.SystemKey)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT category, item_id, system_key, expires_at FROM inventory_items
		WHERE account_id = ? AND quantity > 0 AND (expires_at IS NULL OR expires_at > ?)
		AND (category, item_id, system_key) IN (`+strings.Join(tuples, ", ")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			ref     ItemRef
			expires sql.NullInt64
		)
		if err := rows.Scan(&ref.Category, &ref.ItemID, &ref.SystemKey, &expires); err != nil {
			return nil, err
		}
		var ownership Ownership
		if expires.Valid {
			ownership.ExpiresAt = &expires.Int64
		}
		owned[ref] = ownership
	}
	return owned, rows.Err()
}

// The item changer cards (category 7, rewrite/ITEM_MODE.md C.6): the
// 道具换位卡 (7:1) and 道具变更卡 (7:2) stack; the 道具变更卡使用券 (7:3)
// and 道具换位卡使用券 (7:4) are rentals, unlimited while they last.
const (
	CategoryChanger = 7
	itemSlotChanger = 1
	itemItemChanger = 2
	itemItemVoucher = 3
	itemSlotVoucher = 4
)

// ChangerCards are an account's item changer cards: the slot (7:1) and
// item (7:2) card counts, each -1 while the matching voucher (7:4 / 7:3) is
// unexpired; SlotUntil / ItemUntil are such a voucher's expiry (nil when it
// is permanent).
type ChangerCards struct {
	Slot, Item           int
	SlotUntil, ItemUntil *int64
}

// Changers returns an account's item changer cards at now (Unix ms).
func (s *Store) Changers(ctx context.Context, accountID string, now int64) (ChangerCards, error) {
	var cards ChangerCards
	rows, err := s.db.QueryContext(ctx, `SELECT item_id, quantity, expires_at FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id IN (?, ?, ?, ?) AND system_key = '' AND quantity > 0
		AND (expires_at IS NULL OR expires_at > ?)`, accountID, CategoryChanger,
		itemSlotChanger, itemItemChanger, itemItemVoucher, itemSlotVoucher, now)
	if err != nil {
		return cards, err
	}
	defer rows.Close()
	var slotVoucher, itemVoucher bool
	for rows.Next() {
		var (
			itemID, quantity int
			expires          sql.NullInt64
		)
		if err := rows.Scan(&itemID, &quantity, &expires); err != nil {
			return cards, err
		}
		var until *int64
		if expires.Valid {
			until = &expires.Int64
		}
		switch itemID {
		case itemSlotChanger:
			cards.Slot = quantity
		case itemItemChanger:
			cards.Item = quantity
		case itemSlotVoucher:
			slotVoucher, cards.SlotUntil = true, until
		case itemItemVoucher:
			itemVoucher, cards.ItemUntil = true, until
		}
	}
	if slotVoucher {
		cards.Slot = -1
	}
	if itemVoucher {
		cards.Item = -1
	}
	return cards, rows.Err()
}

// Onboarding returns the account's claimed starter choice.
func (s *Store) Onboarding(ctx context.Context, accountID string) (StarterChoice, bool, error) {
	var choice StarterChoice
	err := s.db.QueryRowContext(ctx, "SELECT character_id, paint_id, dye_id FROM account_onboarding WHERE account_id = ?",
		accountID).Scan(&choice.Character, &choice.Paint, &choice.Dye)
	if errors.Is(err, sql.ErrNoRows) {
		return StarterChoice{}, false, nil
	}
	return choice, err == nil, err
}

// Onboarded reports whether the account has claimed the starter gift.
func (s *Store) Onboarded(ctx context.Context, accountID string) (bool, error) {
	return exists(ctx, s.db, "SELECT 1 FROM account_onboarding WHERE account_id = ?", accountID)
}

// ClaimStarter grants the new-rider gift once (ECONOMY.md 4): the starter
// system kart, the chosen character, paint and dye, all permanent, and
// writes the initial equipment into the account profile through
// mergeProfile (given the stored profile, if any). The caller validated the
// choice. It reports false, changing nothing, when the gift was claimed
// before.
func (s *Store) ClaimStarter(ctx context.Context, accountID string, choice StarterChoice, now int64,
	mergeProfile func(profile string, found bool) (string, error)) (bool, error) {
	data, err := s.economyData()
	if err != nil {
		return false, err
	}
	kart := data.Catalog.Starter.Kart
	claimed := false
	err = inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		claimed = false
		if _, err := s.lockLedger(ctx, tx, accountID, now); err != nil {
			return err
		}
		if done, err := exists(ctx, tx, "SELECT 1 FROM account_onboarding WHERE account_id = ? FOR UPDATE", accountID); err != nil || done {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO account_onboarding(account_id, character_id, paint_id, dye_id, claimed_at)
			VALUES(?, ?, ?, ?, ?)`, accountID, choice.Character, choice.Paint, choice.Dye, now); err != nil {
			return err
		}
		for _, ref := range []ItemRef{
			{Category: kart.Category, ItemID: kart.ItemID, SystemKey: kart.SystemKey},
			{Category: economy.CategoryCharacter, ItemID: choice.Character},
			{Category: economy.CategoryPaint, ItemID: choice.Paint},
			{Category: economy.CategoryDye, ItemID: choice.Dye},
		} {
			// An item the account already rents becomes permanent, and a starter
			// item: the browser finds the starter picks (its fallback character,
			// paint and dye) by source "starter".
			if _, err := tx.ExecContext(ctx, `INSERT INTO inventory_items
				(account_id, category, item_id, system_key, quantity, expires_at, source, created_at, updated_at)
				VALUES(?, ?, ?, ?, 1, NULL, ?, ?, ?) AS incoming
				ON DUPLICATE KEY UPDATE quantity = GREATEST(inventory_items.quantity, 1), expires_at = NULL,
					source = incoming.source, updated_at = incoming.updated_at`,
				accountID, ref.Category, ref.ItemID, ref.SystemKey, SourceStarter, now, now); err != nil {
				return err
			}
		}
		var profile string
		err := tx.QueryRowContext(ctx, "SELECT json FROM account_profiles WHERE account_id = ? FOR UPDATE", accountID).Scan(&profile)
		found := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		merged, err := mergeProfile(profile, found)
		if err != nil {
			return err
		}
		if err := saveProfile(ctx, tx, accountID, merged, now); err != nil {
			return err
		}
		claimed = true
		return nil
	})
	return claimed, err
}

// AccountProfile returns the account-bound client profile.
func (s *Store) AccountProfile(ctx context.Context, accountID string) (string, bool, error) {
	return s.document(ctx, "SELECT json FROM account_profiles WHERE account_id = ?", accountID)
}

// SaveAccountProfile stores the account-bound client profile.
func (s *Store) SaveAccountProfile(ctx context.Context, accountID, profile string, now int64) error {
	err := saveProfile(ctx, s.db, accountID, profile, now)
	if missingParent(err) {
		return errAccountNotFound
	}
	return err
}

type execer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

func saveProfile(ctx context.Context, e execer, accountID, profile string, now int64) error {
	_, err := e.ExecContext(ctx, `INSERT INTO account_profiles(account_id, json, updated_at) VALUES(?, ?, ?) AS incoming
		ON DUPLICATE KEY UPDATE json = incoming.json, updated_at = incoming.updated_at`, accountID, profile, now)
	return err
}

// Purchase is one validated shop purchase.
type Purchase struct {
	AccountID      string
	RequestID      string // client UUID, the idempotency key
	Item           *economy.Item
	Offer          economy.Offer
	CatalogVersion string
	Now            int64
	// ExpectedPrice and ExpectedCurrency, when set, are the price the
	// buyer was shown; a different current offer is PRICE_CHANGED (a replay
	// of a stored purchase still answers the original).
	ExpectedPrice    *int64
	ExpectedCurrency *string
}

// PurchaseResult is the body of POST /api/shop/purchase. A replay of the
// same request id returns the stored original.
type PurchaseResult struct {
	Wallet     Wallet        `json:"wallet"`
	Item       InventoryItem `json:"item"`
	PurchaseID int64         `json:"purchaseId"`
}

// Purchase buys an offer in one transaction under the wallet lock
// (ECONOMY.md 5): PRICE_CHANGED when the offer no longer has the expected
// price or currency, EXP_REQUIRED below the offer's exp requirement,
// ALREADY_OWNED for an item owned permanently, INSUFFICIENT_FUNDS when the
// price exceeds the balance. A rental extends from max(now, expiry); a
// permanent offer makes a rented item permanent; count items add up.
func (s *Store) Purchase(ctx context.Context, in Purchase) (PurchaseResult, error) {
	var result PurchaseResult
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = PurchaseResult{}
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		// The wallet lock serializes requests of one account, so a replay
		// always sees the committed original.
		var stored, storedOffer string
		err = tx.QueryRowContext(ctx, "SELECT result_json, offer_id FROM purchases WHERE account_id = ? AND request_id = ?",
			in.AccountID, in.RequestID).Scan(&stored, &storedOffer)
		if err == nil {
			if storedOffer != in.Offer.OfferID {
				return errRequestIDReuse
			}
			return json.Unmarshal([]byte(stored), &result)
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}

		if (in.ExpectedPrice != nil && *in.ExpectedPrice != in.Offer.Price) ||
			(in.ExpectedCurrency != nil && *in.ExpectedCurrency != string(in.Offer.Currency)) {
			return errPriceChanged
		}
		if l.exp < in.Offer.MinExp {
			return errExpRequired
		}
		var (
			quantity int
			expires  sql.NullInt64
		)
		err = tx.QueryRowContext(ctx, `SELECT quantity, expires_at FROM inventory_items
			WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = '' FOR UPDATE`,
			in.AccountID, in.Item.Category, in.Item.ItemID).Scan(&quantity, &expires)
		owned := err == nil
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		active := owned && (!expires.Valid || expires.Int64 > in.Now)
		item := InventoryItem{Category: in.Item.Category, ItemID: in.Item.ItemID, Quantity: 1, Source: SourceShop}
		if in.Item.IsAdditional {
			// Count items are not consumed yet: buying again adds to the pile.
			if active {
				item.Quantity = quantity
			} else {
				item.Quantity = 0
			}
			item.Quantity += in.Offer.Count
			if item.Quantity > MaxQuantity {
				return errQuantityLimit
			}
		} else if active && !expires.Valid {
			return errAlreadyOwned
		}
		if !in.Offer.Permanent() {
			base := in.Now
			if active && expires.Valid {
				base = max(base, expires.Int64)
			}
			if active && !expires.Valid {
				// A rental pack of a permanently owned count item keeps it permanent.
				item.ExpiresAt = nil
			} else {
				until := base + int64(in.Offer.Days)*dayMillis
				item.ExpiresAt = &until
			}
		}
		if l.wallet.Get(in.Offer.Currency) < in.Offer.Price {
			return errInsufficientFunds
		}

		insert, err := tx.ExecContext(ctx, `INSERT INTO purchases(account_id, request_id, offer_id, category, item_id,
			currency, price, days, count, catalog_version, result_json, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
			in.AccountID, in.RequestID, in.Offer.OfferID, in.Item.Category, in.Item.ItemID, string(in.Offer.Currency),
			in.Offer.Price, in.Offer.Days, in.Offer.Count, in.CatalogVersion, in.Now)
		if err != nil {
			return err
		}
		if result.PurchaseID, err = insert.LastInsertId(); err != nil {
			return err
		}
		if paid, err := l.add(in.Offer.Currency, -in.Offer.Price, ReasonPurchase, in.RequestID, in.Offer.OfferID); err != nil {
			return err
		} else if !paid {
			return fmt.Errorf("purchase %s: ledger already charged", in.RequestID)
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO inventory_items
			(account_id, category, item_id, system_key, quantity, expires_at, source, created_at, updated_at)
			VALUES(?, ?, ?, '', ?, ?, ?, ?, ?) AS incoming
			ON DUPLICATE KEY UPDATE quantity = incoming.quantity, expires_at = incoming.expires_at,
				source = incoming.source, updated_at = incoming.updated_at`,
			in.AccountID, item.Category, item.ItemID, item.Quantity, item.ExpiresAt, item.Source, in.Now, in.Now); err != nil {
			return err
		}
		result.Wallet = l.wallet
		result.Item = item
		encoded, err := json.Marshal(result)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE purchases SET result_json = ? WHERE id = ?", string(encoded), result.PurchaseID)
		return err
	})
	return result, err
}

// ShopCouponSpent returns the coupons (点券, the original 电池) the account
// paid for shop purchases with a ledger time in [from, until) (Unix
// milliseconds): the 累计消费 of the shop's tcCash spend event (ECONOMY.md
// 3.4). Refunds and admin debits do not count.
func (s *Store) ShopCouponSpent(ctx context.Context, accountID string, from, until int64) (int64, error) {
	var spent int64
	err := s.db.QueryRowContext(ctx, `SELECT CAST(COALESCE(-SUM(delta), 0) AS SIGNED) FROM wallet_ledger
		WHERE account_id = ? AND created_at >= ? AND created_at < ? AND currency = ? AND reason = ? AND delta < 0`,
		accountID, from, until, string(economy.Coupon), ReasonPurchase).Scan(&spent)
	return spent, err
}

// TimeAttackRun is one finished time-attack run to settle (ECONOMY.md 2.2).
type TimeAttackRun struct {
	AccountID string
	RequestID string // client UUID, the idempotency key
	TrackID   string // already checked against the track list
	ElapsedMs int64  // already checked against rewards.MinTimeAttackMs
	Day       string // the Beijing day of Now (data service clock)
	Now       int64
	// MaxTracks bounds the distinct tracks an account holds records on
	// (the track list size); 0 means no bound.
	MaxTracks int
}

// TimeAttackTolerance is how much shorter than the run time the interval
// since the account's previous settled run may be (network and clock
// jitter between two submissions).
const TimeAttackTolerance = 3_000

// TimeAttackResult is what settling a run granted.
type TimeAttackResult struct {
	Exp       int64                 `json:"exp"`
	Lucci     int64                 `json:"lucci"`
	NewRecord bool                  `json:"newRecord"`
	Capped    bool                  `json:"capped"`
	BestMs    int64                 `json:"bestMs"`
	LevelUps  []economy.LevelReward `json:"levelUps"`
}

// SettleTimeAttack settles a run once per request id: the account's best on
// the track decides a new record, and the first DailyTimeAttackRewardRuns
// runs of a Beijing day earn the time-attack reward.
//
// Only rewarded runs are kept in timeattack_runs (pruned after 30 days);
// timeattack_state remembers the account's latest run, rewarded or not. A
// replay of a stored run, or of the latest run, returns the original
// result (REQUEST_ID_CONFLICT when its track or time differ).
//
// A new run must leave at least rewards.MinTimeAttackMs, and at least its
// own time minus TimeAttackTolerance, since the previous settled run of the
// account (429 TOO_MANY_ATTEMPTS), and may not add a record on a track
// beyond MaxTracks distinct tracks (400 INVALID_TRACK).
func (s *Store) SettleTimeAttack(ctx context.Context, run TimeAttackRun) (TimeAttackResult, error) {
	var result TimeAttackResult
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = TimeAttackResult{}
		l, err := s.lockLedger(ctx, tx, run.AccountID, run.Now)
		if err != nil {
			return err
		}
		replay := func(stored, track string, elapsed int64) error {
			if track != run.TrackID || elapsed != run.ElapsedMs {
				return errRequestIDReuse
			}
			return json.Unmarshal([]byte(stored), &result)
		}
		var (
			stored, storedTrack string
			storedElapsed       int64
		)
		err = tx.QueryRowContext(ctx, `SELECT result_json, track_id, elapsed_ms FROM timeattack_runs
			WHERE account_id = ? AND request_id = ?`, run.AccountID, run.RequestID).Scan(&stored, &storedTrack, &storedElapsed)
		if err == nil {
			return replay(stored, storedTrack, storedElapsed)
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		var (
			lastAt      int64
			lastRequest string
		)
		err = tx.QueryRowContext(ctx, `SELECT last_settle_at, last_request_id, last_track_id, last_elapsed_ms, last_result_json
			FROM timeattack_state WHERE account_id = ? FOR UPDATE`, run.AccountID).
			Scan(&lastAt, &lastRequest, &storedTrack, &storedElapsed, &stored)
		switch {
		case err == nil && lastRequest == run.RequestID:
			return replay(stored, storedTrack, storedElapsed)
		case err == nil:
			since := run.Now - lastAt
			if since < rewards.MinTimeAttackMs || since < run.ElapsedMs-TimeAttackTolerance {
				return errTimeAttackTooSoon
			}
		case !errors.Is(err, sql.ErrNoRows):
			return err
		}

		var best sql.NullInt64
		err = tx.QueryRowContext(ctx, "SELECT best_ms FROM timeattack_bests WHERE account_id = ? AND track_id = ? FOR UPDATE",
			run.AccountID, run.TrackID).Scan(&best)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if !best.Valid && run.MaxTracks > 0 {
			var tracks int
			if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM timeattack_bests WHERE account_id = ?",
				run.AccountID).Scan(&tracks); err != nil {
				return err
			}
			if tracks >= run.MaxTracks {
				return errInvalidTrack
			}
		}
		result.NewRecord = !best.Valid || run.ElapsedMs < best.Int64
		result.BestMs = best.Int64
		if result.NewRecord {
			result.BestMs = run.ElapsedMs
			if _, err := tx.ExecContext(ctx, `INSERT INTO timeattack_bests(account_id, track_id, best_ms, updated_at)
				VALUES(?, ?, ?, ?) AS incoming
				ON DUPLICATE KEY UPDATE best_ms = incoming.best_ms, updated_at = incoming.updated_at`,
				run.AccountID, run.TrackID, run.ElapsedMs, run.Now); err != nil {
				return err
			}
		}
		counter, err := l.lockDaily(run.Day, DailyTimeAttack)
		if err != nil {
			return err
		}
		if counter.count >= rewards.DailyTimeAttackRewardRuns {
			result.Capped = true
		} else {
			reward := rewards.TimeAttackRewards(result.NewRecord, s.rules.Rates)
			if result.Exp, _, err = l.addExp(reward.Exp, ReasonTimeAttack, run.RequestID, ""); err != nil {
				return err
			}
			before := l.wallet.Lucci
			if _, err := l.add(economy.Lucci, reward.Lucci, ReasonTimeAttack, run.RequestID, ""); err != nil {
				return err
			}
			result.Lucci = l.wallet.Lucci - before
			if err := l.addDaily(run.Day, DailyTimeAttack, result.Exp, result.Lucci); err != nil {
				return err
			}
		}
		result.LevelUps = l.levelUpsOrEmpty()
		encoded, err := json.Marshal(result)
		if err != nil {
			return err
		}
		if !result.Capped {
			// The ledger rows reference this request id; past the daily cap
			// nothing was granted and only timeattack_state remembers the run.
			if _, err := tx.ExecContext(ctx, `INSERT INTO timeattack_runs(account_id, request_id, track_id, elapsed_ms,
				result_json, created_at) VALUES(?, ?, ?, ?, ?, ?)`,
				run.AccountID, run.RequestID, run.TrackID, run.ElapsedMs, string(encoded), run.Now); err != nil {
				return err
			}
		}
		// Every settled run is a finished time-attack race (career type 28).
		if err := addCounters(ctx, tx, run.AccountID, map[string]int64{career.CounterTimeAttack: 1}, run.Now); err != nil {
			return err
		}
		// And a 练习计时赛 quest run (MENUS.md 2).
		if err := addQuestProgress(ctx, tx, run.AccountID, quest.Race{Channel: quest.ChannelTimeAttack, Finished: true,
			Rank: 1}, run.Now); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO timeattack_state(account_id, last_settle_at, last_request_id,
			last_track_id, last_elapsed_ms, last_result_json) VALUES(?, ?, ?, ?, ?, ?) AS incoming
			ON DUPLICATE KEY UPDATE last_settle_at = incoming.last_settle_at, last_request_id = incoming.last_request_id,
				last_track_id = incoming.last_track_id, last_elapsed_ms = incoming.last_elapsed_ms,
				last_result_json = incoming.last_result_json`,
			run.AccountID, run.Now, run.RequestID, run.TrackID, run.ElapsedMs, string(encoded))
		return err
	})
	return result, err
}

// PruneEconomyHistory deletes rewarded time-attack runs created before
// runsBefore and daily reward counters of days before dayBefore (a Beijing
// "2006-01-02" day), at most limit rows of each per call. Neither is needed
// after its day: replays of old requests and old caps no longer matter.
func (s *Store) PruneEconomyHistory(ctx context.Context, runsBefore int64, dayBefore string, limit int) (runs, days int64, err error) {
	result, err := s.db.ExecContext(ctx, "DELETE FROM timeattack_runs WHERE created_at < ? LIMIT ?", runsBefore, limit)
	if err != nil {
		return 0, 0, err
	}
	if runs, err = result.RowsAffected(); err != nil {
		return 0, 0, err
	}
	result, err = s.db.ExecContext(ctx, "DELETE FROM daily_rewards WHERE day < ? LIMIT ?", dayBefore, limit)
	if err != nil {
		return runs, 0, err
	}
	days, err = result.RowsAffected()
	return runs, days, err
}

// GrantExp is the Grant.Currency value that changes exp instead of a balance.
const GrantExp = "exp"

// Grant is an admin's change to one account (POST /api/admin/grant).
type Grant struct {
	AccountID string
	Currency  string // coupon, lucci, koin or GrantExp
	Amount    int64  // non-zero; negative takes away
	Admin     string // the admin's username, recorded in the ledger ref
	RequestID string // idempotency key (UUID)
	Note      string
	Now       int64
}

// GrantResult reports what an admin grant changed.
type GrantResult struct {
	Applied   int64                 `json:"applied"`
	LevelUps  []economy.LevelReward `json:"levelUps"`
	Duplicate bool                  `json:"duplicate"`
}

// AdminGrant applies a grant with the ledger reason "admin" and the ref
// "<admin>:<requestId>". The request is recorded in admin_grants: repeating
// it changes nothing and reports Duplicate, while reusing the request id
// for another account, currency or amount is REQUEST_ID_CONFLICT. A balance
// or exp may not go below zero (INSUFFICIENT_FUNDS / INSUFFICIENT_EXP); exp
// stops at the level table's cap and grants level-up rewards.
func (s *Store) AdminGrant(ctx context.Context, grant Grant) (GrantResult, error) {
	var result GrantResult
	ref := grant.Admin + ":" + grant.RequestID
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = GrantResult{}
		l, err := s.lockLedger(ctx, tx, grant.AccountID, grant.Now)
		if err != nil {
			return err
		}
		// The primary key decides between concurrent uses of one request id:
		// a second insert waits for the first transaction and then fails.
		_, err = tx.ExecContext(ctx, `INSERT INTO admin_grants(admin, request_id, account_id, currency, amount, created_at)
			VALUES(?, ?, ?, ?, ?, ?)`, grant.Admin, grant.RequestID, grant.AccountID, grant.Currency, grant.Amount, grant.Now)
		if _, duplicate := duplicateKey(err); duplicate {
			var (
				account, currency string
				amount            int64
			)
			if err := tx.QueryRowContext(ctx, `SELECT account_id, currency, amount FROM admin_grants
				WHERE admin = ? AND request_id = ?`, grant.Admin, grant.RequestID).Scan(&account, &currency, &amount); err != nil {
				return err
			}
			if account != grant.AccountID || currency != grant.Currency || amount != grant.Amount {
				return errRequestIDReuse
			}
			result.Duplicate, result.LevelUps = true, []economy.LevelReward{}
			return nil
		} else if err != nil {
			return err
		}
		if grant.Currency == GrantExp {
			result.Applied, result.Duplicate, err = l.addExp(grant.Amount, ReasonAdmin, ref, grant.Note)
			result.LevelUps = l.levelUpsOrEmpty()
			return err
		}
		currency := economy.Currency(grant.Currency)
		balance := l.wallet.Get(currency)
		if grant.Amount > 0 && grant.Amount > MaxBalance-balance {
			return errBalanceLimit
		}
		applied, err := l.add(currency, grant.Amount, ReasonAdmin, ref, grant.Note)
		if err != nil {
			return err
		}
		result.LevelUps = []economy.LevelReward{}
		if applied {
			result.Applied = l.wallet.Get(currency) - balance
		} else {
			result.Duplicate = true
		}
		return nil
	})
	return result, err
}

// AccountIDByUsername resolves a username (case-insensitive).
func (s *Store) AccountIDByUsername(ctx context.Context, username string) (string, bool, error) {
	var id string
	err := s.db.QueryRowContext(ctx, "SELECT id FROM accounts WHERE username = ?", username).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return id, err == nil, err
}

// escapeLike quotes the LIKE metacharacters (the default escape is \).
func escapeLike(value string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(value)
}
