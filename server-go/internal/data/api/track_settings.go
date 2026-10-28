package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"slices"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

var (
	errBuiltinTrackNotFound = apierr.New(http.StatusNotFound, "TRACK_NOT_FOUND")
	errTrackThemeNotFound   = apierr.New(http.StatusNotFound, "TRACK_THEME_NOT_FOUND")
	errInvalidTrackSetting  = apierr.New(http.StatusBadRequest, "INVALID_TRACK_SETTINGS")
)

type publicTrackSettingsJSON struct {
	DisabledTrackIDs []string `json:"disabledTrackIds"`
	Version          string   `json:"version"`
	UpdatedAt        int64    `json:"updatedAt"`
}

type adminTrackJSON struct {
	economy.DirectoryTrack
	Enabled bool `json:"enabled"`
}

type trackThemeJSON struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Total        int    `json:"total"`
	EnabledCount int    `json:"enabledCount"`
}

type adminTracksJSON struct {
	Tracks    []adminTrackJSON `json:"tracks"`
	Themes    []trackThemeJSON `json:"themes"`
	Version   string           `json:"version"`
	UpdatedAt int64            `json:"updatedAt"`
	UpdatedBy string           `json:"updatedBy"`
}

func (a *API) builtinTrackSettings(ctx context.Context) (store.BuiltinTrackSettings, error) {
	if a.store == nil {
		return store.BuiltinTrackSettings{DisabledTrackIDs: []string{}}, nil
	}
	return a.store.BuiltinTrackSettings(ctx)
}

func (a *API) disabledBuiltinTrackIDs(ctx context.Context) ([]string, error) {
	directory, err := economy.DefaultTrackDirectory()
	if err != nil {
		return nil, err
	}
	settings, err := a.builtinTrackSettings(ctx)
	if err != nil {
		return nil, err
	}
	public, _ := trackSettingsViews(directory, settings)
	return public.DisabledTrackIDs, nil
}

func trackSettingsViews(directory *economy.TrackDirectory, settings store.BuiltinTrackSettings) (publicTrackSettingsJSON, adminTracksJSON) {
	disabled := make(map[string]bool, len(settings.DisabledTrackIDs))
	for _, id := range settings.DisabledTrackIDs {
		disabled[id] = true
	}
	public := publicTrackSettingsJSON{DisabledTrackIDs: []string{}, UpdatedAt: settings.UpdatedAt}
	admin := adminTracksJSON{Tracks: make([]adminTrackJSON, 0, len(directory.Tracks)), Themes: []trackThemeJSON{},
		UpdatedAt: settings.UpdatedAt, UpdatedBy: settings.UpdatedBy}
	themes := make(map[string]int)
	for _, track := range directory.Tracks {
		enabled := !disabled[track.ID]
		for _, alias := range track.Aliases {
			enabled = enabled && !disabled[alias]
		}
		admin.Tracks = append(admin.Tracks, adminTrackJSON{DirectoryTrack: track, Enabled: enabled})
		if !enabled {
			public.DisabledTrackIDs = append(public.DisabledTrackIDs, track.ID)
			public.DisabledTrackIDs = append(public.DisabledTrackIDs, track.Aliases...)
		}
		i, ok := themes[track.Theme]
		if !ok {
			i = len(admin.Themes)
			themes[track.Theme] = i
			admin.Themes = append(admin.Themes, trackThemeJSON{ID: track.Theme, Title: track.ThemeTitle})
		}
		admin.Themes[i].Total++
		if enabled {
			admin.Themes[i].EnabledCount++
		}
	}
	slices.Sort(public.DisabledTrackIDs)
	slices.SortFunc(admin.Themes, func(a, b trackThemeJSON) int {
		if a.ID < b.ID {
			return -1
		}
		if a.ID > b.ID {
			return 1
		}
		return 0
	})
	encoded, _ := json.Marshal(public.DisabledTrackIDs)
	digest := sha256.Sum256(append([]byte(directory.Version+"\n"), encoded...))
	public.Version = hex.EncodeToString(digest[:])
	admin.Version = public.Version
	return public, admin
}

// These settings govern map-picker visibility, not historical record/replay
// access or in-progress races. The custom-map workshop APIs are independent.
func (a *API) trackSettings(w http.ResponseWriter, r *http.Request) error {
	directory, err := economy.DefaultTrackDirectory()
	if err != nil {
		return err
	}
	settings, err := a.builtinTrackSettings(r.Context())
	if err != nil {
		return err
	}
	public, _ := trackSettingsViews(directory, settings)
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, public)
}

func (a *API) adminTracks(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	directory, err := economy.DefaultTrackDirectory()
	if err != nil {
		return err
	}
	settings, err := a.builtinTrackSettings(r.Context())
	if err != nil {
		return err
	}
	_, admin := trackSettingsViews(directory, settings)
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, admin)
}

func (a *API) adminSetTrack(w http.ResponseWriter, r *http.Request) error {
	return a.adminSetBuiltinTracks(w, r, false)
}

func (a *API) adminSetTrackTheme(w http.ResponseWriter, r *http.Request) error {
	return a.adminSetBuiltinTracks(w, r, true)
}

func (a *API) adminSetBuiltinTracks(w http.ResponseWriter, r *http.Request, byTheme bool) error {
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
		return errInvalidTrackSetting
	}
	directory, err := economy.DefaultTrackDirectory()
	if err != nil {
		return err
	}
	ids := []string{}
	target := r.PathValue("id")
	if byTheme {
		target = r.PathValue("theme")
		for _, track := range directory.Tracks {
			if track.Theme == target {
				ids = append(ids, track.ID)
				ids = append(ids, track.Aliases...)
			}
		}
		if len(ids) == 0 {
			return errTrackThemeNotFound
		}
	} else {
		track, ok := directory.Find(target)
		if !ok {
			return errBuiltinTrackNotFound
		}
		ids = append(ids, track.ID)
		ids = append(ids, track.Aliases...)
	}
	settings, err := a.store.SetBuiltinTracksEnabled(r.Context(), ids, *request.Enabled, admin.Username, a.nowMillis())
	if err != nil {
		return err
	}
	a.log.Info("admin built-in track visibility", "admin", admin.Username, "target", target,
		"byTheme", byTheme, "enabled", *request.Enabled, "settlementIDs", len(ids))
	public, response := trackSettingsViews(directory, settings)
	if a.lobby != nil {
		a.lobby.setTrackSettings(public.DisabledTrackIDs)
	}
	w.Header().Set("Cache-Control", "no-store")
	return writeJSON(w, http.StatusOK, response)
}
