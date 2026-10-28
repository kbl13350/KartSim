package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

var (
	errBuiltinVehicleNotFound  = apierr.New(http.StatusNotFound, "VEHICLE_NOT_FOUND")
	errVehicleCategoryNotFound = apierr.New(http.StatusNotFound, "VEHICLE_CATEGORY_NOT_FOUND")
	errInvalidVehicleSetting   = apierr.New(http.StatusBadRequest, "INVALID_VEHICLE_SETTINGS")
)

type publicVehicleSettingsJSON struct {
	DisabledVehicleIDs []string `json:"disabledVehicleIds"`
	Version            string   `json:"version"`
	UpdatedAt          int64    `json:"updatedAt"`
}

type adminVehicleJSON struct {
	economy.DirectoryVehicle
	Enabled bool `json:"enabled"`
}

type vehicleCategoryJSON struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Total        int    `json:"total"`
	EnabledCount int    `json:"enabledCount"`
}

type adminVehiclesJSON struct {
	Vehicles   []adminVehicleJSON    `json:"vehicles"`
	Categories []vehicleCategoryJSON `json:"categories"`
	Version    string                `json:"version"`
	UpdatedAt  int64                 `json:"updatedAt"`
	UpdatedBy  string                `json:"updatedBy"`
}

func (a *API) builtinVehicleSettings(ctx context.Context) (store.BuiltinVehicleSettings, error) {
	if a.store == nil {
		return store.BuiltinVehicleSettings{DisabledVehicleIDs: []string{}}, nil
	}
	return a.store.BuiltinVehicleSettings(ctx)
}

func vehicleSettingsViews(directory *economy.VehicleDirectory, settings store.BuiltinVehicleSettings) (publicVehicleSettingsJSON, adminVehiclesJSON) {
	disabled := make(map[string]bool, len(settings.DisabledVehicleIDs))
	for _, id := range settings.DisabledVehicleIDs {
		disabled[id] = true
	}
	public := publicVehicleSettingsJSON{DisabledVehicleIDs: []string{}, UpdatedAt: settings.UpdatedAt}
	admin := adminVehiclesJSON{Vehicles: make([]adminVehicleJSON, 0, len(directory.Vehicles)), Categories: []vehicleCategoryJSON{},
		UpdatedAt: settings.UpdatedAt, UpdatedBy: settings.UpdatedBy}
	categories := make(map[string]int)
	for _, vehicle := range directory.Vehicles {
		enabled := !disabled[vehicle.ID]
		admin.Vehicles = append(admin.Vehicles, adminVehicleJSON{DirectoryVehicle: vehicle, Enabled: enabled})
		if !enabled {
			public.DisabledVehicleIDs = append(public.DisabledVehicleIDs, vehicle.ID)
		}
		i, ok := categories[vehicle.Category]
		if !ok {
			i = len(admin.Categories)
			categories[vehicle.Category] = i
			admin.Categories = append(admin.Categories, vehicleCategoryJSON{ID: vehicle.Category, Title: vehicle.CategoryTitle})
		}
		admin.Categories[i].Total++
		if enabled {
			admin.Categories[i].EnabledCount++
		}
	}
	slices.Sort(public.DisabledVehicleIDs)
	slices.SortFunc(admin.Categories, func(a, b vehicleCategoryJSON) int {
		if a.ID < b.ID {
			return -1
		}
		if a.ID > b.ID {
			return 1
		}
		return 0
	})
	encoded, _ := json.Marshal(public.DisabledVehicleIDs)
	digest := sha256.Sum256(append([]byte(directory.Version+"\n"), encoded...))
	public.Version = hex.EncodeToString(digest[:])
	admin.Version = public.Version
	return public, admin
}

// Visibility settings leave owned inventory, saved equipment, rewards, replay
// access and in-progress races intact.
func (a *API) vehicleSettings(w http.ResponseWriter, r *http.Request) error {
	directory, err := economy.DefaultVehicleDirectory()
	if err != nil {
		return err
	}
	settings, err := a.builtinVehicleSettings(r.Context())
	if err != nil {
		return err
	}
	public, _ := vehicleSettingsViews(directory, settings)
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, public)
}

func (a *API) adminVehicles(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	directory, err := economy.DefaultVehicleDirectory()
	if err != nil {
		return err
	}
	settings, err := a.builtinVehicleSettings(r.Context())
	if err != nil {
		return err
	}
	_, admin := vehicleSettingsViews(directory, settings)
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, admin)
}

func (a *API) adminSetVehicle(w http.ResponseWriter, r *http.Request) error {
	return a.adminSetBuiltinVehicles(w, r, false)
}

func (a *API) adminSetVehicleCategory(w http.ResponseWriter, r *http.Request) error {
	return a.adminSetBuiltinVehicles(w, r, true)
}

func (a *API) adminSetBuiltinVehicles(w http.ResponseWriter, r *http.Request, byCategory bool) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	var request struct {
		Enabled *bool `json:"enabled"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if request.Enabled == nil {
		return errInvalidVehicleSetting
	}
	directory, err := economy.DefaultVehicleDirectory()
	if err != nil {
		return err
	}
	ids := []string{}
	target := r.PathValue("id")
	if byCategory {
		target = r.PathValue("category")
		for _, vehicle := range directory.Vehicles {
			if vehicle.Category == target {
				ids = append(ids, vehicle.ID)
			}
		}
		if len(ids) == 0 {
			return errVehicleCategoryNotFound
		}
	} else {
		vehicle, ok := directory.Find(target)
		if !ok {
			return errBuiltinVehicleNotFound
		}
		ids = append(ids, vehicle.ID)
	}
	settings, err := a.store.SetBuiltinVehiclesEnabled(r.Context(), ids, *request.Enabled, admin.Username, a.nowMillis())
	if err != nil {
		return err
	}
	a.log.Info("admin built-in vehicle visibility", "admin", admin.Username, "target", target,
		"byCategory", byCategory, "enabled", *request.Enabled, "vehicles", len(ids))
	_, response := vehicleSettingsViews(directory, settings)
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, response)
}

func equippedVehicleID(items []equippedItem) string {
	for _, item := range items {
		if item.Slot != economy.CategoryKart {
			continue
		}
		if item.ItemID > 0 {
			return "catalog:3:" + strconv.Itoa(item.ItemID)
		}
		return "system:" + item.SystemKey
	}
	return ""
}

// checkVehicleSwitch refuses a newly selected disabled vehicle. Keeping the
// already saved kart remains valid, including changes to its tuning or other
// equipment. Ownership verification and existing race equipment are unchanged.
func (a *API) checkVehicleSwitch(ctx context.Context, accountID string, items []equippedItem) error {
	id := equippedVehicleID(items)
	if id == "" {
		return nil
	}
	settings, err := a.builtinVehicleSettings(ctx)
	if err != nil {
		return err
	}
	if !slices.Contains(settings.DisabledVehicleIDs, id) {
		return nil
	}
	profile, found, err := a.store.AccountProfile(ctx, accountID)
	if err != nil {
		return err
	}
	if found {
		var fields map[string]json.RawMessage
		if json.Unmarshal([]byte(profile), &fields) == nil {
			if previous, err := parseEquipment(fields["equipment"]); err == nil {
				if previousItems, err := previous.items(); err == nil && equippedVehicleID(previousItems) == id {
					return nil
				}
			}
		}
	}
	return store.ErrVehicleDisabled
}
