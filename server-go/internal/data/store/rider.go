package store

import (
	"context"
	"database/sql"
	"errors"
)

// RiderCard is what 查找车手 shows of a rider (dialog2_userInfo 车手资料).
type RiderCard struct {
	AccountID   string
	Nickname    string
	Exp         int64
	CreatedAt   int64
	Invisible   bool
	Stats       SummaryStats
	License     int
	ProUntil    int64
	Club        *ClubInfo
	ClubGrade   int
	MainEmblems [MainEmblemSlots]int
}

// RiderCardByNickname finds a rider's card (case-insensitive nickname).
func (s *Store) RiderCardByNickname(ctx context.Context, nickname string, now int64) (RiderCard, bool, error) {
	var (
		card      RiderCard
		invisible sql.NullBool
	)
	err := s.db.QueryRowContext(ctx, `SELECT a.id, a.nickname, a.created_at, COALESCE(p.exp, 0),
			COALESCE(st.races, 0), COALESCE(st.wins, 0), COALESCE(st.podiums, 0), COALESCE(st.points, 0),
			COALESCE(ls.level, 0), COALESCE(ls.pro_until, 0), m.invisible
		FROM accounts a
		LEFT JOIN account_progress p ON p.account_id = a.id
		LEFT JOIN player_stats st ON st.account_id = a.id
		LEFT JOIN license_state ls ON ls.account_id = a.id
		LEFT JOIN messenger_settings m ON m.account_id = a.id
		WHERE a.nickname = ?`, nickname).Scan(&card.AccountID, &card.Nickname, &card.CreatedAt, &card.Exp,
		&card.Stats.Races, &card.Stats.Wins, &card.Stats.Podiums, &card.Stats.Points, &card.License, &card.ProUntil,
		&invisible)
	if errors.Is(err, sql.ErrNoRows) {
		return RiderCard{}, false, nil
	} else if err != nil {
		return RiderCard{}, false, err
	}
	card.Invisible = invisible.Bool
	if _, card.MainEmblems, err = s.Emblems(ctx, card.AccountID); err != nil {
		return RiderCard{}, false, err
	}
	brief, grade, err := s.ClubOf(ctx, card.AccountID, now)
	if err != nil {
		return RiderCard{}, false, err
	}
	if brief.ID != 0 {
		info, err := s.Club(ctx, brief.ID, now)
		if err == nil {
			card.Club, card.ClubGrade = &info, grade
		} else if !errors.Is(err, errClubNotFound) {
			return RiderCard{}, false, err
		}
	}
	return card, true, nil
}
