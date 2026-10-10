package api

import (
	"context"
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strconv"
	"strings"
	"unicode/utf8"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// The admin console (ADMIN.md): a single-page app (GET /multiplayer/admin,
// with or without the trailing slash; built from server-go/admin-ui into
// adminui/ and embedded) that signs in through the normal login and keeps
// the token in memory only, and the admin API it calls. Every admin endpoint needs a session of an admin
// (stored admin flag or KART_ADMIN_USERNAMES).

//go:embed all:adminui
var adminUI embed.FS

// adminFiles is the console build (index.html and assets/); tests swap it.
var adminFiles = func() fs.FS {
	files, err := fs.Sub(adminUI, "adminui")
	if err != nil {
		panic(err) // adminui is a constant directory of this package
	}
	return files
}()

const (
	maxAdminQuery  = 64
	maxGrantAmount = 1_000_000_000
	maxGrantNote   = 200

	defaultPageSize = 20
	maxPageSize     = 100
	maxPage         = 1_000_000
)

var (
	errInvalidGrant  = apierr.New(http.StatusBadRequest, "INVALID_GRANT")
	errInvalidNote   = apierr.New(http.StatusBadRequest, "INVALID_NOTE")
	errInvalidQuery  = apierr.New(http.StatusBadRequest, "INVALID_QUERY")
	errUnknownTarget = apierr.New(http.StatusNotFound, "ACCOUNT_NOT_FOUND")
	errAssetNotFound = apierr.New(http.StatusNotFound, "NOT_FOUND")
)

// adminPageHeaders lock the console down: only its own scripts, styles and
// fonts, no framing, no referrer, never cached.
func adminPageHeaders(w http.ResponseWriter, contentType string) {
	header := w.Header()
	header.Set("Content-Type", contentType)
	header.Set("Cache-Control", "no-store")
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("X-Frame-Options", "DENY")
	header.Set("Referrer-Policy", "no-referrer")
	header.Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "+
		"connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; "+
		"frame-ancestors 'none'")
}

func (a *API) adminPage(w http.ResponseWriter, _ *http.Request) error {
	page, err := fs.ReadFile(adminFiles, "index.html")
	if err != nil {
		return err
	}
	adminPageHeaders(w, "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(page)
	return nil
}

// adminAssetTypes are the Content-Types of the console build's files; any
// other file is served as application/octet-stream.
var adminAssetTypes = map[string]string{
	".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8", ".json": "application/json", ".map": "application/json",
	".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
	".webp": "image/webp", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8",
}

// adminAsset serves a file of the console build's assets/ directory. Vite
// names them by content hash, so they are cached for good.
func (a *API) adminAsset(w http.ResponseWriter, r *http.Request) error {
	name := r.PathValue("path")
	if !fs.ValidPath(name) || strings.Contains(name, `\`) {
		return errAssetNotFound
	}
	body, err := fs.ReadFile(adminFiles, "assets/"+name)
	if err != nil {
		return errAssetNotFound // missing, or a directory
	}
	contentType, known := adminAssetTypes[strings.ToLower(path.Ext(name))]
	if !known {
		contentType = "application/octet-stream"
	}
	adminPageHeaders(w, contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
	return nil
}

// listJSON is the body of every admin list.
type listJSON[T any] struct {
	Items    []T `json:"items"`
	Total    int `json:"total"`
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
}

// adminList is the common query of an admin list (ADMIN.md 3): ?page=
// (from 1), pageSize= (1-100, 20), q= (at most 64 characters, matched as
// a substring), sort= (one of the list's keys), order=asc|desc, from= and
// to= (inclusive Unix ms).
type adminList struct {
	page, pageSize int
	store.AdminPage
}

// parseAdminList reads the common query. sorts are the list's sort keys,
// the first being the default; the order defaults to desc, or to asc when
// ascending is set.
func parseAdminList(r *http.Request, ascending bool, sorts ...string) (adminList, error) {
	values := r.URL.Query()
	list := adminList{page: 1, pageSize: defaultPageSize}
	number := func(name string, low, high int64) (int64, bool, error) {
		text := values.Get(name)
		if text == "" {
			return 0, false, nil
		}
		value, err := strconv.ParseInt(text, 10, 64)
		if err != nil || value < low || value > high {
			return 0, false, errInvalidQuery
		}
		return value, true, nil
	}
	if value, set, err := number("page", 1, maxPage); err != nil {
		return list, err
	} else if set {
		list.page = int(value)
	}
	if value, set, err := number("pageSize", 1, maxPageSize); err != nil {
		return list, err
	} else if set {
		list.pageSize = int(value)
	}
	for _, bound := range []struct {
		name   string
		target **int64
	}{{"from", &list.From}, {"to", &list.To}} {
		if value, set, err := number(bound.name, 0, 1<<53); err != nil {
			return list, err
		} else if set {
			*bound.target = &value
		}
	}
	query := strings.TrimSpace(values.Get("q"))
	if !utf8.ValidString(query) || utf8.RuneCountInString(query) > maxAdminQuery {
		return list, errInvalidQuery
	}
	list.Query = query
	list.Sort = sorts[0]
	if sort := values.Get("sort"); sort != "" {
		known := false
		for _, key := range sorts {
			known = known || key == sort
		}
		if !known {
			return list, errInvalidQuery
		}
		list.Sort = sort
	}
	switch values.Get("order") {
	case "":
		list.Desc = !ascending
	case "asc":
		list.Desc = false
	case "desc":
		list.Desc = true
	default:
		return list, errInvalidQuery
	}
	list.Offset, list.Limit = (list.page-1)*list.pageSize, list.pageSize
	return list, nil
}

// answer writes a page of a list.
func answerList[T any](w http.ResponseWriter, list adminList, items []T, total int) error {
	if items == nil {
		items = []T{}
	}
	return writeJSON(w, http.StatusOK, listJSON[T]{Items: items, Total: total, Page: list.page, PageSize: list.pageSize})
}

// emptyList answers a list whose filter cannot match.
func emptyList[T any](w http.ResponseWriter, list adminList) error {
	return answerList(w, list, []T{}, 0)
}

// flagParam reads a filter switch: 1 or true; absent, 0 or false is off.
func flagParam(r *http.Request, name string) (bool, error) {
	switch r.URL.Query().Get(name) {
	case "", "0", "false":
		return false, nil
	case "1", "true":
		return true, nil
	}
	return false, errInvalidQuery
}

// tokenParam reads an ASCII filter value (a kind, a currency, a reason, a
// track): "" when absent, 400 INVALID_QUERY when not printable ASCII.
func tokenParam(r *http.Request, name string, max int) (string, error) {
	value := r.URL.Query().Get(name)
	if value != "" && !validASCIIID(value, max) {
		return "", errInvalidQuery
	}
	return value, nil
}

// oneOfParam reads a filter value that must be one of allowed ("" when absent).
func oneOfParam(r *http.Request, name string, allowed ...string) (string, error) {
	value := r.URL.Query().Get(name)
	if value == "" {
		return "", nil
	}
	for _, option := range allowed {
		if value == option {
			return value, nil
		}
	}
	return "", errInvalidQuery
}

// accountParam reads a list's account filter (?account=): an account id or
// a username (any case). matched is false when it names no account, so
// the list is empty.
func (a *API) accountParam(ctx context.Context, r *http.Request) (id string, matched bool, err error) {
	value := strings.TrimSpace(r.URL.Query().Get("account"))
	switch {
	case value == "":
		return "", true, nil
	case len(value) == 36 && validASCIIID(value, 36):
		return value, true, nil
	case !validUsername(&value):
		return "", false, nil
	}
	return a.store.AccountIDByUsername(ctx, value)
}

// adminGrant adds to or takes from an account's coupon, lucci, koin or exp
// ({username, currency, amount, note, requestId?}). Balances and exp never
// go below zero (409 INSUFFICIENT_FUNDS / INSUFFICIENT_EXP). The ledger row
// has reason "admin", ref "<admin>:<requestId>" and the note. The request id
// stands for one grant: repeating it with the same account, currency and
// amount changes nothing and answers duplicate:true, reusing it with others
// is 409 REQUEST_ID_CONFLICT. Without a requestId the server picks one. The
// answer's account is an AccountRow plus its wallet.
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
	type grantedAccount struct {
		accountRowJSON
		Wallet store.Wallet `json:"wallet"`
	}
	return writeJSON(w, http.StatusOK, struct {
		store.GrantResult
		RequestID string         `json:"requestId"`
		Account   grantedAccount `json:"account"`
	}{result, id, grantedAccount{a.accountRows(ctx, []store.AdminAccountRow{row}, now)[0], row.Wallet}})
}
