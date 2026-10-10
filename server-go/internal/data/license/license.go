// Package license is the 驾照考试 (rider school) table: six licenses of
// mission steps, the reward stock of each step and the PRO qualification,
// exported from the release DataPack1 etc_/riderSchool files
// (client/tools/export-license-data.mjs). See server-go/RIDER_SCHOOL.md.
package license

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

//go:embed license.json
var embedded []byte

// License levels (baseStringBag licenseLevel1..6).
const (
	Beginner = 1 // 新手
	Rookie   = 2 // 初级
	L3       = 3
	L2       = 4
	L1       = 5
	Pro      = 6
)

// ProDays is how long a PRO license lasts (updateLevelText6: 有效期是90天).
const ProDays = 90

// StepsPerLicense is the steps of a license 新手 to L1; a PRO set has two.
const StepsPerLicense = 6

// Clear rules of a step (license.mjs).
const (
	// RuleTime: finish inside TimeMs (0: no limit).
	RuleTime = "time"
	// RuleRival: finish before the rival ghost's RivalMs.
	RuleRival = "rival"
	// RuleDrill: 行驶练习's four key prompts (向前/向后/右转/左转), which only the
	// client sees; no time limit.
	RuleDrill = "drill"
	// RuleItem: an item mission: finish inside TimeMs; its own objective
	// (the targets shot or trapped) only the client sees.
	RuleItem = "item"
	// RuleFinish: finish the course (the item missions with AI karts, which
	// the Web build does not run).
	RuleFinish = "finish"
)

// Rival is a duel step's opponent (outRun<step>@zz.xml).
type Rival struct {
	KartID      int    `json:"kartId"`
	CharacterID int    `json:"characterId"`
	Ksv         string `json:"ksv"`
}

// Step is one mission.
type Step struct {
	Step    int    `json:"step"`
	Mission int    `json:"mission"` // the release mission id (20 time trial, 21 duel…)
	Rule    string `json:"rule"`
	Name    string `json:"name"`
	Icon    string `json:"icon"` // riderSchool/<icon>_1…4 on the step card
	Track   string `json:"track"`
	Laps    int    `json:"laps"`  // 0: the track's own
	Speed   int    `json:"speed"` // gameSpeed, 7 标准
	TimeMs  int64  `json:"timeMs"`
	StockID int    `json:"stockId"`
	Rival   *Rival `json:"rival,omitempty"`
	RivalMs int64  `json:"rivalMs,omitempty"`
	// Setup is the release set-up the browser races the step with (items in
	// the slots, cube item, targets, HUD switches, the original limit); the
	// data service passes it through to GET /api/license.
	Setup json.RawMessage `json:"setup,omitempty"`
}

// License is one license and its steps in order.
type License struct {
	Level int    `json:"level"`
	Name  string `json:"name"`
	Steps []Step `json:"steps"`
}

// Qualify is one PRO qualification time trial (proCategory item).
type Qualify struct {
	Track  string `json:"track"`
	Speed  int    `json:"speed"`
	TimeMs int64  `json:"timeMs"`
}

// ProRules is the PRO qualification: an emblem for three time trials.
type ProRules struct {
	EmblemID int       `json:"emblemId"`
	Qualify  []Qualify `json:"qualify"`
}

// StockItem is one item of a reward stock.
type StockItem struct {
	Category int `json:"category"`
	ItemID   int `json:"itemId"`
	Count    int `json:"count"`
	Days     int `json:"days"`
}

// Stock is a reward stock (stock.kml).
type Stock struct {
	Name  string      `json:"name"`
	Items []StockItem `json:"items"`
}

// Data is the parsed table.
type Data struct {
	Version  string
	Licenses []License
	Pro      ProRules
	Stocks   map[int]Stock
	byStep   map[int]stepRef
}

type stepRef struct {
	license *License
	index   int
}

// Parse reads a license.json document.
func Parse(raw []byte) (*Data, error) {
	var doc struct {
		Version      string           `json:"version"`
		Licenses     []License        `json:"licenses"`
		Pro          ProRules         `json:"pro"`
		RewardStocks map[string]Stock `json:"rewardStocks"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("license.json: %w", err)
	}
	if doc.Version == "" || len(doc.Licenses) != Pro || doc.Pro.EmblemID <= 0 || len(doc.Pro.Qualify) == 0 {
		return nil, errors.New("license.json: missing version, licenses or PRO rules")
	}
	d := &Data{Version: doc.Version, Licenses: doc.Licenses, Pro: doc.Pro, Stocks: map[int]Stock{},
		byStep: map[int]stepRef{}}
	for key, stock := range doc.RewardStocks {
		var id int
		if _, err := fmt.Sscan(key, &id); err != nil || id <= 0 || len(stock.Items) == 0 {
			return nil, fmt.Errorf("license.json: reward stock %q", key)
		}
		d.Stocks[id] = stock
	}
	for i := range d.Licenses {
		l := &d.Licenses[i]
		pro := l.Level == Pro && len(l.Steps) >= 2 && len(l.Steps)%2 == 0
		if l.Level != i+1 || (l.Level != Pro && len(l.Steps) != StepsPerLicense) || (l.Level == Pro && !pro) {
			return nil, fmt.Errorf("license.json: license %d has %d steps", l.Level, len(l.Steps))
		}
		for j := range l.Steps {
			s := &l.Steps[j]
			_, seen := d.byStep[s.Step]
			bad := seen || s.Track == "" || len(d.Stocks[s.StockID].Items) == 0
			switch s.Rule {
			case RuleTime:
				bad = bad || s.TimeMs < 0
			case RuleItem:
				bad = bad || s.TimeMs <= 0
			case RuleRival:
				bad = bad || s.RivalMs <= 0 || s.Rival == nil
			case RuleDrill, RuleFinish:
			default:
				bad = true
			}
			if bad {
				return nil, fmt.Errorf("license.json: bad step %d", s.Step)
			}
			d.byStep[s.Step] = stepRef{license: l, index: j}
		}
	}
	return d, nil
}

var loadDefault = sync.OnceValues(func() (*Data, error) { return Parse(embedded) })

// Default returns the embedded table.
func Default() (*Data, error) { return loadDefault() }

// License returns a license by level 1-6.
func (d *Data) License(level int) (*License, bool) {
	if level < Beginner || level > len(d.Licenses) {
		return nil, false
	}
	return &d.Licenses[level-1], true
}

// Step returns a step, its license and its index in the license.
func (d *Data) Step(step int) (*Step, *License, int, bool) {
	ref, ok := d.byStep[step]
	if !ok {
		return nil, nil, 0, false
	}
	return &ref.license.Steps[ref.index], ref.license, ref.index, true
}

var beijing = time.FixedZone("UTC+8", 8*60*60)

// ProPeriod is the PRO mission period holding t: the missions reset on the
// 1st of every odd month (licenseProInfo1), Beijing time. Key names the
// period ("2026-09"), Index counts periods since year 0 and Ends is the
// next reset in Unix ms.
type ProPeriod struct {
	Key   string
	Index int
	Ends  int64
}

// ProPeriodAt returns the period of a Unix ms time.
func ProPeriodAt(now int64) ProPeriod {
	t := time.UnixMilli(now).In(beijing)
	month := int(t.Month()) - 1 // 0-based
	start := month - month%2
	begin := time.Date(t.Year(), time.Month(start+1), 1, 0, 0, 0, 0, beijing)
	return ProPeriod{Key: begin.Format("2006-01"), Index: (t.Year()*12 + start) / 2,
		Ends: begin.AddDate(0, 2, 0).UnixMilli()}
}

// ProSet returns the PRO steps of a period: the sets A-F (a time trial and
// a duel each) take turns, one per period.
func (d *Data) ProSet(period ProPeriod) []Step {
	steps := d.Licenses[Pro-1].Steps
	sets := len(steps) / 2
	index := period.Index % sets
	return steps[2*index : 2*index+2]
}

// InProSet reports whether a PRO step is one of a period's missions.
func (d *Data) InProSet(step int, period ProPeriod) bool {
	for _, s := range d.ProSet(period) {
		if s.Step == step {
			return true
		}
	}
	return false
}

// Qualifies reports whether best times (track -> ms) meet every PRO
// qualification time.
func (d *Data) Qualifies(bests map[string]int64) bool {
	for _, q := range d.Pro.Qualify {
		best, ok := bests[q.Track]
		if !ok || best > q.TimeMs {
			return false
		}
	}
	return true
}

// QualifyTrack returns a PRO qualification track by id.
func (d *Data) QualifyTrack(track string) (*Qualify, bool) {
	for i := range d.Pro.Qualify {
		if d.Pro.Qualify[i].Track == track {
			return &d.Pro.Qualify[i], true
		}
	}
	return nil, false
}

// Judge applies a step's clear rule to a finished run's time.
func (s *Step) Judge(elapsedMs int64) bool {
	switch s.Rule {
	case RuleTime:
		return s.TimeMs == 0 || elapsedMs <= s.TimeMs
	case RuleItem:
		return elapsedMs <= s.TimeMs
	case RuleRival:
		return elapsedMs < s.RivalMs
	}
	return true
}
