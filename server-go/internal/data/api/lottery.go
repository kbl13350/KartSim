package api

import (
	"context"
	crand "crypto/rand"
	"encoding/json"
	"math/rand/v2"
	"net/http"
	"slices"
	"sort"
	"strconv"

	"kartsim/internal/data/lottery"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/rewards"
)

// The lottery endpoints (LOTTERY.md 6): the 寻宝 board, the 精品道具场
// (通用扭蛋), the material packs, the daily free materials and the admin's
// activity settings. Every player endpoint needs a Bearer session.

const (
	// MaxGachaUses bounds one 精品道具场 request (the original multi-use).
	maxGachaUses = 10
	// treasureMultiDraw is the 10 个使用 count of the treasure hunt.
	treasureMultiDraw = 10
	// summaryLimit bounds the 可获得道具 list when a lottery marks none.
	summaryLimit = 12
)

var (
	errLotteryNotFound = apierr.New(http.StatusNotFound, "LOTTERY_NOT_FOUND")
	errPackNotFound    = apierr.New(http.StatusNotFound, "PACK_NOT_FOUND")
	errLotteryClosed   = apierr.New(http.StatusForbidden, "LOTTERY_CLOSED")
	errInvalidCount    = apierr.New(http.StatusBadRequest, "INVALID_COUNT")
	errInvalidActivity = apierr.New(http.StatusBadRequest, "INVALID_ACTIVITY")
	errNoDailyItems    = apierr.New(http.StatusConflict, "NOTHING_TO_CLAIM")
)

// newLotteryRand returns a ChaCha8 generator seeded from crypto/rand.
func newLotteryRand() lottery.Rand {
	var seed [32]byte
	if _, err := crand.Read(seed[:]); err != nil {
		panic(err)
	}
	return rand.New(rand.NewChaCha8(seed))
}

// lotteryItemsDocument is GET /api/lottery/items: the names of the items
// the shop catalog does not name (lottery items, materials, rewards).
func lotteryItemsDocument(data *lottery.Data) catalogDocument {
	body, err := json.Marshal(struct {
		Version string             `json:"version"`
		Items   []lottery.ItemInfo `json:"items"`
	}{data.Version, data.Items})
	if err != nil {
		panic(err)
	}
	return newJSONDocument(data.Version, body)
}

func (a *API) lotteryItems(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.signedIn(r); err != nil {
		return err
	}
	return serveDocument(w, r, a.lotteryItemsDoc)
}

// lotterySettings is every activity's stored admin setting.
type lotterySettings map[string]store.LotteryActivity

func (a *API) lotterySettings(ctx context.Context) (lotterySettings, error) {
	return a.store.LotteryActivities(ctx)
}

// setting is an activity's effective setting: the stored one, or open with
// the built-in daily items.
func (a *API) setting(stored lotterySettings, activity string) lottery.Setting {
	setting := lottery.Setting{Enabled: true, Daily: a.lottery.DefaultDaily(activity)}
	row, ok := stored[activity]
	if !ok {
		return setting
	}
	setting.Enabled, setting.Start, setting.End, setting.Custom = row.Enabled, row.Start, row.End, true
	if row.Daily != nil {
		if items, err := a.lottery.ParseDaily(*row.Daily); err == nil {
			setting.Daily = items
		}
	}
	return setting
}

// lotteryOpen reports whether a lottery item may be used: the 精品道具场 and
// the lottery's own activity are both open.
func (a *API) lotteryOpen(stored lotterySettings, itemID int, now int64) bool {
	return a.setting(stored, lottery.ActivityGacha).Open(now) &&
		a.setting(stored, lottery.LotteryActivity(itemID)).Open(now)
}

// activityJSON is an activity's state for the screens.
type activityJSON struct {
	Open    bool   `json:"open"`
	Enabled bool   `json:"enabled"`
	Start   *int64 `json:"start"`
	End     *int64 `json:"end"`
}

func activityView(setting lottery.Setting, now int64) activityJSON {
	return activityJSON{Open: setting.Open(now), Enabled: setting.Enabled, Start: setting.Start, End: setting.End}
}

func (a *API) stockItems(stock *lottery.Stock) []store.DrawnItem {
	items := make([]store.DrawnItem, 0, len(stock.Items))
	for _, item := range stock.Items {
		drawn := store.DrawnItem{Category: item.Category, ItemID: item.ItemID,
			Name: a.lottery.ItemName(item.Key(), stock), Count: item.Count, Days: item.Days}
		if currency, ok := lottery.CurrencyOf(item.Key()); ok {
			drawn.Currency = string(currency)
		}
		items = append(items, drawn)
	}
	return items
}

func (a *API) stockView(stockID int) []store.DrawnItem {
	stock, ok := a.lottery.StockByID(stockID)
	if !ok {
		return []store.DrawnItem{}
	}
	return a.stockItems(stock)
}

// packJSON is an on-sale material pack.
type packJSON struct {
	StockID  int               `json:"stockId"`
	Name     string            `json:"name"`
	Currency string            `json:"currency"`
	Price    int64             `json:"price"`
	MinExp   int64             `json:"minExp,omitempty"`
	Items    []store.DrawnItem `json:"items"`
}

func (a *API) packViews(packs []*lottery.Pack) []packJSON {
	views := make([]packJSON, 0, len(packs))
	for _, pack := range packs {
		views = append(views, packJSON{StockID: pack.StockID, Name: pack.Name, Currency: string(pack.Currency),
			Price: pack.Price, MinExp: pack.MinExp, Items: a.stockView(pack.StockID)})
	}
	return views
}

// dailyJSON is an activity's daily free materials.
type dailyJSON struct {
	Available bool              `json:"available"` // open, not claimed today, something to claim
	Claimed   bool              `json:"claimed"`
	Items     []store.DrawnItem `json:"items"`
}

func (a *API) dailyView(ctx context.Context, accountID, activity string, setting lottery.Setting,
	now int64) (dailyJSON, error) {
	claimed, err := a.store.LotteryDailyClaimed(ctx, accountID, activity, rewards.BeijingDay(a.now()))
	if err != nil {
		return dailyJSON{}, err
	}
	items := a.stockItems(&lottery.Stock{Items: setting.Daily})
	return dailyJSON{Available: setting.Open(now) && !claimed && len(items) > 0, Claimed: claimed, Items: items}, nil
}

func itemRef(data *lottery.Data, key lottery.ItemKey, owned int) map[string]any {
	return map[string]any{"category": key.Category, "itemId": key.ItemID, "name": data.ItemName(key, nil), "owned": owned}
}

/* ---------- 寻宝 ---------- */

// huntSlotJSON is one of the nine board slots.
type huntSlotJSON struct {
	Slot    int               `json:"slot"`
	Rarity  string            `json:"rarity"`
	StockID int               `json:"stockId"`
	Items   []store.DrawnItem `json:"items"`
	Chance  int64             `json:"chance"` // parts per million
	// 保底 rewards: the acquireCount, the counted draws since the account
	// last obtained it, and the draws left until it is granted.
	AcquireCount int   `json:"acquireCount,omitempty"`
	Counter      int64 `json:"counter,omitempty"`
	Remaining    int64 `json:"remaining,omitempty"`
}

func (a *API) huntSlots(hunt *lottery.TreasureHunt, counters map[string]int64) []huntSlotJSON {
	slots := []huntSlotJSON{}
	for _, index := range hunt.SlotRewards() {
		reward := hunt.Rewards[index]
		slot := huntSlotJSON{Slot: reward.Summary, Rarity: hunt.Rarity(index), StockID: reward.StockID,
			Items: a.stockView(reward.StockID), Chance: hunt.Weight(index) * lottery.ProbabilityScale / hunt.TotalWeight()}
		if reward.AcquireCount > 0 {
			slot.AcquireCount = reward.AcquireCount
			slot.Counter = counters[store.HuntCounter(hunt, reward.StockID)]
			slot.Remaining = max(1, int64(reward.AcquireCount)-slot.Counter)
		}
		slots = append(slots, slot)
	}
	return slots
}

func huntMaterials(hunt *lottery.TreasureHunt) []lottery.ItemKey {
	keys := []lottery.ItemKey{{Category: lottery.MaterialCategory, ItemID: hunt.Material},
		{Category: lottery.MaterialCategory, ItemID: hunt.OtherMaterial}}
	if hunt.EventMaterial != 0 {
		keys = append(keys, lottery.ItemKey{Category: lottery.MaterialCategory, ItemID: hunt.EventMaterial})
	}
	return keys
}

func huntCounterNames(hunt *lottery.TreasureHunt) []string {
	var names []string
	for _, index := range hunt.PityRewards() {
		names = append(names, store.HuntCounter(hunt, hunt.Rewards[index].StockID))
	}
	return names
}

func (a *API) treasureHuntState(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	hunt := a.lottery.TreasureHunt()
	setting := a.setting(stored, lottery.ActivityTreasureHunt)
	holdings, err := a.store.LotteryHoldings(ctx, account.ID, huntMaterials(hunt), now)
	if err != nil {
		return err
	}
	counters, err := a.store.LotteryCounters(ctx, account.ID, huntCounterNames(hunt))
	if err != nil {
		return err
	}
	daily, err := a.dailyView(ctx, account.ID, lottery.ActivityTreasureHunt, setting, now)
	if err != nil {
		return err
	}
	var otherChance int64
	others := 0
	for i, reward := range hunt.Rewards {
		if reward.Summary == 0 {
			others++
			otherChance += hunt.Weight(i)
		}
	}
	material := func(id int) map[string]any {
		key := lottery.ItemKey{Category: lottery.MaterialCategory, ItemID: id}
		return itemRef(a.lottery, key, holdings[key.String()])
	}
	materials := map[string]any{"material": material(hunt.Material), "other": material(hunt.OtherMaterial)}
	if hunt.EventMaterial != 0 {
		materials["eventMaterial"] = material(hunt.EventMaterial)
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"activity":  activityView(setting, now),
		"huntId":    hunt.ID,
		"theme":     hunt.Theme,
		"slots":     a.huntSlots(hunt, counters),
		"others":    map[string]any{"rewards": others, "chance": otherChance * lottery.ProbabilityScale / hunt.TotalWeight()},
		"materials": materials,
		"packs":     a.packViews(a.lottery.HuntPacks(hunt)),
		"daily":     daily,
		"rewards":   len(hunt.Rewards),
	})
}

func (a *API) treasureHuntDraw(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		RequestID string `json:"requestId"`
		Count     int    `json:"count"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	if request.Count != 1 && request.Count != treasureMultiDraw {
		return errInvalidCount
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	if !a.setting(stored, lottery.ActivityTreasureHunt).Open(now) {
		return errLotteryClosed
	}
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	hunt := a.lottery.TreasureHunt()
	result, err := a.store.TreasureHunt(ctx, store.TreasureDraw{AccountID: account.ID, RequestID: id,
		Count: request.Count, Data: a.lottery, Hunt: hunt, Rand: a.lotteryRand(), Now: now})
	if err != nil {
		return err
	}
	a.log.Debug("treasure hunt", "username", account.Username, "draws", len(result.Draws), "stopped", result.Stopped)
	return writeJSON(w, http.StatusOK, struct {
		store.DrawResult
		Slots []huntSlotJSON `json:"slots"`
	}{result, a.huntSlots(hunt, result.Counters)})
}

/* ---------- 精品道具场 ---------- */

// gachaEntryJSON is a lottery the 精品道具场 lists.
type gachaEntryJSON struct {
	ItemID   int            `json:"itemId"`
	Name     string         `json:"name"`
	Owned    int            `json:"owned"`
	Featured bool           `json:"featured"` // an original pack sells it
	Open     bool           `json:"open"`
	Key      map[string]any `json:"key,omitempty"`
}

// gachaList lists the lottery items the account holds, then the open ones
// a pack sells, the newest first.
func (a *API) gachaList(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	owned, err := a.store.OwnedLotteryItems(ctx, account.ID, now)
	if err != nil {
		return err
	}
	featured := map[int]bool{}
	for _, row := range a.lottery.FeaturedLotteries() {
		featured[row.ItemID] = true
	}
	entries := []gachaEntryJSON{}
	add := func(row *lottery.Lottery) {
		entry := gachaEntryJSON{ItemID: row.ItemID, Name: row.Name, Owned: owned[row.ItemID],
			Featured: featured[row.ItemID], Open: a.lotteryOpen(stored, row.ItemID, now)}
		if row.Key != 0 {
			key := lottery.ItemKey{Category: lottery.Category, ItemID: row.Key}
			entry.Key = itemRef(a.lottery, key, owned[row.Key])
		}
		entries = append(entries, entry)
	}
	for id := range owned {
		if row, ok := a.lottery.Lottery(id); ok {
			add(row)
		}
	}
	for _, row := range a.lottery.FeaturedLotteries() {
		if owned[row.ItemID] == 0 && a.lotteryOpen(stored, row.ItemID, now) {
			add(row)
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		if (entries[i].Owned > 0) != (entries[j].Owned > 0) {
			return entries[i].Owned > 0
		}
		return entries[i].ItemID > entries[j].ItemID
	})
	setting := a.setting(stored, lottery.ActivityGacha)
	daily, err := a.dailyView(ctx, account.ID, lottery.ActivityGacha, setting, now)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"activity": activityView(setting, now), "daily": daily, "lotteries": entries,
	})
}

// summaryRewards is a lottery's 可获得道具 list: the rewards it marks with a
// summary position, else its announced (needToNotice) and rarest rewards.
func summaryRewards(data *lottery.Data, row *lottery.Lottery) []lottery.Reward {
	var marked, all []lottery.Reward
	seen := map[int]bool{}
	for _, id := range row.Sets {
		set, _ := data.Set(id)
		for _, reward := range set.Rewards {
			if reward.Weight <= 0 || seen[reward.StockID] {
				continue
			}
			seen[reward.StockID] = true
			all = append(all, reward)
			if reward.Summary > 0 {
				marked = append(marked, reward)
			}
		}
	}
	if len(marked) > 0 {
		sort.SliceStable(marked, func(i, j int) bool { return marked[i].Summary < marked[j].Summary })
		return marked
	}
	sort.SliceStable(all, func(i, j int) bool {
		if all[i].Notice != all[j].Notice {
			return all[i].Notice
		}
		return all[i].Weight < all[j].Weight
	})
	return all[:min(len(all), summaryLimit)]
}

func (a *API) gachaDetail(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	itemID, err := strconv.Atoi(r.PathValue("itemId"))
	if err != nil {
		return errLotteryNotFound
	}
	row, ok := a.lottery.Lottery(itemID)
	if !ok {
		return errLotteryNotFound
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	item := lottery.ItemKey{Category: lottery.Category, ItemID: row.ItemID}
	keys := []lottery.ItemKey{item}
	if row.Key != 0 {
		keys = append(keys, lottery.ItemKey{Category: lottery.Category, ItemID: row.Key})
	}
	holdings, err := a.store.LotteryHoldings(ctx, account.ID, keys, now)
	if err != nil {
		return err
	}
	rewardCount := 0
	for _, id := range row.Sets {
		set, _ := a.lottery.Set(id)
		for _, reward := range set.Rewards {
			if reward.Weight > 0 {
				rewardCount++
			}
		}
	}
	summary := []map[string]any{}
	for _, reward := range summaryRewards(a.lottery, row) {
		summary = append(summary, map[string]any{"stockId": reward.StockID, "notice": reward.Notice,
			"items": a.stockView(reward.StockID)})
	}
	setting := a.setting(stored, lottery.LotteryActivity(row.ItemID))
	activity := activityView(setting, now)
	activity.Open = a.lotteryOpen(stored, row.ItemID, now)
	body := map[string]any{
		"lottery": map[string]any{"itemId": row.ItemID, "name": row.Name, "caption": row.Caption, "desc": row.Desc,
			"effect": row.Effect, "dialog": row.Dialog, "sets": len(row.Sets), "rewards": rewardCount},
		"activity": activity,
		"owned":    holdings[item.String()],
		"summary":  summary,
		"packs":    a.packViews(a.lottery.LotteryPacks(row)),
	}
	if row.Key != 0 {
		key := lottery.ItemKey{Category: lottery.Category, ItemID: row.Key}
		body["key"] = itemRef(a.lottery, key, holdings[key.String()])
	}
	if mileage, event, ok := a.lottery.MileageOf(row.ItemID); ok {
		counters, err := a.store.LotteryCounters(ctx, account.ID, []string{store.MileageCounter(mileage.ItemID)})
		if err != nil {
			return err
		}
		prizes := []map[string]any{}
		for _, prize := range mileage.Prizes {
			prizes = append(prizes, map[string]any{"points": prize.Points, "items": a.stockView(prize.StockID)})
		}
		body["mileage"] = map[string]any{"points": counters[store.MileageCounter(mileage.ItemID)], "event": event,
			"prizes": prizes}
	}
	gacha := a.setting(stored, lottery.ActivityGacha)
	if body["daily"], err = a.dailyView(ctx, account.ID, lottery.ActivityGacha, gacha, now); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, body)
}

func (a *API) gachaDraw(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		ItemID    int    `json:"itemId"`
		Count     int    `json:"count"`
		RequestID string `json:"requestId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	if request.Count < 1 || request.Count > maxGachaUses {
		return errInvalidCount
	}
	row, ok := a.lottery.Lottery(request.ItemID)
	if !ok {
		return errLotteryNotFound
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	if !a.lotteryOpen(stored, row.ItemID, now) {
		return errLotteryClosed
	}
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	result, err := a.store.Gacha(ctx, store.GachaDraw{AccountID: account.ID, RequestID: id, Count: request.Count,
		Data: a.lottery, Lottery: row, Rand: a.lotteryRand(), Now: now})
	if err != nil {
		return err
	}
	a.log.Debug("gacha", "username", account.Username, "lottery", row.ItemID, "uses", len(result.Draws),
		"stopped", result.Stopped)
	return writeJSON(w, http.StatusOK, result)
}

/* ---------- packs and daily materials ---------- */

// packOpen reports whether a pack sells something for an open activity:
// a lottery item or key of an open lottery, or a treasure-hunt material
// while the board is open.
func (a *API) packOpen(stored lotterySettings, pack *lottery.Pack, now int64) bool {
	stock, _ := a.lottery.StockByID(pack.StockID)
	hunt := a.lottery.TreasureHunt()
	materials := huntMaterials(hunt)
	for _, item := range stock.Items {
		key := item.Key()
		if slices.Contains(materials, key) && a.setting(stored, lottery.ActivityTreasureHunt).Open(now) {
			return true
		}
		if key.Category != lottery.Category {
			continue
		}
		if _, ok := a.lottery.Lottery(key.ItemID); ok && a.lotteryOpen(stored, key.ItemID, now) {
			return true
		}
		for i := range a.lottery.Lotteries {
			row := &a.lottery.Lotteries[i]
			if row.Key == key.ItemID && a.lotteryOpen(stored, row.ItemID, now) {
				return true
			}
		}
	}
	return false
}

func (a *API) buyPack(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		StockID          int     `json:"stockId"`
		RequestID        string  `json:"requestId"`
		ExpectedPrice    *int64  `json:"expectedPrice"`
		ExpectedCurrency *string `json:"expectedCurrency"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	pack, ok := a.lottery.Pack(request.StockID)
	if !ok {
		return errPackNotFound
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	if !a.packOpen(stored, pack, now) {
		return errLotteryClosed
	}
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	result, err := a.store.BuyPack(ctx, store.PackPurchase{AccountID: account.ID, RequestID: id, Data: a.lottery,
		Pack: pack, Now: now, ExpectedPrice: request.ExpectedPrice, ExpectedCurrency: request.ExpectedCurrency})
	if err != nil {
		return err
	}
	a.log.Debug("lottery pack", "username", account.Username, "stock", pack.StockID, "price", pack.Price,
		"currency", pack.Currency, "purchaseId", result.PurchaseID)
	return writeJSON(w, http.StatusOK, result)
}

func (a *API) claimLotteryDaily(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Activity string `json:"activity"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if request.Activity != lottery.ActivityTreasureHunt && request.Activity != lottery.ActivityGacha {
		return errInvalidActivity
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	setting := a.setting(stored, request.Activity)
	if !setting.Open(now) {
		return errLotteryClosed
	}
	if len(setting.Daily) == 0 {
		return errNoDailyItems
	}
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	result, err := a.store.ClaimLotteryDaily(ctx, store.DailyClaim{AccountID: account.ID, Activity: request.Activity,
		Day: rewards.BeijingDay(a.now()), Items: setting.Daily, Data: a.lottery, Now: now})
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, result)
}

/* ---------- admin ---------- */

// adminActivityJSON is one activity in the admin console.
type adminActivityJSON struct {
	Activity     string            `json:"activity"`
	Name         string            `json:"name"`
	Enabled      bool              `json:"enabled"`
	Open         bool              `json:"open"`
	Start        *int64            `json:"start"`
	End          *int64            `json:"end"`
	Daily        []store.DrawnItem `json:"daily"`
	DefaultDaily []store.DrawnItem `json:"defaultDaily"`
	HasDaily     bool              `json:"hasDaily"` // the activity grants daily items (treasureHunt, gacha)
	Custom       bool              `json:"custom"`
	UpdatedBy    string            `json:"updatedBy,omitempty"`
	UpdatedAt    int64             `json:"updatedAt,omitempty"`
	// The original period of the data (informational).
	OriginalStart string `json:"originalStart,omitempty"`
	OriginalEnd   string `json:"originalEnd,omitempty"`
}

func (a *API) adminActivity(stored lotterySettings, activity string, now int64) adminActivityJSON {
	setting := a.setting(stored, activity)
	view := adminActivityJSON{Activity: activity, Enabled: setting.Enabled, Open: setting.Open(now),
		Start: setting.Start, End: setting.End, Daily: a.stockItems(&lottery.Stock{Items: setting.Daily}),
		DefaultDaily: a.stockItems(&lottery.Stock{Items: a.lottery.DefaultDaily(activity)}), Custom: setting.Custom}
	if row, ok := stored[activity]; ok {
		view.UpdatedBy, view.UpdatedAt = row.UpdatedBy, row.UpdatedAt
	}
	switch activity {
	case lottery.ActivityTreasureHunt:
		hunt := a.lottery.TreasureHunt()
		view.Name, view.HasDaily = "寻宝活动（"+hunt.Theme+"）", true
		view.OriginalStart, view.OriginalEnd = hunt.Start, hunt.End
	case lottery.ActivityGacha:
		view.Name, view.HasDaily = "精品道具场（全部扭蛋）", true
	default:
		if itemID, err := a.lottery.ParseActivity(activity); err == nil {
			row, _ := a.lottery.Lottery(itemID)
			view.Name = row.Name
			view.OriginalStart, view.OriginalEnd = row.Start, row.End
		}
	}
	return view
}

// adminLottery lists the treasure hunt, the 精品道具场, the lotteries a pack
// sells and every customised lottery, plus all lottery names for the picker.
func (a *API) adminLottery(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	ctx, now := r.Context(), a.nowMillis()
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	activities := []adminActivityJSON{a.adminActivity(stored, lottery.ActivityTreasureHunt, now),
		a.adminActivity(stored, lottery.ActivityGacha, now)}
	listed := map[string]bool{}
	for _, row := range a.lottery.FeaturedLotteries() {
		listed[lottery.LotteryActivity(row.ItemID)] = true
	}
	for activity := range stored {
		if _, err := a.lottery.ParseActivity(activity); err == nil && activity != lottery.ActivityTreasureHunt &&
			activity != lottery.ActivityGacha {
			listed[activity] = true
		}
	}
	var lotteries []map[string]any
	for i := range a.lottery.Lotteries {
		row := &a.lottery.Lotteries[i]
		lotteries = append(lotteries, map[string]any{"itemId": row.ItemID, "name": row.Name})
		if activity := lottery.LotteryActivity(row.ItemID); listed[activity] {
			activities = append(activities, a.adminActivity(stored, activity, now))
		}
	}
	return writeJSON(w, http.StatusOK, map[string]any{"activities": activities, "lotteries": lotteries,
		"serverTime": now})
}

// adminSaveLottery stores an activity setting ({activity, enabled, start,
// end, daily}) or, with reset, drops it.
func (a *API) adminSaveLottery(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Activity string               `json:"activity"`
		Enabled  bool                 `json:"enabled"`
		Start    *int64               `json:"start"`
		End      *int64               `json:"end"`
		Daily    *[]lottery.StockItem `json:"daily"`
		Reset    bool                 `json:"reset"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	if _, err := a.lottery.ParseActivity(request.Activity); err != nil {
		return errInvalidActivity
	}
	ctx, now := r.Context(), a.nowMillis()
	if request.Reset {
		if err := a.store.DeleteLotteryActivity(ctx, request.Activity); err != nil {
			return err
		}
	} else {
		if (request.Start != nil && *request.Start < 0) || (request.End != nil && *request.End < 0) ||
			(request.Start != nil && request.End != nil && *request.Start >= *request.End) {
			return errInvalidRequest
		}
		var daily *string
		if request.Daily != nil {
			if request.Activity != lottery.ActivityTreasureHunt && request.Activity != lottery.ActivityGacha {
				return errInvalidRequest
			}
			encoded, err := json.Marshal(*request.Daily)
			if err != nil {
				return err
			}
			if _, err := a.lottery.ParseDaily(string(encoded)); err != nil {
				return errInvalidRequest
			}
			text := string(encoded)
			daily = &text
		}
		if err := a.store.SaveLotteryActivity(ctx, store.LotteryActivity{Activity: request.Activity,
			Enabled: request.Enabled, Start: request.Start, End: request.End, Daily: daily,
			UpdatedBy: admin.Username, UpdatedAt: now}); err != nil {
			return err
		}
	}
	a.log.Info("admin lottery activity", "admin", admin.Username, "activity", request.Activity,
		"enabled", request.Enabled, "reset", request.Reset)
	stored, err := a.lotterySettings(ctx)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, a.adminActivity(stored, request.Activity, now))
}
