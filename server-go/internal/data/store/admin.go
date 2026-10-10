package store

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"strings"

	"kartsim/internal/data/club"
)

// The admin console's lists and account changes (ADMIN.md 3). A list pages
// by offset in a total order (its sort column, then a unique key) and
// counts its total. Sort keys are looked up in each list's column map, so
// only constant SQL of this file is ever spliced into a query; every value
// is a parameter.

// AdminPage is the paging, search and order of one admin list.
type AdminPage struct {
	Offset, Limit int
	// Query is matched as a substring (LIKE metacharacters are literal);
	// "" matches everything.
	Query string
	Sort  string // a key of the list's sort columns; its default otherwise
	Desc  bool
	// From and To bound the list's time column (inclusive); nil is open.
	From, To *int64
}

// adminQuery collects the conditions of one admin query.
type adminQuery struct {
	conds []string
	args  []any
}

func (q *adminQuery) add(cond string, args ...any) {
	q.conds = append(q.conds, cond)
	q.args = append(q.args, args...)
}

// where is the WHERE clause of the conditions ("" without any).
func (q *adminQuery) where() string {
	if len(q.conds) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(q.conds, " AND ")
}

// search matches text as a substring of any of columns. ASCII columns
// (ascii_bin, which MySQL cannot compare with other characters) take part
// only when text is ASCII; text with other characters cannot match them.
func (q *adminQuery) search(text string, columns []string, asciiColumns []string) {
	if text == "" {
		return
	}
	if isASCII(text) {
		columns = append(slices.Clip(columns), asciiColumns...)
	}
	if len(columns) == 0 {
		q.add("FALSE")
		return
	}
	pattern := "%" + escapeLike(text) + "%"
	parts := make([]string, len(columns))
	for i, column := range columns {
		parts[i] = column + " LIKE ?"
		q.args = append(q.args, pattern)
	}
	q.conds = append(q.conds, "("+strings.Join(parts, " OR ")+")")
}

// during bounds a time column by the page's From and To.
func (q *adminQuery) during(column string, page AdminPage) {
	if page.From != nil {
		q.add(column+" >= ?", *page.From)
	}
	if page.To != nil {
		q.add(column+" <= ?", *page.To)
	}
}

// in keeps rows whose column is one of values (none: no rows).
func (q *adminQuery) in(column string, values []string) {
	if len(values) == 0 {
		q.add("FALSE")
		return
	}
	q.add(column+" IN ("+placeholders(len(values))+")", anySlice(values)...)
}

func isASCII(text string) bool {
	for i := 0; i < len(text); i++ {
		if text[i] >= 0x80 {
			return false
		}
	}
	return true
}

func placeholders(n int) string {
	return strings.TrimSuffix(strings.Repeat("?, ", n), ", ")
}

func anySlice(values []string) []any {
	args := make([]any, len(values))
	for i, value := range values {
		args[i] = value
	}
	return args
}

// orderBy is the ORDER BY clause of a page: its sort column (the
// fallback key's when the key is unknown), then the tie-breaking columns,
// all in the page's direction.
func orderBy(page AdminPage, columns map[string]string, fallback string, ties ...string) string {
	column, ok := columns[page.Sort]
	if !ok {
		column = columns[fallback]
	}
	direction := " ASC"
	if page.Desc {
		direction = " DESC"
	}
	clause := " ORDER BY " + column + direction
	for _, tie := range ties {
		clause += ", " + tie + direction
	}
	return clause
}

// limit is the LIMIT clause of a page.
func limit(page AdminPage, args []any) (string, []any) {
	return " LIMIT ? OFFSET ?", append(slices.Clip(args), page.Limit, page.Offset)
}

// count runs a COUNT(*) query.
func (s *Store) count(ctx context.Context, query string, args []any) (int, error) {
	var total int
	err := s.db.QueryRowContext(ctx, query, args...).Scan(&total)
	return total, err
}

// queryRows runs a list query and scans each row with scan.
func (s *Store) queryRows(ctx context.Context, query string, args []any, scan func(*sql.Rows) error) error {
	rows, err := s.db.QueryContext(ctx, query, args...)
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

/* ---------- accounts ---------- */

// AdminAccountRow is one account in the admin console.
type AdminAccountRow struct {
	Account        Account
	CreatedAt      int64
	RegisterIP     string
	LastLoginAt    int64 // 0: never since the login records began
	LastLoginIP    string
	BannedUntil    int64 // 0: never banned or unbanned
	BanReason      string
	Exp            int64
	Wallet         Wallet
	InventoryCount int
	Onboarded      bool
}

// AccountFilter narrows the admin account list.
type AccountFilter struct {
	// IDs keeps only these accounts when not nil (the online filter).
	IDs []string
	// Banned keeps accounts banned at the list's now.
	Banned bool
	// Admin keeps admins: the stored flag or one of AdminNames
	// (KART_ADMIN_USERNAMES, compared case-insensitively).
	Admin      bool
	AdminNames []string
}

var accountSorts = map[string]string{
	"createdAt": "a.created_at", "lastLoginAt": "a.last_login_at", "level": "acc_exp",
	"coupon": "acc_coupon", "lucci": "acc_lucci", "koin": "acc_koin",
}

// adminAccountColumns select an AdminAccountRow; the first two parameters
// are the starting lucci (an account without a wallet row yet shows it)
// and now (unexpired items count).
const adminAccountColumns = `SELECT a.id, a.username, a.nickname, a.admin, a.created_at, a.register_ip,
		a.last_login_at, a.last_login_ip, a.banned_until, a.ban_reason,
		COALESCE(p.exp, 0) AS acc_exp, COALESCE(w.coupon, 0) AS acc_coupon, COALESCE(w.lucci, ?) AS acc_lucci,
		COALESCE(w.koin, 0) AS acc_koin,
		(SELECT COUNT(*) FROM inventory_items i WHERE i.account_id = a.id AND (i.expires_at IS NULL OR i.expires_at > ?)),
		EXISTS(SELECT 1 FROM account_onboarding o WHERE o.account_id = a.id)
	FROM accounts a
	LEFT JOIN wallets w ON w.account_id = a.id
	LEFT JOIN account_progress p ON p.account_id = a.id`

// AdminAccounts lists accounts: q matches the username, nickname and the
// register and latest login addresses; From/To bound the registration
// time. Sort keys: createdAt (default), lastLoginAt, level, coupon, lucci,
// koin.
func (s *Store) AdminAccounts(ctx context.Context, page AdminPage, filter AccountFilter,
	now int64) ([]AdminAccountRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"a.username", "a.nickname", "a.register_ip", "a.last_login_ip"}, nil)
	q.during("a.created_at", page)
	if filter.IDs != nil {
		q.in("a.id", filter.IDs)
	}
	if filter.Banned {
		q.add("a.banned_until > ?", now)
	}
	if filter.Admin {
		if len(filter.AdminNames) == 0 {
			q.add("a.admin = 1")
		} else {
			q.add("(a.admin = 1 OR a.username IN ("+placeholders(len(filter.AdminNames))+"))",
				anySlice(filter.AdminNames)...)
		}
	}
	total, err := s.count(ctx, "SELECT COUNT(*) FROM accounts a"+q.where(), q.args)
	if err != nil || total == 0 {
		return []AdminAccountRow{}, total, err
	}
	tail, args := limit(page, q.args)
	rows, err := s.adminAccounts(ctx, now, q.where()+orderBy(page, accountSorts, "createdAt", "a.id")+tail, args...)
	return rows, total, err
}

// AdminAccount returns the admin view of one account.
func (s *Store) AdminAccount(ctx context.Context, accountID string, now int64) (AdminAccountRow, bool, error) {
	rows, err := s.adminAccounts(ctx, now, " WHERE a.id = ?", accountID)
	if err != nil || len(rows) == 0 {
		return AdminAccountRow{}, false, err
	}
	return rows[0], true, nil
}

func (s *Store) adminAccounts(ctx context.Context, now int64, tail string, args ...any) ([]AdminAccountRow, error) {
	list := []AdminAccountRow{}
	err := s.queryRows(ctx, adminAccountColumns+tail, append([]any{s.rules.StartingLucci, now}, args...),
		func(rows *sql.Rows) error {
			var row AdminAccountRow
			if err := rows.Scan(&row.Account.ID, &row.Account.Username, &row.Account.Nickname, &row.Account.Admin,
				&row.CreatedAt, &row.RegisterIP, &row.LastLoginAt, &row.LastLoginIP, &row.BannedUntil, &row.BanReason,
				&row.Exp, &row.Wallet.Coupon, &row.Wallet.Lucci, &row.Wallet.Koin, &row.InventoryCount,
				&row.Onboarded); err != nil {
				return err
			}
			list = append(list, row)
			return nil
		})
	return list, err
}

// AccountsByID loads the accounts among ids, by id.
func (s *Store) AccountsByID(ctx context.Context, ids []string) (map[string]Account, error) {
	accounts := map[string]Account{}
	for chunk := range slices.Chunk(ids, 500) {
		err := s.queryRows(ctx, "SELECT id, username, nickname, admin FROM accounts WHERE id IN ("+
			placeholders(len(chunk))+")", anySlice(chunk), func(rows *sql.Rows) error {
			var account Account
			if err := rows.Scan(&account.ID, &account.Username, &account.Nickname, &account.Admin); err != nil {
				return err
			}
			accounts[account.ID] = account
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return accounts, nil
}

// SessionCount counts an account's unexpired sessions.
func (s *Store) SessionCount(ctx context.Context, accountID string, now int64) (int, error) {
	return s.count(ctx, "SELECT COUNT(*) FROM sessions WHERE account_id = ? AND expires_at > ?",
		[]any{accountID, now})
}

// AccountPatch is an admin's change to an account; nil fields stay.
type AccountPatch struct {
	Nickname     *string
	Admin        *bool
	BannedUntil  *int64 // 0 lifts a ban
	BanReason    *string
	PasswordHash *string
}

// AdminUpdateAccount applies an admin's changes to an account and returns
// it as it was before. A nickname another account uses is 409
// NICKNAME_TAKEN, an unknown account 404 ACCOUNT_NOT_FOUND. Banning
// (BannedUntil after now) or setting a password deletes every session of
// the account in the same transaction, under the account row lock that
// logins take; their digests are returned.
func (s *Store) AdminUpdateAccount(ctx context.Context, accountID string, patch AccountPatch,
	now int64) (Account, []string, error) {
	var (
		before Account
		ended  []string
	)
	err := inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		ended = nil
		err := tx.QueryRowContext(ctx, "SELECT id, username, nickname, admin FROM accounts WHERE id = ? FOR UPDATE",
			accountID).Scan(&before.ID, &before.Username, &before.Nickname, &before.Admin)
		if errors.Is(err, sql.ErrNoRows) {
			return errAccountNotFound
		} else if err != nil {
			return err
		}
		var q adminQuery
		if patch.Nickname != nil && *patch.Nickname != before.Nickname {
			taken, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE nickname = ? AND id <> ?", *patch.Nickname, accountID)
			if err != nil {
				return err
			}
			if taken {
				return errNicknameTaken
			}
			q.add("nickname = ?", *patch.Nickname)
		}
		if patch.Admin != nil {
			q.add("admin = ?", *patch.Admin)
		}
		if patch.BannedUntil != nil {
			q.add("banned_until = ?", *patch.BannedUntil)
		}
		if patch.BanReason != nil {
			q.add("ban_reason = ?", *patch.BanReason)
		}
		if patch.PasswordHash != nil {
			q.add("password_hash = ?", *patch.PasswordHash)
		}
		if len(q.conds) > 0 {
			if _, err := tx.ExecContext(ctx, "UPDATE accounts SET "+strings.Join(q.conds, ", ")+" WHERE id = ?",
				append(q.args, accountID)...); err != nil {
				return accountConflict(err)
			}
		}
		if (patch.BannedUntil != nil && *patch.BannedUntil > now) || patch.PasswordHash != nil {
			ended, err = endSessions(ctx, tx, accountID)
		}
		return err
	})
	return before, ended, err
}

/* ---------- the overview ---------- */

// AdminOverview are the admin console's headline counts; "today" is since
// the given time (the Beijing midnight).
type AdminOverview struct {
	Accounts, AccountsToday, Admins, Banned int
	// LoginsToday counts logins; LoginAccountsToday the accounts that
	// logged in or registered.
	LoginsToday, LoginAccountsToday int
	RacesToday                      int
	// CouponSpent is what accounts paid in coupons (debits other than
	// admin deductions); CouponGranted what admins granted.
	CouponSpentToday, CouponGrantedToday int64
}

// AdminOverview counts accounts, logins, races and coupons. adminNames are
// the KART_ADMIN_USERNAMES.
func (s *Store) AdminOverview(ctx context.Context, today, now int64, adminNames []string) (AdminOverview, error) {
	var o AdminOverview
	admin := "a.admin = 1"
	args := []any{today}
	if len(adminNames) > 0 {
		admin = "(a.admin = 1 OR a.username IN (" + placeholders(len(adminNames)) + "))"
		args = append(args, anySlice(adminNames)...)
	}
	args = append(args, now)
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(a.created_at >= ?), 0),
		COALESCE(SUM(`+admin+`), 0), COALESCE(SUM(a.banned_until > ?), 0) FROM accounts a`, args...).
		Scan(&o.Accounts, &o.AccountsToday, &o.Admins, &o.Banned); err != nil {
		return o, err
	}
	if err := s.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(kind = ?), 0), COUNT(DISTINCT account_id)
		FROM login_records WHERE at >= ?`, LoginKindLogin, today).Scan(&o.LoginsToday, &o.LoginAccountsToday); err != nil {
		return o, err
	}
	if err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM race_outcomes WHERE created_at >= ?", today).
		Scan(&o.RacesToday); err != nil {
		return o, err
	}
	err := s.db.QueryRowContext(ctx, `SELECT
			COALESCE(SUM(CASE WHEN delta < 0 AND reason <> ? THEN -delta ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN delta > 0 AND reason = ? THEN delta ELSE 0 END), 0)
		FROM wallet_ledger WHERE currency = 'coupon' AND created_at >= ?`, ReasonAdmin, ReasonAdmin, today).
		Scan(&o.CouponSpentToday, &o.CouponGrantedToday)
	return o, err
}

/* ---------- login records ---------- */

// LoginRow is one register or login.
type LoginRow struct {
	ID        int64
	At        int64
	Kind      string
	AccountID string
	Username  string
	Nickname  string
	IP        string
	UserAgent string
}

// LoginFilter narrows the login records: a kind, an account, an exact
// address; "" keeps all.
type LoginFilter struct {
	Kind, AccountID, IP string
}

var loginSorts = map[string]string{"at": "r.at"}

// AdminLogins lists login records, newest first by default: q matches the
// username, nickname and address; From/To bound the time.
func (s *Store) AdminLogins(ctx context.Context, page AdminPage, filter LoginFilter) ([]LoginRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"a.username", "a.nickname", "r.ip"}, nil)
	q.during("r.at", page)
	if filter.Kind != "" {
		q.add("r.kind = ?", filter.Kind)
	}
	if filter.AccountID != "" {
		q.add("r.account_id = ?", filter.AccountID)
	}
	if filter.IP != "" {
		q.add("r.ip = ?", filter.IP)
	}
	from := " FROM login_records r JOIN accounts a ON a.id = r.account_id"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []LoginRow{}, total, err
	}
	tail, args := limit(page, q.args)
	list := []LoginRow{}
	err = s.queryRows(ctx, "SELECT r.id, r.at, r.kind, r.account_id, a.username, a.nickname, r.ip, r.user_agent"+
		from+q.where()+orderBy(page, loginSorts, "at", "r.id")+tail, args, func(rows *sql.Rows) error {
		var row LoginRow
		if err := rows.Scan(&row.ID, &row.At, &row.Kind, &row.AccountID, &row.Username, &row.Nickname, &row.IP,
			&row.UserAgent); err != nil {
			return err
		}
		list = append(list, row)
		return nil
	})
	return list, total, err
}

/* ---------- the ledgers ---------- */

// LedgerRow is one wallet_ledger (Exp false) or exp_ledger (Exp true,
// Currency "exp") row.
type LedgerRow struct {
	Exp          bool
	ID           int64
	At           int64
	AccountID    string
	Username     string
	Nickname     string
	Currency     string
	Delta        int64
	BalanceAfter int64
	Reason       string
	RefID        string
	Note         string
}

// LedgerFilter narrows the ledger: a currency (coupon, lucci, koin or exp),
// a reason, an account; "" keeps all.
type LedgerFilter struct {
	Currency, Reason, AccountID string
}

var ledgerSorts = map[string]string{"at": "created_at", "delta": "delta"}

// AdminLedger lists both ledgers merged, newest first by default: q
// matches the ref and the note; From/To bound the time. Sort keys: at,
// delta.
func (s *Store) AdminLedger(ctx context.Context, page AdminPage, filter LedgerFilter) ([]LedgerRow, int, error) {
	type branch struct {
		table, source, currency, balance string
	}
	var branches []branch
	if filter.Currency != GrantExp {
		branches = append(branches, branch{"wallet_ledger", "'w'", "currency", "balance_after"})
	}
	if filter.Currency == "" || filter.Currency == GrantExp {
		branches = append(branches, branch{"exp_ledger", "'e'", "'exp'", "exp_after"})
	}
	total := 0
	var parts []string
	var args []any
	order := orderBy(page, ledgerSorts, "at", "id")
	for _, b := range branches {
		var q adminQuery
		q.search(page.Query, []string{"note"}, []string{"ref_id"})
		q.during("created_at", page)
		if filter.Currency != "" && b.table == "wallet_ledger" {
			q.add("currency = ?", filter.Currency)
		}
		if filter.Reason != "" {
			q.add("reason = ?", filter.Reason)
		}
		if filter.AccountID != "" {
			q.add("account_id = ?", filter.AccountID)
		}
		n, err := s.count(ctx, "SELECT COUNT(*) FROM "+b.table+q.where(), q.args)
		if err != nil {
			return nil, 0, err
		}
		total += n
		// Each branch needs at most the rows up to the end of the page.
		parts = append(parts, "(SELECT "+b.source+" AS src, id, created_at, account_id, "+b.currency+
			" AS currency, delta, "+b.balance+" AS balance_after, reason, ref_id, note FROM "+b.table+q.where()+
			order+" LIMIT ?)")
		args = append(args, q.args...)
		args = append(args, page.Offset+page.Limit)
	}
	if total == 0 {
		return []LedgerRow{}, 0, nil
	}
	tail, args := limit(page, args)
	list := []LedgerRow{}
	err := s.queryRows(ctx, `SELECT x.src, x.id, x.created_at, x.account_id, a.username, a.nickname, x.currency,
			x.delta, x.balance_after, x.reason, x.ref_id, x.note
		FROM (`+strings.Join(parts, " UNION ALL ")+`) x JOIN accounts a ON a.id = x.account_id`+
		orderBy(page, map[string]string{"at": "x.created_at", "delta": "x.delta"}, "at", "x.src", "x.id")+tail, args,
		func(rows *sql.Rows) error {
			var (
				row    LedgerRow
				source string
			)
			if err := rows.Scan(&source, &row.ID, &row.At, &row.AccountID, &row.Username, &row.Nickname, &row.Currency,
				&row.Delta, &row.BalanceAfter, &row.Reason, &row.RefID, &row.Note); err != nil {
				return err
			}
			row.Exp = source == "e"
			list = append(list, row)
			return nil
		})
	return list, total, err
}

// GrantRow is one admin grant or deduction with the note of its ledger row.
type GrantRow struct {
	At        int64
	Admin     string
	RequestID string
	AccountID string
	Username  string
	Nickname  string
	Currency  string
	Amount    int64
	Note      string
}

// GrantFilter narrows the grants: an account, the granting admin's
// username, a currency; "" keeps all.
type GrantFilter struct {
	AccountID, Admin, Currency string
}

var grantSorts = map[string]string{"at": "g.created_at", "amount": "g.amount"}

// AdminGrants lists admin_grants, newest first by default: q matches the
// admin, the account's username and nickname; From/To bound the time.
// admin_grants has no note: it is the one of the ledger row the grant
// wrote (reason "admin", ref "<admin>:<requestId>"), "" for a grant that
// changed nothing.
func (s *Store) AdminGrants(ctx context.Context, page AdminPage, filter GrantFilter) ([]GrantRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"g.admin", "a.username", "a.nickname"}, nil)
	q.during("g.created_at", page)
	if filter.AccountID != "" {
		q.add("g.account_id = ?", filter.AccountID)
	}
	if filter.Admin != "" {
		q.add("g.admin = ?", filter.Admin)
	}
	if filter.Currency != "" {
		q.add("g.currency = ?", filter.Currency)
	}
	from := " FROM admin_grants g JOIN accounts a ON a.id = g.account_id"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []GrantRow{}, total, err
	}
	// Admin usernames are ASCII, so the ref converts to the ledgers' column
	// type and the lookup stays on their (account, reason, ref) key.
	const ref = "CONVERT(CONCAT(g.admin, ':', g.request_id) USING ascii) COLLATE ascii_bin"
	tail, args := limit(page, append([]any{ReasonAdmin, ReasonAdmin}, q.args...))
	list := []GrantRow{}
	err = s.queryRows(ctx, `SELECT g.created_at, g.admin, g.request_id, g.account_id, a.username, a.nickname,
			g.currency, g.amount, COALESCE(CASE WHEN g.currency = 'exp'
				THEN (SELECT e.note FROM exp_ledger e WHERE e.account_id = g.account_id AND e.reason = ? AND e.ref_id = `+ref+`)
				ELSE (SELECT l.note FROM wallet_ledger l WHERE l.account_id = g.account_id AND l.reason = ?
					AND l.ref_id = `+ref+` AND l.currency = g.currency) END, '')`+
		from+q.where()+orderBy(page, grantSorts, "at", "g.admin", "g.request_id")+tail, args,
		func(rows *sql.Rows) error {
			var row GrantRow
			if err := rows.Scan(&row.At, &row.Admin, &row.RequestID, &row.AccountID, &row.Username, &row.Nickname,
				&row.Currency, &row.Amount, &row.Note); err != nil {
				return err
			}
			list = append(list, row)
			return nil
		})
	return list, total, err
}

/* ---------- races ---------- */

// RaceRow is one settled race with its ranked racers.
type RaceRow struct {
	RaceID       string
	RoomID       string
	At           int64
	Gameplay     string
	TrackID      string
	Players      int
	Participants []RaceParticipant
}

// RaceParticipant is one ranked racer of a race; Exp and Lucci are what
// the race credited the account (nil for guests and racers without one).
type RaceParticipant struct {
	RaceID    string
	At        int64
	Gameplay  string
	TrackID   string
	Rank      int
	Name      string
	AccountID string // "" for guests
	Username  string
	ElapsedMs *int64
	Points    int
	Exp       *int64
	Lucci     *int64
}

// RaceFilter narrows the races: a gameplay, a track, a racing account; ""
// keeps all.
type RaceFilter struct {
	Gameplay, TrackID, AccountID string
}

var raceSorts = map[string]string{"at": "o.created_at"}

// AdminRaces lists race outcomes, newest first by default, each with its
// racers in rank order: q matches the track and the room; From/To bound
// the time.
func (s *Store) AdminRaces(ctx context.Context, page AdminPage, filter RaceFilter) ([]RaceRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"o.track_id"}, []string{"o.room_id", "o.race_id"})
	q.during("o.created_at", page)
	if filter.Gameplay != "" {
		q.add("o.gameplay = ?", filter.Gameplay)
	}
	if filter.TrackID != "" {
		q.add("o.track_id = ?", filter.TrackID)
	}
	if filter.AccountID != "" {
		q.add("o.race_id IN (SELECT r.race_id FROM race_results r WHERE r.account_id = ?)", filter.AccountID)
	}
	total, err := s.count(ctx, "SELECT COUNT(*) FROM race_outcomes o"+q.where(), q.args)
	if err != nil || total == 0 {
		return []RaceRow{}, total, err
	}
	tail, args := limit(page, q.args)
	races := []RaceRow{}
	err = s.queryRows(ctx, `SELECT o.race_id, o.room_id, o.created_at, o.gameplay, o.track_id,
			(SELECT COUNT(*) FROM race_results r WHERE r.race_id = o.race_id)
		FROM race_outcomes o`+q.where()+orderBy(page, raceSorts, "at", "o.race_id")+tail, args,
		func(rows *sql.Rows) error {
			race := RaceRow{Participants: []RaceParticipant{}}
			if err := rows.Scan(&race.RaceID, &race.RoomID, &race.At, &race.Gameplay, &race.TrackID,
				&race.Players); err != nil {
				return err
			}
			races = append(races, race)
			return nil
		})
	if err != nil || len(races) == 0 {
		return races, total, err
	}
	ids := make([]string, len(races))
	index := make(map[string]int, len(races))
	for i, race := range races {
		ids[i], index[race.RaceID] = race.RaceID, i
	}
	participants, err := s.raceParticipants(ctx, " WHERE r.race_id IN ("+placeholders(len(ids))+
		") ORDER BY r.race_id, r.`rank`, r.id", anySlice(ids)...)
	for _, p := range participants {
		race := &races[index[p.RaceID]]
		race.Participants = append(race.Participants, p)
	}
	return races, total, err
}

// AccountRaces returns the latest n races of an account.
func (s *Store) AccountRaces(ctx context.Context, accountID string, n int) ([]RaceParticipant, error) {
	return s.raceParticipants(ctx, " WHERE r.account_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT ?",
		accountID, n)
}

func (s *Store) raceParticipants(ctx context.Context, tail string, args ...any) ([]RaceParticipant, error) {
	list := []RaceParticipant{}
	err := s.queryRows(ctx, "SELECT r.race_id, r.created_at, COALESCE(o.gameplay, ''), COALESCE(o.track_id, ''), "+
		"r.`rank`, r.name, COALESCE(r.account_id, ''), COALESCE(a.username, ''), r.elapsed_ms, r.points, "+
		`(SELECT e.delta FROM exp_ledger e WHERE e.account_id = r.account_id AND e.reason = ? AND e.ref_id = r.race_id),
		(SELECT l.delta FROM wallet_ledger l WHERE l.account_id = r.account_id AND l.reason = ? AND l.ref_id = r.race_id
			AND l.currency = 'lucci')
		FROM race_results r LEFT JOIN race_outcomes o ON o.race_id = r.race_id
		LEFT JOIN accounts a ON a.id = r.account_id`+tail, append([]any{ReasonRace, ReasonRace}, args...),
		func(rows *sql.Rows) error {
			var (
				p                   RaceParticipant
				elapsed, exp, lucci sql.NullInt64
			)
			if err := rows.Scan(&p.RaceID, &p.At, &p.Gameplay, &p.TrackID, &p.Rank, &p.Name, &p.AccountID,
				&p.Username, &elapsed, &p.Points, &exp, &lucci); err != nil {
				return err
			}
			p.ElapsedMs, p.Exp, p.Lucci = nullInt(elapsed), nullInt(exp), nullInt(lucci)
			list = append(list, p)
			return nil
		})
	return list, err
}

func nullInt(value sql.NullInt64) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

/* ---------- purchases, lottery draws, box openings ---------- */

// PurchaseRow is one shop purchase.
type PurchaseRow struct {
	ID        int64
	At        int64
	AccountID string
	Username  string
	Nickname  string
	OfferID   string
	Category  int
	ItemID    int
	Currency  string
	Price     int64
	Days      int
	Count     int
}

// PurchaseFilter narrows the purchases: an account, a currency; "" keeps all.
type PurchaseFilter struct {
	AccountID, Currency string
}

var purchaseSorts = map[string]string{"at": "p.created_at", "price": "p.price"}

// AdminPurchases lists purchases, newest first by default: q matches the
// username, nickname and offer id; From/To bound the time. Sort keys: at,
// price.
func (s *Store) AdminPurchases(ctx context.Context, page AdminPage, filter PurchaseFilter) ([]PurchaseRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"a.username", "a.nickname"}, []string{"p.offer_id"})
	q.during("p.created_at", page)
	if filter.AccountID != "" {
		q.add("p.account_id = ?", filter.AccountID)
	}
	if filter.Currency != "" {
		q.add("p.currency = ?", filter.Currency)
	}
	from := " FROM purchases p JOIN accounts a ON a.id = p.account_id"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []PurchaseRow{}, total, err
	}
	tail, args := limit(page, q.args)
	list := []PurchaseRow{}
	err = s.queryRows(ctx, `SELECT p.id, p.created_at, p.account_id, a.username, a.nickname, p.offer_id, p.category,
			p.item_id, p.currency, p.price, p.days, p.count`+from+q.where()+orderBy(page, purchaseSorts, "at", "p.id")+tail,
		args, func(rows *sql.Rows) error {
			var row PurchaseRow
			if err := rows.Scan(&row.ID, &row.At, &row.AccountID, &row.Username, &row.Nickname, &row.OfferID,
				&row.Category, &row.ItemID, &row.Currency, &row.Price, &row.Days, &row.Count); err != nil {
				return err
			}
			list = append(list, row)
			return nil
		})
	return list, total, err
}

// LotteryDrawRow is one stored lottery draw request (lottery_draws).
type LotteryDrawRow struct {
	At        int64
	RequestID string
	AccountID string
	Username  string
	Nickname  string
	Kind      string
	Ref       int
	Count     int
	Result    string // the stored DrawResult JSON
}

// DrawFilter narrows the lottery draws: an account, a kind (DrawTreasure,
// DrawGacha); "" keeps all.
type DrawFilter struct {
	AccountID, Kind string
}

var drawSorts = map[string]string{"at": "d.created_at"}

// AdminLotteryDraws lists lottery draws, newest first by default: q
// matches the username and nickname; From/To bound the time.
func (s *Store) AdminLotteryDraws(ctx context.Context, page AdminPage, filter DrawFilter) ([]LotteryDrawRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"a.username", "a.nickname"}, nil)
	q.during("d.created_at", page)
	if filter.AccountID != "" {
		q.add("d.account_id = ?", filter.AccountID)
	}
	if filter.Kind != "" {
		q.add("d.kind = ?", filter.Kind)
	}
	from := " FROM lottery_draws d JOIN accounts a ON a.id = d.account_id"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []LotteryDrawRow{}, total, err
	}
	tail, args := limit(page, q.args)
	list := []LotteryDrawRow{}
	err = s.queryRows(ctx, `SELECT d.created_at, d.request_id, d.account_id, a.username, a.nickname, d.kind, d.ref,
			d.count, d.result_json`+from+q.where()+orderBy(page, drawSorts, "at", "d.account_id", "d.request_id")+tail,
		args, func(rows *sql.Rows) error {
			var row LotteryDrawRow
			if err := rows.Scan(&row.At, &row.RequestID, &row.AccountID, &row.Username, &row.Nickname, &row.Kind,
				&row.Ref, &row.Count, &row.Result); err != nil {
				return err
			}
			list = append(list, row)
			return nil
		})
	return list, total, err
}

// BoxOpeningRow is one opened box (box_openings).
type BoxOpeningRow struct {
	At        int64
	RequestID string
	AccountID string
	Username  string
	Nickname  string
	BoxID     int
	StockID   int
	Result    string // the stored BoxOpening JSON
}

// BoxFilter narrows the box openings: an account ("" for all) and a box (0
// for all).
type BoxFilter struct {
	AccountID string
	BoxID     int
}

var boxSorts = map[string]string{"at": "b.created_at"}

// AdminBoxOpenings lists box openings, newest first by default: q matches
// the username and nickname; From/To bound the time.
func (s *Store) AdminBoxOpenings(ctx context.Context, page AdminPage, filter BoxFilter) ([]BoxOpeningRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"a.username", "a.nickname"}, nil)
	q.during("b.created_at", page)
	if filter.AccountID != "" {
		q.add("b.account_id = ?", filter.AccountID)
	}
	if filter.BoxID != 0 {
		q.add("b.box_id = ?", filter.BoxID)
	}
	from := " FROM box_openings b JOIN accounts a ON a.id = b.account_id"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []BoxOpeningRow{}, total, err
	}
	tail, args := limit(page, q.args)
	list := []BoxOpeningRow{}
	err = s.queryRows(ctx, `SELECT b.created_at, b.request_id, b.account_id, a.username, a.nickname, b.box_id,
			b.stock_id, b.result_json`+from+q.where()+orderBy(page, boxSorts, "at", "b.account_id", "b.request_id")+tail,
		args, func(rows *sql.Rows) error {
			var row BoxOpeningRow
			if err := rows.Scan(&row.At, &row.RequestID, &row.AccountID, &row.Username, &row.Nickname, &row.BoxID,
				&row.StockID, &row.Result); err != nil {
				return err
			}
			list = append(list, row)
			return nil
		})
	return list, total, err
}

/* ---------- clubs and inventories ---------- */

// ClubRow is one club in the admin console.
type ClubRow struct {
	ID             int64
	Name           string
	MasterID       string
	MasterUsername string
	MasterNickname string
	Members        int
	HQ, Racing     int
	Rider, Bank    int
	Budget         int64
	CS             int64
	CSWeek         int64 // this week's points (0 when the club earned none yet)
	AutoJoin       bool
	CreatedAt      int64
	BreakAt        *int64 // when a disbanding club goes
}

var clubSorts = map[string]string{
	"createdAt": "c.created_at", "name": "c.name", "members": "club_members", "cs": "c.cs",
	"csWeek": "club_cs_week", "budget": "c.budget",
}

// AdminClubs lists clubs, newest first by default: q matches the name and
// the master's username and nickname; From/To bound the creation time.
// Sort keys: createdAt, name, members, cs, csWeek, budget.
func (s *Store) AdminClubs(ctx context.Context, page AdminPage, now int64) ([]ClubRow, int, error) {
	var q adminQuery
	q.search(page.Query, []string{"c.name", "a.username", "a.nickname"}, nil)
	q.during("c.created_at", page)
	from := " FROM clubs c LEFT JOIN accounts a ON a.id = c.master_id"
	total, err := s.count(ctx, "SELECT COUNT(*)"+from+q.where(), q.args)
	if err != nil || total == 0 {
		return []ClubRow{}, total, err
	}
	tail, args := limit(page, append([]any{club.Week(now)}, q.args...))
	list := []ClubRow{}
	err = s.queryRows(ctx, `SELECT c.id, c.name, c.master_id, COALESCE(a.username, ''), COALESCE(a.nickname, ''),
			(SELECT COUNT(*) FROM club_members m WHERE m.club_id = c.id) AS club_members, c.hq, c.racing, c.rider,
			c.bank, c.budget, c.cs, CASE WHEN c.week = ? THEN c.cs_week ELSE 0 END AS club_cs_week, c.auto_join,
			c.created_at, c.break_at`+from+q.where()+orderBy(page, clubSorts, "createdAt", "c.id")+tail, args,
		func(rows *sql.Rows) error {
			var (
				row     ClubRow
				breakAt sql.NullInt64
			)
			if err := rows.Scan(&row.ID, &row.Name, &row.MasterID, &row.MasterUsername, &row.MasterNickname,
				&row.Members, &row.HQ, &row.Racing, &row.Rider, &row.Bank, &row.Budget, &row.CS, &row.CSWeek,
				&row.AutoJoin, &row.CreatedAt, &breakAt); err != nil {
				return err
			}
			row.BreakAt = nullInt(breakAt)
			list = append(list, row)
			return nil
		})
	return list, total, err
}

// AdminInventoryRow is one inventory row, expired and used-up ones too.
type AdminInventoryRow struct {
	ID        int64
	Category  int
	ItemID    int
	SystemKey string
	Quantity  int
	ExpiresAt *int64 // nil: permanent
	Source    string
	CreatedAt int64
	UpdatedAt int64
}

// AdminInventory returns every inventory row of an account, oldest first.
func (s *Store) AdminInventory(ctx context.Context, accountID string) ([]AdminInventoryRow, error) {
	list := []AdminInventoryRow{}
	err := s.queryRows(ctx, `SELECT id, category, item_id, system_key, quantity, expires_at, source, created_at, updated_at
		FROM inventory_items WHERE account_id = ? ORDER BY id`, []any{accountID}, func(rows *sql.Rows) error {
		var (
			row     AdminInventoryRow
			expires sql.NullInt64
		)
		if err := rows.Scan(&row.ID, &row.Category, &row.ItemID, &row.SystemKey, &row.Quantity, &expires, &row.Source,
			&row.CreatedAt, &row.UpdatedAt); err != nil {
			return err
		}
		row.ExpiresAt = nullInt(expires)
		list = append(list, row)
		return nil
	})
	return list, err
}
