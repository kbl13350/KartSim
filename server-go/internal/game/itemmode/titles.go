package itemmode

import "slices"

// Title keys (title_icons/namemap@zz, ITEM_MODE.md C.9), in namemap order.
const (
	TitlePerfectAim   = "perfectAim"   // 백발백중 百发百中: fail="0" (and a hit landed)
	TitleIronWall     = "ironWall"     // 철벽방어 铁壁防御: angel ×5
	TitleTurret       = "turret"       // 터렛모드 炮台模式: missiles ×10
	TitleFlyKing      = "flyKing"      // 파리대왕 苍蝇之王: water flies ×10
	TitleCarpetBomb   = "carpetBomb"   // 융단폭격 地毯式轰炸: water bombs ×10
	TitleCloudyDay    = "cloudyDay"    // 구름낀날 阴云密布: clouds ×10
	TitleMagnetic     = "magnetic"     // 왠지끌려 莫名吸引: magnets ×10
	TitleInvasion     = "invasion"     // 지구침공 入侵地球: UFOs ×10
	TitleSpeedWar     = "speedWar"     // 스피드전 速度战: boosters ×10
	TitlePerfectStart = "perfectStart" // 완벽출발 完美起步: custom 1
	TitleOnlyOne      = "onlyOne"      // 유아독존 唯我独尊: custom 2
	TitleSafetyFirst  = "safetyFirst"  // 안전제일 安全第一: custom 3
)

// TitleKeys lists every title key, in namemap order.
var TitleKeys = []string{TitlePerfectAim, TitleIronWall, TitleTurret, TitleFlyKing, TitleCarpetBomb,
	TitleCloudyDay, TitleMagnetic, TitleInvasion, TitleSpeedWar, TitlePerfectStart, TitleOnlyOne,
	TitleSafetyFirst}

// TitleFacts are what the lobby knows of a racer for the custom titles.
type TitleFacts struct {
	// Finished: the racer finished the race; First: it finished first.
	Finished, First bool
	// PerfectStart: its finish reported a successful start boost.
	PerfectStart bool
	// LapLeader: it was the leader each time it crossed the line.
	LapLeader bool
}

// Titles returns the result titles a racer earned (ITEM_MODE.md C.9), in
// namemap order: fail="0" needs a landed attack and none blocked; item
// titles need that many uses of the item's family; custom 1 is a perfect
// start, custom 2 a first place led at every lap line, custom 3 a finish
// without being hit by any item.
func (r *Race) Titles(playerID string, facts TitleFacts) []string {
	p := r.racers[playerID]
	titles := []string{}
	if p == nil {
		return titles
	}
	for _, title := range r.data.Titles {
		earned := false
		switch {
		case title.Fail != nil:
			earned = p.failed <= *title.Fail && p.landed > 0
		case title.Use > 0:
			used := 0
			for idx, count := range p.uses {
				if slices.Contains(title.Items, idx) {
					used += count
				}
			}
			earned = used >= title.Use
		case title.Custom == 1:
			earned = facts.PerfectStart
		case title.Custom == 2:
			earned = facts.First && facts.LapLeader
		case title.Custom == 3:
			earned = facts.Finished && !p.hitTaken
		}
		if earned {
			titles = append(titles, title.Key)
		}
	}
	return titles
}
