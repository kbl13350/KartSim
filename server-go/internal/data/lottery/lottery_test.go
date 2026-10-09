package lottery

import (
	"slices"
	"testing"
	"time"
)

func defaultData(t *testing.T) *Data {
	t.Helper()
	data, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	return data
}

// The embedded tables hold the latest original lotteries and the summer
// treasure hunt with its four 保底 rewards.
func TestEmbeddedTables(t *testing.T) {
	data := defaultData(t)
	gem, ok := data.Lottery(1241)
	if !ok || gem.Name != "光明骑士幸运宝石" || gem.Key != 862 || len(gem.Sets) != 1 {
		t.Fatalf("1241 %+v", gem)
	}
	box, ok := data.Lottery(776)
	if !ok || len(box.Sets) != 6 {
		t.Fatalf("776 draws one reward from each of 6 sets: %+v", box)
	}
	hunt := data.TreasureHunt()
	if hunt.Theme != "summer" || hunt.Material != 883 || hunt.EventMaterial != 884 || hunt.OtherMaterial != 834 ||
		len(hunt.SlotRewards()) != 9 || len(hunt.PityRewards()) != 4 {
		t.Fatalf("hunt %+v", hunt)
	}
	if mileage, event, ok := data.MileageOf(1233); !ok || event || mileage.Prizes[0].Points != 500 {
		t.Fatalf("mileage 1233 %+v %v %v", mileage, event, ok)
	}
	if !data.IsCountItem(ItemKey{Category, 1241}) || data.IsCountItem(ItemKey{1, 2}) {
		t.Fatal("count items: lottery items stack, characters do not")
	}
	if currency, ok := CurrencyOf(ItemKey{56, 1}); !ok || currency != "koin" {
		t.Fatal("56:1 is the koin")
	}
}

// 保底 rewards are drawn with 1/(2N), the other slots with 0.5%, and the
// rest share what is left; rarities follow the 保底 length.
func TestTreasureHuntProbabilities(t *testing.T) {
	hunt := defaultData(t).TreasureHunt()
	var others int64
	rarities := map[int]string{}
	for i, reward := range hunt.Rewards {
		switch {
		case reward.AcquireCount > 0:
			if want := int64(ProbabilityScale / (2 * reward.AcquireCount)); hunt.Weight(i) != want {
				t.Errorf("保底 %d: weight %d, want %d", reward.StockID, hunt.Weight(i), want)
			}
		case reward.Summary > 0:
			if hunt.Weight(i) != SlotProbability {
				t.Errorf("slot %d: weight %d", reward.Summary, hunt.Weight(i))
			}
		default:
			if others == 0 {
				others = hunt.Weight(i)
			} else if hunt.Weight(i) != others {
				t.Errorf("other reward %d: weight %d, want %d", reward.StockID, hunt.Weight(i), others)
			}
		}
		if reward.Summary > 0 {
			rarities[reward.Summary] = hunt.Rarity(i)
		}
	}
	if hunt.TotalWeight() > ProbabilityScale || hunt.TotalWeight() < ProbabilityScale-int64(len(hunt.Rewards)) {
		t.Errorf("total %d", hunt.TotalWeight())
	}
	// Slots 1-4 are the 保底 rewards at 750, 450, 150 and 50 draws.
	want := map[int]string{1: RarityUltimate, 2: RarityLegend, 3: RarityUnique, 4: RarityEpic, 5: RarityRare}
	for slot, rarity := range want {
		if rarities[slot] != rarity {
			t.Errorf("slot %d: rarity %s, want %s", slot, rarities[slot], rarity)
		}
	}
	pity := hunt.PityRewards()
	if hunt.Rewards[pity[0]].AcquireCount != 50 || hunt.Rewards[pity[3]].AcquireCount != 750 {
		t.Errorf("pity order %v", pity)
	}
}

type fixed int64

func (f fixed) Int64N(n int64) int64 { return int64(f) % n }

func TestRewardSetDrawSkipsZeroWeights(t *testing.T) {
	set := &RewardSet{Rewards: []Reward{{StockID: 1, Weight: 0}, {StockID: 2, Weight: 3}, {StockID: 3, Weight: 0},
		{StockID: 4, Weight: 1}}}
	set.total = 4
	for pick, want := range map[int64]int{0: 2, 2: 2, 3: 4} {
		if got := set.Draw(fixed(pick)); got == nil || got.StockID != want {
			t.Errorf("pick %d: %+v, want stock %d", pick, got, want)
		}
	}
	empty := &RewardSet{Rewards: []Reward{{StockID: 1}}}
	if empty.Draw(fixed(0)) != nil {
		t.Error("a set without weights draws nothing")
	}
}

func TestPacks(t *testing.T) {
	data := defaultData(t)
	gem, _ := data.Lottery(1241)
	var ids []int
	for _, pack := range data.LotteryPacks(gem) {
		ids = append(ids, pack.StockID)
	}
	// The gem packs and the 幸运车胎 packs, not every old bundle with some 车胎.
	for _, id := range []int{32323, 32326, 22779} {
		if !slices.Contains(ids, id) {
			t.Errorf("1241 packs %v lack %d", ids, id)
		}
	}
	if slices.Contains(ids, 29656) {
		t.Errorf("1241 packs %v list the 51特殊礼包 bundle", ids)
	}
	var hunt []int
	for _, pack := range data.HuntPacks(data.TreasureHunt()) {
		hunt = append(hunt, pack.StockID)
	}
	for _, id := range []int{28445, 32023, 32139} {
		if !slices.Contains(hunt, id) {
			t.Errorf("hunt packs %v lack %d", hunt, id)
		}
	}
	if pack, ok := data.Pack(32023); !ok || pack.Currency != "coupon" || pack.Price != 47 {
		t.Errorf("pack 32023 %+v", pack)
	}
}

func TestActivities(t *testing.T) {
	data := defaultData(t)
	for _, activity := range []string{ActivityTreasureHunt, ActivityGacha, "lottery:1241"} {
		if _, err := data.ParseActivity(activity); err != nil {
			t.Errorf("%s: %v", activity, err)
		}
	}
	for _, activity := range []string{"", "lottery:", "lottery:0", "lottery:01241", "lottery:99999", "shop"} {
		if _, err := data.ParseActivity(activity); err == nil {
			t.Errorf("%q accepted", activity)
		}
	}
	hunt := data.DefaultDaily(ActivityTreasureHunt)
	if len(hunt) != 2 || hunt[0].Key() != (ItemKey{MaterialCategory, 884}) || hunt[1].Key() != (ItemKey{MaterialCategory, 834}) ||
		hunt[0].Count != DailyItemCount {
		t.Errorf("hunt daily %+v", hunt)
	}
	if gacha := data.DefaultDaily(ActivityGacha); len(gacha) != 2 || gacha[0].ItemID != 1242 || gacha[1].ItemID != 862 {
		t.Errorf("gacha daily %+v", gacha)
	}
	if len(data.DefaultDaily("lottery:1241")) != 0 {
		t.Error("a single lottery has no daily items")
	}
	if items, err := data.ParseDaily(`[{"category":34,"itemId":884,"count":3,"days":0}]`); err != nil || len(items) != 1 {
		t.Errorf("parse daily %+v %v", items, err)
	}
	for _, raw := range []string{`[{"category":34,"itemId":999999,"count":3}]`, `[{"category":34,"itemId":884,"count":0}]`,
		`[{"category":34,"itemId":884,"count":1,"days":-1}]`, `{}`} {
		if _, err := data.ParseDaily(raw); err == nil {
			t.Errorf("daily %s accepted", raw)
		}
	}
	start, end := int64(100), int64(200)
	for now, want := range map[int64]bool{99: false, 100: true, 199: true, 200: false} {
		if (Setting{Enabled: true, Start: &start, End: &end}).Open(now) != want {
			t.Errorf("open at %d", now)
		}
	}
	if (Setting{}).Open(150) {
		t.Error("a disabled activity is closed")
	}
}

// The 我的物品 box opening (store OpenBox): the union of the sets while the
// original period runs, one draw by weight.

func TestExpeditionBoxes(t *testing.T) {
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC).UnixMilli()
	for _, box := range []struct{ id, rewards int }{{1228, 175}, {1007, 243}, {1008, 498}} {
		l, ok := d.Lottery(box.id)
		if !ok {
			t.Fatalf("box %d missing", box.id)
		}
		rewards := d.Rewards(l, now)
		var total int64
		for _, reward := range rewards {
			total += reward.Weight
			if len(d.Stock(reward.StockID)) == 0 {
				t.Fatalf("box %d reward stock %d has no items", box.id, reward.StockID)
			}
		}
		if len(rewards) != box.rewards || total != 10000 {
			t.Fatalf("box %d: %d rewards weighing %d", box.id, len(rewards), total)
		}
	}
	if d.Name(24, 1228) != "探险队补给箱" || d.Name(34, 879) != "" && d.Name(34, 879) != "探险币" {
		t.Fatalf("names %q %q", d.Name(24, 1228), d.Name(34, 879))
	}
	ruby, _ := d.Lottery(1007)
	if after := time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(); d.Rewards(ruby, after) != nil {
		t.Fatal("the ruby box opens after its period")
	}
}

func TestDrawFollowsWeights(t *testing.T) {
	rewards := []Reward{{StockID: 1, Weight: 1}, {StockID: 2, Weight: 0}, {StockID: 3, Weight: 3}}
	counts := map[int]int{}
	for n := range 4 {
		reward, ok := Draw(rewards, func(total int) int {
			if total != 4 {
				t.Fatalf("total %d", total)
			}
			return n
		})
		if !ok {
			t.Fatal("no draw")
		}
		counts[reward.StockID]++
	}
	if counts[1] != 1 || counts[2] != 0 || counts[3] != 3 {
		t.Fatalf("draws %v", counts)
	}
	if _, ok := Draw([]Reward{{StockID: 1}}, func(int) int { return 0 }); ok {
		t.Fatal("weightless rewards drew")
	}
}
