package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
)

const settingsBuiltinTracks = "builtinTracks"

// BuiltinTrackSettings use the existing app_settings table. An absent row or
// absent ID means enabled, so future maps are available by default. Historical
// aliases are saved together with their canonical ID to survive catalog changes.
type BuiltinTrackSettings struct {
	DisabledTrackIDs []string `json:"disabledTrackIds"`
	UpdatedAt        int64    `json:"updatedAt"`
	UpdatedBy        string   `json:"updatedBy"`
}

var builtinTrackID = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,64}$`)

func readBuiltinTrackSettings(ctx context.Context, q settingsQuerier, locked bool) (BuiltinTrackSettings, error) {
	settings := BuiltinTrackSettings{DisabledTrackIDs: []string{}}
	query := "SELECT json, updated_at, updated_by FROM app_settings WHERE name = ?"
	if locked {
		query += " FOR UPDATE"
	}
	var raw string
	err := q.QueryRowContext(ctx, query, settingsBuiltinTracks).Scan(&raw, &settings.UpdatedAt, &settings.UpdatedBy)
	if errors.Is(err, sql.ErrNoRows) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	var stored struct {
		DisabledTrackIDs []string `json:"disabledTrackIds"`
	}
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return settings, fmt.Errorf("built-in track settings: %w", err)
	}
	for _, id := range stored.DisabledTrackIDs {
		if !builtinTrackID.MatchString(id) {
			return settings, fmt.Errorf("built-in track settings: invalid ID %q", id)
		}
	}
	settings.DisabledTrackIDs = append(settings.DisabledTrackIDs, stored.DisabledTrackIDs...)
	slices.Sort(settings.DisabledTrackIDs)
	settings.DisabledTrackIDs = slices.Compact(settings.DisabledTrackIDs)
	return settings, nil
}

func (s *Store) BuiltinTrackSettings(ctx context.Context) (BuiltinTrackSettings, error) {
	return readBuiltinTrackSettings(ctx, s.db, false)
}

// SetBuiltinTracksEnabled atomically changes a canonical group or an entire
// theme. The caller supplies every canonical ID and alias in the selected group.
// A locked read/modify/write prevents concurrent edits to different maps from
// overwriting one another. No unrelated app setting is touched.
func (s *Store) SetBuiltinTracksEnabled(ctx context.Context, ids []string, enabled bool, admin string, now int64) (BuiltinTrackSettings, error) {
	if len(ids) == 0 || len(ids) > 4096 {
		return BuiltinTrackSettings{}, errors.New("invalid built-in track selection")
	}
	for _, id := range ids {
		if !builtinTrackID.MatchString(id) {
			return BuiltinTrackSettings{}, errors.New("invalid built-in track ID")
		}
	}
	var result BuiltinTrackSettings
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		// Also serializes first-time writes when the row did not exist yet.
		if _, err := tx.ExecContext(ctx, `INSERT INTO app_settings(name, json, updated_at, updated_by)
			VALUES(?, '{"disabledTrackIds":[]}', 0, '') ON DUPLICATE KEY UPDATE name = name`, settingsBuiltinTracks); err != nil {
			return err
		}
		current, err := readBuiltinTrackSettings(ctx, tx, true)
		if err != nil {
			return err
		}
		disabled := make(map[string]bool, len(current.DisabledTrackIDs)+len(ids))
		for _, id := range current.DisabledTrackIDs {
			disabled[id] = true
		}
		for _, id := range ids {
			if enabled {
				delete(disabled, id)
			} else {
				disabled[id] = true
			}
		}
		result = current
		result.DisabledTrackIDs = make([]string, 0, len(disabled))
		for id := range disabled {
			result.DisabledTrackIDs = append(result.DisabledTrackIDs, id)
		}
		slices.Sort(result.DisabledTrackIDs)
		if slices.Equal(current.DisabledTrackIDs, result.DisabledTrackIDs) {
			return nil
		}
		result.UpdatedAt, result.UpdatedBy = max(now, current.UpdatedAt+1), admin
		encoded, err := json.Marshal(struct {
			DisabledTrackIDs []string `json:"disabledTrackIds"`
		}{result.DisabledTrackIDs})
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE app_settings SET json = ?, updated_at = ?, updated_by = ? WHERE name = ?",
			string(encoded), result.UpdatedAt, admin, settingsBuiltinTracks)
		return err
	})
	return result, err
}
