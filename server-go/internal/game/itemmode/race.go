package itemmode

import (
	"fmt"
	"slices"
)

// Error is a rejected item request; Code is the protocol error code. The
// race state is unchanged after one.
type Error struct{ Code string }

func (e *Error) Error() string { return "item request rejected: " + e.Code }

var (
	// ErrNotHeld: slot 0 does not hold the item.
	ErrNotHeld = &Error{"ITEM_NOT_HELD"}
	// ErrLocked: the racer is under a slot lock (only the angel is usable).
	ErrLocked = &Error{"ITEM_LOCKED"}
	// ErrInvalidUse: the request does not fit the item, the racer or the use
	// (unknown or expired useId, wrong reporter, a removed banana…).
	ErrInvalidUse = &Error{"INVALID_USE"}
	// ErrInvalidTarget: the aimed target or the hit victim is not one the
	// item can affect.
	ErrInvalidTarget = &Error{"INVALID_TARGET"}
	// ErrInvalidPoint: the item needs a point.
	ErrInvalidPoint = &Error{"INVALID_POINT"}
	// ErrInvalidResult: a hit result other than hit or blocked.
	ErrInvalidResult = &Error{"INVALID_RESULT"}
	// ErrInvalidBy: a defence that cannot block the item, or one named with
	// a hit.
	ErrInvalidBy = &Error{"INVALID_BY"}
	// ErrInvalidTestItem: a test grant names an item the race's table does
	// not have.
	ErrInvalidTestItem = &Error{"INVALID_TESTITEMID"}
)

const (
	// UseLifetimeMs is how long a use accepts place and hit reports.
	UseLifetimeMs = 60_000
	// CubeAbuseWindowMs: eating the same cube again within this, with no
	// other cube in between, grants nothing (ItemCubeAbusingCheck).
	CubeAbuseWindowMs = 10_000
	// HazardCooldownMs: a track-placed hazard hits one racer at most once
	// in this window; reports inside it repeat the first.
	HazardCooldownMs = 3_000
	// MaxCubeID bounds the cube IDs (the instanceOrdinal of a track's cubes).
	MaxCubeID = 4096
)

// NoItem is the ItemID of a grant that gives nothing.
const NoItem = -1

// Grant reasons.
const (
	ReasonFull    = "full"
	ReasonAbusing = "abusing"
)

// Hit results.
const (
	ResultHit     = "hit"
	ResultBlocked = "blocked"
)

// Member is a racer of the race and its team (0 in an individual race).
type Member struct {
	ID   string
	Team int
}

// Point is a client position (Z up), as the client reports it.
type Point struct{ X, Y, Z float64 }

// Grant answers a cube pickup.
type Grant struct {
	CubeID int
	ItemID int    // NoItem when nothing was granted
	Reason string // ReasonFull, ReasonAbusing or "" (granted, or nothing left to draw)
	Slots  []int
}

// Use is one item use, live for UseLifetimeMs from StartAt.
type Use struct {
	ID       int
	PlayerID string
	ItemID   int
	Targets  []string
	StartAt  int64
	// EtaMs is when a tracking item reaches its target, from StartAt; 0 for
	// other items.
	EtaMs int
	// Point is the drop or landing point given with the use (banana, water
	// bomb); Placed the point reported by place (barricade, time bomb).
	Point  *Point
	Placed *Point

	hits    map[string]Hit
	removed bool
}

// Hit is a victim's report on an item or a track hazard.
type Hit struct {
	VictimID string
	UseID    int // 0 for a track hazard
	ItemID   int
	UserID   string // "" for a track hazard
	Result   string
	By       string
	HazardID int
	// Removed: this hit removed the item (the first hit on a banana).
	Removed bool
	At      int64

	// escaped: the victim left the trap of this hit early (Escape).
	escaped bool
}

// ScanNotice is a scanned opponent's slots for a racer whose team scans.
type ScanNotice struct {
	Viewer  string
	Subject string
	Slots   []int
	Until   int64
}

type window struct{ from, until int64 }

type hazardKey struct {
	victim string
	hazard int
}

// racer is one racer's item state.
type racer struct {
	slots         Slots
	capacityFixed bool
	obtained      map[int]int
	lastCube      int
	lastCubeAt    int64
	locks         []window
}

func (p *racer) locked(now int64) bool {
	return slices.ContainsFunc(p.locks, func(w window) bool { return w.from <= now && now < w.until })
}

// Race is the item state of one race. It is not safe for concurrent use
// (the lobby runs it under its lock).
type Race struct {
	data    *Data
	table   *Table
	random  Random
	members []Member
	teams   map[string]int
	racers  map[string]*racer
	uses    map[int]*Use
	lastUse int
	scans   map[string]int64 // viewer -> end of its team's scan
	hazards map[hazardKey]Hit
}

// NewRace starts the item state of a race drawing from table kind
// (TableIndividual or TableTeam) for its members.
func NewRace(data *Data, kind string, members []Member, random Random) (*Race, error) {
	table := data.Table(kind)
	if table == nil {
		return nil, fmt.Errorf("itemmode: no table %q", kind)
	}
	r := &Race{data: data, table: table, random: random, members: slices.Clone(members),
		teams: map[string]int{}, racers: map[string]*racer{}, uses: map[int]*Use{},
		scans: map[string]int64{}, hazards: map[hazardKey]Hit{}}
	for _, m := range members {
		r.teams[m.ID] = m.Team
		r.racers[m.ID] = &racer{slots: NewSlots(MinCapacity), obtained: map[int]int{}}
	}
	return r, nil
}

// TableKind returns the kind of table the race draws from.
func (r *Race) TableKind() string {
	if r.table == r.data.Table(TableTeam) {
		return TableTeam
	}
	return TableIndividual
}

// teammates reports whether a and b are the same racer or on one team.
func (r *Race) teammates(a, b string) bool {
	return a == b || (r.teams[a] != 0 && r.teams[a] == r.teams[b])
}

// Slots returns a racer's slots, one value per slot (Empty when empty).
func (r *Race) Slots(playerID string) []int {
	if p := r.racers[playerID]; p != nil {
		return p.slots.Values()
	}
	return nil
}

// racing returns the racer of playerID when it is still racing.
func (r *Race) racing(playerID string, standings []Racer) *racer {
	p := r.racers[playerID]
	i := slices.IndexFunc(standings, func(s Racer) bool { return s.ID == playerID })
	if p == nil || i < 0 || !standings[i].Racing() {
		return nil
	}
	return p
}

// Cube handles a racer eating cube cubeID (ITEM_MODE.md 3, 4). The first
// report fixes the racer's slot capacity (clamped to 2..3). Eating the same
// cube again within CubeAbuseWindowMs with no other cube in between, or
// eating with full slots, grants nothing; otherwise an item is drawn by the
// racer's rank group, leaving out the items it already got as often as
// their cap allows.
func (r *Race) Cube(playerID string, cubeID, capacity int, now int64, standings []Racer) (Grant, []ScanNotice, error) {
	return r.cube(playerID, cubeID, capacity, NoItem, now, standings)
}

// TestCube is Cube with the granted item named instead of drawn (a test
// grant, for the game node's KART_ITEM_TEST_GRANTS development switch): the
// same abuse and full-slot rules apply, the per-race caps do not (the item
// still counts toward them). The item must be one of the race's table.
func (r *Race) TestCube(playerID string, cubeID, capacity, itemID int, now int64, standings []Racer) (Grant, []ScanNotice, error) {
	if !r.table.Contains(itemID) {
		return Grant{}, nil, ErrInvalidTestItem
	}
	return r.cube(playerID, cubeID, capacity, itemID, now, standings)
}

// cube grants a cube's item: forced when it is not NoItem, otherwise drawn.
func (r *Race) cube(playerID string, cubeID, capacity, forced int, now int64, standings []Racer) (Grant, []ScanNotice, error) {
	p := r.racing(playerID, standings)
	if p == nil || cubeID < 1 || cubeID > MaxCubeID {
		return Grant{}, nil, ErrInvalidUse
	}
	if !p.capacityFixed {
		p.slots.SetCapacity(capacity)
		p.capacityFixed = true
	}
	grant := Grant{CubeID: cubeID, ItemID: NoItem}
	abusing := p.lastCube == cubeID && now-p.lastCubeAt < CubeAbuseWindowMs
	p.lastCube, p.lastCubeAt = cubeID, now
	switch {
	case abusing:
		grant.Reason = ReasonAbusing
	case p.slots.Full():
		grant.Reason = ReasonFull
	case forced != NoItem:
		p.slots.Add(forced)
		p.obtained[forced]++
		grant.ItemID = forced
	default:
		group := GroupOf(rankOf(standings, playerID), len(standings))
		capped := func(idx int) bool {
			allow, limited := r.data.Cap(idx)
			return limited && p.obtained[idx] >= allow
		}
		if idx, ok := r.table.Draw(group, capped, r.random); ok {
			p.slots.Add(idx)
			p.obtained[idx]++
			grant.ItemID = idx
		}
	}
	grant.Slots = p.slots.Values()
	if grant.ItemID == NoItem {
		return grant, nil, nil
	}
	return grant, r.scanNotices(playerID, now), nil
}

// UseRequest is a racer using the item in slot 0.
type UseRequest struct {
	PlayerID string
	ItemID   int
	// TargetID is the aimed target of a rocket or magnet ("" for none: a
	// misfire); ignored for other items.
	TargetID  string
	Point     *Point
	Now       int64
	Standings []Racer
}

// UseResult is an accepted use: the use, the user's slots after it, and
// the scan notices it causes.
type UseResult struct {
	Use     *Use
	Slots   []int
	Notices []ScanNotice
}

// UseItem handles a racer using the item in slot 0 (ITEM_MODE.md 5,
// appendix B): it must hold the item, not be slot-locked (the angel is
// always usable), and give a point for the banana and water bomb. The
// server picks the targets, starts the use now and, for tracking items,
// computes etaMs from the route distance between user and target. A slot
// lock locks its targets from Use.life after the start for
// Affect.life + Postaffect.life; a scan lets the user's team see the
// opponents' slots for Affect.life.
func (r *Race) UseItem(req UseRequest) (UseResult, error) {
	p := r.racing(req.PlayerID, req.Standings)
	if p == nil {
		return UseResult{}, ErrInvalidUse
	}
	if first, ok := p.slots.First(); !ok || first != req.ItemID {
		return UseResult{}, ErrNotHeld
	}
	if req.ItemID != Angel && p.locked(req.Now) {
		return UseResult{}, ErrLocked
	}
	rule, ok := rules[req.ItemID]
	if !ok {
		return UseResult{}, ErrInvalidUse
	}
	if rule.point && req.Point == nil {
		return UseResult{}, ErrInvalidPoint
	}
	targets, err := r.targets(rule.target, req.PlayerID, req.TargetID, req.Standings)
	if err != nil {
		return UseResult{}, err
	}
	use := &Use{PlayerID: req.PlayerID, ItemID: req.ItemID, Targets: targets, StartAt: req.Now,
		hits: map[string]Hit{}}
	if rule.speed > 0 && len(targets) == 1 {
		item, _ := r.data.Item(rule.etaItem)
		gap := distanceOf(req.Standings, targets[0]) - distanceOf(req.Standings, req.PlayerID)
		use.EtaMs = EtaMs(gap, rule.speed, item.Life(rule.etaState))
	}
	if rule.point {
		point := *req.Point
		use.Point = &point
	}
	p.slots.TakeFirst()
	r.prune(req.Now)
	r.lastUse++
	use.ID = r.lastUse
	r.uses[use.ID] = use
	notices := r.scanNotices(req.PlayerID, req.Now)
	switch req.ItemID {
	case SlotLock:
		item, _ := r.data.Item(SlotLock)
		from := req.Now + int64(item.Life("Use"))
		lock := window{from: from, until: from + int64(item.Life("Affect")+item.Life("Postaffect"))}
		for _, id := range targets {
			victim := r.racers[id]
			if victim == nil {
				continue
			}
			victim.locks = append(slices.DeleteFunc(victim.locks, func(w window) bool {
				return w.until <= req.Now
			}), lock)
		}
	case Scanning:
		item, _ := r.data.Item(Scanning)
		until := req.Now + int64(item.Life("Affect"))
		for _, viewer := range targets {
			r.scans[viewer] = max(r.scans[viewer], until)
		}
		for _, viewer := range targets {
			for _, s := range req.Standings {
				if s.Racing() && !r.teammates(viewer, s.ID) {
					notices = append(notices, ScanNotice{Viewer: viewer, Subject: s.ID,
						Slots: r.Slots(s.ID), Until: r.scans[viewer]})
				}
			}
		}
	}
	return UseResult{Use: use, Slots: p.slots.Values(), Notices: notices}, nil
}

// targets picks a use's targets by rule.
func (r *Race) targets(rule TargetRule, user, aimed string, standings []Racer) ([]string, error) {
	position := slices.IndexFunc(standings, func(s Racer) bool { return s.ID == user })
	opponents := func(from, to int) []string {
		var ids []string
		for _, s := range standings[from:to] {
			if s.Racing() && !r.teammates(user, s.ID) {
				ids = append(ids, s.ID)
			}
		}
		return ids
	}
	switch rule {
	case TargetSelf:
		return []string{user}, nil
	case TargetOwnTeam:
		ids := []string{user}
		for _, s := range standings {
			if s.ID != user && s.Racing() && r.teammates(user, s.ID) {
				ids = append(ids, s.ID)
			}
		}
		return ids, nil
	case TargetAheadOne:
		if ahead := opponents(0, position); len(ahead) > 0 {
			return ahead[len(ahead)-1:], nil
		}
		return []string{}, nil
	case TargetLeader:
		if all := opponents(0, len(standings)); len(all) > 0 {
			return all[:1], nil
		}
		return []string{}, nil
	case TargetRandomAhead:
		if ahead := opponents(0, position); len(ahead) > 0 {
			return []string{ahead[r.random.IntN(len(ahead))]}, nil
		}
		return []string{}, nil
	case TargetAllAhead:
		return orEmpty(opponents(0, position)), nil
	case TargetAllBehind:
		return orEmpty(opponents(position+1, len(standings))), nil
	case TargetAllOpponents:
		return orEmpty(opponents(0, len(standings))), nil
	case TargetAimed:
		if aimed == "" {
			return []string{}, nil
		}
		if !slices.Contains(opponents(0, len(standings)), aimed) {
			return nil, ErrInvalidTarget
		}
		return []string{aimed}, nil
	}
	return []string{}, nil
}

func orEmpty(ids []string) []string {
	if ids == nil {
		return []string{}
	}
	return ids
}

func distanceOf(standings []Racer, id string) float64 {
	if i := slices.IndexFunc(standings, func(s Racer) bool { return s.ID == id }); i >= 0 {
		return standings[i].Distance
	}
	return 0
}

// prune forgets the uses past their lifetime.
func (r *Race) prune(now int64) {
	for id, use := range r.uses {
		if now-use.StartAt > UseLifetimeMs {
			delete(r.uses, id)
		}
	}
}

// liveUse returns a use still accepting reports.
func (r *Race) liveUse(id int, now int64) *Use {
	use := r.uses[id]
	if use == nil || now-use.StartAt > UseLifetimeMs {
		return nil
	}
	return use
}

// Place records where a barricade lands (reported by its target, the
// leader) or where a time bomb explodes (reported by its user), once.
func (r *Race) Place(playerID string, useID int, point Point, now int64) (*Use, error) {
	use := r.liveUse(useID, now)
	if use == nil || use.Placed != nil {
		return nil, ErrInvalidUse
	}
	switch rules[use.ItemID].place {
	case placeByTarget:
		if len(use.Targets) == 0 || use.Targets[0] != playerID {
			return nil, ErrInvalidUse
		}
	case placeByUser:
		if use.PlayerID != playerID {
			return nil, ErrInvalidUse
		}
	default:
		return nil, ErrInvalidUse
	}
	use.Placed = &point
	return use, nil
}

// HitRequest is a victim's report (the victim decides whether it was hit).
type HitRequest struct {
	VictimID string
	// UseID is the use that hit, 0 for a track-placed hazard (HazardID).
	UseID    int
	ItemID   int
	Result   string // ResultHit or ResultBlocked
	By       string // the defence of a blocked item ("" when not named)
	HazardID int
	Now      int64
}

// Hit records a hit report. A victim reports each use once: a repeat
// returns the first report with fresh false (and a hazard repeats its
// report within HazardCooldownMs). Only the targets of a targeted item may
// report; anyone for a banana or a time bomb; opponents of the user for a
// water bomb or a barricade. The first hit on a banana removes it, and
// later reports on it are rejected.
func (r *Race) Hit(req HitRequest) (hit Hit, fresh bool, err error) {
	if r.racers[req.VictimID] == nil {
		return Hit{}, false, ErrInvalidTarget
	}
	hit = Hit{VictimID: req.VictimID, UseID: req.UseID, ItemID: req.ItemID, Result: req.Result,
		By: req.By, At: req.Now}
	if req.UseID == 0 {
		blocks, ok := hazardBlocks[req.ItemID]
		if !ok || req.HazardID < 1 {
			return Hit{}, false, ErrInvalidUse
		}
		if err := checkDefence(req.Result, req.By, blocks); err != nil {
			return Hit{}, false, err
		}
		key := hazardKey{req.VictimID, req.HazardID}
		if previous, ok := r.hazards[key]; ok && req.Now-previous.At < HazardCooldownMs {
			return previous, false, nil
		}
		hit.HazardID = req.HazardID
		r.hazards[key] = hit
		return hit, true, nil
	}
	use := r.liveUse(req.UseID, req.Now)
	if use == nil || use.ItemID != req.ItemID {
		return Hit{}, false, ErrInvalidUse
	}
	rule := rules[use.ItemID]
	switch rule.hit {
	case hitNone:
		return Hit{}, false, ErrInvalidUse
	case hitTargets:
		if !slices.Contains(use.Targets, req.VictimID) {
			return Hit{}, false, ErrInvalidTarget
		}
	case hitOpponents:
		if r.teammates(use.PlayerID, req.VictimID) {
			return Hit{}, false, ErrInvalidTarget
		}
	}
	if previous, ok := use.hits[req.VictimID]; ok {
		return previous, false, nil
	}
	if use.removed {
		return Hit{}, false, ErrInvalidUse
	}
	if err := checkDefence(req.Result, req.By, rule.blocks); err != nil {
		return Hit{}, false, err
	}
	hit.UserID = use.PlayerID
	if use.ItemID == Banana {
		use.removed = true
		hit.Removed = true
	}
	use.hits[req.VictimID] = hit
	return hit, true, nil
}

// Escape records that a trapped racer left its water bubble early by
// pressing left/right (ITEM_MODE.md 6): the victim's own notice after a hit
// it reported on a trapping use (water bomb, water fly, time bomb) or, with
// useID 0, on a water mine hazard (hazardID), so the others end the bubble
// and start the blue shield then. It returns the trapping hit. Each hit
// escapes once: a repeat returns the hit again with fresh false.
func (r *Race) Escape(playerID string, useID, hazardID int, now int64) (Hit, bool, error) {
	if r.racers[playerID] == nil {
		return Hit{}, false, ErrInvalidTarget
	}
	if useID == 0 {
		key := hazardKey{playerID, hazardID}
		hit, ok := r.hazards[key]
		if hazardID < 1 || !ok || hit.Result != ResultHit || !trapHazards[hit.ItemID] {
			return Hit{}, false, ErrInvalidUse
		}
		if hit.escaped {
			return hit, false, nil
		}
		hit.escaped = true
		r.hazards[key] = hit
		return hit, true, nil
	}
	use := r.liveUse(useID, now)
	if use == nil || !rules[use.ItemID].trap {
		return Hit{}, false, ErrInvalidUse
	}
	hit, ok := use.hits[playerID]
	if !ok || hit.Result != ResultHit {
		return Hit{}, false, ErrInvalidUse
	}
	if hit.escaped {
		return hit, false, nil
	}
	hit.escaped = true
	use.hits[playerID] = hit
	return hit, true, nil
}

func checkDefence(result, by string, blocks []string) error {
	switch result {
	case ResultHit:
		if by != "" {
			return ErrInvalidBy
		}
	case ResultBlocked:
		if by != "" && by != ByEscape && !slices.Contains(blocks, by) {
			return ErrInvalidBy
		}
	default:
		return ErrInvalidResult
	}
	return nil
}

// Swap exchanges slots 0 and 1 (the slot changer, Alt); both must hold an
// item.
func (r *Race) Swap(playerID string, now int64, standings []Racer) ([]int, []ScanNotice, error) {
	p := r.racing(playerID, standings)
	if p == nil || !p.slots.Swap() {
		return nil, nil, ErrInvalidUse
	}
	return p.slots.Values(), r.scanNotices(playerID, now), nil
}

// scanNotices are the notices of subject's changed slots for the
// opponents whose team is scanning.
func (r *Race) scanNotices(subject string, now int64) []ScanNotice {
	var notices []ScanNotice
	for _, m := range r.members {
		until := r.scans[m.ID]
		if until <= now || r.teammates(m.ID, subject) {
			continue
		}
		notices = append(notices, ScanNotice{Viewer: m.ID, Subject: subject, Slots: r.Slots(subject), Until: until})
	}
	return notices
}

// Locked reports whether a racer is under a slot lock at now.
func (r *Race) Locked(playerID string, now int64) bool {
	p := r.racers[playerID]
	return p != nil && p.locked(now)
}

// Lookup returns a use still accepting reports.
func (r *Race) Lookup(useID int, now int64) (*Use, bool) {
	use := r.liveUse(useID, now)
	return use, use != nil
}
