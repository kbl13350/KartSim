package lobby

import (
	"encoding/json"
	"slices"

	"kartsim/internal/game/cheat"
	"kartsim/internal/game/itemmode"
	"kartsim/internal/shared/rewards"
)

// room is the authoritative in-memory room (Room.java). Only rules and race
// settlements leave the node, through the Recorder.
type room struct {
	id              string
	name            string
	password        string
	mode            string
	channelName     string
	gameplay        string
	resourceVersion string
	capacity        int
	speed           int
	hostID          string
	phase           string
	trackID         string // "" is Java null
	randomTrackCode *int
	revision        int
	raceError       string // "" is Java null
	race            *race
	kickVote        *kickVote
	members         []*member
	chat            []obj
	chatSequence    int
	closedSlots     []int
}

func newRoom(id, name, password, mode, channelName, gameplay, resourceVersion string,
	capacity, speed int, hostID string) *room {
	return &room{
		id: id, name: name, password: password, mode: mode, channelName: channelName,
		gameplay: gameplay, resourceVersion: resourceVersion, capacity: capacity,
		speed: speed, hostID: hostID, phase: "open", trackID: "village_R01", revision: 1,
	}
}

func (r *room) member(playerID string) *member {
	for _, m := range r.members {
		if m.playerID == playerID {
			return m
		}
	}
	return nil
}

func (r *room) removeMember(playerID string) {
	kept := r.members[:0]
	for _, m := range r.members {
		if m.playerID != playerID {
			kept = append(kept, m)
		}
	}
	clear(r.members[len(kept):])
	r.members = kept
}

func (r *room) summary() obj {
	value := obj{
		{"roomId", r.id},
		{"name", r.name},
		{"mode", r.mode},
		{"capacity", r.capacity},
		{"speedVersion", "国服"},
		{"channelName", r.channelName},
		{"speed", r.speed},
		{"gameplay", r.gameplay},
		{"resourceVersion", r.resourceVersion},
		{"count", len(r.members)},
		{"locked", r.password != ""},
		{"gaming", r.phase != "open"},
	}
	if r.trackID != "" {
		value = append(value, field{"trackId", r.trackID})
	}
	if r.randomTrackCode != nil {
		value = append(value, field{"randomTrackCode", *r.randomTrackCode})
	}
	return value
}

func (r *room) snapshot() obj {
	value := obj{
		{"roomId", r.id},
		{"revision", r.revision},
		{"name", r.name},
		{"mode", r.mode},
		{"capacity", r.capacity},
		{"speedVersion", "国服"},
		{"channelName", r.channelName},
		{"speed", r.speed},
		{"gameplay", r.gameplay},
		{"resourceVersion", r.resourceVersion},
		{"hostId", r.hostID},
		{"phase", r.phase},
	}
	if r.trackID != "" {
		value = append(value, field{"trackId", r.trackID})
	}
	if r.randomTrackCode != nil {
		value = append(value, field{"randomTrackCode", *r.randomTrackCode})
	}
	value = append(value, field{"locked", r.password != ""})
	members := make([]obj, len(r.members))
	for i, m := range r.members {
		members[i] = m.snapshot()
	}
	value = append(value, field{"members", members})
	if len(r.chat) > 0 {
		value = append(value, field{"chat", append([]obj(nil), r.chat...)})
	}
	if len(r.closedSlots) > 0 {
		value = append(value, field{"closedSlots", append([]int(nil), r.closedSlots...)})
	}
	if r.raceError != "" {
		value = append(value, field{"raceError", r.raceError})
	}
	if r.kickVote != nil {
		value = append(value, field{"kickVote", r.kickVote.snapshot()})
	}
	if r.race != nil {
		value = append(value, field{"race", r.race.snapshot()})
	}
	return value
}

// kickVote is a running vote to remove targetID from the room.
type kickVote struct {
	id          string
	targetID    string
	eligibleIDs []string
	yesIDs      []string
	noIDs       []string
	deadline    int64
}

func (v *kickVote) snapshot() obj {
	return obj{
		{"voteId", v.id},
		{"targetId", v.targetID},
		{"eligibleIds", append([]string{}, v.eligibleIDs...)},
		{"yesIds", append([]string{}, v.yesIDs...)},
		{"noIds", append([]string{}, v.noIDs...)},
		{"deadline", v.deadline},
	}
}

// member is one player in a room. accountID is empty for guests.
type member struct {
	playerID  string
	name      string
	accountID string
	slot      int
	ready     bool
	team      int // 0 is Java null (individual mode)
	equipment json.RawMessage
	initial   *string
	changing  bool
}

func (m *member) snapshot() obj {
	value := obj{
		{"playerId", m.playerID},
		{"name", m.name},
		{"slot", m.slot},
		{"ready", m.ready},
		{"team", teamValue(m.team)},
	}
	if m.equipment != nil {
		value = append(value, field{"equipment", m.equipment})
	}
	if m.initial != nil {
		value = append(value, field{"initial", *m.initial})
	}
	if m.changing {
		value = append(value, field{"changing", true})
	}
	return value
}

func teamValue(team int) any {
	if team == 0 {
		return nil
	}
	return team
}

// finishRow is one entry of race.finishes. serverAt (not in snapshots) is
// the room clock when the server received it, for the rewards.
type finishRow struct {
	playerID  string
	elapsedMs int
	serverAt  int64
}

// resultRow is one ranked entry of race.results; elapsedMs is nil for a
// racer who did not finish.
type resultRow struct {
	playerID  string
	rank      int
	elapsedMs *int
	points    int
	// titles are an item race racer's result titles (ITEM_MODE.md C.9);
	// nil in other races.
	titles []string
}

// giantState is the last accepted giant state of one racer.
type giantState struct {
	sequence, main, extra, status int
}

// race is the race of one room, frozen at start.
type race struct {
	id              string
	channelName     string
	gameplay        string
	trackID         string
	loadingDeadline int64
	roster          []obj    // member snapshots at start
	rosterIDs       []string // roster player IDs in start order
	rosterAccounts  map[string]string
	rosterNames     map[string]string
	rosterTeams     map[string]int // 0 in individual mode
	startSlots      []int          // slot of rosterIDs[i]
	// rosterEquipment is the frozen equipment of rosterIDs[i].
	rosterEquipment []json.RawMessage
	loadedIDs       []string
	returnedIDs     []string
	finishes        []finishRow
	results         []resultRow
	resultsSet      bool // results != null in Java
	startAt         *int64
	finishDeadline  *int64
	raceOverAt      *int64
	winningTeam     int     // 0 is Java null
	teamScores      *[2]int // teams 1 and 2; nil is Java null
	rp              obj
	lte             obj
	giant           obj
	roadblock       obj
	roadblockRunner string
	roadblockResult obj // roadblockOutcome
	// outIDs are the racers out of the race before it finished: they left
	// the room, or failed to load (load-failed, loading timeout). The race
	// goes on without them (not in Java, which cancelled it).
	outIDs []string
	// rewards are the base exp and lucci of the rewarded racers, set with
	// the results when the race finishes (ECONOMY.md 2.1) and settled as is;
	// shownRewards are the same scaled by rates, the data service's reward
	// rates at that time, which the settlement carries so they are credited
	// as shown; they are what race.rewards shows.
	rewards      []rewards.RacerReward
	shownRewards []rewards.RacerReward
	rates        rewards.Rates

	giantStates         map[string]giantState
	teamChargeSequences map[string]int
	teamGaugeSequences  map[int]int
	teamGaugeTargets    map[int]float64

	// progress is each racer's furthest accepted route distance (meters).
	progress map[string]float64
	// current is each racer's latest accepted route distance and lap, the
	// live order of an item race.
	current map[string]routeSample

	// item is race.item of an item race ({"ruleset","table"}); items its
	// item state, and itemSequences each racer's last item sequence.
	item          obj
	items         *itemmode.Race
	itemSequences map[string]int
	// itemStartPending: the countdown started and the racers' start slots
	// (the 迅 item karts' start item, everyone's changers) go out after the
	// snapshot announcing it.
	itemStartPending bool
	// perfectStart: the racer's finish reported a successful start boost;
	// lapTrailed: the racer crossed the line at least once while not
	// leading (the 完美起步 / 唯我独尊 titles).
	perfectStart map[string]bool
	lapTrailed   map[string]bool
	// bonusLucci is each rewarded racer's in-race lucci (settled apart).
	bonusLucci map[string]int

	// cheat is the race in the anti-cheat plugin (from its countdown) and
	// guards its racers (lobby.guard).
	cheat  cheat.Race
	guards map[string]cheat.Racer
}

// routeSample is a racer's latest route progress from its motion frames.
type routeSample struct {
	distance float64
	lap      int
}

func (r *race) inRoster(playerID string) bool { return slices.Contains(r.rosterIDs, playerID) }

func (r *race) isLoaded(playerID string) bool { return slices.Contains(r.loadedIDs, playerID) }

func (r *race) isOut(playerID string) bool { return slices.Contains(r.outIDs, playerID) }

func (r *race) markOut(playerID string) {
	if !r.isOut(playerID) {
		r.outIDs = append(r.outIDs, playerID)
	}
}

func (r *race) hasFinished(playerID string) bool {
	return slices.ContainsFunc(r.finishes, func(f finishRow) bool { return f.playerID == playerID })
}

// finishedForRewards reports whether a racer's finish counts for the
// rewards: the server saw at least minRewardedRaceMs of racing before it
// arrived, and the reported elapsedMs is no more than finishToleranceMs
// shorter than that. Anything else earns the unfinished reward.
func (r *race) finishedForRewards(playerID string) bool {
	for _, f := range r.finishes {
		if f.playerID == playerID {
			raced := f.serverAt - *r.startAt
			return raced >= minRewardedRaceMs && int64(f.elapsedMs) >= raced-finishToleranceMs
		}
	}
	return false
}

func (r *race) startSlotsObj() obj {
	value := make(obj, len(r.rosterIDs))
	for i, id := range r.rosterIDs {
		value[i] = field{id, r.startSlots[i]}
	}
	return value
}

func (r *race) snapshot() obj {
	value := obj{
		{"raceId", r.id},
		{"channelName", r.channelName},
		{"gameplay", r.gameplay},
		{"trackId", r.trackID},
		{"loadingDeadline", r.loadingDeadline},
		{"roster", r.roster},
		{"startSlots", r.startSlotsObj()},
		{"loadedIds", append([]string{}, r.loadedIDs...)},
	}
	if r.startAt != nil {
		value = append(value, field{"startAt", *r.startAt})
	}
	if r.finishDeadline != nil {
		if r.gameplay != "roadblock" {
			value = append(value, field{"finishWindowMs", 10_000})
		}
		value = append(value, field{"finishDeadline", *r.finishDeadline})
	}
	if len(r.finishes) > 0 {
		rows := make([]obj, len(r.finishes))
		for i, f := range r.finishes {
			rows[i] = obj{{"playerId", f.playerID}, {"elapsedMs", f.elapsedMs}}
		}
		value = append(value, field{"finishes", rows})
	}
	if r.raceOverAt != nil {
		value = append(value, field{"raceOverAt", *r.raceOverAt})
	}
	if r.resultsSet {
		rows := make([]obj, len(r.results))
		for i, row := range r.results {
			var elapsed any
			if row.elapsedMs != nil {
				elapsed = *row.elapsedMs
			}
			rows[i] = obj{{"playerId", row.playerID}, {"rank", row.rank},
				{"elapsedMs", elapsed}, {"points", row.points}}
			if row.titles != nil {
				rows[i] = append(rows[i], field{"titles", row.titles})
			}
		}
		value = append(value, field{"results", rows})
	}
	if r.winningTeam != 0 {
		value = append(value, field{"winningTeam", r.winningTeam})
	}
	if r.teamScores != nil {
		value = append(value, field{"teamScores", obj{
			{"1", r.teamScores[0]}, {"2", r.teamScores[1]}}})
	}
	if len(r.returnedIDs) > 0 {
		value = append(value, field{"returnedIds", append([]string{}, r.returnedIDs...)})
	}
	if r.rp != nil {
		value = append(value, field{"rp", r.rp})
	}
	if r.lte != nil {
		value = append(value, field{"lte", r.lte})
	}
	if r.giant != nil {
		value = append(value, field{"giant", r.giant})
	}
	if r.roadblock != nil {
		value = append(value, field{"roadblock", r.roadblock})
	}
	if r.roadblockResult != nil {
		value = append(value, field{"roadblockOutcome", r.roadblockResult})
	}
	if r.resultsSet {
		// Not in Java: {playerId: {"exp", "lucci"}} for every gameplay,
		// after the Java fields so their order is unchanged.
		value = append(value, field{"rewards", r.rewardsObj()})
	}
	if r.item != nil {
		// Not in Java: the item race ruleset, after every other field.
		value = append(value, field{"item", r.item})
	}
	return value
}

func (r *race) rewardsObj() obj {
	value := make(obj, len(r.shownRewards))
	for i, reward := range r.shownRewards {
		value[i] = field{reward.PlayerID, obj{{"exp", reward.Exp}, {"lucci", reward.Lucci}}}
	}
	return value
}

// removeFirst mirrors List.remove(Object): drop the first occurrence.
func removeFirst[T comparable](values []T, value T) []T {
	if i := slices.Index(values, value); i >= 0 {
		return slices.Delete(values, i, i+1)
	}
	return values
}
