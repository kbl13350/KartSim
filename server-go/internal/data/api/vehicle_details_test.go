package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
)

func TestVehicleDetailsRequireAdmin(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	for _, method := range []string{http.MethodGet, http.MethodPut} {
		send(t, method, h.public.URL+"/api/admin/vehicles/catalog:3:387/details", nil, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
}

func TestVehicleDetailsSaveReadResetConflictAndValidation(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	datatest.LockEconomySettings(t, h.db)
	datatest.Exec(t, h.db, "DELETE FROM app_settings WHERE name LIKE 'veh:%'")
	t.Cleanup(func() { datatest.Exec(t, h.db, "DELETE FROM app_settings WHERE name LIKE 'veh:%'") })
	path := "/api/admin/vehicles/catalog:3:387/details"
	var initial adminVehicleDetailsJSON
	h.adminGet(path, &initial)
	if len(initial.PhysicsFields) != 90 || initial.Base.ID != "catalog:3:387" || initial.UpdatedAt != 0 || len(initial.Base.Profile("7")) != 90 {
		t.Fatalf("incomplete details: %+v", initial)
	}
	changes := economy.EmptyVehicleOverrides()
	changes.Metadata["title"] = "测试车辆详细数据"
	changes.Metadata["kartType"] = float64(1)
	changes.Profiles["7"] = map[string]float64{"forwardAccel": 2345.5, "partsEngineLock": 1, "boostAccelFactorOnlyItem": 1.99}
	request := func(at int64, overrides economy.VehicleOverrides) map[string]any {
		return map[string]any{"version": initial.Version, "updatedAt": at, "overrides": overrides}
	}
	var saved adminVehicleDetailsJSON
	h.put(path, request(0, changes), h.adminHeader).expect(t, http.StatusOK, "").json(t, &saved)
	if saved.UpdatedAt <= 0 || saved.UpdatedBy != h.adminName || saved.Vehicle.Title != "测试车辆详细数据" || saved.Vehicle.Category != "item" {
		t.Fatalf("save %+v", saved)
	}
	stored, err := store.New(h.db).VehicleDetailSettings(context.Background(), initial.Base.ID)
	if err != nil || stored.Overrides.Profiles["7"]["forwardAccel"] != 2345.5 {
		t.Fatalf("not persisted: %+v %v", stored, err)
	}
	var reloaded adminVehicleDetailsJSON
	h.adminGet(path, &reloaded)
	if reloaded.UpdatedAt != saved.UpdatedAt || reloaded.Overrides.Profiles["7"]["partsEngineLock"] != 1 {
		t.Fatal("reload lost changes")
	}
	var public publicVehicleSettingsJSON
	h.get("/api/vehicle-settings", nil).expect(t, http.StatusOK, "").json(t, &public)
	if public.VehicleOverrides[initial.Base.ID].Profiles["7"]["forwardAccel"] != 2345.5 || public.UpdatedAt != saved.UpdatedAt {
		t.Fatal("runtime settings not published")
	}
	beforeVersion := public.Version
	var directory adminVehiclesJSON
	h.adminGet("/api/admin/vehicles", &directory)
	found := false
	for _, row := range directory.Vehicles {
		if row.ID == initial.Base.ID {
			found = row.Title == saved.Vehicle.Title && row.Category == "item"
		}
	}
	if !found {
		t.Fatal("directory does not reflect metadata")
	}
	h.put(path, request(0, changes), h.adminHeader).expect(t, http.StatusConflict, "VEHICLE_DETAILS_CONFLICT")
	for _, raw := range []string{
		`{"metadata":{"itemId":4},"profiles":{}}`,
		`{"metadata":{"title":""},"profiles":{}}`,
		`{"metadata":{"enchant":1},"profiles":{}}`,
		`{"metadata":{},"profiles":{"7":{"mass":0}}}`,
		`{"metadata":{},"profiles":{"7":{"partsEngineLock":256}}}`,
		`{"metadata":{},"profiles":{"7":{"itemSlotCapacity":1.5}}}`,
		`{"metadata":{},"profiles":{"7":{"forwardAccel":null}}}`,
		`{"metadata":{},"profiles":{"7":{"unknown":123}}}`,
		`{"metadata":{},"profiles":{"8":{"mass":100}}}`,
		`{"metadata":{},"profiles":{"7":{"dualBoosterTickMin":200,"dualBoosterTickMax":10}}}`,
	} {
		body := fmt.Sprintf(`{"version":%q,"updatedAt":%d,"overrides":%s}`, initial.Version, saved.UpdatedAt, raw)
		h.put(path, body, h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_VEHICLE_DETAILS")
	}
	h.get("/api/admin/vehicles/catalog:3:99999/details", h.adminHeader).expect(t, http.StatusNotFound, "VEHICLE_NOT_FOUND")
	_, userToken := h.register("vd_"+h.u, "VD"+h.u)
	h.get(path, bearerHeader(userToken)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	h.put(path, request(saved.UpdatedAt, changes), bearerHeader(userToken)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	var reset adminVehicleDetailsJSON
	h.put(path, request(saved.UpdatedAt, economy.EmptyVehicleOverrides()), h.adminHeader).expect(t, http.StatusOK, "").json(t, &reset)
	if len(reset.Overrides.Profiles) != 0 || reset.Vehicle.Title != initial.Vehicle.Title || reset.UpdatedAt <= saved.UpdatedAt {
		t.Fatal("reset did not restore defaults")
	}
	// Decode into a new map: json.Unmarshal otherwise retains old map keys.
	public = publicVehicleSettingsJSON{}
	h.get("/api/vehicle-settings", nil).expect(t, http.StatusOK, "").json(t, &public)
	if len(public.VehicleOverrides) != 0 || beforeVersion == public.Version {
		t.Fatal("reset was not published")
	}
}
