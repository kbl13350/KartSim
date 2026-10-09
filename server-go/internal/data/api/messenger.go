package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"kartsim/internal/data/messenger"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// Friends and private chat (DESIGN.md 9). Every route needs a Bearer
// session. Mutations answer the result and push {"type":"sync"} to every
// socket of each account whose messenger state changed; messages and
// presence are pushed granularly by the hub.

const (
	// messageLength is the longest private message in code points (the
	// release chatInput maxChar).
	messageLength = 30
	// maxNicknameLookup bounds a nickname a friend request may name
	// (accounts.nickname is VARCHAR(64)).
	maxNicknameLookup = 64
	defaultHistory    = 30
	maxHistory        = 100
)

var (
	errInvalidMessage  = apierr.New(http.StatusBadRequest, "INVALID_MESSAGE")
	errNotFriends      = apierr.New(http.StatusForbidden, "NOT_FRIENDS")
	errRequestNotFound = apierr.New(http.StatusNotFound, "REQUEST_NOT_FOUND")
	errFriendNotFound  = apierr.New(http.StatusNotFound, "FRIEND_NOT_FOUND")
	errBlockNotFound   = apierr.New(http.StatusNotFound, "BLOCK_NOT_FOUND")
)

// contactJSON is the identity part of every list entry.
type contactJSON struct {
	AccountID string `json:"accountId"`
	Nickname  string `json:"nickname"`
	Level     int    `json:"level"`
	Glove     string `json:"glove"`
}

type friendJSON struct {
	contactJSON
	Favorite bool   `json:"favorite"`
	Since    int64  `json:"since"`
	Presence string `json:"presence"`
}

type incomingJSON struct {
	contactJSON
	CreatedAt int64 `json:"createdAt"`
	ExpiresAt int64 `json:"expiresAt"`
}

type outgoingJSON struct {
	contactJSON
	State      string `json:"state"`
	CreatedAt  int64  `json:"createdAt"`
	ResolvedAt *int64 `json:"resolvedAt"`
	ExpiresAt  int64  `json:"expiresAt"`
}

type blockJSON struct {
	contactJSON
	Since int64 `json:"since"`
}

type conversationJSON struct {
	AccountID     string `json:"accountId"`
	Nickname      string `json:"nickname"`
	LastMessageID int64  `json:"lastMessageId"`
	LastMessageAt int64  `json:"lastMessageAt"`
	Unread        int    `json:"unread"`
	LastReadID    int64  `json:"lastReadId"`
}

type messengerLimits struct {
	Friends         int `json:"friends"`
	PendingOutgoing int `json:"pendingOutgoing"`
	Blocks          int `json:"blocks"`
	MessageLength   int `json:"messageLength"`
	RequestDays     int `json:"requestDays"`
	ResultDays      int `json:"resultDays"`
}

var limitsJSON = messengerLimits{Friends: store.MaxFriends, PendingOutgoing: store.MaxPendingOutgoing,
	Blocks: store.MaxBlocks, MessageLength: messageLength, RequestDays: store.RequestDays, ResultDays: store.ResultDays}

// stateJSON is the messenger State (GET /api/messenger/state and the
// socket's welcome).
type stateJSON struct {
	Me            contactJSON             `json:"me"`
	Settings      store.MessengerSettings `json:"settings"`
	Friends       []friendJSON            `json:"friends"`
	Incoming      []incomingJSON          `json:"incoming"`
	Outgoing      []outgoingJSON          `json:"outgoing"`
	Blocks        []blockJSON             `json:"blocks"`
	Conversations []conversationJSON      `json:"conversations"`
	Limits        messengerLimits         `json:"limits"`
	ServerTime    int64                   `json:"serverTime"`
}

func (a *API) contact(contact store.Contact) contactJSON {
	progress := a.progress(contact.Exp)
	return contactJSON{AccountID: contact.AccountID, Nickname: contact.Nickname, Level: progress.Level, Glove: progress.Glove}
}

func outgoing(contact contactJSON, request store.FriendRequest) outgoingJSON {
	return outgoingJSON{contactJSON: contact, State: request.State, CreatedAt: request.CreatedAt,
		ResolvedAt: request.ResolvedAt, ExpiresAt: request.ExpiresAt}
}

// accountsInGame reads game presence from Redis; without Redis nobody is
// in game (messenger presence still works).
func (a *API) accountsInGame(ctx context.Context, ids []string) map[string]bool {
	if a.cluster == nil || len(ids) == 0 {
		return map[string]bool{}
	}
	inGame, err := a.cluster.AccountsInGame(ctx, ids)
	if err != nil {
		a.log.Debug("game presence unavailable; friends shown without it", "error", err)
		return map[string]bool{}
	}
	return inGame
}

// friends adds presence to friend rows.
func (a *API) friends(ctx context.Context, rows []store.Friend) []friendJSON {
	ids := make([]string, len(rows))
	for i, row := range rows {
		ids[i] = row.AccountID
	}
	inGame := a.accountsInGame(ctx, ids)
	online := a.hub.Online(ids)
	friends := make([]friendJSON, len(rows))
	for i, row := range rows {
		friends[i] = friendJSON{contactJSON: a.contact(row.Contact), Favorite: row.Favorite, Since: row.Since,
			Presence: messenger.PresenceOf(row.Invisible, inGame[row.AccountID], online[row.AccountID])}
	}
	return friends
}

// loadMessengerState builds an account's State.
func (a *API) loadMessengerState(ctx context.Context, accountID string) (stateJSON, error) {
	now := a.nowMillis()
	loaded, found, err := a.store.MessengerState(ctx, accountID, now)
	if err != nil {
		return stateJSON{}, err
	}
	if !found {
		return stateJSON{}, errLoginRequired // the account was deleted under its session
	}
	state := stateJSON{
		Me:            a.contact(loaded.Me),
		Settings:      loaded.Settings,
		Friends:       a.friends(ctx, loaded.Friends),
		Incoming:      make([]incomingJSON, len(loaded.Incoming)),
		Outgoing:      make([]outgoingJSON, len(loaded.Outgoing)),
		Blocks:        make([]blockJSON, len(loaded.Blocks)),
		Conversations: make([]conversationJSON, len(loaded.Conversations)),
		Limits:        limitsJSON,
		ServerTime:    now,
	}
	for i, request := range loaded.Incoming {
		state.Incoming[i] = incomingJSON{contactJSON: a.contact(request.Contact), CreatedAt: request.CreatedAt,
			ExpiresAt: request.ExpiresAt}
	}
	for i, request := range loaded.Outgoing {
		state.Outgoing[i] = outgoing(a.contact(request.Contact), request)
	}
	for i, block := range loaded.Blocks {
		state.Blocks[i] = blockJSON{contactJSON: a.contact(block.Contact), Since: block.Since}
	}
	for i, conversation := range loaded.Conversations {
		state.Conversations[i] = conversationJSON(conversation)
	}
	return state, nil
}

func (a *API) messengerState(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	state, err := a.loadMessengerState(r.Context(), account.ID)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, state)
}

// messengerWrite resolves the session of a messenger mutation, counts it
// against the account write limit and decodes its body into target (when
// set).
func (a *API) messengerWrite(w http.ResponseWriter, r *http.Request, target any) (store.Account, error) {
	account, err := a.signedIn(r)
	if err != nil {
		return store.Account{}, err
	}
	if target != nil {
		if err := decodeJSON(w, r, target); err != nil {
			return store.Account{}, err
		}
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return store.Account{}, err
	}
	return account, nil
}

// validAccountID accepts what can be an accounts.id (a UUID, also for
// accounts migrated from the Java service); anything else names no account.
func validAccountID(id string) bool { return uuidPattern.MatchString(id) }

func ok(w http.ResponseWriter) error { return writeJSON(w, http.StatusOK, map[string]bool{"ok": true}) }

// friendRequest asks the account with a nickname to be friends; when it
// had already asked, the two become friends at once.
func (a *API) friendRequest(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Nickname *string `json:"nickname"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	ctx := r.Context()
	if err := a.friendRequestLimit(ctx, account.ID); err != nil {
		return err
	}
	nickname := ""
	if body.Nickname != nil {
		nickname = strings.TrimSpace(*body.Nickname)
	}
	if nickname == "" || utf8.RuneCountInString(nickname) > maxNicknameLookup {
		return errPlayerNotFound
	}
	out, err := a.store.SendFriendRequest(ctx, account.ID, nickname, a.nowMillis())
	if err != nil {
		return err
	}
	target := out.Target.AccountID
	a.hub.Sync(account.ID, target)
	if out.Accepted {
		a.hub.FriendsChanged(account.ID, target)
		a.hub.Notice(target, messenger.NoticeFriendAccepted, account.ID, account.Nickname)
		return writeJSON(w, http.StatusOK, struct {
			Friend   friendJSON `json:"friend"`
			Accepted bool       `json:"accepted"`
		}{a.friends(ctx, []store.Friend{out.Friend})[0], true})
	}
	a.hub.Notice(target, messenger.NoticeFriendRequest, account.ID, account.Nickname)
	return writeJSON(w, http.StatusOK, struct {
		Request outgoingJSON `json:"request"`
	}{outgoing(a.contact(out.Request.Contact), out.Request)})
}

func (a *API) friendRespond(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		AccountID string `json:"accountId"`
		Accept    *bool  `json:"accept"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if body.Accept == nil {
		return errInvalidRequest
	}
	if !validAccountID(body.AccountID) {
		return errRequestNotFound
	}
	ctx := r.Context()
	requester, friend, err := a.store.RespondFriendRequest(ctx, account.ID, body.AccountID, *body.Accept, a.nowMillis())
	if err != nil {
		return err
	}
	a.hub.Sync(account.ID, requester.AccountID)
	if !*body.Accept {
		a.hub.Notice(requester.AccountID, messenger.NoticeFriendRefused, account.ID, account.Nickname)
		return ok(w)
	}
	a.hub.FriendsChanged(account.ID, requester.AccountID)
	a.hub.Notice(requester.AccountID, messenger.NoticeFriendAccepted, account.ID, account.Nickname)
	return writeJSON(w, http.StatusOK, struct {
		Friend friendJSON `json:"friend"`
	}{a.friends(ctx, []store.Friend{friend})[0]})
}

// accountIDBody is the {accountId} body of several messenger routes.
type accountIDBody struct {
	AccountID string `json:"accountId"`
}

func (a *API) friendCancel(w http.ResponseWriter, r *http.Request) error {
	var body accountIDBody
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if !validAccountID(body.AccountID) {
		return errRequestNotFound
	}
	if err := a.store.CancelFriendRequest(r.Context(), account.ID, body.AccountID, a.nowMillis()); err != nil {
		return err
	}
	a.hub.Sync(account.ID, body.AccountID)
	return ok(w)
}

func (a *API) friendRemove(w http.ResponseWriter, r *http.Request) error {
	var body accountIDBody
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if !validAccountID(body.AccountID) {
		return errFriendNotFound
	}
	if err := a.store.RemoveFriend(r.Context(), account.ID, body.AccountID, a.nowMillis()); err != nil {
		return err
	}
	a.hub.FriendsChanged(account.ID, body.AccountID)
	a.hub.Sync(account.ID, body.AccountID)
	return ok(w)
}

func (a *API) friendFavorite(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		AccountID string `json:"accountId"`
		Favorite  *bool  `json:"favorite"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if body.Favorite == nil {
		return errInvalidRequest
	}
	if !validAccountID(body.AccountID) {
		return errFriendNotFound
	}
	ctx := r.Context()
	friend, err := a.store.SetFavorite(ctx, account.ID, body.AccountID, *body.Favorite)
	if err != nil {
		return err
	}
	a.hub.Sync(account.ID)
	return writeJSON(w, http.StatusOK, struct {
		Friend friendJSON `json:"friend"`
	}{a.friends(ctx, []store.Friend{friend})[0]})
}

// outboxClear hides my answered requests; the body is ignored.
func (a *API) outboxClear(w http.ResponseWriter, r *http.Request) error {
	account, err := a.messengerWrite(w, r, nil)
	if err != nil {
		return err
	}
	deleted, err := a.store.ClearOutbox(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	a.hub.Sync(account.ID)
	return writeJSON(w, http.StatusOK, map[string]int64{"deleted": deleted})
}

func (a *API) blockAdd(w http.ResponseWriter, r *http.Request) error {
	var body accountIDBody
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if !validAccountID(body.AccountID) {
		return errPlayerNotFound
	}
	block, err := a.store.AddBlock(r.Context(), account.ID, body.AccountID, a.nowMillis())
	if err != nil {
		return err
	}
	a.hub.FriendsChanged(account.ID, body.AccountID)
	a.hub.Sync(account.ID, body.AccountID)
	return writeJSON(w, http.StatusOK, struct {
		Block blockJSON `json:"block"`
	}{blockJSON{contactJSON: a.contact(block.Contact), Since: block.Since}})
}

func (a *API) blockRemove(w http.ResponseWriter, r *http.Request) error {
	var body accountIDBody
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if !validAccountID(body.AccountID) {
		return errBlockNotFound
	}
	if err := a.store.RemoveBlock(r.Context(), account.ID, body.AccountID); err != nil {
		return err
	}
	a.hub.Sync(account.ID)
	return ok(w)
}

// messengerSettings replaces the three switches; each one is required.
func (a *API) messengerSettings(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		BlockFriendRequests *bool `json:"blockFriendRequests"`
		BlockGameInvites    *bool `json:"blockGameInvites"`
		Invisible           *bool `json:"invisible"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if body.BlockFriendRequests == nil || body.BlockGameInvites == nil || body.Invisible == nil {
		return errInvalidRequest
	}
	settings := store.MessengerSettings{BlockFriendRequests: *body.BlockFriendRequests,
		BlockGameInvites: *body.BlockGameInvites, Invisible: *body.Invisible}
	if err := a.store.SaveMessengerSettings(r.Context(), account.ID, settings, a.nowMillis()); err != nil {
		return err
	}
	a.hub.SettingsChanged(account.ID, settings.Invisible)
	a.hub.Sync(account.ID)
	return writeJSON(w, http.StatusOK, settings)
}

func messageJSON(message store.PrivateMessage) messenger.Message {
	return messenger.Message{ID: message.ID, From: message.From, To: message.To, Text: message.Text,
		SentAt: message.SentAt, ClientID: message.ClientID}
}

// messengerHistory pages back through a conversation:
// ?with=<accountId>&before=<messageId>&limit=<1..100>.
func (a *API) messengerHistory(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	query := r.URL.Query()
	with := query.Get("with")
	if !validAccountID(with) || with == account.ID {
		return errInvalidAccountID
	}
	var before int64
	if value := query.Get("before"); value != "" {
		if before, err = strconv.ParseInt(value, 10, 64); err != nil || before < 1 {
			return errInvalidRequest
		}
	}
	limit := defaultHistory
	if value := query.Get("limit"); value != "" {
		if limit, err = strconv.Atoi(value); err != nil || limit < 1 || limit > maxHistory {
			return errInvalidRequest
		}
	}
	rows, more, err := a.store.PrivateMessages(r.Context(), account.ID, with, before, limit)
	if err != nil {
		return err
	}
	messages := make([]messenger.Message, len(rows))
	for i, row := range rows {
		messages[i] = messageJSON(row)
	}
	return writeJSON(w, http.StatusOK, struct {
		Messages []messenger.Message `json:"messages"`
		HasMore  bool                `json:"hasMore"`
	}{messages, more})
}

// trimMessage strips leading and trailing white space (what the browser's
// String.trim strips).
func trimMessage(text string) string {
	return strings.TrimFunc(text, func(r rune) bool { return unicode.IsSpace(r) || r == '\uFEFF' })
}

// sendMessage is the message rule shared by HTTP and the socket: the
// client id (INVALID_REQUEST_ID), the text (INVALID_MESSAGE), a repeat of a
// stored client id (answered as a duplicate without spending the chat
// limit, so a resend over HTTP after a dropped socket goes through), the
// chat flood limit (CHAT_FLOOD), then friendship (NOT_FRIENDS).
func (a *API) sendMessage(ctx context.Context, from, to, text, clientID string) (messenger.Message, bool, error) {
	clientID, err := requestID(clientID)
	if err != nil {
		return messenger.Message{}, false, err
	}
	text = trimMessage(text)
	if !validText(text, messageLength) {
		return messenger.Message{}, false, errInvalidMessage
	}
	if !validAccountID(to) {
		return messenger.Message{}, false, errNotFriends
	}
	if previous, found, err := a.store.MessageByClientID(ctx, from, clientID); err != nil {
		return messenger.Message{}, false, err
	} else if found {
		return messageJSON(previous), true, nil
	}
	if allowed, mutedUntil := a.hub.AllowChat(from); !allowed {
		return messenger.Message{}, false, &messenger.FloodError{MutedUntil: mutedUntil}
	}
	stored, duplicate, err := a.store.SendPrivateMessage(ctx, store.PrivateMessage{From: from, To: to, Text: text,
		SentAt: a.nowMillis(), ClientID: clientID})
	if err != nil {
		return messenger.Message{}, false, err
	}
	return messageJSON(stored), duplicate, nil
}

func (a *API) messengerSend(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		To       string `json:"to"`
		Text     string `json:"text"`
		ClientID string `json:"clientId"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	message, duplicate, err := a.sendMessage(r.Context(), account.ID, body.To, body.Text, body.ClientID)
	var flood *messenger.FloodError
	if errors.As(err, &flood) {
		return writeJSON(w, http.StatusTooManyRequests, struct {
			Error      string `json:"error"`
			MutedUntil int64  `json:"mutedUntil"`
		}{flood.Error(), flood.MutedUntil})
	}
	if err != nil {
		return err
	}
	if !duplicate {
		a.hub.Deliver(message)
	}
	return writeJSON(w, http.StatusOK, struct {
		Message   messenger.Message `json:"message"`
		Duplicate bool              `json:"duplicate"`
	}{message, duplicate})
}

// markRead moves the read mark; an id that names no account changes nothing.
func (a *API) markRead(ctx context.Context, accountID, with string, upTo int64) error {
	if !validAccountID(with) || with == accountID || upTo <= 0 {
		return nil
	}
	return a.store.MarkConversationRead(ctx, accountID, with, upTo, a.nowMillis())
}

func (a *API) messengerRead(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		With string `json:"with"`
		UpTo *int64 `json:"upTo"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if body.UpTo == nil {
		return errInvalidRequest
	}
	if err := a.markRead(r.Context(), account.ID, body.With, *body.UpTo); err != nil {
		return err
	}
	a.hub.Sync(account.ID)
	return ok(w)
}

func (a *API) conversationHide(w http.ResponseWriter, r *http.Request) error {
	var body struct {
		With string `json:"with"`
	}
	account, err := a.messengerWrite(w, r, &body)
	if err != nil {
		return err
	}
	if validAccountID(body.With) && body.With != account.ID {
		if err := a.store.HideConversation(r.Context(), account.ID, body.With, a.nowMillis()); err != nil {
			return err
		}
	}
	a.hub.Sync(account.ID)
	return ok(w)
}

// messengerRenamed tells everybody whose messenger state shows an
// account's nickname to reload it.
func (a *API) messengerRenamed(ctx context.Context, accountID string) {
	audience, err := a.store.MessengerAudience(ctx, accountID)
	if err != nil {
		a.log.Warn("messenger rename not pushed", "account", accountID, "error", err)
	}
	a.hub.Sync(append(audience, accountID)...)
}

// RunMessenger reconciles messenger game presence until ctx ends.
func (a *API) RunMessenger(ctx context.Context) { a.hub.Run(ctx) }

// ShutdownMessenger closes every messenger socket (http.Server.Shutdown
// does not track upgraded connections).
func (a *API) ShutdownMessenger(ctx context.Context) error { return a.hub.Shutdown(ctx) }

// messengerBackend is the data API as the messenger hub uses it.
type messengerBackend struct{ a *API }

var _ messenger.Backend = messengerBackend{}

func (b messengerBackend) Authenticate(ctx context.Context, token string) (messenger.Session, bool, error) {
	account, found, err := b.a.findAccount(ctx, &token)
	if err != nil || !found {
		return messenger.Session{}, false, err
	}
	return messenger.Session{AccountID: account.ID, Key: digest(token)}, true, nil
}

func (b messengerBackend) Welcome(ctx context.Context, accountID string) (any, error) {
	return b.a.loadMessengerState(ctx, accountID)
}

func (b messengerBackend) Roster(ctx context.Context, accountID string) (messenger.Roster, error) {
	invisible, rows, err := b.a.store.FriendRoster(ctx, accountID)
	if err != nil {
		return messenger.Roster{}, err
	}
	friends := make([]messenger.RosterFriend, len(rows))
	for i, row := range rows {
		friends[i] = messenger.RosterFriend(row)
	}
	return messenger.Roster{Invisible: invisible, Friends: friends}, nil
}

func (b messengerBackend) InGame(ctx context.Context, ids []string) (map[string]bool, error) {
	if b.a.cluster == nil {
		return map[string]bool{}, nil
	}
	return b.a.cluster.AccountsInGame(ctx, ids)
}

func (b messengerBackend) Send(ctx context.Context, from, to, text, clientID string) (messenger.Message, bool, error) {
	return b.a.sendMessage(ctx, from, to, text, clientID)
}

func (b messengerBackend) Read(ctx context.Context, accountID, with string, upTo int64) error {
	return b.a.markRead(ctx, accountID, with, upTo)
}
