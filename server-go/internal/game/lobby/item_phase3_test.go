package lobby

import (
	"slices"
	"strconv"
	"testing"
	"time"

	"kartsim/internal/game/itemmode"
	"kartsim/internal/shared/contract"
)

// The item race protocol of ITEM_MODE.md appendix C (C.6-C.9).

// gearWith is the test equipment with the given itemIds slots set.
func gearWith(ids map[int]int) map[string]any {
	value := equipment()
	for slot, id := range ids {
		value["itemIds"].(map[string]any)[strconv.Itoa(slot)] = id
	}
	return value
}

// connectGeared says hello as an account with equipment.
func (h *harness) connectGeared(nickname, accountID string, ids map[int]int) *Client {
	h.t.Helper()
	c := h.newClient()
	h.must(c, accountHello(h, nickname, accountID, gearWith(ids)))
	return c
}

// lastItemEvents are c's item events with the given action.
func actionEvents(t *testing.T, h *harness, c *Client, action string) []map[string]any {
	t.Helper()
	var out []map[string]any
	for _, event := range h.sink(c).events(t) {
		if event["type"] == "item" && event["action"] == action {
			out = append(out, event)
		}
	}
	return out
}

func changers(slot, item int, armed bool) map[string]any {
	return map[string]any{"slot": slot, "item": item, "itemArmed": armed}
}

// The start re-checks the racers' equipment with the data service and reads
// their changer cards from that answer; once the countdown snapshot is out,
// every racer is told its slots and changers, a 迅 item kart with its start
// item; the cards it uses are settled.
func TestItemStartChangersAndConsumption(t *testing.T) {
	h := newHarness(t)
	o := withOwnership(h)
	o.changers = map[string]itemmode.Changers{"acc-xun": {Slot: 3, Item: itemmode.Infinite}}
	xun := h.connectGeared("Xun", "acc-xun", map[int]int{3: 1513})
	plain := h.connectGeared("Plain", "acc-plain", nil)
	guest := h.connect("Guest")
	players := []*Client{xun, plain, guest}
	random := &scriptedRandom{values: []int{1}} // the 迅 kart draws indi[1], the cloud
	h.lobby.itemRandom = func() itemmode.Random { return random }
	room := h.joinAndReady(players, h.create(players, "item", "itemIndiCombine", 3))
	roomID := room["roomId"].(string)
	calls := o.callCount()
	room = h.command(xun, map[string]any{"type": "start", "roomId": roomID, "revision": room["revision"]})
	if o.callCount() != calls+2 { // both accounts, despite the remembered answers
		t.Fatalf("start made %d equipment checks", o.callCount()-calls)
	}
	raceID := raceOf(room)["raceId"].(string)
	for _, p := range players {
		if len(startPushes(t, h, p)) != 0 {
			t.Fatal("start push before the countdown")
		}
		h.must(p, loadedRequest(roomID, raceID))
	}
	ir := &itemRace{t: t, h: h, roomID: roomID, raceID: raceID, kind: itemmode.TableIndividual,
		random: random, sequences: map[*Client]int{}}
	for _, p := range players {
		events := h.sink(p).events(t)
		at := slices.IndexFunc(events, func(e map[string]any) bool { return e["type"] == "item" })
		if at < 1 || events[at-1]["type"] != "room" || object(events[at-1]["room"])["phase"] != "countdown" {
			t.Fatalf("%s: the start push does not follow the countdown snapshot: %v", p.name, events)
		}
	}
	base := map[string]any{"type": "item", "roomId": roomID, "raceId": raceID, "action": "slots"}
	with := func(fields map[string]any) map[string]any {
		out := map[string]any{}
		for k, v := range base {
			out[k] = v
		}
		for k, v := range fields {
			out[k] = v
		}
		return out
	}
	assertEqual(t, startPushes(t, h, xun), []map[string]any{with(map[string]any{
		"slots": []int{itemmode.Cloud, -1}, "changers": changers(3, -1, true), "reason": "start", "itemId": itemmode.Cloud})})
	assertEqual(t, startPushes(t, h, plain), []map[string]any{with(map[string]any{
		"slots": []int{-1, -1}, "changers": changers(0, 0, false)})})
	assertEqual(t, startPushes(t, h, guest), []map[string]any{with(map[string]any{
		"slots": []int{-1, -1}, "changers": changers(0, 0, false)})})

	h.clock.Advance(3 * time.Second)
	// The voucher changes the start item; the change waits for the next new item.
	random.values = []int{pickFor(t, itemmode.TableIndiChanger, itemmode.GroupTop, itemmode.Shield)}
	changed := ir.send(xun, "change", nil)
	assertEqual(t, []any{changed["action"], changed["slots"], changed["changers"]},
		[]any{"slots", []int{itemmode.Shield, -1}, changers(3, -1, false)})
	assertEqual(t, ir.reject(xun, "change", nil), "ITEM_CHANGER_USED")
	assertEqual(t, ir.reject(plain, "change", nil), "ITEM_CHANGER_UNAVAILABLE")
	// A cube re-arms it; a swap uses a card.
	h.lobby.itemTests = true
	grant := ir.send(xun, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.Booster})
	assertEqual(t, grant["changers"], changers(3, -1, true))
	swapped := ir.send(xun, "swap", nil)
	assertEqual(t, []any{swapped["slots"], swapped["changers"]}, []any{[]int{itemmode.Booster, itemmode.Shield}, changers(2, -1, true)})
	ir.send(xun, "swap", nil)
	// Settled: the two cards used, not the voucher's changes.
	h.clock.Advance(20 * time.Second)
	for i, p := range players {
		h.must(p, finishRequest(roomID, raceID, 20_000+i))
	}
	settlements := h.recorder.settlements()
	settled := settlements[len(settlements)-1]
	assertEqual(t, settled.Consumed, []contract.ConsumedItem{{PlayerID: xun.playerID, AccountID: "acc-xun",
		Category: contract.CategoryChanger, ItemID: contract.ItemSlotChanger, Count: 2}})
}

// KART_ITEM_CHANGERS=infinite gives everyone vouchers, guests included.
func TestItemInfiniteChangers(t *testing.T) {
	h := newHarness(t)
	h.lobby.itemChangers = true
	players := h.connectN(2)
	ir := h.startItemRace(players, "itemIndiCombine")
	assertEqual(t, startPushes(t, h, players[1])[0]["changers"], changers(-1, -1, false))
	h.lobby.itemTests = true
	ir.send(players[0], "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.Rocket})
	ir.send(players[0], "cube", map[string]any{"cubeId": 2, "capacity": 2, "testItemId": itemmode.Banana})
	assertEqual(t, ir.send(players[0], "swap", nil)["changers"], changers(-1, -1, true))
}

// Gains, variants, lucci, double rockets and the EMP on the wire.
func TestItemGainsVariantsAndLucci(t *testing.T) {
	h := newHarness(t)
	shooter := h.connectGeared("Shooter", "acc-shooter", map[int]int{3: 85})        // useTwoRocket
	kiki := h.connectGeared("Kiki", "acc-kiki", map[int]int{1: 10, 3: 31, 11: 284}) // 奇奇, 飞碟车 R4
	players := []*Client{shooter, kiki}
	ir := h.startItemRace(players, "itemIndiCombine")
	h.lobby.itemTests = true
	ir.at(kiki, 900, 1)
	ir.at(shooter, 800, 1)
	// A UFO on 奇奇: the bonus variant pays lucci, and kart 31 gains a shield.
	ir.send(shooter, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.UFO})
	ufo := ir.send(shooter, "use", map[string]any{"itemId": itemmode.UFO})
	assertEqual(t, ufo["targets"], []string{kiki.playerID})
	assertEqual(t, ir.reject(kiki, "hit", map[string]any{"useId": ufo["useId"], "itemId": 3, "result": "hit",
		"variant": "fancy"}), "INVALID_VARIANT")
	assertEqual(t, ir.reject(kiki, "hit", map[string]any{"useId": ufo["useId"], "itemId": 3, "result": "blocked",
		"by": "shield"}), "INVALID_BY") // the shield does not stop a UFO
	hit := ir.send(kiki, "hit", map[string]any{"useId": ufo["useId"], "itemId": 3, "result": "hit", "variant": "bonus"})
	assertEqual(t, hit["variant"], "bonus")
	assertEqual(t, actionEvents(t, h, shooter, "hit")[0]["variant"], "bonus")
	gains := actionEvents(t, h, kiki, "slots")
	assertEqual(t, without(gains[len(gains)-1], "type", "roomId", "raceId"), map[string]any{"action": "slots",
		"slots": []int{itemmode.Shield, -1}, "changers": changers(0, 0, true), "reason": "gain", "itemId": itemmode.Shield})
	assertEqual(t, without(actionEvents(t, h, kiki, "lucci")[0], "type", "roomId", "raceId"),
		map[string]any{"action": "lucci", "amount": 10, "reason": "ufo"})
	if len(actionEvents(t, h, shooter, "lucci")) != 0 {
		t.Fatal("the lucci notice reached another racer")
	}
	// A double rocket: count 2, each shot reported once.
	ir.send(shooter, "cube", map[string]any{"cubeId": 2, "capacity": 2, "testItemId": itemmode.Rocket})
	rocket := ir.send(shooter, "use", map[string]any{"itemId": itemmode.Rocket, "targetId": kiki.playerID})
	assertEqual(t, rocket["count"], 2)
	used := actionEvents(t, h, kiki, "used")
	assertEqual(t, used[len(used)-1]["count"], 2)
	second := ir.send(kiki, "hit", map[string]any{"useId": rocket["useId"], "itemId": 7, "result": "hit", "shot": 1})
	assertEqual(t, second["shot"], 1)
	first := ir.send(kiki, "hit", map[string]any{"useId": rocket["useId"], "itemId": 7, "result": "hit", "shot": 0})
	if _, ok := first["shot"]; ok {
		t.Fatal("shot 0 is left out")
	}
	assertEqual(t, ir.reject(kiki, "hit", map[string]any{"useId": rocket["useId"], "itemId": 7, "result": "hit",
		"shot": 2}), "INVALID_SHOT")
	// The in-race lucci shows in race.rewards and is settled apart.
	h.clock.Advance(20 * time.Second)
	h.must(kiki, finishRequest(ir.roomID, ir.raceID, 30_000))
	room := h.command(shooter, finishRequest(ir.roomID, ir.raceID, 31_000))
	rewards := object(raceOf(room)["rewards"])
	settlements := h.recorder.settlements()
	settled := settlements[len(settlements)-1]
	for _, reward := range settled.Rewards {
		shown := object(rewards[reward.PlayerID])
		want := 0
		if reward.PlayerID == kiki.playerID {
			want = 10
		}
		if reward.BonusLucci != want || shown["lucci"] != float64(reward.Lucci+want) {
			t.Errorf("%s: bonus %d, shown %v of %d", reward.PlayerID, reward.BonusLucci, shown["lucci"], reward.Lucci)
		}
	}
}

// The EMP cures only teammates under a UFO slow; with none it does nothing.
func TestItemEMPOnTheWire(t *testing.T) {
	h, ir, players := teamItemRace(t)
	a1, b1, a2 := players[0], players[1], players[2]
	h.lobby.itemTests = true
	ir.send(a2, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.EMP})
	ir.send(a2, "cube", map[string]any{"cubeId": 2, "capacity": 2, "testItemId": itemmode.EMP})
	idle := ir.send(a2, "use", map[string]any{"itemId": itemmode.EMP})
	assertEqual(t, idle["targets"], []string{})
	ir.send(a1, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.UFO})
	ufo := ir.send(a1, "use", map[string]any{"itemId": itemmode.UFO})
	assertEqual(t, ufo["targets"], []string{b1.playerID})
	ir.send(b1, "hit", map[string]any{"useId": ufo["useId"], "itemId": 3, "result": "hit"})
	// a2's EMP is not b1's team; b2's is.
	assertEqual(t, ir.send(a2, "use", map[string]any{"itemId": itemmode.EMP})["targets"], []string{})
	b2 := players[3]
	h.clock.Advance(time.Second)
	ir.send(b2, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.EMP})
	assertEqual(t, ir.send(b2, "use", map[string]any{"itemId": itemmode.EMP})["targets"], []string{b1.playerID})
}

// Titles: finish may say perfectStart; result rows carry titles (and the
// settlement's results); crossing a lap line while not leading costs 唯我独尊.
func TestItemTitles(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(3)
	ir := h.startItemRace(players, "itemIndiCombine")
	p0, p1, p2 := players[0], players[1], players[2]
	ir.at(p0, 900, 1)
	ir.at(p1, 800, 1)
	ir.at(p2, 700, 1)
	ir.at(p0, 1000, 2) // p0 leads at its line
	ir.at(p1, 950, 2)  // p1 does not
	h.lobby.itemTests = true
	for i := range 10 {
		ir.send(p1, "cube", map[string]any{"cubeId": 1 + i%2, "capacity": 2, "testItemId": itemmode.Booster})
		ir.send(p1, "use", map[string]any{"itemId": itemmode.Booster})
	}
	ir.send(p2, "cube", map[string]any{"cubeId": 1, "capacity": 2, "testItemId": itemmode.Rocket})
	rocket := ir.send(p2, "use", map[string]any{"itemId": itemmode.Rocket, "targetId": p1.playerID})
	ir.send(p1, "hit", map[string]any{"useId": rocket["useId"], "itemId": 7, "result": "hit"})
	h.clock.Advance(20 * time.Second)
	assertEqual(t, h.errorCode(p0, map[string]any{"type": "finish", "roomId": ir.roomID, "raceId": ir.raceID,
		"elapsedMs": 30_000, "perfectStart": "yes"}), "INVALID_PERFECTSTART")
	h.must(p0, map[string]any{"type": "finish", "roomId": ir.roomID, "raceId": ir.raceID, "elapsedMs": 30_000,
		"perfectStart": true})
	h.must(p1, finishRequest(ir.roomID, ir.raceID, 31_000))
	room := h.command(p2, finishRequest(ir.roomID, ir.raceID, 32_000))
	titles := map[string]any{}
	for _, row := range list(raceOf(room)["results"]) {
		titles[object(row)["playerId"].(string)] = object(row)["titles"]
	}
	assertEqual(t, titles, map[string]any{
		p0.playerID: []string{itemmode.TitlePerfectStart, itemmode.TitleOnlyOne, itemmode.TitleSafetyFirst},
		p1.playerID: []string{itemmode.TitleSpeedWar},
		p2.playerID: []string{itemmode.TitlePerfectAim, itemmode.TitleSafetyFirst},
	})
	settlements := h.recorder.settlements()
	for _, result := range settlements[len(settlements)-1].Results {
		if !slices.Equal(result.Titles, toStrings(titles[result.PlayerID])) {
			t.Errorf("settled titles of %s: %v", result.PlayerID, result.Titles)
		}
	}
}

func toStrings(value any) []string {
	var out []string
	for _, item := range list(value) {
		out = append(out, item.(string))
	}
	return out
}

// Other races have no titles.
func TestNoTitlesOutsideItemRaces(t *testing.T) {
	h := newHarness(t)
	players := h.connectN(2)
	roomID, raceID := h.startRace(players, "ordinary", "speedIndiCombine", 2)
	h.clock.Advance(20 * time.Second)
	h.must(players[0], map[string]any{"type": "finish", "roomId": roomID, "raceId": raceID, "elapsedMs": 30_000,
		"perfectStart": true})
	room := h.command(players[1], finishRequest(roomID, raceID, 31_000))
	for _, row := range list(raceOf(room)["results"]) {
		if _, ok := object(row)["titles"]; ok {
			t.Fatal("titles in a speed race")
		}
	}
}
