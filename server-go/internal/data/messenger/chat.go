package messenger

import (
	"context"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"kartsim/internal/shared/apierr"
)

// 聊天系统 (stage_globalChatSystem, MENUS.md 4): one server-wide channel and
// each club's channel. A socket joins with "chat-join" (and gets both
// histories); "chat" sends a line to the joined sockets of the channel.
// Lines are at most ChatMaxRunes (the release input maxChar 30) and share
// the private messages' flood limiter (CHAT_FLOOD, 10 s).

// Chat channels.
const (
	ChatAll  = "all"
	ChatClub = "club"
)

var (
	errInvalidChat   = apierr.New(http.StatusBadRequest, "INVALID_CHAT")
	errNotInChatClub = apierr.New(http.StatusConflict, "NOT_IN_CLUB")
)

// ChatMaxRunes is the longest chat line.
const ChatMaxRunes = 30

// chatHistory is how many lines a channel keeps for new joiners.
const chatHistory = 50

// ChatProfile is what a chat line names of its sender.
type ChatProfile struct {
	Nickname string
	ClubID   int64
	ClubName string
}

// ChatLine is one chat message.
type ChatLine struct {
	ID      uint64 `json:"id"`
	Channel string `json:"channel"`
	From    string `json:"from"`
	Text    string `json:"text"`
	At      int64  `json:"at"`
}

// chatRoom is a channel's recent lines.
type chatRoom struct{ lines []ChatLine }

func (r *chatRoom) add(line ChatLine) {
	r.lines = append(r.lines, line)
	if len(r.lines) > chatHistory {
		r.lines = append([]ChatLine(nil), r.lines[len(r.lines)-chatHistory:]...)
	}
}

func clubRoom(clubID int64) string {
	return "club:" + itoa(clubID)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for ; n > 0; n /= 10 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
	}
	return string(digits)
}

// cleanChat trims a line and checks it: 1-30 runes, no control characters.
func cleanChat(text string) (string, bool) {
	text = strings.TrimSpace(text)
	if text == "" || utf8.RuneCountInString(text) > ChatMaxRunes || !utf8.ValidString(text) {
		return text, false
	}
	for _, r := range text {
		if unicode.IsControl(r) {
			return text, false
		}
	}
	return text, true
}

// chatFrame is a line sent or heard.
type chatFrame struct {
	Type      string    `json:"type"`
	RequestID string    `json:"requestId,omitempty"`
	Line      *ChatLine `json:"line"`
}

// joinedFrame answers chat-join with both channels' recent lines.
type joinedFrame struct {
	Type      string     `json:"type"`
	RequestID string     `json:"requestId,omitempty"`
	All       []ChatLine `json:"all"`
	Club      []ChatLine `json:"club"`
	ClubName  string     `json:"clubName,omitempty"`
	HasClub   bool       `json:"hasClub"`
}

// chatJoin subscribes the account's sockets and answers the histories.
func (h *Hub) chatJoin(ctx context.Context, c *conn, requestID string) error {
	profile, err := h.backend.ChatProfile(ctx, c.accountID)
	if err != nil {
		return err
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.account == nil {
		return nil
	}
	c.account.chatJoined = true
	c.account.chatClub = profile.ClubID
	frame := joinedFrame{Type: "chat-joined", RequestID: requestID, All: []ChatLine{}, Club: []ChatLine{},
		ClubName: profile.ClubName, HasClub: profile.ClubID != 0}
	if room := h.rooms[ChatAll]; room != nil {
		frame.All = append(frame.All, room.lines...)
	}
	if profile.ClubID != 0 {
		if room := h.rooms[clubRoom(profile.ClubID)]; room != nil {
			frame.Club = append(frame.Club, room.lines...)
		}
	}
	c.send(encode(frame))
	return nil
}

// chatLeave stops chat frames for the account.
func (h *Hub) chatLeave(c *conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.account != nil {
		c.account.chatJoined = false
	}
}

// chatSend checks and broadcasts a line.
func (h *Hub) chatSend(ctx context.Context, c *conn, requestID, channel, text string) error {
	if channel != ChatAll && channel != ChatClub {
		return errInvalidChat
	}
	text, ok := cleanChat(text)
	if !ok {
		return errInvalidChat
	}
	profile, err := h.backend.ChatProfile(ctx, c.accountID)
	if err != nil {
		return err
	}
	if channel == ChatClub && profile.ClubID == 0 {
		return errNotInChatClub
	}
	if allowed, mutedUntil := h.AllowChat(c.accountID); !allowed {
		return &FloodError{MutedUntil: mutedUntil}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.account != nil {
		c.account.chatClub = profile.ClubID
	}
	line := ChatLine{ID: h.nextSeq(), Channel: channel, From: profile.Nickname, Text: text,
		At: h.opts.Now().UnixMilli()}
	key := ChatAll
	if channel == ChatClub {
		key = clubRoom(profile.ClubID)
	}
	room := h.rooms[key]
	if room == nil {
		room = &chatRoom{}
		h.rooms[key] = room
	}
	room.add(line)
	payload := encode(chatFrame{Type: "chat", Line: &line})
	for _, a := range h.accounts {
		if !a.chatJoined || (channel == ChatClub && a.chatClub != profile.ClubID) {
			continue
		}
		for _, socket := range a.conns {
			socket.send(payload)
		}
	}
	c.send(encode(chatFrame{Type: "chat-sent", RequestID: requestID, Line: &line}))
	return nil
}
