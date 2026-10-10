package myroom

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// Close codes besides the standard ones (the messenger's).
const (
	CloseSessionEnded = 4001 // logout, expired session, failed or missing hello
)

// Error codes of the room commands. Each matches an original string:
// UNKNOWN_RIDER 不存在的车手, ALREADY_HERE 已经在 %s的小屋里, PASSWORD_REQUIRED
// (the visitor password box), WRONG_PASSWORD 密码错误, RANDOM_FAILED 随机进入失败,
// CANNOT_ENTER 进入小屋失败.
const (
	CodeUnknownRider     = "UNKNOWN_RIDER"
	CodeAlreadyHere      = "ALREADY_HERE"
	CodePasswordRequired = "PASSWORD_REQUIRED"
	CodeWrongPassword    = "WRONG_PASSWORD"
	CodeRoomFull         = "ROOM_FULL"
	CodeKicked           = "KICKED"
	CodeCannotEnter      = "CANNOT_ENTER"
	CodeRandomFailed     = "RANDOM_FAILED"
	CodeNotInRoom        = "NOT_IN_ROOM"
	CodeNotOwner         = "NOT_OWNER"
	CodeChatDisabled     = "CHAT_DISABLED"
	CodeChatFlood        = "CHAT_FLOOD"
	CodeInvalidRequest   = "INVALID_REQUEST"
	CodeLoginRequired    = "LOGIN_REQUIRED"
	CodeUnavailable      = "DATA_SERVICE_UNAVAILABLE"
	CodeInternal         = "INTERNAL_ERROR"
)

// Session is an authenticated socket's account and session key.
type Session struct {
	AccountID string
	Key       string
}

// Rider is an account as a room shows it.
type Rider struct {
	AccountID string
	Nickname  string
	Exp       int64
	Level     int
	Glove     string // the level glove icon (etc_/level/<glove>.png)
	Profile   Profile
}

// Backend is the data API seen from the hub. Every call gets a context
// bounded by the hub.
type Backend interface {
	Authenticate(ctx context.Context, token string) (session Session, found bool, err error)
	Rider(ctx context.Context, accountID string) (Rider, bool, error)
	RiderByNickname(ctx context.Context, nickname string) (Rider, bool, error)
	// MainEmblems are the owner's representative emblems (0 for empty).
	MainEmblems(ctx context.Context, accountID string) ([2]int, error)
	// Blocked reports whether owner blocked visitor (messenger blocks).
	Blocked(ctx context.Context, owner, visitor string) (bool, error)
	// Online lists up to limit visible online accounts (messenger presence).
	Online(limit int) []string
	// PasswordAttempt counts one room password guess of an account; an
	// error means it has guessed too often.
	PasswordAttempt(ctx context.Context, accountID string) error
}

// Options tune the hub; zero values use the defaults in brackets.
type Options struct {
	MaxConnections  int           // [5000]
	SendBufferLimit int           // [262144] queued bytes per socket
	ReadLimit       int64         // [4 KiB] per message, also once decompressed
	HelloTimeout    time.Duration // [10 s]
	ReadTimeout     time.Duration // [90 s]
	PingInterval    time.Duration // [30 s]
	WriteTimeout    time.Duration // [5 s]
	SessionCheck    time.Duration // [5 min]
	KickBan         time.Duration // [5 min] a kicked visitor cannot re-enter that room
	// Commands per socket: [40]/s, burst [80]; beyond that the socket is
	// closed with 1008. Moves past [15]/s are dropped silently.
	CommandRate  float64
	CommandBurst int
	MoveRate     float64
	// Chat lines per account: [1]/s, burst [5], then muted for [10 s].
	ChatRate    float64
	ChatBurst   int
	ChatMute    time.Duration
	CheckOrigin func(*http.Request) bool
	// DisableCompression never negotiates permessage-deflate
	// (KART_WS_COMPRESSION=false); otherwise text of wsdeflate.MinBytes or
	// more goes compressed to browsers that offer it.
	DisableCompression bool
	Now                func() time.Time
	Logger             *slog.Logger
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
	setFloat := func(value *float64, fallback float64) {
		if *value <= 0 {
			*value = fallback
		}
	}
	setInt(&o.MaxConnections, 5000)
	setInt(&o.SendBufferLimit, 256<<10)
	if o.ReadLimit <= 0 {
		o.ReadLimit = 4 << 10
	}
	setDuration(&o.HelloTimeout, 10*time.Second)
	setDuration(&o.ReadTimeout, 90*time.Second)
	setDuration(&o.PingInterval, 30*time.Second)
	setDuration(&o.WriteTimeout, 5*time.Second)
	setDuration(&o.SessionCheck, 5*time.Minute)
	setDuration(&o.KickBan, 5*time.Minute)
	setFloat(&o.CommandRate, 40)
	setInt(&o.CommandBurst, 80)
	setFloat(&o.MoveRate, 15)
	setFloat(&o.ChatRate, 1)
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
	backendTimeout = 5 * time.Second
	// randomCandidates bounds the rooms one random visit inspects.
	randomCandidates = 40
	// maxChat is the longest room chat line (code points).
	maxChat = 60
)

// Pose is where a rider stands in the room scene (the client's world
// coordinates) and whether it is walking.
type Pose struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Z      float64 `json:"z"`
	Yaw    float64 `json:"yaw"`
	Moving bool    `json:"moving"`
}

// MemberView is a rider in a room as everyone there sees it.
type MemberView struct {
	AccountID  string          `json:"accountId"`
	Nickname   string          `json:"nickname"`
	Exp        int64           `json:"exp"`
	Level      int             `json:"level"`
	Glove      string          `json:"glove"`
	Appearance json.RawMessage `json:"appearance"`
	Owner      bool            `json:"owner"`
	// Slot is the rider card: 0 the owner, 1..7 visitors.
	Slot int `json:"slot"`
	// Pose is nil until the rider first moves (the client spawns it).
	Pose *Pose `json:"pose"`
}

// RoomView is a room as its riders see it.
type RoomView struct {
	OwnerID         string          `json:"ownerId"`
	OwnerNickname   string          `json:"ownerNickname"`
	OwnerExp        int64           `json:"ownerExp"`
	OwnerAppearance json.RawMessage `json:"ownerAppearance"`
	Settings        Settings        `json:"settings"`
	MainEmblems     [2]int          `json:"mainEmblems"`
}

type room struct {
	view    RoomView
	members map[string]*member // by account id
}

type member struct {
	conn *conn
	room *room
	view MemberView
}

type chatState struct {
	bucket     limiter
	mutedUntil time.Time
}

// Hub holds the live rooms.
type Hub struct {
	backend  Backend
	opts     Options
	log      *slog.Logger
	upgrader websocket.Upgrader
	ctx      context.Context
	cancel   context.CancelFunc

	mu        sync.Mutex
	closing   bool
	conns     map[*conn]*client
	upgrading int
	rooms     map[string]*room   // by owner id
	members   map[string]*member // by account id: one room per account
	kicks     map[string]time.Time
	chat      map[string]*chatState
	wg        sync.WaitGroup
}

// client is the hub's state of one socket.
type client struct {
	conn       *conn
	accountID  string
	sessionKey string
	token      string
	helloed    bool
	commands   limiter
	moves      limiter
	member     *member // nil when not in a room
	entering   bool    // an enter is in progress
}

// New returns a hub serving backend.
func New(backend Backend, opts Options) *Hub {
	opts.defaults()
	h := &Hub{
		backend: backend,
		opts:    opts,
		log:     opts.Logger,
		upgrader: websocket.Upgrader{
			HandshakeTimeout:  10 * time.Second,
			CheckOrigin:       opts.CheckOrigin,
			EnableCompression: !opts.DisableCompression,
		},
		conns:   map[*conn]*client{},
		rooms:   map[string]*room{},
		members: map[string]*member{},
		kicks:   map[string]time.Time{},
		chat:    map[string]*chatState{},
	}
	h.ctx, h.cancel = context.WithCancel(context.Background())
	return h
}

// Shutdown closes every socket with 1001 and waits for the handlers until
// ctx ends, then drops the sockets that are left.
func (h *Hub) Shutdown(ctx context.Context) error {
	h.mu.Lock()
	h.closing = true
	conns := make([]*conn, 0, len(h.conns))
	for c := range h.conns {
		conns = append(conns, c)
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
	for c := range h.conns {
		c.terminate()
	}
	h.mu.Unlock()
	<-done
	return ctx.Err()
}

// encode marshals a frame without HTML escaping.
func encode(value any) []byte {
	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		slog.Error("encode my room frame", "error", err)
		return nil
	}
	return bytes.TrimSuffix(buffer.Bytes(), []byte("\n"))
}

func errorFrame(code, requestID string, extra map[string]any) []byte {
	frame := map[string]any{"type": "error", "code": code}
	if requestID != "" {
		frame["requestId"] = requestID
	}
	for key, value := range extra {
		frame[key] = value
	}
	return encode(frame)
}

// broadcastLocked queues payload to every member of r except one.
func (h *Hub) broadcastLocked(r *room, payload []byte, except *member) {
	for _, m := range r.members {
		if m != except {
			m.conn.send(payload)
		}
	}
}

func (r *room) sortedMembers() []MemberView {
	views := make([]MemberView, 0, len(r.members))
	for _, m := range r.members {
		views = append(views, m.view)
	}
	slices.SortFunc(views, func(a, b MemberView) int { return a.Slot - b.Slot })
	return views
}

// freeSlotLocked is the rider card of a newcomer: 0 for the owner, else the
// lowest free visitor card, or -1 when the visitor cards are taken.
func (r *room) freeSlotLocked(owner bool) int {
	if owner {
		return 0
	}
	taken := map[int]bool{}
	for _, m := range r.members {
		taken[m.view.Slot] = true
	}
	for slot := 1; slot < MaxMembers; slot++ {
		if !taken[slot] {
			return slot
		}
	}
	return -1
}

// leaveLocked takes a client out of its room, telling the others; reason
// is "" for a normal leave, else "kicked" or "replaced".
func (h *Hub) leaveLocked(cl *client, reason string) {
	m := cl.member
	if m == nil {
		return
	}
	cl.member = nil
	r := m.room
	if h.members[cl.accountID] == m {
		delete(h.members, cl.accountID)
	}
	delete(r.members, cl.accountID)
	frame := map[string]any{"type": "left", "accountId": cl.accountID, "nickname": m.view.Nickname}
	if reason != "" {
		frame["reason"] = reason
	}
	h.broadcastLocked(r, encode(frame), nil)
	if len(r.members) == 0 && h.rooms[r.view.OwnerID] == r {
		delete(h.rooms, r.view.OwnerID)
	}
}

// kickKey names a kick ban.
func kickKey(owner, visitor string) string { return owner + "|" + visitor }

func (h *Hub) kickedLocked(owner, visitor string) bool {
	until, ok := h.kicks[kickKey(owner, visitor)]
	if !ok {
		return false
	}
	if h.opts.Now().Before(until) {
		return true
	}
	delete(h.kicks, kickKey(owner, visitor))
	return false
}

// RefreshOwner reloads the room of ownerID (when it is live) and the
// rider ownerID is wherever it walks, and tells the riders there: called
// after the account's profile or representative emblems changed.
func (h *Hub) RefreshOwner(accountID string) {
	h.mu.Lock()
	_, owns := h.rooms[accountID]
	_, inRoom := h.members[accountID]
	if h.closing || (!owns && !inRoom) {
		h.mu.Unlock()
		return
	}
	h.wg.Add(1)
	h.mu.Unlock()
	go func() {
		defer h.wg.Done()
		h.refresh(accountID)
	}()
}

func (h *Hub) refresh(accountID string) {
	ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
	defer cancel()
	rider, found, err := h.backend.Rider(ctx, accountID)
	if err != nil || !found {
		return
	}
	emblems, err := h.backend.MainEmblems(ctx, accountID)
	if err != nil {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if r := h.rooms[accountID]; r != nil {
		r.view = roomView(rider, emblems)
		h.broadcastLocked(r, encode(map[string]any{"type": "settings", "room": r.view}), nil)
	}
	if m := h.members[accountID]; m != nil {
		m.view.Nickname, m.view.Exp, m.view.Appearance = rider.Nickname, rider.Exp, rider.Profile.Appearance
		m.view.Level, m.view.Glove = rider.Level, rider.Glove
		h.broadcastLocked(m.room, encode(map[string]any{"type": "member", "member": m.view}), nil)
	}
}

func roomView(owner Rider, emblems [2]int) RoomView {
	return RoomView{OwnerID: owner.AccountID, OwnerNickname: owner.Nickname, OwnerExp: owner.Exp,
		OwnerAppearance: owner.Profile.Appearance, Settings: owner.Profile.Settings, MainEmblems: emblems}
}

// pickRandom chooses a room for a random visit: a live room or an online
// rider's, not the visitor's own or current one, without a room password,
// not full, and not one the visitor was kicked from or blocked by. ok is
// false when none qualifies.
func (h *Hub) pickRandom(ctx context.Context, cl *client) (Rider, bool) {
	h.mu.Lock()
	current := ""
	if cl.member != nil {
		current = cl.member.room.view.OwnerID
	}
	candidates := make([]string, 0, len(h.rooms))
	for owner := range h.rooms {
		candidates = append(candidates, owner)
	}
	h.mu.Unlock()
	candidates = append(candidates, h.backend.Online(4*randomCandidates)...)
	rand.Shuffle(len(candidates), func(i, j int) { candidates[i], candidates[j] = candidates[j], candidates[i] })
	seen := map[string]bool{}
	tried := 0
	for _, owner := range candidates {
		if seen[owner] || owner == cl.accountID || owner == current {
			continue
		}
		seen[owner] = true
		if tried++; tried > randomCandidates {
			break
		}
		h.mu.Lock()
		full := false
		if r := h.rooms[owner]; r != nil {
			full = r.freeSlotLocked(false) < 0
		}
		kicked := h.kickedLocked(owner, cl.accountID)
		h.mu.Unlock()
		if full || kicked {
			continue
		}
		rider, found, err := h.backend.Rider(ctx, owner)
		if err != nil || !found || rider.Profile.Settings.Locked {
			continue
		}
		if blocked, err := h.backend.Blocked(ctx, owner, cl.accountID); err != nil || blocked {
			continue
		}
		return rider, true
	}
	return Rider{}, false
}
