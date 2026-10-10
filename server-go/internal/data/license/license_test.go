package license

import (
	"strings"
	"testing"
	"time"

	"kartsim/internal/data/canonical"
)

func TestEmbeddedVersionMatchesContent(t *testing.T) {
	stored, computed, err := canonical.Version(embedded)
	if err != nil {
		t.Fatal(err)
	}
	if stored != computed {
		t.Errorf("license.json: version %s, content hashes to %s; regenerate with "+
			"`node --import tsx tools/export-license-data.mjs` in client/ instead of editing by hand", stored, computed)
	}
}

func TestDefaultTable(t *testing.T) {
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	names := []string{"新手", "初级", "L3", "L2", "L1", "PRO"}
	for i, l := range d.Licenses {
		if l.Level != i+1 || l.Name != names[i] {
			t.Fatalf("license %d = %d %s", i, l.Level, l.Name)
		}
	}
	if steps := len(d.Licenses[Pro-1].Steps); steps != 12 {
		t.Fatalf("PRO steps %d", steps)
	}
	step, owner, index, ok := d.Step(3)
	if !ok || owner.Level != Beginner || index != 2 || step.Track != "village_L01_04" || step.Rule != RuleTime ||
		step.TimeMs != 13000 || step.StockID != 68 {
		t.Fatalf("step 3 = %+v", step)
	}
	if !step.Judge(13000) || step.Judge(13001) {
		t.Fatal("time rule")
	}
	duel, _, _, _ := d.Step(21)
	if duel.Rule != RuleRival || duel.Rival == nil || duel.Rival.CharacterID != 190 || duel.RivalMs <= 0 ||
		!duel.Judge(duel.RivalMs-1) || duel.Judge(duel.RivalMs) {
		t.Fatalf("step 21 = %+v", duel)
	}
	// 获得道具: an item mission keeps its release limit (10 s on CN).
	item, _, _, _ := d.Step(2)
	if item.Rule != RuleItem || item.TimeMs != 10000 || !item.Judge(10000) || item.Judge(10001) {
		t.Fatalf("step 2 = %+v", item)
	}
	// 组队道具赛 needs AI karts: finishing is enough.
	npc, _, _, _ := d.Step(15)
	if npc.Rule != RuleFinish || !npc.Judge(500_000) {
		t.Fatalf("step 15 = %+v", npc)
	}
	// 行驶练习: the key drill has no time limit; its set-up travels to the browser.
	drill, _, _, _ := d.Step(1)
	if drill.Rule != RuleDrill || drill.TimeMs != 0 || !drill.Judge(500_000) ||
		!strings.Contains(string(drill.Setup), `"hideMiniMap":true`) {
		t.Fatalf("step 1 = %+v", drill)
	}
	if stock := d.Stocks[12092]; len(stock.Items) != 1 || stock.Items[0].Category != 56 || stock.Items[0].Count != 20 {
		t.Fatalf("stock 12092 = %+v", stock)
	}
	if d.Pro.EmblemID != 8524 || len(d.Pro.Qualify) != 3 || d.Pro.Qualify[0].Track != "mine_R01" {
		t.Fatalf("pro = %+v", d.Pro)
	}
	if !d.Qualifies(map[string]int64{"mine_R01": 72000, "forest_R02": 1, "village_R03": 70000}) ||
		d.Qualifies(map[string]int64{"mine_R01": 72001, "forest_R02": 1, "village_R03": 1}) ||
		d.Qualifies(map[string]int64{"mine_R01": 1}) {
		t.Fatal("qualification")
	}
}

func TestProPeriods(t *testing.T) {
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	at := func(value string) int64 {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			t.Fatal(err)
		}
		return parsed.UnixMilli()
	}
	september := ProPeriodAt(at("2026-10-09T12:00:00+08:00"))
	if september.Key != "2026-09" || september.Ends != at("2026-11-01T00:00:00+08:00") {
		t.Fatalf("october = %+v", september)
	}
	// Beijing midnight of 1 November opens the next period.
	if p := ProPeriodAt(at("2026-10-31T23:59:59+08:00")); p.Key != "2026-09" {
		t.Fatalf("31 october = %+v", p)
	}
	november := ProPeriodAt(at("2026-11-01T00:00:00+08:00"))
	if november.Key != "2026-11" || november.Index != september.Index+1 {
		t.Fatalf("november = %+v", november)
	}
	if p := ProPeriodAt(at("2027-01-15T00:00:00+08:00")); p.Key != "2027-01" || p.Index != november.Index+1 {
		t.Fatalf("january = %+v", p)
	}
	seen := map[int]bool{}
	period := september
	for range 6 {
		set := d.ProSet(period)
		if len(set) != 2 || set[0].Rule != RuleTime || set[1].Rule != RuleRival || set[1].Step != set[0].Step+1 {
			t.Fatalf("set %+v", set)
		}
		seen[set[0].Step] = true
		if !d.InProSet(set[1].Step, period) {
			t.Fatal("InProSet")
		}
		period.Index++
	}
	if len(seen) != 6 {
		t.Fatalf("six periods use %d sets", len(seen))
	}
}
