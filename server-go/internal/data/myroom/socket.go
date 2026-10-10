package myroom

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gorilla/websocket"

	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/wsdeflate"
)

var (
	errInvalidRequest = apierr.New(http.StatusBadRequest, "INVALID_REQUEST")
	errServerBusy     = apierr.New(http.StatusServiceUnavailable, "SERVER_BUSY")
)

// maxRequestID is the longest requestId echoed back.
const maxRequestID = 64

// maxCoordinate bounds pose values; the room scenes are far smaller.
const maxCoordinate = 100_000

// ServeHTTP upgrades GET /api/myroom/ws and serves the socket until it
// closes. A plain request is 400 INVALID_REQUEST; over MaxConnections (or
// while shutting down) it is 503 SERVER_BUSY.
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
		return
	}
	c := newConn(socket, &h.opts, h.log)
	cl := &client{conn: c, commands: newLimiter(h.opts.CommandRate, h.opts.CommandBurst),
		moves: newLimiter(h.opts.MoveRate, int(math.Ceil(h.opts.MoveRate)))}
	h.mu.Lock()
	h.upgrading--
	if h.closing {
		h.mu.Unlock()
		c.closeWith(websocket.CloseGoingAway, "server shutting down")
		return
	}
	h.conns[c] = cl
	h.mu.Unlock()

	go c.writeLoop()
	h.readLoop(cl)
	c.finish()
	h.detach(cl)
}

func (h *Hub) readLoop(cl *client) {
	socket := cl.conn.socket
	_ = socket.SetReadDeadline(time.Now().Add(h.opts.HelloTimeout))
	extend := func() {
		if cl.helloed {
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
		kind, data, err := wsdeflate.Read(socket, h.opts.ReadLimit)
		if err != nil {
			var netErr net.Error
			if !cl.helloed && errors.As(err, &netErr) && netErr.Timeout() {
				h.refuse(cl)
			}
			return
		}
		extend()
		if kind != websocket.TextMessage {
			cl.conn.closeAfter(websocket.CloseUnsupportedData, "text frames only")
			return
		}
		if !utf8.Valid(data) {
			cl.conn.closeAfter(websocket.CloseInvalidFramePayloadData, "invalid UTF-8")
			return
		}
		if !cl.helloed {
			if !h.hello(cl, data) {
				return
			}
			continue
		}
		if !h.command(cl, data) {
			return
		}
	}
}

func (h *Hub) refuse(cl *client) {
	cl.conn.send(errorFrame(CodeLoginRequired, "", nil))
	cl.conn.closeAfter(CloseSessionEnded, "login required")
}

func (h *Hub) hello(cl *client, data []byte) bool {
	var message struct {
		Type  string `json:"type"`
		Token any    `json:"token"`
	}
	token, isText := "", false
	if json.Unmarshal(data, &message) == nil {
		token, isText = message.Token.(string)
	}
	if message.Type != "hello" || !isText || token == "" {
		h.refuse(cl)
		return false
	}
	ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
	defer cancel()
	session, found, err := h.backend.Authenticate(ctx, token)
	if err != nil {
		h.log.Warn("my room hello failed", "error", err)
		cl.conn.send(errorFrame(CodeUnavailable, "", nil))
		cl.conn.closeAfter(websocket.CloseInternalServerErr, "service unavailable")
		return false
	}
	if !found {
		h.refuse(cl)
		return false
	}
	h.mu.Lock()
	cl.helloed, cl.accountID, cl.sessionKey, cl.token = true, session.AccountID, session.Key, token
	if !h.closing {
		h.wg.Add(1)
		go func() {
			defer h.wg.Done()
			h.watchSession(cl)
		}()
	}
	h.mu.Unlock()
	_ = cl.conn.socket.SetReadDeadline(time.Now().Add(h.opts.ReadTimeout))
	cl.conn.send(encode(struct {
		Type       string `json:"type"`
		AccountID  string `json:"accountId"`
		ServerTime int64  `json:"serverTime"`
	}{"welcome", session.AccountID, h.opts.Now().UnixMilli()}))
	return true
}

// detach forgets a closed socket and takes it out of its room.
func (h *Hub) detach(cl *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.conns, cl.conn)
	h.leaveLocked(cl, "")
}

func (h *Hub) watchSession(cl *client) {
	ticker := time.NewTicker(h.opts.SessionCheck)
	defer ticker.Stop()
	for {
		select {
		case <-cl.conn.done:
			return
		case <-h.ctx.Done():
			return
		case <-ticker.C:
		}
		ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
		session, found, err := h.backend.Authenticate(ctx, cl.token)
		cancel()
		if err != nil {
			continue
		}
		if !found || session.AccountID != cl.accountID {
			cl.conn.closeAfter(CloseSessionEnded, "session ended")
			return
		}
	}
}

// CloseSession closes the sockets of a session that ended (logout).
func (h *Hub) CloseSession(key string) {
	if key == "" {
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, cl := range h.conns {
		if cl.sessionKey == key {
			cl.conn.closeAfter(CloseSessionEnded, "session ended")
		}
	}
}

func requestID(raw json.RawMessage) string {
	var value string
	if len(raw) == 0 || json.Unmarshal(raw, &value) != nil || strings.TrimSpace(value) == "" ||
		utf8.RuneCountInString(value) > maxRequestID {
		return ""
	}
	return value
}

func text(raw json.RawMessage) string {
	var value string
	if json.Unmarshal(raw, &value) != nil {
		return ""
	}
	return value
}

func number(raw json.RawMessage) (float64, bool) {
	var value float64
	if json.Unmarshal(raw, &value) != nil || math.IsNaN(value) || math.IsInf(value, 0) ||
		math.Abs(value) > maxCoordinate {
		return 0, false
	}
	return value, true
}

// command handles one frame after hello; false once the socket closes.
func (h *Hub) command(cl *client, data []byte) bool {
	now := h.opts.Now()
	h.mu.Lock()
	allowed := cl.commands.allow(now)
	h.mu.Unlock()
	if !allowed {
		h.log.Warn("my room client exceeds its command rate; closing connection", "account", cl.accountID)
		cl.conn.closeAfter(websocket.ClosePolicyViolation, "rate limit exceeded")
		return false
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(data, &fields) != nil || fields == nil {
		cl.conn.send(errorFrame(CodeInvalidRequest, "", nil))
		return true
	}
	id := requestID(fields["requestId"])
	switch text(fields["type"]) {
	case "ping":
		cl.conn.send(encode(map[string]any{"type": "pong", "requestId": id}))
	case "enter":
		var random bool
		_ = json.Unmarshal(fields["random"], &random)
		h.enter(cl, id, strings.TrimSpace(text(fields["nickname"])), random, text(fields["password"]))
	case "leave":
		h.mu.Lock()
		h.leaveLocked(cl, "")
		h.mu.Unlock()
		cl.conn.send(encode(map[string]any{"type": "left-room", "requestId": id}))
	case "move":
		h.move(cl, fields)
	case "chat":
		h.chatLine(cl, id, text(fields["text"]))
	case "kick":
		h.kick(cl, id, text(fields["accountId"]))
	default:
		cl.conn.send(errorFrame(CodeInvalidRequest, id, nil))
	}
	return true
}

// enter moves the client into a room: its own (no nickname), the rider
// named, or a random one. The checks, in order: the rider exists, it is
// not the current room, the visitor is not banned by a kick nor blocked,
// the room has a free card, then the room password.
func (h *Hub) enter(cl *client, id, nickname string, random bool, password string) {
	h.mu.Lock()
	if cl.entering {
		h.mu.Unlock()
		cl.conn.send(errorFrame(CodeInvalidRequest, id, nil))
		return
	}
	cl.entering = true
	h.mu.Unlock()
	defer func() {
		h.mu.Lock()
		cl.entering = false
		h.mu.Unlock()
	}()
	if utf8.RuneCountInString(nickname) > 64 || utf8.RuneCountInString(password) > 64 {
		cl.conn.send(errorFrame(CodeInvalidRequest, id, nil))
		return
	}
	ctx, cancel := context.WithTimeout(h.ctx, backendTimeout)
	defer cancel()
	var (
		owner Rider
		found bool
		err   error
	)
	switch {
	case random:
		owner, found = h.pickRandom(ctx, cl)
		if !found {
			cl.conn.send(errorFrame(CodeRandomFailed, id, nil))
			return
		}
	case nickname == "":
		owner, found, err = h.backend.Rider(ctx, cl.accountID)
	default:
		owner, found, err = h.backend.RiderByNickname(ctx, nickname)
	}
	if err != nil {
		h.replyError(cl, id, err)
		return
	}
	if !found {
		cl.conn.send(errorFrame(CodeUnknownRider, id, nil))
		return
	}
	isOwner := owner.AccountID == cl.accountID
	var self Rider
	if isOwner {
		self = owner
	} else {
		if self, found, err = h.backend.Rider(ctx, cl.accountID); err != nil || !found {
			h.replyError(cl, id, err)
			return
		}
	}
	h.mu.Lock()
	if cl.member != nil && cl.member.room.view.OwnerID == owner.AccountID {
		h.mu.Unlock()
		cl.conn.send(errorFrame(CodeAlreadyHere, id, map[string]any{"nickname": owner.Nickname}))
		return
	}
	kicked := !isOwner && h.kickedLocked(owner.AccountID, cl.accountID)
	h.mu.Unlock()
	if kicked {
		cl.conn.send(errorFrame(CodeKicked, id, nil))
		return
	}
	if !isOwner {
		blocked, err := h.backend.Blocked(ctx, owner.AccountID, cl.accountID)
		if err != nil {
			h.replyError(cl, id, err)
			return
		}
		if blocked {
			cl.conn.send(errorFrame(CodeCannotEnter, id, nil))
			return
		}
		if settings := owner.Profile.Settings; settings.Locked {
			if password == "" {
				cl.conn.send(errorFrame(CodePasswordRequired, id, map[string]any{"nickname": owner.Nickname}))
				return
			}
			if err := h.backend.PasswordAttempt(ctx, cl.accountID); err != nil {
				h.replyError(cl, id, err)
				return
			}
			if !settings.RoomPasswordMatches(password) {
				cl.conn.send(errorFrame(CodeWrongPassword, id, nil))
				return
			}
		}
	}
	emblems, err := h.backend.MainEmblems(ctx, owner.AccountID)
	if err != nil {
		h.replyError(cl, id, err)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closing {
		return
	}
	r := h.rooms[owner.AccountID]
	if r == nil {
		r = &room{members: map[string]*member{}}
	}
	r.view = roomView(owner, emblems)
	slot := r.freeSlotLocked(isOwner)
	if slot < 0 {
		cl.conn.send(errorFrame(CodeRoomFull, id, nil))
		return
	}
	// One room per account: another tab of the account leaves its room.
	if previous := h.members[cl.accountID]; previous != nil && previous.conn != cl.conn {
		for _, other := range h.conns {
			if other.member == previous {
				h.leaveLocked(other, "replaced")
				other.conn.send(encode(map[string]any{"type": "left-room", "reason": "replaced"}))
			}
		}
	}
	h.leaveLocked(cl, "")
	h.rooms[owner.AccountID] = r
	m := &member{conn: cl.conn, room: r, view: MemberView{AccountID: cl.accountID, Nickname: self.Nickname,
		Exp: self.Exp, Level: self.Level, Glove: self.Glove, Appearance: self.Profile.Appearance,
		Owner: isOwner, Slot: slot}}
	r.members[cl.accountID] = m
	h.members[cl.accountID] = m
	cl.member = m
	cl.conn.send(encode(map[string]any{"type": "room", "requestId": id, "room": r.view,
		"members": r.sortedMembers(), "self": cl.accountID}))
	h.broadcastLocked(r, encode(map[string]any{"type": "joined", "member": m.view}), m)
}

func (h *Hub) move(cl *client, fields map[string]json.RawMessage) {
	var pose Pose
	var ok bool
	if pose.X, ok = number(fields["x"]); !ok {
		return
	}
	if pose.Y, ok = number(fields["y"]); !ok {
		return
	}
	if pose.Z, ok = number(fields["z"]); !ok {
		return
	}
	if pose.Yaw, ok = number(fields["yaw"]); !ok {
		return
	}
	_ = json.Unmarshal(fields["moving"], &pose.Moving)
	h.mu.Lock()
	defer h.mu.Unlock()
	m := cl.member
	if m == nil || !cl.moves.allow(h.opts.Now()) {
		return
	}
	m.view.Pose = &pose
	h.broadcastLocked(m.room, encode(struct {
		Type      string `json:"type"`
		AccountID string `json:"accountId"`
		Pose
	}{"moved", cl.accountID, pose}), m)
}

func (h *Hub) chatLine(cl *client, id, line string) {
	line = strings.TrimSpace(line)
	if line == "" || utf8.RuneCountInString(line) > maxChat || strings.ContainsAny(line, "\r\n") {
		cl.conn.send(errorFrame(CodeInvalidRequest, id, nil))
		return
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	m := cl.member
	if m == nil {
		cl.conn.send(errorFrame(CodeNotInRoom, id, nil))
		return
	}
	if !m.view.Owner && !m.room.view.Settings.ChatAllowed {
		cl.conn.send(errorFrame(CodeChatDisabled, id, nil))
		return
	}
	now := h.opts.Now()
	state := h.chat[cl.accountID]
	if state == nil {
		state = &chatState{bucket: newLimiter(h.opts.ChatRate, h.opts.ChatBurst)}
		h.chat[cl.accountID] = state
	}
	if now.Before(state.mutedUntil) {
		cl.conn.send(errorFrame(CodeChatFlood, id, map[string]any{"mutedUntil": state.mutedUntil.UnixMilli()}))
		return
	}
	if !state.bucket.allow(now) {
		state.mutedUntil = now.Add(h.opts.ChatMute)
		cl.conn.send(errorFrame(CodeChatFlood, id, map[string]any{"mutedUntil": state.mutedUntil.UnixMilli()}))
		return
	}
	h.broadcastLocked(m.room, encode(map[string]any{"type": "chat", "accountId": cl.accountID,
		"nickname": m.view.Nickname, "text": line, "at": now.UnixMilli()}), nil)
}

func (h *Hub) kick(cl *client, id, target string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	m := cl.member
	if m == nil {
		cl.conn.send(errorFrame(CodeNotInRoom, id, nil))
		return
	}
	if !m.view.Owner {
		cl.conn.send(errorFrame(CodeNotOwner, id, nil))
		return
	}
	victim := m.room.members[target]
	if victim == nil || victim == m {
		cl.conn.send(errorFrame(CodeInvalidRequest, id, nil))
		return
	}
	h.kicks[kickKey(cl.accountID, target)] = h.opts.Now().Add(h.opts.KickBan)
	for _, other := range h.conns {
		if other.member == victim {
			h.leaveLocked(other, "kicked")
			other.conn.send(encode(map[string]any{"type": "kicked", "ownerNickname": m.room.view.OwnerNickname}))
		}
	}
	cl.conn.send(encode(map[string]any{"type": "kicked-ok", "requestId": id, "accountId": target}))
}

func (h *Hub) replyError(cl *client, id string, err error) {
	if err == nil {
		cl.conn.send(errorFrame(CodeUnknownRider, id, nil))
		return
	}
	if rejected, ok := apierr.As(err); ok {
		cl.conn.send(errorFrame(rejected.Code, id, nil))
		return
	}
	h.log.Error("my room command failed", "account", cl.accountID, "error", err)
	cl.conn.send(errorFrame(CodeInternal, id, nil))
}
