package api

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

type boxBody struct {
	Entries []store.RewardBoxEntry `json:"entries"`
	Claim   store.RewardBoxClaim   `json:"claim"`
	Account struct {
		Wallet store.Wallet `json:"wallet"`
	} `json:"account"`
}

type questsBody struct {
	Quests []questJSON `json:"quests"`
}

type noticesBody struct {
	Notices   []noticeJSON `json:"notices"`
	RewardBox int          `json:"rewardBox"`
}

func TestMenusNeedLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	for _, path := range []string{"/api/reward-box", "/api/quests", "/api/notices", "/api/riders/x"} {
		h.get(path, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
	h.post("/api/reward-box/claim", map[string]any{"ids": []int{1}}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}

func TestRewardBoxQuestsNoticesAndRiderCard(t *testing.T) {
	clock := newFakeClock(time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC))
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	id, nickname, token := h.messengerUser()
	auth := bearerHeader(token)
	username := "mu_" + strings.TrimPrefix(nickname, "Mu")
	_, adminToken := h.adminUser()
	admin := bearerHeader(adminToken)

	var box boxBody
	h.get("/api/reward-box", auth).expect(t, http.StatusOK, "").json(t, fresh(&box))
	if len(box.Entries) != 0 {
		t.Fatalf("new box %+v", box)
	}
	// Admins file gifts: a currency and an item.
	h.post("/api/admin/reward-box", map[string]any{"username": username, "currency": "lucci", "count": 5000}, auth).
		expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.post("/api/admin/reward-box", map[string]any{"username": username, "currency": "gold", "count": 5}, admin).
		expect(t, http.StatusBadRequest, "INVALID_GIFT")
	h.post("/api/admin/reward-box", map[string]any{"username": username, "currency": "lucci", "count": 5000,
		"message": "测试补偿"}, admin).expect(t, http.StatusOK, "")
	h.post("/api/admin/reward-box", map[string]any{"username": username, "category": 24, "itemId": 1242, "count": 3},
		admin).expect(t, http.StatusOK, "")
	h.get("/api/reward-box", auth).expect(t, http.StatusOK, "").json(t, fresh(&box))
	if len(box.Entries) != 2 || box.Entries[1].Message != "测试补偿" || box.Entries[0].Name != "[活动]光明骑士幸运宝石" ||
		box.Entries[0].ExpiresAt != clock.millis()+store.RewardBoxDays*dayMillis {
		t.Fatalf("box %+v", box.Entries)
	}
	ids := []int64{box.Entries[0].ID, box.Entries[1].ID}
	h.post("/api/reward-box/claim", map[string]any{"ids": ids}, auth).expect(t, http.StatusOK, "").json(t, fresh(&box))
	if len(box.Claim.Claimed) != 2 || len(box.Entries) != 0 || box.Account.Wallet.Lucci < 5000 {
		t.Fatalf("claimed %+v", box)
	}
	h.post("/api/reward-box/claim", map[string]any{"ids": ids}, auth).expect(t, http.StatusNotFound, "REWARD_BOX_EMPTY")
	var gems int
	if err := h.db.QueryRow("SELECT quantity FROM inventory_items WHERE account_id = ? AND category = 24 AND item_id = 1242",
		id).Scan(&gems); err != nil || gems != 3 {
		t.Fatalf("gems %d %v", gems, err)
	}

	// A won individual race counts on the quests; 胜利1回 completes and mails 5 酷币.
	elapsed := 70_000
	if _, _, err := h.api.store.SaveSettlement(context.Background(), store.Settlement{RaceID: "race-" + datatest.Unique(),
		RoomID: "room", Gameplay: "ordinary", TrackID: "village_R01", Snapshot: "{}", CreatedAt: clock.millis(),
		Results: []store.SettledResult{{PlayerID: "p", AccountID: id, Name: nickname, Rank: 1, ElapsedMs: &elapsed,
			DistanceMeters: 5000}}}); err != nil {
		t.Fatal(err)
	}
	var quests questsBody
	h.get("/api/quests", auth).expect(t, http.StatusOK, "").json(t, &quests)
	values := map[int]questJSON{}
	for _, q := range quests.Quests {
		values[q.ID] = q
	}
	if values[9001].Value != 1 || values[9002].Value != 1 || values[9003].CompletedAt == 0 || values[9004].Value != 1 ||
		values[9005].Value != 0 || values[9006].Value != 50 || values[9201].Value != 50 || !values[9202].Locked ||
		values[9001].PeriodEnd-values[9001].PeriodStart != dayMillis {
		t.Fatalf("quests %+v", values)
	}
	h.get("/api/reward-box", auth).expect(t, http.StatusOK, "").json(t, fresh(&box))
	if len(box.Entries) != 1 || box.Entries[0].Currency != "koin" || box.Entries[0].Count != 5 ||
		box.Entries[0].Source != store.BoxSourceQuest {
		t.Fatalf("quest reward %+v", box.Entries)
	}
	// The next day (after 06:00 Beijing) the daily quests start over.
	clock.advance(24 * time.Hour)
	h.get("/api/quests", auth).expect(t, http.StatusOK, "").json(t, fresh(&quests))
	for _, q := range quests.Quests {
		if q.ID == 9003 && q.CompletedAt != 0 || q.ID == 9201 && q.Value != 50 {
			t.Fatalf("next day %+v", q)
		}
	}

	// Notices: the waiting reward and the admin's notice.
	var notices noticesBody
	h.get("/api/notices", auth).expect(t, http.StatusOK, "").json(t, &notices)
	if notices.RewardBox != 1 || len(notices.Notices) == 0 || notices.Notices[0].Kind != "rewardBox" {
		t.Fatalf("notices %+v", notices)
	}
	h.put("/api/admin/notices", map[string]any{"title": "维护公告", "message": "今晚22点维护"}, auth).
		expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.put("/api/admin/notices", map[string]any{"title": "", "message": "x"}, admin).expect(t, http.StatusBadRequest, "INVALID_NOTICE")
	var saved struct{ ID int64 }
	h.put("/api/admin/notices", map[string]any{"title": "维护公告", "message": "今晚22点维护"}, admin).
		expect(t, http.StatusOK, "").json(t, &saved)
	t.Cleanup(func() { datatest.Exec(t, h.db, "DELETE FROM notices WHERE id = ?", saved.ID) })
	h.get("/api/notices", auth).expect(t, http.StatusOK, "").json(t, fresh(&notices))
	if last := notices.Notices[len(notices.Notices)-1]; last.Title != "维护公告" || last.Kind != "notice" {
		t.Fatalf("admin notice %+v", notices.Notices)
	}
	send(t, http.MethodDelete, h.public.URL+"/api/admin/notices/"+strconv.FormatInt(saved.ID, 10), nil, admin).expect(t, http.StatusOK, "")
	send(t, http.MethodDelete, h.public.URL+"/api/admin/notices/"+strconv.FormatInt(saved.ID, 10), nil, admin).expect(t, http.StatusNotFound, "NOTICE_NOT_FOUND")

	// 查找车手.
	var card struct {
		Nickname string       `json:"nickname"`
		Progress progressJSON `json:"progress"`
		Presence string       `json:"presence"`
		Self     bool         `json:"self"`
		Stats    store.SummaryStats
	}
	h.get("/api/riders/"+nickname, admin).expect(t, http.StatusOK, "").json(t, &card)
	if card.Nickname != nickname || card.Progress.Level < 1 || card.Presence != "offline" || card.Self ||
		card.Stats.Races != 1 {
		t.Fatalf("card %+v", card)
	}
	h.get("/api/riders/nobody-"+datatest.Unique(), admin).expect(t, http.StatusNotFound, "UNKNOWN_RIDER")
}
