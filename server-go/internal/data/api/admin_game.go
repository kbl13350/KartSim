package api

import (
	"net/http"

	"kartsim/internal/data/quest"
	"kartsim/internal/data/store"
)

// The admin console's game view of an account (ADMIN.md 5): GET
// /api/admin/accounts/{id}/game.

type gameStatsJSON struct {
	Races   int `json:"races"`
	Wins    int `json:"wins"`
	Podiums int `json:"podiums"`
	Points  int `json:"points"`
}

// gameLicenseJSON is the license held: level 1 新手 to 5 L1, 6 PRO while
// proUntil lies ahead (0 none); proUntil and lastRunAt are null when never.
type gameLicenseJSON struct {
	Level     int    `json:"level"`
	ProUntil  *int64 `json:"proUntil"`
	ProCount  int    `json:"proCount"`
	LastRunAt *int64 `json:"lastRunAt"`
}

type gameClearJSON struct {
	Step      int    `json:"step"`
	Period    string `json:"period"` // "" for 新手 to L1, the mission period for PRO steps
	BestMs    int64  `json:"bestMs"`
	ClearedAt int64  `json:"clearedAt"`
}

type gameBestJSON struct {
	TrackID   string `json:"trackId"`
	TrackName string `json:"trackName"`
	BestMs    int64  `json:"bestMs"`
	UpdatedAt int64  `json:"updatedAt"`
}

// gameQuestJSON is one quest's progress; title is the quest's name ("" for
// a quest the table no longer has).
type gameQuestJSON struct {
	QuestID     int    `json:"questId"`
	Title       string `json:"title"`
	Period      string `json:"period"`
	Value       int64  `json:"value"`
	CompletedAt *int64 `json:"completedAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

type gameCounterJSON struct {
	Counter   string `json:"counter"`
	Value     int64  `json:"value"`
	UpdatedAt int64  `json:"updatedAt"`
}

type gameClubJSON struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Grade        int    `json:"grade"`
	JoinedAt     int64  `json:"joinedAt"`
	CSWeek       int64  `json:"csWeek"`
	CSTotal      int64  `json:"csTotal"`
	DonatedTotal int64  `json:"donatedTotal"`
}

// adminAccountGame answers an account's game data: race tallies, licenses
// (clears newest first, qualification records), time-attack bests, quest
// progress (latest change first), career counters, the friend count and
// the club membership (null outside a club or in a disbanded one).
func (a *API) adminAccountGame(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	now := a.nowMillis()
	target, err := a.adminAccountTarget(r, now)
	if err != nil {
		return err
	}
	game, err := a.store.AccountGame(r.Context(), target.Account.ID, now)
	if err != nil {
		return err
	}
	var stats *gameStatsJSON
	if game.Stats != nil {
		stats = &gameStatsJSON{Races: game.Stats.Races, Wins: game.Stats.Wins, Podiums: game.Stats.Podiums,
			Points: game.Stats.Points}
	}
	var held *gameLicenseJSON
	if game.License != nil {
		held = &gameLicenseJSON{Level: game.License.Level, ProUntil: nonZero(game.License.ProUntil),
			ProCount: game.License.ProCount, LastRunAt: nonZero(game.License.LastRunAt)}
	}
	clears := make([]gameClearJSON, len(game.LicenseClears))
	for i, row := range game.LicenseClears {
		clears[i] = gameClearJSON{Step: row.Step, Period: row.Period, BestMs: row.BestMs, ClearedAt: row.ClearedAt}
	}
	bests := func(rows []store.BestTime) []gameBestJSON {
		list := make([]gameBestJSON, len(rows))
		for i, row := range rows {
			list[i] = gameBestJSON{TrackID: row.TrackID, TrackName: a.trackName(row.TrackID), BestMs: row.BestMs,
				UpdatedAt: row.UpdatedAt}
		}
		return list
	}
	quests := make([]gameQuestJSON, len(game.Quests))
	for i, row := range game.Quests {
		quests[i] = gameQuestJSON{QuestID: row.QuestID, Period: row.Period, Value: row.Value,
			CompletedAt: row.CompletedAt, UpdatedAt: row.UpdatedAt}
		if known, ok := quest.ByID(row.QuestID); ok {
			quests[i].Title = known.Title
		}
	}
	counters := make([]gameCounterJSON, len(game.Counters))
	for i, row := range game.Counters {
		counters[i] = gameCounterJSON{Counter: row.Counter, Value: row.Value, UpdatedAt: row.UpdatedAt}
	}
	var member *gameClubJSON
	if game.Club != nil {
		member = &gameClubJSON{ID: game.Club.ID, Name: game.Club.Name, Grade: game.Club.Grade,
			JoinedAt: game.Club.JoinedAt, CSWeek: game.Club.CSWeek, CSTotal: game.Club.CSTotal,
			DonatedTotal: game.Club.DonatedTotal}
	}
	return writeJSON(w, http.StatusOK, struct {
		Stats          *gameStatsJSON    `json:"stats"`
		License        *gameLicenseJSON  `json:"license"`
		LicenseClears  []gameClearJSON   `json:"licenseClears"`
		LicenseRecords []gameBestJSON    `json:"licenseRecords"`
		TimeAttack     []gameBestJSON    `json:"timeAttack"`
		Quests         []gameQuestJSON   `json:"quests"`
		Counters       []gameCounterJSON `json:"counters"`
		Friends        int               `json:"friends"`
		Club           *gameClubJSON     `json:"club"`
	}{stats, held, clears, bests(game.LicenseRecords), bests(game.TimeAttack), quests, counters, game.Friends, member})
}
