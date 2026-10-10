// Package ws carries the lobby protocol over WebSocket: request/reply JSON
// in text frames and motion frames in binary frames (the Java LocalWebSocket),
// or over WebRTC data channels (rtc.go).
// Each connection has one reader goroutine that handles messages in order
// and one writer goroutine that drains a bounded queue, so broadcasts made
// under the lobby lock never block on a slow peer.
package ws

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net"
	"net/http"
	"runtime/debug"
	"slices"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v4"

	"kartsim/internal/game/lobby"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/netcfg"
)

// Options tune the connections; zero values use the defaults.
type Options struct {
	ReadLimit       int64         // 64 KiB per message
	ReadTimeout     time.Duration // 90 s without any frame closes the socket
	PingInterval    time.Duration // 30 s
	WriteTimeout    time.Duration // 5 s per frame, like Spring's send-time limit
	SendBufferLimit int           // 1 MiB of queued bytes per connection (KART_SEND_BUFFER_BYTES)
	// MaxConnections caps open sockets, hello'd or not; further upgrades get
	// HTTP 503 (KART_MAX_CONNECTIONS). Zero means no cap.
	MaxConnections int
	// HelloTimeout closes a socket that has not completed hello in time
	// (KART_HELLO_TIMEOUT). Zero disables it.
	HelloTimeout time.Duration
	// Busy reports memory pressure; upgrades are then refused with HTTP 503
	// SERVER_BUSY (KART_MEMORY_LIMIT_MB). Nil means never busy.
	Busy func() bool
	// Per-connection token buckets (rate per second, burst): text commands
	// (30, 60), the rule-changing commands create/track/random-track/
	// room-settings on top of that (5, 20), and binary motion frames
	// (200, 400). A command over its limit is answered 429 RATE_LIMITED and
	// dropped, a motion frame is dropped; a client that keeps exceeding the
	// limits is closed with 1008. Zero uses the default; a negative rate
	// disables that limit.
	TextRate, RulesRate, MotionRate    float64
	TextBurst, RulesBurst, MotionBurst int
	Logger                             *slog.Logger
}

// Strikes: messages refused by a rate limit draw on this bucket; once it is
// empty the client is flooding and is disconnected.
const (
	strikeRate  = 10
	strikeBurst = 50
)

// rulesCommands change room rules, and each one queues an outbox record.
var rulesCommands = map[string]bool{"create": true, "track": true, "random-track": true, "room-settings": true}

// errFlooding closes a connection that keeps exceeding its rate limits.
var errFlooding = errors.New("rate limit exceeded")

// Server upgrades /multiplayer/ws requests and runs the connections.
type Server struct {
	lobby    *lobby.Lobby
	opts     Options
	log      *slog.Logger
	upgrader websocket.Upgrader
	ctx      context.Context // ends at shutdown; aborts pending presence claims
	cancel   context.CancelFunc

	mu        sync.Mutex
	conns     map[*conn]struct{}
	upgrading int // requests between the capacity check and registration
	closing   bool
	wg        sync.WaitGroup

	// WebRTC transport (rtc.go): nil until EnableWebRTC.
	rtc    *webrtc.API
	rtcMux io.Closer
}

// NewServer returns a WebSocket endpoint for l. Browser origins are checked
// with network (requests without Origin are accepted).
func NewServer(l *lobby.Lobby, network *netcfg.Network, opts Options) *Server {
	if opts.ReadLimit <= 0 {
		opts.ReadLimit = 64 << 10
	}
	if opts.ReadTimeout <= 0 {
		opts.ReadTimeout = 90 * time.Second
	}
	if opts.PingInterval <= 0 {
		opts.PingInterval = 30 * time.Second
	}
	if opts.WriteTimeout <= 0 {
		opts.WriteTimeout = 5 * time.Second
	}
	if opts.SendBufferLimit <= 0 {
		opts.SendBufferLimit = 1 << 20
	}
	defaultRate := func(rate *float64, burst *int, defRate float64, defBurst int) {
		if *rate == 0 {
			*rate = defRate
		}
		if *burst <= 0 {
			*burst = defBurst
		}
	}
	defaultRate(&opts.TextRate, &opts.TextBurst, 30, 60)
	defaultRate(&opts.RulesRate, &opts.RulesBurst, 5, 20)
	defaultRate(&opts.MotionRate, &opts.MotionBurst, 200, 400)
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	s := &Server{
		lobby: l,
		opts:  opts,
		log:   opts.Logger,
		upgrader: websocket.Upgrader{
			HandshakeTimeout: 10 * time.Second,
			CheckOrigin:      network.CheckWebSocketOrigin,
		},
		conns: map[*conn]struct{}{},
	}
	s.ctx, s.cancel = context.WithCancel(context.Background())
	return s
}

// ServeHTTP upgrades the request and serves the connection until it closes.
// Over the connection cap or under memory pressure it answers HTTP 503
// before upgrading, so a flood of sockets cannot exhaust the node.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	busy := s.opts.Busy != nil && s.opts.Busy()
	s.mu.Lock()
	var rejected *apierr.Error
	switch {
	case s.closing:
		rejected = apierr.New(http.StatusServiceUnavailable, "SERVER_SHUTTING_DOWN")
	case s.opts.MaxConnections > 0 && len(s.conns)+s.upgrading >= s.opts.MaxConnections:
		rejected = apierr.New(http.StatusServiceUnavailable, "SERVER_FULL")
	case busy:
		rejected = apierr.New(http.StatusServiceUnavailable, "SERVER_BUSY")
	}
	if rejected != nil {
		s.mu.Unlock()
		apierr.WriteError(w, rejected)
		return
	}
	s.upgrading++
	s.wg.Add(1)
	s.mu.Unlock()
	defer s.wg.Done()

	socket, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.mu.Lock()
		s.upgrading--
		s.mu.Unlock()
		return // the upgrader already answered with an HTTP error
	}
	c := newConn(&wsLink{socket: socket, writeTimeout: s.opts.WriteTimeout}, s.opts, s.log)
	s.mu.Lock()
	s.upgrading--
	if s.closing {
		s.mu.Unlock()
		c.closeWith(websocket.CloseGoingAway, "server shutting down")
		return
	}
	s.conns[c] = struct{}{}
	s.mu.Unlock()

	if s.opts.HelloTimeout > 0 {
		timer := time.AfterFunc(s.opts.HelloTimeout, func() {
			if !s.lobby.Admitted(c.client) {
				c.closeWith(websocket.ClosePolicyViolation, "hello timeout")
			}
		})
		defer timer.Stop()
	}
	go c.writeLoop()
	s.readLoop(c)
	c.terminate()
	s.lobby.Disconnect(c.client)
	s.mu.Lock()
	delete(s.conns, c)
	s.mu.Unlock()
}

// Connections reports how many sockets are open.
func (s *Server) Connections() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.conns)
}

// Shutdown refuses new sockets, sends close 1001 to every connection (all at
// once: each may wait up to a second behind a write to a peer that stopped
// reading) and waits for their cleanup (room release, presence release).
// When ctx ends first, the remaining sockets are dropped without a close
// frame. Either way it returns only after every cleanup has run, so nothing
// a disconnect records (a roadblock settlement) arrives after the outbox
// closes; the cleanups are quick once the sockets are closed.
func (s *Server) Shutdown(ctx context.Context) error {
	s.mu.Lock()
	s.closing = true
	conns := slices.Collect(maps.Keys(s.conns))
	s.mu.Unlock()
	s.cancel()
	var closing sync.WaitGroup
	for _, c := range conns {
		closing.Add(1)
		go func() {
			defer closing.Done()
			c.closeWith(websocket.CloseGoingAway, "server shutting down")
		}()
	}
	done := make(chan struct{})
	go func() {
		closing.Wait()
		s.wg.Wait()
		close(done)
	}()
	select {
	case <-done:
		s.closeRTCMux()
		return nil
	case <-ctx.Done():
	}
	s.mu.Lock()
	conns = slices.Collect(maps.Keys(s.conns))
	s.mu.Unlock()
	for _, c := range conns {
		c.terminate()
	}
	<-done
	s.closeRTCMux()
	return ctx.Err()
}

// closeRTCMux releases the WebRTC UDP port once no peer uses it.
func (s *Server) closeRTCMux() {
	s.mu.Lock()
	mux := s.rtcMux
	s.rtcMux = nil
	s.mu.Unlock()
	if mux != nil {
		_ = mux.Close()
	}
}

func (s *Server) readLoop(c *conn) {
	socket := c.link.(*wsLink).socket
	extend := func() { _ = socket.SetReadDeadline(time.Now().Add(s.opts.ReadTimeout)) }
	socket.SetReadLimit(s.opts.ReadLimit)
	extend()
	socket.SetPongHandler(func(string) error {
		extend()
		return nil
	})
	socket.SetPingHandler(func(data string) error {
		extend()
		err := socket.WriteControl(websocket.PongMessage, []byte(data),
			time.Now().Add(s.opts.WriteTimeout))
		var netErr net.Error
		if errors.Is(err, websocket.ErrCloseSent) || errors.As(err, &netErr) {
			return nil
		}
		return err
	})
	for {
		kind, data, err := socket.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure,
				websocket.CloseGoingAway, websocket.CloseNoStatusReceived) &&
				!errors.Is(err, net.ErrClosed) {
				s.log.Debug("WebSocket closed", "error", err)
			}
			return
		}
		extend()
		if !s.receive(c, kind, data) {
			return
		}
	}
}

// receive handles one client message of either transport: a JSON command
// (text) or a motion frame (binary). It returns false once the connection
// was closed (malformed text, flooding).
func (s *Server) receive(c *conn, kind int, data []byte) bool {
	switch kind {
	case websocket.TextMessage:
		if !utf8.Valid(data) {
			// Tomcat rejected malformed text frames the same way (RFC 6455 §8.1).
			c.closeWith(websocket.CloseInvalidFramePayloadData, "invalid UTF-8")
			return false
		}
		return s.handleText(c, data)
	case websocket.BinaryMessage:
		now := time.Now()
		if !c.motion.allow(now) {
			if !c.strikes.allow(now) {
				s.closeFlooder(c)
				return false
			}
			return true
		}
		s.relay(c, data)
	}
	return true
}

// handleText mirrors LocalWebSocket.handleTextMessage: parse, validate
// requestId, run the command, reply only when a requestId was given, and
// always answer errors. It returns false once the connection was closed for
// flooding.
func (s *Server) handleText(c *conn, data []byte) bool {
	requestID, reply, err := s.process(c, data)
	switch {
	case errors.Is(err, errFlooding):
		s.closeFlooder(c)
		return false
	case err != nil:
		c.Text(lobby.ErrorMessage(s.errorCode(err), errorFields(err), requestID))
	case requestID != "":
		c.Text(reply.Encode(requestID))
	}
	return true
}

func (s *Server) process(c *conn, data []byte) (string, lobby.Reply, error) {
	req, err := lobby.ParseRequest(data)
	requestID := ""
	if err == nil {
		if requestID, err = req.RequestID(); err != nil {
			requestID = ""
		}
	}
	// Malformed messages count against the limit too.
	if limited := s.limit(c, req.Type()); limited != nil {
		return requestID, lobby.Reply{}, limited
	}
	if err != nil {
		return "", lobby.Reply{}, err
	}
	reply, err := s.handle(c, req)
	return requestID, reply, err
}

// limit applies the connection's rate limits to one text command: over a
// limit it is 429 RATE_LIMITED (and dropped), and errFlooding once the
// client has been refused too often.
func (s *Server) limit(c *conn, typ string) error {
	now := time.Now()
	allowed := c.text.allow(now)
	if allowed && rulesCommands[typ] {
		allowed = c.rules.allow(now)
	}
	if allowed {
		return nil
	}
	if !c.strikes.allow(now) {
		return errFlooding
	}
	return apierr.New(http.StatusTooManyRequests, "RATE_LIMITED")
}

// closeFlooder disconnects a client that keeps exceeding its rate limits.
func (s *Server) closeFlooder(c *conn) {
	s.log.Warn("WebSocket client exceeds its rate limits; closing connection")
	c.closeWith(websocket.ClosePolicyViolation, "rate limit exceeded")
}

func (s *Server) errorCode(err error) string {
	if rejected, ok := apierr.As(err); ok {
		return rejected.Code
	}
	s.log.Error("WebSocket command failed", "error", err)
	return "INTERNAL_ERROR"
}

// errorFields are the further members of a refusal (nil for most).
func errorFields(err error) map[string]any {
	if rejected, ok := apierr.As(err); ok {
		return rejected.Fields
	}
	return nil
}

func (s *Server) handle(c *conn, req lobby.Request) (reply lobby.Reply, err error) {
	defer func() {
		if p := recover(); p != nil {
			err = fmt.Errorf("panic: %v\n%s", p, debug.Stack())
		}
	}()
	return s.lobby.Handle(s.ctx, c.client, req)
}

func (s *Server) relay(c *conn, frame []byte) {
	defer func() {
		if p := recover(); p != nil {
			s.log.Error("motion relay failed", "panic", p, "stack", string(debug.Stack()))
		}
	}()
	s.lobby.RelayMotion(c.client, frame)
}

var (
	_ lobby.Sink         = (*conn)(nil)
	_ lobby.SnapshotSink = (*conn)(nil)
	_ lobby.Closer       = (*conn)(nil)
)

// link is a connection's transport: a WebSocket, or the WebRTC data
// channels of rtc.go. Frames keep the WebSocket kinds: text is a JSON
// command or event, binary a motion frame.
type link interface {
	write(f frame) error
	// ping keeps an idle transport alive between writes.
	ping() error
	// sendClose tells the peer why the connection ends, where the transport
	// can (a WebSocket close frame).
	sendClose(code int, reason string)
	close() error
}

// wsLink is a WebSocket transport.
type wsLink struct {
	socket       *websocket.Conn
	writeTimeout time.Duration
}

func (l *wsLink) write(f frame) error {
	_ = l.socket.SetWriteDeadline(time.Now().Add(l.writeTimeout))
	return l.socket.WriteMessage(f.kind, f.data)
}

func (l *wsLink) ping() error {
	return l.socket.WriteControl(websocket.PingMessage, nil, time.Now().Add(l.writeTimeout))
}

func (l *wsLink) sendClose(code int, reason string) {
	_ = l.socket.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(code, reason), time.Now().Add(time.Second))
}

func (l *wsLink) close() error { return l.socket.Close() }

// conn is one client connection with its bounded outbound queue.
type conn struct {
	link   link
	client *lobby.Client
	opts   Options
	log    *slog.Logger

	// Rate limits; only the reader goroutine uses them.
	text, rules, motion, strikes limiter

	mu     sync.Mutex
	queue  []frame
	queued int // bytes not yet written
	closed bool
	// closing: Close queued its close; nothing more is queued.
	closing bool
	wake    chan struct{}
	done    chan struct{}
	once    sync.Once
}

type frame struct {
	kind int
	data []byte
	room string // set for a room snapshot push, which a newer one supersedes
	// close, when set, ends the connection once the frames before it are
	// written (Close).
	close *closeNote
}

type closeNote struct {
	code   int
	reason string
}

// closeFlushTimeout bounds how long Close waits for the frames queued
// before it (a peer that stopped reading): the connection then closes
// without them.
const closeFlushTimeout = 2 * time.Second

func newConn(transport link, opts Options, log *slog.Logger) *conn {
	c := &conn{link: transport, opts: opts, log: log,
		text:    newLimiter(opts.TextRate, opts.TextBurst),
		rules:   newLimiter(opts.RulesRate, opts.RulesBurst),
		motion:  newLimiter(opts.MotionRate, opts.MotionBurst),
		strikes: newLimiter(strikeRate, strikeBurst),
		wake:    make(chan struct{}, 1), done: make(chan struct{})}
	c.client = lobby.NewClient(c)
	return c
}

// Text queues a JSON message (lobby.Sink).
func (c *conn) Text(payload []byte) { c.enqueue(frame{kind: websocket.TextMessage, data: payload}) }

// Binary queues a motion frame (lobby.Sink).
func (c *conn) Binary(data []byte) { c.enqueue(frame{kind: websocket.BinaryMessage, data: data}) }

// Snapshot queues a room snapshot pushed to this member
// (lobby.SnapshotSink). Once the peer has fallen behind by more than a
// quarter of SendBufferLimit, unsent snapshots of the same room are dropped
// in favour of this newer, complete one (clients keep only the highest
// revision), so a member flooding room changes cannot overflow a slower
// member's buffer. A peer that keeps up receives every snapshot.
func (c *conn) Snapshot(roomID string, payload []byte) {
	c.enqueue(frame{kind: websocket.TextMessage, data: payload, room: roomID})
}

// Close ends the connection (lobby.Closer, used to evict a session or kick
// a cheater) once the messages queued before it are written, so the event
// that says why arrives first, at the latest after closeFlushTimeout: it
// sends a close frame and drops the socket. Nothing queued after it is
// sent. It is called under the lobby lock, so the close runs on another
// goroutine; the reader then fails and the server releases the player like
// any disconnect.
func (c *conn) Close(code int, reason string) {
	c.mu.Lock()
	if c.closed || c.closing {
		c.mu.Unlock()
		return
	}
	c.closing = true
	c.queue = append(c.queue, frame{close: &closeNote{code: code, reason: reason}})
	c.mu.Unlock()
	select {
	case c.wake <- struct{}{}:
	default:
	}
	time.AfterFunc(closeFlushTimeout, func() { c.closeWith(code, reason) })
}

// enqueue never blocks; a peer that falls more than SendBufferLimit bytes
// behind is disconnected with 1008. Its queue is dropped at once, and the
// close frame is sent from another goroutine because enqueue runs under the
// lobby lock.
func (c *conn) enqueue(f frame) {
	data := f.data
	c.mu.Lock()
	if c.closed || c.closing {
		c.mu.Unlock()
		return
	}
	if f.room != "" && c.queued > c.opts.SendBufferLimit/4 {
		c.queue = slices.DeleteFunc(c.queue, func(queued frame) bool {
			if queued.room != f.room {
				return false
			}
			c.queued -= len(queued.data)
			return true
		})
	}
	if c.queued+len(data) > c.opts.SendBufferLimit {
		c.closed = true
		c.queue = nil
		c.queued = 0
		c.mu.Unlock()
		c.log.Warn("WebSocket send buffer overflow; closing connection",
			"limitBytes", c.opts.SendBufferLimit)
		go c.closeWith(websocket.ClosePolicyViolation, "send buffer overflow")
		return
	}
	c.queue = append(c.queue, f)
	c.queued += len(data)
	c.mu.Unlock()
	select {
	case c.wake <- struct{}{}:
	default:
	}
}

func (c *conn) writeLoop() {
	ticker := time.NewTicker(c.opts.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-c.wake:
			c.mu.Lock()
			batch := c.queue
			c.queue = nil
			c.mu.Unlock()
			for _, f := range batch {
				if f.close != nil {
					c.closeWith(f.close.code, f.close.reason)
					return
				}
				if err := c.link.write(f); err != nil {
					c.terminate()
					return
				}
				c.mu.Lock()
				c.queued -= len(f.data)
				c.mu.Unlock()
			}
		case <-ticker.C:
			if err := c.link.ping(); err != nil {
				c.terminate()
				return
			}
		}
	}
}

// closeWith sends a close frame, then drops the socket.
func (c *conn) closeWith(code int, text string) {
	c.link.sendClose(code, text)
	c.terminate()
}

// terminate stops the writer and closes the transport; the reader then
// fails and the server releases the player.
func (c *conn) terminate() {
	c.once.Do(func() {
		c.mu.Lock()
		c.closed = true
		c.queue = nil
		c.queued = 0
		c.mu.Unlock()
		close(c.done)
		_ = c.link.close()
	})
}

// limiter is a token bucket: rate tokens per second, at most burst.
type limiter struct {
	rate   float64 // <= 0 disables the limit
	burst  float64
	tokens float64
	last   time.Time
}

func newLimiter(rate float64, burst int) limiter {
	return limiter{rate: rate, burst: float64(burst), tokens: float64(burst)}
}

func (b *limiter) allow(now time.Time) bool {
	if b.rate <= 0 {
		return true
	}
	if !b.last.IsZero() {
		b.tokens = min(b.burst, b.tokens+now.Sub(b.last).Seconds()*b.rate)
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
