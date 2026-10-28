package api

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"kartsim/internal/data/cache"
	"kartsim/internal/game/admission"
	"kartsim/internal/game/itemmode"
	"kartsim/internal/game/lobby"
	"kartsim/internal/game/ws"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/nodekey"
	"kartsim/internal/shared/ticket"
)

// The global lobby (GLOBAL_LOBBY.md): rooms are created and wait on the
// data service, for every region at once, and race on a game node chosen
// when the host starts. The lobby is the game node's Lobby in Home mode,
// served at /multiplayer/lobby/ws; its sessions hold their nicknames and
// accounts like a node's ("lobby" in the node registry).

const (
	// lobbyHeartbeat refreshes the lobby's registration and claims.
	lobbyHeartbeat = 5 * time.Second
	// unclaimedHandoff is how long a handed-off room may wait for its node
	// to fetch it (the first racer's hello) before it comes back.
	unclaimedHandoff = 30 * time.Second
	// longestRace brings back a room whose node never returned it.
	longestRace = 45 * time.Minute
	// lobbyMaxPlayers is how many players the lobby takes.
	lobbyMaxPlayers = 10_000
)

var (
	errNoGameServer  = apierr.New(http.StatusServiceUnavailable, lobby.RaceErrorNoServer)
	errHandoffAbsent = apierr.New(http.StatusNotFound, "ROOM_NOT_FOUND")
)

// lobbyHome is the data service's global lobby.
type lobbyHome struct {
	a              *API
	lobby          *lobby.Lobby
	sockets        *ws.Server
	startedAt      int64
	disabledTracks atomic.Pointer[map[string]bool]

	mu       sync.Mutex
	handoffs map[string]*handoffRecord
	// choices are the latest node picks, newest last (the console's 最近分配).
	choices []nodeChoice
	// cityNode is the node the lobby last sent a player to the city on.
	cityNode string
}

// handoffRecord is a room handed to a node, until it comes back.
type handoffRecord struct {
	handoff   contract.RoomHandoff
	nodeID    string
	createdAt time.Time
	claimed   bool
}

func newLobbyHome(a *API, compression bool) *lobbyHome {
	h := &lobbyHome{a: a, startedAt: a.nowMillis(), handoffs: map[string]*handoffRecord{}}
	h.refreshTrackSettings(context.Background())
	h.lobby = lobby.New(lobby.Options{
		NodeID:      contract.LobbyNodeID,
		Presence:    lobbyPresence{a},
		Tickets:     admission.New([]byte(nodekey.TicketKey(a.secret, contract.LobbyNodeID)), contract.LobbyNodeID, a.dataNode),
		Recorder:    lobbyRecorder{a},
		Ownership:   lobbyOwnership{a},
		AllowGuests: a.allowGuests,
		MaxPlayers:  lobbyMaxPlayers,
		MaxRooms:    lobbyMaxPlayers / 2,
		Logger:      a.log.With("service", "lobby"),
		Home:        h,
		// 地图工坊 maps with item boxes may be raced in item rooms (MAPS.md).
		CustomItemTrack: a.itemMaps.has,
		TrackEnabled:    h.trackEnabled,
	})
	h.sockets = ws.NewServer(h.lobby, a.network, ws.Options{
		MaxConnections:     lobbyMaxPlayers + 500,
		HelloTimeout:       15 * time.Second,
		DisableCompression: !compression,
		Logger:             a.log.With("service", "lobby"),
	})
	return h
}

// Handoff picks the node for a room and signs its members' tickets.
func (h *lobbyHome) Handoff(ctx context.Context, handoff contract.RoomHandoff,
	latency map[string]map[string]int) (lobby.HandoffPlan, error) {
	choice := nodeChoice{Kind: choiceRace, RoomID: handoff.Room.RoomID, RoomName: handoff.Room.Name}
	reports := make([]map[string]int, len(handoff.Room.Members))
	for i, m := range handoff.Room.Members {
		reports[i] = latency[m.PlayerID]
		choice.Players = append(choice.Players, choicePlayer{Name: m.Name, Latency: reports[i]})
	}
	node, err := h.pickNode(ctx, &choice, reports)
	if err != nil {
		h.a.log.Warn("no game node for a room", "room", handoff.Room.RoomID, "error", err,
			"latency", choice.logLatency(), "scores", choice.logScores())
		return lobby.HandoffPlan{}, err
	}
	plan := lobby.HandoffPlan{Node: h.entry(node), Tickets: map[string]string{}}
	for _, m := range handoff.Room.Members {
		plan.Tickets[m.PlayerID] = h.sign(node, ticket.Claims{Guest: m.AccountID == "", AccountID: m.AccountID,
			Nickname: m.Name, GM: m.GM, PlayerID: m.PlayerID, Use: ticket.UseRace, Handoff: handoff.HandoffID})
	}
	h.mu.Lock()
	h.handoffs[handoff.HandoffID] = &handoffRecord{handoff: handoff, nodeID: node.NodeID, createdAt: h.a.now()}
	h.mu.Unlock()
	h.a.log.Info("room handed to a game node", "room", handoff.Room.RoomID, "handoff", handoff.HandoffID,
		"node", node.NodeID, "racers", len(handoff.Room.Members), "latency", choice.logLatency(),
		"scores", choice.logScores())
	return plan, nil
}

// CityHost sends a player to the 卡丁城 node everyone goes to
// (pickCityNode).
func (h *lobbyHome) CityHost(ctx context.Context, player lobby.CityPlayer) (lobby.NodeEntry, error) {
	choice := nodeChoice{Kind: choiceCity, Players: []choicePlayer{{Name: player.Name, Latency: player.Latency}}}
	node, err := h.pickCityNode(ctx, &choice, player.Latency)
	if err != nil {
		h.a.log.Warn("no game node for the city", "player", player.Name, "error", err,
			"setting", choice.Setting, "settingExcluded", choice.SettingExcluded)
		return lobby.NodeEntry{}, err
	}
	entry := h.entry(node)
	entry.Ticket = h.sign(node, ticket.Claims{Guest: player.Guest, AccountID: player.AccountID,
		Nickname: player.Name, PlayerID: player.PlayerID, Use: ticket.UseCity})
	return entry, nil
}

func (h *lobbyHome) entry(node cache.Node) lobby.NodeEntry {
	return lobby.NodeEntry{NodeID: node.NodeID, Name: node.Name, Origin: nodeOrigin(node)}
}

func (h *lobbyHome) sign(node cache.Node, claims ticket.Claims) string {
	claims.NodeID, claims.DataNode = node.NodeID, h.a.dataNode
	signed, _ := ticket.Sign(h.a.ticketKey(node), claims, h.a.now())
	return signed
}

// pickNode chooses the game node for players (their latency reports, see
// pickNode) from the registry and keeps the record of the choice.
func (h *lobbyHome) pickNode(ctx context.Context, choice *nodeChoice, latency []map[string]int) (cache.Node, error) {
	if h.a.cluster == nil {
		return cache.Node{}, errNoGameServer
	}
	nodes, err := h.a.cluster.Nodes(ctx)
	if err != nil {
		return cache.Node{}, errServiceUnavailable
	}
	pick := pickNode(nodes, latency)
	choice.At = h.a.nowMillis()
	choice.describe(nodes, pick)
	h.remember(*choice)
	if !pick.found {
		return cache.Node{}, errNoGameServer
	}
	return pick.node, nil
}

// pickCityNode chooses the city node for a player (its latency report)
// from the registry, the console's setting and the city players of each
// node, and keeps the record of the choice.
func (h *lobbyHome) pickCityNode(ctx context.Context, choice *nodeChoice, latency map[string]int) (cache.Node, error) {
	if h.a.cluster == nil {
		return cache.Node{}, errNoGameServer
	}
	nodes, err := h.a.cluster.Nodes(ctx)
	if err != nil {
		return cache.Node{}, errServiceUnavailable
	}
	setting := h.citySetting(ctx)
	h.mu.Lock()
	last := h.cityNode
	h.mu.Unlock()
	pick := pickCityNode(nodes, latency, setting, last)
	choice.At = h.a.nowMillis()
	choice.describe(nodes, pick.nodePick)
	choice.describeCity(nodes, pick, setting)
	if pick.found {
		h.mu.Lock()
		h.cityNode = pick.node.NodeID
		h.mu.Unlock()
	}
	h.remember(*choice)
	if !pick.found {
		return cache.Node{}, errNoGameServer
	}
	return pick.node, nil
}

// citySetting is the console's city node ("" automatic, also when MySQL
// cannot say: the city stays open).
func (h *lobbyHome) citySetting(ctx context.Context) string {
	if h.a.store == nil {
		return ""
	}
	setting, err := h.a.store.CityServer(ctx)
	if err != nil {
		h.a.log.Warn("city server setting unavailable; choosing automatically", "error", err)
		return ""
	}
	return setting.NodeID
}

// cityNext is where a player without a latency report entering the city
// now would go, for the console; nothing is recorded.
func (h *lobbyHome) cityNext(nodes []cache.Node, setting string) cityPick {
	h.mu.Lock()
	last := h.cityNode
	h.mu.Unlock()
	return pickCityNode(nodes, nil, setting, last)
}

// claim gives a node the room it was handed (the first racer's hello).
func (h *lobbyHome) claim(nodeID, handoffID string) (contract.RoomHandoff, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	record := h.handoffs[handoffID]
	if record == nil {
		return contract.RoomHandoff{}, errHandoffAbsent
	}
	if record.nodeID != nodeID {
		return contract.RoomHandoff{}, errNodeMismatch
	}
	record.claimed = true
	return record.handoff, nil
}

// returned takes a room back from its node.
func (h *lobbyHome) returned(nodeID, handoffID string, room *contract.RoomState) error {
	h.mu.Lock()
	record := h.handoffs[handoffID]
	if record != nil && record.nodeID != nodeID {
		h.mu.Unlock()
		return errNodeMismatch
	}
	delete(h.handoffs, handoffID)
	h.mu.Unlock()
	if record == nil {
		return nil // already back (timed out), or the data service restarted
	}
	h.lobby.ReturnHome(handoffID, room, "")
	return nil
}

// watch brings back the rooms whose race cannot go on: never fetched by
// their node, their node gone, or racing far too long.
func (h *lobbyHome) watch(ctx context.Context) {
	away := h.lobby.AwayRooms()
	var live map[string]bool
	if h.a.cluster != nil {
		if nodes, err := h.a.cluster.Nodes(ctx); err == nil {
			live = map[string]bool{}
			for _, node := range nodes {
				live[node.NodeID] = true
			}
		}
	}
	now := h.a.now()
	type back struct{ handoffID, raceError string }
	var comeBack []back
	h.mu.Lock()
	for handoffID, nodeID := range away {
		record := h.handoffs[handoffID]
		switch {
		case nodeID == "":
			// Still choosing the node (or the choice failed; the lobby handles it).
		case record == nil:
			comeBack = append(comeBack, back{handoffID, lobby.RaceErrorServerLost})
		case !record.claimed && now.Sub(record.createdAt) > unclaimedHandoff:
			comeBack = append(comeBack, back{handoffID, lobby.RaceErrorUnreachable})
		case live != nil && !live[nodeID]:
			comeBack = append(comeBack, back{handoffID, lobby.RaceErrorServerLost})
		case now.Sub(record.createdAt) > longestRace:
			comeBack = append(comeBack, back{handoffID, lobby.RaceErrorServerLost})
		}
	}
	for _, b := range comeBack {
		delete(h.handoffs, b.handoffID)
	}
	for handoffID, record := range h.handoffs {
		if _, stillAway := away[handoffID]; !stillAway && now.Sub(record.createdAt) > time.Hour {
			delete(h.handoffs, handoffID) // its room was given up in the lobby
		}
	}
	h.mu.Unlock()
	for _, b := range comeBack {
		h.a.log.Warn("room came back from its game node without the race", "handoff", b.handoffID, "why", b.raceError)
		h.lobby.ReturnHome(b.handoffID, nil, b.raceError)
	}
}

// heartbeat registers the lobby in the node registry like a game node, so
// its sessions' nickname and account claims stay held, and evicts the
// sessions whose claims went elsewhere (a new login, a kick, a ban).
func (h *lobbyHome) heartbeat(ctx context.Context) {
	h.refreshTrackSettings(ctx)
	if h.a.cluster == nil {
		return
	}
	players, rooms := h.lobby.Online()
	result, err := h.a.cluster.Heartbeat(ctx, cache.Node{
		NodeID: contract.LobbyNodeID, Name: "大厅", Lobby: true, Capacity: lobbyMaxPlayers, Rooms: rooms,
		Players: len(players), StartedAt: h.startedAt, ProtocolVersion: contract.ProtocolVersion,
		SeenAt: h.a.nowMillis(),
	}, players)
	if err != nil {
		h.a.log.Warn("lobby heartbeat failed", "error", err)
		return
	}
	if len(result.Conflicts) > 0 {
		h.lobby.Evict(result.Conflicts)
	}
}

// run keeps the lobby registered and watches its away rooms until ctx ends.
func (h *lobbyHome) run(ctx context.Context) {
	ticker := time.NewTicker(lobbyHeartbeat)
	defer ticker.Stop()
	refreshed := time.Time{}
	for {
		h.heartbeat(ctx)
		h.watch(ctx)
		// The item maps follow publishes at once; this catches other writers.
		if time.Since(refreshed) > time.Minute {
			h.a.itemMaps.refresh(ctx, h.a.store)
			refreshed = time.Now()
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// shutdown closes the lobby's sockets and leaves the registry (without
// Redis the registration and claims expire on their own).
func (h *lobbyHome) shutdown(ctx context.Context) error {
	h.lobby.Close()
	err := h.sockets.Shutdown(ctx)
	if h.a.cluster != nil {
		if leaveErr := h.a.cluster.Leave(ctx, contract.LobbyNodeID); leaveErr != nil {
			h.a.log.Warn("lobby left the registry without Redis; its claims expire on their own", "error", leaveErr)
		}
	}
	return err
}

// lobbyPresence claims the lobby sessions' names and accounts in process.
type lobbyPresence struct{ a *API }

func (p lobbyPresence) Claim(ctx context.Context, request contract.PresenceClaimRequest) error {
	if p.a.cluster == nil {
		return errServiceUnavailable
	}
	return p.a.claimPresence(ctx, request)
}

func (p lobbyPresence) Release(request contract.PresenceReleaseRequest) {
	if p.a.cluster == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := p.a.cluster.ReleasePresence(ctx, cache.Presence{NodeID: request.NodeID,
			PlayerID: request.PlayerID, Name: request.Name, AccountID: request.AccountID}); err != nil {
			p.a.log.Warn("lobby presence release failed; it expires on its own", "error", err)
			return
		}
		if request.AccountID != "" {
			p.a.hub.GameChanged(request.AccountID)
		}
	}()
}

// lobbyRecorder stores the lobby rooms' rules (room_rules) in the
// background; lobby rooms never race here.
type lobbyRecorder struct{ a *API }

func (r lobbyRecorder) SaveRules(request contract.RoomRulesRequest) {
	if r.a.store == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		rules, ok := compactObject(request.Rules)
		if !ok {
			return
		}
		if err := r.a.store.SaveRoomRules(ctx, request.RoomID, rules, request.UpdatedAt); err != nil {
			r.a.log.Warn("lobby room rules not stored", "room", request.RoomID, "error", err)
			return
		}
		r.a.cache.BumpHistory(ctx)
	}()
}

func (r lobbyRecorder) SaveRace(contract.RaceSettlement)       {}
func (r lobbyRecorder) SaveAntiCheat(contract.AntiCheatReport) {}

// lobbyOwnership checks equipment ownership in process (the game nodes'
// PathEquipmentVerify).
type lobbyOwnership struct{ a *API }

func (o lobbyOwnership) VerifyEquipment(ctx context.Context, accountID string,
	equipment json.RawMessage) (lobby.OwnershipAnswer, error) {
	doc, err := parseEquipment(equipment)
	if err != nil {
		return lobby.OwnershipAnswer{}, nil
	}
	items, err := doc.items()
	if err != nil {
		return lobby.OwnershipAnswer{}, nil
	}
	missing, validUntil, err := o.a.missingItems(ctx, accountID, items)
	if err != nil || len(missing) > 0 {
		return lobby.OwnershipAnswer{}, err
	}
	cards, err := o.a.store.Changers(ctx, accountID, o.a.nowMillis())
	if err != nil {
		return lobby.OwnershipAnswer{}, err
	}
	answer := lobby.OwnershipAnswer{Owned: true,
		Changers: &itemmode.Changers{Slot: max(cards.Slot, itemmode.Infinite), Item: max(cards.Item, itemmode.Infinite)}}
	if validUntil != nil {
		answer.ValidUntil = time.UnixMilli(*validUntil)
	}
	return answer, nil
}

// ---- HTTP ----

// lobbyTicket signs a one-time ticket for the global lobby's socket.
func (a *API) lobbyTicket(w http.ResponseWriter, r *http.Request) error {
	claims, err := a.ticketClaims(r)
	if err != nil {
		return err
	}
	claims.NodeID, claims.DataNode = contract.LobbyNodeID, a.dataNode
	signed, issued := ticket.Sign([]byte(nodekey.TicketKey(a.secret, contract.LobbyNodeID)), claims, a.now())
	return writeJSON(w, http.StatusOK, contract.TicketResponse{Ticket: signed, NodeID: contract.LobbyNodeID,
		DataNode: a.dataNode, ExpiresAt: issued.ExpiresAt})
}

// lobbyOffer answers the browsers' WebRTC attempt: the lobby speaks
// WebSocket only.
func (a *API) lobbyOffer(w http.ResponseWriter, _ *http.Request) error {
	return apierr.New(http.StatusNotImplemented, "USE_WEBSOCKET")
}

func (a *API) claimRoom(w http.ResponseWriter, r *http.Request) error {
	var request contract.RoomClaimRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if err := a.callerNode(r, request.NodeID); err != nil {
		return err
	}
	handoff, err := a.lobby.claim(request.NodeID, request.HandoffID)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, handoff)
}

func (a *API) returnRoom(w http.ResponseWriter, r *http.Request) error {
	var request contract.RoomReturnRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if err := a.callerNode(r, request.NodeID); err != nil {
		return err
	}
	if !validASCIIID(request.HandoffID, 64) {
		return errInvalidRoomRules
	}
	if err := a.lobby.returned(request.NodeID, request.HandoffID, request.Room); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, contract.OK{OK: true})
}

// RunLobby keeps the global lobby registered until ctx ends.
func (a *API) RunLobby(ctx context.Context) { a.lobby.run(ctx) }

// ShutdownLobby closes the lobby's sockets (http.Server.Shutdown does not
// track upgraded connections).
func (a *API) ShutdownLobby(ctx context.Context) error { return a.lobby.shutdown(ctx) }
