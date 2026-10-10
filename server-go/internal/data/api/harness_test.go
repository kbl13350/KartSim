package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/datatest"
	"kartsim/internal/data/lottery"
	"kartsim/internal/data/messenger"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/netcfg"
	"kartsim/internal/shared/rewards"
)

const testSecret = "test-cluster-secret-0123456789abcdef"

// harness runs the public and internal handlers against miniredis and,
// when db is set, the shared MySQL test database.
type harness struct {
	t        *testing.T
	db       *sql.DB
	redis    *miniredis.Miniredis
	prefix   string
	api      *API
	public   *httptest.Server
	internal *httptest.Server
}

type harnessOptions struct {
	mysql        bool
	publicOrigin string
	network      *netcfg.Network
	now          func() time.Time   // the API clock; time.Now when nil
	recordQuota  *store.RecordQuota // store.DefaultRecordQuota when nil

	registration  string // open when empty
	allowGuests   bool
	admins        []string
	rates         *rewards.Rates
	startingLucci *int64
	// limits are generous unless a test sets them, so tests that register
	// many accounts from one address do not trip the production limits.
	limits         *RateLimits
	trustedProxies []netip.Prefix
	redisHook      redis.Hook
	messenger      messenger.Options // short offline grace unless set
	lotteryRand    func() lottery.Rand
}

// generousLimits keep rate limiting active but out of the way.
func generousLimits() RateLimits {
	limits := DefaultRateLimits()
	limits.RegisterPerIP, limits.RegisterPerIPv6Site, limits.RegisterGlobal, limits.LoginPerIP, limits.LoginFailures,
		limits.AccountWrites, limits.FriendRequests = 1000, 1000, 1000, 1000, 1000, 100_000, 1000
	return limits
}

func newHarness(t *testing.T, opts harnessOptions) *harness {
	t.Helper()
	h := &harness{t: t, redis: miniredis.RunT(t), prefix: "kt-test-" + datatest.Unique() + ":"}
	var st *store.Store
	if opts.mysql {
		h.db = datatest.MySQL(t)
		st = store.New(h.db)
		if opts.recordQuota != nil {
			st = st.WithRecordQuota(*opts.recordQuota)
		}
	}
	client := redis.NewClient(&redis.Options{Addr: h.redis.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	if opts.redisHook != nil {
		client.AddHook(opts.redisHook)
	}
	limits := generousLimits()
	if opts.limits != nil {
		limits = *opts.limits
	}
	if opts.messenger.OfflineGrace == 0 {
		opts.messenger.OfflineGrace = 100 * time.Millisecond
	}
	h.api = New(Options{
		Store:          st,
		Cache:          cache.New(client, h.prefix, datatest.Logger()),
		Cluster:        cache.NewCluster(client, h.prefix),
		Network:        opts.network,
		Secret:         []byte(testSecret),
		DataNodeID:     "data-test",
		PublicOrigin:   opts.publicOrigin,
		Logger:         datatest.Logger(),
		Now:            opts.now,
		Registration:   opts.registration,
		AllowGuests:    opts.allowGuests,
		AdminUsernames: opts.admins,
		Rates:          opts.rates,
		StartingLucci:  opts.startingLucci,
		Limiter:        cache.NewLimiter(client, h.prefix),
		Limits:         &limits,
		TrustedProxies: opts.trustedProxies,
		Messenger:      opts.messenger,
		LotteryRand:    opts.lotteryRand,
	})
	// Activity writes run in the background after a response; the test
	// server finishes each response only once they are done, so tests can
	// read them.
	public := h.api.PublicHandler()
	h.public = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		public.ServeHTTP(w, r)
		h.api.WaitActivity()
	}))
	h.internal = httptest.NewServer(h.api.InternalHandler())
	t.Cleanup(h.public.Close)
	t.Cleanup(h.internal.Close)
	// httptest does not track upgraded connections: close the messenger
	// sockets (and wait for their handlers) before the servers and MySQL.
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := h.api.ShutdownMessenger(ctx); err != nil {
			t.Errorf("messenger shutdown: %v", err)
		}
	})
	return h
}

type response struct {
	status int
	header http.Header
	body   []byte
}

func (r response) json(t *testing.T, target any) {
	t.Helper()
	if err := json.Unmarshal(r.body, target); err != nil {
		t.Fatalf("decode %s: %v", r.body, err)
	}
}

// expect fails unless the response has the status and, for errors, the code.
func (r response) expect(t *testing.T, status int, code string) response {
	t.Helper()
	if r.status != status {
		t.Fatalf("status %d, want %d; body %s", r.status, status, r.body)
	}
	if code != "" {
		var body struct{ Error string }
		r.json(t, &body)
		if body.Error != code {
			t.Fatalf("error %q, want %q", body.Error, code)
		}
	}
	return r
}

func send(t *testing.T, method, url string, body any, headers map[string]string) response {
	t.Helper()
	var reader io.Reader
	switch value := body.(type) {
	case nil:
	case string:
		reader = strings.NewReader(value)
	case []byte:
		reader = bytes.NewReader(value)
	default:
		encoded, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatal(err)
	}
	if reader != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	result, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer result.Body.Close()
	data, err := io.ReadAll(result.Body)
	if err != nil {
		t.Fatal(err)
	}
	return response{status: result.StatusCode, header: result.Header, body: data}
}

func (h *harness) get(path string, headers map[string]string) response {
	h.t.Helper()
	return send(h.t, http.MethodGet, h.public.URL+path, nil, headers)
}

func (h *harness) post(path string, body any, headers map[string]string) response {
	h.t.Helper()
	return send(h.t, http.MethodPost, h.public.URL+path, body, headers)
}

func (h *harness) put(path string, body any, headers map[string]string) response {
	h.t.Helper()
	return send(h.t, http.MethodPut, h.public.URL+path, body, headers)
}

// call posts to the internal API with the cluster key.
func (h *harness) call(path string, body any) response {
	h.t.Helper()
	return send(h.t, http.MethodPost, h.internal.URL+path, body, map[string]string{contract.ClusterKeyHeader: testSecret})
}

// fakeClock is a settable API clock.
type fakeClock struct{ ms atomic.Int64 }

func newFakeClock(at time.Time) *fakeClock {
	clock := &fakeClock{}
	clock.ms.Store(at.UnixMilli())
	return clock
}

func (c *fakeClock) now() time.Time              { return time.UnixMilli(c.ms.Load()) }
func (c *fakeClock) millis() int64               { return c.ms.Load() }
func (c *fakeClock) advance(delta time.Duration) { c.ms.Add(delta.Milliseconds()) }

func bearerHeader(token string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token}
}

// heartbeat registers a game node with the given players.
func (h *harness) heartbeat(nodeID, name, origin string, capacity int, players ...contract.OnlinePlayer) {
	h.t.Helper()
	if players == nil {
		players = []contract.OnlinePlayer{}
	}
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{
		NodeID: nodeID, Name: name, Origin: origin, Capacity: capacity, Players: players,
		StartedAt: time.Now().UnixMilli(), ProtocolVersion: contract.ProtocolVersion,
	}).expect(h.t, http.StatusOK, "")
}

// The helpers below create fixture rows and register their deletion.

func (h *harness) cleanup(query string, args ...any) {
	h.t.Cleanup(func() { datatest.Exec(h.t, h.db, query, args...) })
}

// invite inserts a fresh invitation and returns its code.
func (h *harness) invite() string {
	h.t.Helper()
	code := "invite-" + datatest.Unique()
	datatest.Exec(h.t, h.db, "INSERT INTO invites(code_hash, created_at) VALUES(?, ?)", digest(code), time.Now().UnixMilli())
	h.cleanup("DELETE FROM invites WHERE code_hash = ?", digest(code))
	return code
}

// account inserts an account directly and returns its id; its rows are
// removed after the test.
func (h *harness) account(username, nickname, password string, admin bool) string {
	h.t.Helper()
	id := newUUID()
	hash, err := hashPassword(password)
	if err != nil {
		h.t.Fatal(err)
	}
	datatest.Exec(h.t, h.db, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
		VALUES(?, ?, ?, ?, ?, ?)`, id, username, nickname, hash, admin, time.Now().UnixMilli())
	h.cleanupAccount(id)
	return id
}

// cleanupAccount removes an account after the test; its sessions and stats
// cascade, invites it used are deleted first (they reference it).
func (h *harness) cleanupAccount(id string) {
	h.t.Cleanup(func() {
		datatest.Exec(h.t, h.db, "DELETE FROM invites WHERE used_by = ?", id)
		datatest.Exec(h.t, h.db, "DELETE FROM accounts WHERE id = ?", id)
	})
}

// accountID looks up an account created through the API and schedules its removal.
func (h *harness) accountID(username string) string {
	h.t.Helper()
	var id string
	if err := h.db.QueryRow("SELECT id FROM accounts WHERE username = ?", username).Scan(&id); err != nil {
		h.t.Fatal(err)
	}
	h.cleanupAccount(id)
	return id
}

func (h *harness) login(username, password string) string {
	h.t.Helper()
	var body struct{ Token string }
	h.post("/multiplayer/auth/login", map[string]string{"username": username, "password": password}, nil).
		expect(h.t, http.StatusOK, "").json(h.t, &body)
	return body.Token
}
