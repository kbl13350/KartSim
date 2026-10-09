package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
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

// These tests need KART_TEST_MYSQL_DSN; they skip otherwise.

// economyNoon is a fixed API clock: 12:00 Beijing time, far from midnight,
// so daily caps never straddle two days by accident.
var economyNoon = time.Date(2026, 10, 7, 4, 0, 0, 0, time.UTC)

type summaryBody struct {
	Account struct {
		Username  string
		Nickname  string
		Admin     bool
		CreatedAt int64
	}
	Progress struct {
		Level        int
		Exp          int64
		LevelExp     int64
		NextLevelExp *int64
		Glove        string
		GloveName    string
		MaxLevel     int
	}
	Wallet    store.Wallet
	Stats     store.SummaryStats
	Onboarded bool
}

// register creates an account through the public API and returns its id
// and session token; the account is removed after the test.
func (h *harness) register(username, nickname string) (string, string) {
	h.t.Helper()
	var body struct {
		Account publicAccount
		Token   string
	}
	h.post("/multiplayer/auth/register", map[string]string{"username": username, "nickname": nickname, "password": password}, nil).
		expect(h.t, http.StatusOK, "").json(h.t, &body)
	return h.accountID(username), body.Token
}

// registerInvite registers with an invite code, like register.
func (h *harness) registerInvite(username, nickname, invite string) (string, string) {
	h.t.Helper()
	var body struct {
		Account publicAccount
		Token   string
	}
	h.post("/multiplayer/auth/register", map[string]string{"username": username, "nickname": nickname, "password": password,
		"invite": invite}, nil).expect(h.t, http.StatusOK, "").json(h.t, &body)
	return h.accountID(username), body.Token
}

func (h *harness) summary(token string) summaryBody {
	h.t.Helper()
	var body summaryBody
	h.get("/api/account", bearerHeader(token)).expect(h.t, http.StatusOK, "").json(h.t, &body)
	return body
}

func (h *harness) claimStarter(token string, character, paint, dye int) summaryBody {
	h.t.Helper()
	var body summaryBody
	h.post("/api/account/starter", map[string]int{"character": character, "paint": paint, "dye": dye}, bearerHeader(token)).
		expect(h.t, http.StatusOK, "").json(h.t, &body)
	return body
}

func (h *harness) inventory(token string) []store.InventoryItem {
	h.t.Helper()
	var body struct {
		Items      []store.InventoryItem
		ServerTime int64
	}
	h.get("/api/inventory", bearerHeader(token)).expect(h.t, http.StatusOK, "").json(h.t, &body)
	if body.ServerTime == 0 || body.Items == nil {
		h.t.Fatalf("inventory %+v", body)
	}
	return body.Items
}

// setWallet overwrites an account's balances (creating the row).
func (h *harness) setWallet(accountID string, wallet store.Wallet) {
	h.t.Helper()
	datatest.Exec(h.t, h.db, `INSERT INTO wallets(account_id, coupon, lucci, koin, updated_at) VALUES(?, ?, ?, ?, 0) AS v
		ON DUPLICATE KEY UPDATE coupon = v.coupon, lucci = v.lucci, koin = v.koin`,
		accountID, wallet.Coupon, wallet.Lucci, wallet.Koin)
}

// setExp overwrites an account's exp (creating the row).
func (h *harness) setExp(accountID string, exp int64) {
	h.t.Helper()
	datatest.Exec(h.t, h.db, `INSERT INTO account_progress(account_id, exp, level, updated_at) VALUES(?, ?, 1, 0) AS v
		ON DUPLICATE KEY UPDATE exp = v.exp`, accountID, exp)
}

func (h *harness) wallet(accountID string) store.Wallet {
	h.t.Helper()
	var wallet store.Wallet
	if err := h.db.QueryRow("SELECT coupon, lucci, koin FROM wallets WHERE account_id = ?", accountID).
		Scan(&wallet.Coupon, &wallet.Lucci, &wallet.Koin); err != nil {
		h.t.Fatal(err)
	}
	return wallet
}

func (h *harness) count(query string, args ...any) int {
	h.t.Helper()
	var n int
	if err := h.db.QueryRow(query, args...).Scan(&n); err != nil {
		h.t.Fatalf("%s: %v", query, err)
	}
	return n
}

// findOffer returns the first catalog offer matching keep.
func findOffer(t *testing.T, keep func(item *economy.Item, offer economy.Offer) bool) (*economy.Item, economy.Offer) {
	t.Helper()
	data, err := economy.Default()
	if err != nil {
		t.Fatal(err)
	}
	for i := range data.Catalog.Items {
		item := &data.Catalog.Items[i]
		for _, offer := range item.Offers {
			if keep(item, offer) {
				return item, offer
			}
		}
	}
	t.Fatal("no matching offer in the catalog")
	return nil, economy.Offer{}
}

func uuid() string { return newUUID() }

func TestOpenRegistrationCreatesAnEconomy(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true, admins: []string{"Boss_ADMIN_ignored"}})
	u := datatest.Unique()
	register := func(fields map[string]any) response { return h.post("/multiplayer/auth/register", fields, nil) }

	// No invite needed; an 8-character password is enough.
	var created struct {
		Account publicAccount
		Token   string
	}
	register(map[string]any{"username": "open_" + u, "nickname": "Open" + u, "password": "eight888"}).
		expect(t, http.StatusOK, "").json(t, &created)
	id := h.accountID("open_" + u)
	if created.Account.Admin || !validToken(created.Token) {
		t.Fatalf("registered %+v", created)
	}
	summary := h.summary(created.Token)
	if summary.Wallet != (store.Wallet{Lucci: 10_000}) || summary.Progress.Level != 1 || summary.Progress.Exp != 0 ||
		summary.Onboarded || summary.Account.Username != "open_"+u || summary.Account.CreatedAt <= 0 ||
		summary.Progress.NextLevelExp == nil || *summary.Progress.NextLevelExp != 70 || summary.Progress.MaxLevel != 126 {
		t.Fatalf("new account summary %+v", summary)
	}
	if n := h.count("SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'starter' AND delta = 10000", id); n != 1 {
		t.Fatalf("%d starter ledger rows", n)
	}

	// The exact JSON shape of ECONOMY.md 8.
	var raw map[string]map[string]any
	var top map[string]json.RawMessage
	body := h.get("/api/account", bearerHeader(created.Token)).body
	if err := json.Unmarshal(body, &top); err != nil {
		t.Fatal(err)
	}
	keys := func(fields map[string]any) []string {
		names := make([]string, 0, len(fields))
		for name := range fields {
			names = append(names, name)
		}
		slices.Sort(names)
		return names
	}
	raw = map[string]map[string]any{}
	for _, name := range []string{"account", "progress", "wallet", "stats"} {
		var fields map[string]any
		if err := json.Unmarshal(top[name], &fields); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		raw[name] = fields
	}
	for name, want := range map[string][]string{
		"account":  {"admin", "createdAt", "nickname", "username"},
		"progress": {"exp", "glove", "gloveName", "level", "levelExp", "maxLevel", "nextLevelExp"},
		"wallet":   {"coupon", "koin", "lucci"},
		"stats":    {"podiums", "points", "races", "wins"},
	} {
		if got := keys(raw[name]); !slices.Equal(got, want) {
			t.Fatalf("%s keys %v, want %v", name, got, want)
		}
	}
	if len(top) != 5 || string(top["onboarded"]) != "false" {
		t.Fatalf("summary %s", body)
	}

	// An empty invite field is no invite; a given invite must be valid and is consumed.
	register(map[string]any{"username": "empty_" + u, "nickname": "Empty" + u, "password": password, "invite": ""}).
		expect(t, http.StatusOK, "")
	h.accountID("empty_" + u)
	register(map[string]any{"username": "bad_" + u, "nickname": "Bad" + u, "password": password, "invite": "nope-" + u}).
		expect(t, http.StatusBadRequest, "INVALID_INVITE")
	invite := h.invite()
	register(map[string]any{"username": "inv_" + u, "nickname": "Inv" + u, "password": password, "invite": invite}).
		expect(t, http.StatusOK, "")
	invitedID := h.accountID("inv_" + u)
	var usedBy string
	if err := h.db.QueryRow("SELECT used_by FROM invites WHERE code_hash = ?", digest(invite)).Scan(&usedBy); err != nil || usedBy != invitedID {
		t.Fatalf("invite not consumed: %q %v", usedBy, err)
	}
	register(map[string]any{"username": "inv2_" + u, "nickname": "Inv2" + u, "password": password, "invite": invite}).
		expect(t, http.StatusBadRequest, "INVALID_INVITE")
	register(map[string]any{"username": "OPEN_" + u, "nickname": "Other" + u, "password": password}).
		expect(t, http.StatusConflict, "USERNAME_TAKEN")
	register(map[string]any{"username": "other_" + u, "nickname": "open" + u, "password": password}).
		expect(t, http.StatusConflict, "NICKNAME_TAKEN")
	register(map[string]any{"username": "short_" + u, "nickname": "Short" + u, "password": "seven77"}).
		expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")

	// Without the named lock, concurrent registrations of one name still
	// end with exactly one account (the unique keys decide).
	const racers = 6
	statuses := make(chan response, racers)
	var wg sync.WaitGroup
	for i := range racers {
		wg.Go(func() {
			statuses <- send(t, http.MethodPost, h.public.URL+"/multiplayer/auth/register", map[string]string{
				"username": "race_" + u, "nickname": fmt.Sprintf("Race%d%s", i, u), "password": password}, nil)
		})
	}
	wg.Wait()
	close(statuses)
	created2, taken := 0, 0
	for result := range statuses {
		switch {
		case result.status == http.StatusOK:
			created2++
		case result.status == http.StatusConflict && strings.Contains(string(result.body), "USERNAME_TAKEN"):
			taken++
		default:
			t.Errorf("concurrent registration: %d %s", result.status, result.body)
		}
	}
	h.accountID("race_" + u)
	if created2 != 1 || taken != racers-1 {
		t.Fatalf("%d created, %d taken", created2, taken)
	}
}

func TestRegistrationModesAndAdmins(t *testing.T) {
	u := datatest.Unique()
	closed := newHarness(t, harnessOptions{mysql: true, registration: "closed"})
	closed.post("/multiplayer/auth/register", map[string]string{"username": "closed_" + u, "nickname": "Closed" + u,
		"password": password}, nil).expect(t, http.StatusForbidden, "REGISTRATION_CLOSED")
	if closed.count("SELECT COUNT(*) FROM accounts WHERE username = ?", "closed_"+u) != 0 {
		t.Fatal("closed registration created an account")
	}

	invite := newHarness(t, harnessOptions{mysql: true, registration: "invite"})
	invite.post("/multiplayer/auth/register", map[string]string{"username": "noinv_" + u, "nickname": "NoInv" + u,
		"password": password}, nil).expect(t, http.StatusBadRequest, "INVALID_INVITE")
	// Without listed admin names lacking an account, Bootstrap only creates
	// an invite in invite mode (TestListedAdminNamesNeedAnInvite covers the rest).
	plain := newHarness(t, harnessOptions{mysql: true})
	code := "bootstrap-open-" + u
	if err := plain.api.Bootstrap(t.Context(), code); err != nil {
		t.Fatal(err)
	}
	if plain.count("SELECT COUNT(*) FROM invites WHERE code_hash = ?", digest(code)) != 0 {
		t.Fatal("open mode created a bootstrap invite")
	}

	// KART_ADMIN_USERNAMES (any case) makes an account admin without storing it.
	open := newHarness(t, harnessOptions{mysql: true, admins: []string{"BOSS_" + u}})
	bossID, bossToken := open.registerInvite("boss_"+u, "Boss"+u, open.invite())
	var me struct{ Account publicAccount }
	open.get("/multiplayer/auth/me", bearerHeader(bossToken)).expect(t, http.StatusOK, "").json(t, &me)
	if !me.Account.Admin || !open.summary(bossToken).Account.Admin {
		t.Fatalf("listed username is not admin: %+v", me)
	}
	if open.count("SELECT admin FROM accounts WHERE id = ?", bossID) != 0 {
		t.Fatal("the admin list was written to MySQL")
	}
	_, playerToken := open.register("player_"+u, "Player"+u)
	if open.summary(playerToken).Account.Admin {
		t.Fatal("an open-mode registrant became admin")
	}
	// A stored admin flag (invite-mode first account, Java admins) stays.
	open.account("legacy_"+u, "Legacy"+u, password, true)
	var legacy struct{ Account publicAccount }
	open.post("/multiplayer/auth/login", map[string]string{"username": "legacy_" + u, "password": password}, nil).
		expect(t, http.StatusOK, "").json(t, &legacy)
	if !legacy.Account.Admin {
		t.Fatal("stored admin lost")
	}
}

func TestRegistrationAndLoginRateLimits(t *testing.T) {
	limits := DefaultRateLimits()
	limits.RegisterGlobal = 7
	h := newHarness(t, harnessOptions{mysql: true, limits: &limits})
	u := datatest.Unique()
	from := func(ip string) map[string]string { return map[string]string{"X-Forwarded-For": ip} }
	register := func(i int, ip string) response {
		return h.post("/multiplayer/auth/register", map[string]string{"username": fmt.Sprintf("rl%d_%s", i, u),
			"nickname": fmt.Sprintf("Rl%d%s", i, u), "password": password}, from(ip))
	}
	t.Cleanup(func() { datatest.Exec(t, h.db, "DELETE FROM accounts WHERE username LIKE ?", "rl%\\_"+u) })
	// Invalid fields are refused before counting.
	for range 10 {
		h.post("/multiplayer/auth/register", map[string]string{"username": "x"}, from("203.0.113.1")).
			expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	}
	for i := range 5 {
		register(i, "203.0.113.1").expect(t, http.StatusOK, "")
	}
	register(5, "203.0.113.1").expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	// Another client is counted separately; IPv6 clients are counted per /64.
	register(6, "2001:db8:1:2::10").expect(t, http.StatusOK, "")
	// The global limit (7 here) holds across clients.
	register(7, "198.51.100.7").expect(t, http.StatusOK, "")
	register(8, "198.51.100.8").expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	if h.count("SELECT COUNT(*) FROM accounts WHERE username LIKE ?", "rl%\\_"+u) != 7 {
		t.Fatal("rate-limited registrations were stored")
	}

	// Login: failures per username, checked before the password hash; the
	// correct password is refused too once the limit is reached.
	h.account("victim_"+u, "Victim"+u, password, false)
	for i := range 10 {
		h.post("/multiplayer/auth/login", map[string]string{"username": "VICTIM_" + u, "password": "wrong-password"},
			from(fmt.Sprintf("192.0.2.%d", i+1))).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	}
	h.post("/multiplayer/auth/login", map[string]string{"username": "victim_" + u, "password": password}, from("192.0.2.99")).
		expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	h.account("bystander_"+u, "Bystander"+u, password, false)
	h.post("/multiplayer/auth/login", map[string]string{"username": "bystander_" + u, "password": password}, from("192.0.2.1")).
		expect(t, http.StatusOK, "")
	// Attempts per client IP.
	for i := range 20 {
		h.post("/multiplayer/auth/login", map[string]string{"username": fmt.Sprintf("ghost%d_%s", i, u), "password": "x"},
			from("192.0.2.200")).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	}
	h.post("/multiplayer/auth/login", map[string]string{"username": "bystander_" + u, "password": password}, from("192.0.2.200")).
		expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	h.redis.FastForward(5 * time.Minute)
	h.post("/multiplayer/auth/login", map[string]string{"username": "bystander_" + u, "password": password}, from("192.0.2.200")).
		expect(t, http.StatusOK, "")

	// Redis down: registration fails closed, login fails open.
	h.redis.SetError("ERR down")
	register(9, "203.0.113.50").expect(t, http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	h.post("/multiplayer/auth/login", map[string]string{"username": "bystander_" + u, "password": password}, from("192.0.2.201")).
		expect(t, http.StatusOK, "")
	h.redis.SetError("")
}

func TestLazyEconomyForExistingAccounts(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	id := h.account("old_"+u, "Old"+u, password, false) // an account from before the economy
	token := h.login("old_"+u, password)
	if h.count("SELECT COUNT(*) FROM wallets WHERE account_id = ?", id) != 0 {
		t.Fatal("fixture already has a wallet")
	}
	var wg sync.WaitGroup
	for range 6 {
		wg.Go(func() {
			if got := send(t, http.MethodGet, h.public.URL+"/api/account", nil, bearerHeader(token)); got.status != http.StatusOK {
				t.Errorf("summary %d %s", got.status, got.body)
			}
		})
	}
	wg.Wait()
	if summary := h.summary(token); summary.Wallet.Lucci != 10_000 || summary.Progress.Level != 1 {
		t.Fatalf("lazy wallet %+v", summary)
	}
	if n := h.count("SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'starter'", id); n != 1 {
		t.Fatalf("starting lucci granted %d times", n)
	}

	zero := int64(0)
	none := newHarness(t, harnessOptions{mysql: true, startingLucci: &zero})
	none.account("zero_"+u, "Zero"+u, password, false)
	if summary := none.summary(none.login("zero_"+u, password)); summary.Wallet.Lucci != 0 {
		t.Fatalf("KART_STARTING_LUCCI=0 granted %+v", summary.Wallet)
	}
}

func TestStarterClaim(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	_, token := h.register("new_"+u, "New"+u)
	h.post("/api/account/starter", map[string]int{"character": 2, "paint": 6, "dye": 4}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	for _, bad := range []map[string]int{
		{"character": 1, "paint": 6, "dye": 4}, // 宝宝 is not a starter character
		{"character": 2, "paint": 1, "dye": 4}, // the @zz default color is not offered in CN
		{"character": 2, "paint": 6, "dye": 99},
		{"paint": 6, "dye": 4},
	} {
		h.post("/api/account/starter", bad, bearerHeader(token)).expect(t, http.StatusBadRequest, "INVALID_STARTER")
	}
	h.post("/api/account/starter", `{"character":"2","paint":6,"dye":4}`, bearerHeader(token)).
		expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.get("/api/account/profile", bearerHeader(token)).expect(t, http.StatusNotFound, "PROFILE_NOT_FOUND")
	// A profile saved before the claim keeps its other fields.
	h.put("/api/account/profile", `{"favoriteTracks":["village_R01"],"initial":"AB"}`, bearerHeader(token)).
		expect(t, http.StatusOK, "")

	if summary := h.claimStarter(token, 3, 5, 7); !summary.Onboarded || summary.Wallet.Lucci != 10_000 {
		t.Fatalf("claim summary %+v", summary)
	}
	items := h.inventory(token)
	want := []store.InventoryItem{
		{Category: 1, ItemID: 3, Quantity: 1, Source: "starter"},
		{Category: 2, ItemID: 5, Quantity: 1, Source: "starter"},
		{Category: 3, ItemID: 0, SystemKey: "practiceKart", Quantity: 1, Source: "starter"},
		{Category: 70, ItemID: 7, Quantity: 1, Source: "starter"},
	}
	if !slices.Equal(items, want) {
		t.Fatalf("starter inventory %+v", items)
	}
	var profile struct {
		FavoriteTracks []string
		Initial        string
		Equipment      struct {
			ItemIDs    map[string]int `json:"itemIds"`
			KartSerial int            `json:"kartSerial"`
			ExceedType int            `json:"exceedType"`
			ValueAt3E  int            `json:"valueAt3E"`
			SystemKart string         `json:"systemKart"`
		}
	}
	h.get("/api/account/profile", bearerHeader(token)).expect(t, http.StatusOK, "").json(t, &profile)
	ids := profile.Equipment.ItemIDs
	if len(ids) != len(equipmentSlots) || ids["1"] != 3 || ids["2"] != 5 || ids["3"] != 0 || ids["70"] != 7 || ids["4"] != 0 ||
		profile.Equipment.SystemKart != "practiceKart" || profile.Initial != "AB" || len(profile.FavoriteTracks) != 1 {
		t.Fatalf("starter profile %+v", profile)
	}
	// The equipment passes the game nodes' ownership check.
	raw, _ := json.Marshal(profile.Equipment)
	id := h.accountID("new_" + u)
	h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: id, Equipment: raw}).
		expect(t, http.StatusOK, "")

	// Claiming again changes nothing.
	if summary := h.claimStarter(token, 2, 6, 4); !summary.Onboarded {
		t.Fatal("second claim")
	}
	if again := h.inventory(token); !slices.Equal(again, want) {
		t.Fatalf("second claim changed the inventory: %+v", again)
	}
	var choice store.StarterChoice
	if err := h.db.QueryRow("SELECT character_id, paint_id, dye_id FROM account_onboarding WHERE account_id = ?", id).
		Scan(&choice.Character, &choice.Paint, &choice.Dye); err != nil || choice != (store.StarterChoice{Character: 3, Paint: 5, Dye: 7}) {
		t.Fatalf("onboarding %+v %v", choice, err)
	}
}

// A starter pick the account already rents becomes permanent and is marked
// source "starter": the browser finds its fallback picks by that source.
func TestStarterClaimTakesOverARental(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	id, token := h.register("renter_"+u, "Renter"+u)
	h.summary(token) // creates the wallet
	h.setWallet(id, store.Wallet{Coupon: 100, Lucci: 10_000})
	h.post("/api/shop/purchase", map[string]string{"offerId": "s23294", "requestId": uuid()}, bearerHeader(token)).
		expect(t, http.StatusOK, "") // character 3, 7 days
	if items := h.inventory(token); len(items) != 1 || items[0].ExpiresAt == nil || items[0].Source != "shop" {
		t.Fatalf("rental %+v", items)
	}
	h.claimStarter(token, 3, 6, 4)
	items := h.inventory(token)
	if len(items) != 4 || items[0].Category != 1 || items[0].ItemID != 3 || items[0].ExpiresAt != nil ||
		items[0].Source != "starter" {
		t.Fatalf("starter inventory %+v", items)
	}
}

func TestPurchases(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("buyer_"+u, "Buyer"+u)
	auth := bearerHeader(token)
	buy := func(offerID, request string) response {
		return h.post("/api/shop/purchase", map[string]string{"offerId": offerID, "requestId": request}, auth)
	}
	type result struct {
		Wallet     store.Wallet
		Item       store.InventoryItem
		PurchaseID int64
	}
	bought := func(offerID, request string) result {
		t.Helper()
		var body result
		buy(offerID, request).expect(t, http.StatusOK, "").json(t, &body)
		return body
	}

	h.post("/api/shop/purchase", map[string]string{"offerId": "s5177", "requestId": uuid()}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	buy("s0", uuid()).expect(t, http.StatusNotFound, "OFFER_NOT_FOUND")
	buy("s5177", "not-a-uuid").expect(t, http.StatusBadRequest, "INVALID_REQUEST_ID")

	// A kart with rental and permanent coupon offers.
	kart, rental := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		hasPermanent := slices.ContainsFunc(item.Offers, func(other economy.Offer) bool {
			return other.Currency == economy.Coupon && other.Permanent() && other.MinExp == 0
		})
		return !item.IsAdditional && offer.Currency == economy.Coupon && offer.Days > 0 && offer.MinExp == 0 &&
			item.Category == economy.CategoryKart && hasPermanent
	})
	var permanent economy.Offer
	for _, offer := range kart.Offers {
		if offer.Currency == economy.Coupon && offer.Permanent() && offer.MinExp == 0 {
			permanent = offer
		}
	}
	if permanent.OfferID == "" {
		t.Fatalf("item %d:%d has no permanent coupon offer", kart.Category, kart.ItemID)
	}
	buy(rental.OfferID, uuid()).expect(t, http.StatusConflict, "INSUFFICIENT_FUNDS")
	if h.count("SELECT COUNT(*) FROM purchases WHERE account_id = ?", id) != 0 {
		t.Fatal("a refused purchase was recorded")
	}

	h.setWallet(id, store.Wallet{Coupon: 10_000, Lucci: 10_000})
	first := uuid()
	got := bought(rental.OfferID, first)
	days := int64(rental.Days) * 24 * 60 * 60 * 1000
	if got.Wallet.Coupon != 10_000-rental.Price || got.Item.ExpiresAt == nil || *got.Item.ExpiresAt != clock.millis()+days ||
		got.Item.Category != kart.Category || got.Item.ItemID != kart.ItemID || got.Item.Quantity != 1 ||
		got.Item.Source != "shop" || got.PurchaseID <= 0 {
		t.Fatalf("rental %+v", got)
	}
	// A replay answers the original, byte for byte, and charges nothing.
	original := buy(rental.OfferID, first).expect(t, http.StatusOK, "").body
	clock.advance(time.Hour)
	if replay := buy(rental.OfferID, strings.ToUpper(first)).expect(t, http.StatusOK, "").body; string(replay) != string(original) {
		t.Fatalf("replay %s, original %s", replay, original)
	}
	buy(permanent.OfferID, first).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")
	if wallet := h.wallet(id); wallet.Coupon != 10_000-rental.Price {
		t.Fatalf("replay charged again: %+v", wallet)
	}
	if n := h.count("SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'purchase' AND ref_id = ? AND delta = ?",
		id, first, -rental.Price); n != 1 {
		t.Fatalf("%d purchase ledger rows", n)
	}

	// Renting again extends from the current expiry.
	expiry := *got.Item.ExpiresAt
	if again := bought(rental.OfferID, uuid()); *again.Item.ExpiresAt != expiry+days {
		t.Fatalf("extension %d, want %d", *again.Item.ExpiresAt, expiry+days)
	}
	// After it expired, a rental starts now.
	clock.advance(time.Duration(3*days) * time.Millisecond)
	if again := bought(rental.OfferID, uuid()); *again.Item.ExpiresAt != clock.millis()+days {
		t.Fatalf("rental after expiry %d, want %d", *again.Item.ExpiresAt, clock.millis()+days)
	}
	// A permanent purchase upgrades the rental; then the item cannot be bought again.
	if upgraded := bought(permanent.OfferID, uuid()); upgraded.Item.ExpiresAt != nil {
		t.Fatalf("upgrade %+v", upgraded)
	}
	buy(permanent.OfferID, uuid()).expect(t, http.StatusConflict, "ALREADY_OWNED")
	buy(rental.OfferID, uuid()).expect(t, http.StatusConflict, "ALREADY_OWNED")
	spent := 3*rental.Price + permanent.Price
	if wallet := h.wallet(id); wallet.Coupon != 10_000-spent {
		t.Fatalf("wallet %+v, want coupon %d", wallet, 10_000-spent)
	}
	if n := h.count("SELECT COALESCE(SUM(delta), 0) FROM wallet_ledger WHERE account_id = ? AND currency = 'coupon'", id); int64(n) != -spent {
		t.Fatalf("coupon ledger sums to %d", n)
	}

	// Count items add up and never count as owned.
	pack, packOffer := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return item.IsAdditional && offer.Count > 1 && offer.Currency == economy.Coupon && offer.MinExp == 0
	})
	bought(packOffer.OfferID, uuid())
	if again := bought(packOffer.OfferID, uuid()); again.Item.Quantity != 2*packOffer.Count || again.Item.ExpiresAt != nil ||
		again.Item.ItemID != pack.ItemID {
		t.Fatalf("pack %+v", again)
	}

	// Offers with an exp requirement.
	_, gated := findOffer(t, func(_ *economy.Item, offer economy.Offer) bool {
		return offer.MinExp > 0 && offer.MinExp < 5000 && offer.Currency == economy.Coupon && offer.Price < 1000
	})
	buy(gated.OfferID, uuid()).expect(t, http.StatusForbidden, "EXP_REQUIRED")
	h.setExp(id, gated.MinExp)
	bought(gated.OfferID, uuid())

	// Lucci and koin offers use their own balance.
	_, koinOffer := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return offer.Currency == economy.Koin && offer.MinExp == 0 && !item.IsAdditional
	})
	buy(koinOffer.OfferID, uuid()).expect(t, http.StatusConflict, "INSUFFICIENT_FUNDS")
	_, lucciOffer := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return offer.Currency == economy.Lucci && offer.MinExp == 0 && !item.IsAdditional && offer.Price <= 10_000
	})
	if got := bought(lucciOffer.OfferID, uuid()); got.Wallet.Lucci != 10_000-lucciOffer.Price {
		t.Fatalf("lucci purchase %+v", got)
	}
	// The inventory lists what was bought.
	var hasKart bool
	for _, item := range h.inventory(token) {
		if item.Category == kart.Category && item.ItemID == kart.ItemID && item.ExpiresAt == nil {
			hasKart = true
		}
	}
	if !hasKart {
		t.Fatal("permanent kart missing from the inventory")
	}
}

func TestConcurrentPurchasesCannotOverspend(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	u := datatest.Unique()
	id, token := h.register("rush_"+u, "Rush"+u)
	_, offer := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return item.IsAdditional && offer.Currency == economy.Coupon && offer.MinExp == 0
	})
	const affordable, buyers = 3, 16
	h.setWallet(id, store.Wallet{Coupon: affordable*offer.Price + offer.Price - 1})
	statuses := make(chan int, buyers+5)
	var wg sync.WaitGroup
	purchase := func(request string) {
		result := send(t, http.MethodPost, h.public.URL+"/api/shop/purchase",
			map[string]string{"offerId": offer.OfferID, "requestId": request}, bearerHeader(token))
		statuses <- result.status
	}
	for range buyers {
		wg.Go(func() { purchase(uuid()) })
	}
	// Concurrent retries of one request are charged once.
	shared := uuid()
	for range 5 {
		wg.Go(func() { purchase(shared) })
	}
	wg.Wait()
	close(statuses)
	counts := map[int]int{}
	for status := range statuses {
		counts[status]++
	}
	wallet := h.wallet(id)
	purchases := h.count("SELECT COUNT(*) FROM purchases WHERE account_id = ?", id)
	if purchases != affordable || wallet.Coupon != offer.Price-1 || counts[http.StatusConflict]+counts[http.StatusOK] != buyers+5 {
		t.Fatalf("%d purchases, wallet %+v, statuses %v", purchases, wallet, counts)
	}
	var quantity int
	if err := h.db.QueryRow("SELECT quantity FROM inventory_items WHERE account_id = ? AND category <> 3", id).Scan(&quantity); err != nil ||
		quantity != affordable*offer.Count {
		t.Fatalf("quantity %d %v", quantity, err)
	}
	if n := h.count("SELECT COALESCE(SUM(delta), 0) FROM wallet_ledger WHERE account_id = ? AND currency = 'coupon'", id); int64(n) != -affordable*offer.Price {
		t.Fatalf("ledger sum %d", n)
	}
}

// raceWithRewards is a settlement whose rewards list the given entries.
func raceWithRewards(raceID string, finishedAt int64, entries ...contract.RaceReward) contract.RaceSettlement {
	results := make([]contract.RaceResult, 0, len(entries))
	for i, entry := range entries {
		results = append(results, contract.RaceResult{PlayerID: entry.PlayerID, AccountID: entry.AccountID,
			Name: "N" + entry.PlayerID, Rank: i + 1, ElapsedMs: elapsed(60_000 + i), Points: 10 - i})
	}
	return contract.RaceSettlement{
		NodeID: "game-1", RaceID: raceID, RoomID: "room-" + raceID, Gameplay: "ordinary", TrackID: "village_R01",
		Snapshot: json.RawMessage(`{"race":{"id":"` + raceID + `"}}`), FinishedAt: finishedAt, Results: results, Rewards: entries,
	}
}

func TestRaceRewardsAreCreditedOnce(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	a := h.account("ra_"+u, "Ra"+u, password, false) // no wallet yet: created with the starting lucci
	b := h.account("rb_"+u, "Rb"+u, password, false)
	h.setWallet(b, store.Wallet{})
	h.setExp(b, 2600) // inside level 10 [2500, 3200): no level-ups below

	h.setExp(a, 120) // level 2 [70, 148); the 145 exp below reach 265, level 4 [262, 412)
	race := raceWithRewards("rw-1-"+u, clock.millis(),
		contract.RaceReward{PlayerID: "pa", AccountID: a, Exp: 145, Lucci: 150}, // the formula maximum of exp
		contract.RaceReward{PlayerID: "pb", AccountID: b, Exp: 66, Lucci: 100},
		contract.RaceReward{PlayerID: "pa2", AccountID: a, Exp: 100, Lucci: 100}, // a second entry of a is ignored
		contract.RaceReward{PlayerID: "pg", Exp: 10, Lucci: 10},                  // a guest
		contract.RaceReward{PlayerID: "px", AccountID: newUUID(), Exp: 10, Lucci: 10},
		contract.RaceReward{PlayerID: "pbad", AccountID: b, Exp: -5, Lucci: 10}, // out of range: dropped
		contract.RaceReward{PlayerID: "pbig", AccountID: b, Exp: 10, Lucci: 50_000},
	)
	// A malformed account id drops that reward, not the race.
	race.Rewards = append(race.Rewards, contract.RaceReward{PlayerID: "pid", AccountID: "not an id", Exp: 10, Lucci: 10})
	if result := h.settle(race); result.Duplicate {
		t.Fatal("new race reported duplicate")
	}
	// exp 265 is level 4: levels 3 and 4 grant 300+400 lucci and level 3 grants 20 koin.
	if wallet := h.wallet(a); wallet != (store.Wallet{Lucci: 10_000 + 150 + 700, Koin: 20}) {
		t.Fatalf("account a wallet %+v", wallet)
	}
	if wallet := h.wallet(b); wallet != (store.Wallet{Lucci: 100}) {
		t.Fatalf("account b wallet %+v", wallet)
	}
	if level := h.count("SELECT level FROM account_progress WHERE account_id = ?", a); level != 4 {
		t.Fatalf("level %d", level)
	}
	for _, check := range []struct {
		query string
		want  int
	}{
		{"SELECT COUNT(*) FROM exp_ledger WHERE account_id = ? AND reason = 'race' AND delta = 145", 1},
		{"SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'race' AND delta = 150", 1},
		{"SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'levelup'", 3},
		{"SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'levelup' AND ref_id = 'L3' AND currency = 'koin'", 1},
	} {
		if got := h.count(check.query, a); got != check.want {
			t.Fatalf("%s: %d, want %d", check.query, got, check.want)
		}
	}
	// Re-delivery of the same race credits nothing.
	if result := h.settle(race); !result.Duplicate {
		t.Fatal("re-delivery not reported duplicate")
	}
	if wallet := h.wallet(a); wallet.Lucci != 10_000+150+700 {
		t.Fatalf("re-delivery credited again: %+v", wallet)
	}

	// Daily caps (Beijing day): 19,950 exp and 29,900 lucci already granted today.
	day := rewards.BeijingDay(clock.now())
	datatest.Exec(t, h.db, "UPDATE daily_rewards SET exp = 19950, lucci = 29900 WHERE account_id = ? AND day = ? AND kind = 'race'", b, day)
	h.settle(raceWithRewards("rw-2-"+u, clock.millis(), contract.RaceReward{PlayerID: "pb", AccountID: b, Exp: 100, Lucci: 150}))
	if wallet := h.wallet(b); wallet.Lucci != 100+100 {
		t.Fatalf("capped lucci %+v", wallet)
	}
	if exp := h.count("SELECT exp FROM account_progress WHERE account_id = ?", b); exp != 2600+66+50 {
		t.Fatalf("capped exp %d", exp)
	}
	h.settle(raceWithRewards("rw-3-"+u, clock.millis(), contract.RaceReward{PlayerID: "pb", AccountID: b, Exp: 100, Lucci: 150}))
	if wallet := h.wallet(b); wallet.Lucci != 200 {
		t.Fatalf("over the cap %+v", wallet)
	}
	var count int
	var exp, lucci int64
	if err := h.db.QueryRow("SELECT count, exp, lucci FROM daily_rewards WHERE account_id = ? AND day = ? AND kind = 'race'", b, day).
		Scan(&count, &exp, &lucci); err != nil || count != 3 || exp != 20_000 || lucci != 30_000 {
		t.Fatalf("daily counter %d %d %d %v", count, exp, lucci, err)
	}
	// The next Beijing day starts a new counter.
	clock.advance(24 * time.Hour)
	h.settle(raceWithRewards("rw-4-"+u, clock.millis(), contract.RaceReward{PlayerID: "pb", AccountID: b, Exp: 100, Lucci: 150}))
	if wallet := h.wallet(b); wallet.Lucci != 350 {
		t.Fatalf("next day %+v", wallet)
	}

	// Reaching level 10 grants 50 coupons and 1000 lucci, once per account.
	h.setExp(a, 2400)
	h.settle(raceWithRewards("rw-5-"+u, clock.millis(), contract.RaceReward{PlayerID: "pa", AccountID: a, Exp: 140, Lucci: 0}))
	if wallet := h.wallet(a); wallet.Coupon != 50 || wallet.Lucci != 10_000+150+700+1000 {
		t.Fatalf("level 10 rewards %+v", wallet)
	}
	h.setExp(a, 2400)
	h.settle(raceWithRewards("rw-6-"+u, clock.millis(), contract.RaceReward{PlayerID: "pa", AccountID: a, Exp: 140, Lucci: 0}))
	if wallet := h.wallet(a); wallet.Coupon != 50 {
		t.Fatalf("level 10 rewarded twice: %+v", wallet)
	}

	// Configured rates multiply the node's base amounts (half up).
	rates := rewards.Rates{Exp: 1.5, Lucci: 2}
	scaled := newHarness(t, harnessOptions{mysql: true, now: clock.now, rates: &rates})
	c := scaled.account("rc_"+u, "Rc"+u, password, false)
	scaled.setWallet(c, store.Wallet{})
	scaled.settle(raceWithRewards("rw-7-"+u, clock.millis(), contract.RaceReward{PlayerID: "pc", AccountID: c, Exp: 45, Lucci: 33}))
	if exp := scaled.count("SELECT exp FROM account_progress WHERE account_id = ?", c); exp != 68 { // 67.5 rounds up
		t.Fatalf("scaled exp %d", exp)
	}
	if wallet := scaled.wallet(c); wallet.Lucci != 66 {
		t.Fatalf("scaled lucci %+v", wallet)
	}
}

func TestTimeAttackSettle(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("ta_"+u, "Ta"+u)
	h.setWallet(id, store.Wallet{})
	type settled struct {
		Exp, Lucci int64
		NewRecord  bool
		Capped     bool
		BestMs     int64
		LevelUps   []economy.LevelReward
		Summary    summaryBody
	}
	settle := func(track string, ms any, request string) response {
		return h.post("/api/timeattack/settle", map[string]any{"trackId": track, "elapsedMs": ms, "requestId": request}, bearerHeader(token))
	}
	// run drives a lap of ms (the clock advances by it) and settles it.
	run := func(track string, ms int64) settled {
		t.Helper()
		clock.advance(time.Duration(ms) * time.Millisecond)
		var body settled
		settle(track, ms, uuid()).expect(t, http.StatusOK, "").json(t, &body)
		return body
	}
	settle("village_R01", 9_999, uuid()).expect(t, http.StatusBadRequest, "INVALID_ELAPSED_MS")
	settle("village_R01", nil, uuid()).expect(t, http.StatusBadRequest, "INVALID_ELAPSED_MS")
	settle("village_R01", 60_000.5, uuid()).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	settle("", 60_000, uuid()).expect(t, http.StatusBadRequest, "INVALID_TRACK")
	// Only tracks of the exported time-attack list (exact ids) are accepted.
	for _, track := range []string{"junk-track", "VILLAGE_R01", "village_R01 ", "village_R02_rvs"} {
		settle(track, 60_000, uuid()).expect(t, http.StatusBadRequest, "INVALID_TRACK")
	}
	settle("village_R01", 60_000, "x").expect(t, http.StatusBadRequest, "INVALID_REQUEST_ID")
	h.post("/api/timeattack/settle", map[string]any{"trackId": "t", "elapsedMs": 60_000, "requestId": uuid()}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")

	request := uuid()
	var first settled
	original := settle("village_R01", 60_000, request).expect(t, http.StatusOK, "")
	original.json(t, &first)
	// First run on a track is a record: 10+20 exp, 20+50 lucci; 30 exp stays level 1.
	if first.Exp != 30 || first.Lucci != 70 || !first.NewRecord || first.Capped || first.BestMs != 60_000 ||
		first.Summary.Wallet.Lucci != 70 || first.Summary.Progress.Exp != 30 || len(first.LevelUps) != 0 || first.LevelUps == nil {
		t.Fatalf("first run %+v", first)
	}
	var replay settled
	settle("village_R01", 60_000, request).expect(t, http.StatusOK, "").json(t, &replay)
	if replay.Exp != 30 || replay.Lucci != 70 || replay.Summary.Wallet.Lucci != 70 {
		t.Fatalf("replay %+v", replay)
	}
	settle("village_R01", 61_000, request).expect(t, http.StatusConflict, "REQUEST_ID_CONFLICT")

	if slower := run("village_R01", 65_000); slower.NewRecord || slower.Exp != 10 || slower.Lucci != 20 || slower.BestMs != 60_000 {
		t.Fatalf("slower run %+v", slower)
	}
	// 30 + 10 + 30 = 70 exp reaches level 2 (200 lucci).
	faster := run("village_R01", 55_000)
	if !faster.NewRecord || faster.BestMs != 55_000 || len(faster.LevelUps) != 1 || faster.LevelUps[0] != (economy.LevelReward{Level: 2, Lucci: 200}) ||
		faster.Summary.Progress.Level != 2 || faster.Summary.Wallet.Lucci != 70+20+70+200 {
		t.Fatalf("faster run %+v", faster)
	}
	if other := run("forest_R02", 90_000); !other.NewRecord {
		t.Fatalf("other track %+v", other)
	}
	if reverse := run("village_R01_rvs", 70_000); !reverse.NewRecord {
		t.Fatalf("reverse track %+v", reverse)
	}
	var best int
	if err := h.db.QueryRow("SELECT best_ms FROM timeattack_bests WHERE account_id = ? AND track_id = 'village_R01'", id).Scan(&best); err != nil || best != 55_000 {
		t.Fatalf("best %d %v", best, err)
	}

	// 50 rewarded runs per Beijing day; later runs still set records.
	datatest.Exec(t, h.db, "UPDATE daily_rewards SET count = 49 WHERE account_id = ? AND kind = 'timeattack'", id)
	if last := run("village_R01", 70_000); last.Capped || last.Exp != 10 {
		t.Fatalf("50th run %+v", last)
	}
	capped := run("village_R01", 50_000)
	if !capped.Capped || capped.Exp != 0 || capped.Lucci != 0 || !capped.NewRecord || capped.BestMs != 50_000 {
		t.Fatalf("capped run %+v", capped)
	}
	clock.advance(24 * time.Hour)
	if next := run("village_R01", 80_000); next.Capped || next.Exp != 10 {
		t.Fatalf("next day %+v", next)
	}
}

func TestEquipmentOwnership(t *testing.T) {
	clock := newFakeClock(economyNoon)
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("eq_"+u, "Eq"+u)
	h.claimStarter(token, 2, 6, 4)
	equipment := func(change func(ids map[string]int, doc map[string]any)) json.RawMessage {
		ids := map[string]int{}
		for _, slot := range equipmentSlots {
			ids[fmt.Sprint(slot)] = 0
		}
		ids["1"], ids["2"], ids["70"] = 2, 6, 4
		doc := map[string]any{"kartSerial": 0, "exceedType": 0, "valueAt3E": 0, "systemKart": "practiceKart"}
		if change != nil {
			change(ids, doc)
		}
		doc["itemIds"] = ids
		raw, _ := json.Marshal(doc)
		return raw
	}
	verify := func(raw json.RawMessage) response {
		return h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: id, Equipment: raw})
	}
	missing := func(r response) []contract.EquipmentSlot {
		t.Helper()
		var body struct {
			Error   string
			OK      bool
			Missing []contract.EquipmentSlot
		}
		r.expect(t, http.StatusConflict, "ITEM_NOT_OWNED").json(t, &body)
		return body.Missing
	}
	withKart := func(ids map[string]int, doc map[string]any) {
		ids["3"] = 387
		delete(doc, "systemKart")
		doc["kartSerial"] = 7
	}

	verify(equipment(nil)).expect(t, http.StatusOK, "")
	// Free garage parts (43-46) and coatings are not checked.
	verify(equipment(func(ids map[string]int, _ map[string]any) { ids["43"], ids["68"] = 5, 9 })).expect(t, http.StatusOK, "")
	if got := missing(verify(equipment(withKart))); !slices.Equal(got, []contract.EquipmentSlot{{Slot: 3, ItemID: 387}}) {
		t.Fatalf("missing %+v", got)
	}
	if got := missing(verify(equipment(func(ids map[string]int, doc map[string]any) {
		ids["1"], ids["9"] = 1, 1
		doc["systemKart"] = "legacyPracticeX"
	}))); !slices.Equal(got, []contract.EquipmentSlot{{Slot: 1, ItemID: 1}, {Slot: 3}, {Slot: 9, ItemID: 1}}) {
		t.Fatalf("missing %+v", got)
	}
	for _, bad := range []string{`[]`, `{}`, `{"itemIds":[1]}`, `{"itemIds":{"1":"2"}}`, `{"itemIds":{"x":1}}`, `{"itemIds":{"1":1.5}}`} {
		verify(json.RawMessage(bad)).expect(t, http.StatusBadRequest, "INVALID_EQUIPMENT")
	}
	h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: "", Equipment: equipment(nil)}).
		expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_ID")
	// An unknown account owns nothing.
	h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: newUUID(), Equipment: equipment(nil)}).
		expect(t, http.StatusConflict, "ITEM_NOT_OWNED")

	// Rentals count until they expire.
	expires := clock.millis() + 60_000
	for _, item := range [][2]int{{3, 387}, {9, 1}, {1, 1}} {
		datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at, source,
			created_at, updated_at) VALUES(?, ?, ?, '', 1, ?, 'shop', 0, 0)`, id, item[0], item[1], expires)
	}
	rented := equipment(func(ids map[string]int, doc map[string]any) {
		withKart(ids, doc)
		ids["9"], ids["1"] = 1, 1
		doc["exceedType"] = 2
	})
	verify(rented).expect(t, http.StatusOK, "")

	// The profile accepts owned equipment only.
	profile := func(equipment json.RawMessage) string {
		return `{"initial":"Z","favoriteItems":[{"category":3,"itemId":387,"serial":0}],"equipment":` + string(equipment) + `}`
	}
	auth := bearerHeader(token)
	h.put("/api/account/profile", profile(rented), auth).expect(t, http.StatusOK, "")
	h.put("/api/account/profile", profile(equipment(func(ids map[string]int, _ map[string]any) { ids["8"] = 3 })), auth).
		expect(t, http.StatusConflict, "ITEM_NOT_OWNED")
	h.put("/api/account/profile", `{"equipment":{"itemIds":5}}`, auth).expect(t, http.StatusBadRequest, "INVALID_EQUIPMENT")
	h.put("/api/account/profile", `[1]`, auth).expect(t, http.StatusBadRequest, "INVALID_DOCUMENT")
	h.put("/api/account/profile", `{"p":"`+strings.Repeat("x", maxProfileChars)+`"}`, auth).expect(t, http.StatusBadRequest, "INVALID_DOCUMENT")
	h.put("/api/account/profile", `{}`, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	var stored map[string]json.RawMessage
	h.get("/api/account/profile", auth).expect(t, http.StatusOK, "").json(t, &stored)
	if string(stored["initial"]) != `"Z"` || !strings.Contains(string(stored["equipment"]), `"3":387`) {
		t.Fatalf("stored profile %v", stored)
	}

	// Expired rentals: the game nodes refuse them and the profile GET falls
	// back to the starter kart, character and empty slots.
	clock.advance(2 * time.Minute)
	if got := missing(verify(rented)); len(got) != 3 {
		t.Fatalf("expired rentals still owned: %+v", got)
	}
	h.put("/api/account/profile", profile(rented), auth).expect(t, http.StatusConflict, "ITEM_NOT_OWNED")
	var sanitized struct {
		Initial       string
		FavoriteItems []map[string]int
		Equipment     struct {
			ItemIDs           map[string]int `json:"itemIds"`
			KartSerial        int            `json:"kartSerial"`
			ExceedType        int            `json:"exceedType"`
			ValueAt3E         int            `json:"valueAt3E"`
			SystemKart        string         `json:"systemKart"`
			SystemKartVariant *string        `json:"systemKartVariant,omitempty"`
		}
	}
	h.get("/api/account/profile", auth).expect(t, http.StatusOK, "").json(t, &sanitized)
	ids := sanitized.Equipment.ItemIDs
	if ids["3"] != 0 || sanitized.Equipment.SystemKart != "practiceKart" || sanitized.Equipment.KartSerial != 0 ||
		sanitized.Equipment.ExceedType != 0 || ids["9"] != 0 || ids["1"] != 2 || ids["2"] != 6 || ids["70"] != 4 ||
		len(ids) != len(equipmentSlots) || sanitized.Initial != "Z" || len(sanitized.FavoriteItems) != 1 {
		t.Fatalf("sanitized profile %+v", sanitized)
	}
	// The sanitized equipment is valid for the game nodes.
	raw, _ := json.Marshal(sanitized.Equipment)
	verify(raw).expect(t, http.StatusOK, "")
	// Expired items are not listed.
	for _, item := range h.inventory(token) {
		if item.ExpiresAt != nil {
			t.Fatalf("expired item listed: %+v", item)
		}
	}
}

func TestAdminGrantAndSearch(t *testing.T) {
	u := datatest.Unique()
	chief := "chief_" + u
	h := newHarness(t, harnessOptions{mysql: true, admins: []string{strings.ToUpper(chief)}})
	h.account(chief, "Chief"+u, password, false)
	adminToken := h.login(chief, password)
	targetID, targetToken := h.register("target_"+u, "Target"+u)
	h.setWallet(targetID, store.Wallet{})
	grant := func(token string, body map[string]any) response {
		return h.post("/api/admin/grant", body, bearerHeader(token))
	}
	type granted struct {
		Applied   int64
		LevelUps  []economy.LevelReward
		Duplicate bool
		RequestID string
		Account   struct {
			Username       string
			Level          int
			Exp            int64
			Wallet         store.Wallet
			InventoryCount int
			Onboarded      bool
		}
	}
	ok := func(body map[string]any) granted {
		t.Helper()
		var result granted
		grant(adminToken, body).expect(t, http.StatusOK, "").json(t, &result)
		return result
	}

	h.post("/api/admin/grant", map[string]any{"username": "target_" + u, "currency": "coupon", "amount": 5, "note": "x"}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	grant(targetToken, map[string]any{"username": "target_" + u, "currency": "coupon", "amount": 5, "note": "x"}).
		expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.get("/api/admin/accounts?q="+u, bearerHeader(targetToken)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	for _, bad := range []map[string]any{
		{"username": "target_" + u, "currency": "gold", "amount": 5, "note": "x"},
		{"username": "target_" + u, "currency": "coupon", "amount": 0, "note": "x"},
		{"username": "target_" + u, "currency": "coupon", "amount": 2_000_000_000, "note": "x"},
	} {
		grant(adminToken, bad).expect(t, http.StatusBadRequest, "INVALID_GRANT")
	}
	grant(adminToken, map[string]any{"username": "target_" + u, "currency": "coupon", "amount": 5, "note": ""}).
		expect(t, http.StatusBadRequest, "INVALID_NOTE")
	grant(adminToken, map[string]any{"username": "nobody_" + u, "currency": "coupon", "amount": 5, "note": "x"}).
		expect(t, http.StatusNotFound, "ACCOUNT_NOT_FOUND")

	request := uuid()
	first := ok(map[string]any{"username": "TARGET_" + u, "currency": "coupon", "amount": 500, "note": "活动补偿", "requestId": request})
	if first.Applied != 500 || first.Duplicate || first.Account.Wallet.Coupon != 500 || first.RequestID != request {
		t.Fatalf("grant %+v", first)
	}
	var ref, note string
	if err := h.db.QueryRow("SELECT ref_id, note FROM wallet_ledger WHERE account_id = ? AND reason = 'admin'", targetID).
		Scan(&ref, &note); err != nil || ref != chief+":"+request || note != "活动补偿" {
		t.Fatalf("ledger %q %q %v", ref, note, err)
	}
	if again := ok(map[string]any{"username": "target_" + u, "currency": "coupon", "amount": 500, "note": "活动补偿", "requestId": request}); !again.Duplicate ||
		again.Applied != 0 || again.Account.Wallet.Coupon != 500 {
		t.Fatalf("replayed grant %+v", again)
	}
	grant(adminToken, map[string]any{"username": "target_" + u, "currency": "coupon", "amount": -501, "note": "扣除"}).
		expect(t, http.StatusConflict, "INSUFFICIENT_FUNDS")
	if taken := ok(map[string]any{"username": "target_" + u, "currency": "coupon", "amount": -500, "note": "扣除"}); taken.Applied != -500 ||
		taken.Account.Wallet.Coupon != 0 {
		t.Fatalf("deduction %+v", taken)
	}
	ok(map[string]any{"username": "target_" + u, "currency": "koin", "amount": 30, "note": "k"})
	ok(map[string]any{"username": "target_" + u, "currency": "lucci", "amount": 7, "note": "l"})
	// Exp grants level up with rewards; exp never goes below zero.
	levelled := ok(map[string]any{"username": "target_" + u, "currency": "exp", "amount": 300, "note": "经验"})
	if levelled.Applied != 300 || levelled.Account.Level != 4 || len(levelled.LevelUps) != 3 ||
		levelled.Account.Wallet != (store.Wallet{Lucci: 7 + 900, Koin: 30 + 20}) {
		t.Fatalf("exp grant %+v", levelled)
	}
	grant(adminToken, map[string]any{"username": "target_" + u, "currency": "exp", "amount": -301, "note": "x"}).
		expect(t, http.StatusConflict, "INSUFFICIENT_EXP")
	if down := ok(map[string]any{"username": "target_" + u, "currency": "exp", "amount": -300, "note": "x"}); down.Account.Level != 1 {
		t.Fatalf("exp deduction %+v", down)
	}
	// Levels already rewarded are not rewarded again.
	if again := ok(map[string]any{"username": "target_" + u, "currency": "exp", "amount": 300, "note": "x"}); len(again.LevelUps) != 0 ||
		again.Account.Wallet.Lucci != 907 {
		t.Fatalf("re-levelling %+v", again)
	}
	if n := h.count("SELECT COUNT(*) FROM exp_ledger WHERE account_id = ? AND reason = 'admin'", targetID); n != 3 {
		t.Fatalf("%d exp ledger rows", n)
	}

	var found struct {
		Accounts []struct {
			ID       string
			Username string
			Level    int
			Wallet   store.Wallet
		}
	}
	h.get("/api/admin/accounts?q=arget_"+u, bearerHeader(adminToken)).expect(t, http.StatusOK, "").json(t, &found)
	if len(found.Accounts) != 1 || found.Accounts[0].ID != targetID || found.Accounts[0].Level != 4 || found.Accounts[0].Wallet.Koin != 50 {
		t.Fatalf("search %+v", found)
	}
	// LIKE metacharacters are literal.
	h.get("/api/admin/accounts?q=%25", bearerHeader(adminToken)).expect(t, http.StatusOK, "")
	h.get("/api/admin/accounts", bearerHeader(adminToken)).expect(t, http.StatusOK, "")

	// The console page and its script.
	page := h.get("/multiplayer/admin", nil).expect(t, http.StatusOK, "")
	if !strings.Contains(string(page.body), "管理后台") || !strings.Contains(page.header.Get("Content-Security-Policy"), "script-src 'self'") ||
		page.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("admin page %v", page.header)
	}
	if script := h.get("/multiplayer/admin/admin.js", nil).expect(t, http.StatusOK, ""); !strings.HasPrefix(script.header.Get("Content-Type"), "text/javascript") {
		t.Fatalf("admin script %v", script.header)
	}
	// Invites stay admin-only.
	var invite struct{ Invite string }
	h.post("/multiplayer/admin/invites", nil, bearerHeader(adminToken)).expect(t, http.StatusOK, "").json(t, &invite)
	h.cleanup("DELETE FROM invites WHERE code_hash = ?", digest(invite.Invite))
}

// TestShopSpendEvent: GET /api/shop/spend-event reports the tcCash 累计消费
// event with the coupons the account spent on shop purchases in its event
// period (ECONOMY.md 3.4).
func TestShopSpendEvent(t *testing.T) {
	events, err := economy.DefaultEvents()
	if err != nil {
		t.Fatal(err)
	}
	if len(events.TCCashEvents) == 0 {
		t.Skip("events.json has no tcCash event")
	}
	event := &events.TCCashEvents[0]
	from, until := event.EventPeriod.Millis()
	_, shownUntil := event.RewardPeriod.Millis()
	clock := newFakeClock(time.UnixMilli(from + time.Hour.Milliseconds()))
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	u := datatest.Unique()
	id, token := h.register("spend_"+u, "Spend"+u)
	auth := bearerHeader(token)

	type spendEvent struct {
		Event *struct {
			EventType    string
			EventPeriod  struct{ Start, End string }
			RewardPeriod struct{ Start, End string }
			Steps        []struct {
				Step    int
				Value   int64
				StockID int `json:"stockId"`
				Reward  economy.EventReward
			}
		}
		Spent      int64
		Active     bool
		ServerTime int64
	}
	get := func() (spendEvent, string) {
		t.Helper()
		var body spendEvent
		result := h.get("/api/shop/spend-event", auth).expect(t, http.StatusOK, "")
		result.json(t, &body)
		return body, string(result.body)
	}
	buy := func(offerID string) {
		t.Helper()
		h.post("/api/shop/purchase", map[string]string{"offerId": offerID, "requestId": uuid()}, auth).
			expect(t, http.StatusOK, "")
	}
	ledger := func(currency, reason string, delta, at int64) {
		t.Helper()
		datatest.Exec(t, h.db, `INSERT INTO wallet_ledger(account_id, currency, delta, balance_after, reason, ref_id,
			created_at) VALUES(?, ?, ?, 0, ?, ?, ?)`, id, currency, delta, reason, "fixture-"+uuid(), at)
	}

	h.get("/api/shop/spend-event", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	got, _ := get()
	if got.Event == nil || !got.Active || got.Spent != 0 || got.ServerTime != clock.millis() ||
		got.Event.EventType != "use" || got.Event.EventPeriod.Start != event.EventPeriod.Start ||
		got.Event.RewardPeriod.End != event.RewardPeriod.End || len(got.Event.Steps) != len(event.Steps) ||
		got.Event.Steps[0].Value != event.Steps[0].Value || got.Event.Steps[0].StockID != event.Steps[0].StockID ||
		got.Event.Steps[0].Reward != event.Steps[0].Reward {
		t.Fatalf("spend event %+v", got)
	}

	// Coupon purchases count; lucci purchases, admin debits, refunds and
	// purchases outside [start, end + 1s) do not.
	_, coupon := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return item.IsAdditional && offer.Currency == economy.Coupon && offer.MinExp == 0
	})
	_, lucci := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return offer.Currency == economy.Lucci && offer.MinExp == 0 && !item.IsAdditional && offer.Price <= 10_000
	})
	h.setWallet(id, store.Wallet{Coupon: 100_000, Lucci: 100_000})
	buy(coupon.OfferID)
	buy(coupon.OfferID)
	buy(lucci.OfferID)
	ledger("coupon", store.ReasonPurchase, -500, from-1)
	ledger("coupon", store.ReasonPurchase, -7, from)
	ledger("coupon", store.ReasonPurchase, -11, until-1)
	ledger("coupon", store.ReasonPurchase, -1000, until)
	ledger("coupon", store.ReasonAdmin, -300, from+1)
	ledger("coupon", store.ReasonPurchase, 40, from+2)
	ledger("koin", store.ReasonPurchase, -9, from+3)
	spent := 2*coupon.Price + 7 + 11
	if got, _ := get(); got.Spent != spent || !got.Active {
		t.Fatalf("spent %d active %v, want %d", got.Spent, got.Active, spent)
	}

	// After the event period it is still shown (rewards are claimed until
	// the reward period ends), but spending no longer counts.
	clock.advance(time.Duration(until-clock.millis()) * time.Millisecond)
	buy(coupon.OfferID)
	if got, _ := get(); got.Event == nil || got.Active || got.Spent != spent {
		t.Fatalf("after the event period: %+v, want spent %d", got, spent)
	}
	clock.advance(time.Duration(shownUntil-clock.millis()-1) * time.Millisecond)
	if got, _ := get(); got.Event == nil || got.Active {
		t.Fatalf("last moment of the reward period: %+v", got)
	}
	// After the reward period there is no event.
	clock.advance(time.Millisecond)
	got, raw := get()
	if got.Event != nil || got.Active || got.Spent != 0 || got.ServerTime != shownUntil ||
		!strings.Contains(raw, `"event":null`) {
		t.Fatalf("after the reward period: %s", raw)
	}
}
