package api

// Regression tests for the economy review findings (F1-F8, E1, E2, E6 and
// the shop price check). The MySQL tests need KART_TEST_MYSQL_DSN.

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

// logRecorder captures the API's log records as JSON lines.
type logRecorder struct {
	mu     sync.Mutex
	buffer bytes.Buffer
}

func (l *logRecorder) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.buffer.Write(p)
}

func (l *logRecorder) records(t *testing.T) []map[string]any {
	t.Helper()
	l.mu.Lock()
	defer l.mu.Unlock()
	var records []map[string]any
	scanner := bufio.NewScanner(bytes.NewReader(l.buffer.Bytes()))
	for scanner.Scan() {
		var record map[string]any
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
			t.Fatal(err)
		}
		records = append(records, record)
	}
	return records
}

func (l *logRecorder) reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.buffer.Reset()
}

// invites returns the invite codes the records logged.
func (l *logRecorder) invites(t *testing.T) []string {
	t.Helper()
	var codes []string
	for _, record := range l.records(t) {
		if code, ok := record["invite"].(string); ok {
			codes = append(codes, code)
		}
	}
	return codes
}

func recordLogs(h *harness) *logRecorder {
	recorder := &logRecorder{}
	h.api.log = slog.New(slog.NewJSONHandler(recorder, &slog.HandlerOptions{Level: slog.LevelDebug}))
	return recorder
}

// F1 (review R1): the daily race caps are keyed by the data service's own
// Beijing day; a node-supplied finish time cannot open a fresh cap.
func TestBackdatedSettlementsCannotBypassTheDailyCap(t *testing.T) {
	clock := newFakeClock(economyNoon) // 12:00 Beijing time
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	b := h.account("bd_"+u, "Bd"+u, password, false)
	h.setWallet(b, store.Wallet{})
	h.setExp(b, 2600) // inside level 10 [2500, 3200): no level-up lucci below
	today := rewards.BeijingDay(clock.now())
	yesterday := rewards.BeijingDay(clock.now().Add(-24 * time.Hour))
	reward := contract.RaceReward{PlayerID: "p", AccountID: b, Exp: 100, Lucci: 200}

	h.settle(raceWithRewards("bd-"+u+"-today", clock.millis(), reward))
	if wallet := h.wallet(b); wallet.Lucci != 200 {
		t.Fatalf("today %+v", wallet)
	}
	// Today's cap is reached.
	datatest.Exec(t, h.db, "UPDATE daily_rewards SET exp = ?, lucci = ? WHERE account_id = ? AND day = ? AND kind = 'race'",
		rewards.DailyRaceExpCap, rewards.DailyRaceLucciCap, b, today)
	// The same real moment, finish times backdated by 23 h (within the 24 h
	// window, but yesterday in Beijing) and by 1-10 days: before the fix each
	// past day had a fresh cap of its own.
	h.settle(raceWithRewards("bd-"+u+"-23h", clock.millis()-23*3600*1000, reward))
	for k := 1; k <= 10; k++ {
		for i := range 3 {
			h.settle(raceWithRewards(fmt.Sprintf("bd-%s-back%d-%d", u, k, i), clock.millis()-int64(k)*24*3600*1000, reward))
		}
	}
	if wallet := h.wallet(b); wallet.Lucci != 200 {
		t.Fatalf("backdated settlements credited past today's cap: %+v", wallet)
	}
	if n := h.count("SELECT COUNT(*) FROM daily_rewards WHERE account_id = ? AND day <> ?", b, today); n != 0 {
		t.Fatalf("%d daily counters for other days (e.g. %s)", n, yesterday)
	}
	// The races themselves are stored with their own times.
	if n := h.count("SELECT COUNT(*) FROM race_outcomes WHERE race_id LIKE ?", "bd-"+u+"-%"); n != 32 {
		t.Fatalf("%d races stored", n)
	}
	var created int64
	if err := h.db.QueryRow("SELECT created_at FROM race_outcomes WHERE race_id = ?", "bd-"+u+"-23h").Scan(&created); err != nil ||
		created != clock.millis()-23*3600*1000 {
		t.Fatalf("backdated race stored at %d, %v", created, err)
	}

	// The next day: a race finished within 24 h is credited against the new
	// day; one that finished longer ago is stored without any credit.
	clock.advance(24 * time.Hour)
	h.settle(raceWithRewards("bd-"+u+"-fresh", clock.millis()-23*3600*1000, reward))
	if wallet := h.wallet(b); wallet.Lucci != 400 {
		t.Fatalf("a delivery within 24 h was not credited: %+v", wallet)
	}
	stale := h.settle(raceWithRewards("bd-"+u+"-stale", clock.millis()-24*3600*1000-1, reward))
	if !stale.Stored || stale.Duplicate {
		t.Fatalf("stale settlement %+v", stale)
	}
	if wallet := h.wallet(b); wallet.Lucci != 400 {
		t.Fatalf("a settlement older than 24 h was credited: %+v", wallet)
	}
	if n := h.count("SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND ref_id = ?", b, "bd-"+u+"-stale"); n != 0 {
		t.Fatalf("%d ledger rows for the stale race", n)
	}
	if n := h.count("SELECT COUNT(*) FROM race_results WHERE race_id = ?", "bd-"+u+"-stale"); n != 1 {
		t.Fatalf("stale race results not stored: %d", n)
	}
}

// F1: one reward entry may not exceed what the formulas can give one racer.
func TestRaceRewardCapIsTheFormulaMaximum(t *testing.T) {
	// 8 racers, winner of the winning team in a Combine channel:
	// exp round((30+50+30) x 1.1 x 1.2) = 145, lucci (40+80+60) x 1.2 = 216.
	if maxRaceReward != (rewards.Reward{Exp: 145, Lucci: 216}) {
		t.Fatalf("maxRaceReward %+v", maxRaceReward)
	}
}

func TestRaceRewardsAboveTheFormulaMaximumAreDropped(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	ids := make([]string, 3)
	for i := range ids {
		ids[i] = h.account(fmt.Sprintf("mx%d_%s", i, u), fmt.Sprintf("Mx%d%s", i, u), password, false)
		h.setWallet(ids[i], store.Wallet{})
	}
	h.settle(raceWithRewards("mx-"+u, clock.millis(),
		contract.RaceReward{PlayerID: "p0", AccountID: ids[0], Exp: 145, Lucci: 216},
		contract.RaceReward{PlayerID: "p1", AccountID: ids[1], Exp: 146, Lucci: 10},
		contract.RaceReward{PlayerID: "p2", AccountID: ids[2], Exp: 10, Lucci: 217}))
	if wallet := h.wallet(ids[0]); wallet.Lucci != 216+200 { // 145 exp reach level 2: 200 lucci
		t.Fatalf("maximum reward %+v", wallet)
	}
	for _, id := range ids[1:] {
		if wallet := h.wallet(id); wallet.Lucci != 0 {
			t.Fatalf("oversized reward credited: %+v", wallet)
		}
	}
}

// E6: rewards are credited with the rates the node reports it showed,
// within [0, max(10, configured)], else with the configured rates.
func TestSettlementRatesAreUsedWithinRange(t *testing.T) {
	clock := newFakeClock(economyNoon)
	configured := rewards.Rates{Exp: 1.5, Lucci: 2}
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now, rates: &configured})
	u := datatest.Unique()
	rate := func(value float64) *float64 { return &value }
	for i, tc := range []struct {
		exp, lucci         *float64
		wantExp, wantLucci int64
	}{
		{rate(3), rate(0.5), 135, 17},     // 45 x 3, 33 x 0.5 = 16.5 rounds up
		{nil, nil, 68, 66},                // configured: 67.5 rounds up, 66
		{rate(11), rate(-1), 68, 66},      // out of range: configured
		{rate(0), rate(10), 0, 330},       // the bounds themselves are allowed
		{rate(1.5), rate(2.0001), 68, 66}, // configured exp; lucci 66.0033 rounds to 66
	} {
		id := h.account(fmt.Sprintf("rt%d_%s", i, u), fmt.Sprintf("Rt%d%s", i, u), password, false)
		h.setWallet(id, store.Wallet{})
		race := raceWithRewards(fmt.Sprintf("rt-%s-%d", u, i), clock.millis(),
			contract.RaceReward{PlayerID: "p", AccountID: id, Exp: 45, Lucci: 33})
		race.ExpRate, race.LucciRate = tc.exp, tc.lucci
		h.settle(race)
		if exp := h.count("SELECT COALESCE(SUM(delta), 0) FROM exp_ledger WHERE account_id = ? AND reason = 'race'", id); int64(exp) != tc.wantExp {
			t.Errorf("case %d: exp %d, want %d", i, exp, tc.wantExp)
		}
		if lucci := h.count("SELECT COALESCE(SUM(delta), 0) FROM wallet_ledger WHERE account_id = ? AND reason = 'race'", id); int64(lucci) != tc.wantLucci {
			t.Errorf("case %d: lucci %d, want %d", i, lucci, tc.wantLucci)
		}
	}
	// A configured rate above 10 is itself allowed.
	high := rewards.Rates{Exp: 20, Lucci: 1}
	h2 := newHarness(t, harnessOptions{mysql: true, now: clock.now, rates: &high})
	id := h2.account("rth_"+u, "Rth"+u, password, false)
	race := raceWithRewards("rt-"+u+"-high", clock.millis(), contract.RaceReward{PlayerID: "p", AccountID: id, Exp: 10, Lucci: 10})
	race.ExpRate = rate(15)
	h2.settle(race)
	if exp := h2.count("SELECT COALESCE(SUM(delta), 0) FROM exp_ledger WHERE account_id = ? AND reason = 'race'", id); exp != 150 {
		t.Fatalf("high rate: exp %d", exp)
	}
}

// E1: one account counts once per race, with its best ranked result.
func TestSettlementCountsAnAccountOnce(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id := h.account("once_"+u, "Once"+u, password, false)
	h.setWallet(id, store.Wallet{})
	race := raceWithRewards("once-"+u, clock.millis(),
		contract.RaceReward{PlayerID: "s3", AccountID: id, Exp: 40, Lucci: 50},
		contract.RaceReward{PlayerID: "s2", AccountID: id, Exp: 60, Lucci: 70})
	race.Results = []contract.RaceResult{
		{PlayerID: "g1", Name: "Guest" + u, Rank: 1, ElapsedMs: elapsed(60_000), Points: 10},
		{PlayerID: "s4", AccountID: id, Name: "Once" + u, Rank: 4, ElapsedMs: nil, Points: 0},
		{PlayerID: "s2", AccountID: id, Name: "Once" + u, Rank: 2, ElapsedMs: elapsed(61_000), Points: 8},
		{PlayerID: "s3", AccountID: id, Name: "Once" + u, Rank: 3, ElapsedMs: elapsed(62_000), Points: 6},
	}
	h.settle(race)
	var player string
	var rank int
	if err := h.db.QueryRow("SELECT player_id, `rank` FROM race_results WHERE race_id = ? AND account_id = ?", race.RaceID, id).
		Scan(&player, &rank); err != nil || player != "s2" || rank != 2 {
		t.Fatalf("kept %s rank %d, %v", player, rank, err)
	}
	if n := h.count("SELECT COUNT(*) FROM race_results WHERE race_id = ?", race.RaceID); n != 2 {
		t.Fatalf("%d result rows, want the guest and one for the account", n)
	}
	var races, wins, podiums, points int
	if err := h.db.QueryRow("SELECT races, wins, podiums, points FROM player_stats WHERE account_id = ?", id).
		Scan(&races, &wins, &podiums, &points); err != nil || races != 1 || wins != 0 || podiums != 1 || points != 8 {
		t.Fatalf("stats %d %d %d %d %v", races, wins, podiums, points, err)
	}
	if wallet := h.wallet(id); wallet.Lucci != 50 { // the first reward entry only
		t.Fatalf("wallet %+v", wallet)
	}
}

// E1: one account has at most one live session cluster-wide.
func TestAccountHasOneLiveSession(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	heartbeat := func(node string, startedAt int64, players ...contract.OnlinePlayer) {
		t.Helper()
		if players == nil {
			players = []contract.OnlinePlayer{}
		}
		h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: node, Name: node, Capacity: 10, Players: players,
			StartedAt: startedAt, ProtocolVersion: contract.ProtocolVersion}).expect(t, http.StatusOK, "")
	}
	claim := func(node, player, name, account string) response {
		return h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: node, PlayerID: player, Name: name,
			AccountID: account})
	}
	release := func(node, player, name, account string) {
		t.Helper()
		h.call(contract.PathPresenceRelease, contract.PresenceReleaseRequest{NodeID: node, PlayerID: player, Name: name,
			AccountID: account}).expect(t, http.StatusOK, "")
	}
	heartbeat("game-a", 1)
	heartbeat("game-b", 1)
	account, other := newUUID(), newUUID()

	claim("game-a", "p1", "Alice", account).expect(t, http.StatusOK, "")
	claim("game-a", "p1", "Alice", account).expect(t, http.StatusOK, "") // the same session again
	claim("game-b", "p2", "Alice", account).expect(t, http.StatusConflict, "ACCOUNT_ONLINE")
	claim("game-b", "p2", "Renamed", account).expect(t, http.StatusConflict, "ACCOUNT_ONLINE") // also after a rename
	claim("game-a", "p3", "Third", account).expect(t, http.StatusConflict, "ACCOUNT_ONLINE")   // also on the same node
	// A refused claim reserved nothing: its name is still free.
	claim("game-b", "p9", "Renamed", other).expect(t, http.StatusOK, "")
	release("game-b", "p9", "Renamed", other)
	// Guests and names keep their rules.
	claim("game-b", "p2", "ALICE", "").expect(t, http.StatusConflict, "NICKNAME_TAKEN")
	claim("game-b", "p2", "x", "not an id").expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_ID")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "game-b", PlayerID: "p2", Name: "Gx",
		Guest: true, AccountID: account}).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_ID")
	h.call(contract.PathPresenceRelease, contract.PresenceReleaseRequest{NodeID: "game-b", PlayerID: "p2", Name: "x",
		AccountID: "not an id"}).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_ID")

	// Releasing frees the account.
	release("game-a", "p1", "Alice", account)
	claim("game-b", "p2", "Renamed", account).expect(t, http.StatusOK, "")
	// A release without the account id (an older node) frees it too.
	release("game-b", "p2", "Renamed", "")
	claim("game-a", "p4", "Fourth", account).expect(t, http.StatusOK, "")

	// Heartbeats listing the session keep the account claimed past PresenceTTL.
	for range 4 {
		h.redis.FastForward(10 * time.Second)
		heartbeat("game-a", 1, contract.OnlinePlayer{PlayerID: "p4", Name: "Fourth"})
		heartbeat("game-b", 1)
	}
	claim("game-b", "p5", "Fifth", account).expect(t, http.StatusConflict, "ACCOUNT_ONLINE")
	// Leaving frees the node's accounts at once.
	h.call(contract.PathNodeLeave, contract.NodeLeaveRequest{NodeID: "game-a"}).expect(t, http.StatusOK, "")
	claim("game-b", "p5", "Fifth", account).expect(t, http.StatusOK, "")
	// The claim of a node that stopped heartbeating is taken over.
	h.redis.FastForward(16 * time.Second)
	heartbeat("game-a", 2)
	claim("game-a", "p6", "Sixth", account).expect(t, http.StatusOK, "")
}

// E2: a positive ownership answer carries the earliest rental expiry.
func TestEquipmentVerifyReportsValidUntil(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("vu_"+u, "Vu"+u)
	h.claimStarter(token, 2, 6, 4)
	equipment := func(set map[string]int) json.RawMessage {
		ids := map[string]int{}
		for _, slot := range equipmentSlots {
			ids[fmt.Sprint(slot)] = 0
		}
		ids["1"], ids["2"], ids["70"] = 2, 6, 4
		doc := map[string]any{"kartSerial": 0, "exceedType": 0, "valueAt3E": 0, "systemKart": "practiceKart"}
		for slot, item := range set {
			ids[slot] = item
		}
		if set["3"] != 0 {
			delete(doc, "systemKart")
		}
		doc["itemIds"] = ids
		raw, _ := json.Marshal(doc)
		return raw
	}
	verify := func(set map[string]int) (*int64, response) {
		t.Helper()
		r := h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: id, Equipment: equipment(set)})
		if r.status != http.StatusOK {
			return nil, r
		}
		var body contract.EquipmentVerifyResponse
		r.json(t, &body)
		if !body.OK {
			t.Fatalf("verify %s", r.body)
		}
		return body.ValidUntil, r
	}
	// Starter items are permanent: no validUntil at all.
	if until, r := verify(nil); until != nil || strings.Contains(string(r.body), "validUntil") {
		t.Fatalf("permanent equipment: %s", r.body)
	}
	now := clock.millis()
	for _, item := range []struct {
		category, itemID int
		expires          any
	}{{3, 387, now + 60_000}, {9, 1, now + 30_000}, {1, 1, nil}} {
		datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at,
			source, created_at, updated_at) VALUES(?, ?, ?, '', 1, ?, 'shop', 0, 0)`, id, item.category, item.itemID, item.expires)
	}
	if until, r := verify(map[string]int{"3": 387}); until == nil || *until != now+60_000 {
		t.Fatalf("rented kart: %s", r.body)
	}
	if until, r := verify(map[string]int{"3": 387, "9": 1, "1": 1}); until == nil || *until != now+30_000 {
		t.Fatalf("earliest expiry: %s", r.body)
	}
	if until, r := verify(map[string]int{"1": 1}); until != nil {
		t.Fatalf("permanent character: %s", r.body)
	}
	clock.advance(30 * time.Second)
	if _, r := verify(map[string]int{"3": 387, "9": 1}); r.status != http.StatusConflict {
		t.Fatalf("expired balloon accepted: %s", r.body)
	}
	if until, r := verify(map[string]int{"3": 387}); until == nil || *until != now+60_000 {
		t.Fatalf("kart after the balloon expired: %s", r.body)
	}
}

// Shop price check: what the player was shown must still be the price.
func TestPurchaseRefusesChangedPrices(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	id, token := h.register("pc_"+u, "Pc"+u)
	_, offer := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return item.IsAdditional && offer.Currency == economy.Lucci && offer.MinExp == 0 && offer.Price <= 2_000
	})
	purchase := func(fields map[string]any) response {
		fields["offerId"] = offer.OfferID
		return h.post("/api/shop/purchase", fields, bearerHeader(token))
	}
	request := uuid()
	purchase(map[string]any{"requestId": request, "expectedPrice": offer.Price + 1}).
		expect(t, http.StatusConflict, "PRICE_CHANGED")
	purchase(map[string]any{"requestId": request, "expectedPrice": offer.Price, "expectedCurrency": "coupon"}).
		expect(t, http.StatusConflict, "PRICE_CHANGED")
	purchase(map[string]any{"requestId": uuid(), "expectedPrice": "100"}).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	if wallet := h.wallet(id); wallet.Lucci != 10_000 {
		t.Fatalf("a refused purchase charged: %+v", wallet)
	}
	if n := h.count("SELECT COUNT(*) FROM purchases WHERE account_id = ?", id); n != 0 {
		t.Fatalf("%d purchases stored", n)
	}
	var bought, replay store.PurchaseResult
	purchase(map[string]any{"requestId": request, "expectedPrice": offer.Price, "expectedCurrency": "lucci"}).
		expect(t, http.StatusOK, "").json(t, &bought)
	// A retry of the stored purchase answers the original even if the price changed meanwhile.
	purchase(map[string]any{"requestId": request, "expectedPrice": offer.Price + 1}).expect(t, http.StatusOK, "").json(t, &replay)
	if replay.PurchaseID != bought.PurchaseID || bought.Wallet.Lucci != 10_000-offer.Price {
		t.Fatalf("bought %+v replay %+v", bought, replay)
	}
	// Without the fields (or with null) nothing is checked.
	purchase(map[string]any{"requestId": uuid(), "expectedPrice": nil}).expect(t, http.StatusOK, "")
}

// F3 (review R3): unknown tracks are refused; past the daily reward cap
// runs are no longer stored; a retry still gets its original answer.
func TestTimeAttackStoresOnlyRewardedRuns(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("tr_"+u, "Tr"+u)
	type settled struct {
		Exp, Lucci int64
		NewRecord  bool
		Capped     bool
		BestMs     int64
	}
	settle := func(track string, ms int64, request string) response {
		return h.post("/api/timeattack/settle", map[string]any{"trackId": track, "elapsedMs": ms, "requestId": request},
			bearerHeader(token))
	}
	run := func(track string, ms int64, request string) settled {
		t.Helper()
		clock.advance(time.Duration(ms) * time.Millisecond)
		var body settled
		settle(track, ms, request).expect(t, http.StatusOK, "").json(t, &body)
		return body
	}
	for i := range 20 {
		clock.advance(time.Minute)
		settle(fmt.Sprintf("junk-track-%s-%d", u, i), 10_000, uuid()).expect(t, http.StatusBadRequest, "INVALID_TRACK")
	}
	if bests, runs := h.count("SELECT COUNT(*) FROM timeattack_bests WHERE account_id = ?", id),
		h.count("SELECT COUNT(*) FROM timeattack_runs WHERE account_id = ?", id); bests != 0 || runs != 0 {
		t.Fatalf("junk tracks stored %d bests, %d runs", bests, runs)
	}

	firstRequest := uuid()
	first := run("village_R01", 60_000, firstRequest)
	datatest.Exec(t, h.db, "UPDATE daily_rewards SET count = ? WHERE account_id = ? AND kind = 'timeattack'",
		rewards.DailyTimeAttackRewardRuns-1, id)
	if last := run("forest_R02", 60_000, uuid()); last.Capped {
		t.Fatalf("the 50th run was capped: %+v", last)
	}
	tracks := []string{"village_R01", "forest_R02", "village_R01_rvs", "desert_R01"}
	for i := range 30 {
		if capped := run(tracks[i%len(tracks)], int64(50_000-i), uuid()); !capped.Capped || capped.Exp != 0 {
			t.Fatalf("run past the cap %+v", capped)
		}
	}
	if runs := h.count("SELECT COUNT(*) FROM timeattack_runs WHERE account_id = ?", id); runs != 2 {
		t.Fatalf("%d runs stored, want the 2 rewarded ones", runs)
	}
	if bests := h.count("SELECT COUNT(*) FROM timeattack_bests WHERE account_id = ?", id); bests != len(tracks) {
		t.Fatalf("%d bests", bests)
	}
	// A retry of the latest (capped) run answers it again at once, not 429.
	request := uuid()
	latest := run("desert_R01", 40_000, request)
	var retried settled
	settle("desert_R01", 40_000, request).expect(t, http.StatusOK, "").json(t, &retried)
	if retried != latest || !latest.Capped || !latest.NewRecord {
		t.Fatalf("latest %+v retried %+v", latest, retried)
	}
	settle("desert_R01", 41_000, request).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	// A rewarded run is answered from its stored row, also after later runs.
	var again settled
	settle("village_R01", 60_000, firstRequest).expect(t, http.StatusOK, "").json(t, &again)
	if again != first {
		t.Fatalf("first %+v replay %+v", first, again)
	}
}

// F3: a run is accepted only when the account had the time to drive it
// since its previous settled run.
func TestTimeAttackRunsNeedTheirDrivingTime(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	_, token := h.register("tl_"+u, "Tl"+u)
	settle := func(ms int64) response {
		return h.post("/api/timeattack/settle", map[string]any{"trackId": "village_R01", "elapsedMs": ms, "requestId": uuid()},
			bearerHeader(token))
	}
	settle(60_000).expect(t, http.StatusOK, "")
	clock.advance(20 * time.Second)
	settle(30_000).expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	clock.advance(7 * time.Second) // 27 s = 30 s minus the 3 s tolerance
	settle(30_000).expect(t, http.StatusOK, "")
	clock.advance(rewards.MinTimeAttackMs*time.Millisecond - time.Millisecond)
	settle(10_000).expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	clock.advance(time.Millisecond)
	settle(10_000).expect(t, http.StatusOK, "")

	// Of a burst of runs at once, one is accepted.
	clock.advance(time.Minute)
	var wg sync.WaitGroup
	var mu sync.Mutex
	statuses := map[int]int{}
	for range 8 {
		wg.Go(func() {
			r := send(t, http.MethodPost, h.public.URL+"/api/timeattack/settle",
				map[string]any{"trackId": "village_R01", "elapsedMs": 10_000, "requestId": uuid()}, bearerHeader(token))
			mu.Lock()
			statuses[r.status]++
			mu.Unlock()
		})
	}
	wg.Wait()
	if statuses[http.StatusOK] != 1 || statuses[http.StatusTooManyRequests] != 7 {
		t.Fatalf("burst statuses %v", statuses)
	}
}

// F2 (review R2): a KART_ADMIN_USERNAMES name without an account cannot be
// squatted under open registration; Bootstrap logs an invite for it.
func TestListedAdminNamesNeedAnInvite(t *testing.T) {
	u := datatest.Unique()
	admin, present := "admin_"+u, "present_"+u
	h := newHarness(t, harnessOptions{mysql: true, admins: []string{strings.ToUpper(admin), present}})
	logs := recordLogs(h)
	h.account(present, "Present"+u, password, false)
	t.Cleanup(func() { datatest.Exec(t, h.db, "DELETE FROM accounts WHERE username = ?", admin) })

	for _, invite := range []any{nil, "", "not-an-invite-" + u} {
		fields := map[string]any{"username": "ADMIN_" + u, "nickname": "Squat" + u, "password": password}
		if invite != nil {
			fields["invite"] = invite
		}
		h.post("/multiplayer/auth/register", fields, nil).expect(t, http.StatusBadRequest, "INVALID_INVITE")
	}
	if n := h.count("SELECT COUNT(*) FROM accounts WHERE username = ?", admin); n != 0 {
		t.Fatal("the listed admin name was registered without an invite")
	}

	// Bootstrap (open mode) reports the missing name and creates the configured invite.
	code := "boot-" + u
	h.cleanup("DELETE FROM invites WHERE code_hash = ?", digest(code))
	for range 2 { // idempotent across restarts
		logs.reset()
		if err := h.api.Bootstrap(t.Context(), code); err != nil {
			t.Fatal(err)
		}
		if got := logs.invites(t); len(got) != 1 || got[0] != code {
			t.Fatalf("logged invites %v", got)
		}
		var missing []string
		for _, record := range logs.records(t) {
			if record["level"] == "ERROR" {
				missing = append(missing, fmt.Sprint(record["username"]))
			}
		}
		if len(missing) != 1 || missing[0] != admin {
			t.Fatalf("error logs for %v", missing)
		}
	}
	if n := h.count("SELECT COUNT(*) FROM invites WHERE code_hash = ? AND used_by IS NULL", digest(code)); n != 1 {
		t.Fatalf("%d bootstrap invites", n)
	}
	adminID, token := h.registerInvite("Admin_"+u, "Admin"+u, code)
	if !h.summary(token).Account.Admin {
		t.Fatal("the listed name is not admin")
	}
	if n := h.count("SELECT COUNT(*) FROM invites WHERE code_hash = ? AND used_by = ?", digest(code), adminID); n != 1 {
		t.Fatal("the invite was not consumed")
	}
	// Every listed name has an account: nothing more to report.
	logs.reset()
	if err := h.api.Bootstrap(t.Context(), code); err != nil {
		t.Fatal(err)
	}
	if records := logs.records(t); len(records) != 0 {
		t.Fatalf("logged %v", records)
	}
	// Ordinary names still need no invite.
	h.register("plain_"+u, "Plain"+u)

	// A used configured code, or none, yields a one-time random invite.
	for i, configured := range []string{code, ""} {
		name := fmt.Sprintf("next%d_%s", i, u)
		mode := []string{"invite", "open"}[i]
		next := newHarness(t, harnessOptions{mysql: true, admins: []string{name}, registration: mode})
		nextLogs := recordLogs(next)
		if err := next.api.Bootstrap(t.Context(), configured); err != nil {
			t.Fatal(err)
		}
		got := nextLogs.invites(t)
		if len(got) != 1 || got[0] == code {
			t.Fatalf("logged invites %v", got)
		}
		next.cleanup("DELETE FROM invites WHERE code_hash = ?", digest(got[0]))
		next.registerInvite(name, fmt.Sprintf("Next%d%s", i, u), got[0])
	}
}

// F5: failed logins lock a username out only for the network they came from.
func TestLoginFailuresCountPerClientNetwork(t *testing.T) {
	limits := DefaultRateLimits()
	limits.LoginPerIP = 1000
	h := newHarness(t, harnessOptions{mysql: true, limits: &limits})
	u := datatest.Unique()
	h.account("victim_"+u, "Victim"+u, password, false)
	login := func(secret, ip string) response {
		return h.post("/multiplayer/auth/login", map[string]string{"username": "Victim_" + u, "password": secret},
			map[string]string{"X-Forwarded-For": ip})
	}
	for _, network := range []struct{ attacker, sameNetwork, elsewhere string }{
		{"203.0.113.%d", "203.0.113.250", "198.51.100.7"},
		{"2001:db8:7:1::%x", "2001:db8:7:1::ffff", "2001:db8:7:2::1"},
	} {
		for i := range limits.LoginFailures {
			login("wrong-password", fmt.Sprintf(network.attacker, i+1)).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
		}
		login(password, network.sameNetwork).expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
		// Before the fix the owner was locked out everywhere.
		login(password, network.elsewhere).expect(t, http.StatusOK, "")
	}
}

// F6: doomed registrations do not use up the global budget; IPv6 clients
// are also limited per /56.
func TestRegistrationGlobalBudgetAndIPv6Sites(t *testing.T) {
	u := datatest.Unique()
	limits := generousLimits()
	limits.RegisterGlobal = 3
	h := newHarness(t, harnessOptions{mysql: true, limits: &limits})
	h.cleanup("DELETE FROM accounts WHERE username LIKE ?", "rg%\\_"+u)
	// nickname is the username without underscores, at most 16 characters.
	nickname := func(username string) string {
		name := strings.ReplaceAll(username, "_", "")
		return name[:min(len(name), 16)]
	}
	register := func(username, ip string, extra map[string]string) response {
		fields := map[string]string{"username": username, "nickname": nickname(username), "password": password}
		for name, value := range extra {
			fields[name] = value
		}
		return h.post("/multiplayer/auth/register", fields, map[string]string{"X-Forwarded-For": ip})
	}
	h.account("rgtaken_"+u, "Taken"+u, password, false)
	for i := range 10 {
		register("rgtaken_"+u, fmt.Sprintf("192.0.2.%d", i+1), nil).expect(t, http.StatusConflict, "USERNAME_TAKEN")
		register(fmt.Sprintf("rgbad%d_%s", i, u), fmt.Sprintf("192.0.2.%d", i+1), map[string]string{"invite": "nope-" + u}).
			expect(t, http.StatusBadRequest, "INVALID_INVITE")
	}
	for i := range 3 {
		register(fmt.Sprintf("rgok%d_%s", i, u), fmt.Sprintf("198.51.100.%d", i+1), nil).expect(t, http.StatusOK, "")
	}
	register("rgover_"+u, "198.51.100.99", nil).expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")

	sites := generousLimits()
	sites.RegisterPerIPv6Site = 2
	h6 := newHarness(t, harnessOptions{mysql: true, limits: &sites})
	register6 := func(username, ip string) response {
		return h6.post("/multiplayer/auth/register", map[string]string{"username": username, "nickname": nickname(username),
			"password": password}, map[string]string{"X-Forwarded-For": ip})
	}
	register6("rgv1_"+u, "2001:db8:5:100::1").expect(t, http.StatusOK, "")
	register6("rgv2_"+u, "2001:db8:5:1ff::1").expect(t, http.StatusOK, "") // another /64 of the same /56
	register6("rgv3_"+u, "2001:db8:5:180::1").expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	register6("rgv4_"+u, "2001:db8:5:200::1").expect(t, http.StatusOK, "") // the next /56
	register6("rgv5_"+u, "203.0.113.9").expect(t, http.StatusOK, "")       // IPv4 has no site limit
}

// F8: an admin's request id stands for one grant.
func TestAdminGrantRequestIDsStandForOneGrant(t *testing.T) {
	u := datatest.Unique()
	chief := "gchief_" + u
	h := newHarness(t, harnessOptions{mysql: true, admins: []string{chief}})
	h.account(chief, "GChief"+u, password, false)
	adminToken := h.login(chief, password)
	grant := func(fields map[string]any) response {
		return h.post("/api/admin/grant", fields, bearerHeader(adminToken))
	}
	type granted struct {
		Applied   int64
		Duplicate bool
	}
	targets := make([]string, 7)
	for i := range targets {
		targets[i] = h.account(fmt.Sprintf("gt%d_%s", i, u), fmt.Sprintf("Gt%d%s", i, u), password, false)
		h.setWallet(targets[i], store.Wallet{})
	}
	request := uuid()
	body := func(target int, currency string, amount int64) map[string]any {
		return map[string]any{"username": fmt.Sprintf("gt%d_%s", target, u), "currency": currency, "amount": amount,
			"note": "n", "requestId": request}
	}
	var result granted
	grant(body(0, "coupon", 5)).expect(t, http.StatusOK, "").json(t, &result)
	if result.Applied != 5 || result.Duplicate {
		t.Fatalf("first %+v", result)
	}
	same := body(0, "coupon", 5)
	same["note"], same["username"], same["requestId"] = "other note", fmt.Sprintf("GT0_%s", u), strings.ToUpper(request)
	grant(same).expect(t, http.StatusOK, "").json(t, &result)
	if result.Applied != 0 || !result.Duplicate {
		t.Fatalf("repeat %+v", result)
	}
	// Before the fix these applied again (another currency or account is
	// another ledger key).
	grant(body(0, "coupon", 6)).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	grant(body(0, "lucci", 5)).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	grant(body(0, "exp", 5)).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	grant(body(1, "coupon", 5)).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	if wallet := h.wallet(targets[0]); wallet != (store.Wallet{Coupon: 5}) {
		t.Fatalf("wallet %+v", wallet)
	}
	if wallet := h.wallet(targets[1]); wallet != (store.Wallet{}) {
		t.Fatalf("other wallet %+v", wallet)
	}

	// Concurrent uses of one new request id for different accounts: one wins.
	request = uuid()
	var wg sync.WaitGroup
	var mu sync.Mutex
	statuses := map[int]int{}
	for i := 1; i < len(targets); i++ {
		wg.Go(func() {
			r := send(t, http.MethodPost, h.public.URL+"/api/admin/grant", body(i, "coupon", 7), bearerHeader(adminToken))
			mu.Lock()
			statuses[r.status]++
			mu.Unlock()
		})
	}
	wg.Wait()
	total := int64(0)
	for _, id := range targets[1:] {
		total += h.wallet(id).Coupon
	}
	if statuses[http.StatusOK] != 1 || statuses[http.StatusConflict] != len(targets)-2 || total != 7 {
		t.Fatalf("statuses %v, %d coupons granted", statuses, total)
	}

	// A refused grant records nothing, so its id stays usable.
	request = uuid()
	grant(body(0, "coupon", -1000)).expect(t, http.StatusConflict, "INSUFFICIENT_FUNDS")
	grant(body(0, "coupon", 1)).expect(t, http.StatusOK, "").json(t, &result)
	if result.Applied != 1 {
		t.Fatalf("after a refusal %+v", result)
	}

	// The console keeps its request ids without crypto.randomUUID.
	script := string(h.get("/multiplayer/admin/admin.js", nil).expect(t, http.StatusOK, "").body)
	if !strings.Contains(script, "crypto.getRandomValues") || strings.Contains(script, "randomUUID") {
		t.Fatal("admin.js does not generate its own request ids")
	}
}

// Review R4: concurrent purchases, admin debits, time-attack runs and race
// settlements keep every balance equal to its ledger.
func TestConcurrentEconomyKeepsTheLedgerConsistent(t *testing.T) {
	clock := newFakeClock(economyNoon)
	u := datatest.Unique()
	chief := "lchief_" + u
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now, admins: []string{chief}})
	h.account(chief, "LChief"+u, password, false)
	adminToken := h.login(chief, password)
	id, token := h.register("lc_"+u, "Lc"+u)
	id2, _ := h.register("lcb_"+u, "Lcb"+u)
	_, offer := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return item.IsAdditional && offer.Currency == economy.Lucci && offer.MinExp == 0
	})
	var wg sync.WaitGroup
	for i := range 30 {
		wg.Go(func() {
			send(t, http.MethodPost, h.public.URL+"/api/shop/purchase",
				map[string]string{"offerId": offer.OfferID, "requestId": uuid()}, bearerHeader(token))
		})
		wg.Go(func() {
			send(t, http.MethodPost, h.public.URL+"/api/admin/grant", map[string]any{"username": "lc_" + u,
				"currency": "lucci", "amount": -700, "note": "debit", "requestId": uuid()}, bearerHeader(adminToken))
		})
		wg.Go(func() {
			send(t, http.MethodPost, h.public.URL+"/api/timeattack/settle",
				map[string]any{"trackId": "village_R01", "elapsedMs": 100_000 - i, "requestId": uuid()}, bearerHeader(token))
		})
		wg.Go(func() {
			first, second := id, id2
			if i%2 == 1 {
				first, second = id2, id
			}
			race := raceWithRewards(fmt.Sprintf("lc-%s-%d", u, i), clock.millis(),
				contract.RaceReward{PlayerID: "p1", AccountID: first, Exp: 100, Lucci: 150},
				contract.RaceReward{PlayerID: "p2", AccountID: second, Exp: 100, Lucci: 150})
			h.cleanup("DELETE FROM race_results WHERE race_id = ?", race.RaceID)
			h.cleanup("DELETE FROM race_outcomes WHERE race_id = ?", race.RaceID)
			send(t, http.MethodPost, h.internal.URL+contract.PathRaces, race, map[string]string{contract.ClusterKeyHeader: testSecret})
		})
	}
	wg.Wait()
	for _, account := range []string{id, id2} {
		wallet := h.wallet(account)
		for currency, balance := range map[string]int64{"coupon": wallet.Coupon, "lucci": wallet.Lucci, "koin": wallet.Koin} {
			sum := h.count("SELECT COALESCE(SUM(delta), 0) FROM wallet_ledger WHERE account_id = ? AND currency = ?", account, currency)
			if int64(sum) != balance {
				t.Errorf("%s %s: ledger %d, balance %d", account, currency, sum, balance)
			}
		}
		exp := h.count("SELECT exp FROM account_progress WHERE account_id = ?", account)
		if sum := h.count("SELECT COALESCE(SUM(delta), 0) FROM exp_ledger WHERE account_id = ?", account); exp != sum {
			t.Errorf("%s: exp %d, ledger %d", account, exp, sum)
		}
	}
}
