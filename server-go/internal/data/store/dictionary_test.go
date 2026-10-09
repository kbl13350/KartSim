package store_test

import (
	"context"
	"sync"
	"testing"

	"kartsim/internal/data/career"
	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

// Concurrent claims pay each collected item once.
func TestDictionaryRewardConcurrentClaims(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	dictionary, err := career.DefaultDictionary()
	if err != nil {
		t.Fatal(err)
	}
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	datatest.Exec(t, db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, expires_at, source,
		created_at, updated_at) VALUES(?, 3, 1, '', NULL, 'test', 0, 0), (?, 3, 2, '', NULL, 'test', 0, 0),
		(?, 27, 1, '', NULL, 'test', 0, 0)`, id, id, id)

	var wg sync.WaitGroup
	results := make([]error, 4)
	paid := make([]int64, len(results))
	for i := range results {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claim, err := st.ClaimDictionaryReward(ctx, dictionary, id, 5_000)
			results[i], paid[i] = err, claim.Koin
		}()
	}
	wg.Wait()
	total, succeeded := int64(0), 0
	for i, err := range results {
		if err == nil {
			succeeded++
			total += paid[i]
		}
	}
	if succeeded != 1 || total != 3 {
		t.Fatalf("succeeded %d paid %d (%v)", succeeded, total, results)
	}
	state, err := st.DictionaryState(ctx, dictionary, id, 5_000)
	if err != nil || state.Total != 3 || state.Rewarded != 3 || state.Claimable != 0 ||
		len(state.Collected[3]) != 2 || len(state.Collected[27]) != 1 {
		t.Fatalf("state %+v %v", state, err)
	}
	var koin int64
	if err := db.QueryRow("SELECT koin FROM wallets WHERE account_id = ?", id).Scan(&koin); err != nil || koin != 3 {
		t.Fatalf("koin %d %v", koin, err)
	}
}
