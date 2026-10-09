package api

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
)

// The messenger HTTP tests need MySQL (KART_TEST_MYSQL_DSN).

type messengerContact struct {
	AccountID string `json:"accountId"`
	Nickname  string `json:"nickname"`
	Level     int    `json:"level"`
	Glove     string `json:"glove"`
}

type messengerFriend struct {
	messengerContact
	Favorite bool   `json:"favorite"`
	Since    int64  `json:"since"`
	Presence string `json:"presence"`
}

type messengerRequest struct {
	messengerContact
	State      string `json:"state"`
	CreatedAt  int64  `json:"createdAt"`
	ResolvedAt *int64 `json:"resolvedAt"`
	ExpiresAt  int64  `json:"expiresAt"`
}

type messengerConversation struct {
	AccountID     string `json:"accountId"`
	Nickname      string `json:"nickname"`
	LastMessageID int64  `json:"lastMessageId"`
	LastMessageAt int64  `json:"lastMessageAt"`
	Unread        int    `json:"unread"`
	LastReadID    int64  `json:"lastReadId"`
}

type messengerMessage struct {
	ID       int64  `json:"id"`
	From     string `json:"from"`
	To       string `json:"to"`
	Text     string `json:"text"`
	SentAt   int64  `json:"sentAt"`
	ClientID string `json:"clientId"`
}

type messengerStateBody struct {
	Me       messengerContact `json:"me"`
	Settings struct {
		BlockFriendRequests bool `json:"blockFriendRequests"`
		BlockGameInvites    bool `json:"blockGameInvites"`
		Invisible           bool `json:"invisible"`
	} `json:"settings"`
	Friends  []messengerFriend  `json:"friends"`
	Incoming []messengerRequest `json:"incoming"`
	Outgoing []messengerRequest `json:"outgoing"`
	Blocks   []struct {
		messengerContact
		Since int64 `json:"since"`
	} `json:"blocks"`
	Conversations []messengerConversation `json:"conversations"`
	Limits        map[string]int          `json:"limits"`
	ServerTime    int64                   `json:"serverTime"`
}

// messengerUser inserts an account with a session (no password hashing)
// and returns its id, nickname and token.
func (h *harness) messengerUser() (id, nickname, token string) {
	h.t.Helper()
	u := datatest.Unique()
	id, nickname, token = newUUID(), "Mu"+u, randomCode(32)
	now := time.Now().UnixMilli()
	datatest.Exec(h.t, h.db, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at)
		VALUES(?, ?, ?, 'x', 0, ?)`, id, "mu_"+u, nickname, now)
	h.cleanupAccount(id)
	datatest.Exec(h.t, h.db, "INSERT INTO sessions(token_hash, account_id, expires_at) VALUES(?, ?, ?)",
		digest(token), id, now+24*3600*1000)
	return id, nickname, token
}

func (h *harness) messengerState(token string) messengerStateBody {
	h.t.Helper()
	var state messengerStateBody
	h.get("/api/messenger/state", bearerHeader(token)).expect(h.t, http.StatusOK, "").json(h.t, &state)
	return state
}

// befriend makes two accounts friends through the API.
func (h *harness) befriend(tokenA, idA, nicknameB, tokenB string) {
	h.t.Helper()
	h.post("/api/messenger/friends/request", map[string]string{"nickname": nicknameB}, bearerHeader(tokenA)).
		expect(h.t, http.StatusOK, "")
	h.post("/api/messenger/friends/respond", map[string]any{"accountId": idA, "accept": true}, bearerHeader(tokenB)).
		expect(h.t, http.StatusOK, "")
}

func TestMessengerNeedsLogin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.get("/api/messenger/state", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.post("/api/messenger/friends/request", map[string]string{"nickname": "x"}, nil).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	h.put("/api/messenger/settings", map[string]bool{}, bearerHeader("not-a-token")).
		expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	// A plain GET of the socket path is not an upgrade.
	h.get("/api/messenger/ws", nil).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
}

func TestMessengerFriendsHTTP(t *testing.T) {
	h := newHarness(t, harnessOptions{mysql: true})
	idA, nickA, tokenA := h.messengerUser()
	idB, nickB, tokenB := h.messengerUser()
	idC, nickC, tokenC := h.messengerUser()
	a, b, c := bearerHeader(tokenA), bearerHeader(tokenB), bearerHeader(tokenC)

	state := h.messengerState(tokenA)
	if state.Me.AccountID != idA || state.Me.Nickname != nickA || state.Me.Level != 1 || state.Me.Glove == "" ||
		len(state.Friends) != 0 || state.Friends == nil || state.Incoming == nil || state.Conversations == nil ||
		state.Limits["friends"] != 100 || state.Limits["pendingOutgoing"] != 30 || state.Limits["blocks"] != 100 ||
		state.Limits["messageLength"] != 30 || state.Limits["requestDays"] != 7 || state.Limits["resultDays"] != 7 ||
		state.Settings.Invisible || state.ServerTime == 0 {
		t.Fatalf("initial state %+v", state)
	}

	request := "/api/messenger/friends/request"
	h.post(request, map[string]string{"nickname": nickA}, a).expect(t, http.StatusBadRequest, "CANNOT_ADD_SELF")
	h.post(request, map[string]string{"nickname": "nobody" + datatest.Unique()}, a).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
	h.post(request, map[string]any{}, a).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
	h.post(request, `{"nickname":`, a).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	var sent struct {
		Request messengerRequest `json:"request"`
	}
	h.post(request, map[string]string{"nickname": " " + strings.ToLower(nickB) + " "}, a).
		expect(t, http.StatusOK, "").json(t, &sent)
	if sent.Request.AccountID != idB || sent.Request.Nickname != nickB || sent.Request.State != "pending" ||
		sent.Request.ResolvedAt != nil || sent.Request.ExpiresAt-sent.Request.CreatedAt != 7*24*3600*1000 {
		t.Fatalf("request %+v", sent.Request)
	}
	h.post(request, map[string]string{"nickname": nickB}, a).expect(t, http.StatusConflict, "REQUEST_PENDING")
	if state := h.messengerState(tokenB); len(state.Incoming) != 1 || state.Incoming[0].AccountID != idA {
		t.Fatalf("incoming %+v", state.Incoming)
	}

	respond := "/api/messenger/friends/respond"
	h.post(respond, map[string]any{"accountId": idA}, b).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post(respond, map[string]any{"accountId": "x y", "accept": true}, b).expect(t, http.StatusNotFound, "REQUEST_NOT_FOUND")
	h.post(respond, map[string]any{"accountId": idC, "accept": true}, b).expect(t, http.StatusNotFound, "REQUEST_NOT_FOUND")
	var accepted struct {
		Friend messengerFriend `json:"friend"`
	}
	h.post(respond, map[string]any{"accountId": idA, "accept": true}, b).expect(t, http.StatusOK, "").json(t, &accepted)
	if accepted.Friend.AccountID != idA || accepted.Friend.Presence != "offline" || accepted.Friend.Favorite {
		t.Fatalf("accepted %+v", accepted.Friend)
	}
	state = h.messengerState(tokenA)
	if len(state.Friends) != 1 || state.Friends[0].AccountID != idB || state.Friends[0].Nickname != nickB ||
		len(state.Outgoing) != 1 || state.Outgoing[0].State != "accepted" || state.Outgoing[0].ResolvedAt == nil {
		t.Fatalf("state after acceptance %+v", state)
	}
	h.post(request, map[string]string{"nickname": nickB}, a).expect(t, http.StatusConflict, "ALREADY_FRIENDS")

	favorite := "/api/messenger/friends/favorite"
	h.post(favorite, map[string]any{"accountId": idB}, a).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post(favorite, map[string]any{"accountId": idC, "favorite": true}, a).expect(t, http.StatusNotFound, "FRIEND_NOT_FOUND")
	var favored struct {
		Friend messengerFriend `json:"friend"`
	}
	h.post(favorite, map[string]any{"accountId": idB, "favorite": true}, a).expect(t, http.StatusOK, "").json(t, &favored)
	if !favored.Friend.Favorite || favored.Friend.AccountID != idB {
		t.Fatalf("favorite %+v", favored.Friend)
	}
	var cleared struct{ Deleted int }
	h.post("/api/messenger/outbox/clear", nil, a).expect(t, http.StatusOK, "").json(t, &cleared)
	if cleared.Deleted != 1 || len(h.messengerState(tokenA).Outgoing) != 0 {
		t.Fatalf("outbox clear %+v", cleared)
	}

	// Refusal and its cooldown, cancel.
	h.post(request, map[string]string{"nickname": nickA}, c).expect(t, http.StatusOK, "")
	h.post(respond, map[string]any{"accountId": idC, "accept": false}, a).expect(t, http.StatusOK, "")
	h.post(request, map[string]string{"nickname": nickA}, c).expect(t, http.StatusConflict, "REQUEST_COOLDOWN")
	if state := h.messengerState(tokenC); len(state.Outgoing) != 1 || state.Outgoing[0].State != "refused" {
		t.Fatalf("refused outbox %+v", state.Outgoing)
	}
	h.post(request, map[string]string{"nickname": nickC}, b).expect(t, http.StatusOK, "")
	h.post("/api/messenger/friends/cancel", map[string]string{"accountId": idC}, b).expect(t, http.StatusOK, "")
	h.post("/api/messenger/friends/cancel", map[string]string{"accountId": idC}, b).
		expect(t, http.StatusNotFound, "REQUEST_NOT_FOUND")

	// Remove.
	h.post("/api/messenger/friends/remove", map[string]string{"accountId": idA}, b).expect(t, http.StatusOK, "")
	h.post("/api/messenger/friends/remove", map[string]string{"accountId": idA}, b).
		expect(t, http.StatusNotFound, "FRIEND_NOT_FOUND")

	// Blocks.
	blocks := "/api/messenger/blocks/add"
	h.post(blocks, map[string]string{"accountId": idA}, a).expect(t, http.StatusBadRequest, "CANNOT_BLOCK_SELF")
	h.post(blocks, map[string]string{"accountId": newUUID()}, a).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
	var blocked struct {
		Block struct {
			messengerContact
			Since int64 `json:"since"`
		} `json:"block"`
	}
	h.post(blocks, map[string]string{"accountId": idB}, a).expect(t, http.StatusOK, "").json(t, &blocked)
	if blocked.Block.AccountID != idB || blocked.Block.Nickname != nickB || blocked.Block.Since == 0 {
		t.Fatalf("block %+v", blocked.Block)
	}
	h.post(request, map[string]string{"nickname": nickA}, b).expect(t, http.StatusForbidden, "FRIEND_REQUESTS_BLOCKED")
	h.post(request, map[string]string{"nickname": nickB}, a).expect(t, http.StatusConflict, "BLOCKED_TARGET")
	if state := h.messengerState(tokenA); len(state.Blocks) != 1 || state.Blocks[0].AccountID != idB {
		t.Fatalf("blocks %+v", state.Blocks)
	}
	h.post("/api/messenger/blocks/remove", map[string]string{"accountId": idB}, a).expect(t, http.StatusOK, "")
	h.post("/api/messenger/blocks/remove", map[string]string{"accountId": idB}, a).
		expect(t, http.StatusNotFound, "BLOCK_NOT_FOUND")

	// Settings: all three switches are required.
	settings := "/api/messenger/settings"
	h.put(settings, map[string]bool{"blockFriendRequests": true}, b).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	var saved map[string]bool
	h.put(settings, map[string]bool{"blockFriendRequests": true, "blockGameInvites": true, "invisible": false}, b).
		expect(t, http.StatusOK, "").json(t, &saved)
	if !saved["blockFriendRequests"] || !saved["blockGameInvites"] || saved["invisible"] || len(saved) != 3 {
		t.Fatalf("settings %v", saved)
	}
	if state := h.messengerState(tokenB); !state.Settings.BlockFriendRequests || !state.Settings.BlockGameInvites {
		t.Fatalf("settings in state %+v", state.Settings)
	}
	h.post(request, map[string]string{"nickname": nickB}, a).expect(t, http.StatusForbidden, "FRIEND_REQUESTS_BLOCKED")
}

func TestMessengerMessagesHTTP(t *testing.T) {
	clock := newFakeClock(time.Now())
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	idA, _, tokenA := h.messengerUser()
	idB, nickB, tokenB := h.messengerUser()
	idC, _, _ := h.messengerUser()
	a, b := bearerHeader(tokenA), bearerHeader(tokenB)
	h.befriend(tokenA, idA, nickB, tokenB)
	clientID := func(i int) string { return fmt.Sprintf("30000000-0000-4000-8000-%012d", i) }
	messages := "/api/messenger/messages"

	h.post(messages, map[string]string{"to": idB, "text": "hi", "clientId": "nope"}, a).
		expect(t, http.StatusBadRequest, "INVALID_REQUEST_ID")
	for _, text := range []string{"", "   ", strings.Repeat("长", 31), "a\u0007b"} {
		h.post(messages, map[string]string{"to": idB, "text": text, "clientId": clientID(1)}, a).
			expect(t, http.StatusBadRequest, "INVALID_MESSAGE")
	}
	h.post(messages, map[string]string{"to": idC, "text": "hi", "clientId": clientID(1)}, a).
		expect(t, http.StatusForbidden, "NOT_FRIENDS")
	var sent struct {
		Message   messengerMessage `json:"message"`
		Duplicate bool             `json:"duplicate"`
	}
	h.post(messages, map[string]string{"to": idB, "text": "  " + strings.Repeat("长", 30) + "　", "clientId": clientID(2)}, a).
		expect(t, http.StatusOK, "").json(t, &sent)
	if sent.Duplicate || sent.Message.From != idA || sent.Message.To != idB || sent.Message.Text != strings.Repeat("长", 30) ||
		sent.Message.ClientID != clientID(2) || sent.Message.SentAt != clock.millis() {
		t.Fatalf("sent %+v", sent)
	}
	first := sent.Message
	h.post(messages, map[string]string{"to": idB, "text": "again", "clientId": strings.ToUpper(clientID(2))}, a).
		expect(t, http.StatusOK, "").json(t, &sent)
	if !sent.Duplicate || sent.Message != first {
		t.Fatalf("resend %+v", sent)
	}
	clock.advance(10 * time.Second)
	for i := 3; i <= 5; i++ {
		h.post(messages, map[string]string{"to": idA, "text": fmt.Sprint("m", i), "clientId": clientID(i)}, b).
			expect(t, http.StatusOK, "")
	}
	state := h.messengerState(tokenA)
	if len(state.Conversations) != 1 || state.Conversations[0].AccountID != idB || state.Conversations[0].Nickname != nickB ||
		state.Conversations[0].Unread != 3 {
		t.Fatalf("conversations %+v", state.Conversations)
	}

	history := "/api/messenger/messages?with="
	h.get(history+"x", a).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_ID")
	h.get(history+idA, a).expect(t, http.StatusBadRequest, "INVALID_ACCOUNT_ID")
	h.get(history+idB+"&limit=0", a).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.get(history+idB+"&limit=101", a).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.get(history+idB+"&before=x", a).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	var page struct {
		Messages []messengerMessage `json:"messages"`
		HasMore  bool               `json:"hasMore"`
	}
	h.get(history+idB+"&limit=2", a).expect(t, http.StatusOK, "").json(t, &page)
	if !page.HasMore || len(page.Messages) != 2 || page.Messages[0].Text != "m4" || page.Messages[1].Text != "m5" {
		t.Fatalf("page %+v", page)
	}
	m4 := page.Messages[0].ID
	h.get(history+idB+fmt.Sprintf("&before=%d", page.Messages[0].ID), a).expect(t, http.StatusOK, "").json(t, &page)
	if page.HasMore || len(page.Messages) != 2 || page.Messages[0].ID != first.ID || page.Messages[1].Text != "m3" {
		t.Fatalf("older page %+v", page)
	}

	h.post("/api/messenger/read", map[string]any{"with": idB}, a).expect(t, http.StatusBadRequest, "INVALID_REQUEST")
	h.post("/api/messenger/read", map[string]any{"with": idB, "upTo": m4}, a).expect(t, http.StatusOK, "")
	if state := h.messengerState(tokenA); state.Conversations[0].Unread != 1 || state.Conversations[0].LastReadID != m4 {
		t.Fatalf("after reading %+v", state.Conversations)
	}
	h.post("/api/messenger/conversations/hide", map[string]any{"with": idB}, a).expect(t, http.StatusOK, "")
	if state := h.messengerState(tokenA); len(state.Conversations) != 0 {
		t.Fatalf("hidden conversation listed %+v", state.Conversations)
	}
	h.get(history+idB, a).expect(t, http.StatusOK, "").json(t, &page)
	if len(page.Messages) != 0 {
		t.Fatalf("hidden log %+v", page)
	}
	h.get(history+idA, b).expect(t, http.StatusOK, "").json(t, &page)
	if len(page.Messages) != 4 {
		t.Fatalf("b's log %+v", page)
	}
}

func TestMessengerChatFloodHTTP(t *testing.T) {
	clock := newFakeClock(time.Now())
	h := newHarness(t, harnessOptions{mysql: true, now: clock.now})
	idA, _, tokenA := h.messengerUser()
	idB, nickB, tokenB := h.messengerUser()
	h.befriend(tokenA, idA, nickB, tokenB)
	for i := range 5 {
		h.post("/api/messenger/messages", map[string]string{"to": idB, "text": "x",
			"clientId": fmt.Sprintf("40000000-0000-4000-8000-%012d", i)}, bearerHeader(tokenA)).expect(t, http.StatusOK, "")
	}
	var flood struct {
		Error      string `json:"error"`
		MutedUntil int64  `json:"mutedUntil"`
	}
	h.post("/api/messenger/messages", map[string]string{"to": idB, "text": "x",
		"clientId": "40000000-0000-4000-8000-000000000009"}, bearerHeader(tokenA)).
		expect(t, http.StatusTooManyRequests, "CHAT_FLOOD").json(t, &flood)
	if flood.MutedUntil != clock.millis()+10_000 {
		t.Fatalf("muted until %d, now %d", flood.MutedUntil, clock.millis())
	}
	clock.advance(10 * time.Second)
	h.post("/api/messenger/messages", map[string]string{"to": idB, "text": "x",
		"clientId": "40000000-0000-4000-8000-000000000009"}, bearerHeader(tokenA)).expect(t, http.StatusOK, "")
}

func TestFriendRequestRateLimit(t *testing.T) {
	limits := generousLimits()
	limits.FriendRequests = 2
	h := newHarness(t, harnessOptions{mysql: true, limits: &limits})
	_, _, token := h.messengerUser()
	for range 2 {
		h.post("/api/messenger/friends/request", map[string]string{"nickname": "nobody" + datatest.Unique()},
			bearerHeader(token)).expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
	}
	h.post("/api/messenger/friends/request", map[string]string{"nickname": "nobody"}, bearerHeader(token)).
		expect(t, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	// Without Redis the limit lets requests through.
	h.redis.SetError("ERR down")
	h.post("/api/messenger/friends/request", map[string]string{"nickname": "nobody"}, bearerHeader(token)).
		expect(t, http.StatusNotFound, "PLAYER_NOT_FOUND")
}
