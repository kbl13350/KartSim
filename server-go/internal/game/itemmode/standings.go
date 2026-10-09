package itemmode

import (
	"math"
	"slices"
)

// Racer is one racer's place in the race as the game node sees it.
type Racer struct {
	ID string
	// Distance is the racer's current route distance (m) from its latest
	// motion frame (not the furthest one: a racer reset or knocked back
	// loses places).
	Distance float64
	// FinishOrder is 1 for the first racer to finish, 2 for the next, and 0
	// while racing.
	FinishOrder int
	// Out: the racer left the race (or failed to load).
	Out bool
}

// Racing reports whether the racer is still on the track: not finished and
// not out. Only racing racers are targets.
func (r Racer) Racing() bool { return r.FinishOrder == 0 && !r.Out }

// Standings orders racers best first (ITEM_MODE.md 4): finishers in finish
// order, then the racers still racing by current distance, ties in input
// order. Racers out of the race without a finish are left out.
func Standings(racers []Racer) []Racer {
	ordered := slices.DeleteFunc(slices.Clone(racers), func(r Racer) bool {
		return r.Out && r.FinishOrder == 0
	})
	slices.SortStableFunc(ordered, func(a, b Racer) int {
		switch {
		case a.FinishOrder != 0 && b.FinishOrder != 0:
			return a.FinishOrder - b.FinishOrder
		case a.FinishOrder != 0:
			return -1
		case b.FinishOrder != 0:
			return 1
		case a.Distance > b.Distance:
			return -1
		case a.Distance < b.Distance:
			return 1
		}
		return 0
	})
	return ordered
}

// rankOf returns the 1-based rank of id in standings, 0 when absent.
func rankOf(standings []Racer, id string) int {
	return slices.IndexFunc(standings, func(r Racer) bool { return r.ID == id }) + 1
}

// Eta bounds (ms): a tracking item takes at least minEtaMs and at most its
// Use state's life to reach its target.
const minEtaMs = 300

// EtaMs is when a tracking item reaches its target (ITEM_MODE.md appendix
// B): the route distance between the two racers at the tracking speed
// (m/s), clamped to [300, maxMs].
func EtaMs(gapMeters, speed float64, maxMs int) int {
	maxMs = max(maxMs, minEtaMs)
	if speed <= 0 || math.IsNaN(gapMeters) || math.IsInf(gapMeters, 0) {
		return maxMs
	}
	eta := math.Round(math.Abs(gapMeters) / speed * 1000)
	return int(min(max(eta, minEtaMs), float64(maxMs)))
}
