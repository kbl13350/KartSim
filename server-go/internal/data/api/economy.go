package api

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/rewards"
)

// The account economy endpoints (ECONOMY.md 6). Every one needs a Bearer
// session; balances and inventory are always read from MySQL.

// maxTimeAttackMs bounds a time-attack run (INT column; no real run is
// anywhere near an hour).
const maxTimeAttackMs = 60 * 60 * 1000

var (
	errInvalidStarter   = apierr.New(http.StatusBadRequest, "INVALID_STARTER")
	errInvalidRequestID = apierr.New(http.StatusBadRequest, "INVALID_REQUEST_ID")
	errOfferNotFound    = apierr.New(http.StatusNotFound, "OFFER_NOT_FOUND")
	errInvalidTrack     = apierr.New(http.StatusBadRequest, "INVALID_TRACK")
	errInvalidElapsed   = apierr.New(http.StatusBadRequest, "INVALID_ELAPSED_MS")

	uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// requestID validates a client-generated UUID and returns its lower-case form.
func requestID(value string) (string, error) {
	if !uuidPattern.MatchString(value) {
		return "", errInvalidRequestID
	}
	return strings.ToLower(value), nil
}

// summaryJSON is ECONOMY.md 8 AccountSummary.
type summaryJSON struct {
	Account   summaryAccount     `json:"account"`
	Progress  progressJSON       `json:"progress"`
	Wallet    store.Wallet       `json:"wallet"`
	Stats     store.SummaryStats `json:"stats"`
	Onboarded bool               `json:"onboarded"`
}

type summaryAccount struct {
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	Admin     bool   `json:"admin"`
	CreatedAt int64  `json:"createdAt"`
}

// progressJSON is the level state; nextLevelExp is null at the max level.
type progressJSON struct {
	Level        int    `json:"level"`
	Exp          int64  `json:"exp"`
	LevelExp     int64  `json:"levelExp"`
	NextLevelExp *int64 `json:"nextLevelExp"`
	Glove        string `json:"glove"`
	GloveName    string `json:"gloveName"`
	MaxLevel     int    `json:"maxLevel"`
	// TryLevel is the highest license the level may try (1 新手 … 5 L1);
	// License the license held (0 none … 6 PRO) and ProUntil the end of a
	// PRO license (Unix ms, 0 never taken).
	TryLevel int   `json:"tryLevel"`
	License  int   `json:"license"`
	ProUntil int64 `json:"proUntil"`
}

func (a *API) progress(exp int64) progressJSON {
	level := a.economy.Levels.LevelForExp(exp)
	progress := progressJSON{Level: level.Level, Exp: level.Exp, LevelExp: level.LevelStartExp,
		Glove: level.Glove, GloveName: level.GloveName, MaxLevel: level.MaxLevel,
		TryLevel: a.economy.Levels.Levels[level.Level].TryLevel}
	if level.Level < level.MaxLevel {
		next := level.NextLevelExp
		progress.NextLevelExp = &next
	}
	return progress
}

// summary loads the AccountSummary of a signed-in account.
func (a *API) summary(r *http.Request, account store.Account) (summaryJSON, error) {
	loaded, found, err := a.store.AccountSummary(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return summaryJSON{}, err
	}
	if !found {
		return summaryJSON{}, errLoginRequired // the account was deleted under its session
	}
	loaded.Account = a.withAdmin(loaded.Account)
	return summaryJSON{
		Account: summaryAccount{Username: loaded.Account.Username, Nickname: loaded.Account.Nickname,
			Admin: loaded.Account.Admin, CreatedAt: loaded.CreatedAt},
		Progress:  a.licensed(a.progress(loaded.Exp), loaded.License, loaded.ProUntil),
		Wallet:    loaded.Wallet,
		Stats:     loaded.Stats,
		Onboarded: loaded.Onboarded,
	}, nil
}

// signedIn resolves the Bearer session.
func (a *API) signedIn(r *http.Request) (store.Account, error) {
	return a.requireAccount(r.Context(), bearer(r))
}

func (a *API) accountSummary(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	a.recordLoginDay(r.Context(), account.ID)
	summary, err := a.summary(r, account)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

// claimStarter grants the new-rider gift once and answers the account
// summary; claiming again changes nothing and answers the same way.
func (a *API) claimStarter(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Character int `json:"character"`
		Paint     int `json:"paint"`
		Dye       int `json:"dye"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	starter := &a.economy.Catalog.Starter
	if !starter.AllowsCharacter(request.Character) || !starter.AllowsPaint(request.Paint) || !starter.AllowsDye(request.Dye) {
		return errInvalidStarter
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	fallback := starterFallback{KartKey: starter.Kart.SystemKey, Character: request.Character, Paint: request.Paint, Dye: request.Dye}
	claimed, err := a.store.ClaimStarter(r.Context(), account.ID,
		store.StarterChoice{Character: request.Character, Paint: request.Paint, Dye: request.Dye}, a.nowMillis(),
		func(profile string, found bool) (string, error) {
			return withStarterEquipment(profile, found, fallback)
		})
	if err != nil {
		return err
	}
	if claimed {
		a.log.Info("starter gift claimed", "username", account.Username, "character", request.Character)
	}
	summary, err := a.summary(r, account)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

// withStarterEquipment puts the starter equipment into a profile, keeping
// its other fields.
func withStarterEquipment(profile string, found bool, fallback starterFallback) (string, error) {
	fields := map[string]json.RawMessage{}
	if found && json.Unmarshal([]byte(profile), &fields) != nil {
		fields = map[string]json.RawMessage{} // unreadable: start over
	}
	equipment, err := starterEquipment(fallback)
	if err != nil {
		return "", err
	}
	fields["equipment"] = equipment
	merged, err := marshalJSON(fields)
	return string(merged), err
}

// inventory lists the account's unexpired items.
func (a *API) inventory(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	now := a.nowMillis()
	items, err := a.store.Inventory(r.Context(), account.ID, now)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, struct {
		Items      []store.InventoryItem `json:"items"`
		ServerTime int64                 `json:"serverTime"`
	}{items, now})
}

// getAccountProfile returns the account-bound profile with equipment the
// account no longer owns (expired rentals) replaced by the starter
// fallbacks. The stored document is not changed; the next PUT stores the
// corrected one.
func (a *API) getAccountProfile(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	ctx := r.Context()
	profile, found, err := a.store.AccountProfile(ctx, account.ID)
	if err != nil {
		return err
	}
	if !found {
		return errProfileNotFound
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal([]byte(profile), &fields) != nil {
		writeRaw(w, http.StatusOK, []byte(profile))
		return nil
	}
	raw, present := fields["equipment"]
	if !present || string(raw) == "null" {
		writeRaw(w, http.StatusOK, []byte(profile))
		return nil
	}
	doc, err := parseEquipment(raw)
	var items []equippedItem
	if err == nil {
		items, err = doc.items()
	}
	if err != nil {
		a.log.Debug("stored profile equipment is unreadable; returned as is", "account", account.ID)
		writeRaw(w, http.StatusOK, []byte(profile))
		return nil
	}
	missing, _, err := a.missingItems(ctx, account.ID, items)
	if err != nil {
		return err
	}
	if len(missing) == 0 {
		writeRaw(w, http.StatusOK, []byte(profile))
		return nil
	}
	fallback, err := a.fallbackFor(ctx, account.ID)
	if err != nil {
		return err
	}
	doc.replace(missing, fallback)
	if fields["equipment"], err = doc.marshal(); err != nil {
		return err
	}
	sanitized, err := marshalJSON(fields)
	if err != nil {
		return err
	}
	writeRaw(w, http.StatusOK, sanitized)
	return nil
}

// putAccountProfile stores the account-bound profile (a JSON object of at
// most 1,000,000 UTF-16 units, like /api/profile). Its equipment, when
// present, may only use items the account owns: otherwise 409
// ITEM_NOT_OWNED lists the slots.
func (a *API) putAccountProfile(w http.ResponseWriter, r *http.Request) error {
	doc, kind, err := readDocument(w, r)
	if err != nil {
		return err
	}
	if err := checkDocument(doc, kind, maxProfileChars, false); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	ctx := r.Context()
	var fields map[string]json.RawMessage
	if err := json.Unmarshal([]byte(doc), &fields); err != nil {
		return errInvalidDocument
	}
	if raw, present := fields["equipment"]; present && string(raw) != "null" {
		equipment, err := parseEquipment(raw)
		if err != nil {
			return errInvalidEquipment
		}
		items, err := equipment.items()
		if err != nil {
			return errInvalidEquipment
		}
		missing, _, err := a.missingItems(ctx, account.ID, items)
		if err != nil {
			return err
		}
		if len(missing) > 0 {
			return writeItemNotOwned(w, missing)
		}
	}
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	if err := a.store.SaveAccountProfile(ctx, account.ID, doc, a.nowMillis()); err != nil {
		return err
	}
	a.rooms.RefreshOwner(account.ID) // room settings and looks live in the profile
	writeRaw(w, http.StatusOK, []byte(doc))
	return nil
}

// catalogDocument is the shop catalog response, encoded once.
type catalogDocument struct {
	etag    string
	body    []byte
	gzipped func() []byte
}

func newCatalogDocument(catalog *economy.Catalog) catalogDocument {
	return newJSONDocument(catalog.Version, catalog.JSON())
}

// newJSONDocument is a fixed JSON response with its ETag (the version) and
// gzipped form made once.
func newJSONDocument(version string, body []byte) catalogDocument {
	return catalogDocument{
		etag: `"` + version + `"`,
		body: body,
		gzipped: sync.OnceValue(func() []byte {
			var buffer bytes.Buffer
			writer, _ := gzip.NewWriterLevel(&buffer, gzip.BestCompression)
			_, _ = writer.Write(body)
			_ = writer.Close()
			return buffer.Bytes()
		}),
	}
}

// shopCatalog serves the embedded catalog: ETag is its version, so a
// revalidation costs a 304; gzip when the client accepts it. It needs no
// session (the catalog is public).
func (a *API) shopCatalog(w http.ResponseWriter, r *http.Request) error {
	return serveDocument(w, r, a.catalog)
}

// serveDocument answers a fixed document with its ETag (304 on a match)
// and gzip when the client accepts it.
func serveDocument(w http.ResponseWriter, r *http.Request, doc catalogDocument) error {
	header := w.Header()
	header.Set("ETag", doc.etag)
	header.Set("Cache-Control", "public, max-age=300")
	header.Add("Vary", "Accept-Encoding")
	if etagMatches(r.Header.Values("If-None-Match"), doc.etag) {
		w.WriteHeader(http.StatusNotModified)
		return nil
	}
	body := doc.body
	if acceptsGzip(r.Header.Values("Accept-Encoding")) {
		body = doc.gzipped()
		header.Set("Content-Encoding", "gzip")
	}
	header.Set("Content-Type", "application/json; charset=utf-8")
	header.Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
	return nil
}

// etagMatches implements If-None-Match (weak comparison, "*" matches).
func etagMatches(values []string, etag string) bool {
	for _, value := range values {
		for _, candidate := range strings.Split(value, ",") {
			candidate = strings.TrimSpace(candidate)
			if candidate == "*" || strings.TrimPrefix(candidate, "W/") == etag {
				return true
			}
		}
	}
	return false
}

// acceptsGzip reports whether Accept-Encoding allows gzip (q > 0).
func acceptsGzip(values []string) bool {
	for _, value := range values {
		for _, entry := range strings.Split(value, ",") {
			coding, params, _ := strings.Cut(strings.TrimSpace(entry), ";")
			coding = strings.ToLower(strings.TrimSpace(coding))
			if coding != "gzip" && coding != "*" {
				continue
			}
			params = strings.ReplaceAll(params, " ", "")
			if q, ok := strings.CutPrefix(strings.ToLower(params), "q="); ok {
				if weight, err := strconv.ParseFloat(q, 64); err == nil && weight == 0 {
					continue
				}
			}
			return true
		}
	}
	return false
}

// purchase buys a catalog offer ({offerId, requestId, expectedPrice?,
// expectedCurrency?}) and answers {wallet, item, purchaseId}; a repeated
// requestId answers the original. When the expected price or currency (what
// the shop showed) differs from the current offer the answer is 409
// PRICE_CHANGED and nothing is bought.
func (a *API) purchase(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		OfferID          string  `json:"offerId"`
		RequestID        string  `json:"requestId"`
		ExpectedPrice    *int64  `json:"expectedPrice"`
		ExpectedCurrency *string `json:"expectedCurrency"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	item, offer, ok := a.economy.Catalog.OfferByID(request.OfferID)
	if !ok {
		return errOfferNotFound
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	result, err := a.store.Purchase(r.Context(), store.Purchase{
		AccountID: account.ID, RequestID: id, Item: item, Offer: offer,
		CatalogVersion: a.economy.Catalog.Version, Now: a.nowMillis(),
		ExpectedPrice: request.ExpectedPrice, ExpectedCurrency: request.ExpectedCurrency,
	})
	if err != nil {
		return err
	}
	a.log.Debug("purchase", "username", account.Username, "offer", offer.OfferID, "price", offer.Price,
		"currency", offer.Currency, "purchaseId", result.PurchaseID)
	return writeJSON(w, http.StatusOK, result)
}

// spendEventJSON is the GET /api/shop/spend-event body.
type spendEventJSON struct {
	Event      *economy.SpendEvent `json:"event"` // null when no event is shown
	Spent      int64               `json:"spent"`
	Active     bool                `json:"active"`
	ServerTime int64               `json:"serverTime"`
}

// shopSpendEvent answers the shop's tcCash 累计消费 event (ECONOMY.md 3.4):
// the event shown now (from its event period start to its reward period
// end), the coupons the account spent on shop purchases within the event
// period, and whether spending still counts (active: now is in the event
// period). Without a shown event: {"event": null, "spent": 0, "active":
// false}. The rewards are display-only; nothing is granted.
func (a *API) shopSpendEvent(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	now := a.now()
	body := spendEventJSON{ServerTime: now.UnixMilli()}
	if event, ok := a.events.SpendEventAt(now); ok {
		from, until := event.EventPeriod.Millis()
		spent, err := a.store.ShopCouponSpent(r.Context(), account.ID, from, until)
		if err != nil {
			return err
		}
		body.Event, body.Spent, body.Active = event, spent, event.Active(now)
	}
	return writeJSON(w, http.StatusOK, body)
}

// settleTimeAttack credits a finished time-attack run (ECONOMY.md 2.2) and
// answers what it granted plus the account summary; a repeated requestId
// answers the original grant. The track must be one of the exported
// time-attack tracks (400 INVALID_TRACK); runs closer together than their
// own time are refused (429 TOO_MANY_ATTEMPTS, see store.SettleTimeAttack).
func (a *API) settleTimeAttack(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		TrackID   string `json:"trackId"`
		ElapsedMs *int64 `json:"elapsedMs"`
		RequestID string `json:"requestId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if !validText(request.TrackID, 64) || !a.tracks.Has(request.TrackID) {
		return errInvalidTrack
	}
	if request.ElapsedMs == nil || !rewards.ValidTimeAttack(*request.ElapsedMs) || *request.ElapsedMs > maxTimeAttackMs {
		return errInvalidElapsed
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	now := a.now()
	result, err := a.store.SettleTimeAttack(r.Context(), store.TimeAttackRun{
		AccountID: account.ID, RequestID: id, TrackID: request.TrackID, ElapsedMs: *request.ElapsedMs,
		Day: rewards.BeijingDay(now), Now: now.UnixMilli(), MaxTracks: a.tracks.Len(),
	})
	if err != nil {
		return err
	}
	summary, err := a.summary(r, account)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, struct {
		store.TimeAttackResult
		Summary summaryJSON `json:"summary"`
	}{result, summary})
}
