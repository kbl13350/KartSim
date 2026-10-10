package api

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"kartsim/internal/data/lottery"
	"kartsim/internal/data/store"
)

// Names the admin console shows for items, categories, lotteries and the
// stored draw and box results.

// itemName is an item's CN name: the original item table's (item.kml, as
// the lottery data exports it), else the shop catalog's, else the free
// practice kart's for its system key; "" when none knows it.
func (a *API) itemName(category, itemID int, systemKey string) string {
	if name := a.lottery.ItemName(lottery.ItemKey{Category: category, ItemID: itemID}, nil); name != "" {
		return name
	}
	if item, ok := a.economy.Catalog.ItemByKey(category, itemID); ok {
		return item.Name
	}
	if kart := a.economy.Catalog.Starter.Kart; systemKey != "" && kart.Category == category &&
		kart.ItemID == itemID && kart.SystemKey == systemKey {
		return kart.Name
	}
	return ""
}

// itemCategoryNames label the inventory categories, after the 我的物品
// tabs (dialog.rho/garageDialog/atMyRoom@cn.bml) and the item table's kinds.
var itemCategoryNames = map[int]string{
	1: "角色", 2: "喷漆", 3: "赛车", 4: "车牌", 6: "临时驾照", 7: "道具卡", 8: "护目镜", 9: "气球",
	10: "房间道具", 11: "头饰", 12: "回放摄像机", 13: "回放观赏券", 14: "升级工具", 15: "特殊道具", 16: "手部装备",
	18: "服装", 19: "属性卡", 20: "贴花", 21: "宠物", 22: "车牌编辑卡", 23: "实用道具", 24: "宝箱与抽奖",
	25: "钥匙", 26: "光环", 27: "轮胎印", 28: "小屋背景", 29: "金币卡", 30: "必杀技", 31: "车手颜色", 32: "加成卡",
	33: "印章", 34: "寻宝材料", 35: "兑换券", 36: "攻击力卡片", 37: "改装魔方", 38: "粒子激活器", 39: "重置扳手",
	40: "猜拳", 41: "喇叭", 43: "改装部件", 44: "方向盘", 45: "车轮", 46: "神秘部件", 47: "兑换券", 48: "钥匙",
	49: "改装保护锁", 50: "兑换券", 51: "幸运币卡", 52: "飞行宠物", 53: "扳手", 56: "酷币", 57: "酷币卡",
	58: "道具皮肤卡", 59: "鱼竿", 60: "鱼", 61: "仪表盘", 62: "点券", 63: "强化部件", 64: "强化部件",
	65: "强化部件", 66: "强化部件", 67: "部件碎片", 68: "车膜", 69: "车灯", 70: "染色", 71: "车手栏背景",
	72: "强化部件", 73: "强化部件", 74: "强化部件", 75: "强化部件", 76: "车膜", 77: "车灯", 78: "加速器特效",
	79: "研究零件",
}

// categoryName labels an item category ("类别 N" when unknown).
func categoryName(category int) string {
	if name, ok := itemCategoryNames[category]; ok {
		return name
	}
	return "类别 " + strconv.Itoa(category)
}

// trackName is a track's CN title from the track table ("" when unknown).
func (a *API) trackName(id string) string {
	if a.trackTitles == nil {
		return ""
	}
	return a.trackTitles[id]
}

// lotteryName is the CN name of a lottery item (category 24).
func (a *API) lotteryName(itemID int) string {
	if name := a.itemName(lottery.Category, itemID, ""); name != "" {
		return name
	}
	if l, ok := a.lottery.Lottery(itemID); ok {
		return l.Name
	}
	return "宝箱 " + strconv.Itoa(itemID)
}

// gotItem is one item of a result summary.
type gotItem struct {
	name        string
	count, days int
}

// summarizeItems joins items into "宝宝、粉色气球（30天）×2" (a count only
// above 1, the days of rentals), adding equal entries up.
func summarizeItems(items []gotItem) string {
	type key struct {
		name string
		days int
	}
	var order []key
	counts := map[key]int{}
	for _, item := range items {
		k := key{item.name, item.days}
		if _, seen := counts[k]; !seen {
			order = append(order, k)
		}
		counts[k] += max(item.count, 1)
	}
	parts := make([]string, len(order))
	for i, k := range order {
		part := k.name
		if k.days > 0 {
			part += fmt.Sprintf("（%d天）", k.days)
		}
		if counts[k] > 1 {
			part += fmt.Sprintf("×%d", counts[k])
		}
		parts[i] = part
	}
	if len(parts) == 0 {
		return "没有获得物品"
	}
	return strings.Join(parts, "、")
}

// named fills in an item's name from the tables when the stored one is empty.
func (a *API) named(name string, category, itemID int) string {
	if name != "" {
		return name
	}
	if name = a.itemName(category, itemID, ""); name != "" {
		return name
	}
	return fmt.Sprintf("%s %d", categoryName(category), itemID)
}

// drawSummary describes a stored draw request: "寻宝 10 次：…" or
// "精品道具场「…」3 次：…", with the 保底 rewards (the 寻宝 draws that pity
// forced, and the 精品道具场 mileage prizes) and why it stopped early.
// result is the parsed result (nil when the JSON is unreadable).
func (a *API) drawSummary(row store.LotteryDrawRow) (string, any) {
	var result store.DrawResult
	if json.Unmarshal([]byte(row.Result), &result) != nil {
		return "结果无法读取", nil
	}
	var items, pity []gotItem
	for _, draw := range result.Draws {
		for _, item := range draw.Items {
			got := gotItem{a.named(item.Name, item.Category, item.ItemID), item.Count, item.Days}
			if draw.Pity {
				pity = append(pity, got)
			} else {
				items = append(items, got)
			}
		}
	}
	title := "寻宝"
	if row.Kind == store.DrawGacha {
		title = "精品道具场「" + a.lotteryName(row.Ref) + "」"
	}
	summary := fmt.Sprintf("%s %d 次：%s", title, len(result.Draws), summarizeItems(items))
	if len(items) == 0 && len(pity) > 0 {
		summary = fmt.Sprintf("%s %d 次", title, len(result.Draws))
	}
	for _, prize := range result.Prizes {
		for _, item := range prize.Items {
			pity = append(pity, gotItem{a.named(item.Name, item.Category, item.ItemID), item.Count, item.Days})
		}
	}
	if len(pity) > 0 {
		summary += "；保底奖励：" + summarizeItems(pity)
	}
	if result.Stopped != nil {
		reason, known := map[string]string{store.StopInsufficient: "材料不足", store.StopOwned: "抽到已永久拥有的物品",
			store.StopEmpty: "没有可抽的物品"}[result.Stopped.Code]
		if !known {
			reason = result.Stopped.Code
		}
		summary += "；提前停止（" + reason + "）"
	}
	return summary, json.RawMessage(row.Result)
}

// boxSummary describes a stored box opening: "开启 迷你宝箱：…".
func (a *API) boxSummary(row store.BoxOpeningRow) (string, any) {
	var result store.BoxOpening
	if json.Unmarshal([]byte(row.Result), &result) != nil {
		return "结果无法读取", nil
	}
	items := make([]gotItem, 0, len(result.Rewards))
	for _, reward := range result.Rewards {
		items = append(items, gotItem{a.named(reward.Name, reward.Category, reward.ItemID), reward.Count, reward.Days})
	}
	return "开启 " + a.lotteryName(row.BoxID) + "：" + summarizeItems(items), json.RawMessage(row.Result)
}
