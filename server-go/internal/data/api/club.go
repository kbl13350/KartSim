package api

import (
	"net/http"
	"strconv"

	"kartsim/internal/data/club"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// 俱乐部 (CLUB.md): the account's club and members, the 俱乐部目录,
// applications, member management, the 俱乐部基地 facilities, donations and
// welfare.

var (
	errClubLevel        = apierr.New(http.StatusForbidden, "CLUB_LEVEL_REQUIRED")
	errInvalidClubID    = apierr.New(http.StatusBadRequest, "INVALID_CLUB_ID")
	errInvalidClubQuery = apierr.New(http.StatusBadRequest, "INVALID_CLUB_QUERY")
)

// clubsPerPage is the 俱乐部目录 page (clubInfo_0..14 at 1600×900).
const clubsPerPage = 15

// clubRules are the numbers the pages show.
type clubRules struct {
	CreateLevel     int            `json:"createLevel"`
	CreateLucci     int64          `json:"createLucci"`
	NameMin         int            `json:"nameMin"`
	NameMax         int            `json:"nameMax"`
	IntroMax        int            `json:"introMax"`
	MemberCaps      []int          `json:"memberCaps"`
	BudgetCaps      []int64        `json:"budgetCaps"`
	Donations       []int64        `json:"donations"`
	Upgrades        []club.Upgrade `json:"upgrades"`
	Welfares        []club.Welfare `json:"welfares"`
	NameChangeLucci int64          `json:"nameChangeLucci"`
	MarkChangeLucci int64          `json:"markChangeLucci"`
	Marks           []club.Mark    `json:"marks"`
	Frames          []club.Mark    `json:"frames"`
}

func (a *API) clubRules() clubRules {
	return clubRules{CreateLevel: club.CreateLevel, CreateLucci: club.CreateLucci, NameMin: club.NameMin,
		NameMax: club.NameMax, IntroMax: club.IntroMax, MemberCaps: club.MemberCaps[:], BudgetCaps: club.BudgetCaps[:],
		Donations: club.Donations[:], Upgrades: club.Upgrades[:], Welfares: club.Welfares,
		NameChangeLucci: club.NameChangeLucci, MarkChangeLucci: club.MarkChangeLucci,
		Marks: a.clubData.Marks, Frames: a.clubData.Frames}
}

// clubMemberJSON is a member row: level and glove from its exp, online
// from the messenger.
type clubMemberJSON struct {
	store.ClubMember
	Level  int    `json:"level"`
	Glove  string `json:"glove"`
	Online bool   `json:"online"`
}

func (a *API) clubMembers(members []store.ClubMember) []clubMemberJSON {
	ids := make([]string, len(members))
	for i, member := range members {
		ids[i] = member.AccountID
	}
	online := a.hub.Online(ids)
	rows := make([]clubMemberJSON, len(members))
	for i, member := range members {
		progress := a.economy.Levels.LevelForExp(member.Exp)
		rows[i] = clubMemberJSON{ClubMember: member, Level: progress.Level, Glove: progress.Glove,
			Online: online[member.AccountID]}
	}
	return rows
}

func (a *API) getClub(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	me, info, members, err := a.store.ClubState(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	body := map[string]any{"me": me, "rules": a.clubRules()}
	if info != nil {
		body["club"] = info
		body["members"] = a.clubMembers(members)
	}
	return writeJSON(w, http.StatusOK, body)
}

func (a *API) listClubs(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.signedIn(r); err != nil {
		return err
	}
	query := r.URL.Query()
	page, _ := strconv.Atoi(query.Get("page"))
	name, master := query.Get("name"), query.Get("master")
	if (name != "" && !validText(name, 40)) || (master != "" && !validText(master, 40)) {
		return errInvalidClubQuery
	}
	clubs, total, err := a.store.Clubs(r.Context(), store.ClubQuery{Name: name, Master: master, Page: max(0, page),
		PerPage: clubsPerPage}, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"clubs": clubs, "total": total, "page": max(0, page),
		"perPage": clubsPerPage})
}

func (a *API) clubDetail(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.signedIn(r); err != nil {
		return err
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		return errInvalidClubID
	}
	info, err := a.store.Club(r.Context(), id, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, info)
}

// clubWrite resolves the signed-in account of a club change, rate limited.
func (a *API) clubWrite(r *http.Request) (store.Account, error) {
	account, err := a.signedIn(r)
	if err != nil {
		return store.Account{}, err
	}
	return account, a.accountWrite(r.Context(), account.ID)
}

// clubAnswer answers a change with the account's club state (and the
// account summary when the wallet moved).
func (a *API) clubAnswer(w http.ResponseWriter, r *http.Request, account store.Account, summary bool,
	fields map[string]any) error {
	me, info, members, err := a.store.ClubState(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	body := map[string]any{"me": me}
	if info != nil {
		body["club"] = info
		body["members"] = a.clubMembers(members)
	}
	if summary {
		loaded, err := a.summary(r, account)
		if err != nil {
			return err
		}
		body["account"] = loaded
	}
	for key, value := range fields {
		body[key] = value
	}
	return writeJSON(w, http.StatusOK, body)
}

func (a *API) createClub(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Name  string `json:"name"`
		Intro string `json:"intro"`
		Mark  int    `json:"mark"`
		Frame int    `json:"frame"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	summary, err := a.summary(r, account)
	if err != nil {
		return err
	}
	if summary.Progress.Level < club.CreateLevel {
		return errClubLevel
	}
	info, err := a.store.CreateClub(r.Context(), store.ClubCreate{AccountID: account.ID, Name: request.Name,
		Intro: request.Intro, Mark: request.Mark, Frame: request.Frame, Now: a.nowMillis(), Data: a.clubData})
	if err != nil {
		return err
	}
	a.log.Info("club created", "username", account.Username, "club", info.ID, "name", info.Name)
	return a.clubAnswer(w, r, account, true, nil)
}

func (a *API) applyClub(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		ClubID int64 `json:"clubId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	joined, err := a.store.ApplyClub(r.Context(), account.ID, request.ClubID, a.nowMillis())
	if err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, map[string]any{"joined": joined})
}

func (a *API) cancelClubApplication(w http.ResponseWriter, r *http.Request) error {
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if err := a.store.CancelClubApplication(r.Context(), account.ID); err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, nil)
}

func (a *API) clubApplicants(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	applicants, err := a.store.ClubApplicants(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"applicants": a.clubMembers(applicants)})
}

func (a *API) decideClubApplicant(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		AccountID string `json:"accountId"`
		Accept    bool   `json:"accept"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if !validASCIIID(request.AccountID, 36) {
		return errInvalidAccountID
	}
	if err := a.store.DecideClubApplicant(r.Context(), account.ID, request.AccountID, request.Accept,
		a.nowMillis()); err != nil {
		return err
	}
	applicants, err := a.store.ClubApplicants(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, map[string]any{"applicants": a.clubMembers(applicants)})
}

func (a *API) leaveClub(w http.ResponseWriter, r *http.Request) error {
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if err := a.store.LeaveClub(r.Context(), account.ID, a.nowMillis()); err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, nil)
}

func (a *API) clubMemberChange(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		AccountID string `json:"accountId"`
		Grade     int    `json:"grade"`
		Kick      bool   `json:"kick"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if !validASCIIID(request.AccountID, 36) {
		return errInvalidAccountID
	}
	now := a.nowMillis()
	if request.Kick {
		err = a.store.KickClubMember(r.Context(), account.ID, request.AccountID, now)
	} else {
		err = a.store.SetClubGrade(r.Context(), account.ID, request.AccountID, request.Grade, now)
	}
	if err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, nil)
}

func (a *API) updateClub(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Intro    *string `json:"intro"`
		AutoJoin *bool   `json:"autoJoin"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if err := a.store.UpdateClub(r.Context(), account.ID, request.Intro, request.AutoJoin, a.nowMillis()); err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, nil)
}

func (a *API) breakClub(w http.ResponseWriter, r *http.Request) error {
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	immediate, err := a.store.BreakClub(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	a.log.Info("club break", "username", account.Username, "immediate", immediate)
	return a.clubAnswer(w, r, account, false, map[string]any{"immediate": immediate})
}

func (a *API) cancelClubBreak(w http.ResponseWriter, r *http.Request) error {
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if err := a.store.CancelClubBreak(r.Context(), account.ID, a.nowMillis()); err != nil {
		return err
	}
	return a.clubAnswer(w, r, account, false, nil)
}

// houseAnswer answers a 俱乐部基地 change with the house (and the summary).
func (a *API) houseAnswer(w http.ResponseWriter, r *http.Request, account store.Account, summary bool,
	fields map[string]any) error {
	house, err := a.store.ClubHouseView(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	body := map[string]any{"house": house}
	if summary {
		loaded, err := a.summary(r, account)
		if err != nil {
			return err
		}
		body["account"] = loaded
	}
	for key, value := range fields {
		body[key] = value
	}
	return writeJSON(w, http.StatusOK, body)
}

func (a *API) clubHouse(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	return a.houseAnswer(w, r, account, false, map[string]any{"rules": a.clubRules()})
}

func (a *API) donateClub(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Amount int64 `json:"amount"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if err := a.store.DonateClub(r.Context(), account.ID, request.Amount, a.nowMillis()); err != nil {
		return err
	}
	return a.houseAnswer(w, r, account, true, nil)
}

func (a *API) upgradeClub(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Facility int `json:"facility"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if _, err := a.store.UpgradeClub(r.Context(), account.ID, request.Facility, a.nowMillis()); err != nil {
		return err
	}
	return a.houseAnswer(w, r, account, false, nil)
}

func (a *API) renameClub(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if _, err := a.store.RenameClub(r.Context(), account.ID, request.Name, a.nowMillis()); err != nil {
		return err
	}
	return a.houseAnswer(w, r, account, false, nil)
}

func (a *API) changeClubMark(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Mark  int `json:"mark"`
		Frame int `json:"frame"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	if _, err := a.store.ChangeClubMark(r.Context(), a.clubData, account.ID, request.Mark, request.Frame,
		a.nowMillis()); err != nil {
		return err
	}
	return a.houseAnswer(w, r, account, false, nil)
}

func (a *API) claimClubWelfare(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Slot int `json:"slot"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.clubWrite(r)
	if err != nil {
		return err
	}
	welfare, _, err := a.store.ClaimClubWelfare(r.Context(), account.ID, request.Slot, a.nowMillis())
	if err != nil {
		return err
	}
	return a.houseAnswer(w, r, account, true, map[string]any{"welfare": welfare})
}
