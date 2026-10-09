package messenger

import (
	"log/slog"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// conn is one socket with its bounded outbound queue (the game node's
// internal/game/ws conn, text frames only). The hub never blocks on it:
// pushes are queued and one writer goroutine drains them.
type conn struct {
	socket *websocket.Conn
	opts   *Options
	log    *slog.Logger

	// Set by the socket's reader goroutine at hello, under Hub.mu; pushes
	// read them under Hub.mu as well.
	account    *account
	accountID  string
	sessionKey string // the session token digest, for CloseSession
	token      string // the session token, for the periodic re-check
	// helloed is only used by the reader goroutine (and the ping/pong
	// handlers it runs).
	helloed bool

	mu     sync.Mutex
	queue  []frame
	queued int // bytes not yet written
	// held queues pushes until the welcome is sent, so welcome is always
	// the first frame after hello.
	held      bool
	heldQueue []frame
	closed    bool // no more frames are queued
	closing   bool // a close frame is queued
	wake      chan struct{}
	done      chan struct{}
	once      sync.Once
}

// frame is a text frame, or a close frame when closeCode is set.
type frame struct {
	data      []byte
	closeCode int
}

func newConn(socket *websocket.Conn, opts *Options, log *slog.Logger) *conn {
	return &conn{socket: socket, opts: opts, log: log, wake: make(chan struct{}, 1), done: make(chan struct{})}
}

// send queues a text frame; it never blocks. A peer that falls more than
// SendBufferLimit bytes behind is disconnected with 1008 and its queue is
// dropped.
func (c *conn) send(data []byte) {
	if data == nil {
		return
	}
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return
	}
	if c.queued+len(data) > c.opts.SendBufferLimit {
		c.closed = true
		c.queue, c.heldQueue = nil, nil
		c.queued = 0
		c.mu.Unlock()
		c.log.Warn("messenger send buffer overflow; closing connection", "limitBytes", c.opts.SendBufferLimit)
		go c.closeWith(websocket.ClosePolicyViolation, "send buffer overflow")
		return
	}
	c.queued += len(data)
	if c.held {
		c.heldQueue = append(c.heldQueue, frame{data: data})
		c.mu.Unlock()
		return
	}
	c.queue = append(c.queue, frame{data: data})
	c.mu.Unlock()
	c.signal()
}

// hold makes later pushes wait for release.
func (c *conn) hold() {
	c.mu.Lock()
	c.held = true
	c.mu.Unlock()
}

// release queues first (the welcome) and then the pushes held since hold.
func (c *conn) release(first []byte) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return
	}
	c.queue = append(c.queue, frame{data: first})
	c.queue = append(c.queue, c.heldQueue...)
	c.queued += len(first)
	c.heldQueue, c.held = nil, false
	c.mu.Unlock()
	c.signal()
}

// closeAfter queues a close frame behind the frames already queued (held
// pushes are dropped), so an error reply reaches the client before the
// socket closes. Nothing is queued after it.
func (c *conn) closeAfter(code int, reason string) {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return
	}
	c.closed, c.closing = true, true
	c.heldQueue = nil
	c.queue = append(c.queue, frame{data: []byte(reason), closeCode: code})
	c.mu.Unlock()
	c.signal()
}

// finish ends the connection once its reader stopped: a queued close frame
// (and the replies before it) still gets up to WriteTimeout to go out.
func (c *conn) finish() {
	c.mu.Lock()
	closing := c.closing
	c.mu.Unlock()
	if closing {
		timer := time.NewTimer(c.opts.WriteTimeout + time.Second)
		select {
		case <-c.done:
		case <-timer.C:
		}
		timer.Stop()
	}
	c.terminate()
}

func (c *conn) signal() {
	select {
	case c.wake <- struct{}{}:
	default:
	}
}

func (c *conn) writeLoop() {
	ticker := time.NewTicker(c.opts.PingInterval)
	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			return
		case <-c.wake:
			c.mu.Lock()
			batch := c.queue
			c.queue = nil
			c.mu.Unlock()
			for _, f := range batch {
				if f.closeCode != 0 {
					c.closeWith(f.closeCode, string(f.data))
					return
				}
				_ = c.socket.SetWriteDeadline(time.Now().Add(c.opts.WriteTimeout))
				if err := c.socket.WriteMessage(websocket.TextMessage, f.data); err != nil {
					c.terminate()
					return
				}
				c.mu.Lock()
				c.queued -= len(f.data)
				c.mu.Unlock()
			}
		case <-ticker.C:
			if err := c.socket.WriteControl(websocket.PingMessage, nil,
				time.Now().Add(c.opts.WriteTimeout)); err != nil {
				c.terminate()
				return
			}
		}
	}
}

// closeWith sends a close frame now, then drops the socket.
func (c *conn) closeWith(code int, text string) {
	_ = c.socket.WriteControl(websocket.CloseMessage,
		websocket.FormatCloseMessage(code, text), time.Now().Add(time.Second))
	c.terminate()
}

// terminate stops the writer and closes the socket; the reader then fails
// and the hub detaches the connection.
func (c *conn) terminate() {
	c.once.Do(func() {
		c.mu.Lock()
		c.closed = true
		c.queue, c.heldQueue = nil, nil
		c.queued = 0
		c.mu.Unlock()
		close(c.done)
		_ = c.socket.Close()
	})
}

// limiter is a token bucket: rate tokens per second, at most burst.
type limiter struct {
	rate   float64 // <= 0 disables the limit
	burst  float64
	tokens float64
	last   time.Time
}

func newLimiter(rate float64, burst int) limiter {
	return limiter{rate: rate, burst: float64(burst), tokens: float64(burst)}
}

func (b *limiter) allow(now time.Time) bool {
	if b.rate <= 0 {
		return true
	}
	if !b.last.IsZero() {
		b.tokens = min(b.burst, b.tokens+now.Sub(b.last).Seconds()*b.rate)
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// full reports whether the bucket has refilled (it can be forgotten).
func (b *limiter) full(now time.Time) bool {
	return b.last.IsZero() || b.tokens+now.Sub(b.last).Seconds()*b.rate >= b.burst
}
