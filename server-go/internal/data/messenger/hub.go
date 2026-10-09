// Package messenger is the real-time side of friends and private chat
// (DESIGN.md 9): one WebSocket per browser tab on the data service
// (GET /api/messenger/ws) and an in-process hub that knows which accounts
// are connected, pushes presence changes to their connected friends, fans
// out messages and sync hints, and owns the per-account chat flood limiter
// that the HTTP API shares. Everything durable is in MySQL behind Backend;
// the hub only keeps what a restart rebuilds (a single data service runs).
//
// Lock order: Hub.mu, then conn.mu. Hub methods never block on a socket:
// pushes are queued and every connection has its own writer goroutine.
package messenger

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"maps"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Presence values (contract §1).
const (
	Online  = "online"
	InGame  = "inGame"
	Offline = "offline"
)

// PresenceOf is how others see an account: invisible accounts are offline
// even in game; otherwise a game-node presence wins over a messenger socket.
func PresenceOf(invisible, inGame, online bool) string {
	switch {
	case invisible:
		return Offline
	case inGame:
		return InGame
	case online:
		return Online
	}
	return Offline
}

// Close codes besides the standard ones.
const (
	CloseSessionEnded = 4001 // logout, expired session, failed or missing hello
	CloseReplaced     = 4002 // the account opened more than MaxPerAccount sockets
)

// Notice kinds (contract §3).
const (
	NoticeFriendRequest  = "friend-request"
	NoticeFriendAccepted = "friend-accepted"
	NoticeFriendRefused  = "friend-refused"
)

// Message is a private message as the API and the socket show it.
type Message struct {
	ID       int64  `json:"id"`
	From     string `json:"from"`
	To       string `json:"to"`
	Text     string `json:"text"`
	SentAt   int64  `json:"sentAt"`
	ClientID string `json:"clientId"`
}

// FloodError is the CHAT_FLOOD rejection: the account may send again at
// MutedUntil (Unix ms).
type FloodError struct{ MutedUntil int64 }

func (e *FloodError) Error() string { return "CHAT_FLOOD" }

// Session is an authenticated socket's account and session key (the token
// digest that logout names).
type Session struct {
	AccountID string
	Key       string
}

// RosterFriend is a friend with its own invisible setting.
type RosterFriend struct {
	AccountID string
	Invisible bool
}

// Roster is what the hub tracks of a connected account: its own invisible
// setting and its friends.
type Roster struct {
	Invisible bool
	Friends   []RosterFriend
}

// Backend is the data API seen from the hub. Every call gets a context
// bounded by the hub, never by an HTTP request.
type Backend interface {
	// Authenticate resolves a session token; found is false for an unknown
	// or expired session.
	Authenticate(ctx context.Context, token string) (session Session, found bool, err error)
	// Welcome is the State document of the welcome frame.
	Welcome(ctx context.Context, accountID string) (any, error)
	Roster(ctx context.Context, accountID string) (Roster, error)
	// InGame reports which of the accounts hold a live game-node presence.
	InGame(ctx context.Context, ids []string) (map[string]bool, error)
	// Send validates and stores a message (the same rules as the HTTP API,
	// including AllowChat); duplicate means the client id was used before.
	Send(ctx context.Context, from, to, text, clientID string) (message Message, duplicate bool, err error)
	// Read moves the account's read mark of a conversation.
	Read(ctx context.Context, accountID, with string, upTo int64) error
}

// Options tune the hub; zero values use the defaults in brackets.
type Options struct {
	MaxConnections  int           // [5000] sockets, hello'd or not; more get HTTP 503 SERVER_BUSY
	MaxPerAccount   int           // [4] sockets per account; another closes the oldest with 4002
	SendBufferLimit int           // [262144] queued bytes per socket; more closes it with 1008
	ReadLimit       int64         // [8 KiB] per message
	HelloTimeout    time.Duration // [10 s] until the hello frame
	ReadTimeout     time.Duration // [90 s] without any frame
	PingInterval    time.Duration // [30 s]
	WriteTimeout    time.Duration // [5 s] per frame
	OfflineGrace    time.Duration // [5 s] after the last socket before "offline"; negative: none
	SessionCheck    time.Duration // [5 min] between session re-checks
	Reconcile       time.Duration // [10 s] between game presence reconciliations
	// Commands per account (all of its sockets): [10]/s, burst [30]; a
	// client beyond that is closed with 1008.
	CommandRate  float64
	CommandBurst int
	// Chat messages per account (socket and HTTP): [1]/s, burst [5]; when
	// they run out the account is muted for [10 s] (CHAT_FLOOD).
	ChatRate  float64
	ChatBurst int
	ChatMute  time.Duration
	// CheckOrigin is the upgrader's Origin policy (netcfg.CheckWebSocketOrigin).
	CheckOrigin func(*http.Request) bool
	Now         func() time.Time // the chat limiter clock [time.Now]
	Logger      *slog.Logger
}

func (o *Options) defaults() {
	setInt := func(value *int, fallback int) {
		if *value <= 0 {
			*value = fallback
		}
	}
	setDuration := func(value *time.Duration, fallback time.Duration) {
		if *value <= 0 {
			*value = fallback
		}
	}
	setInt(&o.MaxConnections, 5000)
	setInt(&o.MaxPerAccount, 4)
	setInt(&o.SendBufferLimit, 256<<10)
	if o.ReadLimit <= 0 {
		o.ReadLimit = 8 << 10
	}
	setDuration(&o.HelloTimeout, 10*time.Second)
	setDuration(&o.ReadTimeout, 90*time.Second)
	setDuration(&o.PingInterval, 30*time.Second)
	setDuration(&o.WriteTimeout, 5*time.Second)
	switch {
	case o.OfflineGrace == 0:
		o.OfflineGrace = 5 * time.Second
	case o.OfflineGrace < 0:
		o.OfflineGrace = 0
	}
	setDuration(&o.SessionCheck, 5*time.Minute)
	setDuration(&o.Reconcile, 10*time.Second)
	if o.CommandRate <= 0 {
		o.CommandRate = 10
	}
	setInt(&o.CommandBurst, 30)
	if o.ChatRate <= 0 {
		o.ChatRate = 1
	}
	setInt(&o.ChatBurst, 5)
	setDuration(&o.ChatMute, 10*time.Second)
	if o.Now == nil {
		o.Now = time.Now
	}
	if o.Logger == nil {
		o.Logger = slog.Default()
	}
}

const (
	// backendTimeout bounds one Backend call made by the hub.
	backendTimeout = 5 * time.Second
	// gameBatch is how many accounts one InGame call checks.
	gameBatch = 1000
	// chatIdle is how long an untouched chat limiter is kept.
	chatIdle = time.Minute
)

// account is a connected account: from its first hello until its last
// socket has been gone for OfflineGrace.
type account struct {
	id      string
	conns   []*conn         // hello'd sockets, oldest first
	friends map[string]bool // as of the last applied roster
	grace   *time.Timer
	// Roster loads are numbered; only a newer one than the last applied
	// load may apply, so a slow load never undoes a faster later one.
	rosterGen, rosterApplied uint64
	commands                 limiter
}

// peer is the presence state of an account that is connected or that a
// connected account lists as a friend.
type peer struct {
	watchers  map[string]bool // connected accounts that list this one as a friend
	invisible bool
	inGame    bool
	// Each value comes with the hub sequence number taken before it was
	// read; an older reading never replaces a newer one.
	settingsSeq, gameSeq uint64
	sent                 string // the presence its watchers were last told
}

type chatState struct {
	bucket     limiter
	mutedUntil time.Time
	last       time.Time
}

// Hub is the messenger's in-process state.
type Hub struct {
	backend  Backend
	opts     Options
	log      *slog.Logger
	upgrader websocket.Upgrader
	ctx      context.Context // ends at shutdown
	cancel   context.CancelFunc

	mu        sync.Mutex
	closing   bool
	conns     map[*conn]struct{} // every upgraded socket
	upgrading int
	accounts  map[string]*account
	peers     map[string]*peer
	chat      map[string]*chatState
	seq       uint64
	wg        sync.WaitGroup // socket handlers and background loads
}

// New returns a hub serving backend.
func New(backend Backend, opts Options) *Hub {
	opts.defaults()
	h := &Hub{
		backend: backend,
		opts:    opts,
		log:     opts.Logger,
		upgrader: websocket.Upgrader{
			HandshakeTimeout: 10 * time.Second,
			CheckOrigin:      opts.CheckOrigin,
		},
		conns:    map[*conn]struct{}{},
		accounts: map[string]*account{},
		peers:    map[string]*peer{},
		chat:     map[string]*chatState{},
	}
	h.ctx, h.cancel = context.WithCancel(context.Background())
	return h
}

// encode marshals a frame without HTML escaping.
func encode(value any) []byte {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		slog.Error("encode messenger frame", "error", err)
		return nil
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
}

var syncFrame = []byte(`{"type":"sync"}`)

// background runs fn on its own goroutine unless the hub is closing; the
// caller holds h.mu.
func (h *Hub) background(fn func()) {
	if h.closing {
		return
	}
	h.wg.Go(fn)
}

// pushLocked queues payload on every socket of accountID except one.
func (h *Hub) pushLocked(accountID string, payload []byte, except *conn) {
	if a := h.accounts[accountID]; a != nil {
		for _, c := range a.conns {
			if c != except {
				c.send(payload)
			}
		}
	}
}

// Online reports which of ids have a messenger socket (or lost their last
// one less than OfflineGrace ago).
func (h *Hub) Online(ids []string) map[string]bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	online := make(map[string]bool, len(ids))
	for _, id := range ids {
		if h.accounts[id] != nil {
			online[id] = true
		}
	}
	return online
}

// Sync tells every socket of each account to reload the messenger state.
func (h *Hub) Sync(ids ...string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, id := range slices.Compact(slices.Sorted(slices.Values(ids))) {
		h.pushLocked(id, syncFrame, nil)
	}
}

// Notice tells accountID about a friend request event of the account about.
func (h *Hub) Notice(accountID, kind, about, nickname string) {
	payload := encode(struct {
		Type      string `json:"type"`
		Kind      string `json:"kind"`
		AccountID string `json:"accountId"`
		Nickname  string `json:"nickname"`
	}{"notice", kind, about, nickname})
	h.mu.Lock()
	defer h.mu.Unlock()
	h.pushLocked(accountID, payload, nil)
}

// Deliver pushes a new message to the recipient's sockets and the sender's.
func (h *Hub) Deliver(message Message) { h.deliver(message, nil) }

func (h *Hub) deliver(message Message, except *conn) {
	payload := encode(struct {
		Type    string  `json:"type"`
		Message Message `json:"message"`
	}{"message", message})
	h.mu.Lock()
	defer h.mu.Unlock()
	h.pushLocked(message.To, payload, nil)
	if message.From != message.To {
		h.pushLocked(message.From, payload, except)
	}
}

// CloseSession closes the sockets of a session that ended (logout) with 4001.
func (h *Hub) CloseSession(key string) {
	if key == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.conns {
		if c.sessionKey == key {
			c.closeAfter(CloseSessionEnded, "session ended")
		}
	}
}

// AllowChat counts one chat message of accountID against its flood limit.
// When the limit runs out the account is muted for ChatMute; mutedUntil
// (Unix ms) is set whenever ok is false.
func (h *Hub) AllowChat(accountID string) (ok bool, mutedUntil int64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := h.opts.Now()
	state := h.chat[accountID]
	if state == nil {
		state = &chatState{bucket: newLimiter(h.opts.ChatRate, h.opts.ChatBurst)}
		h.chat[accountID] = state
	}
	state.last = now
	if now.Before(state.mutedUntil) {
		return false, state.mutedUntil.UnixMilli()
	}
	if state.bucket.allow(now) {
		return true, 0
	}
	state.mutedUntil = now.Add(h.opts.ChatMute)
	return false, state.mutedUntil.UnixMilli()
}

// nextSeq numbers a reading of settings or game presence; the caller
// holds h.mu.
func (h *Hub) nextSeq() uint64 {
	h.seq++
	return h.seq
}

// presenceLocked is how accountID's watchers see it.
func (h *Hub) presenceLocked(accountID string) string {
	p := h.peers[accountID]
	if p == nil {
		return PresenceOf(false, false, h.accounts[accountID] != nil)
	}
	return PresenceOf(p.invisible, p.inGame, h.accounts[accountID] != nil)
}

// ensurePeer returns the peer of accountID, creating it.
func (h *Hub) ensurePeer(accountID string) (*peer, bool) {
	if p := h.peers[accountID]; p != nil {
		return p, false
	}
	p := &peer{watchers: map[string]bool{}}
	h.peers[accountID] = p
	return p, true
}

// update pushes accountID's presence to its watchers when it changed.
func (h *Hub) update(accountID string) {
	p := h.peers[accountID]
	if p == nil {
		return
	}
	presence := h.presenceLocked(accountID)
	if presence == p.sent {
		return
	}
	p.sent = presence
	if len(p.watchers) == 0 {
		return
	}
	payload := encode(struct {
		Type      string `json:"type"`
		AccountID string `json:"accountId"`
		Presence  string `json:"presence"`
	}{"presence", accountID, presence})
	for watcher := range p.watchers {
		h.pushLocked(watcher, payload, nil)
	}
}

// dropIdlePeer forgets a peer nobody watches and that is not connected.
func (h *Hub) dropIdlePeer(accountID string) {
	if p := h.peers[accountID]; p != nil && len(p.watchers) == 0 && h.accounts[accountID] == nil {
		delete(h.peers, accountID)
	}
}

func (p *peer) setInvisible(invisible bool, seq uint64) {
	if seq > p.settingsSeq {
		p.invisible, p.settingsSeq = invisible, seq
	}
}

func (p *peer) setInGame(inGame bool, seq uint64) {
	if seq > p.gameSeq {
		p.inGame, p.gameSeq = inGame, seq
	}
}

// loadRoster (re)loads a connected account's friends and the presence
// state of them and of the account itself.
func (h *Hub) loadRoster(a *account) {
	h.mu.Lock()
	if h.accounts[a.id] != a {
		h.mu.Unlock()
		return
	}
	a.rosterGen++
	gen, seq := a.rosterGen, h.nextSeq()
	h.mu.Unlock()

	ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
	defer cancel()
	roster, err := h.backend.Roster(ctx, a.id)
	if err != nil {
		h.log.Warn("messenger friend list not loaded", "account", a.id, "error", err)
		return
	}
	ids := []string{a.id}
	for _, friend := range roster.Friends {
		ids = append(ids, friend.AccountID)
	}
	inGame, gameErr := h.inGame(ctx, ids)

	h.mu.Lock()
	defer h.mu.Unlock()
	if h.accounts[a.id] != a || gen <= a.rosterApplied {
		return
	}
	a.rosterApplied = gen
	friends := make(map[string]bool, len(roster.Friends))
	for _, friend := range roster.Friends {
		friends[friend.AccountID] = true
	}
	for id := range a.friends {
		if !friends[id] {
			h.unwatch(id, a.id)
		}
	}
	a.friends = friends
	apply := func(id string, invisible bool) {
		p, created := h.ensurePeer(id)
		p.setInvisible(invisible, seq)
		if gameErr == nil {
			p.setInGame(inGame[id], seq)
		}
		if created {
			p.sent = h.presenceLocked(id) // its watchers read it in their state
		} else {
			h.update(id)
		}
	}
	for _, friend := range roster.Friends {
		apply(friend.AccountID, friend.Invisible)
		h.peers[friend.AccountID].watchers[a.id] = true
	}
	apply(a.id, roster.Invisible)
}

// unwatch removes watcher from accountID's watchers; the caller holds h.mu.
func (h *Hub) unwatch(accountID, watcher string) {
	if p := h.peers[accountID]; p != nil {
		delete(p.watchers, watcher)
		h.dropIdlePeer(accountID)
	}
}

// inGame asks the backend in batches.
func (h *Hub) inGame(ctx context.Context, ids []string) (map[string]bool, error) {
	result := map[string]bool{}
	for batch := range slices.Chunk(ids, gameBatch) {
		found, err := h.backend.InGame(ctx, batch)
		if err != nil {
			return nil, err
		}
		maps.Copy(result, found)
	}
	return result, nil
}

// FriendsChanged reloads the friend lists of the connected accounts among
// ids after a friendship was made or ended.
func (h *Hub) FriendsChanged(ids ...string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, id := range ids {
		if a := h.accounts[id]; a != nil {
			h.background(func() { h.loadRoster(a) })
		}
	}
}

// SettingsChanged applies an account's new invisible setting (after it
// was committed) and pushes its presence when that changed.
func (h *Hub) SettingsChanged(accountID string, invisible bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if p := h.peers[accountID]; p != nil {
		p.setInvisible(invisible, h.nextSeq())
		h.update(accountID)
	}
}

// GameChanged re-checks the game presence of an account that a game node
// just claimed or released, when anybody is interested in it.
func (h *Hub) GameChanged(accountID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.peers[accountID] == nil {
		return
	}
	seq := h.nextSeq()
	h.background(func() {
		ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
		defer cancel()
		inGame, err := h.backend.InGame(ctx, []string{accountID})
		if err != nil {
			h.log.Debug("messenger game presence not checked", "account", accountID, "error", err)
			return
		}
		h.mu.Lock()
		defer h.mu.Unlock()
		if p := h.peers[accountID]; p != nil {
			p.setInGame(inGame[accountID], seq)
			h.update(accountID)
		}
	})
}

// Reconcile re-reads the game presence of every tracked account (game
// nodes that crash or lose a heartbeat conflict report no account ids),
// retries friend lists that failed to load and forgets idle chat limiters.
// Without Redis the last known game presence stays.
func (h *Hub) Reconcile(ctx context.Context) {
	h.mu.Lock()
	ids := slices.Collect(maps.Keys(h.peers))
	seq := h.nextSeq()
	now := h.opts.Now()
	for id, state := range h.chat {
		if now.Sub(state.last) > chatIdle && !now.Before(state.mutedUntil) && state.bucket.full(now) {
			delete(h.chat, id)
		}
	}
	var unloaded []*account
	for _, a := range h.accounts {
		if a.rosterApplied == 0 {
			unloaded = append(unloaded, a)
		}
	}
	h.mu.Unlock()
	for _, a := range unloaded {
		h.loadRoster(a)
	}
	for batch := range slices.Chunk(ids, gameBatch) {
		callCtx, cancel := context.WithTimeout(ctx, backendTimeout)
		inGame, err := h.backend.InGame(callCtx, batch)
		cancel()
		if err != nil {
			h.log.Debug("messenger game presence not reconciled", "error", err)
			return
		}
		h.mu.Lock()
		for _, id := range batch {
			if p := h.peers[id]; p != nil {
				p.setInGame(inGame[id], seq)
				h.update(id)
			}
		}
		h.mu.Unlock()
	}
}

// Run reconciles game presence every Reconcile interval until ctx ends or
// the hub shuts down.
func (h *Hub) Run(ctx context.Context) {
	ticker := time.NewTicker(h.opts.Reconcile)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-h.ctx.Done():
			return
		case <-ticker.C:
		}
		h.Reconcile(ctx)
	}
}

// Shutdown refuses new sockets, closes every socket with 1001 and waits for
// their handlers and the background loads. When ctx ends first the
// remaining sockets are dropped without a close frame.
func (h *Hub) Shutdown(ctx context.Context) error {
	h.mu.Lock()
	h.closing = true
	conns := slices.Collect(maps.Keys(h.conns))
	for _, a := range h.accounts {
		if a.grace != nil {
			a.grace.Stop()
		}
	}
	h.mu.Unlock()
	h.cancel()
	var closing sync.WaitGroup
	for _, c := range conns {
		closing.Go(func() { c.closeWith(websocket.CloseGoingAway, "server shutting down") })
	}
	done := make(chan struct{})
	go func() {
		closing.Wait()
		h.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
	}
	h.mu.Lock()
	conns = slices.Collect(maps.Keys(h.conns))
	h.mu.Unlock()
	for _, c := range conns {
		c.terminate()
	}
	<-done
	return ctx.Err()
}
