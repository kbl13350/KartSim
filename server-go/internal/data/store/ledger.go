package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"kartsim/internal/data/economy"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/rewards"
)

// DefaultStartingLucci is what a new account receives (ECONOMY.md 2.3).
const DefaultStartingLucci = 10_000

// MaxBalance bounds every wallet balance. Rewards stop at it; an admin
// grant past it is refused. It keeps sums far from int64 overflow.
const MaxBalance = 1_000_000_000_000

// Ledger reasons (wallet_ledger.reason and exp_ledger.reason). Together
// with ref_id they are the idempotency key of every credit or debit.
const (
	ReasonStarter    = "starter"    // starting lucci; ref "signup"
	ReasonRace       = "race"       // online race reward; ref = raceId
	ReasonLevelUp    = "levelup"    // level-up reward; ref = "L<level>"
	ReasonTimeAttack = "timeattack" // time-attack reward; ref = requestId
	ReasonPurchase   = "purchase"   // shop purchase; ref = requestId
	ReasonAdmin      = "admin"      // admin grant; ref = "<admin username>:<requestId>"
	// ReasonDictionary (dictionary.go): 道具图鉴 reward; ref = rewarded count
)

// Daily reward counters (daily_rewards.kind).
const (
	DailyRace       = "race"
	DailyTimeAttack = "timeattack"
)

const signupRef = "signup"

var (
	errInsufficientFunds = apierr.New(http.StatusConflict, "INSUFFICIENT_FUNDS")
	errInsufficientExp   = apierr.New(http.StatusConflict, "INSUFFICIENT_EXP")
	errBalanceLimit      = apierr.New(http.StatusConflict, "BALANCE_LIMIT")
	errAccountNotFound   = apierr.New(http.StatusNotFound, "ACCOUNT_NOT_FOUND")
)

// EconomyRules are the configured economy settings.
type EconomyRules struct {
	Data          *economy.Data
	StartingLucci int64
	Rates         rewards.Rates // applied to race and time-attack rewards
}

var errNoEconomyData = errors.New("economy data unavailable")

func (s *Store) economyData() (*economy.Data, error) {
	if s.rules.Data == nil {
		return nil, errNoEconomyData
	}
	return s.rules.Data, nil
}

// Wallet holds the three currencies of an account.
type Wallet struct {
	Coupon int64 `json:"coupon"`
	Lucci  int64 `json:"lucci"`
	Koin   int64 `json:"koin"`
}

// Get returns the balance of currency c.
func (w Wallet) Get(c economy.Currency) int64 {
	switch c {
	case economy.Coupon:
		return w.Coupon
	case economy.Lucci:
		return w.Lucci
	case economy.Koin:
		return w.Koin
	}
	return 0
}

func (w *Wallet) set(c economy.Currency, value int64) {
	switch c {
	case economy.Coupon:
		w.Coupon = value
	case economy.Lucci:
		w.Lucci = value
	case economy.Koin:
		w.Koin = value
	}
}

// walletUpdates are the statements that set one balance; the column name
// never comes from input.
var walletUpdates = map[economy.Currency]string{
	economy.Coupon: "UPDATE wallets SET coupon = ?, updated_at = ? WHERE account_id = ?",
	economy.Lucci:  "UPDATE wallets SET lucci = ?, updated_at = ? WHERE account_id = ?",
	economy.Koin:   "UPDATE wallets SET koin = ?, updated_at = ? WHERE account_id = ?",
}

// ledger is one account's economy inside a transaction. lockLedger takes
// the account's wallet row lock first, so every economy change of one
// account is serialized; transactions that touch several accounts lock
// them in ascending id order.
type ledger struct {
	ctx       context.Context
	tx        *sql.Tx
	accountID string
	now       int64
	levels    *economy.Levels
	wallet    Wallet
	exp       int64
	// levelUps lists the level rewards granted in this transaction.
	levelUps []economy.LevelReward
}

// lockLedger creates the account's wallet and progress rows when they are
// missing (an account from before the economy, or a brand new one) and
// locks them. A created wallet receives the starting lucci exactly once:
// the grant is tied to its ledger row. A missing account is
// errAccountNotFound.
func (s *Store) lockLedger(ctx context.Context, tx *sql.Tx, accountID string, now int64) (*ledger, error) {
	data, err := s.economyData()
	if err != nil {
		return nil, err
	}
	l := &ledger{ctx: ctx, tx: tx, accountID: accountID, now: now, levels: data.Levels}
	// INSERT ... ON DUPLICATE KEY UPDATE takes the exclusive row lock at
	// once, also when the row exists (INSERT IGNORE would take a shared lock
	// that two transactions could then both try to upgrade).
	created, err := upsertRow(ctx, tx, `INSERT INTO wallets(account_id, coupon, lucci, koin, updated_at)
		VALUES(?, 0, 0, 0, ?) ON DUPLICATE KEY UPDATE account_id = account_id`, accountID, now)
	if err != nil {
		if missingParent(err) {
			return nil, errAccountNotFound
		}
		return nil, err
	}
	if _, err := upsertRow(ctx, tx, `INSERT INTO account_progress(account_id, exp, level, updated_at)
		VALUES(?, 0, 1, ?) ON DUPLICATE KEY UPDATE account_id = account_id`, accountID, now); err != nil {
		return nil, err
	}
	if err := tx.QueryRowContext(ctx, "SELECT coupon, lucci, koin FROM wallets WHERE account_id = ? FOR UPDATE",
		accountID).Scan(&l.wallet.Coupon, &l.wallet.Lucci, &l.wallet.Koin); err != nil {
		return nil, err
	}
	if err := tx.QueryRowContext(ctx, "SELECT exp FROM account_progress WHERE account_id = ? FOR UPDATE",
		accountID).Scan(&l.exp); err != nil {
		return nil, err
	}
	if created && s.rules.StartingLucci > 0 {
		if _, err := l.add(economy.Lucci, s.rules.StartingLucci, ReasonStarter, signupRef, ""); err != nil {
			return nil, err
		}
	}
	return l, nil
}

// upsertRow runs an INSERT ... ON DUPLICATE KEY UPDATE that changes nothing
// on a duplicate and reports whether it inserted.
func upsertRow(ctx context.Context, tx *sql.Tx, query string, args ...any) (bool, error) {
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected == 1, err
}

// add changes one balance by delta and writes its ledger row; it reports
// false, changing nothing, when the ledger already has (reason, ref) for
// this currency. A debit below zero is errInsufficientFunds; a credit stops
// at MaxBalance (the ledger records what was applied).
func (l *ledger) add(currency economy.Currency, delta int64, reason, ref, note string) (bool, error) {
	update, ok := walletUpdates[currency]
	if !ok {
		return false, fmt.Errorf("unknown currency %q", currency)
	}
	if delta == 0 {
		return false, nil
	}
	balance := l.wallet.Get(currency)
	var after int64
	if delta > 0 {
		after = balance + min(delta, MaxBalance-balance)
	} else {
		after = balance + delta
		if after < 0 {
			return false, errInsufficientFunds
		}
	}
	if after == balance {
		return false, nil
	}
	_, err := l.tx.ExecContext(l.ctx, `INSERT INTO wallet_ledger
		(account_id, currency, delta, balance_after, reason, ref_id, note, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
		l.accountID, string(currency), after-balance, after, reason, ref, note, l.now)
	if _, duplicate := duplicateKey(err); duplicate {
		return false, nil
	} else if err != nil {
		return false, err
	}
	if _, err := l.tx.ExecContext(l.ctx, update, after, l.now, l.accountID); err != nil {
		return false, err
	}
	l.wallet.set(currency, after)
	return true, nil
}

// addExp changes the account's exp by delta (clamped to the level table's
// exp cap) and grants the rewards of every level reached for the first
// time (ECONOMY.md 1). It returns the exp applied and whether the ledger
// already had (reason, ref). Going below zero is errInsufficientExp.
func (l *ledger) addExp(delta int64, reason, ref, note string) (applied int64, duplicate bool, err error) {
	target := l.exp + delta
	if target < 0 {
		return 0, false, errInsufficientExp
	}
	target = min(target, l.levels.RPLimit)
	if target == l.exp {
		return 0, false, nil
	}
	applied = target - l.exp
	_, err = l.tx.ExecContext(l.ctx, `INSERT INTO exp_ledger(account_id, delta, exp_after, reason, ref_id, note, created_at)
		VALUES(?, ?, ?, ?, ?, ?, ?)`, l.accountID, applied, target, reason, ref, note, l.now)
	if _, dup := duplicateKey(err); dup {
		return 0, true, nil
	} else if err != nil {
		return 0, false, err
	}
	before := l.levels.LevelForExp(l.exp).Level
	after := l.levels.LevelForExp(target).Level
	if _, err := l.tx.ExecContext(l.ctx, "UPDATE account_progress SET exp = ?, level = ?, updated_at = ? WHERE account_id = ?",
		target, after, l.now, l.accountID); err != nil {
		return 0, false, err
	}
	l.exp = target
	// A level's reward is granted once per account: after an admin took exp
	// away, reaching the level again finds its ledger rows and adds nothing.
	for _, reward := range l.levels.LevelUpRewards(before, after) {
		ref := "L" + strconv.Itoa(reward.Level)
		granted := economy.LevelReward{Level: reward.Level}
		for _, part := range []struct {
			currency economy.Currency
			amount   int64
			into     *int64
		}{{economy.Lucci, reward.Lucci, &granted.Lucci}, {economy.Koin, reward.Koin, &granted.Koin},
			{economy.Coupon, reward.Coupon, &granted.Coupon}} {
			if part.amount <= 0 {
				continue
			}
			before := l.wallet.Get(part.currency)
			ok, err := l.add(part.currency, part.amount, ReasonLevelUp, ref, "")
			if err != nil {
				return 0, false, err
			}
			if ok {
				*part.into = l.wallet.Get(part.currency) - before
			}
		}
		if granted.Lucci > 0 || granted.Koin > 0 || granted.Coupon > 0 {
			l.levelUps = append(l.levelUps, granted)
		}
	}
	return applied, false, nil
}

// daily is one account's reward counter for a Beijing day.
type daily struct {
	count      int
	exp, lucci int64
}

// lockDaily returns the account's counter of kind for day, creating it.
func (l *ledger) lockDaily(day, kind string) (daily, error) {
	if _, err := l.tx.ExecContext(l.ctx, `INSERT INTO daily_rewards(account_id, day, kind, count, exp, lucci)
		VALUES(?, ?, ?, 0, 0, 0) ON DUPLICATE KEY UPDATE count = count`, l.accountID, day, kind); err != nil {
		return daily{}, err
	}
	var counter daily
	err := l.tx.QueryRowContext(l.ctx, `SELECT count, exp, lucci FROM daily_rewards
		WHERE account_id = ? AND day = ? AND kind = ? FOR UPDATE`, l.accountID, day, kind).
		Scan(&counter.count, &counter.exp, &counter.lucci)
	return counter, err
}

// addDaily counts one rewarded event and what it granted.
func (l *ledger) addDaily(day, kind string, exp, lucci int64) error {
	_, err := l.tx.ExecContext(l.ctx, `UPDATE daily_rewards SET count = count + 1, exp = exp + ?, lucci = lucci + ?
		WHERE account_id = ? AND day = ? AND kind = ?`, exp, lucci, l.accountID, day, kind)
	return err
}

// levelUpsOrEmpty returns the granted level rewards as a non-nil list.
func (l *ledger) levelUpsOrEmpty() []economy.LevelReward {
	if l.levelUps == nil {
		return []economy.LevelReward{}
	}
	return l.levelUps
}
