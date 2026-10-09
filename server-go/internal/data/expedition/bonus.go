package expedition

// Bonuses are in tenths of a percent (45 = 4.5%), like the kart tables.
//
// This server's reading of the original tables (the original server's
// formula is not in the client):
//   - a character whose attribute matches the mission's adds to the reward
//     bonusConstChar × bonusConstCharSpecific1 (5%), one that does not
//     × bonusConstCharSpecific0 (0%);
//   - a kart cuts the time by its upgrade level's kartBodyTuning value for
//     the mission's difficulty (level 0 4.5% … level 5 27% at difficulty 1),
//     and a kart with reinforced parts (the classic upgrade's four part
//     levels, total 4-40) adds the reinforcePart value to the basicReward
//     (whole points: 27 … 111 at total 40, about 22% of it);
//   - the friend adds bonusConstChar to the reward when their character's
//     attribute matches, half of it otherwise.
//
// The time cut stops at MaxTimeBonus.

// MaxTimeBonus caps the time cut (50%).
const MaxTimeBonus = 500

// Member is one crew pair as the bonus sees it.
type Member struct {
	CharacterSpecific int
	KartSpecific      int
	// KartLevel is the kart's garage upgrade level, KartParts the total of
	// its reinforced parts' levels (0 without).
	KartLevel int
	KartParts int
}

// Bonus is a crew's time cut, reward bonus and reward points (added to
// the basicReward before the reward constants).
type Bonus struct {
	Time   int `json:"time"`
	Reward int `json:"reward"`
	Points int `json:"points,omitempty"`
}

// CharacterBonus is a character's reward bonus on a mission.
func (d *Data) CharacterBonus(m *Mission, specific int) int {
	factor := d.Constants.CharacterUnmatched
	if specific == m.Specific {
		factor = d.Constants.CharacterMatched
	}
	return d.Constants.Character * factor / 1000
}

// KartBonus is a kart's time cut and reward points on a mission.
func (d *Data) KartBonus(m *Mission, level, parts int) Bonus {
	level = min(max(level, 0), maxKey(d.KartTuning))
	b := Bonus{Time: d.KartTuning[level][m.Difficulty-1]}
	if row, ok := d.Parts[parts]; ok {
		b.Points = row[m.Difficulty-1]
	}
	return b
}

// FriendBonus is the friend's reward bonus on a mission.
func (d *Data) FriendBonus(m *Mission, specific int) int {
	if specific == m.Specific {
		return d.Constants.Character
	}
	return d.Constants.Character / 2
}

// CrewBonus adds up a crew's bonuses; friend is nil without a friend.
func (d *Data) CrewBonus(m *Mission, members []Member, friend *int) Bonus {
	var total Bonus
	for _, member := range members {
		total.Reward += d.CharacterBonus(m, member.CharacterSpecific)
		kart := d.KartBonus(m, member.KartLevel, member.KartParts)
		total.Time += kart.Time
		total.Points += kart.Points
	}
	if friend != nil {
		total.Reward += d.FriendBonus(m, *friend)
	}
	total.Time = min(total.Time, MaxTimeBonus)
	return total
}

// Departs reports whether a crew may go: at least one character and one
// kart whose attribute matches the mission's (expeditionStartCondition).
func Departs(m *Mission, members []Member) bool {
	character, kart := false, false
	for _, member := range members {
		character = character || member.CharacterSpecific == m.Specific
		kart = kart || member.KartSpecific == m.Specific
	}
	return character && kart
}

// Duration is how long a mission takes with a time cut (ms).
func (d *Data) Duration(m *Mission, b Bonus) int64 {
	return int64(m.Hours) * 3_600_000 * int64(1000-b.Time) / 1000
}

// Payout is a mission's exp and lucci with a crew's bonus: the difficulty's
// basicReward plus the reward points as exp (bonusType 0, × bonusConstRp),
// lucci (1, × bonusConstLucci) or both (2, each × bonusConstRpLucci), then
// raised by the reward bonus.
func (d *Data) Payout(m *Mission, b Bonus) (exp, lucci int64) {
	base := int64(d.Rewards[m.Difficulty] + b.Points)
	c := d.Constants
	switch m.BonusType {
	case RewardExp:
		exp = base * int64(c.Rp) / 1000
	case RewardLucci:
		lucci = base * int64(c.Lucci) / 1000
	default:
		exp = base * int64(c.Rp) * int64(c.RpLucci) / 1_000_000
		lucci = base * int64(c.Lucci) * int64(c.RpLucci) / 1_000_000
	}
	scale := func(v int64) int64 { return (v*int64(1000+b.Reward) + 500) / 1000 }
	return scale(exp), scale(lucci)
}

func maxKey(table map[int][5]int) int {
	top := 0
	for key := range table {
		top = max(top, key)
	}
	return top
}
