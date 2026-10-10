package store

import (
	"context"
	"database/sql"
	"errors"

	"kartsim/internal/data/club"
	licensedata "kartsim/internal/data/license"
)

// The admin console's game view of one account (ADMIN.md 5,
// GET /api/admin/accounts/{id}/game): race tallies, licenses, best times,
// quests, career counters, friends and club membership.

// GameStats are an account's player_stats tallies.
type GameStats struct {
	Races, Wins, Podiums, Points int
}

// LicenseSummary is an account's license_state row; Level is the license
// held at the time asked: PRO (6) while ProUntil lies ahead, else the
// highest of 新手 (1) to L1 (5) taken (0 none).
type LicenseSummary struct {
	Level     int
	ProUntil  int64 // 0: no PRO license yet
	ProCount  int
	LastRunAt int64 // 0: never ran a step
}

// GameLicenseClear is one cleared license step (PRO steps per period).
type GameLicenseClear struct {
	Step      int
	Period    string
	BestMs    int64
	ClearedAt int64
}

// BestTime is an account's best time on a track (license qualification or
// time attack).
type BestTime struct {
	TrackID   string
	BestMs    int64
	UpdatedAt int64
}

// QuestRow is an account's progress on a quest in one period.
type QuestRow struct {
	QuestID     int
	Period      string
	Value       int64
	CompletedAt *int64
	UpdatedAt   int64
}

// CounterRow is one career counter of an account.
type CounterRow struct {
	Counter   string
	Value     int64
	UpdatedAt int64
}

// GameClub is an account's club membership; CSWeek is this week's points.
type GameClub struct {
	ID           int64
	Name         string
	Grade        int
	JoinedAt     int64
	CSWeek       int64
	CSTotal      int64
	DonatedTotal int64
}

// AccountGame is what an account did in the game.
type AccountGame struct {
	Stats          *GameStats      // nil before the first race
	License        *LicenseSummary // nil before the first license
	LicenseClears  []GameLicenseClear
	LicenseRecords []BestTime
	TimeAttack     []BestTime
	Quests         []QuestRow
	Counters       []CounterRow
	Friends        int
	Club           *GameClub // nil outside a club (or in a disbanded one)
}

// AccountGame reads an account's game data at now: license clears newest
// first, best times by track, quests by their last change (newest first),
// counters by name.
func (s *Store) AccountGame(ctx context.Context, accountID string, now int64) (AccountGame, error) {
	game := AccountGame{LicenseClears: []GameLicenseClear{}, LicenseRecords: []BestTime{}, TimeAttack: []BestTime{},
		Quests: []QuestRow{}, Counters: []CounterRow{}}
	var stats GameStats
	err := s.db.QueryRowContext(ctx, "SELECT races, wins, podiums, points FROM player_stats WHERE account_id = ?",
		accountID).Scan(&stats.Races, &stats.Wins, &stats.Podiums, &stats.Points)
	if err == nil {
		game.Stats = &stats
	} else if !errors.Is(err, sql.ErrNoRows) {
		return game, err
	}
	var license LicenseSummary
	err = s.db.QueryRowContext(ctx, "SELECT level, pro_until, pro_count, last_run_at FROM license_state WHERE account_id = ?",
		accountID).Scan(&license.Level, &license.ProUntil, &license.ProCount, &license.LastRunAt)
	if err == nil {
		if license.ProUntil > now {
			license.Level = licensedata.Pro
		}
		game.License = &license
	} else if !errors.Is(err, sql.ErrNoRows) {
		return game, err
	}
	if err := s.queryRows(ctx, `SELECT step, period, best_ms, cleared_at FROM license_clears WHERE account_id = ?
		ORDER BY cleared_at DESC, step, period`, []any{accountID}, func(rows *sql.Rows) error {
		var row GameLicenseClear
		if err := rows.Scan(&row.Step, &row.Period, &row.BestMs, &row.ClearedAt); err != nil {
			return err
		}
		game.LicenseClears = append(game.LicenseClears, row)
		return nil
	}); err != nil {
		return game, err
	}
	for _, list := range []struct {
		table  string
		target *[]BestTime
	}{{"license_records", &game.LicenseRecords}, {"timeattack_bests", &game.TimeAttack}} {
		// The table names are constants of this function.
		if err := s.queryRows(ctx, "SELECT track_id, best_ms, updated_at FROM "+list.table+
			" WHERE account_id = ? ORDER BY track_id", []any{accountID}, func(rows *sql.Rows) error {
			var row BestTime
			if err := rows.Scan(&row.TrackID, &row.BestMs, &row.UpdatedAt); err != nil {
				return err
			}
			*list.target = append(*list.target, row)
			return nil
		}); err != nil {
			return game, err
		}
	}
	if err := s.queryRows(ctx, `SELECT quest_id, period, value, completed_at, updated_at FROM quest_progress
		WHERE account_id = ? ORDER BY updated_at DESC, quest_id, period`, []any{accountID}, func(rows *sql.Rows) error {
		var (
			row       QuestRow
			completed sql.NullInt64
		)
		if err := rows.Scan(&row.QuestID, &row.Period, &row.Value, &completed, &row.UpdatedAt); err != nil {
			return err
		}
		row.CompletedAt = nullInt(completed)
		game.Quests = append(game.Quests, row)
		return nil
	}); err != nil {
		return game, err
	}
	if err := s.queryRows(ctx, "SELECT counter, value, updated_at FROM account_counters WHERE account_id = ? ORDER BY counter",
		[]any{accountID}, func(rows *sql.Rows) error {
			var row CounterRow
			if err := rows.Scan(&row.Counter, &row.Value, &row.UpdatedAt); err != nil {
				return err
			}
			game.Counters = append(game.Counters, row)
			return nil
		}); err != nil {
		return game, err
	}
	if game.Friends, err = s.count(ctx, "SELECT COUNT(*) FROM friendships WHERE account_id = ?",
		[]any{accountID}); err != nil {
		return game, err
	}
	var (
		member GameClub
		week   string
	)
	err = s.db.QueryRowContext(ctx, `SELECT c.id, c.name, m.grade, m.joined_at, m.cs_week, m.week, m.cs_total,
			m.donated_total FROM club_members m JOIN clubs c ON c.id = m.club_id
		WHERE m.account_id = ? AND (c.break_at IS NULL OR c.break_at > ?)`, accountID, now).
		Scan(&member.ID, &member.Name, &member.Grade, &member.JoinedAt, &member.CSWeek, &week, &member.CSTotal,
			&member.DonatedTotal)
	if err == nil {
		if week != club.Week(now) {
			member.CSWeek = 0
		}
		game.Club = &member
	} else if !errors.Is(err, sql.ErrNoRows) {
		return game, err
	}
	return game, nil
}
