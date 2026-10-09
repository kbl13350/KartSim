package api

import (
	"net/http"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/license"
	"kartsim/internal/data/store"
)

type licenseBody struct {
	Table struct {
		Licenses []license.License `json:"licenses"`
		Pro      license.ProRules  `json:"pro"`
		Rewards  map[string]string `json:"rewards"`
	} `json:"table"`
	State store.LicenseView `json:"state"`
}

type licenseRunBody struct {
	Run     store.LicenseRun     `json:"run"`
	State   store.LicenseView    `json:"state"`
	License store.LicenseUpgrade `json:"license"`
	Account struct {
		Progress progressJSON `json:"progress"`
		Wallet   store.Wallet `json:"wallet"`
	} `json:"account"`
}

// fresh zeroes a body before decoding into it (omitted fields stay unset).
func fresh[T any](body *T) *T {
	var zero T
	*body = zero
	return body
}

func TestLicenseNeedsLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.get("/api/license", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	for _, path := range []string{"/api/license/run", "/api/license/take", "/api/license/qualify",
		"/api/license/emblem"} {
		h.post(path, map[string]any{}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
}

func TestLicenseAPI(t *testing.T) {
	clock := newFakeClock(time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC))
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	id, _, token := h.messengerUser()
	auth := bearerHeader(token)
	data, err := license.Default()
	if err != nil {
		t.Fatal(err)
	}

	var state licenseBody
	h.get("/api/license", auth).expect(t, http.StatusOK, "").json(t, &state)
	if len(state.Table.Licenses) != 6 || state.Table.Rewards["10802"] == "" || state.State.BaseLevel != 0 ||
		state.State.Level != 0 || state.State.TryLevel != 1 || state.State.Qualified || len(state.State.ProSteps) != 2 ||
		state.State.Period != "2026-09" {
		t.Fatalf("state %+v", state.State)
	}

	run := func(step int, elapsed int64) response {
		clock.advance(time.Duration(elapsed+1000) * time.Millisecond)
		return h.post("/api/license/run", map[string]any{"requestId": newUUID(), "step": step, "elapsedMs": elapsed}, auth)
	}
	// The steps open one after another.
	run(2, 9000).expect(t, http.StatusConflict, "LICENSE_LOCKED")
	var body licenseRunBody
	run(1, 30000).expect(t, http.StatusOK, "").json(t, fresh(&body))
	if !body.Run.First || body.Run.Reward == nil || body.Run.Reward.StockID != 10802 ||
		len(body.Run.Reward.Items) != 1 || body.Run.Reward.Items[0].ItemID != 16 || len(body.State.Cleared) != 1 {
		t.Fatalf("step 1 %+v", body)
	}
	var count int
	h.db.QueryRow("SELECT quantity FROM inventory_items WHERE account_id = ? AND category = 29 AND item_id = 16",
		id).Scan(&count)
	if count != 1 {
		t.Fatalf("5千金币卡 x%d", count)
	}
	// A replay answers the original; a faster run only improves the best.
	requestID := newUUID()
	clock.advance(time.Minute)
	h.post("/api/license/run", map[string]any{"requestId": requestID, "step": 1, "elapsedMs": 20000}, auth).
		expect(t, http.StatusOK, "").json(t, fresh(&body))
	if body.Run.First || !body.Run.NewBest || body.Run.BestMs != 20000 || body.Run.Reward != nil {
		t.Fatalf("rerun %+v", body.Run)
	}
	h.post("/api/license/run", map[string]any{"requestId": requestID, "step": 1, "elapsedMs": 20000}, auth).
		expect(t, http.StatusOK, "").json(t, fresh(&body))
	if !body.Run.NewBest || body.Run.BestMs != 20000 {
		t.Fatalf("replay %+v", body.Run)
	}
	h.post("/api/license/run", map[string]any{"requestId": requestID, "step": 2, "elapsedMs": 20000}, auth).
		expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	// Runs keep the pace of the clock.
	h.post("/api/license/run", map[string]any{"requestId": newUUID(), "step": 2, "elapsedMs": 9000}, auth).
		expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	run(2, 50000).expect(t, http.StatusOK, "")
	// 弯道练习 1 has 13 s.
	run(3, 13001).expect(t, http.StatusConflict, "MISSION_FAILED")
	run(3, 12000).expect(t, http.StatusOK, "")
	run(99, 12000).expect(t, http.StatusBadRequest, "INVALID_STEP")
	run(4, 1).expect(t, http.StatusBadRequest, "INVALID_ELAPSED_MS")

	h.post("/api/license/take", map[string]int{"level": 1}, auth).expect(t, http.StatusConflict, "LICENSE_INCOMPLETE")
	for _, step := range []int{4, 5, 6} {
		run(step, 20000).expect(t, http.StatusOK, "")
	}
	h.post("/api/license/take", map[string]int{"level": 2}, auth).expect(t, http.StatusConflict, "LICENSE_LOCKED")
	h.post("/api/license/take", map[string]int{"level": 1}, auth).expect(t, http.StatusOK, "").json(t, fresh(&body))
	if body.License.Level != 1 || body.State.BaseLevel != 1 || body.Account.Progress.License != 1 {
		t.Fatalf("take 新手 %+v", body)
	}
	h.post("/api/license/take", map[string]int{"level": 1}, auth).expect(t, http.StatusConflict, "LICENSE_HELD")
	// A yellow glove may not try 初级.
	run(7, 15000).expect(t, http.StatusConflict, "LICENSE_LOCKED")

	// L2 steps pay koin; PRO needs L1 and the qualification.
	datatest.Exec(t, h.db, "UPDATE account_progress SET exp = 100000000, level = 60 WHERE account_id = ?", id)
	datatest.Exec(t, h.db, "UPDATE license_state SET level = 3 WHERE account_id = ?", id)
	run(19, 30000).expect(t, http.StatusOK, "").json(t, fresh(&body))
	if body.Run.Reward == nil || body.Run.Reward.Items[0].Currency != "koin" || body.Account.Wallet.Koin < 20 ||
		body.State.TryLevel != 5 {
		t.Fatalf("step 19 %+v", body)
	}
	duel, _, _, _ := data.Step(21)
	run(20, 60000).expect(t, http.StatusOK, "")
	run(21, duel.RivalMs).expect(t, http.StatusConflict, "MISSION_FAILED")
	run(21, duel.RivalMs-1).expect(t, http.StatusOK, "")

	set := data.ProSet(license.ProPeriodAt(clock.millis()))
	run(set[0].Step, 60000).expect(t, http.StatusConflict, "LICENSE_LOCKED")
	qualify := func(track string, elapsed int64) response {
		clock.advance(time.Duration(elapsed+1000) * time.Millisecond)
		return h.post("/api/license/qualify", map[string]any{"requestId": newUUID(), "track": track,
			"elapsedMs": elapsed}, auth)
	}
	qualify("mine_R01", 70000).expect(t, http.StatusConflict, "LICENSE_LOCKED")
	datatest.Exec(t, h.db, "UPDATE license_state SET level = 5 WHERE account_id = ?", id)
	run(set[0].Step, 60000).expect(t, http.StatusConflict, "PRO_NOT_QUALIFIED")
	qualify("village_R01", 70000).expect(t, http.StatusBadRequest, "INVALID_TRACK")
	for _, q := range data.Pro.Qualify {
		qualify(q.Track, q.TimeMs+1).expect(t, http.StatusOK, "")
	}
	h.post("/api/license/emblem", map[string]any{}, auth).expect(t, http.StatusConflict, "PRO_NOT_QUALIFIED")
	for _, q := range data.Pro.Qualify {
		qualify(q.Track, q.TimeMs).expect(t, http.StatusOK, "")
	}
	h.post("/api/license/emblem", map[string]any{}, auth).expect(t, http.StatusOK, "").json(t, fresh(&body))
	if !body.State.Qualified || len(body.State.Records) != 3 {
		t.Fatalf("emblem %+v", body.State)
	}
	h.post("/api/license/take", map[string]int{"level": 6}, auth).expect(t, http.StatusConflict, "LICENSE_INCOMPLETE")
	other := 31
	if set[0].Step == 31 {
		other = 33
	}
	run(other, 60000).expect(t, http.StatusConflict, "LICENSE_LOCKED")
	run(set[0].Step, set[0].TimeMs).expect(t, http.StatusOK, "")
	run(set[1].Step, set[1].RivalMs-1).expect(t, http.StatusOK, "")
	h.post("/api/license/take", map[string]int{"level": 6}, auth).expect(t, http.StatusOK, "").json(t, fresh(&body))
	if body.License.Level != license.Pro || body.State.Level != license.Pro || body.State.ProCount != 1 ||
		body.State.ProUntil != clock.millis()+license.ProDays*24*3600*1000 || body.Account.Progress.License != license.Pro {
		t.Fatalf("take PRO %+v", body)
	}
	h.post("/api/license/take", map[string]int{"level": 6}, auth).expect(t, http.StatusConflict, "LICENSE_HELD")
	var counters struct{ level, pro int64 }
	h.db.QueryRow(`SELECT
		(SELECT value FROM account_counters WHERE account_id = ? AND counter = 'license.level'),
		(SELECT value FROM account_counters WHERE account_id = ? AND counter = 'license.pro')`, id, id).
		Scan(&counters.level, &counters.pro)
	if counters.level != 6 || counters.pro != 1 {
		t.Fatalf("counters %+v", counters)
	}

	// The next period brings the next set; PRO lapses after 90 days.
	clock.advance(license.ProDays * 24 * time.Hour)
	h.get("/api/license", auth).expect(t, http.StatusOK, "").json(t, &state)
	if state.State.Level != license.L1 || state.State.Period == "2026-09" || len(state.State.Cleared) == 0 {
		t.Fatalf("after 90 days %+v", state.State)
	}
	for _, clear := range state.State.Cleared {
		if clear.Step > 30 {
			t.Fatalf("an old period's PRO step is listed: %+v", clear)
		}
	}
}
