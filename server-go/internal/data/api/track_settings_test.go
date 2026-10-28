package api

import (
	"context"
	"net/http"
	"slices"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/contract"
)

func TestBuiltinTrackSettingsPublicDefaultsAndAdminAuthentication(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	var body publicTrackSettingsJSON
	response := h.get("/api/track-settings", nil).expect(t, http.StatusOK, "")
	response.json(t, &body)
	if body.DisabledTrackIDs == nil || len(body.DisabledTrackIDs) != 0 || len(body.Version) != 64 || body.UpdatedAt != 0 || response.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("defaults %+v", body)
	}
	h.get("/api/admin/tracks", nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	for _, path := range []string{"/api/admin/tracks/korea_I01", "/api/admin/track-themes/korea"} {
		send(t, http.MethodPatch, h.public.URL+path, `{"enabled":false}`, nil).expect(t, http.StatusUnauthorized, "LOGIN_REQUIRED")
	}
}

func TestBuiltinTrackSettingsAliasExpansionAndVersions(t *testing.T) {
	d, err := economy.DefaultTrackDirectory()
	if err != nil {
		t.Fatal(err)
	}
	var chosen economy.DirectoryTrack
	for _, row := range d.Tracks {
		if len(row.Aliases) > 0 {
			chosen = row
			break
		}
	}
	before, _ := trackSettingsViews(d, store.BuiltinTrackSettings{})
	public, admin := trackSettingsViews(d, store.BuiltinTrackSettings{DisabledTrackIDs: []string{chosen.Aliases[0]}, UpdatedAt: 5})
	if public.Version == before.Version || !slices.Contains(public.DisabledTrackIDs, chosen.ID) {
		t.Fatalf("alias did not disable canonical %+v", public)
	}
	for _, alias := range chosen.Aliases {
		if !slices.Contains(public.DisabledTrackIDs, alias) {
			t.Fatalf("alias escaped %s", alias)
		}
	}
	if len(admin.Tracks) != 796 || public.UpdatedAt != 5 {
		t.Fatal("directory changed")
	}
	all := []string{}
	for _, row := range d.Tracks {
		all = append(all, row.ID)
	}
	closed, closedAdmin := trackSettingsViews(d, store.BuiltinTrackSettings{DisabledTrackIDs: all})
	if len(closed.DisabledTrackIDs) != 921 {
		t.Fatalf("all closed expanded to %d IDs", len(closed.DisabledTrackIDs))
	}
	for _, theme := range closedAdmin.Themes {
		if theme.EnabledCount != 0 {
			t.Fatal("closed theme has enabled maps")
		}
	}
}

func TestBuiltinTrackSettingsAdminPersistenceThemeAndHeartbeat(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	datatest.LockEconomySettings(t, h.db)
	datatest.Exec(t, h.db, "DELETE FROM app_settings WHERE name = 'builtinTracks'")
	t.Cleanup(func() { datatest.Exec(t, h.db, "DELETE FROM app_settings WHERE name = 'builtinTracks'") })
	var initial adminTracksJSON
	h.adminGet("/api/admin/tracks", &initial)
	if len(initial.Tracks) != 796 {
		t.Fatalf("%d choices", len(initial.Tracks))
	}
	var chosen adminTrackJSON
	for _, row := range initial.Tracks {
		if len(row.Aliases) > 0 {
			chosen = row
			break
		}
	}
	patch := func(path string, enabled bool) adminTracksJSON {
		t.Helper()
		var body adminTracksJSON
		send(t, http.MethodPatch, h.public.URL+path, map[string]bool{"enabled": enabled}, h.adminHeader).expect(t, http.StatusOK, "").json(t, &body)
		return body
	}
	changed := patch("/api/admin/tracks/"+chosen.Aliases[0], false)
	if changed.Version == initial.Version || changed.UpdatedAt == 0 || changed.UpdatedBy != h.adminName {
		t.Fatalf("saved %+v", changed)
	}
	var public publicTrackSettingsJSON
	h.get("/api/track-settings", nil).expect(t, http.StatusOK, "").json(t, &public)
	if !slices.Contains(public.DisabledTrackIDs, chosen.ID) || h.api.lobby.trackEnabled(chosen.ID) {
		t.Fatal("canonical remains enabled")
	}
	// A failed refresh never replaces the last known disabled snapshot.
	var saved string
	if err := h.db.QueryRow("SELECT json FROM app_settings WHERE name = 'builtinTracks'").Scan(&saved); err != nil {
		t.Fatal(err)
	}
	datatest.Exec(t, h.db, "UPDATE app_settings SET json = 'broken-json' WHERE name = 'builtinTracks'")
	h.api.lobby.refreshTrackSettings(context.Background())
	if h.api.lobby.trackEnabled(chosen.ID) {
		t.Fatal("failed refresh cleared disabled state")
	}
	datatest.Exec(t, h.db, "UPDATE app_settings SET json = ? WHERE name = 'builtinTracks'", saved)
	patch("/api/admin/tracks/"+chosen.ID, true)
	closed := patch("/api/admin/track-themes/korea", false)
	count := 0
	for _, row := range closed.Tracks {
		if row.Theme == "korea" {
			count++
			if row.Enabled {
				t.Fatal("Korean map remains enabled")
			}
		}
	}
	if count == 0 {
		t.Fatal("Korean theme missing")
	}
	var heartbeat contract.HeartbeatResponse
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "track-settings-" + h.u, Name: "test", Capacity: 10, ProtocolVersion: contract.ProtocolVersion}).expect(t, http.StatusOK, "").json(t, &heartbeat)
	if heartbeat.DisabledTrackIDs == nil || len(*heartbeat.DisabledTrackIDs) < count {
		t.Fatalf("heartbeat %+v", heartbeat)
	}
	patch("/api/admin/track-themes/korea", true)
	h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: "track-settings-" + h.u, Name: "test", Capacity: 10, ProtocolVersion: contract.ProtocolVersion}).expect(t, http.StatusOK, "").json(t, &heartbeat)
	if heartbeat.DisabledTrackIDs == nil || len(*heartbeat.DisabledTrackIDs) != 0 {
		t.Fatal("reenabling all did not send explicit empty array")
	}
	for _, body := range []string{`{}`, `{"enabled":null}`} {
		send(t, http.MethodPatch, h.public.URL+"/api/admin/tracks/"+chosen.ID, body, h.adminHeader).expect(t, http.StatusBadRequest, "INVALID_TRACK_SETTINGS")
	}
	send(t, http.MethodPatch, h.public.URL+"/api/admin/tracks/unknown", `{"enabled":false}`, h.adminHeader).expect(t, http.StatusNotFound, "TRACK_NOT_FOUND")
	send(t, http.MethodPatch, h.public.URL+"/api/admin/track-themes/unknown", `{"enabled":false}`, h.adminHeader).expect(t, http.StatusNotFound, "TRACK_THEME_NOT_FOUND")
	// Ordinary players cannot change or inspect admin settings.
	h.account("viewer_"+h.u, "Viewer"+h.u, password, false)
	var user struct{ Token string }
	h.post("/multiplayer/auth/login", map[string]any{"username": "viewer_" + h.u, "password": password}, nil).expect(t, http.StatusOK, "").json(t, &user)
	h.get("/api/admin/tracks", bearerHeader(user.Token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
	send(t, http.MethodPatch, h.public.URL+"/api/admin/tracks/"+chosen.ID, `{"enabled":false}`, bearerHeader(user.Token)).expect(t, http.StatusForbidden, "ADMIN_REQUIRED")
}
