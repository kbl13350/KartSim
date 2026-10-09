package career

import "fmt"

// Career game types (CareerData.h CareerGameType) of the races this server
// runs: speed (channel *Combine) and infinite boost (*Infinit), each
// individual or team. Item modes (2, 4, 6, 8) never occur.
const (
	GameSpeedIndividual    = 1
	GameSpeedTeam          = 3
	GameInfiniteIndividual = 9
	GameInfiniteTeam       = 10
)

// RaceGameType classifies a multiplayer race.
func RaceGameType(team, infinite bool) int {
	switch {
	case infinite && team:
		return GameInfiniteTeam
	case infinite:
		return GameInfiniteIndividual
	case team:
		return GameSpeedTeam
	}
	return GameSpeedIndividual
}

// raceGameTypes are the race classes a careerGameType counts: 0 every race,
// 5 (스피드 전체) both speed classes.
func raceGameTypes(careerGameType int) []int {
	switch careerGameType {
	case 0:
		return []int{GameSpeedIndividual, GameSpeedTeam, GameInfiniteIndividual, GameInfiniteTeam}
	case 5:
		return []int{GameSpeedIndividual, GameSpeedTeam}
	case GameSpeedIndividual, GameSpeedTeam, GameInfiniteIndividual, GameInfiniteTeam:
		return []int{careerGameType}
	}
	return nil
}

// Race counter kinds.
const (
	RaceWin    = "win"
	RaceFinish = "finish"
	RaceRetire = "retire"
	// RaceDistance counts meters driven (route progress) instead of races.
	RaceDistance = "distance"
)

// Counter names besides RaceCounter.
const (
	CounterRetireStreak    = "race.retire.streak"
	CounterRetireStreakMax = "race.retire.streakMax"
	CounterTimeAttack      = "timeattack.finish"
	// CounterCameraDistance is the meters raced with a replay camera.
	CounterCameraDistance = "race.distance.camera"
	// CounterLicenseLevel is the highest license taken (1 新手 … 6 PRO) and
	// CounterLicensePro how many times PRO was taken.
	CounterLicenseLevel = "license.level"
	CounterLicensePro   = "license.pro"
)

// metersPerCareerUnit converts meters to the distance careers' clearValue
// unit, 0.1 km (森林主题赛道累积完成500Km is clearValue 5000).
const metersPerCareerUnit = 100

// MaxTheme is the largest career themeId.
const MaxTheme = 35

// RaceCounter names the counter of races of one kind, class and theme
// (0 when the track's theme is unknown).
func RaceCounter(kind string, gameType, theme int) string {
	return fmt.Sprintf("race.%s.%d.%d", kind, gameType, theme)
}

// Item categories of the item-dictionary career types (도감 13-23); type 12
// counts every category.
var dictionaryCategory = map[int]int{
	13: 3,  // 车辆 kart
	15: 1,  // 角色 character
	16: 21, // 宠物 pet
	17: 52, // 飞行宠物 flying pet
	18: 9,  // 气球 balloon
	19: 11, // 头饰 headBand (전자파밴드)
	20: 8,  // 护目镜 goggle
	21: 26, // 炫光 aura
	22: 2,  // 喷漆 color
	23: 27, // 印迹 skid mark
}

// Facts is what the data service knows about one account.
type Facts struct {
	Now            int64 // Unix ms the facts were gathered at
	Exp            int64
	RegisteredDays int64           // whole days since the account was created
	LoginDates     map[string]bool // "MM-DD" Beijing dates the account signed in on
	Friends        int
	LucciSpent     int64
	Lucci          int64
	// Collected holds every item the account ever had (category -> ids);
	// Owned only those not expired.
	Collected    map[int]map[int]bool
	Owned        map[int]map[int]bool
	Emblems      map[int]bool
	MainEmblems  int
	DisplayKarts int
	Counters     map[string]int64
	Rewarded     map[int]bool
	// RewardedAt is when each rewarded career was completed (Unix ms).
	RewardedAt map[int]int64
}

// Career states as the client shows them (tabDetailCombo).
const (
	StatePlaying  = "playing"  // 未完成
	StateComplete = "complete" // 可完成
	StateRewarded = "rewarded" // 完成
)

// Progress is one career's standing for an account.
type Progress struct {
	ID    int    `json:"id"`
	Value int64  `json:"value"`
	State string `json:"state"`
	// Locked: its preClearCareerId is not completed yet (the next stage of
	// a chain stays hidden until the previous one is done).
	Locked bool `json:"locked,omitempty"`
	// Untracked: this server cannot measure the condition, so the career
	// never completes.
	Untracked bool `json:"untracked,omitempty"`
	// CompletedAt is when a rewarded career was completed (Unix ms).
	CompletedAt int64 `json:"completedAt,omitempty"`
}

// Value measures a career's condition; tracked is false for condition types
// this server cannot measure.
func (d *Data) Value(c *Career, f Facts) (value int64, tracked bool) {
	switch c.Type {
	case 1: // 레벨(RP누적): clearValue is accumulated RP
		return f.Exp, true
	case 3: // 특정날짜접속
		if c.Date != "" && f.LoginDates[c.Date] {
			return 1, true
		}
		return 0, true
	case 4: // 유저접속날짜누적: days since the first sign-in (registration)
		return f.RegisteredDays, true
	case 7:
		return int64(f.Friends), true
	case 11:
		return f.LucciSpent, true
	case 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23: // 도감: items the dictionary lists
		if d.dictionary == nil {
			return 0, false
		}
		return int64(d.dictionary.Count(f.Collected, dictionaryCategory[c.Type], f.Now)), true
	case 24:
		return int64(len(f.Emblems)), true
	case 26:
		return int64(f.DisplayKarts), true
	case 27:
		return int64(f.MainEmblems), true
	case 28:
		return f.Counters[CounterTimeAttack], true
	case 30: // 라이센스 획득: the license level reached
		return f.Counters[CounterLicenseLevel], true
	case 31: // PRO 라이센스 획득 횟수
		return f.Counters[CounterLicensePro], true
	case 40:
		return raceCount(f, RaceWin, c), true
	case 42:
		return raceCount(f, RaceFinish, c), true
	case 43:
		return raceCount(f, RaceRetire, c), true
	case 46: // 주행 - 거리 누적, by theme
		return raceCount(f, RaceDistance, c) / metersPerCareerUnit, true
	case 50: // 녹화 카메라 장착 + 거리 누적
		return f.Counters[CounterCameraDistance] / metersPerCareerUnit, true
	case 49:
		done := int64(0)
		for _, id := range c.Multi {
			if f.Rewarded[id] {
				done++
			}
		}
		return done, true
	case 54:
		return f.Counters[CounterRetireStreakMax], true
	case 55:
		owned := int64(0)
		for _, id := range c.Items {
			if f.Owned[c.ItemCat][id] {
				owned++
			}
		}
		return owned, true
	case 56:
		return f.Lucci, true
	case 60:
		owned := int64(0)
		for _, id := range c.Emblems {
			if f.Emblems[id] {
				owned++
			}
		}
		return owned, true
	}
	return 0, false
}

func raceCount(f Facts, kind string, c *Career) int64 {
	total := int64(0)
	for _, gameType := range raceGameTypes(c.GameType) {
		if c.Theme != 0 {
			total += f.Counters[RaceCounter(kind, gameType, c.Theme)]
			continue
		}
		for theme := 0; theme <= MaxTheme; theme++ {
			total += f.Counters[RaceCounter(kind, gameType, theme)]
		}
	}
	return total
}

// target is the value that completes a career: a multi career needs all of
// its careers.
func target(c *Career) int64 {
	if c.Type == 49 {
		return int64(len(c.Multi))
	}
	return c.Clear
}

// Reached reports whether a career's condition is met.
func (d *Data) Reached(c *Career, f Facts) bool {
	value, tracked := d.Value(c, f)
	if !tracked {
		return false
	}
	if c.LucciZero {
		return f.Lucci == 0
	}
	return value >= target(c)
}

// Evaluate returns every career's progress, in table order.
func (d *Data) Evaluate(f Facts) []Progress {
	out := make([]Progress, len(d.Careers))
	for i := range d.Careers {
		out[i] = d.progress(&d.Careers[i], f)
	}
	return out
}

// Progress is one career's standing.
func (d *Data) Progress(c *Career, f Facts) Progress { return d.progress(c, f) }

func (d *Data) progress(c *Career, f Facts) Progress {
	value, tracked := d.Value(c, f)
	p := Progress{ID: c.ID, Value: value, State: StatePlaying, Untracked: !tracked}
	switch {
	case f.Rewarded[c.ID]:
		p.State = StateRewarded
		p.CompletedAt = f.RewardedAt[c.ID]
	case c.Pre != 0 && !f.Rewarded[c.Pre]:
		p.Locked = true
	case d.Reached(c, f):
		p.State = StateComplete
	}
	return p
}

// Points is the career points of the rewarded careers.
func (d *Data) Points(rewarded map[int]bool) int {
	total := 0
	for id := range rewarded {
		if c := d.byID[id]; c != nil {
			total += c.Point
		}
	}
	return total
}
