// Package app wires a game node together: the lobby, the WebSocket
// endpoint, ticket admission, the data service agent (heartbeat and
// presence) and the settlement outbox.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"kartsim/internal/game/admission"
	"kartsim/internal/game/cluster"
	"kartsim/internal/game/config"
	"kartsim/internal/game/itemmode"
	"kartsim/internal/game/lobby"
	"kartsim/internal/game/outbox"
	"kartsim/internal/game/ws"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
)

// Options are test hooks; the zero value is production behaviour.
type Options struct {
	Outbox outbox.Options
	WS     ws.Options
	Clock  lobby.Clock
}

// App is one game node.
type App struct {
	cfg     config.Config
	log     *slog.Logger
	data    *cluster.DataClient
	agent   *cluster.Agent
	outbox  *outbox.Outbox
	lobby   *lobby.Lobby
	ws      *ws.Server
	memory  *memoryGuard
	handler http.Handler

	agentCancel context.CancelFunc
	agentDone   chan struct{}

	shutdownOnce sync.Once
	shutdownErr  error
}

// New builds a node; nothing runs until Start.
func New(cfg config.Config, log *slog.Logger, opts Options) (*App, error) {
	items, err := itemmode.Default()
	if err != nil {
		return nil, fmt.Errorf("item race data: %w", err)
	}
	data := cluster.NewDataClient(cfg.DataInternalURL, cfg.Secret)
	if opts.Outbox.Logger == nil {
		opts.Outbox.Logger = log
	}
	box, err := outbox.Open(cfg.OutboxDir, data, opts.Outbox)
	if err != nil {
		return nil, err
	}
	agent := cluster.NewAgent(data, cluster.NodeInfo{
		NodeID:   cfg.NodeID,
		Name:     cfg.NodeName,
		Origin:   cfg.PublicOrigin,
		Capacity: cfg.MaxPlayers,
		DataNode: cfg.DataNodeID,
	}, cfg.HeartbeatInterval, log)
	memory := newMemoryGuard(cfg.MemoryLimitMB)
	rooms := lobby.New(lobby.Options{
		NodeID:      cfg.NodeID,
		Clock:       opts.Clock,
		Presence:    agent,
		Tickets:     admission.New(cfg.Secret, cfg.NodeID, cfg.DataNodeID),
		Recorder:    recorder{box: box, log: log},
		Ownership:   cluster.NewOwnership(data),
		AllowGuests: cfg.AllowGuests,
		MaxPlayers:  cfg.MaxPlayers,
		MaxRooms:    cfg.MaxRooms,
		Busy:        memory.busy,
		Rates:       agent.Rates,
		Logger:      log,
		ItemMode:    items,
		// A development switch (KART_ITEM_TEST_GRANTS): cube requests may
		// name their item.
		ItemTestGrants: cfg.ItemTestGrants,
		// A playtest switch (KART_ITEM_CHANGERS=infinite): unlimited changers.
		ItemChangersInfinite: cfg.ItemChangersInfinite,
	})
	if cfg.ItemTestGrants {
		log.Warn("item test grants are on (KART_ITEM_TEST_GRANTS): item race clients may choose the items " +
			"their cubes grant; never enable this on a public deployment")
	}
	if cfg.ItemChangersInfinite {
		log.Warn("item changers are unlimited for every racer (KART_ITEM_CHANGERS=infinite)")
	}
	agent.SetSource(rooms)
	agent.SetConflictHandler(func(playerIDs []string) { rooms.Evict(playerIDs) })
	if opts.WS.Logger == nil {
		opts.WS.Logger = log
	}
	// Explicit test options win; otherwise the configured memory guards apply.
	if opts.WS.SendBufferLimit == 0 {
		opts.WS.SendBufferLimit = cfg.SendBufferBytes
	}
	if opts.WS.MaxConnections == 0 {
		opts.WS.MaxConnections = cfg.MaxConnections
	}
	if opts.WS.HelloTimeout == 0 {
		opts.WS.HelloTimeout = cfg.HelloTimeout
	}
	if opts.WS.Busy == nil {
		opts.WS.Busy = memory.busy
	}
	if !cfg.WSCompression {
		opts.WS.DisableCompression = true
	}
	sockets := ws.NewServer(rooms, cfg.Network, opts.WS)
	if cfg.WebRTC {
		// Without WebRTC (a taken UDP port) browsers keep the WebSocket.
		if err := sockets.EnableWebRTC(ws.RTCOptions{UDPPort: cfg.WebRTCUDPPort, PublicIPs: cfg.WebRTCPublicIPs,
			IncludeLoopback: cfg.WebRTCLoopback}); err != nil {
			log.Error("WebRTC transport unavailable; players connect over WebSocket", "error", err)
		}
	}

	a := &App{cfg: cfg, log: log, data: data, agent: agent, outbox: box,
		lobby: rooms, ws: sockets, memory: memory}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /multiplayer/healthz", a.health)
	mux.Handle("GET /multiplayer/ws", sockets)
	mux.Handle("POST /multiplayer/offer", sockets.OfferHandler())
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		apierr.WriteError(w, apierr.New(http.StatusNotFound, "NOT_FOUND"))
	})
	a.handler = cfg.Network.CORS(mux)
	return a, nil
}

// Handler serves /multiplayer/healthz, /multiplayer/ws and /multiplayer/offer.
func (a *App) Handler() http.Handler { return a.handler }

// Lobby exposes the room authority (tests).
func (a *App) Lobby() *lobby.Lobby { return a.lobby }

// health reports the Java healthz fields plus load figures for monitoring
// (DESIGN.md 4.5): open sockets, hello'd players, rooms, the live heap, the
// undelivered outbox records and whether outbox writes are failing.
func (a *App) health(w http.ResponseWriter, _ *http.Request) {
	players, rooms := a.lobby.Counts()
	apierr.WriteJSON(w, http.StatusOK, struct {
		ProtocolVersion    int    `json:"protocolVersion"`
		Ruleset            string `json:"ruleset"`
		Transport          string `json:"transport"`
		Service            string `json:"service"`
		NodeID             string `json:"nodeId"`
		Connections        int    `json:"connections"`
		Players            int    `json:"players"`
		Rooms              int    `json:"rooms"`
		HeapMB             uint64 `json:"heapMB"`
		OutboxPending      int    `json:"outboxPending"`
		OutboxWriteFailing bool   `json:"outboxWriteFailing"`
		// WebRTC: the node also answers /multiplayer/offer (data channels).
		WebRTC bool `json:"webrtc"`
	}{contract.ProtocolVersion, contract.Ruleset, "websocket", "game", a.cfg.NodeID,
		a.ws.Connections(), players, rooms, a.memory.heapBytes() >> 20,
		a.outbox.Len(), a.outbox.WriteFailing(), a.ws.WebRTCEnabled()})
}

// Start registers the node with the data service (immediately, then every
// heartbeat interval) and starts delivering the outbox.
//
// Before the first heartbeat it removes the nickname claims a previous run
// of this node ID may have left (a crash or kill skips the leave at
// shutdown): the first heartbeat re-registers the node, after which those
// claims look alive and would refuse every reconnecting player for up to 30
// seconds. Run calls Start before serving, so no claim of this run exists
// yet. Two live processes must therefore never share a node ID.
func (a *App) Start() {
	leaveCtx, cancelLeave := context.WithTimeout(context.Background(), 2*time.Second)
	if err := a.agent.Leave(leaveCtx); err != nil {
		a.log.Warn("could not clear nickname claims of a previous run", "node", a.cfg.NodeID, "error", err)
	}
	cancelLeave()
	ctx, cancel := context.WithCancel(context.Background())
	a.agentCancel = cancel
	a.agentDone = make(chan struct{})
	go func() {
		defer close(a.agentDone)
		a.agent.Run(ctx)
	}()
	a.outbox.Start()
}

// Shutdown closes every WebSocket with 1001, leaves the cluster and flushes
// the outbox for at most 5 seconds; what is left stays on disk. Later calls
// return the first result.
func (a *App) Shutdown(ctx context.Context) error {
	a.shutdownOnce.Do(func() { a.shutdownErr = a.shutdown(ctx) })
	return a.shutdownErr
}

func (a *App) shutdown(ctx context.Context) error {
	var errs []error
	closeCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	if err := a.ws.Shutdown(closeCtx); err != nil {
		errs = append(errs, fmt.Errorf("close WebSockets: %w", err))
	}
	cancel()
	a.lobby.Close()
	if a.agentCancel != nil {
		a.agentCancel()
		<-a.agentDone
	}
	if err := a.agent.Leave(ctx); err != nil {
		a.log.Warn("leave cluster failed", "error", err)
	}
	flushCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := a.outbox.Close(flushCtx); err != nil {
		errs = append(errs, fmt.Errorf("flush outbox: %w", err))
	}
	return errors.Join(errs...)
}

// Run listens on the configured address until ctx ends, then shuts down.
func (a *App) Run(ctx context.Context) error {
	listener, err := net.Listen("tcp", a.cfg.ListenAddr())
	if err != nil {
		return err
	}
	server := &http.Server{
		Handler:           a.handler,
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       120 * time.Second,
		ErrorLog:          slog.NewLogLogger(a.log.Handler(), slog.LevelWarn),
	}
	a.Start()
	a.log.Info("game node listening", "addr", listener.Addr().String(), "node", a.cfg.NodeID,
		"origin", a.cfg.PublicOrigin, "data", a.cfg.DataInternalURL, "capacity", a.cfg.MaxPlayers,
		"maxConnections", a.cfg.MaxConnections, "maxRooms", a.cfg.MaxRooms,
		"memoryLimitMB", a.cfg.MemoryLimitMB, "allowGuests", a.cfg.AllowGuests,
		"webrtc", a.ws.WebRTCEnabled(), "webrtcUDPPort", a.cfg.WebRTCUDPPort)
	served := make(chan error, 1)
	go func() { served <- server.Serve(listener) }()

	select {
	case err = <-served:
	case <-ctx.Done():
	}
	a.log.Info("game node shutting down")
	stopCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if shutdownErr := server.Shutdown(stopCtx); shutdownErr != nil {
		a.log.Warn("HTTP shutdown", "error", shutdownErr)
	}
	shutdownErr := a.Shutdown(context.Background())
	if errors.Is(err, http.ErrServerClosed) {
		err = nil
	}
	return errors.Join(err, shutdownErr)
}

// recorder writes the lobby's durable records to the outbox.
type recorder struct {
	box *outbox.Outbox
	log *slog.Logger
}

// SaveRules queues the room's rules; a newer save of the same room replaces
// an older one that has not been delivered (the data service keeps only the
// newest), so rule changes cannot flood the outbox.
func (r recorder) SaveRules(req contract.RoomRulesRequest) {
	err := r.box.EnqueueLatest("room-rules", "rules:"+req.RoomID, contract.PathRoomRules, req)
	if err != nil && !errors.Is(err, outbox.ErrBacklog) { // the outbox logs refusals itself
		r.log.Error("room rules not queued", "room", req.RoomID, "error", err)
	}
}

func (r recorder) SaveRace(req contract.RaceSettlement) {
	if err := r.box.Enqueue("race", contract.PathRaces, req); err != nil {
		r.log.Error("race settlement not queued", "race", req.RaceID, "error", err)
	}
}
