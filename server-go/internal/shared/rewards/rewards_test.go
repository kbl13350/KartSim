package rewards

import (
	"fmt"
	"math"
	"slices"
	"testing"
	"time"
)

// ranked builds n individual racers p1..pn with ranks 1..n, all finished.
func ranked(n int) []Racer {
	racers := make([]Racer, n)
	for i := range racers {
		racers[i] = Racer{PlayerID: fmt.Sprintf("p%d", i+1), Rank: i + 1, Finished: true}
	}
	return racers
}

func rewardsOf(rows []RacerReward) []Reward {
	out := make([]Reward, len(rows))
	for i, row := range rows {
		out[i] = row.Reward
	}
	return out
}

func TestRaceRewards(t *testing.T) {
	eight := ranked(8)
	eightWithDNF := ranked(8)
	eightWithDNF[7].Finished = false
	team := []Racer{
		{PlayerID: "a", Rank: 1, Finished: true, Team: 1},
		{PlayerID: "b", Rank: 2, Finished: true, Team: 2},
		{PlayerID: "c", Rank: 3, Finished: true, Team: 1},
		{PlayerID: "d", Rank: 4, Finished: false, Team: 2},
	}
	five := []Racer{{PlayerID: "runner"}, {PlayerID: "b1"}, {PlayerID: "b2"}, {PlayerID: "b3"}, {PlayerID: "b4"}}
	for _, tc := range []struct {
		name string
		in   RaceInput
		want []Reward
	}{{
		// ECONOMY.md 2.1 example: winner 110 x 1.1 = 121 exp, 180 lucci;
		// rank 4: p = 4/7, exp (30 + 28.57 + 30) x 1.1 = 97.43, lucci 145.71.
		name: "8 racers, Combine channel",
		in:   RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: eight, Rates: DefaultRates()},
		want: []Reward{{121, 180}, {113, 169}, {105, 157}, {97, 146}, {90, 134}, {82, 123}, {74, 111}, {66, 100}},
	}, {
		name: "8 racers, Infinit channel has no exp bonus",
		in:   RaceInput{Channel: "speedIndiInfinit", Mode: ModeIndividual, Racers: eight, Rates: DefaultRates()},
		want: []Reward{{110, 180}, {103, 169}, {96, 157}, {89, 146}, {81, 134}, {74, 123}, {67, 111}, {60, 100}},
	}, {
		name: "unfinished racer gets 10/10 (exp x1.1 in Combine)",
		in:   RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: eightWithDNF, Rates: DefaultRates()},
		want: []Reward{{121, 180}, {113, 169}, {105, 157}, {97, 146}, {90, 134}, {82, 123}, {74, 111}, {11, 10}},
	}, {
		name: "2 racers",
		in:   RaceInput{Channel: "speedIndiInfinit", Mode: ModeIndividual, Racers: ranked(2), Rates: DefaultRates()},
		want: []Reward{{80, 120}, {30, 40}},
	}, {
		name: "lone loaded racer counts as winner",
		in:   RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: ranked(1), Rates: DefaultRates()},
		want: []Reward{{88, 120}},
	}, {
		// N = 4: a (team 1, p = 1) 90 x 1.1 x 1.2 = 118.8 exp, 140 x 1.2 = 168 lucci;
		// c (team 1, p = 1/3) 56.67 x 1.32 = 74.8, 86.67 x 1.2 = 104.
		name: "team mode, team 1 wins",
		in: RaceInput{Channel: "speedTeamCombine", Mode: ModeTeam, WinningTeam: 1, Racers: team,
			Rates: DefaultRates()},
		want: []Reward{{119, 168}, {81, 113}, {75, 104}, {11, 10}},
	}, {
		name: "team bonus needs team mode",
		in: RaceInput{Channel: "speedTeamCombine", Mode: ModeIndividual, WinningTeam: 1, Racers: team,
			Rates: DefaultRates()},
		want: []Reward{{99, 140}, {81, 113}, {62, 87}, {11, 10}},
	}, {
		// Runner 1st: 95 x 1.1 = 104.5 -> 105; blockers rank 2.5 of 5, p = 0.625:
		// exp (30 + 31.25 + 15) x 1.1 = 83.875 -> 84, lucci 40 + 50 + 30 = 120.
		name: "roadblock, runner wins",
		in: RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: five,
			Roadblock: &Roadblock{RunnerID: "runner", RunnerWon: true}, Rates: DefaultRates()},
		want: []Reward{{105, 150}, {84, 120}, {84, 120}, {84, 120}, {84, 120}},
	}, {
		// Blockers 1st; runner last: 45 x 1.1 = 49.5 -> 50, lucci 70.
		name: "roadblock, blockers win",
		in: RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: five,
			Roadblock: &Roadblock{RunnerID: "runner", RunnerWon: false}, Rates: DefaultRates()},
		want: []Reward{{50, 70}, {105, 150}, {105, 150}, {105, 150}, {105, 150}},
	}, {
		name: "rates scale after bonuses",
		in: RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: ranked(8)[:1:1],
			Rates: Rates{Exp: 2, Lucci: 0.5}},
		want: []Reward{{88 * 2, 60}},
	}, {
		name: "invalid rates grant nothing",
		in: RaceInput{Channel: "speedIndiCombine", Mode: ModeIndividual, Racers: ranked(2),
			Rates: Rates{Exp: math.NaN(), Lucci: -1}},
		want: []Reward{{0, 0}, {0, 0}},
	}, {
		name: "rank outside 1..N counts as last",
		in: RaceInput{Channel: "speedIndiInfinit", Mode: ModeIndividual, Rates: DefaultRates(),
			Racers: []Racer{{PlayerID: "x", Rank: 0, Finished: true}, {PlayerID: "y", Rank: 9, Finished: true}}},
		want: []Reward{{30, 40}, {30, 40}},
	}} {
		t.Run(tc.name, func(t *testing.T) {
			got := RaceRewards(tc.in)
			if !slices.Equal(rewardsOf(got), tc.want) {
				t.Fatalf("got  %v\nwant %v", rewardsOf(got), tc.want)
			}
			for i, row := range got {
				if row.PlayerID != tc.in.Racers[i].PlayerID {
					t.Fatalf("row %d is %s, want input order", i, row.PlayerID)
				}
			}
		})
	}
	if got := RaceRewards(RaceInput{Channel: "speedIndiCombine"}); len(got) != 0 {
		t.Fatalf("no racers -> %v", got)
	}
}

func TestChannelExpBonus(t *testing.T) {
	for channel, want := range map[string]float64{
		"speedIndiCombine": 1.1, "speedTeamCombine": 1.1, "speedIndiInfinit": 1, "speedTeamInfinit": 1, "": 1,
	} {
		if got := ChannelExpBonus(channel); got != want {
			t.Errorf("ChannelExpBonus(%q) = %v, want %v", channel, got, want)
		}
	}
}

func TestTimeAttackRewards(t *testing.T) {
	for _, tc := range []struct {
		newRecord bool
		rates     Rates
		want      Reward
	}{
		{false, DefaultRates(), Reward{10, 20}},
		{true, DefaultRates(), Reward{30, 70}},
		{false, Rates{Exp: 1.5, Lucci: 2}, Reward{15, 40}},
		{true, Rates{Exp: 1.5, Lucci: 2}, Reward{45, 140}},
		{true, Rates{}, Reward{0, 0}},
	} {
		if got := TimeAttackRewards(tc.newRecord, tc.rates); got != tc.want {
			t.Errorf("TimeAttackRewards(%v, %+v) = %+v, want %+v", tc.newRecord, tc.rates, got, tc.want)
		}
	}
	if ValidTimeAttack(9_999) || !ValidTimeAttack(10_000) {
		t.Fatal("runs under 10 s are invalid")
	}
}

func TestCapDaily(t *testing.T) {
	for _, tc := range [][4]int64{
		{0, 121, DailyRaceExpCap, 121},
		{19_950, 121, DailyRaceExpCap, 50},
		{20_000, 121, DailyRaceExpCap, 0},
		{25_000, 121, DailyRaceExpCap, 0},
		{29_990, 180, DailyRaceLucciCap, 10},
		{0, -5, DailyRaceLucciCap, 0},
	} {
		if got := CapDaily(tc[0], tc[1], tc[2]); got != tc[3] {
			t.Errorf("CapDaily(%d, %d, %d) = %d, want %d", tc[0], tc[1], tc[2], got, tc[3])
		}
	}
}

func TestBeijingDay(t *testing.T) {
	for at, want := range map[time.Time]string{
		time.Date(2026, 10, 6, 15, 59, 59, 0, time.UTC):                      "2026-10-06",
		time.Date(2026, 10, 6, 16, 0, 0, 0, time.UTC):                        "2026-10-07",
		time.Date(2026, 10, 7, 0, 30, 0, 0, time.FixedZone("UTC+9", 9*3600)): "2026-10-06",
	} {
		if got := BeijingDay(at); got != want {
			t.Errorf("BeijingDay(%v) = %s, want %s", at, got, want)
		}
	}
}

func TestRoundHalfUp(t *testing.T) {
	for _, tc := range []struct {
		in   float64
		want int64
	}{{0, 0}, {-3, 0}, {0.49, 0}, {0.5, 1}, {1.25 * 1.2, 2}, {104.5, 105}, {2.4999, 2}, {math.Inf(1), 1e15}} {
		if got := round(tc.in); got != tc.want {
			t.Errorf("round(%v) = %d, want %d", tc.in, got, tc.want)
		}
	}
}

func TestApplyRate(t *testing.T) {
	for _, tc := range []struct {
		amount int64
		rate   float64
		want   int64
	}{
		{88, 1, 88}, {88, 1.5, 132}, {33, 1.5, 50}, {121, 0.5, 61}, {40, 2, 80},
		{7, 1.3, 9}, // 9.1
		{5, 0.3, 2}, // 1.5 computed as 1.4999999999999998 still rounds up
		{0, 3, 0}, {-4, 2, 0}, {10, 0, 0}, {10, -1, 0}, {10, math.NaN(), 0}, {10, math.Inf(1), 0},
	} {
		if got := ApplyRate(tc.amount, tc.rate); got != tc.want {
			t.Errorf("ApplyRate(%d, %v) = %d, want %d", tc.amount, tc.rate, got, tc.want)
		}
	}
	rates := Rates{Exp: 1.5, Lucci: 2}
	if got := rates.Apply(Reward{Exp: 33, Lucci: 40}); got != (Reward{Exp: 50, Lucci: 80}) {
		t.Errorf("Rates.Apply = %+v", got)
	}
	if got := DefaultRates().Apply(Reward{Exp: 121, Lucci: 180}); got != (Reward{Exp: 121, Lucci: 180}) {
		t.Errorf("DefaultRates().Apply changed the reward: %+v", got)
	}
}
