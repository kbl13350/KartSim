package itemmode

// Slot capacities: every kart holds two items, a kart whose physics has
// ItemSlotCapacity=3 holds three.
const (
	MinCapacity = 2
	MaxCapacity = 3
)

// Empty marks an empty slot in Slots.Values.
const Empty = -1

// held is one held item and its slot icon override (the special booster's
// item/slot/animal<icon>.png; 0 for the item's own icon).
type held struct{ idx, icon int }

// Slots is a racer's item slots: held items are packed from slot 0 (the one
// Ctrl uses), so a new item goes into the first empty slot and using slot 0
// shifts the rest forward.
type Slots struct {
	capacity int
	held     []held
}

// NewSlots returns empty slots of capacity, clamped to 2..3.
func NewSlots(capacity int) Slots {
	return Slots{capacity: min(max(capacity, MinCapacity), MaxCapacity)}
}

// Capacity returns the number of slots.
func (s *Slots) Capacity() int { return max(s.capacity, MinCapacity) }

// SetCapacity changes the number of slots (clamped to 2..3); items beyond
// it are dropped.
func (s *Slots) SetCapacity(capacity int) {
	s.capacity = min(max(capacity, MinCapacity), MaxCapacity)
	if len(s.held) > s.capacity {
		s.held = s.held[:s.capacity]
	}
}

// Len returns how many items are held.
func (s *Slots) Len() int { return len(s.held) }

// Full reports whether every slot holds an item.
func (s *Slots) Full() bool { return len(s.held) >= s.Capacity() }

// First returns the item in slot 0.
func (s *Slots) First() (int, bool) {
	if len(s.held) == 0 {
		return 0, false
	}
	return s.held[0].idx, true
}

// Add puts idx into the first empty slot; false when full.
func (s *Slots) Add(idx int) bool { return s.AddIcon(idx, 0) }

// AddIcon puts idx with a slot icon override into the first empty slot;
// false when full.
func (s *Slots) AddIcon(idx, icon int) bool {
	if s.Full() {
		return false
	}
	s.held = append(s.held, held{idx, icon})
	return true
}

// ReplaceFirst changes the item in slot 0 (the item changer); false when
// slot 0 is empty.
func (s *Slots) ReplaceFirst(idx, icon int) bool {
	if len(s.held) == 0 {
		return false
	}
	s.held[0] = held{idx, icon}
	return true
}

// TakeFirst removes the item in slot 0 and shifts the others forward.
func (s *Slots) TakeFirst() (int, bool) {
	if len(s.held) == 0 {
		return 0, false
	}
	idx := s.held[0].idx
	s.held = append(s.held[:0], s.held[1:]...)
	return idx, true
}

// Swap exchanges slots 0 and 1; false unless both hold an item.
func (s *Slots) Swap() bool {
	if len(s.held) < 2 {
		return false
	}
	s.held[0], s.held[1] = s.held[1], s.held[0]
	return true
}

// Values returns one value per slot: the item idx, or Empty.
func (s *Slots) Values() []int {
	values := make([]int, s.Capacity())
	for i := range values {
		values[i] = Empty
		if i < len(s.held) {
			values[i] = s.held[i].idx
		}
	}
	return values
}

// Icons returns one slot icon override per slot (0: the item's own icon),
// or nil when no held item has one.
func (s *Slots) Icons() []int {
	var icons []int
	for i, item := range s.held {
		if item.icon == 0 {
			continue
		}
		if icons == nil {
			icons = make([]int, s.Capacity())
		}
		icons[i] = item.icon
	}
	return icons
}
