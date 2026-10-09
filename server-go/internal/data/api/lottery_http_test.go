package api

import (
	"context"
	"math/rand/v2"
	"net/http"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/lottery"
	"kartsim/internal/data/store"
)

func seededLottery() lottery.Rand { return rand.New(rand.NewPCG(1, 2)) }

type drawnItemBody struct {
	Category int    `json:"category"`
	ItemID   int    `json:"itemId"`
	Name     string `json:"name"`
	Count    int    `json:"count"`
	Currency string `json:"currency"`
	Owned    bool   `json:"owned"`
}

type drawBody struct {
	Draws []struct {
		Stocks []int           `json:"stocks"`
		Items  []drawnItemBody `json:"items"`
		Event  bool            `json:"event"`
		Rarity string          `json:"rarity"`
	} `json:"draws"`
	Stopped *struct {
		Code string        `json:"code"`
		Item drawnItemBody `json:"item"`
	} `json:"stopped"`
	Holdings map[string]int `json:"holdings"`
	Wallet   store.Wallet   `json:"wallet"`
	Slots    []struct {
		Slot      int   `json:"slot"`
		Remaining int64 `json:"remaining"`
	} `json:"slots"`
}

type huntStateBody struct {
	Activity activityJSON `json:"activity"`
	Theme    string       `json:"theme"`
	Slots    []struct {
		Slot         int             `json:"slot"`
		Rarity       string          `json:"rarity"`
		Items        []drawnItemBody `json:"items"`
		Chance       int64           `json:"chance"`
		AcquireCount int             `json:"acquireCount"`
		Remaining    int64           `json:"remaining"`
	} `json:"slots"`
	Materials map[string]struct {
		ItemID int    `json:"itemId"`
		Name   string `json:"name"`
		Owned  int    `json:"owned"`
	} `json:"materials"`
	Packs []packJSON `json:"packs"`
	Daily dailyJSON  `json:"daily"`
}

func (h *harness) adminUser() (id, token string) {
	h.t.Helper()
	id, _, token = h.messengerUser()
	datatest.Exec(h.t, h.db, "UPDATE accounts SET admin = 1 WHERE id = ?", id)
	return id, token
}

func (h *harness) resetActivity(activity string) {
	h.t.Cleanup(func() { datatest.Exec(h.t, h.db, "DELETE FROM lottery_activities WHERE activity = ?", activity) })
}

func TestLotteryNeedsLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	for _, path := range []string{"/api/lottery/items", "/api/lottery/treasure-hunt", "/api/lottery/gacha",
		"/api/lottery/gacha/1241"} {
		h.get(path, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
	for _, path := range []string{"/api/lottery/treasure-hunt/draw", "/api/lottery/gacha/draw",
		"/api/lottery/packs/buy", "/api/lottery/daily"} {
		h.post(path, map[string]any{}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
}

func TestTreasureHuntAPI(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true, lotteryRand: seededLottery})
	h.resetActivity(lottery.ActivityTreasureHunt)
	_, _, token := h.messengerUser()
	auth := bearerHeader(token)
	_, adminToken := h.adminUser()
	admin := bearerHeader(adminToken)

	var state huntStateBody
	h.get("/api/lottery/treasure-hunt", auth).expect(t, http.StatusOK, "").json(t, &state)
	if !state.Activity.Open || state.Theme != "summer" || len(state.Slots) != 9 || state.Slots[0].Rarity != "ultimate" ||
		state.Slots[0].AcquireCount != 750 || state.Slots[0].Remaining != 750 || state.Slots[0].Chance != 666 ||
		state.Materials["material"].ItemID != 883 || state.Materials["eventMaterial"].Owned != 0 ||
		len(state.Packs) == 0 || !state.Daily.Available || len(state.Daily.Items) != 2 {
		t.Fatalf("state %+v", state)
	}

	var draw drawBody
	h.post("/api/lottery/treasure-hunt/draw", map[string]any{"requestId": newUUID(), "count": 1}, auth).
		expect(t, http.StatusOK, "").json(t, &draw)
	if len(draw.Draws) != 0 || draw.Stopped == nil || draw.Stopped.Code != "INSUFFICIENT_ITEMS" ||
		draw.Stopped.Item.ItemID != 883 {
		t.Fatalf("without materials %+v", draw)
	}
	h.post("/api/lottery/treasure-hunt/draw", map[string]any{"requestId": newUUID(), "count": 3}, auth).
		expect(t, http.StatusBadRequest, "INVALID_COUNT")
	h.post("/api/lottery/treasure-hunt/draw", map[string]any{"requestId": "x", "count": 1}, auth).
		expect(t, http.StatusBadRequest, "INVALID_REQUEST_ID")

	var claim store.DailyResult
	h.post("/api/lottery/daily", map[string]string{"activity": "treasureHunt"}, auth).
		expect(t, http.StatusOK, "").json(t, &claim)
	if len(claim.Items) != 2 || claim.Items[0].ItemID != 884 || claim.Items[0].Count != 5 {
		t.Fatalf("daily %+v", claim)
	}
	h.post("/api/lottery/daily", map[string]string{"activity": "treasureHunt"}, auth).
		expect(t, http.StatusConflict, "ALREADY_CLAIMED")
	h.post("/api/lottery/daily", map[string]string{"activity": "shop"}, auth).
		expect(t, http.StatusBadRequest, "INVALID_ACTIVITY")

	// Ten draws with the five free [活动] magnifiers: five draws, then no
	// regular magnifier.
	h.post("/api/lottery/treasure-hunt/draw", map[string]any{"requestId": newUUID(), "count": 10}, auth).
		expect(t, http.StatusOK, "").json(t, &draw)
	if len(draw.Draws) != 5 || draw.Stopped == nil || draw.Stopped.Code != "INSUFFICIENT_ITEMS" ||
		draw.Holdings["34:884"] != 0 || draw.Holdings["34:834"] != 0 || len(draw.Slots) != 9 {
		t.Fatalf("ten draws %+v", draw)
	}
	for _, one := range draw.Draws {
		if !one.Event || len(one.Items) == 0 || one.Items[0].Name == "" || one.Rarity == "" {
			t.Fatalf("draw %+v", one)
		}
	}
	h.get("/api/lottery/treasure-hunt", auth).expect(t, http.StatusOK, "").json(t, &state)
	if state.Daily.Available || !state.Daily.Claimed {
		t.Fatalf("daily after claim %+v", state.Daily)
	}

	// The admin closes the board.
	h.put("/api/admin/lottery", map[string]any{"activity": "treasureHunt", "enabled": false}, auth).
		expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	var saved adminActivityJSON
	h.put("/api/admin/lottery", map[string]any{"activity": "treasureHunt", "enabled": false}, admin).
		expect(t, http.StatusOK, "").json(t, &saved)
	if saved.Enabled || saved.Open || !saved.Custom || len(saved.Daily) != 2 {
		t.Fatalf("saved %+v", saved)
	}
	h.post("/api/lottery/treasure-hunt/draw", map[string]any{"requestId": newUUID(), "count": 1}, auth).
		expect(t, http.StatusForbidden, "LOTTERY_CLOSED")
	h.post("/api/lottery/packs/buy", map[string]any{"requestId": newUUID(), "stockId": 32023}, auth).
		expect(t, http.StatusForbidden, "LOTTERY_CLOSED")
	h.get("/api/lottery/treasure-hunt", auth).expect(t, http.StatusOK, "").json(t, &state)
	if state.Activity.Open {
		t.Fatal("closed board reported open")
	}
	h.put("/api/admin/lottery", map[string]any{"activity": "treasureHunt", "reset": true}, admin).
		expect(t, http.StatusOK, "").json(t, &saved)
	if !saved.Enabled || saved.Custom {
		t.Fatalf("reset %+v", saved)
	}
}

func TestGachaAPI(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true, lotteryRand: seededLottery})
	h.resetActivity("lottery:1241")
	id, _, token := h.messengerUser()
	auth := bearerHeader(token)
	_, adminToken := h.adminUser()
	admin := bearerHeader(adminToken)

	var list struct {
		Activity  activityJSON     `json:"activity"`
		Daily     dailyJSON        `json:"daily"`
		Lotteries []gachaEntryJSON `json:"lotteries"`
	}
	h.get("/api/lottery/gacha", auth).expect(t, http.StatusOK, "").json(t, &list)
	found := false
	for _, entry := range list.Lotteries {
		if entry.ItemID == 1241 {
			found = entry.Featured && entry.Open && entry.Owned == 0 && entry.Key["itemId"] == float64(862)
		}
	}
	if !found || !list.Activity.Open || !list.Daily.Available {
		t.Fatalf("list %+v", list)
	}

	var detail struct {
		Lottery map[string]any   `json:"lottery"`
		Owned   int              `json:"owned"`
		Key     map[string]any   `json:"key"`
		Summary []map[string]any `json:"summary"`
		Packs   []packJSON       `json:"packs"`
	}
	h.get("/api/lottery/gacha/1241", auth).expect(t, http.StatusOK, "").json(t, &detail)
	if detail.Lottery["name"] != "光明骑士幸运宝石" || detail.Key["itemId"] != float64(862) || len(detail.Summary) == 0 ||
		len(detail.Packs) == 0 {
		t.Fatalf("detail %+v", detail)
	}
	h.get("/api/lottery/gacha/99999", auth).expect(t, http.StatusNotFound, "LOTTERY_NOT_FOUND")

	if _, err := h.api.store.AdminGrant(context.Background(), store.Grant{AccountID: id, Currency: "coupon", Amount: 100,
		Admin: "test", RequestID: newUUID(), Now: 1}); err != nil {
		t.Fatal(err)
	}
	var pack store.PackResult
	h.post("/api/lottery/packs/buy", map[string]any{"requestId": newUUID(), "stockId": 32323, "expectedPrice": 38},
		auth).expect(t, http.StatusOK, "").json(t, &pack)
	if pack.Wallet.Coupon != 62 || len(pack.Items) != 2 || pack.Items[0].ItemID != 1241 {
		t.Fatalf("gem pack %+v", pack)
	}
	h.post("/api/lottery/packs/buy", map[string]any{"requestId": newUUID(), "stockId": 22779}, auth).
		expect(t, http.StatusOK, "").json(t, &pack)
	if pack.Wallet.Lucci != store.DefaultStartingLucci-10 || pack.Items[0].Count != 100 {
		t.Fatalf("tire pack %+v", pack)
	}
	h.post("/api/lottery/packs/buy", map[string]any{"requestId": newUUID(), "stockId": 1}, auth).
		expect(t, http.StatusNotFound, "PACK_NOT_FOUND")

	var draw drawBody
	h.post("/api/lottery/gacha/draw", map[string]any{"requestId": newUUID(), "itemId": 1241, "count": 2}, auth).
		expect(t, http.StatusOK, "").json(t, &draw)
	if len(draw.Draws) != 1 || draw.Stopped == nil || draw.Stopped.Item.ItemID != 1241 ||
		draw.Holdings["24:1241"] != 0 || draw.Holdings["24:862"] != 99 || len(draw.Draws[0].Items) == 0 {
		t.Fatalf("gem draw %+v", draw)
	}
	h.post("/api/lottery/gacha/draw", map[string]any{"requestId": newUUID(), "itemId": 1241, "count": 11}, auth).
		expect(t, http.StatusBadRequest, "INVALID_COUNT")

	h.put("/api/admin/lottery", map[string]any{"activity": "lottery:1241", "enabled": false}, admin).
		expect(t, http.StatusOK, "")
	h.post("/api/lottery/gacha/draw", map[string]any{"requestId": newUUID(), "itemId": 1241, "count": 1}, auth).
		expect(t, http.StatusForbidden, "LOTTERY_CLOSED")
	// The tires still sell: the [活动] gem shares them.
	h.post("/api/lottery/packs/buy", map[string]any{"requestId": newUUID(), "stockId": 22779}, auth).
		expect(t, http.StatusOK, "")
	h.post("/api/lottery/packs/buy", map[string]any{"requestId": newUUID(), "stockId": 32323}, auth).
		expect(t, http.StatusForbidden, "LOTTERY_CLOSED")
}

func TestAdminLotteryAPI(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	h.resetActivity(lottery.ActivityGacha)
	_, adminToken := h.adminUser()
	admin := bearerHeader(adminToken)
	var listing struct {
		Activities []adminActivityJSON `json:"activities"`
		Lotteries  []map[string]any    `json:"lotteries"`
	}
	h.get("/api/admin/lottery", admin).expect(t, http.StatusOK, "").json(t, &listing)
	if len(listing.Activities) < 3 || listing.Activities[0].Activity != "treasureHunt" ||
		listing.Activities[1].Activity != "gacha" || listing.Activities[0].OriginalEnd == "" ||
		len(listing.Lotteries) < 200 {
		t.Fatalf("listing %d activities %d lotteries", len(listing.Activities), len(listing.Lotteries))
	}
	h.put("/api/admin/lottery", map[string]any{"activity": "nope", "enabled": true}, admin).
		expect(t, http.StatusBadRequest, "INVALID_ACTIVITY")
	h.put("/api/admin/lottery", map[string]any{"activity": "lottery:1241", "enabled": true,
		"daily": []map[string]int{{"category": 24, "itemId": 1241, "count": 1}}}, admin).
		expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.put("/api/admin/lottery", map[string]any{"activity": "gacha", "enabled": true, "start": 10, "end": 5}, admin).
		expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	var saved adminActivityJSON
	h.put("/api/admin/lottery", map[string]any{"activity": "gacha", "enabled": true, "start": 10,
		"daily": []map[string]int{{"category": 24, "itemId": 1241, "count": 2}}}, admin).
		expect(t, http.StatusOK, "").json(t, &saved)
	if !saved.Custom || !saved.Open || saved.Start == nil || *saved.Start != 10 || len(saved.Daily) != 1 ||
		saved.Daily[0].ItemID != 1241 || len(saved.DefaultDaily) != 2 {
		t.Fatalf("saved %+v", saved)
	}
}
