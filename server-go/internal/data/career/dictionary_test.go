package career

import "testing"

func TestEmbeddedDictionaryVersionMatchesContent(t *testing.T) {
	stored, computed := contentVersion(t, embeddedDictionary)
	if stored != computed {
		t.Errorf("dictionary.json: version %s, content hashes to %s; regenerate with "+
			"`node --import tsx tools/export-career-data.mjs` in client/ instead of editing by hand",
			stored, computed)
	}
}

func TestEmbeddedDictionary(t *testing.T) {
	d, err := DefaultDictionary()
	if err != nil {
		t.Fatal(err)
	}
	if len(d.Categories) != 10 || d.Reward != (DictionaryReward{Category: 56, Item: 1, Count: 1}) {
		t.Fatalf("categories %d reward %+v", len(d.Categories), d.Reward)
	}
	if d.Categories[0].Category != 1 || d.Categories[2].Category != 3 || len(d.Categories[2].Items) != 1173 {
		t.Fatalf("category order %+v", d.Categories[:3])
	}
	if len(d.KartGrades) != 1173 || d.KartGrades[1638] != 13 {
		t.Fatalf("kart grades %d, 1638 = %d", len(d.KartGrades), d.KartGrades[1638])
	}
	// 2026-10-01 06:00 Beijing lists the last embargoed item (balloon 1490).
	const before, after = int64(1790805600000 - 1), int64(1790805600000)
	if d.Listed(9, 1490, before) || !d.Listed(9, 1490, after) || d.Listed(9, 99999, after) {
		t.Fatal("balloon 1490 embargo")
	}
	if d.Size(after) != 3684 || d.Size(before) != 3683 || d.Size(0) != 3684-12 {
		t.Fatalf("sizes %d %d %d", d.Size(after), d.Size(before), d.Size(0))
	}
	owned := map[int]map[int]bool{3: {1: true, 1638: true, 99999: true}, 9: {1490: true}, 4: {1: true}}
	collected := d.Collected(owned, after)
	if got := collected[3]; len(got) != 2 || got[0] != 1638 || got[1] != 1 {
		t.Fatalf("karts in display order %v", got)
	}
	if d.Count(owned, 0, after) != 3 || d.Count(owned, 0, before) != 2 || d.Count(owned, 3, 0) != 1 {
		t.Fatalf("counts %d %d %d", d.Count(owned, 0, after), d.Count(owned, 0, before), d.Count(owned, 3, 0))
	}
}
