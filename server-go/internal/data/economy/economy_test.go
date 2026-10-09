package economy

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
	"time"
)

func mustDefault(t *testing.T) *Data {
	t.Helper()
	data, err := Default()
	if err != nil {
		t.Fatalf("Default: %v", err)
	}
	return data
}

func TestEmbeddedCatalogLoads(t *testing.T) {
	catalog := mustDefault(t).Catalog
	if n := len(catalog.Items); n < 5000 {
		t.Fatalf("catalog has %d items, expected the full garage set (~6000)", n)
	}
	if catalog.OfferCount() < len(catalog.Items) {
		t.Fatalf("%d offers for %d items", catalog.OfferCount(), len(catalog.Items))
	}
	categories := map[int]int{}
	for i := range catalog.Items {
		item := &catalog.Items[i]
		categories[item.Category]++
		if i > 0 {
			prev := &catalog.Items[i-1]
			if prev.Category > item.Category || (prev.Category == item.Category && prev.ItemID >= item.ItemID) {
				t.Fatalf("items not sorted by (category, itemId) at %d", i)
			}
		}
	}
	for category := range Kinds {
		if categories[category] == 0 {
			t.Errorf("no items in sellable category %d (%s)", category, Kinds[category])
		}
	}
	if string(catalog.JSON()) != string(embeddedCatalog) {
		t.Fatal("JSON() must return the embedded document")
	}
}

func TestItemByKeyAndOfferByID(t *testing.T) {
	catalog := mustDefault(t).Catalog
	kart, ok := catalog.ItemByKey(3, 387)
	if !ok {
		t.Fatal("kart 387 missing")
	}
	if kart.Name != "尖锋6.5" || kart.Kind != "kart" || kart.InternalID != "saber10" ||
		kart.Tab != "kartBody" || kart.SubTab != "speedKart" || kart.KartType != 2 ||
		kart.EngineGrade == nil || *kart.EngineGrade != 2 {
		t.Fatalf("kart 387 = %+v", kart)
	}
	// ECONOMY.md 3.2 applied to stock.kml: one offer per (currency, days, count).
	want := []Offer{
		{OfferID: "s5177", Currency: Coupon, Price: 95, Days: 10, Count: 1, Source: SourceOriginal},
		{OfferID: "s5178", Currency: Coupon, Price: 120, Days: 30, Count: 1, Source: SourceOriginal},
		{OfferID: "s5179", Currency: Coupon, Price: 200, Days: 365, Count: 1, Source: SourceOriginal},
		{OfferID: "s5075", Currency: Coupon, Price: 216, Days: 0, Count: 1, Source: SourceOriginal},
	}
	if !slices.Equal(kart.Offers, want) || kart.Marks != nil {
		t.Fatalf("kart 387 offers = %+v marks %v", kart.Offers, kart.Marks)
	}
	permanent := &kart.Offers[3]
	item, offer, ok := catalog.OfferByID(permanent.OfferID)
	if !ok || item.Key() != (ItemKey{3, 387}) || offer != *permanent {
		t.Fatalf("OfferByID(%s) = %+v %+v %v", permanent.OfferID, item, offer, ok)
	}

	character, ok := catalog.ItemByKey(1, 2)
	if !ok || character.Name != "皮蛋" || character.Tab != "character" || character.SubTab != "character" ||
		character.EngineGrade != nil || character.KartType != 0 {
		t.Fatalf("character 2 = %+v", character)
	}
	if _, ok := catalog.ItemByKey(3, 0); ok {
		t.Fatal("system karts (itemId 0) must not be sellable")
	}
	if _, ok := catalog.ItemByKey(24, 1); ok {
		t.Fatal("lottery items are not sellable")
	}
	if _, _, ok := catalog.OfferByID("s0"); ok {
		t.Fatal("unknown offer found")
	}
}

// rentalOnlyCategories are the categories stock.kml never grants
// permanently (headPhone, rpLucciBonus, goItemSkinCard, tachometer); the
// exporter gives their estimated items one original-style rental instead of
// a permanent price.
var rentalOnlyCategories = map[int]bool{12: true, 32: true, 58: true, 61: true}

// dominated mirrors the exporter rule: another offer of the item in the same
// currency is no dearer, lasts at least as long, grants at least as many and
// needs no more exp.
func dominated(item *Item, offer Offer) (Offer, bool) {
	for _, other := range item.Offers {
		covers := other.Days == 0 || (offer.Days != 0 && other.Days >= offer.Days)
		if other.OfferID != offer.OfferID && other.Currency == offer.Currency && other.Price <= offer.Price &&
			covers && other.Count >= offer.Count && other.MinExp <= offer.MinExp {
			return other, true
		}
	}
	return Offer{}, false
}

func TestOffersFollowExportRules(t *testing.T) {
	catalog := mustDefault(t).Catalog
	var estimated, minExp, balloons int
	for i := range catalog.Items {
		item := &catalog.Items[i]
		sources := map[string]bool{}
		for _, offer := range item.Offers {
			if by, ok := dominated(item, offer); ok {
				t.Errorf("%d:%d: offer %s is dominated by %s", item.Category, item.ItemID, offer.OfferID, by.OfferID)
			}
			if rentalOnlyCategories[item.Category] && offer.Permanent() {
				t.Errorf("%d:%d: permanent offer %s in a rental-only category", item.Category, item.ItemID, offer.OfferID)
			}
			sources[offer.Source] = true
			if offer.Currency == Lucci && (offer.Price >= 1_000_000 || offer.Price < 10) {
				t.Errorf("%s: lucci placeholder/token price %d kept", offer.OfferID, offer.Price)
			}
			if offer.Currency == Coupon && offer.Price >= 100_000 {
				t.Errorf("%s: coupon placeholder %d kept", offer.OfferID, offer.Price)
			}
			if offer.MinExp > 0 {
				minExp++
			}
		}
		if len(sources) != 1 {
			t.Errorf("%d:%d mixes original and estimated offers", item.Category, item.ItemID)
		}
		if sources[SourceEstimated] {
			estimated++
			if rentalOnlyCategories[item.Category] {
				if len(item.Offers) != 1 {
					t.Errorf("%d:%d: rental-only estimate has %d offers", item.Category, item.ItemID, len(item.Offers))
				}
			} else if !slices.ContainsFunc(item.Offers, Offer.Permanent) {
				t.Errorf("%d:%d: estimated offers lack a permanent option", item.Category, item.ItemID)
			}
		}
		if item.Category == 9 {
			balloons++
			if !item.IsAdditional {
				t.Errorf("balloon %d is not count-based", item.ItemID)
			}
		}
	}
	if estimated == 0 || estimated == len(catalog.Items) {
		t.Fatalf("estimated items = %d of %d", estimated, len(catalog.Items))
	}
	if minExp == 0 {
		t.Fatal("no offer keeps rpLimit as minExp")
	}
	if balloons == 0 {
		t.Fatal("no balloons")
	}
	// Aura 2 (翠绿炫光) has original rentals that need exp >= 600.
	aura, _ := catalog.ItemByKey(26, 2)
	if aura == nil || !slices.ContainsFunc(aura.Offers, func(o Offer) bool { return o.MinExp == 600 }) {
		t.Fatalf("aura 2 offers = %+v", aura)
	}
}

func TestOfferCleanups(t *testing.T) {
	catalog := mustDefault(t).Catalog
	offerIDs := func(category, itemID int) []string {
		item, ok := catalog.ItemByKey(category, itemID)
		if !ok {
			t.Fatalf("item %d:%d missing", category, itemID)
		}
		ids := make([]string, len(item.Offers))
		for i, offer := range item.Offers {
			ids[i] = offer.OfferID
		}
		return ids
	}
	for _, tc := range []struct {
		category, itemID int
		want             []string
		why              string
	}{
		// Event tokens (onBuyOk setEventTemp, < 25% of the ordinary median) are dropped.
		{1, 267, []string{"s20432", "s24262"}, "布蕾: event 70 permanent -> ordinary 350; koin 15d 49 dominated by 30d 35"},
		{3, 849, []string{"s12944", "s10959"}, "棉花糖 9: the 11-koin event stock is dropped, 88 koin kept"},
		{3, 874, []string{"e3-874-30", "e3-874-0"}, "暴龙 9: only an 11-koin event stock, so estimated"},
		{3, 946, []string{"e3-946-30", "e3-946-0"}, "勇往直前的皮蛋: only a 10-coupon 30-day event stock"},
		// Dominated offers are dropped.
		{9, 126, []string{"s4507", "s4508"}, "龙舟气球: the 30-pack for 10,000 is dearer than the 50-pack for 20"},
		{2, 7, []string{"s13750", "s20058", "s6", "s25843"}, "紫色喷漆: lucci 30d 2,000 > permanent 700"},
		{3, 357, []string{"s7788", "s9040"}, "尖锋 Z7+: 30d 284 / 365d 396 > permanent 275"},
		{1, 32, []string{"s4392", "s15949"}, "美美: 3d 20 and 7d 120 > 10d 15"},
		{8, 125, []string{"s13748", "s24717"}, "豹纹护目镜: 30d 202 > 100d 33"},
		// Rental-only categories copy the original rental terms.
		{32, 4, []string{"e32-4-7"}, "+50%经验卡: estimated 7-day rental, never permanent"},
		{61, 1, []string{"e61-1-30"}, "滴哒出租车仪表盘: estimated 30-day rental"},
	} {
		if got := offerIDs(tc.category, tc.itemID); !slices.Equal(got, tc.want) {
			t.Errorf("%d:%d offers %v, want %v (%s)", tc.category, tc.itemID, got, tc.want, tc.why)
		}
	}
	if _, _, ok := catalog.OfferByID("s987"); ok {
		t.Error("dominated balloon pack s987 is still sold")
	}
	if item, offer, ok := catalog.OfferByID("s20432"); !ok || item.ItemID != 267 || offer.Price != 350 || !offer.Permanent() {
		t.Errorf("s20432 = %+v %+v %v", item, offer, ok)
	}
	if item, ok := catalog.ItemByKey(11, 30010); !ok {
		t.Error("item 11:30010 missing")
	} else if strings.Contains(item.Desc, "\t") || !strings.Contains(item.Desc, "\r\n  ") {
		t.Errorf("11:30010 desc must keep the &#xD;&#xA; break and turn literal tabs into spaces: %q", item.Desc)
	}
}

func TestStarter(t *testing.T) {
	starter := &mustDefault(t).Catalog.Starter
	if starter.Kart.SystemKey != "practiceKart" || starter.Kart.ItemID != 0 || starter.Kart.Category != 3 {
		t.Fatalf("starter kart = %+v", starter.Kart)
	}
	if !slices.Equal(starter.Characters, []int{2, 3}) || starter.DefaultCharacter != 2 {
		t.Fatalf("starter characters = %v default %d", starter.Characters, starter.DefaultCharacter)
	}
	// etc_/newRiderItem@cn.xml defaults (defalutId 4), valid in both color lists.
	if starter.DefaultPaint != 4 || starter.DefaultDye != 4 {
		t.Fatalf("starter default paint/dye = %d/%d, want 4/4", starter.DefaultPaint, starter.DefaultDye)
	}
	for _, list := range [][]int{starter.Paints, starter.Dyes} {
		if !slices.Equal(list, []int{6, 4, 5, 7}) {
			t.Fatalf("starter colors = %v, want original newRiderItem@cn 6/4/5/7", list)
		}
	}
	for id, want := range map[int]bool{2: true, 3: true, 1: false, 4: false} {
		if starter.AllowsCharacter(id) != want {
			t.Errorf("AllowsCharacter(%d) = %v", id, !want)
		}
	}
	if starter.AllowsPaint(1) || !starter.AllowsPaint(6) || starter.AllowsDye(1) || !starter.AllowsDye(7) {
		t.Fatal("paint/dye whitelist wrong")
	}
}

func TestLevelForExp(t *testing.T) {
	levels := mustDefault(t).Levels
	if levels.MaxLevel() != 126 || levels.RPLimit != 75_000_000 {
		t.Fatalf("max level %d, rpLimit %d", levels.MaxLevel(), levels.RPLimit)
	}
	for _, tc := range []struct {
		exp                 int64
		level               int
		start, next, capped int64
		glove, gloveName    string
	}{
		{-5, 1, 0, 70, 0, "노랑5", "黄色手套5"},
		{0, 1, 0, 70, 0, "노랑5", "黄色手套5"},
		{1, 1, 0, 70, 1, "노랑5", "黄色手套5"},
		{69, 1, 0, 70, 69, "노랑5", "黄色手套5"},
		{70, 2, 70, 148, 70, "노랑4", "黄色手套4"},
		{147, 2, 70, 148, 147, "노랑4", "黄色手套4"},
		{148, 3, 148, 262, 148, "노랑3", "黄色手套3"},
		{9899, 15, 7800, 9900, 9899, "파랑1", "蓝色手套1"},
		{9900, 16, 9900, 11878, 9900, "빨강5", "红色手套5"},
		{61270, 31, 61270, 66268, 61270, "스타노랑5", "黄色星星手套5"},
		{63262843, 125, 53603959, 63262844, 63262843, "금뱃지검정", "黑金徽章"},
		{63262844, 126, 63262844, 75_000_000, 63262844, "금뱃지무지개", "彩虹金徽章"},
		{75_000_000, 126, 63262844, 75_000_000, 75_000_000, "금뱃지무지개", "彩虹金徽章"},
		{90_000_000, 126, 63262844, 75_000_000, 75_000_000, "금뱃지무지개", "彩虹金徽章"},
	} {
		got := levels.LevelForExp(tc.exp)
		want := Progress{Level: tc.level, Exp: tc.capped, LevelStartExp: tc.start, NextLevelExp: tc.next,
			Glove: tc.glove, GloveName: tc.gloveName, MaxLevel: 126}
		if got != want {
			t.Errorf("LevelForExp(%d)\n got %+v\nwant %+v", tc.exp, got, want)
		}
	}
	// Every threshold starts its level and the exp just below it ends the previous one.
	for level := 2; level <= levels.MaxLevel(); level++ {
		threshold := levels.Levels[level-1].NextExp
		if got := levels.LevelForExp(threshold); got.Level != level || got.LevelStartExp != threshold {
			t.Fatalf("exp %d -> %+v, want level %d", threshold, got, level)
		}
		if got := levels.LevelForExp(threshold - 1); got.Level != level-1 || got.NextLevelExp != threshold {
			t.Fatalf("exp %d -> %+v, want level %d", threshold-1, got, level-1)
		}
	}
	encoded, _ := json.Marshal(levels.LevelForExp(70))
	if !strings.Contains(string(encoded), `"levelExp":70`) || !strings.Contains(string(encoded), `"nextLevelExp":148`) {
		t.Fatalf("progress JSON = %s", encoded)
	}
}

func TestLevelUpRewards(t *testing.T) {
	levels := mustDefault(t).Levels
	if got := levels.LevelUpRewards(1, 3); !slices.Equal(got, []LevelReward{
		{Level: 2, Lucci: 200}, {Level: 3, Lucci: 300, Koin: 20},
	}) {
		t.Fatalf("1->3 = %+v", got)
	}
	if got := levels.LevelUpRewards(9, 10); !slices.Equal(got, []LevelReward{
		{Level: 10, Lucci: 1000, Coupon: 50},
	}) {
		t.Fatalf("9->10 = %+v", got)
	}
	// Original koin table: 109 -> 20, 115 -> 30, 121 -> 50 (not the plain mod-6 rule).
	total := TotalReward(levels.LevelUpRewards(108, 126))
	want := LevelReward{Level: 126, Lucci: 100 * (109 + 126) * 18 / 2, Koin: 20 + 30 + 50, Coupon: 2 * 50}
	if total != want {
		t.Fatalf("108->126 total = %+v, want %+v", total, want)
	}
	for _, tc := range [][2]int{{5, 5}, {7, 3}, {126, 200}, {0, 1}, {-3, 1}} {
		if got := levels.LevelUpRewards(tc[0], tc[1]); got != nil {
			t.Errorf("LevelUpRewards(%d, %d) = %+v, want none", tc[0], tc[1], got)
		}
	}
	if got := levels.LevelUpRewards(0, 2); !slices.Equal(got, []LevelReward{{Level: 2, Lucci: 200}}) {
		t.Fatalf("0->2 must count from display level 1: %+v", got)
	}
	if got := levels.LevelUpRewards(125, 300); len(got) != 1 || got[0].Level != 126 {
		t.Fatalf("125->300 = %+v", got)
	}
	koinLevels := 0
	for level := 1; level <= levels.MaxLevel(); level++ {
		if levels.KoinRewards[level] > 0 {
			koinLevels++
		}
	}
	if koinLevels != 21 || levels.KoinRewards[3] != 20 || levels.KoinRewards[105] != 20 {
		t.Fatalf("koin table = %v", levels.KoinRewards)
	}
	// Exp 0 (display Lv1) to 148 (Lv3): two level-ups; a new account gets nothing for Lv1.
	if got := levels.LevelUpsForExp(0, 148); len(got) != 2 || got[0].Level != 2 || got[1].Level != 3 {
		t.Fatalf("LevelUpsForExp(0, 148) = %+v", got)
	}
	if got := levels.LevelUpsForExp(0, 1); got != nil {
		t.Fatalf("LevelUpsForExp(0, 1) = %+v", got)
	}
}

// fixture returns a minimal valid catalog and level document as generic
// JSON so tests can break one field at a time.
func fixture() (catalog, levels map[string]any) {
	offer := func(id, currency string, price, days int, source string) map[string]any {
		return map[string]any{"offerId": id, "currency": currency, "price": price, "days": days,
			"count": 1, "source": source}
	}
	item := func(category, id int, kind, tab, sub string, offers ...map[string]any) map[string]any {
		list := make([]any, len(offers))
		for i, o := range offers {
			list[i] = o
		}
		return map[string]any{"category": category, "itemId": id, "kind": kind, "internalId": kind,
			"name": kind, "tab": tab, "subTab": sub, "offers": list}
	}
	kart := item(3, 387, "kart", "kartBody", "speedKart", offer("s2603", "coupon", 485, 0, "original"))
	kart["engineGrade"], kart["kartType"] = 2, 2
	place := func(item map[string]any, category, sub, display string) map[string]any {
		item["shopCategory"], item["displayOfferId"] = category, display
		if sub != "" {
			item["shopSubCategory"] = sub
		}
		return item
	}
	subTab := func(id, name string, items ...any) map[string]any {
		return map[string]any{"id": id, "name": name, "cardItems": append([]any{}, items...)}
	}
	character := place(item(1, 2, "character", "character", "character", offer("s1", "lucci", 5000, 0, "original")),
		"character", "", "s1")
	character["recommend"], character["marks"] = []any{"new"}, []any{"new"}
	catalog = map[string]any{
		"version":       strings.Repeat("a", 64),
		"generatedFrom": "test",
		"currencies": []any{
			map[string]any{"id": "coupon", "name": "点券", "priceType": 0},
			map[string]any{"id": "lucci", "name": "金币", "priceType": 1},
			map[string]any{"id": "koin", "name": "K币", "priceType": 3},
		},
		"tabs": []any{
			map[string]any{"id": "recommend", "name": "推荐", "subTabs": []any{}},
			map[string]any{"id": "kartBody", "name": "卡丁车", "subTabs": []any{
				map[string]any{"id": "speedKart", "name": "竞速车"}}},
			map[string]any{"id": "character", "name": "角色", "subTabs": []any{
				map[string]any{"id": "character", "name": "角色"}}},
			map[string]any{"id": "equip", "name": "装备", "subTabs": []any{
				map[string]any{"id": "color", "name": "喷漆"}, map[string]any{"id": "dye", "name": "染色"}}},
		},
		"shopTabs": []any{
			map[string]any{"id": "recommand", "name": "推荐", "defaultSubTab": "new", "subTabs": []any{
				subTab("new", "新商品", "1:2"), subTab("hotItem", "热门商品")}},
			map[string]any{"id": "kartBody", "name": "卡丁车", "allSubTab": "全部", "subTabs": []any{
				subTab("engineXun", "迅 引擎"), subTab("engineV1", "V1 引擎"), subTab("engineEtc", "其他引擎", "3:387")}},
			map[string]any{"id": "character", "name": "角色", "subTabs": []any{}, "cardItems": []any{"1:2"}},
			map[string]any{"id": "equip", "name": "装备", "allSubTab": "全部", "subTabs": []any{
				subTab("color", "喷漆"), subTab("dye", "染色剂", "70:6"), subTab("couple", "情侣")}},
		},
		"starter": map[string]any{
			"kart":       map[string]any{"category": 3, "itemId": 0, "systemKey": "practiceKart", "internalId": "practiceV1", "name": "练习车"},
			"characters": []any{2}, "defaultCharacter": 2, "paints": []any{6}, "defaultPaint": 6,
			"dyes": []any{6}, "defaultDye": 6,
		},
		"items": []any{
			character,
			place(item(2, 6, "color", "equip", "color", offer("e2-6-0", "coupon", 199, 0, "estimated"),
				offer("e2-6-30", "coupon", 66, 30, "estimated")), "equip", "color", "e2-6-0"),
			place(kart, "kartBody", "engineEtc", "s2603"),
			place(item(70, 6, "dye", "equip", "dye", offer("s25850", "koin", 6, 7, "original")), "equip", "dye", "s25850"),
		},
	}
	levels = map[string]any{
		"version": strings.Repeat("b", 64), "generatedFrom": "test", "rpLimit": 1000,
		"levels": []any{
			map[string]any{"level": 0, "nextExp": 1, "glove": "g", "gloveName": "G", "tryLevel": 1},
			map[string]any{"level": 1, "nextExp": 70, "glove": "g", "gloveName": "G", "tryLevel": 1},
			map[string]any{"level": 2, "glove": "g2", "gloveName": "G2", "tryLevel": 1},
		},
		"koinRewards": map[string]any{"2": 20},
	}
	return catalog, levels
}

func parseFixture(t *testing.T, catalog, levels map[string]any) error {
	t.Helper()
	c, err := json.Marshal(catalog)
	if err != nil {
		t.Fatal(err)
	}
	l, err := json.Marshal(levels)
	if err != nil {
		t.Fatal(err)
	}
	_, err = Parse(c, l)
	return err
}

func TestParseFixture(t *testing.T) {
	catalog, levels := fixture()
	if err := parseFixture(t, catalog, levels); err != nil {
		t.Fatalf("valid fixture rejected: %v", err)
	}
	c, _ := json.Marshal(catalog)
	l, _ := json.Marshal(levels)
	data, err := Parse(c, l)
	if err != nil {
		t.Fatal(err)
	}
	if p := data.Levels.LevelForExp(5000); p.Level != 2 || p.Exp != 1000 || p.NextLevelExp != 1000 {
		t.Fatalf("fixture max level progress = %+v", p)
	}
}

func TestParseRejectsInvalidData(t *testing.T) {
	items := func(c map[string]any) []any { return c["items"].([]any) }
	itemAt := func(c map[string]any, i int) map[string]any { return items(c)[i].(map[string]any) }
	firstOffer := func(c map[string]any, i int) map[string]any {
		return itemAt(c, i)["offers"].([]any)[0].(map[string]any)
	}
	shopTab := func(c map[string]any, i int) map[string]any { return c["shopTabs"].([]any)[i].(map[string]any) }
	for name, tc := range map[string]struct {
		catalog func(map[string]any)
		levels  func(map[string]any)
		want    string
	}{
		"duplicate offerId": {catalog: func(c map[string]any) {
			firstOffer(c, 3)["offerId"], itemAt(c, 3)["displayOfferId"] = "s1", "s1"
		}, want: "duplicate offerId"},
		"zero price":       {catalog: func(c map[string]any) { firstOffer(c, 0)["price"] = 0 }, want: "price 0"},
		"unknown currency": {catalog: func(c map[string]any) { firstOffer(c, 0)["currency"] = "luccon" }, want: "unknown currency"},
		"zero count":       {catalog: func(c map[string]any) { firstOffer(c, 0)["count"] = 0 }, want: "count 0"},
		"unknown source":   {catalog: func(c map[string]any) { firstOffer(c, 0)["source"] = "guess" }, want: "unknown source"},
		"estimated id":     {catalog: func(c map[string]any) { firstOffer(c, 1)["offerId"] = "e2-7-0" }, want: "e<category>"},
		"original id":      {catalog: func(c map[string]any) { firstOffer(c, 0)["offerId"] = "x1" }, want: "s<stockId>"},
		"same option twice": {catalog: func(c map[string]any) {
			itemAt(c, 0)["offers"] = append(itemAt(c, 0)["offers"].([]any), map[string]any{
				"offerId": "s4089", "currency": "lucci", "price": 1500, "days": 0, "count": 1, "source": "original"})
		}, want: "two offers for lucci/0/1"},
		"unknown category": {catalog: func(c map[string]any) { itemAt(c, 0)["category"] = 24 }, want: "not sellable"},
		"kind mismatch":    {catalog: func(c map[string]any) { itemAt(c, 0)["kind"] = "pet" }, want: "kind"},
		"system kart sold": {catalog: func(c map[string]any) { itemAt(c, 2)["itemId"] = 0 }, want: "itemId must be positive"},
		"duplicate item": {catalog: func(c map[string]any) {
			itemAt(c, 3)["category"], itemAt(c, 3)["itemId"], itemAt(c, 3)["kind"] = 2, 6, "color"
			itemAt(c, 3)["subTab"] = "color"
		}, want: "duplicate item"},
		"unknown tab":       {catalog: func(c map[string]any) { itemAt(c, 0)["subTab"] = "pet" }, want: "unknown tab"},
		"kart without type": {catalog: func(c map[string]any) { delete(itemAt(c, 2), "kartType") }, want: "kartType"},
		"no offers":         {catalog: func(c map[string]any) { itemAt(c, 0)["offers"] = []any{} }, want: "no offers"},
		"unknown mark":      {catalog: func(c map[string]any) { itemAt(c, 0)["marks"] = []any{"sale"} }, want: "unknown mark"},
		"unknown field":     {catalog: func(c map[string]any) { itemAt(c, 0)["price"] = 1 }, want: "unknown field"},
		"bad version":       {catalog: func(c map[string]any) { c["version"] = "v1" }, want: "SHA-256"},
		"missing currency":  {catalog: func(c map[string]any) { c["currencies"] = c["currencies"].([]any)[:2] }, want: "currencies"},
		"starter character missing": {catalog: func(c map[string]any) {
			c["starter"].(map[string]any)["characters"] = []any{2, 3}
		}, want: "starter characters item 1:3"},
		"starter default": {catalog: func(c map[string]any) {
			c["starter"].(map[string]any)["defaultCharacter"] = 3
		}, want: "starter default 3 is not one of the characters"},
		"starter default paint": {catalog: func(c map[string]any) {
			delete(c["starter"].(map[string]any), "defaultPaint")
		}, want: "starter default 0 is not one of the paints"},
		"starter default dye": {catalog: func(c map[string]any) {
			c["starter"].(map[string]any)["defaultDye"] = 1
		}, want: "starter default 1 is not one of the dyes"},
		"starter kart": {catalog: func(c map[string]any) {
			c["starter"].(map[string]any)["kart"].(map[string]any)["itemId"] = 387
		}, want: "system kart"},
		"levels not increasing": {levels: func(l map[string]any) {
			l["levels"].([]any)[1].(map[string]any)["nextExp"] = 1
		}, want: "not increasing"},
		"max level threshold": {levels: func(l map[string]any) {
			l["levels"].([]any)[2].(map[string]any)["nextExp"] = 99
		}, want: "max level"},
		"level numbering": {levels: func(l map[string]any) {
			l["levels"].([]any)[1].(map[string]any)["level"] = 5
		}, want: "has level 5"},
		"rpLimit":        {levels: func(l map[string]any) { l["rpLimit"] = 70 }, want: "rpLimit"},
		"koin level":     {levels: func(l map[string]any) { l["koinRewards"] = map[string]any{"9": 20} }, want: "koin reward"},
		"koin amount":    {levels: func(l map[string]any) { l["koinRewards"] = map[string]any{"2": 0} }, want: "koin reward"},
		"levels unknown": {levels: func(l map[string]any) { l["extra"] = 1 }, want: "unknown field"},
		// The original mall layout.
		"no recommand tab": {catalog: func(c map[string]any) { c["shopTabs"] = c["shopTabs"].([]any)[1:] },
			want: `missing shop tab "recommand"`},
		"recommand with 全部": {catalog: func(c map[string]any) { shopTab(c, 0)["allSubTab"] = "全部" },
			want: "has no 全部"},
		"bad default sub-tab": {catalog: func(c map[string]any) { shopTab(c, 0)["defaultSubTab"] = "event" },
			want: "default sub-tab"},
		"sub-tabs without 全部 or default": {catalog: func(c map[string]any) { delete(shopTab(c, 1), "allSubTab") },
			want: "needs a 全部"},
		"duplicate shop tab": {catalog: func(c map[string]any) { shopTab(c, 3)["id"] = "kartBody" },
			want: "duplicate shop tab"},
		"unknown shopCategory": {catalog: func(c map[string]any) { itemAt(c, 0)["shopCategory"] = "pets" },
			want: "unknown shopCategory"},
		"shopCategory recommand": {catalog: func(c map[string]any) { itemAt(c, 0)["shopCategory"] = "recommand" },
			want: "unknown shopCategory"},
		"missing shopSubCategory": {catalog: func(c map[string]any) { delete(itemAt(c, 2), "shopSubCategory") },
			want: "unknown shopSubCategory kartBody/"},
		"sub-category on a flat tab": {catalog: func(c map[string]any) { itemAt(c, 0)["shopSubCategory"] = "pet" },
			want: "has no sub-categories"},
		"shopSubCategories without the primary": {catalog: func(c map[string]any) {
			itemAt(c, 1)["shopSubCategories"] = []any{"dye", "couple"}
		}, want: "shopSubCategories must list"},
		"shopSubCategories order": {catalog: func(c map[string]any) {
			itemAt(c, 1)["shopSubCategory"], itemAt(c, 1)["shopSubCategories"] = "couple", []any{"couple", "color"}
		}, want: "out of order"},
		"unknown recommend": {catalog: func(c map[string]any) { itemAt(c, 0)["recommend"] = []any{"sale"} },
			want: `recommend: unknown "sale"`},
		"recommend not listed": {catalog: func(c map[string]any) { itemAt(c, 0)["recommend"] = []any{"new", "hotItem"} },
			want: "names 推荐 hotItem"},
		"card item not placed": {catalog: func(c map[string]any) {
			shopTab(c, 1)["subTabs"].([]any)[0].(map[string]any)["cardItems"] = []any{"3:387"}
		},
			want: "kartBody/engineXun lists 3:387"},
		"unknown card item": {catalog: func(c map[string]any) { shopTab(c, 2)["cardItems"] = []any{"1:9"} },
			want: `card item "1:9" unknown`},
		"display offer": {catalog: func(c map[string]any) { itemAt(c, 0)["displayOfferId"] = "s2" },
			want: "displayOfferId"},
		"discount without mark": {catalog: func(c map[string]any) {
			o := firstOffer(c, 0)
			o["originalPrice"], o["discountPercent"], o["discountLabel"] = 6000, 17, "8.3折"
		}, want: `mark "discount"`},
		"discount above price": {catalog: func(c map[string]any) {
			o := firstOffer(c, 0)
			o["originalPrice"], o["discountPercent"], o["discountLabel"] = 4000, 10, "9折"
			itemAt(c, 0)["marks"] = []any{"new", "discount"}
		}, want: "discount 4000 -> 5000"},
		"label without discount": {catalog: func(c map[string]any) { firstOffer(c, 0)["discountLabel"] = "9折" },
			want: "without originalPrice"},
		"limited mark without offer": {catalog: func(c map[string]any) { itemAt(c, 0)["marks"] = []any{"new", "limited"} },
			want: `mark "limited"`},
		"buy limit without limited": {catalog: func(c map[string]any) { firstOffer(c, 0)["buyLimit"] = 1 },
			want: "buyLimit"},
		"repeated mark": {catalog: func(c map[string]any) { itemAt(c, 0)["marks"] = []any{"new", "new"} },
			want: "repeated mark"},
	} {
		t.Run(name, func(t *testing.T) {
			catalog, levels := fixture()
			if tc.catalog != nil {
				tc.catalog(catalog)
			}
			if tc.levels != nil {
				tc.levels(levels)
			}
			err := parseFixture(t, catalog, levels)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want containing %q", err, tc.want)
			}
		})
	}
	if _, err := Parse([]byte(`{}`+"\n"+`{}`), embeddedLevels); err == nil {
		t.Fatal("trailing JSON accepted")
	}
}

func TestEmbeddedTracks(t *testing.T) {
	data := mustDefault(t)
	tracks := data.Tracks
	if tracks == nil || tracks.Len() < 300 {
		t.Fatalf("tracks %v", tracks)
	}
	if again, err := DefaultTracks(); err != nil || again != tracks {
		t.Fatalf("DefaultTracks %p %v, Load used %p", again, err, tracks)
	}
	reverse := 0
	for _, track := range tracks.Tracks {
		if track.Reverse != strings.HasSuffix(track.ID, "_rvs") {
			t.Errorf("track %s reverse flag %v", track.ID, track.Reverse)
		}
		if track.Reverse {
			reverse++
		}
	}
	if reverse == 0 {
		t.Fatal("no reverse tracks")
	}
	// Ids the browser settles; ids are case-sensitive and never trimmed.
	for _, id := range []string{"village_R01", "forest_R02", "village_R01_rvs"} {
		if !tracks.Has(id) {
			t.Errorf("track %s missing", id)
		}
	}
	for _, id := range []string{"", "VILLAGE_R01", "village_R01 ", "junk-track", "village_R02_rvs"} {
		if tracks.Has(id) {
			t.Errorf("track %q accepted", id)
		}
	}
}

func TestParseTracksRejectsInvalidData(t *testing.T) {
	valid := func() map[string]any {
		return map[string]any{"version": strings.Repeat("a", 64), "generatedFrom": "test", "tracks": []any{
			map[string]any{"id": "village_R01", "title": "城镇 高速公路", "gameType": "speed"},
			map[string]any{"id": "village_R01_rvs", "title": "[反]城镇 高速公路", "gameType": "speed", "reverse": true},
		}}
	}
	parse := func(doc map[string]any) error {
		encoded, err := json.Marshal(doc)
		if err != nil {
			t.Fatal(err)
		}
		_, err = ParseTracks(encoded)
		return err
	}
	if err := parse(valid()); err != nil {
		t.Fatalf("valid tracks rejected: %v", err)
	}
	track := func(doc map[string]any, i int) map[string]any { return doc["tracks"].([]any)[i].(map[string]any) }
	for name, tc := range map[string]struct {
		edit func(map[string]any)
		want string
	}{
		"bad version":   {func(d map[string]any) { d["version"] = "v1" }, "SHA-256"},
		"empty":         {func(d map[string]any) { d["tracks"] = []any{} }, "no tracks"},
		"duplicate":     {func(d map[string]any) { track(d, 1)["id"] = "village_R01" }, "duplicate track"},
		"bad id":        {func(d map[string]any) { track(d, 0)["id"] = "a b" }, "invalid track id"},
		"long id":       {func(d map[string]any) { track(d, 0)["id"] = strings.Repeat("x", 65) }, "invalid track id"},
		"game type":     {func(d map[string]any) { track(d, 0)["gameType"] = "battle" }, "gameType"},
		"no title":      {func(d map[string]any) { track(d, 0)["title"] = "" }, "no title"},
		"unknown field": {func(d map[string]any) { track(d, 0)["laps"] = 3 }, "unknown field"},
	} {
		t.Run(name, func(t *testing.T) {
			doc := valid()
			tc.edit(doc)
			if err := parse(doc); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want containing %q", err, tc.want)
			}
		})
	}
}

func TestShopLayout(t *testing.T) {
	catalog := mustDefault(t).Catalog
	var ids []string
	for _, tab := range catalog.ShopTabs {
		ids = append(ids, tab.ID)
	}
	if want := []string{"recommand", "kartBody", "character", "package", "equip", "useful"}; !slices.Equal(ids, want) {
		t.Fatalf("shop tabs %v, want %v", ids, want)
	}
	subTabs := func(id string) (names []string) {
		tab, ok := catalog.ShopTab(id)
		if !ok {
			t.Fatalf("shop tab %s missing", id)
		}
		for _, sub := range tab.SubTabs {
			names = append(names, sub.ID+" "+sub.Name)
		}
		return names
	}
	for id, want := range map[string][]string{
		"recommand": {"new 新商品", "hotItem 热门商品", "event 活动"},
		"kartBody":  {"engineXun 迅 引擎", "engineV1 V1 引擎", "engineEtc 其他引擎", "strengthen 改装部件", "tunningXun 强化材料"},
		"equip": {"balloon 气球", "headband 电磁波头带", "goggle 防尘眼镜", "color 喷漆", "dye 染色剂", "couple 情侣",
			"etc 其它"},
		"useful":    {"specialKit 必杀技", "card 卡片类", "etc 其它"},
		"character": nil,
	} {
		if got := subTabs(id); !slices.Equal(got, want) {
			t.Errorf("%s sub-tabs %v, want %v", id, got, want)
		}
	}
	recommend, _ := catalog.ShopTab("recommand")
	kartBody, _ := catalog.ShopTab("kartBody")
	character, _ := catalog.ShopTab("character")
	if recommend.Name != "推荐" || recommend.DefaultSubTab != "new" || recommend.AllSubTab != "" ||
		kartBody.AllSubTab != "全部" || character.AllSubTab != "" || len(character.CardItems) == 0 ||
		character.CardItems[0] != "1:25" {
		t.Fatalf("推荐 %+v, 卡丁车 %+v, 角色 %+v", recommend, kartBody, character)
	}

	// Engine family: itemTable engineGrade 9 = 迅 (XUN), 8 = V1, the rest other.
	families := map[string]int{}
	for i := range catalog.Items {
		item := &catalog.Items[i]
		if item.Kind != "kart" {
			continue
		}
		want := "engineEtc"
		switch *item.EngineGrade {
		case 9:
			want = "engineXun"
		case 8:
			want = "engineV1"
		}
		if item.ShopCategory != "kartBody" || item.ShopSubCategory != want {
			t.Errorf("kart %d (grade %d) placed %s/%s", item.ItemID, *item.EngineGrade, item.ShopCategory, item.ShopSubCategory)
		}
		families[want]++
	}
	if families["engineXun"] == 0 || families["engineV1"] == 0 || families["engineEtc"] == 0 {
		t.Fatalf("engine families %v", families)
	}
	// The karts the original lists under 迅 / V1 are XUN / V1 karts.
	for _, sub := range kartBody.SubTabs[:2] {
		if len(sub.CardItems) == 0 {
			t.Fatalf("%s lists no karts", sub.ID)
		}
		for _, key := range sub.CardItems {
			item, err := catalog.itemByText(key)
			if err != nil || item.ShopSubCategory != sub.ID {
				t.Errorf("%s card %s: %v %+v", sub.ID, key, err, item)
			}
		}
	}

	item := func(category, itemID int) *Item {
		t.Helper()
		found, ok := catalog.ItemByKey(category, itemID)
		if !ok {
			t.Fatalf("item %d:%d missing", category, itemID)
		}
		return found
	}
	// 概念车I 迅: 限购 5 on its engineXun card.
	if xun := item(3, 1513); xun.ShopSubCategory != "engineXun" || !slices.Equal(xun.Marks, []string{MarkLimited}) ||
		!xun.DisplayOffer().Limited || xun.DisplayOffer().BuyLimit != 5 {
		t.Errorf("3:1513 = %+v", xun)
	}
	// 轰炸机 V1: the card shows its first stock (7 days, 89 coupons).
	if v1 := item(3, 1412); v1.ShopSubCategory != "engineV1" || v1.DisplayOfferID != "s26497" || v1.Marks != nil {
		t.Errorf("3:1412 = %+v", v1)
	}
	if balloon := item(9, 1322); balloon.ShopCategory != "equip" || balloon.ShopSubCategory != "balloon" ||
		balloon.ShopSubCategories != nil || !balloon.InShopSubCategory("balloon") || balloon.InShopSubCategory("couple") {
		t.Errorf("9:1322 = %+v", balloon)
	}
	// 钻戒气球 is sold to couples: listed under 气球 and 情侣.
	if couple := item(9, 1483); couple.ShopSubCategory != "couple" ||
		!slices.Equal(couple.ShopSubCategories, []string{"balloon", "couple"}) || !couple.InShopSubCategory("balloon") {
		t.Errorf("9:1483 = %+v", couple)
	}
	// SVIP通行证手杖: 9折 (400 -> 360) and 限购 1 on every 推荐 page.
	svip := item(16, 364)
	shown := svip.DisplayOffer()
	if svip.ShopSubCategory != "etc" || !slices.Equal(svip.Recommend, []string{"new", "hotItem", "event"}) ||
		!slices.Equal(svip.Marks, []string{MarkDiscount, MarkLimited}) || shown.OfferID != "s26914" ||
		shown.Price != 360 || shown.OriginalPrice != 400 || shown.DiscountPercent != 10 || shown.DiscountLabel != "9折" ||
		!shown.Limited || shown.BuyLimit != 1 {
		t.Errorf("16:364 = %+v, shown %+v", svip, shown)
	}
	if dao := item(1, 2); !slices.Equal(dao.Recommend, []string{"hotItem"}) || !slices.Equal(dao.Marks, []string{MarkHot}) ||
		dao.DisplayOfferID != "s23292" || dao.ShopCategory != "character" || dao.ShopSubCategory != "" {
		t.Errorf("1:2 = %+v", dao)
	}
	if card := item(32, 2); card.ShopCategory != "useful" || card.ShopSubCategory != "card" {
		t.Errorf("32:2 = %+v", card)
	}
	if camera := item(12, 1); camera.ShopCategory != "useful" || camera.ShopSubCategory != "etc" {
		t.Errorf("12:1 = %+v", camera)
	}
}

func TestEmbeddedEvents(t *testing.T) {
	events := mustDefault(t).Events
	if again, err := DefaultEvents(); err != nil || again != events {
		t.Fatalf("DefaultEvents %p %v, Load used %p", again, err, events)
	}
	if len(events.TCCashEvents) != 1 {
		t.Fatalf("events %+v", events.TCCashEvents)
	}
	event := &events.TCCashEvents[0]
	var values []int64
	for _, step := range event.Steps {
		values = append(values, step.Value)
	}
	last := event.Steps[len(event.Steps)-1].Reward
	if event.EventType != SpendEventType || event.EventPeriod.Start != "2026-09-17T06:00:00+08:00" ||
		event.EventPeriod.End != "2026-10-15T05:59:59+08:00" || event.RewardPeriod.End != "2026-10-22T05:59:59+08:00" ||
		!slices.Equal(values, []int64{1000, 2000, 5000, 8000}) ||
		last != (EventReward{Name: "孔明灯车手栏背景", Category: 71, ItemID: 16, Count: 1, IconHint: "slotBg"}) {
		t.Fatalf("event %+v", event)
	}
	at := func(text string) time.Time {
		parsed, err := time.Parse(time.RFC3339Nano, text)
		if err != nil {
			t.Fatal(err)
		}
		return parsed
	}
	for _, tc := range []struct {
		at            string
		shown, active bool
	}{
		{"2026-09-17T05:59:59.999+08:00", false, false},
		{"2026-09-16T22:00:00Z", true, true},
		{"2026-10-15T05:59:59.999+08:00", true, true},
		{"2026-10-15T06:00:00+08:00", true, false},
		{"2026-10-22T05:59:59.5+08:00", true, false},
		{"2026-10-22T06:00:00+08:00", false, false},
	} {
		found, ok := events.SpendEventAt(at(tc.at))
		if ok != tc.shown || (ok && (found != event || found.Active(at(tc.at)) != tc.active)) {
			t.Errorf("%s: shown %v active %v, want %v %v", tc.at, ok, ok && found.Active(at(tc.at)), tc.shown, tc.active)
		}
	}
	from, until := event.EventPeriod.Millis()
	if from != at("2026-09-17T06:00:00+08:00").UnixMilli() || until != at("2026-10-15T06:00:00+08:00").UnixMilli() {
		t.Fatalf("event millis %d %d", from, until)
	}
}

func TestParseEventsRejectsInvalidData(t *testing.T) {
	valid := func() map[string]any {
		step := func(n, value int) map[string]any {
			return map[string]any{"step": n, "value": value, "stockId": 32336, "reward": map[string]any{
				"name": "宝石", "category": 24, "itemId": 1242, "count": 10, "days": 0, "iconHint": "etc"}}
		}
		return map[string]any{"version": strings.Repeat("c", 64), "generatedFrom": "test", "tcCashEvents": []any{
			map[string]any{"eventType": "use",
				"eventPeriod":  map[string]any{"start": "2026-09-17T06:00:00+08:00", "end": "2026-10-15T05:59:59+08:00"},
				"rewardPeriod": map[string]any{"start": "2026-09-17T06:00:00+08:00", "end": "2026-10-22T05:59:59+08:00"},
				"steps":        []any{step(1, 1000), step(2, 2000)}},
		}}
	}
	parse := func(doc map[string]any) (*Events, error) {
		encoded, err := json.Marshal(doc)
		if err != nil {
			t.Fatal(err)
		}
		return ParseEvents(encoded)
	}
	if _, err := parse(valid()); err != nil {
		t.Fatalf("valid events rejected: %v", err)
	}
	empty := valid()
	empty["tcCashEvents"] = []any{}
	if events, err := parse(empty); err != nil {
		t.Fatalf("no events rejected: %v", err)
	} else if _, ok := events.SpendEventAt(time.Now()); ok {
		t.Fatal("an empty list has an event")
	}
	event := func(d map[string]any) map[string]any { return d["tcCashEvents"].([]any)[0].(map[string]any) }
	step := func(d map[string]any, i int) map[string]any { return event(d)["steps"].([]any)[i].(map[string]any) }
	for name, tc := range map[string]struct {
		edit func(map[string]any)
		want string
	}{
		"bad version":  {func(d map[string]any) { d["version"] = "v1" }, "SHA-256"},
		"charge event": {func(d map[string]any) { event(d)["eventType"] = "charge" }, "only \"use\""},
		"no offset":    {func(d map[string]any) { event(d)["eventPeriod"].(map[string]any)["start"] = "2026-09-17T06:00:00" }, "+08:00"},
		"utc":          {func(d map[string]any) { event(d)["eventPeriod"].(map[string]any)["start"] = "2026-09-16T22:00:00Z" }, "+08:00"},
		"fraction": {func(d map[string]any) {
			event(d)["eventPeriod"].(map[string]any)["end"] = "2026-10-15T05:59:59.5+08:00"
		}, "+08:00"},
		"empty period":    {func(d map[string]any) { event(d)["eventPeriod"].(map[string]any)["end"] = "2026-09-17T06:00:00+08:00" }, "is empty"},
		"reward too soon": {func(d map[string]any) { event(d)["rewardPeriod"].(map[string]any)["end"] = "2026-10-01T05:59:59+08:00" }, "does not cover"},
		"no steps":        {func(d map[string]any) { event(d)["steps"] = []any{} }, "no steps"},
		"step numbering":  {func(d map[string]any) { step(d, 1)["step"] = 3 }, "step 3 at position 2"},
		"step values":     {func(d map[string]any) { step(d, 1)["value"] = 1000 }, "increasing"},
		"reward count":    {func(d map[string]any) { step(d, 0)["reward"].(map[string]any)["count"] = 0 }, "invalid reward"},
		"no icon hint":    {func(d map[string]any) { step(d, 0)["reward"].(map[string]any)["iconHint"] = "" }, "invalid reward"},
		"unknown field":   {func(d map[string]any) { event(d)["claimed"] = true }, "unknown field"},
	} {
		t.Run(name, func(t *testing.T) {
			doc := valid()
			tc.edit(doc)
			if _, err := parse(doc); err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want containing %q", err, tc.want)
			}
		})
	}
}
