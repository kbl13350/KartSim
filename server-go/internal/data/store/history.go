package store

import (
	"context"
	"database/sql"
	"errors"
)

// historyLimit matches the Java history endpoints.
const historyLimit = 100

// RaceResultRow is one ranked racer of a stored race.
type RaceResultRow struct {
	RoomID    string `json:"roomId"`
	RaceID    string `json:"raceId"`
	PlayerID  string `json:"playerId"`
	Name      string `json:"name"`
	Rank      int    `json:"rank"`
	ElapsedMs *int64 `json:"elapsedMs"`
	Points    int    `json:"points"`
	CreatedAt int64  `json:"createdAt"`
}

// OutcomeRow is one stored race outcome document.
type OutcomeRow struct {
	RaceID    string
	RoomID    string
	Gameplay  string
	TrackID   string
	JSON      string
	CreatedAt int64
}

// RoomRulesRow is the saved rule set of one room.
type RoomRulesRow struct {
	RoomID    string
	JSON      string
	UpdatedAt int64
}

// PlayerStats are the accumulated results of one account.
type PlayerStats struct {
	Nickname  string `json:"nickname"`
	Races     int    `json:"races"`
	Wins      int    `json:"wins"`
	Podiums   int    `json:"podiums"`
	Points    int    `json:"points"`
	UpdatedAt int64  `json:"updatedAt"`
}

// RecentResults returns the newest 100 results, optionally for one name
// (case-insensitive).
func (s *Store) RecentResults(ctx context.Context, name *string) ([]RaceResultRow, error) {
	query := "SELECT room_id, race_id, player_id, name, `rank`, elapsed_ms, points, created_at FROM race_results "
	var args []any
	if name != nil {
		query += "WHERE name = ? "
		args = append(args, *name)
	}
	query += "ORDER BY created_at DESC, id DESC LIMIT 100"
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := make([]RaceResultRow, 0, historyLimit)
	for rows.Next() {
		var (
			row     RaceResultRow
			elapsed sql.NullInt64
		)
		if err := rows.Scan(&row.RoomID, &row.RaceID, &row.PlayerID, &row.Name, &row.Rank,
			&elapsed, &row.Points, &row.CreatedAt); err != nil {
			return nil, err
		}
		if elapsed.Valid {
			row.ElapsedMs = &elapsed.Int64
		}
		results = append(results, row)
	}
	return results, rows.Err()
}

// RecentOutcomes returns the newest 100 race outcomes, optionally of one gameplay.
func (s *Store) RecentOutcomes(ctx context.Context, gameplay *string) ([]OutcomeRow, error) {
	query := "SELECT race_id, room_id, gameplay, track_id, json, created_at FROM race_outcomes "
	var args []any
	if gameplay != nil {
		query += "WHERE gameplay = ? "
		args = append(args, *gameplay)
	}
	query += "ORDER BY created_at DESC LIMIT 100"
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	outcomes := make([]OutcomeRow, 0, historyLimit)
	for rows.Next() {
		var row OutcomeRow
		if err := rows.Scan(&row.RaceID, &row.RoomID, &row.Gameplay, &row.TrackID, &row.JSON, &row.CreatedAt); err != nil {
			return nil, err
		}
		outcomes = append(outcomes, row)
	}
	return outcomes, rows.Err()
}

// RecentRoomRules returns the 100 most recently updated room rule sets.
func (s *Store) RecentRoomRules(ctx context.Context) ([]RoomRulesRow, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT room_id, json, updated_at FROM room_rules ORDER BY updated_at DESC LIMIT 100")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	rules := make([]RoomRulesRow, 0, historyLimit)
	for rows.Next() {
		var row RoomRulesRow
		if err := rows.Scan(&row.RoomID, &row.JSON, &row.UpdatedAt); err != nil {
			return nil, err
		}
		rules = append(rules, row)
	}
	return rules, rows.Err()
}

// StatsByNickname returns the stats of the account named nickname
// (case-insensitive). An account that never raced has zero stats.
func (s *Store) StatsByNickname(ctx context.Context, nickname string) (PlayerStats, bool, error) {
	var stats PlayerStats
	err := s.db.QueryRowContext(ctx, `SELECT a.nickname, COALESCE(p.races, 0), COALESCE(p.wins, 0),
			COALESCE(p.podiums, 0), COALESCE(p.points, 0), COALESCE(p.updated_at, 0)
		FROM accounts a LEFT JOIN player_stats p ON p.account_id = a.id
		WHERE a.nickname = ?`, nickname).
		Scan(&stats.Nickname, &stats.Races, &stats.Wins, &stats.Podiums, &stats.Points, &stats.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PlayerStats{}, false, nil
	}
	return stats, err == nil, err
}
