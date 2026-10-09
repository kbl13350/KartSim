package store

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"net/http"
	"slices"

	"kartsim/internal/shared/apierr"
)

var errNotFriends = apierr.New(http.StatusForbidden, "NOT_FRIENDS")

// PrivateMessage is one stored 1:1 message.
type PrivateMessage struct {
	ID       int64
	From     string
	To       string
	Text     string
	SentAt   int64
	ClientID string
}

// pair orders two account ids the way private_messages stores them.
func pair(a, b string) (low, high string) {
	if a < b {
		return a, b
	}
	return b, a
}

const messageColumns = "id, low_id, high_id, sender_id, client_id, body, created_at"

func scanMessage(scan func(...any) error) (PrivateMessage, error) {
	var (
		message   PrivateMessage
		low, high string
	)
	err := scan(&message.ID, &low, &high, &message.From, &message.ClientID, &message.Text, &message.SentAt)
	message.To = high
	if message.From == high {
		message.To = low
	}
	return message, err
}

// MessageByClientID is the message sender stored under clientID, if any.
func (s *Store) MessageByClientID(ctx context.Context, sender, clientID string) (PrivateMessage, bool, error) {
	return messageByClientID(ctx, s.db, sender, clientID)
}

func messageByClientID(ctx context.Context, q queryer, sender, clientID string) (PrivateMessage, bool, error) {
	message, err := scanMessage(q.QueryRowContext(ctx, "SELECT "+messageColumns+
		" FROM private_messages WHERE sender_id = ? AND client_id = ?", sender, clientID).Scan)
	if errors.Is(err, sql.ErrNoRows) {
		return PrivateMessage{}, false, nil
	}
	return message, err == nil, err
}

// SendPrivateMessage stores a message from in.From to in.To (fields ID is
// ignored) and updates both conversations: the sender's is read up to the
// message, the recipient's gains an unread message, and both are shown
// again if they were hidden. Only friends may write to each other
// (NOT_FRIENDS). The sender's client id makes the call idempotent: a repeat
// returns the stored message with duplicate set.
func (s *Store) SendPrivateMessage(ctx context.Context, in PrivateMessage) (PrivateMessage, bool, error) {
	var (
		stored    PrivateMessage
		duplicate bool
	)
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		previous, found, err := messageByClientID(ctx, tx, in.From, in.ClientID)
		if err != nil {
			return err
		}
		if found {
			stored, duplicate = previous, true
			return nil
		}
		if in.From == in.To {
			return errNotFriends
		}
		// The shared lock keeps the friendship until commit: a concurrent
		// removal or block waits, so no message is stored after it.
		friends, err := exists(ctx, tx, "SELECT 1 FROM friendships WHERE account_id = ? AND friend_id = ? FOR SHARE",
			in.From, in.To)
		if err != nil {
			return err
		}
		if !friends {
			return errNotFriends
		}
		low, high := pair(in.From, in.To)
		result, err := tx.ExecContext(ctx, `INSERT INTO private_messages(low_id, high_id, sender_id, client_id, body, created_at)
			VALUES(?, ?, ?, ?, ?, ?)`, low, high, in.From, in.ClientID, in.Text, in.SentAt)
		if _, isDuplicate := duplicateKey(err); isDuplicate {
			// A concurrent request with the same client id won.
			previous, found, err := messageByClientID(ctx, tx, in.From, in.ClientID)
			if err != nil {
				return err
			}
			if !found {
				return errors.New("private message: duplicate client id without a row")
			}
			stored, duplicate = previous, true
			return nil
		} else if err != nil {
			return err
		}
		stored, duplicate = in, false
		if stored.ID, err = result.LastInsertId(); err != nil {
			return err
		}
		// Lock the two conversation rows in ascending account order, so
		// messages crossing in both directions cannot deadlock.
		updates := []func() error{
			func() error {
				_, err := tx.ExecContext(ctx, `INSERT INTO private_conversations(account_id, peer_id, last_message_id,
						last_message_at, last_read_id, unread, cleared_up_to, hidden, updated_at)
					VALUES(?, ?, ?, ?, ?, 0, 0, 0, ?) AS incoming
					ON DUPLICATE KEY UPDATE last_message_id = GREATEST(private_conversations.last_message_id, incoming.last_message_id),
						last_message_at = GREATEST(private_conversations.last_message_at, incoming.last_message_at),
						last_read_id = GREATEST(private_conversations.last_read_id, incoming.last_read_id), unread = 0, hidden = 0,
						updated_at = incoming.updated_at`,
					in.From, in.To, stored.ID, in.SentAt, stored.ID, in.SentAt)
				return err
			},
			func() error {
				_, err := tx.ExecContext(ctx, `INSERT INTO private_conversations(account_id, peer_id, last_message_id,
						last_message_at, last_read_id, unread, cleared_up_to, hidden, updated_at)
					VALUES(?, ?, ?, ?, 0, 1, 0, 0, ?) AS incoming
					ON DUPLICATE KEY UPDATE last_message_id = GREATEST(private_conversations.last_message_id, incoming.last_message_id),
						last_message_at = GREATEST(private_conversations.last_message_at, incoming.last_message_at), unread = private_conversations.unread + 1,
						hidden = 0, updated_at = incoming.updated_at`,
					in.To, in.From, stored.ID, in.SentAt, in.SentAt)
				return err
			},
		}
		if in.To < in.From {
			slices.Reverse(updates)
		}
		for _, update := range updates {
			if err := update(); err != nil {
				if missingParent(err) {
					return errNotFriends // an account was deleted under the friendship
				}
				return err
			}
		}
		return nil
	})
	return stored, duplicate, err
}

// PrivateMessages returns up to limit messages between me and peer, oldest
// first, older than before (when before > 0) and newer than my cleared-up-to
// mark, and whether older ones remain.
func (s *Store) PrivateMessages(ctx context.Context, me, peer string, before int64, limit int) ([]PrivateMessage, bool, error) {
	var cleared int64
	if err := s.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(cleared_up_to), 0) FROM private_conversations
		WHERE account_id = ? AND peer_id = ?`, me, peer).Scan(&cleared); err != nil {
		return nil, false, err
	}
	if before <= 0 {
		before = math.MaxInt64
	}
	low, high := pair(me, peer)
	rows, err := s.db.QueryContext(ctx, "SELECT "+messageColumns+` FROM private_messages
		WHERE low_id = ? AND high_id = ? AND id > ? AND id < ? ORDER BY id DESC LIMIT ?`, low, high, cleared, before, limit+1)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()
	messages := []PrivateMessage{}
	for rows.Next() {
		message, err := scanMessage(rows.Scan)
		if err != nil {
			return nil, false, err
		}
		messages = append(messages, message)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(messages) > limit
	if more {
		messages = messages[:limit]
	}
	slices.Reverse(messages)
	return messages, more, nil
}

// MarkConversationRead moves my read mark of the conversation with peer to
// upTo (never backwards, never past its last message) and recounts the
// unread messages. A conversation that does not exist is left alone.
func (s *Store) MarkConversationRead(ctx context.Context, me, peer string, upTo, now int64) error {
	return inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		var lastRead, lastMessage, cleared int64
		err := tx.QueryRowContext(ctx, `SELECT last_read_id, last_message_id, cleared_up_to FROM private_conversations
			WHERE account_id = ? AND peer_id = ? FOR UPDATE`, me, peer).Scan(&lastRead, &lastMessage, &cleared)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		} else if err != nil {
			return err
		}
		read := max(lastRead, min(upTo, lastMessage))
		low, high := pair(me, peer)
		unread, err := countRows(ctx, tx, `SELECT COUNT(*) FROM private_messages
			WHERE low_id = ? AND high_id = ? AND id > ? AND sender_id = ?`, low, high, max(read, cleared), peer)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `UPDATE private_conversations SET last_read_id = ?, unread = ?, updated_at = ?
			WHERE account_id = ? AND peer_id = ?`, read, unread, now, me, peer)
		return err
	})
}

// HideConversation removes the conversation with peer from my list and
// clears its log for me up to its last message (the release 退出); the next
// message shows it again.
func (s *Store) HideConversation(ctx context.Context, me, peer string, now int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE private_conversations SET hidden = 1, cleared_up_to = last_message_id,
			last_read_id = GREATEST(last_read_id, last_message_id), unread = 0, updated_at = ?
		WHERE account_id = ? AND peer_id = ?`, now, me, peer)
	return err
}

// MessengerPrune counts what PruneMessenger removed or changed.
type MessengerPrune struct {
	Refused       int64 // pending requests refused at their expiry
	Results       int64 // accepted/refused requests past their outbox time
	Messages      int64
	Conversations int64 // conversations whose last message is older than the retention
}

// PruneMessenger is the hourly messenger sweep, at most limit rows per
// step: pending requests past their expiry become refused (resolved at the
// expiry, kept for ResultDays more), results past their expiry are deleted,
// and messages and conversations last written before messagesBefore are
// deleted.
func (s *Store) PruneMessenger(ctx context.Context, now, messagesBefore int64, limit int) (MessengerPrune, error) {
	var pruned MessengerPrune
	steps := []struct {
		count *int64
		query string
		args  []any
	}{
		{&pruned.Refused, `UPDATE friend_requests SET state = 'refused', resolved_at = expires_at, expires_at = expires_at + ?
			WHERE state = 'pending' AND expires_at <= ? LIMIT ?`, []any{resultLifetime, now, limit}},
		{&pruned.Results, `DELETE FROM friend_requests WHERE state IN ('accepted', 'refused') AND expires_at <= ? LIMIT ?`,
			[]any{now, limit}},
		{&pruned.Messages, "DELETE FROM private_messages WHERE created_at < ? LIMIT ?", []any{messagesBefore, limit}},
		{&pruned.Conversations, "DELETE FROM private_conversations WHERE last_message_at < ? LIMIT ?",
			[]any{messagesBefore, limit}},
	}
	for _, step := range steps {
		result, err := s.db.ExecContext(ctx, step.query, step.args...)
		if err != nil {
			return pruned, err
		}
		if *step.count, err = result.RowsAffected(); err != nil {
			return pruned, err
		}
	}
	return pruned, nil
}
