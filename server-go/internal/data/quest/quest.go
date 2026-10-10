// Package quest is the 任务 list this server runs (MENUS.md 2): daily,
// weekly and one-time quests in the release QuestUX2nd form (原版
// QuestAutomation types 行驶 1, 完成 2, 累计距离 3, 名次 4, 胜利 8), limited
// to what the server counts: multiplayer speed and infinite-boost races
// and practice time attack runs. Daily quests reset at 06:00 Beijing
// time, weekly ones on Thursday 06:00 (questInfo2 detailDailyQuest /
// detailWeeklyQuest); rewards go to the 奖励箱.
package quest

import (
	"time"
)

// Kinds (QuestAutomation type).
const (
	KindDrive    = 1 // 行驶: a race played, finished or not
	KindFinish   = 2 // 完成
	KindDistance = 3 // 累计完成: route distance in 0.1 km
	KindRank     = 4 // 第N名以内完成
	KindWin      = 8 // 胜利
)

// Resets (QuestUX2ndButton resetType).
const (
	ResetDaily  = "daily"  // 每日
	ResetWeekly = "weekly" // 每周
	ResetNone   = "none"   // 一般
)

// Channels a quest counts: the multiplayer channels and practice time attack.
const (
	ChannelSpeedIndi    = "speedIndiCombine"
	ChannelSpeedTeam    = "speedTeamCombine"
	ChannelInfiniteIndi = "speedIndiInfinit"
	ChannelInfiniteTeam = "speedTeamInfinit"
	ChannelTimeAttack   = "timeAttack"
)

// Multiplayer is every multiplayer channel.
var Multiplayer = []string{ChannelSpeedIndi, ChannelSpeedTeam, ChannelInfiniteIndi, ChannelInfiniteTeam}

// Reward is one prize: an item, a currency amount, or an emblem (granted
// at once; items and currencies go to the 奖励箱).
type Reward struct {
	Name     string `json:"name"`
	Category int    `json:"category,omitempty"`
	ItemID   int    `json:"itemId,omitempty"`
	Count    int    `json:"count"`
	Days     int    `json:"days,omitempty"`
	Currency string `json:"currency,omitempty"`
	Emblem   int    `json:"emblem,omitempty"`
}

// Quest is one quest.
type Quest struct {
	ID       int      `json:"id"`
	Reset    string   `json:"reset"`
	Kind     int      `json:"kind"`
	Target   int64    `json:"target"`
	Rank     int      `json:"rank,omitempty"`
	Channels []string `json:"channels"`
	// Pre must be completed first (a one-time chain).
	Pre     int      `json:"pre,omitempty"`
	Title   string   `json:"title"`
	Desc    string   `json:"desc"`
	Mission string   `json:"mission"`
	Rewards []Reward `json:"rewards"`
}

func lucci(amount int) Reward {
	return Reward{Name: formatAmount(amount) + "金币", Count: amount, Currency: "lucci"}
}

func koin(amount int) Reward {
	return Reward{Name: formatAmount(amount) + "酷币", Count: amount, Currency: "koin"}
}

func formatAmount(amount int) string {
	digits := []byte{}
	for i, n := 0, amount; ; i++ {
		if i > 0 && i%3 == 0 {
			digits = append([]byte{','}, digits...)
		}
		digits = append([]byte{byte('0' + n%10)}, digits...)
		if n /= 10; n == 0 {
			break
		}
	}
	return string(digits)
}

// Gacha and treasure-hunt materials (lottery.json items).
var (
	gem       = Reward{Name: "[活动]光明骑士幸运宝石", Category: 24, ItemID: 1242, Count: 1}
	tire      = Reward{Name: "幸运车胎", Category: 24, ItemID: 862, Count: 1}
	magnifier = Reward{Name: "[活动]海洋寻宝放大镜", Category: 34, ItemID: 884, Count: 1}
	treasure  = Reward{Name: "幸运藏宝图", Category: 34, ItemID: 834, Count: 1}
)

func times(reward Reward, count int) Reward {
	reward.Count = count
	return reward
}

// All is the quest list, in the order the dialog lists them.
var All = []Quest{
	{ID: 9001, Reset: ResetDaily, Kind: KindDrive, Target: 3, Channels: Multiplayer, Title: "多人游戏行驶",
		Desc: "在多人游戏中驾驶吧！|不论是否完成比赛都会计入。", Mission: "多人游戏行驶3回", Rewards: []Reward{lucci(1000)}},
	{ID: 9002, Reset: ResetDaily, Kind: KindFinish, Target: 5, Channels: Multiplayer, Title: "多人游戏完成",
		Desc: "在多人游戏中完成比赛吧！", Mission: "多人游戏完成5回", Rewards: []Reward{lucci(2000), gem, tire}},
	{ID: 9003, Reset: ResetDaily, Kind: KindWin, Target: 1, Channels: Multiplayer, Title: "多人游戏胜利",
		Desc: "在多人游戏中取得胜利吧！|组队赛中所在队伍获胜也计入。", Mission: "多人游戏胜利1回", Rewards: []Reward{koin(5)}},
	{ID: 9004, Reset: ResetDaily, Kind: KindRank, Target: 3, Rank: 3, Channels: []string{ChannelSpeedIndi},
		Title: "竞速个人赛名次", Desc: "在竞速个人赛中冲进前三名吧！", Mission: "竞速个人赛第3名以内完成3回",
		Rewards: []Reward{lucci(3000), magnifier, treasure}},
	{ID: 9005, Reset: ResetDaily, Kind: KindDrive, Target: 5, Channels: []string{ChannelInfiniteIndi, ChannelInfiniteTeam},
		Title: "无限加速赛行驶", Desc: "在无限加速频道中驾驶吧！", Mission: "无限加速赛行驶5回", Rewards: []Reward{lucci(2000)}},
	{ID: 9006, Reset: ResetDaily, Kind: KindDistance, Target: 100, Channels: Multiplayer, Title: "累计行驶距离",
		Desc: "在多人游戏中累计行驶10KM吧！", Mission: "多人游戏累计完成10KM", Rewards: []Reward{koin(3)}},
	{ID: 9007, Reset: ResetDaily, Kind: KindFinish, Target: 3, Channels: []string{ChannelTimeAttack},
		Title: "练习计时赛", Desc: "在单人游戏的练习计时赛中完成比赛吧！", Mission: "练习计时赛完成3回",
		Rewards: []Reward{lucci(1000)}},
	{ID: 9101, Reset: ResetWeekly, Kind: KindFinish, Target: 30, Channels: Multiplayer, Title: "每周完成",
		Desc: "本周在多人游戏中完成30场比赛吧！", Mission: "多人游戏完成30回",
		Rewards: []Reward{koin(20), times(gem, 3), times(tire, 3)}},
	{ID: 9102, Reset: ResetWeekly, Kind: KindWin, Target: 10, Channels: Multiplayer, Title: "每周胜利",
		Desc: "本周在多人游戏中取得10次胜利吧！", Mission: "多人游戏胜利10回",
		Rewards: []Reward{koin(30), times(magnifier, 3), times(treasure, 3)}},
	{ID: 9103, Reset: ResetWeekly, Kind: KindWin, Target: 5, Channels: []string{ChannelSpeedTeam, ChannelInfiniteTeam},
		Title: "组队赛胜利", Desc: "本周和队友一起赢得5场组队赛吧！", Mission: "组队赛胜利5回", Rewards: []Reward{lucci(10000)}},
	{ID: 9201, Reset: ResetNone, Kind: KindDistance, Target: 300, Channels: Multiplayer, Title: "跑跑之路 1",
		Desc: "在多人游戏中累计行驶30KM。", Mission: "多人游戏累计完成30KM", Rewards: []Reward{lucci(10000)}},
	{ID: 9202, Reset: ResetNone, Kind: KindDistance, Target: 3000, Channels: Multiplayer, Pre: 9201, Title: "跑跑之路 2",
		Desc: "在多人游戏中累计行驶300KM。|（原版任务2118）", Mission: "多人游戏累计完成300KM",
		Rewards: []Reward{koin(50), {Name: "徽章", Count: 1, Emblem: 8872}}},
}

var byID = func() map[int]*Quest {
	index := map[int]*Quest{}
	for i := range All {
		index[All[i].ID] = &All[i]
	}
	return index
}()

// ByID returns a quest.
func ByID(id int) (*Quest, bool) {
	q, ok := byID[id]
	return q, ok
}

var beijing = time.FixedZone("UTC+8", 8*60*60)

// ResetHour is when daily and weekly quests start over (06:00 Beijing).
const ResetHour = 6

// Period is the reset window of a quest at a Unix ms time: its key
// (the window's first day, "" for one-time quests) and its bounds.
type Period struct {
	Key   string
	Start int64
	End   int64 // 0 for one-time quests
}

// PeriodOf returns the window holding now.
func PeriodOf(reset string, now int64) Period {
	if reset == ResetNone {
		return Period{}
	}
	t := time.UnixMilli(now).In(beijing).Add(-ResetHour * time.Hour)
	day := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, beijing)
	length := 1
	if reset == ResetWeekly {
		day = day.AddDate(0, 0, -((int(day.Weekday()) - int(time.Thursday) + 7) % 7))
		length = 7
	}
	start := day.Add(ResetHour * time.Hour)
	return Period{Key: day.Format(time.DateOnly), Start: start.UnixMilli(),
		End: start.AddDate(0, 0, length).UnixMilli()}
}

// Race is one counted result of a rider.
type Race struct {
	Channel  string
	Finished bool
	Rank     int
	Won      bool
	// Meters is the route distance the rider drove.
	Meters int64
}

// Gain is what a race adds to a quest's progress (0 when it does not count).
func (q *Quest) Gain(race Race) int64 {
	counts := false
	for _, channel := range q.Channels {
		if channel == race.Channel {
			counts = true
		}
	}
	if !counts {
		return 0
	}
	switch q.Kind {
	case KindDrive:
		return 1
	case KindFinish:
		if race.Finished {
			return 1
		}
	case KindWin:
		if race.Won {
			return 1
		}
	case KindRank:
		if race.Finished && race.Rank >= 1 && race.Rank <= q.Rank {
			return 1
		}
	case KindDistance:
		return race.Meters / 100
	}
	return 0
}

// RaceChannel names the multiplayer channel of a race.
func RaceChannel(team, infinite bool) string {
	switch {
	case team && infinite:
		return ChannelInfiniteTeam
	case infinite:
		return ChannelInfiniteIndi
	case team:
		return ChannelSpeedTeam
	}
	return ChannelSpeedIndi
}
