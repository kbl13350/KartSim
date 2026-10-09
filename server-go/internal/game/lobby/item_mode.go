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
// for the replies. Each accepted cube, use and swap reply carries the
// racer's authoritative slots.

import (
	crand "crypto/rand"
	"encoding/binary"
	"encoding/json"
	"errors"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"

	"kartsim/internal/game/itemmode"
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
// from the team table.
func (l *Lobby) startItemRace(r *room, rc *race) {
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
	}
	items, err := itemmode.NewRace(l.items, table, members, l.itemRandom())
	if err != nil {
		l.log.Error("item race not started", "error", err)
		return
	}
	rc.items = items
	rc.item = obj{{"ruleset", itemRuleset}, {"table", table}}
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
	case "swap":
		slots, notices, err := rc.items.Swap(c.playerID, now, itemStandings(rc))
		if err != nil {
			return nil, itemFailure(err)
		}
		l.emitScans(r, notices)
		return itemEvent(r, "slots", field{"sequence", sequence}, field{"slots", slots}), nil
	case "change":
		// The item changer (道具变更卡, Z) comes with the kart and
		// accessory abilities (ITEM_MODE.md 9, phase 3).
		return nil, fail(http.StatusBadRequest, "ITEM_CHANGER_UNAVAILABLE")
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
	grant, notices, err := r.race.items.Cube(c.playerID, cubeID, capacity, now, itemStandings(r.race))
	if err != nil {
		return nil, itemFailure(err)
	}
	var itemID any
	if grant.ItemID != itemmode.NoItem {
		itemID = grant.ItemID
	}
	reply := itemEvent(r, "grant", field{"sequence", sequence}, field{"cubeId", cubeID}, field{"itemId", itemID})
	if grant.Reason != "" {
		reply = append(reply, field{"reason", grant.Reason})
	}
	reply = append(reply, field{"slots", grant.Slots})
	l.emitScans(r, notices)
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
	l.broadcastPeerEvent(r, c, event)
	l.emitScans(r, result.Notices)
	return append(slices.Clone(event), field{"sequence", sequence}, field{"slots", result.Slots}), nil
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

// hitDefences are the "by" values of a hit report.
var hitDefences = []string{itemmode.ByShield, itemmode.ByAngel, itemmode.ByEMP, itemmode.ByEscape}

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
	hazardID := 0
	if useID == 0 {
		// A track-placed hazard (banana, mine, waterMine) has no use.
		if hazardID, err = in.integer("hazardId", 1, itemmode.MaxCubeID); err != nil {
			return nil, err
		}
	}
	hit, fresh, err := r.race.items.Hit(itemmode.HitRequest{VictimID: c.playerID, UseID: useID,
		ItemID: itemID, Result: result, By: by, HazardID: hazardID, Now: now})
	if err != nil {
		return nil, itemFailure(err)
	}
	var userID any
	if hit.UserID != "" {
		userID = hit.UserID
	}
	event := itemEvent(r, "hit", field{"playerId", hit.VictimID}, field{"useId", hit.UseID},
		field{"itemId", hit.ItemID}, field{"userId", userID}, field{"result", hit.Result})
	if hit.By != "" {
		event = append(event, field{"by", hit.By})
	}
	if hit.HazardID != 0 {
		event = append(event, field{"hazardId", hit.HazardID})
	}
	if hit.Removed {
		event = append(event, field{"removed", true})
	}
	// A repeated report answers the recorded hit again without telling the
	// others twice.
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
