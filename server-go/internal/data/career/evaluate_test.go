package career

import "testing"

func defaultData(t *testing.T) *Data {
	t.Helper()
	data, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func mustCareer(t *testing.T, data *Data, id int) *Career {
	t.Helper()
	c, ok := data.Career(id)
	if !ok {
		t.Fatalf("career %d missing", id)
	}
	return c
}

func emptyFacts() Facts {
	return Facts{LoginDates: map[string]bool{}, Collected: map[int]map[int]bool{},
		Owned: map[int]map[int]bool{}, Emblems: map[int]bool{}, Counters: map[string]int64{},
		Rewarded: map[int]bool{}}
}

func TestEmbeddedTable(t *testing.T) {
	data := defaultData(t)
	if len(data.Careers) != 1198 || len(data.EmblemIDs) != 487 {
		t.Fatalf("careers %d emblems %d", len(data.Careers), len(data.EmblemIDs))
	}
	// 1293 is repeated in newCareer@cn.xml; the kept row has its item list.
	if c := mustCareer(t, data, 1293); c.ItemCat != 52 || len(c.Items) != 12 {
		t.Fatalf("career 1293 = %+v", c)
	}
	if c := mustCareer(t, data, 863); c.Type != 49 || len(c.Multi) != 3 || c.Emblem != 8643 {
		t.Fatalf("career 863 = %+v", c)
	}
	if c := mustCareer(t, data, 24); c.Date != "03-17" {
		t.Fatalf("career 24 date %q", c.Date)
	}
}

func TestThemeOf(t *testing.T) {
	data := defaultData(t)
	for track, want := range map[string]int{"forest_I01": 1, "forest_I01_rvs": 1, "village_R01": 3,
		"northeu_I04_rvs": 7, "steam_I01": 22, "moonhill_R06": 11, "unknown_X": 0, "fengshen_Z99": 35} {
		if got := data.ThemeOf(track); got != want {
			t.Errorf("ThemeOf(%s) = %d, want %d", track, got, want)
		}
	}
}

func TestRaceGameType(t *testing.T) {
	cases := []struct {
		team, infinite bool
		want           int
	}{{false, false, 1}, {true, false, 3}, {false, true, 9}, {true, true, 10}}
	for _, c := range cases {
		if got := RaceGameType(c.team, c.infinite); got != c.want {
			t.Errorf("RaceGameType(%v, %v) = %d", c.team, c.infinite, got)
		}
	}
}

func TestEvaluateStatesAndChains(t *testing.T) {
	data := defaultData(t)
	f := emptyFacts()
	// 1 萌新驾到: RP >= 0, done at once; 2 needs 39782 RP and career 1.
	first, second := mustCareer(t, data, 1), mustCareer(t, data, 2)
	if p := data.Progress(first, f); p.State != StateComplete || p.Locked {
		t.Fatalf("career 1 = %+v", p)
	}
	if p := data.Progress(second, f); !p.Locked || p.State != StatePlaying {
		t.Fatalf("career 2 before 1 = %+v", p)
	}
	f.Rewarded[1] = true
	f.Exp = 39_781
	if p := data.Progress(second, f); p.Locked || p.State != StatePlaying || p.Value != 39_781 {
		t.Fatalf("career 2 short of RP = %+v", p)
	}
	f.Exp = 39_782
	if p := data.Progress(second, f); p.State != StateComplete {
		t.Fatalf("career 2 reached = %+v", p)
	}
	if p := data.Progress(first, f); p.State != StateRewarded {
		t.Fatalf("career 1 rewarded = %+v", p)
	}
	if got := data.Points(f.Rewarded); got != first.Point {
		t.Fatalf("points %d", got)
	}
}

func TestRaceCounters(t *testing.T) {
	data := defaultData(t)
	var themed *Career
	for i := range data.Careers {
		c := &data.Careers[i]
		if c.Type == 40 && c.Theme == 1 && c.GameType == 0 && c.Pre == 0 {
			themed = c
			break
		}
	}
	if themed == nil {
		t.Fatal("no first-stage forest win career")
	}
	f := emptyFacts()
	f.Counters[RaceCounter(RaceWin, GameSpeedIndividual, 1)] = themed.Clear - 1
	f.Counters[RaceCounter(RaceWin, GameSpeedTeam, 2)] = 100 // another theme
	if p := data.Progress(themed, f); p.Value != themed.Clear-1 || p.State != StatePlaying {
		t.Fatalf("forest wins = %+v", p)
	}
	f.Counters[RaceCounter(RaceWin, GameInfiniteTeam, 1)] = 1
	if p := data.Progress(themed, f); p.State != StateComplete {
		t.Fatalf("forest wins reached = %+v", p)
	}
	speedOnly := &Career{Type: 42, GameType: 5, Clear: 2}
	f.Counters[RaceCounter(RaceFinish, GameSpeedIndividual, 0)] = 1
	f.Counters[RaceCounter(RaceFinish, GameInfiniteIndividual, 3)] = 5
	if value, _ := data.Value(speedOnly, f); value != 1 {
		t.Fatalf("speed-all finishes %d", value)
	}
	itemOnly := &Career{Type: 42, GameType: 2, Clear: 1}
	if value, tracked := data.Value(itemOnly, f); value != 0 || !tracked {
		t.Fatalf("item finishes %d %v", value, tracked)
	}
}

func TestCollectionsEmblemsAndMulti(t *testing.T) {
	data := defaultData(t)
	f := emptyFacts()
	f.Collected[3] = map[int]bool{1: true, 2: true}
	f.Collected[1] = map[int]bool{5: true}
	if value, _ := data.Value(&Career{Type: 13}, f); value != 2 {
		t.Fatalf("karts collected %d", value)
	}
	if value, _ := data.Value(&Career{Type: 12}, f); value != 3 {
		t.Fatalf("all collected %d", value)
	}
	c1293 := mustCareer(t, data, 1293)
	f.Owned[52] = map[int]bool{102: true, 103: true, 999: true}
	if value, _ := data.Value(c1293, f); value != 2 {
		t.Fatalf("constellation pets %d", value)
	}
	f.Emblems = map[int]bool{8806: true, 8807: true}
	if value, _ := data.Value(&Career{Type: 24}, f); value != 2 {
		t.Fatalf("emblem count %d", value)
	}
	multi := mustCareer(t, data, 863)
	f.Rewarded[multi.Multi[0]] = true
	if p := data.Progress(multi, f); p.Value != 1 || p.State == StateComplete {
		t.Fatalf("multi one of three = %+v", p)
	}
	for _, id := range multi.Multi {
		f.Rewarded[id] = true
	}
	if multi.Pre != 0 {
		f.Rewarded[multi.Pre] = true
	}
	if p := data.Progress(multi, f); p.State != StateComplete {
		t.Fatalf("multi all = %+v", p)
	}
}

func TestLucciZeroDateAndUntracked(t *testing.T) {
	data := defaultData(t)
	f := emptyFacts()
	broke := mustCareer(t, data, 1136)
	f.Lucci = 5
	if data.Reached(broke, f) {
		t.Fatal("lucci-zero career reached with lucci")
	}
	f.Lucci = 0
	if !data.Reached(broke, f) {
		t.Fatal("lucci-zero career not reached at 0")
	}
	birthday := mustCareer(t, data, 24)
	if data.Reached(birthday, f) {
		t.Fatal("date career reached without a sign-in")
	}
	f.LoginDates["03-17"] = true
	if !data.Reached(birthday, f) {
		t.Fatal("date career not reached")
	}
	vip := mustCareer(t, data, 33) // VIP 等级: no such system here
	if p := data.Progress(vip, f); !p.Untracked || p.State != StatePlaying {
		t.Fatalf("untracked career = %+v", p)
	}
}
