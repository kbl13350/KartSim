package api

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
)

// The console page is the embedded build's index.html behind the strict
// page policy; its assets are served from assets/ only.
func TestAdminConsoleFiles(t *testing.T) {
	embedded, err := fs.ReadFile(adminUI, "adminui/index.html")
	if err != nil || !strings.Contains(string(embedded), "管理后台") {
		t.Fatalf("embedded index.html: %v", err)
	}
	h := newHarness(t, harnessOptions{})
	page := h.get("/multiplayer/admin", nil).expect(t, http.StatusOK, "")
	policy := page.header.Get("Content-Security-Policy")
	if string(page.body) != string(embedded) || !strings.HasPrefix(page.header.Get("Content-Type"), "text/html") ||
		page.header.Get("Cache-Control") != "no-store" || page.header.Get("X-Content-Type-Options") != "nosniff" ||
		!strings.Contains(policy, "script-src 'self';") || !strings.Contains(policy, "font-src 'self';") ||
		strings.Contains(policy, "unsafe-eval") || strings.Contains(policy, "script-src 'self' 'unsafe-inline'") ||
		page.header.Get("X-Frame-Options") != "DENY" {
		t.Fatalf("admin page %v", page.header)
	}

	built := adminFiles
	t.Cleanup(func() { adminFiles = built })
	adminFiles = fstest.MapFS{
		"index.html":                 {Data: []byte("<!doctype html><title>管理后台</title>")},
		"assets/index-Ab12.js":       {Data: []byte("console.log(1)")},
		"assets/index-Cd34.css":      {Data: []byte("body{}")},
		"assets/fonts/icons-9.woff2": {Data: []byte("wOF2")},
		"assets/data.bin":            {Data: []byte{0}},
		"secret.txt":                 {Data: []byte("not an asset")},
	}
	for path, contentType := range map[string]string{
		"index-Ab12.js": "text/javascript; charset=utf-8", "index-Cd34.css": "text/css; charset=utf-8",
		"fonts/icons-9.woff2": "font/woff2", "data.bin": "application/octet-stream",
	} {
		asset := h.get("/multiplayer/admin/assets/"+path, nil).expect(t, http.StatusOK, "")
		if asset.header.Get("Content-Type") != contentType || asset.header.Get("X-Content-Type-Options") != "nosniff" ||
			asset.header.Get("Cache-Control") != "public, max-age=31536000, immutable" {
			t.Fatalf("asset %s: %v", path, asset.header)
		}
	}
	// Missing files, directories and anything outside assets/ are 404.
	for _, path := range []string{"missing.js", "fonts", "fonts/", "..%2fsecret.txt", "%2e%2e/secret.txt",
		"fonts/..%2f..%2fsecret.txt", "..%5csecret.txt", "%2fsecret.txt"} {
		if response := h.get("/multiplayer/admin/assets/"+path, nil); response.status != http.StatusNotFound ||
			strings.Contains(string(response.body), "not an asset") {
			t.Fatalf("asset %s: %d %s", path, response.status, response.body)
		}
	}
	// The old console script is gone.
	h.get("/multiplayer/admin/admin.js", nil).expect(t, http.StatusNotFound, "NOT_FOUND")
}

// adminHarness is a MySQL harness with a signed-in admin.
type adminHarness struct {
	*harness
	u             string
	adminID       string
	adminName     string
	adminHeader   map[string]string
	listedAdmin   string // a KART_ADMIN_USERNAMES name
	listedAdminID string
}

func newAdminHarness(t *testing.T, opts harnessOptions) *adminHarness {
	t.Helper()
	u := datatest.Unique()
	opts.mysql = true
	opts.admins = append(opts.admins, "listed_"+u)
	h := &adminHarness{harness: newHarness(t, opts), u: u, adminName: "chief_" + u}
	h.adminID = h.account(h.adminName, "管理员"+u, password, true)
	h.listedAdmin = "listed_" + u
	h.listedAdminID = h.account(h.listedAdmin, "名单"+u, password, false)
	var login struct{ Token string }
	h.post("/multiplayer/auth/login", map[string]any{"username": h.adminName, "password": password, "console": true}, nil).
		expect(t, http.StatusOK, "").json(t, &login)
	h.adminHeader = bearerHeader(login.Token)
	return h
}

func (h *adminHarness) adminGet(path string, target any) response {
	h.t.Helper()
	response := h.get(path, h.adminHeader).expect(h.t, http.StatusOK, "")
	if target != nil {
		response.json(h.t, target)
	}
	return response
}

func (h *adminHarness) patch(id string, body any) response {
	h.t.Helper()
	return send(h.t, http.MethodPatch, h.public.URL+"/api/admin/accounts/"+id, body, h.adminHeader)
}

type accountRowBody struct {
	ID          string
	Username    string
	Nickname    string
	Admin       bool
	CreatedAt   int64
	RegisterIP  string
	LastLoginAt *int64
	LastLoginIP string
	BannedUntil *int64
	BanReason   string
	Banned      bool
	Level       int
	Exp         int64
	Coupon      int64
	Lucci       int64
	Koin        int64
	Online      *adminOnlineJSON
}

type accountListBody struct {
	Items    []accountRowBody
	Total    int
	Page     int
	PageSize int
}

// Every admin endpoint needs an admin session.
func TestAdminEndpointsNeedAnAdmin(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	player := h.account("player_"+h.u, "玩家"+h.u, password, false)
	token := h.login("player_"+h.u, password)
	for _, path := range []string{"/api/admin/me", "/api/admin/overview", "/api/admin/accounts",
		"/api/admin/accounts/" + player, "/api/admin/accounts/" + player + "/inventory", "/api/admin/logins",
		"/api/admin/online", "/api/admin/nodes", "/api/admin/ledger", "/api/admin/grants", "/api/admin/races",
		"/api/admin/purchases", "/api/admin/lottery-draws", "/api/admin/box-openings", "/api/admin/clubs"} {
		h.get(path, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
		h.get(path, bearerHeader(token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	}
	send(t, http.MethodPatch, h.public.URL+"/api/admin/accounts/"+player, map[string]any{"admin": true},
		bearerHeader(token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.post("/api/admin/accounts/"+player+"/kick", nil, bearerHeader(token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")

	var me map[string]string
	h.adminGet("/api/admin/me", &me)
	if me["id"] != h.adminID || me["username"] != h.adminName || me["nickname"] != "管理员"+h.u {
		t.Fatalf("me %v", me)
	}
	// A KART_ADMIN_USERNAMES account is an admin without the stored flag.
	listed := h.login(h.listedAdmin, password)
	h.get("/api/admin/me", bearerHeader(listed)).expect(t, http.StatusOK, "")
}

// Registrations and logins are recorded with the client address and
// browser; the account list shows them, pages, sorts and filters.
func TestAdminAccountListAndLoginRecords(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	agent := "Mozilla/5.0 (" + strings.Repeat("长", 100) + ")"
	from := func(ip string) map[string]string {
		return map[string]string{"X-Forwarded-For": ip, "User-Agent": agent}
	}
	h.post("/multiplayer/auth/register", map[string]string{"username": "rec_" + u, "nickname": "记录" + u,
		"password": password}, from("203.0.113.9")).expect(t, http.StatusOK, "")
	id := h.accountID("rec_" + u)
	h.post("/multiplayer/auth/login", map[string]string{"username": "rec_" + u, "password": password},
		from("2001:db8::7")).expect(t, http.StatusOK, "")
	h.post("/multiplayer/auth/login", map[string]string{"username": "rec_" + u, "password": "wrong-password"},
		from("198.51.100.1")).expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	var storedAgent string
	if err := h.db.QueryRow("SELECT user_agent FROM login_records WHERE account_id = ? AND kind = 'register'", id).
		Scan(&storedAgent); err != nil || len(storedAgent) > maxUserAgent || !strings.HasPrefix(agent, storedAgent) ||
		len(storedAgent) < maxUserAgent-3 {
		t.Fatalf("user agent %q (%d bytes), %v", storedAgent, len(storedAgent), err)
	}

	var list accountListBody
	h.adminGet("/api/admin/accounts?q=rec_"+u, &list)
	if list.Total != 1 || len(list.Items) != 1 || list.Page != 1 || list.PageSize != 20 {
		t.Fatalf("list %+v", list)
	}
	row := list.Items[0]
	if row.ID != id || row.Nickname != "记录"+u || row.RegisterIP != "203.0.113.9" || row.LastLoginIP != "2001:db8::7" ||
		row.LastLoginAt == nil || *row.LastLoginAt < row.CreatedAt || row.Banned || row.BannedUntil != nil ||
		row.Online != nil || row.Level != 1 || row.Lucci != store.DefaultStartingLucci {
		t.Fatalf("row %+v", row)
	}
	// q also matches addresses (LIKE metacharacters stay literal).
	h.adminGet("/api/admin/accounts?q=2001:db8::7", &list)
	if list.Total != 1 || list.Items[0].ID != id {
		t.Fatalf("by address %+v", list)
	}
	h.adminGet("/api/admin/accounts?q="+url.QueryEscape("rec%"+u), &list)
	if list.Total != 0 {
		t.Fatalf("wildcard %+v", list)
	}

	// Paging and sorting.
	for i := range 3 {
		h.account("page"+string(rune('a'+i))+"_"+u, "分页"+string(rune('a'+i))+u, password, false)
		time.Sleep(2 * time.Millisecond)
	}
	datatest.Exec(t, h.db, "UPDATE accounts SET created_at = created_at + ? WHERE username = ?", 10, "pagec_"+u)
	h.adminGet("/api/admin/accounts?pageSize=2&q="+url.QueryEscape("_"+u)+"&sort=createdAt&order=asc", &list)
	if list.Total != 6 || len(list.Items) != 2 || list.PageSize != 2 || list.Items[0].CreatedAt > list.Items[1].CreatedAt {
		t.Fatalf("first page %+v", list)
	}
	h.adminGet("/api/admin/accounts?page=3&pageSize=2&q="+url.QueryEscape("_"+u)+"&sort=createdAt&order=asc", &list)
	if len(list.Items) != 2 || list.Page != 3 || list.Items[1].Username != "pagec_"+u {
		t.Fatalf("last page %+v", list)
	}
	h.adminGet("/api/admin/accounts?page=4&pageSize=2&q="+url.QueryEscape("_"+u), &list)
	if len(list.Items) != 0 || list.Total != 6 {
		t.Fatalf("past the end %+v", list)
	}
	h.setWallet(id, store.Wallet{Coupon: 9_999_999})
	h.adminGet("/api/admin/accounts?pageSize=1&sort=coupon&q="+url.QueryEscape("_"+u), &list)
	if list.Items[0].ID != id || list.Items[0].Coupon != 9_999_999 {
		t.Fatalf("by coupon %+v", list)
	}
	// Filters: admins (stored flag and KART_ADMIN_USERNAMES), banned, from/to.
	h.adminGet("/api/admin/accounts?admin=1&q="+url.QueryEscape("_"+u), &list)
	if list.Total != 2 {
		t.Fatalf("admins %+v", list)
	}
	for _, item := range list.Items {
		if !item.Admin || (item.ID != h.adminID && item.ID != h.listedAdminID) {
			t.Fatalf("admin row %+v", item)
		}
	}
	h.adminGet("/api/admin/accounts?banned=1&q="+url.QueryEscape("_"+u), &list)
	if list.Total != 0 {
		t.Fatalf("banned %+v", list)
	}
	at := strconv.FormatInt(row.CreatedAt, 10)
	h.adminGet("/api/admin/accounts?q="+url.QueryEscape("_"+u)+"&from="+at+"&to="+at, &list)
	if list.Total < 1 {
		t.Fatalf("by time %+v", list)
	}
	for _, query := range []string{"page=0", "pageSize=101", "pageSize=x", "sort=nickname", "order=up", "online=2",
		"from=-1", "q=" + strings.Repeat("长", 65), "q=%FF"} {
		h.get("/api/admin/accounts?"+query, h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
	}

	// The login records.
	var logins struct {
		Items []loginRowJSON
		Total int
	}
	h.adminGet("/api/admin/logins?account=REC_"+u, &logins)
	if logins.Total != 2 || logins.Items[0].Kind != "login" || logins.Items[0].IP != "2001:db8::7" ||
		logins.Items[1].Kind != "register" || logins.Items[1].IP != "203.0.113.9" || logins.Items[1].Username != "rec_"+u ||
		logins.Items[0].UserAgent != storedAgent || logins.Items[0].At < logins.Items[1].At {
		t.Fatalf("logins %+v", logins)
	}
	h.adminGet("/api/admin/logins?kind=register&account="+id, &logins)
	if logins.Total != 1 || logins.Items[0].AccountID != id {
		t.Fatalf("registrations %+v", logins)
	}
	h.adminGet("/api/admin/logins?ip=203.0.113.9&q="+url.QueryEscape("记录"+u), &logins)
	if logins.Total != 1 {
		t.Fatalf("by address %+v", logins)
	}
	h.adminGet("/api/admin/logins?account=nobody_"+u, &logins)
	if logins.Total != 0 || logins.Items == nil {
		t.Fatalf("unknown account %+v", logins)
	}
	h.get("/api/admin/logins?kind=logout", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
}

// Editing an account: nickname, admin flag, password and bans, with the
// self-protection rules; bans and kicks end every session and the game
// session.
func TestAdminEditBanAndKick(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	targetName, targetNick := "target_"+u, "目标"+u
	target := h.account(targetName, targetNick, password, false)
	other := "其他" + u
	h.account("other_"+u, other, password, false)
	token := h.login(targetName, password)
	h.get("/api/account", bearerHeader(token)).expect(t, http.StatusOK, "") // the session is cached

	var row accountRowBody
	h.patch(target, map[string]any{"nickname": "a<b"}).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	h.patch(target, map[string]any{"nickname": strings.ToUpper(other)}).expect(t, http.StatusConflict, "NICKNAME_TAKEN")
	h.patch(target, map[string]any{"password": "short"}).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	h.patch(target, map[string]any{"banReason": strings.Repeat("因", 201)}).
		expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	h.patch(target, map[string]any{"bannedUntil": -1}).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_FIELDS")
	h.patch(target, "{").expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.patch("no-such-account", map[string]any{"admin": true}).expect(t, http.StatusNotFound, "ACCOUNT_NOT_FOUND")
	h.patch(h.adminID, map[string]any{"admin": false}).expect(t, http.StatusConflict, "CANNOT_MODIFY_SELF")
	h.patch(h.adminID, map[string]any{"bannedUntil": time.Now().Add(time.Hour).UnixMilli()}).
		expect(t, http.StatusConflict, "CANNOT_MODIFY_SELF")
	h.patch(h.adminID, map[string]any{"nickname": "新管理员" + u}).expect(t, http.StatusOK, "")

	h.patch(target, map[string]any{"nickname": "改名" + u, "admin": true}).expect(t, http.StatusOK, "").json(t, &row)
	if row.Nickname != "改名"+u || !row.Admin {
		t.Fatalf("edited %+v", row)
	}
	// The cached account follows the edit.
	var me struct{ Account publicAccount }
	h.get("/multiplayer/auth/me", bearerHeader(token)).expect(t, http.StatusOK, "").json(t, &me)
	if me.Account.Nickname != "改名"+u || !me.Account.Admin {
		t.Fatalf("me after edit %+v", me)
	}
	h.patch(target, map[string]any{"admin": false}).expect(t, http.StatusOK, "").json(t, &row)
	if row.Admin {
		t.Fatalf("admin flag kept %+v", row)
	}
	// A KART_ADMIN_USERNAMES admin stays one whatever the stored flag.
	h.patch(h.listedAdminID, map[string]any{"admin": false}).expect(t, http.StatusOK, "").json(t, &row)
	if !row.Admin {
		t.Fatalf("listed admin %+v", row)
	}

	// A ban ends the sessions (also the cached one), the messenger and the
	// game session; the login is refused only after the password.
	h.heartbeat("node-ban", "Ban", "", 10)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "node-ban", PlayerID: "p-ban",
		Name: "改名" + u, AccountID: target}).expect(t, http.StatusOK, "")
	h.heartbeat("node-ban", "Ban", "", 10, contract.OnlinePlayer{PlayerID: "p-ban", Name: "改名" + u})
	h.adminGet("/api/admin/accounts/"+target, nil)
	var detail struct {
		Account  accountRowBody
		Sessions int
	}
	h.adminGet("/api/admin/accounts/"+target, &detail)
	if detail.Sessions != 1 || detail.Account.Online == nil || detail.Account.Online.NodeID != "node-ban" ||
		detail.Account.Online.NodeName != "Ban" {
		t.Fatalf("detail before the ban %+v", detail)
	}
	until := time.Now().Add(24 * time.Hour).UnixMilli()
	h.patch(target, map[string]any{"bannedUntil": until, "banReason": " 外挂 "}).expect(t, http.StatusOK, "").json(t, &row)
	if !row.Banned || row.BannedUntil == nil || *row.BannedUntil != until || row.BanReason != "外挂" || row.Online != nil {
		t.Fatalf("banned %+v", row)
	}
	h.get("/api/account", bearerHeader(token)).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	var beat contract.HeartbeatResponse
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "node-ban", Name: "Ban", Capacity: 10,
		Players:         []contract.OnlinePlayer{{PlayerID: "p-ban", Name: "改名" + u}},
		ProtocolVersion: contract.ProtocolVersion}).expect(t, http.StatusOK, "").json(t, &beat)
	if len(beat.Conflicts) != 1 || beat.Conflicts[0] != "p-ban" {
		t.Fatalf("conflicts %v", beat.Conflicts)
	}
	h.post("/multiplayer/auth/login", map[string]string{"username": targetName, "password": "wrong-password"}, nil).
		expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	refused := h.post("/multiplayer/auth/login", map[string]string{"username": targetName, "password": password}, nil).
		expect(t, http.StatusForbidden, "ACCOUNT_BANNED")
	var ban struct {
		Error  string
		Until  int64
		Reason string
	}
	refused.json(t, &ban)
	if ban.Until != until || ban.Reason != "外挂" {
		t.Fatalf("ban answer %s", refused.body)
	}
	if n := h.count("SELECT COUNT(*) FROM sessions WHERE account_id = ?", target); n != 0 {
		t.Fatalf("%d sessions of a banned account", n)
	}
	// An entry ticket issued before the ban does not get it back into a game.
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "node-ban", PlayerID: "p-back",
		Name: "改名" + u, AccountID: target}).expect(t, http.StatusForbidden, "ACCOUNT_BANNED")
	var banned accountListBody
	h.adminGet("/api/admin/accounts?banned=1&q="+url.QueryEscape("_"+u), &banned)
	if banned.Total != 1 || banned.Items[0].ID != target {
		t.Fatalf("banned list %+v", banned)
	}

	// Lifting the ban clears the reason; a time already past lifts it too.
	h.patch(target, map[string]any{"bannedUntil": 0}).expect(t, http.StatusOK, "").json(t, &row)
	if row.Banned || row.BannedUntil != nil || row.BanReason != "" {
		t.Fatalf("unbanned %+v", row)
	}
	h.patch(target, map[string]any{"bannedUntil": time.Now().Add(-time.Hour).UnixMilli(), "banReason": "旧"}).
		expect(t, http.StatusOK, "").json(t, &row)
	if row.Banned || row.BannedUntil != nil || row.BanReason != "旧" {
		t.Fatalf("past ban %+v", row)
	}
	token = h.login(targetName, password)

	// A new password ends the sessions; the old password stops working.
	h.patch(target, map[string]any{"password": "new-password-456"}).expect(t, http.StatusOK, "")
	h.get("/api/account", bearerHeader(token)).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/multiplayer/auth/login", map[string]string{"username": targetName, "password": password}, nil).
		expect(t, http.StatusUnauthorized, "INVALID_CREDENTIALS")
	token = h.login(targetName, "new-password-456")

	// Kicks: the session ends and its messenger socket closes.
	messenger, _ := h.openMessenger(token)
	var kicked struct {
		Sessions int
		Game     bool
	}
	h.post("/api/admin/accounts/"+target+"/kick", nil, h.adminHeader).expect(t, http.StatusOK, "").json(t, &kicked)
	if kicked.Sessions != 1 || kicked.Game {
		t.Fatalf("kick %+v", kicked)
	}
	messenger.expectClose(4001)
	h.get("/api/account", bearerHeader(token)).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/admin/accounts/"+h.adminID+"/kick", nil, h.adminHeader).expect(t, http.StatusConflict, "CANNOT_MODIFY_SELF")
	h.post("/api/admin/accounts/no-such-account/kick", nil, h.adminHeader).expect(t, http.StatusNotFound, "ACCOUNT_NOT_FOUND")

	// The detail: club, sessions, logins and races.
	h.settle(contract.RaceSettlement{
		NodeID: "game-1", RaceID: "adm-race-" + u, RoomID: "room-" + u, Gameplay: "ordinary", TrackID: "village_R01",
		Snapshot: json.RawMessage(`{}`), FinishedAt: time.Now().UnixMilli(),
		Results: []contract.RaceResult{
			{PlayerID: "p1-" + u, AccountID: target, Name: "改名" + u, Rank: 1, ElapsedMs: elapsed(70_000), Points: 10},
			{PlayerID: "p2-" + u, Name: "Guest" + u, Rank: 2, Points: 0},
		},
		Rewards: []contract.RaceReward{{PlayerID: "p1-" + u, AccountID: target, Exp: 40, Lucci: 60}},
	})
	var full struct {
		Account  accountRowBody
		Club     *struct{ ID int64 }
		Sessions int
		Logins   []loginRowJSON
		Races    []raceParticipantJSON
	}
	h.adminGet("/api/admin/accounts/"+target, &full)
	if full.Account.ID != target || full.Club != nil || full.Sessions != 0 || len(full.Logins) != 3 ||
		len(full.Races) != 1 || full.Races[0].Rank != 1 || full.Races[0].Exp == nil || *full.Races[0].Exp != 40 ||
		full.Races[0].Lucci == nil || *full.Races[0].Lucci != 60 || full.Races[0].Username != targetName {
		t.Fatalf("detail %+v", full)
	}
	h.get("/api/admin/accounts/no-such-account", h.adminHeader).expect(t, http.StatusNotFound, "ACCOUNT_NOT_FOUND")
}

// The inventory, ledgers, grants, races, purchases, lottery draws, box
// openings and clubs lists.
func TestAdminRecordLists(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	name := "rich_" + u
	id := h.account(name, "富翁"+u, password, false)
	now := time.Now().UnixMilli()

	// Inventory rows are named from the item tables.
	for _, item := range [][2]int{{1, 1}, {3, 1}, {24, 2}} {
		datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, quantity, source, created_at,
			updated_at) VALUES(?, ?, ?, 1, 'test', ?, ?)`, id, item[0], item[1], now, now+int64(item[0]))
	}
	var inventory struct {
		Items []inventoryRowJSON
		Total int
	}
	h.adminGet("/api/admin/accounts/"+id+"/inventory", &inventory)
	if inventory.Total != 3 || inventory.Items[0].Name != "迷你宝箱" || inventory.Items[2].Name != "宝宝" ||
		inventory.Items[2].CategoryName != "角色" || inventory.Items[0].CategoryName != "宝箱与抽奖" {
		t.Fatalf("inventory %+v", inventory)
	}
	h.adminGet("/api/admin/accounts/"+id+"/inventory?category=1", &inventory)
	if inventory.Total != 1 || inventory.Items[0].ItemID != 1 {
		t.Fatalf("by category %+v", inventory)
	}
	h.adminGet("/api/admin/accounts/"+id+"/inventory?q="+url.QueryEscape("宝宝"), &inventory)
	if inventory.Total != 1 || inventory.Items[0].Category != 1 {
		t.Fatalf("by name %+v", inventory)
	}
	h.adminGet("/api/admin/accounts/"+id+"/inventory?pageSize=1&page=2&sort=category&order=asc", &inventory)
	if inventory.Total != 3 || len(inventory.Items) != 1 || inventory.Items[0].Category != 3 {
		t.Fatalf("paged %+v", inventory)
	}

	// Grants write ledger rows; the grants list takes their notes.
	grant := func(currency string, amount int64, note string) {
		h.post("/api/admin/grant", map[string]any{"username": name, "currency": currency, "amount": amount, "note": note},
			h.adminHeader).expect(t, http.StatusOK, "")
	}
	grant("coupon", 500, "补偿"+u)
	time.Sleep(2 * time.Millisecond) // the exp grant is the later one
	grant("exp", 10, "经验"+u)
	var ledger struct {
		Items []ledgerRowJSON
		Total int
	}
	h.adminGet("/api/admin/ledger?reason=admin&account="+name, &ledger)
	if ledger.Total != 2 || ledger.Items[0].Currency != "exp" || !strings.HasPrefix(ledger.Items[0].ID, "e") ||
		ledger.Items[0].Note != "经验"+u || ledger.Items[1].Currency != "coupon" || ledger.Items[1].Delta != 500 ||
		!strings.HasPrefix(ledger.Items[1].ID, "w") || ledger.Items[1].BalanceAfter != 500 ||
		ledger.Items[1].Username != name {
		t.Fatalf("ledger %+v", ledger)
	}
	h.adminGet("/api/admin/ledger?currency=exp&account="+id, &ledger)
	if ledger.Total != 1 || ledger.Items[0].Delta != 10 {
		t.Fatalf("exp ledger %+v", ledger)
	}
	h.adminGet("/api/admin/ledger?account="+name+"&q="+url.QueryEscape("补偿"), &ledger)
	if ledger.Total != 1 || ledger.Items[0].Currency != "coupon" {
		t.Fatalf("by note %+v", ledger)
	}
	// Paging the merged ledgers (the starting lucci, the coupon, the exp).
	h.adminGet("/api/admin/ledger?account="+name+"&pageSize=1&page=3&order=asc", &ledger)
	if ledger.Total != 3 || len(ledger.Items) != 1 || ledger.Items[0].Currency != "exp" {
		t.Fatalf("ledger page %+v", ledger)
	}
	h.get("/api/admin/ledger?currency=gold", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
	var grants struct {
		Items []grantRowJSON
		Total int
	}
	h.adminGet("/api/admin/grants?account="+name, &grants)
	if grants.Total != 2 || grants.Items[0].Note != "经验"+u || grants.Items[1].Note != "补偿"+u ||
		grants.Items[1].Admin != h.adminName || grants.Items[1].Amount != 500 {
		t.Fatalf("grants %+v", grants)
	}
	h.adminGet("/api/admin/grants?currency=coupon&admin="+h.adminName, &grants)
	if grants.Total < 1 || grants.Items[0].Currency != "coupon" {
		t.Fatalf("grants by admin %+v", grants)
	}

	// Races.
	h.settle(contract.RaceSettlement{
		NodeID: "game-1", RaceID: "list-race-" + u, RoomID: "room-" + u, Gameplay: "ordinary", TrackID: "village_R01",
		Snapshot: json.RawMessage(`{}`), FinishedAt: now,
		Results: []contract.RaceResult{
			{PlayerID: "g-" + u, Name: "Guest" + u, Rank: 2, Points: 8, ElapsedMs: elapsed(80_000)},
			{PlayerID: "a-" + u, AccountID: id, Name: "富翁" + u, Rank: 1, ElapsedMs: elapsed(70_000), Points: 10},
		},
	})
	var races struct {
		Items []raceRowJSON
		Total int
	}
	h.adminGet("/api/admin/races?account="+name, &races)
	if races.Total != 1 || races.Items[0].Players != 2 || len(races.Items[0].Participants) != 2 ||
		races.Items[0].Participants[0].Rank != 1 || races.Items[0].Participants[0].AccountID != id ||
		races.Items[0].Participants[1].AccountID != "" || races.Items[0].Participants[1].Exp != nil ||
		races.Items[0].TrackName == "" {
		t.Fatalf("races %+v", races)
	}
	h.adminGet("/api/admin/races?gameplay=ordinary&track=village_R01&q="+url.QueryEscape("room-"+u), &races)
	if races.Total != 1 {
		t.Fatalf("races by gameplay %+v", races)
	}
	h.adminGet("/api/admin/races?gameplay=roadblock&q="+url.QueryEscape("room-"+u), &races)
	if races.Total != 0 {
		t.Fatalf("other gameplay %+v", races)
	}

	// Purchases, draws and openings (stored rows, named here).
	datatest.Exec(t, h.db, `INSERT INTO purchases(account_id, request_id, offer_id, category, item_id, currency, price,
		days, count, catalog_version, result_json, created_at) VALUES(?, 'req-1', 's18', 1, 1, 'coupon', 20, 1, 1, 'v', '{}', ?)`,
		id, now)
	var purchases struct {
		Items []purchaseRowJSON
		Total int
	}
	h.adminGet("/api/admin/purchases?account="+name+"&currency=coupon", &purchases)
	if purchases.Total != 1 || purchases.Items[0].Name != "宝宝" || purchases.Items[0].Price != 20 ||
		purchases.Items[0].OfferID != "s18" {
		t.Fatalf("purchases %+v", purchases)
	}
	draw, _ := json.Marshal(store.DrawResult{Draws: []store.Draw{
		{Items: []store.DrawnItem{{Category: 1, ItemID: 1, Count: 1}}},
		{Items: []store.DrawnItem{{Category: 9, ItemID: 2, Name: "测试气球", Count: 1, Days: 7}}},
		{Items: []store.DrawnItem{{Category: 9, ItemID: 2, Name: "测试气球", Count: 1, Days: 7}}},
	}, Stopped: &store.DrawStop{Code: store.StopInsufficient}})
	datatest.Exec(t, h.db, `INSERT INTO lottery_draws(account_id, request_id, kind, ref, count, result_json, created_at)
		VALUES(?, ?, 'treasure', 1, 5, ?, ?)`, id, newUUID(), string(draw), now)
	var draws struct {
		Items []struct {
			Kind    string
			RefName string
			Summary string
			Result  struct{ Draws []json.RawMessage }
		}
		Total int
	}
	h.adminGet("/api/admin/lottery-draws?kind=treasure&account="+name, &draws)
	if draws.Total != 1 || draws.Items[0].Summary != "寻宝 3 次：宝宝、测试气球（7天）×2；提前停止（材料不足）" ||
		len(draws.Items[0].Result.Draws) != 3 || draws.Items[0].RefName != "寻宝" {
		t.Fatalf("draws %+v", draws)
	}
	h.get("/api/admin/lottery-draws?kind=dice", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
	opening, _ := json.Marshal(store.BoxOpening{Box: 2, StockID: 7, Rewards: []store.BoxReward{
		{Category: 1, ItemID: 1, Count: 1}}})
	datatest.Exec(t, h.db, `INSERT INTO box_openings(account_id, request_id, box_id, stock_id, result_json, created_at)
		VALUES(?, ?, 2, 7, ?, ?)`, id, newUUID(), string(opening), now)
	var boxes struct {
		Items []struct {
			BoxID   int
			BoxName string
			StockID int
			Summary string
		}
		Total int
	}
	h.adminGet("/api/admin/box-openings?box=2&account="+name, &boxes)
	if boxes.Total != 1 || boxes.Items[0].BoxName != "迷你宝箱" || boxes.Items[0].StockID != 7 ||
		boxes.Items[0].Summary != "开启 迷你宝箱：宝宝" {
		t.Fatalf("boxes %+v", boxes)
	}

	// Clubs.
	var clubID int64
	result, err := h.db.Exec(`INSERT INTO clubs(name, intro, mark, frame, master_id, cs, cs_week, week, created_at,
		updated_at) VALUES(?, '', 1, 1, ?, 30, 7, 'old-week', ?, ?)`, "车队"+u, id, now, now)
	if err != nil {
		t.Fatal(err)
	}
	clubID, _ = result.LastInsertId()
	h.cleanup("DELETE FROM clubs WHERE id = ?", clubID)
	datatest.Exec(t, h.db, "INSERT INTO club_members(account_id, club_id, grade, joined_at) VALUES(?, ?, 1, ?)", id, clubID, now)
	var clubs struct {
		Items []clubRowJSON
		Total int
	}
	h.adminGet("/api/admin/clubs?q="+url.QueryEscape("车队"+u), &clubs)
	if clubs.Total != 1 || clubs.Items[0].MasterUsername != name || clubs.Items[0].Members != 1 ||
		clubs.Items[0].CS != 30 || clubs.Items[0].CSWeek != 0 || clubs.Items[0].BreakAt != nil {
		t.Fatalf("clubs %+v", clubs)
	}
	h.adminGet("/api/admin/clubs?sort=members&q="+url.QueryEscape(name), &clubs)
	if clubs.Total != 1 {
		t.Fatalf("clubs by master %+v", clubs)
	}
	var detail struct {
		Club *struct {
			ID    int64
			Name  string
			Grade int
		}
	}
	h.adminGet("/api/admin/accounts/"+id, &detail)
	if detail.Club == nil || detail.Club.ID != clubID || detail.Club.Grade != 1 {
		t.Fatalf("detail club %+v", detail.Club)
	}

	// Every list takes each of its sort keys in both orders with a search
	// and a time range, and refuses other keys.
	for path, sorts := range map[string][]string{
		"/api/admin/accounts":                      {"createdAt", "lastLoginAt", "level", "coupon", "lucci", "koin"},
		"/api/admin/accounts/" + id + "/inventory": {"updatedAt", "createdAt", "expiresAt", "category", "quantity"},
		"/api/admin/logins":                        {"at"},
		"/api/admin/online":                        {"name", "username", "node", "room"},
		"/api/admin/ledger":                        {"at", "delta"},
		"/api/admin/grants":                        {"at", "amount"},
		"/api/admin/races":                         {"at"},
		"/api/admin/purchases":                     {"at", "price"},
		"/api/admin/lottery-draws":                 {"at"},
		"/api/admin/box-openings":                  {"at"},
		"/api/admin/clubs":                         {"createdAt", "name", "members", "cs", "csWeek", "budget"},
	} {
		for _, sort := range sorts {
			for _, order := range []string{"asc", "desc"} {
				var page struct{ Items []json.RawMessage }
				h.adminGet(path+"?pageSize=5&sort="+sort+"&order="+order+"&q="+url.QueryEscape("富翁_")+
					"&from=0&to=9999999999999", &page)
				if page.Items == nil {
					t.Fatalf("%s by %s: no items array", path, sort)
				}
			}
		}
		h.get(path+"?sort=bogus", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
	}

	// The overview counts what happened today.
	var overview struct {
		Now      int64
		Accounts struct{ Total, Today, Admins, Banned int }
		Logins   struct{ Today, UniqueToday int }
		Online   *struct{ Players, Accounts, Guests int }
		Nodes    *struct{ Total, Healthy int }
		Rooms    *int
		Races    struct{ Today int }
		Coupon   struct{ SpentToday, GrantedToday int64 }

		RecentRegistrations []accountRowBody
		RecentLogins        []loginRowJSON
	}
	h.adminGet("/api/admin/overview", &overview)
	if overview.Accounts.Total < 3 || overview.Accounts.Today < 3 || overview.Accounts.Admins < 2 ||
		overview.Logins.Today < 1 || overview.Races.Today < 1 || overview.Coupon.GrantedToday < 500 ||
		overview.Online == nil || overview.Nodes == nil || overview.Rooms == nil ||
		len(overview.RecentRegistrations) == 0 || len(overview.RecentRegistrations) > 10 || len(overview.RecentLogins) == 0 {
		t.Fatalf("overview %+v", overview)
	}
}

// The online list and the node page come from the cluster registry; they,
// and the account list, keep working without Redis.
func TestAdminOnlineAndNodes(t *testing.T) {
	clock := newFakeClock(time.Now())
	h := newAdminHarness(t, harnessOptions{now: clock.now})
	u := h.u
	id := h.account("online_"+u, "在线"+u, password, false)
	h.heartbeat("node-a-"+u, "一号", "", 10)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "node-a-" + u, PlayerID: "pa",
		Name: "在线" + u, AccountID: id}).expect(t, http.StatusOK, "")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: "node-a-" + u, PlayerID: "pg",
		Name: "游客" + u, Guest: true}).expect(t, http.StatusOK, "")
	stats := &contract.NodeStats{HeapMB: 48, Goroutines: 31, Connections: 2, Races: 1, Version: "abc123"}
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "node-a-" + u, Name: "一号", Capacity: 10, Rooms: 1,
		Players:   []contract.OnlinePlayer{{PlayerID: "pa", Name: "在线" + u, Room: "快来玩"}, {PlayerID: "pg", Name: "游客" + u}},
		StartedAt: clock.millis() - 60_000, ProtocolVersion: contract.ProtocolVersion, Stats: stats}).
		expect(t, http.StatusOK, "")
	h.heartbeat("node-b-"+u, "二号", "https://b.example", 1, contract.OnlinePlayer{PlayerID: "pb", Name: "满员" + u})

	var online struct {
		Items []onlineRowJSON
		Total int
	}
	h.adminGet("/api/admin/online?q="+u, &online)
	if online.Total != 3 || online.Items[0].Name != "在线"+u || online.Items[0].Username != "online_"+u ||
		online.Items[0].Guest || online.Items[0].Room != "快来玩" || online.Items[0].NodeName != "一号" ||
		!online.Items[1].Guest || online.Items[1].AccountID != "" {
		t.Fatalf("online %+v", online)
	}
	h.adminGet("/api/admin/online?q=ONLINE_"+u, &online)
	if online.Total != 1 || online.Items[0].AccountID != id {
		t.Fatalf("online by username %+v", online)
	}
	h.adminGet("/api/admin/online?node=node-b-"+u, &online)
	if online.Total != 1 || online.Items[0].PlayerID != "pb" {
		t.Fatalf("online by node %+v", online)
	}
	var accounts accountListBody
	h.adminGet("/api/admin/accounts?online=1&q="+url.QueryEscape("_"+u), &accounts)
	if accounts.Total != 1 || accounts.Items[0].ID != id || accounts.Items[0].Online == nil ||
		accounts.Items[0].Online.NodeName != "一号" {
		t.Fatalf("online accounts %+v", accounts)
	}

	type nodeBody struct {
		NodeID string
		Origin *string
		Status string
		Stats  *contract.NodeStats
		Full   bool
	}
	var nodes struct {
		Now   int64
		Nodes []nodeBody
		Data  struct {
			Version, GoVersion string
			StartedAt          int64
			Goroutines         int
			MySQL              serviceCheck `json:"mysql"`
			Redis              serviceCheck `json:"redis"`
		}
	}
	byID := func() map[string]nodeBody {
		found := map[string]nodeBody{}
		for _, node := range nodes.Nodes {
			found[node.NodeID] = node
		}
		return found
	}
	h.adminGet("/api/admin/nodes", &nodes)
	a, b := byID()["node-a-"+u], byID()["node-b-"+u]
	if a.Status != "ok" || a.Stats == nil || *a.Stats != *stats || a.Origin != nil || b.Status != "full" || !b.Full ||
		b.Stats != nil || b.Origin == nil || *b.Origin != "https://b.example" {
		t.Fatalf("nodes %+v", nodes.Nodes)
	}
	if nodes.Data.Version == "" || !strings.HasPrefix(nodes.Data.GoVersion, "go") || nodes.Data.StartedAt == 0 ||
		nodes.Data.Goroutines == 0 || !nodes.Data.MySQL.OK || nodes.Data.MySQL.LatencyMs == nil || !nodes.Data.Redis.OK {
		t.Fatalf("data service %+v", nodes.Data)
	}
	clock.advance(11 * time.Second)
	h.adminGet("/api/admin/nodes", &nodes)
	if byID()["node-a-"+u].Status != "stale" {
		t.Fatalf("late node %+v", nodes.Nodes)
	}
	// Stats are checked like the rest of the heartbeat.
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "node-a-" + u, Capacity: 10,
		Stats: &contract.NodeStats{HeapMB: -1}}).expect(t, http.StatusBadRequest, "INVALID_HEARTBEAT")

	// Without Redis the lists still answer: nothing online, no nodes.
	h.redis.SetError("ERR down")
	t.Cleanup(func() { h.redis.SetError("") })
	h.adminGet("/api/admin/online", &online)
	if online.Total != 0 || online.Items == nil {
		t.Fatalf("online without Redis %+v", online)
	}
	h.adminGet("/api/admin/nodes", &nodes)
	if len(nodes.Nodes) != 0 || nodes.Data.Redis.OK || nodes.Data.Redis.Error == "" || !nodes.Data.MySQL.OK {
		t.Fatalf("nodes without Redis %+v", nodes)
	}
	h.adminGet("/api/admin/accounts?q="+url.QueryEscape("_"+u), &accounts)
	if accounts.Total != 3 || accounts.Items[0].Online != nil {
		t.Fatalf("accounts without Redis %+v", accounts)
	}
	h.adminGet("/api/admin/accounts?online=1", &accounts)
	if accounts.Total != 0 {
		t.Fatalf("online accounts without Redis %+v", accounts)
	}
	var overview struct {
		Online *struct{ Players int }
		Nodes  *struct{ Total int }
	}
	h.adminGet("/api/admin/overview", &overview)
	if overview.Online != nil || overview.Nodes != nil {
		t.Fatalf("overview without Redis %+v", overview)
	}
}
