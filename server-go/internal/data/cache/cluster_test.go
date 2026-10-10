package cache

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"kartsim/internal/shared/contract"
)

func newTestCluster(t *testing.T) (*Cluster, *miniredis.Miniredis) {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	return NewCluster(client, "kt:"), server
}

func register(t *testing.T, cluster *Cluster, node Node, players ...contract.OnlinePlayer) HeartbeatResult {
	t.Helper()
	result, err := cluster.Heartbeat(context.Background(), node, players)
	if err != nil {
		t.Fatal(err)
	}
	return result
}

func TestClaimRules(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-a", Name: "A", Capacity: 10})
	register(t, cluster, Node{NodeID: "game-b", Name: "B", Capacity: 10})

	claim := func(node, player, name string) bool {
		t.Helper()
		ok, err := cluster.Claim(ctx, node, player, name)
		if err != nil {
			t.Fatal(err)
		}
		return ok
	}
	if !claim("game-a", "p1", "Alice") {
		t.Fatal("free name refused")
	}
	if got, _ := server.Get("kt:presence:alice"); got != "game-a|p1" {
		t.Fatalf("presence value %q", got)
	}
	if ttl := server.TTL("kt:presence:alice"); ttl != PresenceTTL {
		t.Fatalf("presence ttl %s", ttl)
	}
	if !server.Exists("kt:node-players:game-a") {
		t.Fatal("claim not recorded for the node")
	}
	server.FastForward(10 * time.Second)
	if !claim("game-a", "p1", "ALICE") {
		t.Fatal("same player could not re-claim")
	}
	if ttl := server.TTL("kt:presence:alice"); ttl != PresenceTTL {
		t.Fatalf("re-claim did not refresh the ttl: %s", ttl)
	}
	if claim("game-b", "p2", "alice") || claim("game-a", "p3", "Alice") {
		t.Fatal("name held by a live node was taken")
	}

	// game-a stops heartbeating: its registration expires and the name is free.
	server.FastForward(NodeTTL)
	register(t, cluster, Node{NodeID: "game-b", Name: "B", Capacity: 10})
	if !claim("game-b", "p2", "alice") {
		t.Fatal("name of a vanished node was not taken over")
	}
	if got, _ := server.Get("kt:presence:alice"); got != "game-b|p2" {
		t.Fatalf("presence value %q", got)
	}
}

func TestReleaseOnlyByHolder(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-a", Capacity: 10})
	if ok, err := cluster.Claim(ctx, "game-a", "p1", "Bob"); err != nil || !ok {
		t.Fatal(ok, err)
	}
	if err := cluster.Release(ctx, "game-a", "p9", "bob"); err != nil {
		t.Fatal(err)
	}
	if !server.Exists("kt:presence:bob") {
		t.Fatal("another player released the name")
	}
	if err := cluster.Release(ctx, "game-a", "p1", "BOB"); err != nil {
		t.Fatal(err)
	}
	if server.Exists("kt:presence:bob") {
		t.Fatal("holder could not release")
	}
	if members, _ := server.SMembers("kt:node-players:game-a"); len(members) != 0 {
		t.Fatalf("node-players still lists %v", members)
	}
}

func TestHeartbeatRefreshesPresence(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	node := Node{NodeID: "game-a", Name: "A", Capacity: 4, Players: 3, Rooms: 1}
	register(t, cluster, Node{NodeID: "game-b", Capacity: 4})
	if ok, _ := cluster.Claim(ctx, "game-a", "p1", "Carol"); !ok {
		t.Fatal("claim refused")
	}
	if ok, _ := cluster.Claim(ctx, "game-b", "p9", "Dave"); !ok {
		t.Fatal("claim refused")
	}
	server.FastForward(20 * time.Second)

	result := register(t, cluster, node,
		contract.OnlinePlayer{PlayerID: "p1", Name: "Carol"}, // refreshed
		contract.OnlinePlayer{PlayerID: "p2", Name: "Erin"},  // expired or missing: claimed again
		contract.OnlinePlayer{PlayerID: "p3", Name: "dave"},  // held by game-b: conflict
	)
	if len(result.Conflicts) != 1 || result.Conflicts[0] != "p3" || result.Freed != 0 {
		t.Fatalf("heartbeat result %+v", result)
	}
	if ttl := server.TTL("kt:presence:carol"); ttl != PresenceTTL {
		t.Fatalf("carol ttl %s", ttl)
	}
	if got, _ := server.Get("kt:presence:erin"); got != "game-a|p2" {
		t.Fatalf("erin %q", got)
	}
	if got, _ := server.Get("kt:presence:dave"); got != "game-b|p9" {
		t.Fatalf("dave %q", got)
	}
	members, _ := server.SMembers("kt:node-players:game-a")
	if len(members) != 2 || members[0] != "carol" || members[1] != "erin" {
		t.Fatalf("node-players = %v", members)
	}
	if ttl := server.TTL("kt:node:game-a"); ttl != NodeTTL {
		t.Fatalf("node ttl %s", ttl)
	}
	stored, _ := server.Get("kt:node:game-a")
	var decoded Node
	if err := json.Unmarshal([]byte(stored), &decoded); err != nil || decoded.Players != 3 || decoded.Name != "A" {
		t.Fatalf("node record %s", stored)
	}
}

func TestLeaveFreesOnlyOwnNames(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-a", Capacity: 4}, contract.OnlinePlayer{PlayerID: "p1", Name: "Fay"})
	register(t, cluster, Node{NodeID: "game-b", Capacity: 4}, contract.OnlinePlayer{PlayerID: "p2", Name: "Gus"})
	// A stale node-players entry whose name now belongs to game-b must survive.
	server.SAdd("kt:node-players:game-a", "gus")

	if err := cluster.Leave(ctx, "game-a"); err != nil {
		t.Fatal(err)
	}
	if server.Exists("kt:presence:fay") || server.Exists("kt:node:game-a") || server.Exists("kt:node-players:game-a") ||
		server.Exists("kt:node-epoch:game-a") {
		t.Fatal("node state left behind")
	}
	if !server.Exists("kt:presence:gus") {
		t.Fatal("another node's name was freed")
	}
	if ok, _ := server.SIsMember("kt:nodes", "game-a"); ok {
		t.Fatal("node still in the node set")
	}
}

func TestNodesSortedAndPruned(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "z", Name: "Beta", Capacity: 2, Players: 2})
	register(t, cluster, Node{NodeID: "y", Name: "Alpha", Capacity: 2, Origin: "http://127.0.0.1:8789"})
	register(t, cluster, Node{NodeID: "x", Name: "Beta", Capacity: 2})

	nodes, err := cluster.Nodes(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(nodes) != 3 || nodes[0].NodeID != "y" || nodes[1].NodeID != "x" || nodes[2].NodeID != "z" {
		t.Fatalf("order %+v", nodes)
	}
	if !nodes[2].Full() || nodes[1].Full() {
		t.Fatal("full flag wrong")
	}

	server.FastForward(10 * time.Second)
	register(t, cluster, Node{NodeID: "x", Name: "Beta", Capacity: 2})
	server.FastForward(6 * time.Second)
	nodes, err = cluster.Nodes(ctx)
	if err != nil || len(nodes) != 1 || nodes[0].NodeID != "x" {
		t.Fatalf("live nodes %+v, %v", nodes, err)
	}
	if members, _ := server.SMembers("kt:nodes"); len(members) != 1 {
		t.Fatalf("expired ids not pruned: %v", members)
	}
	if _, found, err := cluster.Node(ctx, "y"); err != nil || found {
		t.Fatal("expired node still found")
	}
	if node, found, err := cluster.Node(ctx, "x"); err != nil || !found || node.Capacity != 2 {
		t.Fatal("live node not found")
	}
}

func TestNameOnlineIgnoresVanishedNodes(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-a", Capacity: 4}, contract.OnlinePlayer{PlayerID: "p1", Name: "Hal"})
	if online, err := cluster.NameOnline(ctx, "HAL"); err != nil || !online {
		t.Fatal("live name not reported", err)
	}
	if online, _ := cluster.NameOnline(ctx, "Ivy"); online {
		t.Fatal("free name reported online")
	}
	server.FastForward(NodeTTL + time.Second)
	if online, _ := cluster.NameOnline(ctx, "Hal"); online {
		t.Fatal("name of a vanished node reported online")
	}
}

func TestRedisErrorsSurface(t *testing.T) {
	cluster, server := newTestCluster(t)
	server.SetError("ERR down")
	ctx := context.Background()
	if _, err := cluster.Claim(ctx, "a", "p", "n"); err == nil {
		t.Fatal("claim error hidden")
	}
	if _, err := cluster.Nodes(ctx); err == nil {
		t.Fatal("list error hidden")
	}
	if _, _, err := cluster.Node(ctx, "a"); err == nil {
		t.Fatal("lookup error hidden")
	}
}

func TestFoldName(t *testing.T) {
	cases := map[string]string{
		"Alice": "alice", "ÉLAN": "élan", "ẞ": "ß", "名字": "名字", "ΣΊΣΥΦΟΣ": "σίσυφοσ", "K": "k",
		// utf8mb4_0900_as_ci keeps these apart from their Go case partners.
		"ALİCE": "alİce", "Alıce": "alıce", "ſam": "ſam", "Ლa": "Ლa", "ẛ": "ẛ", "Ꞹ": "Ꞹ", "𐕰": "𐕰", "𖹀": "𖹀",
	}
	for input, want := range cases {
		if got := FoldName(input); got != want {
			t.Errorf("FoldName(%q) = %q, want %q", input, got, want)
		}
	}
	// A guest name that MySQL tells apart from an account nickname must not
	// share its presence key (the account would be locked out).
	for _, pair := range [][2]string{{"Alice", "ALİCE"}, {"Alice", "Alıce"}, {"Sam", "ſam"}, {"ლa", "Ლa"}} {
		if FoldName(pair[0]) == FoldName(pair[1]) {
			t.Errorf("%q and %q share the presence key %q", pair[0], pair[1], FoldName(pair[0]))
		}
	}
}

func TestRestartedNodeFreesNamesOfItsPreviousProcess(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	claim := func(node, player, name string) bool {
		t.Helper()
		ok, err := cluster.Claim(ctx, node, player, name)
		if err != nil {
			t.Fatal(err)
		}
		return ok
	}
	online := func(name string) bool {
		t.Helper()
		online, err := cluster.NameOnline(ctx, name)
		if err != nil {
			t.Fatal(err)
		}
		return online
	}
	old := Node{NodeID: "game-1", Capacity: 10, StartedAt: 1000}
	register(t, cluster, Node{NodeID: "game-2", Capacity: 10, StartedAt: 7}, contract.OnlinePlayer{PlayerID: "q1", Name: "Gil"})
	register(t, cluster, old, contract.OnlinePlayer{PlayerID: "p-old", Name: "Bob"},
		contract.OnlinePlayer{PlayerID: "p-cat", Name: "Cat"})
	if !claim("game-1", "p-amy", "Amy") { // claimed after the last heartbeat
		t.Fatal("claim refused")
	}

	// The same process keeps its names: same startedAt, nothing freed.
	server.FastForward(4 * time.Second)
	if result := register(t, cluster, old, contract.OnlinePlayer{PlayerID: "p-old", Name: "Bob"}); result.Freed != 0 {
		t.Fatalf("same process freed %d names", result.Freed)
	}
	if !online("Amy") || !online("Cat") {
		t.Fatal("same-process heartbeat dropped a claim")
	}
	register(t, cluster, old, contract.OnlinePlayer{PlayerID: "p-old", Name: "Bob"},
		contract.OnlinePlayer{PlayerID: "p-cat", Name: "Cat"}, contract.OnlinePlayer{PlayerID: "p-amy", Name: "Amy"})

	// The node crashes and restarts at once under the same id. Cat
	// reconnected to the new process before its first heartbeat.
	server.FastForward(time.Second)
	server.Del("kt:presence:cat")
	if !claim("game-1", "p-cat-2", "Cat") {
		t.Fatal("free name refused")
	}
	if !online("Bob") {
		t.Fatal("precondition: the old claim looks live before the new process registers")
	}
	// A stale entry for a name another node now holds must survive.
	server.SAdd("kt:node-players:game-1", "gil")
	result := register(t, cluster, Node{NodeID: "game-1", Capacity: 10, StartedAt: 5000},
		contract.OnlinePlayer{PlayerID: "p-cat-2", Name: "Cat"})
	if result.Freed != 2 || len(result.Conflicts) != 0 {
		t.Fatalf("restart heartbeat %+v, want Bob and Amy freed", result)
	}
	if online("Bob") || online("Amy") {
		t.Fatal("names of the previous process still locked")
	}
	if got, _ := server.Get("kt:presence:cat"); got != "game-1|p-cat-2" {
		t.Fatalf("the new process lost its own claim: %q", got)
	}
	if got, _ := server.Get("kt:presence:gil"); got != "game-2|q1" {
		t.Fatalf("another node's name was freed: %q", got)
	}
	if !claim("game-1", "p-new", "Bob") {
		t.Fatal("Bob cannot reconnect")
	}
}

func TestSlowRestartFreesNamesAfterTheNodeExpired(t *testing.T) {
	cluster, server := newTestCluster(t)
	register(t, cluster, Node{NodeID: "game-1", Capacity: 10, StartedAt: 1}, contract.OnlinePlayer{PlayerID: "p-old", Name: "Bob"})
	// The restart takes longer than NodeTTL: node:game-1 expired, Bob's
	// presence has not, and re-registering would make it look live again.
	server.FastForward(NodeTTL + 5*time.Second)
	if !server.Exists("kt:presence:bob") {
		t.Fatal("precondition: presence outlives the node key")
	}
	if result := register(t, cluster, Node{NodeID: "game-1", Capacity: 10, StartedAt: 2}); result.Freed != 1 {
		t.Fatalf("restart heartbeat %+v", result)
	}
	if ok, err := cluster.Claim(context.Background(), "game-1", "p-new", "Bob"); err != nil || !ok {
		t.Fatal("Bob locked out after a slow restart", ok, err)
	}
	if ttl := server.TTL("kt:node-epoch:game-1"); ttl != nodeStateTTL {
		t.Fatalf("epoch ttl %s", ttl)
	}
}

func claimPresence(t *testing.T, cluster *Cluster, node, player, name, account string) ClaimOutcome {
	t.Helper()
	outcome, err := cluster.ClaimPresence(context.Background(),
		Presence{NodeID: node, PlayerID: player, Name: name, AccountID: account})
	if err != nil {
		t.Fatal(err)
	}
	return outcome
}

func TestAccountClaims(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-a", Capacity: 10})
	register(t, cluster, Node{NodeID: "game-b", Capacity: 10})

	if got := claimPresence(t, cluster, "game-a", "p1", "Alice", "acct-1"); got != Claimed {
		t.Fatalf("free account: %v", got)
	}
	if got, _ := server.Get("kt:presence-account:acct-1"); got != "game-a|p1" {
		t.Fatalf("account value %q", got)
	}
	if ttl := server.TTL("kt:presence-account:acct-1"); ttl != PresenceTTL {
		t.Fatalf("account ttl %s", ttl)
	}
	if got := server.HGet("kt:node-accounts:game-a", "p1"); got != "acct-1" {
		t.Fatalf("node account map %q", got)
	}
	// The account is checked first, and a refused claim sets nothing.
	if got := claimPresence(t, cluster, "game-b", "p2", "Bob", "acct-1"); got != AccountOnline {
		t.Fatalf("second session: %v", got)
	}
	if got := claimPresence(t, cluster, "game-b", "p2", "alice", "acct-1"); got != AccountOnline {
		t.Fatalf("second session with the same name: %v", got)
	}
	if got := claimPresence(t, cluster, "game-b", "p2", "ALICE", "acct-2"); got != NameTaken {
		t.Fatalf("taken name: %v", got)
	}
	if server.Exists("kt:presence:bob") || server.Exists("kt:presence-account:acct-2") || server.Exists("kt:node-accounts:game-b") {
		t.Fatal("a refused claim reserved something")
	}
	server.FastForward(10 * time.Second)
	if got := claimPresence(t, cluster, "game-a", "p1", "Alice", "acct-1"); got != Claimed {
		t.Fatalf("re-claim: %v", got)
	}
	if ttl := server.TTL("kt:presence-account:acct-1"); ttl != PresenceTTL {
		t.Fatalf("re-claim did not refresh the account: %s", ttl)
	}

	// Only the holder releases; a release without the account id uses the node's map.
	if err := cluster.ReleasePresence(ctx, Presence{NodeID: "game-b", PlayerID: "p2", Name: "Bob", AccountID: "acct-1"}); err != nil {
		t.Fatal(err)
	}
	if !server.Exists("kt:presence-account:acct-1") {
		t.Fatal("another session released the account")
	}
	if err := cluster.Release(ctx, "game-a", "p1", "Alice"); err != nil {
		t.Fatal(err)
	}
	if server.Exists("kt:presence-account:acct-1") || server.Exists("kt:presence:alice") || server.Exists("kt:node-accounts:game-a") {
		t.Fatal("release left the account claimed")
	}

	// A vanished node's account is taken over.
	if got := claimPresence(t, cluster, "game-a", "p1", "Alice", "acct-1"); got != Claimed {
		t.Fatalf("claim: %v", got)
	}
	server.FastForward(NodeTTL)
	register(t, cluster, Node{NodeID: "game-b", Capacity: 10})
	if got := claimPresence(t, cluster, "game-b", "p7", "Alicia", "acct-1"); got != Claimed {
		t.Fatalf("takeover: %v", got)
	}
	if got, _ := server.Get("kt:presence-account:acct-1"); got != "game-b|p7" {
		t.Fatalf("account value %q", got)
	}
}

func TestHeartbeatRefreshesAccounts(t *testing.T) {
	cluster, server := newTestCluster(t)
	node := Node{NodeID: "game-a", Capacity: 10, StartedAt: 1}
	register(t, cluster, node)
	register(t, cluster, Node{NodeID: "game-b", Capacity: 10, StartedAt: 1})
	claimPresence(t, cluster, "game-a", "p1", "Carol", "acct-1")
	claimPresence(t, cluster, "game-a", "p2", "Erin", "acct-2")
	claimPresence(t, cluster, "game-b", "p9", "Dave", "acct-9")
	server.FastForward(20 * time.Second)

	// p1 is listed: refreshed. p2 is not listed (yet): kept, not refreshed.
	if result := register(t, cluster, node, contract.OnlinePlayer{PlayerID: "p1", Name: "Carol"}); len(result.Conflicts) != 0 {
		t.Fatalf("heartbeat %+v", result)
	}
	if ttl := server.TTL("kt:presence-account:acct-1"); ttl != PresenceTTL {
		t.Fatalf("listed account ttl %s", ttl)
	}
	if ttl := server.TTL("kt:presence-account:acct-2"); ttl != 10*time.Second {
		t.Fatalf("unlisted account ttl %s", ttl)
	}
	if server.HGet("kt:node-accounts:game-a", "p2") != "acct-2" {
		t.Fatal("the map lost a player whose account is still claimed")
	}
	if ttl := server.TTL("kt:node-accounts:game-a"); ttl != nodeStateTTL {
		t.Fatalf("node account map ttl %s", ttl)
	}
	// The next heartbeat lists p2 too: its account is refreshed.
	register(t, cluster, node, contract.OnlinePlayer{PlayerID: "p1", Name: "Carol"}, contract.OnlinePlayer{PlayerID: "p2", Name: "Erin"})
	if ttl := server.TTL("kt:presence-account:acct-2"); ttl != PresenceTTL {
		t.Fatalf("account of a newly listed player: %s", ttl)
	}
	// A listed player's lost account key is claimed again.
	server.Del("kt:presence-account:acct-1")
	register(t, cluster, node, contract.OnlinePlayer{PlayerID: "p1", Name: "Carol"}, contract.OnlinePlayer{PlayerID: "p2", Name: "Erin"})
	if got, _ := server.Get("kt:presence-account:acct-1"); got != "game-a|p1" {
		t.Fatalf("re-claimed account %q", got)
	}
	// An unlisted player's expired key drops it from the map.
	server.FastForward(PresenceTTL + time.Second)
	register(t, cluster, Node{NodeID: "game-b", Capacity: 10, StartedAt: 1})
	register(t, cluster, node, contract.OnlinePlayer{PlayerID: "p1", Name: "Carol"})
	if server.HGet("kt:node-accounts:game-a", "p2") != "" {
		t.Fatal("the map keeps a player whose account expired")
	}
	// An account another session took meanwhile is a conflict (reported
	// once) and leaves the map; the other session keeps it.
	if err := server.Set("kt:presence-account:acct-1", "game-b|p9"); err != nil {
		t.Fatal(err)
	}
	result := register(t, cluster, node, contract.OnlinePlayer{PlayerID: "p1", Name: "Carol"})
	if len(result.Conflicts) != 1 || result.Conflicts[0] != "p1" {
		t.Fatalf("heartbeat %+v", result)
	}
	if got, _ := server.Get("kt:presence-account:acct-1"); got != "game-b|p9" || server.HGet("kt:node-accounts:game-a", "p1") != "" {
		t.Fatalf("conflicting account %q", got)
	}
	if server.Exists("kt:node-accounts:game-a") {
		t.Fatal("empty map left behind")
	}
}

func TestRestartAndLeaveFreeAccounts(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-1", Capacity: 10, StartedAt: 1000})
	register(t, cluster, Node{NodeID: "game-2", Capacity: 10, StartedAt: 7})
	claimPresence(t, cluster, "game-1", "p-old", "Bob", "acct-old")
	claimPresence(t, cluster, "game-1", "p-keep", "Cat", "acct-keep")
	claimPresence(t, cluster, "game-2", "q1", "Gil", "acct-gil")
	// A stale map entry for an account another node now holds must survive.
	server.HSet("kt:node-accounts:game-1", "p-gone", "acct-gil")

	// The node restarts under the same id; Cat reconnected to the new process.
	result := register(t, cluster, Node{NodeID: "game-1", Capacity: 10, StartedAt: 5000},
		contract.OnlinePlayer{PlayerID: "p-keep", Name: "Cat"})
	if result.Freed != 2 || len(result.Conflicts) != 0 { // Bob's name and account
		t.Fatalf("restart heartbeat %+v", result)
	}
	if server.Exists("kt:presence-account:acct-old") || !server.Exists("kt:presence-account:acct-keep") {
		t.Fatal("restart freed the wrong accounts")
	}
	if got, _ := server.Get("kt:presence-account:acct-gil"); got != "game-2|q1" {
		t.Fatalf("another node's account was freed: %q", got)
	}
	if got := claimPresence(t, cluster, "game-2", "q2", "Bobby", "acct-old"); got != Claimed {
		t.Fatalf("the restarted node's account stays locked: %v", got)
	}

	server.HSet("kt:node-accounts:game-1", "p-gone", "acct-gil")
	if err := cluster.Leave(ctx, "game-1"); err != nil {
		t.Fatal(err)
	}
	if server.Exists("kt:presence-account:acct-keep") || server.Exists("kt:node-accounts:game-1") {
		t.Fatal("leave left the node's accounts claimed")
	}
	if got, _ := server.Get("kt:presence-account:acct-gil"); got != "game-2|q1" {
		t.Fatalf("leave freed another node's account: %q", got)
	}
}

func TestAccountsInGame(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	if inGame, err := cluster.AccountsInGame(ctx, nil); err != nil || len(inGame) != 0 {
		t.Fatalf("no ids: %v, %v", inGame, err)
	}
	register(t, cluster, Node{NodeID: "game-a", Capacity: 10})
	register(t, cluster, Node{NodeID: "game-b", Capacity: 10})
	claimPresence(t, cluster, "game-a", "p1", "Ann", "acc-1")
	claimPresence(t, cluster, "game-b", "p2", "Bob", "acc-2")
	claimPresence(t, cluster, "game-a", "p3", "Guest", "")
	inGame, err := cluster.AccountsInGame(ctx, []string{"acc-1", "acc-2", "acc-3"})
	if err != nil || len(inGame) != 2 || !inGame["acc-1"] || !inGame["acc-2"] {
		t.Fatalf("in game: %v, %v", inGame, err)
	}
	// A released claim and a claim whose node vanished do not count.
	if err := cluster.ReleasePresence(ctx, Presence{NodeID: "game-a", PlayerID: "p1", Name: "Ann", AccountID: "acc-1"}); err != nil {
		t.Fatal(err)
	}
	server.FastForward(NodeTTL + time.Second)
	register(t, cluster, Node{NodeID: "game-a", Capacity: 10})
	if !server.Exists("kt:presence-account:acc-2") {
		t.Fatal("the stale claim should still be stored")
	}
	inGame, err = cluster.AccountsInGame(ctx, []string{"acc-1", "acc-2"})
	if err != nil || len(inGame) != 0 {
		t.Fatalf("in game after release and node expiry: %v, %v", inGame, err)
	}
	server.SetError("ERR down")
	if _, err := cluster.AccountsInGame(ctx, []string{"acc-1"}); err == nil {
		t.Fatal("lookup error hidden")
	}
}

// The admin console's online list: each live node with the players of its
// latest heartbeat (but those in conflict), their rooms and accounts.
func TestOnlineListsTheLatestHeartbeat(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	if online, err := cluster.Online(ctx); err != nil || len(online) != 0 {
		t.Fatalf("no nodes: %v, %v", online, err)
	}
	stats := &contract.NodeStats{HeapMB: 40, Goroutines: 21, Connections: 3, Races: 1, Version: "abc"}
	register(t, cluster, Node{NodeID: "game-a", Name: "A", Capacity: 10, Stats: stats})
	register(t, cluster, Node{NodeID: "game-b", Name: "B", Capacity: 10})
	claimPresence(t, cluster, "game-a", "p1", "Ann", "acc-1")
	claimPresence(t, cluster, "game-a", "p2", "Guest", "")
	claimPresence(t, cluster, "game-b", "p3", "Bob", "acc-2")
	ann := contract.OnlinePlayer{PlayerID: "p1", Name: "Ann", Room: "快来"}
	guest := contract.OnlinePlayer{PlayerID: "p2", Name: "Guest"}
	register(t, cluster, Node{NodeID: "game-a", Name: "A", Capacity: 10, Stats: stats}, ann, guest)
	// p9 claims a name game-b holds: it is in conflict and not listed.
	register(t, cluster, Node{NodeID: "game-b", Name: "B", Capacity: 10},
		contract.OnlinePlayer{PlayerID: "p3", Name: "Bob"}, contract.OnlinePlayer{PlayerID: "p9", Name: "Ann"})

	online, err := cluster.Online(ctx)
	if err != nil || len(online) != 2 {
		t.Fatalf("online %v, %v", online, err)
	}
	a, b := online[0], online[1]
	if a.Node.NodeID != "game-a" || a.Node.Stats == nil || *a.Node.Stats != *stats || len(a.Players) != 2 ||
		a.Players[0] != ann || a.Players[1] != guest || len(a.Accounts) != 1 || a.Accounts["p1"] != "acc-1" {
		t.Fatalf("node a %+v", a)
	}
	if b.Node.NodeID != "game-b" || b.Node.Stats != nil || len(b.Players) != 1 || b.Players[0].PlayerID != "p3" ||
		b.Accounts["p3"] != "acc-2" {
		t.Fatalf("node b %+v", b)
	}
	if nodes, err := cluster.AccountNodes(ctx, []string{"acc-1", "acc-2", "acc-3"}); err != nil || len(nodes) != 2 ||
		nodes["acc-1"] != "game-a" || nodes["acc-2"] != "game-b" {
		t.Fatalf("account nodes %v, %v", nodes, err)
	}
	if ttl := server.TTL("kt:node-online:game-a"); ttl != NodeTTL {
		t.Fatalf("online list ttl %s", ttl)
	}
	// A replaced account (an admin kick) is no longer in game at once.
	if marked, err := cluster.ReplaceAccount(ctx, "acc-1", "Ann"); err != nil || !marked {
		t.Fatalf("replace %v, %v", marked, err)
	}
	if nodes, err := cluster.AccountNodes(ctx, []string{"acc-1"}); err != nil || len(nodes) != 0 {
		t.Fatalf("account nodes after replace %v, %v", nodes, err)
	}
	// Leaving drops the list with the node.
	if err := cluster.Leave(ctx, "game-a"); err != nil {
		t.Fatal(err)
	}
	if server.Exists("kt:node-online:game-a") {
		t.Fatal("online list outlived the node")
	}
	if online, err := cluster.Online(ctx); err != nil || len(online) != 1 || online[0].Node.NodeID != "game-b" {
		t.Fatalf("online after leave %v, %v", online, err)
	}
	server.SetError("ERR down")
	if _, err := cluster.Online(ctx); err == nil {
		t.Fatal("online error hidden")
	}
}

// Heartbeats whose players carry their account ids rebuild the account map
// and account keys Redis lost (a restart without persistence, a flush), so
// kicks, bans and single sign-on keep working; an account someone else
// holds is a conflict instead.
func TestHeartbeatRebuildsLostAccounts(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	node := Node{NodeID: "game-a", Capacity: 10, StartedAt: 1}
	register(t, cluster, node)
	claimPresence(t, cluster, "game-a", "p1", "Ann", "acc-1")
	ann := contract.OnlinePlayer{PlayerID: "p1", Name: "Ann", AccountID: "acc-1"}
	guest := contract.OnlinePlayer{PlayerID: "p2", Name: "Guest"}
	register(t, cluster, node, ann, guest)

	server.FlushAll()
	if result := register(t, cluster, node, ann, guest); len(result.Conflicts) != 0 {
		t.Fatalf("heartbeat after the flush %+v", result)
	}
	if server.HGet("kt:node-accounts:game-a", "p1") != "acc-1" || server.HGet("kt:node-accounts:game-a", "p2") != "" {
		t.Fatal("the account map was not rebuilt from the heartbeat")
	}
	if got, _ := server.Get("kt:presence-account:acc-1"); got != "game-a|p1" {
		t.Fatalf("account key %q", got)
	}
	if nodes, err := cluster.AccountNodes(ctx, []string{"acc-1"}); err != nil || nodes["acc-1"] != "game-a" {
		t.Fatalf("account nodes %v, %v", nodes, err)
	}
	if online, err := cluster.Online(ctx); err != nil || len(online) != 1 || online[0].Accounts["p1"] != "acc-1" ||
		online[0].Players[0].AccountID != "acc-1" {
		t.Fatalf("online %+v, %v", online, err)
	}
	// A kick works again: the next heartbeat reports the session, and keeps
	// reporting it while the node still lists it.
	if marked, err := cluster.ReplaceAccount(ctx, "acc-1", "Ann"); err != nil || !marked {
		t.Fatalf("replace %v, %v", marked, err)
	}
	for range 2 {
		if result := register(t, cluster, node, ann, guest); len(result.Conflicts) != 1 || result.Conflicts[0] != "p1" {
			t.Fatalf("heartbeat after the kick %+v", result)
		}
		if server.HGet("kt:node-accounts:game-a", "p1") != "" {
			t.Fatal("a replaced account was mapped again")
		}
	}

	// An account another session holds is a conflict; nothing is mapped.
	server.FlushAll()
	if err := server.Set("kt:presence-account:acc-1", "game-b|p9"); err != nil {
		t.Fatal(err)
	}
	if result := register(t, cluster, node, ann); len(result.Conflicts) != 1 || result.Conflicts[0] != "p1" {
		t.Fatalf("heartbeat with the account held elsewhere %+v", result)
	}
	if got, _ := server.Get("kt:presence-account:acc-1"); got != "game-b|p9" || server.Exists("kt:node-accounts:game-a") {
		t.Fatalf("account taken from its holder: %q", got)
	}
	// A player whose name is in conflict gets no account back either.
	server.FlushAll()
	if err := server.Set("kt:presence:ann", "game-b|p9"); err != nil {
		t.Fatal(err)
	}
	if result := register(t, cluster, node, ann); len(result.Conflicts) != 1 {
		t.Fatalf("heartbeat with the name held elsewhere %+v", result)
	}
	if server.Exists("kt:presence-account:acc-1") || server.Exists("kt:node-accounts:game-a") {
		t.Fatal("a conflicting player's account was claimed")
	}
}

// Every heartbeat keeps the node entry as node-seen for a day: a node that
// left or stopped is still listed by SeenNodes until then.
func TestSeenNodesOutliveTheRegistry(t *testing.T) {
	cluster, server := newTestCluster(t)
	ctx := context.Background()
	if seen, err := cluster.SeenNodes(ctx); err != nil || len(seen) != 0 {
		t.Fatalf("no nodes: %v, %v", seen, err)
	}
	stats := &contract.NodeStats{HeapMB: 0.6}
	register(t, cluster, Node{NodeID: "game-b", Name: "B", Capacity: 10, SeenAt: 100, Stats: stats})
	register(t, cluster, Node{NodeID: "game-a", Name: "A", Capacity: 10, SeenAt: 200})
	if ttl := server.TTL("kt:node-seen:game-a"); ttl != NodeSeenTTL {
		t.Fatalf("seen ttl %s", ttl)
	}
	if err := cluster.Leave(ctx, "game-b"); err != nil {
		t.Fatal(err)
	}
	seen, err := cluster.SeenNodes(ctx)
	if err != nil || len(seen) != 2 || seen[0].NodeID != "game-a" || seen[1].NodeID != "game-b" ||
		seen[1].SeenAt != 100 || seen[1].Stats == nil || seen[1].Stats.HeapMB != 0.6 {
		t.Fatalf("seen %+v, %v", seen, err)
	}
	if nodes, err := cluster.Nodes(ctx); err != nil || len(nodes) != 1 || nodes[0].NodeID != "game-a" {
		t.Fatalf("registered %+v, %v", nodes, err)
	}
	// A day later only the node that kept beating is left.
	server.FastForward(NodeSeenTTL - time.Minute)
	register(t, cluster, Node{NodeID: "game-a", Name: "A", Capacity: 10, SeenAt: 300})
	server.FastForward(2 * time.Minute)
	if seen, err := cluster.SeenNodes(ctx); err != nil || len(seen) != 1 || seen[0].NodeID != "game-a" {
		t.Fatalf("seen a day later %+v, %v", seen, err)
	}
	if members, _ := server.SMembers("kt:nodes-seen"); len(members) != 1 {
		t.Fatalf("expired id kept: %v", members)
	}
}

// The admin console's copies are best effort: when they cannot be stored,
// the presence refresh still counts and its conflicts are still reported.
func TestHeartbeatListFailureKeepsConflicts(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
	t.Cleanup(func() { client.Close() })
	client.AddHook(failPipelines{})
	cluster := NewCluster(client, "kt:")
	node := Node{NodeID: "game-a", Capacity: 10}
	register(t, cluster, node)
	claimPresence(t, cluster, "game-a", "p1", "Ann", "acc-1")
	if marked, err := cluster.ReplaceAccount(context.Background(), "acc-1", "Ann"); err != nil || !marked {
		t.Fatalf("replace %v, %v", marked, err)
	}
	result, err := cluster.Heartbeat(context.Background(), node, []contract.OnlinePlayer{{PlayerID: "p1", Name: "Ann"}})
	if err != nil || result.ListErr == nil || len(result.Conflicts) != 1 || result.Conflicts[0] != "p1" {
		t.Fatalf("heartbeat %+v, %v", result, err)
	}
	if !server.Exists("kt:node:game-a") {
		t.Fatal("registration lost")
	}
}

// failPipelines fails the pipelines that write an online list (the
// heartbeat's console copies); connection setup and the rest pass.
type failPipelines struct{}

func (failPipelines) DialHook(next redis.DialHook) redis.DialHook          { return next }
func (failPipelines) ProcessHook(next redis.ProcessHook) redis.ProcessHook { return next }
func (failPipelines) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		for _, cmd := range cmds {
			if args := cmd.Args(); len(args) > 1 {
				if key, ok := args[1].(string); ok && strings.Contains(key, "node-online:") {
					return errors.New("pipeline refused")
				}
			}
		}
		return next(ctx, cmds)
	}
}

// AccountClaims reads the raw account keys, replaced markers included.
func TestAccountClaimValues(t *testing.T) {
	cluster, _ := newTestCluster(t)
	ctx := context.Background()
	register(t, cluster, Node{NodeID: "game-a", Capacity: 10})
	claimPresence(t, cluster, "game-a", "p1", "Ann", "acc-1")
	claimPresence(t, cluster, "game-a", "p2", "Bob", "acc-2")
	if _, err := cluster.ReplaceAccount(ctx, "acc-2", "Bob"); err != nil {
		t.Fatal(err)
	}
	claims, err := cluster.AccountClaims(ctx, []string{"acc-1", "acc-2", "acc-3"})
	if err != nil || len(claims) != 2 || claims["acc-1"] != PresenceValue("game-a", "p1") ||
		!strings.HasPrefix(claims["acc-2"], replacedOwner+"|") {
		t.Fatalf("claims %v, %v", claims, err)
	}
}
