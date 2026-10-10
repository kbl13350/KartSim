package api

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"kartsim/internal/data/economy"
	"kartsim/internal/data/messenger"
	"kartsim/internal/data/quest"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
)

// The taskbar menus besides the club: 奖励箱 (MENUS.md 1), 任务
// (MENUS.md 2), 迷你提示窗 notices (MENUS.md 3) and the 查找车手 rider card.

var (
	errInvalidBoxClaim   = apierr.New(http.StatusBadRequest, "INVALID_CLAIM")
	errInvalidBoxGift    = apierr.New(http.StatusBadRequest, "INVALID_GIFT")
	errInvalidNotice     = apierr.New(http.StatusBadRequest, "INVALID_NOTICE")
	errInvalidNoticeID   = apierr.New(http.StatusBadRequest, "INVALID_NOTICE_ID")
	errInvalidRiderQuery = apierr.New(http.StatusBadRequest, "INVALID_NICKNAME")
)

// Notice limits (dialog2_noticer noticeTitle / noticeMsg).
const (
	maxNoticeTitle   = 40
	maxNoticeMessage = 400
	maxGiftCount     = 1_000_000
	maxGiftDays      = 3650
)

/* ---------- 奖励箱 ---------- */

func (a *API) rewardBox(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	entries, err := a.store.RewardBox(r.Context(), account.ID, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"entries": entries, "days": store.RewardBoxDays,
		"page": store.RewardBoxPage})
}

func (a *API) claimRewardBox(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		IDs []int64 `json:"ids"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	if len(request.IDs) == 0 || len(request.IDs) > store.RewardBoxPage {
		return errInvalidBoxClaim
	}
	ctx := r.Context()
	if err := a.accountWrite(ctx, account.ID); err != nil {
		return err
	}
	now := a.nowMillis()
	claim, err := a.store.ClaimRewardBox(ctx, a.lottery, account.ID, request.IDs, now)
	if err != nil {
		return err
	}
	entries, err := a.store.RewardBox(ctx, account.ID, now)
	if err != nil {
		return err
	}
	summary, err := a.summary(r, account)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"claim": claim, "entries": entries, "account": summary})
}

// adminRewardBox files a gift into a rider's 奖励箱 (an item of the item
// tables, or a currency amount).
func (a *API) adminRewardBox(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Username string `json:"username"`
		Category int    `json:"category"`
		ItemID   int    `json:"itemId"`
		Count    int    `json:"count"`
		Days     int    `json:"days"`
		Currency string `json:"currency"`
		Message  string `json:"message"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	if request.Count < 1 || request.Count > maxGiftCount || request.Days < 0 || request.Days > maxGiftDays ||
		utf8.RuneCountInString(request.Message) > 60 {
		return errInvalidBoxGift
	}
	entry := store.RewardBoxEntry{Source: store.BoxSourceAdmin, Message: strings.TrimSpace(request.Message),
		Count: request.Count}
	if entry.Message == "" {
		entry.Message = "管理员赠送"
	}
	if request.Currency != "" {
		currency := economy.Currency(request.Currency)
		if !currency.Valid() {
			return errInvalidBoxGift
		}
		entry.Currency = request.Currency
		entry.Name = map[economy.Currency]string{economy.Lucci: "金币", economy.Koin: "酷币",
			economy.Coupon: "点券"}[currency]
	} else {
		name := a.itemName(request.Category, request.ItemID, "")
		if name == "" {
			return errInvalidBoxGift
		}
		entry.Category, entry.ItemID, entry.Days, entry.Name = request.Category, request.ItemID, request.Days, name
	}
	if !validUsername(&request.Username) {
		return errUnknownTarget
	}
	ctx := r.Context()
	accountID, found, err := a.store.AccountIDByUsername(ctx, request.Username)
	if err != nil {
		return err
	}
	if !found {
		return errUnknownTarget
	}
	if err := a.store.AddRewardBox(ctx, accountID, []store.RewardBoxEntry{entry}, a.nowMillis()); err != nil {
		return err
	}
	a.log.Info("admin reward box gift", "admin", admin.Username, "target", request.Username, "name", entry.Name,
		"count", entry.Count)
	return writeJSON(w, http.StatusOK, map[string]any{"ok": true, "entry": entry})
}

/* ---------- 任务 ---------- */

type questJSON struct {
	quest.Quest
	Value       int64 `json:"value"`
	CompletedAt int64 `json:"completedAt,omitempty"`
	Locked      bool  `json:"locked,omitempty"`
	PeriodStart int64 `json:"periodStart,omitempty"`
	PeriodEnd   int64 `json:"periodEnd,omitempty"`
}

func (a *API) quests(r *http.Request, accountID string) ([]questJSON, error) {
	now := a.nowMillis()
	states, err := a.store.Quests(r.Context(), accountID, now)
	if err != nil {
		return nil, err
	}
	done := map[int]bool{}
	for _, state := range states {
		done[state.ID] = state.CompletedAt != 0
	}
	rows := make([]questJSON, len(quest.All))
	for i, q := range quest.All {
		period := quest.PeriodOf(q.Reset, now)
		rows[i] = questJSON{Quest: q, Value: states[i].Value, CompletedAt: states[i].CompletedAt,
			Locked: q.Pre != 0 && !done[q.Pre], PeriodStart: period.Start, PeriodEnd: period.End}
	}
	return rows, nil
}

func (a *API) listQuests(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	rows, err := a.quests(r, account.ID)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"quests": rows, "resetHour": quest.ResetHour})
}

/* ---------- 迷你提示窗 ---------- */

type noticeJSON struct {
	Title   string `json:"title"`
	Message string `json:"message"`
	Kind    string `json:"kind"` // "notice", "quest" or "rewardBox"
}

// listNotices answers the current admin notices and the rider's reminders:
// completed quests (questInfo2 completeGetRewardMsg) and waiting rewards.
func (a *API) listNotices(w http.ResponseWriter, r *http.Request) error {
	account, err := a.signedIn(r)
	if err != nil {
		return err
	}
	ctx, now := r.Context(), a.nowMillis()
	notices := []noticeJSON{}
	count, err := a.store.RewardBoxCount(ctx, account.ID, now)
	if err != nil {
		return err
	}
	if count > 0 {
		notices = append(notices, noticeJSON{Title: "奖励箱", Kind: "rewardBox",
			Message: "奖励箱中有" + strconv.Itoa(count) + "个道具。|保管的道具在保管时间结束后将自动删除，请在到期前领取道具。"})
	}
	rows, err := a.quests(r, account.ID)
	if err != nil {
		return err
	}
	completed, open := []string{}, 0
	for _, row := range rows {
		switch {
		case row.CompletedAt != 0 && row.CompletedAt >= now-dayMillis:
			completed = append(completed, row.Mission)
		case row.CompletedAt == 0 && !row.Locked:
			open++
		}
	}
	if len(completed) > 0 {
		notices = append(notices, noticeJSON{Title: "您有已完成的任务。", Kind: "quest",
			Message: strings.Join(completed, "、") + "|任务已完成。请在奖励箱中确认奖励~！"})
	} else if open > 0 {
		notices = append(notices, noticeJSON{Title: "有正在进行的任务。", Kind: "quest",
			Message: "还有" + strconv.Itoa(open) + "个任务可以进行，|点击任务按钮查看详情。"})
	}
	admin, err := a.store.Notices(ctx, true, now)
	if err != nil {
		return err
	}
	for _, notice := range admin {
		notices = append(notices, noticeJSON{Title: notice.Title, Message: notice.Message, Kind: "notice"})
	}
	return writeJSON(w, http.StatusOK, map[string]any{"notices": notices, "rewardBox": count})
}

const dayMillis = 24 * 60 * 60 * 1000

func (a *API) adminNotices(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	notices, err := a.store.Notices(r.Context(), false, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"notices": notices})
}

func (a *API) adminSaveNotice(w http.ResponseWriter, r *http.Request) error {
	var request store.Notice
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	request.Title, request.Message = strings.TrimSpace(request.Title), strings.TrimSpace(request.Message)
	if !validText(request.Title, maxNoticeTitle) || utf8.RuneCountInString(request.Message) > maxNoticeMessage ||
		request.Message == "" || request.StartAt < 0 || request.EndAt < 0 ||
		(request.StartAt > 0 && request.EndAt > 0 && request.EndAt <= request.StartAt) || request.ID < 0 {
		return errInvalidNotice
	}
	request.UpdatedBy = admin.Username
	id, err := a.store.SaveNotice(r.Context(), request, a.nowMillis())
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"id": id})
}

func (a *API) adminDeleteNotice(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		return errInvalidNoticeID
	}
	if err := a.store.DeleteNotice(r.Context(), id); err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

/* ---------- 查找车手 ---------- */

// riderCard is dialog2_userInfo's 车手资料: level and glove, license, club,
// representative emblems, race statistics and where the rider is.
func (a *API) riderCard(w http.ResponseWriter, r *http.Request) error {
	viewer, err := a.signedIn(r)
	if err != nil {
		return err
	}
	nickname := strings.TrimSpace(r.PathValue("nickname"))
	if !validText(nickname, 64) {
		return errInvalidRiderQuery
	}
	ctx, now := r.Context(), a.nowMillis()
	card, found, err := a.store.RiderCardByNickname(ctx, nickname, now)
	if err != nil {
		return err
	}
	if !found {
		return errUnknownRider
	}
	inGame := false
	if a.cluster != nil {
		if games, err := a.cluster.AccountsInGame(ctx, []string{card.AccountID}); err == nil {
			inGame = games[card.AccountID]
		}
	}
	online := a.hub.Online([]string{card.AccountID})[card.AccountID]
	presence := messenger.PresenceOf(card.Invisible && card.AccountID != viewer.ID, inGame, online)
	progress := a.licensed(a.progress(card.Exp), card.License, card.ProUntil)
	body := map[string]any{"nickname": card.Nickname, "progress": progress, "createdAt": card.CreatedAt,
		"stats": card.Stats, "mainEmblems": card.MainEmblems, "presence": presence, "self": card.AccountID == viewer.ID}
	if card.Club != nil {
		body["club"] = map[string]any{"id": card.Club.ID, "name": card.Club.Name, "mark": card.Club.Mark,
			"frame": card.Club.Frame, "level": card.Club.Level, "grade": card.ClubGrade}
	}
	return writeJSON(w, http.StatusOK, body)
}
