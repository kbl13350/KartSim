package lobby

import (
	"context"
	"strings"
	"testing"
	"unicode/utf8"
)

// replyBytes runs a raw JSON command and returns the encoded reply.
func (h *harness) replyBytes(c *Client, payload string) (string, error) {
	h.t.Helper()
	in, err := ParseRequest([]byte(payload))
	if err != nil {
		return "", err
	}
	reply, err := h.lobby.Handle(context.Background(), c, in)
	if err != nil {
		return "", err
	}
	return string(reply.Encode("")), nil
}

func (h *harness) codeOfJSON(c *Client, payload string) string {
	h.t.Helper()
	_, err := h.replyBytes(c, payload)
	return codeOf(h.t, err)
}

func TestIntegerAcceptsOnlyIntegralInt32Literals(t *testing.T) {
	h := newHarness(t)
	alice := h.connect("Alice")
	for _, tc := range []struct {
		page string
		want string
	}{
		{"5", ""},
		{"-0", ""},
		{"0", ""},
		{"5.0", "INVALID_PAGE"},
		{"1e2", "INVALID_PAGE"},
		{"1E2", "INVALID_PAGE"},
		{`"5"`, "INVALID_PAGE"},
		{"true", "INVALID_PAGE"},
		{"null", "INVALID_PAGE"},
		{"-1", "INVALID_PAGE"},
		{"100001", "INVALID_PAGE"},
		{"2147483648", "INVALID_PAGE"},
		{"99999999999999999999999", "INVALID_PAGE"},
	} {
		_, err := h.replyBytes(alice, `{"type":"list-ordinary","page":`+tc.page+`}`)
		if tc.want == "" {
			if err != nil {
				t.Errorf("page %s rejected: %v", tc.page, err)
			}
			continue
		}
		if code := codeOf(t, err); code != tc.want {
			t.Errorf("page %s: got %s, want %s", tc.page, code, tc.want)
		}
	}
	if code := h.codeOfJSON(alice, `{"type":"list-ordinary"}`); code != "INVALID_PAGE" {
		t.Fatalf("missing page: %s", code)
	}
}

func TestRevisionPresenceFollowsHasNotHasNonNull(t *testing.T) {
	h := newHarness(t)
	alice, bob := h.connect("Alice"), h.connect("Bob")
	room := h.create([]*Client{alice}, "ordinary", "speedIndiCombine", 2)
	roomID := room["roomId"].(string)
	// has("revision") is true for null, so it must be a valid integer.
	if code := h.codeOfJSON(alice, `{"type":"changing","roomId":"`+roomID+`","changing":true,"revision":null}`); code != "INVALID_REVISION" {
		t.Fatalf("null revision: %s", code)
	}
	if code := h.codeOfJSON(alice, `{"type":"changing","roomId":"`+roomID+`","changing":true,"revision":2147483647}`); code != "STALE_REVISION" {
		t.Fatalf("max int revision: %s", code)
	}
	if code := h.codeOfJSON(alice, `{"type":"changing","roomId":"`+roomID+`","changing":true,"revision":2147483648}`); code != "INVALID_REVISION" {
		t.Fatalf("overflowing revision: %s", code)
	}
	if code := h.codeOfJSON(alice, `{"type":"changing","roomId":"`+roomID+`","changing":"true"}`); code != "INVALID_CHANGING" {
		t.Fatalf("string boolean: %s", code)
	}
	// optionalText uses hasNonNull: a null password is "".
	if _, err := h.replyBytes(bob, `{"type":"join","roomId":"`+roomID+`","password":null}`); err != nil {
		t.Fatalf("join with null password: %v", err)
	}
}

func TestTextCountsCodePointsAndRejectsISOControls(t *testing.T) {
	h := newHarness(t)
	alice := h.connect("Alice")
	room := h.create([]*Client{alice}, "ordinary", "speedIndiCombine", 2)
	roomID := room["roomId"].(string)
	settings := func(name string) string {
		return `{"type":"room-settings","roomId":"` + roomID + `","name":` + name + `}`
	}
	emoji18 := strings.Repeat("😀", 18) // 18 code points, 36 UTF-16 units
	if _, err := h.replyBytes(alice, settings(`"`+emoji18+`"`)); err != nil {
		t.Fatalf("18 code points rejected: %v", err)
	}
	for _, name := range []string{
		`"` + emoji18 + `a"`, // 19 code points
		`""`,
		`"a\u0007b"`,
		`"a\u007fb"`,
		`"a\u0085b"`,
		`"a\nb"`,
		`5`,
		`null`,
	} {
		if code := h.codeOfJSON(alice, settings(name)); code != "INVALID_NAME" {
			t.Errorf("name %s: got %s", name, code)
		}
	}
	// Non-control format characters are accepted, as in Java.
	if _, err := h.replyBytes(alice, settings(`"a​b"`)); err != nil {
		t.Fatalf("zero-width space rejected: %v", err)
	}
	// Chat: 120 code points is the limit; blank text is INVALID_CHAT.
	chat := func(text string) string {
		return `{"type":"chat","roomId":"` + roomID + `","text":"` + text + `"}`
	}
	if _, err := h.replyBytes(alice, chat(strings.Repeat("赛", 120))); err != nil {
		t.Fatalf("120 code points rejected: %v", err)
	}
	if code := h.codeOfJSON(alice, chat(strings.Repeat("赛", 121))); code != "INVALID_TEXT" {
		t.Fatalf("121 code points: %s", code)
	}
	if code := h.codeOfJSON(alice, chat("　 ")); code != "INVALID_CHAT" {
		t.Fatalf("ideographic space text: %s", code)
	}
	// U+00A0 is not Java whitespace, so it is not blank.
	if _, err := h.replyBytes(alice, chat(" ")); err != nil {
		t.Fatalf("no-break space rejected: %v", err)
	}
}

func TestClockMirrorsJacksonNumbers(t *testing.T) {
	h := newHarness(t)
	alice := h.connect("Alice")
	for _, tc := range []struct{ tick, want string }{
		{"5", `"clientTick":5.0`},
		{"1e2", `"clientTick":100.0`},
		{"123.5", `"clientTick":123.5`},
		{"0", `"clientTick":0.0`},
		{"-0.0", `"clientTick":-0.0`},
		{"12345678", `"clientTick":1.2345678E7`},
		{"0.0001", `"clientTick":1.0E-4`},
		{"123456789012345678901234567890", `"clientTick":1.2345678901234568E29`},
	} {
		reply, err := h.replyBytes(alice, `{"type":"clock","clientTick":`+tc.tick+`}`)
		if err != nil {
			t.Fatalf("tick %s: %v", tc.tick, err)
		}
		if !strings.Contains(reply, tc.want) || !strings.Contains(reply, `"serverTick":1000000`) {
			t.Errorf("tick %s: reply %s, want %s", tc.tick, reply, tc.want)
		}
	}
	for _, tick := range []string{"-1", "1e400", `"5"`, "null", "[]"} {
		if code := h.codeOfJSON(alice, `{"type":"clock","clientTick":`+tick+`}`); code != "INVALID_CLOCK" {
			t.Errorf("tick %s: %s", tick, code)
		}
	}
	// Duplicate keys: the last one wins, like Jackson's readTree.
	if _, err := h.replyBytes(alice, `{"type":"clock","clientTick":-1,"clientTick":2}`); err != nil {
		t.Fatalf("duplicate key: %v", err)
	}
}

func TestParseRequestAndRequestID(t *testing.T) {
	for _, payload := range []string{``, `nope`, `[1]`, `"hello"`, `null`, `{"type":`} {
		if _, err := ParseRequest([]byte(payload)); codeOf(t, err) != "INVALID_REQUEST" {
			t.Errorf("%q accepted", payload)
		}
	}
	// Malformed UTF-8 is repaired, so raw values stay valid UTF-8.
	repaired, err := ParseRequest([]byte("{\"equipment\":{\"x\":\"a\xffb\"}}"))
	if err != nil {
		t.Fatal(err)
	}
	if raw, _ := repaired.get("equipment"); !utf8.Valid(raw) {
		t.Fatalf("raw value not repaired: %q", raw)
	}
	// Jackson's readTree ignores content after the first value.
	if _, err := ParseRequest([]byte(`{"type":"clock"} trailing`)); err != nil {
		t.Fatalf("trailing content: %v", err)
	}
	for _, tc := range []struct {
		payload string
		want    string
		code    string
	}{
		{`{}`, "", ""},
		{`{"requestId":"7"}`, "7", ""},
		{`{"requestId":"` + strings.Repeat("a", 64) + `"}`, strings.Repeat("a", 64), ""},
		{`{"requestId":"` + strings.Repeat("a", 65) + `"}`, "", "INVALID_REQUEST_ID"},
		// 32 emoji are 64 UTF-16 units (Java length), 33 are 66.
		{`{"requestId":"` + strings.Repeat("😀", 32) + `"}`, strings.Repeat("😀", 32), ""},
		{`{"requestId":"` + strings.Repeat("😀", 33) + `"}`, "", "INVALID_REQUEST_ID"},
		{`{"requestId":null}`, "", "INVALID_REQUEST_ID"},
		{`{"requestId":7}`, "", "INVALID_REQUEST_ID"},
		{`{"requestId":" \t "}`, "", "INVALID_REQUEST_ID"},
		{`{"requestId":" "}`, " ", ""},
	} {
		req, err := ParseRequest([]byte(tc.payload))
		if err != nil {
			t.Fatal(err)
		}
		id, err := req.RequestID()
		if tc.code != "" {
			if code := codeOf(t, err); code != tc.code {
				t.Errorf("%s: %s", tc.payload, code)
			}
			continue
		}
		if err != nil || id != tc.want {
			t.Errorf("%s: id %q err %v", tc.payload, id, err)
		}
	}
}

func TestCommandDispatchErrors(t *testing.T) {
	h := newHarness(t)
	c := h.newClient()
	if code := h.codeOfJSON(c, `{"type":"clock","clientTick":1}`); code != "HELLO_REQUIRED" {
		t.Fatalf("before hello: %s", code)
	}
	if code := h.codeOfJSON(c, `{"clientTick":1}`); code != "INVALID_TYPE" {
		t.Fatalf("missing type: %s", code)
	}
	if code := h.codeOfJSON(c, `{"type":"`+strings.Repeat("x", 41)+`"}`); code != "INVALID_TYPE" {
		t.Fatalf("long type: %s", code)
	}
	alice := h.connect("Alice")
	if code := h.codeOfJSON(alice, `{"type":"latency-reply"}`); code != "UNSUPPORTED_COMMAND" {
		t.Fatalf("unknown command: %s", code)
	}
}

func TestJavaDoubleFormatting(t *testing.T) {
	for value, want := range map[float64]string{
		0.5: "0.5", 1: "1.0", 0.1: "0.1", 100: "100.0", 1e-3: "0.001",
		1e-4: "1.0E-4", 1e7: "1.0E7", 9999999: "9999999.0", 123456789: "1.23456789E8",
		-2.5: "-2.5", 1e21: "1.0E21", 1.5e-7: "1.5E-7",
	} {
		if got := string(appendJavaDouble(nil, value)); got != want {
			t.Errorf("%v: got %s, want %s", value, got, want)
		}
	}
}

func TestEncoderDoesNotEscapeHTML(t *testing.T) {
	got := string(encode(obj{{"text", `<a href="x">&</a>`}, {"ctl", "a\u0001\n"}, {"nil", nil}}))
	want := `{"text":"<a href=\"x\">&</a>","ctl":"a\u0001\n","nil":null}`
	if got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}
