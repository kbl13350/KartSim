package itemmode

import (
	"errors"
	"math/rand/v2"
	"slices"
	"testing"
)

// teamRace is a 组队道具赛 of a1, a2 (team 1) and b1, b2 (team 2).
func teamRace(t *testing.T, random Random) *Race {
	t.Helper()
	r, err := NewRace(defaultData(t), TableTeam, []Member{{"a1", 1}, {"b1", 2}, {"a2", 1}, {"b2", 2}}, random)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

// soloRace is a 道具个人赛 of p1..p4.
func soloRace(t *testing.T, random Random) *Race {
	t.Helper()
	r, err := NewRace(defaultData(t), TableIndividual, []Member{{"p1", 0}, {"p2", 0}, {"p3", 0}, {"p4", 0}}, random)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

// order returns standings with racers placed in the given order, 100 m
// apart (the first leads).
func order(placed ...string) []Racer {
	racers := make([]Racer, len(placed))
	for i, id := range placed {
		racers[i] = Racer{ID: id, Distance: float64(1000 - 100*i)}
	}
	return Standings(racers)
}

// give puts items into a racer's slots.
func give(r *Race, id string, items ...int) {
	for _, idx := range items {
		r.racers[id].slots.Add(idx)
	}
}

func wantErr(t *testing.T, err, want error) {
	t.Helper()
	if !errors.Is(err, want) {
		t.Fatalf("error %v, want %v", err, want)
	}
}

func TestNewRaceNeedsATable(t *testing.T) {
	if _, err := NewRace(defaultData(t), "duo", nil, nil); err == nil {
		t.Fatal("unknown table accepted")
	}
	if teamRace(t, nil).TableKind() != TableTeam || soloRace(t, nil).TableKind() != TableIndividual {
		t.Fatal("table kinds")
	}
}

func TestCubeDrawsByRankGroup(t *testing.T) {
	random := &picks{values: []int{0, 99, 70}}
	r := soloRace(t, random)
	standings := order("p1", "p2", "p3", "p4")
	// The leader draws from top: pick 0 is the banana.
	grant, notices, err := r.Cube("p1", 7, 2, 1_000, standings)
	if err != nil || grant.ItemID != Banana || grant.Reason != "" || grant.CubeID != 7 ||
		!slices.Equal(grant.Slots, []int{Banana, Empty}) || notices != nil {
		t.Fatalf("leader grant %+v %v %v", grant, notices, err)
	}
	// 4th of 4 is low: pick 99 is the last low item, the magnet.
	if grant, _, _ := r.Cube("p4", 7, 2, 1_000, standings); grant.ItemID != Magnet {
		t.Fatalf("last place got %d", grant.ItemID)
	}
	// 3rd of 4 is mid: pick 70 lands on the booster (mid 24 at 61..84).
	if grant, _, _ := r.Cube("p3", 7, 2, 1_000, standings); grant.ItemID != Booster {
		t.Fatalf("3rd got %d", grant.ItemID)
	}
	if !slices.Equal(random.asked, []int{100, 100, 100}) {
		t.Fatalf("draws %v", random.asked)
	}
}

func TestCubeCapacityIsFixedByTheFirstReport(t *testing.T) {
	r := soloRace(t, rand.New(rand.NewPCG(3, 4)))
	standings := order("p1", "p2")
	grant, _, _ := r.Cube("p2", 1, 9, 0, standings)
	if len(grant.Slots) != 3 {
		t.Fatalf("capacity %v", grant.Slots)
	}
	grant, _, _ = r.Cube("p2", 2, 2, 0, standings)
	grant, _, _ = r.Cube("p2", 3, 2, 0, standings)
	if len(grant.Slots) != 3 || grant.Reason != "" || slices.Contains(grant.Slots, Empty) {
		t.Fatalf("third slot %+v", grant)
	}
	grant, _, _ = r.Cube("p2", 4, 3, 0, standings)
	if grant.Reason != ReasonFull || grant.ItemID != NoItem {
		t.Fatalf("full grant %+v", grant)
	}
	other, _, _ := r.Cube("p1", 1, 1, 0, standings)
	if len(other.Slots) != 2 {
		t.Fatalf("clamped capacity %v", other.Slots)
	}
}

func TestCubeAbuse(t *testing.T) {
	random := rand.New(rand.NewPCG(5, 6))
	r := soloRace(t, random)
	standings := order("p1", "p2")
	r.Cube("p1", 5, 3, 0, standings)
	if grant, _, _ := r.Cube("p1", 5, 3, 9_999, standings); grant.Reason != ReasonAbusing || grant.ItemID != NoItem {
		t.Fatalf("same cube again %+v", grant)
	}
	// The abusing pickup counts as the latest eat of that cube.
	if grant, _, _ := r.Cube("p1", 5, 3, 19_000, standings); grant.Reason != ReasonAbusing {
		t.Fatalf("camping %+v", grant)
	}
	if grant, _, _ := r.Cube("p1", 5, 3, 29_000, standings); grant.Reason != "" || grant.ItemID == NoItem {
		t.Fatalf("after 10 s %+v", grant)
	}
	// Another cube in between clears it; abuse wins over full slots.
	r.Cube("p2", 1, 2, 0, standings)
	r.Cube("p2", 2, 2, 0, standings)
	if grant, _, _ := r.Cube("p2", 2, 2, 1, standings); grant.Reason != ReasonAbusing {
		t.Fatalf("full and abusing %+v", grant)
	}
	if grant, _, _ := r.Cube("p2", 1, 2, 2, standings); grant.Reason != ReasonFull {
		t.Fatalf("other cube while full %+v", grant)
	}
}

func TestTestCubeGrantsTheNamedItem(t *testing.T) {
	random := &picks{}
	r := soloRace(t, random)
	standings := order("p1", "p2", "p3", "p4")
	// The leader cannot draw a rocket, but a test grant gives it; nothing is drawn.
	grant, _, err := r.TestCube("p1", 1, 2, Rocket, 0, standings)
	if err != nil || grant.ItemID != Rocket || grant.Reason != "" || !slices.Equal(grant.Slots, []int{Rocket, Empty}) ||
		len(random.asked) != 0 {
		t.Fatalf("test grant %+v %v (asked %v)", grant, err, random.asked)
	}
	// The abuse and full-slot rules still apply.
	if grant, _, _ := r.TestCube("p1", 1, 2, Devil, 1, standings); grant.Reason != ReasonAbusing || grant.ItemID != NoItem {
		t.Fatalf("same cube again %+v", grant)
	}
	r.TestCube("p1", 2, 2, Devil, 2, standings)
	if grant, _, _ := r.TestCube("p1", 3, 2, Devil, 3, standings); grant.Reason != ReasonFull ||
		!slices.Equal(grant.Slots, []int{Rocket, Devil}) {
		t.Fatalf("full %+v", grant)
	}
	// Only items of the race's table: the individual table has no slot lock.
	_, _, err = r.TestCube("p2", 1, 2, SlotLock, 0, standings)
	wantErr(t, err, ErrInvalidTestItem)
	_, _, err = r.TestCube("p2", 1, 2, Mine, 0, standings)
	wantErr(t, err, ErrInvalidTestItem)
	// Caps do not stop test grants, but test grants count toward them.
	team := teamRace(t, &picks{})
	teamStandings := order("b1", "b2", "a1", "a2")
	for i := range 3 {
		if grant, _, _ := team.TestCube("a1", i+1, 3, Angel, int64(i), teamStandings); grant.ItemID != Angel {
			t.Fatalf("test angel %d: %+v", i, grant)
		}
		team.racers["a1"].slots.TakeFirst()
	}
	if team.racers["a1"].obtained[Angel] != 3 {
		t.Fatalf("obtained %v", team.racers["a1"].obtained)
	}
}

func TestCubeRejectsFinishedAndUnknownRacers(t *testing.T) {
	r := soloRace(t, &picks{})
	standings := Standings([]Racer{{ID: "p1", FinishOrder: 1}, {ID: "p2", Distance: 5}})
	_, _, err := r.Cube("p1", 1, 2, 0, standings)
	wantErr(t, err, ErrInvalidUse)
	_, _, err = r.Cube("p3", 1, 2, 0, standings) // not in the standings
	wantErr(t, err, ErrInvalidUse)
	_, _, err = r.Cube("p2", MaxCubeID+1, 2, 0, standings)
	wantErr(t, err, ErrInvalidUse)
	// p2 is 2nd of 2 behind a finisher: high.
	r2 := soloRace(t, &picks{values: []int{0}})
	if grant, _, _ := r2.Cube("p2", 1, 2, 0, standings); grant.ItemID != Shield {
		t.Fatalf("2nd behind a finisher got %d", grant.ItemID)
	}
}

func TestCappedItemsAreRedrawn(t *testing.T) {
	// The team table's mid group: angel is at 92..94 of 100.
	random := &picks{}
	r := teamRace(t, random)
	standings := order("b1", "b2", "a1", "a2")
	team := r.table
	angelAt := 0
	for _, e := range team.Entries {
		if e.Idx == Angel {
			break
		}
		angelAt += e.Mid
	}
	for i := range 2 {
		random.values = []int{angelAt}
		grant, _, _ := r.Cube("a1", i+1, 3, int64(i), standings)
		if grant.ItemID != Angel {
			t.Fatalf("draw %d got %d", i, grant.ItemID)
		}
		r.racers["a1"].slots.TakeFirst()
	}
	random.values = []int{angelAt}
	random.asked = nil
	grant, _, _ := r.Cube("a1", 3, 3, 2, standings)
	if grant.ItemID == Angel || random.asked[0] != 97 {
		t.Fatalf("third angel: got %d from %v", grant.ItemID, random.asked)
	}
	// Another racer still gets angels.
	random.values = []int{angelAt}
	if grant, _, _ := r.Cube("a2", 1, 3, 3, order("b1", "b2", "a2", "a1")); grant.ItemID != Angel {
		t.Fatalf("a2 got %d", grant.ItemID)
	}
}

func TestUseTargets(t *testing.T) {
	// Standings: b1, a1, b2, a2 (a = team 1).
	standings := order("b1", "a1", "b2", "a2")
	cases := []struct {
		user   string
		item   int
		aimed  string
		random []int
		want   []string
	}{
		{"a2", WaterFly, "", nil, []string{"b2"}},          // directly ahead, teammate a1 skipped
		{"b1", WaterFly, "", nil, []string{}},              // the leader has nobody ahead
		{"a2", GuideRocket, "", nil, []string{"b1"}},       // leading opponent
		{"b1", UFO, "", nil, []string{"a1"}},               // the leader's leading opponent
		{"a2", Barricade, "", nil, []string{"b1"}},         //
		{"a2", RandomRocket, "", []int{1}, []string{"b2"}}, // b1, b2 ahead
		{"b1", RandomRocket, "", nil, []string{}},          //
		{"a2", Thunderbolt, "", nil, []string{"b1", "b2"}}, // all opponents ahead
		{"a1", Cloud, "", nil, []string{"b2"}},             // all opponents behind
		{"b2", Devil, "", nil, []string{"a1", "a2"}},       // all opponents
		{"b2", SlotLock, "", nil, []string{"a1", "a2"}},    //
		{"a2", Angel, "", nil, []string{"a2", "a1"}},       // own team, user first
		{"a1", Scanning, "", nil, []string{"a1", "a2"}},    //
		{"a1", Booster, "", nil, []string{"a1"}},           // self
		{"a1", Shield, "", nil, []string{"a1"}},            //
		{"a1", EMP, "", nil, []string{"a1"}},               //
		{"a1", Rocket, "b2", nil, []string{"b2"}},          // aimed
		{"a1", Rocket, "", nil, []string{}},                // misfire
		{"a1", Magnet, "b1", nil, []string{"b1"}},          //
		{"a1", Banana, "", nil, []string{}},                // area
		{"a1", WaterBomb, "", nil, []string{}},             //
		{"a1", TimeBomb, "", nil, []string{}},              //
	}
	for _, c := range cases {
		r := teamRace(t, &picks{values: c.random})
		give(r, c.user, c.item)
		result, err := r.UseItem(UseRequest{PlayerID: c.user, ItemID: c.item, TargetID: c.aimed,
			Point: &Point{1, 2, 3}, Now: 50, Standings: standings})
		if err != nil {
			t.Fatalf("%s uses %d: %v", c.user, c.item, err)
		}
		if result.Use.Targets == nil || !slices.Equal(result.Use.Targets, c.want) {
			t.Errorf("%s uses %d: targets %v, want %v", c.user, c.item, result.Use.Targets, c.want)
		}
	}
	// Individual: everyone else is an opponent.
	r := soloRace(t, nil)
	give(r, "p3", Thunderbolt)
	result, _ := r.UseItem(UseRequest{PlayerID: "p3", ItemID: Thunderbolt, Now: 1,
		Standings: order("p1", "p2", "p3", "p4")})
	if !slices.Equal(result.Use.Targets, []string{"p1", "p2"}) {
		t.Fatalf("solo thunderbolt %v", result.Use.Targets)
	}
}

func TestUseChecks(t *testing.T) {
	standings := Standings([]Racer{{ID: "a1", Distance: 500}, {ID: "b1", Distance: 400},
		{ID: "a2", FinishOrder: 1}, {ID: "b2", Distance: 10}})
	r := teamRace(t, nil)
	use := func(user string, item int, aimed string, point *Point) (UseResult, error) {
		return r.UseItem(UseRequest{PlayerID: user, ItemID: item, TargetID: aimed, Point: point,
			Now: 100, Standings: standings})
	}
	_, err := use("a1", Rocket, "", nil)
	wantErr(t, err, ErrNotHeld)
	give(r, "a1", Banana, Rocket)
	_, err = use("a1", Rocket, "", nil) // slot 0 is the banana
	wantErr(t, err, ErrNotHeld)
	_, err = use("a1", Banana, "", nil)
	wantErr(t, err, ErrInvalidPoint)
	result, err := use("a1", Banana, "", &Point{1, 2, 3})
	if err != nil || !slices.Equal(result.Slots, []int{Rocket, Empty}) || *result.Use.Point != (Point{1, 2, 3}) ||
		result.Use.ID != 1 || result.Use.StartAt != 100 {
		t.Fatalf("banana %+v %v", result, err)
	}
	for _, aimed := range []string{"a1", "a2", "b2x", "a3"} {
		_, err = use("a1", Rocket, aimed, nil) // self, teammate, unknown
		wantErr(t, err, ErrInvalidTarget)
	}
	finished := Standings([]Racer{{ID: "a1", Distance: 500}, {ID: "b1", FinishOrder: 1}})
	_, err = r.UseItem(UseRequest{PlayerID: "a1", ItemID: Rocket, TargetID: "b1", Now: 100, Standings: finished})
	wantErr(t, err, ErrInvalidTarget) // a finished racer is no target
	if r.Slots("a1")[0] != Rocket {
		t.Fatal("a rejected use took the item")
	}
	give(r, "a2", Booster)
	_, err = use("a2", Booster, "", nil) // a2 has finished
	wantErr(t, err, ErrInvalidUse)
	if second, _ := use("a1", Rocket, "b1", nil); second.Use.ID != 2 {
		t.Fatalf("use IDs %d", second.Use.ID)
	}
}

func TestEtaFromRouteGap(t *testing.T) {
	r := soloRace(t, &picks{values: []int{0}})
	standings := Standings([]Racer{{ID: "p1", Distance: 2000}, {ID: "p2", Distance: 1940},
		{ID: "p3", Distance: 1890}, {ID: "p4", Distance: 10}})
	cases := []struct {
		user, aimed string
		item, want  int
	}{
		{"p3", "", WaterFly, 833},     // 50 m to p2 at 60 m/s
		{"p3", "", GuideRocket, 1100}, // 110 m to p1 at 100 m/s
		{"p4", "", UFO, 1500},         // capped at the UFO's Use 1500
		{"p2", "", WaterFly, 1000},    // 60 m
		{"p2", "p1", Rocket, 600},     // aimed
		{"p4", "", RandomRocket, 1500},
		{"p1", "", WaterFly, 0}, // no target
		{"p1", "", Devil, 0},    // not tracking
	}
	for _, c := range cases {
		give(r, c.user, c.item)
		result, err := r.UseItem(UseRequest{PlayerID: c.user, ItemID: c.item, TargetID: c.aimed,
			Now: 1, Standings: standings})
		if err != nil || result.Use.EtaMs != c.want {
			t.Errorf("%s uses %d: eta %d, want %d (%v)", c.user, c.item, result.Use.EtaMs, c.want, err)
		}
	}
}

func TestSlotLock(t *testing.T) {
	r := teamRace(t, nil)
	standings := order("b1", "a1", "b2", "a2")
	give(r, "b1", SlotLock)
	if _, err := r.UseItem(UseRequest{PlayerID: "b1", ItemID: SlotLock, Now: 1_000, Standings: standings}); err != nil {
		t.Fatal(err)
	}
	// Use 2000, then locked for Affect 1000 + Postaffect 2000.
	give(r, "a1", Rocket, Angel)
	give(r, "b2", Booster)
	use := func(id string, item int, now int64) error {
		_, err := r.UseItem(UseRequest{PlayerID: id, ItemID: item, Now: now, Standings: standings})
		return err
	}
	if r.Locked("a1", 2_999) || !r.Locked("a1", 3_000) || !r.Locked("a2", 5_999) || r.Locked("a1", 6_000) {
		t.Fatal("lock window")
	}
	wantErr(t, use("a1", Rocket, 3_000), ErrLocked)
	if r.Slots("a1")[0] != Rocket {
		t.Fatal("locked use took the item")
	}
	if err := use("b2", Booster, 3_000); err != nil { // the user's team is not locked
		t.Fatal(err)
	}
	r.Swap("a1", 3_000, standings)
	if err := use("a1", Angel, 3_500); err != nil { // the angel works under a lock
		t.Fatal(err)
	}
	if err := use("a1", Rocket, 6_000); err != nil {
		t.Fatal(err)
	}
}

func TestScanShowsOpponentSlotsToTheTeam(t *testing.T) {
	random := &picks{}
	r := teamRace(t, random)
	standings := order("b1", "a1", "b2", "a2")
	give(r, "b1", Shield, Banana)
	give(r, "a1", Scanning)
	result, err := r.UseItem(UseRequest{PlayerID: "a1", ItemID: Scanning, Now: 10_000, Standings: standings})
	if err != nil {
		t.Fatal(err)
	}
	want := []ScanNotice{
		{Viewer: "a1", Subject: "b1", Slots: []int{Shield, Banana}, Until: 18_000},
		{Viewer: "a1", Subject: "b2", Slots: []int{Empty, Empty}, Until: 18_000},
		{Viewer: "a2", Subject: "b1", Slots: []int{Shield, Banana}, Until: 18_000},
		{Viewer: "a2", Subject: "b2", Slots: []int{Empty, Empty}, Until: 18_000},
	}
	if !slices.EqualFunc(result.Notices, want, sameNotice) {
		t.Fatalf("scan snapshot %+v", result.Notices)
	}
	// An opponent's slot change reaches the scanning team while it lasts.
	_, notices, _ := r.Cube("b2", 1, 2, 12_000, standings)
	if len(notices) != 2 || notices[0].Viewer != "a1" || notices[1].Viewer != "a2" ||
		notices[0].Subject != "b2" || notices[0].Slots[0] == Empty {
		t.Fatalf("grant notices %+v", notices)
	}
	if _, notices, _ := r.Swap("b1", 13_000, standings); len(notices) != 2 ||
		!slices.Equal(notices[0].Slots, []int{Banana, Shield}) {
		t.Fatalf("swap notices %+v", notices)
	}
	// Teammates' changes and changes after the scan send nothing.
	if _, notices, _ := r.Cube("a2", 1, 2, 14_000, standings); notices != nil {
		t.Fatalf("teammate notices %+v", notices)
	}
	if _, notices, _ := r.Cube("b2", 2, 2, 18_000, standings); notices != nil {
		t.Fatalf("expired scan %+v", notices)
	}
}

func sameNotice(a, b ScanNotice) bool {
	return a.Viewer == b.Viewer && a.Subject == b.Subject && a.Until == b.Until && slices.Equal(a.Slots, b.Slots)
}

func TestPlace(t *testing.T) {
	r := teamRace(t, nil)
	standings := order("b1", "a1", "b2", "a2")
	r.racers["a2"].slots.SetCapacity(3)
	give(r, "a2", Barricade, TimeBomb, Booster)
	barricade, _ := r.UseItem(UseRequest{PlayerID: "a2", ItemID: Barricade, Now: 0, Standings: standings})
	timeBomb, _ := r.UseItem(UseRequest{PlayerID: "a2", ItemID: TimeBomb, Now: 0, Standings: standings})
	booster, _ := r.UseItem(UseRequest{PlayerID: "a2", ItemID: Booster, Now: 0, Standings: standings})
	point := Point{5, 6, 7}
	_, err := r.Place("a2", barricade.Use.ID, point, 900) // the user is not the reporter
	wantErr(t, err, ErrInvalidUse)
	use, err := r.Place("b1", barricade.Use.ID, point, 900) // the targeted leader is
	if err != nil || *use.Placed != point {
		t.Fatalf("barricade %+v %v", use, err)
	}
	_, err = r.Place("b1", barricade.Use.ID, point, 950) // once
	wantErr(t, err, ErrInvalidUse)
	_, err = r.Place("b1", timeBomb.Use.ID, point, 3_000)
	wantErr(t, err, ErrInvalidUse)
	if _, err = r.Place("a2", timeBomb.Use.ID, point, 3_000); err != nil {
		t.Fatal(err)
	}
	_, err = r.Place("a2", booster.Use.ID, point, 10)
	wantErr(t, err, ErrInvalidUse)
	_, err = r.Place("a2", 99, point, 10)
	wantErr(t, err, ErrInvalidUse)
}

func TestHitReports(t *testing.T) {
	r := teamRace(t, &picks{})
	standings := order("b1", "a1", "b2", "a2")
	use := func(user string, item int, aimed string, now int64) *Use {
		t.Helper()
		give(r, user, item)
		result, err := r.UseItem(UseRequest{PlayerID: user, ItemID: item, TargetID: aimed,
			Point: &Point{}, Now: now, Standings: standings})
		if err != nil {
			t.Fatal(err)
		}
		return result.Use
	}
	hit := func(victim string, u *Use, result, by string, now int64) (Hit, bool, error) {
		return r.Hit(HitRequest{VictimID: victim, UseID: u.ID, ItemID: u.ItemID, Result: result, By: by, Now: now})
	}
	rocket := use("a1", Rocket, "b1", 0)
	_, _, err := hit("b2", rocket, ResultHit, "", 1)
	wantErr(t, err, ErrInvalidTarget) // not the target
	_, _, err = r.Hit(HitRequest{VictimID: "b1", UseID: rocket.ID, ItemID: Banana, Result: ResultHit, Now: 1})
	wantErr(t, err, ErrInvalidUse) // wrong item
	_, _, err = hit("b1", rocket, ResultBlocked, ByEMP, 1)
	wantErr(t, err, ErrInvalidBy) // EMP stops only the UFO
	_, _, err = hit("b1", rocket, ResultHit, ByShield, 1)
	wantErr(t, err, ErrInvalidBy)
	_, _, err = hit("b1", rocket, "missed", "", 1)
	wantErr(t, err, ErrInvalidResult)
	first, fresh, err := hit("b1", rocket, ResultBlocked, ByShield, 1_000)
	if err != nil || !fresh || first.UserID != "a1" || first.VictimID != "b1" || first.By != ByShield {
		t.Fatalf("rocket hit %+v %v %v", first, fresh, err)
	}
	again, fresh, err := hit("b1", rocket, ResultHit, "", 1_200) // repeats the first report
	if err != nil || fresh || again != first {
		t.Fatalf("repeat %+v %v %v", again, fresh, err)
	}

	devil := use("b1", Devil, "", 0)
	_, _, err = hit("a1", devil, ResultBlocked, ByAngel, 1)
	wantErr(t, err, ErrInvalidBy) // angels do not stop the devil
	if _, fresh, err := hit("a1", devil, ResultBlocked, ByEscape, 1); err != nil || !fresh {
		t.Fatalf("escape %v", err)
	}
	_, _, err = hit("b2", devil, ResultHit, "", 1)
	wantErr(t, err, ErrInvalidTarget)

	// A banana hits anyone, teammates and its user included, and is gone
	// after the first hit.
	banana := use("a1", Banana, "", 0)
	gone, fresh, err := hit("a2", banana, ResultHit, "", 600)
	if err != nil || !fresh || !gone.Removed {
		t.Fatalf("banana %+v %v", gone, err)
	}
	_, _, err = hit("b1", banana, ResultHit, "", 700)
	wantErr(t, err, ErrInvalidUse)
	if repeat, fresh, err := hit("a2", banana, ResultHit, "", 800); err != nil || fresh || !repeat.Removed {
		t.Fatalf("banana repeat %+v %v", repeat, err)
	}

	// Water bombs and barricades spare the user's team; time bombs do not.
	waterBomb := use("a1", WaterBomb, "", 0)
	_, _, err = hit("a2", waterBomb, ResultHit, "", 1_000)
	wantErr(t, err, ErrInvalidTarget)
	_, _, err = hit("a1", waterBomb, ResultHit, "", 1_000)
	wantErr(t, err, ErrInvalidTarget)
	if _, _, err := hit("b2", waterBomb, ResultHit, "", 1_000); err != nil {
		t.Fatal(err)
	}
	timeBomb := use("a1", TimeBomb, "", 0)
	for _, victim := range []string{"a1", "a2", "b1"} {
		if _, _, err := hit(victim, timeBomb, ResultHit, "", 3_000); err != nil {
			t.Fatalf("time bomb on %s: %v", victim, err)
		}
	}
	_, _, err = hit("b2", timeBomb, ResultBlocked, ByShield, 3_000)
	wantErr(t, err, ErrInvalidBy)

	// Items that affect only their user's side take no hits.
	angel := use("a2", Angel, "", 0)
	_, _, err = hit("a2", angel, ResultHit, "", 1)
	wantErr(t, err, ErrInvalidUse)

	// Uses expire after a minute.
	ufo := use("a2", UFO, "", 0)
	_, _, err = hit("b1", ufo, ResultBlocked, ByEMP, UseLifetimeMs+1)
	wantErr(t, err, ErrInvalidUse)
	_, _, err = r.Hit(HitRequest{VictimID: "zz", UseID: ufo.ID, ItemID: UFO, Result: ResultHit})
	wantErr(t, err, ErrInvalidTarget)
}

func TestHazardHits(t *testing.T) {
	r := soloRace(t, nil)
	hazard := func(victim string, item, id int, result, by string, now int64) (Hit, bool, error) {
		return r.Hit(HitRequest{VictimID: victim, ItemID: item, HazardID: id, Result: result, By: by, Now: now})
	}
	first, fresh, err := hazard("p1", WaterMine, 3, ResultHit, "", 1_000)
	if err != nil || !fresh || first.HazardID != 3 || first.UserID != "" || first.Removed {
		t.Fatalf("hazard %+v %v", first, err)
	}
	if again, fresh, _ := hazard("p1", WaterMine, 3, ResultHit, "", 3_999); fresh || again != first {
		t.Fatal("hazard cooldown")
	}
	if _, fresh, _ := hazard("p1", WaterMine, 3, ResultHit, "", 4_000); !fresh {
		t.Fatal("after the cooldown")
	}
	if _, fresh, _ := hazard("p2", WaterMine, 3, ResultBlocked, ByShield, 1_000); !fresh {
		t.Fatal("another racer")
	}
	_, _, err = hazard("p1", Rocket, 4, ResultHit, "", 0)
	wantErr(t, err, ErrInvalidUse)
	_, _, err = hazard("p1", Mine, 0, ResultHit, "", 0)
	wantErr(t, err, ErrInvalidUse)
	_, _, err = hazard("p1", Mine, 4, ResultBlocked, ByEMP, 0)
	wantErr(t, err, ErrInvalidBy)
}

func TestSwapNeedsTwoItems(t *testing.T) {
	r := soloRace(t, nil)
	standings := order("p1", "p2")
	_, _, err := r.Swap("p1", 0, standings)
	wantErr(t, err, ErrInvalidUse)
	give(r, "p1", Rocket, Shield)
	slots, _, err := r.Swap("p1", 0, standings)
	if err != nil || !slices.Equal(slots, []int{Shield, Rocket}) {
		t.Fatalf("swap %v %v", slots, err)
	}
	if r.Slots("nobody") != nil {
		t.Fatal("slots of a stranger")
	}
}

func TestUsesArePrunedAfterTheirLifetime(t *testing.T) {
	r := soloRace(t, nil)
	standings := order("p1", "p2")
	give(r, "p1", Booster, Booster)
	first, _ := r.UseItem(UseRequest{PlayerID: "p1", ItemID: Booster, Now: 0, Standings: standings})
	if _, ok := r.Lookup(first.Use.ID, UseLifetimeMs); !ok {
		t.Fatal("use expired early")
	}
	r.UseItem(UseRequest{PlayerID: "p1", ItemID: Booster, Now: UseLifetimeMs + 1, Standings: standings})
	if _, ok := r.uses[first.Use.ID]; ok {
		t.Fatal("expired use kept")
	}
}
