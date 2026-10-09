// Package api is the HTTP surface of the data service: the public API that
// browsers use (ported from the Java HttpApi, StorageApi and HistoryApi, plus
// the game-server list, entry tickets, player stats and the account economy
// of ECONOMY.md) and the internal API that game nodes call with the cluster
// key.
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/netip"
	"strings"
	"time"
	"unicode/utf8"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/config"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/rewards"
)

const (
	// maxBodyBytes bounds every request body (DESIGN.md 3.2).
	maxBodyBytes = 8 << 20
	// requestTimeout bounds the MySQL and Redis work of one request.
	requestTimeout = 20 * time.Second
)

var (
	errInvalidRequest     = apierr.New(http.StatusBadRequest, "INVALID_REQUEST")
	errRequestTooLarge    = apierr.New(http.StatusRequestEntityTooLarge, "REQUEST_TOO_LARGE")
	errServiceUnavailable = apierr.New(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	errServerBusy         = apierr.New(http.StatusServiceUnavailable, "SERVER_BUSY")
)

// Options are the dependencies of the API.
type Options struct {
	Store        *store.Store
	Cache        *cache.Cache
	Cluster      *cache.Cluster
	Network      *netcfg.Network
	Secret       []byte // KART_CLUSTER_SECRET: ticket signing and internal auth
	DataNodeID   string
	PublicOrigin string // KART_PUBLIC_ORIGIN, empty when unset
	Logger       *slog.Logger
	Now          func() time.Time // defaults to time.Now

	// Accounts and economy (ECONOMY.md).
	Economy        *economy.Data  // the embedded catalog and levels when nil
	Registration   string         // config.Registration*; open when empty
	AllowGuests    bool           // issue guest tickets without a login
	AdminUsernames []string       // KART_ADMIN_USERNAMES (any case)
	Rates          *rewards.Rates // KART_EXP_RATE / KART_LUCCI_RATE; 1.0 when nil
	TrustedProxies []netip.Prefix // peers whose X-Forwarded-For is believed; loopback when nil
	Limiter        *cache.Limiter // rate limits; none when nil
	Limits         *RateLimits    // DefaultRateLimits when nil
	StartingLucci  *int64         // KART_STARTING_LUCCI; store.DefaultStartingLucci when nil
}

// API serves the public and internal handlers.
type API struct {
	store        *store.Store
	cache        *cache.Cache
	cluster      *cache.Cluster
	network      *netcfg.Network
	secret       []byte
	dataNode     string
	publicOrigin string
	log          *slog.Logger
	now          func() time.Time

	economy        *economy.Data
	tracks         *economy.Tracks
	events         *economy.Events
	catalog        catalogDocument
	registration   string
	allowGuests    bool
	admins         map[string]bool
	rates          rewards.Rates
	trustedProxies []netip.Prefix
	limiter        *cache.Limiter
	limits         RateLimits
}

// New builds the API.
func New(opts Options) *API {
	now := opts.Now
	if now == nil {
		now = time.Now
	}
	network := opts.Network
	if network == nil {
		network = netcfg.LoopbackOnly()
	}
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}
	data := opts.Economy
	if data == nil {
		var err error
		if data, err = economy.Default(); err != nil {
			panic(err) // the embedded data is checked by the economy tests
		}
	}
	tracks := data.Tracks
	if tracks == nil {
		var err error
		if tracks, err = economy.DefaultTracks(); err != nil {
			panic(err) // the embedded data is checked by the economy tests
		}
	}
	events := data.Events
	if events == nil {
		var err error
		if events, err = economy.DefaultEvents(); err != nil {
			panic(err) // the embedded data is checked by the economy tests
		}
	}
	registration := opts.Registration
	if registration == "" {
		registration = config.RegistrationOpen
	}
	admins := map[string]bool{}
	for _, name := range opts.AdminUsernames {
		admins[strings.ToLower(name)] = true
	}
	rates := rewards.DefaultRates()
	if opts.Rates != nil {
		rates = *opts.Rates
	}
	proxies := opts.TrustedProxies
	if proxies == nil {
		proxies = config.DefaultTrustedProxies
	}
	limits := DefaultRateLimits()
	if opts.Limits != nil {
		limits = *opts.Limits
	}
	st := opts.Store
	if st != nil {
		startingLucci := int64(store.DefaultStartingLucci)
		if opts.StartingLucci != nil {
			startingLucci = *opts.StartingLucci
		}
		st = st.WithEconomy(store.EconomyRules{Data: data, StartingLucci: startingLucci, Rates: rates})
	}
	return &API{
		store:          st,
		cache:          opts.Cache,
		cluster:        opts.Cluster,
		network:        network,
		secret:         opts.Secret,
		dataNode:       opts.DataNodeID,
		publicOrigin:   opts.PublicOrigin,
		log:            logger,
		now:            now,
		economy:        data,
		tracks:         tracks,
		events:         events,
		catalog:        newCatalogDocument(data.Catalog),
		registration:   registration,
		allowGuests:    opts.AllowGuests,
		admins:         admins,
		rates:          rates,
		trustedProxies: proxies,
		limiter:        opts.Limiter,
		limits:         limits,
	}
}

func (a *API) nowMillis() int64 { return a.now().UnixMilli() }

// handlerFunc is a handler whose error becomes the {"error": code} response.
type handlerFunc func(http.ResponseWriter, *http.Request) error

// PublicHandler serves the browser-facing API with the CORS policy.
func (a *API) PublicHandler() http.Handler {
	mux := http.NewServeMux()
	route := func(pattern string, handler handlerFunc) { mux.Handle(pattern, a.serve(handler)) }

	route("GET /multiplayer/healthz", a.health)
	route("GET /multiplayer/auth/config", a.authConfig)
	route("POST /multiplayer/auth/guest-name", a.guestName)
	route("POST /multiplayer/auth/register", a.register)
	route("POST /multiplayer/auth/login", a.login)
	route("GET /multiplayer/auth/me", a.me)
	route("POST /multiplayer/auth/nickname", a.nickname)
	route("POST /multiplayer/auth/logout", a.logout)
	route("POST /multiplayer/admin/invites", a.createInvite)
	route("GET /multiplayer/admin", a.adminPage)
	route("GET /multiplayer/admin/admin.js", a.adminScript)
	route("GET /multiplayer/ice", a.ice)
	route("POST /multiplayer/offer", a.offer)
	route("GET /multiplayer/game-servers", a.gameServers)
	route("POST /multiplayer/game-servers/ticket", a.issueTicket)

	route("GET /api/profile/{ownerId}", a.getProfile)
	route("PUT /api/profile/{ownerId}", a.putProfile)
	route("GET /api/records/{ownerId}", a.listRecords)
	route("GET /api/records/{ownerId}/{recordId}", a.getRecord)
	route("PUT /api/records/{ownerId}/{recordId}", a.putRecord)
	route("GET /api/race-results", a.raceResults)
	route("GET /api/race-outcomes", a.raceOutcomes)
	route("GET /api/room-rules", a.roomRules)
	route("GET /api/player-stats", a.playerStats)

	route("GET /api/account", a.accountSummary)
	route("POST /api/account/starter", a.claimStarter)
	route("GET /api/account/profile", a.getAccountProfile)
	route("PUT /api/account/profile", a.putAccountProfile)
	route("GET /api/inventory", a.inventory)
	route("GET /api/shop/catalog", a.shopCatalog)
	route("POST /api/shop/purchase", a.purchase)
	route("GET /api/shop/spend-event", a.shopSpendEvent)
	route("POST /api/timeattack/settle", a.settleTimeAttack)
	route("GET /api/admin/accounts", a.adminAccounts)
	route("POST /api/admin/grant", a.adminGrant)

	return recoverPanics(a.network.CORS(jsonFallback(mux)))
}

// serve adapts a handlerFunc: it bounds the request time and writes errors.
func (a *API) serve(handler handlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
		defer cancel()
		if err := handler(w, r.WithContext(ctx)); err != nil {
			if _, ok := apierr.As(err); !ok {
				a.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "error", err)
				err = apierr.New(http.StatusInternalServerError, "INTERNAL_ERROR")
			}
			apierr.WriteError(w, err)
		}
	})
}

// jsonFallback answers unmatched routes with JSON 404/405 instead of the
// mux's plain-text bodies.
func jsonFallback(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, pattern := mux.Handler(r); pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}
		var allowed []string
		for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodPost} {
			probe := r.Clone(r.Context())
			probe.Method = method
			if _, pattern := mux.Handler(probe); pattern != "" {
				allowed = append(allowed, method)
			}
		}
		if len(allowed) > 0 {
			w.Header().Set("Allow", strings.Join(allowed, ", "))
			apierr.WriteError(w, apierr.New(http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED"))
			return
		}
		apierr.WriteError(w, apierr.New(http.StatusNotFound, "NOT_FOUND"))
	})
}

func recoverPanics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if value := recover(); value != nil {
				if value == http.ErrAbortHandler {
					panic(value)
				}
				slog.Error("handler panic", "path", r.URL.Path, "panic", value)
				apierr.WriteError(w, apierr.New(http.StatusInternalServerError, "INTERNAL_ERROR"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// marshalJSON encodes value without HTML escaping, like Jackson.
func marshalJSON(value any) ([]byte, error) {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n")), nil
}

// writeJSON writes value as the response body.
func writeJSON(w http.ResponseWriter, status int, value any) error {
	body, err := marshalJSON(value)
	if err != nil {
		return err
	}
	writeRaw(w, status, body)
	return nil
}

func writeRaw(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

// readBody reads the request body within maxBodyBytes as valid UTF-8.
func readBody(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			return nil, errRequestTooLarge
		}
		return nil, errInvalidRequest
	}
	if !utf8.Valid(body) {
		return nil, errInvalidRequest
	}
	return body, nil
}

// decodeJSON reads a JSON body into target. Unknown fields are ignored.
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) error {
	body, err := readBody(w, r)
	if err != nil {
		return err
	}
	if !json.Valid(body) || json.Unmarshal(body, target) != nil {
		return errInvalidRequest
	}
	return nil
}

// stringFields reads a JSON object the way Spring binds Map<String,String>:
// strings and other scalars become text (numbers keep their literal), null
// is absent, and nested objects or arrays reject the request.
func stringFields(w http.ResponseWriter, r *http.Request) (map[string]*string, error) {
	body, err := readBody(w, r)
	if err != nil {
		return nil, err
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil || raw == nil {
		return nil, errInvalidRequest
	}
	fields := make(map[string]*string, len(raw))
	for name, value := range raw {
		switch value[0] {
		case 'n':
			fields[name] = nil
		case '"':
			var text string
			if err := json.Unmarshal(value, &text); err != nil {
				return nil, errInvalidRequest
			}
			fields[name] = &text
		case '{', '[':
			return nil, errInvalidRequest
		default:
			text := string(value)
			fields[name] = &text
		}
	}
	return fields, nil
}

// header returns a request header the way Spring binds it to a String:
// repeated headers are joined with commas, and an absent header is nil.
func header(r *http.Request, name string) *string {
	values := r.Header.Values(name)
	if len(values) == 0 {
		return nil
	}
	joined := strings.Join(values, ",")
	return &joined
}

// queryParam returns a query parameter like Spring's optional String
// @RequestParam: repeated values are joined with commas.
func queryParam(r *http.Request, name string) *string {
	values, ok := r.URL.Query()[name]
	if !ok {
		return nil
	}
	joined := strings.Join(values, ",")
	return &joined
}
