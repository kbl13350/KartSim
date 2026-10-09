package api

import (
	"net/http"
	"testing"

	"kartsim/internal/data/datatest"
)

func TestExpeditionNeedsLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.get("/api/expedition", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.get("/api/expedition/crew", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/expedition/start", map[string]any{"slot": 1, "crew": []map[string]int{{"character": 1}}}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/inventory/open", map[string]any{"itemId": 1228,
		"requestId": "00000000-0000-4000-8000-000000000001"}, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}

func TestExpeditionAPI(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	id, _, token := h.messengerUser()
	auth := bearerHeader(token)
	var body struct {
		Missions []struct {
			Slot   int    `json:"slot"`
			State  string `json:"state"`
			Reward struct {
				Items []struct {
					Category int    `json:"category"`
					Name     string `json:"name"`
				} `json:"items"`
			} `json:"reward"`
			Lucci int64 `json:"lucci"`
			Exp   int64 `json:"exp"`
		} `json:"missions"`
		Tokens int `json:"tokens"`
		Limit  int `json:"limit"`
		Rules  struct {
			Basic struct {
				WeeklyMissions int `json:"weeklyMissions"`
			} `json:"basic"`
			KartTuning map[string][]int `json:"kartTuning"`
		} `json:"rules"`
	}
	h.get("/api/expedition", auth).expect(t, http.StatusOK, "").json(t, &body)
	if len(body.Missions) != 10 || body.Tokens != 10 || body.Limit != 10 || body.Rules.Basic.WeeklyMissions != 10 ||
		len(body.Rules.KartTuning["5"]) != 5 {
		t.Fatalf("expedition %d missions %d tokens %d limit", len(body.Missions), body.Tokens, body.Limit)
	}
	// The account owns nothing to send: every mission is blocked.
	for _, m := range body.Missions {
		if m.State != "blocked" || m.Exp+m.Lucci == 0 || len(m.Reward.Items) != 1 ||
			m.Reward.Items[0].Category != 24 || m.Reward.Items[0].Name == "" {
			t.Fatalf("mission %+v", m)
		}
	}
	h.post("/api/expedition/start", map[string]any{"slot": body.Missions[0].Slot,
		"crew": []map[string]int{{"character": 1, "kart": 1}}}, auth).expect(t, http.StatusBadRequest, "INVALID_CREW")
	h.post("/api/expedition/tokens", map[string]any{"action": "change", "slot": body.Missions[0].Slot}, auth).
		expect(t, http.StatusOK, "")
	h.post("/api/expedition/tokens", map[string]any{"action": "add"}, auth).
		expect(t, http.StatusConflict, "CANNOT_ADD_MISSION")
	h.post("/api/expedition/claim", map[string]any{"slot": body.Missions[0].Slot}, auth).
		expect(t, http.StatusConflict, "MISSION_NOT_COMPLETE")

	// Boxes open from the inventory.
	datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, quantity, expires_at,
		source, created_at, updated_at) VALUES(?, 24, 1228, '', 1, NULL, 'test', 0, 0)`, id)
	var opening struct {
		Box     int `json:"box"`
		Left    int `json:"left"`
		Rewards []struct {
			Name string `json:"name"`
		} `json:"rewards"`
	}
	h.post("/api/inventory/open", map[string]any{"itemId": 1228, "requestId": "00000000-0000-4000-8000-0000000000aa"},
		auth).expect(t, http.StatusOK, "").json(t, &opening)
	if opening.Box != 1228 || opening.Left != 0 || len(opening.Rewards) == 0 || opening.Rewards[0].Name == "" {
		t.Fatalf("opening %+v", opening)
	}
	h.post("/api/inventory/open", map[string]any{"itemId": 1228, "requestId": "bad"}, auth).
		expect(t, http.StatusBadRequest, "INVALID_REQUEST_ID")
	h.post("/api/inventory/open", map[string]any{"itemId": 1228, "requestId": "00000000-0000-4000-8000-0000000000ab"},
		auth).expect(t, http.StatusConflict, "ITEM_NOT_ENOUGH")
}
