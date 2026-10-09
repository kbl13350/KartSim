package api

import (
	"context"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"kartsim/internal/data/career"
	"kartsim/internal/data/myroom"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/rewards"
)

// My Room careers (成就) and emblems (徽章): the signed-in account's own
// lists and changes, and a visitor's read-only view of another rider's
// lists behind the room's 车库/徽章/图鉴/成就是否公开 password.

var (
	errUnknownRider     = apierr.New(http.StatusNotFound, "UNKNOWN_RIDER")
	errPasswordRequired = apierr.New(http.StatusForbidden, "PASSWORD_REQUIRED")
	errWrongPassword    = apierr.New(http.StatusForbidden, "WRONG_PASSWORD")
	errInvalidCareer    = apierr.New(http.StatusBadRequest, "INVALID_CAREER")
)

// recentCareers is how many completions the summary page lists
// (近期获得成就, completeCareerTemplate rows).
const recentCareers = 5

// Room password attempts per viewer account.
const (
	roomPasswordAttempts = 10
	roomPasswordWindow   = time.Minute
)

type careerSummary struct {
	Nickname string               `json:"nickname"`
	Progress progressJSON         `json:"progress"`
	Points   int                  `json:"points"`
	Careers  []career.Progress    `json:"careers"`
	Recent   []store.CareerRecord `json:"recent"`
	Owner    bool                 `json:"owner"`
}

type emblemSummary struct {
	Nickname string               `json:"nickname"`
	Emblems  []store.EmblemRecord `json:"emblems"`
	Main     [2]int               `json:"main"`
	Owner    bool                 `json:"owner"`
}

func (a *API) careerSummary(ctx context.Context, target store.Contact, owner bool) (careerSummary, error) {
	facts, err := a.store.CareerFacts(ctx, target.AccountID, a.nowMillis())
	if err != nil {
		return careerSummary{}, err
	}
	recent, err := a.store.RecentCareers(ctx, target.AccountID, recentCareers)
	if err != nil {
		return careerSummary{}, err
	}
	return careerSummary{Nickname: target.Nickname, Progress: a.progress(facts.Exp),
		Points:  a.careers.Points(facts.Rewarded),
		Careers: a.careers.Evaluate(facts), Recent: recent, Owner: owner}, nil
}

func (a *API) emblemSummary(ctx context.Context, target store.Contact, owner bool) (emblemSummary, error) {
	emblems, main, err := a.store.Emblems(ctx, target.AccountID)
	if err != nil {
		return emblemSummary{}, err
	}
	return emblemSummary{Nickname: target.Nickname, Emblems: emblems, Main: main, Owner: owner}, nil
}

// ownContact is the signed-in account as a Contact.
func (a *API) ownContact(r *http.Request) (store.Contact, error) {
	account, err := a.signedIn(r)
	if err != nil {
		return store.Contact{}, err
	}
	return store.Contact{AccountID: account.ID, Nickname: account.Nickname}, nil
}

func (a *API) listCareers(w http.ResponseWriter, r *http.Request) error {
	own, err := a.ownContact(r)
	if err != nil {
		return err
	}
	summary, err := a.careerSummary(r.Context(), own, true)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

func (a *API) completeCareer(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		CareerID int `json:"careerId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if request.CareerID <= 0 {
		return errInvalidCareer
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	done, err := a.store.CompleteCareer(r.Context(), a.careers, account.ID, request.CareerID, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, struct {
		Career career.Progress `json:"career"`
		Point  int             `json:"point"`
		Points int             `json:"points"`
		Emblem int             `json:"emblem,omitempty"`
	}{done.Career, done.Point, done.Points, done.Emblem})
}

func (a *API) listEmblems(w http.ResponseWriter, r *http.Request) error {
	own, err := a.ownContact(r)
	if err != nil {
		return err
	}
	summary, err := a.emblemSummary(r.Context(), own, true)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

func (a *API) setMainEmblems(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Main []int `json:"main"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if len(request.Main) != store.MainEmblemSlots {
		return apierr.New(http.StatusBadRequest, "INVALID_MAIN_EMBLEMS")
	}
	var main [store.MainEmblemSlots]int
	for i, id := range request.Main {
		if id != 0 && !a.careers.Emblem(id) {
			return apierr.New(http.StatusBadRequest, "INVALID_MAIN_EMBLEMS")
		}
		main[i] = id
	}
	own, err := a.ownContact(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), own.AccountID); err != nil {
		return err
	}
	if err := a.store.SetMainEmblems(r.Context(), own.AccountID, main); err != nil {
		return err
	}
	a.rooms.RefreshOwner(own.AccountID)
	summary, err := a.emblemSummary(r.Context(), own, true)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

// visitTarget resolves a visitor view request {nickname, password}: the
// rider named, after the room's etc password when it has one. The viewer's
// own name needs no password.
func (a *API) visitTarget(w http.ResponseWriter, r *http.Request) (store.Contact, bool, error) {
	var request struct {
		Nickname string `json:"nickname"`
		Password string `json:"password"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return store.Contact{}, false, err
	}
	viewer, err := a.signedIn(r)
	if err != nil {
		return store.Contact{}, false, err
	}
	nickname := strings.TrimSpace(request.Nickname)
	if nickname == "" || utf8.RuneCountInString(nickname) > 64 || utf8.RuneCountInString(request.Password) > 64 {
		return store.Contact{}, false, errInvalidRequest
	}
	target, found, err := a.store.ContactByNickname(r.Context(), nickname)
	if err != nil {
		return store.Contact{}, false, err
	}
	if !found {
		return store.Contact{}, false, errUnknownRider
	}
	if target.AccountID == viewer.ID {
		return target, true, nil
	}
	document, _, err := a.store.AccountProfile(r.Context(), target.AccountID)
	if err != nil {
		return store.Contact{}, false, err
	}
	settings := myroom.ParseProfile(document).Settings
	if settings.EtcLocked {
		if request.Password == "" {
			return store.Contact{}, false, errPasswordRequired
		}
		if err := a.roomPasswordAttempt(r.Context(), viewer.ID); err != nil {
			return store.Contact{}, false, err
		}
		if !settings.EtcPasswordMatches(request.Password) {
			return store.Contact{}, false, errWrongPassword
		}
	}
	return target, false, nil
}

// roomPasswordAttempt counts one room or etc password guess of a viewer.
func (a *API) roomPasswordAttempt(ctx context.Context, viewerID string) error {
	return a.hit(ctx, "room-password:"+viewerID, roomPasswordAttempts, roomPasswordWindow, false)
}

func (a *API) visitCareers(w http.ResponseWriter, r *http.Request) error {
	target, owner, err := a.visitTarget(w, r)
	if err != nil {
		return err
	}
	summary, err := a.careerSummary(r.Context(), target, owner)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

func (a *API) visitEmblems(w http.ResponseWriter, r *http.Request) error {
	target, owner, err := a.visitTarget(w, r)
	if err != nil {
		return err
	}
	summary, err := a.emblemSummary(r.Context(), target, owner)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

// recordLoginDay notes the Beijing day a signed-in account was seen on (the
// date careers); failures only cost that day's mark.
func (a *API) recordLoginDay(ctx context.Context, accountID string) {
	if err := a.store.RecordLoginDay(ctx, accountID, rewards.BeijingDay(a.now())); err != nil {
		a.log.Warn("login day not recorded", "account", accountID, "error", err)
	}
}

// ShutdownMyRoom closes the My Room sockets.
func (a *API) ShutdownMyRoom(ctx context.Context) error { return a.rooms.Shutdown(ctx) }

// roomBackend adapts the API to the My Room hub.
type roomBackend struct{ a *API }

var _ myroom.Backend = roomBackend{}

func (b roomBackend) Authenticate(ctx context.Context, token string) (myroom.Session, bool, error) {
	account, found, err := b.a.findAccount(ctx, &token)
	if err != nil || !found {
		return myroom.Session{}, false, err
	}
	return myroom.Session{AccountID: account.ID, Key: digest(token)}, true, nil
}

func (b roomBackend) rider(ctx context.Context, contact store.Contact) (myroom.Rider, error) {
	document, _, err := b.a.store.AccountProfile(ctx, contact.AccountID)
	if err != nil {
		return myroom.Rider{}, err
	}
	progress := b.a.progress(contact.Exp)
	return myroom.Rider{AccountID: contact.AccountID, Nickname: contact.Nickname, Exp: contact.Exp,
		Level: progress.Level, Glove: progress.Glove, Profile: myroom.ParseProfile(document)}, nil
}

func (b roomBackend) Rider(ctx context.Context, accountID string) (myroom.Rider, bool, error) {
	contact, found, err := b.a.store.ContactByID(ctx, accountID)
	if err != nil || !found {
		return myroom.Rider{}, false, err
	}
	rider, err := b.rider(ctx, contact)
	return rider, err == nil, err
}

func (b roomBackend) RiderByNickname(ctx context.Context, nickname string) (myroom.Rider, bool, error) {
	contact, found, err := b.a.store.ContactByNickname(ctx, nickname)
	if err != nil || !found {
		return myroom.Rider{}, false, err
	}
	rider, err := b.rider(ctx, contact)
	return rider, err == nil, err
}

func (b roomBackend) MainEmblems(ctx context.Context, accountID string) ([2]int, error) {
	_, main, err := b.a.store.Emblems(ctx, accountID)
	return main, err
}

func (b roomBackend) Blocked(ctx context.Context, owner, visitor string) (bool, error) {
	return b.a.store.IsBlocked(ctx, owner, visitor)
}

func (b roomBackend) Online(limit int) []string { return b.a.hub.Visible(limit) }

func (b roomBackend) PasswordAttempt(ctx context.Context, accountID string) error {
	return b.a.roomPasswordAttempt(ctx, accountID)
}
