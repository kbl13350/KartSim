package api

import (
	"net/http"
	"testing"

	"kartsim/internal/data/datatest"
)

type dictionaryBody struct {
	Nickname   string `json:"nickname"`
	Owner      bool   `json:"owner"`
	Categories []struct {
		Category  int   `json:"category"`
		Items     []int `json:"items"`
		Collected []int `json:"collected"`
	} `json:"categories"`
	KartGrades map[string]int `json:"kartGrades"`
	Total      int            `json:"total"`
	Collected  int            `json:"collected"`
	Rewarded   int            `json:"rewarded"`
	Claimable  int            `json:"claimable"`
}

func TestDictionaryNeedsLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.get("/api/dictionary", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/dictionary/reward", nil, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/myroom/dictionary", map[string]string{"nickname": "x"}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
}

func TestDictionaryAPI(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	id, nickname, token := h.messengerUser()
	auth := bearerHeader(token)

	var body dictionaryBody
	h.get("/api/dictionary", auth).expect(t, http.StatusOK, "").json(t, &body)
	if body.Nickname != nickname || !body.Owner || len(body.Categories) != 10 || body.Total != 3684 ||
		body.Collected != 0 || body.Claimable != 0 || body.KartGrades["1638"] != 13 {
		t.Fatalf("empty dictionary %s %v %d %d %d %d", body.Nickname, body.Owner, len(body.Categories), body.Total,
			body.Collected, body.Claimable)
	}
	h.post("/api/dictionary/reward", nil, auth).expect(t, http.StatusConflict, "NOTHING_TO_CLAIM")

	// Two listed karts (one an expired rental), a listed character and an
	// unlisted kart.
	datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, expires_at, source,
		created_at, updated_at) VALUES(?, 3, 1, '', NULL, 'test', 0, 0), (?, 3, 2, '', 1, 'test', 0, 0),
		(?, 1, 5, '', NULL, 'test', 0, 0), (?, 3, 99999, '', NULL, 'test', 0, 0)`, id, id, id, id)
	h.get("/api/dictionary", auth).expect(t, http.StatusOK, "").json(t, &body)
	if body.Collected != 3 || body.Claimable != 3 || body.Rewarded != 0 {
		t.Fatalf("collected %d claimable %d rewarded %d", body.Collected, body.Claimable, body.Rewarded)
	}
	for _, row := range body.Categories {
		if row.Category == 3 && (len(row.Collected) != 2 || row.Collected[0] != 2 || row.Collected[1] != 1) {
			t.Fatalf("karts collected %v", row.Collected)
		}
	}

	var claim struct {
		Items  int   `json:"items"`
		Koin   int64 `json:"koin"`
		Wallet struct {
			Koin int64 `json:"koin"`
		} `json:"wallet"`
		Dictionary dictionaryBody `json:"dictionary"`
	}
	h.post("/api/dictionary/reward", nil, auth).expect(t, http.StatusOK, "").json(t, &claim)
	if claim.Items != 3 || claim.Koin != 3 || claim.Wallet.Koin != 3 || claim.Dictionary.Rewarded != 3 ||
		claim.Dictionary.Claimable != 0 {
		t.Fatalf("claim items %d koin %d wallet %d rewarded %d claimable %d", claim.Items, claim.Koin,
			claim.Wallet.Koin, claim.Dictionary.Rewarded, claim.Dictionary.Claimable)
	}
	h.post("/api/dictionary/reward", nil, auth).expect(t, http.StatusConflict, "NOTHING_TO_CLAIM")

	// Only the newly collected item pays.
	datatest.Exec(t, h.db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, expires_at, source,
		created_at, updated_at) VALUES(?, 9, 1, '', NULL, 'test', 0, 0)`, id)
	h.post("/api/dictionary/reward", nil, auth).expect(t, http.StatusOK, "").json(t, &claim)
	if claim.Items != 1 || claim.Wallet.Koin != 4 || claim.Dictionary.Rewarded != 4 {
		t.Fatalf("second claim items %d wallet %d rewarded %d", claim.Items, claim.Wallet.Koin,
			claim.Dictionary.Rewarded)
	}
	var ledger int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM wallet_ledger WHERE account_id = ? AND reason = 'dictionary'
		AND currency = 'koin'`, id).Scan(&ledger); err != nil || ledger != 2 {
		t.Fatalf("dictionary ledger rows %d %v", ledger, err)
	}

	// Visitors see the collection behind the etc password, without the reward.
	_, _, visitorToken := h.messengerUser()
	visitor := bearerHeader(visitorToken)
	body = dictionaryBody{}
	h.post("/api/myroom/dictionary", map[string]string{"nickname": nickname}, visitor).
		expect(t, http.StatusOK, "").json(t, &body)
	if body.Owner || body.Collected != 4 || body.Rewarded != 0 || body.Claimable != 0 {
		t.Fatalf("visitor view owner %v collected %d rewarded %d claimable %d", body.Owner, body.Collected,
			body.Rewarded, body.Claimable)
	}
	h.put("/api/account/profile", map[string]any{"myRoom": map[string]any{"environmentId": 16,
		"displayName": "Mine", "message": "", "etcPassword": "pw12"}}, auth).expect(t, http.StatusOK, "")
	h.post("/api/myroom/dictionary", map[string]string{"nickname": nickname}, visitor).
		expect(t, http.StatusForbidden, "PASSWORD_REQUIRED")
	h.post("/api/myroom/dictionary", map[string]string{"nickname": nickname, "password": "pw12"}, visitor).
		expect(t, http.StatusOK, "")
}
