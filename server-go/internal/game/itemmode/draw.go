package itemmode

// Group is a rank group of the probability tables (the toprank, highrank,
// midrank and lowrank columns).
type Group int

const (
	GroupTop Group = iota
	GroupHigh
	GroupMid
	GroupLow
)

func (g Group) String() string {
	switch g {
	case GroupTop:
		return "top"
	case GroupHigh:
		return "high"
	case GroupMid:
		return "mid"
	}
	return "low"
}

// GroupOf maps a 1-based rank among racers to its rank group
// (ITEM_MODE.md 4): 1st is top; any other rank r has p = (r-2)/(N-1) and
// is high below 1/3, mid below 2/3, low otherwise. A lone racer is top.
func GroupOf(rank, racers int) Group {
	if rank <= 1 || racers <= 1 {
		return GroupTop
	}
	// p < 1/3 ⟺ 3(r-2) < N-1, in integers.
	scaled, span := 3*(rank-2), racers-1
	switch {
	case scaled < span:
		return GroupHigh
	case scaled < 2*span:
		return GroupMid
	}
	return GroupLow
}

// Random is the random source of the draws and random targets
// (*math/rand/v2.Rand satisfies it).
type Random interface {
	// IntN returns a uniform integer in [0, n); n > 0.
	IntN(n int) int
}

// Draw picks an item of group by weight, leaving out the items excluded
// reports true for (the caps: a capped item is redrawn among the others).
// ok is false when nothing has weight left.
func (t *Table) Draw(group Group, excluded func(idx int) bool, random Random) (idx int, ok bool) {
	total := 0
	for _, entry := range t.Entries {
		if w := entry.Weight(group); w > 0 && !excluded(entry.Idx) {
			total += w
		}
	}
	if total <= 0 {
		return 0, false
	}
	pick := random.IntN(total)
	for _, entry := range t.Entries {
		w := entry.Weight(group)
		if w <= 0 || excluded(entry.Idx) {
			continue
		}
		if pick < w {
			return entry.Idx, true
		}
		pick -= w
	}
	return 0, false // unreachable: pick < total
}
