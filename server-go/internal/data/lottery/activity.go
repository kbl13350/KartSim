package lottery

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// Activities the admin can open, close and schedule (LOTTERY.md 5). Without
// a stored setting an activity is open: the original periods (treasureHunt
// 2026-07-16 ~ 08-13 and so on) are not enforced.
const (
	ActivityTreasureHunt = "treasureHunt" // the 寻宝 board
	ActivityGacha        = "gacha"        // the 精品道具场 as a whole
	lotteryPrefix        = "lottery:"     // one lottery item: "lottery:<itemId>"
)

// LotteryActivity names the activity of one lottery item.
func LotteryActivity(itemID int) string { return lotteryPrefix + strconv.Itoa(itemID) }

// ParseActivity checks an activity id: treasureHunt, gacha or lottery:<id>
// of a known lottery.
func (d *Data) ParseActivity(activity string) (lotteryItem int, err error) {
	switch {
	case activity == ActivityTreasureHunt || activity == ActivityGacha:
		return 0, nil
	case strings.HasPrefix(activity, lotteryPrefix):
		id, err := strconv.Atoi(strings.TrimPrefix(activity, lotteryPrefix))
		if err == nil && id > 0 && strconv.Itoa(id) == strings.TrimPrefix(activity, lotteryPrefix) {
			if _, ok := d.lotteries[id]; ok {
				return id, nil
			}
		}
	}
	return 0, fmt.Errorf("unknown activity %q", activity)
}

// DailyItemCount is the daily free count of each default material.
const DailyItemCount = 5

// Built-in daily free items of the 精品道具场: [活动]光明骑士幸运宝石 and the
// 幸运车胎 every use of it needs (the latest original [活动] gacha).
var defaultGachaDaily = []ItemKey{{Category, 1242}, {Category, 862}}

// DefaultDaily is an activity's built-in daily free items: for the treasure
// hunt its [活动] magnifier (or the regular one) and its map; for the
// 精品道具场 the latest [活动] gacha item and its key; nothing for a single
// lottery.
func (d *Data) DefaultDaily(activity string) []StockItem {
	var keys []ItemKey
	switch activity {
	case ActivityTreasureHunt:
		hunt := d.TreasureHunt()
		magnifier := hunt.EventMaterial
		if magnifier == 0 {
			magnifier = hunt.Material
		}
		keys = []ItemKey{{MaterialCategory, magnifier}, {MaterialCategory, hunt.OtherMaterial}}
	case ActivityGacha:
		keys = defaultGachaDaily
	}
	items := []StockItem{}
	for _, key := range keys {
		if _, ok := d.items[key]; ok {
			items = append(items, StockItem{Category: key.Category, ItemID: key.ItemID, Count: DailyItemCount})
		}
	}
	return items
}

// Daily item bounds an admin may set.
const (
	MaxDailyItems = 8
	MaxDailyCount = 1000
)

// ParseDaily decodes an admin's daily free item list: up to MaxDailyItems
// known items, counts 1..MaxDailyCount, days 0 (permanent) to 365.
func (d *Data) ParseDaily(raw string) ([]StockItem, error) {
	var items []StockItem
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return nil, err
	}
	if len(items) > MaxDailyItems {
		return nil, errors.New("too many daily items")
	}
	for _, item := range items {
		if _, ok := d.items[item.Key()]; !ok {
			return nil, fmt.Errorf("unknown item %s", item.Key())
		}
		if item.Count < 1 || item.Count > MaxDailyCount || item.Days < 0 || item.Days > 365 {
			return nil, fmt.Errorf("item %s: count %d days %d", item.Key(), item.Count, item.Days)
		}
	}
	if items == nil {
		items = []StockItem{}
	}
	return items, nil
}

// Setting is an activity's effective setting.
type Setting struct {
	Enabled bool
	Start   *int64 // Unix ms; nil: open-ended
	End     *int64
	Daily   []StockItem
	Custom  bool // an admin stored it
}

// Open reports whether the activity runs at now (Unix ms): enabled and
// within [Start, End).
func (s Setting) Open(now int64) bool {
	return s.Enabled && (s.Start == nil || now >= *s.Start) && (s.End == nil || now < *s.End)
}
