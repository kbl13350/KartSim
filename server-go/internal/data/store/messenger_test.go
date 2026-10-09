package store_test

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

var beijing = time.FixedZone("UTC+8", 8*60*60)

// messengerAccounts inserts n accounts (nicknames Mf<u><i>) and deletes
// them, with everything that cascades, after the test.
func messengerAccounts(t *testing.T, db *sql.DB, n int) (ids, nicknames []string) {
	t.Helper()
	u := datatest.Unique()
	values := make([]string, 0, n)
	args := make([]any, 0, 3*n)
	for i := range n {
		id := fmt.Sprintf("00000000-0000-4000-8000-%s%02x", u, i)
		nickname := fmt.Sprintf("Mf%s%d", u, i)
		ids, nicknames = append(ids, id), append(nicknames, nickname)
		values = append(values, "(?, ?, ?, 'x', 0, 0)")
		args = append(args, id, fmt.Sprintf("mf_%s_%d", u, i), nickname)
	}
	datatest.Exec(t, db, "INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at) VALUES "+
		strings.Join(values, ", "), args...)
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM accounts WHERE username LIKE ?", "mf\\_"+u+"\\_%") })
	return ids, nicknames
}

func expectCode(t *testing.T, err error, code string) {
	t.Helper()
	rejected, ok := apierr.As(err)
	if !ok || rejected.Code != code {
		t.Fatalf("error %v, want %s", err, code)
	}
}

func messengerState(t *testing.T, st *store.Store, id string, now int64) store.MessengerState {
	t.Helper()
	state, found, err := st.MessengerState(context.Background(), id, now)
	if err != nil || !found {
		t.Fatalf("state of %s: found %v, %v", id, found, err)
	}
	return state
}

func TestSchemaVersion4(t *testing.T) {
	db := datatest.MySQL(t)
	for _, table := range []string{"messenger_settings", "friendships", "friend_requests", "account_blocks",
		"private_messages", "private_conversations"} {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.tables
			WHERE table_schema = DATABASE() AND table_name = ?`, table).Scan(&n); err != nil || n != 1 {
			t.Fatalf("table %s missing: %v", table, err)
		}
	}
	// Re-applying version 4 (a crash after its DDL, before it was recorded)
	// must not fail on the existing tables.
	if _, err := db.Exec("DELETE FROM schema_migrations WHERE version = 4"); err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(context.Background(), db, datatest.Logger()); err != nil {
		t.Fatalf("re-applying version 4: %v", err)
	}
	// Deleting an account removes its messenger rows on both sides.
	ids, _ := messengerAccounts(t, db, 2)
	a, b := ids[0], ids[1]
	datatest.Exec(t, db, "INSERT INTO friendships(account_id, friend_id, created_at) VALUES(?, ?, 1), (?, ?, 1)", a, b, b, a)
	datatest.Exec(t, db, "INSERT INTO account_blocks(account_id, blocked_id, created_at) VALUES(?, ?, 1)", b, a)
	datatest.Exec(t, db, `INSERT INTO private_messages(low_id, high_id, sender_id, client_id, body, created_at)
		VALUES(?, ?, ?, 'c', 'hi', 1)`, min(a, b), max(a, b), a)
	datatest.Exec(t, db, "DELETE FROM accounts WHERE id = ?", a)
	var left int
	if err := db.QueryRow(`SELECT (SELECT COUNT(*) FROM friendships WHERE friend_id = ? OR account_id = ?)
		+ (SELECT COUNT(*) FROM account_blocks WHERE blocked_id = ?)
		+ (SELECT COUNT(*) FROM private_messages WHERE low_id = ? OR high_id = ?)`, a, a, a, a, a).Scan(&left); err != nil || left != 0 {
		t.Fatalf("%d rows outlived the account, %v", left, err)
	}
}

func TestFriendRequestLifecycle(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 3)
	a, b, c := ids[0], ids[1], ids[2]
	at := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing)
	now := at.UnixMilli()

	_, err := st.SendFriendRequest(ctx, a, "nobody-"+datatest.Unique(), now)
	expectCode(t, err, "PLAYER_NOT_FOUND")
	_, err = st.SendFriendRequest(ctx, a, nicknames[0], now)
	expectCode(t, err, "CANNOT_ADD_SELF")
	// Nicknames compare case-insensitively.
	out, err := st.SendFriendRequest(ctx, a, strings.ToUpper(nicknames[1]), now)
	if err != nil || out.Accepted || out.Target.AccountID != b || out.Request.State != store.RequestPending ||
		out.Request.ExpiresAt != now+7*24*3600*1000 {
		t.Fatalf("request: %+v, %v", out, err)
	}
	_, err = st.SendFriendRequest(ctx, a, nicknames[1], now+1)
	expectCode(t, err, "REQUEST_PENDING")
	state := messengerState(t, st, b, now+2)
	if len(state.Incoming) != 1 || state.Incoming[0].AccountID != a || state.Incoming[0].Nickname != nicknames[0] {
		t.Fatalf("incoming of b: %+v", state.Incoming)
	}
	if state := messengerState(t, st, a, now+2); len(state.Outgoing) != 1 || state.Outgoing[0].State != store.RequestPending ||
		state.Outgoing[0].ResolvedAt != nil {
		t.Fatalf("outgoing of a: %+v", state.Outgoing)
	}

	// b refuses: a may ask again from the next 06:00 Beijing time.
	requester, _, err := st.RespondFriendRequest(ctx, b, a, false, now+10)
	if err != nil || requester.AccountID != a {
		t.Fatalf("refuse: %+v, %v", requester, err)
	}
	_, _, err = st.RespondFriendRequest(ctx, b, a, false, now+11)
	expectCode(t, err, "REQUEST_NOT_FOUND")
	if state := messengerState(t, st, a, now+20); len(state.Outgoing) != 1 || state.Outgoing[0].State != store.RequestRefused ||
		state.Outgoing[0].ResolvedAt == nil || *state.Outgoing[0].ResolvedAt != now+10 {
		t.Fatalf("outgoing after refusal: %+v", state.Outgoing)
	}
	if state := messengerState(t, st, b, now+20); len(state.Incoming) != 0 {
		t.Fatalf("incoming after refusal: %+v", state.Incoming)
	}
	_, err = st.SendFriendRequest(ctx, a, nicknames[1], time.Date(2026, 10, 10, 5, 59, 0, 0, beijing).UnixMilli())
	expectCode(t, err, "REQUEST_COOLDOWN")
	next := time.Date(2026, 10, 10, 6, 0, 0, 0, beijing).UnixMilli()
	if out, err := st.SendFriendRequest(ctx, a, nicknames[1], next); err != nil || out.Request.State != store.RequestPending {
		t.Fatalf("request after the cooldown: %+v, %v", out, err)
	}

	// b accepts; both list each other and a's card shows the result.
	_, friend, err := st.RespondFriendRequest(ctx, b, a, true, next+1)
	if err != nil || friend.AccountID != a || friend.Since != next+1 || friend.Favorite {
		t.Fatalf("accept: %+v, %v", friend, err)
	}
	stateA, stateB := messengerState(t, st, a, next+2), messengerState(t, st, b, next+2)
	if len(stateA.Friends) != 1 || stateA.Friends[0].AccountID != b || len(stateB.Friends) != 1 || stateB.Friends[0].AccountID != a {
		t.Fatalf("friends: %+v / %+v", stateA.Friends, stateB.Friends)
	}
	if len(stateA.Outgoing) != 1 || stateA.Outgoing[0].State != store.RequestAccepted {
		t.Fatalf("outgoing after acceptance: %+v", stateA.Outgoing)
	}
	_, err = st.SendFriendRequest(ctx, b, nicknames[0], next+3)
	expectCode(t, err, "ALREADY_FRIENDS")

	// Favorite, remove, and the outbox clean-up.
	if friend, err := st.SetFavorite(ctx, a, b, true); err != nil || !friend.Favorite {
		t.Fatalf("favorite: %+v, %v", friend, err)
	}
	_, err = st.SetFavorite(ctx, a, c, true)
	expectCode(t, err, "FRIEND_NOT_FOUND")
	if cleared, err := st.ClearOutbox(ctx, a, next+4); err != nil || cleared != 1 {
		t.Fatalf("cleared %d, %v", cleared, err)
	}
	if state := messengerState(t, st, a, next+5); len(state.Outgoing) != 0 {
		t.Fatalf("outbox not cleared: %+v", state.Outgoing)
	}
	if err := st.RemoveFriend(ctx, b, a, next+6); err != nil {
		t.Fatal(err)
	}
	expectCode(t, st.RemoveFriend(ctx, b, a, next+7), "FRIEND_NOT_FOUND")
	if state := messengerState(t, st, a, next+8); len(state.Friends) != 0 {
		t.Fatalf("friend not removed: %+v", state.Friends)
	}

	// A request to someone who asked me first is accepted at once.
	if _, err := st.SendFriendRequest(ctx, c, nicknames[0], next+10); err != nil {
		t.Fatal(err)
	}
	out, err = st.SendFriendRequest(ctx, a, nicknames[2], next+11)
	if err != nil || !out.Accepted || out.Friend.AccountID != c {
		t.Fatalf("mutual request: %+v, %v", out, err)
	}
	if state := messengerState(t, st, c, next+12); len(state.Outgoing) != 1 || state.Outgoing[0].State != store.RequestAccepted ||
		len(state.Friends) != 1 {
		t.Fatalf("state of c: %+v", state)
	}

	// Cancel withdraws only a pending request.
	expectCode(t, st.CancelFriendRequest(ctx, c, a, next+13), "REQUEST_NOT_FOUND")
	if err := st.RemoveFriend(ctx, a, c, next+14); err != nil {
		t.Fatal(err)
	}
	if _, err := st.SendFriendRequest(ctx, c, nicknames[0], next+15); err != nil {
		t.Fatal(err)
	}
	if err := st.CancelFriendRequest(ctx, c, a, next+16); err != nil {
		t.Fatal(err)
	}
	if state := messengerState(t, st, a, next+17); len(state.Incoming) != 0 {
		t.Fatalf("cancelled request still incoming: %+v", state.Incoming)
	}
}

func TestFriendRequestExpiry(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 2)
	a, b := ids[0], ids[1]
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing).UnixMilli()
	week := int64(7 * 24 * 3600 * 1000)
	if _, err := st.SendFriendRequest(ctx, a, nicknames[1], now); err != nil {
		t.Fatal(err)
	}
	// Before the hourly sweep reaches it, an expired request already reads
	// as refused at its expiry.
	later := now + week + 1
	if state := messengerState(t, st, b, later); len(state.Incoming) != 0 {
		t.Fatalf("expired request still incoming: %+v", state.Incoming)
	}
	state := messengerState(t, st, a, later)
	if len(state.Outgoing) != 1 || state.Outgoing[0].State != store.RequestRefused ||
		*state.Outgoing[0].ResolvedAt != now+week || state.Outgoing[0].ExpiresAt != now+2*week {
		t.Fatalf("outgoing after expiry: %+v", state.Outgoing)
	}
	_, _, err := st.RespondFriendRequest(ctx, b, a, true, later)
	expectCode(t, err, "REQUEST_NOT_FOUND")
	// The automatic refusal has the same cooldown as an answer.
	_, err = st.SendFriendRequest(ctx, a, nicknames[1], later)
	expectCode(t, err, "REQUEST_COOLDOWN")
	if state := messengerState(t, st, a, now+2*week); len(state.Outgoing) != 0 {
		t.Fatalf("result past its outbox time: %+v", state.Outgoing)
	}
}

func TestBlocksAndSettings(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 3)
	a, b, c := ids[0], ids[1], ids[2]
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing).UnixMilli()
	if _, err := st.SendFriendRequest(ctx, a, nicknames[1], now); err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.RespondFriendRequest(ctx, b, a, true, now+1); err != nil {
		t.Fatal(err)
	}
	if _, err := st.SendFriendRequest(ctx, c, nicknames[0], now+2); err != nil {
		t.Fatal(err)
	}
	_, err := st.AddBlock(ctx, a, a, now+3)
	expectCode(t, err, "CANNOT_BLOCK_SELF")
	_, err = st.AddBlock(ctx, a, "00000000-0000-4000-8000-000000000000", now+3)
	expectCode(t, err, "PLAYER_NOT_FOUND")
	// Blocking ends the friendship and drops the requests both ways.
	for _, target := range []string{b, c} {
		block, err := st.AddBlock(ctx, a, target, now+4)
		if err != nil || block.AccountID != target || block.Since != now+4 {
			t.Fatalf("block: %+v, %v", block, err)
		}
	}
	if again, err := st.AddBlock(ctx, a, b, now+5); err != nil || again.Since != now+4 {
		t.Fatalf("repeated block: %+v, %v", again, err)
	}
	state := messengerState(t, st, a, now+6)
	if len(state.Friends) != 0 || len(state.Incoming) != 0 || len(state.Blocks) != 2 {
		t.Fatalf("state after blocking: %+v", state)
	}
	if state := messengerState(t, st, b, now+6); len(state.Friends) != 0 {
		t.Fatalf("blocked account keeps the friendship: %+v", state.Friends)
	}
	_, err = st.SendFriendRequest(ctx, a, nicknames[1], now+7)
	expectCode(t, err, "BLOCKED_TARGET")
	_, err = st.SendFriendRequest(ctx, b, nicknames[0], now+7)
	expectCode(t, err, "FRIEND_REQUESTS_BLOCKED")
	if err := st.RemoveBlock(ctx, a, b); err != nil {
		t.Fatal(err)
	}
	expectCode(t, st.RemoveBlock(ctx, a, b), "BLOCK_NOT_FOUND")

	// The friend request setting.
	settings := store.MessengerSettings{BlockFriendRequests: true, Invisible: true}
	if err := st.SaveMessengerSettings(ctx, b, settings, now+8); err != nil {
		t.Fatal(err)
	}
	if got := messengerState(t, st, b, now+9).Settings; got != settings {
		t.Fatalf("settings %+v", got)
	}
	_, err = st.SendFriendRequest(ctx, a, nicknames[1], now+10)
	expectCode(t, err, "FRIEND_REQUESTS_BLOCKED")
	// ...but b may still ask a, and the roster shows b's invisibility.
	if out, err := st.SendFriendRequest(ctx, b, nicknames[0], now+11); err != nil || out.Accepted {
		t.Fatalf("request from b: %+v, %v", out, err)
	}
	if _, _, err := st.RespondFriendRequest(ctx, a, b, true, now+12); err != nil {
		t.Fatal(err)
	}
	invisible, friends, err := st.FriendRoster(ctx, a)
	if err != nil || invisible || len(friends) != 1 || friends[0].AccountID != b || !friends[0].Invisible {
		t.Fatalf("roster: %v %+v, %v", invisible, friends, err)
	}
	// a's nickname shows in b's friend list and outbox; c, whom a blocked,
	// does not see it anywhere.
	audience, err := st.MessengerAudience(ctx, a)
	if err != nil || len(audience) != 1 || audience[0] != b {
		t.Fatalf("audience %v, %v", audience, err)
	}
}

func TestMessengerLimits(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 104)
	a, b, c := ids[0], ids[1], ids[2]
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing).UnixMilli()
	// 30 pending requests are the most a can have.
	for i := 3; i < 3+store.MaxPendingOutgoing; i++ {
		if _, err := st.SendFriendRequest(ctx, a, nicknames[i], now); err != nil {
			t.Fatal(err)
		}
	}
	_, err := st.SendFriendRequest(ctx, a, nicknames[1], now)
	expectCode(t, err, "REQUEST_LIMIT")
	datatest.Exec(t, db, "DELETE FROM friend_requests WHERE from_id = ?", a)

	// 100 friends: neither a nor anybody asking a may add more.
	var values []string
	var args []any
	for _, friend := range ids[4:] {
		values = append(values, "(?, ?, 0, 1)")
		args = append(args, a, friend)
	}
	datatest.Exec(t, db, "INSERT INTO friendships(account_id, friend_id, favorite, created_at) VALUES "+
		strings.Join(values, ", "), args...)
	_, err = st.SendFriendRequest(ctx, a, nicknames[1], now)
	expectCode(t, err, "FRIEND_LIMIT")
	_, err = st.SendFriendRequest(ctx, b, nicknames[0], now)
	expectCode(t, err, "TARGET_FRIEND_LIMIT")
	// A request made before the limit was reached cannot be accepted either.
	datatest.Exec(t, db, `INSERT INTO friend_requests(from_id, to_id, state, created_at, expires_at)
		VALUES(?, ?, 'pending', ?, ?)`, c, a, now, now+1000)
	_, _, err = st.RespondFriendRequest(ctx, a, c, true, now)
	expectCode(t, err, "FRIEND_LIMIT")

	// 100 blocks.
	values, args = nil, nil
	for _, blocked := range ids[4:] {
		values = append(values, "(?, ?, 1)")
		args = append(args, b, blocked)
	}
	datatest.Exec(t, db, "INSERT INTO account_blocks(account_id, blocked_id, created_at) VALUES "+
		strings.Join(values, ", "), args...)
	_, err = st.AddBlock(ctx, b, c, now)
	expectCode(t, err, "BLOCK_LIMIT")
}

// befriend makes two test accounts friends.
func befriend(t *testing.T, st *store.Store, a, b, nicknameB string, now int64) {
	t.Helper()
	ctx := context.Background()
	if _, err := st.SendFriendRequest(ctx, a, nicknameB, now); err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.RespondFriendRequest(ctx, b, a, true, now); err != nil {
		t.Fatal(err)
	}
}

func TestPrivateMessages(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 3)
	a, b, c := ids[0], ids[1], ids[2]
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing).UnixMilli()
	send := func(from, to, text, clientID string, at int64) (store.PrivateMessage, bool, error) {
		return st.SendPrivateMessage(ctx, store.PrivateMessage{From: from, To: to, Text: text, ClientID: clientID, SentAt: at})
	}
	clientID := func(i int) string { return fmt.Sprintf("10000000-0000-4000-8000-%012d", i) }

	_, _, err := send(a, b, "hi", clientID(1), now)
	expectCode(t, err, "NOT_FRIENDS")
	befriend(t, st, a, b, nicknames[1], now)
	first, duplicate, err := send(a, b, "你好", clientID(1), now+1)
	if err != nil || duplicate || first.ID == 0 || first.From != a || first.To != b || first.Text != "你好" {
		t.Fatalf("send: %+v %v, %v", first, duplicate, err)
	}
	// The client id makes a resend idempotent.
	again, duplicate, err := send(a, b, "你好", clientID(1), now+2)
	if err != nil || !duplicate || again != first {
		t.Fatalf("resend: %+v %v, %v", again, duplicate, err)
	}
	for i := 2; i <= 5; i++ {
		from, to := a, b
		if i%2 == 0 {
			from, to = b, a
		}
		if _, _, err := send(from, to, fmt.Sprint("m", i), clientID(i), now+int64(i)); err != nil {
			t.Fatal(err)
		}
	}
	// a wrote 你好, m3 and m5, b wrote m2 and m4: writing reads the
	// conversation, so b has only m5 unread and a nothing.
	conversation := func(owner string) store.Conversation {
		t.Helper()
		state := messengerState(t, st, owner, now+10)
		if len(state.Conversations) != 1 {
			t.Fatalf("conversations of %s: %+v", owner, state.Conversations)
		}
		return state.Conversations[0]
	}
	if got := conversation(b); got.AccountID != a || got.Unread != 1 || got.LastMessageAt != now+5 {
		t.Fatalf("b's conversation %+v", got)
	}
	if got := conversation(a); got.Unread != 0 || got.LastReadID != got.LastMessageID {
		t.Fatalf("a's conversation %+v", got)
	}

	// Paging back from the newest message.
	page, more, err := st.PrivateMessages(ctx, b, a, 0, 3)
	if err != nil || !more || len(page) != 3 || page[0].Text != "m3" || page[2].Text != "m5" {
		t.Fatalf("page %+v %v, %v", page, more, err)
	}
	page, more, err = st.PrivateMessages(ctx, b, a, page[0].ID, 3)
	if err != nil || more || len(page) != 2 || page[0].ID != first.ID {
		t.Fatalf("older page %+v %v, %v", page, more, err)
	}

	// Reading recounts the unread messages and never moves backwards.
	last := conversation(b).LastMessageID
	if err := st.MarkConversationRead(ctx, b, a, last, now+11); err != nil {
		t.Fatal(err)
	}
	if err := st.MarkConversationRead(ctx, b, a, first.ID, now+12); err != nil {
		t.Fatal(err)
	}
	if got := conversation(b); got.Unread != 0 || got.LastReadID != last {
		t.Fatalf("after reading %+v", got)
	}

	// Hiding clears the log for b only; a new message shows it again.
	if err := st.HideConversation(ctx, b, a, now+13); err != nil {
		t.Fatal(err)
	}
	if state := messengerState(t, st, b, now+14); len(state.Conversations) != 0 {
		t.Fatalf("hidden conversation listed: %+v", state.Conversations)
	}
	if page, _, err := st.PrivateMessages(ctx, b, a, 0, 30); err != nil || len(page) != 0 {
		t.Fatalf("cleared log %+v, %v", page, err)
	}
	if page, _, err := st.PrivateMessages(ctx, a, b, 0, 30); err != nil || len(page) != 5 {
		t.Fatalf("a's log %d, %v", len(page), err)
	}
	if _, _, err := send(a, b, "back", clientID(6), now+15); err != nil {
		t.Fatal(err)
	}
	if got := conversation(b); got.Unread != 1 {
		t.Fatalf("conversation not shown again: %+v", got)
	}
	if page, _, err := st.PrivateMessages(ctx, b, a, 0, 30); err != nil || len(page) != 1 || page[0].Text != "back" {
		t.Fatalf("log after hiding %+v, %v", page, err)
	}

	// Strangers and ex-friends cannot write.
	_, _, err = send(c, a, "hey", clientID(7), now+16)
	expectCode(t, err, "NOT_FRIENDS")
	if err := st.RemoveFriend(ctx, a, b, now+17); err != nil {
		t.Fatal(err)
	}
	_, _, err = send(b, a, "bye", clientID(8), now+18)
	expectCode(t, err, "NOT_FRIENDS")
}

// TestMessagesCrossing sends in both directions at once: the conversation
// rows are locked in a fixed order, so neither side deadlocks or loses a
// count.
func TestMessagesCrossing(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 2)
	a, b := ids[0], ids[1]
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing).UnixMilli()
	befriend(t, st, a, b, nicknames[1], now)
	const each = 10
	var wg sync.WaitGroup
	errs := make(chan error, 2*each)
	for i := range 2 * each {
		from, to := a, b
		if i%2 == 1 {
			from, to = b, a
		}
		wg.Go(func() {
			_, _, err := st.SendPrivateMessage(ctx, store.PrivateMessage{From: from, To: to, Text: "x",
				ClientID: fmt.Sprintf("20000000-0000-4000-8000-%012d", i), SentAt: now + int64(i)})
			errs <- err
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	page, _, err := st.PrivateMessages(ctx, a, b, 0, 100)
	if err != nil || len(page) != 2*each {
		t.Fatalf("%d messages, %v", len(page), err)
	}
}

// Blocking and unblocking keeps a refusal's cooldown: the blocker's refused
// request stays (hidden from the outbox) until it expires.
func TestBlockKeepsRefusalCooldown(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, nicknames := messengerAccounts(t, db, 2)
	a, b := ids[0], ids[1]
	now := time.Date(2026, 10, 9, 10, 0, 0, 0, beijing).UnixMilli()
	if _, err := st.SendFriendRequest(ctx, a, nicknames[1], now); err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.RespondFriendRequest(ctx, b, a, false, now+1000); err != nil {
		t.Fatal(err)
	}
	if _, err := st.AddBlock(ctx, a, b, now+2000); err != nil {
		t.Fatal(err)
	}
	if state := messengerState(t, st, a, now+3000); len(state.Outgoing) != 0 {
		t.Fatalf("the refused card stays in the blocker's outbox: %+v", state.Outgoing)
	}
	if err := st.RemoveBlock(ctx, a, b); err != nil {
		t.Fatal(err)
	}
	_, err := st.SendFriendRequest(ctx, a, nicknames[1], now+4000)
	expectCode(t, err, "REQUEST_COOLDOWN")
	// After 06:00 the next day the request goes through again.
	tomorrow := time.Date(2026, 10, 10, 6, 0, 1, 0, beijing).UnixMilli()
	if _, err := st.SendFriendRequest(ctx, a, nicknames[1], tomorrow); err != nil {
		t.Fatal(err)
	}
}
