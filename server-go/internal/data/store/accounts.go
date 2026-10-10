package store

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"strings"

	"kartsim/internal/shared/apierr"
)

// Account is the public identity of a registered player.
type Account struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Admin    bool   `json:"admin"`
}

// Registration is a validated sign-up request. Hashes are computed by the
// caller, outside any lock.
type Registration struct {
	ID           string
	Username     string
	Nickname     string
	PasswordHash string
	// InviteHash is the digest of the invitation to consume; empty for an
	// open registration without one.
	InviteHash string
	// InviteMode is KART_REGISTRATION=invite: an invitation is required,
	// registrations serialize on GET_LOCK('kartsim_register') and the first
	// account becomes admin (the Java rules).
	InviteMode bool
	// TokenHash and SessionExpiresAt describe the session created with the
	// account (registration logs the player in).
	TokenHash        string
	SessionExpiresAt int64
	CreatedAt        int64
	// IP and UserAgent are where the registration came from: the account's
	// register and latest login address and its "register" login record.
	IP        string
	UserAgent string
}

// Login record kinds (login_records.kind). A resume is the first activity
// of a Beijing day with a session token kept from an earlier login (the
// client remembers it for 30 days), see SeenActivity.
const (
	LoginKindRegister = "register"
	LoginKindLogin    = "login"
	LoginKindResume   = "resume"
)

// LoginRecord is where a successful login came from.
type LoginRecord struct {
	IP        string // the client address; "" when unknown
	UserAgent string // at most 255 bytes
	At        int64
}

var (
	errUsernameTaken = apierr.New(http.StatusConflict, "USERNAME_TAKEN")
	errNicknameTaken = apierr.New(http.StatusConflict, "NICKNAME_TAKEN")
	errInvalidInvite = apierr.New(http.StatusBadRequest, "INVALID_INVITE")
	errBanned        = apierr.New(http.StatusForbidden, "ACCOUNT_BANNED")
)

// bannedError refuses a login of an account banned until until (Unix ms)
// for reason; the error body carries both.
func bannedError(until int64, reason string) error {
	return errBanned.With(map[string]any{"until": until, "reason": reason})
}

// accountConflict maps a duplicate-key error on accounts to the API code.
func accountConflict(err error) error {
	key, ok := duplicateKey(err)
	switch {
	case !ok:
		return err
	case strings.Contains(key, "username"):
		return errUsernameTaken
	case strings.Contains(key, "nickname"):
		return errNicknameTaken
	}
	return err
}

// Bootstrap inserts the first invitation when there are neither invites nor
// accounts. It reports whether the invite was created.
func (s *Store) Bootstrap(ctx context.Context, codeHash string, now int64) (bool, error) {
	created := false
	err := withNamedLock(ctx, s.db, "kartsim_bootstrap", lockWait, func(conn *sql.Conn) error {
		return inTx(ctx, s.db, conn, func(tx *sql.Tx) error {
			var hasInvites, hasAccounts bool
			if err := tx.QueryRowContext(ctx, `SELECT
				EXISTS(SELECT 1 FROM invites), EXISTS(SELECT 1 FROM accounts)`).Scan(&hasInvites, &hasAccounts); err != nil {
				return err
			}
			if hasInvites || hasAccounts {
				return nil
			}
			if _, err := tx.ExecContext(ctx, "INSERT INTO invites(code_hash, created_at) VALUES(?, ?)", codeHash, now); err != nil {
				return err
			}
			created = true
			return nil
		})
	})
	return created, err
}

// RegistrationPrecheck reports the first reason a registration would fail
// (invite, username, nickname, in the Java order) without locking, so a
// doomed request costs no password hash. Register checks again.
func (s *Store) RegistrationPrecheck(ctx context.Context, inviteHash, username, nickname string) error {
	if inviteHash != "" {
		if usable, err := exists(ctx, s.db, "SELECT 1 FROM invites WHERE code_hash = ? AND used_by IS NULL", inviteHash); err != nil {
			return err
		} else if !usable {
			return errInvalidInvite
		}
	}
	if taken, err := exists(ctx, s.db, "SELECT 1 FROM accounts WHERE username = ?", username); err != nil {
		return err
	} else if taken {
		return errUsernameTaken
	}
	if taken, err := exists(ctx, s.db, "SELECT 1 FROM accounts WHERE nickname = ?", nickname); err != nil {
		return err
	} else if taken {
		return errNicknameTaken
	}
	return nil
}

// Register creates an account with its session, wallet (holding the
// starting lucci, ECONOMY.md 2.3) and progress rows, and consumes its
// invitation, checking invite, username and nickname in the Java order.
//
// In invite mode registrations serialize on GET_LOCK('kartsim_register'),
// so the first account (which becomes admin) is decided without a race. In
// open mode nobody becomes admin by registering and no named lock is taken:
// the unique keys decide between concurrent registrations of one name, and
// the locking read of an optional invitation serializes its use.
func (s *Store) Register(ctx context.Context, in Registration) (Account, error) {
	var account Account
	register := func(conn *sql.Conn) error {
		return inTxOptions(ctx, s.db, conn, readCommitted, func(tx *sql.Tx) error {
			if in.InviteMode || in.InviteHash != "" {
				var unused int
				err := tx.QueryRowContext(ctx,
					"SELECT 1 FROM invites WHERE code_hash = ? AND used_by IS NULL FOR UPDATE", in.InviteHash).Scan(&unused)
				if errors.Is(err, sql.ErrNoRows) {
					return errInvalidInvite
				} else if err != nil {
					return err
				}
			}
			if taken, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE username = ?", in.Username); err != nil {
				return err
			} else if taken {
				return errUsernameTaken
			}
			if taken, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE nickname = ?", in.Nickname); err != nil {
				return err
			} else if taken {
				return errNicknameTaken
			}
			admin := false
			if in.InviteMode {
				anyAccount, err := exists(ctx, tx, "SELECT 1 FROM accounts LIMIT 1")
				if err != nil {
					return err
				}
				admin = !anyAccount
			}
			account = Account{ID: in.ID, Username: in.Username, Nickname: in.Nickname, Admin: admin}
			if _, err := tx.ExecContext(ctx, `INSERT INTO accounts(id, username, nickname, password_hash, admin, created_at,
				register_ip, last_login_at, last_login_ip, last_seen_at, last_seen_ip) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				account.ID, account.Username, account.Nickname, in.PasswordHash, account.Admin, in.CreatedAt, in.IP,
				in.CreatedAt, in.IP, in.CreatedAt, in.IP); err != nil {
				return accountConflict(err)
			}
			if err := insertLoginRecord(ctx, tx, account.ID, LoginKindRegister,
				LoginRecord{IP: in.IP, UserAgent: in.UserAgent, At: in.CreatedAt}); err != nil {
				return err
			}
			if in.InviteHash != "" {
				if _, err := tx.ExecContext(ctx, "UPDATE invites SET used_by = ? WHERE code_hash = ?", account.ID, in.InviteHash); err != nil {
					return err
				}
			}
			if _, err := s.lockLedger(ctx, tx, account.ID, in.CreatedAt); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, "INSERT INTO sessions(token_hash, account_id, expires_at) VALUES(?, ?, ?)",
				in.TokenHash, account.ID, in.SessionExpiresAt)
			return err
		})
	}
	var err error
	if in.InviteMode {
		err = withNamedLock(ctx, s.db, "kartsim_register", lockWait, register)
	} else {
		err = register(nil)
	}
	return account, err
}

// LoginAccount returns the account and stored password hash for username.
func (s *Store) LoginAccount(ctx context.Context, username string) (Account, string, bool, error) {
	var (
		account Account
		hash    string
	)
	err := s.db.QueryRowContext(ctx,
		"SELECT id, username, nickname, admin, password_hash FROM accounts WHERE username = ?", username).
		Scan(&account.ID, &account.Username, &account.Nickname, &account.Admin, &hash)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{}, "", false, nil
	}
	return account, hash, err == nil, err
}

// CreateSession stores a session token digest for a verified login and
// records it (see loginSession).
func (s *Store) CreateSession(ctx context.Context, tokenHash, accountID string, expiresAt int64,
	record LoginRecord) error {
	return inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		if err := lockLoginAccount(ctx, tx, accountID, record.At); err != nil {
			return err
		}
		return loginSession(ctx, tx, tokenHash, accountID, expiresAt, record)
	})
}

// CreateExclusiveSession stores a session token digest for a verified
// login, records it (see loginSession) and ends every other session of the
// account (single sign-on: a new login replaces the old ones). It returns
// the digests it ended. Logins of one account are serialized on the
// account row, so two racing logins leave exactly the later one.
func (s *Store) CreateExclusiveSession(ctx context.Context, tokenHash, accountID string,
	expiresAt int64, record LoginRecord) ([]string, error) {
	var replaced []string
	err := inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		var err error
		if err = lockLoginAccount(ctx, tx, accountID, record.At); err != nil {
			return err
		}
		if replaced, err = endSessions(ctx, tx, accountID); err != nil {
			return err
		}
		return loginSession(ctx, tx, tokenHash, accountID, expiresAt, record)
	})
	return replaced, err
}

// lockLoginAccount locks the account row of a login and refuses a banned
// account (403 ACCOUNT_BANNED with until and reason). A ban takes the same
// lock, so no login of a banned account ends with a session.
func lockLoginAccount(ctx context.Context, tx *sql.Tx, accountID string, now int64) error {
	var (
		bannedUntil int64
		reason      string
	)
	err := tx.QueryRowContext(ctx, "SELECT banned_until, ban_reason FROM accounts WHERE id = ? FOR UPDATE", accountID).
		Scan(&bannedUntil, &reason)
	if errors.Is(err, sql.ErrNoRows) {
		return errAccountNotFound
	} else if err != nil {
		return err
	}
	if bannedUntil > now {
		return bannedError(bannedUntil, reason)
	}
	return nil
}

// CheckNotBanned refuses an account banned at now (403 ACCOUNT_BANNED with
// until and reason); an unknown account passes.
func (s *Store) CheckNotBanned(ctx context.Context, accountID string, now int64) error {
	var (
		bannedUntil int64
		reason      string
	)
	err := s.db.QueryRowContext(ctx, "SELECT banned_until, ban_reason FROM accounts WHERE id = ?", accountID).
		Scan(&bannedUntil, &reason)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	} else if err != nil {
		return err
	}
	if bannedUntil > now {
		return bannedError(bannedUntil, reason)
	}
	return nil
}

// loginSession inserts the session of a login with its login record and
// the account's latest login (and activity) time and address; the caller
// holds the account row lock (lockLoginAccount).
func loginSession(ctx context.Context, tx *sql.Tx, tokenHash, accountID string, expiresAt int64,
	record LoginRecord) error {
	if _, err := tx.ExecContext(ctx, "INSERT INTO sessions(token_hash, account_id, expires_at) VALUES(?, ?, ?)",
		tokenHash, accountID, expiresAt); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET last_login_at = ?, last_login_ip = ?,
		last_seen_at = GREATEST(last_seen_at, ?), last_seen_ip = ? WHERE id = ?`,
		record.At, record.IP, record.At, record.IP, accountID); err != nil {
		return err
	}
	return insertLoginRecord(ctx, tx, accountID, LoginKindLogin, record)
}

// SeenActivity notes that an account was active with a session token at
// record.At from record.IP (accounts.last_seen_at and last_seen_ip; an
// older time never replaces a newer one). The first activity of a Beijing
// day (dayStart is its midnight) of an account without a register, login
// or resume record that day also writes a resume record with the address
// and browser, so a player who keeps a remembered token counts among the
// day's logins. It reports whether it wrote one; an unknown account is
// ignored. Callers throttle it (once per account every few minutes).
func (s *Store) SeenActivity(ctx context.Context, accountID string, record LoginRecord, dayStart int64) (bool, error) {
	resumed := false
	err := inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		resumed = false
		var seen int64
		err := tx.QueryRowContext(ctx, "SELECT last_seen_at FROM accounts WHERE id = ? FOR UPDATE", accountID).Scan(&seen)
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		} else if err != nil || record.At < seen {
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE accounts SET last_seen_at = ?, last_seen_ip = ? WHERE id = ?",
			record.At, record.IP, accountID); err != nil {
			return err
		}
		if seen >= dayStart || record.At < dayStart {
			return nil
		}
		recorded, err := exists(ctx, tx, "SELECT 1 FROM login_records WHERE account_id = ? AND at >= ? LIMIT 1",
			accountID, dayStart)
		if err != nil || recorded {
			return err
		}
		resumed = true
		return insertLoginRecord(ctx, tx, accountID, LoginKindResume, record)
	})
	return resumed, err
}

func insertLoginRecord(ctx context.Context, tx *sql.Tx, accountID, kind string, record LoginRecord) error {
	_, err := tx.ExecContext(ctx, "INSERT INTO login_records(account_id, kind, ip, user_agent, at) VALUES(?, ?, ?, ?, ?)",
		accountID, kind, record.IP, record.UserAgent, record.At)
	return err
}

// endSessions deletes every session of an account and returns their
// digests; the caller holds the account row lock.
func endSessions(ctx context.Context, tx *sql.Tx, accountID string) ([]string, error) {
	rows, err := tx.QueryContext(ctx, "SELECT token_hash FROM sessions WHERE account_id = ?", accountID)
	if err != nil {
		return nil, err
	}
	var ended []string
	for rows.Next() {
		var hash string
		if err := rows.Scan(&hash); err != nil {
			rows.Close()
			return nil, err
		}
		ended = append(ended, hash)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	if len(ended) == 0 {
		return nil, nil
	}
	_, err = tx.ExecContext(ctx, "DELETE FROM sessions WHERE account_id = ?", accountID)
	return ended, err
}

// RevokeSessions deletes every session of an account (an admin's kick)
// and returns their digests. 404 ACCOUNT_NOT_FOUND for an unknown account.
func (s *Store) RevokeSessions(ctx context.Context, accountID string) ([]string, error) {
	var ended []string
	err := inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		var locked string
		err := tx.QueryRowContext(ctx, "SELECT id FROM accounts WHERE id = ? FOR UPDATE", accountID).Scan(&locked)
		if errors.Is(err, sql.ErrNoRows) {
			return errAccountNotFound
		} else if err != nil {
			return err
		}
		ended, err = endSessions(ctx, tx, accountID)
		return err
	})
	return ended, err
}

// PruneLoginRecords deletes login records older than before, at most limit.
func (s *Store) PruneLoginRecords(ctx context.Context, before int64, limit int) (int64, error) {
	result, err := s.db.ExecContext(ctx, "DELETE FROM login_records WHERE at < ? LIMIT ?", before, limit)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// SessionAccount resolves an unexpired session digest to its account and expiry.
func (s *Store) SessionAccount(ctx context.Context, tokenHash string, now int64) (Account, int64, bool, error) {
	var (
		account   Account
		expiresAt int64
	)
	err := s.db.QueryRowContext(ctx, `SELECT a.id, a.username, a.nickname, a.admin, s.expires_at
		FROM sessions s JOIN accounts a ON a.id = s.account_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, tokenHash, now).
		Scan(&account.ID, &account.Username, &account.Nickname, &account.Admin, &expiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{}, 0, false, nil
	}
	return account, expiresAt, err == nil, err
}

// AccountByID loads one account.
func (s *Store) AccountByID(ctx context.Context, id string) (Account, bool, error) {
	var account Account
	err := s.db.QueryRowContext(ctx, "SELECT id, username, nickname, admin FROM accounts WHERE id = ?", id).
		Scan(&account.ID, &account.Username, &account.Nickname, &account.Admin)
	if errors.Is(err, sql.ErrNoRows) {
		return Account{}, false, nil
	}
	return account, err == nil, err
}

// Rename changes an account nickname unless another account uses it.
func (s *Store) Rename(ctx context.Context, accountID, nickname string) error {
	return inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		taken, err := exists(ctx, tx, "SELECT 1 FROM accounts WHERE nickname = ? AND id <> ?", nickname, accountID)
		if err != nil {
			return err
		}
		if taken {
			return errNicknameTaken
		}
		if _, err := tx.ExecContext(ctx, "UPDATE accounts SET nickname = ? WHERE id = ?", nickname, accountID); err != nil {
			return accountConflict(err)
		}
		return nil
	})
}

// DeleteSession removes a session digest (logout).
func (s *Store) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE token_hash = ?", tokenHash)
	return err
}

// DeleteExpiredSessions removes sessions that can no longer authenticate.
func (s *Store) DeleteExpiredSessions(ctx context.Context, now int64) (int64, error) {
	result, err := s.db.ExecContext(ctx, "DELETE FROM sessions WHERE expires_at <= ? LIMIT 10000", now)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// MissingUsernames returns the names (compared case-insensitively) that no
// account uses, sorted.
func (s *Store) MissingUsernames(ctx context.Context, names []string) ([]string, error) {
	if len(names) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(names))
	args := make([]any, len(names))
	for i, name := range names {
		placeholders[i], args[i] = "?", name
	}
	rows, err := s.db.QueryContext(ctx, "SELECT username FROM accounts WHERE username IN ("+
		strings.Join(placeholders, ", ")+")", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	present := map[string]bool{}
	for rows.Next() {
		var username string
		if err := rows.Scan(&username); err != nil {
			return nil, err
		}
		present[strings.ToLower(username)] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var missing []string
	for _, name := range names {
		if !present[strings.ToLower(name)] {
			missing = append(missing, name)
		}
	}
	slices.Sort(missing)
	return missing, nil
}

// InviteState reports whether an invitation digest exists and is unused.
func (s *Store) InviteState(ctx context.Context, codeHash string) (found, unused bool, err error) {
	var usedBy sql.NullString
	err = s.db.QueryRowContext(ctx, "SELECT used_by FROM invites WHERE code_hash = ?", codeHash).Scan(&usedBy)
	if errors.Is(err, sql.ErrNoRows) {
		return false, false, nil
	} else if err != nil {
		return false, false, err
	}
	return true, !usedBy.Valid, nil
}

// CreateInvite stores a new invitation digest.
func (s *Store) CreateInvite(ctx context.Context, codeHash string, now int64) error {
	_, err := s.db.ExecContext(ctx, "INSERT INTO invites(code_hash, created_at) VALUES(?, ?)", codeHash, now)
	return err
}

// NicknameTaken reports whether an account uses nickname (case-insensitive).
func (s *Store) NicknameTaken(ctx context.Context, nickname string) (bool, error) {
	return exists(ctx, s.db, "SELECT 1 FROM accounts WHERE nickname = ? LIMIT 1", nickname)
}

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func exists(ctx context.Context, q queryer, query string, args ...any) (bool, error) {
	var one int
	err := q.QueryRowContext(ctx, query, args...).Scan(&one)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}
