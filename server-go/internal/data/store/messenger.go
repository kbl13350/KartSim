package store

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"time"

	"kartsim/internal/shared/apierr"
)

// Messenger limits (DESIGN.md 9). Every friendship change locks the
// messenger_settings rows of both accounts, so the counts below are checked
// without races.
const (
	MaxFriends         = 100
	MaxPendingOutgoing = 30
	MaxBlocks          = 100
	// RequestDays is how long a request waits before it is refused
	// automatically; ResultDays is how long an accepted or refused request
	// stays in the sender's outbox.
	RequestDays = 7
	ResultDays  = 7
	// MaxConversations is the length of the conversation list (the release
	// messenger has ten slots).
	MaxConversations = 10
)

// Friend request states.
const (
	RequestPending  = "pending"
	RequestAccepted = "accepted"
	RequestRefused  = "refused"
)

const (
	requestLifetime = int64(RequestDays * dayMillis)
	resultLifetime  = int64(ResultDays * dayMillis)
)

// beijing is UTC+8: a refused request may be sent again from the next 06:00
// there (the release refuseConfirm rule).
var beijing = time.FixedZone("UTC+8", 8*60*60)

var (
	errPlayerNotFound        = apierr.New(http.StatusNotFound, "PLAYER_NOT_FOUND")
	errCannotAddSelf         = apierr.New(http.StatusBadRequest, "CANNOT_ADD_SELF")
	errAlreadyFriends        = apierr.New(http.StatusConflict, "ALREADY_FRIENDS")
	errRequestPending        = apierr.New(http.StatusConflict, "REQUEST_PENDING")
	errRequestCooldown       = apierr.New(http.StatusConflict, "REQUEST_COOLDOWN")
	errFriendLimit           = apierr.New(http.StatusConflict, "FRIEND_LIMIT")
	errTargetFriendLimit     = apierr.New(http.StatusConflict, "TARGET_FRIEND_LIMIT")
	errRequestLimit          = apierr.New(http.StatusConflict, "REQUEST_LIMIT")
	errFriendRequestsBlocked = apierr.New(http.StatusForbidden, "FRIEND_REQUESTS_BLOCKED")
	errBlockedTarget         = apierr.New(http.StatusConflict, "BLOCKED_TARGET")
	errRequestNotFound       = apierr.New(http.StatusNotFound, "REQUEST_NOT_FOUND")
	errFriendNotFound        = apierr.New(http.StatusNotFound, "FRIEND_NOT_FOUND")
	errCannotBlockSelf       = apierr.New(http.StatusBadRequest, "CANNOT_BLOCK_SELF")
	errBlockLimit            = apierr.New(http.StatusConflict, "BLOCK_LIMIT")
	errBlockNotFound         = apierr.New(http.StatusNotFound, "BLOCK_NOT_FOUND")
)

// Contact is an account as the messenger shows it; the level and glove
// come from Exp.
type Contact struct {
	AccountID string
	Nickname  string
	Exp       int64
}

// MessengerSettings are an account's messenger switches (all off by default).
type MessengerSettings struct {
	BlockFriendRequests bool `json:"blockFriendRequests"`
	BlockGameInvites    bool `json:"blockGameInvites"`
	Invisible           bool `json:"invisible"`
}

// Friend is one side of a friendship.
type Friend struct {
	Contact
	Favorite bool
	Since    int64
	// Invisible is the friend's own setting: they appear offline.
	Invisible bool
}

// FriendRequest is a request row as one side sees it: Contact is the other
// account.
type FriendRequest struct {
	Contact
	State      string
	CreatedAt  int64
	ResolvedAt *int64
	// ExpiresAt is when a pending request is refused automatically, or when
	// an accepted or refused one leaves the sender's outbox.
	ExpiresAt int64
}

// settle applies the hourly sweep to a row it has not reached yet: a
// pending request past its expiry was refused at that moment.
func (r *FriendRequest) settle(now int64) {
	if r.State == RequestPending && r.ExpiresAt <= now {
		resolved := r.ExpiresAt
		r.State, r.ResolvedAt, r.ExpiresAt = RequestRefused, &resolved, r.ExpiresAt+resultLifetime
	}
}

// Block is an account I blocked.
type Block struct {
	Contact
	Since int64
}

// Conversation is one entry of the conversation list.
type Conversation struct {
	AccountID     string
	Nickname      string
	LastMessageID int64
	LastMessageAt int64
	Unread        int
	LastReadID    int64
}

// MessengerState is everything GET /api/messenger/state shows an account.
type MessengerState struct {
	Me            Contact
	Settings      MessengerSettings
	Friends       []Friend
	Incoming      []FriendRequest // pending requests to me
	Outgoing      []FriendRequest // my requests and their results, newest first
	Blocks        []Block
	Conversations []Conversation // not hidden, most recent first, at most MaxConversations
}

// RosterFriend is a friend as the presence hub tracks it.
type RosterFriend struct {
	AccountID string
	Invisible bool
}

// FriendRequestOutcome reports what SendFriendRequest did.
type FriendRequestOutcome struct {
	Target Contact
	// Accepted means the target had already asked me: we are friends now
	// and Friend is set; otherwise Request is my new pending request.
	Accepted bool
	Friend   Friend
	Request  FriendRequest
}

// cooldownEnd is when a request refused at resolvedAt may be sent again:
// the next 06:00 Beijing time.
func cooldownEnd(resolvedAt int64) int64 {
	at := time.UnixMilli(resolvedAt).In(beijing)
	six := time.Date(at.Year(), at.Month(), at.Day(), 6, 0, 0, 0, beijing)
	if !six.After(at) {
		six = six.AddDate(0, 0, 1)
	}
	return six.UnixMilli()
}

// contactColumns select a Contact from accounts a joined with account_progress p.
const contactColumns = "a.id, a.nickname, COALESCE(p.exp, 0)"

const contactJoin = "LEFT JOIN account_progress p ON p.account_id = a.id"

// lockMessengers takes the messenger_settings row locks of the accounts,
// creating default rows, in ascending id order. Every friendship, request
// and block change of an account holds its lock, so they are serialized per
// account. A missing account fails with a foreign key error (missingParent).
func lockMessengers(ctx context.Context, tx *sql.Tx, now int64, ids ...string) error {
	sorted := slices.Clone(ids)
	slices.Sort(sorted)
	for _, id := range slices.Compact(sorted) {
		if _, err := upsertRow(ctx, tx, `INSERT INTO messenger_settings(account_id, updated_at) VALUES(?, ?)
			ON DUPLICATE KEY UPDATE account_id = account_id`, id, now); err != nil {
			return err
		}
	}
	return nil
}

func contactWhere(ctx context.Context, q queryer, where string, arg any) (Contact, bool, error) {
	var contact Contact
	err := q.QueryRowContext(ctx, "SELECT "+contactColumns+" FROM accounts a "+contactJoin+" WHERE "+where, arg).
		Scan(&contact.AccountID, &contact.Nickname, &contact.Exp)
	if errors.Is(err, sql.ErrNoRows) {
		return Contact{}, false, nil
	}
	return contact, err == nil, err
}

// ContactByID loads one account as a Contact.
func (s *Store) ContactByID(ctx context.Context, accountID string) (Contact, bool, error) {
	return contactWhere(ctx, s.db, "a.id = ?", accountID)
}

// requestRow loads the request from one account to another and locks it.
func requestRow(ctx context.Context, tx *sql.Tx, from, to string, now int64) (FriendRequest, bool, error) {
	var request FriendRequest
	var resolved sql.NullInt64
	err := tx.QueryRowContext(ctx, `SELECT state, created_at, resolved_at, expires_at FROM friend_requests
		WHERE from_id = ? AND to_id = ? FOR UPDATE`, from, to).Scan(&request.State, &request.CreatedAt, &resolved, &request.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return FriendRequest{}, false, nil
	} else if err != nil {
		return FriendRequest{}, false, err
	}
	if resolved.Valid {
		request.ResolvedAt = &resolved.Int64
	}
	request.settle(now)
	return request, true, nil
}

func countRows(ctx context.Context, q queryer, query string, args ...any) (int, error) {
	var n int
	err := q.QueryRowContext(ctx, query, args...).Scan(&n)
	return n, err
}

// friendCounts checks both accounts' friend limits.
func friendCounts(ctx context.Context, tx *sql.Tx, me, other string) error {
	mine, err := countRows(ctx, tx, "SELECT COUNT(*) FROM friendships WHERE account_id = ?", me)
	if err != nil {
		return err
	}
	if mine >= MaxFriends {
		return errFriendLimit
	}
	theirs, err := countRows(ctx, tx, "SELECT COUNT(*) FROM friendships WHERE account_id = ?", other)
	if err != nil {
		return err
	}
	if theirs >= MaxFriends {
		return errTargetFriendLimit
	}
	return nil
}

// befriend links two accounts and marks every pending request between them
// accepted.
func befriend(ctx context.Context, tx *sql.Tx, a, b string, now int64) error {
	if _, err := tx.ExecContext(ctx, `INSERT INTO friendships(account_id, friend_id, favorite, created_at)
		VALUES(?, ?, 0, ?), (?, ?, 0, ?)`, a, b, now, b, a, now); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE friend_requests SET state = 'accepted', resolved_at = ?, expires_at = ?
		WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)) AND state = 'pending'`,
		now, now+resultLifetime, a, b, b, a)
	return err
}

// SendFriendRequest asks the account named nickname to be fromID's friend.
// The checks run in this order: PLAYER_NOT_FOUND, CANNOT_ADD_SELF,
// ALREADY_FRIENDS, BLOCKED_TARGET (I blocked them), FRIEND_REQUESTS_BLOCKED
// (they blocked me; it reads like their setting, so a block stays private).
// When they had already asked me, their request is accepted at once (my and
// their friend limits apply). Otherwise REQUEST_PENDING, REQUEST_COOLDOWN
// (they refused me and the next 06:00 Beijing time has not come),
// FRIEND_REQUESTS_BLOCKED (their setting), FRIEND_LIMIT,
// TARGET_FRIEND_LIMIT and REQUEST_LIMIT, and the request is stored (an old
// result row of the same pair is replaced).
func (s *Store) SendFriendRequest(ctx context.Context, fromID, nickname string, now int64) (FriendRequestOutcome, error) {
	var out FriendRequestOutcome
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		out = FriendRequestOutcome{}
		target, found, err := contactWhere(ctx, tx, "a.nickname = ?", nickname)
		if err != nil {
			return err
		}
		if !found {
			return errPlayerNotFound
		}
		if target.AccountID == fromID {
			return errCannotAddSelf
		}
		out.Target = target
		if err := lockMessengers(ctx, tx, now, fromID, target.AccountID); err != nil {
			if missingParent(err) {
				return errPlayerNotFound
			}
			return err
		}
		if friends, err := exists(ctx, tx, "SELECT 1 FROM friendships WHERE account_id = ? AND friend_id = ?",
			fromID, target.AccountID); err != nil {
			return err
		} else if friends {
			return errAlreadyFriends
		}
		if blocked, err := exists(ctx, tx, "SELECT 1 FROM account_blocks WHERE account_id = ? AND blocked_id = ?",
			fromID, target.AccountID); err != nil {
			return err
		} else if blocked {
			return errBlockedTarget
		}
		if blocked, err := exists(ctx, tx, "SELECT 1 FROM account_blocks WHERE account_id = ? AND blocked_id = ?",
			target.AccountID, fromID); err != nil {
			return err
		} else if blocked {
			return errFriendRequestsBlocked
		}
		theirs, found, err := requestRow(ctx, tx, target.AccountID, fromID, now)
		if err != nil {
			return err
		}
		if found && theirs.State == RequestPending {
			if err := friendCounts(ctx, tx, fromID, target.AccountID); err != nil {
				return err
			}
			if err := befriend(ctx, tx, fromID, target.AccountID, now); err != nil {
				return err
			}
			friend, _, err := friendRow(ctx, tx, fromID, target.AccountID)
			out.Accepted, out.Friend = true, friend
			return err
		}
		mine, found, err := requestRow(ctx, tx, fromID, target.AccountID, now)
		if err != nil {
			return err
		}
		if found && mine.State == RequestPending {
			return errRequestPending
		}
		if found && mine.State == RequestRefused && mine.ResolvedAt != nil && now < cooldownEnd(*mine.ResolvedAt) {
			return errRequestCooldown
		}
		var refusesRequests bool
		if err := tx.QueryRowContext(ctx, "SELECT block_friend_requests FROM messenger_settings WHERE account_id = ?",
			target.AccountID).Scan(&refusesRequests); err != nil {
			return err
		}
		if refusesRequests {
			return errFriendRequestsBlocked
		}
		if err := friendCounts(ctx, tx, fromID, target.AccountID); err != nil {
			return err
		}
		pending, err := countRows(ctx, tx, `SELECT COUNT(*) FROM friend_requests
			WHERE from_id = ? AND state = 'pending' AND expires_at > ?`, fromID, now)
		if err != nil {
			return err
		}
		if pending >= MaxPendingOutgoing {
			return errRequestLimit
		}
		out.Request = FriendRequest{Contact: target, State: RequestPending, CreatedAt: now, ExpiresAt: now + requestLifetime}
		_, err = tx.ExecContext(ctx, `INSERT INTO friend_requests(from_id, to_id, state, created_at, resolved_at, expires_at, sender_hidden)
			VALUES(?, ?, 'pending', ?, NULL, ?, 0) AS incoming
			ON DUPLICATE KEY UPDATE state = incoming.state, created_at = incoming.created_at, resolved_at = NULL,
				expires_at = incoming.expires_at, sender_hidden = 0`,
			fromID, target.AccountID, now, out.Request.ExpiresAt)
		return err
	})
	return out, err
}

// RespondFriendRequest accepts or refuses the pending request from fromID
// to me. Accepting checks my and their friend limits. It returns the
// requester and, when accepted, the new friend.
func (s *Store) RespondFriendRequest(ctx context.Context, me, fromID string, accept bool, now int64) (Contact, Friend, error) {
	var (
		requester Contact
		friend    Friend
	)
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		if fromID == me {
			return errRequestNotFound
		}
		if err := lockMessengers(ctx, tx, now, me, fromID); err != nil {
			if missingParent(err) {
				return errRequestNotFound
			}
			return err
		}
		request, found, err := requestRow(ctx, tx, fromID, me, now)
		if err != nil {
			return err
		}
		if !found || request.State != RequestPending {
			return errRequestNotFound
		}
		contact, found, err := contactWhere(ctx, tx, "a.id = ?", fromID)
		if err != nil {
			return err
		}
		if !found {
			return errRequestNotFound
		}
		requester = contact
		if !accept {
			_, err := tx.ExecContext(ctx, `UPDATE friend_requests SET state = 'refused', resolved_at = ?, expires_at = ?
				WHERE from_id = ? AND to_id = ?`, now, now+resultLifetime, fromID, me)
			return err
		}
		if err := friendCounts(ctx, tx, me, fromID); err != nil {
			return err
		}
		if err := befriend(ctx, tx, me, fromID, now); err != nil {
			return err
		}
		friend, _, err = friendRow(ctx, tx, me, fromID)
		return err
	})
	return requester, friend, err
}

// CancelFriendRequest withdraws my pending request to toID.
func (s *Store) CancelFriendRequest(ctx context.Context, me, toID string, now int64) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM friend_requests
		WHERE from_id = ? AND to_id = ? AND state = 'pending' AND expires_at > ?`, me, toID, now)
	if err != nil {
		return err
	}
	if removed, err := result.RowsAffected(); err != nil {
		return err
	} else if removed == 0 {
		return errRequestNotFound
	}
	return nil
}

// RemoveFriend ends a friendship on both sides.
func (s *Store) RemoveFriend(ctx context.Context, me, friendID string, now int64) error {
	return inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		if friendID == me {
			return errFriendNotFound
		}
		if err := lockMessengers(ctx, tx, now, me, friendID); err != nil {
			if missingParent(err) {
				return errFriendNotFound
			}
			return err
		}
		result, err := tx.ExecContext(ctx, `DELETE FROM friendships
			WHERE (account_id = ? AND friend_id = ?) OR (account_id = ? AND friend_id = ?)`, me, friendID, friendID, me)
		if err != nil {
			return err
		}
		if removed, err := result.RowsAffected(); err != nil {
			return err
		} else if removed == 0 {
			return errFriendNotFound
		}
		return nil
	})
}

const friendSelect = `SELECT ` + contactColumns + `, f.favorite, f.created_at, COALESCE(m.invisible, 0)
	FROM friendships f JOIN accounts a ON a.id = f.friend_id ` + contactJoin + `
	LEFT JOIN messenger_settings m ON m.account_id = f.friend_id`

func scanFriend(scan func(...any) error) (Friend, error) {
	var friend Friend
	err := scan(&friend.AccountID, &friend.Nickname, &friend.Exp, &friend.Favorite, &friend.Since, &friend.Invisible)
	return friend, err
}

func friendRow(ctx context.Context, q queryer, me, friendID string) (Friend, bool, error) {
	friend, err := scanFriend(q.QueryRowContext(ctx, friendSelect+" WHERE f.account_id = ? AND f.friend_id = ?", me, friendID).Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return Friend{}, false, nil
	}
	return friend, err == nil, err
}

// SetFavorite marks or unmarks one of my friends and returns the friend.
func (s *Store) SetFavorite(ctx context.Context, me, friendID string, favorite bool) (Friend, error) {
	if _, err := s.db.ExecContext(ctx, "UPDATE friendships SET favorite = ? WHERE account_id = ? AND friend_id = ?",
		favorite, me, friendID); err != nil {
		return Friend{}, err
	}
	friend, found, err := friendRow(ctx, s.db, me, friendID)
	if err != nil {
		return Friend{}, err
	}
	if !found {
		return Friend{}, errFriendNotFound
	}
	return friend, nil
}

// ClearOutbox hides my accepted and refused requests (including pending
// ones that expired) from my outbox; pending requests stay. The rows remain
// until they expire, so a refusal's cooldown still applies.
func (s *Store) ClearOutbox(ctx context.Context, me string, now int64) (int64, error) {
	result, err := s.db.ExecContext(ctx, `UPDATE friend_requests SET sender_hidden = 1
		WHERE from_id = ? AND sender_hidden = 0 AND (state <> 'pending' OR expires_at <= ?)`, me, now)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// AddBlock blocks target: the friendship and the requests in both
// directions are removed. Blocking an account again returns the existing
// block.
func (s *Store) AddBlock(ctx context.Context, me, target string, now int64) (Block, error) {
	var block Block
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		if target == me {
			return errCannotBlockSelf
		}
		contact, found, err := contactWhere(ctx, tx, "a.id = ?", target)
		if err != nil {
			return err
		}
		if !found {
			return errPlayerNotFound
		}
		if err := lockMessengers(ctx, tx, now, me, target); err != nil {
			if missingParent(err) {
				return errPlayerNotFound
			}
			return err
		}
		block = Block{Contact: contact, Since: now}
		err = tx.QueryRowContext(ctx, "SELECT created_at FROM account_blocks WHERE account_id = ? AND blocked_id = ?",
			me, target).Scan(&block.Since)
		if err == nil {
			return nil
		} else if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		blocks, err := countRows(ctx, tx, "SELECT COUNT(*) FROM account_blocks WHERE account_id = ?", me)
		if err != nil {
			return err
		}
		if blocks >= MaxBlocks {
			return errBlockLimit
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO account_blocks(account_id, blocked_id, created_at) VALUES(?, ?, ?)",
			me, target, now); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM friendships
			WHERE (account_id = ? AND friend_id = ?) OR (account_id = ? AND friend_id = ?)`, me, target, target, me); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `DELETE FROM friend_requests
			WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)`, me, target, target, me)
		return err
	})
	return block, err
}

// RemoveBlock unblocks target.
func (s *Store) RemoveBlock(ctx context.Context, me, target string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM account_blocks WHERE account_id = ? AND blocked_id = ?", me, target)
	if err != nil {
		return err
	}
	if removed, err := result.RowsAffected(); err != nil {
		return err
	} else if removed == 0 {
		return errBlockNotFound
	}
	return nil
}

// SaveMessengerSettings stores an account's messenger switches.
func (s *Store) SaveMessengerSettings(ctx context.Context, me string, settings MessengerSettings, now int64) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO messenger_settings(account_id, block_friend_requests, block_game_invites,
			invisible, updated_at) VALUES(?, ?, ?, ?, ?) AS incoming
		ON DUPLICATE KEY UPDATE block_friend_requests = incoming.block_friend_requests,
			block_game_invites = incoming.block_game_invites, invisible = incoming.invisible, updated_at = incoming.updated_at`,
		me, settings.BlockFriendRequests, settings.BlockGameInvites, settings.Invisible, now)
	if missingParent(err) {
		return errAccountNotFound
	}
	return err
}

// FriendRoster returns an account's own invisible setting and its friends
// with theirs, for the presence hub.
func (s *Store) FriendRoster(ctx context.Context, accountID string) (bool, []RosterFriend, error) {
	var invisible bool
	err := s.db.QueryRowContext(ctx, "SELECT invisible FROM messenger_settings WHERE account_id = ?", accountID).Scan(&invisible)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT f.friend_id, COALESCE(m.invisible, 0) FROM friendships f
		LEFT JOIN messenger_settings m ON m.account_id = f.friend_id WHERE f.account_id = ?`, accountID)
	if err != nil {
		return false, nil, err
	}
	defer rows.Close()
	friends := []RosterFriend{}
	for rows.Next() {
		var friend RosterFriend
		if err := rows.Scan(&friend.AccountID, &friend.Invisible); err != nil {
			return false, nil, err
		}
		friends = append(friends, friend)
	}
	return invisible, friends, rows.Err()
}

// MessengerAudience lists the accounts whose messenger state shows
// accountID's nickname: its friends, the other side of its requests, the
// accounts that blocked it and its conversation partners.
func (s *Store) MessengerAudience(ctx context.Context, accountID string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT account_id FROM friendships WHERE friend_id = ?
		UNION SELECT to_id FROM friend_requests WHERE from_id = ?
		UNION SELECT from_id FROM friend_requests WHERE to_id = ?
		UNION SELECT account_id FROM account_blocks WHERE blocked_id = ?
		UNION SELECT account_id FROM private_conversations WHERE peer_id = ?`,
		accountID, accountID, accountID, accountID, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// readOnly runs the state queries on one consistent snapshot.
var readOnly = &sql.TxOptions{ReadOnly: true}

// MessengerState loads an account's messenger state. Requests the hourly
// sweep has not reached yet are shown as it will leave them.
func (s *Store) MessengerState(ctx context.Context, accountID string, now int64) (MessengerState, bool, error) {
	var state MessengerState
	found := false
	err := inTxOptions(ctx, s.db, nil, readOnly, func(tx *sql.Tx) error {
		state, found = MessengerState{}, false
		err := tx.QueryRowContext(ctx, `SELECT `+contactColumns+`, COALESCE(m.block_friend_requests, 0),
				COALESCE(m.block_game_invites, 0), COALESCE(m.invisible, 0)
			FROM accounts a `+contactJoin+` LEFT JOIN messenger_settings m ON m.account_id = a.id WHERE a.id = ?`, accountID).
			Scan(&state.Me.AccountID, &state.Me.Nickname, &state.Me.Exp, &state.Settings.BlockFriendRequests,
				&state.Settings.BlockGameInvites, &state.Settings.Invisible)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		} else if err != nil {
			return err
		}
		found = true
		if state.Friends, err = queryList(ctx, tx, friendSelect+" WHERE f.account_id = ? ORDER BY f.favorite DESC, a.nickname",
			func(scan func(...any) error) (Friend, error) { return scanFriend(scan) }, accountID); err != nil {
			return err
		}
		if state.Incoming, err = queryList(ctx, tx, `SELECT `+contactColumns+`, r.state, r.created_at, r.resolved_at, r.expires_at
			FROM friend_requests r JOIN accounts a ON a.id = r.from_id `+contactJoin+`
			WHERE r.to_id = ? AND r.state = 'pending' AND r.expires_at > ? ORDER BY r.created_at DESC`,
			scanRequest, accountID, now); err != nil {
			return err
		}
		outgoing, err := queryList(ctx, tx, `SELECT `+contactColumns+`, r.state, r.created_at, r.resolved_at, r.expires_at
			FROM friend_requests r JOIN accounts a ON a.id = r.to_id `+contactJoin+`
			WHERE r.from_id = ? AND r.sender_hidden = 0 ORDER BY r.created_at DESC`, scanRequest, accountID)
		if err != nil {
			return err
		}
		state.Outgoing = make([]FriendRequest, 0, len(outgoing))
		for _, request := range outgoing {
			request.settle(now)
			if request.State == RequestPending || request.ExpiresAt > now {
				state.Outgoing = append(state.Outgoing, request)
			}
		}
		if state.Blocks, err = queryList(ctx, tx, `SELECT `+contactColumns+`, b.created_at
			FROM account_blocks b JOIN accounts a ON a.id = b.blocked_id `+contactJoin+`
			WHERE b.account_id = ? ORDER BY b.created_at DESC`, func(scan func(...any) error) (Block, error) {
			var block Block
			err := scan(&block.AccountID, &block.Nickname, &block.Exp, &block.Since)
			return block, err
		}, accountID); err != nil {
			return err
		}
		state.Conversations, err = queryList(ctx, tx, `SELECT c.peer_id, a.nickname, c.last_message_id, c.last_message_at,
				c.unread, c.last_read_id
			FROM private_conversations c JOIN accounts a ON a.id = c.peer_id
			WHERE c.account_id = ? AND c.hidden = 0 ORDER BY c.last_message_at DESC, c.last_message_id DESC LIMIT ?`,
			func(scan func(...any) error) (Conversation, error) {
				var conversation Conversation
				err := scan(&conversation.AccountID, &conversation.Nickname, &conversation.LastMessageID,
					&conversation.LastMessageAt, &conversation.Unread, &conversation.LastReadID)
				return conversation, err
			}, accountID, MaxConversations)
		return err
	})
	return state, found, err
}

func scanRequest(scan func(...any) error) (FriendRequest, error) {
	var request FriendRequest
	var resolved sql.NullInt64
	err := scan(&request.AccountID, &request.Nickname, &request.Exp, &request.State, &request.CreatedAt, &resolved,
		&request.ExpiresAt)
	if resolved.Valid {
		request.ResolvedAt = &resolved.Int64
	}
	return request, err
}

// queryList runs query and scans every row with scan; the list is never nil.
func queryList[T any](ctx context.Context, tx *sql.Tx, query string, scan func(func(...any) error) (T, error),
	args ...any) ([]T, error) {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := []T{}
	for rows.Next() {
		item, err := scan(rows.Scan)
		if err != nil {
			return nil, err
		}
		list = append(list, item)
	}
	return list, rows.Err()
}
