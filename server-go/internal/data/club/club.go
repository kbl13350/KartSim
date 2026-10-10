// Package club holds the 俱乐部 rules: the release club marks and frames
// (club.json, exported from DataPack1 etc_/clubMark by
// client/tools/export-club-data.mjs) and the numbers the release kept on
// its servers, chosen here and documented in server-go/CLUB.md.
package club

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

//go:embed club.json
var embedded []byte

// Grades (stage_clubMain: clubMaster, manager, firstMember, member).
const (
	GradeMaster  = 1 // 俱乐部会长
	GradeManager = 2 // 俱乐部管理层
	GradeFirst   = 3 // 俱乐部优秀会员
	GradeMember  = 4 // 俱乐部会员
)

// Facilities of the 俱乐部基地 (clubHQ, racingCenter, riderCenter, clubBank).
const (
	FacilityHQ     = 0 // 俱乐部总部: the club level, marks and frames
	FacilityRacing = 1 // 赛事中心: daily welfare from Lv2
	FacilityRider  = 2 // 车手中心: the member cap
	FacilityBank   = 3 // 俱乐部银行: the budget cap
	Facilities     = 4
)

// MaxLevel is the highest facility and club level.
const MaxLevel = 5

// Release rules (stage_clubList / stage_clubCreate / stage_clubMain strings).
const (
	// CreateLevel is the rider level of 七彩色星星手套 ("彩星手套以上玩家可创建俱乐部").
	CreateLevel = 56
	// CreateLucci is what creating a club costs ("创建俱乐部需要100,000金币").
	CreateLucci = 100_000
	NameMin     = 2   // "需最少输入2字，最多可输入10字"
	NameMax     = 10  //
	IntroMax    = 150 // clubIntroEdit maxChar
	// RejoinCooldown: "退出后24小时内无法加入俱乐部" (and create one).
	RejoinCooldown = 24 * time.Hour
	// BreakGrace is how long a club with members waits before it is disbanded.
	BreakGrace = 7 * 24 * time.Hour
)

// Numbers the release kept on its servers; the defaults of CLUB.md.
const (
	// MaxApplicants bounds the pending applications of a club ("已超过申请人数上限").
	MaxApplicants = 50
	// NameChangeLucci and MarkChangeLucci come out of the club budget.
	NameChangeLucci = 500_000
	MarkChangeLucci = 200_000
	// Activity points (俱乐部活跃度) a member's finished multiplayer race earns,
	// and the extra for winning it.
	RaceFinishPoints = 1
	RaceWinPoints    = 1
)

// MemberCaps is the member cap by 车手中心 level (riderCenter_crew1..5).
var MemberCaps = [MaxLevel]int{100, 150, 200, 300, 500}

// BudgetCaps is the club budget cap in lucci by 俱乐部银行 level.
var BudgetCaps = [MaxLevel]int64{1_000_000, 3_000_000, 5_000_000, 10_000_000, 20_000_000}

// Donations are the 进行捐助 choices (supportLucci0..3, "%d万"), once a day.
var Donations = [4]int64{10_000, 30_000, 50_000, 100_000}

// Upgrade is the cost of reaching a facility level: activity points and
// budget lucci, and for the 俱乐部总部 the members it needs ("升级条件 … 人以上").
type Upgrade struct {
	Level   int   `json:"level"`
	CS      int64 `json:"cs"`
	Lucci   int64 `json:"lucci"`
	Members int   `json:"members"`
}

// Upgrades are the costs of levels 2-5; a facility other than the 总部 may
// not pass the 总部's level.
var Upgrades = [MaxLevel - 1]Upgrade{
	{Level: 2, CS: 500, Lucci: 200_000, Members: 5},
	{Level: 3, CS: 2_000, Lucci: 500_000, Members: 10},
	{Level: 4, CS: 5_000, Lucci: 1_000_000, Members: 20},
	{Level: 5, CS: 10_000, Lucci: 2_000_000, Members: 30},
}

// Welfare is one 赛事中心 slot: open from Level, claimable once a Beijing day.
type Welfare struct {
	Slot     int    `json:"slot"`
	Level    int    `json:"level"`
	Name     string `json:"name"`
	Currency string `json:"currency"` // "lucci" or "koin"
	Amount   int64  `json:"amount"`
}

// Welfares are the 比赛福利道具 by racing center level ("赛事中心达到2级时开放领取福利道具").
var Welfares = []Welfare{
	{Slot: 0, Level: 2, Name: "俱乐部福利 2,000金币", Currency: "lucci", Amount: 2_000},
	{Slot: 1, Level: 3, Name: "俱乐部福利 5,000金币", Currency: "lucci", Amount: 5_000},
	{Slot: 2, Level: 4, Name: "俱乐部福利 5酷币", Currency: "koin", Amount: 5},
	{Slot: 3, Level: 5, Name: "俱乐部福利 10酷币", Currency: "koin", Amount: 10},
}

// UpgradeTo returns the cost of reaching level 2-5.
func UpgradeTo(level int) (Upgrade, bool) {
	if level < 2 || level > MaxLevel {
		return Upgrade{}, false
	}
	return Upgrades[level-2], true
}

// MemberCap returns the member cap of a 车手中心 level.
func MemberCap(level int) int { return MemberCaps[clampLevel(level)-1] }

// BudgetCap returns the budget cap of a 俱乐部银行 level.
func BudgetCap(level int) int64 { return BudgetCaps[clampLevel(level)-1] }

func clampLevel(level int) int { return min(max(level, 1), MaxLevel) }

// ValidDonation reports whether amount is one of the donation choices.
func ValidDonation(amount int64) bool {
	for _, choice := range Donations {
		if amount == choice {
			return true
		}
	}
	return false
}

// Mark is a club mark or frame (clubMark@cn.xml / clubFrame@cn.xml).
type Mark struct {
	ID    int  `json:"id"`
	Level int  `json:"level,omitempty"` // usable from this club level
	Rank  int  `json:"rank,omitempty"`  // a top-3 rank frame
	Order int  `json:"order"`
	Basic bool `json:"basic,omitempty"` // a new club's choice
}

// Data is the parsed club.json.
type Data struct {
	Version string
	Marks   []Mark
	Frames  []Mark
	marks   map[int]Mark
	frames  map[int]Mark
}

// Parse reads a club.json document.
func Parse(raw []byte) (*Data, error) {
	var doc struct {
		Version string `json:"version"`
		Marks   []Mark `json:"marks"`
		Frames  []Mark `json:"frames"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("club.json: %w", err)
	}
	if doc.Version == "" || len(doc.Marks) == 0 || len(doc.Frames) == 0 {
		return nil, errors.New("club.json: missing version, marks or frames")
	}
	d := &Data{Version: doc.Version, Marks: doc.Marks, Frames: doc.Frames, marks: map[int]Mark{}, frames: map[int]Mark{}}
	for _, mark := range doc.Marks {
		d.marks[mark.ID] = mark
	}
	for _, frame := range doc.Frames {
		d.frames[frame.ID] = frame
	}
	return d, nil
}

var loadDefault = sync.OnceValues(func() (*Data, error) { return Parse(embedded) })

// Default returns the embedded table.
func Default() (*Data, error) { return loadDefault() }

// MarkUsable reports whether a club of a level may show a mark; creating a
// club (level 0) allows only the basic marks.
func (d *Data) MarkUsable(id, clubLevel int) bool {
	mark, ok := d.marks[id]
	if !ok || mark.Level == 0 {
		return false
	}
	if clubLevel == 0 {
		return mark.Basic
	}
	return mark.Level <= clubLevel
}

// FrameUsable is MarkUsable for frames; rank frames are not chosen.
func (d *Data) FrameUsable(id, clubLevel int) bool {
	frame, ok := d.frames[id]
	if !ok || frame.Level == 0 {
		return false
	}
	if clubLevel == 0 {
		return frame.Basic
	}
	return frame.Level <= clubLevel
}

var beijing = time.FixedZone("UTC+8", 8*60*60)

// Week is the activity week holding a Unix ms time: weekly points reset
// every Thursday 00:00 Beijing time ("每周星期四00:00进行初始化"). The key is
// the date of that Thursday.
func Week(now int64) string {
	t := time.UnixMilli(now).In(beijing)
	back := (int(t.Weekday()) - int(time.Thursday) + 7) % 7
	start := time.Date(t.Year(), t.Month(), t.Day()-back, 0, 0, 0, 0, beijing)
	return start.Format(time.DateOnly)
}

// Day is the Beijing day of a Unix ms time (donations, welfare).
func Day(now int64) string { return time.UnixMilli(now).In(beijing).Format(time.DateOnly) }

// CleanName trims a club name and checks it: 2-10 characters, letters,
// digits or CJK, no spaces or symbols ("无法使用该名称").
func CleanName(name string) (string, bool) {
	name = strings.TrimSpace(name)
	count := utf8.RuneCountInString(name)
	if count < NameMin || count > NameMax {
		return name, false
	}
	for _, r := range name {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) {
			return name, false
		}
	}
	return name, true
}

// NameKey is the uniqueness key of a club name.
func NameKey(name string) string { return strings.ToLower(name) }

// CleanIntro trims an introduction and checks it: 1-150 characters, no
// control characters but line breaks.
func CleanIntro(intro string) (string, bool) {
	intro = strings.TrimSpace(strings.ReplaceAll(intro, "\r\n", "\n"))
	count := utf8.RuneCountInString(intro)
	if count < 1 || count > IntroMax || !utf8.ValidString(intro) {
		return intro, false
	}
	for _, r := range intro {
		if r != '\n' && unicode.IsControl(r) {
			return intro, false
		}
	}
	return intro, true
}

// CanApprove: 会长, 管理层 and 优秀会员 handle applications.
func CanApprove(grade int) bool { return grade >= GradeMaster && grade <= GradeFirst }

// CanManage: 会长 and 管理层 edit the introduction, auto join and the
// 总部 / 车手中心 ("俱乐部管理层以上职位可使用").
func CanManage(grade int) bool { return grade == GradeMaster || grade == GradeManager }

// CanKick reports whether a grade may remove a member of another grade:
// only the 会长 removes managers ("只有会长可以将管理层踢除俱乐部").
func CanKick(grade, target int) bool {
	switch {
	case target == GradeMaster:
		return false
	case grade == GradeMaster:
		return true
	case grade == GradeManager:
		return target == GradeFirst || target == GradeMember
	}
	return false
}

// FacilityManagers reports whether a grade may upgrade a facility.
func FacilityManagers(facility, grade int) bool {
	return CanManage(grade) && facility >= 0 && facility < Facilities
}
