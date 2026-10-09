package store_test

import (
	"context"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/expedition"
	"kartsim/internal/data/lottery"
	"kartsim/internal/data/store"
)

func first(int) int { return 0 }

func inventoryOf(t *testing.T, st *store.Store, id string, now int64) map[[2]int]store.InventoryItem {
	t.Helper()
	items, err := st.Inventory(context.Background(), id, now)
	if err != nil {
		t.Fatal(err)
	}
	byKey := map[[2]int]store.InventoryItem{}
	for _, item := range items {
		byKey[[2]int{item.Category, item.ItemID}] = item
	}
	return byKey
}

// A box draws by weight, is used up, and a retried request gets the same draw.
func TestOpenBox(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	data, err := lottery.Parse([]byte(`{"version":"t","lotteries":[
		{"id":1228,"lists":[{"from":0,"to":0,"sets":[1]}]},
		{"id":9001,"lists":[{"from":0,"to":1000,"sets":[1]}]}],
		"sets":{"1":[{"stockId":10,"weight":1},{"stockId":11,"weight":3}]},
		"stocks":{"10":[{"category":1,"itemId":5,"count":1,"days":7}],"11":[{"category":34,"itemId":879,"count":4,"days":0}]},
		"names":{"34:879":"探险币"}}`))
	if err != nil {
		t.Fatal(err)
	}
	datatest.Exec(t, db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at,
		source, created_at, updated_at) VALUES(?, 24, 1228, '', 2, NULL, 'test', 0, 0),
		(?, 24, 9001, '', 1, NULL, 'test', 0, 0)`, id, id)
	now := int64(5_000)
	request := "00000000-0000-4000-8000-00000000b001"
	opening, err := st.OpenBox(ctx, data, id, 1228, request, now, func(n int) int { return 1 })
	if err != nil {
		t.Fatal(err)
	}
	if opening.StockID != 11 || opening.Left != 1 || len(opening.Rewards) != 1 || opening.Rewards[0].Name != "探险币" ||
		len(opening.Items) != 2 || opening.Items[0].Quantity != 4 || opening.Items[1].Quantity != 1 {
		t.Fatalf("opening %+v", opening)
	}
	again, err := st.OpenBox(ctx, data, id, 1228, request, now, func(n int) int { return 0 })
	if err != nil || again.StockID != 11 || again.Left != 1 {
		t.Fatalf("retried opening %+v %v", again, err)
	}
	_, err = st.OpenBox(ctx, data, id, 9001, request, now, first)
	expectCode(t, err, "REQUEST_ID_CONFLICT")
	_, err = st.OpenBox(ctx, data, id, 9001, "00000000-0000-4000-8000-00000000b002", now, first)
	expectCode(t, err, "LOTTERY_NOT_IN_PERIOD")
	second, err := st.OpenBox(ctx, data, id, 1228, "00000000-0000-4000-8000-00000000b003", now, first)
	if err != nil || second.StockID != 10 || second.Left != 0 || second.Items[0].ExpiresAt == nil ||
		*second.Items[0].ExpiresAt != now+7*86_400_000 {
		t.Fatalf("second opening %+v %v", second, err)
	}
	_, err = st.OpenBox(ctx, data, id, 1228, "00000000-0000-4000-8000-00000000b004", now, first)
	expectCode(t, err, "ITEM_NOT_ENOUGH")
	_, err = st.OpenBox(ctx, data, id, 7, "00000000-0000-4000-8000-00000000b005", now, first)
	expectCode(t, err, "NOT_A_BOX")
	// The emptied pile stays (quantity 0) and a rental drawn again extends.
	if item := inventoryOf(t, st, id, now)[[2]int{24, 1228}]; item.Quantity != 0 {
		t.Fatalf("box row %+v", item)
	}
}

// matchingCrew finds a character and a kart sharing an attribute.
func matchingCrew() (character, kart, specific int) {
	for c := 1; ; c++ {
		for k := 1; k < 50; k++ {
			if expedition.Specific(1, c) == expedition.Specific(3, k) {
				return c, k, expedition.Specific(1, c)
			}
		}
	}
}

func TestExpeditionWeek(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	data, err := expedition.Default()
	if err != nil {
		t.Fatal(err)
	}
	ids, _ := messengerAccounts(t, db, 2)
	id, friend := ids[0], ids[1]
	character, kart, specific := matchingCrew()
	datatest.Exec(t, db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at,
		source, created_at, updated_at) VALUES(?, 1, ?, '', 1, NULL, 'test', 0, 0), (?, 3, ?, '', 1, NULL, 'test', 0, 0)`,
		id, character, id, kart)
	datatest.Exec(t, db, "INSERT INTO friendships(account_id, friend_id, created_at) VALUES(?, ?, 0)", id, friend)
	now := time.Date(2026, 10, 9, 4, 0, 0, 0, time.UTC).UnixMilli() // Friday 12:00 Beijing

	view, err := st.Expedition(ctx, data, id, now, first)
	if err != nil {
		t.Fatal(err)
	}
	if len(view.State.Slots) != 10 || view.Tokens != expedition.WeeklyTokens || !view.Feasible[specific] {
		t.Fatalf("first week: %d slots, %d tokens, feasible %v", len(view.State.Slots), view.Tokens, view.Feasible)
	}
	// The account's attribute first (as many as it has), the rest at random.
	available, matching := 0, 0
	for _, m := range data.Missions {
		if m.Specific == specific {
			available++
		}
	}
	for _, slot := range view.State.Slots {
		if m, _ := data.Mission(slot.Mission); m.Specific == specific {
			matching++
		}
	}
	if matching != min(available, 10) {
		t.Fatalf("%d of the week's missions match, %d could", matching, min(available, 10))
	}
	if again, err := st.Expedition(ctx, data, id, now+1000, first); err != nil || again.Tokens != expedition.WeeklyTokens {
		t.Fatalf("second read gave tokens again: %d %v", again.Tokens, err)
	}

	crew, err := st.ExpeditionCrew(ctx, data, id, now)
	if err != nil || len(crew.Characters) != 1 || len(crew.Karts) != 1 || len(crew.Friends) != 1 ||
		crew.Friends[0].Character != 1 {
		t.Fatalf("crew %+v %v", crew, err)
	}
	slot := view.State.Slots[0].Slot
	pair := []expedition.Pair{{Character: character, Kart: kart}}
	_, err = st.StartExpedition(ctx, data, id, store.ExpeditionDeparture{Slot: slot,
		Crew: []expedition.Pair{{Character: character + 1, Kart: kart}}}, now, first)
	expectCode(t, err, "INVALID_CREW")
	_, err = st.StartExpedition(ctx, data, id, store.ExpeditionDeparture{Slot: slot, Crew: pair,
		Friend: "00000000-0000-4000-8000-000000000000"}, now, first)
	expectCode(t, err, "NOT_FRIEND")
	view, err = st.StartExpedition(ctx, data, id, store.ExpeditionDeparture{Slot: slot, Crew: pair, Friend: friend},
		now, first)
	if err != nil {
		t.Fatal(err)
	}
	started, _ := view.State.Slot(slot)
	if !started.InProgress(now) || started.Friend != friend || started.Bonus.Reward < 50 {
		t.Fatalf("started %+v", started)
	}

	// 30 minutes for one token, then the rest at once.
	view, err = st.UseExpeditionTokens(ctx, data, id, store.TokenReduce, slot, 1, now, first)
	if err != nil || view.Tokens != expedition.WeeklyTokens-1 {
		t.Fatalf("reduce: %d tokens %v", view.Tokens, err)
	}
	reduced, _ := view.State.Slot(slot)
	cost := data.CompleteCost(reduced, now)
	if cost > view.Tokens {
		datatest.Exec(t, db, `UPDATE inventory_items SET quantity = 200 WHERE account_id = ? AND category = 34`, id)
		view.Tokens = 200
	}
	tokens := view.Tokens
	view, err = st.UseExpeditionTokens(ctx, data, id, store.TokenComplete, slot, 0, now, first)
	if err != nil || view.Tokens != tokens-cost {
		t.Fatalf("complete: %d tokens, cost %d, %v", view.Tokens, cost, err)
	}
	_, err = st.UseExpeditionTokens(ctx, data, id, "bogus", slot, 0, now, first)
	expectCode(t, err, "INVALID_TOKEN_ACTION")

	m, _ := data.Mission(started.Mission)
	view, claim, err := st.ClaimExpedition(ctx, data, func(int, int) string { return "box" }, id, slot, now, first)
	if err != nil {
		t.Fatal(err)
	}
	if claim.Exp != started.Exp || claim.Lucci != started.Lucci || len(claim.Items) != 1 ||
		len(view.State.Slots) != 9 || view.State.Finished != 1 {
		t.Fatalf("claim %+v, %d slots", claim, len(view.State.Slots))
	}
	box := data.Stocks[m.StockID].Items[0]
	if item := inventoryOf(t, st, id, now)[[2]int{box.Category, box.ItemID}]; item.Quantity != box.Count {
		t.Fatalf("reward box %+v, want %d", item, box.Count)
	}
	_, _, err = st.ClaimExpedition(ctx, data, func(int, int) string { return "" }, id, slot, now, first)
	expectCode(t, err, "UNKNOWN_MISSION")

	// The next Thursday renews the list and gives the week's tokens.
	next := now + 7*24*3_600_000
	before := view.Tokens
	view, err = st.Expedition(ctx, data, id, next, first)
	if err != nil || view.Tokens != before+expedition.WeeklyTokens || len(view.State.Slots) != 10 ||
		view.State.Finished != 0 {
		t.Fatalf("next week: %d tokens, %d slots %v", view.Tokens, len(view.State.Slots), err)
	}
}
