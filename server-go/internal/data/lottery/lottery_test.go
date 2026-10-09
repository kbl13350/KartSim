package lottery

import (
	"testing"
	"time"
)

func TestExpeditionBoxes(t *testing.T) {
	d, err := Default()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 9, 12, 0, 0, 0, time.UTC).UnixMilli()
	for _, box := range []struct{ id, rewards int }{{1228, 175}, {1007, 243}, {1008, 498}} {
		l, ok := d.Lottery(box.id)
		if !ok {
			t.Fatalf("box %d missing", box.id)
		}
		rewards := d.Rewards(l, now)
		total := 0
		for _, reward := range rewards {
			total += reward.Weight
			if len(d.Stock(reward.StockID)) == 0 {
				t.Fatalf("box %d reward stock %d has no items", box.id, reward.StockID)
			}
		}
		if len(rewards) != box.rewards || total != 10000 {
			t.Fatalf("box %d: %d rewards weighing %d", box.id, len(rewards), total)
		}
	}
	if d.Name(24, 1228) != "探险队补给箱" || d.Name(34, 879) != "" && d.Name(34, 879) != "探险币" {
		t.Fatalf("names %q %q", d.Name(24, 1228), d.Name(34, 879))
	}
	ruby, _ := d.Lottery(1007)
	if after := time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli(); d.Rewards(ruby, after) != nil {
		t.Fatal("the ruby box opens after its period")
	}
}

func TestDrawFollowsWeights(t *testing.T) {
	rewards := []Reward{{StockID: 1, Weight: 1}, {StockID: 2, Weight: 0}, {StockID: 3, Weight: 3}}
	counts := map[int]int{}
	for n := range 4 {
		reward, ok := Draw(rewards, func(total int) int {
			if total != 4 {
				t.Fatalf("total %d", total)
			}
			return n
		})
		if !ok {
			t.Fatal("no draw")
		}
		counts[reward.StockID]++
	}
	if counts[1] != 1 || counts[2] != 0 || counts[3] != 3 {
		t.Fatalf("draws %v", counts)
	}
	if _, ok := Draw([]Reward{{StockID: 1}}, func(int) int { return 0 }); ok {
		t.Fatal("weightless rewards drew")
	}
}
