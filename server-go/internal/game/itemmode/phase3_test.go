package itemmode

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// The rules of ITEM_MODE.md appendix C over the embedded (original) data.

// equippedRace is a race of members with their equipment and changers.
func equippedRace(t *testing.T, kind string, random Random, track string, members ...Member) *Race {
	t.Helper()
	r, err := NewRace(defaultData(t), kind, members, random, Options{RaceID: "race-p3", TrackID: track})
	if err != nil {
		t.Fatal(err)
	}
	return r
}

// useIDWhere is the first use id whose roll for victim and kind satisfies
// want, so a test can make the next use get it (r.lastUse = id - 1).
func useIDWhere(t *testing.T, r *Race, victim, kind string, want func(roll int) bool) int {
	t.Helper()
	for id := 1; id < 10_000; id++ {
		if want(Roll(r.raceID, id, 0, victim, kind)) {
			return id
		}
	}
	t.Fatalf("no use id with the wanted %s roll", kind)
	return 0
}

// hazardIDWhere is useIDWhere for a track hazard.
func hazardIDWhere(t *testing.T, r *Race, victim, kind string, want func(roll int) bool) int {
	t.Helper()
	for id := 1; id <= MaxCubeID; id++ {
		if want(Roll(r.raceID, 0, id, victim, kind)) {
			return id
		}
	}
	t.Fatalf("no hazard id with the wanted %s roll", kind)
	return 0
}

func below(p int) func(int) bool   { return func(roll int) bool { return roll < p } }
func atLeast(p int) func(int) bool { return func(roll int) bool { return roll >= p } }

// useAs makes user use item with the next use id set to id (0: as is).
func useAs(t *testing.T, r *Race, user string, item, id int, target string, standings []Racer) *Use {
	t.Helper()
	if id > 0 {
		r.lastUse = id - 1
	}
	give(r, user, item)
	for r.racers[user].slots.Len() > 1 {
		r.racers[user].slots.held = r.racers[user].slots.held[len(r.racers[user].slots.held)-1:]
	}
	result, err := r.UseItem(UseRequest{PlayerID: user, ItemID: item, TargetID: target, Point: &Point{},
		Now: 1_000, Standings: standings})
	if err != nil {
		t.Fatalf("%s uses %d: %v", user, item, err)
	}
	return result.Use
}

func TestRollVectors(t *testing.T) {
	// The shared contract's inputs (ITEM_MODE.md C.1), checked against an
	// independent FNV-1a computation.
	for _, c := range []struct {
		raceID          string
		useID, hazardID int
		victimID, kind  string
		hash            uint32
		roll            int
	}{
		{"r1", 1, 0, "p1", "rocket", 423947206, 6},
		{"race-uuid", 42, 0, "victim", "devil", 3761782000, 0},
		{"x", 0, 7, "v", "banana", 3049021301, 1},
		{"abc", 9, 0, "def", "headband", 1394802540, 40},
		{"r", 3, 0, "a", "balloon", 720693324, 24},
		{"车手", 5, 0, "甲", "lucciUfo", 124561834, 34},
		{"赛", 1, 0, "车手", "rocket", 0xa3c3ed4d, 77},
	} {
		key := c.raceID + "|" + itoa(c.useID) + "|" + itoa(c.hazardID) + "|" + c.victimID + "|" + c.kind
		if got := fnv1a32(key); got != c.hash {
			t.Errorf("fnv1a32(%q) = %d, want %d", key, got, c.hash)
		}
		if got := Roll(c.raceID, c.useID, c.hazardID, c.victimID, c.kind); got != c.roll {
			t.Errorf("Roll(%q) = %d, want %d", key, got, c.roll)
		}
	}
	// The browser's fixture, when this checkout has it.
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "rewrite", "src", "item", "item-roll-vectors.json"))
	if errors.Is(err, os.ErrNotExist) {
		t.Skip("rewrite/src/item/item-roll-vectors.json not in this checkout")
	} else if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Vectors []struct {
			RaceID   string `json:"raceId"`
			UseID    int    `json:"useId"`
			HazardID int    `json:"hazardId"`
			VictimID string `json:"victimId"`
			Kind     string `json:"kind"`
			Roll     int    `json:"roll"`
		} `json:"vectors"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil || len(fixture.Vectors) < 5 {
		t.Fatalf("fixture: %v (%d vectors)", err, len(fixture.Vectors))
	}
	for _, v := range fixture.Vectors {
		if got := Roll(v.RaceID, v.UseID, v.HazardID, v.VictimID, v.Kind); got != v.Roll {
			t.Errorf("fixture %+v: roll %d", v, got)
		}
	}
}

func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

// The embedded export holds the original phase-3 data (research 13 / 6).
func TestPhase3Data(t *testing.T) {
	d := defaultData(t)
	special := map[int]struct {
		name, folder string
		base         int
	}{
		1: {"darkCloud", "cloud", 1}, 18: {"superShield", "shield", 1}, 23: {"drrMine", "drmad", 0},
		31: {"animalBooster", "", 0}, 47: {"prisonBomb", "waterBomb", 2}, 85: {"bigBanana", "banana", 3},
		101: {"tigerGhost", "ghost", 1}, 103: {"superMagnet", "magnet", 0}, 117: {"blockRocket", "lockdownRocket", 1},
		126: {"foxTailRocket", "goldRocket", 3}, 130: {"cogWheelMine", "mine", 8}, 137: {"talisman", "", 0},
	}
	for idx, want := range special {
		item, ok := d.Item(idx)
		if !ok || item.Name != want.name || item.Folder != want.folder || item.Base != want.base {
			t.Errorf("item %d = %+v, want %+v", idx, item, want)
		}
	}
	count := 0
	for _, item := range d.Items {
		if _, ok := rules[item.Idx]; !ok {
			t.Errorf("item %s (%d) has no rule", item.Name, item.Idx)
		}
		count++
	}
	if count != 19+49 {
		t.Errorf("%d items, want the 19 table items and 49 special items", count)
	}
	// Variant lifetimes (C.4).
	for _, c := range []struct {
		idx   int
		state string
		life  int
	}{
		{SnowBomb, "Affect", 3000}, {CokeBomb, "Affect", 2500}, {InfectedBomb, "PostAffect", 5000},
		{TimeSnowBomb, "Affect", 3000}, {SnowWaterFly, "Affect", 1500}, {InfectedWaterFly, "AfterBoost", 2000},
		{GoldShield, "Affect", 2500}, {ProtectShield, "Affect", 4000}, {SuperShield, "Use", 3000},
		{TigerGhost, "Affect", 7000}, {DarkCloud2, "Set", 10000}, {Talisman, "Affect", 4000},
		{AbyssBarricade, "StateAffect", 2000}, {LockdownRocket, "AffectSub", 3000}, {NewDevil, "Affect", 5000},
	} {
		if item, _ := d.Item(c.idx); item.Life(c.state) != c.life {
			t.Errorf("%s %s = %d, want %d", item.Name, c.state, item.Life(c.state), c.life)
		}
	}
	// Per-kart tables: base rows overlaid by @cn rows.
	if row := d.transform[[2]int{799, Magnet}]; row.Dst != SuperMagnet || row.P != 100 {
		t.Errorf("799 keeps the base magnet->superMagnet row: %+v", row)
	}
	if _, ok := d.transform[[2]int{584, Rocket}]; ok {
		t.Error("kart 584's transforms are cancelled by @cn")
	}
	if _, ok := d.fired[[2]int{113, Banana}]; ok {
		t.Error("kart 113's banana gain is cancelled by @cn")
	}
	if row := d.fired[[2]int{31, UFO}]; row.Gain != Shield || row.P != 100 {
		t.Errorf("飞碟车 R4 gains a shield from a UFO: %+v", row)
	}
	if row := d.animal[250]; row.Icon != 241 || row.P != 100 {
		t.Errorf("黄金龙车SR's dragon booster: %+v", row)
	}
	if len(d.TrackTransforms) != 6 {
		t.Errorf("transform@zz rows %+v", d.TrackTransforms)
	}
	// 迅 item karts.
	if len(d.XunKarts) != 46 || !d.XunKart(1513) || !d.XunKart(1638) || d.XunKart(1605) {
		t.Errorf("迅 item karts %v", d.XunKarts)
	}
	// Passives: first numbers, -1 as 0.
	for _, c := range []struct {
		holder    string
		id        int
		attribute string
		want      int
	}{
		{HolderKart, 75, "devil", 100}, {HolderKart, 62, "mine", 70}, {HolderKart, 32, "iceBanana", 100},
		{HolderKart, 432, "waterfly", 0},                           // "-1,80": vs-AI only
		{HolderPet, 3, "rocket", 20}, {HolderPet, 110, "devil", 0}, // "0,100"
		{HolderCharacter, 10, "lucciUfo", 100}, {HolderCharacter, 94, "lucciUfo", 10},
		{HolderBalloon, 1135, "prob", 80}, {HolderHeadBand, 284, "probability", 50},
	} {
		if got := d.Passive(c.holder, c.id, c.attribute); got != c.want {
			t.Errorf("%s %d %s = %d, want %d", c.holder, c.id, c.attribute, got, c.want)
		}
	}
	// Changer tables: the race tables plus oil and rainbowCloud2 at weight 0.
	for kind, race := range map[string]string{TableIndiChanger: TableIndividual, TableTeamChanger: TableTeam} {
		changer, table := d.Table(kind), d.Table(race)
		if len(changer.Entries) != len(table.Entries)+2 || !changer.Contains(Oil) || !changer.Contains(116) {
			t.Errorf("%s has %d rows", kind, len(changer.Entries))
		}
	}
	if len(d.Titles) != len(TitleKeys) {
		t.Errorf("titles %+v", d.Titles)
	}
}

// A shield blocks exactly the items whose variant has a Shield, StateShield
// or RocketShield state, but the UFO (bonusStageProperty@tw.xml:53).
func TestShieldBlocksFollowTheItemStates(t *testing.T) {
	d := defaultData(t)
	for idx, rule := range rules {
		if rule.hit == hitNone {
			continue
		}
		item, _ := d.Item(idx)
		_, s1 := item.States["Shield"]
		_, s2 := item.States["StateShield"]
		_, s3 := item.States["RocketShield"]
		want := (s1 || s2 || s3) && idx != UFO
		if got := slices.Contains(rule.blocks, ByShield); got != want {
			t.Errorf("%s: shield blocks %v, its states say %v", item.Name, got, want)
		}
	}
}

// The passive families cover every item enchantCatalog.xml lists for the
// key (C.2 adds the reskins of the same item.bml).
func TestPassiveFamiliesCoverTheEnchantCatalog(t *testing.T) {
	d := defaultData(t)
	families := map[string][]int{
		"rocket": rocketFamily, "waterBomb": waterBombFamily, "onlyWaterBomb": {WaterBomb},
		"waterfly": flyFamily, "iceBanana": bananaFamily, "forceZone": {ForceZone},
	}
	for _, shield := range d.EnchantKeys {
		family, ok := families[shield.Key]
		switch {
		case shield.Key == "mine":
			family, ok = append(slices.Clone(mineFamily), append(bananaFamily, ForceZone)...), true
		case shield.Group == 4 && slices.Contains(shield.Items, Devil):
			family, ok = devilFamily, true
		case shield.Group == 4 && slices.Contains(shield.Items, Banana):
			family, ok = bananaFamily, true
		}
		if !ok {
			continue
		}
		for _, idx := range shield.Items {
			if !slices.Contains(family, idx) {
				t.Errorf("enchant %d/%d %s covers %d, missing from the family", shield.Group, shield.Tune, shield.Key, idx)
			}
		}
	}
}

func TestGrantTransforms(t *testing.T) {
	standings := order("p1", "p2")
	// transformByKart: kart 44 turns a banana into a mine (100 %).
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01",
		Member{ID: "p1", Equipment: Equipment{Kart: 44}}, Member{ID: "p2"})
	if grant, _, _ := r.Cube("p1", 1, 2, 0, standings); grant.ItemID != Mine || grant.Icon != 0 {
		t.Fatalf("kart 44 grant %+v", grant)
	}
	// animalBooster: kart 250's booster is the dragon special booster.
	r = equippedRace(t, TableIndividual, &picks{values: []int{pickIn(t, TableIndividual, GroupLow, Booster)}},
		"forest_I01", Member{ID: "p1"}, Member{ID: "p2", Equipment: Equipment{Kart: 250}})
	grant, _, _ := r.Cube("p2", 1, 2, 0, order("p1", "p3", "p4", "p2"))
	if grant.ItemID != AnimalBoost || grant.Icon != 241 || !slices.Equal(grant.Icons, []int{241, 0}) {
		t.Fatalf("kart 250 grant %+v", grant)
	}
	// transform@zz: a time bomb is a water bomb on a level-1 track, and on a
	// reverse level-2 track a devil is Dr. R.
	team := func(track string) *Race {
		return equippedRace(t, TableTeam, nil, track, Member{ID: "a1", Team: 1}, Member{ID: "b1", Team: 2})
	}
	for _, c := range []struct {
		track string
		drawn int
		want  int
	}{
		{"forest_I01", TimeBomb, WaterBomb}, {"forest_I06", TimeBomb, TimeBomb},
		{"forest_I05_rvs", Devil, DrrMine}, {"forest_I01_rvs", Devil, Devil}, {"forest_I06", Devil, Devil},
	} {
		r := team(c.track)
		if got, _ := r.obtain(r.racers["a1"], c.drawn); got != c.want {
			t.Errorf("%s: %d becomes %d, want %d", c.track, c.drawn, got, c.want)
		}
	}
	// The XUN start item and test grants: no draw, the transforms for the
	// start item only.
	r = equippedRace(t, TableIndividual, &picks{values: []int{0}}, "forest_I01",
		Member{ID: "p1", Equipment: Equipment{Kart: 1536}}, Member{ID: "p2"}, Member{ID: "p3", Equipment: Equipment{Kart: 1605}})
	notices := r.Start([]string{"p1", "p2", "p3"})
	indi := defaultData(t).Table(TableIndividual).Entries
	if len(notices) != 3 || notices[0].ItemID == NoItem || notices[1].ItemID != NoItem || notices[2].ItemID != NoItem ||
		notices[0].Reason != ReasonStart || !r.racers["p1"].itemArmed {
		t.Fatalf("start notices %+v", notices)
	}
	if drawn := indi[0].Idx; drawn != Banana || notices[0].ItemID != Mine {
		t.Fatalf("kart 1536 started with %d (drew %d), want its banana as a mine", notices[0].ItemID, drawn)
	}
	if again := r.Start([]string{"p1"}); again[0].ItemID != NoItem {
		t.Fatal("a second start gave another item")
	}
}

func TestPerKartGains(t *testing.T) {
	standings := order("u", "v", "w")
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01",
		Member{ID: "u", Equipment: Equipment{Kart: 1375}}, Member{ID: "v", Equipment: Equipment{Kart: 31}},
		Member{ID: "w", Equipment: Equipment{Kart: 112}})
	// firing2Gain: kart 1375 using a magnet gains a shield (after the magnet left slot 0).
	give(r, "u", Magnet)
	result, err := r.UseItem(UseRequest{PlayerID: "u", ItemID: Magnet, TargetID: "v", Now: 1_000, Standings: standings})
	if err != nil || len(result.Gains) != 1 || result.Gains[0].PlayerID != "u" || result.Gains[0].ItemID != Shield ||
		result.Gains[0].Reason != ReasonGain || !slices.Equal(result.Slots, []int{Shield, Empty}) {
		t.Fatalf("firing gain %+v %v", result, err)
	}
	// fired2Gain: kart 31 hit by a UFO gains a shield; not when it blocks it.
	give(r, "w", UFO)
	ufo, _ := r.UseItem(UseRequest{PlayerID: "w", ItemID: UFO, Now: 1_000, Standings: order("v", "u", "w")})
	hit, fresh, err := r.Hit(HitRequest{VictimID: "v", UseID: ufo.Use.ID, ItemID: UFO, Result: ResultHit, Now: 2_000})
	if err != nil || !fresh || hit.Gain == nil || hit.Gain.ItemID != Shield || !slices.Equal(hit.Gain.Slots, []int{Shield, Empty}) {
		t.Fatalf("fired gain %+v %v", hit, err)
	}
	if again, fresh, _ := r.Hit(HitRequest{VictimID: "v", UseID: ufo.Use.ID, ItemID: UFO, Result: ResultHit, Now: 2_100}); fresh ||
		r.Slots("v")[1] != Empty || again.Gain == nil {
		t.Fatal("a repeated report gained again")
	}
	// An eaten banana counts as contact: 踩到香蕉皮 gives kart 112 a booster.
	banana := useAs(t, r, "u", Banana, 0, "", standings)
	hit, _, err = r.Hit(HitRequest{VictimID: "w", UseID: banana.ID, ItemID: Banana, Result: ResultBlocked,
		By: ByEat, Now: 3_100})
	if err != nil || hit.Gain == nil || hit.Gain.ItemID != Booster || !hit.Removed {
		t.Fatalf("eaten banana %+v %v", hit, err)
	}
	// Full slots drop the gain.
	give(r, "v", Booster)
	r.racers["v"].equipment.Kart = 1115 // a rocket hit gains oil
	rocket := useAs(t, r, "u", Rocket, 0, "v", standings)
	if hit, _, _ := r.Hit(HitRequest{VictimID: "v", UseID: rocket.ID, ItemID: Rocket, Result: ResultHit, Now: 4_100}); hit.Gain != nil {
		t.Fatalf("gain into full slots %+v", hit.Gain)
	}
}

func TestDoubleRockets(t *testing.T) {
	standings := order("t", "u")
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01",
		Member{ID: "u", Equipment: Equipment{Kart: 85}}, Member{ID: "t"}, Member{ID: "g", Equipment: Equipment{Kart: 1404}})
	use := useAs(t, r, "u", Rocket, 0, "t", standings)
	if use.Count != 2 {
		t.Fatalf("useTwoRocket count %d", use.Count)
	}
	for shot := range 2 {
		if _, fresh, err := r.Hit(HitRequest{VictimID: "t", UseID: use.ID, ItemID: Rocket, Result: ResultHit, Shot: shot, Now: 2_000}); err != nil || !fresh {
			t.Fatalf("shot %d: %v", shot, err)
		}
	}
	_, _, err := r.Hit(HitRequest{VictimID: "t", UseID: use.ID, ItemID: Rocket, Result: ResultHit, Shot: 2, Now: 2_000})
	wantErr(t, err, ErrInvalidShot)
	// A kart without the passive fires one; a gold-rocket kart two gold kinds only.
	plain := useAs(t, r, "t", Rocket, 0, "u", order("u", "t"))
	_, _, err = r.Hit(HitRequest{VictimID: "u", UseID: plain.ID, ItemID: Rocket, Result: ResultHit, Shot: 1, Now: 2_000})
	wantErr(t, err, ErrInvalidShot)
	if gold := useAs(t, r, "g", FoxTailRocket, 0, "t", order("t", "g", "u")); gold.Count != 2 {
		t.Fatalf("useTwoGoldRocket on the fox tail rocket: %d", gold.Count)
	}
	if rocket := useAs(t, r, "g", Rocket, 0, "t", order("t", "g", "u")); rocket.Count != 1 {
		t.Fatalf("useTwoGoldRocket on a rocket: %d", rocket.Count)
	}
	if r.racers["u"].landed != 2 || r.racers["u"].uses[Rocket] != 1 {
		t.Fatalf("counters %+v", r.racers["u"])
	}
}

func TestEquipmentDefences(t *testing.T) {
	standings := order("v", "u")
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01",
		Member{ID: "u"},
		Member{ID: "v", Equipment: Equipment{Kart: 640, Pet: 3}}) // kart rocket 40, pet rocket 20
	blocked := func(item, id int, by string) error {
		use := useAs(t, r, "u", item, id, "v", standings)
		_, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: item, Result: ResultBlocked, By: by, Now: 2_000})
		return err
	}
	// One roll per kind: the kart's 40 % and the pet's 20 % share it.
	if err := blocked(Rocket, useIDWhere(t, r, "v", RollRocket, below(20)), ByPet); err != nil {
		t.Fatalf("pet rocket under 20: %v", err)
	}
	if err := blocked(GoldRocket, useIDWhere(t, r, "v", RollRocket, func(roll int) bool { return roll >= 20 && roll < 40 }), ByKart); err != nil {
		t.Fatalf("kart rocket under 40 (gold rocket): %v", err)
	}
	wantErr(t, blocked(Rocket, useIDWhere(t, r, "v", RollRocket, func(roll int) bool { return roll >= 20 && roll < 40 }), ByPet), ErrInvalidBy)
	wantErr(t, blocked(Rocket, useIDWhere(t, r, "v", RollRocket, atLeast(40)), ByKart), ErrInvalidBy)
	// Guide rockets are not in the rocket defence (enchantCatalog.xml:41-47).
	wantErr(t, blocked(GuideRocket, useIDWhere(t, r, "v", RollRocket, below(20)), ByKart), ErrInvalidBy)
	// Nothing else.
	wantErr(t, blocked(Devil, 0, ByKart), ErrInvalidBy)

	cases := []struct {
		name      string
		equipment Equipment
		item      int
		by        string
		kind      string
		p         int
	}{
		{"kart devil", Equipment{Kart: 75}, NewDevil, ByKart, RollDevil, 100},
		{"pet devil", Equipment{Pet: 87}, DrrMine, ByPet, RollDevil, 100},
		{"onlyWaterBomb", Equipment{Kart: 572}, WaterBomb, ByKart, RollWaterBomb, 40},
		{"waterflyToWaterBomb", Equipment{Kart: 1174}, WaterFly, ByKart, RollWaterBomb, 100},
		{"allflyToAllBomb", Equipment{Kart: 1189}, SnowWaterFly, ByKart, RollWaterBomb, 100},
		{"pet waterBomb", Equipment{Pet: 35}, PumpkinBomb, ByPet, RollWaterBomb, 40},
		{"pet snowBomb", Equipment{Pet: 178}, TimeSnowBomb, ByPet, RollSnowBomb, 30},
		{"kart waterfly", Equipment{Kart: 487}, InfectedWaterFly, ByKart, RollWaterFly, 20},
		{"banana eaten", Equipment{Kart: 62}, BigBanana, ByEat, RollBanana, 50},
		{"mine", Equipment{Kart: 62}, SpringMine, ByKart, RollMine, 70},
		{"mine eaten", Equipment{Kart: 153}, Mine, ByEat, RollMine, 100},
		{"egg mine", Equipment{Kart: 610}, GoldEggMine, ByEat, RollMine, 0}, // mineWithEggMine without mine
		{"egg mine eaten", Equipment{Kart: 799}, GoldEggMine, ByEat, RollMine, 100},
		{"forceZone eaten", Equipment{Kart: 153}, ForceZone, ByEat, RollForceZone, 100},
		{"waterMine", Equipment{Kart: 974}, WaterMine, ByKart, RollWaterMine, 100},
		{"siren", Equipment{Kart: 1482}, SirenShield, ByKart, RollSiren, 100},
	}
	for _, c := range cases {
		r := equippedRace(t, TableIndividual, &picks{}, "forest_I01", Member{ID: "u"}, Member{ID: "v", Equipment: c.equipment})
		report := func(id int) error {
			use := useAs(t, r, "u", c.item, id, "v", standings)
			_, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: c.item, Result: ResultBlocked, By: c.by, Now: 2_000})
			return err
		}
		if c.p > 0 {
			if err := report(useIDWhere(t, r, "v", c.kind, below(c.p))); err != nil {
				t.Errorf("%s: %v", c.name, err)
			}
		}
		if c.p < 100 {
			if err := report(useIDWhere(t, r, "v", c.kind, atLeast(c.p))); !errors.Is(err, ErrInvalidBy) {
				t.Errorf("%s at a failed roll: %v", c.name, err)
			}
		}
	}
	// A kart that eats no mines only claims the kart defence; the ice banana
	// works on ice tracks only.
	r = equippedRace(t, TableIndividual, &picks{}, "forest_I01", Member{ID: "u"}, Member{ID: "v", Equipment: Equipment{Kart: 571}})
	use := useAs(t, r, "u", Mine, 0, "", standings)
	_, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: Mine, Result: ResultBlocked, By: ByEat, Now: 2_000})
	wantErr(t, err, ErrInvalidBy)
	for track, ok := range map[string]bool{"forest_I01": false, "ice_I10": true} {
		r := equippedRace(t, TableIndividual, &picks{}, track, Member{ID: "u"}, Member{ID: "v", Equipment: Equipment{Kart: 32}})
		use := useAs(t, r, "u", Banana, 0, "", standings)
		_, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: Banana, Result: ResultBlocked, By: ByEat, Now: 2_000})
		if (err == nil) != ok {
			t.Errorf("iceBanana on %s: %v", track, err)
		}
	}
	// Track hazards roll with the hazard id.
	r = equippedRace(t, TableIndividual, &picks{}, "forest_I01", Member{ID: "v", Equipment: Equipment{Kart: 62}})
	for _, c := range []struct {
		id  int
		err error
	}{{hazardIDWhere(t, r, "v", RollBanana, below(50)), nil}, {hazardIDWhere(t, r, "v", RollBanana, atLeast(50)), ErrInvalidBy}} {
		_, _, err := r.Hit(HitRequest{VictimID: "v", ItemID: Banana, HazardID: c.id, Result: ResultBlocked, By: ByEat, Now: 2_000})
		if !errors.Is(err, c.err) && (err != nil || c.err != nil) {
			t.Errorf("banana hazard %d: %v, want %v", c.id, err, c.err)
		}
	}
	// A racer is not a target of its own UFO.
	use = useAs(t, r, "v", UFO, 0, "", order("x", "v"))
	_, _, err = r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: UFO, Result: ResultHit, Now: 2_000})
	wantErr(t, err, ErrInvalidTarget)
}

func TestHitVariants(t *testing.T) {
	standings := order("v", "u")
	member := func(e Equipment) *Race {
		return equippedRace(t, TableIndividual, &picks{}, "forest_I01", Member{ID: "u"}, Member{ID: "v", Equipment: e})
	}
	report := func(r *Race, item, id int, variant, by, result string) (Hit, error) {
		use := useAs(t, r, "u", item, id, "v", standings)
		hit, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: item, Result: result, By: by,
			Variant: variant, Now: 2_000})
		return hit, err
	}
	// The headband shortens a UFO at its probability.
	r := member(Equipment{HeadBand: 284})
	if _, err := report(r, UFO, useIDWhere(t, r, "v", RollHeadband, below(50)), VariantHeadband, "", ResultHit); err != nil {
		t.Fatal(err)
	}
	_, err := report(r, UFO, useIDWhere(t, r, "v", RollHeadband, atLeast(50)), VariantHeadband, "", ResultHit)
	wantErr(t, err, ErrInvalidVariant)
	// 奇奇 earns lucci from a UFO; others do not.
	r = member(Equipment{Character: 10})
	hit, err := report(r, UFO, 0, VariantBonus, "", ResultHit)
	if err != nil || hit.Lucci == nil || *hit.Lucci != (LucciNotice{PlayerID: "v", Amount: LucciAmount, Reason: LucciUFO}) {
		t.Fatalf("lucciUfo %+v %v", hit, err)
	}
	_, err = report(member(Equipment{Character: 2}), UFO, 0, VariantBonus, "", ResultHit)
	wantErr(t, err, ErrInvalidVariant)
	// A balloon softens the missiles but the gold kind, and pays lucci.
	r = member(Equipment{Balloon: 1135})
	id := useIDWhere(t, r, "v", RollBalloon, below(80))
	if hit, err := report(r, CokeRocket, id, VariantBalloon, "", ResultHit); err != nil || hit.Lucci == nil || hit.Lucci.Reason != LucciBalloon {
		t.Fatalf("balloon %+v %v", hit, err)
	}
	_, err = report(r, GoldRocket, id+1000, VariantBalloon, "", ResultHit)
	wantErr(t, err, ErrInvalidVariant)
	// waterAngel leaves water traps at once.
	r = member(Equipment{Kart: 64})
	if _, err := report(r, SnowBomb, 0, VariantQuick, "", ResultHit); err != nil {
		t.Fatal(err)
	}
	_, err = report(r, Rocket, 0, VariantQuick, "", ResultHit)
	wantErr(t, err, ErrInvalidVariant)
	// The milder missile hit has no condition, but needs an AffectSmall state.
	if _, err := report(member(Equipment{}), TigerRocket, 0, VariantSmall, "", ResultHit); err != nil {
		t.Fatal(err)
	}
	_, err = report(member(Equipment{}), Banana, 0, VariantSmall, "", ResultHit)
	wantErr(t, err, ErrInvalidVariant)
	// 神秘工头 in an eating kart earns lucci from the mine it eats.
	r = member(Equipment{Kart: 153, Character: 16})
	if hit, err := report(r, Mine, 0, VariantBonus, ByEat, ResultBlocked); err != nil || hit.Lucci == nil || hit.Lucci.Reason != LucciMine || !hit.Removed {
		t.Fatalf("eat bonus %+v %v", hit, err)
	}
	_, err = report(member(Equipment{Kart: 153}), Mine, 0, VariantBonus, ByEat, ResultBlocked)
	wantErr(t, err, ErrInvalidVariant)
	_, err = report(r, Mine, 0, VariantBonus, ByKart, ResultBlocked)
	wantErr(t, err, ErrInvalidVariant)
}

func TestLucciIsCappedPerRace(t *testing.T) {
	standings := order("v", "u")
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01", Member{ID: "u"}, Member{ID: "v", Equipment: Equipment{Character: 10}})
	total := 0
	for range MaxBonusLucci/LucciAmount + 3 {
		use := useAs(t, r, "u", UFO, 0, "", standings)
		hit, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: UFO, Result: ResultHit, Variant: VariantBonus, Now: 2_000})
		if err != nil {
			t.Fatal(err)
		}
		if hit.Lucci != nil {
			total += hit.Lucci.Amount
		}
	}
	if total != MaxBonusLucci || r.BonusLucci("v") != MaxBonusLucci {
		t.Fatalf("lucci %d / %d", total, r.BonusLucci("v"))
	}
	// lucciItemCube: 10 % of cubes, a server roll.
	r = equippedRace(t, TableIndividual, &picks{values: []int{0, 9, 0, 10}}, "forest_I01", Member{ID: "p1", Equipment: Equipment{Kart: 273}})
	first, _, _ := r.Cube("p1", 1, 3, 0, order("p1"))
	second, _, _ := r.Cube("p1", 2, 3, 0, order("p1"))
	if first.Lucci != LucciAmount || second.Lucci != 0 {
		t.Fatalf("cube lucci %d %d", first.Lucci, second.Lucci)
	}
}

// The EMP (a counter item, C.1) cures only teammates under a UFO slow when
// it takes effect; otherwise it does nothing.
func TestEMPCuresOnlyUFOSlowedTeammates(t *testing.T) {
	r := teamRace(t, &picks{})
	standings := order("a1", "b1", "a2", "b2")
	ufo := useAs(t, r, "b1", UFO, 0, "", standings)
	if !slices.Equal(ufo.Targets, []string{"a1"}) {
		t.Fatalf("ufo targets %v", ufo.Targets)
	}
	landed := ufo.StartAt + int64(ufo.EtaMs)
	emp := func(user string, now int64) []string {
		give(r, user, EMP)
		result, err := r.UseItem(UseRequest{PlayerID: user, ItemID: EMP, Now: now, Standings: standings})
		if err != nil {
			t.Fatal(err)
		}
		return result.Use.Targets
	}
	if targets := emp("a2", landed); len(targets) != 0 {
		t.Fatalf("EMP before the UFO hit report cured %v", targets)
	}
	if _, _, err := r.Hit(HitRequest{VictimID: "a1", UseID: ufo.ID, ItemID: UFO, Result: ResultHit, Now: landed}); err != nil {
		t.Fatal(err)
	}
	// Opponents' EMPs do not cure; the slow ends at Affect (3000) after landing.
	if targets := emp("b2", landed+1_000); len(targets) != 0 {
		t.Fatalf("an opponent's EMP cured %v", targets)
	}
	if targets := emp("a2", landed+3_000); len(targets) != 0 { // takes effect at +500: over
		t.Fatalf("EMP after the slow cured %v", targets)
	}
	if targets := emp("a2", landed+2_000); !slices.Equal(targets, []string{"a1"}) {
		t.Fatalf("EMP during the slow cured %v", targets)
	}
	if targets := emp("a1", landed+2_100); len(targets) != 0 {
		t.Fatalf("a cured slow was cured again: %v", targets)
	}
	// A headband's shorter slow (1500).
	r.racers["a1"].equipment.HeadBand = 284
	short := useAs(t, r, "b1", UFO, useIDWhere(t, r, "a1", RollHeadband, below(50)), "", standings)
	at := short.StartAt + int64(short.EtaMs)
	if _, _, err := r.Hit(HitRequest{VictimID: "a1", UseID: short.ID, ItemID: UFO, Result: ResultHit, Variant: VariantHeadband, Now: at}); err != nil {
		t.Fatal(err)
	}
	if targets := emp("a1", at+1_000); len(targets) != 0 {
		t.Fatalf("EMP after a headband slow cured %v", targets)
	}
}

func TestShieldsAngelsAndTheGoldShield(t *testing.T) {
	r := soloRace(t, &picks{})
	standings := order("p2", "p1", "p3")
	ufo := useAs(t, r, "p1", UFO, 0, "", standings)
	for _, by := range []string{ByShield, ByAngel, ByEMP} {
		_, _, err := r.Hit(HitRequest{VictimID: "p2", UseID: ufo.ID, ItemID: UFO, Result: ResultBlocked, By: by, Now: 1_500})
		wantErr(t, err, ErrInvalidBy)
	}
	// A gold shield blocks every attack (the devil and the UFO too) while it
	// lasts (Use 500 + Affect 2500), but not a cloud.
	gold := useAs(t, r, "p2", GoldShield, 0, "", standings)
	if !r.racers["p2"].invincibleAt(gold.StartAt + 2_999) {
		t.Fatal("gold shield window")
	}
	if _, _, err := r.Hit(HitRequest{VictimID: "p2", UseID: ufo.ID, ItemID: UFO, Result: ResultBlocked, By: ByShield, Now: 1_500}); err != nil {
		t.Fatalf("gold shield on a UFO: %v", err)
	}
	devil := useAs(t, r, "p1", Devil, 0, "", standings)
	if _, _, err := r.Hit(HitRequest{VictimID: "p2", UseID: devil.ID, ItemID: Devil, Result: ResultBlocked, By: ByShield, Now: 1_500}); err != nil {
		t.Fatalf("gold shield on a devil: %v", err)
	}
	cloud := useAs(t, r, "p3", Cloud, 0, "", order("p2", "p3", "p1"))
	_, _, err := r.Hit(HitRequest{VictimID: "p1", UseID: cloud.ID, ItemID: Cloud, Result: ResultBlocked, By: ByShield, Now: 1_500})
	wantErr(t, err, ErrInvalidBy)
	late := useAs(t, r, "p1", Devil, 0, "", standings)
	_, _, err = r.Hit(HitRequest{VictimID: "p2", UseID: late.ID, ItemID: Devil, Result: ResultBlocked, By: ByShield, Now: 5_000})
	wantErr(t, err, ErrInvalidBy)
	// A slot lock does not lock a gold-shielded target.
	lock := useAs(t, r, "p3", SlotLock, 0, "", standings)
	if r.Locked("p2", lock.StartAt+2_000) || !r.Locked("p1", lock.StartAt+2_000) {
		t.Fatal("slot lock under a gold shield")
	}
}

func TestHitLocks(t *testing.T) {
	standings := order("v", "u")
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01", Member{ID: "u"}, Member{ID: "v", Equipment: Equipment{Kart: 64}})
	lockOf := func(item int, variant string, now int64) {
		t.Helper()
		use := useAs(t, r, "u", item, 0, "v", standings)
		if _, _, err := r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: item, Result: ResultHit, Variant: variant, Now: now}); err != nil {
			t.Fatal(err)
		}
	}
	// 毒性水炸弹: trapped 2000, then the key lock 5000.
	lockOf(InfectedBomb, "", 10_000)
	if !r.Locked("v", 16_999) || r.Locked("v", 17_000) {
		t.Fatal("infected bomb lock")
	}
	// Left at once (waterAngel): 500 + 5000.
	lockOf(PumpkinBomb, VariantQuick, 20_000)
	if !r.Locked("v", 25_499) || r.Locked("v", 25_500) {
		t.Fatal("quick infected bomb lock")
	}
	// 毒性水苍蝇: 1000 + AfterBoost 2000.
	lockOf(InfectedWaterFly, "", 30_000)
	if !r.Locked("v", 32_999) || r.Locked("v", 33_000) {
		t.Fatal("infected fly lock")
	}
	// The talisman locks for its Affect (4000), until the QTE escape.
	talisman := useAs(t, r, "u", Talisman, 0, "", standings)
	if !slices.Equal(talisman.Targets, []string{"v"}) {
		t.Fatalf("talisman targets %v", talisman.Targets)
	}
	if _, _, err := r.Hit(HitRequest{VictimID: "v", UseID: talisman.ID, ItemID: Talisman, Result: ResultHit, Now: 40_000}); err != nil {
		t.Fatal(err)
	}
	if !r.Locked("v", 41_000) {
		t.Fatal("talisman lock")
	}
	if _, fresh, err := r.Escape("v", talisman.ID, 0, 41_000); err != nil || !fresh || r.Locked("v", 41_000) {
		t.Fatalf("talisman escape %v %v", fresh, err)
	}
	// A blocked report locks nothing.
	use := useAs(t, r, "u", InfectedBomb, 0, "", standings)
	r.Hit(HitRequest{VictimID: "v", UseID: use.ID, ItemID: InfectedBomb, Result: ResultBlocked, By: ByAngel, Now: 50_000})
	if r.Locked("v", 50_001) {
		t.Fatal("a blocked infected bomb locked")
	}
}

func TestPlacedTrapsAndSirens(t *testing.T) {
	r := teamRace(t, &picks{})
	standings := order("a1", "b1", "a2", "b2")
	// Mines hit anyone (the user's team too), once.
	mine := useAs(t, r, "a1", DuckMine, 0, "", standings)
	if hit, _, err := r.Hit(HitRequest{VictimID: "a2", UseID: mine.ID, ItemID: DuckMine, Result: ResultHit, Now: 2_000}); err != nil || !hit.Removed {
		t.Fatalf("mine %+v %v", hit, err)
	}
	_, _, err := r.Hit(HitRequest{VictimID: "b1", UseID: mine.ID, ItemID: DuckMine, Result: ResultHit, Now: 2_000})
	wantErr(t, err, ErrInvalidUse)
	// A water mine's burst traps everyone in it.
	water := useAs(t, r, "a1", WaterMine, 0, "", standings)
	for _, victim := range []string{"b1", "a2"} {
		if hit, _, err := r.Hit(HitRequest{VictimID: victim, UseID: water.ID, ItemID: WaterMine, Result: ResultHit, Now: 2_000}); err != nil || hit.Removed {
			t.Fatalf("water mine on %s: %+v %v", victim, hit, err)
		}
	}
	if _, fresh, err := r.Escape("b1", water.ID, 0, 2_500); err != nil || !fresh {
		t.Fatalf("water mine escape %v", err)
	}
	// A siren knocks opponents only; the angel blocks it.
	siren := useAs(t, r, "a1", Siren, 0, "", standings)
	if !slices.Equal(siren.Targets, []string{"a1"}) {
		t.Fatalf("siren targets %v", siren.Targets)
	}
	_, _, err = r.Hit(HitRequest{VictimID: "a2", UseID: siren.ID, ItemID: Siren, Result: ResultHit, Now: 2_000})
	wantErr(t, err, ErrInvalidTarget)
	if _, _, err := r.Hit(HitRequest{VictimID: "b2", UseID: siren.ID, ItemID: Siren, Result: ResultBlocked, By: ByAngel, Now: 2_000}); err != nil {
		t.Fatal(err)
	}
	// Placed items need a point; lockdown fields reach any opponent.
	give(r, "b1", Oil)
	_, err = r.UseItem(UseRequest{PlayerID: "b1", ItemID: Oil, Now: 1_000, Standings: standings})
	wantErr(t, err, ErrInvalidPoint)
	lockdown := useAs(t, r, "b1", LockdownRocket, 0, "a1", standings)
	if _, _, err := r.Hit(HitRequest{VictimID: "a2", UseID: lockdown.ID, ItemID: LockdownRocket, Result: ResultHit, Now: 2_000}); err != nil {
		t.Fatalf("lockdown field on a2: %v", err)
	}
}

func TestChangerCards(t *testing.T) {
	standings := order("p1", "p2", "p3")
	r := equippedRace(t, TableIndividual, &picks{}, "forest_I01",
		Member{ID: "p1", Changers: Changers{Slot: 1, Item: 2}}, Member{ID: "p2", Changers: Changers{Slot: Infinite, Item: Infinite}},
		Member{ID: "p3"})
	// No card or voucher: neither changer.
	give(r, "p3", Rocket, Shield)
	_, _, err := r.Swap("p3", 0, standings)
	wantErr(t, err, ErrNoChanger)
	_, _, _, err = r.Change("p3", 0, standings)
	wantErr(t, err, ErrNoChanger)
	// A card per swap; the voucher is free.
	give(r, "p1", Rocket, Shield)
	if slots, _, err := r.Swap("p1", 0, standings); err != nil || !slices.Equal(slots, []int{Shield, Rocket}) {
		t.Fatalf("swap %v %v", slots, err)
	}
	_, _, err = r.Swap("p1", 0, standings)
	wantErr(t, err, ErrNoChanger)
	give(r, "p2", Rocket, Shield)
	for range 3 {
		if _, _, err := r.Swap("p2", 0, standings); err != nil {
			t.Fatal(err)
		}
	}
	// The item changer needs a new item: the given items are not new.
	_, _, _, err = r.Change("p1", 0, standings)
	wantErr(t, err, ErrChangerUsed)
	// A cube re-arms it; a change redraws slot 0 from the changer table by
	// rank group and disarms it until the next new item.
	r.racers["p1"].slots = NewSlots(2)
	grant, _, _ := r.Cube("p1", 1, 2, 0, standings)
	if r.Changers("p1") != (ChangerState{Slot: 0, Item: 2, ItemArmed: true}) || grant.ItemID != Banana {
		t.Fatalf("after a cube %+v %+v", r.Changers("p1"), grant)
	}
	r.random = &picks{values: []int{pickIn(t, TableIndiChanger, GroupTop, Shield)}}
	slots, item, _, err := r.Change("p1", 0, standings)
	if err != nil || item != Shield || slots[0] != Shield || r.Changers("p1") != (ChangerState{Item: 1}) {
		t.Fatalf("change %v %d %v %+v", slots, item, err, r.Changers("p1"))
	}
	_, _, _, err = r.Change("p1", 0, standings)
	wantErr(t, err, ErrChangerUsed)
	if slot, item := r.Consumed("p1"); slot != 1 || item != 1 {
		t.Fatalf("consumed %d %d", slot, item)
	}
	if slot, item := r.Consumed("p2"); slot != 0 || item != 0 {
		t.Fatalf("voucher consumed %d %d", slot, item)
	}
	// Not under a slot lock (the swap still works).
	r.racers["p2"].slots = NewSlots(2)
	r.Cube("p2", 1, 2, 0, standings)
	r.racers["p2"].locks = []window{{0, 10_000}}
	_, _, _, err = r.Change("p2", 0, standings)
	wantErr(t, err, ErrLocked)
	// The caps hold for redraws too.
	r.racers["p2"].locks = nil
	r.racers["p2"].obtained[Shield] = 0
	team := equippedRace(t, TableTeam, &picks{values: []int{pickIn(t, TableTeamChanger, GroupMid, Angel)}}, "forest_I06",
		Member{ID: "a1", Team: 1, Changers: Changers{Item: Infinite}}, Member{ID: "b1", Team: 2})
	team.racers["a1"].obtained[Angel] = 2
	give(team, "a1", Booster)
	team.racers["a1"].itemArmed = true
	if _, item, _, err := team.Change("a1", 0, order("b1", "a1", "x", "y")); err != nil || item == Angel {
		t.Fatalf("capped angel redrawn: %d %v", item, err)
	}
}

// pickIn is the draw value that lands on idx in a group of a table.
func pickIn(t *testing.T, kind string, group Group, idx int) int {
	t.Helper()
	pick := 0
	for _, entry := range defaultData(t).Table(kind).Entries {
		if entry.Idx == idx {
			return pick
		}
		pick += entry.Weight(group)
	}
	t.Fatalf("%d not in %s", idx, kind)
	return 0
}

func TestTitles(t *testing.T) {
	r := soloRace(t, &picks{})
	standings := order("p2", "p1", "p3")
	for range 10 {
		useAs(t, r, "p1", Booster, 0, "", standings)
	}
	for range 5 {
		useAs(t, r, "p1", AnimalBoost, 0, "", standings)
	}
	rocket := useAs(t, r, "p1", Rocket, 0, "p2", standings)
	r.Hit(HitRequest{VictimID: "p2", UseID: rocket.ID, ItemID: Rocket, Result: ResultHit, Now: 2_000})
	got := r.Titles("p1", TitleFacts{Finished: true, First: true, PerfectStart: true, LapLeader: true})
	if !slices.Equal(got, []string{TitlePerfectAim, TitleSpeedWar, TitlePerfectStart, TitleOnlyOne, TitleSafetyFirst}) {
		t.Fatalf("titles %v", got)
	}
	// A blocked attack spoils 百发百中; a hit taken spoils 安全第一; not
	// leading at a lap line spoils 唯我独尊.
	blocked := useAs(t, r, "p1", Rocket, 0, "p2", standings)
	r.Hit(HitRequest{VictimID: "p2", UseID: blocked.ID, ItemID: Rocket, Result: ResultBlocked, By: ByShield, Now: 2_000})
	if got := r.Titles("p1", TitleFacts{Finished: true, First: true}); !slices.Equal(got, []string{TitleSpeedWar, TitleSafetyFirst}) {
		t.Fatalf("titles %v", got)
	}
	if got := r.Titles("p2", TitleFacts{Finished: true}); len(got) != 0 {
		t.Fatalf("hit racer titles %v", got)
	}
	if got := r.Titles("p3", TitleFacts{}); got == nil || len(got) != 0 {
		t.Fatalf("unfinished titles %v", got)
	}
	// Missile families count together (导弹类).
	for range 10 {
		useAs(t, r, "p3", TigerRocket, 0, "", standings)
	}
	if got := r.Titles("p3", TitleFacts{}); !slices.Equal(got, []string{TitleTurret}) {
		t.Fatalf("turret titles %v", got)
	}
}
