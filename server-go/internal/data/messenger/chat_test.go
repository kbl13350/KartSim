package messenger

import (
	"strings"
	"testing"
)

func TestChatChannels(t *testing.T) {
	h := newTestHub(t, Options{})
	h.backend.clubs["a"], h.backend.clubs["b"] = 7, 7
	a, b, c := h.connect("a"), h.connect("b"), h.connect("c")
	// Before joining nobody hears the channels.
	a.send(map[string]any{"type": "chat-join", "requestId": "j"})
	if joined := a.expect("chat-joined"); joined["hasClub"] != true || len(joined["all"].([]any)) != 0 {
		t.Fatalf("joined %v", joined)
	}
	a.send(map[string]any{"type": "chat", "channel": "all", "text": " 大家好 ", "requestId": "1"})
	if line := a.expect("chat")["line"].(map[string]any); line["text"] != "大家好" || line["from"] != "Na" {
		t.Fatalf("line %v", line)
	}
	a.expect("chat-sent")
	// b and c join and get the history; the club channel reaches club members only.
	b.send(map[string]any{"type": "chat-join"})
	if joined := b.expect("chat-joined"); len(joined["all"].([]any)) != 1 {
		t.Fatalf("history %v", joined)
	}
	c.send(map[string]any{"type": "chat-join"})
	if joined := c.expect("chat-joined"); joined["hasClub"] != false {
		t.Fatalf("c joined %v", joined)
	}
	b.send(map[string]any{"type": "chat", "channel": "club", "text": "俱乐部集合"})
	if line := a.expect("chat")["line"].(map[string]any); line["channel"] != "club" || line["from"] != "Nb" {
		t.Fatalf("club line %v", line)
	}
	b.expect("chat")
	b.expect("chat-sent")
	c.send(map[string]any{"type": "chat", "channel": "club", "text": "我也要"})
	if frame := c.expect("error"); frame["code"] != "NOT_IN_CLUB" {
		t.Fatalf("club without a club %v", frame)
	}
	c.send(map[string]any{"type": "chat", "channel": "all", "text": strings.Repeat("长", 31)})
	if frame := c.expect("error"); frame["code"] != "INVALID_CHAT" {
		t.Fatalf("too long %v", frame)
	}
	c.send(map[string]any{"type": "chat-leave"})
	// A socket's commands run in order: the pong says the leave is done.
	c.send(map[string]any{"type": "ping"})
	c.expect("pong")
	a.send(map[string]any{"type": "chat", "channel": "all", "text": "再见"})
	a.expect("chat")
	a.expect("chat-sent")
	b.expect("chat")
	c.quiet()
}

func TestChatChannelFlood(t *testing.T) {
	h := newTestHub(t, Options{ChatRate: 1, ChatBurst: 2})
	a := h.connect("a")
	a.send(map[string]any{"type": "chat-join"})
	a.expect("chat-joined")
	for i := range 2 {
		a.send(map[string]any{"type": "chat", "channel": "all", "text": "第" + itoa(int64(i))})
		a.expect("chat")
		a.expect("chat-sent")
	}
	a.send(map[string]any{"type": "chat", "channel": "all", "text": "刷屏"})
	if frame := a.expect("error"); frame["code"] != "CHAT_FLOOD" {
		t.Fatalf("flood %v", frame)
	}
}
