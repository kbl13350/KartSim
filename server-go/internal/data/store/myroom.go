package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"slices"

	"kartsim/internal/data/career"
	"kartsim/internal/shared/apierr"
)

// My Room careers (成就) and emblems (徽章). Progress is measured live from
// what the store already holds plus account_counters (race and time-attack
// tallies kept by SaveSettlement and SettleTimeAttack) and account_login_days;
// completed careers and owned emblems are stored.

var (
	errUnknownCareer      = apierr.New(http.StatusNotFound, "UNKNOWN_CAREER")
	errCareerNotComplete  = apierr.New(http.StatusConflict, "CAREER_NOT_COMPLETE")
	errCareerRewarded     = apierr.New(http.StatusConflict, "CAREER_ALREADY_COMPLETED")
	errEmblemNotOwned     = apierr.New(http.StatusConflict, "EMBLEM_NOT_OWNED")
	errInvalidMainEmblems = apierr.New(http.StatusBadRequest, "INVALID_MAIN_EMBLEMS")
)

// Emblem sources.
const EmblemSourceCareer = "career"

// MainEmblemSlots is how many representative emblems a room shows.
const MainEmblemSlots = 2

type rowsQueryer interface {
	queryer
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// RecordLoginDay notes that an account signed in on a Beijing day
// ("YYYY-MM-DD"); repeats are ignored.
func (s *Store) RecordLoginDay(ctx context.Context, accountID, day string) error {
	_, err := s.db.ExecContext(ctx, "INSERT IGNORE INTO account_login_days(account_id, day) VALUES(?, ?)",
		accountID, day)
	if missingParent(err) {
		return nil
	}
	return err
}

// ContactByNickname finds an account by nickname (case-insensitive).
func (s *Store) ContactByNickname(ctx context.Context, nickname string) (Contact, bool, error) {
	return contactWhere(ctx, s.db, "a.nickname = ?", nickname)
}

// CareerFacts gathers what career.Data.Evaluate needs about an account.
func (s *Store) CareerFacts(ctx context.Context, accountID string, now int64) (career.Facts, error) {
	return careerFacts(ctx, s.db, accountID, now)
}

func careerFacts(ctx context.Context, q rowsQueryer, accountID string, now int64) (career.Facts, error) {
	f := career.Facts{LoginDates: map[string]bool{}, Collected: map[int]map[int]bool{},
		Owned: map[int]map[int]bool{}, Emblems: map[int]bool{}, Counters: map[string]int64{},
		Rewarded: map[int]bool{}, RewardedAt: map[int]int64{}}
	var createdAt int64
	err := q.QueryRowContext(ctx, `SELECT a.created_at, COALESCE(p.exp, 0), COALESCE(w.lucci, 0)
		FROM accounts a LEFT JOIN account_progress p ON p.account_id = a.id
		LEFT JOIN wallets w ON w.account_id = a.id WHERE a.id = ?`, accountID).Scan(&createdAt, &f.Exp, &f.Lucci)
	if errors.Is(err, sql.ErrNoRows) {
		return f, errAccountNotFound
	} else if err != nil {
		return f, err
	}
	if now > createdAt {
		f.RegisteredDays = (now - createdAt) / 86_400_000
	}
	err = q.QueryRowContext(ctx, `SELECT
		(SELECT COUNT(*) FROM friendships WHERE account_id = ?),
		(SELECT COALESCE(SUM(-delta), 0) FROM wallet_ledger WHERE account_id = ? AND currency = 'lucci' AND delta < 0)`,
		accountID, accountID).Scan(&f.Friends, &f.LucciSpent)
	if err != nil {
		return f, err
	}
	each := func(query string, scan func(*sql.Rows) error) error {
		rows, err := q.QueryContext(ctx, query, accountID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			if err := scan(rows); err != nil {
				return err
			}
		}
		return rows.Err()
	}
	add := func(set map[int]map[int]bool, category, item int) {
		if set[category] == nil {
			set[category] = map[int]bool{}
		}
		set[category][item] = true
	}
	if err := each("SELECT day FROM account_login_days WHERE account_id = ?", func(rows *sql.Rows) error {
		var day string
		if err := rows.Scan(&day); err != nil {
			return err
		}
		if len(day) == len("2006-01-02") {
			f.LoginDates[day[5:]] = true
		}
		return nil
	}); err != nil {
		return f, err
	}
	if err := each("SELECT category, item_id, expires_at FROM inventory_items WHERE account_id = ?", func(rows *sql.Rows) error {
		var category, item int
		var expires sql.NullInt64
		if err := rows.Scan(&category, &item, &expires); err != nil {
			return err
		}
		add(f.Collected, category, item)
		if !expires.Valid || expires.Int64 > now {
			add(f.Owned, category, item)
		}
		return nil
	}); err != nil {
		return f, err
	}
	if err := each("SELECT emblem_id, main_slot FROM account_emblems WHERE account_id = ?", func(rows *sql.Rows) error {
		var id int
		var slot sql.NullInt64
		if err := rows.Scan(&id, &slot); err != nil {
			return err
		}
		f.Emblems[id] = true
		if slot.Valid {
			f.MainEmblems++
		}
		return nil
	}); err != nil {
		return f, err
	}
	if err := each("SELECT counter, value FROM account_counters WHERE account_id = ?", func(rows *sql.Rows) error {
		var name string
		var value int64
		if err := rows.Scan(&name, &value); err != nil {
			return err
		}
		f.Counters[name] = value
		return nil
	}); err != nil {
		return f, err
	}
	if err := each("SELECT career_id, completed_at FROM account_careers WHERE account_id = ?", func(rows *sql.Rows) error {
		var id int
		var at int64
		if err := rows.Scan(&id, &at); err != nil {
			return err
		}
		f.Rewarded[id], f.RewardedAt[id] = true, at
		return nil
	}); err != nil {
		return f, err
	}
	var profile sql.NullString
	err = q.QueryRowContext(ctx, "SELECT json FROM account_profiles WHERE account_id = ?", accountID).Scan(&profile)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return f, err
	}
	if profile.Valid {
		var doc struct {
			MyRoom struct {
				DisplayKarts []json.RawMessage `json:"displayKarts"`
			} `json:"myRoom"`
		}
		if json.Unmarshal([]byte(profile.String), &doc) == nil {
			f.DisplayKarts = len(doc.MyRoom.DisplayKarts)
		}
	}
	return f, nil
}

// CareerRecord is a completed career.
type CareerRecord struct {
	ID          int   `json:"id"`
	CompletedAt int64 `json:"completedAt"`
}

// RecentCareers lists an account's latest completed careers, newest first.
func (s *Store) RecentCareers(ctx context.Context, accountID string, limit int) ([]CareerRecord, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT career_id, completed_at FROM account_careers
		WHERE account_id = ? ORDER BY completed_at DESC, career_id DESC LIMIT ?`, accountID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []CareerRecord{}
	for rows.Next() {
		var record CareerRecord
		if err := rows.Scan(&record.ID, &record.CompletedAt); err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

// CareerCompletion is what completing a career granted.
type CareerCompletion struct {
	Career career.Progress
	Point  int // the career's rewardPoint
	Points int // the account's career points afterwards
	Emblem int // the emblem granted now, 0 when none (or already owned)
}

// CompleteCareer stores a career the account has reached (点击完成) and
// grants its emblem. The account row lock serializes completions of one
// account, so a career is completed and rewarded once.
func (s *Store) CompleteCareer(ctx context.Context, data *career.Data, accountID string, careerID int,
	now int64) (CareerCompletion, error) {
	c, ok := data.Career(careerID)
	if !ok {
		return CareerCompletion{}, errUnknownCareer
	}
	var result CareerCompletion
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result = CareerCompletion{}
		if found, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE id = ? FOR UPDATE", accountID); err != nil {
			return err
		} else if !found {
			return errAccountNotFound
		}
		facts, err := careerFacts(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		if facts.Rewarded[careerID] {
			return errCareerRewarded
		}
		if (c.Pre != 0 && !facts.Rewarded[c.Pre]) || !data.Reached(c, facts) {
			return errCareerNotComplete
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO account_careers(account_id, career_id, completed_at)
			VALUES(?, ?, ?)`, accountID, careerID, now); err != nil {
			return err
		}
		result.Point = c.Point
		if c.Emblem != 0 {
			granted, err := grantEmblem(ctx, tx, accountID, c.Emblem, EmblemSourceCareer, careerID, now)
			if err != nil {
				return err
			}
			if granted {
				result.Emblem = c.Emblem
				facts.Emblems[c.Emblem] = true
			}
		}
		facts.Rewarded[careerID] = true
		facts.RewardedAt[careerID] = now
		result.Career = data.Progress(c, facts)
		result.Points = data.Points(facts.Rewarded)
		return nil
	})
	return result, err
}

func grantEmblem(ctx context.Context, tx *sql.Tx, accountID string, emblemID int, source string, ref int,
	now int64) (bool, error) {
	result, err := tx.ExecContext(ctx, `INSERT IGNORE INTO account_emblems(account_id, emblem_id, source, ref,
		created_at) VALUES(?, ?, ?, ?, ?)`, accountID, emblemID, source, ref, now)
	if err != nil {
		return false, err
	}
	added, err := result.RowsAffected()
	return added > 0, err
}

// EmblemRecord is an owned emblem; Slot is its representative slot (0 or
// 1), or -1.
type EmblemRecord struct {
	ID       int   `json:"id"`
	Acquired int64 `json:"acquiredAt"`
	Slot     int   `json:"-"`
}

// Emblems lists an account's emblems, newest first, and its representative
// emblems by slot (0 for an empty slot).
func (s *Store) Emblems(ctx context.Context, accountID string) ([]EmblemRecord, [MainEmblemSlots]int, error) {
	var main [MainEmblemSlots]int
	rows, err := s.db.QueryContext(ctx, `SELECT emblem_id, created_at, main_slot FROM account_emblems
		WHERE account_id = ? ORDER BY created_at DESC, emblem_id`, accountID)
	if err != nil {
		return nil, main, err
	}
	defer rows.Close()
	records := []EmblemRecord{}
	for rows.Next() {
		record := EmblemRecord{Slot: -1}
		var slot sql.NullInt64
		if err := rows.Scan(&record.ID, &record.Acquired, &slot); err != nil {
			return nil, main, err
		}
		if slot.Valid && slot.Int64 >= 0 && slot.Int64 < MainEmblemSlots {
			record.Slot = int(slot.Int64)
			main[record.Slot] = record.ID
		}
		records = append(records, record)
	}
	return records, main, rows.Err()
}

// SetMainEmblems sets the representative emblems (0 leaves a slot empty).
// The original rules hold: both must be owned, distinct, and the first slot
// cannot be empty while the second is set (前面徽章槽不能为空).
func (s *Store) SetMainEmblems(ctx context.Context, accountID string, main [MainEmblemSlots]int) error {
	if main[0] == 0 && main[1] != 0 {
		return errInvalidMainEmblems
	}
	if main[0] != 0 && main[0] == main[1] {
		return errInvalidMainEmblems
	}
	return inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		if found, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE id = ? FOR UPDATE", accountID); err != nil {
			return err
		} else if !found {
			return errAccountNotFound
		}
		for _, id := range main {
			if id == 0 {
				continue
			}
			owned, err := exists(ctx, tx, "SELECT 1 FROM account_emblems WHERE account_id = ? AND emblem_id = ?",
				accountID, id)
			if err != nil {
				return err
			}
			if !owned {
				return errEmblemNotOwned
			}
		}
		if _, err := tx.ExecContext(ctx, "UPDATE account_emblems SET main_slot = NULL WHERE account_id = ? AND main_slot IS NOT NULL",
			accountID); err != nil {
			return err
		}
		for slot, id := range main {
			if id == 0 {
				continue
			}
			if _, err := tx.ExecContext(ctx, "UPDATE account_emblems SET main_slot = ? WHERE account_id = ? AND emblem_id = ?",
				slot, accountID, id); err != nil {
				return err
			}
		}
		return nil
	})
}

// GrantEmblem gives an account an emblem (admin tools and tests); it
// reports whether the account did not have it yet.
func (s *Store) GrantEmblem(ctx context.Context, accountID string, emblemID int, source string, ref int,
	now int64) (bool, error) {
	var granted bool
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		var err error
		granted, err = grantEmblem(ctx, tx, accountID, emblemID, source, ref, now)
		if missingParent(err) {
			return errAccountNotFound
		}
		return err
	})
	return granted, err
}

// addCounters adds deltas to an account's counters.
func addCounters(ctx context.Context, tx *sql.Tx, accountID string, deltas map[string]int64, now int64) error {
	names := make([]string, 0, len(deltas))
	for name := range deltas {
		names = append(names, name)
	}
	slices.Sort(names) // a fixed lock order
	for _, name := range names {
		if _, err := tx.ExecContext(ctx, `INSERT INTO account_counters(account_id, counter, value, updated_at)
			VALUES(?, ?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE
			value = account_counters.value + incoming.value, updated_at = incoming.updated_at`,
			accountID, name, deltas[name], now); err != nil {
			return err
		}
	}
	return nil
}

// countRetireStreak keeps the consecutive-retire tally (career type 54): a
// retire extends the streak and raises its maximum, a finish resets it.
func countRetireStreak(ctx context.Context, tx *sql.Tx, accountID string, retired bool, now int64) error {
	if !retired {
		_, err := tx.ExecContext(ctx, `UPDATE account_counters SET value = 0, updated_at = ?
			WHERE account_id = ? AND counter = ?`, now, accountID, career.CounterRetireStreak)
		return err
	}
	if err := addCounters(ctx, tx, accountID, map[string]int64{career.CounterRetireStreak: 1}, now); err != nil {
		return err
	}
	var streak int64
	if err := tx.QueryRowContext(ctx, "SELECT value FROM account_counters WHERE account_id = ? AND counter = ?",
		accountID, career.CounterRetireStreak).Scan(&streak); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `INSERT INTO account_counters(account_id, counter, value, updated_at)
		VALUES(?, ?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE
		value = GREATEST(account_counters.value, incoming.value), updated_at = incoming.updated_at`,
		accountID, career.CounterRetireStreakMax, streak, now)
	return err
}

// IsBlocked reports whether account blocked another (messenger blocks).
func (s *Store) IsBlocked(ctx context.Context, accountID, blockedID string) (bool, error) {
	return exists(ctx, s.db, "SELECT 1 FROM account_blocks WHERE account_id = ? AND blocked_id = ?",
		accountID, blockedID)
}
