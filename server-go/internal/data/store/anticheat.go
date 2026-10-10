package store

import (
	"context"
	"database/sql"
)

// AntiCheatEvent is one anti-cheat record of a game node (ANTICHEAT.md 4).
type AntiCheatEvent struct {
	EventID   string
	NodeID    string
	AccountID string // "" for a guest
	PlayerID  string
	Name      string
	RoomID    string
	RaceID    string
	TrackID   string
	Gameplay  string
	Code      string
	Detail    string
	Action    string
	At        int64
}

// SaveAntiCheatEvent stores a record once: a redelivery of the same event
// ID is ignored.
func (s *Store) SaveAntiCheatEvent(ctx context.Context, e AntiCheatEvent) error {
	_, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO anti_cheat_events(event_id, node_id, account_id,
		player_id, name, room_id, race_id, track_id, gameplay, code, detail, action, at)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.EventID, e.NodeID, e.AccountID, e.PlayerID, e.Name, e.RoomID, e.RaceID, e.TrackID, e.Gameplay,
		e.Code, e.Detail, e.Action, e.At)
	return err
}

// PruneAntiCheatEvents deletes anti-cheat records older than before, at
// most limit.
func (s *Store) PruneAntiCheatEvents(ctx context.Context, before int64, limit int) (int64, error) {
	result, err := s.db.ExecContext(ctx, "DELETE FROM anti_cheat_events WHERE at < ? LIMIT ?", before, limit)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// AntiCheatRow is one anti-cheat record with the account's current
// username and nickname ("" for a guest or a deleted account).
type AntiCheatRow struct {
	ID int64
	AntiCheatEvent
	Username string
	Nickname string
}

// AntiCheatFilter narrows the anti-cheat records: a check, an action, an
// account, a node; "" keeps all.
type AntiCheatFilter struct {
	Code, Action, AccountID, NodeID string
}

var antiCheatSorts = map[string]string{"at": "e.at"}

// AdminAntiCheat lists anti-cheat records, newest first by default: q
// matches the name at the time, the username, the nickname and the detail
// (and the player, room and race IDs when ASCII); From/To bound the time.
func (s *Store) AdminAntiCheat(ctx context.Context, page AdminPage, filter AntiCheatFilter) ([]AntiCheatRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"e.name", "a.username", "a.nickname", "e.detail"},
		[]string{"e.player_id", "e.room_id", "e.race_id"})
	q.during("e.at", page)
	if filter.Code != "" {
		q.add("e.code = ?", filter.Code)
	}
	if filter.Action != "" {
		q.add("e.action = ?", filter.Action)
	}
	if filter.AccountID != "" {
		q.add("e.account_id = ?", filter.AccountID)
	}
	if filter.NodeID != "" {
		q.add("e.node_id = ?", filter.NodeID)
	}
	from := " FROM anti_cheat_events e LEFT JOIN accounts a ON a.id = e.account_id AND e.account_id <> ''"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []AntiCheatRow{}, total, err
	}
	tail, args := limit(page, q.args)
	list := []AntiCheatRow{}
	err = s.queryRows(ctx, `SELECT e.id, e.event_id, e.node_id, e.account_id, e.player_id, e.name, e.room_id,
		e.race_id, e.track_id, e.gameplay, e.code, e.detail, e.action, e.at,
		COALESCE(a.username, ''), COALESCE(a.nickname, '')`+
		from+q.where()+orderBy(page, antiCheatSorts, "at", "e.id")+tail, args, func(rows *sql.Rows) error {
		var row AntiCheatRow
		if err := rows.Scan(&row.ID, &row.EventID, &row.NodeID, &row.AccountID, &row.PlayerID, &row.Name,
			&row.RoomID, &row.RaceID, &row.TrackID, &row.Gameplay, &row.Code, &row.Detail, &row.Action,
			&row.At, &row.Username, &row.Nickname); err != nil {
			return err
		}
		list = append(list, row)
		return nil
	})
	return list, total, err
}
