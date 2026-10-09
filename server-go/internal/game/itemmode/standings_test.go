package itemmode

import (
	"math"
	"slices"
	"testing"
)

func ids(racers []Racer) []string {
	out := make([]string, len(racers))
	for i, r := range racers {
		out[i] = r.ID
	}
	return out
}

func TestStandingsOrder(t *testing.T) {
	got := Standings([]Racer{
		{ID: "slow", Distance: 100},
		{ID: "second-home", FinishOrder: 2},
		{ID: "fast", Distance: 900},
		{ID: "left", Distance: 5000, Out: true},
		{ID: "tie", Distance: 100},
		{ID: "first-home", FinishOrder: 1, Out: true}, // finished, then left
	})
	want := []string{"first-home", "second-home", "fast", "slow", "tie"}
	if !slices.Equal(ids(got), want) {
		t.Fatalf("standings %v, want %v", ids(got), want)
	}
	if got[0].Racing() || !got[2].Racing() {
		t.Fatal("racing flags")
	}
	if rankOf(got, "fast") != 3 || rankOf(got, "left") != 0 {
		t.Fatal("ranks")
	}
}

func TestEtaMs(t *testing.T) {
	cases := []struct {
		gap, speed float64
		max, want  int
	}{
		{100, missileSpeed, 1500, 1000},
		{-100, missileSpeed, 1500, 1000}, // a target behind is as far
		{10, missileSpeed, 1500, 300},
		{1000, missileSpeed, 1500, 1500},
		{60, flySpeed, 2000, 1000},
		{math.NaN(), flySpeed, 2000, 2000},
		{50, 0, 1500, 1500},
		{50, flySpeed, 0, 300},
	}
	for _, c := range cases {
		if got := EtaMs(c.gap, c.speed, c.max); got != c.want {
			t.Errorf("EtaMs(%v, %v, %d) = %d, want %d", c.gap, c.speed, c.max, got, c.want)
		}
	}
}
