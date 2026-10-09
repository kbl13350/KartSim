package store_test

import (
	"context"
	"fmt"
	"testing"

	"kartsim/internal/data/career"
	"kartsim/internal/data/datatest"
	"kartsim/internal/data/store"
)

func TestSchemaMyRoomTables(t *testing.T) {
	db := datatest.MySQL(t)
	for _, table := range []string{"account_counters", "account_login_days", "account_careers", "account_emblems"} {
		var n int
		if err := db.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
			table).Scan(&n); err != nil || n != 1 {
			t.Fatalf("table %s: %d, %v", table, n, err)
		}
	}
}

func elapsed(ms int) *int { return &ms }

func TestCareerRaceCounters(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, _ := messengerAccounts(t, db, 3)
	u := datatest.Unique()
	race := func(n int, team, infinite bool, winning int, results ...store.SettledResult) {
		t.Helper()
		_, _, err := st.SaveSettlement(ctx, store.Settlement{RaceID: fmt.Sprintf("career-%s-%d", u, n),
			RoomID: "room-" + u, Gameplay: "ordinary", TrackID: "forest_I01", Snapshot: "{}", CreatedAt: 1000 + int64(n),
			Team: team, Infinite: infinite, WinningTeam: winning, Results: results})
		if err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() { datatest.Exec(t, db, "DELETE FROM race_outcomes WHERE race_id LIKE ?", "career-"+u+"-%") })
	race(1, false, false, 0,
		store.SettledResult{PlayerID: "p0", AccountID: ids[0], Name: "a", Rank: 1, ElapsedMs: elapsed(90_000),
			DistanceMeters: 4_200, Camera: true},
		store.SettledResult{PlayerID: "p1", AccountID: ids[1], Name: "b", Rank: 2, DistanceMeters: 1_000})
	race(2, true, true, 2,
		store.SettledResult{PlayerID: "p0", AccountID: ids[0], Name: "a", Rank: 2, ElapsedMs: elapsed(91_000), Team: 1},
		store.SettledResult{PlayerID: "p1", AccountID: ids[1], Name: "b", Rank: 3, Team: 2},
		store.SettledResult{PlayerID: "p2", AccountID: ids[2], Name: "c", Rank: 1, ElapsedMs: elapsed(89_000), Team: 2})
	// A repeated settlement counts nothing.
	race(2, true, true, 2,
		store.SettledResult{PlayerID: "p0", AccountID: ids[0], Name: "a", Rank: 2, ElapsedMs: elapsed(91_000), Team: 1})

	facts := func(id string) career.Facts {
		t.Helper()
		f, err := st.CareerFacts(ctx, id, 10_000)
		if err != nil {
			t.Fatal(err)
		}
		return f
	}
	forest := 1
	a, b, c := facts(ids[0]), facts(ids[1]), facts(ids[2])
	want := map[string]int64{
		career.RaceCounter(career.RaceWin, career.GameSpeedIndividual, forest):    1,
		career.RaceCounter(career.RaceFinish, career.GameSpeedIndividual, forest): 1,
		career.RaceCounter(career.RaceFinish, career.GameInfiniteTeam, forest):    1,
		career.CounterRetireStreak: 0,
		career.RaceCounter(career.RaceDistance, career.GameSpeedIndividual, forest): 4_200,
		career.CounterCameraDistance: 4_200,
	}
	for name, value := range want {
		if a.Counters[name] != value {
			t.Errorf("a %s = %d, want %d (all %v)", name, a.Counters[name], value, a.Counters)
		}
	}
	if a.Counters[career.RaceCounter(career.RaceWin, career.GameInfiniteTeam, forest)] != 0 {
		t.Errorf("a won a team race its team lost: %v", a.Counters)
	}
	// b retired twice in a row; its team won the second race.
	if b.Counters[career.RaceCounter(career.RaceRetire, career.GameSpeedIndividual, forest)] != 1 ||
		b.Counters[career.RaceCounter(career.RaceWin, career.GameInfiniteTeam, forest)] != 1 ||
		b.Counters[career.CounterRetireStreak] != 2 || b.Counters[career.CounterRetireStreakMax] != 2 {
		t.Errorf("b counters %v", b.Counters)
	}
	if b.Counters[career.RaceCounter(career.RaceDistance, career.GameSpeedIndividual, forest)] != 1_000 ||
		b.Counters[career.CounterCameraDistance] != 0 {
		t.Errorf("b distance counters %v", b.Counters)
	}
	if c.Counters[career.RaceCounter(career.RaceWin, career.GameInfiniteTeam, forest)] != 1 {
		t.Errorf("c counters %v", c.Counters)
	}
}

func TestCompleteCareerAndEmblems(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	data, err := career.Default()
	if err != nil {
		t.Fatal(err)
	}
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	// 1 萌新驾到 (RP >= 0) is complete at once; 2 needs RP and career 1.
	if _, err := st.CompleteCareer(ctx, data, id, 2, 5000); err == nil {
		t.Fatal("career 2 completed before career 1")
	} else {
		expectCode(t, err, "CAREER_NOT_COMPLETE")
	}
	done, err := st.CompleteCareer(ctx, data, id, 1, 5000)
	if err != nil {
		t.Fatal(err)
	}
	if done.Career.State != career.StateRewarded || done.Point != 5 || done.Points != 5 {
		t.Fatalf("completion %+v", done)
	}
	_, err = st.CompleteCareer(ctx, data, id, 1, 5001)
	expectCode(t, err, "CAREER_ALREADY_COMPLETED")
	_, err = st.CompleteCareer(ctx, data, id, 999_999, 5001)
	expectCode(t, err, "UNKNOWN_CAREER")

	// An emblem career: 123 首次获得徽章！ needs one emblem.
	emblemCareer, _ := data.Career(123)
	granted, err := st.GrantEmblem(ctx, id, 8196, "test", 0, 6000)
	if err != nil || !granted {
		t.Fatalf("grant %v %v", granted, err)
	}
	if again, err := st.GrantEmblem(ctx, id, 8196, "test", 0, 6001); err != nil || again {
		t.Fatalf("second grant %v %v", again, err)
	}
	if emblemCareer.Pre != 0 {
		t.Fatalf("career 123 has a prerequisite %d", emblemCareer.Pre)
	}
	if _, err := st.CompleteCareer(ctx, data, id, 123, 6002); err != nil {
		t.Fatal(err)
	}
	recent, err := st.RecentCareers(ctx, id, 5)
	if err != nil || len(recent) != 2 || recent[0].ID != 123 || recent[1].ID != 1 {
		t.Fatalf("recent %v %v", recent, err)
	}

	// A career that rewards an emblem grants it: 1291 星座徽章收藏家 needs
	// the listed constellation emblems and rewards 8805.
	collector, ok := data.Career(1291)
	if !ok || collector.Type != 60 || collector.Pre != 0 || collector.Emblem == 0 {
		t.Fatalf("career 1291 = %+v", collector)
	}
	for _, emblem := range collector.Emblems {
		if _, err := st.GrantEmblem(ctx, id, emblem, "test", 0, 6100); err != nil {
			t.Fatal(err)
		}
	}
	done, err = st.CompleteCareer(ctx, data, id, collector.ID, 6200)
	if err != nil || done.Emblem != collector.Emblem || done.Career.State != career.StateRewarded {
		t.Fatalf("emblem career %+v %v", done, err)
	}

	// Representative emblems follow the original slot rules.
	expectCode(t, st.SetMainEmblems(ctx, id, [2]int{0, 8196}), "INVALID_MAIN_EMBLEMS")
	expectCode(t, st.SetMainEmblems(ctx, id, [2]int{8196, 8196}), "INVALID_MAIN_EMBLEMS")
	expectCode(t, st.SetMainEmblems(ctx, id, [2]int{30013, 0}), "EMBLEM_NOT_OWNED")
	if err := st.SetMainEmblems(ctx, id, [2]int{8196, 0}); err != nil {
		t.Fatal(err)
	}
	emblems, main, err := st.Emblems(ctx, id)
	if err != nil || main != [2]int{8196, 0} || len(emblems) == 0 {
		t.Fatalf("emblems %v main %v %v", emblems, main, err)
	}
	facts, err := st.CareerFacts(ctx, id, 7000)
	if err != nil || facts.MainEmblems != 1 || !facts.Emblems[8196] {
		t.Fatalf("facts %+v %v", facts, err)
	}
	if err := st.SetMainEmblems(ctx, id, [2]int{0, 0}); err != nil {
		t.Fatal(err)
	}
	if _, main, _ := st.Emblems(ctx, id); main != [2]int{0, 0} {
		t.Fatalf("cleared main %v", main)
	}
}

func TestCareerFactsLoginAndInventory(t *testing.T) {
	db := datatest.MySQL(t)
	st := store.New(db)
	ctx := context.Background()
	ids, _ := messengerAccounts(t, db, 1)
	id := ids[0]
	if err := st.RecordLoginDay(ctx, id, "2026-03-17"); err != nil {
		t.Fatal(err)
	}
	if err := st.RecordLoginDay(ctx, id, "2026-03-17"); err != nil {
		t.Fatal(err)
	}
	datatest.Exec(t, db, `INSERT INTO inventory_items(account_id, category, item_id, system_key, expires_at, source,
		created_at, updated_at) VALUES(?, 3, 10, '', NULL, 'test', 0, 0), (?, 3, 11, '', 100, 'test', 0, 0),
		(?, 1, 2, '', NULL, 'test', 0, 0)`, id, id, id)
	f, err := st.CareerFacts(ctx, id, 2*86_400_000+5)
	if err != nil {
		t.Fatal(err)
	}
	if !f.LoginDates["03-17"] || f.RegisteredDays != 2 {
		t.Fatalf("login facts %v %d", f.LoginDates, f.RegisteredDays)
	}
	if len(f.Collected[3]) != 2 || len(f.Owned[3]) != 1 || !f.Owned[3][10] || len(f.Collected[1]) != 1 {
		t.Fatalf("inventory facts collected %v owned %v", f.Collected, f.Owned)
	}
}
