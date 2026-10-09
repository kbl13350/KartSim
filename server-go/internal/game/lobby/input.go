package lobby

import (
	"bytes"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"kartsim/internal/shared/apierr"
)

// Request is one decoded client command. Field values stay raw so every
// accessor applies the Jackson JsonNode semantics of the Java service:
// has() counts a JSON null, hasNonNull() does not, integers must be integral
// literals inside the int32 range, and text is measured in code points.
type Request struct {
	fields map[string]json.RawMessage
}

// ParseRequest decodes a text frame. Like Jackson's readTree it reads only
// the first JSON value and ignores trailing content; anything that is not an
// object is INVALID_REQUEST. The WebSocket layer already refuses malformed
// UTF-8; any that slips through is replaced so raw values (equipment) stay
// valid JSON text for the data service.
func ParseRequest(payload []byte) (Request, error) {
	if !utf8.Valid(payload) {
		payload = bytes.ToValidUTF8(payload, []byte("\uFFFD"))
	}
	var raw json.RawMessage
	if err := json.NewDecoder(bytes.NewReader(payload)).Decode(&raw); err != nil {
		return Request{}, fail(http.StatusBadRequest, "INVALID_REQUEST")
	}
	if kindOf(raw) != kindObject {
		return Request{}, fail(http.StatusBadRequest, "INVALID_REQUEST")
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return Request{}, fail(http.StatusBadRequest, "INVALID_REQUEST")
	}
	return Request{fields: fields}, nil
}

// RequestID validates the optional requestId: present (even as null) means
// it must be a non-blank string of at most 64 UTF-16 units.
func (r Request) RequestID() (string, error) {
	raw, ok := r.fields["requestId"]
	if !ok {
		return "", nil
	}
	value, isText := decodeString(raw)
	if !isText || javaIsBlank(value) || utf16Len(value) > 64 {
		return "", fail(http.StatusBadRequest, "INVALID_REQUEST_ID")
	}
	return value, nil
}

// Type returns the command name without validating it ("" when it is
// missing or not a string), for decisions made before the lobby runs the
// command (per-connection rate limits).
func (r Request) Type() string {
	value, _ := decodeString(r.fields["type"])
	return value
}

type valueKind int

const (
	kindMissing valueKind = iota
	kindNull
	kindString
	kindNumber
	kindBool
	kindObject
	kindArray
)

func kindOf(raw json.RawMessage) valueKind {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return kindMissing
	}
	switch raw[0] {
	case 'n':
		return kindNull
	case '"':
		return kindString
	case 't', 'f':
		return kindBool
	case '{':
		return kindObject
	case '[':
		return kindArray
	default:
		return kindNumber
	}
}

func (r Request) get(key string) (json.RawMessage, bool) {
	raw, ok := r.fields[key]
	return raw, ok
}

// has mirrors JsonNode.has: true for any present key, including null.
func (r Request) has(key string) bool {
	_, ok := r.fields[key]
	return ok
}

// hasNonNull mirrors JsonNode.hasNonNull.
func (r Request) hasNonNull(key string) bool {
	raw, ok := r.fields[key]
	return ok && kindOf(raw) != kindNull
}

// text mirrors the Java text(): a JSON string of min..max code points
// without ISO control characters.
func (r Request) text(key string, min, max int) (string, error) {
	raw, ok := r.fields[key]
	if !ok {
		return "", invalid(key)
	}
	value, isText := decodeString(raw)
	if !isText {
		return "", invalid(key)
	}
	count := utf8.RuneCountInString(value)
	if count < min || count > max || hasISOControl(value) {
		return "", invalid(key)
	}
	return value, nil
}

// optionalText mirrors the Java optionalText(): nil when the key is absent
// or null, otherwise text(key, 0, max).
func (r Request) optionalText(key string, max int) (*string, error) {
	if !r.hasNonNull(key) {
		return nil, nil
	}
	value, err := r.text(key, 0, max)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

// integer mirrors the Java integer(): an integral JSON literal (5, not 5.0
// or 1e2) that fits an int32 and lies in min..max.
func (r Request) integer(key string, min, max int) (int, error) {
	raw, ok := r.fields[key]
	if !ok {
		return 0, invalid(key)
	}
	value, ok := intValue(raw)
	if !ok || value < min || value > max {
		return 0, invalid(key)
	}
	return value, nil
}

// booleanField mirrors the Java booleanField(): a JSON true or false.
func (r Request) booleanField(key string) (bool, error) {
	raw, ok := r.fields[key]
	if !ok || kindOf(raw) != kindBool {
		return false, invalid(key)
	}
	return bytes.Equal(bytes.TrimSpace(raw), []byte("true")), nil
}

// number mirrors JsonNode.isNumber()/doubleValue(): any JSON number, as the
// nearest double (overflow becomes ±Inf just like Java).
func (r Request) number(key string) (float64, bool) {
	raw, ok := r.fields[key]
	if !ok {
		return 0, false
	}
	return doubleValue(raw)
}

func doubleValue(raw json.RawMessage) (float64, bool) {
	if kindOf(raw) != kindNumber {
		return 0, false
	}
	value, err := strconv.ParseFloat(string(bytes.TrimSpace(raw)), 64)
	if err != nil && !errors.Is(err, strconv.ErrRange) {
		return 0, false
	}
	return value, true
}

// intValue reports whether raw is an integral JSON literal that Jackson can
// convert to an int (isIntegralNumber && canConvertToInt).
func intValue(raw json.RawMessage) (int, bool) {
	if kindOf(raw) != kindNumber {
		return 0, false
	}
	literal := string(bytes.TrimSpace(raw))
	if strings.ContainsAny(literal, ".eE") {
		return 0, false
	}
	value, err := strconv.ParseInt(literal, 10, 64)
	if err != nil || value < math.MinInt32 || value > math.MaxInt32 {
		return 0, false
	}
	return int(value), true
}

func decodeString(raw json.RawMessage) (string, bool) {
	if kindOf(raw) != kindString {
		return "", false
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", false
	}
	return value, true
}

// hasISOControl mirrors Character.isISOControl over code points.
func hasISOControl(value string) bool {
	for _, r := range value {
		if isISOControl(r) {
			return true
		}
	}
	return false
}

func isISOControl(r rune) bool {
	return r <= 0x1F || (r >= 0x7F && r <= 0x9F)
}

// javaIsBlank mirrors String.isBlank (Character.isWhitespace on every code point).
func javaIsBlank(value string) bool {
	for _, r := range value {
		if !javaIsWhitespace(r) {
			return false
		}
	}
	return true
}

// javaIsWhitespace mirrors Character.isWhitespace: Unicode space, line and
// paragraph separators except the non-breaking ones, plus \t \n \v \f \r and
// the four information separators U+001C..U+001F.
func javaIsWhitespace(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', 0x1C, 0x1D, 0x1E, 0x1F:
		return true
	case 0x00A0, 0x2007, 0x202F:
		return false
	}
	return unicode.In(r, unicode.Zs, unicode.Zl, unicode.Zp)
}

// utf16Len is Java's String.length().
func utf16Len(value string) int {
	n := 0
	for _, r := range value {
		if r >= 0x10000 {
			n += 2
		} else {
			n++
		}
	}
	return n
}

func fail(status int, code string) error { return apierr.New(status, code) }

func invalid(key string) error {
	return apierr.New(http.StatusBadRequest, "INVALID_"+strings.ToUpper(key))
}
