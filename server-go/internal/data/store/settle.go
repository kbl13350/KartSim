package store

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"math"
	"slices"

	"kartsim/internal/data/career"
	"kartsim/internal/data/economy"
	"kartsim/internal/shared/rewards"
)

// Settlement is one finished race reported by a game node.
type Settlement struct {
	RaceID    string
	RoomID    string
	Gameplay  string
	TrackID   string
	Snapshot  string
	CreatedAt int64
	Results   []SettledResult
	// Rewards are credited to registered accounts when the race is new.
	// Amounts already include the configured rates; the daily caps of
	// RewardDay (a Beijing day) apply here.
	Rewards   []SettledReward
	RewardDay string
	// The race class the careers count: a team race, an infinite-boost
	// channel, an item race, and the winning team of a team race (0 when
	// unknown).
	Team        bool
	Infinite    bool
	Item        bool
	WinningTeam int
	// Consumed are the consumables racers used up (an item race's changer
	// cards), taken from the inventories when the race is new.
	Consumed []ConsumedItem
}

// ConsumedItem is how many of an inventory stack an account used up.
type ConsumedItem struct {
	AccountID string
	Category  int
	ItemID    int
	Count     int
}

// SettledReward is what one account earned in a race.
type SettledReward struct {
	AccountID string
	Exp       int64
	Lucci     int64
}

// CreditedReward is what a race reward actually added to an account after
// the daily caps, with the level rewards it triggered.
type CreditedReward struct {
	AccountID string
	Exp       int64
	Lucci     int64
	LevelUps  []economy.LevelReward
}

// SettledResult is one ranked racer; AccountID is empty for guests.
type SettledResult struct {
	PlayerID  string
	AccountID string
	Name      string
	Rank      int
	ElapsedMs *int
	Points    int
	Team      int // 1 or 2 in a team race, else 0
	// DistanceMeters is how far along the track the racer got; Camera says
	// it raced with a replay camera (item category 12) equipped.
	DistanceMeters int
	Camera         bool
}

// SaveSettlement stores a race once. The outcome row is the idempotency key:
// a repeated submission changes nothing and reports duplicate. For a new
// race, every newly inserted result of a registered account adds to that
// account's player_stats: one race always, and points, wins (rank 1) and
// podiums (rank <= 3) only when the racer finished (ElapsedMs set). An
// account counts once per race: of several results with one account id
// only the best ranked is stored. In the same transaction each rewarded
// account is credited its exp and lucci within the daily race caps, with
// level-ups (ledger reasons "race" and "levelup"). Rewards of unknown
// accounts are skipped. The consumables racers used up (Consumed) are taken
// from their stacks in the same transaction, never below 0; a duplicate
// race takes nothing again.
func (s *Store) SaveSettlement(ctx context.Context, in Settlement) (duplicate bool, credited []CreditedReward, err error) {
	in.Results = bestResultPerAccount(in.Results)
	err = inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		duplicate, credited = false, nil
		result, err := tx.ExecContext(ctx, `INSERT IGNORE INTO race_outcomes
			(race_id, room_id, gameplay, track_id, json, created_at) VALUES(?, ?, ?, ?, ?, ?)`,
			in.RaceID, in.RoomID, in.Gameplay, in.TrackID, in.Snapshot, in.CreatedAt)
		if err != nil {
			return err
		}
		inserted, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if inserted == 0 {
			duplicate = true
			return nil
		}
		for _, racer := range in.Results {
			var accountID any
			if racer.AccountID != "" {
				accountID = racer.AccountID
			}
			result, err := tx.ExecContext(ctx, "INSERT IGNORE INTO race_results"+
				"(room_id, race_id, player_id, account_id, name, `rank`, elapsed_ms, points, created_at)"+
				" VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)",
				in.RoomID, in.RaceID, racer.PlayerID, accountID, racer.Name, racer.Rank, racer.ElapsedMs,
				racer.Points, in.CreatedAt)
			if err != nil {
				return err
			}
			if added, err := result.RowsAffected(); err != nil {
				return err
			} else if added == 0 || racer.AccountID == "" {
				continue
			}
			registered, err := addStats(ctx, tx, racer, in.CreatedAt)
			if err != nil {
				return err
			}
			if registered {
				if err := countCareerRace(ctx, tx, in, racer); err != nil {
					return err
				}
				// A member's race adds to its club's activity points (CLUB.md).
				if err := addClubActivity(ctx, tx, racer.AccountID, raceClubPoints(racer), in.CreatedAt); err != nil {
					return err
				}
				// And to the rider's quests (MENUS.md 2).
				if err := addQuestProgress(ctx, tx, racer.AccountID, raceQuestResult(in, racer), in.CreatedAt); err != nil {
					return err
				}
			}
		}
		if credited, err = s.creditRaceRewards(ctx, tx, in); err != nil {
			return err
		}
		return consume(ctx, tx, in.Consumed, in.CreatedAt)
	})
	return duplicate, credited, err
}

// consume takes used-up consumables from their stacks (never below 0), in
// account, category and item order. A stack the account does not hold, or
// has used up, stays as it is.
func consume(ctx context.Context, tx *sql.Tx, consumed []ConsumedItem, at int64) error {
	totals := map[ConsumedItem]int{}
	for _, item := range consumed {
		if item.AccountID != "" && item.Count > 0 {
			key := ConsumedItem{AccountID: item.AccountID, Category: item.Category, ItemID: item.ItemID}
			totals[key] = min(totals[key]+item.Count, MaxQuantity)
		}
	}
	keys := make([]ConsumedItem, 0, len(totals))
	for key := range totals {
		keys = append(keys, key)
	}
	slices.SortFunc(keys, func(a, b ConsumedItem) int {
		return cmp.Or(cmp.Compare(a.AccountID, b.AccountID), cmp.Compare(a.Category, b.Category),
			cmp.Compare(a.ItemID, b.ItemID))
	})
	for _, key := range keys {
		if _, err := tx.ExecContext(ctx, `UPDATE inventory_items SET quantity = GREATEST(quantity - ?, 0),
			updated_at = ? WHERE account_id = ? AND category = ? AND item_id = ? AND system_key = '' AND quantity > 0`,
			totals[key], at, key.AccountID, key.Category, key.ItemID); err != nil {
			return err
		}
	}
	return nil
}

// bestResultPerAccount keeps, for each account id, only its best ranked
// result (a finished time before none, then the lower rank; the first of
// equals), in the original order. Guest results all stay. Since one
// account has at most one live session this only drops results of a race
// that started before the rule held.
func bestResultPerAccount(results []SettledResult) []SettledResult {
	better := func(a, b SettledResult) bool {
		if (a.ElapsedMs != nil) != (b.ElapsedMs != nil) {
			return a.ElapsedMs != nil
		}
		rankA, rankB := a.Rank, b.Rank
		if rankA < 1 {
			rankA = math.MaxInt
		}
		if rankB < 1 {
			rankB = math.MaxInt
		}
		return rankA < rankB
	}
	best := map[string]int{}
	for i, result := range results {
		if result.AccountID == "" {
			continue
		}
		if kept, seen := best[result.AccountID]; !seen || better(result, results[kept]) {
			best[result.AccountID] = i
		}
	}
	if len(best) == 0 {
		return results
	}
	kept := make([]SettledResult, 0, len(results))
	for i, result := range results {
		if result.AccountID == "" || best[result.AccountID] == i {
			kept = append(kept, result)
		}
	}
	return kept
}

// creditRaceRewards credits each account's first reward entry, locking the
// accounts in ascending id order so concurrent settlements cannot deadlock.
func (s *Store) creditRaceRewards(ctx context.Context, tx *sql.Tx, in Settlement) ([]CreditedReward, error) {
	byAccount := map[string]SettledReward{}
	for _, reward := range in.Rewards {
		if _, seen := byAccount[reward.AccountID]; !seen && reward.AccountID != "" {
			byAccount[reward.AccountID] = reward
		}
	}
	ids := make([]string, 0, len(byAccount))
	for id := range byAccount {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	var credited []CreditedReward
	for _, id := range ids {
		reward := byAccount[id]
		l, err := s.lockLedger(ctx, tx, id, in.CreatedAt)
		if errors.Is(err, errAccountNotFound) {
			continue // a guest id, or an account that is gone
		} else if err != nil {
			return nil, err
		}
		counter, err := l.lockDaily(in.RewardDay, DailyRace)
		if err != nil {
			return nil, err
		}
		exp := rewards.CapDaily(counter.exp, reward.Exp, rewards.DailyRaceExpCap)
		lucci := rewards.CapDaily(counter.lucci, reward.Lucci, rewards.DailyRaceLucciCap)
		entry := CreditedReward{AccountID: id}
		if entry.Exp, _, err = l.addExp(exp, ReasonRace, in.RaceID, ""); err != nil {
			return nil, err
		}
		before := l.wallet.Lucci
		if _, err := l.add(economy.Lucci, lucci, ReasonRace, in.RaceID, ""); err != nil {
			return nil, err
		}
		entry.Lucci = l.wallet.Lucci - before
		if err := l.addDaily(in.RewardDay, DailyRace, exp, lucci); err != nil {
			return nil, err
		}
		entry.LevelUps = l.levelUpsOrEmpty()
		credited = append(credited, entry)
	}
	return credited, nil
}

// addStats reports whether racer's account exists.
func addStats(ctx context.Context, tx *sql.Tx, racer SettledResult, at int64) (bool, error) {
	registered, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE id = ?", racer.AccountID)
	if err != nil || !registered {
		return false, err
	}
	wins, podiums, points := 0, 0, 0
	if racer.ElapsedMs != nil {
		points = racer.Points
		if racer.Rank == 1 {
			wins = 1
		}
		if racer.Rank <= 3 {
			podiums = 1
		}
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO player_stats(account_id, races, wins, podiums, points, updated_at)
		VALUES(?, 1, ?, ?, ?, ?) AS incoming
		ON DUPLICATE KEY UPDATE
			races = player_stats.races + incoming.races,
			wins = player_stats.wins + incoming.wins,
			podiums = player_stats.podiums + incoming.podiums,
			points = player_stats.points + incoming.points,
			updated_at = GREATEST(player_stats.updated_at, incoming.updated_at)`,
		racer.AccountID, wins, podiums, points, at)
	return err == nil, err
}

// countCareerRace adds one race to the career tallies of a registered
// racer: a finish or a retire (no finish time), a win (rank 1 with a time;
// in a team race, being on the winning team) and the meters driven, each by
// race class and track theme (and the meters with a replay camera), and the
// consecutive-retire streak.
func countCareerRace(ctx context.Context, tx *sql.Tx, in Settlement, racer SettledResult) error {
	data, err := career.Default()
	if err != nil {
		return err
	}
	gameType := career.RaceGameType(in.Team, in.Infinite, in.Item)
	theme := data.ThemeOf(in.TrackID)
	finished := racer.ElapsedMs != nil
	kind := career.RaceRetire
	if finished {
		kind = career.RaceFinish
	}
	deltas := map[string]int64{career.RaceCounter(kind, gameType, theme): 1}
	won := finished && racer.Rank == 1
	if in.Team {
		won = in.WinningTeam != 0 && racer.Team == in.WinningTeam
	}
	if won {
		deltas[career.RaceCounter(career.RaceWin, gameType, theme)] = 1
	}
	if racer.DistanceMeters > 0 {
		deltas[career.RaceCounter(career.RaceDistance, gameType, theme)] = int64(racer.DistanceMeters)
		if racer.Camera {
			deltas[career.CounterCameraDistance] = int64(racer.DistanceMeters)
		}
	}
	if err := addCounters(ctx, tx, racer.AccountID, deltas, in.CreatedAt); err != nil {
		return err
	}
	return countRetireStreak(ctx, tx, racer.AccountID, !finished, in.CreatedAt)
}

// SaveRoomRules upserts the rules of one room. An update older than the
// stored one is ignored; equal timestamps overwrite (later delivery wins).
// The json assignment must come first: it compares against the old updated_at.
func (s *Store) SaveRoomRules(ctx context.Context, roomID, rules string, updatedAt int64) error {
	_, err := s.db.ExecContext(ctx, `INSERT INTO room_rules(room_id, json, updated_at) VALUES(?, ?, ?) AS incoming
		ON DUPLICATE KEY UPDATE
			json = IF(incoming.updated_at >= room_rules.updated_at, incoming.json, room_rules.json),
			updated_at = GREATEST(room_rules.updated_at, incoming.updated_at)`,
		roomID, rules, updatedAt)
	return err
}
