package store_test

import (
	"context"
	"database/sql"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/lottery"
	"kartsim/internal/data/store"
)

// testLottery is a small lottery table: lottery 900 (key 901, two sets,
// mileage at 2 and 3 uses, its [活动] variant 902), a treasure hunt whose
// 保底 reward (stock 1) comes at 3 counted draws, and a pack.
const testLottery = `{
 "version": "0000000000000000000000000000000000000000000000000000000000000000",
 "generatedFrom": "test",
 "lotteries": [
  {"itemId": 900, "name": "测试宝石", "key": 901, "sets": [10, 11]},
  {"itemId": 902, "name": "[活动]测试宝石", "sets": [10]}
 ],
 "rewardSets": [
  {"id": 10, "rewards": [{"stockId": 1, "weight": 1}, {"stockId": 2, "weight": 1}, {"stockId": 9, "weight": 0}]},
  {"id": 11, "rewards": [{"stockId": 3, "weight": 1, "notice": true}]}
 ],
 "mileage": [{"itemId": 900, "eventItemId": 902, "prizes": [{"points": 2, "stockId": 4}, {"points": 3, "stockId": 5}]}],
 "treasureHunts": [{"id": 7, "theme": "summer", "material": 883, "eventMaterial": 884, "otherMaterial": 834,
  "rewards": [{"stockId": 1, "summary": 1, "acquireCount": 3}, {"stockId": 6, "summary": 2}, {"stockId": 7}, {"stockId": 8}]}],
 "packs": [{"stockId": 12, "name": "宝石礼包", "currency": "coupon", "price": 30}],
 "stocks": [
  {"stockId": 1, "items": [{"category": 3, "itemId": 5001, "count": 1, "days": 0}]},
  {"stockId": 2, "items": [{"category": 1, "itemId": 5002, "count": 1, "days": 30}]},
  {"stockId": 3, "items": [{"category": 9, "itemId": 5003, "count": 10, "days": 0}]},
  {"stockId": 4, "items": [{"category": 56, "itemId": 1, "count": 5, "days": 0}]},
  {"stockId": 5, "items": [{"category": 3, "itemId": 5004, "count": 1, "days": 7}]},
  {"stockId": 6, "items": [{"category": 21, "itemId": 5005, "count": 1, "days": 0}]},
  {"stockId": 7, "items": [{"category": 34, "itemId": 5006, "count": 3, "days": 0}]},
  {"stockId": 8, "items": [{"category": 62, "itemId": 1, "count": 2, "days": 0}]},
  {"stockId": 9, "items": [{"category": 3, "itemId": 5007, "count": 1, "days": 0}]},
  {"stockId": 12, "items": [{"category": 24, "itemId": 900, "count": 10, "days": 0}, {"category": 3, "itemId": 5001, "count": 1, "days": 3}]}
 ],
 "items": [
  {"category": 1, "itemId": 5002, "name": "测试角色"},
  {"category": 3, "itemId": 5001, "name": "测试车"},
  {"category": 3, "itemId": 5004, "name": "奖品车"},
  {"category": 3, "itemId": 5007, "name": "零权重车"},
  {"category": 9, "itemId": 5003, "name": "测试气球", "count": true},
  {"category": 21, "itemId": 5005, "name": "测试宠物"},
  {"category": 24, "itemId": 900, "name": "测试宝石", "count": true},
  {"category": 24, "itemId": 901, "name": "测试车胎", "count": true},
  {"category": 24, "itemId": 902, "name": "[活动]测试宝石", "count": true},
  {"category": 34, "itemId": 834, "name": "藏宝图", "count": true},
  {"category": 34, "itemId": 883, "name": "放大镜", "count": true},
  {"category": 34, "itemId": 884, "name": "[活动]放大镜", "count": true},
  {"category": 34, "itemId": 5006, "name": "材料", "count": true},
  {"category": 56, "itemId": 1, "name": "酷币", "count": true},
  {"category": 62, "itemId": 1, "name": "电池", "count": true}
 ]
}`

const dayMs = 24 * 60 * 60 * 1000

func testLotteryData(t *testing.T) *lottery.Data {
	t.Helper()
	data, err := lottery.Parse([]byte(testLottery))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// picks returns the given values from Int64N in order.
type picks struct {
	t      *testing.T
	values []int64
}

func (p *picks) Int64N(n int64) int64 {
	if len(p.values) == 0 {
		p.t.Fatalf("unexpected draw from [0, %d)", n)
	}
	value := p.values[0]
	p.values = p.values[1:]
	if value >= n {
		p.t.Fatalf("pick %d outside [0, %d)", value, n)
	}
	return value
}

// huntPick is the Int64N value that draws treasure-hunt reward index.
func huntPick(hunt *lottery.TreasureHunt, index int) int64 {
	var offset int64
	for i := range index {
		offset += hunt.Weight(i)
	}
	return offset
}

func giveItems(t *testing.T, db *sql.DB, accountID string, items map[[2]int]int) {
	t.Helper()
	for key, quantity := range items {
		datatest.Exec(t, db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at,
			source, created_at, updated_at) VALUES(?, ?, ?, '', ?, NULL, 'test', 0, 0) AS incoming
			ON DUPLICATE KEY UPDATE quantity = incoming.quantity`, accountID, key[0], key[1], quantity)
	}
}

type ownedRow struct {
	quantity int
	expires  sql.NullInt64
	source   string
	found    bool
}

func inventoryRow(t *testing.T, db *sql.DB, accountID string, category, itemID int) ownedRow {
	t.Helper()
	var row ownedRow
	err := db.QueryRow(`SELECT quantity, expires_at, source FROM inventory_items
		WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = ''`, accountID, category, itemID).
		Scan(&row.quantity, &row.expires, &row.source)
	if err != nil && err != sql.ErrNoRows {
		t.Fatal(err)
	}
	row.found = err == nil
	return row
}

func TestTreasureHuntDraws(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	data := testLotteryData(t)
	hunt := data.TreasureHunt()
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	giveItems(t, db, id, map[[2]int]int{{34, 883}: 5, {34, 884}: 1, {34, 834}: 10})
	draw := func(requestID string, count int, values ...int64) store.DrawResult {
		t.Helper()
		result, err := st.TreasureHunt(ctx, store.TreasureDraw{AccountID: id, RequestID: requestID, Count: count,
			Data: data, Hunt: hunt, Rand: &picks{t, values}, Now: 1_000})
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	counter := store.HuntCounter(hunt, 1)

	// The [活动] magnifier goes first and leaves 保底 alone.
	first := draw("00000000-0000-4000-8000-000000000001", 1, huntPick(hunt, 2))
	if len(first.Draws) != 1 || !first.Draws[0].Event || first.Draws[0].Stocks[0] != 7 || first.Stopped != nil ||
		first.Holdings["34:884"] != 0 || first.Holdings["34:883"] != 5 || first.Holdings["34:834"] != 9 ||
		first.Counters[counter] != 0 || first.Draws[0].Rarity != lottery.RarityNormal {
		t.Fatalf("event draw %+v", first)
	}
	if row := inventoryRow(t, db, id, 34, 5006); row.quantity != 3 || row.expires.Valid || row.source != store.SourceLottery {
		t.Fatalf("drawn material %+v", row)
	}

	// Regular draws count; the third counted draw grants the 保底 reward and
	// resets its counter; the sixth runs out of magnifiers.
	ten := draw("00000000-0000-4000-8000-000000000002", 10,
		huntPick(hunt, 3), huntPick(hunt, 3), huntPick(hunt, 3), huntPick(hunt, 3))
	if len(ten.Draws) != 5 || ten.Stopped == nil || ten.Stopped.Code != store.StopInsufficient ||
		ten.Stopped.Item.ItemID != 883 || !ten.Draws[2].Pity || ten.Draws[2].Stocks[0] != 1 ||
		ten.Draws[2].Rarity != lottery.RarityUltimate || ten.Draws[2].Slot != 1 || ten.Counters[counter] != 2 ||
		ten.Wallet.Coupon != 8 || ten.Holdings["34:883"] != 0 || ten.Holdings["34:834"] != 4 {
		t.Fatalf("ten draws %+v", ten)
	}
	if row := inventoryRow(t, db, id, 3, 5001); row.quantity != 1 || row.expires.Valid {
		t.Fatalf("保底 kart %+v", row)
	}
	// A replay answers the stored result and changes nothing.
	if again := draw("00000000-0000-4000-8000-000000000002", 10); len(again.Draws) != 5 || again.Wallet.Coupon != 8 {
		t.Fatalf("replay %+v", again)
	}
	_, err := st.TreasureHunt(ctx, store.TreasureDraw{AccountID: id, RequestID: "00000000-0000-4000-8000-000000000002",
		Count: 1, Data: data, Hunt: hunt, Rand: &picks{t, nil}, Now: 1_000})
	expectCode(t, err, "REQUEST_ID_CONFLICT")

	// The 保底 reward is owned permanently: it is moot (its counter resets) and
	// a normal draw of it stops the request with nothing used.
	giveItems(t, db, id, map[[2]int]int{{34, 883}: 3})
	owned := draw("00000000-0000-4000-8000-000000000003", 1, huntPick(hunt, 0))
	if len(owned.Draws) != 0 || owned.Stopped == nil || owned.Stopped.Code != store.StopOwned ||
		owned.Stopped.Item.ItemID != 5001 || owned.Holdings["34:883"] != 3 || owned.Counters[counter] != 0 {
		t.Fatalf("owned stop %+v", owned)
	}
	// Nothing was drawn, so the request id is free for a retry.
	retry := draw("00000000-0000-4000-8000-000000000003", 1, huntPick(hunt, 1))
	if len(retry.Draws) != 1 || retry.Draws[0].Rarity != lottery.RarityRare || retry.Counters[counter] != 1 {
		t.Fatalf("retry %+v", retry)
	}

	// Used-up stacks stay for the dictionary but leave the inventory list.
	items, err := st.Inventory(ctx, id, 1_000)
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range items {
		if item.Category == 34 && item.ItemID == 884 {
			t.Fatalf("empty stack listed: %+v", item)
		}
	}
	if row := inventoryRow(t, db, id, 34, 884); !row.found || row.quantity != 0 {
		t.Fatalf("used-up row %+v", row)
	}
}

func TestGachaDraws(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	data := testLotteryData(t)
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	giveItems(t, db, id, map[[2]int]int{{24, 900}: 3, {24, 901}: 2, {24, 902}: 1})
	main, _ := data.Lottery(900)
	event, _ := data.Lottery(902)
	use := func(row *lottery.Lottery, requestID string, count int, values ...int64) store.DrawResult {
		t.Helper()
		result, err := st.Gacha(ctx, store.GachaDraw{AccountID: id, RequestID: requestID, Count: count, Data: data,
			Lottery: row, Rand: &picks{t, values}, Now: 1_000})
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	mileage := store.MileageCounter(900)

	// One reward from each set; the key item runs out after two uses; the
	// second use reaches the first mileage prize (5 酷币).
	result := use(main, "00000000-0000-4000-8000-000000000011", 3, 0, 0, 1, 0)
	if len(result.Draws) != 2 || result.Stopped == nil || result.Stopped.Code != store.StopInsufficient ||
		result.Stopped.Item.ItemID != 901 || len(result.Draws[0].Items) != 2 || !result.Draws[0].Notice ||
		len(result.Prizes) != 1 || result.Prizes[0].Items[0].Currency != "koin" || result.Wallet.Koin != 5 ||
		result.Counters[mileage] != 2 || result.Holdings["24:900"] != 1 || result.Holdings["24:901"] != 0 {
		t.Fatalf("uses %+v", result)
	}
	if row := inventoryRow(t, db, id, 9, 5003); row.quantity != 20 || row.expires.Valid {
		t.Fatalf("balloons %+v", row)
	}
	if row := inventoryRow(t, db, id, 1, 5002); !row.expires.Valid || row.expires.Int64 != 1_000+30*dayMs {
		t.Fatalf("rental character %+v", row)
	}

	// Drawing the permanent kart again stops before anything is used.
	giveItems(t, db, id, map[[2]int]int{{24, 901}: 1})
	stopped := use(main, "00000000-0000-4000-8000-000000000012", 1, 0, 0)
	if len(stopped.Draws) != 0 || stopped.Stopped == nil || stopped.Stopped.Code != store.StopOwned ||
		stopped.Stopped.Item.ItemID != 5001 || stopped.Holdings["24:900"] != 1 || stopped.Holdings["24:901"] != 1 {
		t.Fatalf("owned %+v", stopped)
	}

	// The [活动] variant collects no mileage.
	if eventUse := use(event, "00000000-0000-4000-8000-000000000013", 1, 1); len(eventUse.Draws) != 1 ||
		len(eventUse.Prizes) != 0 {
		t.Fatalf("event use %+v", eventUse)
	}
	if counters, err := st.LotteryCounters(ctx, id, []string{mileage}); err != nil || counters[mileage] != 2 {
		t.Fatalf("mileage after event use %v %v", counters, err)
	}
	// The rental character extends from its expiry.
	if row := inventoryRow(t, db, id, 1, 5002); row.expires.Int64 != 1_000+60*dayMs {
		t.Fatalf("extended character %+v", row)
	}

	// The third point reaches the last prize (a 7-day kart) and starts over.
	last := use(main, "00000000-0000-4000-8000-000000000014", 1, 1, 0)
	if len(last.Draws) != 1 || len(last.Prizes) != 1 || last.Prizes[0].Items[0].ItemID != 5004 ||
		last.Counters[mileage] != 0 {
		t.Fatalf("last prize %+v", last)
	}
	if row := inventoryRow(t, db, id, 3, 5004); !row.expires.Valid || row.expires.Int64 != 1_000+7*dayMs {
		t.Fatalf("prize kart %+v", row)
	}
}

func TestLotteryPackAndDaily(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	data := testLotteryData(t)
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	pack, _ := data.Pack(12)
	if _, err := st.AdminGrant(ctx, store.Grant{AccountID: id, Currency: "coupon", Amount: 40, Admin: "test",
		RequestID: "00000000-0000-4000-8000-000000000020", Now: 1_000}); err != nil {
		t.Fatal(err)
	}
	giveItems(t, db, id, map[[2]int]int{{3, 5001}: 1})
	wrong := int64(29)
	_, err := st.BuyPack(ctx, store.PackPurchase{AccountID: id, RequestID: "00000000-0000-4000-8000-000000000021",
		Data: data, Pack: pack, Now: 2_000, ExpectedPrice: &wrong})
	expectCode(t, err, "PRICE_CHANGED")
	bought, err := st.BuyPack(ctx, store.PackPurchase{AccountID: id, RequestID: "00000000-0000-4000-8000-000000000021",
		Data: data, Pack: pack, Now: 2_000})
	if err != nil || bought.Wallet.Coupon != 10 || len(bought.Items) != 2 || bought.Items[0].Count != 10 ||
		!bought.Items[1].Owned {
		t.Fatalf("pack %+v %v", bought, err)
	}
	if again, err := st.BuyPack(ctx, store.PackPurchase{AccountID: id, RequestID: "00000000-0000-4000-8000-000000000021",
		Data: data, Pack: pack, Now: 3_000}); err != nil || again.PurchaseID != bought.PurchaseID || again.Wallet.Coupon != 10 {
		t.Fatalf("pack replay %+v %v", again, err)
	}
	_, err = st.BuyPack(ctx, store.PackPurchase{AccountID: id, RequestID: "00000000-0000-4000-8000-000000000022",
		Data: data, Pack: pack, Now: 3_000})
	expectCode(t, err, "INSUFFICIENT_FUNDS")
	if spent, err := st.ShopCouponSpent(ctx, id, 0, 10_000); err != nil || spent != 30 {
		t.Fatalf("spent %d %v", spent, err)
	}
	if row := inventoryRow(t, db, id, 24, 900); row.quantity != 10 || row.source != store.SourcePack {
		t.Fatalf("pack item %+v", row)
	}

	daily := []lottery.StockItem{{Category: 34, ItemID: 884, Count: 5}, {Category: 56, ItemID: 1, Count: 2}}
	claim := func(day string) (store.DailyResult, error) {
		return st.ClaimLotteryDaily(ctx, store.DailyClaim{AccountID: id, Activity: lottery.ActivityTreasureHunt,
			Day: day, Items: daily, Data: data, Now: 4_000})
	}
	if result, err := claim("2026-10-09"); err != nil || len(result.Items) != 2 || result.Wallet.Koin != 2 {
		t.Fatalf("daily %+v %v", result, err)
	}
	_, err = claim("2026-10-09")
	expectCode(t, err, "ALREADY_CLAIMED")
	if claimed, err := st.LotteryDailyClaimed(ctx, id, lottery.ActivityTreasureHunt, "2026-10-09"); err != nil || !claimed {
		t.Fatalf("claimed %v %v", claimed, err)
	}
	if _, err := claim("2026-10-10"); err != nil {
		t.Fatal(err)
	}
	if row := inventoryRow(t, db, id, 34, 884); row.quantity != 10 {
		t.Fatalf("daily magnifiers %+v", row)
	}
}

func TestLotteryActivitySettings(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	activity := "lottery:" + datatest.Unique()
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM lottery_activities WHERE activity = ?", activity) })
	start, daily := int64(10), `[]`
	if err := st.SaveLotteryActivity(ctx, store.LotteryActivity{Activity: activity, Enabled: false, Start: &start,
		Daily: &daily, UpdatedBy: "admin", UpdatedAt: 5}); err != nil {
		t.Fatal(err)
	}
	settings, err := st.LotteryActivities(ctx)
	if err != nil {
		t.Fatal(err)
	}
	row, ok := settings[activity]
	if !ok || row.Enabled || row.Start == nil || *row.Start != 10 || row.End != nil || row.Daily == nil || *row.Daily != "[]" {
		t.Fatalf("setting %+v", row)
	}
	if err := st.DeleteLotteryActivity(ctx, activity); err != nil {
		t.Fatal(err)
	}
	if settings, err = st.LotteryActivities(ctx); err != nil || settings[activity].Activity != "" {
		t.Fatalf("after delete %+v %v", settings[activity], err)
	}
}
