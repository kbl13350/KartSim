package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"testing"
	"time"

	"kartsim/internal/data/club"
	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

// The item count leaves out used-up and expired rows, as the player's own
// inventory does.
func TestAdminInventoryCountsHeldItems(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	id := h.account("items_"+h.u, "物品"+h.u, password, false)
	now := time.Now().UnixMilli()
	for _, item := range []struct {
		itemID, quantity int
		expires          any
	}{{1, 1, nil}, {2, 0, nil}, {3, 1, now - 1000}, {4, 2, now + 86_400_000}} {
		datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, quantity, expires_at, source,
			created_at, updated_at) VALUES(?, 1, ?, ?, ?, 'test', ?, ?)`, id, item.itemID, item.quantity, item.expires, now, now)
	}
	var detail struct{ Account struct{ InventoryCount int } }
	h.adminGet("/api/admin/accounts/"+id, &detail)
	if detail.Account.InventoryCount != 2 {
		t.Fatalf("item count %d", detail.Account.InventoryCount)
	}
	var inventory struct{ Total int }
	h.adminGet("/api/admin/accounts/"+id+"/inventory", &inventory)
	if inventory.Total != 4 { // the inventory page still lists every row
		t.Fatalf("inventory rows %d", inventory.Total)
	}
}

// Clubs carry their state; the members list pages one club's members.
func TestAdminClubStatesAndMembers(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	now := time.Now().UnixMilli()
	master := h.account("master_"+u, "会长"+u, password, false)
	member := h.account("member_"+u, "会员"+u, password, false)
	newClub := func(name string, breakAt any) int64 {
		t.Helper()
		result, err := h.db.Exec(`INSERT INTO clubs(name, intro, mark, frame, master_id, break_at, created_at, updated_at)
			VALUES(?, '', 1, 1, ?, ?, ?, ?)`, name+u, master, breakAt, now, now)
		if err != nil {
			t.Fatal(err)
		}
		id, _ := result.LastInsertId()
		h.cleanup("DELETE FROM clubs WHERE id = ?", id)
		return id
	}
	active := newClub("正常", nil)
	newClub("解散中", now+86_400_000)
	newClub("已解散", now-1000)
	week := club.Week(now)
	datatest.Exec(t, h.db, `INSERT INTO club_members(account_id, club_id, grade, joined_at, cs_week, week, cs_total,
		donated_total) VALUES(?, ?, 1, ?, 30, ?, 300, 5000), (?, ?, 4, ?, 9, 'old-week', 90, 0)`,
		master, active, now-2000, week, member, active, now-1000)

	var clubs struct {
		Items []clubRowJSON
		Total int
	}
	h.adminGet("/api/admin/clubs?sort=name&order=asc&q="+url.QueryEscape(u), &clubs)
	states := map[string]string{}
	for _, item := range clubs.Items {
		states[item.Name] = item.State
	}
	if clubs.Total != 3 || states["正常"+u] != "active" || states["解散中"+u] != "breaking" ||
		states["已解散"+u] != "disbanded" {
		t.Fatalf("clubs %+v", clubs)
	}
	for state, name := range map[string]string{"active": "正常", "breaking": "解散中", "disbanded": "已解散"} {
		h.adminGet("/api/admin/clubs?state="+state+"&q="+url.QueryEscape(u), &clubs)
		if clubs.Total != 1 || clubs.Items[0].Name != name+u || clubs.Items[0].State != state {
			t.Fatalf("%s clubs %+v", state, clubs)
		}
	}
	h.get("/api/admin/clubs?state=gone", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")

	var members struct {
		Items []memberRowJSON
		Total int
	}
	path := "/api/admin/clubs/" + strconv.FormatInt(active, 10) + "/members"
	h.adminGet(path, &members)
	if members.Total != 2 || members.Items[0].AccountID != member || members.Items[1].AccountID != master {
		t.Fatalf("members %+v", members)
	}
	if first := members.Items[1]; first.Username != "master_"+u || first.Nickname != "会长"+u || first.Grade != 1 ||
		first.CSWeek != 30 || first.CSTotal != 300 || first.DonatedTotal != 5000 || first.JoinedAt != now-2000 {
		t.Fatalf("master %+v", first)
	}
	if members.Items[0].CSWeek != 0 { // earned in an earlier week
		t.Fatalf("member %+v", members.Items[0])
	}
	h.adminGet(path+"?sort=grade&order=asc&pageSize=1", &members)
	if members.Total != 2 || len(members.Items) != 1 || members.Items[0].Grade != 1 {
		t.Fatalf("by grade %+v", members)
	}
	h.adminGet(path+"?q="+url.QueryEscape("会员"+u), &members)
	if members.Total != 1 || members.Items[0].AccountID != member {
		t.Fatalf("by name %+v", members)
	}
	h.get("/api/admin/clubs/999999999999/members", h.adminHeader).expect(t, http.StatusNotFound, "CLUB_NOT_FOUND")
	h.get("/api/admin/clubs/abc/members", h.adminHeader).expect(t, http.StatusNotFound, "CLUB_NOT_FOUND")
	h.get(path+"?sort=name", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
}

// Invitations are listed by a digest prefix with who used them.
func TestAdminInviteList(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	var created struct{ Invite string }
	h.post("/multiplayer/admin/invites", nil, h.adminHeader).expect(t, http.StatusOK, "").json(t, &created)
	hash := digest(created.Invite)
	h.cleanup("DELETE FROM invites WHERE code_hash = ?", hash)
	prefix := hash[:inviteHashShown]
	type inviteBody struct {
		Hash      string
		CreatedAt int64
		Used      bool
		UsedBy    *inviteUserJSON
		UsedAt    *int64
	}
	var invites struct {
		Items []inviteBody
		Total int
	}
	h.adminGet("/api/admin/invites?q="+prefix, &invites)
	if invites.Total != 1 || invites.Items[0].Hash != prefix || invites.Items[0].Used || invites.Items[0].UsedBy != nil ||
		invites.Items[0].UsedAt != nil || invites.Items[0].CreatedAt == 0 {
		t.Fatalf("unused invite %+v", invites)
	}
	h.post("/multiplayer/auth/register", map[string]string{"username": "invited_" + u, "nickname": "受邀" + u,
		"password": password, "invite": created.Invite}, nil).expect(t, http.StatusOK, "")
	id := h.accountID("invited_" + u)
	h.adminGet("/api/admin/invites?used=1&q="+prefix, &invites)
	if invites.Total != 1 || !invites.Items[0].Used || invites.Items[0].UsedBy == nil ||
		invites.Items[0].UsedBy.AccountID != id || invites.Items[0].UsedBy.Username != "invited_"+u ||
		invites.Items[0].UsedBy.Nickname != "受邀"+u || invites.Items[0].UsedAt == nil {
		t.Fatalf("used invite %+v", invites)
	}
	h.adminGet("/api/admin/invites?used=0&q="+prefix, &invites)
	if invites.Total != 0 {
		t.Fatalf("unused filter %+v", invites)
	}
	h.adminGet("/api/admin/invites?q="+url.QueryEscape("受邀"+u), &invites)
	if invites.Total != 1 || invites.Items[0].Hash != prefix {
		t.Fatalf("by user %+v", invites)
	}
	// The digest matches from its start only.
	h.adminGet("/api/admin/invites?q="+hash[2:14], &invites)
	if invites.Total != 0 {
		t.Fatalf("digest middle %+v", invites)
	}
	h.get("/api/admin/invites?used=2", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
}

// The reward box list shows every account's entries with their state.
func TestAdminRewardBoxList(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	name := "boxed_" + u
	id := h.account(name, "奖励"+u, password, false)
	gift := func(body map[string]any) {
		body["username"] = name
		h.post("/api/admin/reward-box", body, h.adminHeader).expect(t, http.StatusOK, "")
	}
	gift(map[string]any{"category": 1, "itemId": 1, "count": 1, "days": 7, "message": "补偿" + u})
	gift(map[string]any{"currency": "coupon", "count": 100})
	gift(map[string]any{"category": 1, "itemId": 1, "count": 2})
	ids := []int64{}
	rows, err := h.db.Query("SELECT id FROM reward_box WHERE account_id = ? ORDER BY id", id)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var entry int64
		if err := rows.Scan(&entry); err != nil {
			t.Fatal(err)
		}
		ids = append(ids, entry)
	}
	rows.Close()
	now := time.Now().UnixMilli()
	datatest.Exec(t, h.db, "UPDATE reward_box SET claimed_at = ? WHERE id = ?", now, ids[1])
	datatest.Exec(t, h.db, "UPDATE reward_box SET expires_at = ? WHERE id = ?", now-1000, ids[2])

	var list struct {
		Items []rewardBoxRowJSON
		Total int
	}
	h.adminGet("/api/admin/reward-box?account="+name, &list)
	if list.Total != 3 || list.Items[0].ID != ids[2] || list.Items[2].ID != ids[0] {
		t.Fatalf("entries %+v", list)
	}
	first := list.Items[2]
	if first.AccountID != id || first.Username != name || first.Nickname != "奖励"+u || first.Source != "admin" ||
		first.Message != "补偿"+u || first.Name != "宝宝" || first.Category != 1 || first.ItemID != 1 || first.Count != 1 ||
		first.Days != 7 || first.ExpiresAt <= first.CreatedAt || first.ClaimedAt != nil || first.State != "unclaimed" {
		t.Fatalf("first entry %+v", first)
	}
	if coupon := list.Items[1]; coupon.Currency != "coupon" || coupon.Count != 100 || coupon.State != "claimed" ||
		coupon.ClaimedAt == nil || coupon.Name != "点券" {
		t.Fatalf("claimed entry %+v", coupon)
	}
	if list.Items[0].State != "expired" {
		t.Fatalf("expired entry %+v", list.Items[0])
	}
	for state, want := range map[string]int64{"unclaimed": ids[0], "claimed": ids[1], "expired": ids[2]} {
		h.adminGet("/api/admin/reward-box?state="+state+"&account="+id, &list)
		if list.Total != 1 || list.Items[0].ID != want {
			t.Fatalf("%s %+v", state, list)
		}
	}
	h.adminGet("/api/admin/reward-box?source=admin&q="+url.QueryEscape("奖励"+u)+"&sort=createdAt&order=asc", &list)
	if list.Total != 3 || list.Items[0].ID != ids[0] {
		t.Fatalf("by nickname %+v", list)
	}
	h.adminGet("/api/admin/reward-box?source=quest&account="+name, &list)
	if list.Total != 0 {
		t.Fatalf("quest entries %+v", list)
	}
	h.adminGet("/api/admin/reward-box?account=nobody_"+u, &list)
	if list.Total != 0 || list.Items == nil {
		t.Fatalf("unknown account %+v", list)
	}
	for _, query := range []string{"state=taken", "source=shop", "sort=id"} {
		h.get("/api/admin/reward-box?"+query, h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
	}
}

// The game view gathers an account's tallies, licenses, best times,
// quests, counters, friends and club.
func TestAdminAccountGame(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	now := time.Now().UnixMilli()
	id := h.account("gamer_"+u, "车手"+u, password, false)
	friend := h.account("friend_"+u, "好友"+u, password, false)

	type gameBody struct {
		Stats   *struct{ Races, Wins, Podiums, Points int }
		License *struct {
			Level     int
			ProUntil  *int64
			ProCount  int
			LastRunAt *int64
		}
		LicenseClears  []gameClearJSON
		LicenseRecords []gameBestJSON
		TimeAttack     []gameBestJSON
		Quests         []gameQuestJSON
		Counters       []gameCounterJSON
		Friends        int
		Club           *gameClubJSON
	}
	var game gameBody
	h.adminGet("/api/admin/accounts/"+id+"/game", &game)
	if game.Stats != nil || game.License != nil || game.LicenseClears == nil || len(game.LicenseClears) != 0 ||
		game.TimeAttack == nil || game.Quests == nil || game.Counters == nil || game.Friends != 0 || game.Club != nil {
		t.Fatalf("new account %+v", game)
	}

	datatest.Exec(t, h.db, `INSERT INTO player_stats(account_id, races, wins, podiums, points, updated_at)
		VALUES(?, 12, 3, 7, 88, ?)`, id, now)
	datatest.Exec(t, h.db, `INSERT INTO license_state(account_id, level, pro_until, pro_period, pro_count, last_run_at,
		updated_at) VALUES(?, 5, ?, '2031-01', 2, ?, ?)`, id, now+86_400_000, now-5000, now)
	datatest.Exec(t, h.db, `INSERT INTO license_clears(account_id, step, period, best_ms, cleared_at, updated_at)
		VALUES(?, 1, '', 41000, ?, ?), (?, 31, '2031-01', 52000, ?, ?)`, id, now-9000, now, id, now-1000, now)
	datatest.Exec(t, h.db, `INSERT INTO license_records(account_id, track_id, best_ms, updated_at)
		VALUES(?, 'village_R01', 70100, ?)`, id, now)
	datatest.Exec(t, h.db, `INSERT INTO timeattack_bests(account_id, track_id, best_ms, updated_at)
		VALUES(?, 'village_R01', 69000, ?)`, id, now)
	datatest.Exec(t, h.db, `INSERT INTO quest_progress(account_id, quest_id, period, value, completed_at, updated_at)
		VALUES(?, 9001, '2031-03-01', 5, ?, ?), (?, 999999, '', 1, NULL, ?)`, id, now, now-100, id, now)
	datatest.Exec(t, h.db, `INSERT INTO account_counters(account_id, counter, value, updated_at)
		VALUES(?, 'races', 12, ?), (?, 'wins', 3, ?)`, id, now, id, now)
	datatest.Exec(t, h.db, `INSERT INTO friendships(account_id, friend_id, favorite, created_at)
		VALUES(?, ?, 0, ?), (?, ?, 0, ?)`, id, friend, now, friend, id, now)
	result, err := h.db.Exec(`INSERT INTO clubs(name, intro, mark, frame, master_id, created_at, updated_at)
		VALUES(?, '', 1, 1, ?, ?, ?)`, "车队"+u, id, now, now)
	if err != nil {
		t.Fatal(err)
	}
	clubID, _ := result.LastInsertId()
	h.cleanup("DELETE FROM clubs WHERE id = ?", clubID)
	datatest.Exec(t, h.db, `INSERT INTO club_members(account_id, club_id, grade, joined_at, cs_week, week, cs_total,
		donated_total) VALUES(?, ?, 1, ?, 40, ?, 400, 1000)`, id, clubID, now-3000, club.Week(now))

	h.adminGet("/api/admin/accounts/"+id+"/game", &game)
	if game.Stats == nil || *game.Stats != (struct{ Races, Wins, Podiums, Points int }{12, 3, 7, 88}) {
		t.Fatalf("stats %+v", game.Stats)
	}
	if game.License == nil || game.License.Level != 6 || game.License.ProUntil == nil || game.License.ProCount != 2 ||
		game.License.LastRunAt == nil || *game.License.LastRunAt != now-5000 {
		t.Fatalf("license %+v", game.License)
	}
	if len(game.LicenseClears) != 2 || game.LicenseClears[0].Step != 31 || game.LicenseClears[0].Period != "2031-01" ||
		game.LicenseClears[1].BestMs != 41000 {
		t.Fatalf("clears %+v", game.LicenseClears)
	}
	if len(game.LicenseRecords) != 1 || game.LicenseRecords[0].BestMs != 70100 || game.LicenseRecords[0].TrackName == "" ||
		len(game.TimeAttack) != 1 || game.TimeAttack[0].BestMs != 69000 || game.TimeAttack[0].TrackID != "village_R01" {
		t.Fatalf("best times %+v %+v", game.LicenseRecords, game.TimeAttack)
	}
	if len(game.Quests) != 2 || game.Quests[0].QuestID != 999999 || game.Quests[0].Title != "" ||
		game.Quests[0].CompletedAt != nil || game.Quests[1].QuestID != 9001 || game.Quests[1].Title != "多人游戏行驶" ||
		game.Quests[1].CompletedAt == nil || game.Quests[1].Value != 5 {
		t.Fatalf("quests %+v", game.Quests)
	}
	if len(game.Counters) != 2 || game.Counters[0].Counter != "races" || game.Counters[1].Value != 3 {
		t.Fatalf("counters %+v", game.Counters)
	}
	if game.Friends != 1 || game.Club == nil || game.Club.ID != clubID || game.Club.Grade != 1 || game.Club.CSWeek != 40 ||
		game.Club.CSTotal != 400 || game.Club.DonatedTotal != 1000 || game.Club.JoinedAt != now-3000 {
		t.Fatalf("friends %d club %+v", game.Friends, game.Club)
	}
	// An expired PRO license shows the base level; a disbanded club none.
	datatest.Exec(t, h.db, "UPDATE license_state SET pro_until = ? WHERE account_id = ?", now-1000, id)
	datatest.Exec(t, h.db, "UPDATE clubs SET break_at = ? WHERE id = ?", now-1000, clubID)
	h.adminGet("/api/admin/accounts/"+id+"/game", &game)
	if game.License.Level != 5 || game.Club != nil {
		t.Fatalf("expired %+v %+v", game.License, game.Club)
	}
	h.get("/api/admin/accounts/no-such-account/game", h.adminHeader).expect(t, http.StatusNotFound, "ACCOUNT_NOT_FOUND")
}

// A 寻宝 draw that pity forced is summarized as the 保底 reward.
func TestDrawSummaryNamesPityDraws(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	draw, _ := json.Marshal(store.DrawResult{Draws: []store.Draw{
		{Items: []store.DrawnItem{{Category: 1, ItemID: 1, Count: 1}}},
		{Items: []store.DrawnItem{{Category: 9, ItemID: 2, Name: "测试气球", Count: 1, Days: 7}}},
		{Items: []store.DrawnItem{{Category: 9, ItemID: 3, Name: "金色气球", Count: 1}}, Pity: true},
	}})
	summary, _ := h.api.drawSummary(store.LotteryDrawRow{Kind: store.DrawTreasure, Ref: 1, Result: string(draw)})
	if summary != "寻宝 3 次：宝宝、测试气球（7天）；保底奖励：金色气球" {
		t.Fatalf("summary %q", summary)
	}
	only, _ := json.Marshal(store.DrawResult{Draws: []store.Draw{
		{Items: []store.DrawnItem{{Category: 9, ItemID: 3, Name: "金色气球", Count: 1}}, Pity: true}}})
	if summary, _ := h.api.drawSummary(store.LotteryDrawRow{Kind: store.DrawTreasure, Ref: 1, Result: string(only)}); summary != "寻宝 1 次；保底奖励：金色气球" {
		t.Fatalf("pity only %q", summary)
	}
	mileage, _ := json.Marshal(store.DrawResult{Draws: []store.Draw{
		{Items: []store.DrawnItem{{Category: 1, ItemID: 1, Count: 1}}}},
		Prizes: []store.Draw{{Items: []store.DrawnItem{{Category: 9, ItemID: 3, Name: "金色气球", Count: 1}}}}})
	if summary, _ := h.api.drawSummary(store.LotteryDrawRow{Kind: store.DrawTreasure, Ref: 1, Result: string(mileage)}); summary != "寻宝 1 次：宝宝；保底奖励：金色气球" {
		t.Fatalf("mileage %q", summary)
	}
}
