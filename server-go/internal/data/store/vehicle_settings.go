package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strconv"

	"kartsim/internal/data/economy"
	"kartsim/internal/shared/apierr"
)

const settingsBuiltinVehicles = "builtinVehicles"

// BuiltinVehicleSettings use the existing app_settings table. An absent row or
// absent ID means enabled, so future vehicles are available by default.
// Inventory, prizes and saved equipment are never removed by this setting.
type BuiltinVehicleSettings struct {
	DisabledVehicleIDs []string `json:"disabledVehicleIds"`
	UpdatedAt          int64    `json:"updatedAt"`
	UpdatedBy          string   `json:"updatedBy"`
}

var builtinVehicleID = regexp.MustCompile(`^(catalog:3:[1-9][0-9]{0,4}|system:[A-Za-z0-9_.-]{1,128})$`)

var ErrVehicleDisabled = apierr.New(http.StatusConflict, "VEHICLE_DISABLED")

// checkVehiclePurchase runs only for a new purchase, after its idempotency
// lookup. A replay of an already paid purchase must still return its receipt.
func checkVehiclePurchase(ctx context.Context, tx *sql.Tx, item *economy.Item) error {
	if item.Category != economy.CategoryKart {
		return nil
	}
	settings, err := readBuiltinVehicleSettings(ctx, tx, false)
	if err != nil {
		return err
	}
	if slices.Contains(settings.DisabledVehicleIDs, "catalog:3:"+strconv.Itoa(item.ItemID)) {
		return ErrVehicleDisabled
	}
	return nil
}

func readBuiltinVehicleSettings(ctx context.Context, q settingsQuerier, locked bool) (BuiltinVehicleSettings, error) {
	settings := BuiltinVehicleSettings{DisabledVehicleIDs: []string{}}
	query := "SELECT json, updated_at, updated_by FROM app_settings WHERE name = ?"
	if locked {
		query += " FOR UPDATE"
	}
	var raw string
	err := q.QueryRowContext(ctx, query, settingsBuiltinVehicles).Scan(&raw, &settings.UpdatedAt, &settings.UpdatedBy)
	if errors.Is(err, sql.ErrNoRows) {
		return settings, nil
	}
	if err != nil {
		return settings, err
	}
	var stored struct {
		DisabledVehicleIDs []string `json:"disabledVehicleIds"`
	}
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return settings, fmt.Errorf("built-in vehicle settings: %w", err)
	}
	for _, id := range stored.DisabledVehicleIDs {
		if !builtinVehicleID.MatchString(id) {
			return settings, fmt.Errorf("built-in vehicle settings: invalid ID %q", id)
		}
	}
	settings.DisabledVehicleIDs = append(settings.DisabledVehicleIDs, stored.DisabledVehicleIDs...)
	slices.Sort(settings.DisabledVehicleIDs)
	settings.DisabledVehicleIDs = slices.Compact(settings.DisabledVehicleIDs)
	return settings, nil
}

func (s *Store) BuiltinVehicleSettings(ctx context.Context) (BuiltinVehicleSettings, error) {
	return readBuiltinVehicleSettings(ctx, s.db, false)
}

// SetBuiltinVehiclesEnabled atomically changes one vehicle or an entire
// category. IDs come from the resource-backed vehicle directory.
// A locked read/modify/write prevents concurrent edits to different vehicles from
// overwriting one another. No unrelated app setting is touched.
func (s *Store) SetBuiltinVehiclesEnabled(ctx context.Context, ids []string, enabled bool, admin string, now int64) (BuiltinVehicleSettings, error) {
	if len(ids) == 0 || len(ids) > 8192 {
		return BuiltinVehicleSettings{}, errors.New("invalid built-in vehicle selection")
	}
	for _, id := range ids {
		if !builtinVehicleID.MatchString(id) {
			return BuiltinVehicleSettings{}, errors.New("invalid built-in vehicle ID")
		}
	}
	var result BuiltinVehicleSettings
	err := inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		// Also serializes first-time writes when the row did not exist yet.
		if _, err := tx.ExecContext(ctx, `INSERT INTO app_settings(name, json, updated_at, updated_by)
			VALUES(?, '{"disabledVehicleIds":[]}', 0, '') ON DUPLICATE KEY UPDATE name = name`, settingsBuiltinVehicles); err != nil {
			return err
		}
		current, err := readBuiltinVehicleSettings(ctx, tx, true)
		if err != nil {
			return err
		}
		disabled := make(map[string]bool, len(current.DisabledVehicleIDs)+len(ids))
		for _, id := range current.DisabledVehicleIDs {
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
		result.DisabledVehicleIDs = make([]string, 0, len(disabled))
		for id := range disabled {
			result.DisabledVehicleIDs = append(result.DisabledVehicleIDs, id)
		}
		slices.Sort(result.DisabledVehicleIDs)
		if slices.Equal(current.DisabledVehicleIDs, result.DisabledVehicleIDs) {
			return nil
		}
		result.UpdatedAt, result.UpdatedBy = max(now, current.UpdatedAt+1), admin
		encoded, err := json.Marshal(struct {
			DisabledVehicleIDs []string `json:"disabledVehicleIds"`
		}{result.DisabledVehicleIDs})
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE app_settings SET json = ?, updated_at = ?, updated_by = ? WHERE name = ?",
			string(encoded), result.UpdatedAt, admin, settingsBuiltinVehicles)
		return err
	})
	return result, err
}
