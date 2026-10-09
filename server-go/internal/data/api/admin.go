package api

import (
	_ "embed"
	"net/http"
	"unicode/utf8"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// The admin console: a static page (GET /multiplayer/admin) that signs in
// through the normal login and keeps the token in memory only, and the
// admin API it calls. Every admin endpoint needs a session of an admin
// (stored admin flag or KART_ADMIN_USERNAMES).

//go:embed admin.html
var adminHTML []byte

//go:embed admin.js
var adminJS []byte

const (
	maxAdminResults = 50
	maxAdminQuery   = 64
	maxGrantAmount  = 1_000_000_000
	maxGrantNote    = 200
)

var (
	errInvalidGrant  = apierr.New(http.StatusBadRequest, "INVALID_GRANT")
	errInvalidNote   = apierr.New(http.StatusBadRequest, "INVALID_NOTE")
	errInvalidQuery  = apierr.New(http.StatusBadRequest, "INVALID_QUERY")
	errUnknownTarget = apierr.New(http.StatusNotFound, "ACCOUNT_NOT_FOUND")
)

// adminPageHeaders lock the console down: only its own script, no framing,
// no referrer, never cached.
func adminPageHeaders(w http.ResponseWriter, contentType string) {
	header := w.Header()
	header.Set("Content-Type", contentType)
	header.Set("Cache-Control", "no-store")
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("X-Frame-Options", "DENY")
	header.Set("Referrer-Policy", "no-referrer")
	header.Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
		"connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
}

func (a *API) adminPage(w http.ResponseWriter, _ *http.Request) error {
	adminPageHeaders(w, "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(adminHTML)
	return nil
}

func (a *API) adminScript(w http.ResponseWriter, _ *http.Request) error {
	adminPageHeaders(w, "text/javascript; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(adminJS)
	return nil
}

// adminAccountJSON is one account in the admin console.
type adminAccountJSON struct {
	ID             string       `json:"id"`
	Username       string       `json:"username"`
	Nickname       string       `json:"nickname"`
	Admin          bool         `json:"admin"`
	CreatedAt      int64        `json:"createdAt"`
	Level          int          `json:"level"`
	Exp            int64        `json:"exp"`
	Wallet         store.Wallet `json:"wallet"`
	InventoryCount int          `json:"inventoryCount"`
	Onboarded      bool         `json:"onboarded"`
}

func (a *API) adminAccountView(row store.AdminAccountRow) adminAccountJSON {
	account := a.withAdmin(row.Account)
	return adminAccountJSON{
		ID: account.ID, Username: account.Username, Nickname: account.Nickname, Admin: account.Admin,
		CreatedAt: row.CreatedAt, Level: a.economy.Levels.LevelForExp(row.Exp).Level, Exp: row.Exp,
		Wallet: row.Wallet, InventoryCount: row.InventoryCount, Onboarded: row.Onboarded,
	}
}

// adminAccounts searches accounts by username or nickname (?q=, contains;
// the newest accounts without q), at most 50.
func (a *API) adminAccounts(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	query := ""
	if q := queryParam(r, "q"); q != nil {
		query = *q
	}
	if !utf8.ValidString(query) || utf8.RuneCountInString(query) > maxAdminQuery {
		return errInvalidQuery
	}
	rows, err := a.store.AdminAccounts(r.Context(), query, maxAdminResults, a.nowMillis())
	if err != nil {
		return err
	}
	accounts := make([]adminAccountJSON, len(rows))
	for i, row := range rows {
		accounts[i] = a.adminAccountView(row)
	}
	return writeJSON(w, http.StatusOK, map[string]any{"accounts": accounts})
}

// adminGrant adds to or takes from an account's coupon, lucci, koin or exp
// ({username, currency, amount, note, requestId?}). Balances and exp never
// go below zero (409 INSUFFICIENT_FUNDS / INSUFFICIENT_EXP). The ledger row
// has reason "admin", ref "<admin>:<requestId>" and the note. The request id
// stands for one grant: repeating it with the same account, currency and
// amount changes nothing and answers duplicate:true, reusing it with others
// is 409 REQUEST_ID_CONFLICT. Without a requestId the server picks one.
func (a *API) adminGrant(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Username  string `json:"username"`
		Currency  string `json:"currency"`
		Amount    int64  `json:"amount"`
		Note      string `json:"note"`
		RequestID string `json:"requestId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	if (request.Currency != store.GrantExp && !economy.Currency(request.Currency).Valid()) ||
		request.Amount == 0 || request.Amount > maxGrantAmount || request.Amount < -maxGrantAmount {
		return errInvalidGrant
	}
	if !validText(request.Note, maxGrantNote) {
		return errInvalidNote
	}
	id := newUUID()
	if request.RequestID != "" {
		if id, err = requestID(request.RequestID); err != nil {
			return err
		}
	}
	if !validUsername(&request.Username) {
		return errUnknownTarget
	}
	ctx := r.Context()
	accountID, found, err := a.store.AccountIDByUsername(ctx, request.Username)
	if err != nil {
		return err
	}
	if !found {
		return errUnknownTarget
	}
	now := a.nowMillis()
	result, err := a.store.AdminGrant(ctx, store.Grant{
		AccountID: accountID, Currency: request.Currency, Amount: request.Amount,
		Admin: admin.Username, RequestID: id, Note: request.Note, Now: now,
	})
	if err != nil {
		return err
	}
	a.log.Info("admin grant", "admin", admin.Username, "account", request.Username, "currency", request.Currency,
		"amount", request.Amount, "applied", result.Applied, "duplicate", result.Duplicate, "note", request.Note)
	row, found, err := a.store.AdminAccount(ctx, accountID, now)
	if err != nil {
		return err
	}
	if !found {
		return errUnknownTarget
	}
	return writeJSON(w, http.StatusOK, struct {
		store.GrantResult
		RequestID string           `json:"requestId"`
		Account   adminAccountJSON `json:"account"`
	}{result, id, a.adminAccountView(row)})
}
