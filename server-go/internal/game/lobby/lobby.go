// Package lobby is the game node's room authority, a line-by-line port of the
// Java LobbyService/Room/GameModes. One mutex plays the role of Java's
// synchronized: every command, timer and motion frame runs under it, then
// publishes a snapshot with a greater revision to the other members.
package lobby

import (
	"cmp"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"kartsim/internal/game/names"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
	"kartsim/internal/shared/ticket"
)

// Sink delivers messages to one connection. It is called with the lobby
// lock held and must never block.
type Sink interface {
	Text(payload []byte)
	Binary(frame []byte)
}

// SnapshotSink is an optional Sink extension for the room snapshots pushed
// to members. A connection that has fallen behind may drop an unsent
// snapshot of the same room in favour of the newer one: snapshots are
// complete states and clients keep only the highest revision, so one member
// flooding cheap commands cannot overflow a slower member's send buffer.
type SnapshotSink interface {
	Snapshot(roomID string, payload []byte)
}

// Presence reserves live nicknames, and the accounts of account players,
// cluster-wide through the data service.
type Presence interface {
	// Claim reserves a name and account. It is called without the lobby lock
	// and returns an *apierr.Error for INVALID_GUEST_NAME / NICKNAME_TAKEN /
	// ACCOUNT_ONLINE.
	Claim(ctx context.Context, req contract.PresenceClaimRequest) error
	// Release frees a name and account in the background; it must not block.
	Release(req contract.PresenceReleaseRequest)
}

// Tickets verifies a signed entry ticket for this node and consumes its
// nonce, returning an *apierr.Error on rejection.
type Tickets interface {
	Admit(token string) (ticket.Claims, error)
}

// Closer is an optional Sink extension: Evict asks the connection to close
// with a WebSocket close code and reason. It is called with the lobby lock
// held and must not block; the connection's normal disconnect then releases
// its room seat and name.
type Closer interface {
	Close(code int, reason string)
}

// Recorder takes the records the Java service wrote to SQLite (saveRules,
// saveResults). It is called with the lobby lock held, in order, and must
// not block on the network.
type Recorder interface {
	SaveRules(contract.RoomRulesRequest)
	SaveRace(contract.RaceSettlement)
}

// Options configure a Lobby.
type Options struct {
	NodeID   string
	Clock    Clock
	Presence Presence
	Tickets  Tickets
	Recorder Recorder
	// Ownership verifies that account players own the equipment they bring
	// and race with (nil: not checked).
	Ownership Ownership
	// AllowGuests admits guest tickets (KART_ALLOW_GUESTS); otherwise hello
	// with a guest ticket answers 401 LOGIN_REQUIRED.
	AllowGuests bool
	MaxPlayers  int
	// MaxRooms caps the rooms on this node; create answers 503
	// ROOM_LIMIT_REACHED beyond it (default 200).
	MaxRooms int
	// Busy reports memory pressure; hello then answers 503 SERVER_BUSY
	// (nil: never busy).
	Busy   func() bool
	Logger *slog.Logger
	// WallClock stamps rule updates and settlements and times the equipment
	// checks' caches and rate limits (default time.Now).
	WallClock func() time.Time
	// Rates returns the data service's current reward rates (KART_EXP_RATE,
	// KART_LUCCI_RATE; nil: 1/1). Settlements carry the base rewards and the
	// rates used, which the data service applies when it credits them; the
	// race.rewards shown in snapshots are scaled the same way
	// (rewards.ApplyRate) so players see what is credited. Called with the
	// lobby lock held; must not block.
	Rates func() rewards.Rates
}

// Client is one WebSocket connection. Its fields are guarded by Lobby.mu.
type Client struct {
	sink            Sink
	playerID        string
	name            string
	folded          string // names.Fold(name), for the duplicate check
	accountID       string
	resourceVersion string
	roomID          string
	equipment       json.RawMessage
	initial         *string

	// ownership is the session's remembered equipment checks and its
	// budget for new ones.
	ownership sessionOwnership
}

// NewClient returns a connection that has not said hello yet.
func NewClient(sink Sink) *Client { return &Client{sink: sink} }

func (c *Client) emit(payload []byte) { c.sink.Text(payload) }

func (c *Client) emitSnapshot(roomID string, payload []byte) {
	if sink, ok := c.sink.(SnapshotSink); ok {
		sink.Snapshot(roomID, payload)
		return
	}
	c.sink.Text(payload)
}

// Lobby owns every room on this node.
type Lobby struct {
	nodeID      string
	clock       Clock
	wall        func() time.Time
	presence    Presence
	tickets     Tickets
	recorder    Recorder
	ownership   Ownership
	allowGuests bool
	maxPlayers  int
	maxRooms    int
	busy        func() bool
	rates       func() rewards.Rates
	log         *slog.Logger

	// verifySlots bounds the equipment checks in flight (a semaphore).
	verifySlots chan struct{}

	mu      sync.Mutex
	rooms   map[string]*room
	order   []*room // creation order, like the Java LinkedHashMap
	clients map[string]*Client
	pending map[*Client]pendingHello // hellos claiming presence
	closed  bool
}

// pendingHello is what a hello still claiming presence reserves on the
// node: its folded name and its account.
type pendingHello struct {
	folded    string
	accountID string
}

var (
	resourceVersions = []string{"p3528", "p3543", "p3553"}
	randomTrackCodes = []int{0, 3, 4, 5, 6, 7, 8, 30, 40}
	awardMotions     = []int{3, 4, 5, 12}
	finishPoints     = []int{10, 8, 6, 4, 2, 1, 0, 0}
)

// New returns an empty lobby.
func New(opts Options) *Lobby {
	l := &Lobby{
		nodeID:      opts.NodeID,
		clock:       opts.Clock,
		wall:        opts.WallClock,
		presence:    opts.Presence,
		tickets:     opts.Tickets,
		recorder:    opts.Recorder,
		ownership:   opts.Ownership,
		allowGuests: opts.AllowGuests,
		maxPlayers:  opts.MaxPlayers,
		maxRooms:    opts.MaxRooms,
		busy:        opts.Busy,
		rates:       opts.Rates,
		log:         opts.Logger,
		verifySlots: make(chan struct{}, maxConcurrentVerifies),
		rooms:       map[string]*room{},
		clients:     map[string]*Client{},
		pending:     map[*Client]pendingHello{},
	}
	if l.clock == nil {
		l.clock = SystemClock()
	}
	if l.wall == nil {
		l.wall = time.Now
	}
	if l.recorder == nil {
		l.recorder = discardRecorder{}
	}
	if l.maxPlayers <= 0 {
		l.maxPlayers = 400
	}
	if l.maxRooms <= 0 {
		l.maxRooms = 200
	}
	if l.log == nil {
		l.log = slog.Default()
	}
	if l.rates == nil {
		l.rates = rewards.DefaultRates
	}
	return l
}

type discardRecorder struct{}

func (discardRecorder) SaveRules(contract.RoomRulesRequest) {}
func (discardRecorder) SaveRace(contract.RaceSettlement)    {}

// Close stops timers from acting; it is called during shutdown.
func (l *Lobby) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.closed = true
}

// Online lists the hello'd players and the room count for the heartbeat.
func (l *Lobby) Online() ([]contract.OnlinePlayer, int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	players := make([]contract.OnlinePlayer, 0, len(l.clients))
	for _, c := range l.clients {
		players = append(players, contract.OnlinePlayer{PlayerID: c.playerID, Name: c.name})
	}
	slices.SortFunc(players, func(a, b contract.OnlinePlayer) int { return cmp.Compare(a.Name, b.Name) })
	return players, len(l.rooms)
}

// Counts reports the hello'd players and the rooms (healthz).
func (l *Lobby) Counts() (players, rooms int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.clients), len(l.rooms)
}

// Admitted reports whether c has completed hello.
func (l *Lobby) Admitted(c *Client) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return c.playerID != ""
}

// Handle runs one command for c (the Java LobbyService.handle). Rejections
// are *apierr.Error; any other error is an internal failure. The commands of
// one client must not run concurrently (each connection has one reader).
//
// Commands that bring or race with an account's equipment (create, join,
// equipment, ready, start) need the data service to confirm it is owned.
// The command first runs under the lobby lock; when it reaches the point
// where Java applies the equipment without a fresh answer, it stops before
// changing anything, the call runs on this goroutine without the lock, and
// the command runs again (runVerified).
func (l *Lobby) Handle(ctx context.Context, c *Client, in Request) (Reply, error) {
	l.mu.Lock()
	typ, err := in.text("type", 1, 40)
	if err == nil && typ != "hello" && c.playerID == "" {
		err = fail(http.StatusBadRequest, "HELLO_REQUIRED")
	}
	if err != nil || typ == "hello" {
		l.mu.Unlock()
		if err != nil {
			return Reply{}, err
		}
		return l.hello(ctx, c, in)
	}
	defer l.mu.Unlock()
	body, err := l.runVerified(ctx, c, func(check *ownershipCheck) (obj, error) {
		return l.dispatch(c, typ, in, check)
	})
	if err != nil {
		return Reply{}, err
	}
	return Reply{body}, nil
}

func (l *Lobby) dispatch(c *Client, typ string, in Request, check *ownershipCheck) (obj, error) {
	switch typ {
	case "clock":
		return l.clockCommand(in)
	case "list-ordinary", "list-gameplay":
		return l.list(typ, in)
	case "create":
		return l.create(c, in, check)
	case "join":
		return l.join(c, in, check)
	case "leave":
		return l.leave(c, in)
	case "get-room-settings":
		return l.getSettings(c, in)
	case "chat":
		return l.chat(c, in, false)
	case "race-chat":
		return l.chat(c, in, true)
	case "ready", "team", "track", "random-track", "slot", "kick",
		"kick-vote", "transfer-host", "equipment", "changing", "room-settings":
		return l.mutate(c, typ, in, check)
	case "start":
		return l.start(c, in, check)
	case "loaded":
		return l.loaded(c, in)
	case "load-failed":
		return l.loadFailed(c, in)
	case "finish":
		return l.finish(c, in)
	case "return-room":
		return l.returnRoom(c, in)
	case "giant-state":
		return l.giantState(c, in)
	case "team-charge":
		return l.teamCharge(c, in)
	case "award-motion":
		return l.awardMotion(c, in)
	default:
		return nil, fail(http.StatusBadRequest, "UNSUPPORTED_COMMAND")
	}
}

// Disconnect releases the connection's room and live name (Java disconnect).
func (l *Lobby) Disconnect(c *Client) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if c.playerID == "" {
		return
	}
	delete(l.clients, c.playerID)
	if c.roomID != "" {
		l.leaveInternal(c, nil)
	}
	l.presence.Release(contract.PresenceReleaseRequest{
		NodeID: l.nodeID, PlayerID: c.playerID, Name: c.name, AccountID: c.accountID})
}

// Close code and reason of a session whose nickname claim another node took
// over (heartbeat conflicts): 1008 policy violation.
const (
	ConflictCloseCode   = 1008
	ConflictCloseReason = "nickname taken elsewhere"
)

// Evict closes the sessions of playerIDs, which the data service reports as
// holding a nickname claim that another node now owns (HeartbeatResponse
// Conflicts). Each connection then disconnects normally, which releases its
// room seat like any disconnect; its name release is a no-op at the data
// service because the claim is someone else's. Unknown IDs are ignored. It
// returns how many sessions were asked to close.
func (l *Lobby) Evict(playerIDs []string) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	evicted := 0
	for _, id := range playerIDs {
		c := l.clients[id]
		if c == nil {
			continue
		}
		closer, ok := c.sink.(Closer)
		if !ok {
			l.log.Warn("cannot close a conflicting session", "player", id)
			continue
		}
		closer.Close(ConflictCloseCode, ConflictCloseReason)
		evicted++
	}
	return evicted
}

// admitted is a hello that passed every local check and waits for the
// cluster-wide nickname claim.
type admitted struct {
	playerID  string
	name      string
	accountID string
	guest     bool
	version   string
	equipment json.RawMessage
	initial   *string
}

// hello admits a connection. The checks run under the lock and reserve the
// name and account locally; the data service calls (equipment ownership,
// then the nickname and account claim) run without the lock.
func (l *Lobby) hello(ctx context.Context, c *Client, in Request) (Reply, error) {
	l.mu.Lock()
	ad, err := l.admit(c, in)
	if err == nil {
		l.pending[c] = pendingHello{folded: names.Fold(ad.name), accountID: ad.accountID}
		// Refused like create/join/equipment, so the client learns that its
		// gear is not owned (an expired rental): the browser re-reads the
		// inventory, falls back to its starter gear and says hello again.
		_, err = l.runVerified(ctx, c, func(check *ownershipCheck) (obj, error) {
			return nil, l.owns(check, c, ad.accountID, ad.equipment)
		})
		if err != nil {
			delete(l.pending, c)
		}
	}
	l.mu.Unlock()
	if err != nil {
		return Reply{}, err
	}

	claimErr := l.presence.Claim(ctx, contract.PresenceClaimRequest{
		NodeID: l.nodeID, PlayerID: ad.playerID, Name: ad.name, Guest: ad.guest,
		AccountID: ad.accountID})

	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.pending, c)
	if claimErr != nil {
		if rejected, ok := apierr.As(claimErr); ok {
			return Reply{}, rejected
		}
		l.log.Warn("presence claim failed", "error", claimErr)
		return Reply{}, fail(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
	}
	if l.closed {
		l.presence.Release(contract.PresenceReleaseRequest{
			NodeID: l.nodeID, PlayerID: ad.playerID, Name: ad.name, AccountID: ad.accountID})
		return Reply{}, fail(http.StatusServiceUnavailable, "SERVER_SHUTTING_DOWN")
	}
	c.playerID = ad.playerID
	c.name = ad.name
	c.folded = names.Fold(ad.name)
	c.accountID = ad.accountID
	c.resourceVersion = ad.version
	c.equipment = ad.equipment
	c.initial = ad.initial
	l.clients[c.playerID] = c
	return Reply{obj{
		{"type", "welcome"},
		{"playerId", c.playerID},
		{"protocolVersion", contract.ProtocolVersion},
		{"ruleset", contract.Ruleset},
		{"capabilities", []string{}},
	}}, nil
}

func (l *Lobby) admit(c *Client, in Request) (admitted, error) {
	var ad admitted
	if c.playerID != "" {
		return ad, fail(http.StatusBadRequest, "ALREADY_CONNECTED")
	}
	protocol, err := in.integer("protocolVersion", 0, 1000)
	if err != nil {
		return ad, err
	}
	if protocol != contract.ProtocolVersion {
		return ad, fail(http.StatusBadRequest, "PROTOCOL_MISMATCH")
	}
	ruleset, err := in.text("ruleset", 1, 40)
	if err != nil {
		return ad, err
	}
	if ruleset != contract.Ruleset {
		return ad, fail(http.StatusBadRequest, "PROTOCOL_MISMATCH")
	}
	version, err := in.text("resourceVersion", 1, 20)
	if err != nil {
		return ad, err
	}
	if !slices.Contains(resourceVersions, version) {
		return ad, fail(http.StatusBadRequest, "RESOURCE_VERSION_UNSUPPORTED")
	}
	supplied, err := in.text("name", 1, 18)
	if err != nil {
		return ad, err
	}
	if len(l.clients)+len(l.pending) >= l.maxPlayers {
		return ad, fail(http.StatusServiceUnavailable, "SERVER_FULL")
	}
	if l.busy != nil && l.busy() {
		return ad, fail(http.StatusServiceUnavailable, "SERVER_BUSY")
	}
	token, err := ticketField(in)
	if err != nil {
		return ad, err
	}
	claims, err := l.tickets.Admit(token)
	if err != nil {
		return ad, err
	}
	if claims.Guest && !l.allowGuests {
		return ad, fail(http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
	ad.guest = claims.Guest
	ad.name = supplied
	if claims.Guest {
		if !validGuestName(supplied) {
			return ad, fail(http.StatusBadRequest, "INVALID_GUEST_NAME")
		}
	} else {
		ad.name = claims.Nickname
		ad.accountID = claims.AccountID
	}
	if l.nameTaken(ad.name) {
		return ad, fail(http.StatusConflict, "NICKNAME_TAKEN")
	}
	// Not in Java: one session per account. Nicknames alone do not ensure
	// it (an account renamed while connected could say hello again), and
	// two seats of one account would race and be rewarded twice. The data
	// service enforces the same cluster-wide (PresenceClaimRequest.AccountID).
	if ad.accountID != "" && l.accountOnline(ad.accountID) {
		return ad, fail(http.StatusConflict, "ACCOUNT_ONLINE")
	}
	if raw, present := in.get("equipment"); validEquipment(raw, present) {
		ad.equipment = compactJSON(raw)
	}
	if ad.initial, err = in.optionalText("initial", 64); err != nil {
		return ad, err
	}
	ad.playerID = newUUID()
	ad.version = version
	return ad, nil
}

// ticketField reads the hello ticket: missing or null is TICKET_REQUIRED,
// any other non-string is TICKET_INVALID.
func ticketField(in Request) (string, error) {
	raw, ok := in.get("ticket")
	if !ok || kindOf(raw) == kindNull {
		return "", fail(http.StatusUnauthorized, "TICKET_REQUIRED")
	}
	token, isText := decodeString(raw)
	if !isText {
		return "", fail(http.StatusUnauthorized, "TICKET_INVALID")
	}
	return token, nil
}

// nameTaken is the Java equalsIgnoreCase scan over live names, including
// names reserved by hellos still claiming presence. names.Fold is that rule
// (strings.EqualFold is not: it keeps İ and ı apart from I and i).
func (l *Lobby) nameTaken(name string) bool {
	folded := names.Fold(name)
	for _, other := range l.clients {
		if other.folded == folded {
			return true
		}
	}
	for _, reserved := range l.pending {
		if reserved.folded == folded {
			return true
		}
	}
	return false
}

// accountOnline reports whether a live session, or a hello still claiming
// presence, belongs to accountID.
func (l *Lobby) accountOnline(accountID string) bool {
	for _, other := range l.clients {
		if other.accountID == accountID {
			return true
		}
	}
	for _, reserved := range l.pending {
		if reserved.accountID == accountID {
			return true
		}
	}
	return false
}

// validGuestName mirrors Accounts.validName(name, 18).
func validGuestName(name string) bool {
	if name == "" || javaIsBlank(name) || name[0] <= ' ' || name[len(name)-1] <= ' ' ||
		len([]rune(name)) > 18 {
		return false
	}
	for _, r := range name {
		if isISOControl(r) || r == '<' || r == '>' {
			return false
		}
	}
	return true
}

func (l *Lobby) clockCommand(in Request) (obj, error) {
	tick, ok := in.number("clientTick")
	if !ok || tick < 0 || math.IsInf(tick, 0) || math.IsNaN(tick) {
		return nil, fail(http.StatusBadRequest, "INVALID_CLOCK")
	}
	return obj{{"type", "clock"}, {"clientTick", jdouble(tick)}, {"serverTick", l.clock.Now()}}, nil
}

func (l *Lobby) list(typ string, in Request) (obj, error) {
	page, err := in.integer("page", 0, 100_000)
	if err != nil {
		return nil, err
	}
	gameplay := "ordinary"
	if typ != "list-ordinary" {
		if gameplay, err = in.text("gameplay", 1, 20); err != nil {
			return nil, err
		}
	}
	matching := []obj{}
	for _, r := range l.order {
		if r.gameplay == gameplay {
			matching = append(matching, r.summary())
		}
	}
	from := min(len(matching), page*10)
	to := min(len(matching), from+10)
	return obj{{"type", "rooms"}, {"page", page}, {"total", len(matching)},
		{"rooms", matching[from:to]}}, nil
}

func (l *Lobby) create(c *Client, in Request, check *ownershipCheck) (obj, error) {
	if c.roomID != "" {
		return nil, fail(http.StatusBadRequest, "ALREADY_IN_ROOM")
	}
	channel, err := in.text("channelName", 1, 40)
	if err != nil {
		return nil, err
	}
	var mode string
	switch channel {
	case "speedIndiCombine", "speedIndiInfinit":
		mode = "individual"
	case "speedTeamCombine", "speedTeamInfinit":
		mode = "team"
	default:
		return nil, fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	speed := 7
	if strings.HasSuffix(channel, "Infinit") {
		speed = 4
	}
	requestedMode, err := in.text("mode", 1, 20)
	if err != nil {
		return nil, err
	}
	if requestedMode != mode {
		return nil, fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	requestedSpeed, err := in.integer("speed", 4, 7)
	if err != nil {
		return nil, err
	}
	if requestedSpeed != speed {
		return nil, fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	speedVersion, err := in.text("speedVersion", 1, 10)
	if err != nil {
		return nil, err
	}
	if speedVersion != "国服" {
		return nil, fail(http.StatusBadRequest, "INVALID_CHANNEL")
	}
	gameplay := "ordinary"
	if value, err := in.optionalText("gameplay", 20); err != nil {
		return nil, err
	} else if value != nil {
		gameplay = *value
	}
	name, err := in.text("name", 1, 18)
	if err != nil {
		return nil, err
	}
	capacity, err := in.integer("capacity", 2, 8)
	if err != nil {
		return nil, err
	}
	if mode == "team" && capacity%2 != 0 {
		return nil, fail(http.StatusBadRequest, "INVALID_CAPACITY")
	}
	if err := validateCreation(gameplay, channel, c.resourceVersion, capacity); err != nil {
		return nil, err
	}
	password := ""
	if value, err := in.optionalText("password", 12); err != nil {
		return nil, err
	} else if value != nil {
		password = *value
	}
	if len(l.rooms) >= l.maxRooms {
		return nil, fail(http.StatusServiceUnavailable, "ROOM_LIMIT_REACHED")
	}
	equipment := appliedEquipment(c, in)
	if err := l.owns(check, c, c.accountID, equipment); err != nil {
		return nil, err
	}
	c.equipment = equipment
	r := newRoom(newUUID(), name, password, mode, channel, gameplay,
		c.resourceVersion, capacity, speed, c.playerID)
	initializeTrack(r)
	team := 0
	if mode == "team" {
		team = 1
	}
	r.members = append(r.members, &member{playerID: c.playerID, name: c.name,
		accountID: c.accountID, slot: 0, team: team, equipment: c.equipment, initial: c.initial})
	l.rooms[r.id] = r
	l.order = append(l.order, r)
	c.roomID = r.id
	l.saveRules(r)
	return roomReply(r), nil
}

func (l *Lobby) join(c *Client, in Request, check *ownershipCheck) (obj, error) {
	if c.roomID != "" {
		return nil, fail(http.StatusBadRequest, "ALREADY_IN_ROOM")
	}
	id, err := in.text("roomId", 1, 64)
	if err != nil {
		return nil, err
	}
	r, err := l.requireRoom(id)
	if err != nil {
		return nil, err
	}
	// A racing room with space can be joined; the newcomer is not in the
	// frozen roster and waits in the room until the race closes.
	if r.resourceVersion != c.resourceVersion {
		return nil, fail(http.StatusBadRequest, "RESOURCE_VERSION_MISMATCH")
	}
	password, err := in.optionalText("password", 12)
	if err != nil {
		return nil, err
	}
	supplied := ""
	if password != nil {
		supplied = *password
	}
	if r.password != supplied {
		return nil, fail(http.StatusForbidden, "INVALID_PASSWORD")
	}
	if len(r.members) >= r.capacity {
		return nil, fail(http.StatusBadRequest, "ROOM_FULL")
	}
	preferred := 0
	if r.mode == "team" {
		preferred = preferredTeam(r)
	}
	slot := availableSlot(r, preferred)
	if slot < 0 {
		return nil, fail(http.StatusBadRequest, "ROOM_FULL")
	}
	team := 0
	if r.mode == "team" {
		team = 2
		if slot < 4 {
			team = 1
		}
	}
	equipment := appliedEquipment(c, in)
	if err := l.owns(check, c, c.accountID, equipment); err != nil {
		return nil, err
	}
	c.equipment = equipment
	r.members = append(r.members, &member{playerID: c.playerID, name: c.name,
		accountID: c.accountID, slot: slot, team: team, equipment: c.equipment, initial: c.initial})
	c.roomID = r.id
	r.revision++
	l.broadcastRoom(r, c)
	return roomReply(r), nil
}

func (l *Lobby) leave(c *Client, in Request) (obj, error) {
	r, err := l.memberRoom(c, in)
	if err != nil {
		return nil, err
	}
	l.leaveInternal(c, r)
	return obj{{"type", "left"}, {"roomId", r.id}}, nil
}

func (l *Lobby) leaveInternal(c *Client, existing *room) {
	r := existing
	if r == nil {
		r = l.rooms[c.roomID]
	}
	c.roomID = ""
	if r == nil {
		return
	}
	r.removeMember(c.playerID)
	r.kickVote = nil
	if len(r.members) == 0 {
		l.removeRoom(r)
		return
	}
	if r.hostID == c.playerID {
		r.hostID = r.members[0].playerID
	}
	if r.gameplay == "roadblock" && r.race != nil && r.phase == "racing" {
		if r.race.inRoster(c.playerID) {
			r.race.leftIDs = append(r.race.leftIDs, c.playerID)
		}
		if c.playerID == r.race.roadblockRunner {
			l.endRoadblock(r, "runner-left", max(l.clock.Now(), *r.race.startAt))
		} else {
			r.revision++
			l.broadcastRoom(r, nil)
		}
		return
	}
	if r.phase == "finished" && r.race != nil {
		r.race.returnedIDs = removeFirst(r.race.returnedIDs, c.playerID)
		closeRaceWhenReturned(r)
	}
	if r.phase != "open" && r.phase != "finished" {
		r.phase = "open"
		r.race = nil
		r.raceError = "MEMBER_LEFT"
	}
	r.revision++
	l.broadcastRoom(r, nil)
}

func (l *Lobby) removeRoom(r *room) {
	delete(l.rooms, r.id)
	if i := slices.Index(l.order, r); i >= 0 {
		l.order = slices.Delete(l.order, i, i+1)
	}
}

func (l *Lobby) getSettings(c *Client, in Request) (obj, error) {
	r, err := l.memberRoom(c, in)
	if err != nil {
		return nil, err
	}
	if err := requireHost(r, c); err != nil {
		return nil, err
	}
	return obj{{"type", "room-settings"}, {"roomId", r.id}, {"revision", r.revision},
		{"name", r.name}, {"password", r.password}}, nil
}

func (l *Lobby) mutate(c *Client, typ string, in Request, check *ownershipCheck) (obj, error) {
	r, err := l.memberRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.phase != "open" {
		return nil, fail(http.StatusBadRequest, "ROOM_NOT_OPEN")
	}
	if in.has("revision") {
		revision, err := in.integer("revision", 1, math.MaxInt32)
		if err != nil {
			return nil, err
		}
		if revision != r.revision {
			return nil, fail(http.StatusConflict, "STALE_REVISION")
		}
	}
	m := r.member(c.playerID)
	if err := l.applyMutation(r, m, c, typ, in, check); err != nil {
		return nil, err
	}
	r.revision++
	l.broadcastRoom(r, c)
	return roomReply(r), nil
}

func (l *Lobby) applyMutation(r *room, m *member, c *Client, typ string, in Request, check *ownershipCheck) error {
	switch typ {
	case "ready":
		if r.hostID == c.playerID {
			return fail(http.StatusBadRequest, "HOST_CANNOT_READY")
		}
		ready, err := in.booleanField("ready")
		if err != nil {
			return err
		}
		// Not in Java: a member readies only with equipment still owned (a
		// rental may have expired since it was confirmed).
		if ready {
			if err := l.owns(check, c, m.accountID, m.equipment); err != nil {
				return err
			}
		}
		m.ready = ready
	case "team":
		if r.mode != "team" {
			return fail(http.StatusBadRequest, "TEAM_REQUIRED")
		}
		team, err := in.integer("team", 1, 2)
		if err != nil {
			return err
		}
		slot := availableSlot(r, team)
		if slot < 0 {
			return fail(http.StatusBadRequest, "TEAM_FULL")
		}
		m.slot = slot
		m.team = team
	case "track":
		if err := requireHost(r, c); err != nil {
			return err
		}
		track, err := in.text("trackId", 1, 64)
		if err != nil {
			return err
		}
		if !identifierPattern.MatchString(track) {
			return fail(http.StatusBadRequest, "INVALID_TRACK")
		}
		if err := validateTrack(r, track); err != nil {
			return err
		}
		r.trackID = track
		r.randomTrackCode = nil
		l.saveRules(r)
	case "random-track":
		if err := requireHost(r, c); err != nil {
			return err
		}
		if r.resourceVersion != "p3553" {
			return fail(http.StatusBadRequest, "RESOURCE_VERSION_UNSUPPORTED")
		}
		code, err := in.integer("randomTrackCode", 0, 40)
		if err != nil {
			return err
		}
		if !slices.Contains(randomTrackCodes, code) {
			return fail(http.StatusBadRequest, "INVALID_TRACK")
		}
		if err := validateRandomTrack(r, code); err != nil {
			return err
		}
		r.trackID = ""
		r.randomTrackCode = &code
		l.saveRules(r)
	case "slot":
		if err := requireHost(r, c); err != nil {
			return err
		}
		slot, err := in.integer("slot", 0, 7)
		if err != nil {
			return err
		}
		closed, err := in.booleanField("closed")
		if err != nil {
			return err
		}
		if (r.mode == "team" && slot%4 >= r.capacity/2) || (r.mode != "team" && slot >= r.capacity) {
			return fail(http.StatusBadRequest, "INVALID_SLOT")
		}
		for _, other := range r.members {
			if other.slot == slot {
				return fail(http.StatusBadRequest, "SLOT_OCCUPIED")
			}
		}
		r.closedSlots = removeFirst(r.closedSlots, slot)
		if closed {
			r.closedSlots = append(r.closedSlots, slot)
		}
	case "kick":
		if err := requireHost(r, c); err != nil {
			return err
		}
		target, err := in.text("playerId", 1, 64)
		if err != nil {
			return err
		}
		if target == c.playerID {
			return fail(http.StatusBadRequest, "INVALID_TARGET")
		}
		if r.member(target) == nil {
			return fail(http.StatusBadRequest, "PLAYER_NOT_FOUND")
		}
		if r.kickVote != nil {
			return fail(http.StatusBadRequest, "VOTE_IN_PROGRESS")
		}
		var voters []string
		for _, other := range r.members {
			if other.playerID != target {
				voters = append(voters, other.playerID)
			}
		}
		vote := &kickVote{id: newUUID(), targetID: target, eligibleIDs: voters,
			deadline: l.clock.Now() + 20_000}
		r.kickVote = vote
		vote.yesIDs = append(vote.yesIDs, c.playerID)
		if len(voters) == 1 {
			l.resolveVote(r)
		} else {
			roomID, voteID := r.id, vote.id
			l.schedule(20*time.Second, func() { l.voteTimeout(roomID, voteID) })
		}
	case "kick-vote":
		vote := r.kickVote
		if vote == nil {
			return fail(http.StatusBadRequest, "VOTE_NOT_FOUND")
		}
		voteID, err := in.text("voteId", 1, 64)
		if err != nil {
			return err
		}
		if vote.id != voteID || !slices.Contains(vote.eligibleIDs, c.playerID) ||
			slices.Contains(vote.yesIDs, c.playerID) || slices.Contains(vote.noIDs, c.playerID) {
			return fail(http.StatusBadRequest, "VOTE_NOT_FOUND")
		}
		approve, err := in.booleanField("approve")
		if err != nil {
			return err
		}
		if approve {
			vote.yesIDs = append(vote.yesIDs, c.playerID)
		} else {
			vote.noIDs = append(vote.noIDs, c.playerID)
		}
		l.resolveVote(r)
	case "transfer-host":
		if err := requireHost(r, c); err != nil {
			return err
		}
		if r.kickVote != nil {
			return fail(http.StatusBadRequest, "VOTE_IN_PROGRESS")
		}
		target, err := in.text("playerId", 1, 64)
		if err != nil {
			return err
		}
		if r.member(target) == nil {
			return fail(http.StatusBadRequest, "PLAYER_NOT_FOUND")
		}
		r.hostID = target
	case "equipment":
		raw, present := in.get("equipment")
		if !validEquipment(raw, present) {
			return fail(http.StatusBadRequest, "INVALID_EQUIPMENT")
		}
		equipment := compactJSON(raw)
		if err := l.owns(check, c, c.accountID, equipment); err != nil {
			return err
		}
		m.equipment = equipment
		c.equipment = m.equipment
		m.ready = false
		// Confirming the garage closes it; the client relies on this instead
		// of sending changing=false, so the member must not stay "装备中".
		m.changing = false
	case "changing":
		changing, err := in.booleanField("changing")
		if err != nil {
			return err
		}
		m.changing = changing
	case "room-settings":
		if err := requireHost(r, c); err != nil {
			return err
		}
		name, err := in.text("name", 1, 18)
		if err != nil {
			return err
		}
		// Java assigns the name before validating the password.
		r.name = name
		password, err := in.optionalText("password", 12)
		if err != nil {
			return err
		}
		r.password = ""
		if password != nil {
			r.password = *password
		}
		l.saveRules(r)
	default:
		return fail(http.StatusBadRequest, "UNSUPPORTED_COMMAND")
	}
	return nil
}

func (l *Lobby) chat(c *Client, in Request, inRace bool) (obj, error) {
	r, err := l.memberRoom(c, in)
	if err != nil {
		return nil, err
	}
	if inRace {
		if r.race == nil {
			return nil, fail(http.StatusBadRequest, "RACE_NOT_FOUND")
		}
		raceID, err := in.text("raceId", 1, 64)
		if err != nil {
			return nil, err
		}
		if r.race.id != raceID {
			return nil, fail(http.StatusBadRequest, "RACE_NOT_FOUND")
		}
	}
	text, err := in.text("text", 1, 120)
	if err != nil {
		return nil, err
	}
	if javaIsBlank(text) {
		return nil, fail(http.StatusBadRequest, "INVALID_CHAT")
	}
	r.chatSequence++
	message := obj{{"sequence", r.chatSequence}, {"playerId", c.playerID},
		{"name", c.name}, {"text", text}}
	r.chat = append(r.chat, message)
	if len(r.chat) > 32 {
		r.chat = slices.Delete(r.chat, 0, 1)
	}
	typ := "chat"
	if inRace {
		typ = "race-chat"
	}
	event := obj{{"type", typ}, {"roomId", r.id}}
	if inRace {
		event = append(event, field{"raceId", r.race.id})
	}
	event = append(event, field{"message", message})
	l.broadcastPeerEvent(r, c, event)
	return event, nil
}

func (l *Lobby) start(c *Client, in Request, check *ownershipCheck) (obj, error) {
	r, err := l.memberRoom(c, in)
	if err != nil {
		return nil, err
	}
	if err := requireHost(r, c); err != nil {
		return nil, err
	}
	if r.phase != "open" {
		return nil, fail(http.StatusBadRequest, "ROOM_NOT_OPEN")
	}
	revision, err := in.integer("revision", 1, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	if revision != r.revision {
		return nil, fail(http.StatusConflict, "STALE_REVISION")
	}
	if len(r.members) < 2 {
		return nil, fail(http.StatusBadRequest, "NOT_ENOUGH_PLAYERS")
	}
	if r.gameplay == "roadblock" && len(r.members) < 5 {
		return nil, fail(http.StatusBadRequest, "NOT_ENOUGH_PLAYERS")
	}
	hasTeam := [3]bool{}
	for _, m := range r.members {
		if m.playerID != r.hostID && !m.ready {
			return nil, fail(http.StatusBadRequest, "PLAYERS_NOT_READY")
		}
	}
	for _, m := range r.members {
		if m.equipment == nil {
			return nil, fail(http.StatusBadRequest, "EQUIPMENT_REQUIRED")
		}
		hasTeam[m.team] = true
	}
	if r.mode == "team" && (!hasTeam[1] || !hasTeam[2]) {
		return nil, fail(http.StatusBadRequest, "TEAM_REQUIRED")
	}
	// Not in Java: one seat per account (hello already refuses a second
	// session, ACCOUNT_ONLINE), and everyone's equipment still owned.
	accounts := map[string]bool{}
	for _, m := range r.members {
		if m.accountID == "" {
			continue
		}
		if accounts[m.accountID] {
			return nil, fail(http.StatusConflict, "ACCOUNT_ONLINE")
		}
		accounts[m.accountID] = true
	}
	if err := l.membersOwnEquipment(r, check); err != nil {
		return nil, err
	}
	loadingWindow := int64(30_000)
	switch r.gameplay {
	case "roadblock", "giant", "rp", "lte":
		loadingWindow = 90_000
	}
	rc := &race{
		id:                  newUUID(),
		channelName:         r.channelName,
		gameplay:            r.gameplay,
		trackID:             chooseTrack(r),
		loadingDeadline:     l.clock.Now() + loadingWindow,
		rosterAccounts:      map[string]string{},
		rosterTeams:         map[string]int{},
		giantStates:         map[string]giantState{},
		teamChargeSequences: map[string]int{},
		teamGaugeSequences:  map[int]int{},
		teamGaugeTargets:    map[int]float64{},
	}
	for _, m := range r.members {
		rc.roster = append(rc.roster, m.snapshot())
		rc.rosterIDs = append(rc.rosterIDs, m.playerID)
		rc.startSlots = append(rc.startSlots, m.slot)
		rc.rosterAccounts[m.playerID] = m.accountID
		rc.rosterTeams[m.playerID] = m.team
	}
	r.race = rc
	addRaceData(r, rc)
	r.kickVote = nil
	r.phase = "loading"
	r.raceError = ""
	r.revision++
	roomID, raceID := r.id, rc.id
	l.schedule(time.Duration(loadingWindow)*time.Millisecond,
		func() { l.loadingTimeout(roomID, raceID) })
	l.broadcastRoom(r, c)
	return roomReply(r), nil
}

// membersOwnEquipment checks, at start, that every member still owns the
// equipment it races with: confirmations older than ownedTTL or past a
// rental's expiry are asked again (all at once, without the lobby lock).
// Members whose equipment is no longer owned are un-readied (a new room
// revision tells everyone who; the host has no ready state, so its own
// refused equipment only fails the start) and the start fails with
// ITEM_NOT_OWNED; the member's next ready is refused until it equips owned
// items.
func (l *Lobby) membersOwnEquipment(r *room, check *ownershipCheck) error {
	need := &verifyNeeded{}
	var refused []*member
	var failure error
	for _, m := range r.members {
		session := l.clients[m.playerID]
		if session == nil {
			continue
		}
		err := l.owns(check, session, m.accountID, m.equipment)
		var more *verifyNeeded
		switch {
		case err == nil:
		case errors.As(err, &more):
			need.items = append(need.items, more.items...)
		case isCode(err, "ITEM_NOT_OWNED"):
			refused = append(refused, m)
		case failure == nil:
			failure = err
		}
	}
	switch {
	case len(need.items) > 0:
		return need
	case failure != nil:
		return failure
	case len(refused) == 0:
		return nil
	}
	changed := false
	for _, m := range refused {
		changed = changed || m.ready
		m.ready = false
	}
	if changed {
		r.revision++
		l.broadcastRoom(r, nil)
	}
	return errNotOwned()
}

func isCode(err error, code string) bool {
	rejected, ok := apierr.As(err)
	return ok && rejected.Code == code
}

func (l *Lobby) loadingTimeout(roomID, raceID string) {
	r := l.rooms[roomID]
	if r == nil || r.race == nil || r.race.id != raceID || r.phase != "loading" {
		return
	}
	r.phase = "open"
	r.race = nil
	r.raceError = "LOAD_TIMEOUT"
	r.revision++
	l.broadcastRoom(r, nil)
}

func (l *Lobby) loaded(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.phase != "loading" {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_LOADING")
	}
	rc := r.race
	if !rc.isLoaded(c.playerID) {
		rc.loadedIDs = append(rc.loadedIDs, c.playerID)
	}
	if containsAll(rc.loadedIDs, racers(r)) {
		startAt := l.clock.Now() + 3_000
		rc.startAt = &startAt
		if r.gameplay == "roadblock" {
			deadline := startAt + roadblockLimitMs
			rc.finishDeadline = &deadline
			roomID, raceID := r.id, rc.id
			l.schedule((roadblockLimitMs+3_000)*time.Millisecond,
				func() { l.roadblockTimeout(roomID, raceID) })
		}
		r.phase = "countdown"
		roomID, raceID := r.id, rc.id
		l.schedule(3*time.Second, func() { l.beginRace(roomID, raceID) })
	}
	r.revision++
	l.broadcastRoom(r, c)
	return roomReply(r), nil
}

func (l *Lobby) beginRace(roomID, raceID string) {
	r := l.rooms[roomID]
	if r == nil || r.race == nil || r.race.id != raceID || r.phase != "countdown" {
		return
	}
	r.phase = "racing"
	r.revision++
	l.broadcastRoom(r, nil)
}

func (l *Lobby) loadFailed(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.phase != "loading" {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_LOADING")
	}
	r.phase = "open"
	r.race = nil
	r.raceError = "LOAD_FAILED"
	r.revision++
	l.broadcastRoom(r, c)
	return roomReply(r), nil
}

func (l *Lobby) finish(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.phase != "racing" {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_RUNNING")
	}
	elapsed, err := in.integer("elapsedMs", 0, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	rc := r.race
	if r.gameplay == "roadblock" {
		if c.playerID != rc.roadblockRunner {
			return nil, fail(http.StatusForbidden, "RUNNER_REQUIRED")
		}
		if l.clock.Now() >= *rc.finishDeadline {
			l.endRoadblock(r, "timeout", *rc.finishDeadline)
		} else {
			l.endRoadblock(r, "finish", l.clock.Now())
		}
		return roomReply(r), nil
	}
	for _, row := range rc.finishes {
		if row.playerID == c.playerID {
			return nil, fail(http.StatusBadRequest, "ALREADY_FINISHED")
		}
	}
	rc.finishes = append(rc.finishes, finishRow{playerID: c.playerID, elapsedMs: elapsed,
		serverAt: l.clock.Now()})
	if rc.finishDeadline == nil {
		deadline := l.clock.Now() + 10_000
		rc.finishDeadline = &deadline
		roomID, raceID := r.id, rc.id
		l.schedule(10*time.Second, func() { l.finalizeRace(roomID, raceID) })
	}
	if len(rc.finishes) == len(rc.loadedIDs) {
		l.finalizeRace(r.id, rc.id)
	} else {
		r.revision++
		l.broadcastRoom(r, c)
	}
	return roomReply(r), nil
}

func (l *Lobby) roadblockTimeout(roomID, raceID string) {
	r := l.rooms[roomID]
	if r == nil || r.race == nil || r.race.id != raceID || r.phase != "racing" {
		return
	}
	l.endRoadblock(r, "timeout", *r.race.finishDeadline)
}

// endRoadblock ends a roadblock race. The runner is the only racer who can
// win; blockers win at the time limit.
func (l *Lobby) endRoadblock(r *room, reason string, observedAt int64) {
	rc := r.race
	endAt := max(*rc.startAt, min(observedAt, *rc.finishDeadline))
	runner := rc.roadblockRunner
	if reason == "finish" {
		rc.finishes = append(rc.finishes, finishRow{playerID: runner,
			elapsedMs: int(int32(endAt - *rc.startAt)), serverAt: endAt})
	}
	rc.roadblockResult = obj{{"runnerWon", reason == "finish"}, {"reason", reason}, {"endAt", endAt}}
	raceOverAt := endAt + 3_000
	rc.raceOverAt = &raceOverAt
	rc.results = []resultRow{}
	rc.resultsSet = true
	l.awardRoadblock(r, rewards.Roadblock{RunnerID: runner, RunnerWon: reason == "finish"},
		endAt-*rc.startAt)
	r.phase = "finished"
	r.revision++
	l.saveResults(r)
	l.broadcastRoom(r, nil)
}

func (l *Lobby) giantState(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	rc := r.race
	if r.gameplay != "giant" || r.phase != "racing" || !rc.isLoaded(c.playerID) {
		return nil, fail(http.StatusBadRequest, "GIANT_STATE_UNAVAILABLE")
	}
	sequence, err := in.integer("sequence", 1, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	mainState, err := in.integer("main", 0, 4)
	if err != nil {
		return nil, err
	}
	extra, err := in.integer("extra", 0, 2)
	if err != nil {
		return nil, err
	}
	status, err := in.integer("status", 0, 1)
	if err != nil {
		return nil, err
	}
	if mainState != 4 && extra != 0 {
		return nil, fail(http.StatusBadRequest, "INVALID_GIANT_STATE")
	}
	previous := rc.giantStates[c.playerID]
	if sequence != previous.sequence+1 {
		return nil, fail(http.StatusConflict, "INVALID_SEQUENCE")
	}
	next := (previous.main + previous.extra + 1) % 7
	if (status == 1 && (mainState != previous.main || extra != previous.extra)) ||
		(status != 1 && (mainState != min(next, 4) || extra != max(0, next-4))) {
		return nil, fail(http.StatusBadRequest, "INVALID_GIANT_STATE")
	}
	rc.giantStates[c.playerID] = giantState{sequence: sequence, main: mainState, extra: extra, status: status}
	event := obj{{"type", "giant-state"}, {"roomId", r.id}, {"raceId", rc.id},
		{"playerId", c.playerID}, {"sequence", sequence}, {"main", mainState},
		{"extra", extra}, {"status", status}}
	l.broadcastPeerEvent(r, c, event)
	return event, nil
}

// teamCharge sums the team's drift charge and publishes the next normalized
// meter target.
func (l *Lobby) teamCharge(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	rc := r.race
	if r.mode != "team" || r.speed == 4 || r.gameplay == "grip" || r.phase != "racing" ||
		!rc.isLoaded(c.playerID) {
		return nil, fail(http.StatusBadRequest, "TEAM_GAUGE_UNAVAILABLE")
	}
	team := r.member(c.playerID).team
	if team == 0 {
		return nil, fail(http.StatusBadRequest, "TEAM_REQUIRED")
	}
	sequence, err := in.integer("sequence", 1, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	if sequence != rc.teamChargeSequences[c.playerID]+1 {
		return nil, fail(http.StatusConflict, "INVALID_SEQUENCE")
	}
	amount, ok := in.number("charge")
	if !ok || math.IsInf(amount, 0) || math.IsNaN(amount) || amount <= 0 || amount > 100_000 {
		return nil, fail(http.StatusBadRequest, "INVALID_CHARGE")
	}
	target := math.Min(1.0, rc.teamGaugeTargets[team]+amount/8_000.0)
	rc.teamChargeSequences[c.playerID] = sequence
	if target >= 1 {
		rc.teamGaugeTargets[team] = 0
	} else {
		rc.teamGaugeTargets[team] = target
	}
	rc.teamGaugeSequences[team]++
	event := obj{{"type", "team-gauge"}, {"roomId", r.id}, {"raceId", rc.id},
		{"team", team}, {"sequence", rc.teamGaugeSequences[team]}, {"target", jdouble(target)}}
	l.broadcastPeerEvent(r, c, event)
	return event, nil
}

func (l *Lobby) awardMotion(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.phase != "racing" && r.phase != "finished" {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_RUNNING")
	}
	motion, err := in.integer("motion", 3, 12)
	if err != nil {
		return nil, err
	}
	if !slices.Contains(awardMotions, motion) {
		return nil, fail(http.StatusBadRequest, "INVALID_MOTION")
	}
	event := obj{{"type", "award-motion"}, {"roomId", r.id}, {"raceId", r.race.id},
		{"playerId", c.playerID}, {"motion", motion}}
	l.broadcastPeerEvent(r, c, event)
	return event, nil
}

func (l *Lobby) broadcastPeerEvent(r *room, sender *Client, event obj) {
	payload := encode(event)
	for _, m := range r.members {
		if receiver := l.clients[m.playerID]; receiver != nil && receiver != sender {
			receiver.emit(payload)
		}
	}
}

func (l *Lobby) finalizeRace(roomID, raceID string) {
	r := l.rooms[roomID]
	if r == nil || r.race == nil || r.race.id != raceID || r.phase != "racing" {
		return
	}
	rc := r.race
	deadline := l.clock.Now()
	rc.finishDeadline = &deadline
	raceOverAt := deadline + 6_000
	rc.raceOverAt = &raceOverAt
	times := map[string]int{}
	for _, row := range rc.finishes {
		times[row.playerID] = row.elapsedMs
	}
	timeOf := func(id string) int {
		if t, ok := times[id]; ok {
			return t
		}
		return math.MaxInt32
	}
	order := slices.Clone(rc.loadedIDs)
	slices.SortStableFunc(order, func(a, b string) int { return cmp.Compare(timeOf(a), timeOf(b)) })
	rc.results = make([]resultRow, 0, len(order))
	rc.resultsSet = true
	for index, id := range order {
		row := resultRow{playerID: id, rank: index + 1}
		if t, ok := times[id]; ok {
			row.elapsedMs = &t
			if index < len(finishPoints) {
				row.points = finishPoints[index]
			}
		}
		rc.results = append(rc.results, row)
	}
	if r.mode == "team" {
		var scores [2]int
		for _, row := range rc.results {
			if m := r.member(row.playerID); m != nil && m.team != 0 {
				scores[m.team-1] = min(39, scores[m.team-1]+row.points)
			}
		}
		rc.teamScores = &scores
		rc.winningTeam = 1
		if scores[1] > scores[0] {
			rc.winningTeam = 2
		}
	}
	l.awardRanked(r)
	r.phase = "finished"
	r.revision++
	l.saveResults(r)
	l.broadcastRoom(r, nil)
}

func (l *Lobby) returnRoom(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.phase != "finished" {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_FINISHED")
	}
	if !slices.Contains(r.race.returnedIDs, c.playerID) {
		r.race.returnedIDs = append(r.race.returnedIDs, c.playerID)
	}
	closeRaceWhenReturned(r)
	r.revision++
	l.broadcastRoom(r, c)
	return roomReply(r), nil
}

func closeRaceWhenReturned(r *room) {
	if r.race == nil || r.phase != "finished" || !containsAll(r.race.returnedIDs, racers(r)) {
		return
	}
	r.phase = "open"
	r.race = nil
	r.raceError = ""
	for _, m := range r.members {
		m.ready = false
	}
}

// saveResults replaces the Java SQLite insert: the outcome document and the
// ranked rows (with account IDs) go to the data service as one settlement.
func (l *Lobby) saveResults(r *room) {
	rc := r.race
	snapshot := obj{{"roomId", r.id}, {"mode", r.mode}, {"gameplay", r.gameplay},
		{"race", rc.snapshot()}}
	results := make([]contract.RaceResult, 0, len(rc.results))
	for _, row := range rc.results {
		name, accountID := row.playerID, rc.rosterAccounts[row.playerID]
		if m := r.member(row.playerID); m != nil {
			name, accountID = m.name, m.accountID
		}
		var elapsed *int
		if row.elapsedMs != nil {
			value := *row.elapsedMs
			elapsed = &value
		}
		results = append(results, contract.RaceResult{PlayerID: row.playerID,
			AccountID: accountID, Name: name, Rank: row.rank, ElapsedMs: elapsed, Points: row.points})
	}
	granted := make([]contract.RaceReward, 0, len(rc.rewards))
	for _, reward := range rc.rewards {
		// Guests have no account ID: shown their reward, never credited.
		granted = append(granted, contract.RaceReward{PlayerID: reward.PlayerID,
			AccountID: rc.rosterAccounts[reward.PlayerID], Exp: int(reward.Exp), Lucci: int(reward.Lucci)})
	}
	l.recorder.SaveRace(contract.RaceSettlement{
		NodeID:     l.nodeID,
		RaceID:     rc.id,
		RoomID:     r.id,
		Mode:       r.mode,
		Gameplay:   r.gameplay,
		TrackID:    rc.trackID,
		Snapshot:   encode(snapshot),
		Results:    results,
		Rewards:    granted,
		ExpRate:    settledRate(rc.rates.Exp),
		LucciRate:  settledRate(rc.rates.Lucci),
		FinishedAt: l.wall().UnixMilli(),
	})
}

// settledRate is a rate race.rewards were shown with, for the settlement:
// the data service credits with it, so what players saw is what they get.
// Like rewards.ApplyRate, NaN, infinite and negative rates count as 0 (and
// stay encodable as JSON).
func settledRate(rate float64) *float64 {
	if math.IsNaN(rate) || math.IsInf(rate, 0) || rate < 0 {
		rate = 0
	}
	return &rate
}

// Reward rules on top of ECONOMY.md 2.1. They decide only the rewards:
// race.results, ranks and points stay exactly as Java computes them from
// the elapsed times the clients report.
const (
	// minRewardedRaceMs: a finish less than 10 s of server time after the
	// race start, and every racer of a roadblock race that ends within 10 s,
	// earns only the unfinished reward.
	minRewardedRaceMs = 10_000
	// finishToleranceMs: a finish counts only if the elapsedMs the client
	// reports is at most this much shorter than the race time the server
	// observed (finish received minus startAt), which allows for latency.
	finishToleranceMs = 3_000
)

// awardRanked computes the exp and lucci of a ranked race (every gameplay
// but roadblock) once its results are set. Racers are rewarded in result
// order; N counts distinct accounts (and every guest), so a second seat of
// one account earns nothing. A racer counts as finished only when the
// server's own timing backs the reported time (finishedForRewards);
// rewards rank those racers in finishing order, ahead of everyone else.
func (l *Lobby) awardRanked(r *room) {
	rc := r.race
	counted := firstSeatOfAccount(rc)
	var racers []rewards.Racer
	for _, row := range rc.results {
		if counted(row.playerID) {
			racers = append(racers, rewards.Racer{PlayerID: row.playerID,
				Finished: rc.finishedForRewards(row.playerID), Team: rc.rosterTeams[row.playerID]})
		}
	}
	rank := 1
	for _, finished := range []bool{true, false} {
		for i := range racers {
			if racers[i].Finished == finished {
				racers[i].Rank = rank
				rank++
			}
		}
	}
	l.setRewards(r, rewards.RaceInput{Racers: racers}, nil)
}

// awardRoadblock computes the rewards of a roadblock race, which has no
// ranks: its outcome decides them for the loaded racers (in loading order,
// one seat per account) once it has run racedMs. Every racer earns only
// the unfinished reward when it ended within minRewardedRaceMs, and racers
// who left the room during the race earn nothing; N still counts them.
func (l *Lobby) awardRoadblock(r *room, outcome rewards.Roadblock, racedMs int64) {
	rc := r.race
	counted := firstSeatOfAccount(rc)
	in := rewards.RaceInput{}
	for _, id := range rc.loadedIDs {
		if counted(id) {
			in.Racers = append(in.Racers, rewards.Racer{PlayerID: id, Team: rc.rosterTeams[id]})
		}
	}
	if racedMs >= minRewardedRaceMs {
		in.Roadblock = &outcome
	}
	l.setRewards(r, in, rc.leftIDs)
}

// setRewards completes in with the race's channel, mode and team bonus,
// keeps the base rewards for the settlement and the amounts shown, scaled
// by the current rates (fixed for this race's snapshots and sent with the
// settlement), and leaves out the racers in excluded.
func (l *Lobby) setRewards(r *room, in rewards.RaceInput, excluded []string) {
	rc := r.race
	in.Channel = rc.channelName
	in.Mode = r.mode
	in.WinningTeam = rewardedTeam(rc)
	// Base amounts for the settlement: the data service applies the rates
	// (rc.rates, sent with it) when it credits them.
	in.Rates = rewards.DefaultRates()
	rc.rewards = slices.DeleteFunc(rewards.RaceRewards(in), func(reward rewards.RacerReward) bool {
		return slices.Contains(excluded, reward.PlayerID)
	})
	// What the players are shown: the same rates, applied the same way, as
	// of the latest heartbeat.
	rc.rates = l.rates()
	rc.shownRewards = make([]rewards.RacerReward, len(rc.rewards))
	for i, reward := range rc.rewards {
		rc.shownRewards[i] = rewards.RacerReward{PlayerID: reward.PlayerID, Reward: rc.rates.Apply(reward.Reward)}
	}
}

// rewardedTeam is the team that earns the x1.2 team bonus. Product rule
// (ECONOMY.md 2.1, decided 2026-10-07): when the team scores are equal
// neither team gets the bonus, although race.winningTeam keeps the Java
// value (team 1 on a tie) for display.
func rewardedTeam(rc *race) int {
	if rc.teamScores != nil && rc.teamScores[0] == rc.teamScores[1] {
		return 0
	}
	return rc.winningTeam
}

// firstSeatOfAccount reports, called once per racer in reward order,
// whether the racer is rewarded: every guest, and the first seat of each
// account.
func firstSeatOfAccount(rc *race) func(playerID string) bool {
	seen := map[string]bool{}
	return func(playerID string) bool {
		account := rc.rosterAccounts[playerID]
		if account == "" {
			return true
		}
		if seen[account] {
			return false
		}
		seen[account] = true
		return true
	}
}

func (l *Lobby) resolveVote(r *room) {
	vote := r.kickVote
	if vote == nil {
		return
	}
	majority := len(vote.eligibleIDs)/2 + 1
	if len(vote.yesIDs) >= majority {
		if kicked := l.clients[vote.targetID]; kicked != nil {
			kicked.roomID = ""
			kicked.emit(encode(obj{{"type", "left"}, {"roomId", r.id}}))
		}
		r.removeMember(vote.targetID)
		if r.hostID == vote.targetID && len(r.members) > 0 {
			r.hostID = r.members[0].playerID
		}
		r.kickVote = nil
	} else if len(vote.noIDs) > len(vote.eligibleIDs)-majority {
		r.kickVote = nil
	}
}

func (l *Lobby) voteTimeout(roomID, voteID string) {
	r := l.rooms[roomID]
	if r == nil || r.kickVote == nil || r.kickVote.id != voteID {
		return
	}
	r.kickVote = nil
	r.revision++
	l.broadcastRoom(r, nil)
}

// saveRules replaces the Java room_rules upsert.
func (l *Lobby) saveRules(r *room) {
	rules := obj{
		{"name", r.name},
		{"channelName", r.channelName},
		{"mode", r.mode},
		{"capacity", r.capacity},
		{"speed", r.speed},
		{"gameplay", r.gameplay},
		{"resourceVersion", r.resourceVersion},
	}
	if r.trackID != "" {
		rules = append(rules, field{"trackId", r.trackID})
	}
	if r.randomTrackCode != nil {
		rules = append(rules, field{"randomTrackCode", *r.randomTrackCode})
	}
	l.recorder.SaveRules(contract.RoomRulesRequest{NodeID: l.nodeID, RoomID: r.id,
		Rules: encode(rules), UpdatedAt: l.wall().UnixMilli()})
}

func (l *Lobby) raceRoom(c *Client, in Request) (*room, error) {
	r, err := l.memberRoom(c, in)
	if err != nil {
		return nil, err
	}
	if r.race == nil {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_FOUND")
	}
	raceID, err := in.text("raceId", 1, 64)
	if err != nil {
		return nil, err
	}
	if r.race.id != raceID {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_FOUND")
	}
	if !r.race.inRoster(c.playerID) {
		return nil, fail(http.StatusForbidden, "NOT_RACE_PARTICIPANT")
	}
	return r, nil
}

// racers are the current members who started this race; late joiners are
// left out.
func racers(r *room) []string {
	var ids []string
	for _, m := range r.members {
		if r.race.inRoster(m.playerID) {
			ids = append(ids, m.playerID)
		}
	}
	return ids
}

func containsAll(values, required []string) bool {
	for _, id := range required {
		if !slices.Contains(values, id) {
			return false
		}
	}
	return true
}

func (l *Lobby) memberRoom(c *Client, in Request) (*room, error) {
	id, err := in.text("roomId", 1, 64)
	if err != nil {
		return nil, err
	}
	r, err := l.requireRoom(id)
	if err != nil {
		return nil, err
	}
	if id != c.roomID || r.member(c.playerID) == nil {
		return nil, fail(http.StatusForbidden, "NOT_ROOM_MEMBER")
	}
	return r, nil
}

func (l *Lobby) requireRoom(id string) (*room, error) {
	r := l.rooms[id]
	if r == nil {
		return nil, fail(http.StatusNotFound, "ROOM_NOT_FOUND")
	}
	return r, nil
}

func requireHost(r *room, c *Client) error {
	if r.hostID != c.playerID {
		return fail(http.StatusForbidden, "HOST_REQUIRED")
	}
	return nil
}

func preferredTeam(r *room) int {
	first, second := 0, 0
	for _, m := range r.members {
		switch m.team {
		case 1:
			first++
		case 2:
			second++
		}
	}
	if first <= second {
		return 1
	}
	return 2
}

// availableSlot returns the first open slot of team (0 for individual mode),
// or -1.
func availableSlot(r *room, team int) int {
	size := r.capacity
	if r.mode == "team" {
		size = r.capacity / 2
	}
	first := 0
	if team == 2 {
		first = 4
	}
	for slot := first; slot < first+size; slot++ {
		if slices.Contains(r.closedSlots, slot) {
			continue
		}
		occupied := false
		for _, m := range r.members {
			if m.slot == slot {
				occupied = true
				break
			}
		}
		if !occupied {
			return slot
		}
	}
	return -1
}

func (l *Lobby) broadcastRoom(r *room, except *Client) {
	payload := encode(roomReply(r))
	for _, m := range r.members {
		if recipient := l.clients[m.playerID]; recipient != nil && recipient != except {
			recipient.emitSnapshot(r.id, payload)
		}
	}
}

func roomReply(r *room) obj {
	return obj{{"type", "room"}, {"room", r.snapshot()}}
}

// schedule runs f under the lobby lock after d, like the Java single-thread
// timer whose callbacks are synchronized and re-check room, race and phase.
func (l *Lobby) schedule(d time.Duration, f func()) {
	l.clock.AfterFunc(d, func() {
		l.mu.Lock()
		defer l.mu.Unlock()
		if l.closed {
			return
		}
		defer func() {
			if p := recover(); p != nil {
				l.log.Error("room timer failed", "panic", p)
			}
		}()
		f()
	})
}

// newUUID returns a random (version 4) UUID in Java's lowercase form.
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return formatUUID(b[:])
}

func formatUUID(b []byte) string {
	var out [36]byte
	hex.Encode(out[0:8], b[0:4])
	out[8] = '-'
	hex.Encode(out[9:13], b[4:6])
	out[13] = '-'
	hex.Encode(out[14:18], b[6:8])
	out[18] = '-'
	hex.Encode(out[19:23], b[8:10])
	out[23] = '-'
	hex.Encode(out[24:36], b[10:16])
	return string(out[:])
}
