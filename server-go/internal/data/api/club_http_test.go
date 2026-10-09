package api

import (
	"context"
	"net/http"
	"strconv"
	"testing"
	"time"

	"kartsim/internal/data/club"
	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

type clubBody struct {
	Me      store.ClubMe     `json:"me"`
	Club    *store.ClubInfo  `json:"club"`
	Members []clubMemberJSON `json:"members"`
	Joined  bool             `json:"joined"`
	Account struct {
		Wallet store.Wallet `json:"wallet"`
	} `json:"account"`
	Applicants []clubMemberJSON `json:"applicants"`
	Immediate  bool             `json:"immediate"`
}

type houseBody struct {
	House   store.ClubHouse `json:"house"`
	Welfare club.Welfare    `json:"welfare"`
	Account struct {
		Wallet store.Wallet `json:"wallet"`
	} `json:"account"`
}

func TestClubNeedsLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	for _, path := range []string{"/api/club", "/api/club/list", "/api/club/info/1", "/api/club/applicants",
		"/api/club/house"} {
		h.get(path, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
	h.post("/api/club/create", map[string]any{}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}

func TestClubAPI(t *testing.T) {
	clock := newFakeClock(time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC))
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	masterID, masterName, masterToken := h.messengerUser()
	master := bearerHeader(masterToken)
	riderID, _, riderToken := h.messengerUser()
	rider := bearerHeader(riderToken)
	otherID, _, otherToken := h.messengerUser()
	other := bearerHeader(otherToken)
	name := "测试俱乐部" + datatest.Unique()[:4]
	t.Cleanup(func() {
		datatest.Exec(t, h.db, "DELETE FROM clubs WHERE master_id IN (?, ?, ?)", masterID, riderID, otherID)
	})

	var state clubBody
	h.get("/api/club", master).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if state.Club != nil || state.Me.ClubID != 0 {
		t.Fatalf("new account %+v", state)
	}
	create := map[string]any{"name": name, "intro": "一起跑跑吧", "mark": 22, "frame": 0}
	// A yellow glove may not found a club; then the lucci are short.
	h.post("/api/club/create", create, master).expect(t, http.StatusForbidden, "CLUB_LEVEL_REQUIRED")
	datatest.Exec(t, h.db, "UPDATE account_progress SET exp = 300000 WHERE account_id = ?", masterID)
	h.post("/api/club/create", create, master).expect(t, http.StatusConflict, "INSUFFICIENT_FUNDS")
	datatest.Exec(t, h.db, "UPDATE wallets SET lucci = 2000000 WHERE account_id = ?", masterID)
	h.post("/api/club/create", map[string]any{"name": "a", "intro": "x", "mark": 22, "frame": 0}, master).
		expect(t, http.StatusBadRequest, "INVALID_CLUB_NAME")
	h.post("/api/club/create", map[string]any{"name": name, "intro": "x", "mark": 23, "frame": 0}, master).
		expect(t, http.StatusBadRequest, "INVALID_CLUB_MARK")
	h.post("/api/club/create", create, master).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if state.Club == nil || state.Club.Name != name || state.Club.Level != 1 || state.Club.MaxMembers != 100 ||
		state.Me.Grade != club.GradeMaster || len(state.Members) != 1 || state.Members[0].Nickname != masterName ||
		state.Account.Wallet.Lucci != 2_000_000-club.CreateLucci {
		t.Fatalf("created %+v", state)
	}
	clubID := state.Club.ID
	h.post("/api/club/create", create, master).expect(t, http.StatusConflict, "ALREADY_IN_CLUB")

	// The directory finds it; a rider applies and the master accepts.
	var list struct {
		Clubs []store.ClubInfo `json:"clubs"`
		Total int              `json:"total"`
	}
	h.get("/api/club/list?name="+name[len(name)-4:], rider).expect(t, http.StatusOK, "").json(t, &list)
	if list.Total != 1 || list.Clubs[0].ID != clubID || list.Clubs[0].Master != masterName {
		t.Fatalf("list %+v", list)
	}
	h.post("/api/club/apply", map[string]any{"clubId": clubID}, rider).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if state.Joined || state.Me.Applied == nil || state.Me.Applied.ID != clubID {
		t.Fatalf("applied %+v", state.Me)
	}
	h.get("/api/club/applicants", rider).expect(t, http.StatusConflict, "NOT_IN_CLUB")
	h.get("/api/club/applicants", master).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if len(state.Applicants) != 1 || state.Applicants[0].AccountID != riderID {
		t.Fatalf("applicants %+v", state.Applicants)
	}
	h.post("/api/club/applicants/decide", map[string]any{"accountId": riderID, "accept": true}, master).
		expect(t, http.StatusOK, "").json(t, fresh(&state))
	if len(state.Members) != 2 || len(state.Applicants) != 0 {
		t.Fatalf("accepted %+v", state)
	}

	// Auto join takes the next rider in at once; managing needs a grade.
	h.put("/api/club", map[string]any{"autoJoin": true}, rider).expect(t, http.StatusForbidden, "CLUB_PERMISSION")
	h.put("/api/club", map[string]any{"autoJoin": true, "intro": "新的简介"}, master).expect(t, http.StatusOK, "")
	h.post("/api/club/apply", map[string]any{"clubId": clubID}, other).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if !state.Joined || state.Me.ClubID != clubID || state.Club.Intro != "新的简介" || !state.Club.AutoJoin {
		t.Fatalf("auto join %+v", state)
	}
	h.post("/api/club/members", map[string]any{"accountId": otherID, "grade": club.GradeManager}, rider).
		expect(t, http.StatusForbidden, "CLUB_PERMISSION")
	h.post("/api/club/members", map[string]any{"accountId": riderID, "grade": club.GradeManager}, master).
		expect(t, http.StatusOK, "")
	// A manager removes members but not the master; leaving starts a cooldown.
	h.post("/api/club/members", map[string]any{"accountId": masterID, "kick": true}, rider).
		expect(t, http.StatusForbidden, "CLUB_PERMISSION")
	h.post("/api/club/members", map[string]any{"accountId": otherID, "kick": true}, rider).expect(t, http.StatusOK, "")
	h.post("/api/club/apply", map[string]any{"clubId": clubID}, other).expect(t, http.StatusConflict, "CLUB_COOLDOWN")
	h.post("/api/club/leave", map[string]any{}, master).expect(t, http.StatusConflict, "CLUB_MASTER_CANNOT_LEAVE")

	// Races earn activity points for the member and the club.
	elapsed := 60_000
	if _, _, err := h.api.store.SaveSettlement(context.Background(), store.Settlement{RaceID: "race-" + datatest.Unique(),
		RoomID: "room", Gameplay: "ordinary", TrackID: "village_R01", Snapshot: "{}", CreatedAt: clock.millis(),
		Results: []store.SettledResult{{PlayerID: "p1", AccountID: riderID, Name: "r", Rank: 1, ElapsedMs: &elapsed},
			{PlayerID: "p2", AccountID: masterID, Name: "m", Rank: 2, ElapsedMs: &elapsed}}}); err != nil {
		t.Fatal(err)
	}
	h.get("/api/club", master).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if state.Club.CS != 3 || state.Club.CSWeek != 3 {
		t.Fatalf("activity %+v", state.Club)
	}
	for _, member := range state.Members {
		if member.AccountID == riderID && (member.CSTotal != 2 || member.Grade != club.GradeManager) {
			t.Fatalf("rider %+v", member)
		}
	}

	// The 俱乐部基地: donations once a day, upgrades need points and budget.
	var house houseBody
	h.post("/api/club/donate", map[string]any{"amount": 20_000}, master).expect(t, http.StatusBadRequest, "INVALID_DONATION")
	h.post("/api/club/donate", map[string]any{"amount": 100_000}, master).expect(t, http.StatusOK, "").json(t, fresh(&house))
	if house.House.Club.Budget != 100_000 || !house.House.DonatedToday || len(house.House.Donations) != 1 ||
		house.House.TopDonor != masterName {
		t.Fatalf("donated %+v", house.House)
	}
	h.post("/api/club/donate", map[string]any{"amount": 10_000}, master).expect(t, http.StatusConflict, "CLUB_DONATED_TODAY")
	h.post("/api/club/upgrade", map[string]any{"facility": club.FacilityBank}, master).expect(t, http.StatusConflict, "CLUB_HQ_LEVEL")
	h.post("/api/club/upgrade", map[string]any{"facility": club.FacilityHQ}, master).expect(t, http.StatusConflict, "CLUB_MEMBERS_LOW")
	for range 3 {
		id, _, _ := h.messengerUser()
		h.cleanupAccount(id)
		datatest.Exec(t, h.db, "INSERT INTO club_members(account_id, club_id, grade, joined_at) VALUES(?, ?, 4, 1)", id, clubID)
	}
	h.post("/api/club/upgrade", map[string]any{"facility": club.FacilityHQ}, master).expect(t, http.StatusConflict, "CLUB_CS_LOW")
	datatest.Exec(t, h.db, "UPDATE clubs SET cs = 600 WHERE id = ?", clubID)
	h.post("/api/club/upgrade", map[string]any{"facility": club.FacilityHQ}, master).expect(t, http.StatusConflict, "CLUB_BUDGET_LOW")
	datatest.Exec(t, h.db, "UPDATE clubs SET budget = 300000 WHERE id = ?", clubID)
	h.post("/api/club/upgrade", map[string]any{"facility": club.FacilityHQ}, master).expect(t, http.StatusOK, "").json(t, fresh(&house))
	if house.House.Club.Level != 2 || house.House.Club.CS != 100 || house.House.Club.Budget != 100_000 {
		t.Fatalf("upgraded %+v", house.House.Club)
	}
	h.post("/api/club/welfare", map[string]any{"slot": 0}, rider).expect(t, http.StatusConflict, "CLUB_WELFARE_LOCKED")
	datatest.Exec(t, h.db, "UPDATE clubs SET racing = 2 WHERE id = ?", clubID)
	h.post("/api/club/welfare", map[string]any{"slot": 0}, rider).expect(t, http.StatusOK, "").json(t, fresh(&house))
	if house.Welfare.Amount != 2_000 || len(house.House.WelfareToday) != 1 {
		t.Fatalf("welfare %+v", house)
	}
	h.post("/api/club/welfare", map[string]any{"slot": 0}, rider).expect(t, http.StatusConflict, "CLUB_WELFARE_CLAIMED")
	h.post("/api/club/name", map[string]any{"name": name}, master).expect(t, http.StatusConflict, "CLUB_SAME_NAME")
	h.post("/api/club/mark", map[string]any{"mark": 24, "frame": 3}, master).expect(t, http.StatusConflict, "CLUB_BUDGET_LOW")

	// Disbanding a club with members waits a week, and can be withdrawn.
	h.post("/api/club/break", map[string]any{}, rider).expect(t, http.StatusForbidden, "CLUB_PERMISSION")
	h.post("/api/club/break", map[string]any{}, master).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if state.Immediate || state.Club.BreakAt == 0 {
		t.Fatalf("break %+v", state)
	}
	h.post("/api/club/apply", map[string]any{"clubId": clubID}, other).expect(t, http.StatusConflict, "CLUB_COOLDOWN")
	h.post("/api/club/break/cancel", map[string]any{}, master).expect(t, http.StatusOK, "")
	h.post("/api/club/break", map[string]any{}, master).expect(t, http.StatusOK, "")
	clock.advance(club.BreakGrace + time.Minute)
	h.get("/api/club", rider).expect(t, http.StatusOK, "").json(t, fresh(&state))
	if state.Club != nil || state.Me.ClubID != 0 {
		t.Fatalf("after the grace %+v", state)
	}
	h.get("/api/club/info/"+strconv.FormatInt(clubID, 10), rider).expect(t, http.StatusNotFound, "CLUB_NOT_FOUND")
}
