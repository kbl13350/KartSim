package messenger

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"

	"kartsim/internal/shared/apierr"
)

var (
	errInvalidRequest = apierr.New(http.StatusBadRequest, "INVALID_REQUEST")
	errServerBusy     = apierr.New(http.StatusServiceUnavailable, "SERVER_BUSY")
)

// Error codes the socket answers with besides the Backend's.
const (
	codeLoginRequired      = "LOGIN_REQUIRED"
	codeServiceUnavailable = "DATA_SERVICE_UNAVAILABLE"
	codeInvalidRequest     = "INVALID_REQUEST"
	codeInternal           = "INTERNAL_ERROR"
)

// maxRequestID is the longest requestId echoed back (the game protocol rule).
const maxRequestID = 64

// ServeHTTP upgrades GET /api/messenger/ws and serves the socket until it
// closes. A plain request is 400 INVALID_REQUEST; over MaxConnections (or
// while shutting down) it is 503 SERVER_BUSY before the upgrade.
func (h *Hub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !websocket.IsWebSocketUpgrade(r) {
		apierr.WriteError(w, errInvalidRequest)
		return
	}
	h.mu.Lock()
	if h.closing || len(h.conns)+h.upgrading >= h.opts.MaxConnections {
		h.mu.Unlock()
		apierr.WriteError(w, errServerBusy)
		return
	}
	h.upgrading++
	h.wg.Add(1)
	h.mu.Unlock()
	defer h.wg.Done()

	socket, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.mu.Lock()
		h.upgrading--
		h.mu.Unlock()
		return // the upgrader already answered with an HTTP error
	}
	c := newConn(socket, &h.opts, h.log)
	h.mu.Lock()
	h.upgrading--
	if h.closing {
		h.mu.Unlock()
		c.closeWith(websocket.CloseGoingAway, "server shutting down")
		return
	}
	h.conns[c] = struct{}{}
	h.mu.Unlock()

	go c.writeLoop()
	h.readLoop(c)
	c.finish()
	h.detach(c)
}

func (h *Hub) readLoop(c *conn) {
	socket := c.socket
	// Until hello the deadline is HelloTimeout after the upgrade; then every
	// frame (pongs included) extends it by ReadTimeout.
	_ = socket.SetReadDeadline(time.Now().Add(h.opts.HelloTimeout))
	extend := func() {
		if c.helloed {
			_ = socket.SetReadDeadline(time.Now().Add(h.opts.ReadTimeout))
		}
	}
	socket.SetReadLimit(h.opts.ReadLimit)
	socket.SetPongHandler(func(string) error {
		extend()
		return nil
	})
	socket.SetPingHandler(func(data string) error {
		extend()
		err := socket.WriteControl(websocket.PongMessage, []byte(data), time.Now().Add(h.opts.WriteTimeout))
		var netErr net.Error
		if errors.Is(err, websocket.ErrCloseSent) || errors.As(err, &netErr) {
			return nil
		}
		return err
	})
	for {
		kind, data, err := socket.ReadMessage()
		if err != nil {
			var netErr net.Error
			if !c.helloed && errors.As(err, &netErr) && netErr.Timeout() {
				h.refuse(c) // no hello in time
			} else if websocket.IsUnexpectedCloseError(err, websocket.CloseNormalClosure,
				websocket.CloseGoingAway, websocket.CloseNoStatusReceived) && !errors.Is(err, net.ErrClosed) {
				h.log.Debug("messenger socket closed", "error", err)
			}
			return
		}
		extend()
		if kind != websocket.TextMessage {
			c.closeAfter(websocket.CloseUnsupportedData, "text frames only")
			return
		}
		if !utf8.Valid(data) {
			c.closeAfter(websocket.CloseInvalidFramePayloadData, "invalid UTF-8")
			return
		}
		if !c.helloed {
			if !h.hello(c, data) {
				return
			}
			continue
		}
		if !h.command(c, data) {
			return
		}
	}
}

// errorFrame is {"type":"error","code","requestId"?,"mutedUntil"?}.
func errorFrame(code, requestID string, mutedUntil int64) []byte {
	return encode(struct {
		Type       string `json:"type"`
		Code       string `json:"code"`
		RequestID  string `json:"requestId,omitempty"`
		MutedUntil int64  `json:"mutedUntil,omitempty"`
	}{"error", code, requestID, mutedUntil})
}

// refuse answers a missing or invalid hello: LOGIN_REQUIRED, then 4001.
func (h *Hub) refuse(c *conn) {
	c.send(errorFrame(codeLoginRequired, "", 0))
	c.closeAfter(CloseSessionEnded, "login required")
}

// hello authenticates the first frame, attaches the socket to its account
// and sends the welcome. It returns false once the socket is closing.
func (h *Hub) hello(c *conn, data []byte) bool {
	var message struct {
		Type  string `json:"type"`
		Token any    `json:"token"`
	}
	token, isText := "", false
	if json.Unmarshal(data, &message) == nil {
		token, isText = message.Token.(string)
	}
	if message.Type != "hello" || !isText || token == "" {
		h.refuse(c)
		return false
	}
	ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
	defer cancel()
	session, found, err := h.backend.Authenticate(ctx, token)
	if err != nil {
		h.unavailable(c, "hello", err)
		return false
	}
	if !found {
		h.refuse(c)
		return false
	}
	c.helloed = true
	_ = c.socket.SetReadDeadline(time.Now().Add(h.opts.ReadTimeout))
	c.token = token
	a, first := h.attach(c, session)
	if a == nil {
		return false
	}
	if first {
		h.loadRoster(a)
	}
	state, err := h.backend.Welcome(ctx, session.AccountID)
	if err != nil {
		h.unavailable(c, "welcome", err)
		return false
	}
	c.release(encode(struct {
		Type       string `json:"type"`
		AccountID  string `json:"accountId"`
		ServerTime int64  `json:"serverTime"`
		State      any    `json:"state"`
	}{"welcome", session.AccountID, h.opts.Now().UnixMilli(), state}))
	h.mu.Lock()
	h.background(func() { h.watchSession(c) })
	h.mu.Unlock()
	return true
}

// unavailable closes a socket whose hello could not be served (MySQL or
// Redis trouble) with 1011; the client reconnects later.
func (h *Hub) unavailable(c *conn, step string, err error) {
	h.log.Warn("messenger hello failed", "step", step, "error", err)
	c.send(errorFrame(codeServiceUnavailable, "", 0))
	c.closeAfter(websocket.CloseInternalServerErr, "service unavailable")
}

// attach adds a hello'd socket to its account (creating the account entry
// on its first socket, or keeping it when it reconnects within the offline
// grace). Beyond MaxPerAccount the oldest socket is closed with 4002. It
// returns nil when the hub is closing.
func (h *Hub) attach(c *conn, session Session) (*account, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closing {
		return nil, false
	}
	a := h.accounts[session.AccountID]
	first := a == nil
	if first {
		a = &account{id: session.AccountID, commands: newLimiter(h.opts.CommandRate, h.opts.CommandBurst)}
		h.accounts[a.id] = a
	} else if a.grace != nil {
		a.grace.Stop()
		a.grace = nil
	}
	c.account, c.accountID, c.sessionKey = a, session.AccountID, session.Key
	c.hold()
	a.conns = append(a.conns, c)
	for len(a.conns) > h.opts.MaxPerAccount {
		oldest := a.conns[0]
		a.conns = a.conns[1:]
		oldest.closeAfter(CloseReplaced, "replaced by a newer connection")
	}
	h.ensurePeer(a.id)
	h.update(a.id)
	return a, first
}

// detach forgets a closed socket. The account's last socket starts the
// offline grace; when it ends without a new socket the account goes
// offline for its friends.
func (h *Hub) detach(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns, c)
	a := c.account
	if a == nil {
		return
	}
	index := slices.Index(a.conns, c)
	if index < 0 {
		return // replaced earlier
	}
	a.conns = slices.Delete(a.conns, index, index+1)
	if len(a.conns) > 0 || h.accounts[a.id] != a || h.closing {
		return
	}
	if h.opts.OfflineGrace <= 0 {
		h.expire(a)
		return
	}
	a.grace = time.AfterFunc(h.opts.OfflineGrace, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if !h.closing {
			h.expire(a)
		}
	})
}

// expire removes an account without sockets; the caller holds h.mu.
func (h *Hub) expire(a *account) {
	if h.accounts[a.id] != a || len(a.conns) > 0 {
		return
	}
	delete(h.accounts, a.id)
	for id := range a.friends {
		h.unwatch(id, a.id)
	}
	h.update(a.id)
	h.dropIdlePeer(a.id)
}

// watchSession re-checks the socket's session every SessionCheck and
// closes it with 4001 once the session is gone. Errors keep it open.
func (h *Hub) watchSession(c *conn) {
	ticker := time.NewTicker(h.opts.SessionCheck)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-h.ctx.Done():
			return
		case <-ticker.C:
		}
		ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
		session, found, err := h.backend.Authenticate(ctx, c.token)
		cancel()
		if err != nil {
			h.log.Debug("messenger session not re-checked", "error", err)
			continue
		}
		if !found || session.AccountID != c.accountID {
			c.closeAfter(CloseSessionEnded, "session ended")
			return
		}
	}
}

// requestID returns a requestId worth echoing: a non-blank string of at
// most maxRequestID characters.
func requestID(raw json.RawMessage) string {
	var value string
	if len(raw) == 0 || json.Unmarshal(raw, &value) != nil || strings.TrimSpace(value) == "" ||
		utf8.RuneCountInString(value) > maxRequestID {
		return ""
	}
	return value
}

// text reads an optional string field; anything else is "".
func text(raw json.RawMessage) string {
	var value string
	if json.Unmarshal(raw, &value) != nil {
		return ""
	}
	return value
}

// command handles one frame after hello. It returns false once the socket
// is closing.
func (h *Hub) command(c *conn, data []byte) bool {
	h.mu.Lock()
	allowed := c.account.commands.allow(time.Now())
	h.mu.Unlock()
	if !allowed {
		h.log.Warn("messenger client exceeds its command rate; closing connection", "account", c.accountID)
		c.closeAfter(websocket.ClosePolicyViolation, "rate limit exceeded")
		return false
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(data, &fields) != nil || fields == nil {
		c.send(errorFrame(codeInvalidRequest, "", 0))
		return true
	}
	id := requestID(fields["requestId"])
	ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
	defer cancel()
	switch text(fields["type"]) {
	case "ping":
		c.send(encode(struct {
			Type      string `json:"type"`
			RequestID string `json:"requestId,omitempty"`
		}{"pong", id}))
	case "send":
		message, duplicate, err := h.backend.Send(ctx, c.accountID, text(fields["to"]), text(fields["text"]),
			text(fields["clientId"]))
		if err != nil {
			h.replyError(c, id, err)
			return true
		}
		c.send(encode(struct {
			Type      string  `json:"type"`
			RequestID string  `json:"requestId,omitempty"`
			Message   Message `json:"message"`
			Duplicate bool    `json:"duplicate"`
		}{"sent", id, message, duplicate}))
		if !duplicate {
			h.deliver(message, c)
		}
	case "read":
		var upTo int64
		if json.Unmarshal(fields["upTo"], &upTo) != nil {
			c.send(errorFrame(codeInvalidRequest, id, 0))
			return true
		}
		if err := h.backend.Read(ctx, c.accountID, text(fields["with"]), upTo); err != nil {
			h.replyError(c, id, err)
			return true
		}
		h.mu.Lock()
		h.pushLocked(c.accountID, syncFrame, c)
		h.mu.Unlock()
	default:
		c.send(errorFrame(codeInvalidRequest, id, 0))
	}
	return true
}

// replyError answers a failed command; unexpected errors are logged and
// reported as INTERNAL_ERROR.
func (h *Hub) replyError(c *conn, requestID string, err error) {
	var flood *FloodError
	if errors.As(err, &flood) {
		c.send(errorFrame(flood.Error(), requestID, flood.MutedUntil))
		return
	}
	if rejected, ok := apierr.As(err); ok {
		c.send(errorFrame(rejected.Code, requestID, 0))
		return
	}
	h.log.Error("messenger command failed", "account", c.accountID, "error", err)
	c.send(errorFrame(codeInternal, requestID, 0))
}
