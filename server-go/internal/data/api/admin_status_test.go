package api

import (
	"net/http"
	"testing"
	"time"

	"kartsim/internal/shared/contract"
)

// A kicked or banned account's session shows as leaving until its node
// drops it at the next heartbeat; a node that left is listed offline for a
// day; heaps are reported with one decimal.
func TestAdminLeavingSessionsAndOfflineNodes(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	id := h.account("kicked_"+u, "被踢"+u, password, false)
	h.login("kicked_"+u, password)
	node := "node-k-" + u
	h.heartbeat(node, "踢人", "", 10)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: node, PlayerID: "pk", Name: "被踢" + u,
		AccountID: id}).expect(t, http.StatusOK, "")
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: node, PlayerID: "pg", Name: "游客" + u,
		Guest: true}).expect(t, http.StatusOK, "")
	kicked := contract.OnlinePlayer{PlayerID: "pk", Name: "被踢" + u, AccountID: id}
	guest := contract.OnlinePlayer{PlayerID: "pg", Name: "游客" + u}
	beat := func(players ...contract.OnlinePlayer) contract.HeartbeatResponse {
		t.Helper()
		var response contract.HeartbeatResponse
		h.call(contract.PathHeartbeat, contract.HeartbeatRequest{NodeID: node, Name: "踢人", Capacity: 10,
			Players: players, StartedAt: 1, ProtocolVersion: contract.ProtocolVersion,
			Stats: &contract.NodeStats{HeapMB: 0.6, Goroutines: 9}}).expect(t, http.StatusOK, "").json(t, &response)
		return response
	}
	beat(kicked, guest)

	var online struct {
		Items []onlineRowJSON
		Total int
	}
	type overviewBody struct {
		Online *struct{ Players, Accounts, Guests int }
		Nodes  *struct{ Total, Healthy, Offline int }
	}
	h.adminGet("/api/admin/online?node="+node, &online)
	if online.Total != 2 || online.Items[1].AccountID != id || online.Items[1].Leaving || online.Items[0].Leaving {
		t.Fatalf("online %+v", online)
	}
	var overview overviewBody
	h.adminGet("/api/admin/overview", &overview)
	if overview.Online == nil || overview.Online.Players != 2 || overview.Online.Accounts != 1 || overview.Online.Guests != 1 {
		t.Fatalf("overview before the kick %+v", overview.Online)
	}

	h.post("/api/admin/accounts/"+id+"/kick", nil, h.adminHeader).expect(t, http.StatusOK, "")
	h.adminGet("/api/admin/online?node="+node, &online)
	if online.Total != 2 || online.Items[1].AccountID != id || !online.Items[1].Leaving || online.Items[1].Guest ||
		online.Items[1].Username != "kicked_"+u || online.Items[0].Leaving {
		t.Fatalf("online after the kick %+v", online)
	}
	h.adminGet("/api/admin/overview", &overview)
	if overview.Online.Players != 1 || overview.Online.Accounts != 0 || overview.Online.Guests != 1 {
		t.Fatalf("overview after the kick %+v", overview.Online)
	}
	var list accountListBody
	h.adminGet("/api/admin/accounts?q=kicked_"+u, &list)
	if list.Total != 1 || list.Items[0].Online == nil || !list.Items[0].Online.Leaving ||
		list.Items[0].Online.NodeID != node || list.Items[0].Online.NodeName != "踢人" {
		t.Fatalf("account after the kick %+v", list.Items)
	}
	h.adminGet("/api/admin/accounts?online=1&q=kicked_"+u, &list)
	if list.Total != 0 {
		t.Fatalf("a leaving account counts as online %+v", list)
	}
	// The next heartbeat reports the session; the node drops it.
	if response := beat(kicked, guest); len(response.Conflicts) != 1 || response.Conflicts[0] != "pk" {
		t.Fatalf("heartbeat %+v", response)
	}
	h.adminGet("/api/admin/online?node="+node, &online)
	if online.Total != 1 || online.Items[0].PlayerID != "pg" {
		t.Fatalf("online after the heartbeat %+v", online)
	}
	h.adminGet("/api/admin/accounts?q=kicked_"+u, &list)
	if list.Items[0].Online != nil {
		t.Fatalf("account after the heartbeat %+v", list.Items[0])
	}

	// The node's heap keeps its decimal; integers from older nodes decode.
	type nodeBody struct {
		NodeID string
		Status string
		SeenAt int64
		Stats  *contract.NodeStats
	}
	var nodes struct {
		Nodes []nodeBody
		Data  struct{ HeapMB float64 }
	}
	find := func(id string) *nodeBody {
		for i := range nodes.Nodes {
			if nodes.Nodes[i].NodeID == id {
				return &nodes.Nodes[i]
			}
		}
		return nil
	}
	h.adminGet("/api/admin/nodes", &nodes)
	if found := find(node); found == nil || found.Status != "ok" || found.Stats == nil || found.Stats.HeapMB != 0.6 ||
		nodes.Data.HeapMB <= 0 {
		t.Fatalf("nodes %+v", nodes)
	}
	older := "node-o-" + u
	h.call(contract.PathHeartbeat, map[string]any{"nodeId": older, "name": "旧版", "capacity": 10, "players": []any{},
		"protocolVersion": contract.ProtocolVersion, "stats": map[string]any{"heapMB": 48, "goroutines": 3}}).
		expect(t, http.StatusOK, "")
	h.adminGet("/api/admin/nodes", &nodes)
	if found := find(older); found == nil || found.Stats == nil || found.Stats.HeapMB != 48 {
		t.Fatalf("older node %+v", nodes.Nodes)
	}

	// A node that leaves (or stops beating) is listed offline with its last
	// heartbeat, and counted by the overview.
	h.call(contract.PathNodeLeave, contract.NodeLeaveRequest{NodeID: node}).expect(t, http.StatusOK, "")
	h.adminGet("/api/admin/nodes", &nodes)
	if found := find(node); found == nil || found.Status != "offline" || found.SeenAt == 0 || found.Stats == nil ||
		nodes.Nodes[len(nodes.Nodes)-1].NodeID != node {
		t.Fatalf("nodes after the leave %+v", nodes.Nodes)
	}
	h.adminGet("/api/admin/overview", &overview)
	if overview.Nodes == nil || overview.Nodes.Total != 1 || overview.Nodes.Offline != 1 {
		t.Fatalf("overview nodes %+v", overview.Nodes)
	}
	h.adminGet("/api/admin/online?node="+node, &online)
	if online.Total != 0 {
		t.Fatalf("online of an offline node %+v", online)
	}
	h.redis.FastForward(25 * time.Hour)
	h.adminGet("/api/admin/nodes", &nodes)
	if find(node) != nil || find(older) != nil {
		t.Fatalf("nodes a day later %+v", nodes.Nodes)
	}
}

// After Redis lost the account map, the next heartbeat of a node whose
// players carry their accounts restores it: the console shows the account
// again and a kick still reaches the session.
func TestAdminOnlineAfterRedisLostTheAccounts(t *testing.T) {
	h := newAdminHarness(t, harnessOptions{})
	u := h.u
	id := h.account("flushed_"+u, "清空"+u, password, false)
	node := "node-f-" + u
	h.heartbeat(node, "清空", "", 10)
	h.call(contract.PathPresenceClaim, contract.PresenceClaimRequest{NodeID: node, PlayerID: "pf", Name: "清空" + u,
		AccountID: id}).expect(t, http.StatusOK, "")
	player := contract.OnlinePlayer{PlayerID: "pf", Name: "清空" + u, AccountID: id}
	h.heartbeat(node, "清空", "", 10, player)
	h.redis.FlushAll()
	h.heartbeat(node, "清空", "", 10, player)

	var online struct{ Items []onlineRowJSON }
	h.adminGet("/api/admin/online?node="+node, &online)
	if len(online.Items) != 1 || online.Items[0].Guest || online.Items[0].AccountID != id ||
		online.Items[0].Username != "flushed_"+u || online.Items[0].Leaving {
		t.Fatalf("online %+v", online)
	}
	var kicked struct{ Game bool }
	h.post("/api/admin/accounts/"+id+"/kick", nil, h.adminHeader).expect(t, http.StatusOK, "").json(t, &kicked)
	if !kicked.Game {
		t.Fatal("the kick did not reach the game session")
	}
}
