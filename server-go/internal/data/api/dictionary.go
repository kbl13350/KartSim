package api

import (
	"context"
	"net/http"

	"kartsim/internal/data/career"
	"kartsim/internal/data/store"
)

// The 道具图鉴 (item dictionary, dialog.rho/itemDictionary): the items it
// lists now (embargoed ones hidden), which of them a rider has collected,
// and for the owner the K币 reward of newly collected items (领取奖励).

type dictionaryCategory struct {
	Category  int    `json:"category"`
	Name      string `json:"name"`
	Items     []int  `json:"items"`
	Collected []int  `json:"collected"`
}

type dictionarySummary struct {
	Nickname   string                  `json:"nickname"`
	Owner      bool                    `json:"owner"`
	Version    string                  `json:"version"`
	Categories []dictionaryCategory    `json:"categories"`
	KartGrades map[int]int             `json:"kartGrades"`
	Reward     career.DictionaryReward `json:"reward"`
	Total      int                     `json:"total"`     // items listed
	Collected  int                     `json:"collected"` // listed items collected
	// Owner only: collected items already rewarded and still claimable.
	Rewarded  int `json:"rewarded,omitempty"`
	Claimable int `json:"claimable,omitempty"`
}

func (a *API) dictionarySummary(ctx context.Context, target store.Contact, owner bool) (dictionarySummary, error) {
	now := a.nowMillis()
	state, err := a.store.DictionaryState(ctx, a.dictionary, target.AccountID, now)
	if err != nil {
		return dictionarySummary{}, err
	}
	return a.dictionaryView(target, owner, state, now), nil
}

func (a *API) dictionaryView(target store.Contact, owner bool, state store.DictionaryState,
	now int64) dictionarySummary {
	d := a.dictionary
	summary := dictionarySummary{Nickname: target.Nickname, Owner: owner, Version: d.Version,
		KartGrades: d.KartGrades, Reward: d.Reward, Total: d.Size(now), Collected: state.Total}
	for _, row := range d.Categories {
		items := make([]int, 0, len(row.Items))
		for _, id := range row.Items {
			if d.Listed(row.Category, id, now) {
				items = append(items, id)
			}
		}
		summary.Categories = append(summary.Categories, dictionaryCategory{Category: row.Category,
			Name: row.Name, Items: items, Collected: state.Collected[row.Category]})
	}
	if owner {
		summary.Rewarded, summary.Claimable = state.Rewarded, state.Claimable
	}
	return summary
}

func (a *API) getDictionary(w http.ResponseWriter, r *http.Request) error {
	own, err := a.ownContact(r)
	if err != nil {
		return err
	}
	summary, err := a.dictionarySummary(r.Context(), own, true)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}

// claimDictionaryReward pays 1 K币 (the dictionary's rewardItem) for each
// collected item not rewarded before.
func (a *API) claimDictionaryReward(w http.ResponseWriter, r *http.Request) error {
	own, err := a.ownContact(r)
	if err != nil {
		return err
	}
	if err := a.accountWrite(r.Context(), own.AccountID); err != nil {
		return err
	}
	now := a.nowMillis()
	claim, err := a.store.ClaimDictionaryReward(r.Context(), a.dictionary, own.AccountID, now)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, struct {
		Items      int               `json:"items"`
		Koin       int64             `json:"koin"`
		Wallet     store.Wallet      `json:"wallet"`
		Dictionary dictionarySummary `json:"dictionary"`
	}{claim.Items, claim.Koin, claim.Wallet, a.dictionaryView(own, true, claim.State, now)})
}

// visitDictionary is 浏览图鉴: another rider's collection, behind the room's
// etc password.
func (a *API) visitDictionary(w http.ResponseWriter, r *http.Request) error {
	target, owner, err := a.visitTarget(w, r)
	if err != nil {
		return err
	}
	summary, err := a.dictionarySummary(r.Context(), target, owner)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, summary)
}
