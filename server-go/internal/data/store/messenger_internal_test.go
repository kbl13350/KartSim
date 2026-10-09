package store

import (
	"testing"
	"time"
)

func TestCooldownEnd(t *testing.T) {
	at := func(day, hour, minute int) int64 {
		return time.Date(2026, 10, day, hour, minute, 0, 0, beijing).UnixMilli()
	}
	cases := map[int64]int64{
		at(9, 10, 0): at(10, 6, 0), at(9, 5, 59): at(9, 6, 0), at(9, 6, 0): at(10, 6, 0), at(9, 23, 59): at(10, 6, 0),
		time.Date(2026, 10, 9, 21, 30, 0, 0, time.UTC).UnixMilli(): at(10, 6, 0), // 05:30 on the 10th in Beijing
	}
	for resolved, want := range cases {
		if got := cooldownEnd(resolved); got != want {
			t.Errorf("cooldownEnd(%s) = %s, want %s", time.UnixMilli(resolved).In(beijing), time.UnixMilli(got).In(beijing),
				time.UnixMilli(want).In(beijing))
		}
	}
}
