package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"kartsim/internal/data/cache"
	"kartsim/internal/data/store"
	"kartsim/internal/shared/apierr"
	"kartsim/internal/shared/contract"
	"kartsim/internal/shared/rewards"
)

const (
	maxHeartbeatPlayers = 10_000
	maxRaceResults      = 100
	// maxRoomRacers is the largest room a game node opens (room capacity
	// 2-8), so the most racers one reward formula can count.
	maxRoomRacers = 8
	// staleSettlement is how long after its finish a race still earns
	// rewards. Every reward counts against the data service's current
	// Beijing day; an older settlement (an outbox delivery after a long
	// outage, or a node clock far behind) is stored without crediting.
	staleSettlement = 24 * time.Hour
	// maxSettlementRate is the largest exp or lucci rate a settlement may
	// carry (contract RaceSettlement.ExpRate/LucciRate) unless the configured
	// rate is larger; anything else falls back to the configured rate.
	maxSettlementRate = 10
	// lateReleaseTimeout bounds the release of a claim whose caller gave up.
	lateReleaseTimeout = 2 * time.Second
	maxRoomRulesBytes  = 65_535 // room_rules.json is TEXT
	maxLoggedConflicts = 20
	// clockSkewWarning is how far ahead of the data service a game node's
	// timestamp may be before it is logged (it is clamped either way).
	clockSkewWarning = 60_000
)

var (
	errClusterKeyInvalid = apierr.New(http.StatusUnauthorized, "CLUSTER_KEY_INVALID")
	errInvalidNodeID     = apierr.New(http.StatusBadRequest, "INVALID_NODE_ID")
	errInvalidHeartbeat  = apierr.New(http.StatusBadRequest, "INVALID_HEARTBEAT")
	errInvalidPlayerID   = apierr.New(http.StatusBadRequest, "INVALID_PLAYER_ID")
	errNicknameTaken     = apierr.New(http.StatusConflict, "NICKNAME_TAKEN")
	errAccountOnline     = apierr.New(http.StatusConflict, "ACCOUNT_ONLINE")
	errInvalidRoomRules  = apierr.New(http.StatusBadRequest, "INVALID_ROOM_RULES")
	errInvalidSettlement = apierr.New(http.StatusBadRequest, "INVALID_SETTLEMENT")
)

// maxRaceReward is the largest base reward one racer can earn in one race
// (ECONOMY.md 2.1): the winner of a full room on the winning team of a
// *Combine channel, before rates (exp 145, lucci 216). A larger entry is a
// game node bug and is not credited.
var maxRaceReward = func() rewards.Reward {
	racers := make([]rewards.Racer, maxRoomRacers)
	for i := range racers {
		racers[i] = rewards.Racer{PlayerID: strconv.Itoa(i), Rank: i + 1, Finished: true, Team: 1 + i%2}
	}
	var most rewards.Reward
	for _, reward := range rewards.RaceRewards(rewards.RaceInput{Channel: "speedTeamCombine", Mode: rewards.ModeTeam,
		WinningTeam: 1, Racers: racers, Rates: rewards.DefaultRates()}) {
		most.Exp, most.Lucci = max(most.Exp, reward.Exp), max(most.Lucci, reward.Lucci)
	}
	return most
}()

// InternalHandler serves the game-node API. Every call needs the cluster key.
func (a *API) InternalHandler() http.Handler {
	mux := http.NewServeMux()
	route := func(path string, handler handlerFunc) { mux.Handle("POST "+path, a.serve(handler)) }
	route(contract.PathHeartbeat, a.heartbeat)
	route(contract.PathNodeLeave, a.nodeLeave)
	route(contract.PathPresenceClaim, a.presenceClaim)
	route(contract.PathPresenceRelease, a.presenceRelease)
	route(contract.PathRoomRules, a.saveRoomRules)
	route(contract.PathRaces, a.saveRace)
	route(contract.PathEquipmentVerify, a.verifyEquipment)

	routes := jsonFallback(mux)
	expected := sha256.Sum256(a.secret)
	return recoverPanics(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Comparing digests keeps the comparison constant-time for any key length.
		given := sha256.Sum256([]byte(r.Header.Get(contract.ClusterKeyHeader)))
		if len(a.secret) == 0 || subtle.ConstantTimeCompare(given[:], expected[:]) != 1 {
			apierr.WriteError(w, errClusterKeyInvalid)
			return
		}
		routes.ServeHTTP(w, r)
	}))
}

// normalizeNodeOrigin accepts "" or an http(s) origin without a path.
func normalizeNodeOrigin(value string) (string, bool) {
	if value == "" {
		return "", true
	}
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
		parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" ||
		parsed.Fragment != "" {
		return "", false
	}
	return parsed.Scheme + "://" + parsed.Host, true
}

func (a *API) heartbeat(w http.ResponseWriter, r *http.Request) error {
	var request contract.HeartbeatRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validNodeID(request.NodeID) {
		return errInvalidNodeID
	}
	name := strings.TrimSpace(request.Name)
	if name == "" {
		name = request.NodeID
	}
	origin, validOrigin := normalizeNodeOrigin(request.Origin)
	if !validText(name, 64) || !validOrigin || request.Capacity < 0 || request.Rooms < 0 ||
		len(request.Players) > maxHeartbeatPlayers {
		return errInvalidHeartbeat
	}
	for _, player := range request.Players {
		if !validASCIIID(player.PlayerID, 64) || !validText(player.Name, 64) {
			return errInvalidHeartbeat
		}
	}
	now := a.nowMillis()
	result, err := a.cluster.Heartbeat(r.Context(), cache.Node{
		NodeID:          request.NodeID,
		Name:            name,
		Origin:          origin,
		Capacity:        request.Capacity,
		Rooms:           request.Rooms,
		Players:         len(request.Players),
		StartedAt:       request.StartedAt,
		ProtocolVersion: request.ProtocolVersion,
		SeenAt:          now,
	}, request.Players)
	if err != nil {
		a.log.Warn("heartbeat not stored", "node", request.NodeID, "error", err)
		return errServiceUnavailable
	}
	if result.Freed > 0 {
		a.log.Info("game node restarted; released the names of its previous process", "node", request.NodeID,
			"names", result.Freed)
	}
	if len(result.Conflicts) > 0 {
		a.log.Warn("heartbeat lists players whose names are held elsewhere", "node", request.NodeID,
			"conflicts", len(result.Conflicts), "players", result.Conflicts[:min(len(result.Conflicts), maxLoggedConflicts)])
	}
	expRate, lucciRate := a.rates.Exp, a.rates.Lucci
	return writeJSON(w, http.StatusOK, contract.HeartbeatResponse{Accepted: true, DataNode: a.dataNode, ServerTime: now,
		Conflicts: result.Conflicts, ExpRate: &expRate, LucciRate: &lucciRate})
}

func (a *API) nodeLeave(w http.ResponseWriter, r *http.Request) error {
	var request contract.NodeLeaveRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validNodeID(request.NodeID) {
		return errInvalidNodeID
	}
	if err := a.cluster.Leave(r.Context(), request.NodeID); err != nil {
		a.log.Warn("node leave not stored", "node", request.NodeID, "error", err)
		return errServiceUnavailable
	}
	// Nodes send this when they stop and again when they start (to drop what
	// a crashed predecessor registered), so it does not mean the node is gone.
	a.log.Info("game node registration reset; its nickname claims were released", "node", request.NodeID)
	return writeJSON(w, http.StatusOK, contract.OK{OK: true})
}

func (a *API) presenceClaim(w http.ResponseWriter, r *http.Request) error {
	var request contract.PresenceClaimRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validNodeID(request.NodeID) {
		return errInvalidNodeID
	}
	if !validASCIIID(request.PlayerID, 64) {
		return errInvalidPlayerID
	}
	if request.AccountID != "" && (request.Guest || !validASCIIID(request.AccountID, 36)) {
		return errInvalidAccountID
	}
	if request.Guest {
		if !validName(&request.Name, 18) {
			return errInvalidGuestName
		}
		taken, err := a.store.NicknameTaken(r.Context(), request.Name)
		if err != nil {
			return err
		}
		if taken {
			return errNicknameTaken
		}
	} else if !validText(request.Name, 64) {
		return errInvalidName
	}
	presence := cache.Presence{NodeID: request.NodeID, PlayerID: request.PlayerID, Name: request.Name,
		AccountID: request.AccountID}
	outcome, err := a.cluster.ClaimPresence(r.Context(), presence)
	if r.Context().Err() != nil && (outcome == cache.Claimed || err != nil) {
		// The game node gave up waiting (and treats the claim as failed), but
		// the script may have run: release it, or the name and account stay
		// locked until they expire. The release only deletes this player's
		// own values.
		a.releaseLateClaim(r.Context(), presence)
		return errServiceUnavailable
	}
	if err != nil {
		a.log.Warn("presence claim unavailable", "node", request.NodeID, "error", err)
		return errServiceUnavailable
	}
	switch outcome {
	case cache.AccountOnline:
		return errAccountOnline
	case cache.NameTaken:
		return errNicknameTaken
	}
	if request.AccountID != "" {
		a.hub.GameChanged(request.AccountID) // friends see "inGame"
	}
	return writeJSON(w, http.StatusOK, contract.OK{OK: true})
}

// releaseLateClaim frees a claim whose request was canceled.
func (a *API) releaseLateClaim(ctx context.Context, request cache.Presence) {
	releaseCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), lateReleaseTimeout)
	defer cancel()
	if err := a.cluster.ReleasePresence(releaseCtx, request); err != nil {
		a.log.Warn("late presence claim not released; it expires on its own", "node", request.NodeID,
			"player", request.PlayerID, "error", err)
		return
	}
	a.log.Info("released a presence claim whose request was canceled", "node", request.NodeID, "player", request.PlayerID)
}

func (a *API) presenceRelease(w http.ResponseWriter, r *http.Request) error {
	var request contract.PresenceReleaseRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validNodeID(request.NodeID) {
		return errInvalidNodeID
	}
	if !validASCIIID(request.PlayerID, 64) {
		return errInvalidPlayerID
	}
	if !validText(request.Name, 64) {
		return errInvalidName
	}
	if request.AccountID != "" && !validASCIIID(request.AccountID, 36) {
		return errInvalidAccountID
	}
	if err := a.cluster.ReleasePresence(r.Context(), cache.Presence{NodeID: request.NodeID, PlayerID: request.PlayerID,
		Name: request.Name, AccountID: request.AccountID}); err != nil {
		a.log.Warn("presence release unavailable", "node", request.NodeID, "error", err)
		return errServiceUnavailable
	}
	if request.AccountID != "" {
		a.hub.GameChanged(request.AccountID)
	}
	return writeJSON(w, http.StatusOK, contract.OK{OK: true})
}

// compactObject validates a JSON object and returns its compact text.
func compactObject(raw json.RawMessage) (string, bool) {
	var compact bytes.Buffer
	if len(raw) == 0 || !utf8.Valid(raw) || json.Compact(&compact, raw) != nil ||
		compact.Len() == 0 || compact.Bytes()[0] != '{' {
		return "", false
	}
	return compact.String(), true
}

func (a *API) saveRoomRules(w http.ResponseWriter, r *http.Request) error {
	var request contract.RoomRulesRequest
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validNodeID(request.NodeID) {
		return errInvalidNodeID
	}
	rules, ok := compactObject(request.Rules)
	if !ok || !validASCIIID(request.RoomID, 64) || len(rules) > maxRoomRulesBytes || request.UpdatedAt <= 0 {
		return errInvalidRoomRules
	}
	// Game nodes stamp updates with their own clocks. A timestamp from a fast
	// clock is clamped to ours: stored as is, it would make every later update
	// of the room look older and be ignored until real time caught up.
	updatedAt := a.clampNodeTime(request.NodeID, "room rules", request.UpdatedAt)
	if err := a.store.SaveRoomRules(r.Context(), request.RoomID, rules, updatedAt); err != nil {
		return err
	}
	a.cache.BumpHistory(r.Context())
	return writeJSON(w, http.StatusOK, contract.OK{OK: true})
}

// clampNodeTime limits a game node's timestamp to the data service clock,
// so no stored row is dated in the future (Java stamped rows with its own
// clock). Earlier values, such as delayed outbox deliveries, are kept.
func (a *API) clampNodeTime(nodeID, what string, value int64) int64 {
	now := a.nowMillis()
	if value <= now {
		return value
	}
	if value-now > clockSkewWarning {
		a.log.Warn("game node clock is ahead of the data service; timestamp clamped", "node", nodeID,
			"what", what, "aheadMs", value-now)
	}
	return now
}

func fitsInt32(value int) bool { return value >= math.MinInt32 && value <= math.MaxInt32 }

// settlementFromRequest validates a settlement against the column limits,
// so INSERT IGNORE can only ever skip duplicates.
func settlementFromRequest(request contract.RaceSettlement, now int64) (store.Settlement, bool) {
	snapshot, ok := compactObject(request.Snapshot)
	if !ok || !validASCIIID(request.RaceID, 64) || !validASCIIID(request.RoomID, 64) ||
		!validASCIIID(request.Gameplay, 20) || utf8.RuneCountInString(request.TrackID) > 64 ||
		len(request.Results) > maxRaceResults || len(request.Rewards) > maxRaceResults {
		return store.Settlement{}, false
	}
	createdAt := request.FinishedAt
	if createdAt <= 0 || createdAt > now {
		createdAt = now
	}
	settlement := store.Settlement{
		RaceID:    request.RaceID,
		RoomID:    request.RoomID,
		Gameplay:  request.Gameplay,
		TrackID:   request.TrackID,
		Snapshot:  snapshot,
		CreatedAt: createdAt,
		Results:   make([]store.SettledResult, 0, len(request.Results)),
	}
	teams := raceClass(&settlement, request)
	for _, result := range request.Results {
		name := result.Name
		if name == "" {
			name = result.PlayerID // Java stored the player id when the member was gone
		}
		if !validASCIIID(result.PlayerID, 64) || utf8.RuneCountInString(name) > 64 ||
			(result.AccountID != "" && !validASCIIID(result.AccountID, 36)) ||
			!fitsInt32(result.Rank) || !fitsInt32(result.Points) ||
			(result.ElapsedMs != nil && !fitsInt32(*result.ElapsedMs)) {
			return store.Settlement{}, false
		}
		settlement.Results = append(settlement.Results, store.SettledResult{
			PlayerID:  result.PlayerID,
			AccountID: result.AccountID,
			Name:      name,
			Rank:      result.Rank,
			ElapsedMs: result.ElapsedMs,
			Points:    result.Points,
			Team:      teams[result.PlayerID],
		})
	}
	return settlement, true
}

// raceClass sets what the careers need to classify a race (a team race, an
// infinite-boost channel, the winning team) from the settlement's mode and
// snapshot, and returns each roster player's team. A snapshot without those
// fields counts as an individual speed race.
func raceClass(settlement *store.Settlement, request contract.RaceSettlement) map[string]int {
	var snapshot struct {
		Race struct {
			ChannelName string `json:"channelName"`
			WinningTeam int    `json:"winningTeam"`
			Roster      []struct {
				PlayerID string `json:"playerId"`
				Team     *int   `json:"team"`
			} `json:"roster"`
		} `json:"race"`
	}
	_ = json.Unmarshal(request.Snapshot, &snapshot)
	settlement.Team = request.Mode == "team"
	settlement.Infinite = strings.HasSuffix(snapshot.Race.ChannelName, "Infinit")
	if snapshot.Race.WinningTeam == 1 || snapshot.Race.WinningTeam == 2 {
		settlement.WinningTeam = snapshot.Race.WinningTeam
	}
	teams := make(map[string]int, len(snapshot.Race.Roster))
	for _, member := range snapshot.Race.Roster {
		if member.Team != nil && (*member.Team == 1 || *member.Team == 2) {
			teams[member.PlayerID] = *member.Team
		}
	}
	return teams
}

func (a *API) saveRace(w http.ResponseWriter, r *http.Request) error {
	var request contract.RaceSettlement
	if err := decodeJSON(w, r, &request); err != nil {
		return err
	}
	if !validNodeID(request.NodeID) {
		return errInvalidNodeID
	}
	// A future finish time would pin the race above newer ones in the history.
	request.FinishedAt = a.clampNodeTime(request.NodeID, "race", request.FinishedAt)
	now := a.now()
	settlement, ok := settlementFromRequest(request, now.UnixMilli())
	if !ok {
		return errInvalidSettlement
	}
	// The daily caps count against the data service's own Beijing day, never
	// the node-supplied finish time: a backdated settlement would otherwise
	// find a fresh cap on every past day.
	settlement.RewardDay = rewards.BeijingDay(now)
	if age := time.Duration(now.UnixMilli()-settlement.CreatedAt) * time.Millisecond; age > staleSettlement {
		if len(request.Rewards) > 0 {
			a.log.Warn("race finished too long ago; stored without crediting rewards", "node", request.NodeID,
				"race", request.RaceID, "finishedAt", request.FinishedAt, "age", age.Round(time.Second).String(),
				"rewards", len(request.Rewards))
		}
	} else {
		settlement.Rewards = a.raceRewards(request)
	}
	duplicate, credited, err := a.store.SaveSettlement(r.Context(), settlement)
	if err != nil {
		return err
	}
	if !duplicate {
		a.cache.BumpHistory(r.Context())
		for _, entry := range credited {
			a.log.Debug("race reward credited", "race", settlement.RaceID, "account", entry.AccountID,
				"exp", entry.Exp, "lucci", entry.Lucci, "levelUps", len(entry.LevelUps))
		}
	}
	return writeJSON(w, http.StatusOK, contract.RaceSettlementResponse{Stored: true, Duplicate: duplicate})
}

// raceRewards turns the node's reward list into account credits: guests
// are skipped, the rates applied with rewards.ApplyRate (game nodes settle
// the base amounts of ECONOMY.md 2.1 and show the same scaled numbers, see
// contract.HeartbeatResponse.ExpRate), and malformed entries or entries
// above maxRaceReward dropped with a warning rather than failing the whole
// race (a refused settlement would lose its results too). The rates are the
// ones the node reports it showed (settlementRate), else the configured ones.
func (a *API) raceRewards(request contract.RaceSettlement) []store.SettledReward {
	var credits []store.SettledReward
	var expRate, lucciRate float64
	ratesChosen := false
	for _, reward := range request.Rewards {
		if reward.AccountID == "" {
			continue
		}
		if !validASCIIID(reward.AccountID, 36) || reward.Exp < 0 || reward.Lucci < 0 ||
			int64(reward.Exp) > maxRaceReward.Exp || int64(reward.Lucci) > maxRaceReward.Lucci {
			a.log.Warn("race reward out of range; not credited", "node", request.NodeID, "race", request.RaceID,
				"player", reward.PlayerID, "exp", reward.Exp, "lucci", reward.Lucci,
				"maxExp", maxRaceReward.Exp, "maxLucci", maxRaceReward.Lucci)
			continue
		}
		if !ratesChosen {
			expRate = a.settlementRate(request, "exp", request.ExpRate, a.rates.Exp)
			lucciRate = a.settlementRate(request, "lucci", request.LucciRate, a.rates.Lucci)
			ratesChosen = true
		}
		credits = append(credits, store.SettledReward{
			AccountID: reward.AccountID,
			Exp:       rewards.ApplyRate(int64(reward.Exp), expRate),
			Lucci:     rewards.ApplyRate(int64(reward.Lucci), lucciRate),
		})
	}
	return credits
}

// settlementRate is the rate a settlement's rewards are credited with: the
// one the node used for what it showed, when present and within [0,
// max(maxSettlementRate, configured)], so shown and credited amounts match
// across a rate change; otherwise the configured rate.
func (a *API) settlementRate(request contract.RaceSettlement, what string, reported *float64, configured float64) float64 {
	if reported == nil {
		return configured
	}
	rate := *reported
	if !math.IsNaN(rate) && !math.IsInf(rate, 0) && rate >= 0 && rate <= max(maxSettlementRate, configured) {
		return rate
	}
	a.log.Warn("settlement rate out of range; the configured rate applies", "node", request.NodeID,
		"race", request.RaceID, "rate", what, "reported", rate, "configured", configured)
	return configured
}
