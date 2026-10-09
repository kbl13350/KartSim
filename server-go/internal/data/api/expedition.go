package api

import (
	"math/rand/v2"
	"net/http"

	"kartsim/internal/data/expedition"
	"kartsim/internal/data/store"
)

// The 赛车探险队 (racing expedition) and opening boxes (开箱): see the
// expedition and lottery packages for the rules.

// roll draws the expedition's and the boxes' random numbers.
func roll(n int) int { return rand.IntN(n) }

type expeditionStockJSON struct {
	StockID int               `json:"stockId"`
	Name    string            `json:"name"`
	Items   []store.BoxReward `json:"items"`
}

type expeditionMissionJSON struct {
	Slot       int    `json:"slot"`
	Mission    int    `json:"mission"`
	Specific   int    `json:"specific"`
	TrackID    string `json:"trackId"`
	Theme      int    `json:"theme"`
	BonusType  int    `json:"bonusType"`
	Difficulty int    `json:"difficulty"`
	Hours      int    `json:"hours"`
	Added      bool   `json:"added"`
	// State: ready (未开始), blocked (无法进行: no matching character and
	// kart), running (进行中) or done (探险完成, the reward waits).
	State   string            `json:"state"`
	Started int64             `json:"started,omitempty"`
	Ends    int64             `json:"ends,omitempty"`
	Crew    []expedition.Pair `json:"crew"`
	Friend  string            `json:"friend,omitempty"`
	Bonus   expedition.Bonus  `json:"bonus"`
	// Exp and Lucci: what the mission pays (without a crew's bonus before
	// it starts).
	Exp          int64               `json:"exp"`
	Lucci        int64               `json:"lucci"`
	Reward       expeditionStockJSON `json:"reward"`
	CompleteCost int                 `json:"completeCost,omitempty"`
}

type expeditionJSON struct {
	Missions   []expeditionMissionJSON `json:"missions"`
	Started    int                     `json:"started"`
	Limit      int                     `json:"limit"`
	Added      int                     `json:"added"`
	CanAdd     bool                    `json:"canAdd"`
	Tokens     int                     `json:"tokens"`
	WeekStart  int64                   `json:"weekStart"`
	WeekEnds   int64                   `json:"weekEnds"`
	DayEnds    int64                   `json:"dayEnds"` // friends renew
	ServerTime int64                   `json:"serverTime"`
	Rules      expeditionRulesJSON     `json:"rules"`
}

// expeditionRulesJSON is what the client needs to show costs and to
// preview a crew's bonus (expedition.CrewBonus).
type expeditionRulesJSON struct {
	Basic        expedition.Basic     `json:"basic"`
	Constants    expedition.Constants `json:"constants"`
	KartTuning   map[int][5]int       `json:"kartTuning"`
	Parts        map[int][5]int       `json:"parts"`
	Rewards      map[int]int          `json:"rewards"`
	MaxTimeBonus int                  `json:"maxTimeBonus"`
	WeeklyTokens int                  `json:"weeklyTokens"`
}

func (a *API) expeditionStock(stockID int) expeditionStockJSON {
	stock := a.expedition.Stocks[stockID]
	out := expeditionStockJSON{StockID: stockID, Name: stock.Name, Items: []store.BoxReward{}}
	for _, item := range stock.Items {
		out.Items = append(out.Items, store.BoxReward{Category: item.Category, ItemID: item.ItemID,
			Count: item.Count, Days: item.Days, Name: a.lottery.Name(item.Category, item.ItemID)})
	}
	return out
}

func (a *API) expeditionView(view store.ExpeditionView, now int64) expeditionJSON {
	d := a.expedition
	state := view.State
	out := expeditionJSON{Missions: []expeditionMissionJSON{}, Started: state.Started, Limit: d.Limit(&state),
		Added: state.Added, CanAdd: d.CanAdd(&state), Tokens: view.Tokens, WeekStart: state.Week,
		WeekEnds: d.WeekStart(now) + 7*24*3_600_000, DayEnds: d.DayStart(now) + 24*3_600_000, ServerTime: now,
		Rules: expeditionRulesJSON{Basic: d.Basic, Constants: d.Constants, KartTuning: d.KartTuning, Parts: d.Parts,
			Rewards: d.Rewards, MaxTimeBonus: expedition.MaxTimeBonus, WeeklyTokens: expedition.WeeklyTokens}}
	for _, slot := range state.Slots {
		m, ok := d.Mission(slot.Mission)
		if !ok {
			continue
		}
		mission := expeditionMissionJSON{Slot: slot.Slot, Mission: m.ID, Specific: m.Specific, TrackID: m.TrackID,
			Theme: m.Theme, BonusType: m.BonusType, Difficulty: m.Difficulty, Hours: m.Hours, Added: slot.Added,
			Started: slot.Started, Ends: slot.Ends, Crew: slot.Crew, Friend: slot.Friend, Bonus: slot.Bonus,
			Exp: slot.Exp, Lucci: slot.Lucci, Reward: a.expeditionStock(m.StockID)}
		if mission.Crew == nil {
			mission.Crew = []expedition.Pair{}
		}
		switch {
		case slot.Done(now):
			mission.State = "done"
		case slot.InProgress(now):
			mission.State = "running"
			mission.CompleteCost = d.CompleteCost(&slot, now)
		case view.Feasible[m.Specific]:
			mission.State = "ready"
		default:
			mission.State = "blocked"
		}
		if slot.Started == 0 {
			mission.Exp, mission.Lucci = d.Payout(m, expedition.Bonus{})
		}
		out.Missions = append(out.Missions, mission)
	}
	return out
}

func (a *API) getExpedition(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	now := a.nowMillis()
	view, err := a.store.Expedition(r.Context(), a.expedition, account.ID, now, roll)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, a.expeditionView(view, now))
}

func (a *API) expeditionCrew(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	crew, err := a.store.ExpeditionCrew(r.Context(), a.expedition, account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, crew)
}

func (a *API) startExpedition(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Slot   int               `json:"slot"`
		Crew   []expedition.Pair `json:"crew"`
		Friend string            `json:"friend"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if request.Slot <= 0 || len(request.Crew) == 0 || len(request.Crew) > 3 || len(request.Friend) > 64 {
		return expedition.ErrInvalidCrew
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	now := a.nowMillis()
	view, err := a.store.StartExpedition(r.Context(), a.expedition, account.ID,
		store.ExpeditionDeparture{Slot: request.Slot, Crew: request.Crew, Friend: request.Friend}, now, roll)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, a.expeditionView(view, now))
}

func (a *API) expeditionTokens(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Action string `json:"action"`
		Slot   int    `json:"slot"`
		Count  int    `json:"count"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	now := a.nowMillis()
	view, err := a.store.UseExpeditionTokens(r.Context(), a.expedition, account.ID, request.Action, request.Slot,
		request.Count, now, roll)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, a.expeditionView(view, now))
}

func (a *API) claimExpedition(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Slot int `json:"slot"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	now := a.nowMillis()
	view, claim, err := a.store.ClaimExpedition(r.Context(), a.expedition, a.lottery.Name, account.ID, request.Slot,
		now, roll)
	if err != nil {
		return err
	}
	if claim.Items == nil {
		claim.Items = []store.BoxReward{}
	}
	return writeJSON(w, http.StatusOK, struct {
		Expedition expeditionJSON        `json:"expedition"`
		Exp        int64                 `json:"exp"`
		Lucci      int64                 `json:"lucci"`
		Items      []store.BoxReward     `json:"items"`
		Inventory  []store.InventoryItem `json:"inventory"`
		LevelUps   any                   `json:"levelUps"`
	}{a.expeditionView(view, now), claim.Exp, claim.Lucci, claim.Items, claim.Inventory, claim.LevelUps})
}

// openBox opens one box (category 24) of the account's: {itemId, requestId}.
func (a *API) openBox(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		ItemID    int    `json:"itemId"`
		RequestID string `json:"requestId"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	id, err := requestID(request.RequestID)
	if err != nil {
		return err
	}
	if request.ItemID <= 0 {
		return errInvalidRequest
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), account.ID); err != nil {
		return err
	}
	opening, err := a.store.OpenBox(r.Context(), a.lottery, account.ID, request.ItemID, id, a.nowMillis(), roll)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, opening)
}
