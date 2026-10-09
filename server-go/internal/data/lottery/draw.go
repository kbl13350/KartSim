package lottery

import (
	"errors"
	"fmt"
	"sort"
)

// Rand is the randomness a draw uses (math/rand/v2 *rand.Rand satisfies it).
type Rand interface {
	// Int64N returns a uniform value in [0, n).
	Int64N(n int64) int64
}

// Draw picks a reward by weight; zero-weight rewards are never drawn. It
// returns nil when no reward has a weight.
func (s *RewardSet) Draw(rng Rand) *Reward {
	if s.total <= 0 {
		return nil
	}
	pick := rng.Int64N(s.total)
	for i := range s.Rewards {
		reward := &s.Rewards[i]
		if pick < reward.Weight {
			return reward
		}
		pick -= reward.Weight
	}
	return nil // unreachable: the weights sum to total
}

// Total is the sum of the set's weights.
func (s *RewardSet) Total() int64 { return s.total }

// Treasure-hunt probabilities (LOTTERY.md 3). The original keeps them on its
// server, so they are derived from what the client data has: a 保底 reward
// of acquireCount N is drawn with probability 1/(2N); the other board slots
// with SlotProbability each; the remaining rewards share the rest evenly.
const (
	// ProbabilityScale is the weight of probability 1 (parts per million).
	ProbabilityScale = 1_000_000
	// SlotProbability is a board slot reward's share without 保底.
	SlotProbability = 5_000 // 0.5%
)

// Rarities, the board slot and result art of the treasure hunt
// (newgacha_slot_<rarity>, newgacha_LeftSlot_<rarity>).
const (
	RarityNormal   = "normal"
	RarityRare     = "rare"
	RarityEpic     = "epic"
	RarityUnique   = "unique"
	RarityLegend   = "legend"
	RarityUltimate = "ultimate"
)

// pityRarities name the 保底 rewards from the longest acquireCount down.
var pityRarities = []string{RarityUltimate, RarityLegend, RarityUnique, RarityEpic}

func (h *TreasureHunt) prepare(d *Data) error {
	if h.ID <= 0 || h.Theme == "" || h.Material <= 0 || h.OtherMaterial <= 0 || len(h.Rewards) == 0 {
		return errors.New("needs an id, a theme, materials and rewards")
	}
	for _, id := range []int{h.Material, h.EventMaterial, h.OtherMaterial} {
		if id != 0 && !d.IsCountItem(ItemKey{MaterialCategory, id}) {
			return fmt.Errorf("material %d:%d is not a count item", MaterialCategory, id)
		}
	}
	if err := validPeriod(h.Start, h.End); err != nil {
		return err
	}
	h.weights = make([]int64, len(h.Rewards))
	var fixed int64
	rest := 0
	seen := map[int]bool{}
	slots := map[int]bool{}
	for i, reward := range h.Rewards {
		if d.stocks[reward.StockID] == nil || seen[reward.StockID] {
			return fmt.Errorf("reward stock %d unknown or repeated", reward.StockID)
		}
		seen[reward.StockID] = true
		if reward.Summary != 0 {
			if reward.Summary < 0 || slots[reward.Summary] {
				return fmt.Errorf("summary slot %d invalid or repeated", reward.Summary)
			}
			slots[reward.Summary] = true
		}
		switch {
		case reward.AcquireCount > 0:
			if reward.Summary == 0 {
				return fmt.Errorf("保底 reward %d has no board slot", reward.StockID)
			}
			h.weights[i] = max(1, ProbabilityScale/(2*int64(reward.AcquireCount)))
		case reward.Summary > 0:
			h.weights[i] = SlotProbability
		default:
			rest++
			continue
		}
		fixed += h.weights[i]
	}
	if rest == 0 || fixed >= ProbabilityScale {
		return fmt.Errorf("no probability left for the %d other rewards", rest)
	}
	share := (ProbabilityScale - fixed) / int64(rest)
	for i, reward := range h.Rewards {
		if reward.AcquireCount == 0 && reward.Summary == 0 {
			h.weights[i] = share
		}
		h.total += h.weights[i]
	}
	return nil
}

// Weight returns a reward's draw weight; Probability(i) = Weight(i) / TotalWeight().
func (h *TreasureHunt) Weight(i int) int64 { return h.weights[i] }

// TotalWeight is the sum of the draw weights.
func (h *TreasureHunt) TotalWeight() int64 { return h.total }

// Draw picks a reward index by weight.
func (h *TreasureHunt) Draw(rng Rand) int {
	pick := rng.Int64N(h.total)
	for i, weight := range h.weights {
		if pick < weight {
			return i
		}
		pick -= weight
	}
	return len(h.weights) - 1 // unreachable
}

// PityRewards lists the indexes of the 保底 rewards, the shortest acquireCount first.
func (h *TreasureHunt) PityRewards() []int {
	var indexes []int
	for i, reward := range h.Rewards {
		if reward.AcquireCount > 0 {
			indexes = append(indexes, i)
		}
	}
	sort.SliceStable(indexes, func(a, b int) bool {
		return h.Rewards[indexes[a]].AcquireCount < h.Rewards[indexes[b]].AcquireCount
	})
	return indexes
}

// Rarity is the board and result art of a reward: the 保底 rewards from the
// longest acquireCount down are ultimate, legend, unique and epic; the other
// board slots rare; everything else (the 神秘魔方 slot) normal.
func (h *TreasureHunt) Rarity(i int) string {
	reward := h.Rewards[i]
	if reward.AcquireCount > 0 {
		longer := 0
		for _, other := range h.Rewards {
			if other.AcquireCount > reward.AcquireCount {
				longer++
			}
		}
		return pityRarities[min(longer, len(pityRarities)-1)]
	}
	if reward.Summary > 0 {
		return RarityRare
	}
	return RarityNormal
}

// SlotRewards lists the board slot rewards' indexes in slot order.
func (h *TreasureHunt) SlotRewards() []int {
	var indexes []int
	for i, reward := range h.Rewards {
		if reward.Summary > 0 {
			indexes = append(indexes, i)
		}
	}
	sort.Slice(indexes, func(a, b int) bool { return h.Rewards[indexes[a]].Summary < h.Rewards[indexes[b]].Summary })
	return indexes
}
