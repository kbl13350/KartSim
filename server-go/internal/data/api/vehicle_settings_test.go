package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
)

func TestBuiltinVehicleSettingsPublicDefaultsAndAdminAuthentication(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	var body publicVehicleSettingsJSON
	response := h.get("/api/vehicle-settings", nil).expect(t, http.StatusOK, "")
	response.json(t, &body)
	if body.DisabledVehicleIDs == nil || len(body.DisabledVehicleIDs) != 0 || len(body.Version) != 64 || body.UpdatedAt != 0 || response.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("defaults %+v", body)
	}
	h.get("/api/admin/vehicles", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	for _, path := range []string{"/api/admin/vehicles/catalog:3:387", "/api/admin/vehicle-categories/speed"} {
		send(t, http.MethodPatch, h.public.URL+path, `{"enabled":false}`, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
}

func TestBuiltinVehicleSettingsViewsAndVersions(t *testing.T) {
	d, err := economy.DefaultVehicleDirectory()
	if err != nil {
		t.Fatal(err)
	}
	before, _ := vehicleSettingsViews(d, store.BuiltinVehicleSettings{})
	public, admin := vehicleSettingsViews(d, store.BuiltinVehicleSettings{DisabledVehicleIDs: []string{d.Vehicles[0].ID, "system:retired"}, UpdatedAt: 5})
	if public.Version == before.Version || !slices.Equal(public.DisabledVehicleIDs, []string{d.Vehicles[0].ID}) || public.UpdatedAt != 5 {
		t.Fatalf("changed view %+v", public)
	}
	if len(admin.Vehicles) != 1651 || len(admin.Categories) != 3 || admin.Vehicles[0].Enabled {
		t.Fatal("invalid vehicle directory view")
	}
	all := make([]string, 0, len(d.Vehicles))
	for _, row := range d.Vehicles {
		all = append(all, row.ID)
	}
	closed, closedAdmin := vehicleSettingsViews(d, store.BuiltinVehicleSettings{DisabledVehicleIDs: all})
	if len(closed.DisabledVehicleIDs) != 1651 {
		t.Fatalf("all closed: %d IDs", len(closed.DisabledVehicleIDs))
	}
	for _, category := range closedAdmin.Categories {
		if category.EnabledCount != 0 {
			t.Fatal("closed category has enabled vehicles")
		}
	}
}

func resetVehicleSettingsFixture(t *testing.T, h *harness) {
	t.Helper()
	datatest.LockEconomySettings(t, h.db)
	datatest.Exec(t, h.db, "DELETE FROM app_settings WHERE name = 'builtinVehicles'")
	t.Cleanup(func() { datatest.Exec(t, h.db, "DELETE FROM app_settings WHERE name = 'builtinVehicles'") })
}

func TestBuiltinVehicleSettingsAdminPersistenceCategoriesAndPermissions(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	resetVehicleSettingsFixture(t, h.harness)
	var initial adminVehiclesJSON
	h.adminGet("/api/admin/vehicles", &initial)
	if len(initial.Vehicles) != 1651 {
		t.Fatalf("%d choices", len(initial.Vehicles))
	}
	chosen := initial.Vehicles[0]
	patch := func(path string, enabled bool) adminVehiclesJSON {
		t.Helper()
		var body adminVehiclesJSON
		send(t, http.MethodPatch, h.public.URL+path, map[string]bool{"enabled": enabled}, h.adminHeader).expect(t, http.StatusOK, "").json(t, &body)
		return body
	}
	changed := patch("/api/admin/vehicles/"+chosen.ID, false)
	if changed.Version == initial.Version || changed.UpdatedAt == 0 || changed.UpdatedBy != h.adminName {
		t.Fatalf("saved %+v", changed)
	}
	var public publicVehicleSettingsJSON
	h.get("/api/vehicle-settings", nil).expect(t, http.StatusOK, "").json(t, &public)
	if !slices.Contains(public.DisabledVehicleIDs, chosen.ID) {
		t.Fatal("disabled vehicle remains enabled")
	}
	stored, err := store.New(h.db).BuiltinVehicleSettings(context.Background())
	if err != nil || !slices.Equal(stored.DisabledVehicleIDs, public.DisabledVehicleIDs) {
		t.Fatalf("persistence %+v %v", stored, err)
	}
	patch("/api/admin/vehicles/"+chosen.ID, true)
	for _, category := range initial.Categories {
		closed := patch("/api/admin/vehicle-categories/"+category.ID, false)
		for _, row := range closed.Vehicles {
			if row.Category == category.ID && row.Enabled {
				t.Fatalf("category %s remains enabled", category.ID)
			}
		}
	}
	h.get("/api/vehicle-settings", nil).expect(t, http.StatusOK, "").json(t, &public)
	if len(public.DisabledVehicleIDs) != 1651 {
		t.Fatalf("all categories closed %d", len(public.DisabledVehicleIDs))
	}
	for _, category := range initial.Categories {
		patch("/api/admin/vehicle-categories/"+category.ID, true)
	}
	h.get("/api/vehicle-settings", nil).expect(t, http.StatusOK, "").json(t, &public)
	if len(public.DisabledVehicleIDs) != 0 || public.DisabledVehicleIDs == nil || public.Version != initial.Version {
		t.Fatal("reenabling did not restore initial public policy")
	}
	for _, body := range []string{`{}`, `{"enabled":null}`} {
		send(t, http.MethodPatch, h.public.URL+"/api/admin/vehicles/"+chosen.ID, body, h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_VEHICLE_SETTINGS")
	}
	send(t, http.MethodPatch, h.public.URL+"/api/admin/vehicles/unknown", `{"enabled":false}`, h.adminHeader).expect(t, http.StatusNotFound, "VEHICLE_NOT_FOUND")
	send(t, http.MethodPatch, h.public.URL+"/api/admin/vehicle-categories/unknown", `{"enabled":false}`, h.adminHeader).expect(t, http.StatusNotFound, "VEHICLE_CATEGORY_NOT_FOUND")
	h.account("viewer_"+h.u, "Viewer"+h.u, password, false)
	var user struct{ Token string }
	h.post("/multiplayer/auth/login", map[string]any{"username": "viewer_" + h.u, "password": password}, nil).expect(t, http.StatusOK, "").json(t, &user)
	h.get("/api/admin/vehicles", bearerHeader(user.Token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	send(t, http.MethodPatch, h.public.URL+"/api/admin/vehicles/"+chosen.ID, `{"enabled":false}`, bearerHeader(user.Token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	send(t, http.MethodPatch, h.public.URL+"/api/admin/vehicle-categories/speed", `{"enabled":false}`, bearerHeader(user.Token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
}

func TestDisabledVehicleBlocksNewPurchaseAndSwitchButKeepsReceiptsAndEquipment(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	resetVehicleSettingsFixture(t, h.harness)
	id, token := h.register("car_"+h.u, "Car"+h.u)
	auth := bearerHeader(token)
	h.claimStarter(token, 2, 6, 4)
	h.setWallet(id, store.Wallet{Coupon: 10_000, Lucci: 10_000})
	kart, rental := findOffer(t, func(item *economy.Item, offer economy.Offer) bool {
		return item.Category == economy.CategoryKart && offer.Currency == economy.Coupon && offer.Days > 0 && offer.MinExp == 0
	})
	requestID := uuid()
	buy := func(request string) response {
		return h.post("/api/shop/purchase", map[string]string{"offerId": rental.OfferID, "requestId": request}, auth)
	}
	paid := buy(requestID).expect(t, http.StatusOK, "").body
	equipment := func(itemID int) json.RawMessage {
		doc := map[string]any{"itemIds": map[string]int{"1": 2, "2": 6, "3": itemID, "70": 4}, "systemKart": "practiceKart", "kartSerial": 0}
		raw, _ := json.Marshal(doc)
		return raw
	}
	profile := func(itemID int) string { return `{"initial":"Z","equipment":` + string(equipment(itemID)) + `}` }
	patch := func(vehicleID string, enabled bool) {
		t.Helper()
		send(t, http.MethodPatch, h.public.URL+"/api/admin/vehicles/"+vehicleID, map[string]bool{"enabled": enabled}, h.adminHeader).expect(t, http.StatusOK, "")
	}
	h.put("/api/account/profile", profile(kart.ItemID), auth).expect(t, http.StatusOK, "")
	vehicleID := fmt.Sprintf("catalog:3:%d", kart.ItemID)
	patch(vehicleID, false)
	if replay := buy(requestID).expect(t, http.StatusOK, "").body; string(replay) != string(paid) {
		t.Fatal("paid retry receipt changed after vehicle was disabled")
	}
	buy(uuid()).expect(t, http.StatusConflict, "VEHICLE_DISABLED")
	if count := h.count("SELECT COUNT(*) FROM purchases WHERE account_id = ?", id); count != 1 {
		t.Fatalf("disabled purchase wrote a purchase: %d", count)
	}
	// Existing selected kart, its owned item and the game verification remain.
	h.put("/api/account/profile", profile(kart.ItemID), auth).expect(t, http.StatusOK, "")
	h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: id, Equipment: equipment(kart.ItemID)}).expect(t, http.StatusOK, "")
	if count := h.count("SELECT COUNT(*) FROM inventory_items WHERE account_id = ? AND category = 3 AND item_id = ?", id, kart.ItemID); count != 1 {
		t.Fatal("disabled vehicle disappeared from inventory")
	}
	h.put("/api/account/profile", profile(0), auth).expect(t, http.StatusOK, "")
	h.put("/api/account/profile", profile(kart.ItemID), auth).expect(t, http.StatusConflict, "VEHICLE_DISABLED")
	patch(vehicleID, true)
	h.put("/api/account/profile", profile(kart.ItemID), auth).expect(t, http.StatusOK, "")
	patch("system:practiceKart", false)
	h.put("/api/account/profile", profile(0), auth).expect(t, http.StatusConflict, "VEHICLE_DISABLED")
	patch("system:practiceKart", true)
	h.put("/api/account/profile", profile(0), auth).expect(t, http.StatusOK, "")
	patch("system:practiceKart", false)
	h.put("/api/account/profile", profile(0), auth).expect(t, http.StatusOK, "")
	h.call(contract.PathEquipmentVerify, contract.EquipmentVerifyRequest{AccountID: id, Equipment: equipment(0)}).expect(t, http.StatusOK, "")
}
