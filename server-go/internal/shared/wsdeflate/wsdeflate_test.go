package wsdeflate

import (
	"bytes"
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// countingConn counts the bytes read from the wire.
type countingConn struct {
	net.Conn
	read *atomic.Int64
}

func (c countingConn) Read(p []byte) (int, error) {
	n, err := c.Conn.Read(p)
	c.read.Add(int64(n))
	return n, err
}

// dial connects to serve, offering permessage-deflate when compress is set.
func dial(t *testing.T, compress bool, serve func(*websocket.Conn)) (*websocket.Conn, *http.Response, *atomic.Int64) {
	t.Helper()
	upgrader := websocket.Upgrader{EnableCompression: true}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		socket, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer socket.Close()
		serve(socket)
	}))
	t.Cleanup(server.Close)
	read := &atomic.Int64{}
	dialer := websocket.Dialer{EnableCompression: compress,
		NetDialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			conn, err := (&net.Dialer{}).DialContext(ctx, network, address)
			if err != nil {
				return nil, err
			}
			return countingConn{Conn: conn, read: read}, nil
		}}
	socket, response, err := dialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { socket.Close() })
	return socket, response, read
}

// receive asks the server for its next message (serve answers one write per
// request, so the client's buffered reads stop at that message) and returns
// it with the wire bytes it took.
func receive(t *testing.T, socket *websocket.Conn, read *atomic.Int64) (int, []byte, int64) {
	t.Helper()
	before := read.Load()
	if err := socket.WriteMessage(websocket.TextMessage, []byte("next")); err != nil {
		t.Fatal(err)
	}
	_ = socket.SetReadDeadline(time.Now().Add(5 * time.Second))
	kind, data, err := socket.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	return kind, data, read.Load() - before
}

func TestWriteCompressesOnlyLargeText(t *testing.T) {
	large := []byte(`{"type":"room","members":[` + strings.Repeat(`{"name":"Player","ready":true},`, 100) + `{}]}`)
	short := bytes.Repeat([]byte("a"), MinBytes-1)
	motion := bytes.Repeat([]byte{7}, 4096)
	socket, response, read := dial(t, true, func(server *websocket.Conn) {
		for _, message := range []struct {
			kind int
			data []byte
		}{{websocket.TextMessage, large}, {websocket.TextMessage, short}, {websocket.BinaryMessage, motion}} {
			if _, _, err := server.ReadMessage(); err != nil {
				return
			}
			if err := Write(server, message.kind, message.data); err != nil {
				return
			}
		}
		_, _, _ = server.ReadMessage() // until the client closes
	})
	if extensions := response.Header.Get("Sec-WebSocket-Extensions"); !strings.Contains(extensions, "permessage-deflate") {
		t.Fatalf("extension not negotiated: %q", extensions)
	}

	kind, data, wire := receive(t, socket, read)
	if kind != websocket.TextMessage || !bytes.Equal(data, large) {
		t.Fatalf("large text arrived as %d %q", kind, data)
	}
	if wire >= int64(len(large))/4 {
		t.Fatalf("large text took %d wire bytes for %d", wire, len(large))
	}
	kind, data, wire = receive(t, socket, read)
	if kind != websocket.TextMessage || !bytes.Equal(data, short) || wire < int64(len(short)) {
		t.Fatalf("short text: kind %d, %d bytes, %d on the wire", kind, len(data), wire)
	}
	kind, data, wire = receive(t, socket, read)
	if kind != websocket.BinaryMessage || !bytes.Equal(data, motion) || wire < int64(len(motion)) {
		t.Fatalf("binary: kind %d, %d bytes, %d on the wire", kind, len(data), wire)
	}
}

func TestWriteWithoutNegotiation(t *testing.T) {
	large := bytes.Repeat([]byte("b"), 4096)
	socket, response, read := dial(t, false, func(server *websocket.Conn) {
		if _, _, err := server.ReadMessage(); err == nil {
			_ = Write(server, websocket.TextMessage, large)
		}
		_, _, _ = server.ReadMessage()
	})
	if extensions := response.Header.Get("Sec-WebSocket-Extensions"); extensions != "" {
		t.Fatalf("unexpected extension %q", extensions)
	}
	if _, data, wire := receive(t, socket, read); !bytes.Equal(data, large) || wire < int64(len(large)) {
		t.Fatalf("got %d bytes with %d on the wire", len(data), wire)
	}
}

func TestReadLimitsDecompressedSize(t *testing.T) {
	const limit = 1024
	type result struct {
		data []byte
		err  error
	}
	results := make(chan result, 2)
	socket, _, _ := dial(t, true, func(server *websocket.Conn) {
		server.SetReadLimit(limit)
		for range 2 {
			_, data, err := Read(server, limit)
			results <- result{data, err}
			if err != nil {
				return
			}
		}
	})
	fits := bytes.Repeat([]byte("c"), limit)
	if err := socket.WriteMessage(websocket.TextMessage, fits); err != nil {
		t.Fatal(err)
	}
	if got := <-results; got.err != nil || !bytes.Equal(got.data, fits) {
		t.Fatalf("message at the limit: %d bytes, %v", len(got.data), got.err)
	}
	// About 100 bytes on the wire, 1 MiB once inflated.
	if err := socket.WriteMessage(websocket.TextMessage, bytes.Repeat([]byte("d"), 1<<20)); err != nil {
		t.Fatal(err)
	}
	if got := <-results; !errors.Is(got.err, websocket.ErrReadLimit) {
		t.Fatalf("inflated message: %d bytes, %v", len(got.data), got.err)
	}
	_ = socket.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, _, err := socket.ReadMessage()
	if !websocket.IsCloseError(err, websocket.CloseMessageTooBig) {
		t.Fatalf("client saw %v, want close 1009", err)
	}
}
