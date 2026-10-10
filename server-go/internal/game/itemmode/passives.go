package itemmode

import (
	"slices"
	"strings"
)

// Passive holders: the itemTable tags of the equipment whose attributes
// matter in item races (ITEM_MODE.md C.2), keys of Data.Passives.
const (
	HolderKart      = "kart"
	HolderPet       = "pet"
	HolderCharacter = "character"
	HolderBalloon   = "balloon"
	HolderHeadBand  = "headBand"
)

// Equipment is a racer's frozen equipment (race.roster[i].equipment.itemIds
// at start): kart "3", character "1", pet "21", goggle "8", balloon "9",
// headband "11", flying pet "52" (ITEM_MODE.md C.1). 0 is nothing (or the
// starter practice kart).
type Equipment struct {
	Kart, Character, Pet, Goggle, Balloon, HeadBand, FlyingPet int
}

// EquipmentFromItemIDs reads an equipment document's itemIds.
func EquipmentFromItemIDs(ids map[string]int) Equipment {
	return Equipment{Kart: ids["3"], Character: ids["1"], Pet: ids["21"], Goggle: ids["8"],
		Balloon: ids["9"], HeadBand: ids["11"], FlyingPet: ids["52"]}
}

// LucciAmount is the lucci one in-race bonus pays (C.8: the UFO bonus's
// lucci='10', enchantCatalog.xml:157; the others follow it); a racer earns
// at most MaxBonusLucci per race.
const (
	LucciAmount   = 10
	MaxBonusLucci = 200
)

// Lucci reasons ({"action":"lucci","reason"}).
const (
	LucciItemCube = "itemCube" // kart lucciItemCube, at a cube
	LucciUFO      = "ufo"      // character lucciUfo, hit by a UFO (VariantBonus)
	LucciBalloon  = "balloon"  // the balloon popped under a missile (VariantBalloon)
	LucciMine     = "mine"     // character lucciMine / lucciForceZone, a mine eaten (ByEat + VariantBonus)
)

// chance returns the item-race chance of a passive of the racer's equipment.
func (r *Race) chance(e Equipment, holder, attribute string) int {
	var id int
	switch holder {
	case HolderKart:
		id = e.Kart
	case HolderPet:
		id = e.Pet
	case HolderCharacter:
		id = e.Character
	case HolderBalloon:
		id = e.Balloon
	case HolderHeadBand:
		id = e.HeadBand
	}
	if id == 0 {
		return 0
	}
	return r.data.Passive(holder, id, attribute)
}

// rolled reports whether a passive of chance p succeeds for this hit.
func (r *Race) rolled(p int, useID, hazardID int, victimID, kind string) bool {
	return p > 0 && Roll(r.raceID, useID, hazardID, victimID, kind) < p
}

// hitContext is one victim report being checked.
type hitContext struct {
	victimID        string
	equipment       Equipment
	useID, hazardID int
	item            int
}

func (r *Race) roll(h hitContext, holder, attribute, kind string) bool {
	return r.rolled(r.chance(h.equipment, holder, attribute), h.useID, h.hazardID, h.victimID, kind)
}

// equipmentBlocks reports whether the victim's kart (ByKart) or pet (ByPet)
// passive blocks the item, or its kart eats it (ByEat), for this hit's
// roll (ITEM_MODE.md C.2).
func (r *Race) equipmentBlocks(h hitContext, by string) bool {
	in := func(family []int) bool { return slices.Contains(family, h.item) }
	switch by {
	case ByKart:
		switch {
		case in(rocketFamily):
			return r.roll(h, HolderKart, "rocket", RollRocket)
		case in(flyFamily):
			if r.roll(h, HolderKart, "waterfly", RollWaterFly) {
				return true
			}
			// Flies counted as water bombs take the onlyWaterBomb roll.
			counted := r.chance(h.equipment, HolderKart, "allflyToAllBomb") > 0 ||
				(h.item == WaterFly && r.chance(h.equipment, HolderKart, "waterflyToWaterBomb") > 0)
			return counted && r.roll(h, HolderKart, "onlyWaterBomb", RollOnlyWaterBomb)
		case h.item == WaterBomb:
			return r.roll(h, HolderKart, "onlyWaterBomb", RollOnlyWaterBomb)
		case in(devilFamily):
			return r.roll(h, HolderKart, "devil", RollDevil)
		case r.mineCovered(h):
			return r.roll(h, HolderKart, "mine", RollMine)
		case h.item == ForceZone:
			return r.roll(h, HolderKart, "forceZone", RollForceZone)
		case h.item == WaterMine:
			return r.roll(h, HolderKart, "waterMine", RollWaterMine)
		case in(sirenFamily):
			return r.roll(h, HolderKart, "siren", RollSiren)
		}
	case ByPet:
		switch {
		case in(rocketFamily):
			return r.roll(h, HolderPet, "rocket", RollRocket)
		case in(flyFamily):
			return r.roll(h, HolderPet, "waterfly", RollWaterFly)
		case in(devilFamily):
			return r.roll(h, HolderPet, "devil", RollDevil)
		}
		// A snow bomb is in both pet families: either passive blocks it.
		return (in(waterBombFamily) && r.roll(h, HolderPet, "waterBomb", RollWaterBomb)) ||
			(in(snowFamily) && r.roll(h, HolderPet, "snowBomb", RollSnowBomb))
	case ByEat:
		switch {
		case in(bananaFamily):
			p := r.chance(h.equipment, HolderKart, "banana")
			// iceBanana: every banana is eaten on an ice-theme track.
			if r.chance(h.equipment, HolderKart, "iceBanana") > 0 && strings.HasPrefix(r.trackID, "ice_") {
				p = max(p, r.chance(h.equipment, HolderKart, "iceBanana"))
			}
			return r.rolled(p, h.useID, h.hazardID, h.victimID, RollBanana)
		case r.mineCovered(h):
			return r.chance(h.equipment, HolderKart, "eatMine") > 0 && r.roll(h, HolderKart, "mine", RollMine)
		case h.item == ForceZone:
			return r.chance(h.equipment, HolderKart, "eatForceZone") > 0 && r.roll(h, HolderKart, "forceZone", RollForceZone)
		}
	}
	return false
}

// mineCovered reports whether the kart's mine passive covers the item: the
// mines, and the egg mines with mineWithEggMine / mineWithKindOfEgg.
func (r *Race) mineCovered(h hitContext) bool {
	switch {
	case slices.Contains(mineFamily, h.item):
		return true
	case slices.Contains(eggMines, h.item) && r.chance(h.equipment, HolderKart, "mineWithEggMine") > 0:
		return true
	}
	return slices.Contains(kindOfEggs, h.item) && r.chance(h.equipment, HolderKart, "mineWithKindOfEgg") > 0
}

// variantHolds reports whether the victim's equipment gives the hit its
// variant (ITEM_MODE.md C.2), and the lucci reason it pays ("" none).
// result and by are the report's; states are the item variant's states.
func (r *Race) variantHolds(h hitContext, result, by, variant string) (ok bool, lucci string) {
	in := func(family []int) bool { return slices.Contains(family, h.item) }
	if result == ResultBlocked {
		// Only an eaten mine pays the character's bonus (EatBonus).
		if variant != VariantBonus || by != ByEat {
			return false, ""
		}
		switch {
		case r.mineCovered(h):
			return r.roll(h, HolderCharacter, "lucciMine", RollLucciMine), LucciMine
		case h.item == ForceZone:
			return r.roll(h, HolderCharacter, "lucciForceZone", RollLucciForce), LucciMine
		}
		return false, ""
	}
	switch variant {
	case VariantSmall:
		// A milder missile hit (AffectSmall) has no equipment condition.
		item, _ := r.data.Item(h.item)
		_, small := item.States["AffectSmall"]
		return small, ""
	case VariantHeadband:
		return h.item == UFO && r.roll(h, HolderHeadBand, "probability", RollHeadband), ""
	case VariantBonus:
		return h.item == UFO && r.roll(h, HolderCharacter, "lucciUfo", RollLucciUFO), LucciUFO
	case VariantQuick:
		return in(waterTraps) && r.roll(h, HolderKart, "waterAngel", RollWaterAngel), ""
	case VariantBalloon:
		return in(balloonRockets) && r.roll(h, HolderBalloon, "prob", RollBalloon), LucciBalloon
	}
	return false, ""
}

// rocketCount is how many missiles one use fires: two for a kart with
// useTwoRocket (rocket) or useTwoGoldRocket (the gold rocket kind).
func (r *Race) rocketCount(e Equipment, item int) int {
	var p int
	switch {
	case item == Rocket:
		p = r.chance(e, HolderKart, "useTwoRocket")
	case slices.Contains(goldRocketFamily, item):
		p = r.chance(e, HolderKart, "useTwoGoldRocket")
	}
	if r.chanceRoll(p) {
		return 2
	}
	return 1
}

// chanceRoll is a server-side roll (the cube lucci, the transforms and
// gains): p percent, no draw when certain.
func (r *Race) chanceRoll(p int) bool {
	switch {
	case p <= 0:
		return false
	case p >= 100:
		return true
	}
	return r.random.IntN(100) < p
}
