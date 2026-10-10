package api

import (
	"net/http"
	"slices"
	"strings"

	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
)

var errInvalidAntiCheat = apierr.New(http.StatusBadRequest, "INVALID_ANTI_CHEAT_REPORT")

// maxAntiCheatDetail bounds a record's detail (code points; the column is
// VARCHAR(255)); a longer one is cut, not refused, so a record never dies
// in the node's outbox over its wording.
const maxAntiCheatDetail = 255

// saveAntiCheat stores a game node's anti-cheat record (ANTICHEAT.md 4).
// A redelivered record (the same event ID) is ignored.
func (a *API) saveAntiCheat(w http.ResponseWriter, r *http.Request) error {
	var report contract.AntiCheatReport
	if err := decodeJSON(w, r, &report); err != nil {
		return err
	}
	if !validNodeID(report.NodeID) {
		return errInvalidNodeID
	}
	optionalID := func(value string, max int) bool { return value == "" || validASCIIID(value, max) }
	if !validASCIIID(report.EventID, 36) || !validASCIIID(report.PlayerID, 64) ||
		!optionalID(report.AccountID, 36) || !validText(report.Name, 64) ||
		!optionalID(report.RoomID, 64) || !optionalID(report.RaceID, 64) ||
		!optionalID(report.TrackID, 64) || !optionalID(report.Gameplay, 16) ||
		!validASCIIID(report.Code, 32) ||
		(report.Action != contract.AntiCheatKick && report.Action != contract.AntiCheatLog) ||
		report.At <= 0 {
		return errInvalidAntiCheat
	}
	detail := []rune(strings.Map(func(r rune) rune {
		if isISOControl(r) {
			return ' '
		}
		return r
	}, report.Detail))
	if len(detail) > maxAntiCheatDetail {
		detail = detail[:maxAntiCheatDetail]
	}
	if !slices.Contains(contract.AntiCheatCodes, report.Code) {
		// A newer node's check: kept as is, logged so it gets a label.
		a.log.Warn("anti-cheat record with an unknown check", "node", report.NodeID, "code", report.Code)
	}
	err := a.store.SaveAntiCheatEvent(r.Context(), store.AntiCheatEvent{
		EventID: report.EventID, NodeID: report.NodeID, AccountID: report.AccountID,
		PlayerID: report.PlayerID, Name: report.Name, RoomID: report.RoomID, RaceID: report.RaceID,
		TrackID: report.TrackID, Gameplay: report.Gameplay, Code: report.Code, Detail: string(detail),
		Action: report.Action, At: a.clampNodeTime(report.NodeID, "anti-cheat", report.At)})
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, contract.OK{OK: true})
}

// antiCheatRowJSON is the AntiCheatRow of ANTICHEAT.md 4, with the
// track's title.
type antiCheatRowJSON struct {
	ID        int64  `json:"id"`
	At        int64  `json:"at"`
	Code      string `json:"code"`
	Detail    string `json:"detail"`
	Action    string `json:"action"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	Name      string `json:"name"`
	PlayerID  string `json:"playerId"`
	NodeID    string `json:"nodeId"`
	RoomID    string `json:"roomId"`
	RaceID    string `json:"raceId"`
	TrackID   string `json:"trackId"`
	TrackName string `json:"trackName"`
	Gameplay  string `json:"gameplay"`
}

// adminAntiCheat lists the anti-cheat records: ?code= (a check),
// action=kick|log, account= (id or username), node= (exact); q matches
// the name, username, nickname and detail, and the player, room and race
// IDs; from/to bound the time.
func (a *API) adminAntiCheat(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at")
	if err != nil {
		return err
	}
	var filter store.AntiCheatFilter
	if filter.Code, err = tokenParam(r, "code", 32); err != nil {
		return err
	}
	if filter.Action, err = oneOfParam(r, "action", contract.AntiCheatKick, contract.AntiCheatLog); err != nil {
		return err
	}
	if filter.NodeID, err = tokenParam(r, "node", 64); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[antiCheatRowJSON](w, list)
	}
	rows, total, err := a.store.AdminAntiCheat(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]antiCheatRowJSON, len(rows))
	for i, row := range rows {
		items[i] = antiCheatRowJSON{ID: row.ID, At: row.At, Code: row.Code, Detail: row.Detail,
			Action: row.Action, AccountID: row.AccountID, Username: row.Username, Nickname: row.Nickname,
			Name: row.Name, PlayerID: row.PlayerID, NodeID: row.NodeID, RoomID: row.RoomID,
			RaceID: row.RaceID, TrackID: row.TrackID, TrackName: a.trackName(row.TrackID), Gameplay: row.Gameplay}
	}
	return answerList(w, list, items, total)
}
