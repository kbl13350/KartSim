package expedition

import (
	"errors"
	"testing"
	"time"
)

func defaultData(t *testing.T) *Data {
	t.Helper()
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func beijingMs(text string) int64 {
	at, err := time.ParseInLocation("2006-01-02 15:04", text, beijing)
	if err != nil {
		panic(err)
	}
	return at.UnixMilli()
}

func TestEmbeddedTable(t *testing.T) {
	d := defaultData(t)
	if len(d.Missions) != 94 || d.Basic.WeeklyMissions != 10 || d.Basic.ResetWeekday != 4 ||
		d.Basic.Token.Category != 34 || d.Basic.Token.Item != 879 {
		t.Fatalf("table %d missions, basic %+v", len(d.Missions), d.Basic)
	}
	m, ok := d.Mission(1)
	if !ok || m.TrackID != "village_R03" || m.Difficulty != 4 || m.Hours != 32 || m.StockID != 31900 {
		t.Fatalf("mission 1 = %+v", m)
	}
	if items := d.Stocks[31900].Items; len(items) != 1 || items[0].Category != 24 || items[0].ItemID != 1228 ||
		items[0].Count != 3 {
		t.Fatalf("stock 31900 = %+v", d.Stocks[31900])
	}
}

func TestWeekAndDayStart(t *testing.T) {
	d := defaultData(t)
	thursday := beijingMs("2026-10-08 06:00") // a Thursday
	for _, at := range []string{"2026-10-08 06:00", "2026-10-09 12:00", "2026-10-15 05:59"} {
		if got := d.WeekStart(beijingMs(at)); got != thursday {
			t.Fatalf("WeekStart(%s) = %d, want %d", at, got, thursday)
		}
	}
	if got := d.WeekStart(beijingMs("2026-10-08 05:59")); got != beijingMs("2026-10-01 06:00") {
		t.Fatalf("before the reset hour: %d", got)
	}
	if got := d.DayStart(beijingMs("2026-10-09 05:00")); got != beijingMs("2026-10-08 06:00") {
		t.Fatalf("DayStart before 06:00 = %d", got)
	}
}

func TestSpecificIsStable(t *testing.T) {
	seen := map[int]bool{}
	for id := 1; id <= 200; id++ {
		s := Specific(1, id)
		if s < 0 || s >= Specifics || s != Specific(1, id) {
			t.Fatalf("Specific(1, %d) = %d", id, s)
		}
		seen[s] = true
	}
	if len(seen) != Specifics {
		t.Fatalf("200 characters cover %d attributes", len(seen))
	}
}

func TestBonusAndPayout(t *testing.T) {
	d := defaultData(t)
	m := &Mission{Specific: 2, Difficulty: 1, Hours: 8, BonusType: RewardLucci}
	matched := Member{CharacterSpecific: 2, KartSpecific: 5, KartLevel: 0}
	if d.CharacterBonus(m, 2) != 50 || d.CharacterBonus(m, 3) != 0 {
		t.Fatal("character bonus")
	}
	if b := d.KartBonus(m, 9, 40); b.Time != 270 || b.Points != 27 || b.Reward != 0 {
		t.Fatalf("kart level 9 (capped at 5) with 40 parts = %+v", b)
	}
	friend := 4
	b := d.CrewBonus(m, []Member{matched, {CharacterSpecific: 1, KartSpecific: 2, KartLevel: 5}}, &friend)
	if b.Time != 45+270 || b.Reward != 50+25 {
		t.Fatalf("crew bonus %+v", b)
	}
	if d.CrewBonus(m, []Member{{KartLevel: 5}, {KartLevel: 5}, {KartLevel: 5}}, nil).Time != MaxTimeBonus {
		t.Fatal("time cut not capped")
	}
	if Departs(m, []Member{matched}) || !Departs(m, []Member{matched, {KartSpecific: 2}}) {
		t.Fatal("departure needs a matching character and kart")
	}
	if got := d.Duration(m, Bonus{Time: 500}); got != 4*3_600_000 {
		t.Fatalf("duration %d", got)
	}
	if exp, lucci := d.Payout(m, Bonus{Reward: 100, Points: 10}); exp != 0 || lucci != 1144 {
		t.Fatalf("lucci mission %d %d", exp, lucci)
	}
	both := &Mission{Difficulty: 5, BonusType: RewardExpLucci}
	if exp, lucci := d.Payout(both, Bonus{}); exp != 250 || lucci != 2000 {
		t.Fatalf("exp+lucci mission %d %d", exp, lucci)
	}
}

func sequence() Roller { return func(n int) int { return 0 } }

func TestWeekRenewPrefersFeasibleMissions(t *testing.T) {
	d := defaultData(t)
	now := beijingMs("2026-10-09 12:00")
	s := &State{}
	if !d.Renew(s, now, func(specific int) bool { return specific == 5 }, sequence()) {
		t.Fatal("a first visit starts a week")
	}
	if len(s.Slots) != 10 || s.Week != d.WeekStart(now) {
		t.Fatalf("slots %d week %d", len(s.Slots), s.Week)
	}
	for _, slot := range s.Slots {
		if m, _ := d.Mission(slot.Mission); m.Specific != 5 {
			t.Fatalf("mission %d has attribute %d", slot.Mission, m.Specific)
		}
	}
	if d.Renew(s, now+1000, nil, sequence()) {
		t.Fatal("the same week renewed")
	}
	// A started mission survives the reset; the others are replaced.
	if _, err := d.Start(s, Departure{Slot: s.Slots[0].Slot, Crew: []Pair{{Character: 1, Kart: 2}},
		Members: []Member{{CharacterSpecific: 5, KartSpecific: 5}}}, now); err != nil {
		t.Fatal(err)
	}
	next := now + 7*24*3_600_000
	if !d.Renew(s, next, nil, sequence()) || len(s.Slots) != 11 || s.Slots[0].Started == 0 || s.Started != 0 {
		t.Fatalf("after the reset: %d slots, first started %d, started %d", len(s.Slots), s.Slots[0].Started, s.Started)
	}
}

func TestMissionLifecycle(t *testing.T) {
	d := defaultData(t)
	now := beijingMs("2026-10-09 12:00")
	s := &State{}
	d.Renew(s, now, nil, sequence())
	first := &s.Slots[0]
	m, _ := d.Mission(first.Mission)
	match := Member{CharacterSpecific: m.Specific, KartSpecific: m.Specific}
	crew := []Pair{{Character: 1, Kart: 0, KartKey: "practice"}}

	if _, err := d.Start(s, Departure{Slot: first.Slot, Crew: crew, Members: []Member{{CharacterSpecific: m.Specific,
		KartSpecific: (m.Specific + 1) % Specifics}}}, now); !errors.Is(err, ErrNoMatch) {
		t.Fatalf("no matching kart: %v", err)
	}
	if _, err := d.Start(s, Departure{Slot: first.Slot, Crew: append(crew, crew[0]),
		Members: []Member{match, match}}, now); !errors.Is(err, ErrInvalidCrew) {
		t.Fatalf("repeated pair: %v", err)
	}
	slot, err := d.Start(s, Departure{Slot: first.Slot, Crew: crew, Members: []Member{match}, Friend: "f",
		FriendSpecific: m.Specific}, now)
	if err != nil {
		t.Fatal(err)
	}
	if slot.Ends <= now || slot.Bonus.Reward != 100 || s.Started != 1 {
		t.Fatalf("started slot %+v", slot)
	}
	second := s.Slots[1]
	m2, _ := d.Mission(second.Mission)
	if _, err := d.Start(s, Departure{Slot: second.Slot, Crew: crew, Members: []Member{{CharacterSpecific: m2.Specific,
		KartSpecific: m2.Specific}}}, now); !errors.Is(err, ErrCrewBusy) {
		t.Fatalf("busy crew: %v", err)
	}
	if _, err := d.Start(s, Departure{Slot: second.Slot, Crew: []Pair{{Character: 2, Kart: 3}},
		Members: []Member{{CharacterSpecific: m2.Specific, KartSpecific: m2.Specific}}, Friend: "f"},
		now); !errors.Is(err, ErrFriendUsed) {
		t.Fatalf("friend twice a day: %v", err)
	}
	if _, _, err := d.Claim(s, first.Slot, now); !errors.Is(err, ErrMissionNotDone) {
		t.Fatalf("early claim: %v", err)
	}
	// Cut 30 minutes, then finish now for the rest.
	before := slot.Ends
	if _, err := d.Reduce(s, slot.Slot, 1, now); err != nil || slot.Ends != before-30*60_000 {
		t.Fatalf("reduce %v, ends %d", err, slot.Ends)
	}
	remaining, number := slot.Ends-now, slot.Slot
	if _, cost, err := d.Complete(s, number, now); err != nil || cost != int((remaining+1_799_999)/1_800_000) {
		t.Fatalf("complete cost %d %v", cost, err)
	}
	claimed, mission, err := d.Claim(s, number, now)
	if err != nil || claimed.Slot != number || mission.ID != m.ID || len(s.Slots) != 9 || s.Finished != 1 {
		t.Fatalf("claim %+v %v, %d slots", claimed, err, len(s.Slots))
	}
	// Change keeps the slot, with another mission; adding waits until all started.
	changed, err := d.Change(s, s.Slots[0].Slot, nil, sequence())
	if err != nil || changed.Mission == second.Mission {
		t.Fatalf("change %+v %v", changed, err)
	}
	if _, err := d.Add(s, nil, sequence()); !errors.Is(err, ErrCannotAdd) {
		t.Fatalf("add with missions waiting: %v", err)
	}
	for i := range s.Slots {
		s.Slots[i].Started, s.Slots[i].Ends = now, now
	}
	added, err := d.Add(s, nil, sequence())
	if err != nil || !added.Added || s.Added != 1 || d.Limit(s) != 11 {
		t.Fatalf("add %+v %v", added, err)
	}
}
