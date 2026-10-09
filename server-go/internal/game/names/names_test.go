package names

import "testing"

// The game node folds names exactly like the data service's presence keys,
// which follow the nickname column collation (utf8mb4_0900_as_ci): ordinary
// case pairs fold together, but letters the collation keeps apart (dotted
// and dotless I, long s, …) stay distinct even though Java's
// equalsIgnoreCase would merge them.
func TestFoldMatchesNicknameCollation(t *testing.T) {
	for _, group := range [][]string{
		{"istanbul", "ISTANBUL", "Istanbul"},
		{"ß", "ẞ"},
		{"s", "S"},
		{"k", "K", "K"}, // Kelvin sign
		{"Alice", "ALICE", "alice"},
		{"甲乙", "甲乙"},
	} {
		want := Fold(group[0])
		for _, name := range group[1:] {
			if got := Fold(name); got != want {
				t.Errorf("Fold(%q) = %q, want %q (same as %q)", name, got, want, group[0])
			}
		}
	}
	for _, pair := range [][2]string{{"Alice", "Alicé"}, {"a", "b"}, {"ss", "ß"},
		{"istanbul", "İstanbul"}, {"istanbul", "ıstanbul"}, {"s", "ſ"}} {
		if Fold(pair[0]) == Fold(pair[1]) {
			t.Errorf("%q and %q fold together", pair[0], pair[1])
		}
	}
}
