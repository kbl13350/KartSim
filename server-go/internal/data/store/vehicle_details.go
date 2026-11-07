package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"

	"kartsim/internal/data/economy"
	"kartsim/internal/shared/apierr"
)

var ErrVehicleDetailsConflict = apierr.New(http.StatusConflict, "VEHICLE_DETAILS_CONFLICT")

type VehicleDetailSettings struct {
	ID        string                   `json:"id"`
	Overrides economy.VehicleOverrides `json:"overrides"`
	UpdatedAt int64                    `json:"updatedAt"`
	UpdatedBy string                   `json:"updatedBy"`
}

func vehicleDetailSettingKey(id string) string {
	digest := sha256.Sum256([]byte(id))
	return "veh:" + hex.EncodeToString(digest[:14]) // app_settings.name is VARCHAR(32)
}

func readVehicleDetailSettings(ctx context.Context, q settingsQuerier, id string, locked bool) (VehicleDetailSettings, error) {
	result := VehicleDetailSettings{ID: id, Overrides: economy.EmptyVehicleOverrides()}
	query := "SELECT json, updated_at, updated_by FROM app_settings WHERE name = ?"
	if locked {
		query += " FOR UPDATE"
	}
	var raw string
	err := q.QueryRowContext(ctx, query, vehicleDetailSettingKey(id)).Scan(&raw, &result.UpdatedAt, &result.UpdatedBy)
	if errors.Is(err, sql.ErrNoRows) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	var stored VehicleDetailSettings
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return result, err
	}
	if stored.ID != id {
		return result, errors.New("vehicle detail identity mismatch")
	}
	result.Overrides = stored.Overrides
	return result, nil
}

func (s *Store) VehicleDetailSettings(ctx context.Context, id string) (VehicleDetailSettings, error) {
	return readVehicleDetailSettings(ctx, s.db, id, false)
}

func (s *Store) AllVehicleDetailSettings(ctx context.Context) (map[string]VehicleDetailSettings, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT json, updated_at, updated_by FROM app_settings WHERE name LIKE 'veh:%'")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]VehicleDetailSettings{}
	for rows.Next() {
		var raw string
		var at int64
		var by string
		if err := rows.Scan(&raw, &at, &by); err != nil {
			return nil, err
		}
		var value VehicleDetailSettings
		if err := json.Unmarshal([]byte(raw), &value); err != nil {
			return nil, err
		}
		value.UpdatedAt, value.UpdatedBy = at, by
		result[value.ID] = value
	}
	return result, rows.Err()
}

func (s *Store) SetVehicleDetails(ctx context.Context, id string, changes economy.VehicleOverrides, expectedAt int64, admin string, now int64) (VehicleDetailSettings, error) {
	data, err := economy.DefaultVehicleDetails()
	if err != nil {
		return VehicleDetailSettings{}, err
	}
	if err := data.Validate(id, changes); err != nil {
		return VehicleDetailSettings{}, err
	}
	if changes.Metadata == nil {
		changes.Metadata = map[string]any{}
	}
	if changes.Profiles == nil {
		changes.Profiles = map[string]map[string]float64{}
	}
	var result VehicleDetailSettings
	err = inEconomyTx(ctx, s.db, nil, func(tx *sql.Tx) error {
		empty, _ := json.Marshal(VehicleDetailSettings{ID: id, Overrides: economy.EmptyVehicleOverrides()})
		if _, err := tx.ExecContext(ctx, `INSERT INTO app_settings(name, json, updated_at, updated_by)
			VALUES(?, ?, 0, '') ON DUPLICATE KEY UPDATE name = name`, vehicleDetailSettingKey(id), string(empty)); err != nil {
			return err
		}
		current, err := readVehicleDetailSettings(ctx, tx, id, true)
		if err != nil {
			return err
		}
		if current.UpdatedAt != expectedAt {
			return ErrVehicleDetailsConflict
		}
		result = VehicleDetailSettings{ID: id, Overrides: changes, UpdatedAt: max(now, current.UpdatedAt+1), UpdatedBy: admin}
		raw, err := json.Marshal(result)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "UPDATE app_settings SET json = ?, updated_at = ?, updated_by = ? WHERE name = ?",
			string(raw), result.UpdatedAt, admin, vehicleDetailSettingKey(id))
		return err
	})
	return result, err
}
