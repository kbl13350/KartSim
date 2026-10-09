package store

import (
	"context"
	"database/sql"
	"net/http"

	"kartsim/internal/shared/apierr"
)

// Notices of the 迷你提示窗 (MENUS.md 3): admin-written title and message,
// shown between start and end (open ends allowed).

var errNoticeNotFound = apierr.New(http.StatusNotFound, "NOTICE_NOT_FOUND")

// Notice is one admin notice.
type Notice struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Message   string `json:"message"`
	StartAt   int64  `json:"startAt,omitempty"`
	EndAt     int64  `json:"endAt,omitempty"`
	UpdatedBy string `json:"updatedBy,omitempty"`
	UpdatedAt int64  `json:"updatedAt,omitempty"`
}

// Notices lists notices, newest first; only those showing at now when
// current is set.
func (s *Store) Notices(ctx context.Context, current bool, now int64) ([]Notice, error) {
	query := "SELECT id, title, message, start_at, end_at, updated_by, updated_at FROM notices"
	args := []any{}
	if current {
		query += " WHERE (start_at IS NULL OR start_at <= ?) AND (end_at IS NULL OR end_at > ?)"
		args = append(args, now, now)
	}
	rows, err := s.db.QueryContext(ctx, query+" ORDER BY id DESC LIMIT 50", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	notices := []Notice{}
	for rows.Next() {
		var (
			notice     Notice
			start, end sql.NullInt64
		)
		if err := rows.Scan(&notice.ID, &notice.Title, &notice.Message, &start, &end, &notice.UpdatedBy,
			&notice.UpdatedAt); err != nil {
			return nil, err
		}
		notice.StartAt, notice.EndAt = start.Int64, end.Int64
		notices = append(notices, notice)
	}
	return notices, rows.Err()
}

func nullable(value int64) any {
	if value <= 0 {
		return nil
	}
	return value
}

// SaveNotice creates (ID 0) or replaces a notice.
func (s *Store) SaveNotice(ctx context.Context, notice Notice, now int64) (int64, error) {
	if notice.ID == 0 {
		result, err := s.db.ExecContext(ctx, `INSERT INTO notices(title, message, start_at, end_at, updated_by, updated_at)
			VALUES(?, ?, ?, ?, ?, ?)`, notice.Title, notice.Message, nullable(notice.StartAt), nullable(notice.EndAt),
			notice.UpdatedBy, now)
		if err != nil {
			return 0, err
		}
		return result.LastInsertId()
	}
	result, err := s.db.ExecContext(ctx, `UPDATE notices SET title = ?, message = ?, start_at = ?, end_at = ?,
		updated_by = ?, updated_at = ? WHERE id = ?`, notice.Title, notice.Message, nullable(notice.StartAt),
		nullable(notice.EndAt), notice.UpdatedBy, now, notice.ID)
	if err != nil {
		return 0, err
	}
	if changed, err := result.RowsAffected(); err != nil {
		return 0, err
	} else if changed == 0 {
		if found, err := exists(ctx, s.db, "SELECT 1 FROM notices WHERE id = ?", notice.ID); err != nil {
			return 0, err
		} else if !found {
			return 0, errNoticeNotFound
		}
	}
	return notice.ID, nil
}

// DeleteNotice removes a notice.
func (s *Store) DeleteNotice(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM notices WHERE id = ?", id)
	if err != nil {
		return err
	}
	if removed, err := result.RowsAffected(); err != nil {
		return err
	} else if removed == 0 {
		return errNoticeNotFound
	}
	return nil
}
