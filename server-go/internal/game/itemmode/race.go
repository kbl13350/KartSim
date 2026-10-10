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
	// ErrInvalidBy: a defence that cannot block the item (an equipment
	// defence the racer's frozen equipment and the shared roll do not give),
	// or one named with a hit.
	ErrInvalidBy = &Error{"INVALID_BY"}
	// ErrInvalidVariant: a hit variant the item or the racer's equipment
	// (and the shared roll) does not give.
	ErrInvalidVariant = &Error{"INVALID_VARIANT"}
	// ErrInvalidShot: a shot the use did not fire (only a double rocket has
	// shot 1).
	ErrInvalidShot = &Error{"INVALID_SHOT"}
	// ErrInvalidTestItem: a test grant names an item the race's table does
	// not have.
	ErrInvalidTestItem = &Error{"INVALID_TESTITEMID"}
	// ErrNoChanger: the racer has no card or voucher for the changer.
	ErrNoChanger = &Error{"ITEM_CHANGER_UNAVAILABLE"}
	// ErrChangerUsed: the item changer was already used on the item in slot
	// 0 (once per newly obtained item).
	ErrChangerUsed = &Error{"ITEM_CHANGER_USED"}
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
	// quickEscapeMs is how long a waterAngel kart stays trapped (C.2).
	quickEscapeMs = 500
	// reportSlackMs widens the windows a report is checked against (a gold
	// shield, a UFO slow) for the time the report takes to arrive.
	reportSlackMs = 1_000
)

// NoItem is the ItemID of a grant that gives nothing.
const NoItem = -1

// Grant reasons.
const (
	ReasonFull    = "full"
	ReasonAbusing = "abusing"
)

// Slots notice reasons ({"action":"slots","reason"}).
const (
	ReasonGain  = "gain"  // fired2Gain / firing2Gain
	ReasonStart = "start" // the race start (and the 迅 item karts' start item)
)

// Hit results.
const (
	ResultHit     = "hit"
	ResultBlocked = "blocked"
)

// Infinite is a changer count meaning a valid voucher (使用券): unlimited.
const Infinite = -1

// Changers are a racer's item changer cards at race start: Slot the
// 道具换位卡 (7:1) count, Item the 道具变更卡 (7:2) count, Infinite while
// it holds a valid 道具换位卡使用券 (7:4) / 道具变更卡使用券 (7:3).
type Changers struct{ Slot, Item int }

// ChangerState is what a racer's changer HUD shows: the cards left
// (Infinite with a voucher) and whether the item changer may act on the
// item in slot 0 (it was obtained since the last change).
type ChangerState struct {
	Slot, Item int
	ItemArmed  bool
}

// Member is a racer of the race: its team (0 in an individual race), its
// frozen equipment and its changer cards.
type Member struct {
	ID        string
	Team      int
	Equipment Equipment
	Changers  Changers
}

// Options are the race facts the rules read.
type Options struct {
	// RaceID seeds the shared rolls.
	RaceID string
	// TrackID selects the track transforms (its level and reverse flag)
	// and the ice-theme banana passive.
	TrackID string
}

// Point is a client position (Z up), as the client reports it.
type Point struct{ X, Y, Z float64 }

// Grant answers a cube pickup.
type Grant struct {
	CubeID int
	ItemID int    // NoItem when nothing was granted
	Icon   int    // the slot icon override of a special booster (0: none)
	Reason string // ReasonFull, ReasonAbusing or "" (granted, or nothing left to draw)
	Slots  []int
	Icons  []int // per-slot icon overrides, nil when none
	// Lucci is the bonus lucci the cube paid (kart lucciItemCube), 0 none.
	Lucci int
}

// SlotsNotice is a racer's slots changed by the server alone: an item
// gained from a per-kart table (ReasonGain) or the race start
// (ReasonStart, ItemID the 迅 item kart's start item or NoItem).
type SlotsNotice struct {
	PlayerID string
	Slots    []int
	Icons    []int
	ItemID   int
	Reason   string
}

// LucciNotice is in-race lucci a racer earned.
type LucciNotice struct {
	PlayerID string
	Amount   int
	Reason   string
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
	// Count is how many missiles the use fires (2 for a double rocket).
	Count int
	// Point is the drop or landing point given with the use (banana, water
	// bomb); Placed the point reported by place (barricade, time bomb).
	Point  *Point
	Placed *Point

	hits    map[shotKey]Hit
	removed bool
}

type shotKey struct {
	victim string
	shot   int
}

// Hit is a victim's report on an item or a track hazard.
type Hit struct {
	VictimID string
	UseID    int // 0 for a track hazard
	ItemID   int
	UserID   string // "" for a track hazard
	Result   string
	By       string
	Variant  string
	Shot     int
	HazardID int
	// Removed: this hit removed the item (the first hit on a placed trap).
	Removed bool
	At      int64
	// Gain is the item the victim gained by it (fired2Gain), nil when none;
	// Lucci the bonus it paid. Both only on the first report.
	Gain  *SlotsNotice
	Lucci *LucciNotice

	// escaped: the victim left the trap of this hit early (Escape);
	// cured: an EMP ended this UFO slow.
	escaped bool
	cured   bool
}

// ScanNotice is a scanned opponent's slots for a racer whose team scans.
type ScanNotice struct {
	Viewer  string
	Subject string
	Slots   []int
	Until   int64
}

type window struct{ from, until int64 }

func (w window) covers(at int64) bool { return w.from <= at && at < w.until }

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
	equipment     Equipment
	// Changer cards left (Infinite: voucher), those used, and whether the
	// item changer may act on slot 0.
	slotCards, itemCards       int
	slotConsumed, itemConsumed int
	itemArmed                  bool
	// invincible: the windows of the racer's gold and protect shields.
	invincible []window
	// Title and lucci counters: uses by item, attacks of the racer that
	// landed or were blocked, whether an item ever hit it, bonus lucci.
	uses           map[int]int
	landed, failed int
	hitTaken       bool
	lucci          int
}

func (p *racer) locked(now int64) bool {
	return slices.ContainsFunc(p.locks, func(w window) bool { return w.covers(now) })
}

func (p *racer) invincibleAt(at int64) bool {
	return slices.ContainsFunc(p.invincible, func(w window) bool { return w.covers(at) })
}

// Race is the item state of one race. It is not safe for concurrent use
// (the lobby runs it under its lock).
type Race struct {
	data    *Data
	table   *Table
	changer *Table
	random  Random
	raceID  string
	trackID string
	track   Track
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
func NewRace(data *Data, kind string, members []Member, random Random, opts Options) (*Race, error) {
	table := data.Table(kind)
	if table == nil || (kind != TableIndividual && kind != TableTeam) {
		return nil, fmt.Errorf("itemmode: no table %q", kind)
	}
	track, _ := data.Track(opts.TrackID)
	r := &Race{data: data, table: table, changer: data.Table(changerTable[kind]), random: random,
		raceID: opts.RaceID, trackID: opts.TrackID, track: track, members: slices.Clone(members),
		teams: map[string]int{}, racers: map[string]*racer{}, uses: map[int]*Use{},
		scans: map[string]int64{}, hazards: map[hazardKey]Hit{}}
	for _, m := range members {
		r.teams[m.ID] = m.Team
		r.racers[m.ID] = &racer{slots: NewSlots(MinCapacity), obtained: map[int]int{}, equipment: m.Equipment,
			slotCards: cards(m.Changers.Slot), itemCards: cards(m.Changers.Item), uses: map[int]int{}}
	}
	return r, nil
}

func cards(n int) int {
	if n < 0 {
		return Infinite
	}
	return n
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

// Icons returns a racer's per-slot icon overrides, nil when none.
func (r *Race) Icons(playerID string) []int {
	if p := r.racers[playerID]; p != nil {
		return p.slots.Icons()
	}
	return nil
}

// Changers returns a racer's changer HUD state.
func (r *Race) Changers(playerID string) ChangerState {
	p := r.racers[playerID]
	if p == nil {
		return ChangerState{}
	}
	return ChangerState{Slot: p.slotCards, Item: p.itemCards, ItemArmed: p.itemArmed}
}

// Consumed returns how many 道具换位卡 (7:1) and 道具变更卡 (7:2) a racer
// used up in the race (voucher uses are free).
func (r *Race) Consumed(playerID string) (slot, item int) {
	if p := r.racers[playerID]; p != nil {
		return p.slotConsumed, p.itemConsumed
	}
	return 0, 0
}

// BonusLucci returns the in-race lucci a racer earned (at most MaxBonusLucci).
func (r *Race) BonusLucci(playerID string) int {
	if p := r.racers[playerID]; p != nil {
		return p.lucci
	}
	return 0
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

// earn credits in-race lucci up to MaxBonusLucci; nil when nothing was left.
func (r *Race) earn(playerID string, p *racer, reason string) *LucciNotice {
	amount := min(LucciAmount, MaxBonusLucci-p.lucci)
	if amount <= 0 {
		return nil
	}
	p.lucci += amount
	return &LucciNotice{PlayerID: playerID, Amount: amount, Reason: reason}
}

// obtain runs an obtained item through the grant transforms (ITEM_MODE.md
// C.3): transform@zz by the track's level and reverse flag, the kart's
// transformByKart, then its animalBooster for a booster. It returns the
// item and its slot icon override.
func (r *Race) obtain(p *racer, idx int) (int, int) {
	for _, row := range r.data.TrackTransforms {
		if row.Src == idx && row.Level == r.track.Level && (!row.Reverse || r.track.Reverse) && r.chanceRoll(row.P) {
			idx = row.Dst
			break
		}
	}
	if row, ok := r.data.transform[[2]int{p.equipment.Kart, idx}]; ok && r.chanceRoll(row.P) {
		idx = row.Dst
	}
	return r.boosterIcon(p, idx, true)
}

// boosterIcon turns a booster into the kart's special booster (when roll)
// and gives a special booster the kart's slot icon.
func (r *Race) boosterIcon(p *racer, idx int, roll bool) (int, int) {
	row, ok := r.data.animal[p.equipment.Kart]
	if !ok {
		return idx, 0
	}
	if idx == Booster && roll && r.chanceRoll(row.P) {
		idx = AnimalBoost
	}
	if idx == AnimalBoost {
		return idx, row.Icon
	}
	return idx, 0
}

// gain puts a per-kart table's gain into the racer's first empty slot (no
// transform; dropped when full). table is fired or firing.
func (r *Race) gain(playerID string, p *racer, table map[[2]int]KartGain, item int) *SlotsNotice {
	row, ok := table[[2]int{p.equipment.Kart, item}]
	if !ok || p.slots.Full() || !r.chanceRoll(row.P) {
		return nil
	}
	idx, icon := r.boosterIcon(p, row.Gain, false)
	p.slots.AddIcon(idx, icon)
	p.itemArmed = true
	return &SlotsNotice{PlayerID: playerID, Slots: p.slots.Values(), Icons: p.slots.Icons(), ItemID: idx, Reason: ReasonGain}
}

// Start gives each racer of ids its race-start notice: a 迅 item kart gets
// one item drawn uniformly from the 道具个人赛 table's items into slot 0,
// passed through the grant transforms (ITEM_MODE.md C.3). Every racer's
// notice carries its slots, so its changers can be shown from the start.
func (r *Race) Start(ids []string) []SlotsNotice {
	indi := r.data.Table(TableIndividual).Entries
	notices := make([]SlotsNotice, 0, len(ids))
	for _, id := range ids {
		p := r.racers[id]
		if p == nil {
			continue
		}
		notice := SlotsNotice{PlayerID: id, ItemID: NoItem, Reason: ReasonStart}
		if r.data.XunKart(p.equipment.Kart) && p.slots.Len() == 0 {
			idx, icon := r.obtain(p, indi[r.random.IntN(len(indi))].Idx)
			p.slots.AddIcon(idx, icon)
			p.obtained[idx]++
			p.itemArmed = true
			notice.ItemID = idx
		}
		notice.Slots, notice.Icons = p.slots.Values(), p.slots.Icons()
		notices = append(notices, notice)
	}
	return notices
}

// Cube handles a racer eating cube cubeID (ITEM_MODE.md 3, 4). The first
// report fixes the racer's slot capacity (clamped to 2..3). Eating the same
// cube again within CubeAbuseWindowMs with no other cube in between, or
// eating with full slots, grants nothing; otherwise an item is drawn by the
// racer's rank group, leaving out the items it already got as often as
// their cap allows, and passed through the grant transforms. A kart with
// lucciItemCube earns lucci at any cube but an abusing one.
func (r *Race) Cube(playerID string, cubeID, capacity int, now int64, standings []Racer) (Grant, []ScanNotice, error) {
	return r.cube(playerID, cubeID, capacity, NoItem, now, standings)
}

// TestCube is Cube with the granted item named instead of drawn (a test
// grant, for the game node's KART_ITEM_TEST_GRANTS development switch): the
// same abuse and full-slot rules apply, the per-race caps and the
// transforms do not (the item still counts toward the caps). The item must
// be a race item: a table item or a special item.
func (r *Race) TestCube(playerID string, cubeID, capacity, itemID int, now int64, standings []Racer) (Grant, []ScanNotice, error) {
	if !r.data.raceItem(itemID) {
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
		icon := 0
		if forced == AnimalBoost {
			_, icon = r.boosterIcon(p, forced, false)
		}
		p.slots.AddIcon(forced, icon)
		p.obtained[forced]++
		grant.ItemID, grant.Icon = forced, icon
	default:
		if idx, ok := r.draw(p, r.table, playerID, standings); ok {
			idx, icon := r.obtain(p, idx)
			p.slots.AddIcon(idx, icon)
			p.obtained[idx]++
			grant.ItemID, grant.Icon = idx, icon
		}
	}
	if !abusing && r.chanceRoll(r.chance(p.equipment, HolderKart, "lucciItemCube")) {
		if notice := r.earn(playerID, p, LucciItemCube); notice != nil {
			grant.Lucci = notice.Amount
		}
	}
	grant.Slots, grant.Icons = p.slots.Values(), p.slots.Icons()
	if grant.ItemID == NoItem {
		return grant, nil, nil
	}
	p.itemArmed = true
	return grant, r.scanNotices(playerID, now), nil
}

// draw picks an item of table by the racer's rank group, leaving out the
// items it got as often as their cap allows.
func (r *Race) draw(p *racer, table *Table, playerID string, standings []Racer) (int, bool) {
	group := GroupOf(rankOf(standings, playerID), len(standings))
	capped := func(idx int) bool {
		allow, limited := r.data.Cap(idx)
		return limited && p.obtained[idx] >= allow
	}
	return table.Draw(group, capped, r.random)
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

// UseResult is an accepted use: the use, the user's slots after it (and
// its firing2Gain), the scan notices it causes, and the gains it caused
// (the user's firing2Gain, a magnet target's fired2Gain).
type UseResult struct {
	Use     *Use
	Slots   []int
	Icons   []int
	Notices []ScanNotice
	Gains   []SlotsNotice
}

// UseItem handles a racer using the item in slot 0 (ITEM_MODE.md 5,
// appendix B, C.4): it must hold the item, not be slot-locked (the angel is
// always usable), and give a point for the items thrown or dropped. The
// server picks the targets, starts the use now and, for tracking items,
// computes etaMs from the route distance between user and target. A slot
// lock locks its targets from Use.life after the start for
// Affect.life + Postaffect.life (not a target under a gold shield then); a
// scan lets the user's team see the opponents' slots from the start until
// Use.life + Affect.life; an EMP cures the user's team members under a UFO
// slow when it takes effect (Use.life after the start), and does nothing
// when none is; a gold or protect shield makes the user invincible for
// Use.life + Affect.life. Then the user's kart may gain an item
// (firing2Gain), and a magnet's target one (fired2Gain).
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
	item, _ := r.data.Item(req.ItemID)
	var targets []string
	if rule.target == TargetUFOSlowed {
		targets = r.cureUFO(req.PlayerID, req.Now+int64(item.Life("Use")), req.Standings)
	} else {
		var err error
		if targets, err = r.targets(rule.target, req.PlayerID, req.TargetID, req.Standings); err != nil {
			return UseResult{}, err
		}
	}
	use := &Use{PlayerID: req.PlayerID, ItemID: req.ItemID, Targets: targets, StartAt: req.Now, Count: 1,
		hits: map[shotKey]Hit{}}
	if rule.speed > 0 && len(targets) == 1 {
		etaItem := item
		if rule.etaItem != 0 {
			etaItem, _ = r.data.Item(rule.etaItem)
		}
		gap := distanceOf(req.Standings, targets[0]) - distanceOf(req.Standings, req.PlayerID)
		use.EtaMs = EtaMs(gap, rule.speed, etaItem.Life(rule.etaState))
	}
	if rule.point {
		point := *req.Point
		use.Point = &point
	}
	if rule.target == TargetAimed && rule.hit != hitNone {
		use.Count = r.rocketCount(p.equipment, req.ItemID)
	}
	p.slots.TakeFirst()
	p.uses[req.ItemID]++
	r.prune(req.Now)
	r.lastUse++
	use.ID = r.lastUse
	r.uses[use.ID] = use
	result := UseResult{Use: use}
	switch req.ItemID {
	case SlotLock:
		from := req.Now + int64(item.Life("Use"))
		lock := window{from: from, until: from + int64(item.Life("Affect")+item.Life("Postaffect"))}
		for _, id := range targets {
			victim := r.racers[id]
			if victim == nil || victim.invincibleAt(from) {
				continue
			}
			victim.locks = append(slices.DeleteFunc(victim.locks, func(w window) bool {
				return w.until <= req.Now
			}), lock)
		}
	case Scanning:
		until := req.Now + int64(item.Life("Use")+item.Life("Affect"))
		for _, viewer := range targets {
			r.scans[viewer] = max(r.scans[viewer], until)
		}
		for _, viewer := range targets {
			for _, s := range req.Standings {
				if s.Racing() && !r.teammates(viewer, s.ID) {
					result.Notices = append(result.Notices, ScanNotice{Viewer: viewer, Subject: s.ID,
						Slots: r.Slots(s.ID), Until: r.scans[viewer]})
				}
			}
		}
	case GoldShield, ProtectShield:
		p.invincible = append(p.invincible, window{from: req.Now,
			until: req.Now + int64(item.Life("Use")+item.Life("Affect")) + reportSlackMs})
	case Magnet, SuperMagnet:
		// Being pulled counts as being hit by the magnet (fired2Gain:
		// firedItemIdx="magnet").
		for _, id := range targets {
			if target := r.racers[id]; target != nil {
				if notice := r.gain(id, target, r.data.fired, req.ItemID); notice != nil {
					result.Gains = append(result.Gains, *notice)
				}
			}
		}
	}
	if notice := r.gain(req.PlayerID, p, r.data.firing, req.ItemID); notice != nil {
		result.Gains = append([]SlotsNotice{*notice}, result.Gains...)
	}
	result.Slots, result.Icons = p.slots.Values(), p.slots.Icons()
	result.Notices = append(r.scanNotices(req.PlayerID, req.Now), result.Notices...)
	return result, nil
}

// cureUFO is an EMP of user taking effect at: the user's team members
// still racing whose reported UFO hit slows them then (Affect, or
// HeadBandAffect / BonusAffect for those variants) are cured; nobody when
// no one is.
func (r *Race) cureUFO(user string, at int64, standings []Racer) []string {
	ufo, _ := r.data.Item(UFO)
	cured := []string{}
	for _, s := range standings {
		if !s.Racing() || !r.teammates(user, s.ID) {
			continue
		}
		healed := false
		for _, use := range r.uses {
			if use.ItemID != UFO {
				continue
			}
			key := shotKey{s.ID, 0}
			hit, ok := use.hits[key]
			if !ok || hit.Result != ResultHit || hit.cured {
				continue
			}
			life := ufo.Life("Affect")
			switch hit.Variant {
			case VariantHeadband:
				life = ufo.Life("HeadBandAffect")
			case VariantBonus:
				life = ufo.Life("BonusAffect")
			}
			landed := use.StartAt + int64(use.EtaMs)
			if (window{from: landed - reportSlackMs, until: landed + int64(life)}).covers(at) {
				hit.cured = true
				use.hits[key] = hit
				healed = true
			}
		}
		if healed {
			cured = append(cured, s.ID)
		}
	}
	return cured
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
	UseID   int
	ItemID  int
	Result  string // ResultHit or ResultBlocked
	By      string // the defence of a blocked item ("" when not named)
	Variant string // the equipment's change to a hit ("" none)
	// Shot is which missile of a double rocket (0 or 1).
	Shot     int
	HazardID int
	Now      int64
}

// Hit records a hit report. A victim reports each use (each shot of a
// double rocket) once: a repeat returns the first report with fresh false
// (and a hazard repeats its report within HazardCooldownMs). Only the
// targets of a targeted item may report; anyone for a placed trap or a
// time bomb; opponents of the user for a water bomb, a barricade, a
// lockdown field or a siren. by must be a defence of the item: shield and
// angel as the item allows (shield for anything but a cloud during the
// victim's own gold or protect shield), escape, or an equipment defence
// (kart, pet, eat) that the victim's frozen equipment and the shared roll
// give. A variant needs the same. The first report on a placed trap
// removes it, and later reports on it are rejected. A fresh hit slot-locks its victim
// when the item does so, lets the victim's kart gain an item (fired2Gain;
// an eaten banana or mine counts), and pays a bonus variant's lucci.
func (r *Race) Hit(req HitRequest) (hit Hit, fresh bool, err error) {
	victim := r.racers[req.VictimID]
	if victim == nil {
		return Hit{}, false, ErrInvalidTarget
	}
	hit = Hit{VictimID: req.VictimID, UseID: req.UseID, ItemID: req.ItemID, Result: req.Result,
		By: req.By, Variant: req.Variant, Shot: req.Shot, At: req.Now}
	h := hitContext{victimID: req.VictimID, equipment: victim.equipment, useID: req.UseID,
		hazardID: req.HazardID, item: req.ItemID}
	if req.UseID == 0 {
		blocks, ok := hazardBlocks[req.ItemID]
		if !ok || req.HazardID < 1 {
			return Hit{}, false, ErrInvalidUse
		}
		if req.Shot != 0 {
			return Hit{}, false, ErrInvalidShot
		}
		lucci, err := r.checkReport(req, h, victim, rule{blocks: blocks})
		if err != nil {
			return Hit{}, false, err
		}
		key := hazardKey{req.VictimID, req.HazardID}
		if previous, ok := r.hazards[key]; ok && req.Now-previous.At < HazardCooldownMs {
			return previous, false, nil
		}
		hit.HazardID = req.HazardID
		r.landed(&hit, victim, nil, lucci)
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
	if req.Shot < 0 || req.Shot >= use.Count {
		return Hit{}, false, ErrInvalidShot
	}
	if previous, ok := use.hits[shotKey{req.VictimID, req.Shot}]; ok {
		return previous, false, nil
	}
	if use.removed {
		return Hit{}, false, ErrInvalidUse
	}
	lucci, err := r.checkReport(req, h, victim, rule)
	if err != nil {
		return Hit{}, false, err
	}
	hit.UserID = use.PlayerID
	if rule.removed {
		// The first report on a placed trap removes it, whatever stopped it.
		use.removed = true
		hit.Removed = true
	}
	r.landed(&hit, victim, use, lucci)
	use.hits[shotKey{req.VictimID, req.Shot}] = hit
	return hit, true, nil
}

// checkReport checks a report's result, defence and variant against the
// item's rule and the victim's equipment; it returns the lucci reason of a
// paying variant.
func (r *Race) checkReport(req HitRequest, h hitContext, victim *racer, rule rule) (string, error) {
	switch req.Result {
	case ResultHit:
		if req.By != "" {
			return "", ErrInvalidBy
		}
	case ResultBlocked:
		switch req.By {
		case "", ByEscape:
		case ByShield:
			if !slices.Contains(rule.blocks, ByShield) &&
				(rule.noInvincible || !victim.invincibleAt(req.Now)) {
				return "", ErrInvalidBy
			}
		case ByAngel:
			if !slices.Contains(rule.blocks, ByAngel) {
				return "", ErrInvalidBy
			}
		case ByKart, ByPet, ByEat:
			if !r.equipmentBlocks(h, req.By) {
				return "", ErrInvalidBy
			}
		default:
			return "", ErrInvalidBy
		}
	default:
		return "", ErrInvalidResult
	}
	if req.Variant == "" {
		return "", nil
	}
	ok, lucci := r.variantHolds(h, req.Result, req.By, req.Variant)
	if !ok {
		return "", ErrInvalidVariant
	}
	return lucci, nil
}

// landed applies a fresh report: the title counters, the slot lock of a
// locking item, the victim's fired2Gain (a hit, or an eaten trap) and the
// lucci of a paying variant.
func (r *Race) landed(hit *Hit, victim *racer, use *Use, lucci string) {
	if use != nil && use.PlayerID != hit.VictimID {
		if user := r.racers[use.PlayerID]; user != nil {
			if hit.Result == ResultHit {
				user.landed++
			} else {
				user.failed++
			}
		}
	}
	if hit.Result == ResultHit {
		victim.hitTaken = true
		if use != nil {
			if lock := rules[use.ItemID].lock; lock != nil {
				item, _ := r.data.Item(use.ItemID)
				trapped := item.Life("Affect")
				if hit.Variant == VariantQuick {
					trapped = quickEscapeMs
				}
				if !lock.during {
					trapped += item.Life(lock.state)
				}
				victim.locks = append(victim.locks, window{from: hit.At, until: hit.At + int64(trapped)})
			}
		}
	}
	if hit.Result == ResultHit || hit.By == ByEat {
		hit.Gain = r.gain(hit.VictimID, victim, r.data.fired, hit.ItemID)
	}
	if lucci != "" {
		hit.Lucci = r.earn(hit.VictimID, victim, lucci)
	}
}

// Escape records that a trapped racer left its water bubble early by
// pressing left/right (ITEM_MODE.md 6), or a talisman's QTE early: the
// victim's own notice after a hit it reported on a trapping or escapable
// use or, with useID 0, on a water mine hazard (hazardID), so the others
// end the bubble and start the blue shield then. A talisman's slot lock
// ends with it. It returns the hit. Each hit escapes once: a repeat returns
// the hit again with fresh false.
func (r *Race) Escape(playerID string, useID, hazardID int, now int64) (Hit, bool, error) {
	p := r.racers[playerID]
	if p == nil {
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
	if use == nil || (!rules[use.ItemID].trap && !rules[use.ItemID].escapable) {
		return Hit{}, false, ErrInvalidUse
	}
	key := shotKey{playerID, 0}
	hit, ok := use.hits[key]
	if !ok || hit.Result != ResultHit {
		return Hit{}, false, ErrInvalidUse
	}
	if hit.escaped {
		return hit, false, nil
	}
	hit.escaped = true
	use.hits[key] = hit
	if rules[use.ItemID].escapable {
		// The talisman's lock ends with the escape.
		for i, w := range p.locks {
			if w.from == hit.At && w.until > now {
				p.locks[i].until = now
			}
		}
	}
	return hit, true, nil
}

// Swap exchanges slots 0 and 1 (the 道具换位卡, Alt, ITEM_MODE.md C.6): the
// racer needs a card or the voucher and items in both slots; a slot lock
// does not stop it. A card is used up (the voucher is not).
func (r *Race) Swap(playerID string, now int64, standings []Racer) ([]int, []ScanNotice, error) {
	p := r.racing(playerID, standings)
	if p == nil {
		return nil, nil, ErrInvalidUse
	}
	if p.slotCards == 0 {
		return nil, nil, ErrNoChanger
	}
	if !p.slots.Swap() {
		return nil, nil, ErrInvalidUse
	}
	if p.slotCards > 0 {
		p.slotCards--
		p.slotConsumed++
	}
	return p.slots.Values(), r.scanNotices(playerID, now), nil
}

// Change redraws the item in slot 0 (the 道具变更卡, Z, ITEM_MODE.md C.6):
// the racer needs a card or the voucher, an item in slot 0 obtained since
// its last change, and no slot lock. The new item is drawn from the
// changer table (itemProb_indiChanger@zz / itemProb_teamChanger2@cn) by the
// racer's current rank group with the per-race caps, and passed through
// the grant transforms (changerTuto01@cn: "一定几率出现特殊道具"). A card is
// used up (the voucher is not); the changer waits for the next new item.
func (r *Race) Change(playerID string, now int64, standings []Racer) ([]int, int, []ScanNotice, error) {
	p := r.racing(playerID, standings)
	if p == nil {
		return nil, NoItem, nil, ErrInvalidUse
	}
	if p.itemCards == 0 {
		return nil, NoItem, nil, ErrNoChanger
	}
	if _, ok := p.slots.First(); !ok {
		return nil, NoItem, nil, ErrInvalidUse
	}
	if !p.itemArmed {
		return nil, NoItem, nil, ErrChangerUsed
	}
	if p.locked(now) {
		return nil, NoItem, nil, ErrLocked
	}
	drawn, ok := r.draw(p, r.changer, playerID, standings)
	if !ok {
		return nil, NoItem, nil, ErrInvalidUse
	}
	idx, icon := r.obtain(p, drawn)
	p.slots.ReplaceFirst(idx, icon)
	p.obtained[idx]++
	p.itemArmed = false
	if p.itemCards > 0 {
		p.itemCards--
		p.itemConsumed++
	}
	return p.slots.Values(), idx, r.scanNotices(playerID, now), nil
}

// ScanNotices are the notices of subject's slots for the opponents whose
// team is scanning (after its slots changed).
func (r *Race) ScanNotices(subject string, now int64) []ScanNotice {
	return r.scanNotices(subject, now)
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
