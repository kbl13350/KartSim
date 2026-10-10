package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

// Item races (client/ITEM_MODE.md C.6, C.8): the changer cards the
// equipment check reports, their consumption at settlement, and the in-race
// lucci.

// putChanger stores an item changer stack (category 7) for an account.
func putChanger(t *testing.T, h *harness, accountID string, itemID, quantity int, expires any) {
	t.Helper()
	datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at,
		source, created_at, updated_at) VALUES(?, 7, ?, '', ?, ?, 'shop', 0, 0) AS incoming
		ON DUPLICATE KEY UPDATE quantity = incoming.quantity, expires_at = incoming.expires_at`,
		accountID, itemID, quantity, expires)
}

func changerQuantity(t *testing.T, h *harness, accountID string, itemID int) int {
	t.Helper()
	return h.count("SELECT COALESCE(SUM(quantity), -1) FROM inventory_items WHERE account_id = ? AND category = 7 AND item_id = ?",
		accountID, itemID)
}

func TestEquipmentVerifyReportsChangerCards(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("cc_"+u, "Cc"+u)
	h.claimStarter(token, 2, 6, 4)
	ids := map[string]int{}
	for _, slot := range equipmentSlots {
		ids[fmt.Sprint(slot)] = 0
	}
	ids["1"], ids["2"], ids["70"] = 2, 6, 4
	raw, _ := json.Marshal(map[string]any{"itemIds": ids, "kartSerial": 0, "exceedType": 0, "valueAt3E": 0,
		"systemKart": "practiceKart"})
	verify := func() contract.Changers {
		t.Helper()
		var body contract.EquipmentVerifyResponse
		h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: id, Equipment: raw}).
			expect(t, http.StatusOK, "").json(t, &body)
		if !body.OK || body.Changers == nil {
			t.Fatalf("verify %+v", body)
		}
		return *body.Changers
	}
	if got := verify(); got != (contract.Changers{}) {
		t.Fatalf("no cards: %+v", got)
	}
	now := clock.millis()
	putChanger(t, h, id, contract.ItemSlotChanger, 50, nil)
	putChanger(t, h, id, contract.ItemItemChanger, 7, nil)
	if got := verify(); got != (contract.Changers{Slot: 50, Item: 7}) {
		t.Fatalf("cards: %+v", got)
	}
	// An unexpired voucher is unlimited (-1), with its expiry; an expired
	// one counts for nothing.
	putChanger(t, h, id, contract.ItemItemVoucher, 1, now+60_000)
	putChanger(t, h, id, contract.ItemSlotVoucher, 1, now-1)
	got := verify()
	if got.Slot != 50 || got.Item != -1 || got.ItemUntil == nil || *got.ItemUntil != now+60_000 || got.SlotUntil != nil {
		t.Fatalf("vouchers: %+v", got)
	}
	putChanger(t, h, id, contract.ItemSlotVoucher, 1, nil) // a permanent voucher
	if got := verify(); got.Slot != -1 || got.SlotUntil != nil {
		t.Fatalf("permanent voucher: %+v", got)
	}
	clock.advance(time.Minute)
	if got := verify(); got.Item != 7 {
		t.Fatalf("expired item voucher: %+v", got)
	}
}

// The shop sells the vouchers on their original cards (stockCard.xml
// 3975/3976: 1/7/30 days for 10/45/140 点券); a purchase is a rental that
// makes the matching changer unlimited, and buying again extends it.
func TestChangerVouchersFromTheShop(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("vs_"+u, "Vs"+u)
	h.claimStarter(token, 2, 6, 4)
	h.setWallet(id, store.Wallet{Coupon: 200})
	for _, offer := range []struct {
		id         string
		item, days int
		price      int64
	}{{"s27494", 3, 1, 10}, {"s27478", 3, 7, 45}, {"s27479", 3, 30, 140},
		{"s27495", 4, 1, 10}, {"s27480", 4, 7, 45}, {"s27481", 4, 30, 140}} {
		item, ok := h.api.economy.Catalog.ItemByKey(7, offer.item)
		if !ok || item.Kind != "slotChanger" || item.ShopCategory != "useful" || item.ShopSubCategory != "card" {
			t.Fatalf("7:%d in the catalog: %+v", offer.item, item)
		}
		found := false
		for _, o := range item.Offers {
			found = found || (o.OfferID == offer.id && o.Days == offer.days && o.Price == offer.price && o.Currency == "coupon")
		}
		if !found || len(item.Offers) != 3 {
			t.Fatalf("7:%d offers %+v", offer.item, item.Offers)
		}
	}
	if _, ok := h.api.economy.Catalog.ItemByKey(7, 1); ok {
		t.Fatal("the counted 道具换位卡 is on sale (it comes from card packs)")
	}
	buy := func(offerID string) {
		t.Helper()
		h.post("/api/shop/purchase", map[string]string{"offerId": offerID, "requestId": uuid()}, bearerHeader(token)).
			expect(t, http.StatusOK, "")
	}
	buy("s27480") // 换位卡使用券, 7 days
	buy("s27495") // and one more day
	cards, err := h.api.store.Changers(context.Background(), id, clock.millis())
	if err != nil || cards.Slot != -1 || cards.Item != 0 || cards.SlotUntil == nil ||
		*cards.SlotUntil != clock.millis()+8*86_400_000 {
		t.Fatalf("after buying vouchers: %+v %v", cards, err)
	}
	if wallet := h.wallet(id); wallet.Coupon != 200-45-10 {
		t.Fatalf("wallet %+v", wallet)
	}
}

func TestSettlementConsumesChangerCards(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id := h.account("cons_"+u, "Cons"+u, password, false)
	putChanger(t, h, id, contract.ItemSlotChanger, 3, nil)
	putChanger(t, h, id, contract.ItemItemChanger, 1, nil)
	race := raceWithRewards("cons-"+u, clock.millis(), contract.RaceReward{PlayerID: "p", AccountID: id, Exp: 10, Lucci: 10})
	race.Gameplay = "item"
	race.Consumed = []contract.ConsumedItem{
		{PlayerID: "p", AccountID: id, Category: 7, ItemID: contract.ItemSlotChanger, Count: 2},
		{PlayerID: "p", AccountID: id, Category: 7, ItemID: contract.ItemItemChanger, Count: 5}, // more than held
	}
	if result := h.settle(race); result.Duplicate {
		t.Fatal("first settlement reported duplicate")
	}
	if slot, item := changerQuantity(t, h, id, 1), changerQuantity(t, h, id, 2); slot != 1 || item != 0 {
		t.Fatalf("after the race: %d slot, %d item cards", slot, item)
	}
	// Once per race.
	var result contract.RaceSettlementResponse
	h.call(contract.PathRaces, race).expect(t, http.StatusOK, "").json(t, &result)
	if !result.Duplicate || changerQuantity(t, h, id, 1) != 1 {
		t.Fatalf("duplicate settlement consumed again: %+v, %d", result, changerQuantity(t, h, id, 1))
	}
	// Only the counted cards, with sane counts.
	for i, bad := range []contract.ConsumedItem{
		{PlayerID: "p", AccountID: id, Category: 7, ItemID: contract.ItemItemVoucher, Count: 1},
		{PlayerID: "p", AccountID: id, Category: 8, ItemID: 1, Count: 1},
		{PlayerID: "p", AccountID: id, Category: 7, ItemID: 1, Count: 0},
		{PlayerID: "p", AccountID: "not an id", Category: 7, ItemID: 1, Count: 1},
	} {
		invalid := raceWithRewards(fmt.Sprintf("cons-bad-%d-%s", i, u), clock.millis())
		invalid.Consumed = []contract.ConsumedItem{bad}
		h.call(contract.PathRaces, invalid).expect(t, http.StatusBadRequest, "INVALID_SETTLEMENT")
	}
}

func TestSettlementCreditsBonusLucci(t *testing.T) {
	clock := newFakeClock(economyNoon)
	configured := rewards.Rates{Exp: 1, Lucci: 2}
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now, rates: &configured})
	u := datatest.Unique()
	for i, tc := range []struct {
		bonus, want int
	}{
		{10, 33*2 + 10},                    // the bonus without the rate
		{contract.MaxBonusLucci, 66 + 200}, // the per-race cap itself
		{contract.MaxBonusLucci + 1, 66},   // above it: not credited, the race lucci still is
		{-5, 66},
	} {
		id := h.account(fmt.Sprintf("bl%d_%s", i, u), fmt.Sprintf("Bl%d%s", i, u), password, false)
		h.settle(raceWithRewards(fmt.Sprintf("bl-%s-%d", u, i), clock.millis(),
			contract.RaceReward{PlayerID: "p", AccountID: id, Exp: 10, Lucci: 33, BonusLucci: tc.bonus}))
		if lucci := h.count("SELECT COALESCE(SUM(delta), 0) FROM wallet_ledger WHERE account_id = ? AND reason = 'race'", id); lucci != tc.want {
			t.Errorf("bonus %d: lucci %d, want %d", tc.bonus, lucci, tc.want)
		}
	}
}
