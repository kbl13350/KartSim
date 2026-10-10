// Package wsdeflate is the permessage-deflate policy (RFC 7692) of the game
// node and data service WebSockets. Browsers offer the extension on their
// own; when the upgrader enables it, large JSON text messages are sent
// compressed, while short ones and binary motion frames are not. Compression
// has no context takeover (gorilla's only mode), so it keeps no per-socket
// state. An inbound message may be compressed too, so its size is checked
// after decompression: gorilla's SetReadLimit counts only the wire bytes.
package wsdeflate

import (
	"io"
	"time"

	"github.com/gorilla/websocket"
)

// MinBytes is the smallest text message worth compressing. Room snapshots
// (2–4 KiB) shrink to about a fifth; shorter JSON saves little and still
// costs one deflate per recipient.
const MinBytes = 512

// Write sends one data message, compressed only when the peer negotiated
// the extension and the message is text of at least MinBytes. It must be
// called from the socket's single writer goroutine.
func Write(socket *websocket.Conn, kind int, data []byte) error {
	socket.EnableWriteCompression(kind == websocket.TextMessage && len(data) >= MinBytes)
	return socket.WriteMessage(kind, data)
}

// Read is ReadMessage with limit applied to the decompressed message as
// well: a larger one closes the socket with 1009, as gorilla does for the
// wire limit, and returns websocket.ErrReadLimit.
func Read(socket *websocket.Conn, limit int64) (int, []byte, error) {
	kind, reader, err := socket.NextReader()
	if err != nil {
		return kind, nil, err
	}
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return kind, nil, err
	}
	if int64(len(data)) > limit {
		_ = socket.WriteControl(websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseMessageTooBig, ""), time.Now().Add(time.Second))
		return kind, nil, websocket.ErrReadLimit
	}
	return kind, data, nil
}
