package itemmode

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

func defaultData(t *testing.T) *Data {
	t.Helper()
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	return d
}

// The embedded export holds the original tables (ITEM_MODE.md appendix A),
// caps and lifetimes.
func TestEmbeddedTables(t *testing.T) {
	d := defaultData(t)
	indi, team := d.Table(TableIndividual), d.Table(TableTeam)
	if len(indi.Entries) != 14 || len(team.Entries) != 19 {
		t.Fatalf("tables %d / %d items", len(indi.Entries), len(team.Entries))
	}
	want := map[string][2]Entry{
		"banana":       {{Idx: 8, Name: "banana", Top: 25}, {Idx: 8, Name: "banana", Top: 25, High: 2}},
		"shield":       {{Idx: 10, Name: "shield", Top: 40, High: 25}, {Idx: 10, Name: "shield", Top: 35, High: 20}},
		"booster":      {{Idx: 6, Name: "booster", Mid: 24, Low: 51}, {Idx: 6, Name: "booster", Mid: 20, Low: 60}},
		"magnet":       {{Idx: 5, Name: "magnet", High: 5, Mid: 15, Low: 32}, {Idx: 5, Name: "magnet", High: 5, Mid: 8, Low: 20}},
		"randomRocket": {{}, {Idx: 127, Name: "randomRocket", High: 15, Mid: 5}},
		"timeBomb":     {{}, {Idx: 13, Name: "timeBomb", High: 3, Mid: 5}},
	}
	find := func(table *Table, name string) Entry {
		i := slices.IndexFunc(table.Entries, func(e Entry) bool { return e.Name == name })
		if i < 0 {
			return Entry{}
		}
		return table.Entries[i]
	}
	for name, rows := range want {
		if got := find(indi, name); got != rows[0] {
			t.Errorf("indi %s = %+v, want %+v", name, got, rows[0])
		}
		if got := find(team, name); got != rows[1] {
			t.Errorf("team %s = %+v, want %+v", name, got, rows[1])
		}
	}
	for _, table := range []*Table{indi, team} {
		for _, group := range []Group{GroupTop, GroupHigh, GroupMid, GroupLow} {
			total := 0
			for _, e := range table.Entries {
				total += e.Weight(group)
			}
			if total != 100 {
				t.Errorf("%s %s weights sum to %d", table.Source, group, total)
			}
		}
	}
	for _, idx := range []int{SlotLock, Angel, Thunderbolt} {
		if allow, ok := d.Cap(idx); !ok || allow != 2 {
			t.Errorf("cap of %d = %d %v", idx, allow, ok)
		}
	}
	if _, ok := d.Cap(Booster); ok {
		t.Error("booster is capped")
	}
	lives := map[int]map[string]int{
		Rocket:   {"Use": 1500, "Affect": 1500},
		WaterFly: {"Use": 2000, "Affect": 1000, "EscapeAffect": 2000},
		UFO:      {"Use": 1500, "Affect": 3000},
		SlotLock: {"Use": 2000, "Affect": 1000, "Postaffect": 2000},
		Scanning: {"Affect": 8000},
		Angel:    {"Affect": 4000},
		Banana:   {"Use": 500, "Set": 30000, "Affect": 2000},
		TimeBomb: {"Use": 3000, "Set": 1000},
		Cloud:    {"Use": 666, "Set": 10000},
	}
	for idx, states := range lives {
		item, ok := d.Item(idx)
		if !ok {
			t.Fatalf("item %d missing", idx)
		}
		for state, life := range states {
			if item.Life(state) != life {
				t.Errorf("%s %s = %d, want %d", item.Name, state, item.Life(state), life)
			}
		}
	}
	for _, idx := range []int{GuideRocket, RandomRocket} {
		if item, _ := d.Item(idx); item.Folder != "rocket" || item.Life("Use") != 1500 {
			t.Errorf("%d reads %+v", idx, item)
		}
	}
	if booster, _ := d.Item(Booster); len(booster.States) != 0 {
		t.Errorf("booster states %v", booster.States)
	}
}

func TestEmbeddedTracksAndPools(t *testing.T) {
	d := defaultData(t)
	if len(d.Tracks) < 150 {
		t.Fatalf("only %d item tracks", len(d.Tracks))
	}
	for _, id := range []string{"village_C01", "mine_C04", "china_C01", "world_C02", "nemo_C02"} {
		if track, ok := d.Track(id); !ok || !track.OnlyItem {
			t.Errorf("item-only track %s = %+v %v", id, track, ok)
		}
	}
	// Speed tracks, trackLocale-blocked tracks and tracks without cubes are out.
	for _, id := range []string{"village_R01", "tomb_I05", "nymph_I03", "desert_I09", "ice_I01", "village_I11", "forest_I03_rvs"} {
		if _, ok := d.Track(id); ok {
			t.Errorf("%s accepted", id)
		}
	}
	if track, ok := d.Track("desert_I03_rvs"); !ok || !track.Reverse || track.Cubes == 0 {
		t.Errorf("desert_I03_rvs = %+v %v", track, ok)
	}
	for _, code := range RandomCodes {
		if len(d.Pool(code)) == 0 {
			t.Errorf("pool %d empty", code)
		}
	}
	if d.Pool(40) != nil {
		t.Error("speed-only code 40 has an item pool")
	}
	if d.DefaultTrack != d.Pool(3)[0] {
		t.Errorf("default %s, hot1 starts with %s", d.DefaultTrack, d.Pool(3)[0])
	}
	for _, id := range d.Pool(30) {
		if track, _ := d.Track(id); !track.Reverse {
			t.Errorf("reverse pool has %s", id)
		}
	}
}

// edit decodes the embedded document, applies change and re-encodes it.
func edit(t *testing.T, change func(doc map[string]any)) []byte {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal(embedded, &doc); err != nil {
		t.Fatal(err)
	}
	change(doc)
	data, err := json.Marshal(doc)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestParseRejectsBrokenData(t *testing.T) {
	cases := map[string]func(doc map[string]any){
		"unknown field": func(doc map[string]any) { doc["extra"] = 1 },
		"no version":    func(doc map[string]any) { delete(doc, "version") },
		"no team table": func(doc map[string]any) { delete(doc["tables"].(map[string]any), "team") },
		"negative weight": func(doc map[string]any) {
			items := doc["tables"].(map[string]any)["indi"].(map[string]any)["items"].([]any)
			items[0].(map[string]any)["top"] = -1
		},
		"unknown item": func(doc map[string]any) {
			items := doc["tables"].(map[string]any)["indi"].(map[string]any)["items"].([]any)
			items[0].(map[string]any)["idx"] = 999
		},
		"missing state": func(doc map[string]any) {
			for _, item := range doc["items"].([]any) {
				if item.(map[string]any)["name"] == "slotLock" {
					delete(item.(map[string]any)["states"].(map[string]any), "Postaffect")
				}
			}
		},
		"bad cap": func(doc map[string]any) {
			caps := doc["restrictions"].(map[string]any)["caps"].([]any)
			caps[0].(map[string]any)["allowCount"] = 0
		},
		"duplicate track": func(doc map[string]any) {
			tracks := doc["tracks"].([]any)
			doc["tracks"] = append(tracks, tracks[0])
		},
		"track without cubes": func(doc map[string]any) {
			doc["tracks"].([]any)[0].(map[string]any)["cubes"] = 0
		},
		"unknown pool track": func(doc map[string]any) {
			pool := doc["randomPools"].([]any)[0].(map[string]any)
			pool["tracks"] = []any{"nowhere_X01"}
		},
		"missing pool": func(doc map[string]any) { doc["randomPools"] = doc["randomPools"].([]any)[1:] },
		"speed code": func(doc map[string]any) {
			doc["randomPools"].([]any)[0].(map[string]any)["code"] = 40
		},
		"unknown default": func(doc map[string]any) { doc["defaultTrack"] = "village_R01" },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Parse(edit(t, change)); err == nil {
				t.Fatal("accepted")
			}
		})
	}
	if _, err := Parse(append(append([]byte{}, embedded...), []byte(" {}")...)); err == nil ||
		!strings.Contains(err.Error(), "trailing") {
		t.Fatalf("trailing data: %v", err)
	}
	if _, err := Parse(edit(t, func(map[string]any) {})); err != nil {
		t.Fatalf("re-encoded data: %v", err)
	}
}
