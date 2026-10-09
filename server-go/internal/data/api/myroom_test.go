package api

import (
	"net/http"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

type careerBody struct {
	Nickname string `json:"nickname"`
	Points   int    `json:"points"`
	Owner    bool   `json:"owner"`
	Careers  []struct {
		ID        int    `json:"id"`
		Value     int64  `json:"value"`
		State     string `json:"state"`
		Locked    bool   `json:"locked"`
		Untracked bool   `json:"untracked"`
	} `json:"careers"`
	Recent []struct {
		ID          int   `json:"id"`
		CompletedAt int64 `json:"completedAt"`
	} `json:"recent"`
}

type emblemBody struct {
	Nickname string `json:"nickname"`
	Emblems  []struct {
		ID int `json:"id"`
	} `json:"emblems"`
	Main  [2]int `json:"main"`
	Owner bool   `json:"owner"`
}

func TestCareersNeedLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.get("/api/careers", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/careers/complete", map[string]int{"careerId": 1}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.get("/api/emblems", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/myroom/careers", map[string]string{"nickname": "x"}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}

func TestCareersAndEmblemsAPI(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	id, nickname, token := h.messengerUser()
	auth := bearerHeader(token)

	var careers careerBody
	h.get("/api/careers", auth).expect(t, http.StatusOK, "").json(t, &careers)
	if careers.Nickname != nickname || !careers.Owner || careers.Points != 0 || len(careers.Careers) != 1198 {
		t.Fatalf("careers %s %v %d %d", careers.Nickname, careers.Owner, careers.Points, len(careers.Careers))
	}
	states := map[int]string{}
	locked := map[int]bool{}
	for _, c := range careers.Careers {
		states[c.ID], locked[c.ID] = c.State, c.Locked
	}
	if states[1] != "complete" || !locked[2] {
		t.Fatalf("career 1 %s, career 2 locked %v", states[1], locked[2])
	}

	h.post("/api/careers/complete", map[string]int{"careerId": 0}, auth).expect(t, http.StatusBadRequest, "INVALID_CAREER")
	h.post("/api/careers/complete", map[string]int{"careerId": 2}, auth).
		expect(t, http.StatusConflict, "CAREER_NOT_COMPLETE")
	var done struct {
		Career struct {
			ID    int    `json:"id"`
			State string `json:"state"`
		} `json:"career"`
		Point  int `json:"point"`
		Points int `json:"points"`
	}
	h.post("/api/careers/complete", map[string]int{"careerId": 1}, auth).expect(t, http.StatusOK, "").json(t, &done)
	if done.Career.ID != 1 || done.Career.State != "rewarded" || done.Point != 5 || done.Points != 5 {
		t.Fatalf("completion %+v", done)
	}
	h.post("/api/careers/complete", map[string]int{"careerId": 1}, auth).
		expect(t, http.StatusConflict, "CAREER_ALREADY_COMPLETED")
	h.get("/api/careers", auth).expect(t, http.StatusOK, "").json(t, &careers)
	if careers.Points != 5 || len(careers.Recent) != 1 || careers.Recent[0].ID != 1 {
		t.Fatalf("after completion points %d recent %v", careers.Points, careers.Recent)
	}

	var emblems emblemBody
	h.get("/api/emblems", auth).expect(t, http.StatusOK, "").json(t, &emblems)
	if len(emblems.Emblems) != 0 || emblems.Main != [2]int{} || !emblems.Owner {
		t.Fatalf("emblems %+v", emblems)
	}
	h.post("/api/emblems/main", map[string]any{"main": []int{8196}}, auth).
		expect(t, http.StatusBadRequest, "INVALID_MAIN_EMBLEMS")
	h.post("/api/emblems/main", map[string]any{"main": []int{1, 0}}, auth).
		expect(t, http.StatusBadRequest, "INVALID_MAIN_EMBLEMS")
	h.post("/api/emblems/main", map[string]any{"main": []int{8196, 0}}, auth).
		expect(t, http.StatusConflict, "EMBLEM_NOT_OWNED")
	if _, err := h.api.store.GrantEmblem(t.Context(), id, 8196, "test", 0, 1); err != nil {
		t.Fatal(err)
	}
	h.post("/api/emblems/main", map[string]any{"main": []int{8196, 0}}, auth).expect(t, http.StatusOK, "").
		json(t, &emblems)
	if emblems.Main != [2]int{8196, 0} || len(emblems.Emblems) != 1 {
		t.Fatalf("main emblems %+v", emblems)
	}

	// The account summary marks the Beijing sign-in day.
	h.get("/api/account", auth).expect(t, http.StatusOK, "")
	var days int
	if err := h.db.QueryRow("SELECT COUNT(*) FROM account_login_days WHERE account_id = ? AND day = ?", id,
		rewards.BeijingDay(h.api.now())).Scan(&days); err != nil || days != 1 {
		t.Fatalf("login days %d %v", days, err)
	}
}

func TestVisitorViewsBehindEtcPassword(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	ownerID, ownerNick, ownerToken := h.messengerUser()
	_, _, visitorToken := h.messengerUser()
	visitor := bearerHeader(visitorToken)

	var careers careerBody
	h.post("/api/myroom/careers", map[string]string{"nickname": ownerNick}, visitor).expect(t, http.StatusOK, "").
		json(t, &careers)
	if careers.Nickname != ownerNick || careers.Owner {
		t.Fatalf("visitor careers %s %v", careers.Nickname, careers.Owner)
	}
	h.post("/api/myroom/careers", map[string]string{"nickname": "Nobody" + datatest.Unique()}, visitor).
		expect(t, http.StatusNotFound, "UNKNOWN_RIDER")

	h.put("/api/account/profile", map[string]any{"myRoom": map[string]any{"environmentId": 16,
		"displayName": "Mine", "message": "", "etcPassword": "pw12"}}, bearerHeader(ownerToken)).
		expect(t, http.StatusOK, "")
	h.post("/api/myroom/emblems", map[string]string{"nickname": ownerNick}, visitor).
		expect(t, http.StatusForbidden, "PASSWORD_REQUIRED")
	h.post("/api/myroom/emblems", map[string]string{"nickname": ownerNick, "password": "nope"}, visitor).
		expect(t, http.StatusForbidden, "WRONG_PASSWORD")
	var emblems emblemBody
	h.post("/api/myroom/emblems", map[string]string{"nickname": ownerNick, "password": "pw12"}, visitor).
		expect(t, http.StatusOK, "").json(t, &emblems)
	if emblems.Nickname != ownerNick || emblems.Owner {
		t.Fatalf("visitor emblems %+v", emblems)
	}
	// The owner names itself without a password.
	h.post("/api/myroom/careers", map[string]string{"nickname": ownerNick}, bearerHeader(ownerToken)).
		expect(t, http.StatusOK, "").json(t, &careers)
	if !careers.Owner {
		t.Fatal("owner view not marked as the owner's")
	}
	_ = ownerID
}

func TestSettlementRaceClass(t *testing.T) {
	request := contract.RaceSettlement{RaceID: "race-1", RoomID: "room-1", Mode: "team", Gameplay: "ordinary",
		TrackID: "forest_I01", FinishedAt: 1,
		Snapshot: []byte(`{"mode":"team","race":{"channelName":"speedTeamInfinit","winningTeam":2,
			"roster":[{"playerId":"p1","team":1,"equipment":{"itemIds":{"12":1}}},{"playerId":"p2","team":2},
			{"playerId":"p3","team":null}]}}`),
		Results: []contract.RaceResult{{PlayerID: "p1", Rank: 1, DistanceMeters: 5_000},
			{PlayerID: "p2", Rank: 2, DistanceMeters: -5}, {PlayerID: "p3", Rank: 3, DistanceMeters: 9_000_000}}}
	settlement, ok := settlementFromRequest(request, 10)
	if !ok || !settlement.Team || !settlement.Infinite || settlement.WinningTeam != 2 {
		t.Fatalf("settlement %+v %v", settlement, ok)
	}
	if teams := []int{settlement.Results[0].Team, settlement.Results[1].Team, settlement.Results[2].Team}; teams[0] != 1 ||
		teams[1] != 2 || teams[2] != 0 {
		t.Fatalf("teams %v", teams)
	}
	results := settlement.Results
	if !results[0].Camera || results[1].Camera || results[0].DistanceMeters != 5_000 ||
		results[1].DistanceMeters != 0 || results[2].DistanceMeters != maxRaceDistanceMeters {
		t.Fatalf("camera and distance %+v", results)
	}
	request.Mode = "individual"
	request.Snapshot = []byte(`{"race":{"channelName":"speedIndiCombine"}}`)
	if settlement, ok = settlementFromRequest(request, 10); !ok || settlement.Team || settlement.Infinite {
		t.Fatalf("individual settlement %+v", settlement)
	}
}
