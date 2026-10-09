package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"kartsim/internal/data/lottery"
	"kartsim/internal/shared/apierr"
)

// Lotteries (LOTTERY.md): the 寻宝 board and the 精品道具场 consume their
// materials from the inventory and grant original stocks; packs sell the
// materials; the daily free materials are claimed once per Beijing day.
// Every change of one account runs under its wallet row lock (lockLedger),
// like purchases, so draws, purchases and claims of an account serialize.

// Ledger reasons of lottery currency credits and debits.
const (
	ReasonLottery      = "lottery"      // a currency item drawn; ref "<requestId>:<use>:<item>"
	ReasonLotteryDaily = "lotterydaily" // a currency item of the daily free materials; ref "<activity>:<day>:<item>"
)

// Inventory sources of lottery grants besides SourceLottery (items.go).
const (
	SourcePack  = "pack"  // bought in a material pack
	SourceDaily = "daily" // daily free materials
)

// Draw kinds (lottery_draws.kind).
const (
	DrawTreasure = "treasure"
	DrawGacha    = "gacha"
)

// Why a draw request stopped before its count (DrawStop.Code).
const (
	StopInsufficient = "INSUFFICIENT_ITEMS" // a material or the lottery item ran out
	StopOwned        = "ALREADY_OWNED"      // the drawn item is owned permanently; nothing was used
	StopEmpty        = "LOTTERY_EMPTY"      // the lottery has nothing to draw
)

var errAlreadyClaimed = apierr.New(http.StatusConflict, "ALREADY_CLAIMED")

// DrawnItem is one item a draw, pack or claim granted (or, in a DrawStop,
// the item that stopped it).
type DrawnItem struct {
	Category int    `json:"category"`
	ItemID   int    `json:"itemId"`
	Name     string `json:"name"`
	Count    int    `json:"count"`
	Days     int    `json:"days"` // 0: permanent
	// Currency is set when the item credited the wallet (酷币, 电池).
	Currency string `json:"currency,omitempty"`
	// Owned marks a pack item skipped because the account owns it permanently.
	Owned bool `json:"owned,omitempty"`
}

// Draw is one use: the stocks drawn (one per reward set of a lottery; one
// for the treasure hunt) and what they granted.
type Draw struct {
	Stocks []int       `json:"stocks"`
	Items  []DrawnItem `json:"items"`
	// Treasure hunt: the board slot (0: the 神秘魔方 pool), its rarity,
	// whether 保底 granted it, and whether the [活动] material was used.
	Slot   int    `json:"slot,omitempty"`
	Rarity string `json:"rarity,omitempty"`
	Pity   bool   `json:"pity,omitempty"`
	Event  bool   `json:"event,omitempty"`
	// Notice marks a premium win (lottery.xml needToNotice).
	Notice bool `json:"notice,omitempty"`
}

// DrawStop says why a request made fewer uses than asked.
type DrawStop struct {
	Code string     `json:"code"`
	Item *DrawnItem `json:"item,omitempty"`
}

// DrawResult answers a draw request. A replay of the request id answers the
// stored original.
type DrawResult struct {
	Draws   []Draw    `json:"draws"`
	Stopped *DrawStop `json:"stopped,omitempty"`
	// Prizes are the mileage (保底) prizes reached.
	Prizes []Draw `json:"prizes,omitempty"`
	Wallet Wallet `json:"wallet"`
	// Holdings are the active quantities of the screen's materials after
	// the request ("category:itemId" keys).
	Holdings map[string]int `json:"holdings"`
	// Counters are the 保底 counters after the request.
	Counters map[string]int64 `json:"counters"`
}

// holding is an inventory row of an item as read under its lock.
type holding struct {
	exists   bool
	quantity int
	expires  sql.NullInt64
	source   string
}

func (h *holding) active(now int64) bool {
	return h.exists && h.quantity > 0 && (!h.expires.Valid || h.expires.Int64 > now)
}

func (h *holding) permanent(now int64) bool { return h.active(now) && !h.expires.Valid }

func (h *holding) amount(now int64) int {
	if !h.active(now) {
		return 0
	}
	return h.quantity
}

// lotteryTx is one account's inventory and counters inside an economy
// transaction; rows are locked as they are first read.
type lotteryTx struct {
	l        *ledger
	data     *lottery.Data
	holdings map[lottery.ItemKey]*holding
	counters map[string]int64
}

func newLotteryTx(l *ledger, data *lottery.Data) *lotteryTx {
	return &lotteryTx{l: l, data: data, holdings: map[lottery.ItemKey]*holding{}, counters: map[string]int64{}}
}

func (t *lotteryTx) holding(key lottery.ItemKey) (*holding, error) {
	if h, ok := t.holdings[key]; ok {
		return h, nil
	}
	h := &holding{}
	err := t.l.tx.QueryRowContext(t.l.ctx, `SELECT quantity, expires_at, source FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = '' FOR UPDATE`,
		t.l.accountID, key.Category, key.ItemID).Scan(&h.quantity, &h.expires, &h.source)
	switch {
	case err == nil:
		h.exists = true
	case !errors.Is(err, sql.ErrNoRows):
		return nil, err
	}
	t.holdings[key] = h
	return h, nil
}

func (t *lotteryTx) amount(key lottery.ItemKey) (int, error) {
	h, err := t.holding(key)
	if err != nil {
		return 0, err
	}
	return h.amount(t.l.now), nil
}

func (t *lotteryTx) item(key lottery.ItemKey, count, days int, stock *lottery.Stock) DrawnItem {
	return DrawnItem{Category: key.Category, ItemID: key.ItemID, Name: t.data.ItemName(key, stock), Count: count, Days: days}
}

// consume takes n of an item; false when the account has fewer.
func (t *lotteryTx) consume(key lottery.ItemKey, n int) (bool, error) {
	h, err := t.holding(key)
	if err != nil {
		return false, err
	}
	if h.amount(t.l.now) < n {
		return false, nil
	}
	// The row stays at quantity 0: the 道具图鉴 counts items ever held.
	if _, err := t.l.tx.ExecContext(t.l.ctx, `UPDATE inventory_items SET quantity = quantity - ?, updated_at = ?
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = ''`,
		n, t.l.now, t.l.accountID, key.Category, key.ItemID); err != nil {
		return false, err
	}
	h.quantity -= n
	return true, nil
}

// ownedPermanently returns the first item of items that is not a stack, not
// a currency and owned permanently: drawing it would change nothing (the
// original refuses such a draw: 您已持有该道具，请重新尝试).
func (t *lotteryTx) ownedPermanently(items []lottery.StockItem) (*lottery.StockItem, error) {
	for i := range items {
		key := items[i].Key()
		if _, currency := lottery.CurrencyOf(key); currency || t.data.IsCountItem(key) {
			continue
		}
		h, err := t.holding(key)
		if err != nil {
			return nil, err
		}
		if h.permanent(t.l.now) {
			return &items[i], nil
		}
	}
	return nil, nil
}

// grant adds a stock's items: currencies to the wallet, stacks add up, a
// permanent item makes a rental permanent, a rental extends from
// max(now, expiry). Non-stack items owned permanently are skipped and
// marked Owned. ref makes each currency credit's ledger row unique.
func (t *lotteryTx) grant(stock *lottery.Stock, source, reason, ref string) ([]DrawnItem, error) {
	granted := make([]DrawnItem, 0, len(stock.Items))
	now := t.l.now
	for index, item := range stock.Items {
		key := item.Key()
		drawn := t.item(key, item.Count, item.Days, stock)
		if currency, ok := lottery.CurrencyOf(key); ok {
			drawn.Currency = string(currency)
			if _, err := t.l.add(currency, int64(item.Count), reason, ref+":"+strconv.Itoa(index), ""); err != nil {
				return nil, err
			}
			granted = append(granted, drawn)
			continue
		}
		h, err := t.holding(key)
		if err != nil {
			return nil, err
		}
		active := h.active(now)
		quantity := 1
		var expires sql.NullInt64
		if t.data.IsCountItem(key) {
			quantity = min(h.amount(now)+item.Count, MaxQuantity)
		} else if h.permanent(now) {
			drawn.Owned = true
			granted = append(granted, drawn)
			continue
		}
		switch {
		case item.Days == 0:
			// Permanent.
		case active && !h.expires.Valid:
			// A rental stack added to a permanent stack keeps it permanent.
		default:
			base := now
			if active {
				base = max(base, h.expires.Int64)
			}
			expires = sql.NullInt64{Int64: base + int64(item.Days)*dayMillis, Valid: true}
		}
		if _, err := t.l.tx.ExecContext(t.l.ctx, `INSERT INTO inventory_items
			(account_id, category, item_id, system_key, quantity, expires_at, source, created_at, updated_at)
			VALUES(?, ?, ?, '', ?, ?, ?, ?, ?) AS incoming
			ON DUPLICATE KEY UPDATE quantity = incoming.quantity, expires_at = incoming.expires_at,
				source = IF(inventory_items.source = ?, inventory_items.source, incoming.source),
				updated_at = incoming.updated_at`,
			t.l.accountID, key.Category, key.ItemID, quantity, expires, source, now, now, SourceStarter); err != nil {
			return nil, err
		}
		*h = holding{exists: true, quantity: quantity, expires: expires, source: source}
		granted = append(granted, drawn)
	}
	return granted, nil
}

func (t *lotteryTx) counter(name string) (int64, error) {
	if value, ok := t.counters[name]; ok {
		return value, nil
	}
	var value int64
	err := t.l.tx.QueryRowContext(t.l.ctx, "SELECT value FROM lottery_counters WHERE account_id = ? AND counter = ? FOR UPDATE",
		t.l.accountID, name).Scan(&value)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	t.counters[name] = value
	return value, nil
}

func (t *lotteryTx) setCounter(name string, value int64) error {
	if _, err := t.l.tx.ExecContext(t.l.ctx, `INSERT INTO lottery_counters(account_id, counter, value, updated_at)
		VALUES(?, ?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE value = incoming.value, updated_at = incoming.updated_at`,
		t.l.accountID, name, value, t.l.now); err != nil {
		return err
	}
	t.counters[name] = value
	return nil
}

func (t *lotteryTx) holdingsOf(keys []lottery.ItemKey) (map[string]int, error) {
	holdings := make(map[string]int, len(keys))
	for _, key := range keys {
		amount, err := t.amount(key)
		if err != nil {
			return nil, err
		}
		holdings[key.String()] = amount
	}
	return holdings, nil
}

// HuntCounter is the 保底 counter of a treasure-hunt reward: the counted
// draws since the account last obtained it.
func HuntCounter(hunt *lottery.TreasureHunt, stockID int) string {
	return fmt.Sprintf("hunt:%d:%d", hunt.ID, stockID)
}

// MileageCounter holds a lottery's mileage points.
func MileageCounter(itemID int) string { return "mileage:" + strconv.Itoa(itemID) }

// replayDraw answers a stored draw request (REQUEST_ID_CONFLICT when its
// kind, target or count differ).
func replayDraw(ctx context.Context, tx *sql.Tx, accountID, requestID, kind string, ref, count int,
	result *DrawResult) (bool, error) {
	var (
		storedKind, stored   string
		storedRef, storedCnt int
	)
	err := tx.QueryRowContext(ctx, `SELECT kind, ref, count, result_json FROM lottery_draws
		WHERE account_id = ? AND request_id = ?`, accountID, requestID).Scan(&storedKind, &storedRef, &storedCnt, &stored)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	} else if err != nil {
		return false, err
	}
	if storedKind != kind || storedRef != ref || storedCnt != count {
		return false, errRequestIDReuse
	}
	return true, json.Unmarshal([]byte(stored), result)
}

func saveDraw(ctx context.Context, tx *sql.Tx, accountID, requestID, kind string, ref, count int,
	result DrawResult, now int64) error {
	if len(result.Draws) == 0 {
		return nil // nothing happened: a retry of the id may draw
	}
	encoded, err := json.Marshal(result)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO lottery_draws(account_id, request_id, kind, ref, count, result_json, created_at)
		VALUES(?, ?, ?, ?, ?, ?, ?)`, accountID, requestID, kind, ref, count, string(encoded), now)
	return err
}

// TreasureDraw is a 寻宝 request of Count draws.
type TreasureDraw struct {
	AccountID string
	RequestID string
	Count     int
	Data      *lottery.Data
	Hunt      *lottery.TreasureHunt
	Rand      lottery.Rand
	Now       int64
}

// TreasureHunt draws on the treasure-hunt board (LOTTERY.md 3). Each draw
// uses one [活动] magnifier when the account has one (it neither counts
// towards nor resets 保底), otherwise one regular magnifier, plus one map.
// A counted draw grants the 保底 reward whose acquireCount it reaches;
// a 保底 reward the account owns permanently is moot and its counter
// resets. A draw of an item owned permanently stops the request before
// anything of that draw is used.
func (s *Store) TreasureHunt(ctx context.Context, in TreasureDraw) (DrawResult, error) {
	hunt := in.Hunt
	material := lottery.ItemKey{Category: lottery.MaterialCategory, ItemID: hunt.Material}
	other := lottery.ItemKey{Category: lottery.MaterialCategory, ItemID: hunt.OtherMaterial}
	event := lottery.ItemKey{Category: lottery.MaterialCategory, ItemID: hunt.EventMaterial}
	keys := []lottery.ItemKey{material, other}
	if hunt.EventMaterial != 0 {
		keys = append(keys, event)
	}
	pity := hunt.PityRewards()
	var result DrawResult
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = DrawResult{Draws: []Draw{}}
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		if replayed, err := replayDraw(ctx, tx, in.AccountID, in.RequestID, DrawTreasure, hunt.ID, in.Count, &result); replayed || err != nil {
			return err
		}
		t := newLotteryTx(l, in.Data)
		for use := 0; use < in.Count; use++ {
			useEvent := false
			if hunt.EventMaterial != 0 {
				amount, err := t.amount(event)
				if err != nil {
					return err
				}
				useEvent = amount > 0
			}
			magnifier := material
			if useEvent {
				magnifier = event
			}
			stop := func(code string, key lottery.ItemKey, stock *lottery.Stock) {
				item := t.item(key, 1, 0, stock)
				result.Stopped = &DrawStop{Code: code, Item: &item}
			}
			for _, key := range []lottery.ItemKey{magnifier, other} {
				if amount, err := t.amount(key); err != nil {
					return err
				} else if amount < 1 && result.Stopped == nil {
					stop(StopInsufficient, key, nil)
				}
			}
			if result.Stopped != nil {
				break
			}
			chosen, forced := -1, false
			if !useEvent {
				for _, index := range pity {
					reward := hunt.Rewards[index]
					name := HuntCounter(hunt, reward.StockID)
					count, err := t.counter(name)
					if err != nil {
						return err
					}
					if count+1 < int64(reward.AcquireCount) {
						continue
					}
					stock, _ := in.Data.StockByID(reward.StockID)
					if owned, err := t.ownedPermanently(stock.Items); err != nil {
						return err
					} else if owned != nil {
						if err := t.setCounter(name, 0); err != nil {
							return err
						}
						continue
					}
					chosen, forced = index, true
					break
				}
			}
			if chosen < 0 {
				chosen = hunt.Draw(in.Rand)
			}
			reward := hunt.Rewards[chosen]
			stock, _ := in.Data.StockByID(reward.StockID)
			if owned, err := t.ownedPermanently(stock.Items); err != nil {
				return err
			} else if owned != nil {
				stop(StopOwned, owned.Key(), stock)
				result.Stopped.Item.Count, result.Stopped.Item.Days = owned.Count, owned.Days
				break
			}
			for _, key := range []lottery.ItemKey{magnifier, other} {
				if ok, err := t.consume(key, 1); err != nil {
					return err
				} else if !ok {
					return fmt.Errorf("treasure hunt: %s vanished under the lock", key)
				}
			}
			items, err := t.grant(stock, SourceLottery, ReasonLottery, in.RequestID+":"+strconv.Itoa(use))
			if err != nil {
				return err
			}
			if !useEvent {
				for _, index := range pity {
					name := HuntCounter(hunt, hunt.Rewards[index].StockID)
					count, err := t.counter(name)
					if err != nil {
						return err
					}
					next := count + 1
					if index == chosen {
						next = 0
					}
					if err := t.setCounter(name, next); err != nil {
						return err
					}
				}
			}
			result.Draws = append(result.Draws, Draw{Stocks: []int{reward.StockID}, Items: items, Slot: reward.Summary,
				Rarity: hunt.Rarity(chosen), Pity: forced, Event: useEvent})
		}
		if result.Holdings, err = t.holdingsOf(keys); err != nil {
			return err
		}
		result.Counters = map[string]int64{}
		for _, index := range pity {
			name := HuntCounter(hunt, hunt.Rewards[index].StockID)
			if result.Counters[name], err = t.counter(name); err != nil {
				return err
			}
		}
		result.Wallet = l.wallet
		return saveDraw(ctx, tx, in.AccountID, in.RequestID, DrawTreasure, hunt.ID, in.Count, result, in.Now)
	})
	return result, err
}

// GachaDraw is a 精品道具场 request: Count uses of one lottery item.
type GachaDraw struct {
	AccountID string
	RequestID string
	Count     int
	Data      *lottery.Data
	Lottery   *lottery.Lottery
	Rand      lottery.Rand
	Now       int64
}

// Gacha uses a lottery item Count times (LOTTERY.md 4): each use takes one
// lottery item (and one key item when the lottery has one) and draws one
// reward from each of its sets. A lottery with mileage gains a point per
// use (not its [活动] variant) and grants each prize the points reach,
// starting over after the last. A use that would draw an item owned
// permanently stops the request before anything of it is used.
func (s *Store) Gacha(ctx context.Context, in GachaDraw) (DrawResult, error) {
	item := lottery.ItemKey{Category: lottery.Category, ItemID: in.Lottery.ItemID}
	keys := []lottery.ItemKey{item}
	var key lottery.ItemKey
	if in.Lottery.Key != 0 {
		key = lottery.ItemKey{Category: lottery.Category, ItemID: in.Lottery.Key}
		keys = append(keys, key)
	}
	mileage, eventVariant, hasMileage := in.Data.MileageOf(in.Lottery.ItemID)
	var result DrawResult
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = DrawResult{Draws: []Draw{}}
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		if replayed, err := replayDraw(ctx, tx, in.AccountID, in.RequestID, DrawGacha, in.Lottery.ItemID, in.Count, &result); replayed || err != nil {
			return err
		}
		t := newLotteryTx(l, in.Data)
		for use := 0; use < in.Count; use++ {
			for _, needed := range keys {
				if amount, err := t.amount(needed); err != nil {
					return err
				} else if amount < 1 {
					drawn := t.item(needed, 1, 0, nil)
					result.Stopped = &DrawStop{Code: StopInsufficient, Item: &drawn}
					break
				}
			}
			if result.Stopped != nil {
				break
			}
			var stocks []*lottery.Stock
			notice := false
			for _, id := range in.Lottery.Sets {
				set, _ := in.Data.Set(id)
				if reward := set.Draw(in.Rand); reward != nil {
					stock, _ := in.Data.StockByID(reward.StockID)
					stocks = append(stocks, stock)
					notice = notice || reward.Notice
				}
			}
			if len(stocks) == 0 {
				result.Stopped = &DrawStop{Code: StopEmpty}
				break
			}
			for _, stock := range stocks {
				owned, err := t.ownedPermanently(stock.Items)
				if err != nil {
					return err
				}
				if owned != nil {
					drawn := t.item(owned.Key(), owned.Count, owned.Days, stock)
					result.Stopped = &DrawStop{Code: StopOwned, Item: &drawn}
					break
				}
			}
			if result.Stopped != nil {
				break
			}
			for _, needed := range keys {
				if ok, err := t.consume(needed, 1); err != nil {
					return err
				} else if !ok {
					return fmt.Errorf("gacha: %s vanished under the lock", needed)
				}
			}
			draw := Draw{Items: []DrawnItem{}, Notice: notice}
			for index, stock := range stocks {
				items, err := t.grant(stock, SourceLottery, ReasonLottery,
					in.RequestID+":"+strconv.Itoa(use)+":"+strconv.Itoa(index))
				if err != nil {
					return err
				}
				draw.Stocks = append(draw.Stocks, stock.StockID)
				draw.Items = append(draw.Items, items...)
			}
			result.Draws = append(result.Draws, draw)
			if hasMileage && !eventVariant {
				name := MileageCounter(mileage.ItemID)
				points, err := t.counter(name)
				if err != nil {
					return err
				}
				points++
				for index, prize := range mileage.Prizes {
					if int64(prize.Points) != points {
						continue
					}
					stock, _ := in.Data.StockByID(prize.StockID)
					items, err := t.grant(stock, SourceLottery, ReasonLottery,
						in.RequestID+":"+strconv.Itoa(use)+":prize"+strconv.Itoa(index))
					if err != nil {
						return err
					}
					result.Prizes = append(result.Prizes, Draw{Stocks: []int{prize.StockID}, Items: items})
				}
				if points >= int64(mileage.Prizes[len(mileage.Prizes)-1].Points) {
					points = 0
				}
				if err := t.setCounter(name, points); err != nil {
					return err
				}
			}
		}
		if result.Holdings, err = t.holdingsOf(keys); err != nil {
			return err
		}
		result.Counters = map[string]int64{}
		if hasMileage {
			name := MileageCounter(mileage.ItemID)
			if result.Counters[name], err = t.counter(name); err != nil {
				return err
			}
		}
		result.Wallet = l.wallet
		return saveDraw(ctx, tx, in.AccountID, in.RequestID, DrawGacha, in.Lottery.ItemID, in.Count, result, in.Now)
	})
	return result, err
}

// PackPurchase buys an original material pack.
type PackPurchase struct {
	AccountID        string
	RequestID        string // client UUID, the idempotency key (shared with shop purchases)
	Data             *lottery.Data
	Pack             *lottery.Pack
	Now              int64
	ExpectedPrice    *int64
	ExpectedCurrency *string
}

// PackResult is the body of POST /api/lottery/packs/buy.
type PackResult struct {
	Wallet     Wallet      `json:"wallet"`
	Items      []DrawnItem `json:"items"`
	PurchaseID int64       `json:"purchaseId"`
}

// PackOfferID is the purchases.offer_id of a pack ("p<stockId>").
func PackOfferID(stockID int) string { return "p" + strconv.Itoa(stockID) }

// BuyPack charges a pack's price and grants its items (ECONOMY.md 5 rules:
// PRICE_CHANGED, EXP_REQUIRED, INSUFFICIENT_FUNDS; the coupons spent count
// for the shop's 累计消费). Items the account owns permanently are skipped.
func (s *Store) BuyPack(ctx context.Context, in PackPurchase) (PackResult, error) {
	stock, ok := in.Data.StockByID(in.Pack.StockID)
	if !ok {
		return PackResult{}, fmt.Errorf("pack %d has no stock", in.Pack.StockID)
	}
	offerID := PackOfferID(in.Pack.StockID)
	var result PackResult
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = PackResult{}
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		var stored, storedOffer string
		err = tx.QueryRowContext(ctx, "SELECT result_json, offer_id FROM purchases WHERE account_id = ? AND request_id = ?",
			in.AccountID, in.RequestID).Scan(&stored, &storedOffer)
		if err == nil {
			if storedOffer != offerID {
				return errRequestIDReuse
			}
			return json.Unmarshal([]byte(stored), &result)
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if (in.ExpectedPrice != nil && *in.ExpectedPrice != in.Pack.Price) ||
			(in.ExpectedCurrency != nil && *in.ExpectedCurrency != string(in.Pack.Currency)) {
			return errPriceChanged
		}
		if l.exp < in.Pack.MinExp {
			return errExpRequired
		}
		if l.wallet.Get(in.Pack.Currency) < in.Pack.Price {
			return errInsufficientFunds
		}
		first := stock.Items[0]
		insert, err := tx.ExecContext(ctx, `INSERT INTO purchases(account_id, request_id, offer_id, category, item_id,
			currency, price, days, count, catalog_version, result_json, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)`,
			in.AccountID, in.RequestID, offerID, first.Category, first.ItemID, string(in.Pack.Currency),
			in.Pack.Price, first.Days, first.Count, in.Data.Version, in.Now)
		if err != nil {
			return err
		}
		if result.PurchaseID, err = insert.LastInsertId(); err != nil {
			return err
		}
		if paid, err := l.add(in.Pack.Currency, -in.Pack.Price, ReasonPurchase, in.RequestID, offerID); err != nil {
			return err
		} else if !paid {
			return fmt.Errorf("pack %s: ledger already charged", in.RequestID)
		}
		t := newLotteryTx(l, in.Data)
		if result.Items, err = t.grant(stock, SourcePack, ReasonPurchase, in.RequestID); err != nil {
			return err
		}
		result.Wallet = l.wallet
		encoded, err := json.Marshal(result)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE purchases SET result_json = ? WHERE id = ?", string(encoded), result.PurchaseID)
		return err
	})
	return result, err
}

// DailyClaim claims an activity's daily free materials.
type DailyClaim struct {
	AccountID string
	Activity  string
	Day       string // Beijing "2006-01-02"
	Items     []lottery.StockItem
	Data      *lottery.Data
	Now       int64
}

// DailyResult is what a daily claim granted.
type DailyResult struct {
	Items  []DrawnItem `json:"items"`
	Wallet Wallet      `json:"wallet"`
}

// ClaimLotteryDaily grants the daily free materials once per activity and
// day (409 ALREADY_CLAIMED).
func (s *Store) ClaimLotteryDaily(ctx context.Context, in DailyClaim) (DailyResult, error) {
	var result DailyResult
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = DailyResult{}
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO lottery_daily(account_id, activity, day, created_at) VALUES(?, ?, ?, ?)",
			in.AccountID, in.Activity, in.Day, in.Now)
		if _, duplicate := duplicateKey(err); duplicate {
			return errAlreadyClaimed
		} else if err != nil {
			return err
		}
		t := newLotteryTx(l, in.Data)
		stock := &lottery.Stock{Items: in.Items}
		if result.Items, err = t.grant(stock, SourceDaily, ReasonLotteryDaily, in.Activity+":"+in.Day); err != nil {
			return err
		}
		result.Wallet = l.wallet
		return nil
	})
	return result, err
}

// LotteryDailyClaimed reports whether the account claimed an activity's
// daily materials on day.
func (s *Store) LotteryDailyClaimed(ctx context.Context, accountID, activity, day string) (bool, error) {
	return exists(ctx, s.db, "SELECT 1 FROM lottery_daily WHERE account_id = ? AND activity = ? AND day = ?",
		accountID, activity, day)
}

// LotteryHoldings returns the active quantities of items ("category:itemId" keys).
func (s *Store) LotteryHoldings(ctx context.Context, accountID string, keys []lottery.ItemKey, now int64) (map[string]int, error) {
	holdings := make(map[string]int, len(keys))
	for _, key := range keys {
		holdings[key.String()] = 0
	}
	if len(keys) == 0 {
		return holdings, nil
	}
	tuples := make([]string, len(keys))
	args := []any{accountID, now}
	for i, key := range keys {
		tuples[i] = "(?, ?)"
		args = append(args, key.Category, key.ItemID)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT category, item_id, quantity FROM inventory_items
		WHERE account_id = ? AND system_key = '' AND quantity > 0 AND (expires_at IS NULL OR expires_at > ?)
		AND (category, item_id) IN (`+strings.Join(tuples, ", ")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var key lottery.ItemKey
		var quantity int
		if err := rows.Scan(&key.Category, &key.ItemID, &quantity); err != nil {
			return nil, err
		}
		holdings[key.String()] = quantity
	}
	return holdings, rows.Err()
}

// OwnedLotteryItems returns the account's active category-24 stacks (item id -> quantity).
func (s *Store) OwnedLotteryItems(ctx context.Context, accountID string, now int64) (map[int]int, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT item_id, quantity FROM inventory_items
		WHERE account_id = ? AND category = ? AND system_key = '' AND quantity > 0 AND (expires_at IS NULL OR expires_at > ?)`,
		accountID, lottery.Category, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	owned := map[int]int{}
	for rows.Next() {
		var id, quantity int
		if err := rows.Scan(&id, &quantity); err != nil {
			return nil, err
		}
		owned[id] = quantity
	}
	return owned, rows.Err()
}

// LotteryCounters reads 保底 counters (missing ones are 0).
func (s *Store) LotteryCounters(ctx context.Context, accountID string, names []string) (map[string]int64, error) {
	counters := make(map[string]int64, len(names))
	for _, name := range names {
		counters[name] = 0
	}
	if len(names) == 0 {
		return counters, nil
	}
	args := []any{accountID}
	for _, name := range names {
		args = append(args, name)
	}
	rows, err := s.db.QueryContext(ctx, `SELECT counter, value FROM lottery_counters WHERE account_id = ? AND counter IN (?`+
		strings.Repeat(", ?", len(names)-1)+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var value int64
		if err := rows.Scan(&name, &value); err != nil {
			return nil, err
		}
		counters[name] = value
	}
	return counters, rows.Err()
}

// LotteryActivity is an admin's setting of one activity. Start and End are
// Unix ms (nil: open-ended); Daily is the JSON list of daily free items
// ([{category,itemId,count,days}]), nil for the built-in list.
type LotteryActivity struct {
	Activity  string
	Enabled   bool
	Start     *int64
	End       *int64
	Daily     *string
	UpdatedBy string
	UpdatedAt int64
}

// LotteryActivities returns every stored activity setting.
func (s *Store) LotteryActivities(ctx context.Context) (map[string]LotteryActivity, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT activity, enabled, start_at, end_at, daily_json, updated_by, updated_at
		FROM lottery_activities`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	settings := map[string]LotteryActivity{}
	for rows.Next() {
		var (
			setting    LotteryActivity
			start, end sql.NullInt64
			daily      sql.NullString
		)
		if err := rows.Scan(&setting.Activity, &setting.Enabled, &start, &end, &daily, &setting.UpdatedBy,
			&setting.UpdatedAt); err != nil {
			return nil, err
		}
		if start.Valid {
			setting.Start = &start.Int64
		}
		if end.Valid {
			setting.End = &end.Int64
		}
		if daily.Valid {
			setting.Daily = &daily.String
		}
		settings[setting.Activity] = setting
	}
	return settings, rows.Err()
}

// SaveLotteryActivity stores an activity setting.
func (s *Store) SaveLotteryActivity(ctx context.Context, setting LotteryActivity) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO lottery_activities(activity, enabled, start_at, end_at, daily_json,
		updated_by, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE
		enabled = incoming.enabled, start_at = incoming.start_at, end_at = incoming.end_at,
		daily_json = incoming.daily_json, updated_by = incoming.updated_by, updated_at = incoming.updated_at`,
		setting.Activity, setting.Enabled, setting.Start, setting.End, setting.Daily, setting.UpdatedBy, setting.UpdatedAt)
	return err
}

// DeleteLotteryActivity removes an activity setting (back to the defaults).
func (s *Store) DeleteLotteryActivity(ctx context.Context, activity string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM lottery_activities WHERE activity = ?", activity)
	return err
}
