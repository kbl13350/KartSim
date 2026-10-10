package itemmode

// Item indices: the idx values of the probability tables (item/slot/
// item<idx>.png), the track-placed hazards' items, and the special items
// the per-kart tables lead to (ITEM_MODE.md C.4, special-item registry).
const (
	DarkCloud        = 1   // 黑云 (cloud base 1)
	Devil            = 2   // 大魔王
	UFO              = 3   // 飞碟
	WaterFly         = 4   // 水苍蝇
	Magnet           = 5   // 磁铁
	Booster          = 6   // 加速器
	Rocket           = 7   // 导弹
	Banana           = 8   // 香蕉皮
	WaterBomb        = 9   // 水炸弹
	Shield           = 10  // 护盾
	Angel            = 11  // 天使
	EMP              = 12  // 电磁波
	TimeBomb         = 13  // 定时水炸弹
	Mine             = 17  // 地雷 (also track-placed)
	SuperShield      = 18  // 超级盾牌 (shield base 1)
	CokeBomb         = 20  // 可口可乐水炸弹
	TimeCokeBomb     = 21  // 可口可乐定时炸弹
	DrrMine          = 23  // R博士
	Siren            = 24  // 警灯
	ForceZone        = 25  // 弹性陷阱
	InfectedBomb     = 27  // 毒性水炸弹
	TimeInfectedBomb = 28  // 定时毒性水炸弹
	CokeRocket       = 30  // 可口可乐导弹
	AnimalBoost      = 31  // 特殊加速器
	GoldRocket       = 32  // 黄金导弹
	GuideRocket      = 33  // 追踪导弹
	SnowBomb         = 34  // 冰冻水炸弹
	TimeSnowBomb     = 35  // 定时冰冻水炸弹
	GoldShield       = 36  // 黄金盾牌
	WaterMine        = 37  // 水雷 (also track-placed)
	NewDevil         = 38  // 恶魔阿哥
	PumpkinBomb      = 44  // 南瓜水炸弹 (infectedBomb base 1)
	DuckMine         = 45  // 丫丫炸弹 (mine base 2)
	Oil              = 46  // 废油弹
	PrisonBomb       = 47  // 铁网水炸弹 (waterBomb base 2)
	ProtectShield    = 81  // 保护盾 (goldShield base 1)
	EggMine          = 82  // 蛋蛋弹 (mine base 3)
	GoldEggMine      = 83  // 黄金蛋蛋弹 (mine base 4)
	BigBanana        = 85  // 巨型香蕉皮 (banana base 3)
	TigerRocket      = 99  // 老虎导弹
	TigerGhost       = 101 // 隐身 (ghost base 1)
	CandyRocket      = 102 // 糖果导弹 (goldRocket base 1)
	SuperMagnet      = 103 // 黄金磁铁
	LockdownRocket   = 104 // 电磁导弹
	SirenShield      = 106 // 防护警灯
	DinoEggRocket    = 107 // 恐龙导弹 (goldRocket base 2)
	DinoClawRocket   = 108 // 恐龙爪牙导弹
	Scanning         = 109 // 透视镜
	SlotLock         = 110 // 道具锁
	Thunderbolt      = 111 // 闪电
	Snowman          = 112 // 雪精灵
	Barricade        = 113 // 路障
	Cloud            = 114 // 乌云 (cloud2)
	DarkCloud2       = 115 // 黑云 (cloud2 base 1)
	BlockRocket      = 117 // 像素导弹 (lockdownRocket base 1)
	SnowWaterFly     = 118 // 冰冻水苍蝇
	InfectedWaterFly = 119 // 毒性水苍蝇
	WaterbombFly     = 120 // 定时水炸弹苍蝇
	FoxTailRocket    = 126 // 狐尾导弹 (goldRocket base 3)
	RandomRocket     = 127 // 随机导弹
	SpringMine       = 129 // 发条炸弹 (mine base 7)
	CogWheelMine     = 130 // 锯齿地雷 (mine base 8)
	DeliveryRocket   = 131 // 特快导弹
	HoneyBee         = 132 // 蜜蜂
	LionMaskRocket   = 134 // 舞狮车导弹
	AbyssBarricade   = 135 // 龙卷风
	PantherRocket    = 136 // 黑豹导弹
	Talisman         = 137 // 符咒
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
	// TargetUFOSlowed: the user's team members (the user included) under a
	// UFO slow when the item takes effect (the EMP: a counter item acts only
	// on racers really in the countered state, ITEM_MODE.md C.1).
	TargetUFOSlowed
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
	// hitOpponents: any opponent of the user (avoidItemTeamKill): area items,
	// placed barricades, a lockdown field, a siren's touch.
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

// lockRule is the slot lock a confirmed hit puts on its victim (the victim
// cannot use items, ITEM_LOCKED): after the trap (Affect) for lockState's
// life, or for Affect itself (the talisman).
type lockRule struct {
	state  string // the lock state after Affect ("" with during: Affect only)
	during bool   // the lock is Affect itself
}

// Defences a victim may name when it blocks an item (hit result
// "blocked"). "escape" (immune while trapped or under the blue shield after
// an escape) is accepted for every item a racer can be hit by. The
// equipment defences (ITEM_MODE.md C.2) are ByKart and ByPet (a passive of
// the kart or pet blocks it) and ByEat (the kart eats a banana or a mine).
const (
	ByShield = "shield"
	ByAngel  = "angel"
	// ByEMP is no longer a defence: the EMP only cures racers already under
	// a UFO slow (C.1); a report naming it is refused.
	ByEMP    = "emp"
	ByEscape = "escape"
	ByKart   = "kart"
	ByPet    = "pet"
	ByEat    = "eat"
)

// Hit variants (ITEM_MODE.md C.2/C.7): a hit whose effect an equipment
// passive changed. VariantSmall is the reduced missile (AffectSmall) or a
// lockdown field's slow on a racer near the target (AffectSub);
// VariantHeadband the UFO cut short by a headband (HeadBandAffect);
// VariantBonus the UFO or eaten mine that pays the character's lucci
// (BonusAffect, EatBonus); VariantQuick the water trap left at once
// (waterAngel); VariantBalloon the missile a balloon softened (AffectSmall,
// balloon popped, lucci).
const (
	VariantSmall    = "small"
	VariantHeadband = "headband"
	VariantBonus    = "bonus"
	VariantQuick    = "quick"
	VariantBalloon  = "balloon"
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
	// etaState is the state whose life caps etaMs; etaItem is the item it is
	// read from (0: the item itself; guide and random rockets use the
	// missile's).
	etaState string
	etaItem  int
	// point: use must carry the throw or drop point.
	point  bool
	place  placeRule
	hit    hitRule
	blocks []string // defences that block it besides escape and the equipment
	// trap: a hit traps its victim in a water bubble, which the victim can
	// leave early (escape) or at once (waterAngel, VariantQuick).
	trap bool
	// escapable: the victim may end the hit early (escape) without a water
	// trap (the talisman's arrow-key QTE).
	escapable bool
	// removed: the first hit removes the placed item (it is eaten or bursts).
	removed bool
	// lock: a confirmed hit slot-locks the victim.
	lock *lockRule
	// noInvincible: the gold and protect shields do not block it (clouds
	// are an overlay, not an attack).
	noInvincible bool
}

// attack defences: a shield blocks the items whose item.bml variant has a
// Shield, StateShield or RocketShield state (but not the UFO,
// bonusStageProperty@tw.xml:53); an angel blocks every attack but the devil
// family, the clouds, the slot lock and the UFO.
var (
	shieldAndAngel = []string{ByShield, ByAngel}
	angelOnly      = []string{ByAngel}
)

var (
	postAffectLock = &lockRule{state: "PostAffect"}
	afterBoostLock = &lockRule{state: "AfterBoost"}
	affectLock     = &lockRule{during: true}
)

// rules are the behaviours of every race item (ITEM_MODE.md appendix B and
// C.4).
var rules = map[int]rule{}

func init() {
	missile := func(etaItem int, blocks []string) rule {
		return rule{target: TargetAimed, speed: missileSpeed, etaState: "Use", etaItem: etaItem, hit: hitTargets, blocks: blocks}
	}
	fly := func(hit hitRule, trap bool) rule {
		return rule{target: TargetAheadOne, speed: flySpeed, etaState: "Use", hit: hit, blocks: shieldAndAngel, trap: trap}
	}
	thrown := func(lock *lockRule) rule {
		return rule{target: TargetArea, point: true, hit: hitOpponents, blocks: angelOnly, trap: true, lock: lock}
	}
	timed := func(lock *lockRule) rule {
		return rule{target: TargetArea, place: placeByUser, hit: hitAnyone, blocks: angelOnly, trap: true, lock: lock}
	}
	dropped := func() rule {
		return rule{target: TargetArea, point: true, hit: hitAnyone, blocks: shieldAndAngel, removed: true}
	}
	self := rule{target: TargetSelf}
	cloud := rule{target: TargetAllBehind, hit: hitTargets, noInvincible: true}
	devil := rule{target: TargetAllOpponents, hit: hitTargets}
	barricade := rule{target: TargetLeader, place: placeByTarget, hit: hitOpponents, blocks: shieldAndAngel}
	siren := rule{target: TargetSelf, hit: hitOpponents, blocks: angelOnly}

	for idx, r := range map[int]rule{
		// Appendix B.
		Booster:      self,
		Banana:       dropped(),
		WaterBomb:    thrown(nil),
		WaterFly:     fly(hitTargets, true),
		Rocket:       missile(0, shieldAndAngel),
		GuideRocket:  {target: TargetLeader, speed: missileSpeed, etaState: "Use", etaItem: Rocket, hit: hitTargets, blocks: shieldAndAngel},
		RandomRocket: {target: TargetRandomAhead, speed: missileSpeed, etaState: "Use", etaItem: Rocket, hit: hitTargets, blocks: shieldAndAngel},
		Magnet:       {target: TargetAimed},
		Shield:       self,
		Angel:        {target: TargetOwnTeam},
		Devil:        devil,
		UFO:          {target: TargetLeader, speed: flySpeed, etaState: "Use", hit: hitTargets},
		EMP:          {target: TargetUFOSlowed},
		Thunderbolt:  {target: TargetAllAhead, hit: hitTargets, blocks: angelOnly},
		Barricade:    barricade,
		Cloud:        cloud,
		Scanning:     {target: TargetOwnTeam},
		SlotLock:     devil,
		TimeBomb:     timed(nil),
		// C.4: rocket reskins, blinding / spinning / lockdown missiles.
		CokeRocket: missile(0, shieldAndAngel), GoldRocket: missile(0, shieldAndAngel),
		CandyRocket: missile(0, shieldAndAngel), DinoEggRocket: missile(0, shieldAndAngel),
		FoxTailRocket: missile(0, shieldAndAngel),
		TigerRocket:   missile(0, shieldAndAngel), PantherRocket: missile(0, shieldAndAngel),
		DeliveryRocket: missile(0, shieldAndAngel), DinoClawRocket: missile(0, shieldAndAngel),
		LionMaskRocket: missile(0, shieldAndAngel),
		// The lockdown field around the target slows the opponents in it.
		LockdownRocket: {target: TargetAimed, speed: missileSpeed, etaState: "Use", hit: hitOpponents, blocks: shieldAndAngel},
		BlockRocket:    {target: TargetAimed, speed: missileSpeed, etaState: "Use", hit: hitOpponents, blocks: shieldAndAngel},
		Snowman:        missile(0, angelOnly),
		// Water bomb, time bomb and water fly variants.
		SnowBomb: thrown(nil), CokeBomb: thrown(nil), PrisonBomb: thrown(nil),
		InfectedBomb: thrown(postAffectLock), PumpkinBomb: thrown(postAffectLock),
		TimeCokeBomb: timed(nil), TimeSnowBomb: timed(nil), TimeInfectedBomb: timed(postAffectLock),
		SnowWaterFly:     fly(hitTargets, true),
		InfectedWaterFly: {target: TargetAheadOne, speed: flySpeed, etaState: "Use", hit: hitTargets, blocks: shieldAndAngel, trap: true, lock: afterBoostLock},
		// It bursts on its target and traps the opponents around it.
		WaterbombFly: fly(hitOpponents, true),
		HoneyBee:     fly(hitTargets, false),
		// Placed traps.
		Mine: dropped(), DuckMine: dropped(), EggMine: dropped(), GoldEggMine: dropped(),
		SpringMine: dropped(), CogWheelMine: dropped(), BigBanana: dropped(), ForceZone: dropped(), Oil: dropped(),
		// The water mine bursts over an area: every racer in it may be trapped.
		WaterMine: {target: TargetArea, point: true, hit: hitAnyone, blocks: shieldAndAngel, trap: true},
		// Self items.
		GoldShield: self, ProtectShield: self, SuperShield: self, AnimalBoost: self, TigerGhost: self,
		Siren: siren, SirenShield: siren,
		SuperMagnet: {target: TargetAimed},
		// Clouds, devils, barricades, the talisman.
		DarkCloud: cloud, DarkCloud2: cloud,
		NewDevil: devil, DrrMine: devil,
		AbyssBarricade: barricade,
		Talisman: {target: TargetLeader, speed: flySpeed, etaState: "Use", hit: hitTargets, blocks: shieldAndAngel,
			escapable: true, lock: affectLock},
	} {
		rules[idx] = r
	}
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

// Target returns the target rule of a race item.
func Target(idx int) (TargetRule, bool) {
	r, ok := rules[idx]
	return r.target, ok
}

// NeedsPoint reports whether use must carry a point for idx (the drop point
// of a banana or mine, the landing point of a water bomb).
func NeedsPoint(idx int) bool { return rules[idx].point }

// IsHazardItem reports whether idx is an item a track-placed hazard can be.
func IsHazardItem(idx int) bool {
	_, ok := hazardBlocks[idx]
	return ok
}

// Item families of the equipment passives and other rules (ITEM_MODE.md
// C.2): the items each enchantCatalog.xml key names, with the variants of
// the same item.bml where C.2 lists them.
var (
	// rocketFamily: the kart / pet rocket defence (rocket, cokeRocket,
	// goldRocket and its reskins).
	rocketFamily = []int{Rocket, CokeRocket, GoldRocket, CandyRocket, DinoEggRocket, FoxTailRocket}
	// goldRocketFamily: useTwoGoldRocket fires two of these.
	goldRocketFamily = []int{GoldRocket, CandyRocket, DinoEggRocket, FoxTailRocket}
	// balloonRockets: what a balloon may soften; never the gold rocket kind
	// (itemDescList.xml:350, bonusStageProperty@cn.xml:110).
	balloonRockets = []int{Rocket, GuideRocket, RandomRocket, CokeRocket}
	flyFamily      = []int{WaterFly, SnowWaterFly, InfectedWaterFly, WaterbombFly}
	// waterBombFamily: the pet water-bomb defence (水炸弹类, timeBomb included).
	waterBombFamily = []int{WaterBomb, TimeBomb, CokeBomb, TimeCokeBomb, InfectedBomb, TimeInfectedBomb,
		SnowBomb, TimeSnowBomb, PumpkinBomb, PrisonBomb}
	devilFamily  = []int{Devil, DrrMine, NewDevil}
	snowFamily   = []int{SnowBomb, TimeSnowBomb}
	bananaFamily = []int{Banana, BigBanana}
	// mineFamily: the kart mine defence; the egg mines need mineWithEggMine
	// or mineWithKindOfEgg.
	mineFamily  = []int{Mine, SpringMine, CogWheelMine}
	eggMines    = []int{DuckMine, EggMine, GoldEggMine}
	sirenFamily = []int{Siren, SirenShield}
	// waterTraps: what a waterAngel kart escapes at once.
	waterTraps = append(append([]int{WaterMine}, waterBombFamily...), flyFamily...)
	// clouds: the cloud overlays (goggle and kart trans, no defence).
	clouds = []int{Cloud, DarkCloud, DarkCloud2}
)
