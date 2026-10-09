package cache

import (
	"cmp"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/names"
)

const (
	// NodeTTL is how long a game node stays listed after its last heartbeat.
	NodeTTL = 15 * time.Second
	// PresenceTTL is how long a nickname stays claimed without a refresh.
	PresenceTTL = 30 * time.Second
	// nodeStateTTL is how long a node's name set and process epoch outlive
	// its last heartbeat or claim. It exceeds PresenceTTL, so a process that
	// restarts under the same node id still finds every name its predecessor
	// may hold.
	nodeStateTTL = 2 * PresenceTTL
)

// Node is the registry entry of one game node (Redis node:{id}).
type Node struct {
	NodeID          string `json:"nodeId"`
	Name            string `json:"name"`
	Origin          string `json:"origin"`
	Capacity        int    `json:"capacity"`
	Rooms           int    `json:"rooms"`
	Players         int    `json:"players"`
	StartedAt       int64  `json:"startedAt"`
	ProtocolVersion int    `json:"protocolVersion"`
	SeenAt          int64  `json:"seenAt"`
}

// Full reports whether the node accepts no more players.
func (n Node) Full() bool { return n.Players >= n.Capacity }

// Cluster is the Redis registry of game nodes, live nicknames and live
// accounts. Unlike Cache it has no MySQL fallback: callers turn its errors
// into 503.
//
// A live session holds presence:{folded name} and, for an account player,
// presence-account:{account id}; both hold "nodeId|playerId" and follow the
// same rules (PresenceTTL, refreshed by heartbeats, taken over once the
// owner node is no longer registered). node-players:{node} lists the names a
// node holds and node-accounts:{node} maps its players to their accounts,
// since heartbeats only carry player ids and names.
//
// The Lua scripts touch a few keys they compute themselves (the owner's
// node:{id}, a node's presence keys); that is fine on a standalone Redis or
// a primary/replica pair, which is what the data service uses.
type Cluster struct {
	rdb    *redis.Client
	prefix string
}

// NewCluster returns the registry using rdb with every key under prefix.
func NewCluster(rdb *redis.Client, prefix string) *Cluster {
	return &Cluster{rdb: rdb, prefix: prefix}
}

// FoldName is the presence-key form of a nickname (see names.Fold).
func FoldName(name string) string { return names.Fold(name) }

func presenceValue(nodeID, playerID string) string { return nodeID + "|" + playerID }

func (c *Cluster) nodeKey(nodeID string) string        { return c.prefix + "node:" + nodeID }
func (c *Cluster) nodesKey() string                    { return c.prefix + "nodes" }
func (c *Cluster) nodePlayersKey(nodeID string) string { return c.prefix + "node-players:" + nodeID }
func (c *Cluster) nodeEpochKey(nodeID string) string   { return c.prefix + "node-epoch:" + nodeID }
func (c *Cluster) presenceKey(folded string) string    { return c.prefix + "presence:" + folded }
func (c *Cluster) nodeAccountsKey(nodeID string) string {
	return c.prefix + "node-accounts:" + nodeID
}
func (c *Cluster) accountKey(accountID string) string {
	return c.prefix + "presence-account:" + accountID
}

// heartbeatScript stores the node, re-registers it in the node set and
// refreshes each listed player's presence: a key holding this player's value
// is extended, a missing key is claimed again with NX, a key held by anyone
// else is a conflict and is left alone. node-players is rebuilt from the
// players whose presence this node holds. The same applies to the account
// key of each listed player that node-accounts maps to an account; mappings
// of unlisted players are kept while their key still holds their value
// (a claim may be newer than the player list) and dropped otherwise.
//
// node-epoch remembers the startedAt of the process behind the node id.
// When it changes, the node restarted: the names and accounts its previous
// process still holds (this node's values that this heartbeat does not
// list) are freed first, instead of staying locked until they expire.
//
// KEYS: node, nodes, node-players, node-epoch, node-accounts, presence...
// ARGV: node JSON, node TTL ms, presence TTL ms, node id, startedAt, node
// state TTL ms, presence key prefix, account key prefix, then (value, folded
// name) per presence key.
// Returns the number of freed names and accounts followed by the 0-based
// indices of the conflicting players.
var heartbeatScript = redis.NewScript(`
local first = 6
local base = 9
local owned = ARGV[4] .. '|'
local listed = {}
for i = first, #KEYS do
  listed[ARGV[2 * (i - first) + base]] = i - first
end
local freed = 0
local epoch = redis.call('GET', KEYS[4])
if epoch and epoch ~= ARGV[5] then
  for _, name in ipairs(redis.call('SMEMBERS', KEYS[3])) do
    local key = ARGV[7] .. name
    local current = redis.call('GET', key)
    if current and string.sub(current, 1, #owned) == owned and not listed[current] then
      redis.call('DEL', key)
      freed = freed + 1
    end
  end
  local entries = redis.call('HGETALL', KEYS[5])
  for j = 1, #entries, 2 do
    local value = owned .. entries[j]
    if not listed[value] then
      local key = ARGV[8] .. entries[j + 1]
      if redis.call('GET', key) == value then
        redis.call('DEL', key)
        freed = freed + 1
      end
      redis.call('HDEL', KEYS[5], entries[j])
    end
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[4], ARGV[5], 'PX', ARGV[6])
redis.call('SADD', KEYS[2], ARGV[4])
redis.call('DEL', KEYS[3])
local result = {freed}
local conflicts = {}
local held = 0
for i = first, #KEYS do
  local value = ARGV[2 * (i - first) + base]
  local name = ARGV[2 * (i - first) + base + 1]
  local current = redis.call('GET', KEYS[i])
  local ours = false
  if current == value then
    redis.call('PEXPIRE', KEYS[i], ARGV[3])
    ours = true
  elseif not current then
    redis.call('SET', KEYS[i], value, 'PX', ARGV[3], 'NX')
    ours = true
  elseif not conflicts[value] then
    conflicts[value] = true
    result[#result + 1] = i - first
  end
  if ours then
    redis.call('SADD', KEYS[3], name)
    held = held + 1
  end
end
if held > 0 then
  redis.call('PEXPIRE', KEYS[3], ARGV[6])
end
local entries = redis.call('HGETALL', KEYS[5])
for j = 1, #entries, 2 do
  local player, value = entries[j], owned .. entries[j]
  local key = ARGV[8] .. entries[j + 1]
  local current = redis.call('GET', key)
  if listed[value] then
    if current == value then
      redis.call('PEXPIRE', key, ARGV[3])
    elseif not current then
      redis.call('SET', key, value, 'PX', ARGV[3], 'NX')
    else
      redis.call('HDEL', KEYS[5], player)
      if not conflicts[value] then
        conflicts[value] = true
        result[#result + 1] = listed[value]
      end
    end
  elseif current ~= value then
    redis.call('HDEL', KEYS[5], player)
  end
end
if redis.call('HLEN', KEYS[5]) > 0 then
  redis.call('PEXPIRE', KEYS[5], ARGV[6])
end
return result
`)

// HeartbeatResult reports what a heartbeat found besides the registration.
type HeartbeatResult struct {
	// Conflicts lists the player ids whose name or account someone else
	// holds.
	Conflicts []string
	// Freed counts the names and accounts released because the node
	// restarted under the same id (a new startedAt) while its previous
	// process still held them.
	Freed int
}

// Heartbeat registers or refreshes node and the presence of its players.
func (c *Cluster) Heartbeat(ctx context.Context, node Node, players []contract.OnlinePlayer) (HeartbeatResult, error) {
	encoded, err := json.Marshal(node)
	if err != nil {
		return HeartbeatResult{}, err
	}
	keys := []string{c.nodeKey(node.NodeID), c.nodesKey(), c.nodePlayersKey(node.NodeID), c.nodeEpochKey(node.NodeID),
		c.nodeAccountsKey(node.NodeID)}
	args := []any{string(encoded), NodeTTL.Milliseconds(), PresenceTTL.Milliseconds(), node.NodeID, node.StartedAt,
		nodeStateTTL.Milliseconds(), c.presenceKey(""), c.accountKey("")}
	for _, player := range players {
		folded := FoldName(player.Name)
		keys = append(keys, c.presenceKey(folded))
		args = append(args, presenceValue(node.NodeID, player.PlayerID), folded)
	}
	reply, err := heartbeatScript.Run(ctx, c.rdb, keys, args...).Int64Slice()
	if err != nil {
		return HeartbeatResult{}, fmt.Errorf("heartbeat: %w", err)
	}
	if len(reply) == 0 {
		return HeartbeatResult{}, errors.New("heartbeat: empty script reply")
	}
	result := HeartbeatResult{Freed: int(reply[0])}
	for _, index := range reply[1:] {
		if index >= 0 && index < int64(len(players)) {
			result.Conflicts = append(result.Conflicts, players[index].PlayerID)
		}
	}
	return result, nil
}

// leaveScript removes a node and every name and account it still holds.
// KEYS: node, nodes, node-players, node-epoch, node-accounts.
// ARGV: node id, presence key prefix, account key prefix.
var leaveScript = redis.NewScript(`
local owned = ARGV[1] .. '|'
for _, name in ipairs(redis.call('SMEMBERS', KEYS[3])) do
  local key = ARGV[2] .. name
  local current = redis.call('GET', key)
  if current and string.sub(current, 1, #owned) == owned then
    redis.call('DEL', key)
  end
end
local entries = redis.call('HGETALL', KEYS[5])
for j = 1, #entries, 2 do
  local key = ARGV[3] .. entries[j + 1]
  if redis.call('GET', key) == owned .. entries[j] then
    redis.call('DEL', key)
  end
end
redis.call('DEL', KEYS[1], KEYS[3], KEYS[4], KEYS[5])
redis.call('SREM', KEYS[2], ARGV[1])
return 1
`)

// Leave unregisters a node and frees its nicknames and accounts.
func (c *Cluster) Leave(ctx context.Context, nodeID string) error {
	keys := []string{c.nodeKey(nodeID), c.nodesKey(), c.nodePlayersKey(nodeID), c.nodeEpochKey(nodeID),
		c.nodeAccountsKey(nodeID)}
	if err := leaveScript.Run(ctx, c.rdb, keys, nodeID, c.presenceKey(""), c.accountKey("")).Err(); err != nil {
		return fmt.Errorf("node leave: %w", err)
	}
	return nil
}

// claimScript reserves a nickname and, for an account player, the account:
// a free key or this player's own value is (re)set; a value whose owner node
// is no longer registered is taken over; anything else is refused (the
// account is checked first). Nothing is set unless both can be. The
// claimer's name set, account map and epoch are kept alive at least as long
// as the claimed keys (see heartbeatScript).
// KEYS: presence, node-players, node-epoch, node-accounts[, account].
// ARGV: value, presence TTL ms, node key prefix, folded name, node state TTL
// ms[, player id, account id].
// Returns 1 (claimed), 0 (name taken) or 2 (account online).
var claimScript = redis.NewScript(`
local function heldElsewhere(key)
  local current = redis.call('GET', key)
  if current and current ~= ARGV[1] then
    local owner = string.match(current, '^([^|]+)|')
    if owner and redis.call('EXISTS', ARGV[3] .. owner) == 1 then
      return true
    end
  end
  return false
end
local account = #KEYS >= 5
if account and heldElsewhere(KEYS[5]) then
  return 2
end
if heldElsewhere(KEYS[1]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SADD', KEYS[2], ARGV[4])
redis.call('PEXPIRE', KEYS[2], ARGV[5])
redis.call('PEXPIRE', KEYS[3], ARGV[5])
if account then
  redis.call('SET', KEYS[5], ARGV[1], 'PX', ARGV[2])
  redis.call('HSET', KEYS[4], ARGV[6], ARGV[7])
  redis.call('PEXPIRE', KEYS[4], ARGV[5])
end
return 1
`)

// Presence is one live session's claim: a nickname and, for an account
// player, the account id.
type Presence struct {
	NodeID    string
	PlayerID  string
	Name      string
	AccountID string // empty for guests
}

// ClaimOutcome is the result of ClaimPresence.
type ClaimOutcome int

const (
	Claimed       ClaimOutcome = iota
	NameTaken                  // another live session holds the nickname
	AccountOnline              // another live session holds the account
)

// ClaimPresence reserves the session's nickname and account (when set).
func (c *Cluster) ClaimPresence(ctx context.Context, p Presence) (ClaimOutcome, error) {
	folded := FoldName(p.Name)
	keys := []string{c.presenceKey(folded), c.nodePlayersKey(p.NodeID), c.nodeEpochKey(p.NodeID),
		c.nodeAccountsKey(p.NodeID)}
	args := []any{presenceValue(p.NodeID, p.PlayerID), PresenceTTL.Milliseconds(), c.nodeKey(""), folded,
		nodeStateTTL.Milliseconds()}
	if p.AccountID != "" {
		keys = append(keys, c.accountKey(p.AccountID))
		args = append(args, p.PlayerID, p.AccountID)
	}
	outcome, err := claimScript.Run(ctx, c.rdb, keys, args...).Int()
	if err != nil {
		return NameTaken, fmt.Errorf("presence claim: %w", err)
	}
	switch outcome {
	case 1:
		return Claimed, nil
	case 2:
		return AccountOnline, nil
	}
	return NameTaken, nil
}

// Claim reserves name for nodeID/playerID; false means someone else holds it.
func (c *Cluster) Claim(ctx context.Context, nodeID, playerID, name string) (bool, error) {
	outcome, err := c.ClaimPresence(ctx, Presence{NodeID: nodeID, PlayerID: playerID, Name: name})
	return err == nil && outcome == Claimed, err
}

// releaseScript deletes a presence only if this player still holds it, and
// the player's account key likewise: the given account, or the one the
// node's account map records for the player.
// KEYS: presence, node-players, node-accounts.
// ARGV: value, folded name, player id, account id (may be empty), account
// key prefix.
var releaseScript = redis.NewScript(`
local released = 0
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  released = 1
end
local mapped = redis.call('HGET', KEYS[3], ARGV[3])
local account = ARGV[4]
if account == '' and mapped then
  account = mapped
end
if account ~= '' and redis.call('GET', ARGV[5] .. account) == ARGV[1] then
  redis.call('DEL', ARGV[5] .. account)
end
if mapped and mapped == account then
  redis.call('HDEL', KEYS[3], ARGV[3])
end
return released
`)

// ReleasePresence frees the session's nickname and account if it still
// holds them.
func (c *Cluster) ReleasePresence(ctx context.Context, p Presence) error {
	folded := FoldName(p.Name)
	err := releaseScript.Run(ctx, c.rdb,
		[]string{c.presenceKey(folded), c.nodePlayersKey(p.NodeID), c.nodeAccountsKey(p.NodeID)},
		presenceValue(p.NodeID, p.PlayerID), folded, p.PlayerID, p.AccountID, c.accountKey("")).Err()
	if err != nil {
		return fmt.Errorf("presence release: %w", err)
	}
	return nil
}

// Release frees name (and the player's mapped account) if nodeID/playerID
// still holds it.
func (c *Cluster) Release(ctx context.Context, nodeID, playerID, name string) error {
	return c.ReleasePresence(ctx, Presence{NodeID: nodeID, PlayerID: playerID, Name: name})
}

// replacedOwner owns the presence keys of a session that a newer login
// replaced. It is not a valid node id, so no node key ever exists for it:
// claims treat the keys as free, while the node still serving the old
// session sees them held elsewhere at its next heartbeat and closes it.
const replacedOwner = "!replaced"

// replaceScript hands an account's live game session over to a newer
// login: the account key, and the nickname key when the same session holds
// it, get the replacedOwner value.
// KEYS: account, presence. ARGV: replaced value, presence TTL ms, the
// replacedOwner prefix ("!replaced|").
// Returns 1 when a live session was marked.
var replaceScript = redis.NewScript(`
local current = redis.call('GET', KEYS[1])
if not current or string.sub(current, 1, #ARGV[3]) == ARGV[3] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
if redis.call('GET', KEYS[2]) == current then
  redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[2])
end
return 1
`)

// ReplaceAccount ends the account's live game session, if any, on behalf of
// a newer login (single sign-on): the node serving it disconnects it at its
// next heartbeat (contract.HeartbeatResponse.Conflicts), and the new
// session can claim the account and nickname at once. nickname is the
// account's current nickname.
func (c *Cluster) ReplaceAccount(ctx context.Context, accountID, nickname string) (bool, error) {
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return false, err
	}
	value := replacedOwner + "|" + hex.EncodeToString(nonce)
	marked, err := replaceScript.Run(ctx, c.rdb, []string{c.accountKey(accountID), c.presenceKey(FoldName(nickname))},
		value, PresenceTTL.Milliseconds(), replacedOwner+"|").Int()
	if err != nil {
		return false, fmt.Errorf("replace account presence: %w", err)
	}
	return marked == 1, nil
}

// onlineScript reports whether a nickname is held by a registered node.
// KEYS: presence. ARGV: node key prefix.
var onlineScript = redis.NewScript(`
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local owner = string.match(current, '^([^|]+)|')
if owner and redis.call('EXISTS', ARGV[1] .. owner) == 1 then return 1 end
return 0
`)

// NameOnline reports whether name is in use on a live game node. A claim
// whose node vanished does not count: the next claim would take it over.
func (c *Cluster) NameOnline(ctx context.Context, name string) (bool, error) {
	online, err := onlineScript.Run(ctx, c.rdb, []string{c.presenceKey(FoldName(name))}, c.nodeKey("")).Int()
	if err != nil {
		return false, fmt.Errorf("presence lookup: %w", err)
	}
	return online == 1, nil
}

// AccountsInGame reports which of ids hold a game-node presence
// (presence-account:{id}) whose node is still registered: the same "node
// must still exist" rule as NameOnline. Only accounts in game are listed.
func (c *Cluster) AccountsInGame(ctx context.Context, ids []string) (map[string]bool, error) {
	inGame := map[string]bool{}
	if len(ids) == 0 {
		return inGame, nil
	}
	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = c.accountKey(id)
	}
	values, err := c.rdb.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("account presence lookup: %w", err)
	}
	owners := map[string][]string{} // node id -> accounts it holds
	for i, value := range values {
		text, ok := value.(string)
		if !ok {
			continue
		}
		if node, _, found := strings.Cut(text, "|"); found && node != "" {
			owners[node] = append(owners[node], ids[i])
		}
	}
	if len(owners) == 0 {
		return inGame, nil
	}
	nodes := slices.Sorted(maps.Keys(owners))
	nodeKeys := make([]string, len(nodes))
	for i, node := range nodes {
		nodeKeys[i] = c.nodeKey(node)
	}
	registered, err := c.rdb.MGet(ctx, nodeKeys...).Result()
	if err != nil {
		return nil, fmt.Errorf("account presence lookup: %w", err)
	}
	for i, value := range registered {
		if value == nil {
			continue // the node vanished; its claims are stale
		}
		for _, id := range owners[nodes[i]] {
			inGame[id] = true
		}
	}
	return inGame, nil
}

// Node returns one live node.
func (c *Cluster) Node(ctx context.Context, nodeID string) (Node, bool, error) {
	value, err := c.rdb.Get(ctx, c.nodeKey(nodeID)).Result()
	if errors.Is(err, redis.Nil) {
		return Node{}, false, nil
	} else if err != nil {
		return Node{}, false, fmt.Errorf("node lookup: %w", err)
	}
	var node Node
	if err := json.Unmarshal([]byte(value), &node); err != nil {
		return Node{}, false, fmt.Errorf("decode node %s: %w", nodeID, err)
	}
	return node, true, nil
}

// pruneScript removes node ids whose registration expired.
// KEYS: nodes, node keys... ARGV: node ids (same order as the node keys).
var pruneScript = redis.NewScript(`
for i = 2, #KEYS do
  if redis.call('EXISTS', KEYS[i]) == 0 then
    redis.call('SREM', KEYS[1], ARGV[i - 1])
  end
end
return 1
`)

// Nodes lists the live nodes ordered by name, then id, and drops expired
// ids from the node set.
func (c *Cluster) Nodes(ctx context.Context) ([]Node, error) {
	ids, err := c.rdb.SMembers(ctx, c.nodesKey()).Result()
	if err != nil {
		return nil, fmt.Errorf("node list: %w", err)
	}
	nodes := []Node{}
	if len(ids) == 0 {
		return nodes, nil
	}
	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = c.nodeKey(id)
	}
	values, err := c.rdb.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("node list: %w", err)
	}
	var expiredKeys []string
	var expiredIDs []any
	for i, value := range values {
		text, ok := value.(string)
		if !ok {
			expiredKeys = append(expiredKeys, keys[i])
			expiredIDs = append(expiredIDs, ids[i])
			continue
		}
		var node Node
		if err := json.Unmarshal([]byte(text), &node); err != nil {
			return nil, fmt.Errorf("decode node %s: %w", ids[i], err)
		}
		nodes = append(nodes, node)
	}
	if len(expiredKeys) > 0 {
		// Re-checked inside the script: a node may have re-registered meanwhile.
		if err := pruneScript.Run(ctx, c.rdb, append([]string{c.nodesKey()}, expiredKeys...), expiredIDs...).Err(); err != nil {
			return nil, fmt.Errorf("node prune: %w", err)
		}
	}
	slices.SortFunc(nodes, func(a, b Node) int {
		return cmp.Or(cmp.Compare(a.Name, b.Name), cmp.Compare(a.NodeID, b.NodeID))
	})
	return nodes, nil
}
