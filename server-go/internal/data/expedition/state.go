package expedition

import (
	"net/http"
	"slices"

	"kartsim/internal/shared/apierr"
)

// An account's expedition: this week's mission slots and counters. The
// store keeps it as one JSON document per account and changes it under the
// account's locks; the methods here are the rules.

// WeeklyTokens is how many 探险币 an account gets each week (this server's
// choice; the original sold them in the shop).
const WeeklyTokens = 10

var (
	ErrUnknownSlot      = apierr.New(http.StatusNotFound, "UNKNOWN_MISSION")
	ErrMissionStarted   = apierr.New(http.StatusConflict, "MISSION_STARTED")
	ErrMissionNotActive = apierr.New(http.StatusConflict, "MISSION_NOT_IN_PROGRESS")
	ErrMissionNotDone   = apierr.New(http.StatusConflict, "MISSION_NOT_COMPLETE")
	ErrCannotAdd        = apierr.New(http.StatusConflict, "CANNOT_ADD_MISSION")
	ErrNoMission        = apierr.New(http.StatusConflict, "NO_MISSION")
	ErrInvalidCrew      = apierr.New(http.StatusBadRequest, "INVALID_CREW")
	ErrCrewBusy         = apierr.New(http.StatusConflict, "CREW_BUSY")
	ErrNoMatch          = apierr.New(http.StatusConflict, "NO_MATCHING_CREW")
	ErrFriendUsed       = apierr.New(http.StatusConflict, "FRIEND_USED")
	ErrInvalidCount     = apierr.New(http.StatusBadRequest, "INVALID_COUNT")
)

// Pair is one crew member: a character and a kart (a system kart is item 0
// with its system key).
type Pair struct {
	Character int    `json:"character"`
	Kart      int    `json:"kart"`
	KartKey   string `json:"kartKey,omitempty"`
}

// Slot is one mission of the week's list.
type Slot struct {
	Slot    int    `json:"slot"`
	Mission int    `json:"mission"`
	Added   bool   `json:"added,omitempty"`   // bought with 探险币
	Started int64  `json:"started,omitempty"` // Unix ms, 0 before departure
	Ends    int64  `json:"ends,omitempty"`
	Crew    []Pair `json:"crew,omitempty"`
	Friend  string `json:"friend,omitempty"`
	Bonus   Bonus  `json:"bonus"`
	Exp     int64  `json:"exp,omitempty"`
	Lucci   int64  `json:"lucci,omitempty"`
}

// InProgress reports whether the crew is still out at now.
func (s *Slot) InProgress(now int64) bool { return s.Started != 0 && now < s.Ends }

// Done reports whether the mission waits for its reward at now.
func (s *Slot) Done(now int64) bool { return s.Started != 0 && now >= s.Ends }

// State is an account's expedition.
type State struct {
	Week     int64  `json:"week"`  // WeekStart of the list
	Slots    []Slot `json:"slots"` // in list order
	Added    int    `json:"added"` // missions bought this week
	Started  int    `json:"started"`
	Finished int    `json:"finished"` // rewards claimed this week
	Next     int    `json:"next"`     // the next slot number
	// Friends maps a friend's account id to the friend day they last went.
	Friends map[string]int64 `json:"friends,omitempty"`
}

// Limit is how many missions the week allows (the default ten and those added).
func (d *Data) Limit(s *State) int { return d.Basic.WeeklyMissions + s.Added }

// Slot finds a slot by number.
func (s *State) Slot(number int) (*Slot, bool) {
	for i := range s.Slots {
		if s.Slots[i].Slot == number {
			return &s.Slots[i], true
		}
	}
	return nil, false
}

// Roller draws uniform integers in [0, n).
type Roller func(n int) int

// Renew starts a new week when now is past the list's week: missions not
// started are dropped (started ones stay until their reward is claimed),
// counters reset and the week's missions are drawn, preferring the
// attributes the account can field (feasible). It reports whether a new
// week began (the caller grants WeeklyTokens).
func (d *Data) Renew(s *State, now int64, feasible func(specific int) bool, roll Roller) bool {
	week := d.WeekStart(now)
	if s.Week == week {
		return false
	}
	kept := s.Slots[:0]
	for _, slot := range s.Slots {
		if slot.Started != 0 {
			kept = append(kept, slot)
		}
	}
	s.Week, s.Slots, s.Added, s.Started, s.Finished = week, kept, 0, 0, 0
	for range d.Basic.WeeklyMissions {
		if id, ok := d.draw(s, 0, feasible, roll); ok {
			s.add(id, false)
		}
	}
	return true
}

func (s *State) add(mission int, added bool) {
	s.Next++
	s.Slots = append(s.Slots, Slot{Slot: s.Next, Mission: mission, Added: added})
}

// draw picks a mission not in the list (other than except), from the
// feasible attributes when any is left.
func (d *Data) draw(s *State, except int, feasible func(int) bool, roll Roller) (int, bool) {
	listed := map[int]bool{except: true}
	for _, slot := range s.Slots {
		listed[slot.Mission] = true
	}
	var preferred, others []int
	for _, m := range d.Missions {
		if listed[m.ID] {
			continue
		}
		if feasible != nil && feasible(m.Specific) {
			preferred = append(preferred, m.ID)
		} else {
			others = append(others, m.ID)
		}
	}
	if len(preferred) > 0 {
		return preferred[roll(len(preferred))], true
	}
	if len(others) > 0 {
		return others[roll(len(others))], true
	}
	return 0, false
}

// Departure is a crew about to go on a slot's mission, with what the store
// knows about each pair and the friend.
type Departure struct {
	Slot    int
	Crew    []Pair
	Members []Member // Members[i] describes Crew[i]
	Friend  string   // account id, "" without
	// FriendSpecific is the friend's attribute (their character's).
	FriendSpecific int
}

// Start sends a crew out. The caller has checked that the account owns the
// crew's items and that Friend is a friend.
func (d *Data) Start(s *State, in Departure, now int64) (*Slot, error) {
	slot, ok := s.Slot(in.Slot)
	if !ok {
		return nil, ErrUnknownSlot
	}
	if slot.Started != 0 {
		return nil, ErrMissionStarted
	}
	m, ok := d.Mission(slot.Mission)
	if !ok {
		return nil, ErrUnknownSlot
	}
	if len(in.Crew) == 0 || len(in.Crew) > 3 || len(in.Members) != len(in.Crew) {
		return nil, ErrInvalidCrew
	}
	characters, karts := map[int]bool{}, map[Pair]bool{}
	for _, pair := range in.Crew {
		kart := Pair{Kart: pair.Kart, KartKey: pair.KartKey}
		if characters[pair.Character] || karts[kart] {
			return nil, ErrInvalidCrew
		}
		characters[pair.Character], karts[kart] = true, true
	}
	for _, other := range s.Slots {
		if !other.InProgress(now) {
			continue
		}
		for _, pair := range other.Crew {
			if characters[pair.Character] || karts[Pair{Kart: pair.Kart, KartKey: pair.KartKey}] {
				return nil, ErrCrewBusy
			}
		}
	}
	if !Departs(m, in.Members) {
		return nil, ErrNoMatch
	}
	var friend *int
	if in.Friend != "" {
		if s.Friends[in.Friend] >= d.DayStart(now) {
			return nil, ErrFriendUsed
		}
		friend = &in.FriendSpecific
	}
	slot.Bonus = d.CrewBonus(m, in.Members, friend)
	slot.Exp, slot.Lucci = d.Payout(m, slot.Bonus)
	slot.Started, slot.Ends = now, now+d.Duration(m, slot.Bonus)
	slot.Crew, slot.Friend = slices.Clone(in.Crew), in.Friend
	s.Started++
	if in.Friend != "" {
		if s.Friends == nil {
			s.Friends = map[string]int64{}
		}
		for id, day := range s.Friends {
			if day < d.DayStart(now) {
				delete(s.Friends, id)
			}
		}
		s.Friends[in.Friend] = d.DayStart(now)
	}
	return slot, nil
}

// ReduceCost is the 探险币 count cutting count × 30 minutes takes, and
// CompleteCost the count that finishes a running mission now (立即完成).
func (d *Data) ReduceCost(count int) int { return count * d.Basic.ReduceTimeTokens }

func (d *Data) CompleteCost(slot *Slot, now int64) int {
	unit := int64(d.Basic.ReduceMinutes) * 60_000
	steps := (slot.Ends - now + unit - 1) / unit
	return int(max(steps, 0)) * d.Basic.ReduceTimeTokens
}

// Reduce cuts a running mission by count units (缩短时间).
func (d *Data) Reduce(s *State, number, count int, now int64) (*Slot, error) {
	slot, ok := s.Slot(number)
	if !ok {
		return nil, ErrUnknownSlot
	}
	if !slot.InProgress(now) {
		return nil, ErrMissionNotActive
	}
	if count <= 0 || count > 1000 {
		return nil, ErrInvalidCount
	}
	slot.Ends = max(now, slot.Ends-int64(count)*int64(d.Basic.ReduceMinutes)*60_000)
	return slot, nil
}

// Complete finishes a running mission now (立即完成).
func (d *Data) Complete(s *State, number int, now int64) (*Slot, int, error) {
	slot, ok := s.Slot(number)
	if !ok {
		return nil, 0, ErrUnknownSlot
	}
	if !slot.InProgress(now) {
		return nil, 0, ErrMissionNotActive
	}
	cost := d.CompleteCost(slot, now)
	slot.Ends = now
	return slot, cost, nil
}

// Change swaps a mission not started for another (更换任务).
func (d *Data) Change(s *State, number int, feasible func(int) bool, roll Roller) (*Slot, error) {
	slot, ok := s.Slot(number)
	if !ok {
		return nil, ErrUnknownSlot
	}
	if slot.Started != 0 {
		return nil, ErrMissionStarted
	}
	id, ok := d.draw(s, slot.Mission, feasible, roll)
	if !ok {
		return nil, ErrNoMission
	}
	slot.Mission = id
	return slot, nil
}

// CanAdd reports whether a mission can be added: every listed mission has
// started (addMissionDesc_2) and the week's purchases are not used up.
func (d *Data) CanAdd(s *State) bool {
	if s.Added >= d.Basic.BuyableMissions {
		return false
	}
	for _, slot := range s.Slots {
		if slot.Started == 0 {
			return false
		}
	}
	return true
}

// Add buys one more mission for the week (添加任务).
func (d *Data) Add(s *State, feasible func(int) bool, roll Roller) (*Slot, error) {
	if !d.CanAdd(s) {
		return nil, ErrCannotAdd
	}
	id, ok := d.draw(s, 0, feasible, roll)
	if !ok {
		return nil, ErrNoMission
	}
	s.Added++
	s.add(id, true)
	return &s.Slots[len(s.Slots)-1], nil
}

// Claim takes a finished mission off the list; the caller pays its exp,
// lucci and reward stock.
func (d *Data) Claim(s *State, number int, now int64) (Slot, *Mission, error) {
	slot, ok := s.Slot(number)
	if !ok {
		return Slot{}, nil, ErrUnknownSlot
	}
	if !slot.Done(now) {
		return Slot{}, nil, ErrMissionNotDone
	}
	m, ok := d.Mission(slot.Mission)
	if !ok {
		return Slot{}, nil, ErrUnknownSlot
	}
	claimed := *slot
	s.Slots = slices.DeleteFunc(s.Slots, func(other Slot) bool { return other.Slot == number })
	s.Finished++
	return claimed, m, nil
}
