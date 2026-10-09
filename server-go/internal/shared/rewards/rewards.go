// Package rewards computes exp and lucci rewards for online races and time
// attack (ECONOMY.md 2). The functions are pure so the game node (which
// fills result rows in finalizeRace) and the data service (which credits
// accounts) compute identical numbers.
//
// Online race, N = racers who finished loading, r = rank, p = (N-r)/(N-1):
//
//	          finished                     not finished
//	exp       30 + 50p + 5(N-2)            10
//	lucci     40 + 80p + 10(N-2)           10
//
// then exp x1.1 in *Combine channels (channel.xml rpBonus; *Infinit x1.0)
// and exp and lucci x1.2 for the winning team in team mode; the product is
// rounded half up once. That is the base reward the game node settles; the
// configured KART_EXP_RATE / KART_LUCCI_RATE scale it afterwards with
// ApplyRate (rounded half up again), on the data service when it credits the
// account and on the game node for the race.rewards it shows.
//
// Worked example, 8 racers in speedIndiCombine: the winner (p = 1) gets
// exp round((30+50+30) x 1.1) = 121 and lucci 40+80+60 = 180; last place
// (p = 0) gets exp round(60 x 1.1) = 66 and lucci 100; a racer who did not
// finish gets exp round(10 x 1.1) = 11 and lucci 10. In speedIndiInfinit the
// winner gets 110 exp / 180 lucci.
package rewards

import (
	"math"
	"strings"
	"time"
)

// Race reward constants (ECONOMY.md 2.1).
const (
	FinishedExpBase       = 30
	FinishedExpPlace      = 50 // x p
	FinishedExpPerRacer   = 5  // x (N-2)
	FinishedLucciBase     = 40
	FinishedLucciPlace    = 80
	FinishedLucciPerRacer = 10
	UnfinishedExp         = 10
	UnfinishedLucci       = 10

	CombineChannelExpBonus = 1.1 // channel.xml rpBonus of speed*Combine
	WinningTeamBonus       = 1.2

	ModeIndividual = "individual"
	ModeTeam       = "team"
)

// Time-attack constants (ECONOMY.md 2.2; zeta_/cn/content/config.xml
// timeAttack baseReward / newRecordReward).
const (
	TimeAttackExp       = 10
	TimeAttackLucci     = 20
	NewRecordExtraExp   = 20
	NewRecordExtraLucci = 50
	// MinTimeAttackMs: a run shorter than this is invalid and earns nothing.
	MinTimeAttackMs = 10_000
	// DailyTimeAttackRewardRuns is the number of rewarded runs per Beijing day.
	DailyTimeAttackRewardRuns = 50
)

// Daily race caps per Beijing calendar day (ECONOMY.md 2.1).
const (
	DailyRaceExpCap   = 20_000
	DailyRaceLucciCap = 30_000
)

// Rates are the configured global multipliers (KART_EXP_RATE,
// KART_LUCCI_RATE). The zero value grants nothing; use DefaultRates.
type Rates struct {
	Exp   float64
	Lucci float64
}

// DefaultRates returns the 1.0 / 1.0 rates.
func DefaultRates() Rates { return Rates{Exp: 1, Lucci: 1} }

// Apply scales a base reward by the rates with ApplyRate.
func (r Rates) Apply(base Reward) Reward {
	return Reward{Exp: ApplyRate(base.Exp, r.Exp), Lucci: ApplyRate(base.Lucci, r.Lucci)}
}

// ApplyRate multiplies a base amount by a configured rate and rounds half
// up. Online races go through it twice with the same result: game nodes
// settle the base amounts of RaceRewards (DefaultRates) and the data
// service credits ApplyRate(base, KART_*_RATE), while the game node shows
// the same ApplyRate numbers in race.rewards using the rates it last
// received in a heartbeat response. NaN, infinite and negative rates count
// as 0.
func ApplyRate(amount int64, rateValue float64) int64 {
	if amount <= 0 {
		return 0
	}
	return round(float64(amount) * rate(rateValue))
}

// Reward is an amount of exp and lucci.
type Reward struct {
	Exp   int64 `json:"exp"`
	Lucci int64 `json:"lucci"`
}

// Racer is one loaded racer of a finished online race.
type Racer struct {
	PlayerID string
	// Rank is the 1-based place from finalizeRace (finish time order, racers
	// without a time last). Values outside [1, N] count as last place.
	// Ignored in roadblock races.
	Rank int
	// Finished reports whether the racer has a finish time. Ignored in
	// roadblock races, where everyone counts as finished.
	Finished bool
	// Team is 1 or 2 in team mode, otherwise 0.
	Team int
}

// Roadblock is the outcome of a roadblock race (no ranked results).
type Roadblock struct {
	RunnerID  string
	RunnerWon bool
}

// RaceInput describes a finished online race.
type RaceInput struct {
	Channel     string     // e.g. "speedIndiCombine", "speedTeamInfinit"
	Mode        string     // ModeIndividual or ModeTeam
	WinningTeam int        // 1 or 2 in team mode; 0 means no winner bonus
	Roadblock   *Roadblock // set for gameplay "roadblock"
	Racers      []Racer    // every racer who finished loading; N = len(Racers)
	Rates       Rates
}

// RacerReward is the reward of one racer.
type RacerReward struct {
	PlayerID string `json:"playerId"`
	Reward
}

// ChannelExpBonus returns the exp multiplier of a channel: 1.1 for the
// *Combine channels, 1.0 otherwise (*Infinit).
func ChannelExpBonus(channel string) float64 {
	if strings.HasSuffix(channel, "Combine") {
		return CombineChannelExpBonus
	}
	return 1
}

// RaceRewards returns one reward per racer, in input order.
//
// Roadblock races have no ranks: when the runner wins, the runner counts as
// 1st and every blocker as rank N/2 (a fraction for odd N, e.g. 2.5 of 5,
// p = 0.625); when the blockers win, every blocker counts as 1st and the
// runner as last. Everyone counts as finished.
//
// With a single loaded racer p is 1 and the N-2 term is 0.
func RaceRewards(in RaceInput) []RacerReward {
	n := len(in.Racers)
	expBonus := ChannelExpBonus(in.Channel)
	rewards := make([]RacerReward, 0, n)
	for _, racer := range in.Racers {
		finished, rank := racer.Finished, float64(racer.Rank)
		if racer.Rank < 1 || racer.Rank > n {
			rank = float64(n)
		}
		if in.Roadblock != nil {
			finished = true
			runner := racer.PlayerID == in.Roadblock.RunnerID
			switch {
			case runner == in.Roadblock.RunnerWon: // the winning side
				rank = 1
			case runner: // losing runner
				rank = float64(n)
			default: // losing blockers
				rank = float64(n) / 2
			}
		}
		exp, lucci := float64(UnfinishedExp), float64(UnfinishedLucci)
		if finished {
			p := placeShare(n, rank)
			extra := float64(max(0, n-2))
			exp = FinishedExpBase + FinishedExpPlace*p + FinishedExpPerRacer*extra
			lucci = FinishedLucciBase + FinishedLucciPlace*p + FinishedLucciPerRacer*extra
		}
		exp *= expBonus
		if in.Mode == ModeTeam && in.WinningTeam != 0 && racer.Team == in.WinningTeam {
			exp *= WinningTeamBonus
			lucci *= WinningTeamBonus
		}
		rewards = append(rewards, RacerReward{PlayerID: racer.PlayerID, Reward: Reward{
			Exp:   round(exp * rate(in.Rates.Exp)),
			Lucci: round(lucci * rate(in.Rates.Lucci)),
		}})
	}
	return rewards
}

// placeShare is p = (N-r)/(N-1), 1 for a lone racer, clamped to [0, 1].
func placeShare(n int, rank float64) float64 {
	if n <= 1 {
		return 1
	}
	return min(1, max(0, (float64(n)-rank)/float64(n-1)))
}

// TimeAttackRewards returns the reward of one valid time-attack run:
// exp 10 / lucci 20, plus exp 20 / lucci 50 when it sets a new personal best.
func TimeAttackRewards(newRecord bool, rates Rates) Reward {
	exp, lucci := float64(TimeAttackExp), float64(TimeAttackLucci)
	if newRecord {
		exp += NewRecordExtraExp
		lucci += NewRecordExtraLucci
	}
	return Reward{Exp: round(exp * rate(rates.Exp)), Lucci: round(lucci * rate(rates.Lucci))}
}

// ValidTimeAttack reports whether a run time can earn rewards.
func ValidTimeAttack(elapsedMs int64) bool { return elapsedMs >= MinTimeAttackMs }

// CapDaily returns how much of earned may still be granted today when
// alreadyGranted has been granted against limit.
func CapDaily(alreadyGranted, earned, limit int64) int64 {
	return max(0, min(earned, limit-alreadyGranted))
}

// beijing is UTC+8 without DST; a fixed zone needs no tzdata.
var beijing = time.FixedZone("UTC+8", 8*60*60)

// BeijingDay returns the Beijing calendar day ("2006-01-02") of t, the key
// of the daily reward caps.
func BeijingDay(t time.Time) string { return t.In(beijing).Format(time.DateOnly) }

// rate treats NaN, infinite and negative multipliers as 0.
func rate(value float64) float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
		return 0
	}
	return value
}

// round rounds half up. The 1e-9 tolerance absorbs binary float error so a
// true half such as 1.25 x 1.2 = 1.5 (computed as 1.4999999999999998)
// still rounds up.
func round(value float64) int64 {
	if value <= 0 {
		return 0
	}
	// Absurd configured rates must not overflow int64 conversion.
	return int64(math.Floor(min(value, 1e15) + 0.5 + 1e-9))
}
