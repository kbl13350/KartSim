package lobby

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"slices"
	"time"

	"kartsim/internal/game/itemmode"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/ticket"
)

// The global lobby (GLOBAL_LOBBY.md). The data service runs a Lobby with
// Home: rooms are created and wait there, for players of every region; when
// the host starts, the lobby hands the room to a game node chosen for its
// members and gives each member a ticket for it. The node runs the same
// Lobby with RaceHost: the first racer's hello brings the room from the
// data service, the race runs as on any node, and once it is over (everyone
// back in the room, or the race cancelled) the node returns the room to the
// lobby, where the players find it again.

// Home is the data service side of the global lobby.
type Home interface {
	// Handoff picks a game node for a room whose host started the race and
	// signs every member's ticket for it. latency is each member's measured
	// round trip to the nodes (playerID → nodeID → ms). Called without the
	// lobby lock.
	Handoff(ctx context.Context, handoff contract.RoomHandoff, latency map[string]map[string]int) (HandoffPlan, error)
	// CityHost picks a node for a player entering the city (卡丁城) and
	// signs its ticket. Called without the lobby lock.
	CityHost(ctx context.Context, player CityPlayer) (NodeEntry, error)
}

// HandoffPlan is where a handed-off room races: the node and each member's
// ticket for it (playerID → ticket).
type HandoffPlan struct {
	Node    NodeEntry
	Tickets map[string]string
}

// NodeEntry is a game node a player is sent to, with its ticket.
type NodeEntry struct {
	NodeID string
	Name   string
	Origin *string // nil: the data service's origin
	Ticket string
}

// CityPlayer is a lobby player entering the city.
type CityPlayer struct {
	PlayerID, Name, AccountID string
	Guest                     bool
	Latency                   map[string]int
}

// RaceHost is the game node side of the global lobby.
type RaceHost interface {
	// Claim fetches the room a race ticket names. Called without the lobby
	// lock.
	Claim(ctx context.Context, handoffID string) (contract.RoomHandoff, error)
	// Return gives a room back to the lobby. Called with the lobby lock
	// held; it must not block (the node queues it in its outbox).
	Return(contract.RoomReturnRequest)
}

// awayRoom marks a lobby room that races on a game node.
type awayRoom struct {
	handoffID string
	node      NodeEntry // empty until the node is chosen
}

// Errors of the global lobby.
var (
	errRoomRacing = func() error { return fail(http.StatusConflict, "ROOM_RACING") }
	errNoRace     = func() error { return fail(http.StatusForbidden, "NOT_RACE_PARTICIPANT") }
)

// Race errors the lobby puts on a room that comes back without its race.
const (
	RaceErrorNoServer    = "NO_GAME_SERVER"
	RaceErrorUnreachable = "RACE_SERVER_UNREACHABLE"
	RaceErrorServerLost  = "RACE_SERVER_LOST"
)

// handoffTimeout bounds the call that picks a node (Home.Handoff).
const handoffTimeout = 10 * time.Second

var playerIDPattern = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// exportRoom is r without its race, for the other side.
func exportRoom(r *room) contract.RoomState {
	state := contract.RoomState{
		RoomID: r.id, Name: r.name, Password: r.password, Mode: r.mode, ChannelName: r.channelName,
		Gameplay: r.gameplay, ResourceVersion: r.resourceVersion, Capacity: r.capacity, Speed: r.speed,
		HostID: r.hostID, TrackID: r.trackID, RandomTrackCode: r.randomTrackCode, Revision: r.revision,
		RaceError: r.raceError, RandomTeam: r.randomTeam, ChatSequence: r.chatSequence,
		ClosedSlots: append([]int(nil), r.closedSlots...),
	}
	if len(r.chat) > 0 {
		state.Chat, _ = json.Marshal(r.chat)
	}
	for _, m := range r.members {
		state.Members = append(state.Members, contract.RoomMember{
			PlayerID: m.playerID, Name: m.name, AccountID: m.accountID, GM: m.gm, Slot: m.slot, Ready: m.ready,
			Team: m.team, Equipment: m.equipment, Initial: m.initial, Changing: m.changing})
	}
	return state
}

// importRoom builds a room from the other side's state.
func importRoom(state contract.RoomState) (*room, error) {
	if state.RoomID == "" || len(state.Members) == 0 {
		return nil, errors.New("room without ID or members")
	}
	r := newRoom(state.RoomID, state.Name, state.Password, state.Mode, state.ChannelName, state.Gameplay,
		state.ResourceVersion, state.Capacity, state.Speed, state.HostID)
	r.trackID, r.randomTrackCode, r.revision = state.TrackID, state.RandomTrackCode, state.Revision
	r.raceError, r.randomTeam, r.chatSequence = state.RaceError, state.RandomTeam, state.ChatSequence
	r.closedSlots = append([]int(nil), state.ClosedSlots...)
	if len(state.Chat) > 0 {
		var chat []json.RawMessage
		if err := json.Unmarshal(state.Chat, &chat); err != nil {
			return nil, err
		}
		for _, line := range chat {
			r.chat = append(r.chat, line)
		}
	}
	for _, m := range state.Members {
		r.members = append(r.members, &member{playerID: m.PlayerID, name: m.Name, accountID: m.AccountID, gm: m.GM,
			slot: m.Slot, ready: m.Ready, team: m.Team, equipment: m.Equipment, initial: m.Initial,
			changing: m.Changing})
	}
	if r.member(r.hostID) == nil {
		r.hostID = r.members[0].playerID
	}
	return r, nil
}

// ---- the lobby (Home) ----

// handOff replaces the race start of a lobby room: the room goes away to
// a node chosen by Home, and each member gets its ticket (race-host).
func (l *Lobby) handOff(c *Client, r *room, check *ownershipCheck) (obj, error) {
	handoffID := newUUID()
	r.kickVote = nil
	r.raceError = ""
	r.revision++
	// The node goes on from this revision, so its snapshots supersede the
	// start reply.
	handoff := contract.RoomHandoff{HandoffID: handoffID, Room: exportRoom(r)}
	if check != nil && len(check.changers) > 0 && r.gameplay == "item" {
		handoff.Changers = map[string]contract.Changers{}
		for account, changers := range check.changers {
			handoff.Changers[account] = contract.Changers{Slot: changers.Slot, Item: changers.Item}
		}
	}
	latency := map[string]map[string]int{}
	for _, m := range r.members {
		if session := l.clients[m.playerID]; session != nil && session.latency != nil {
			latency[m.playerID] = session.latency
		}
	}
	r.away = &awayRoom{handoffID: handoffID}
	reply := roomReply(r)
	roomID := r.id
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), handoffTimeout)
		defer cancel()
		plan, err := l.home.Handoff(ctx, handoff, latency)
		l.mu.Lock()
		defer l.mu.Unlock()
		l.handedOff(roomID, handoffID, plan, err)
	}()
	return reply, nil
}

// handedOff sends the members of a room that is away their tickets, or
// brings the room back when no node could take it.
func (l *Lobby) handedOff(roomID, handoffID string, plan HandoffPlan, err error) {
	r := l.rooms[roomID]
	if r == nil || r.away == nil || r.away.handoffID != handoffID {
		return
	}
	if err != nil {
		code := RaceErrorNoServer
		if rejected, ok := apierr.As(err); ok {
			code = rejected.Code
		} else {
			l.log.Warn("room handoff failed", "room", roomID, "error", err)
		}
		l.cameHome(r, nil, code)
		return
	}
	r.away.node = plan.Node
	for _, m := range r.members {
		session := l.clients[m.playerID]
		token := plan.Tickets[m.playerID]
		if session == nil || token == "" {
			continue
		}
		event := obj{{"type", "race-host"}, {"roomId", r.id}, {"nodeId", plan.Node.NodeID},
			{"name", plan.Node.Name}, {"origin", plan.Node.Origin}, {"ticket", token}}
		session.emit(encode(event))
	}
}

// ReturnHome brings back the room handed off as handoffID: with the node's
// state of it (nil: every racer left, or the race never ran there, with
// raceError saying why). The members still connected to the lobby and
// still in the room get it back.
func (l *Lobby) ReturnHome(handoffID string, state *contract.RoomState, raceError string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	for _, r := range l.rooms {
		if r.away != nil && r.away.handoffID == handoffID {
			if state != nil && raceError != "" {
				state.RaceError = raceError
			}
			l.cameHome(r, state, raceError)
			return
		}
	}
}

// cameHome reopens an away room in the lobby. The lobby keeps its own
// member list (players who left the race left the lobby room too); from
// the node it takes the host, chat, race error and each member's seat,
// team and ready mark after the race. Its revision stays ahead of every
// snapshot the players saw.
func (l *Lobby) cameHome(r *room, state *contract.RoomState, raceError string) {
	r.away = nil
	r.raceError = raceError
	connected := r.members[:0]
	for _, m := range r.members {
		if session := l.clients[m.playerID]; session != nil && session.roomID == r.id {
			connected = append(connected, m)
		}
	}
	r.members = connected
	if state != nil {
		if back, err := importRoom(*state); err == nil {
			for _, m := range r.members {
				m.ready = false
				if raced := back.member(m.playerID); raced != nil {
					m.slot, m.team, m.ready, m.changing = raced.slot, raced.team, raced.ready, raced.changing
				}
			}
			reseat(r)
			if r.member(back.hostID) != nil {
				r.hostID = back.hostID
			}
			r.chat, r.chatSequence = back.chat, back.chatSequence
			r.raceError = back.raceError
			r.revision = max(r.revision, back.revision)
		}
	}
	if len(r.members) == 0 {
		l.removeRoom(r)
		return
	}
	if r.member(r.hostID) == nil {
		r.hostID = r.members[0].playerID
	}
	r.revision++
	l.broadcastRoom(r, nil)
}

// reseat gives a free seat to members whose seat another member took
// (a member the node no longer had kept its seat from before the race).
func reseat(r *room) {
	taken := map[int]bool{}
	for _, m := range r.members {
		if taken[m.slot] {
			if slot := freeSlot(r, m.team, taken); slot >= 0 {
				m.slot = slot
			}
		}
		taken[m.slot] = true
	}
}

// freeSlot is availableSlot over the seats in taken.
func freeSlot(r *room, team int, taken map[int]bool) int {
	size, first := r.capacity, 0
	if r.mode == "team" {
		size = r.capacity / 2
		if team == 2 {
			first = 4
		}
	}
	for slot := first; slot < first+size; slot++ {
		if !taken[slot] && !slices.Contains(r.closedSlots, slot) {
			return slot
		}
	}
	return -1
}

// AwayRooms lists the rooms racing on a node (handoff → node ID; "" while
// the node is being chosen), for the lobby's watchdog.
func (l *Lobby) AwayRooms() map[string]string {
	l.mu.Lock()
	defer l.mu.Unlock()
	away := map[string]string{}
	for _, r := range l.rooms {
		if r.away != nil {
			away[r.away.handoffID] = r.away.node.NodeID
		}
	}
	return away
}

// nodeLatency stores a lobby player's measured round trips to the game
// nodes (node-latency), which choose where its rooms race.
func (l *Lobby) nodeLatency(c *Client, in Request) (obj, error) {
	raw, ok := in.get("latency")
	var latency map[string]int
	if !ok || json.Unmarshal(raw, &latency) != nil || len(latency) > 64 {
		return nil, fail(http.StatusBadRequest, "INVALID_LATENCY")
	}
	for node, ms := range latency {
		if !playerIDPattern.MatchString(node) || ms < 0 || ms > 60_000 {
			return nil, fail(http.StatusBadRequest, "INVALID_LATENCY")
		}
	}
	c.latency = latency
	return obj{{"type", "ok"}}, nil
}

// cityHost sends a lobby player to the node of its city line (city-host).
// It runs without the lobby lock.
func (l *Lobby) cityHost(ctx context.Context, c *Client) (Reply, error) {
	l.mu.Lock()
	if c.roomID != "" {
		l.mu.Unlock()
		return Reply{}, fail(http.StatusBadRequest, "IN_ROOM")
	}
	player := CityPlayer{PlayerID: c.playerID, Name: c.name, AccountID: c.accountID, Guest: c.accountID == "",
		Latency: c.latency}
	l.mu.Unlock()
	entry, err := l.home.CityHost(ctx, player)
	if err != nil {
		if _, ok := apierr.As(err); !ok {
			l.log.Warn("city host failed", "error", err)
			err = fail(http.StatusServiceUnavailable, RaceErrorNoServer)
		}
		return Reply{}, err
	}
	return Reply{body: obj{{"type", "city-host"}, {"nodeId", entry.NodeID}, {"name", entry.Name},
		{"origin", entry.Origin}, {"ticket", entry.Ticket}}}, nil
}

// ---- the game node (RaceHost) ----

// claimCall is a room claim in flight: the racers saying hello at the same
// time wait for one call.
type claimCall struct {
	done chan struct{}
	err  error
}

// claimTimeout bounds the call that fetches a handed-off room.
const claimTimeout = 10 * time.Second

// ensureHandoff makes sure the room handed off as handoffID is on this
// node, fetching it (once) from the data service. Called without the lock.
func (l *Lobby) ensureHandoff(ctx context.Context, handoffID string) error {
	l.mu.Lock()
	if _, ok := l.handoffs[handoffID]; ok {
		l.mu.Unlock()
		return nil
	}
	call, waiting := l.claiming[handoffID]
	if !waiting {
		call = &claimCall{done: make(chan struct{})}
		l.claiming[handoffID] = call
	}
	l.mu.Unlock()
	if waiting {
		select {
		case <-call.done:
			return call.err
		case <-ctx.Done():
			return fail(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
		}
	}
	// The racer's hello may give up; the room is everyone's.
	claimCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), claimTimeout)
	handoff, err := l.raceHost.Claim(claimCtx, handoffID)
	cancel()
	l.mu.Lock()
	defer l.mu.Unlock()
	if err == nil && l.closed {
		err = fail(http.StatusServiceUnavailable, "SERVER_SHUTTING_DOWN")
	}
	if err == nil {
		err = l.importHandoff(handoff)
	}
	if err != nil {
		if _, ok := apierr.As(err); !ok {
			l.log.Warn("room claim failed", "handoff", handoffID, "error", err)
			err = fail(http.StatusServiceUnavailable, "DATA_SERVICE_UNAVAILABLE")
		}
	}
	call.err = err
	delete(l.claiming, handoffID)
	close(call.done)
	return err
}

// importHandoff puts a handed-off room on the node and starts its race at
// once; its racers connect while it loads.
func (l *Lobby) importHandoff(handoff contract.RoomHandoff) error {
	if _, taken := l.rooms[handoff.Room.RoomID]; taken {
		return fail(http.StatusConflict, "ROOM_EXISTS")
	}
	r, err := importRoom(handoff.Room)
	if err != nil {
		return fail(http.StatusBadGateway, "INVALID_HANDOFF")
	}
	if err := validateBraveStart(r); err != nil {
		return fail(http.StatusBadGateway, "INVALID_HANDOFF")
	}
	r.handoffID = handoff.HandoffID
	r.raceError = ""
	l.rooms[r.id] = r
	l.order = append(l.order, r)
	l.handoffs[handoff.HandoffID] = r.id
	check := &ownershipCheck{changers: map[string]itemmode.Changers{}}
	for account, changers := range handoff.Changers {
		check.changers[account] = itemmode.Changers{Slot: max(changers.Slot, itemmode.Infinite),
			Item: max(changers.Item, itemmode.Infinite)}
	}
	l.launchRace(r, nil, check)
	return nil
}

// attachRacer seats a racer's session (a race ticket's hello) in its
// handed-off room and returns the room snapshot it starts from.
func (l *Lobby) attachRacer(c *Client, handoffID string) ([]byte, error) {
	r := l.rooms[l.handoffs[handoffID]]
	if r == nil || r.handoffID != handoffID {
		return nil, fail(http.StatusNotFound, "ROOM_NOT_FOUND")
	}
	m := r.member(c.playerID)
	if m == nil {
		return nil, errNoRace()
	}
	c.roomID = r.id
	c.equipment = m.equipment
	c.initial = m.initial
	return encode(roomReply(r)), nil
}

// sendHome returns a handed-off room to the lobby: its race is over, it was
// cancelled, or every racer left (removed). The racers' sessions end.
func (l *Lobby) sendHome(r *room, removed bool) {
	handoffID := r.handoffID
	r.handoffID = ""
	delete(l.handoffs, handoffID)
	request := contract.RoomReturnRequest{NodeID: l.nodeID, HandoffID: handoffID}
	if !removed {
		state := exportRoom(r)
		request.Room = &state
		l.removeRoom(r)
	}
	for _, m := range r.members {
		session := l.clients[m.playerID]
		if session == nil || session.roomID != r.id {
			continue
		}
		session.roomID = ""
		session.emit(encode(obj{{"type", "room-home"}, {"roomId", r.id}}))
		if closer, ok := session.sink.(Closer); ok {
			// Not at once: the command that ended the race (the last
			// return-room) still gets its reply.
			time.AfterFunc(roomHomeCloseDelay, func() { closer.Close(RoomHomeCloseCode, RoomHomeCloseReason) })
		}
	}
	l.raceHost.Return(request)
}

// The close of a racer's session once its room went back to the lobby.
const (
	RoomHomeCloseCode   = 1000
	RoomHomeCloseReason = "room home"
	roomHomeCloseDelay  = 2 * time.Second
)

// truncateRunes cuts s to at most n runes.
func truncateRunes(s string, n int) string {
	runes := []rune(s)
	if len(runes) <= n {
		return s
	}
	return string(runes[:n])
}

// lobbyTicket reports whether claims come from the global lobby.
func lobbyTicket(claims ticket.Claims) bool { return claims.Use != "" }
