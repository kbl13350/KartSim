// Package contract is the internal API between game nodes and the single
// data service. Only the data service talks to MySQL and Redis; game nodes
// call these endpoints on the data service's internal listener.
//
// Every request is a POST with a JSON body and the header
// ClusterKeyHeader: <KART_CLUSTER_SECRET>. Errors use {"error": code} with
// the HTTP status of the apierr package.
package contract

import (
	"encoding/json"
	"math"
)

const (
	ClusterKeyHeader = "X-Kart-Cluster-Key"

	PathHeartbeat       = "/internal/v1/nodes/heartbeat"
	PathNodeLeave       = "/internal/v1/nodes/leave"
	PathPresenceClaim   = "/internal/v1/presence/claim"
	PathPresenceRelease = "/internal/v1/presence/release"
	PathRoomRules       = "/internal/v1/room-rules"
	PathRaces           = "/internal/v1/races"
	PathEquipmentVerify = "/internal/v1/equipment/verify"

	ProtocolVersion = 39
	Ruleset         = "launcher-room-v1"
)

// OnlinePlayer is one hello'd WebSocket session on a game node.
type OnlinePlayer struct {
	PlayerID string `json:"playerId"`
	Name     string `json:"name"`
	// Room is the name of the room the player is in; absent in the lobby
	// and from older nodes (shown by the admin console only).
	Room string `json:"room,omitempty"`
	// AccountID is the account the player claimed at hello; absent for
	// guests and from older nodes. The data service rebuilds the node's
	// account mapping from it when Redis lost it (a restart or a flush).
	AccountID string `json:"accountId,omitempty"`
}

// HeartbeatRequest registers or refreshes a game node (every 5 s). Origin is
// the public HTTP(S) origin browsers use for the node's WebSocket; empty means
// "same origin as the data service" (a reverse proxy routes /multiplayer/ws).
type HeartbeatRequest struct {
	NodeID          string         `json:"nodeId"`
	Name            string         `json:"name"`
	Origin          string         `json:"origin"`
	Capacity        int            `json:"capacity"`
	Rooms           int            `json:"rooms"`
	Players         []OnlinePlayer `json:"players"`
	StartedAt       int64          `json:"startedAt"`
	ProtocolVersion int            `json:"protocolVersion"`
	// Stats are the node's load figures for the admin console; absent from
	// older nodes.
	Stats *NodeStats `json:"stats,omitempty"`
}

// NodeStats are a game node's process and load figures (ADMIN.md 2): the
// live heap, goroutines, open client connections, rooms currently racing
// (loading, countdown or racing) and the build version. HeapMB is rounded
// to 0.1 MB; older nodes send whole numbers, which decode the same. (A data
// service older than this field's float type refuses a fractional value,
// so data services are updated before game nodes.)
type NodeStats struct {
	HeapMB      float64 `json:"heapMB"`
	Goroutines  int     `json:"goroutines"`
	Connections int     `json:"connections"`
	Races       int     `json:"races"`
	Version     string  `json:"version"`
}

// RoundMB is a byte count in MB rounded to 0.1 (NodeStats.HeapMB and the
// data service's own heap), so an idle process shows 0.6 MB instead of 0.
func RoundMB(bytes uint64) float64 {
	return math.Round(float64(bytes)/(1<<20)*10) / 10
}

// HeartbeatResponse confirms the registration.
type HeartbeatResponse struct {
	Accepted   bool   `json:"accepted"`
	DataNode   string `json:"dataNode"`
	ServerTime int64  `json:"serverTime"`
	// Conflicts lists player IDs from the request whose nickname claim is
	// now held by another node (e.g. after this node's registration lapsed).
	// The node must disconnect those sessions.
	Conflicts []string `json:"conflicts,omitempty"`
	// ExpRate and LucciRate are the data service's KART_EXP_RATE and
	// KART_LUCCI_RATE. RaceSettlement.Rewards stay the base amounts (the data
	// service applies the rates when it credits them); the node multiplies
	// the race.rewards it shows players by the latest rates it received
	// (rewards.ApplyRate), so they see what is credited. Absent from an older
	// data service: the node keeps showing base amounts (rates 1).
	ExpRate   *float64 `json:"expRate,omitempty"`
	LucciRate *float64 `json:"lucciRate,omitempty"`
}

// NodeLeaveRequest removes a node and its presence claims on shutdown.
type NodeLeaveRequest struct {
	NodeID string `json:"nodeId"`
}

// PresenceClaimRequest reserves a live nickname cluster-wide at hello.
// Guest claims are also checked against account nicknames.
// Errors: 400 INVALID_GUEST_NAME, 400 INVALID_ACCOUNT_ID (malformed id, or
// a guest claim carrying one), 409 NICKNAME_TAKEN, 409 ACCOUNT_ONLINE.
type PresenceClaimRequest struct {
	NodeID   string `json:"nodeId"`
	PlayerID string `json:"playerId"`
	Name     string `json:"name"`
	Guest    bool   `json:"guest"`
	// AccountID, for account players, is also reserved cluster-wide so one
	// account has at most one live session (409 ACCOUNT_ONLINE otherwise),
	// even after a rename.
	AccountID string `json:"accountId,omitempty"`
}

// PresenceReleaseRequest frees the nickname when the WebSocket closes.
type PresenceReleaseRequest struct {
	NodeID    string `json:"nodeId"`
	PlayerID  string `json:"playerId"`
	Name      string `json:"name"`
	AccountID string `json:"accountId,omitempty"`
}

// OK is the body of a successful call without other data.
type OK struct {
	OK bool `json:"ok"`
}

// RoomRulesRequest upserts the saved rules of one room. UpdatedAt is Unix
// milliseconds; an older update never overwrites a newer one.
type RoomRulesRequest struct {
	NodeID    string          `json:"nodeId"`
	RoomID    string          `json:"roomId"`
	Rules     json.RawMessage `json:"rules"`
	UpdatedAt int64           `json:"updatedAt"`
}

// RaceResult is one ranked racer of a finished race.
type RaceResult struct {
	PlayerID  string `json:"playerId"`
	AccountID string `json:"accountId,omitempty"`
	Name      string `json:"name"`
	Rank      int    `json:"rank"`
	ElapsedMs *int   `json:"elapsedMs"`
	Points    int    `json:"points"`
	// DistanceMeters is how far along the track the racer got: the
	// furthest route progress its motion frames reported while racing,
	// bounded by the time since the start (the distance careers).
	DistanceMeters int `json:"distanceMeters,omitempty"`
	// Titles are an item race racer's result titles (rewrite/ITEM_MODE.md
	// C.9: perfectAim, ironWall, …), as race.results shows them.
	Titles []string `json:"titles,omitempty"`
}

// RaceSettlement is sent once per finished race. Snapshot is the outcome
// document stored in race_outcomes ({"roomId","mode","gameplay","race"}).
// The data service stores it idempotently by RaceID.
type RaceSettlement struct {
	NodeID   string          `json:"nodeId"`
	RaceID   string          `json:"raceId"`
	RoomID   string          `json:"roomId"`
	Mode     string          `json:"mode"`
	Gameplay string          `json:"gameplay"`
	TrackID  string          `json:"trackId"`
	Snapshot json.RawMessage `json:"snapshot"`
	Results  []RaceResult    `json:"results"`
	// Rewards holds one entry per racer the node rewarded, computed with
	// internal/shared/rewards (ECONOMY.md 2.1) for every gameplay mode,
	// including roadblock races that have no ranked Results. The data
	// service credits AccountID entries, applying daily caps and level-ups.
	Rewards []RaceReward `json:"rewards,omitempty"`
	// ExpRate and LucciRate are the rates the node used for the rewards it
	// showed players (from its latest heartbeat). The data service credits
	// with them when present and within its allowed range, so the shown and
	// credited amounts match even if the configured rates changed meanwhile.
	ExpRate    *float64 `json:"expRate,omitempty"`
	LucciRate  *float64 `json:"lucciRate,omitempty"`
	FinishedAt int64    `json:"finishedAt"`
	// Consumed are the consumables racers used up in the race (an item
	// race's changer cards, rewrite/ITEM_MODE.md C.6). The data service
	// takes them from the accounts' inventories in the settlement's
	// transaction (never below 0, once per RaceID).
	Consumed []ConsumedItem `json:"consumed,omitempty"`
}

// RaceReward is the experience and lucci one racer earned in a race.
type RaceReward struct {
	PlayerID  string `json:"playerId"`
	AccountID string `json:"accountId,omitempty"`
	Exp       int    `json:"exp"`
	Lucci     int    `json:"lucci"`
	// BonusLucci is an item race's in-race lucci (rewrite/ITEM_MODE.md C.8,
	// at most MaxBonusLucci): credited on top of Lucci, without the rate
	// (race.rewards shows the sum).
	BonusLucci int `json:"bonusLucci,omitempty"`
}

// MaxBonusLucci bounds a racer's in-race lucci in one race.
const MaxBonusLucci = 200

// The item changer cards (category 7 slotChanger, rewrite/ITEM_MODE.md C.6).
const (
	CategoryChanger = 7
	// ItemSlotChanger is the 道具换位卡 (counted), ItemItemChanger the
	// 道具变更卡 (counted); ItemItemVoucher the 道具变更卡使用券 and
	// ItemSlotVoucher the 道具换位卡使用券 (rentals: unlimited while valid).
	ItemSlotChanger = 1
	ItemItemChanger = 2
	ItemItemVoucher = 3
	ItemSlotVoucher = 4
)

// ConsumedItem is how many of an inventory item one racer used up.
type ConsumedItem struct {
	PlayerID  string `json:"playerId"`
	AccountID string `json:"accountId"`
	Category  int    `json:"category"`
	ItemID    int    `json:"itemId"`
	Count     int    `json:"count"`
}

// RaceSettlementResponse reports whether the race was new.
type RaceSettlementResponse struct {
	Stored    bool `json:"stored"`
	Duplicate bool `json:"duplicate"`
}

// GameServer is one entry of the public GET /multiplayer/game-servers list.
// Origin is null when the node is reached through the data service origin.
type GameServer struct {
	NodeID   string  `json:"nodeId"`
	Name     string  `json:"name"`
	Origin   *string `json:"origin"`
	Players  int     `json:"players"`
	Rooms    int     `json:"rooms"`
	Capacity int     `json:"capacity"`
	Full     bool    `json:"full"`
}

// GameServerList is the body of GET /multiplayer/game-servers.
type GameServerList struct {
	DataNode string       `json:"dataNode"`
	Servers  []GameServer `json:"servers"`
}

// TicketRequest is the body of POST /multiplayer/game-servers/ticket.
type TicketRequest struct {
	NodeID string `json:"nodeId"`
}

// TicketResponse hands the browser a one-time entry ticket for one node.
type TicketResponse struct {
	Ticket    string  `json:"ticket"`
	NodeID    string  `json:"nodeId"`
	Origin    *string `json:"origin"`
	DataNode  string  `json:"dataNode"`
	ExpiresAt int64   `json:"expiresAt"`
}

// EquipmentVerifyRequest asks whether an account owns every non-zero item in
// an equipment document (the multiplayer hello/create/join/equipment JSON).
// Game nodes call it before admitting equipment into a room.
type EquipmentVerifyRequest struct {
	AccountID string          `json:"accountId"`
	Equipment json.RawMessage `json:"equipment"`
}

// EquipmentSlot names one equipped item the account does not own.
type EquipmentSlot struct {
	Slot   int `json:"slot"`
	ItemID int `json:"itemId"`
}

// EquipmentVerifyResponse is 200 with OK=true, or 409 ITEM_NOT_OWNED with
// the offending slots in Missing.
type EquipmentVerifyResponse struct {
	OK      bool            `json:"ok"`
	Missing []EquipmentSlot `json:"missing,omitempty"`
	// ValidUntil is the earliest expiry (Unix ms) among the checked items
	// that are rentals; absent when all are permanent. A node must not reuse
	// a positive answer after this time.
	ValidUntil *int64 `json:"validUntil,omitempty"`
	// Changers are the account's item changer cards, which an item race
	// reads from the check made at its start.
	Changers *Changers `json:"changers,omitempty"`
}

// Changers are an account's item changer cards (rewrite/ITEM_MODE.md C.6):
// Slot the 道具换位卡 (7:1) count and Item the 道具变更卡 (7:2) count, each
// -1 while the account holds an unexpired voucher (7:4 / 7:3), whose expiry
// (Unix ms; absent for a permanent one) is SlotUntil / ItemUntil.
type Changers struct {
	Slot      int    `json:"slot"`
	Item      int    `json:"item"`
	SlotUntil *int64 `json:"slotUntil,omitempty"`
	ItemUntil *int64 `json:"itemUntil,omitempty"`
}
