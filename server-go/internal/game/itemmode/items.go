package itemmode

// Item indices: the idx values of the probability tables (item/slot/
// item<idx>.png), plus the track-placed hazards' items.
const (
	Devil        = 2   // 大魔王
	UFO          = 3   // 飞碟
	WaterFly     = 4   // 水苍蝇
	Magnet       = 5   // 磁铁
	Booster      = 6   // 加速器
	Rocket       = 7   // 导弹
	Banana       = 8   // 香蕉皮
	WaterBomb    = 9   // 水炸弹
	Shield       = 10  // 护盾
	Angel        = 11  // 天使
	EMP          = 12  // 电磁波
	TimeBomb     = 13  // 定时水炸弹
	Mine         = 17  // 地雷 (track-placed only)
	GuideRocket  = 33  // 追踪导弹
	WaterMine    = 37  // 水雷 (track-placed only)
	Scanning     = 109 // 透视镜
	SlotLock     = 110 // 道具锁
	Thunderbolt  = 111 // 闪电
	Barricade    = 113 // 路障
	Cloud        = 114 // 乌云 (cloud2)
	RandomRocket = 127 // 随机导弹
)

// TargetRule is how the server picks an item's targets at use
// (ITEM_MODE.md appendix B). Opponents are racers of the other team (every
// other racer in an individual race) still racing.
type TargetRule int

const (
	// TargetSelf: the user.
	TargetSelf TargetRule = iota
	// TargetOwnTeam: the user's team, the user included (the user alone in
	// an individual race).
	TargetOwnTeam
	// TargetAheadOne: the opponent directly ahead of the user.
	TargetAheadOne
	// TargetLeader: the leading opponent.
	TargetLeader
	// TargetRandomAhead: a random opponent ahead of the user.
	TargetRandomAhead
	// TargetAllAhead: every opponent ahead of the user.
	TargetAllAhead
	// TargetAllBehind: every opponent behind the user.
	TargetAllBehind
	// TargetAllOpponents: every opponent.
	TargetAllOpponents
	// TargetAimed: the opponent the client locked on (targetId); no lock is
	// a misfire with no target.
	TargetAimed
	// TargetArea: a placed or area item, with no targets; who may report a
	// hit is the item's hitRule.
	TargetArea
)

// hitRule is who may report being hit by a use of the item.
type hitRule int

const (
	// hitNone: nobody (the item affects only its user or its team).
	hitNone hitRule = iota
	// hitTargets: the use's targets.
	hitTargets
	// hitAnyone: any racer, the user and teammates included (a banana in
	// the road, the time bomb that traps everyone around it).
	hitAnyone
	// hitOpponents: any opponent of the user (avoidItemTeamKill).
	hitOpponents
)

// placeRule is who reports where an item is placed (place).
type placeRule int

const (
	placeNone placeRule = iota
	// placeByTarget: the targeted leader computes where the barricade lands.
	placeByTarget
	// placeByUser: the user reports where the time bomb explodes.
	placeByUser
)

// Defences a victim may name when it blocks an item (hit result
// "blocked"). "escape" (immune while trapped or under the blue shield after
// an escape) is accepted for every item a racer can be hit by.
const (
	ByShield = "shield"
	ByAngel  = "angel"
	ByEMP    = "emp"
	ByEscape = "escape"
)

// Tracking speeds (m/s) for etaMs (ITEM_MODE.md appendix B).
const (
	missileSpeed = 100.0
	flySpeed     = 60.0
)

type rule struct {
	target TargetRule
	// speed is the tracking speed of an item that flies to its target
	// (etaMs); 0 for others.
	speed float64
	// etaState is the base-0 state whose life caps etaMs; etaItem is the
	// item it is read from (guide and random rockets use the missile's).
	etaState string
	etaItem  int
	// point: use must carry the throw or drop point.
	point  bool
	place  placeRule
	hit    hitRule
	blocks []string // defences that block it besides escape
	// trap: a hit traps its victim in a water bubble, which the victim can
	// leave early (escape).
	trap bool
}

// attack defences: a shield blocks the items whose item.bml has a Shield,
// StateShield or RocketShield state; an angel blocks every attack but the
// devil, the cloud and the slot lock; EMP only the UFO.
var (
	shieldAndAngel = []string{ByShield, ByAngel}
	angelOnly      = []string{ByAngel}
)

// rules are the behaviours of the table items (ITEM_MODE.md appendix B).
var rules = map[int]rule{
	Booster:      {target: TargetSelf},
	Banana:       {target: TargetArea, point: true, hit: hitAnyone, blocks: shieldAndAngel},
	WaterBomb:    {target: TargetArea, point: true, hit: hitOpponents, blocks: angelOnly, trap: true},
	WaterFly:     {target: TargetAheadOne, speed: flySpeed, etaState: "Use", etaItem: WaterFly, hit: hitTargets, blocks: shieldAndAngel, trap: true},
	Rocket:       {target: TargetAimed, speed: missileSpeed, etaState: "Use", etaItem: Rocket, hit: hitTargets, blocks: shieldAndAngel},
	GuideRocket:  {target: TargetLeader, speed: missileSpeed, etaState: "Use", etaItem: Rocket, hit: hitTargets, blocks: shieldAndAngel},
	RandomRocket: {target: TargetRandomAhead, speed: missileSpeed, etaState: "Use", etaItem: Rocket, hit: hitTargets, blocks: shieldAndAngel},
	Magnet:       {target: TargetAimed},
	Shield:       {target: TargetSelf},
	Angel:        {target: TargetOwnTeam},
	Devil:        {target: TargetAllOpponents, hit: hitTargets},
	UFO:          {target: TargetLeader, speed: flySpeed, etaState: "Use", etaItem: UFO, hit: hitTargets, blocks: []string{ByShield, ByAngel, ByEMP}},
	EMP:          {target: TargetSelf},
	Thunderbolt:  {target: TargetAllAhead, hit: hitTargets, blocks: angelOnly},
	Barricade:    {target: TargetLeader, place: placeByTarget, hit: hitOpponents, blocks: shieldAndAngel},
	Cloud:        {target: TargetAllBehind, hit: hitTargets},
	Scanning:     {target: TargetOwnTeam},
	SlotLock:     {target: TargetAllOpponents, hit: hitTargets},
	TimeBomb:     {target: TargetArea, place: placeByUser, hit: hitAnyone, blocks: angelOnly, trap: true},
}

// hazardBlocks are the defences against the track-placed hazards (banana,
// mine, mineHidden, waterMine): their item.bml all have a Shield state.
var hazardBlocks = map[int][]string{
	Banana:    shieldAndAngel,
	Mine:      shieldAndAngel,
	WaterMine: shieldAndAngel,
}

// trapHazards are the track-placed hazards whose hit traps the racer.
var trapHazards = map[int]bool{WaterMine: true}

// Target returns the target rule of a table item.
func Target(idx int) (TargetRule, bool) {
	r, ok := rules[idx]
	return r.target, ok
}

// NeedsPoint reports whether use must carry a point for idx (the banana's
// drop point and the water bomb's landing point).
func NeedsPoint(idx int) bool { return rules[idx].point }

// IsHazardItem reports whether idx is an item a track-placed hazard can be.
func IsHazardItem(idx int) bool {
	_, ok := hazardBlocks[idx]
	return ok
}
