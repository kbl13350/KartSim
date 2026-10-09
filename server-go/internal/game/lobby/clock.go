package lobby

import "time"

// Clock supplies the room clock and the race timers. Tests replace it to
// step through countdowns and deadlines without sleeping.
type Clock interface {
	// Now is monotonic milliseconds since the process started, the Java
	// now(). Every player of a room is on this node, so it needs no sync.
	Now() int64
	// AfterFunc runs f once after d on its own goroutine.
	AfterFunc(d time.Duration, f func())
}

var processStart = time.Now()

type systemClock struct{}

// SystemClock is the real monotonic clock.
func SystemClock() Clock { return systemClock{} }

func (systemClock) Now() int64 { return time.Since(processStart).Milliseconds() }

func (systemClock) AfterFunc(d time.Duration, f func()) { time.AfterFunc(d, f) }
