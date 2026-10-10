package api

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"kartsim/internal/shared/contract"
)

type antiCheatRowBody struct {
	ID        int64
	At        int64
	Code      string
	Detail    string
	Action    string
	AccountID string
	Username  string
	Nickname  string
	Name      string
	PlayerID  string
	NodeID    string
	RoomID    string
	RaceID    string
	TrackID   string
	Gameplay  string
}

// A game node's anti-cheat records are stored once each and listed in the
// admin console with the account's current names.
func TestAntiCheatRecords(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	accountID := h.account("cheat_"+u, "作弊者"+u, password, false)
	node := "game-ac-" + u
	h.cleanup("DELETE FROM anti_cheat_events WHERE node_id = ?", node)
	report := func(eventID, playerID, account, code, action string) contract.AntiCheatReport {
		return contract.AntiCheatReport{NodeID: node, EventID: eventID, PlayerID: playerID, AccountID: account,
			Name: "当时的名字" + u, RoomID: "room-" + u, RaceID: "race-" + u, TrackID: "village_R01",
			Gameplay: "ordinary", Code: code, Detail: "120 ms 内坐标移动 2000 m\x01", Action: action, At: time.Now().UnixMilli()}
	}
	kick := report("00000000-0000-4000-8000-"+u+"01", "player-"+u, accountID, "TELEPORT", contract.AntiCheatKick)
	h.call(contract.PathAntiCheat, kick).expect(t, http.StatusOK, "")
	// A redelivery from the outbox is stored once.
	h.call(contract.PathAntiCheat, kick).expect(t, http.StatusOK, "")
	guest := report("00000000-0000-4000-8000-"+u+"02", "guest-"+u, "", "CUBE_RATE", contract.AntiCheatLog)
	h.call(contract.PathAntiCheat, guest).expect(t, http.StatusOK, "")

	var list struct {
		Items []antiCheatRowBody
		Total int
	}
	h.adminGet("/api/admin/anti-cheat?node="+node, &list)
	if list.Total != 2 || len(list.Items) != 2 {
		t.Fatalf("records %+v", list)
	}
	byCode := map[string]antiCheatRowBody{}
	for _, row := range list.Items {
		byCode[row.Code] = row
	}
	got := byCode["TELEPORT"]
	if got.AccountID != accountID || got.Username != "cheat_"+u || got.Nickname != "作弊者"+u ||
		got.Name != "当时的名字"+u || got.PlayerID != "player-"+u || got.Action != "kick" || got.NodeID != node ||
		got.RoomID != "room-"+u || got.RaceID != "race-"+u || got.TrackID != "village_R01" ||
		got.Gameplay != "ordinary" || got.Detail != "120 ms 内坐标移动 2000 m " || got.At == 0 {
		t.Fatalf("kick row %+v", got)
	}
	if guest := byCode["CUBE_RATE"]; guest.AccountID != "" || guest.Username != "" || guest.Action != "log" {
		t.Fatalf("guest row %+v", guest)
	}
	for query, want := range map[string]int{
		"code=TELEPORT":                   1,
		"action=log":                      1,
		"account=cheat_" + u:              1,
		"q=" + url.QueryEscape("作弊者"+u):   1,
		"q=" + url.QueryEscape("当时的名字"+u): 2,
		"q=guest-" + u:                    1,
		"code=SPEED":                      0,
	} {
		h.adminGet("/api/admin/anti-cheat?node="+node+"&"+query, &list)
		if list.Total != want {
			t.Fatalf("%s: %d, want %d", query, list.Total, want)
		}
	}
	h.get("/api/admin/anti-cheat?action=ban", h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_QUERY")
	h.get("/api/admin/anti-cheat", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")

	// Refused reports (a dead outbox record, not a retry).
	bad := kick
	bad.EventID = "00000000-0000-4000-8000-" + u + "03"
	for name, mutate := range map[string]func(r *contract.AntiCheatReport){
		"action":   func(r *contract.AntiCheatReport) { r.Action = "ban" },
		"code":     func(r *contract.AntiCheatReport) { r.Code = "" },
		"name":     func(r *contract.AntiCheatReport) { r.Name = "" },
		"event id": func(r *contract.AntiCheatReport) { r.EventID = strings.Repeat("a", 40) },
		"time":     func(r *contract.AntiCheatReport) { r.At = 0 },
	} {
		request := bad
		mutate(&request)
		if response := h.call(contract.PathAntiCheat, request); response.status != http.StatusBadRequest {
			t.Fatalf("%s: status %d", name, response.status)
		}
	}
	// A long detail is cut, not refused.
	long := bad
	long.Detail = strings.Repeat("长", 400)
	h.call(contract.PathAntiCheat, long).expect(t, http.StatusOK, "")
	var detail string
	if err := h.db.QueryRowContext(context.Background(), "SELECT detail FROM anti_cheat_events WHERE event_id = ?",
		long.EventID).Scan(&detail); err != nil || len([]rune(detail)) != maxAntiCheatDetail {
		t.Fatalf("long detail: %d runes, %v", len([]rune(detail)), err)
	}
}
