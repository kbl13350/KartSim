package api

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"kartsim/internal/shared/apierr"
)

const historyCacheTTL = 30 * time.Second

var (
	errInvalidName     = apierr.New(http.StatusBadRequest, "INVALID_NAME")
	errInvalidGameplay = apierr.New(http.StatusBadRequest, "INVALID_GAMEPLAY")
	errPlayerNotFound  = apierr.New(http.StatusNotFound, "PLAYER_NOT_FOUND")

	gameplays = []string{"ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp"}
)

// historyName is the Java race-results name rule: at most 18 UTF-16 units
// and not blank.
func historyName(name *string) error {
	if name != nil && (utf16Len(*name) > 18 || javaBlank(*name)) {
		return errInvalidName
	}
	return nil
}

// cachedHistory answers a history list from history:{gen}:{key}, loading
// and caching it on a miss. Writes bump the generation, so a cached
// response is at most one write old and lives 30 seconds.
func (a *API) cachedHistory(ctx context.Context, w http.ResponseWriter, key string, load func() (any, error)) error {
	gen, cacheable := a.cache.HistoryGen(ctx)
	cacheKey := "history:" + gen + ":" + key
	if cacheable {
		if body, ok := a.cache.Get(ctx, cacheKey); ok {
			writeRaw(w, http.StatusOK, []byte(body))
			return nil
		}
	}
	value, err := load()
	if err != nil {
		return err
	}
	body, err := marshalJSON(value)
	if err != nil {
		return err
	}
	if cacheable {
		a.cache.Fill(ctx, cacheKey, string(body), historyCacheTTL)
	}
	writeRaw(w, http.StatusOK, body)
	return nil
}

func (a *API) raceResults(w http.ResponseWriter, r *http.Request) error {
	name := queryParam(r, "name")
	if err := historyName(name); err != nil {
		return err
	}
	key := "results:*"
	if name != nil {
		key = "results:=" + *name
	}
	return a.cachedHistory(r.Context(), w, key, func() (any, error) {
		return a.store.RecentResults(r.Context(), name)
	})
}

func (a *API) raceOutcomes(w http.ResponseWriter, r *http.Request) error {
	gameplay := queryParam(r, "gameplay")
	if gameplay != nil && !slices.Contains(gameplays, *gameplay) {
		return errInvalidGameplay
	}
	key := "outcomes:*"
	if gameplay != nil {
		key = "outcomes:" + *gameplay
	}
	type outcome struct {
		RaceID    string          `json:"raceId"`
		RoomID    string          `json:"roomId"`
		Gameplay  string          `json:"gameplay"`
		TrackID   string          `json:"trackId"`
		Snapshot  json.RawMessage `json:"snapshot"`
		CreatedAt int64           `json:"createdAt"`
	}
	return a.cachedHistory(r.Context(), w, key, func() (any, error) {
		rows, err := a.store.RecentOutcomes(r.Context(), gameplay)
		if err != nil {
			return nil, err
		}
		outcomes := make([]outcome, len(rows))
		for i, row := range rows {
			outcomes[i] = outcome{row.RaceID, row.RoomID, row.Gameplay, row.TrackID, json.RawMessage(row.JSON), row.CreatedAt}
		}
		return outcomes, nil
	})
}

func (a *API) roomRules(w http.ResponseWriter, r *http.Request) error {
	type rules struct {
		RoomID    string          `json:"roomId"`
		Settings  json.RawMessage `json:"settings"`
		UpdatedAt int64           `json:"updatedAt"`
	}
	return a.cachedHistory(r.Context(), w, "rules", func() (any, error) {
		rows, err := a.store.RecentRoomRules(r.Context())
		if err != nil {
			return nil, err
		}
		list := make([]rules, len(rows))
		for i, row := range rows {
			list[i] = rules{row.RoomID, json.RawMessage(row.JSON), row.UpdatedAt}
		}
		return list, nil
	})
}

// maxStatsName is the nickname column size in code points; a longer name
// cannot belong to any account.
const maxStatsName = 64

// playerStats returns the accumulated results of a registered account. Its
// name rule is not the race-results one (18 UTF-16 units): account
// nicknames are up to 16 code points, which can be 32 UTF-16 units.
func (a *API) playerStats(w http.ResponseWriter, r *http.Request) error {
	name := queryParam(r, "name")
	if name == nil || !utf8.ValidString(*name) || javaBlank(*name) || strings.ContainsFunc(*name, isISOControl) {
		return errInvalidName
	}
	if utf8.RuneCountInString(*name) > maxStatsName {
		return errPlayerNotFound
	}
	stats, found, err := a.store.StatsByNickname(r.Context(), *name)
	if err != nil {
		return err
	}
	if !found {
		return errPlayerNotFound
	}
	return writeJSON(w, http.StatusOK, stats)
}
