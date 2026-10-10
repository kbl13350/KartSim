package contract

import (
	"encoding/json"
	"testing"
)

// Heap sizes are MB with one decimal, so an idle process is not "0 MB";
// whole numbers from older nodes decode the same.
func TestHeapMB(t *testing.T) {
	for bytes, want := range map[uint64]float64{0: 0, 600 << 10: 0.6, 1 << 20: 1, 48<<20 + 1<<19: 48.5, 52_000: 0} {
		if got := RoundMB(bytes); got != want {
			t.Errorf("RoundMB(%d) = %v, want %v", bytes, got, want)
		}
	}
	var stats NodeStats
	if err := json.Unmarshal([]byte(`{"heapMB":48,"goroutines":3}`), &stats); err != nil || stats.HeapMB != 48 {
		t.Fatalf("integer heap %+v, %v", stats, err)
	}
	encoded, _ := json.Marshal(NodeStats{HeapMB: 0.6})
	if string(encoded) != `{"heapMB":0.6,"goroutines":0,"connections":0,"races":0,"version":""}` {
		t.Fatalf("encoded %s", encoded)
	}
}
