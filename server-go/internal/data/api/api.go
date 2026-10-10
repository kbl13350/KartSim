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
	"kartsim/internal/data/career"
	"kartsim/internal/data/club"
	"kartsim/internal/data/config"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/expedition"
	"kartsim/internal/data/license"
	"kartsim/internal/data/lottery"
	"kartsim/internal/data/messenger"
	"kartsim/internal/data/myroom"
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

	// Messenger tunes the friends and private chat sockets (DESIGN.md 9);
	// its Origin policy, clock and logger are the API's.
	Messenger messenger.Options
	// MyRoom tunes the My Room visit sockets (GET /api/myroom/ws).
	MyRoom myroom.Options

	// Lottery is the lottery data (LOTTERY.md); the embedded tables when nil.
	Lottery *lottery.Data
	// LotteryRand makes the randomness of one draw request; a ChaCha8
	// generator seeded from crypto/rand when nil (tests fix it).
	LotteryRand func() lottery.Rand
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
	hub            *messenger.Hub
	careers        *career.Data
	dictionary     *career.Dictionary
	expedition     *expedition.Data
	rooms          *myroom.Hub

	lottery         *lottery.Data
	lotteryItemsDoc catalogDocument
	lotteryRand     func() lottery.Rand

	license    *license.Data
	licenseDoc licenseTable
	clubData   *club.Data

	// The admin console: when this API was built (the data service's start)
	// and the track titles by id.
	startedAt   int64
	trackTitles map[string]string
	// seenLocal throttles activity writes without Redis (noteActivity).
	seenLocal localThrottle
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
	a := &API{
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
	hubOptions := opts.Messenger
	hubOptions.CheckOrigin = network.CheckWebSocketOrigin
	hubOptions.Now = now
	hubOptions.Logger = logger
	a.hub = messenger.New(messengerBackend{a}, hubOptions)
	careers, err := career.Default()
	if err != nil {
		panic(err) // the embedded data is checked by the career tests
	}
	a.careers = careers
	if a.dictionary, err = career.DefaultDictionary(); err != nil {
		panic(err)
	}
	if a.expedition, err = expedition.Default(); err != nil {
		panic(err)
	}
	roomOptions := opts.MyRoom
	roomOptions.CheckOrigin = network.CheckWebSocketOrigin
	roomOptions.Now = now
	roomOptions.Logger = logger
	a.rooms = myroom.New(roomBackend{a}, roomOptions)
	if a.lottery = opts.Lottery; a.lottery == nil {
		if a.lottery, err = lottery.Default(); err != nil {
			panic(err) // the embedded data is checked by the lottery tests
		}
	}
	a.lotteryItemsDoc = lotteryItemsDocument(a.lottery)
	if a.lotteryRand = opts.LotteryRand; a.lotteryRand == nil {
		a.lotteryRand = newLotteryRand
	}
	if a.license, err = license.Default(); err != nil {
		panic(err) // the embedded data is checked by the license tests
	}
	a.licenseDoc = newLicenseTable(a.license)
	if a.clubData, err = club.Default(); err != nil {
		panic(err) // the embedded data is checked by the club tests
	}
	a.startedAt = a.nowMillis()
	a.trackTitles = make(map[string]string, len(tracks.Tracks))
	for _, track := range tracks.Tracks {
		a.trackTitles[track.ID] = track.Title
	}
	return a
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
	// The console is built with base /multiplayer/admin/ and its assets use
	// absolute paths, so the page is served with and without the slash.
	route("GET /multiplayer/admin", a.adminPage)
	route("GET /multiplayer/admin/{$}", a.adminPage)
	route("GET /multiplayer/admin/assets/{path...}", a.adminAsset)
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
	route("GET /api/admin/me", a.adminMe)
	route("GET /api/admin/overview", a.adminOverview)
	route("GET /api/admin/accounts", a.adminAccounts)
	route("GET /api/admin/accounts/{id}", a.adminAccountDetail)
	route("PATCH /api/admin/accounts/{id}", a.adminPatchAccount)
	route("POST /api/admin/accounts/{id}/kick", a.adminKick)
	route("GET /api/admin/accounts/{id}/inventory", a.adminInventory)
	route("GET /api/admin/accounts/{id}/game", a.adminAccountGame)
	route("POST /api/admin/grant", a.adminGrant)
	route("GET /api/admin/logins", a.adminLogins)
	route("GET /api/admin/online", a.adminOnline)
	route("GET /api/admin/nodes", a.adminNodes)
	route("GET /api/admin/ledger", a.adminLedger)
	route("GET /api/admin/grants", a.adminGrants)
	route("GET /api/admin/races", a.adminRaces)
	route("GET /api/admin/purchases", a.adminPurchases)
	route("GET /api/admin/lottery-draws", a.adminLotteryDraws)
	route("GET /api/admin/box-openings", a.adminBoxOpenings)
	route("GET /api/admin/clubs", a.adminClubs)
	route("GET /api/admin/clubs/{id}/members", a.adminClubMembers)
	route("GET /api/admin/invites", a.adminInvites)
	route("GET /api/admin/reward-box", a.adminRewardBoxList)

	route("GET /api/messenger/state", a.messengerState)
	route("POST /api/messenger/friends/request", a.friendRequest)
	route("POST /api/messenger/friends/respond", a.friendRespond)
	route("POST /api/messenger/friends/cancel", a.friendCancel)
	route("POST /api/messenger/friends/remove", a.friendRemove)
	route("POST /api/messenger/friends/favorite", a.friendFavorite)
	route("POST /api/messenger/outbox/clear", a.outboxClear)
	route("POST /api/messenger/blocks/add", a.blockAdd)
	route("POST /api/messenger/blocks/remove", a.blockRemove)
	route("PUT /api/messenger/settings", a.messengerSettings)
	route("GET /api/messenger/messages", a.messengerHistory)
	route("POST /api/messenger/messages", a.messengerSend)
	route("POST /api/messenger/read", a.messengerRead)
	route("POST /api/messenger/conversations/hide", a.conversationHide)
	// The socket outlives requestTimeout and writes no error body once
	// upgraded, so it is not wrapped by serve.
	mux.Handle("GET /api/messenger/ws", a.hub)

	route("GET /api/careers", a.listCareers)
	route("POST /api/careers/complete", a.completeCareer)
	route("GET /api/emblems", a.listEmblems)
	route("POST /api/emblems/main", a.setMainEmblems)
	route("POST /api/myroom/careers", a.visitCareers)
	route("POST /api/myroom/emblems", a.visitEmblems)
	route("GET /api/dictionary", a.getDictionary)
	route("POST /api/dictionary/reward", a.claimDictionaryReward)
	route("POST /api/myroom/dictionary", a.visitDictionary)
	route("POST /api/inventory/open", a.openBox)
	route("GET /api/expedition", a.getExpedition)
	route("GET /api/expedition/crew", a.expeditionCrew)
	route("POST /api/expedition/start", a.startExpedition)
	route("POST /api/expedition/tokens", a.expeditionTokens)
	route("POST /api/expedition/claim", a.claimExpedition)
	route("GET /api/lottery/items", a.lotteryItems)
	route("GET /api/lottery/treasure-hunt", a.treasureHuntState)
	route("POST /api/lottery/treasure-hunt/draw", a.treasureHuntDraw)
	route("GET /api/lottery/gacha", a.gachaList)
	route("GET /api/lottery/gacha/{itemId}", a.gachaDetail)
	route("POST /api/lottery/gacha/draw", a.gachaDraw)
	route("POST /api/lottery/packs/buy", a.buyPack)
	route("POST /api/lottery/daily", a.claimLotteryDaily)
	route("GET /api/license", a.getLicense)
	route("POST /api/license/run", a.runLicenseStep)
	route("POST /api/license/take", a.takeLicense)
	route("POST /api/license/qualify", a.qualifyLicense)
	route("POST /api/license/emblem", a.claimLicenseEmblem)
	route("GET /api/club", a.getClub)
	route("GET /api/club/list", a.listClubs)
	route("GET /api/club/info/{id}", a.clubDetail)
	route("POST /api/club/create", a.createClub)
	route("POST /api/club/apply", a.applyClub)
	route("POST /api/club/apply/cancel", a.cancelClubApplication)
	route("GET /api/club/applicants", a.clubApplicants)
	route("POST /api/club/applicants/decide", a.decideClubApplicant)
	route("POST /api/club/leave", a.leaveClub)
	route("POST /api/club/members", a.clubMemberChange)
	route("PUT /api/club", a.updateClub)
	route("POST /api/club/break", a.breakClub)
	route("POST /api/club/break/cancel", a.cancelClubBreak)
	route("GET /api/club/house", a.clubHouse)
	route("POST /api/club/donate", a.donateClub)
	route("POST /api/club/upgrade", a.upgradeClub)
	route("POST /api/club/name", a.renameClub)
	route("POST /api/club/mark", a.changeClubMark)
	route("POST /api/club/welfare", a.claimClubWelfare)
	route("GET /api/reward-box", a.rewardBox)
	route("POST /api/reward-box/claim", a.claimRewardBox)
	route("POST /api/admin/reward-box", a.adminRewardBox)
	route("GET /api/quests", a.listQuests)
	route("GET /api/notices", a.listNotices)
	route("GET /api/admin/notices", a.adminNotices)
	route("PUT /api/admin/notices", a.adminSaveNotice)
	route("DELETE /api/admin/notices/{id}", a.adminDeleteNotice)
	route("GET /api/riders/{nickname}", a.riderCard)
	route("GET /api/admin/lottery", a.adminLottery)
	route("PUT /api/admin/lottery", a.adminSaveLottery)
	mux.Handle("GET /api/myroom/ws", a.rooms)

	return recoverPanics(a.network.CORS(jsonFallback(mux)))
}

// serve adapts a handlerFunc: it bounds the request time and writes errors.
// A request that succeeds with a session token notes the account's
// activity (noteActivity).
func (a *API) serve(handler handlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), requestTimeout)
		defer cancel()
		ctx, seen := withActivity(ctx)
		if err := handler(w, r.WithContext(ctx)); err != nil {
			if _, ok := apierr.As(err); !ok {
				a.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "error", err)
				err = apierr.New(http.StatusInternalServerError, "INTERNAL_ERROR")
			}
			apierr.WriteError(w, err)
		} else if seen.accountID != "" {
			a.noteActivity(ctx, r, seen.accountID)
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
		for _, method := range []string{http.MethodGet, http.MethodPut, http.MethodPost, http.MethodPatch,
			http.MethodDelete} {
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
