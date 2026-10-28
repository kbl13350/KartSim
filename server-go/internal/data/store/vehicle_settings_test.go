package store_test

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"testing"

	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

func TestBuiltinVehicleSettingsPersistenceAndConcurrentEdits(t *testing.T) {
	db := datatest.MySQL(t)
	datatest.LockEconomySettings(t, db)
	datatest.Exec(t, db, "DELETE FROM app_settings WHERE name = 'builtinVehicles'")
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM app_settings WHERE name = 'builtinVehicles'") })
	ctx := context.Background()
	st := store.New(db)
	initial, err := st.BuiltinVehicleSettings(ctx)
	if err != nil || initial.DisabledVehicleIDs == nil || len(initial.DisabledVehicleIDs) != 0 || initial.UpdatedAt != 0 {
		t.Fatalf("defaults %+v %v", initial, err)
	}
	const edits = 16
	errors := make(chan error, edits)
	var wg sync.WaitGroup
	for i := range edits {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := st.SetBuiltinVehiclesEnabled(ctx, []string{fmt.Sprintf("catalog:3:%d", i+1)}, false, "test-admin", 100)
			errors <- err
		}()
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	reloaded, err := store.New(db).BuiltinVehicleSettings(ctx)
	if err != nil || len(reloaded.DisabledVehicleIDs) != edits || reloaded.UpdatedAt < 100 || reloaded.UpdatedBy != "test-admin" {
		t.Fatalf("concurrent persistent result %+v %v", reloaded, err)
	}
	for i := range edits {
		if !slices.Contains(reloaded.DisabledVehicleIDs, fmt.Sprintf("catalog:3:%d", i+1)) {
			t.Fatalf("lost edit %d", i)
		}
	}
	updated, err := st.SetBuiltinVehiclesEnabled(ctx, []string{"catalog:3:1"}, true, "next-admin", 100)
	if err != nil || len(updated.DisabledVehicleIDs) != edits-1 || slices.Contains(updated.DisabledVehicleIDs, "catalog:3:1") || updated.UpdatedAt <= reloaded.UpdatedAt {
		t.Fatalf("reenable %+v %v", updated, err)
	}
	unchanged, err := st.SetBuiltinVehiclesEnabled(ctx, []string{"catalog:3:1"}, true, "other-admin", 999)
	if err != nil || unchanged.UpdatedAt != updated.UpdatedAt || unchanged.UpdatedBy != updated.UpdatedBy {
		t.Fatalf("idempotent edit changed timestamp %+v %v", unchanged, err)
	}
	for _, id := range []string{"bad id", "catalog:2:1", "catalog:3:01", "system:", "system:../kart"} {
		if _, err := st.SetBuiltinVehiclesEnabled(ctx, []string{id}, false, "admin", 1); err == nil {
			t.Fatalf("invalid ID accepted: %q", id)
		}
	}
	if _, err := st.SetBuiltinVehiclesEnabled(ctx, []string{"system:practiceKart"}, false, "admin", 200); err != nil {
		t.Fatal(err)
	}
	// Unrelated settings are neither replaced nor deleted.
	if _, err := st.BuiltinTrackSettings(ctx); err != nil {
		t.Fatal(err)
	}
}
