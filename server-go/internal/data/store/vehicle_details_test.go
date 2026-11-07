package store_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/economy"
	"kartsim/internal/data/store"
)

func TestVehicleDetailsConcurrentWrites(t *testing.T) {
	db := datatest.MySQL(t)
	datatest.LockEconomySettings(t, db)
	datatest.Exec(t, db, "DELETE FROM app_settings WHERE name LIKE 'veh:%'")
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM app_settings WHERE name LIKE 'veh:%'") })
	st := store.New(db)
	ctx := context.Background()
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			changes := economy.EmptyVehicleOverrides()
			changes.Profiles["7"] = map[string]float64{"forwardAccel": float64(2400 + i)}
			_, err := st.SetVehicleDetails(ctx, "catalog:3:387", changes, 0, "test", 100)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	saved, conflicts := 0, 0
	for err := range results {
		if err == nil {
			saved++
		} else if errors.Is(err, store.ErrVehicleDetailsConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if saved != 1 || conflicts != 1 {
		t.Fatalf("concurrent writes: saved=%d conflict=%d", saved, conflicts)
	}
	// A different vehicle has its own revision and cannot overwrite the first.
	if _, err := st.SetVehicleDetails(ctx, "system:legacyPracticeBlackline", economy.EmptyVehicleOverrides(), 0, "test2", 200); err != nil {
		t.Fatal(err)
	}
	all, err := store.New(db).AllVehicleDetailSettings(ctx)
	if err != nil || len(all) != 2 || all["catalog:3:387"].UpdatedAt != 100 {
		t.Fatalf("isolated rows: %+v %v", all, err)
	}
}
