package store

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"errors"
	"net/http"

	"kartsim/internal/shared/apierr"
)

var (
	errProfileKeyInvalid = apierr.New(http.StatusForbidden, "PROFILE_KEY_INVALID")
	errStorageQuota      = apierr.New(http.StatusRequestEntityTooLarge, "STORAGE_QUOTA_EXCEEDED")
	// errOwnerRace means another request created the same owner concurrently;
	// the save is retried once in a fresh transaction, which then sees it.
	errOwnerRace = errors.New("owner key created concurrently")
)

// RecordQuota bounds what one owner may keep in records. Anyone can create
// an owner with a fresh profile key, so the Java service's unlimited records
// let a single anonymous owner fill the disk.
type RecordQuota struct {
	Records int   // number of records
	Bytes   int64 // total size of their JSON documents in bytes
}

// DefaultRecordQuota is far above what the game stores (one ghost summary
// per owner).
var DefaultRecordQuota = RecordQuota{Records: 500, Bytes: 64 << 20}

// RecordInfo is a listed record without its document.
type RecordInfo struct {
	RecordID  string
	UpdatedAt int64
}

// RecordRow is one stored ghost record.
type RecordRow struct {
	RecordID  string
	JSON      string
	UpdatedAt int64
}

// OwnerKey returns the stored X-Profile-Key digest of ownerID.
func (s *Store) OwnerKey(ctx context.Context, ownerID string) (string, bool, error) {
	var digest string
	err := s.db.QueryRowContext(ctx, "SELECT secret_hash FROM owner_keys WHERE owner_id = ?", ownerID).Scan(&digest)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return digest, err == nil, err
}

// DocumentWrite is one profile or record save.
type DocumentWrite struct {
	OwnerID   string
	RecordID  string // empty for the profile
	KeyDigest string
	// KeyVerified skips the owner check when the caller already matched the
	// digest against a cached owner key (owner keys never change).
	KeyVerified bool
	JSON        string
	Now         int64
	// Written runs after the row write, before commit, while the row lock is
	// held; concurrent saves of one document therefore call it in commit order.
	Written func()
}

// SaveDocument upserts a profile or record. Like Java's requireOwner with
// allowCreate, the first save binds the owner to the key digest; later saves
// need the same key (403 PROFILE_KEY_INVALID otherwise). A record save that
// would exceed the owner's quota fails with 413 STORAGE_QUOTA_EXCEEDED.
func (s *Store) SaveDocument(ctx context.Context, write DocumentWrite) error {
	for attempt := 0; ; attempt++ {
		err := inTx(ctx, s.db, nil, func(tx *sql.Tx) error {
			if !write.KeyVerified {
				if err := ensureOwner(ctx, tx, write.OwnerID, write.KeyDigest, write.Now); err != nil {
					return err
				}
			}
			if write.RecordID != "" {
				if err := s.checkRecordQuota(ctx, tx, write); err != nil {
					return err
				}
			}
			var err error
			if write.RecordID == "" {
				_, err = tx.ExecContext(ctx, `INSERT INTO profiles(owner_id, json, updated_at) VALUES(?, ?, ?) AS incoming
					ON DUPLICATE KEY UPDATE json = incoming.json, updated_at = incoming.updated_at`,
					write.OwnerID, write.JSON, write.Now)
			} else {
				_, err = tx.ExecContext(ctx, `INSERT INTO records(owner_id, record_id, json, updated_at) VALUES(?, ?, ?, ?) AS incoming
					ON DUPLICATE KEY UPDATE json = incoming.json, updated_at = incoming.updated_at`,
					write.OwnerID, write.RecordID, write.JSON, write.Now)
			}
			if err != nil {
				return err
			}
			if write.Written != nil {
				write.Written()
			}
			return nil
		})
		if errors.Is(err, errOwnerRace) && attempt == 0 {
			continue
		}
		return err
	}
}

// checkRecordQuota rejects a record save that would take its owner past the
// quota; a replaced record counts with its new size only. Locking the owner
// row serializes the record saves of one owner, and the locking read counts
// every committed record rather than the transaction's snapshot.
func (s *Store) checkRecordQuota(ctx context.Context, tx *sql.Tx, write DocumentWrite) error {
	var locked int
	err := tx.QueryRowContext(ctx, "SELECT 1 FROM owner_keys WHERE owner_id = ? FOR UPDATE", write.OwnerID).Scan(&locked)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	var (
		count int
		bytes int64
	)
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*), COALESCE(SUM(LENGTH(json)), 0) FROM records
		WHERE owner_id = ? AND record_id <> ? FOR SHARE`, write.OwnerID, write.RecordID).Scan(&count, &bytes); err != nil {
		return err
	}
	if count+1 > s.recordQuota.Records || bytes+int64(len(write.JSON)) > s.recordQuota.Bytes {
		return errStorageQuota
	}
	return nil
}

func ensureOwner(ctx context.Context, tx *sql.Tx, ownerID, digest string, now int64) error {
	var stored string
	err := tx.QueryRowContext(ctx, "SELECT secret_hash FROM owner_keys WHERE owner_id = ?", ownerID).Scan(&stored)
	switch {
	case err == nil:
		if subtle.ConstantTimeCompare([]byte(stored), []byte(digest)) != 1 {
			return errProfileKeyInvalid
		}
		return nil
	case !errors.Is(err, sql.ErrNoRows):
		return err
	}
	if _, err := tx.ExecContext(ctx,
		"INSERT INTO owner_keys(owner_id, secret_hash, created_at) VALUES(?, ?, ?)", ownerID, digest, now); err != nil {
		if _, duplicate := duplicateKey(err); duplicate {
			return errOwnerRace
		}
		return err
	}
	return nil
}

// Profile returns the stored profile JSON of ownerID.
func (s *Store) Profile(ctx context.Context, ownerID string) (string, bool, error) {
	return s.document(ctx, "SELECT json FROM profiles WHERE owner_id = ?", ownerID)
}

// Record returns one stored record JSON.
func (s *Store) Record(ctx context.Context, ownerID, recordID string) (string, bool, error) {
	return s.document(ctx, "SELECT json FROM records WHERE owner_id = ? AND record_id = ?", ownerID, recordID)
}

func (s *Store) document(ctx context.Context, query string, args ...any) (string, bool, error) {
	var value string
	err := s.db.QueryRowContext(ctx, query, args...).Scan(&value)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return value, err == nil, err
}

// RecordIndex lists the records of ownerID, newest first, without their
// documents (the owner/updated_at index covers it). Callers load the
// documents one at a time with RecordRow, so listing an owner never holds
// all of its records in memory.
func (s *Store) RecordIndex(ctx context.Context, ownerID string) ([]RecordInfo, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT record_id, updated_at FROM records WHERE owner_id = ? ORDER BY updated_at DESC", ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := []RecordInfo{}
	for rows.Next() {
		var info RecordInfo
		if err := rows.Scan(&info.RecordID, &info.UpdatedAt); err != nil {
			return nil, err
		}
		records = append(records, info)
	}
	return records, rows.Err()
}

// RecordRow returns one stored record with its update time.
func (s *Store) RecordRow(ctx context.Context, ownerID, recordID string) (RecordRow, bool, error) {
	row := RecordRow{RecordID: recordID}
	err := s.db.QueryRowContext(ctx, "SELECT json, updated_at FROM records WHERE owner_id = ? AND record_id = ?",
		ownerID, recordID).Scan(&row.JSON, &row.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return RecordRow{}, false, nil
	}
	return row, err == nil, err
}
