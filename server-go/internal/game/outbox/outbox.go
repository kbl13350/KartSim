// Package outbox is the game node's durable, ordered queue of records for
// the data service (room rules and race settlements). Every record is a file
// "<20-digit sequence>-<kind>.json" holding {"path":…,"body":…}, written to a
// temporary name and renamed into place. One sender delivers files strictly
// in sequence order: 2xx and 409 delete the file; 401, 403, 404 and 405 (a
// wrong cluster key or internal URL, which affects every record), 408, 429,
// 5xx and network errors retry with exponential backoff; any other 4xx
// rejects that record and moves it to dead/. Files left by a previous run are
// delivered after a restart.
//
// Once a record is on disk its body is dropped from memory and read back
// only when it reaches the head of the queue, so a long data-service outage
// fills the disk, not the heap (DESIGN.md 4.5). Records that only matter
// until a newer one exists (room rules) are coalesced per key, and at most
// MaxUnstored of them wait in memory for the disk, so a client flooding
// rule changes cannot grow the heap or delay settlements behind a backlog.
package outbox

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Sender delivers one record. status is meaningful only when err is nil.
type Sender interface {
	Send(ctx context.Context, path string, body []byte) (status int, err error)
}

// Options tune an Outbox; zero values use the defaults.
type Options struct {
	MinBackoff  time.Duration // default 1 s
	MaxBackoff  time.Duration // default 30 s
	SendTimeout time.Duration // default 10 s
	// MaxUnstored caps the keyed records (EnqueueLatest) held in memory while
	// they wait for the disk; further keyed records are refused with
	// ErrBacklog. Enqueue's records (settlements) are never refused.
	// Default 1024.
	MaxUnstored int
	Logger      *slog.Logger
}

var (
	// ErrClosed is returned by Enqueue after Close.
	ErrClosed = errors.New("outbox closed")
	// ErrBacklog is returned by EnqueueLatest while too many keyed records
	// wait for the disk; the outbox logs these refusals itself.
	ErrBacklog = errors.New("outbox write backlog full")
)

var (
	recordName = regexp.MustCompile(`^(\d{20})-([a-z][a-z0-9-]*)\.json$`)
	kindName   = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)
)

const (
	tempPrefix = ".tmp-"
	deadDir    = "dead"
)

type state int

const (
	statePending  state = iota // in memory, not yet written
	stateStored                // on disk
	stateUnstored              // the write failed; retried, and delivered from memory meanwhile
)

// entry is one record. The writer owns it while writing, the sender while
// sending; neither touches an entry the other owns, and EnqueueLatest only
// replaces the body of an entry nobody owns that is not on disk yet.
type entry struct {
	name  string
	key   string // coalescing key; "" for records that are never superseded
	path  string
	body  json.RawMessage // nil once stored: the file holds it
	state state

	writing    bool
	sending    bool
	done       bool   // delivered, dead-lettered or dropped as superseded
	superseded bool   // a newer record of the key is on disk: drop, do not send
	prev       *entry // the older record of the key, dropped once this one is stored
}

// record is the file content.
type record struct {
	Path string          `json:"path"`
	Body json.RawMessage `json:"body"`
}

// Outbox is safe for concurrent use.
type Outbox struct {
	dir    string
	dead   string
	sender Sender
	opts   Options
	log    *slog.Logger

	mu            sync.Mutex
	seq           uint64
	queue         []*entry // sequence order; done entries are skipped and compacted away
	doneInQueue   int
	live          int      // records not yet delivered
	toWrite       []*entry // pending entries not yet taken by the writer, in order
	failed        []*entry // entries whose write failed, retried with backoff
	latest        map[string]*entry
	refused       int // keyed records refused since the last warning
	refusedLogged time.Time
	closed        bool
	started       bool
	persistCh     chan struct{}
	sendCh        chan struct{}
	stop          chan struct{} // closed when Close runs out of time

	writeHook func(name string) // tests: runs before each record file is written

	ctx         context.Context // cancels deliveries on Close
	cancel      context.CancelFunc
	persistDone chan struct{}
	sendDone    chan struct{}
}

// Open prepares dir (0700), removes half-written temporary files and loads
// the records left by a previous run. Call Start to begin delivery.
func Open(dir string, sender Sender, opts Options) (*Outbox, error) {
	if opts.MinBackoff <= 0 {
		opts.MinBackoff = time.Second
	}
	if opts.MaxBackoff <= 0 {
		opts.MaxBackoff = 30 * time.Second
	}
	if opts.SendTimeout <= 0 {
		opts.SendTimeout = 10 * time.Second
	}
	if opts.MaxUnstored <= 0 {
		opts.MaxUnstored = 1024
	}
	if opts.Logger == nil {
		opts.Logger = slog.Default()
	}
	o := &Outbox{
		dir:         dir,
		dead:        filepath.Join(dir, deadDir),
		sender:      sender,
		opts:        opts,
		log:         opts.Logger,
		latest:      map[string]*entry{},
		persistCh:   make(chan struct{}, 1),
		sendCh:      make(chan struct{}, 1),
		stop:        make(chan struct{}),
		persistDone: make(chan struct{}),
		sendDone:    make(chan struct{}),
	}
	o.ctx, o.cancel = context.WithCancel(context.Background())
	if err := os.MkdirAll(o.dead, 0o700); err != nil {
		return nil, fmt.Errorf("create outbox: %w", err)
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return nil, fmt.Errorf("protect outbox: %w", err)
	}
	if err := o.load(); err != nil {
		return nil, err
	}
	return o, nil
}

func (o *Outbox) load() error {
	deadFiles, err := os.ReadDir(o.dead)
	if err != nil {
		return fmt.Errorf("read outbox dead letters: %w", err)
	}
	for _, f := range deadFiles {
		if m := recordName.FindStringSubmatch(f.Name()); m != nil {
			o.seq = max(o.seq, parseSeq(m[1]))
		}
	}
	files, err := os.ReadDir(o.dir)
	if err != nil {
		return fmt.Errorf("read outbox: %w", err)
	}
	for _, f := range files {
		name := f.Name()
		if f.IsDir() {
			continue
		}
		if strings.HasPrefix(name, tempPrefix) {
			// A write that never reached its rename: the record was not
			// acknowledged as stored, so drop the fragment.
			_ = os.Remove(filepath.Join(o.dir, name))
			continue
		}
		m := recordName.FindStringSubmatch(name)
		if m == nil {
			continue
		}
		o.seq = max(o.seq, parseSeq(m[1]))
		data, err := os.ReadFile(filepath.Join(o.dir, name))
		var rec record
		if err == nil {
			err = json.Unmarshal(data, &rec)
		}
		if err != nil || rec.Path == "" || len(rec.Body) == 0 {
			o.log.Error("outbox record unreadable; moved to dead letters", "file", name, "error", err)
			_ = os.Rename(filepath.Join(o.dir, name), filepath.Join(o.dead, name))
			continue
		}
		o.queue = append(o.queue, &entry{name: name, path: rec.Path, state: stateStored})
	}
	slices.SortFunc(o.queue, func(a, b *entry) int { return strings.Compare(a.name, b.name) })
	o.live = len(o.queue)
	if len(o.queue) > 0 {
		o.log.Info("outbox resuming pending records", "count", len(o.queue))
	}
	return nil
}

func parseSeq(digits string) uint64 {
	value, _ := strconv.ParseUint(digits, 10, 64)
	return value
}

// Start launches the writer and the sender.
func (o *Outbox) Start() {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.started {
		return
	}
	o.started = true
	go o.persistLoop()
	go o.sendLoop()
	notify(o.persistCh)
	notify(o.sendCh)
}

// Enqueue appends a record. body is encoded now (callers hold their own lock
// so the order of Enqueue calls is the delivery order); the file is written
// by a background writer so Enqueue never blocks on the disk.
func (o *Outbox) Enqueue(kind, path string, body any) error {
	return o.enqueue(kind, "", path, body)
}

// EnqueueLatest appends a record that is obsolete once a newer record with
// the same key exists (room rules: the data service keeps only the newest).
// While the previous record of key is still waiting for the disk its body is
// replaced in place; otherwise the new record is appended and the older one
// is dropped unsent as soon as the new one is on disk. Beyond MaxUnstored
// keyed records waiting for the disk, it refuses with ErrBacklog.
func (o *Outbox) EnqueueLatest(kind, key, path string, body any) error {
	if key == "" {
		return errors.New("outbox: empty key")
	}
	return o.enqueue(kind, key, path, body)
}

func (o *Outbox) enqueue(kind, key, path string, body any) error {
	if !kindName.MatchString(kind) {
		return fmt.Errorf("outbox: invalid kind %q", kind)
	}
	encoded, err := marshal(body)
	if err != nil {
		return fmt.Errorf("outbox: encode %s: %w", kind, err)
	}
	o.mu.Lock()
	if o.closed {
		o.mu.Unlock()
		return ErrClosed
	}
	var prev *entry
	if key != "" {
		if e := o.latest[key]; e != nil && !e.done {
			if e.state != stateStored && !e.writing && !e.sending {
				e.path, e.body = path, encoded
				o.mu.Unlock()
				notify(o.persistCh)
				return nil
			}
			prev = e
		}
		if len(o.toWrite)+len(o.failed) >= o.opts.MaxUnstored {
			o.refuseLocked(kind)
			o.mu.Unlock()
			return ErrBacklog
		}
	}
	o.seq++
	e := &entry{name: fmt.Sprintf("%020d-%s.json", o.seq, kind), key: key, path: path,
		body: encoded, prev: prev}
	o.queue = append(o.queue, e)
	o.toWrite = append(o.toWrite, e)
	o.live++
	if key != "" {
		o.latest[key] = e
	}
	o.mu.Unlock()
	notify(o.persistCh)
	return nil
}

// refuseLocked counts a refused keyed record and warns at most every 10 s.
func (o *Outbox) refuseLocked(kind string) {
	o.refused++
	if now := time.Now(); now.Sub(o.refusedLogged) >= 10*time.Second {
		o.log.Warn("outbox write backlog full; records dropped",
			"kind", kind, "dropped", o.refused, "limit", o.opts.MaxUnstored)
		o.refused, o.refusedLogged = 0, now
	}
}

// Len reports how many records are not yet delivered.
func (o *Outbox) Len() int {
	o.mu.Lock()
	defer o.mu.Unlock()
	return o.live
}

// WriteFailing reports whether records whose write to the outbox directory
// failed are waiting in memory for another attempt.
func (o *Outbox) WriteFailing() bool {
	o.mu.Lock()
	defer o.mu.Unlock()
	for _, e := range o.failed {
		if !e.done && e.state == stateUnstored {
			return true
		}
	}
	return false
}

// Close stops accepting records, writes the queued ones to disk and keeps
// delivering until the queue is empty or ctx ends. When ctx ends first, the
// writer stores the remaining settlements, drops the remaining keyed records
// and stops. Undelivered records on disk are sent after the next start;
// records that never reached the disk are lost and logged as such.
func (o *Outbox) Close(ctx context.Context) error {
	o.mu.Lock()
	if o.closed {
		o.mu.Unlock()
		return nil
	}
	o.closed = true
	started := o.started
	o.started = true
	o.mu.Unlock()
	if !started {
		// Nothing was delivering: only write the queued records.
		o.cancel()
		close(o.sendDone)
		go o.persistLoop()
	}
	notify(o.persistCh)
	select {
	case <-o.persistDone:
	case <-ctx.Done():
		close(o.stop)
		<-o.persistDone
	}
	notify(o.sendCh)
	select {
	case <-o.sendDone:
	case <-ctx.Done():
		o.cancel()
		<-o.sendDone
	}
	o.cancel()
	o.reportLeftovers()
	return nil
}

func (o *Outbox) reportLeftovers() {
	o.mu.Lock()
	onDisk, inMemory := 0, 0
	for _, e := range o.queue {
		switch {
		case e.done:
		case e.state == stateStored:
			onDisk++
		default:
			inMemory++
		}
	}
	o.mu.Unlock()
	if onDisk > 0 {
		o.log.Warn("outbox closed with undelivered records; they are sent after restart",
			"count", onDisk)
	}
	if inMemory > 0 {
		o.log.Error("outbox closed with records that never reached the disk; they are lost",
			"count", inMemory)
	}
}

func (o *Outbox) stopping() bool {
	select {
	case <-o.stop:
		return true
	default:
		return false
	}
}

// persistLoop writes queued records in batches (one directory sync per
// batch) and retries failed writes with backoff, until the outbox is closed
// and nothing is left to write.
func (o *Outbox) persistLoop() {
	defer close(o.persistDone)
	backoff := o.opts.MinBackoff
	var retryAt time.Time
	finalAttempt := false
	for {
		o.mu.Lock()
		closed, stopping := o.closed, o.stopping()
		// After Close, a failed write is retried exactly once more, whatever
		// the backoff.
		retryFailed := len(o.failed) > 0 &&
			((!closed && !time.Now().Before(retryAt)) || (closed && !finalAttempt))
		if closed && retryFailed {
			finalAttempt = true
		}
		batch := o.takeLocked(retryFailed, stopping)
		waitRetry := len(o.failed) > 0 && !(closed && finalAttempt)
		o.mu.Unlock()
		if len(batch) == 0 {
			if closed {
				return
			}
			var retry <-chan time.Time
			if waitRetry {
				// At least MinBackoff: the failed records may all be in
				// delivery, and then nothing was taken.
				retry = time.After(max(time.Until(retryAt), o.opts.MinBackoff))
			}
			select {
			case <-o.persistCh:
			case <-retry:
			}
			continue
		}
		if o.writeBatch(batch) {
			retryAt = time.Now().Add(backoff)
			backoff = min(backoff*2, o.opts.MaxBackoff)
		} else if retryFailed {
			backoff = o.opts.MinBackoff
		}
		notify(o.sendCh)
	}
}

// takeLocked hands the writer every queued entry (and, when retryFailed,
// every failed one nobody is delivering). Once Close has run out of time only
// unkeyed records (settlements) are still written.
func (o *Outbox) takeLocked(retryFailed, stopping bool) []*entry {
	var batch []*entry
	if retryFailed {
		keep := o.failed[:0]
		for _, e := range o.failed {
			switch {
			case e.done || e.state != stateUnstored:
			case e.sending || (stopping && e.key != ""):
				keep = append(keep, e)
			default:
				batch = append(batch, e)
			}
		}
		clear(o.failed[len(keep):])
		o.failed = keep
	}
	for _, e := range o.toWrite {
		if !e.done && (!stopping || e.key == "") {
			batch = append(batch, e)
		}
	}
	// When stopping, the keyed records left out stay in memory only; Close
	// reports them as lost.
	o.toWrite = nil
	for _, e := range batch {
		e.writing = true
	}
	return batch
}

// writeBatch writes each record file (temp file, fsync, rename), then syncs
// the directory once. It reports whether any write failed.
func (o *Outbox) writeBatch(batch []*entry) bool {
	errs := make([]error, len(batch))
	skipped := make([]bool, len(batch))
	wrote := false
	for i, e := range batch {
		if e.key != "" && o.stopping() {
			skipped[i] = true
			continue
		}
		if o.writeHook != nil {
			o.writeHook(e.name)
		}
		// The writer owns e: nobody changes its path or body meanwhile.
		data, err := marshal(record{Path: e.path, Body: e.body})
		if err == nil {
			err = writeRecord(o.dir, e.name, data)
		}
		errs[i] = err
		wrote = wrote || err == nil
	}
	if wrote {
		syncDir(o.dir)
	}
	var obsolete []string
	var firstErr error
	failures := 0
	o.mu.Lock()
	for i, e := range batch {
		e.writing = false
		switch {
		case skipped[i]:
		case errs[i] != nil:
			failures++
			firstErr = cmp.Or(firstErr, errs[i])
			e.state = stateUnstored
			o.failed = append(o.failed, e)
		default:
			e.state = stateStored
			e.body = nil
			if p := e.prev; p != nil {
				e.prev = nil
				if name := o.dropLocked(p); name != "" {
					obsolete = append(obsolete, name)
				}
			}
		}
	}
	o.mu.Unlock()
	for _, name := range obsolete {
		o.removeFile(name)
	}
	if failures > 0 {
		o.log.Error("outbox write failed; records kept in memory and retried",
			"count", failures, "error", firstErr)
	}
	return failures > 0
}

// dropLocked discards p, an older record of a key whose newer record is now
// on disk. An entry the sender owns is only flagged; the sender drops it if
// that delivery fails. It returns the file to remove, if any.
func (o *Outbox) dropLocked(p *entry) string {
	if p.done {
		return ""
	}
	if p.sending || p.writing {
		p.superseded = true
		return ""
	}
	stored := p.state == stateStored
	o.markDoneLocked(p)
	if stored {
		return p.name
	}
	return ""
}

// markDoneLocked takes e out of the undelivered records and compacts the
// queue: leading done entries go at once, the others once they are half of it.
func (o *Outbox) markDoneLocked(e *entry) {
	e.done = true
	e.body = nil
	o.live--
	o.doneInQueue++
	if e.key != "" && o.latest[e.key] == e {
		delete(o.latest, e.key)
	}
	for len(o.queue) > 0 && o.queue[0].done {
		o.queue[0] = nil
		o.queue = o.queue[1:]
		o.doneInQueue--
	}
	if o.doneInQueue > 64 && o.doneInQueue*2 > len(o.queue) {
		o.queue = slices.DeleteFunc(o.queue, func(e *entry) bool { return e.done })
		o.doneInQueue = 0
	}
}

func (o *Outbox) removeFile(name string) {
	if err := os.Remove(filepath.Join(o.dir, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
		o.log.Error("outbox cleanup failed", "file", name, "error", err)
	}
}

// writeRecord writes data to dir/name atomically: temp file, fsync, rename.
// The caller syncs the directory.
func writeRecord(dir, name string, data []byte) error {
	tmp := filepath.Join(dir, tempPrefix+name)
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Rename(tmp, filepath.Join(dir, name))
	}
	if err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

// writeFile is writeRecord followed by a directory sync.
func writeFile(dir, name string, data []byte) error {
	if err := writeRecord(dir, name, data); err != nil {
		return err
	}
	syncDir(dir)
	return nil
}

func syncDir(dir string) {
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
}

type outcome int

const (
	delivered outcome = iota
	deadLetter
	retry
)

func classify(status int, err error) outcome {
	switch {
	case err != nil:
		return retry
	case status >= 200 && status <= 299, status == http.StatusConflict:
		return delivered
	case status == http.StatusRequestTimeout, status == http.StatusTooManyRequests,
		misdirected(status):
		return retry
	case status >= 400 && status <= 499:
		return deadLetter
	default:
		return retry
	}
}

// misdirected statuses mean the request never reached a handler that judged
// the record: a wrong or rotated cluster key (401/403) or a wrong internal
// URL (404/405). They affect every record, so the record is kept and retried.
func misdirected(status int) bool {
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusMethodNotAllowed:
		return true
	}
	return false
}

func (o *Outbox) sendLoop() {
	defer close(o.sendDone)
	backoff := o.opts.MinBackoff
	for {
		if o.ctx.Err() != nil {
			return
		}
		o.mu.Lock()
		if o.closed && o.live == 0 {
			o.mu.Unlock()
			return
		}
		head, body, obsolete := o.nextLocked()
		o.mu.Unlock()
		if obsolete != "" {
			o.removeFile(obsolete)
			continue
		}
		if head == nil {
			select {
			case <-o.sendCh:
			case <-o.ctx.Done():
				return
			}
			continue
		}

		if body == nil {
			var err error
			if body, err = o.readBody(head); err != nil {
				o.log.Error("outbox record unreadable; moved to dead letters", "file", head.name, "error", err)
				o.finish(head, true, nil)
				continue
			}
		}
		ctx, cancel := context.WithTimeout(o.ctx, o.opts.SendTimeout)
		status, err := o.sender.Send(ctx, head.path, body)
		cancel()
		switch classify(status, err) {
		case delivered:
			o.finish(head, false, body)
			backoff = o.opts.MinBackoff
		case deadLetter:
			o.log.Error("data service rejected outbox record; moved to dead letters",
				"file", head.name, "path", head.path, "status", status)
			o.finish(head, true, body)
			backoff = o.opts.MinBackoff
		case retry:
			o.mu.Lock()
			head.sending = false
			o.mu.Unlock()
			if o.ctx.Err() != nil {
				return
			}
			if err == nil && misdirected(status) {
				o.log.Error("data service refused the cluster key or path; check KART_CLUSTER_SECRET "+
					"and KART_DATA_INTERNAL_URL (records are kept and retried)",
					"file", head.name, "path", head.path, "status", status, "backoff", backoff)
			} else {
				o.log.Warn("outbox delivery failed; retrying", "file", head.name,
					"status", status, "error", err, "backoff", backoff)
			}
			timer := time.NewTimer(backoff)
			select {
			case <-timer.C:
			case <-o.ctx.Done():
				timer.Stop()
				return
			}
			backoff = min(backoff*2, o.opts.MaxBackoff)
		}
	}
}

// nextLocked claims the head for delivery: it returns the entry (marked as
// sending) and, unless the record is on disk, its body. A head superseded by
// a stored newer record is dropped instead and its file returned for
// removal. A head not yet written (or being written) is not sendable.
func (o *Outbox) nextLocked() (head *entry, body json.RawMessage, obsolete string) {
	if len(o.queue) == 0 {
		return nil, nil, ""
	}
	e := o.queue[0]
	if e.writing || e.state == statePending {
		return nil, nil, ""
	}
	if e.superseded {
		stored := e.state == stateStored
		o.markDoneLocked(e)
		if stored {
			return nil, nil, e.name
		}
		return o.nextLocked()
	}
	e.sending = true
	if e.state != stateStored {
		body = e.body
	}
	return e, body, ""
}

// readBody reads a stored record back from its file.
func (o *Outbox) readBody(e *entry) (json.RawMessage, error) {
	data, err := os.ReadFile(filepath.Join(o.dir, e.name))
	if err != nil {
		return nil, err
	}
	var rec record
	if err := json.Unmarshal(data, &rec); err != nil {
		return nil, err
	}
	if len(rec.Body) == 0 {
		return nil, errors.New("record has no body")
	}
	return rec.Body, nil
}

// finish removes the delivered head, or moves it to dead/. body is the
// record sent (needed when it never reached the disk).
func (o *Outbox) finish(e *entry, dead bool, body json.RawMessage) {
	o.mu.Lock()
	stored := e.state == stateStored
	o.mu.Unlock()
	source := filepath.Join(o.dir, e.name)
	switch {
	case dead && stored:
		if err := os.Rename(source, filepath.Join(o.dead, e.name)); err != nil {
			o.log.Error("outbox dead-letter move failed", "file", e.name, "error", err)
		}
	case dead:
		data, err := marshal(record{Path: e.path, Body: body})
		if err == nil {
			err = writeFile(o.dead, e.name, data)
		}
		if err != nil {
			o.log.Error("outbox dead-letter write failed", "file", e.name, "error", err)
		}
	case stored:
		o.removeFile(e.name)
	}
	o.mu.Lock()
	e.sending = false
	o.markDoneLocked(e)
	o.mu.Unlock()
}

// marshal encodes like Jackson: no HTML escaping, no trailing newline.
func marshal(value any) (json.RawMessage, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		return nil, err
	}
	return json.RawMessage(bytes.TrimRight(buf.Bytes(), "\n")), nil
}

func notify(ch chan struct{}) {
	select {
	case ch <- struct{}{}:
	default:
	}
}
