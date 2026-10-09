package outbox

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

type call struct {
	path string
	body string
}

// fakeSender answers with respond(call index, path, body).
type fakeSender struct {
	mu      sync.Mutex
	calls   []call
	respond func(n int, path string, body []byte) (int, error)
	notify  chan struct{}
}

func newSender(respond func(n int, path string, body []byte) (int, error)) *fakeSender {
	return &fakeSender{respond: respond, notify: make(chan struct{}, 100)}
}

func (s *fakeSender) Send(ctx context.Context, path string, body []byte) (int, error) {
	s.mu.Lock()
	n := len(s.calls)
	s.calls = append(s.calls, call{path, string(body)})
	s.mu.Unlock()
	defer func() {
		select {
		case s.notify <- struct{}{}:
		default:
		}
	}()
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	return s.respond(n, path, body)
}

func (s *fakeSender) snapshot() []call {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.calls)
}

func ok(int, string, []byte) (int, error) { return 200, nil }

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func open(t *testing.T, dir string, sender Sender) *Outbox {
	t.Helper()
	box, err := Open(dir, sender, Options{MinBackoff: 5 * time.Millisecond,
		MaxBackoff: 20 * time.Millisecond, SendTimeout: time.Second, Logger: quiet})
	if err != nil {
		t.Fatal(err)
	}
	return box
}

func closeBox(t *testing.T, box *Outbox, wait time.Duration) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), wait)
	defer cancel()
	if err := box.Close(ctx); err != nil {
		t.Fatal(err)
	}
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out waiting for %s", what)
		}
		time.Sleep(2 * time.Millisecond)
	}
}

func records(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	return names
}

type body struct {
	N    int    `json:"n"`
	Text string `json:"text,omitempty"`
}

func bodies(calls []call) []string {
	var out []string
	for _, c := range calls {
		out = append(out, c.body)
	}
	return out
}

func TestDeliversInOrderAndDeletesFiles(t *testing.T) {
	dir := t.TempDir()
	sender := newSender(ok)
	box := open(t, dir, sender)
	box.Start()
	for i := 1; i <= 20; i++ {
		kind, path := "race", "/internal/v1/races"
		if i%3 == 0 {
			kind, path = "room-rules", "/internal/v1/room-rules"
		}
		if err := box.Enqueue(kind, path, body{N: i, Text: "<&>"}); err != nil {
			t.Fatal(err)
		}
	}
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	calls := sender.snapshot()
	if len(calls) != 20 {
		t.Fatalf("calls %d", len(calls))
	}
	for i, c := range calls {
		want := `{"n":` + itoa(i+1) + `,"text":"<&>"}`
		if c.body != want {
			t.Fatalf("call %d body %s, want %s", i, c.body, want)
		}
		if wantRules := (i+1)%3 == 0; wantRules != (c.path == "/internal/v1/room-rules") {
			t.Fatalf("call %d path %s", i, c.path)
		}
	}
	if left := records(t, dir); len(left) != 0 {
		t.Fatalf("files left: %v", left)
	}
}

func itoa(n int) string {
	data, _ := json.Marshal(n)
	return string(data)
}

func TestRetriesInOrderWithBackoff(t *testing.T) {
	dir := t.TempDir()
	sender := newSender(func(n int, _ string, _ []byte) (int, error) {
		switch n {
		case 0:
			return 503, nil
		case 1:
			return 0, errors.New("connection refused")
		case 2:
			return 429, nil
		case 3:
			return 408, nil
		}
		return 201, nil
	})
	box := open(t, dir, sender)
	if err := box.Enqueue("race", "/a", body{N: 1}); err != nil {
		t.Fatal(err)
	}
	if err := box.Enqueue("race", "/b", body{N: 2}); err != nil {
		t.Fatal(err)
	}
	box.Start()
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	calls := sender.snapshot()
	paths := make([]string, len(calls))
	for i, c := range calls {
		paths[i] = c.path
	}
	if !slices.Equal(paths, []string{"/a", "/a", "/a", "/a", "/a", "/b"}) {
		t.Fatalf("paths %v", paths)
	}
}

func TestPermanentRejectionsGoToDeadLetters(t *testing.T) {
	dir := t.TempDir()
	sender := newSender(func(_ int, path string, _ []byte) (int, error) {
		switch path {
		case "/bad":
			return 400, nil
		case "/dup":
			return 409, nil
		}
		return 200, nil
	})
	box := open(t, dir, sender)
	box.Start()
	for _, path := range []string{"/bad", "/dup", "/good"} {
		if err := box.Enqueue("race", path, body{N: 1}); err != nil {
			t.Fatal(err)
		}
	}
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	if left := records(t, dir); len(left) != 0 {
		t.Fatalf("files left: %v", left)
	}
	dead := records(t, filepath.Join(dir, "dead"))
	if len(dead) != 1 || dead[0] != "00000000000000000001-race.json" {
		t.Fatalf("dead letters %v", dead)
	}
	data, err := os.ReadFile(filepath.Join(dir, "dead", dead[0]))
	if err != nil || string(data) != `{"path":"/bad","body":{"n":1}}` {
		t.Fatalf("dead letter %s %v", data, err)
	}
	if len(sender.snapshot()) != 3 {
		t.Fatalf("calls %v", sender.snapshot())
	}
}

func TestRestartResumesPendingFilesInOrder(t *testing.T) {
	dir := t.TempDir()
	down := newSender(func(int, string, []byte) (int, error) { return 502, nil })
	box := open(t, dir, down)
	box.Start()
	for i := 1; i <= 3; i++ {
		if err := box.Enqueue("race", "/r", body{N: i}); err != nil {
			t.Fatal(err)
		}
	}
	<-down.notify
	closeBox(t, box, 30*time.Millisecond)
	if err := box.Enqueue("race", "/r", body{N: 9}); !errors.Is(err, ErrClosed) {
		t.Fatalf("enqueue after close: %v", err)
	}
	names := records(t, dir)
	want := []string{"00000000000000000001-race.json", "00000000000000000002-race.json",
		"00000000000000000003-race.json"}
	if !slices.Equal(names, want) {
		t.Fatalf("files %v", names)
	}
	info, err := os.Stat(filepath.Join(dir, names[0]))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("file mode %v %v", info.Mode(), err)
	}
	dirInfo, err := os.Stat(dir)
	if err != nil || dirInfo.Mode().Perm() != 0o700 {
		t.Fatalf("dir mode %v %v", dirInfo.Mode(), err)
	}
	// A dead letter with a higher sequence keeps new records after it.
	if err := os.WriteFile(filepath.Join(dir, "dead", "00000000000000000007-race.json"), []byte(`{}`), 0o600); err != nil {
		t.Fatal(err)
	}
	// Half-written temporary files are dropped; corrupt records are dead-lettered.
	if err := os.WriteFile(filepath.Join(dir, ".tmp-00000000000000000004-race.json"), []byte(`{"pa`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "00000000000000000005-race.json"), []byte(`not json`), 0o600); err != nil {
		t.Fatal(err)
	}

	up := newSender(ok)
	reopened := open(t, dir, up)
	if reopened.Len() != 3 {
		t.Fatalf("resumed %d records", reopened.Len())
	}
	if err := reopened.Enqueue("race", "/r", body{N: 4}); err != nil {
		t.Fatal(err)
	}
	reopened.Start()
	waitFor(t, "delivery", func() bool { return reopened.Len() == 0 })
	closeBox(t, reopened, time.Second)
	got := bodies(up.snapshot())
	if !slices.Equal(got, []string{`{"n":1}`, `{"n":2}`, `{"n":3}`, `{"n":4}`}) {
		t.Fatalf("bodies %v", got)
	}
	dead := records(t, filepath.Join(dir, "dead"))
	if !slices.Contains(dead, "00000000000000000005-race.json") {
		t.Fatalf("corrupt record not dead-lettered: %v", dead)
	}
	if left := records(t, dir); len(left) != 0 {
		t.Fatalf("files left: %v", left)
	}
}

func TestCloseFlushesWithinDeadline(t *testing.T) {
	dir := t.TempDir()
	release := make(chan struct{})
	sender := newSender(func(n int, _ string, _ []byte) (int, error) {
		if n == 0 {
			<-release
		}
		return 200, nil
	})
	box := open(t, dir, sender)
	box.Start()
	for i := 1; i <= 2; i++ {
		if err := box.Enqueue("race", "/r", body{N: i}); err != nil {
			t.Fatal(err)
		}
	}
	go func() {
		time.Sleep(20 * time.Millisecond)
		close(release)
	}()
	// Close waits for the slow delivery, then sends the rest.
	closeBox(t, box, 2*time.Second)
	if box.Len() != 0 || len(sender.snapshot()) != 2 {
		t.Fatalf("left %d, calls %d", box.Len(), len(sender.snapshot()))
	}
	if left := records(t, dir); len(left) != 0 {
		t.Fatalf("files left: %v", left)
	}
}

func TestCloseWithoutStartPersists(t *testing.T) {
	dir := t.TempDir()
	box := open(t, dir, newSender(ok))
	if err := box.Enqueue("room-rules", "/x", map[string]string{"a": "b"}); err != nil {
		t.Fatal(err)
	}
	closeBox(t, box, time.Second)
	names := records(t, dir)
	if len(names) != 1 || !strings.HasSuffix(names[0], "-room-rules.json") {
		t.Fatalf("files %v", names)
	}
	if err := box.Enqueue("Bad Kind", "/x", nil); err == nil {
		t.Fatal("invalid kind accepted")
	}
}

func TestClassify(t *testing.T) {
	for status, want := range map[int]outcome{200: delivered, 204: delivered, 409: delivered,
		400: deadLetter, 410: deadLetter, 413: deadLetter, 422: deadLetter,
		401: retry, 403: retry, 404: retry, 405: retry,
		408: retry, 429: retry, 500: retry, 503: retry, 302: retry} {
		if got := classify(status, nil); got != want {
			t.Errorf("%d: got %v, want %v", status, got, want)
		}
	}
	if classify(200, errors.New("x")) != retry {
		t.Fatal("network error not retried")
	}
}

// While the data service is down, stored records live on disk only; they are
// read back when they reach the head of the queue (DESIGN.md 4.5).
func TestStoredRecordsAreNotKeptInMemory(t *testing.T) {
	dir := t.TempDir()
	var down sync.Mutex
	down.Lock()
	sender := newSender(func(int, string, []byte) (int, error) {
		if down.TryLock() {
			down.Unlock()
			return 200, nil
		}
		return 503, nil
	})
	box := open(t, dir, sender)
	box.Start()
	for i := 1; i <= 5; i++ {
		if err := box.Enqueue("race", "/internal/v1/races", body{N: i, Text: strings.Repeat("x", 1000)}); err != nil {
			t.Fatal(err)
		}
	}
	waitStored(t, box, 5)
	waitFor(t, "a failed delivery", func() bool { return len(sender.snapshot()) > 0 })
	box.mu.Lock()
	for _, e := range box.queue {
		if e.state != stateStored || e.body != nil {
			t.Errorf("%s: state %d, %d body bytes in memory", e.name, e.state, len(e.body))
		}
	}
	box.mu.Unlock()
	down.Unlock() // the data service is back
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	var delivered []int
	seen := map[int]bool{}
	for _, c := range sender.snapshot() {
		var b body
		if err := json.Unmarshal([]byte(c.body), &b); err != nil || len(b.Text) != 1000 {
			t.Fatalf("delivered %q: %v", c.body, err)
		}
		if !seen[b.N] {
			seen[b.N] = true
			delivered = append(delivered, b.N)
		}
	}
	if !slices.Equal(delivered, []int{1, 2, 3, 4, 5}) {
		t.Fatalf("delivered %v", delivered)
	}
	if left := records(t, dir); len(left) != 0 {
		t.Fatalf("files left %v", left)
	}
}

// A stored record whose file vanished cannot be sent; it is dropped (and
// logged) instead of blocking every later record.
func TestMissingStoredFileIsSkipped(t *testing.T) {
	dir := t.TempDir()
	block := make(chan struct{})
	sender := newSender(func(n int, _ string, _ []byte) (int, error) {
		if n == 0 {
			<-block
		}
		return 200, nil
	})
	box := open(t, dir, sender)
	box.Start()
	for i := 1; i <= 3; i++ {
		if err := box.Enqueue("race", "/internal/v1/races", body{N: i}); err != nil {
			t.Fatal(err)
		}
	}
	waitStored(t, box, 3)
	if err := os.Remove(filepath.Join(dir, "00000000000000000002-race.json")); err != nil {
		t.Fatal(err)
	}
	close(block)
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	if got := bodies(sender.snapshot()); !slices.Equal(got, []string{`{"n":1}`, `{"n":3}`}) {
		t.Fatalf("delivered %v", got)
	}
}

// waitStored waits until count records are queued and all of them are on disk.
func waitStored(t *testing.T, box *Outbox, count int) {
	t.Helper()
	waitFor(t, "records on disk", func() bool {
		box.mu.Lock()
		defer box.mu.Unlock()
		if len(box.queue) != count {
			return false
		}
		for _, e := range box.queue {
			if e.state != stateStored {
				return false
			}
		}
		return true
	})
}

// A wrong or rotated cluster key (401) or a wrong internal URL (404) is not
// a verdict on the record: it stays queued and is delivered once fixed.
func TestMisdirectedDeliveriesAreRetried(t *testing.T) {
	dir := t.TempDir()
	sender := newSender(func(n int, _ string, _ []byte) (int, error) {
		switch n {
		case 0, 1:
			return 401, nil
		case 2:
			return 404, nil
		}
		return 200, nil
	})
	box := open(t, dir, sender)
	box.Start()
	if err := box.Enqueue("race", "/internal/v1/races", body{N: 1}); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	if calls := sender.snapshot(); len(calls) != 4 {
		t.Fatalf("calls %v", calls)
	}
	if dead := records(t, filepath.Join(dir, "dead")); len(dead) != 0 {
		t.Fatalf("dead letters %v", dead)
	}
}

// gate blocks the writer until opened.
type gate struct {
	once    sync.Once
	entered chan struct{}
	open    chan struct{}
}

func newGate() *gate { return &gate{entered: make(chan struct{}, 1), open: make(chan struct{})} }

func (g *gate) hook(string) {
	select {
	case g.entered <- struct{}{}:
	default:
	}
	<-g.open
}

func (g *gate) release() { g.once.Do(func() { close(g.open) }) }

// Room rules are coalesced per room: a flood of updates while the disk is
// busy keeps at most two records, and only the newest is delivered.
func TestEnqueueLatestCoalescesPerKey(t *testing.T) {
	dir := t.TempDir()
	var up sync.Mutex
	up.Lock()
	sender := newSender(func(int, string, []byte) (int, error) {
		if up.TryLock() {
			up.Unlock()
			return 200, nil
		}
		return 503, nil
	})
	box := open(t, dir, sender)
	writer := newGate()
	box.writeHook = writer.hook
	box.Start()
	defer writer.release()
	if err := box.EnqueueLatest("room-rules", "rules:a", "/rules", body{N: 0}); err != nil {
		t.Fatal(err)
	}
	<-writer.entered // the first record is being written
	for i := 1; i < 10_000; i++ {
		if err := box.EnqueueLatest("room-rules", "rules:a", "/rules", body{N: i}); err != nil {
			t.Fatal(err)
		}
		if i == 5_000 {
			if err := box.Enqueue("race", "/races", body{N: -1}); err != nil {
				t.Fatal(err)
			}
		}
	}
	if n := box.Len(); n != 3 {
		t.Fatalf("%d records queued, want 3 (rules being written, newest rules, race)", n)
	}
	writer.release()
	// Once the newest rules are on disk the older record is dropped unsent.
	waitFor(t, "coalesced records on disk", func() bool { return box.Len() == 2 && len(records(t, dir)) == 2 })
	up.Unlock() // the data service is back
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	// Only the first record (sent while it was the head and the data service
	// was down) and the newest one ever reach the data service, which keeps
	// the newest.
	lastRules := ""
	for _, c := range sender.snapshot() {
		switch c.body {
		case `{"n":0}`, `{"n":9999}`:
			lastRules = c.body
		case `{"n":-1}`:
		default:
			t.Fatalf("superseded record sent: %s", c.body)
		}
	}
	if lastRules != `{"n":9999}` {
		t.Fatalf("last rules delivered %s", lastRules)
	}
	if left := records(t, dir); len(left) != 0 {
		t.Fatalf("files left %v", left)
	}
}

// Keyed records beyond MaxUnstored waiting for the disk are refused; the
// settlements are always accepted.
func TestBacklogCapRefusesKeyedRecordsOnly(t *testing.T) {
	dir := t.TempDir()
	sender := newSender(ok)
	box, err := Open(dir, sender, Options{MinBackoff: 5 * time.Millisecond, MaxBackoff: 20 * time.Millisecond,
		SendTimeout: time.Second, MaxUnstored: 10, Logger: quiet})
	if err != nil {
		t.Fatal(err)
	}
	writer := newGate()
	box.writeHook = writer.hook
	box.Start()
	defer writer.release()
	if err := box.EnqueueLatest("room-rules", "rules:0", "/rules", body{N: 0}); err != nil {
		t.Fatal(err)
	}
	<-writer.entered
	accepted, refused := 1, 0
	for i := 1; i < 100; i++ {
		switch err := box.EnqueueLatest("room-rules", "rules:"+itoa(i), "/rules", body{N: i}); {
		case err == nil:
			accepted++
		case errors.Is(err, ErrBacklog):
			refused++
		default:
			t.Fatal(err)
		}
	}
	// An update of a room whose record still waits is coalesced, not refused.
	if err := box.EnqueueLatest("room-rules", "rules:1", "/rules", body{N: 101}); err != nil {
		t.Fatal(err)
	}
	for i := range 20 {
		if err := box.Enqueue("race", "/races", body{N: 1000 + i}); err != nil {
			t.Fatal(err)
		}
	}
	if accepted != 11 || refused != 89 || box.Len() != 31 {
		t.Fatalf("accepted %d refused %d queued %d", accepted, refused, box.Len())
	}
	writer.release()
	waitFor(t, "delivery", func() bool { return box.Len() == 0 })
	closeBox(t, box, time.Second)
	if calls := sender.snapshot(); len(calls) != 31 || calls[1].body != `{"n":101}` {
		t.Fatalf("calls %v", calls)
	}
}

// Close keeps its deadline even when the disk is slow: the remaining
// settlements are written, the remaining keyed records are reported lost.
func TestCloseHonoursItsDeadline(t *testing.T) {
	dir := t.TempDir()
	var logs strings.Builder
	var logMu sync.Mutex
	logger := slog.New(slog.NewTextHandler(writerFunc(func(p []byte) (int, error) {
		logMu.Lock()
		defer logMu.Unlock()
		return logs.Write(p)
	}), nil))
	box, err := Open(dir, newSender(func(int, string, []byte) (int, error) { return 503, nil }),
		Options{MinBackoff: 5 * time.Millisecond, MaxBackoff: 20 * time.Millisecond,
			SendTimeout: time.Second, MaxUnstored: 100_000, Logger: logger})
	if err != nil {
		t.Fatal(err)
	}
	box.writeHook = func(string) { time.Sleep(2 * time.Millisecond) }
	box.Start()
	for i := range 5_000 {
		if err := box.EnqueueLatest("room-rules", "rules:"+itoa(i), "/rules", body{N: i}); err != nil {
			t.Fatal(err)
		}
		if i%1000 == 999 {
			if err := box.Enqueue("race", "/races", body{N: -i}); err != nil {
				t.Fatal(err)
			}
		}
	}
	began := time.Now()
	closeBox(t, box, 200*time.Millisecond)
	if elapsed := time.Since(began); elapsed > time.Second {
		t.Fatalf("Close took %v", elapsed)
	}
	var races int
	for _, name := range records(t, dir) {
		if strings.HasSuffix(name, "-race.json") {
			races++
		}
	}
	if races != 5 {
		t.Fatalf("%d settlements on disk, want 5", races)
	}
	logMu.Lock()
	defer logMu.Unlock()
	if !strings.Contains(logs.String(), "never reached the disk") {
		t.Fatalf("lost records not reported:\n%s", logs.String())
	}
}

type writerFunc func([]byte) (int, error)

func (f writerFunc) Write(p []byte) (int, error) { return f(p) }

// A record whose write failed is written again once the disk recovers, so it
// survives a restart.
func TestFailedWritesAreRetried(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("permissions do not apply to root")
	}
	dir := t.TempDir()
	down := newSender(func(int, string, []byte) (int, error) { return 503, nil })
	box := open(t, dir, down)
	box.Start()
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatal(err)
	}
	if err := box.Enqueue("race", "/races", body{N: 1}); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "a failed write", box.WriteFailing)
	if err := os.Chmod(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := box.Enqueue("race", "/races", body{N: 2}); err != nil {
		t.Fatal(err)
	}
	waitStored(t, box, 2)
	if box.WriteFailing() {
		t.Fatal("write failure still reported")
	}
	closeBox(t, box, 50*time.Millisecond)

	up := newSender(ok)
	reopened := open(t, dir, up)
	reopened.Start()
	waitFor(t, "delivery", func() bool { return reopened.Len() == 0 })
	closeBox(t, reopened, time.Second)
	if got := bodies(up.snapshot()); !slices.Equal(got, []string{`{"n":1}`, `{"n":2}`}) {
		t.Fatalf("delivered after restart %v", got)
	}
}
