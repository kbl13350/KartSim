package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

var errInvalidVehicleDetails = apierr.New(http.StatusBadRequest, "INVALID_VEHICLE_DETAILS")

type adminVehicleDetailsJSON struct {
	Vehicle        adminVehicleJSON             `json:"vehicle"`
	Base           economy.VehicleDetailBase    `json:"base"`
	MetadataFields []economy.VehicleDetailField `json:"metadataFields"`
	PhysicsFields  []economy.VehicleDetailField `json:"physicsFields"`
	Overrides      economy.VehicleOverrides     `json:"overrides"`
	Version        string                       `json:"version"`
	UpdatedAt      int64                        `json:"updatedAt"`
	UpdatedBy      string                       `json:"updatedBy"`
}

func applyVehicleMetadata(vehicle economy.DirectoryVehicle, changes economy.VehicleOverrides) economy.DirectoryVehicle {
	if title, ok := changes.Metadata["title"].(string); ok {
		vehicle.Title = title
	}
	if kind, ok := changes.Metadata["kartType"].(float64); ok && vehicle.ItemID != 0 {
		if kind == 1 {
			vehicle.Category, vehicle.CategoryTitle = "item", "道具车"
		} else {
			vehicle.Category, vehicle.CategoryTitle = "speed", "竞速车"
		}
	}
	if grade, ok := changes.Metadata["engineGrade"].(float64); ok {
		value := int(grade)
		vehicle.EngineGrade = &value
		names := []string{"旧版引擎", "PRO引擎以下", "SR引擎", "Z7引擎", "HT引擎", "HT+引擎", "JIU引擎", "X引擎", "V1引擎", "迅引擎"}
		vehicle.EngineTitle = "其他引擎"
		if value >= 0 && value < len(names) {
			vehicle.EngineTitle = names[value]
		}
	}
	return vehicle
}

func (a *API) vehicleDirectoryWithDetails(ctx context.Context) (*economy.VehicleDirectory, map[string]store.VehicleDetailSettings, error) {
	directory, err := economy.DefaultVehicleDirectory()
	if err != nil {
		return nil, nil, err
	}
	settings := map[string]store.VehicleDetailSettings{}
	if a.store != nil {
		settings, err = a.store.AllVehicleDetailSettings(ctx)
		if err != nil {
			return nil, nil, err
		}
	}
	copy := *directory
	copy.Vehicles = make([]economy.DirectoryVehicle, len(directory.Vehicles))
	for i, vehicle := range directory.Vehicles {
		copy.Vehicles[i] = applyVehicleMetadata(vehicle, settings[vehicle.ID].Overrides)
	}
	return &copy, settings, nil
}

func (a *API) vehicleViews(ctx context.Context, visibility store.BuiltinVehicleSettings) (publicVehicleSettingsJSON, adminVehiclesJSON, error) {
	directory, settings, err := a.vehicleDirectoryWithDetails(ctx)
	if err != nil {
		return publicVehicleSettingsJSON{}, adminVehiclesJSON{}, err
	}
	public, admin := vehicleSettingsViews(directory, visibility)
	public.VehicleOverrides = map[string]economy.VehicleOverrides{}
	for _, vehicle := range directory.Vehicles {
		setting := settings[vehicle.ID]
		if len(setting.Overrides.Metadata) > 0 || len(setting.Overrides.Profiles) > 0 {
			public.VehicleOverrides[vehicle.ID] = setting.Overrides
		}
		if setting.UpdatedAt > public.UpdatedAt {
			public.UpdatedAt = setting.UpdatedAt
		}
		if setting.UpdatedAt > admin.UpdatedAt {
			admin.UpdatedAt, admin.UpdatedBy = setting.UpdatedAt, setting.UpdatedBy
		}
	}
	encoded, _ := json.Marshal(public.VehicleOverrides)
	digest := sha256.Sum256(append([]byte(public.Version+"\n"), encoded...))
	public.Version = hex.EncodeToString(digest[:])
	admin.Version = public.Version
	return public, admin, nil
}

func (a *API) adminVehicleDetails(w http.ResponseWriter, r *http.Request) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	id := r.PathValue("id")
	details, err := economy.DefaultVehicleDetails()
	if err != nil {
		return err
	}
	base, exists := details.Find(id)
	if !exists {
		return errBuiltinVehicleNotFound
	}
	setting := store.VehicleDetailSettings{ID: id, Overrides: economy.EmptyVehicleOverrides()}
	if r.Method == http.MethodPut {
		var request struct {
			Version   string                    `json:"version"`
			UpdatedAt *int64                    `json:"updatedAt"`
			Overrides *economy.VehicleOverrides `json:"overrides"`
		}
		raw, err := readBody(w, r)
		if err != nil {
			return err
		}
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.DisallowUnknownFields()
		var generic any
		if !json.Valid(raw) || json.Unmarshal(raw, &generic) != nil || hasVehicleNull(generic) || decoder.Decode(&request) != nil || request.UpdatedAt == nil || *request.UpdatedAt < 0 ||
			request.Overrides == nil || request.Overrides.Metadata == nil || request.Overrides.Profiles == nil {
			return errInvalidVehicleDetails
		}
		if request.Version != details.Version {
			return store.ErrVehicleDetailsConflict
		}
		if err := details.Validate(id, *request.Overrides); err != nil {
			return errInvalidVehicleDetails
		}
		setting, err = a.store.SetVehicleDetails(r.Context(), id, *request.Overrides, *request.UpdatedAt, admin.Username, a.nowMillis())
		if err != nil {
			return err
		}
		a.log.Info("admin vehicle details", "admin", admin.Username, "vehicle", id, "updatedAt", setting.UpdatedAt)
	} else if a.store != nil {
		setting, err = a.store.VehicleDetailSettings(r.Context(), id)
		if err != nil {
			return err
		}
	}
	visibility, err := a.builtinVehicleSettings(r.Context())
	if err != nil {
		return err
	}
	directory, err := economy.DefaultVehicleDirectory()
	if err != nil {
		return err
	}
	vehicle, _ := directory.Find(id)
	_, view := vehicleSettingsViews(directory, visibility)
	enabled := true
	for _, row := range view.Vehicles {
		if row.ID == id {
			enabled = row.Enabled
			break
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, adminVehicleDetailsJSON{
		Vehicle: adminVehicleJSON{DirectoryVehicle: applyVehicleMetadata(vehicle, setting.Overrides), Enabled: enabled},
		Base:    base, MetadataFields: details.MetadataFields, PhysicsFields: details.PhysicsFields,
		Overrides: setting.Overrides, Version: details.Version, UpdatedAt: setting.UpdatedAt, UpdatedBy: setting.UpdatedBy,
	})
}

func hasVehicleNull(value any) bool {
	if value == nil {
		return true
	}
	if object, ok := value.(map[string]any); ok {
		for _, child := range object {
			if hasVehicleNull(child) {
				return true
			}
		}
	}
	if array, ok := value.([]any); ok {
		for _, child := range array {
			if hasVehicleNull(child) {
				return true
			}
		}
	}
	return false
}
