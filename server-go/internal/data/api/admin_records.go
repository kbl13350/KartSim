package api

import (
	"net/http"
	"strconv"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
)

// The admin console's record lists: currency ledgers, grants, races,
// purchases, lottery draws, box openings and clubs (ADMIN.md 3 and 4).
// Each takes the common list query (parseAdminList) and ?account= (an
// account id or a username) where it lists an account's records.

// currencyParam reads ?currency= among coupon, lucci, koin and, when
// withExp, exp.
func currencyParam(r *http.Request, withExp bool) (string, error) {
	options := []string{string(economy.Coupon), string(economy.Lucci), string(economy.Koin)}
	if withExp {
		options = append(options, store.GrantExp)
	}
	return oneOfParam(r, "currency", options...)
}

// ledgerRowJSON is the LedgerRow of ADMIN.md 4. id is "w<id>" for a
// wallet_ledger row and "e<id>" for an exp_ledger row, so it stays unique
// across both.
type ledgerRowJSON struct {
	ID           string `json:"id"`
	At           int64  `json:"at"`
	AccountID    string `json:"accountId"`
	Username     string `json:"username"`
	Nickname     string `json:"nickname"`
	Currency     string `json:"currency"`
	Delta        int64  `json:"delta"`
	BalanceAfter int64  `json:"balanceAfter"`
	Reason       string `json:"reason"`
	RefID        string `json:"refId"`
	Note         string `json:"note"`
}

// adminLedger lists the wallet and exp ledgers merged: ?currency=
// (coupon, lucci, koin, exp), reason=, account=; q matches the ref and the
// note; from/to bound the time. Sort keys: at (default), delta.
func (a *API) adminLedger(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at", "delta")
	if err != nil {
		return err
	}
	var filter store.LedgerFilter
	if filter.Currency, err = currencyParam(r, true); err != nil {
		return err
	}
	if filter.Reason, err = tokenParam(r, "reason", 24); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[ledgerRowJSON](w, list)
	}
	rows, total, err := a.store.AdminLedger(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]ledgerRowJSON, len(rows))
	for i, row := range rows {
		id := "w" + strconv.FormatInt(row.ID, 10)
		if row.Exp {
			id = "e" + strconv.FormatInt(row.ID, 10)
		}
		items[i] = ledgerRowJSON{ID: id, At: row.At, AccountID: row.AccountID, Username: row.Username,
			Nickname: row.Nickname, Currency: row.Currency, Delta: row.Delta, BalanceAfter: row.BalanceAfter,
			Reason: row.Reason, RefID: row.RefID, Note: row.Note}
	}
	return answerList(w, list, items, total)
}

// grantRowJSON is the GrantRow of ADMIN.md 4.
type grantRowJSON struct {
	At        int64  `json:"at"`
	Admin     string `json:"admin"`
	RequestID string `json:"requestId"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	Currency  string `json:"currency"`
	Amount    int64  `json:"amount"`
	Note      string `json:"note"`
}

// adminGrants lists admin grants and deductions: ?account=, admin= (the
// granting admin's username), currency=; q matches the admin and the
// account's username and nickname; from/to bound the time. Sort keys: at
// (default), amount.
func (a *API) adminGrants(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at", "amount")
	if err != nil {
		return err
	}
	var filter store.GrantFilter
	if filter.Currency, err = currencyParam(r, true); err != nil {
		return err
	}
	if filter.Admin, err = tokenParam(r, "admin", 24); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[grantRowJSON](w, list)
	}
	rows, total, err := a.store.AdminGrants(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]grantRowJSON, len(rows))
	for i, row := range rows {
		items[i] = grantRowJSON{At: row.At, Admin: row.Admin, RequestID: row.RequestID, AccountID: row.AccountID,
			Username: row.Username, Nickname: row.Nickname, Currency: row.Currency, Amount: row.Amount, Note: row.Note}
	}
	return answerList(w, list, items, total)
}

// raceRowJSON is the RaceRow of ADMIN.md 4, with the track's title.
type raceRowJSON struct {
	RaceID       string                `json:"raceId"`
	RoomID       string                `json:"roomId"`
	At           int64                 `json:"at"`
	Gameplay     string                `json:"gameplay"`
	TrackID      string                `json:"trackId"`
	TrackName    string                `json:"trackName"`
	Players      int                   `json:"players"`
	Participants []raceParticipantJSON `json:"participants"`
}

// adminRaces lists settled races, each with its racers by rank and what
// they were credited: ?gameplay=, track= (a track id), account= (races the
// account took part in); q matches the track, room and race ids; from/to
// bound the time.
func (a *API) adminRaces(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at")
	if err != nil {
		return err
	}
	var filter store.RaceFilter
	if filter.Gameplay, err = tokenParam(r, "gameplay", 20); err != nil {
		return err
	}
	if filter.TrackID, err = tokenParam(r, "track", 64); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[raceRowJSON](w, list)
	}
	rows, total, err := a.store.AdminRaces(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]raceRowJSON, len(rows))
	for i, row := range rows {
		items[i] = raceRowJSON{RaceID: row.RaceID, RoomID: row.RoomID, At: row.At, Gameplay: row.Gameplay,
			TrackID: row.TrackID, TrackName: a.trackName(row.TrackID), Players: row.Players,
			Participants: a.raceParticipants(row.Participants)}
	}
	return answerList(w, list, items, total)
}

// purchaseRowJSON is the PurchaseRow of ADMIN.md 4.
type purchaseRowJSON struct {
	ID        int64  `json:"id"`
	At        int64  `json:"at"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	OfferID   string `json:"offerId"`
	Category  int    `json:"category"`
	ItemID    int    `json:"itemId"`
	Name      string `json:"name"`
	Currency  string `json:"currency"`
	Price     int64  `json:"price"`
	Days      int    `json:"days"`
	Count     int    `json:"count"`
}

// adminPurchases lists shop purchases: ?account=, currency=; q matches the
// username, nickname and offer id; from/to bound the time. Sort keys: at
// (default), price.
func (a *API) adminPurchases(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at", "price")
	if err != nil {
		return err
	}
	var filter store.PurchaseFilter
	if filter.Currency, err = currencyParam(r, false); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[purchaseRowJSON](w, list)
	}
	rows, total, err := a.store.AdminPurchases(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]purchaseRowJSON, len(rows))
	for i, row := range rows {
		items[i] = purchaseRowJSON{ID: row.ID, At: row.At, AccountID: row.AccountID, Username: row.Username,
			Nickname: row.Nickname, OfferID: row.OfferID, Category: row.Category, ItemID: row.ItemID,
			Name: a.itemName(row.Category, row.ItemID, ""), Currency: row.Currency, Price: row.Price, Days: row.Days,
			Count: row.Count}
	}
	return answerList(w, list, items, total)
}

// lotteryDrawRowJSON is the LotteryDrawRow of ADMIN.md 4, with the name of
// the lottery (refName: the 精品道具场 lottery item, or the 寻宝 board).
type lotteryDrawRowJSON struct {
	At        int64  `json:"at"`
	RequestID string `json:"requestId"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	Kind      string `json:"kind"`
	Ref       int    `json:"ref"`
	RefName   string `json:"refName"`
	Count     int    `json:"count"`
	Summary   string `json:"summary"`
	Result    any    `json:"result"`
}

// adminLotteryDraws lists 寻宝 and 精品道具场 draw requests: ?account=,
// kind= (treasure, gacha); q matches the username and nickname; from/to
// bound the time.
func (a *API) adminLotteryDraws(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at")
	if err != nil {
		return err
	}
	var filter store.DrawFilter
	if filter.Kind, err = oneOfParam(r, "kind", store.DrawTreasure, store.DrawGacha); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[lotteryDrawRowJSON](w, list)
	}
	rows, total, err := a.store.AdminLotteryDraws(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]lotteryDrawRowJSON, len(rows))
	for i, row := range rows {
		summary, result := a.drawSummary(row)
		refName := "寻宝"
		if row.Kind == store.DrawGacha {
			refName = a.lotteryName(row.Ref)
		}
		items[i] = lotteryDrawRowJSON{At: row.At, RequestID: row.RequestID, AccountID: row.AccountID,
			Username: row.Username, Nickname: row.Nickname, Kind: row.Kind, Ref: row.Ref, RefName: refName,
			Count: row.Count, Summary: summary, Result: result}
	}
	return answerList(w, list, items, total)
}

// boxOpeningRowJSON is the BoxOpeningRow of ADMIN.md 4.
type boxOpeningRowJSON struct {
	At        int64  `json:"at"`
	RequestID string `json:"requestId"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	BoxID     int    `json:"boxId"`
	BoxName   string `json:"boxName"`
	StockID   int    `json:"stockId"`
	Summary   string `json:"summary"`
	Result    any    `json:"result"`
}

// adminBoxOpenings lists opened boxes: ?account=, box= (the box's item
// id); q matches the username and nickname; from/to bound the time.
func (a *API) adminBoxOpenings(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at")
	if err != nil {
		return err
	}
	var filter store.BoxFilter
	if text := r.URL.Query().Get("box"); text != "" {
		if filter.BoxID, err = strconv.Atoi(text); err != nil || filter.BoxID <= 0 {
			return errInvalidQuery
		}
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[boxOpeningRowJSON](w, list)
	}
	rows, total, err := a.store.AdminBoxOpenings(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	items := make([]boxOpeningRowJSON, len(rows))
	for i, row := range rows {
		summary, result := a.boxSummary(row)
		items[i] = boxOpeningRowJSON{At: row.At, RequestID: row.RequestID, AccountID: row.AccountID,
			Username: row.Username, Nickname: row.Nickname, BoxID: row.BoxID, BoxName: a.lotteryName(row.BoxID),
			StockID: row.StockID, Summary: summary, Result: result}
	}
	return answerList(w, list, items, total)
}

// clubRowJSON is the ClubRow of ADMIN.md 4.
type clubRowJSON struct {
	ID             int64  `json:"id"`
	Name           string `json:"name"`
	MasterID       string `json:"masterId"`
	MasterUsername string `json:"masterUsername"`
	MasterNickname string `json:"masterNickname"`
	Members        int    `json:"members"`
	HQ             int    `json:"hq"`
	Racing         int    `json:"racing"`
	Rider          int    `json:"rider"`
	Bank           int    `json:"bank"`
	Budget         int64  `json:"budget"`
	CS             int64  `json:"cs"`
	CSWeek         int64  `json:"csWeek"`
	AutoJoin       bool   `json:"autoJoin"`
	CreatedAt      int64  `json:"createdAt"`
	BreakAt        *int64 `json:"breakAt"`
}

// adminClubs lists clubs: q matches the name and the master's username and
// nickname; from/to bound the creation time. Sort keys: createdAt
// (default), name, members, cs, csWeek, budget.
func (a *API) adminClubs(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "createdAt", "name", "members", "cs", "csWeek", "budget")
	if err != nil {
		return err
	}
	rows, total, err := a.store.AdminClubs(r.Context(), list.AdminPage, a.nowMillis())
	if err != nil {
		return err
	}
	items := make([]clubRowJSON, len(rows))
	for i, row := range rows {
		items[i] = clubRowJSON{ID: row.ID, Name: row.Name, MasterID: row.MasterID, MasterUsername: row.MasterUsername,
			MasterNickname: row.MasterNickname, Members: row.Members, HQ: row.HQ, Racing: row.Racing, Rider: row.Rider,
			Bank: row.Bank, Budget: row.Budget, CS: row.CS, CSWeek: row.CSWeek, AutoJoin: row.AutoJoin,
			CreatedAt: row.CreatedAt, BreakAt: row.BreakAt}
	}
	return answerList(w, list, items, total)
}
