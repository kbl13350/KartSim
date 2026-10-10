package app

import (
	"runtime/metrics"
	"sync"
)

// liveHeapMetric is the heap retained by live objects at the last GC. It
// ignores garbage not yet collected, so a node is not reported busy just
// because the collector has not run yet.
const liveHeapMetric = "/gc/heap/live:bytes"

// memoryGuard implements KART_MEMORY_LIMIT_MB (DESIGN.md 4.5): above 90 % of
// the limit the node refuses new connections and new hellos, while players
// already in rooms keep playing.
type memoryGuard struct {
	limit uint64 // bytes; 0 means no limit

	mu     sync.Mutex
	sample []metrics.Sample
}

func newMemoryGuard(limitMB int) *memoryGuard {
	return &memoryGuard{
		limit:  uint64(max(limitMB, 0)) << 20,
		sample: []metrics.Sample{{Name: liveHeapMetric}},
	}
}

// heapBytes returns the live heap; reading runtime/metrics does not stop the
// world, so it is cheap enough to call per connection attempt.
func (g *memoryGuard) heapBytes() uint64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	metrics.Read(g.sample)
	if g.sample[0].Value.Kind() != metrics.KindUint64 {
		return 0
	}
	return g.sample[0].Value.Uint64()
}

// heapInUseBytes is the heap held by objects, live or not yet swept, as
// the admin console's node page shows it. The live heap of heapBytes stays
// 0 until the first GC, so an idle node would show 0 MB.
func heapInUseBytes() uint64 {
	sample := []metrics.Sample{{Name: "/memory/classes/heap/objects:bytes"}}
	metrics.Read(sample)
	if sample[0].Value.Kind() != metrics.KindUint64 {
		return 0
	}
	return sample[0].Value.Uint64()
}

// busy reports whether the live heap is above 90 % of the limit.
func (g *memoryGuard) busy() bool {
	return g.limit > 0 && g.heapBytes() > g.limit/10*9
}
