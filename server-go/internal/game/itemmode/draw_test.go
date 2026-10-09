package itemmode

import (
	"math"
	"math/rand/v2"
	"testing"
)

// picks is a Random that returns its values in turn (modulo n) and records
// the n it was asked for.
type picks struct {
	values []int
	asked  []int
}

func (p *picks) IntN(n int) int {
	p.asked = append(p.asked, n)
	if len(p.values) == 0 {
		return 0
	}
	value := p.values[0]
	p.values = p.values[1:]
	return value % n
}

func TestGroupOf(t *testing.T) {
	cases := map[int][]Group{
		1: {GroupTop},
		2: {GroupTop, GroupHigh},
		3: {GroupTop, GroupHigh, GroupMid},
		4: {GroupTop, GroupHigh, GroupMid, GroupLow},
		8: {GroupTop, GroupHigh, GroupHigh, GroupHigh, GroupMid, GroupMid, GroupLow, GroupLow},
	}
	for racers, groups := range cases {
		for i, want := range groups {
			if got := GroupOf(i+1, racers); got != want {
				t.Errorf("GroupOf(%d, %d) = %s, want %s", i+1, racers, got, want)
			}
		}
	}
	if GroupOf(0, 0) != GroupTop {
		t.Error("no racers is not top")
	}
}

func TestDrawFollowsWeights(t *testing.T) {
	d := defaultData(t)
	indi := d.Table(TableIndividual)
	none := func(int) bool { return false }
	// Top: banana 25, cloud2 20, shield 40, emp 15 in file order.
	for pick, want := range map[int]int{0: Banana, 24: Banana, 25: Cloud, 44: Cloud, 45: Shield, 84: Shield, 85: EMP, 99: EMP} {
		random := &picks{values: []int{pick}}
		if got, ok := indi.Draw(GroupTop, none, random); !ok || got != want {
			t.Errorf("top pick %d = %d, want %d", pick, got, want)
		}
		if random.asked[0] != 100 {
			t.Errorf("drew from %d", random.asked[0])
		}
	}
	// A seeded source matches the weights over many draws.
	random := rand.New(rand.NewPCG(1, 2))
	counts := map[int]int{}
	const draws = 200_000
	for range draws {
		idx, _ := indi.Draw(GroupLow, none, random)
		counts[idx]++
	}
	for _, e := range indi.Entries {
		share := float64(counts[e.Idx]) / draws * 100
		if math.Abs(share-float64(e.Low)) > 0.5 {
			t.Errorf("%s low share %.2f%%, weight %d", e.Name, share, e.Low)
		}
	}
}

func TestDrawLeavesOutExcludedItems(t *testing.T) {
	team := defaultData(t).Table(TableTeam)
	// Mid without slotLock, angel and thunderbolt: 100 - 2 - 3 - 3 = 92.
	capped := func(idx int) bool { return idx == SlotLock || idx == Angel || idx == Thunderbolt }
	random := &picks{values: []int{91}}
	idx, ok := team.Draw(GroupMid, capped, random)
	if !ok || random.asked[0] != 92 || idx == SlotLock || idx == Angel || idx == Thunderbolt {
		t.Fatalf("drew %d of %d", idx, random.asked[0])
	}
	if _, ok := team.Draw(GroupTop, func(int) bool { return true }, random); ok {
		t.Fatal("drew with everything excluded")
	}
}
