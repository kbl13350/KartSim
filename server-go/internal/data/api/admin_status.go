package api

import (
	"cmp"
	"context"
	"net/http"
	"runtime"
	"runtime/metrics"
	"slices"
	"strings"
	"sync"
	"time"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/buildinfo"
	"kartsim/internal/shared/contract"
)

// The admin console's status pages: the overview, the online players and
// the game nodes with the data service itself (ADMIN.md 3 and 4).

const (
	// nodeStaleAfter is when a node's last heartbeat counts as late: two
	// missed 5-second heartbeats. The registry drops a node after
	// cache.NodeTTL (15 s), so a later threshold could never be seen.
	nodeStaleAfter = 10 * time.Second
	// recentRows is how many registrations and logins the overview lists.
	recentRows = 10
	// pingTimeout bounds the status page's MySQL and Redis checks.
	pingTimeout = 2 * time.Second
)

var beijing = time.FixedZone("UTC+8", 8*60*60)

// beijingMidnight is the start of t's Beijing day, in Unix ms ("today" of
// the overview).
func beijingMidnight(t time.Time) int64 {
	year, month, day := t.In(beijing).Date()
	return time.Date(year, month, day, 0, 0, 0, 0, beijing).UnixMilli()
}

// nodeOffline is the status of a node seen within cache.NodeSeenTTL that
// is no longer registered (stopped, crashed or cut off).
const nodeOffline = "offline"

// nodeStatus is a registered node's state: ok, stale (late heartbeat) or
// full.
func nodeStatus(node cache.Node, now int64) string {
	switch {
	case now-node.SeenAt > nodeStaleAfter.Milliseconds():
		return "stale"
	case node.Full():
		return "full"
	}
	return "ok"
}

// adminOverview answers the overview's counts, with the latest 10
// registrations and logins. "Today" starts at the Beijing midnight. The
// online figures leave out sessions being dropped (leaving); nodes counts
// the registered nodes, the healthy ones and the offline ones (seen within
// a day). The online, nodes and rooms figures are null while the cluster
// registry is unavailable.
func (a *API) adminOverview(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	ctx := r.Context()
	clock := a.now()
	now := clock.UnixMilli()
	counts, err := a.store.AdminOverview(ctx, beijingMidnight(clock), now, a.adminAccountNames())
	if err != nil {
		return err
	}
	registrations, _, err := a.store.AdminAccounts(ctx, store.AdminPage{Limit: recentRows, Sort: "createdAt", Desc: true},
		store.AccountFilter{}, now)
	if err != nil {
		return err
	}
	logins, _, err := a.store.AdminLogins(ctx, store.AdminPage{Limit: recentRows, Sort: "at", Desc: true},
		store.LoginFilter{Kind: store.LoginKindLogin})
	if err != nil {
		return err
	}
	type onlineJSON struct {
		Players  int `json:"players"`
		Accounts int `json:"accounts"`
		Guests   int `json:"guests"`
	}
	type nodesJSON struct {
		Total   int `json:"total"`
		Healthy int `json:"healthy"`
		Offline int `json:"offline"`
	}
	var (
		online *onlineJSON
		nodes  *nodesJSON
		rooms  *int
	)
	if live, leaving, ok := a.liveOnline(ctx); ok {
		online, nodes, rooms = &onlineJSON{}, &nodesJSON{Total: len(live)}, new(int)
		for _, node := range live {
			for _, player := range node.Players {
				switch {
				case leaving[node.Node.NodeID+"|"+player.PlayerID]:
				case playerAccount(node, player) != "":
					online.Players++
					online.Accounts++
				default:
					online.Players++
					online.Guests++
				}
			}
			if nodeStatus(node.Node, now) != "stale" {
				nodes.Healthy++
			}
			*rooms += node.Node.Rooms
		}
		nodes.Offline = len(a.offlineNodes(ctx, live))
	}
	accounts := map[string]int{"total": counts.Accounts, "today": counts.AccountsToday, "admins": counts.Admins,
		"banned": counts.Banned}
	coupon := map[string]int64{"spentToday": counts.CouponSpentToday, "grantedToday": counts.CouponGrantedToday}
	// logins.today counts password logins; uniqueToday the accounts that
	// registered, logged in or resumed a remembered session today.
	return writeJSON(w, http.StatusOK, map[string]any{
		"now":                 now,
		"accounts":            accounts,
		"logins":              map[string]int{"today": counts.LoginsToday, "uniqueToday": counts.LoginAccountsToday},
		"online":              online,
		"nodes":               nodes,
		"rooms":               rooms,
		"races":               map[string]int{"today": counts.RacesToday},
		"coupon":              coupon,
		"recentRegistrations": a.accountRows(ctx, registrations, now),
		"recentLogins":        loginRows(logins),
	})
}

// onlineNodes reads the live nodes with their players; false when the
// cluster registry is unavailable.
func (a *API) onlineNodes(ctx context.Context) ([]cache.NodeOnline, bool) {
	if a.cluster == nil {
		return nil, false
	}
	nodes, err := a.cluster.Online(ctx)
	if err != nil {
		a.log.Warn("admin: online list unavailable", "error", err)
		return nil, false
	}
	return nodes, true
}

// onlineRowJSON is the OnlineRow of ADMIN.md 4, with the player's room;
// leaving marks an account session that a kick, a ban or a newer login
// ended and that its node drops at its next heartbeat.
type onlineRowJSON struct {
	PlayerID  string `json:"playerId"`
	Name      string `json:"name"`
	Guest     bool   `json:"guest"`
	AccountID string `json:"accountId"`
	Username  string `json:"username"`
	NodeID    string `json:"nodeId"`
	NodeName  string `json:"nodeName"`
	Room      string `json:"room"`
	Leaving   bool   `json:"leaving"`
}

// adminOnline lists the players of the live game nodes' latest heartbeats,
// sessions being dropped (leaving) included: q matches the name and
// username, ?node= keeps one node. Sort keys: name (default, ascending),
// username, node, room. Empty while the cluster registry is unavailable.
func (a *API) adminOnline(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	list, err := parseAdminList(r, true, "name", "username", "node", "room")
	if err != nil {
		return err
	}
	nodeFilter, err := tokenParam(r, "node", 64)
	if err != nil {
		return err
	}
	ctx := r.Context()
	nodes, leaving, _ := a.liveOnline(ctx)
	var ids []string
	for _, node := range nodes {
		for _, player := range node.Players {
			if id := playerAccount(node, player); id != "" {
				ids = append(ids, id)
			}
		}
	}
	accounts, err := a.store.AccountsByID(ctx, ids)
	if err != nil {
		return err
	}
	query := strings.ToLower(list.Query)
	rows := []onlineRowJSON{}
	for _, node := range nodes {
		if nodeFilter != "" && node.Node.NodeID != nodeFilter {
			continue
		}
		for _, player := range node.Players {
			accountID := playerAccount(node, player)
			row := onlineRowJSON{PlayerID: player.PlayerID, Name: player.Name, Guest: accountID == "",
				AccountID: accountID, Username: accounts[accountID].Username, NodeID: node.Node.NodeID,
				NodeName: node.Node.Name, Room: player.Room, Leaving: leaving[node.Node.NodeID+"|"+player.PlayerID]}
			if query != "" && !strings.Contains(strings.ToLower(row.Name), query) &&
				!strings.Contains(strings.ToLower(row.Username), query) {
				continue
			}
			rows = append(rows, row)
		}
	}
	key := func(row onlineRowJSON) string {
		switch list.Sort {
		case "username":
			return strings.ToLower(row.Username)
		case "node":
			return row.NodeName + "\x00" + row.NodeID
		case "room":
			return row.Room
		}
		return strings.ToLower(row.Name)
	}
	slices.SortStableFunc(rows, func(x, y onlineRowJSON) int {
		order := cmp.Or(cmp.Compare(key(x), key(y)), cmp.Compare(x.NodeID, y.NodeID),
			cmp.Compare(x.PlayerID, y.PlayerID))
		if list.Desc {
			return -order
		}
		return order
	})
	total := len(rows)
	return answerList(w, list, rows[min(list.Offset, total):min(list.Offset+list.Limit, total)], total)
}

// nodeRowJSON is the NodeRow of ADMIN.md 4.
type nodeRowJSON struct {
	NodeID          string              `json:"nodeId"`
	Name            string              `json:"name"`
	Origin          *string             `json:"origin"` // null: reached through the data service's origin
	Players         int                 `json:"players"`
	Capacity        int                 `json:"capacity"`
	Rooms           int                 `json:"rooms"`
	Full            bool                `json:"full"`
	StartedAt       int64               `json:"startedAt"`
	SeenAt          int64               `json:"seenAt"`
	ProtocolVersion int                 `json:"protocolVersion"`
	Status          string              `json:"status"`
	Stats           *contract.NodeStats `json:"stats"`
}

// serviceCheck is the state of a backing service: whether it answered a
// ping, how long that took, and why not (Chinese, for the console).
type serviceCheck struct {
	OK        bool   `json:"ok"`
	LatencyMs *int64 `json:"latencyMs"`
	Error     string `json:"error"`
}

func checkService(ctx context.Context, ping func(context.Context) error) serviceCheck {
	pingCtx, cancel := context.WithTimeout(ctx, pingTimeout)
	defer cancel()
	start := time.Now()
	err := ping(pingCtx)
	latency := time.Since(start).Milliseconds()
	switch {
	case err == nil:
		return serviceCheck{OK: true, LatencyMs: &latency}
	case pingCtx.Err() != nil:
		return serviceCheck{Error: "超时（" + pingTimeout.String() + " 内没有响应）"}
	}
	message := err.Error()
	if len(message) > 200 {
		message = truncateUTF8(message, 200) + "…"
	}
	return serviceCheck{Error: "连接失败：" + message}
}

// liveHeapMetric is the heap held by live objects at the last GC.
const liveHeapMetric = "/gc/heap/live:bytes"

// offlineNodes are the nodes seen within cache.NodeSeenTTL that are not
// among the registered ones (live), as their last heartbeat left them.
func (a *API) offlineNodes(ctx context.Context, live []cache.NodeOnline) []cache.Node {
	seen, err := a.cluster.SeenNodes(ctx)
	if err != nil {
		a.log.Warn("admin: seen node list unavailable", "error", err)
		return nil
	}
	registered := make(map[string]bool, len(live))
	for _, node := range live {
		registered[node.Node.NodeID] = true
	}
	var offline []cache.Node
	for _, node := range seen {
		if !registered[node.NodeID] {
			offline = append(offline, node)
		}
	}
	return offline
}

// adminNodes lists the game nodes of the registry (status: ok, stale when
// the last heartbeat is older than 10 s, full), then the nodes seen within
// a day that are no longer registered (offline, as their last heartbeat
// left them), and the data service's own build, start, goroutines, live
// heap (MB, one decimal) and MySQL and Redis checks. nodes is empty while
// Redis is unavailable.
func (a *API) adminNodes(w http.ResponseWriter, r *http.Request) error {
	if _, err := a.requireAdmin(r); err != nil {
		return err
	}
	ctx := r.Context()
	now := a.nowMillis()
	var mysql, redis serviceCheck
	var wg sync.WaitGroup
	wg.Go(func() { mysql = checkService(ctx, a.store.Ping) })
	if a.cluster != nil {
		wg.Go(func() { redis = checkService(ctx, a.cluster.Ping) })
	} else {
		redis = serviceCheck{Error: "未配置 Redis"}
	}
	nodes := []nodeRowJSON{}
	row := func(node cache.Node, status string) nodeRowJSON {
		return nodeRowJSON{NodeID: node.NodeID, Name: node.Name, Origin: nodeOrigin(node), Players: node.Players,
			Capacity: node.Capacity, Rooms: node.Rooms, Full: node.Full(), StartedAt: node.StartedAt,
			SeenAt: node.SeenAt, ProtocolVersion: node.ProtocolVersion, Status: status, Stats: node.Stats}
	}
	if a.cluster != nil {
		live, err := a.cluster.Nodes(ctx)
		if err != nil {
			a.log.Warn("admin: node list unavailable", "error", err)
		} else {
			registered := make([]cache.NodeOnline, len(live))
			for i, node := range live {
				nodes = append(nodes, row(node, nodeStatus(node, now)))
				registered[i].Node = node
			}
			for _, node := range a.offlineNodes(ctx, registered) {
				nodes = append(nodes, row(node, nodeOffline))
			}
		}
	}
	wg.Wait()
	sample := []metrics.Sample{{Name: liveHeapMetric}}
	metrics.Read(sample)
	var heapMB float64
	if sample[0].Value.Kind() == metrics.KindUint64 {
		heapMB = contract.RoundMB(sample[0].Value.Uint64())
	}
	return writeJSON(w, http.StatusOK, map[string]any{
		"now":   now,
		"nodes": nodes,
		"data": map[string]any{
			"version": buildinfo.Version(), "goVersion": runtime.Version(), "startedAt": a.startedAt,
			"goroutines": runtime.NumGoroutine(), "heapMB": heapMB, "mysql": mysql, "redis": redis,
		},
	})
}
