package itemmode

import (
	"slices"
	"testing"
)

func TestSlotsPackFromSlotZero(t *testing.T) {
	s := NewSlots(1)
	if s.Capacity() != 2 || !slices.Equal(s.Values(), []int{Empty, Empty}) {
		t.Fatalf("new slots %v", s.Values())
	}
	if _, ok := s.First(); ok {
		t.Fatal("empty slots have a first item")
	}
	if !s.Add(Rocket) || !s.Add(Banana) || s.Add(Shield) || !s.Full() {
		t.Fatalf("two slots took %v", s.Values())
	}
	if first, _ := s.First(); first != Rocket {
		t.Fatalf("first %d", first)
	}
	if !s.Swap() || !slices.Equal(s.Values(), []int{Banana, Rocket}) {
		t.Fatalf("swapped %v", s.Values())
	}
	if idx, ok := s.TakeFirst(); !ok || idx != Banana || !slices.Equal(s.Values(), []int{Rocket, Empty}) {
		t.Fatalf("took %d, left %v", idx, s.Values())
	}
	if s.Swap() {
		t.Fatal("swapped a single item")
	}
	s.TakeFirst()
	if _, ok := s.TakeFirst(); ok || s.Len() != 0 {
		t.Fatal("took from empty slots")
	}

	three := NewSlots(9)
	for _, idx := range []int{Booster, Magnet, Devil} {
		three.Add(idx)
	}
	if three.Capacity() != 3 || !three.Full() {
		t.Fatalf("three slots %v", three.Values())
	}
	three.SetCapacity(2)
	if !slices.Equal(three.Values(), []int{Booster, Magnet}) {
		t.Fatalf("shrunk to %v", three.Values())
	}
	var zero Slots
	if zero.Capacity() != 2 || zero.Full() {
		t.Fatal("zero slots")
	}
}
