package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"maps"
	"net/http"
	"slices"

	"kartsim/internal/data/career"
	"kartsim/internal/data/license"
	"kartsim/internal/data/lottery"
	"kartsim/internal/shared/apierr"
)

// 驾照考试 (RIDER_SCHOOL.md): the rider school steps an account cleared, the
// licenses it took, the PRO qualification records and the PRO license.
// Every change runs under the account's wallet lock (lockLedger), so runs,
// claims and purchases of one account serialize.

// Ledger reason, inventory source and emblem source of license rewards.
const (
	ReasonLicense       = "license" // a currency item of a step reward; ref "<requestId>:<item>"
	SourceLicense       = "license"
	EmblemSourceLicense = "license"
)

// Career counters of the licenses (career types 30 and 31).
const (
	CounterLicenseLevel = career.CounterLicenseLevel
	CounterLicensePro   = career.CounterLicensePro
)

// LicenseTolerance is how much shorter than a run's time the interval
// since the account's previous license run may be.
const LicenseTolerance = 3_000

// MinLicenseMs is the shortest run a step or qualification accepts.
const MinLicenseMs = 1_000

// MaxLicenseMs bounds a run's reported time (ten minutes).
const MaxLicenseMs = 600_000

var (
	errLicenseStep        = apierr.New(http.StatusBadRequest, "INVALID_STEP")
	errLicenseLocked      = apierr.New(http.StatusConflict, "LICENSE_LOCKED")
	errLicenseFailed      = apierr.New(http.StatusConflict, "MISSION_FAILED")
	errLicenseTooSoon     = apierr.New(http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS")
	errLicenseIncomplete  = apierr.New(http.StatusConflict, "LICENSE_INCOMPLETE")
	errLicenseHeld        = apierr.New(http.StatusConflict, "LICENSE_HELD")
	errProNotQualified    = apierr.New(http.StatusConflict, "PRO_NOT_QUALIFIED")
	errLicenseLevel       = apierr.New(http.StatusBadRequest, "INVALID_LEVEL")
	errLicenseRecordTrack = apierr.New(http.StatusBadRequest, "INVALID_TRACK")
)

// LicenseClear is one cleared step: its best time and when it was first
// cleared (PRO steps: in the current period).
type LicenseClear struct {
	Step      int   `json:"step"`
	BestMs    int64 `json:"bestMs"`
	ClearedAt int64 `json:"clearedAt"`
}

// LicenseRecord is the best time on a PRO qualification track.
type LicenseRecord struct {
	Track  string `json:"track"`
	BestMs int64  `json:"bestMs"`
}

// LicenseView is an account's rider school standing.
type LicenseView struct {
	// Level is the license the account holds now: PRO (6) while ProUntil
	// lies ahead, else BaseLevel.
	Level int `json:"level"`
	// BaseLevel is the highest of 新手 to L1 taken (0: none).
	BaseLevel int `json:"baseLevel"`
	// TryLevel is the highest license the account's level may try
	// (leveltable tryLevel; PRO needs L1 and the qualification emblem).
	TryLevel int   `json:"tryLevel"`
	ProUntil int64 `json:"proUntil"`
	// ProPeriod is the period of the PRO license taken last ("" never).
	ProPeriod string `json:"proPeriod"`
	ProCount  int    `json:"proCount"`
	// Qualified: the account owns the PRO qualification emblem.
	Qualified bool `json:"qualified"`
	// Period is the current PRO mission period and ProSteps its two steps.
	Period    string `json:"period"`
	PeriodEnd int64  `json:"periodEnd"`
	ProSteps  []int  `json:"proSteps"`
	// Cleared lists the cleared steps: every step of 新手 to L1, and the
	// PRO steps cleared in the current period.
	Cleared []LicenseClear  `json:"cleared"`
	Records []LicenseRecord `json:"records"`
}

// LicenseReward is the reward stock a first clear granted.
type LicenseReward struct {
	StockID int         `json:"stockId"`
	Name    string      `json:"name"`
	Items   []DrawnItem `json:"items"`
}

// LicenseRun answers a step run.
type LicenseRun struct {
	Step    int            `json:"step"`
	First   bool           `json:"first"`
	NewBest bool           `json:"newBest"`
	BestMs  int64          `json:"bestMs"`
	Reward  *LicenseReward `json:"reward,omitempty"`
	Wallet  Wallet         `json:"wallet"`
}

// LicenseRunRequest is a cleared step reported by the client.
type LicenseRunRequest struct {
	AccountID string
	RequestID string
	Step      int
	ElapsedMs int64
	TryLevel  int
	Now       int64
	Data      *license.Data
	Lottery   *lottery.Data
}

// licenseRow is license_state as read under its lock.
type licenseRow struct {
	level     int
	proUntil  int64
	proPeriod string
	proCount  int
	lastRunAt int64
}

func (r licenseRow) effective(now int64) int {
	if r.proUntil > now {
		return license.Pro
	}
	return r.level
}

// lockLicense reads (creating) the account's license_state row FOR UPDATE.
func lockLicense(ctx context.Context, tx *sql.Tx, accountID string, now int64) (licenseRow, error) {
	if _, err := tx.ExecContext(ctx, `INSERT INTO license_state(account_id, updated_at) VALUES(?, ?)
		ON DUPLICATE KEY UPDATE account_id = account_id`, accountID, now); err != nil {
		if missingParent(err) {
			return licenseRow{}, errAccountNotFound
		}
		return licenseRow{}, err
	}
	var row licenseRow
	err := tx.QueryRowContext(ctx, `SELECT level, pro_until, pro_period, pro_count, last_run_at
		FROM license_state WHERE account_id = ? FOR UPDATE`, accountID).
		Scan(&row.level, &row.proUntil, &row.proPeriod, &row.proCount, &row.lastRunAt)
	return row, err
}

// licenseQueryer reads from the database or a transaction.
type licenseQueryer interface {
	queryer
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// licenseClears reads the cleared steps of the base licenses and of a PRO
// period, by step.
func licenseClears(ctx context.Context, q licenseQueryer, accountID, period string) (map[int]LicenseClear, error) {
	rows, err := q.QueryContext(ctx, `SELECT step, best_ms, cleared_at FROM license_clears
		WHERE account_id = ? AND (period = '' OR period = ?) ORDER BY step`, accountID, period)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cleared := map[int]LicenseClear{}
	for rows.Next() {
		var clear LicenseClear
		if err := rows.Scan(&clear.Step, &clear.BestMs, &clear.ClearedAt); err != nil {
			return nil, err
		}
		cleared[clear.Step] = clear
	}
	return cleared, rows.Err()
}

func licenseRecords(ctx context.Context, q licenseQueryer, accountID string) (map[string]int64, error) {
	rows, err := q.QueryContext(ctx, "SELECT track_id, best_ms FROM license_records WHERE account_id = ?", accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	bests := map[string]int64{}
	for rows.Next() {
		var (
			track string
			best  int64
		)
		if err := rows.Scan(&track, &best); err != nil {
			return nil, err
		}
		bests[track] = best
	}
	return bests, rows.Err()
}

func ownsEmblem(ctx context.Context, q queryer, accountID string, emblemID int) (bool, error) {
	return exists(ctx, q, "SELECT 1 FROM account_emblems WHERE account_id = ? AND emblem_id = ?", accountID, emblemID)
}

// licenseView assembles the view from a state row.
func licenseView(ctx context.Context, q licenseQueryer, data *license.Data, accountID string, row licenseRow,
	tryLevel int, now int64) (LicenseView, error) {
	period := license.ProPeriodAt(now)
	view := LicenseView{Level: row.effective(now), BaseLevel: row.level, TryLevel: tryLevel, ProUntil: row.proUntil,
		ProPeriod: row.proPeriod, ProCount: row.proCount, Period: period.Key, PeriodEnd: period.Ends,
		Cleared: []LicenseClear{}, Records: []LicenseRecord{}}
	for _, step := range data.ProSet(period) {
		view.ProSteps = append(view.ProSteps, step.Step)
	}
	cleared, err := licenseClears(ctx, q, accountID, period.Key)
	if err != nil {
		return LicenseView{}, err
	}
	for _, step := range slices.Sorted(maps.Keys(cleared)) {
		view.Cleared = append(view.Cleared, cleared[step])
	}
	bests, err := licenseRecords(ctx, q, accountID)
	if err != nil {
		return LicenseView{}, err
	}
	for _, q := range data.Pro.Qualify {
		if best, ok := bests[q.Track]; ok {
			view.Records = append(view.Records, LicenseRecord{Track: q.Track, BestMs: best})
		}
	}
	if view.Qualified, err = ownsEmblem(ctx, q, accountID, data.Pro.EmblemID); err != nil {
		return LicenseView{}, err
	}
	return view, nil
}

// License returns an account's rider school standing.
func (s *Store) License(ctx context.Context, data *license.Data, accountID string, tryLevel int,
	now int64) (LicenseView, error) {
	var row licenseRow
	err := s.db.QueryRowContext(ctx, `SELECT level, pro_until, pro_period, pro_count, last_run_at
		FROM license_state WHERE account_id = ?`, accountID).
		Scan(&row.level, &row.proUntil, &row.proPeriod, &row.proCount, &row.lastRunAt)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return LicenseView{}, err
	}
	return licenseView(ctx, s.db, data, accountID, row, tryLevel, now)
}

// licenseOpen reports whether a step may be run: its license is the next
// to take or one already held, the account's level may try it, and the
// step before it in its license is cleared. PRO steps need L1, the
// qualification emblem and must belong to the current period.
func licenseOpen(ctx context.Context, tx *sql.Tx, data *license.Data, accountID string, row licenseRow,
	step *license.Step, owner *license.License, index, tryLevel int, period license.ProPeriod,
	cleared map[int]LicenseClear) error {
	if owner.Level == license.Pro {
		if row.level < license.L1 || !data.InProSet(step.Step, period) {
			return errLicenseLocked
		}
		qualified, err := ownsEmblem(ctx, tx, accountID, data.Pro.EmblemID)
		if err != nil {
			return err
		}
		if !qualified {
			return errProNotQualified
		}
		return nil
	}
	if owner.Level > tryLevel || owner.Level > row.level+1 {
		return errLicenseLocked
	}
	if index > 0 {
		if _, ok := cleared[owner.Steps[index-1].Step]; !ok {
			return errLicenseLocked
		}
	}
	return nil
}

// checkLicensePace refuses a run that cannot have been driven since the
// account's previous license run, and stamps this one.
func checkLicensePace(ctx context.Context, tx *sql.Tx, accountID string, row licenseRow, elapsedMs, now int64) error {
	if row.lastRunAt > 0 && now-row.lastRunAt < elapsedMs-LicenseTolerance {
		return errLicenseTooSoon
	}
	_, err := tx.ExecContext(ctx, "UPDATE license_state SET last_run_at = ?, updated_at = ? WHERE account_id = ?",
		now, now, accountID)
	return err
}

// replayLicenseRun returns the stored answer of a request id, if any.
func replayLicenseRun(ctx context.Context, tx *sql.Tx, accountID, requestID, kind string, ref int,
	into any) (bool, error) {
	var (
		storedKind string
		storedRef  int
		stored     string
	)
	err := tx.QueryRowContext(ctx, `SELECT kind, ref, result_json FROM license_runs
		WHERE account_id = ? AND request_id = ?`, accountID, requestID).Scan(&storedKind, &storedRef, &stored)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	} else if err != nil {
		return false, err
	}
	if storedKind != kind || storedRef != ref {
		return true, errRequestIDReuse
	}
	return true, json.Unmarshal([]byte(stored), into)
}

func saveLicenseRun(ctx context.Context, tx *sql.Tx, accountID, requestID, kind string, ref int, result any,
	now int64) error {
	encoded, err := json.Marshal(result)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO license_runs(account_id, request_id, kind, ref, result_json, created_at)
		VALUES(?, ?, ?, ?, ?, ?)`, accountID, requestID, kind, ref, string(encoded), now)
	return err
}

// License run kinds (license_runs.kind).
const (
	licenseRunStep    = "step"
	licenseRunQualify = "qualify"
)

// RunLicenseStep records a cleared step. The first clear grants the step's
// reward stock (currencies to the wallet, items to the inventory); a later
// clear only improves the best time. The run must meet the step's rule
// (MISSION_FAILED), be open to the account (LICENSE_LOCKED,
// PRO_NOT_QUALIFIED) and keep the pace (TOO_MANY_ATTEMPTS). A replay of the
// request id answers the original.
func (s *Store) RunLicenseStep(ctx context.Context, in LicenseRunRequest) (LicenseRun, LicenseView, error) {
	step, owner, index, ok := in.Data.Step(in.Step)
	if !ok {
		return LicenseRun{}, LicenseView{}, errLicenseStep
	}
	var (
		result LicenseRun
		view   LicenseView
	)
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result, view = LicenseRun{}, LicenseView{}
		l, err := s.lockLedger(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		row, err := lockLicense(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		if replayed, err := replayLicenseRun(ctx, tx, in.AccountID, in.RequestID, licenseRunStep, in.Step,
			&result); replayed || err != nil {
			if err == nil {
				view, err = licenseView(ctx, tx, in.Data, in.AccountID, row, in.TryLevel, in.Now)
			}
			return err
		}
		period := license.ProPeriodAt(in.Now)
		cleared, err := licenseClears(ctx, tx, in.AccountID, period.Key)
		if err != nil {
			return err
		}
		if err := licenseOpen(ctx, tx, in.Data, in.AccountID, row, step, owner, index, in.TryLevel, period,
			cleared); err != nil {
			return err
		}
		if !step.Judge(in.ElapsedMs) {
			return errLicenseFailed
		}
		if err := checkLicensePace(ctx, tx, in.AccountID, row, in.ElapsedMs, in.Now); err != nil {
			return err
		}
		key := ""
		if owner.Level == license.Pro {
			key = period.Key
		}
		result.Step = step.Step
		previous, done := cleared[step.Step]
		switch {
		case !done:
			result.First, result.NewBest, result.BestMs = true, true, in.ElapsedMs
			_, err = tx.ExecContext(ctx, `INSERT INTO license_clears(account_id, step, period, best_ms, cleared_at,
				updated_at) VALUES(?, ?, ?, ?, ?, ?)`, in.AccountID, step.Step, key, in.ElapsedMs, in.Now, in.Now)
		case in.ElapsedMs < previous.BestMs:
			result.NewBest, result.BestMs = true, in.ElapsedMs
			_, err = tx.ExecContext(ctx, `UPDATE license_clears SET best_ms = ?, updated_at = ?
				WHERE account_id = ? AND step = ? AND period = ?`, in.ElapsedMs, in.Now, in.AccountID, step.Step, key)
		default:
			result.BestMs = previous.BestMs
		}
		if err != nil {
			return err
		}
		if result.First {
			stock := in.Data.Stocks[step.StockID]
			grant := lottery.Stock{StockID: step.StockID, Name: stock.Name}
			for _, item := range stock.Items {
				grant.Items = append(grant.Items, lottery.StockItem{Category: item.Category, ItemID: item.ItemID,
					Count: item.Count, Days: item.Days})
			}
			items, err := newLotteryTx(l, in.Lottery).grant(&grant, SourceLicense, ReasonLicense, in.RequestID)
			if err != nil {
				return err
			}
			result.Reward = &LicenseReward{StockID: step.StockID, Name: stock.Name, Items: items}
		}
		result.Wallet = l.wallet
		if err := saveLicenseRun(ctx, tx, in.AccountID, in.RequestID, licenseRunStep, in.Step, result,
			in.Now); err != nil {
			return err
		}
		row.lastRunAt = in.Now
		view, err = licenseView(ctx, tx, in.Data, in.AccountID, row, in.TryLevel, in.Now)
		return err
	})
	return result, view, err
}

// LicenseUpgrade is the answer of taking a license.
type LicenseUpgrade struct {
	Level    int   `json:"level"`
	ProUntil int64 `json:"proUntil,omitempty"`
}

// TakeLicense takes the license of a level once all its steps are cleared:
// 新手 to L1 one after another within the account's tryLevel; PRO with L1,
// the qualification emblem and both steps of the current period, for
// license.ProDays, once per period (LICENSE_HELD when taken already).
func (s *Store) TakeLicense(ctx context.Context, data *license.Data, accountID string, level, tryLevel int,
	now int64) (LicenseUpgrade, LicenseView, error) {
	owner, ok := data.License(level)
	if !ok {
		return LicenseUpgrade{}, LicenseView{}, errLicenseLevel
	}
	var (
		result LicenseUpgrade
		view   LicenseView
	)
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result, view = LicenseUpgrade{}, LicenseView{}
		if _, err := s.lockLedger(ctx, tx, accountID, now); err != nil {
			return err
		}
		row, err := lockLicense(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		period := license.ProPeriodAt(now)
		cleared, err := licenseClears(ctx, tx, accountID, period.Key)
		if err != nil {
			return err
		}
		steps := owner.Steps
		if level == license.Pro {
			switch qualified, err := ownsEmblem(ctx, tx, accountID, data.Pro.EmblemID); {
			case err != nil:
				return err
			case row.level < license.L1:
				return errLicenseLocked
			case !qualified:
				return errProNotQualified
			case row.proPeriod == period.Key:
				return errLicenseHeld
			}
			steps = data.ProSet(period)
		} else {
			switch {
			case level <= row.level:
				return errLicenseHeld
			case level != row.level+1 || level > tryLevel:
				return errLicenseLocked
			}
		}
		for _, step := range steps {
			if _, ok := cleared[step.Step]; !ok {
				return errLicenseIncomplete
			}
		}
		if level == license.Pro {
			row.proUntil = now + license.ProDays*dayMillis
			row.proPeriod = period.Key
			row.proCount++
			result.ProUntil = row.proUntil
			_, err = tx.ExecContext(ctx, `UPDATE license_state SET pro_until = ?, pro_period = ?, pro_count = ?,
				updated_at = ? WHERE account_id = ?`, row.proUntil, row.proPeriod, row.proCount, now, accountID)
			if err == nil {
				err = addCounters(ctx, tx, accountID, map[string]int64{CounterLicensePro: 1}, now)
			}
		} else {
			row.level = level
			_, err = tx.ExecContext(ctx, "UPDATE license_state SET level = ?, updated_at = ? WHERE account_id = ?",
				level, now, accountID)
		}
		if err != nil {
			return err
		}
		if err := raiseCounter(ctx, tx, accountID, CounterLicenseLevel, int64(level), now); err != nil {
			return err
		}
		result.Level = row.effective(now)
		view, err = licenseView(ctx, tx, data, accountID, row, tryLevel, now)
		return err
	})
	return result, view, err
}

// raiseCounter sets a counter to value when that is higher.
func raiseCounter(ctx context.Context, tx *sql.Tx, accountID, name string, value, now int64) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO account_counters(account_id, counter, value, updated_at)
		VALUES(?, ?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE
		value = GREATEST(account_counters.value, incoming.value), updated_at = incoming.updated_at`,
		accountID, name, value, now)
	return err
}

// LicenseQualifyRequest is a finished PRO qualification time trial.
type LicenseQualifyRequest struct {
	AccountID string
	RequestID string
	Track     string
	ElapsedMs int64
	TryLevel  int
	Now       int64
	Data      *license.Data
}

// LicenseQualify answers a qualification run.
type LicenseQualify struct {
	Track   string `json:"track"`
	NewBest bool   `json:"newBest"`
	BestMs  int64  `json:"bestMs"`
}

// RecordLicenseQualify keeps the best time on a PRO qualification track
// (L1 holders only), at the pace of license runs.
func (s *Store) RecordLicenseQualify(ctx context.Context, in LicenseQualifyRequest) (LicenseQualify, LicenseView, error) {
	if _, ok := in.Data.QualifyTrack(in.Track); !ok {
		return LicenseQualify{}, LicenseView{}, errLicenseRecordTrack
	}
	var (
		result LicenseQualify
		view   LicenseView
	)
	ref := 0
	for i, q := range in.Data.Pro.Qualify {
		if q.Track == in.Track {
			ref = i
		}
	}
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		result, view = LicenseQualify{}, LicenseView{}
		if _, err := s.lockLedger(ctx, tx, in.AccountID, in.Now); err != nil {
			return err
		}
		row, err := lockLicense(ctx, tx, in.AccountID, in.Now)
		if err != nil {
			return err
		}
		if replayed, err := replayLicenseRun(ctx, tx, in.AccountID, in.RequestID, licenseRunQualify, ref,
			&result); replayed || err != nil {
			if err == nil {
				view, err = licenseView(ctx, tx, in.Data, in.AccountID, row, in.TryLevel, in.Now)
			}
			return err
		}
		if row.level < license.L1 {
			return errLicenseLocked
		}
		if err := checkLicensePace(ctx, tx, in.AccountID, row, in.ElapsedMs, in.Now); err != nil {
			return err
		}
		bests, err := licenseRecords(ctx, tx, in.AccountID)
		if err != nil {
			return err
		}
		best, ok := bests[in.Track]
		result = LicenseQualify{Track: in.Track, NewBest: !ok || in.ElapsedMs < best, BestMs: best}
		if result.NewBest {
			result.BestMs = in.ElapsedMs
			if _, err := tx.ExecContext(ctx, `INSERT INTO license_records(account_id, track_id, best_ms, updated_at)
				VALUES(?, ?, ?, ?) AS incoming ON DUPLICATE KEY UPDATE best_ms = incoming.best_ms,
				updated_at = incoming.updated_at`, in.AccountID, in.Track, in.ElapsedMs, in.Now); err != nil {
				return err
			}
		}
		if err := saveLicenseRun(ctx, tx, in.AccountID, in.RequestID, licenseRunQualify, ref, result,
			in.Now); err != nil {
			return err
		}
		row.lastRunAt = in.Now
		view, err = licenseView(ctx, tx, in.Data, in.AccountID, row, in.TryLevel, in.Now)
		return err
	})
	return result, view, err
}

// ClaimProEmblem grants the PRO qualification emblem once every
// qualification time is met (PRO_NOT_QUALIFIED otherwise); claiming again
// changes nothing. It reports whether the emblem was new.
func (s *Store) ClaimProEmblem(ctx context.Context, data *license.Data, accountID string, tryLevel int,
	now int64) (bool, LicenseView, error) {
	var (
		granted bool
		view    LicenseView
	)
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		granted, view = false, LicenseView{}
		if _, err := s.lockLedger(ctx, tx, accountID, now); err != nil {
			return err
		}
		row, err := lockLicense(ctx, tx, accountID, now)
		if err != nil {
			return err
		}
		bests, err := licenseRecords(ctx, tx, accountID)
		if err != nil {
			return err
		}
		if row.level < license.L1 || !data.Qualifies(bests) {
			return errProNotQualified
		}
		if granted, err = grantEmblem(ctx, tx, accountID, data.Pro.EmblemID, EmblemSourceLicense, 0, now); err != nil {
			return err
		}
		view, err = licenseView(ctx, tx, data, accountID, row, tryLevel, now)
		return err
	})
	return granted, view, err
}

// LicenseLevel returns the license an account holds now (0 none, 6 PRO).
func (s *Store) LicenseLevel(ctx context.Context, accountID string, now int64) (int, error) {
	var row licenseRow
	err := s.db.QueryRowContext(ctx, "SELECT level, pro_until FROM license_state WHERE account_id = ?",
		accountID).Scan(&row.level, &row.proUntil)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	return row.effective(now), err
}
