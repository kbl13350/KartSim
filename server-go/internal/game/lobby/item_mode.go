package lobby

// Item races (道具个人赛 / 组队道具赛, rewrite/ITEM_MODE.md): rooms of the
// gameplay "item" in the channels itemIndiCombine and itemTeamCombine. The
// rules live in internal/game/itemmode; this file checks the "item"
// requests (ITEM_MODE.md 5) and turns the results into item events.
//
// Every item request carries the racer's next sequence number. Once the
// sequence is accepted it is used up, even when the request is then
// rejected (a rejection is an ordinary error reply that changes nothing and
// does not end the race), so a client numbers its requests without waiting
// for the replies. Each accepted cube, use, swap and change reply carries
// the racer's authoritative slots and changer cards; a slots request asks
// for them alone (a client that lost track after a rejection). Slots the
// server changes on its own (a per-kart table's gain, the race start) are
// pushed as {"action":"slots","reason"}.

import (
	crand "crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"

	"kartsim/internal/game/anticheat"
	"kartsim/internal/game/itemmode"
	"kartsim/internal/shared/contract"
)

const itemRuleset = "web-item-v1"

// itemLoadingWindowMs is the loading window of an item race: the item
// models and effects load on top of the track (90 s like the other special
// modes).
const itemLoadingWindowMs = 90_000

// maxPointComponent bounds the coordinates of a reported point.
const maxPointComponent = 1e6

func isItemChannel(channel string) bool {
	return channel == "itemIndiCombine" || channel == "itemTeamCombine"
}

// newItemRandom is the default random source of an item race: a PCG seeded
// from crypto/rand.
func newItemRandom() itemmode.Random {
	var seed [16]byte
	_, _ = crand.Read(seed[:])
	return rand.New(rand.NewPCG(binary.LittleEndian.Uint64(seed[:8]), binary.LittleEndian.Uint64(seed[8:])))
}

// initializeItemTrack gives a new item room the default item track.
func (l *Lobby) initializeItemTrack(r *room) {
	if r.gameplay == "item" && l.items != nil {
		r.trackID = l.items.DefaultTrack
	}
}

// validateTrack checks a fixed track: item rooms accept only the exported
// item tracks (TRACK_NOT_ITEM); other rooms follow their gameplay's rules.
func (l *Lobby) validateTrack(r *room, trackID string) error {
	if r.gameplay != "item" {
		return validateTrack(r, trackID)
	}
	if l.items == nil {
		return fail(http.StatusBadRequest, "INVALID_TRACK")
	}
	if _, ok := l.items.Track(trackID); !ok {
		return fail(http.StatusBadRequest, "TRACK_NOT_ITEM")
	}
	return nil
}

// validateRandomTrack checks a random-track code: item rooms accept the
// codes of the item pools (3-7 hot1-hot5, 0 all, 8 new, 30 reverse).
func (l *Lobby) validateRandomTrack(r *room, code int) error {
	if r.gameplay != "item" {
		return validateRandomTrack(r, code)
	}
	if l.items == nil || l.items.Pool(code) == nil {
		return fail(http.StatusBadRequest, "INVALID_TRACK")
	}
	return nil
}

// chooseTrack picks the race track: an item room's random code draws from
// its item pool.
func (l *Lobby) chooseTrack(r *room) string {
	if r.gameplay == "item" && r.trackID == "" && r.randomTrackCode != nil && l.items != nil {
		if pool := l.items.Pool(*r.randomTrackCode); len(pool) > 0 {
			return pool[rand.IntN(len(pool))]
		}
		return l.items.DefaultTrack
	}
	return chooseTrack(r)
}

// startItemRace sets up the item state of a starting item race and its
// race.item ruleset: individual rooms draw from the indi table, team rooms
// from the team table. Each racer races with its frozen equipment (the
// passives, ITEM_MODE.md C.2) and the changer cards the start's ownership
// check reported (C.6; none for guests, or every racer unlimited with
// KART_ITEM_CHANGERS=infinite).
func (l *Lobby) startItemRace(r *room, rc *race, check *ownershipCheck) {
	if r.gameplay != "item" || l.items == nil {
		return
	}
	table := itemmode.TableIndividual
	if r.mode == "team" {
		table = itemmode.TableTeam
	}
	members := make([]itemmode.Member, len(rc.rosterIDs))
	for i, id := range rc.rosterIDs {
		members[i] = itemmode.Member{ID: id, Team: rc.rosterTeams[id]}
		if i < len(rc.rosterEquipment) {
			members[i].Equipment = equipmentOf(rc.rosterEquipment[i])
		}
		switch account := rc.rosterAccounts[id]; {
		case l.itemChangers:
			members[i].Changers = itemmode.Changers{Slot: itemmode.Infinite, Item: itemmode.Infinite}
		case account != "" && check != nil:
			members[i].Changers = check.changers[account]
		}
	}
	items, err := itemmode.NewRace(l.items, table, members, l.itemRandom(),
		itemmode.Options{RaceID: rc.id, TrackID: rc.trackID})
	if err != nil {
		l.log.Error("item race not started", "error", err)
		return
	}
	rc.items = items
	rc.item = obj{{"ruleset", itemRuleset}, {"table", table}}
}

// equipmentOf reads the passive slots of a frozen equipment document.
func equipmentOf(raw json.RawMessage) itemmode.Equipment {
	var doc struct {
		ItemIDs map[string]int `json:"itemIds"`
	}
	if json.Unmarshal(raw, &doc) != nil {
		return itemmode.Equipment{}
	}
	return itemmode.EquipmentFromItemIDs(doc.ItemIDs)
}

// flushItemStart sends each loaded racer of a countdown that just began its
// slots and changer cards: {"action":"slots","slots","changers"}, with
// "reason":"start","itemId" for a 迅 item kart's start item (ITEM_MODE.md
// C.3).
func (l *Lobby) flushItemStart(r *room) {
	rc := r.race
	if rc == nil || !rc.itemStartPending || rc.items == nil {
		return
	}
	rc.itemStartPending = false
	var loaded []string
	for _, id := range rc.loadedIDs {
		if !rc.isOut(id) {
			loaded = append(loaded, id)
		}
	}
	for _, notice := range rc.items.Start(loaded) {
		l.emitSlots(r, notice)
	}
}

// emitSlots pushes a racer's slots the server changed on its own, then the
// scan notices they cause.
func (l *Lobby) emitSlots(r *room, notice itemmode.SlotsNotice) {
	if client := l.clients[notice.PlayerID]; client != nil && client.roomID == r.id {
		event := itemEvent(r, "slots", field{"slots", notice.Slots})
		event = withIcons(event, notice.Icons)
		event = append(event, field{"changers", changersObj(r.race.items.Changers(notice.PlayerID))})
		// A reason always comes with the item it explains; a racer that
		// starts empty is told its slots and changers alone.
		if notice.ItemID != itemmode.NoItem {
			event = append(event, field{"reason", notice.Reason}, field{"itemId", notice.ItemID})
		}
		client.emit(encode(event))
	}
	if notice.Reason == itemmode.ReasonGain {
		l.emitScans(r, r.race.items.ScanNotices(notice.PlayerID, l.clock.Now()))
	}
}

// emitLucci tells a racer it earned in-race lucci.
func (l *Lobby) emitLucci(r *room, notice *itemmode.LucciNotice) {
	if notice == nil {
		return
	}
	if client := l.clients[notice.PlayerID]; client != nil && client.roomID == r.id {
		client.emit(encode(itemEvent(r, "lucci", field{"amount", notice.Amount}, field{"reason", notice.Reason})))
	}
}

// changersObj is a reply's "changers": the cards left (-1 with a voucher)
// and whether the item changer may act on slot 0.
func changersObj(state itemmode.ChangerState) obj {
	return obj{{"slot", state.Slot}, {"item", state.Item}, {"itemArmed", state.ItemArmed}}
}

// withIcons adds "slotIcons" (per-slot special booster icon ids, 0 for the
// item's own icon) when a held item has one.
func withIcons(event obj, icons []int) obj {
	if icons != nil {
		event = append(event, field{"slotIcons", icons})
	}
	return event
}

// slotsReply is a reply carrying the racer's slots and changer cards.
func (l *Lobby) slotsReply(r *room, playerID string, sequence int) obj {
	items := r.race.items
	reply := itemEvent(r, "slots", field{"sequence", sequence}, field{"slots", items.Slots(playerID)})
	reply = withIcons(reply, items.Icons(playerID))
	return append(reply, field{"changers", changersObj(items.Changers(playerID))})
}

// itemConsumed are the changer cards the race used up, for the settlement.
func itemConsumed(rc *race) []contract.ConsumedItem {
	if rc.items == nil {
		return nil
	}
	var consumed []contract.ConsumedItem
	for _, id := range rc.rosterIDs {
		account := rc.rosterAccounts[id]
		slot, item := rc.items.Consumed(id)
		if account == "" {
			continue
		}
		for _, used := range []struct{ itemID, count int }{{contract.ItemSlotChanger, slot}, {contract.ItemItemChanger, item}} {
			if used.count > 0 {
				consumed = append(consumed, contract.ConsumedItem{PlayerID: id, AccountID: account,
					Category: contract.CategoryChanger, ItemID: used.itemID, Count: used.count})
			}
		}
	}
	return consumed
}

// itemStandings are the race's standings for item draws and targets: the
// loaded racers, finishers first in finish order, the others by their
// latest route distance.
func itemStandings(rc *race) []itemmode.Racer {
	finishOrder := map[string]int{}
	for i, f := range rc.finishes {
		finishOrder[f.playerID] = i + 1
	}
	racers := make([]itemmode.Racer, 0, len(rc.loadedIDs))
	for _, id := range rc.rosterIDs {
		if rc.isLoaded(id) {
			racers = append(racers, itemmode.Racer{ID: id, Distance: rc.current[id].distance,
				FinishOrder: finishOrder[id], Out: rc.isOut(id)})
		}
	}
	return itemmode.Standings(racers)
}

// itemCommand handles {"type":"item","action":…} (ITEM_MODE.md 5).
func (l *Lobby) itemCommand(c *Client, in Request) (obj, error) {
	r, err := l.raceRoom(c, in)
	if err != nil {
		return nil, err
	}
	rc := r.race
	if r.gameplay != "item" || rc.items == nil {
		return nil, fail(http.StatusBadRequest, "ITEM_UNAVAILABLE")
	}
	if !rc.isLoaded(c.playerID) {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_RUNNING")
	}
	sequence, err := in.integer("sequence", 1, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	if sequence != rc.itemSequences[c.playerID]+1 {
		return nil, fail(http.StatusConflict, "INVALID_SEQUENCE")
	}
	rc.itemSequences[c.playerID] = sequence
	now := l.clock.Now()
	// The race runs from startAt; the timer that switches the phase may
	// fire a moment later.
	if r.phase != "racing" && (r.phase != "countdown" || rc.startAt == nil || now < *rc.startAt) {
		return nil, fail(http.StatusBadRequest, "RACE_NOT_RUNNING")
	}
	action, err := in.text("action", 1, 20)
	if err != nil {
		return nil, err
	}
	switch action {
	case "cube":
		return l.itemCube(r, c, in, sequence, now)
	case "use":
		return l.itemUse(r, c, in, sequence, now)
	case "place":
		return l.itemPlace(r, c, in, sequence, now)
	case "hit":
		return l.itemHit(r, c, in, sequence, now)
	case "escape":
		return l.itemEscape(r, c, in, sequence, now)
	case "slots":
		// A resynchronisation: the racer's current slots; nothing changes.
		return l.slotsReply(r, c.playerID, sequence), nil
	case "swap":
		// 道具换位卡 (Alt): a card or the voucher (ITEM_MODE.md C.6).
		_, notices, err := rc.items.Swap(c.playerID, now, itemStandings(rc))
		if err != nil {
			return nil, itemFailure(err)
		}
		l.emitScans(r, notices)
		return l.slotsReply(r, c.playerID, sequence), nil
	case "change":
		// 道具变更卡 (Z): a card or the voucher, once per new item.
		_, _, notices, err := rc.items.Change(c.playerID, now, itemStandings(rc))
		if err != nil {
			return nil, itemFailure(err)
		}
		l.emitScans(r, notices)
		return l.slotsReply(r, c.playerID, sequence), nil
	}
	return nil, invalid("action")
}

func (l *Lobby) itemCube(r *room, c *Client, in Request, sequence int, now int64) (obj, error) {
	cubeID, err := in.integer("cubeId", 1, itemmode.MaxCubeID)
	if err != nil {
		return nil, err
	}
	// Clamped to 2..3 by the race; the first report fixes it.
	capacity, err := in.integer("capacity", 0, 255)
	if err != nil {
		return nil, err
	}
	if l.cheatMode != anticheat.ModeOff && !l.itemTests {
		if v := l.guard(r, c.playerID).Cube(cubeID, now); v != nil && l.cheated(r, c, v) {
			return nil, errCheatDetected()
		}
	}
	var grant itemmode.Grant
	var notices []itemmode.ScanNotice
	if in.has("testItemId") {
		// A development switch (KART_ITEM_TEST_GRANTS): the test bot names
		// the item instead of drawing it.
		if !l.itemTests {
			return nil, fail(http.StatusForbidden, "ITEM_TEST_GRANTS_DISABLED")
		}
		testItem, err := in.integer("testItemId", 0, 255)
		if err != nil {
			return nil, err
		}
		grant, notices, err = r.race.items.TestCube(c.playerID, cubeID, capacity, testItem, now, itemStandings(r.race))
		if err != nil {
			return nil, itemFailure(err)
		}
	} else if grant, notices, err = r.race.items.Cube(c.playerID, cubeID, capacity, now, itemStandings(r.race)); err != nil {
		return nil, itemFailure(err)
	}
	var itemID any
	if grant.ItemID != itemmode.NoItem {
		itemID = grant.ItemID
	}
	reply := itemEvent(r, "grant", field{"sequence", sequence}, field{"cubeId", cubeID}, field{"itemId", itemID})
	if grant.Icon != 0 {
		reply = append(reply, field{"iconId", grant.Icon})
	}
	if grant.Reason != "" {
		reply = append(reply, field{"reason", grant.Reason})
	}
	reply = withIcons(append(reply, field{"slots", grant.Slots}), grant.Icons)
	reply = append(reply, field{"changers", changersObj(r.race.items.Changers(c.playerID))})
	l.emitScans(r, notices)
	if grant.Lucci > 0 {
		l.emitLucci(r, &itemmode.LucciNotice{PlayerID: c.playerID, Amount: grant.Lucci, Reason: itemmode.LucciItemCube})
	}
	return reply, nil
}

func (l *Lobby) itemUse(r *room, c *Client, in Request, sequence int, now int64) (obj, error) {
	itemID, err := in.integer("itemId", 0, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	targetID := ""
	if value, err := in.optionalText("targetId", 64); err != nil {
		return nil, err
	} else if value != nil {
		targetID = *value
	}
	point, err := optionalPoint(in)
	if err != nil {
		return nil, err
	}
	result, err := r.race.items.UseItem(itemmode.UseRequest{PlayerID: c.playerID, ItemID: itemID,
		TargetID: targetID, Point: point, Now: now, Standings: itemStandings(r.race)})
	if err != nil {
		return nil, itemFailure(err)
	}
	use := result.Use
	event := itemEvent(r, "used", field{"playerId", c.playerID}, field{"useId", use.ID},
		field{"itemId", use.ItemID}, field{"targets", use.Targets}, field{"startAt", use.StartAt},
		field{"etaMs", use.EtaMs})
	if use.Point != nil {
		event = append(event, field{"point", pointObj(*use.Point)})
	}
	if use.Count > 1 {
		// A double rocket (useTwoRocket / useTwoGoldRocket, ITEM_MODE.md C.2).
		event = append(event, field{"count", use.Count})
	}
	l.broadcastPeerEvent(r, c, event)
	l.emitScans(r, result.Notices)
	for _, gain := range result.Gains {
		l.emitSlots(r, gain)
	}
	reply := withIcons(append(slices.Clone(event), field{"sequence", sequence}, field{"slots", result.Slots}), result.Icons)
	return append(reply, field{"changers", changersObj(r.race.items.Changers(c.playerID))}), nil
}

func (l *Lobby) itemPlace(r *room, c *Client, in Request, sequence int, now int64) (obj, error) {
	useID, err := in.integer("useId", 1, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	point, err := optionalPoint(in)
	if err != nil {
		return nil, err
	}
	if point == nil {
		return nil, invalid("point")
	}
	use, err := r.race.items.Place(c.playerID, useID, *point, now)
	if err != nil {
		return nil, itemFailure(err)
	}
	event := itemEvent(r, "placed", field{"useId", use.ID}, field{"itemId", use.ItemID},
		field{"playerId", use.PlayerID}, field{"point", pointObj(*use.Placed)})
	l.broadcastPeerEvent(r, c, event)
	return append(slices.Clone(event), field{"sequence", sequence}), nil
}

// hitDefences are the "by" values of a hit report, and hitVariants its
// "variant" values (ITEM_MODE.md C.7).
var (
	hitDefences = []string{itemmode.ByShield, itemmode.ByAngel, itemmode.ByEMP, itemmode.ByEscape,
		itemmode.ByKart, itemmode.ByPet, itemmode.ByEat}
	hitVariants = []string{itemmode.VariantSmall, itemmode.VariantHeadband, itemmode.VariantBonus,
		itemmode.VariantQuick, itemmode.VariantBalloon}
)

func (l *Lobby) itemHit(r *room, c *Client, in Request, sequence int, now int64) (obj, error) {
	useID, err := in.integer("useId", 0, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	itemID, err := in.integer("itemId", 0, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	result, err := in.text("result", 1, 10)
	if err != nil {
		return nil, err
	}
	if result != itemmode.ResultHit && result != itemmode.ResultBlocked {
		return nil, invalid("result")
	}
	by := ""
	if value, err := in.optionalText("by", 10); err != nil {
		return nil, err
	} else if value != nil {
		if !slices.Contains(hitDefences, *value) {
			return nil, invalid("by")
		}
		by = *value
	}
	variant := ""
	if value, err := in.optionalText("variant", 10); err != nil {
		return nil, err
	} else if value != nil {
		if !slices.Contains(hitVariants, *value) {
			return nil, invalid("variant")
		}
		variant = *value
	}
	shot := 0
	if in.hasNonNull("shot") {
		if shot, err = in.integer("shot", 0, 1); err != nil {
			return nil, err
		}
	}
	hazardID := 0
	if useID == 0 {
		// A track-placed hazard (banana, mine, waterMine) has no use.
		if hazardID, err = in.integer("hazardId", 1, itemmode.MaxCubeID); err != nil {
			return nil, err
		}
	}
	hit, fresh, err := r.race.items.Hit(itemmode.HitRequest{VictimID: c.playerID, UseID: useID,
		ItemID: itemID, Result: result, By: by, Variant: variant, Shot: shot, HazardID: hazardID, Now: now})
	if err != nil {
		return nil, itemFailure(err)
	}
	event := itemEvent(r, "hit", field{"playerId", hit.VictimID}, field{"useId", hit.UseID},
		field{"itemId", hit.ItemID})
	// A track hazard has no user: userId is left out (the browser's event
	// validator accepts an absent userId, not null).
	if hit.UserID != "" {
		event = append(event, field{"userId", hit.UserID})
	}
	event = append(event, field{"result", hit.Result})
	if hit.By != "" {
		event = append(event, field{"by", hit.By})
	}
	if hit.Variant != "" {
		event = append(event, field{"variant", hit.Variant})
	}
	if hit.Shot != 0 {
		event = append(event, field{"shot", hit.Shot})
	}
	if hit.HazardID != 0 {
		event = append(event, field{"hazardId", hit.HazardID})
	}
	if hit.Removed {
		event = append(event, field{"removed", true})
	}
	// A repeated report answers the recorded hit again without telling the
	// others twice, nor gaining or paying again.
	if fresh {
		l.broadcastPeerEvent(r, c, event)
		if hit.Gain != nil {
			l.emitSlots(r, *hit.Gain)
		}
		l.emitLucci(r, hit.Lucci)
	}
	return append(slices.Clone(event), field{"sequence", sequence}), nil
}

// itemEscape relays a trapped racer leaving its bubble early: the others end
// the bubble and start the blue shield then. A repeat answers again without
// telling the others twice.
func (l *Lobby) itemEscape(r *room, c *Client, in Request, sequence int, now int64) (obj, error) {
	useID, err := in.integer("useId", 0, math.MaxInt32)
	if err != nil {
		return nil, err
	}
	hazardID := 0
	if useID == 0 {
		if hazardID, err = in.integer("hazardId", 1, itemmode.MaxCubeID); err != nil {
			return nil, err
		}
	}
	hit, fresh, err := r.race.items.Escape(c.playerID, useID, hazardID, now)
	if err != nil {
		return nil, itemFailure(err)
	}
	event := itemEvent(r, "escaped", field{"playerId", hit.VictimID}, field{"useId", hit.UseID},
		field{"itemId", hit.ItemID})
	if hit.HazardID != 0 {
		event = append(event, field{"hazardId", hit.HazardID})
	}
	if fresh {
		l.broadcastPeerEvent(r, c, event)
	}
	return append(slices.Clone(event), field{"sequence", sequence}), nil
}

// itemEvent starts an item event of the race of r.
func itemEvent(r *room, action string, fields ...field) obj {
	return append(obj{{"type", "item"}, {"roomId", r.id}, {"raceId", r.race.id}, {"action", action}}, fields...)
}

// emitScans sends scan notices to the scanning racers still in the room.
func (l *Lobby) emitScans(r *room, notices []itemmode.ScanNotice) {
	for _, notice := range notices {
		viewer := l.clients[notice.Viewer]
		if viewer == nil || viewer.roomID != r.id {
			continue
		}
		viewer.emit(encode(itemEvent(r, "scan", field{"playerId", notice.Subject},
			field{"slots", notice.Slots}, field{"until", notice.Until})))
	}
}

// itemFailure turns an itemmode rejection into its error code.
func itemFailure(err error) error {
	var rejected *itemmode.Error
	if errors.As(err, &rejected) {
		return fail(http.StatusBadRequest, rejected.Code)
	}
	return err
}

// optionalPoint reads "point": absent or null is nil; otherwise an object
// of finite numbers x, y and z (client coordinates) within ±1e6.
func optionalPoint(in Request) (*itemmode.Point, error) {
	raw, ok := in.get("point")
	if !ok || kindOf(raw) == kindNull {
		return nil, nil
	}
	var fields map[string]json.RawMessage
	if kindOf(raw) != kindObject || json.Unmarshal(raw, &fields) != nil {
		return nil, invalid("point")
	}
	var values [3]float64
	for i, key := range []string{"x", "y", "z"} {
		value, ok := doubleValue(fields[key])
		if !ok || math.IsNaN(value) || math.Abs(value) > maxPointComponent {
			return nil, invalid("point")
		}
		values[i] = value
	}
	return &itemmode.Point{X: values[0], Y: values[1], Z: values[2]}, nil
}

func pointObj(p itemmode.Point) obj {
	return obj{{"x", jdouble(p.X)}, {"y", jdouble(p.Y)}, {"z", jdouble(p.Z)}}
}
