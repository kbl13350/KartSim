package api

import (
	"cmp"
	"context"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
)

// The admin console's account pages: the account list and detail, edits,
// kicks, inventories and login records (ADMIN.md 3 and 4).

const (
	maxBanReason = 200
	// maxBannedUntil is the latest ban end accepted (9999-12-31).
	maxBannedUntil = 253_402_300_799_999
	// detailRows is how many logins and races the account detail lists.
	detailRows = 20
)

var (
	errCannotModifySelf = apierr.New(http.StatusConflict, "CANNOT_MODIFY_SELF")
	// errProtectedAdmin refuses another admin's edit or kick of a
	// KART_ADMIN_USERNAMES account: only the account itself changes it.
	errProtectedAdmin = apierr.New(http.StatusConflict, "PROTECTED_ADMIN")
)

// adminOnlineJSON is where an account plays. Leaving is set while a game
// node still lists a session that a kick, a ban or a newer login ended: the
// node drops it at its next heartbeat.
type adminOnlineJSON struct {
	NodeID   string `json:"nodeId"`
	NodeName string `json:"nodeName"`
	Leaving  bool   `json:"leaving"`
}

// accountRowJSON is the AccountRow of ADMIN.md 4.
type accountRowJSON struct {
	ID             string           `json:"id"`
	Username       string           `json:"username"`
	Nickname       string           `json:"nickname"`
	Admin          bool             `json:"admin"`
	CreatedAt      int64            `json:"createdAt"`
	RegisterIP     string           `json:"registerIp"`
	LastLoginAt    *int64           `json:"lastLoginAt"`
	LastLoginIP    string           `json:"lastLoginIp"`
	LastSeenAt     *int64           `json:"lastSeenAt"`
	LastSeenIP     string           `json:"lastSeenIp"`
	BannedUntil    *int64           `json:"bannedUntil"`
	BanReason      string           `json:"banReason"`
	Banned         bool             `json:"banned"`
	Level          int              `json:"level"`
	Exp            int64            `json:"exp"`
	Coupon         int64            `json:"coupon"`
	Lucci          int64            `json:"lucci"`
	Koin           int64            `json:"koin"`
	InventoryCount int              `json:"inventoryCount"`
	Onboarded      bool             `json:"onboarded"`
	Online         *adminOnlineJSON `json:"online"`
}

// nonZero is nil for 0 (no time) and the value otherwise.
func nonZero(value int64) *int64 {
	if value == 0 {
		return nil
	}
	return &value
}

// accountRows renders accounts with where each plays (online is null for
// all when the cluster registry is unavailable).
func (a *API) accountRows(ctx context.Context, rows []store.AdminAccountRow, now int64) []accountRowJSON {
	ids := make([]string, len(rows))
	for i, row := range rows {
		ids[i] = row.Account.ID
	}
	online := a.accountPresence(ctx, ids)
	list := make([]accountRowJSON, len(rows))
	for i, row := range rows {
		account := a.withAdmin(row.Account)
		list[i] = accountRowJSON{
			ID: account.ID, Username: account.Username, Nickname: account.Nickname, Admin: account.Admin,
			CreatedAt: row.CreatedAt, RegisterIP: row.RegisterIP, LastLoginAt: nonZero(row.LastLoginAt),
			LastLoginIP: row.LastLoginIP, LastSeenAt: nonZero(row.LastSeenAt), LastSeenIP: row.LastSeenIP,
			BannedUntil: nonZero(row.BannedUntil), BanReason: row.BanReason,
			Banned: row.BannedUntil > now, Level: a.economy.Levels.LevelForExp(row.Exp).Level, Exp: row.Exp,
			Coupon: row.Wallet.Coupon, Lucci: row.Wallet.Lucci, Koin: row.Wallet.Koin,
			InventoryCount: row.InventoryCount, Onboarded: row.Onboarded, Online: online[account.ID],
		}
	}
	return list
}

// accountPresence maps the accounts among ids that play on a game node to
// that node: the node holding the account's presence, or, for an account
// whose presence a kick, a ban or a newer login ended while a node still
// lists its old session, that node with leaving set. nil when the cluster
// registry is unavailable.
func (a *API) accountPresence(ctx context.Context, ids []string) map[string]*adminOnlineJSON {
	if a.cluster == nil || len(ids) == 0 {
		return nil
	}
	nodes, err := a.cluster.AccountNodes(ctx, ids)
	if err != nil {
		a.log.Warn("admin: account presence unavailable", "error", err)
		return nil
	}
	wanted := map[string]bool{}
	for _, id := range ids {
		if nodes[id] == "" {
			wanted[id] = true
		}
	}
	online := map[string]*adminOnlineJSON{}
	live, ok := a.onlineNodes(ctx)
	names := map[string]string{}
	for _, node := range live {
		names[node.Node.NodeID] = node.Node.Name
		for _, player := range node.Players {
			// Listed but no longer holding the account: being dropped.
			if id := playerAccount(node, player); wanted[id] && online[id] == nil {
				online[id] = &adminOnlineJSON{NodeID: node.Node.NodeID, NodeName: node.Node.Name, Leaving: true}
			}
		}
	}
	if !ok {
		names = nil
	}
	for id, node := range nodes {
		online[id] = &adminOnlineJSON{NodeID: node, NodeName: cmp.Or(names[node], node)}
	}
	if len(online) == 0 {
		return nil
	}
	return online
}

// playerAccount is the account a listed player claimed ("" for guests):
// the heartbeat's own (newer nodes), else the node's claim map.
func playerAccount(node cache.NodeOnline, player contract.OnlinePlayer) string {
	return cmp.Or(player.AccountID, node.Accounts[player.PlayerID])
}

// liveOnline reads the live nodes' players with whether each account
// player still holds its account (false: a kick, a ban or a newer login
// ended the session, and the node drops it at its next heartbeat). ok is
// false when the cluster registry is unavailable.
func (a *API) liveOnline(ctx context.Context) (nodes []cache.NodeOnline, leaving map[string]bool, ok bool) {
	nodes, ok = a.onlineNodes(ctx)
	if !ok {
		return nil, nil, false
	}
	var ids []string
	for _, node := range nodes {
		for _, player := range node.Players {
			if id := playerAccount(node, player); id != "" {
				ids = append(ids, id)
			}
		}
	}
	claims, err := a.cluster.AccountClaims(ctx, ids)
	if err != nil {
		a.log.Warn("admin: account presence unavailable", "error", err)
		return nodes, nil, true
	}
	leaving = map[string]bool{}
	for _, node := range nodes {
		for _, player := range node.Players {
			id := playerAccount(node, player)
			if id != "" && claims[id] != cache.PresenceValue(node.Node.NodeID, player.PlayerID) {
				leaving[node.Node.NodeID+"|"+player.PlayerID] = true
			}
		}
	}
	return nodes, leaving, true
}

// protectedAdmin reports whether an account is named in
// KART_ADMIN_USERNAMES: only the account itself may edit it.
func (a *API) protectedAdmin(account store.Account) bool {
	return a.admins[strings.ToLower(account.Username)]
}

// adminAccountNames are the KART_ADMIN_USERNAMES.
func (a *API) adminAccountNames() []string {
	names := make([]string, 0, len(a.admins))
	for name := range a.admins {
		names = append(names, name)
	}
	slices.Sort(names)
	return names
}

// adminMe confirms the console's session: {id, username, nickname}.
func (a *API) adminMe(w http.ResponseWriter, r *http.Request) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, map[string]string{"id": admin.ID, "username": admin.Username,
		"nickname": admin.Nickname})
}

// adminAccounts lists accounts: q matches the username, nickname and the
// register, latest login and latest activity addresses, from/to bound the
// registration time; online=1, banned=1 and admin=1 filter. Without the
// cluster registry, online=1 lists nothing.
func (a *API) adminAccounts(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "createdAt", "lastLoginAt", "lastSeenAt", "level", "coupon", "lucci", "koin")
	if err != nil {
		return err
	}
	var filter store.AccountFilter
	online, err := flagParam(r, "online")
	if err != nil {
		return err
	}
	if filter.Banned, err = flagParam(r, "banned"); err != nil {
		return err
	}
	if filter.Admin, err = flagParam(r, "admin"); err != nil {
		return err
	}
	filter.AdminNames = a.adminAccountNames()
	ctx := r.Context()
	if online {
		filter.IDs = a.onlineAccountIDs(ctx)
	}
	now := a.nowMillis()
	rows, total, err := a.store.AdminAccounts(ctx, list.AdminPage, filter, now)
	if err != nil {
		return err
	}
	return answerList(w, list, a.accountRows(ctx, rows, now), total)
}

// onlineAccountIDs are the accounts playing on a live game node (empty
// without the cluster registry).
func (a *API) onlineAccountIDs(ctx context.Context) []string {
	ids := []string{}
	if a.cluster == nil {
		return ids
	}
	nodes, err := a.cluster.Online(ctx)
	if err != nil {
		a.log.Warn("admin: online list unavailable", "error", err)
		return ids
	}
	var claimed []string
	for _, node := range nodes {
		for _, account := range node.Accounts {
			claimed = append(claimed, account)
		}
		for _, player := range node.Players {
			if player.AccountID != "" {
				claimed = append(claimed, player.AccountID)
			}
		}
	}
	slices.Sort(claimed)
	claimed = slices.Compact(claimed)
	// Only accounts whose presence is still theirs (not kicked or replaced).
	live, err := a.cluster.AccountNodes(ctx, claimed)
	if err != nil {
		a.log.Warn("admin: account presence unavailable", "error", err)
		return ids
	}
	for id := range live {
		ids = append(ids, id)
	}
	slices.Sort(ids)
	return ids
}

// loginRowJSON is the LoginRow of ADMIN.md 4.
type loginRowJSON struct {
	ID        int64  `json:"id"`
	At        int64  `json:"at"`
	Kind      string `json:"kind"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	Nickname  string `json:"nickname"`
	IP        string `json:"ip"`
	UserAgent string `json:"userAgent"`
}

func loginRows(rows []store.LoginRow) []loginRowJSON {
	list := make([]loginRowJSON, len(rows))
	for i, row := range rows {
		list[i] = loginRowJSON{ID: row.ID, At: row.At, Kind: row.Kind, AccountID: row.AccountID,
			Username: row.Username, Nickname: row.Nickname, IP: row.IP, UserAgent: row.UserAgent}
	}
	return list
}

// raceParticipantJSON is the RaceParticipantRow of ADMIN.md 4, with the
// track's title and the exp and lucci the race credited (null for guests
// and racers it credited nothing).
type raceParticipantJSON struct {
	RaceID    string `json:"raceId"`
	At        int64  `json:"at"`
	Gameplay  string `json:"gameplay"`
	TrackID   string `json:"trackId"`
	TrackName string `json:"trackName"`
	Rank      int    `json:"rank"`
	Name      string `json:"name"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	ElapsedMs *int64 `json:"elapsedMs"`
	Points    int    `json:"points"`
	Exp       *int64 `json:"exp"`
	Lucci     *int64 `json:"lucci"`
}

func (a *API) raceParticipants(rows []store.RaceParticipant) []raceParticipantJSON {
	list := make([]raceParticipantJSON, len(rows))
	for i, p := range rows {
		list[i] = raceParticipantJSON{RaceID: p.RaceID, At: p.At, Gameplay: p.Gameplay, TrackID: p.TrackID,
			TrackName: a.trackName(p.TrackID), Rank: p.Rank, Name: p.Name, AccountID: p.AccountID,
			Username: p.Username, ElapsedMs: p.ElapsedMs, Points: p.Points, Exp: p.Exp, Lucci: p.Lucci}
	}
	return list
}

// adminAccountTarget loads the account of the {id} path value.
func (a *API) adminAccountTarget(r *http.Request, now int64) (store.AdminAccountRow, error) {
	id := r.PathValue("id")
	if !validASCIIID(id, 36) {
		return store.AdminAccountRow{}, errUnknownTarget
	}
	row, found, err := a.store.AdminAccount(r.Context(), id, now)
	if err != nil {
		return store.AdminAccountRow{}, err
	}
	if !found {
		return store.AdminAccountRow{}, errUnknownTarget
	}
	return row, nil
}

// adminAccountDetail is one account with its club, live session count and
// latest 20 logins and races.
func (a *API) adminAccountDetail(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	now := a.nowMillis()
	row, err := a.adminAccountTarget(r, now)
	if err != nil {
		return err
	}
	ctx := r.Context()
	id := row.Account.ID
	type clubJSON struct {
		ID    int64  `json:"id"`
		Name  string `json:"name"`
		Grade int    `json:"grade"`
	}
	var club *clubJSON
	brief, grade, err := a.store.ClubOf(ctx, id, now)
	if err != nil {
		return err
	}
	if brief.ID != 0 {
		club = &clubJSON{ID: brief.ID, Name: brief.Name, Grade: grade}
	}
	sessions, err := a.store.SessionCount(ctx, id, now)
	if err != nil {
		return err
	}
	logins, _, err := a.store.AdminLogins(ctx, store.AdminPage{Limit: detailRows, Sort: "at", Desc: true},
		store.LoginFilter{AccountID: id})
	if err != nil {
		return err
	}
	races, err := a.store.AccountRaces(ctx, id, detailRows)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, struct {
		Account  accountRowJSON        `json:"account"`
		Club     *clubJSON             `json:"club"`
		Sessions int                   `json:"sessions"`
		Logins   []loginRowJSON        `json:"logins"`
		Races    []raceParticipantJSON `json:"races"`
	}{a.accountRows(ctx, []store.AdminAccountRow{row}, now)[0], club, sessions, loginRows(logins),
		a.raceParticipants(races)})
}

// adminPatchAccount edits an account ({nickname?, admin?, bannedUntil?,
// banReason?, password?}) and answers its AccountRow. The nickname follows
// the registration rules and must be free (409 NICKNAME_TAKEN), the
// password the registration length; bad values are 400
// INVALID_ACCOUNT_FIELDS. An admin cannot take its own admin flag or ban
// itself (409 CANNOT_MODIFY_SELF); a KART_ADMIN_USERNAMES account stays an
// admin whatever its stored flag, and only it may edit itself (409
// PROTECTED_ADMIN for other admins). bannedUntil is Unix ms (0 lifts the
// ban, and so does a time already past; lifting it clears the reason
// unless the request gives a new one: the stored reason sent back counts
// as none). Banning or setting a password signs the account out
// everywhere (adminEndSessions).
func (a *API) adminPatchAccount(w http.ResponseWriter, r *http.Request) error {
	var request struct {
		Nickname    *string `json:"nickname"`
		Admin       *bool   `json:"admin"`
		BannedUntil *int64  `json:"bannedUntil"`
		BanReason   *string `json:"banReason"`
		Password    *string `json:"password"`
	}
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	now := a.nowMillis()
	if request.Nickname != nil && !validName(request.Nickname, 16) {
		return errInvalidAccountField
	}
	if request.Password != nil && (utf16Len(*request.Password) < minPasswordLength ||
		utf16Len(*request.Password) > maxPasswordLength) {
		return errInvalidAccountField
	}
	if request.BanReason != nil {
		reason := strings.TrimSpace(*request.BanReason)
		if utf8.RuneCountInString(reason) > maxBanReason || (reason != "" && !validText(reason, maxBanReason)) {
			return errInvalidAccountField
		}
		request.BanReason = &reason
	}
	banning := false
	if until := request.BannedUntil; until != nil {
		if *until < 0 || *until > maxBannedUntil {
			return errInvalidAccountField
		}
		if *until <= now {
			*until = 0
		}
		banning = *until > 0
	}
	target, err := a.adminAccountTarget(r, now)
	if err != nil {
		return err
	}
	if target.Account.ID == admin.ID && ((request.Admin != nil && !*request.Admin) || banning) {
		return errCannotModifySelf
	}
	if target.Account.ID != admin.ID && a.protectedAdmin(target.Account) {
		return errProtectedAdmin
	}
	if request.BannedUntil != nil && *request.BannedUntil == 0 &&
		(request.BanReason == nil || *request.BanReason == target.BanReason) {
		request.BanReason = new(string) // lifting the ban clears its reason
	}
	patch := store.AccountPatch{Nickname: request.Nickname, Admin: request.Admin, BannedUntil: request.BannedUntil,
		BanReason: request.BanReason}
	ctx := r.Context()
	if request.Password != nil {
		var hash string
		if busy := withPasswordSlot(ctx, func() { hash, err = hashPassword(*request.Password) }); busy != nil {
			return busy
		}
		if err != nil {
			return err
		}
		patch.PasswordHash = &hash
	}
	before, ended, err := a.store.AdminUpdateAccount(ctx, target.Account.ID, patch, now)
	if err != nil {
		return err
	}
	a.cache.Invalidate(ctx, "account:"+before.ID)
	if request.Nickname != nil && *request.Nickname != before.Nickname {
		a.messengerRenamed(ctx, before.ID)
	}
	game := false
	if banning || request.Password != nil {
		// The game session still plays under the name it had.
		game = a.adminEndSessions(ctx, before, ended)
	}
	changes := []any{"admin", admin.Username, "account", before.Username}
	if request.Nickname != nil {
		changes = append(changes, "nickname", *request.Nickname)
	}
	if request.Admin != nil {
		changes = append(changes, "adminFlag", *request.Admin)
	}
	if request.BannedUntil != nil {
		changes = append(changes, "bannedUntil", *request.BannedUntil)
	}
	if request.BanReason != nil {
		changes = append(changes, "banReason", *request.BanReason)
	}
	if request.Password != nil {
		changes = append(changes, "password", "reset")
	}
	a.log.Info("admin account update", append(changes, "sessionsEnded", len(ended), "gameSession", game)...)
	row, err := a.adminAccountTarget(r, now)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, a.accountRows(ctx, []store.AdminAccountRow{row}, now)[0])
}

// adminEndSessions signs an account out everywhere for an admin (a kick,
// a ban, a new password): the deleted sessions' tokens answer
// LOGIN_REQUIRED, their messenger and My Room sockets close, and the game
// node serving the account drops it at its next heartbeat. It reports
// whether a live game session was told to end.
func (a *API) adminEndSessions(ctx context.Context, account store.Account, ended []string) bool {
	a.closeSessions(ctx, ended)
	return a.endGameSession(ctx, account)
}

// adminKick signs an account out everywhere: {sessions: how many ended,
// game: whether a live game session was told to end}. An admin cannot
// kick itself (409 CANNOT_MODIFY_SELF): its console session would end; nor
// a KART_ADMIN_USERNAMES account (409 PROTECTED_ADMIN).
func (a *API) adminKick(w http.ResponseWriter, r *http.Request) error {
	admin, err := a.requireAdmin(r)
	if err != nil {
		return err
	}
	target, err := a.adminAccountTarget(r, a.nowMillis())
	if err != nil {
		return err
	}
	if target.Account.ID == admin.ID {
		return errCannotModifySelf
	}
	if a.protectedAdmin(target.Account) {
		return errProtectedAdmin
	}
	ctx := r.Context()
	ended, err := a.store.RevokeSessions(ctx, target.Account.ID)
	if err != nil {
		return err
	}
	game := a.adminEndSessions(ctx, target.Account, ended)
	a.log.Info("admin kick", "admin", admin.Username, "account", target.Account.Username, "sessions", len(ended),
		"gameSession", game)
	return writeJSON(w, http.StatusOK, map[string]any{"sessions": len(ended), "game": game})
}

// inventoryRowJSON is the InventoryRow of ADMIN.md 4.
type inventoryRowJSON struct {
	ID           int64  `json:"id"`
	Category     int    `json:"category"`
	CategoryName string `json:"categoryName"`
	ItemID       int    `json:"itemId"`
	Name         string `json:"name"`
	SystemKey    string `json:"systemKey"`
	Quantity     int    `json:"quantity"`
	ExpiresAt    *int64 `json:"expiresAt"`
	Source       string `json:"source"`
	CreatedAt    int64  `json:"createdAt"`
	UpdatedAt    int64  `json:"updatedAt"`
}

// adminInventory lists an account's inventory rows, expired and used-up
// ones too: ?category= keeps one category, q matches the item name or id;
// from/to bound the last change. Sort keys: updatedAt (default), createdAt,
// expiresAt, category, quantity.
func (a *API) adminInventory(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "updatedAt", "createdAt", "expiresAt", "category", "quantity")
	if err != nil {
		return err
	}
	category := -1
	if text := r.URL.Query().Get("category"); text != "" {
		if category, err = strconv.Atoi(text); err != nil || category < 0 {
			return errInvalidQuery
		}
	}
	target, err := a.adminAccountTarget(r, a.nowMillis())
	if err != nil {
		return err
	}
	rows, err := a.store.AdminInventory(r.Context(), target.Account.ID)
	if err != nil {
		return err
	}
	query := strings.ToLower(list.Query)
	items := []inventoryRowJSON{}
	for _, row := range rows {
		item := inventoryRowJSON{ID: row.ID, Category: row.Category, CategoryName: categoryName(row.Category),
			ItemID: row.ItemID, Name: a.itemName(row.Category, row.ItemID, row.SystemKey), SystemKey: row.SystemKey,
			Quantity: row.Quantity, ExpiresAt: row.ExpiresAt, Source: row.Source, CreatedAt: row.CreatedAt,
			UpdatedAt: row.UpdatedAt}
		if (category >= 0 && row.Category != category) ||
			(query != "" && !strings.Contains(strings.ToLower(item.Name), query) &&
				!strings.Contains(strconv.Itoa(row.ItemID), query)) ||
			(list.From != nil && row.UpdatedAt < *list.From) || (list.To != nil && row.UpdatedAt > *list.To) {
			continue
		}
		items = append(items, item)
	}
	key := func(item inventoryRowJSON) int64 {
		switch list.Sort {
		case "createdAt":
			return item.CreatedAt
		case "expiresAt":
			if item.ExpiresAt == nil {
				return maxBannedUntil // permanent items last
			}
			return *item.ExpiresAt
		case "category":
			return int64(item.Category)
		case "quantity":
			return int64(item.Quantity)
		}
		return item.UpdatedAt
	}
	slices.SortStableFunc(items, func(x, y inventoryRowJSON) int {
		order := cmp.Or(cmp.Compare(key(x), key(y)), cmp.Compare(x.ID, y.ID))
		if list.Desc {
			return -order
		}
		return order
	})
	total := len(items)
	items = items[min(list.Offset, total):min(list.Offset+list.Limit, total)]
	return answerList(w, list, items, total)
}

// adminLogins lists register, login and resume records:
// ?kind=register|login|resume, account= (id or username), ip= (exact); q
// matches the username, nickname and address; from/to bound the time.
func (a *API) adminLogins(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, false, "at")
	if err != nil {
		return err
	}
	var filter store.LoginFilter
	if filter.Kind, err = oneOfParam(r, "kind", store.LoginKindRegister, store.LoginKindLogin,
		store.LoginKindResume); err != nil {
		return err
	}
	if filter.IP, err = tokenParam(r, "ip", 45); err != nil {
		return err
	}
	var matched bool
	if filter.AccountID, matched, err = a.accountParam(r.Context(), r); err != nil {
		return err
	} else if !matched {
		return emptyList[loginRowJSON](w, list)
	}
	rows, total, err := a.store.AdminLogins(r.Context(), list.AdminPage, filter)
	if err != nil {
		return err
	}
	return answerList(w, list, loginRows(rows), total)
}
