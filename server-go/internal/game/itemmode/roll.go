package itemmode

import "strconv"

// Roll is the deterministic chance roll the victim's client and the server
// share (ITEM_MODE.md C.1): fnv1a32 of the UTF-8 bytes of
// "raceId|useId|hazardId|victimId|kind" modulo 100; a passive with chance p
// succeeds when Roll < p. useId and hazardId are 0 when the hit has none.
// The TypeScript twin and Go use the vectors of
// client/src/item/item-roll-vectors.json.
func Roll(raceID string, useID, hazardID int, victimID, kind string) int {
	key := raceID + "|" + strconv.Itoa(useID) + "|" + strconv.Itoa(hazardID) + "|" + victimID + "|" + kind
	return int(fnv1a32(key) % 100)
}

// fnv1a32 is the 32-bit FNV-1a hash of s's bytes.
func fnv1a32(s string) uint32 {
	hash := uint32(2166136261)
	for i := 0; i < len(s); i++ {
		hash ^= uint32(s[i])
		hash *= 16777619
	}
	return hash
}

// Roll kinds: the kind of each shared roll names the defended item family or
// the equipment ability (one roll per kind and hit: a kart and a pet with
// the same passive share it, so the better chance decides, and both shots
// of a double rocket share it). The browser uses the same kinds
// (client/src/item/item-roll.ts ItemRollKind).
const (
	RollRocket   = "rocket"   // kart / pet rocket
	RollWaterFly = "waterfly" // kart / pet waterfly
	// RollWaterBomb is the water-bomb family's roll: the pet's waterBomb, and
	// the kart's onlyWaterBomb on a water bomb (or a fly it counts as one).
	RollWaterBomb  = "waterBomb"
	RollDevil      = "devil"      // kart / pet devil
	RollSnowBomb   = "snowBomb"   // pet snowBomb
	RollBanana     = "banana"     // kart banana / iceBanana (eaten)
	RollMine       = "mine"       // kart mine
	RollForceZone  = "forceZone"  // kart forceZone
	RollWaterMine  = "waterMine"  // kart waterMine
	RollSiren      = "siren"      // kart siren
	RollWaterAngel = "waterAngel" // kart waterAngel (VariantQuick)
	RollHeadband   = "headband"   // headBand probability (VariantHeadband)
	RollBalloon    = "balloon"    // balloon prob (VariantBalloon)
	RollLucciUFO   = "lucciUfo"   // character lucciUfo (VariantBonus on a UFO)
	RollLucciMine  = "lucciMine"  // character lucciMine (VariantBonus on an eaten mine)
	RollLucciForce = "lucciForceZone"
)
