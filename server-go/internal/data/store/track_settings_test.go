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

func TestBuiltinTrackSettingsPersistenceAndConcurrentEdits(t *testing.T) {
	db := datatest.MySQL(t)
	// Serialize settings fixtures across API/store packages sharing a test DB.
	datatest.LockEconomySettings(t, db)
	datatest.Exec(t, db, "DELETE FROM app_settings WHERE name = 'builtinTracks'")
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM app_settings WHERE name = 'builtinTracks'") })
	ctx := context.Background()
	st := store.New(db)
	initial, err := st.BuiltinTrackSettings(ctx)
	if err != nil || initial.DisabledTrackIDs == nil || len(initial.DisabledTrackIDs) != 0 || initial.UpdatedAt != 0 {
		t.Fatalf("defaults %+v %v", initial, err)
	}
	const edits = 16
	errors := make(chan error, edits)
	var wg sync.WaitGroup
	for i := range edits {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := st.SetBuiltinTracksEnabled(ctx, []string{fmt.Sprintf("track_%d", i), fmt.Sprintf("alias_%d", i)}, false, "test-admin", 100)
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
	reloaded, err := store.New(db).BuiltinTrackSettings(ctx)
	if err != nil || len(reloaded.DisabledTrackIDs) != edits*2 || reloaded.UpdatedAt < 100 || reloaded.UpdatedBy != "test-admin" {
		t.Fatalf("concurrent persistent result %+v %v", reloaded, err)
	}
	for i := range edits {
		if !slices.Contains(reloaded.DisabledTrackIDs, fmt.Sprintf("track_%d", i)) {
			t.Fatalf("lost edit %d", i)
		}
	}
	updated, err := st.SetBuiltinTracksEnabled(ctx, []string{"track_0", "alias_0"}, true, "next-admin", 100)
	if err != nil || len(updated.DisabledTrackIDs) != edits*2-2 || slices.Contains(updated.DisabledTrackIDs, "alias_0") || updated.UpdatedAt <= reloaded.UpdatedAt {
		t.Fatalf("reenable %+v %v", updated, err)
	}
	if _, err := st.SetBuiltinTracksEnabled(ctx, []string{"bad id"}, false, "admin", 1); err == nil {
		t.Fatal("invalid ID accepted")
	}
}
