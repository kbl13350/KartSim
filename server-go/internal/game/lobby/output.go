package lobby

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"
)

// field is one key of an ordered JSON object.
type field struct {
	key   string
	value any
}

// obj is an ordered JSON object, the counterpart of the Java LinkedHashMap
// replies: a key that is absent is omitted, a key with a nil value is
// written as null. Values are never mutated once an obj is shared.
type obj []field

// with returns a copy of o with key set to value (appended when new).
func (o obj) with(key string, value any) obj {
	out := make(obj, 0, len(o)+1)
	replaced := false
	for _, f := range o {
		if f.key == key {
			f.value = value
			replaced = true
		}
		out = append(out, f)
	}
	if !replaced {
		out = append(out, field{key, value})
	}
	return out
}

// MarshalJSON lets obj be embedded in encoding/json values.
func (o obj) MarshalJSON() ([]byte, error) { return appendJSON(nil, o), nil }

// jdouble is a Java double: Jackson writes it with Double.toString, so 5 is
// "5.0" and 1e20 is "1.0E20".
type jdouble float64

// Reply is the answer to one command, encoded on demand.
type Reply struct {
	body obj
}

// Encode returns the reply as JSON, adding requestId when non-empty (the
// Java envelope copies the reply and puts requestId last).
func (r Reply) Encode(requestID string) []byte {
	body := r.body
	if requestID != "" {
		body = body.with("requestId", requestID)
	}
	return appendJSON(nil, body)
}

// ErrorMessage is the WebSocket error reply {"type":"error","code",…}.
func ErrorMessage(code, requestID string) []byte {
	body := obj{{"type", "error"}, {"code", code}}
	if requestID != "" {
		body = append(body, field{"requestId", requestID})
	}
	return appendJSON(nil, body)
}

func encode(value any) []byte { return appendJSON(nil, value) }

// appendJSON writes value without HTML escaping, like Jackson. Nil slices
// are written as [] because every list in the Java snapshots is non-null.
func appendJSON(b []byte, value any) []byte {
	switch v := value.(type) {
	case nil:
		return append(b, "null"...)
	case string:
		return appendString(b, v)
	case bool:
		return strconv.AppendBool(b, v)
	case int:
		return strconv.AppendInt(b, int64(v), 10)
	case int64:
		return strconv.AppendInt(b, v, 10)
	case jdouble:
		return appendJavaDouble(b, float64(v))
	case json.RawMessage:
		if v == nil {
			return append(b, "null"...)
		}
		return append(b, v...)
	case obj:
		b = append(b, '{')
		for i, f := range v {
			if i > 0 {
				b = append(b, ',')
			}
			b = appendString(b, f.key)
			b = append(b, ':')
			b = appendJSON(b, f.value)
		}
		return append(b, '}')
	case []obj:
		b = append(b, '[')
		for i, item := range v {
			if i > 0 {
				b = append(b, ',')
			}
			b = appendJSON(b, item)
		}
		return append(b, ']')
	case []string:
		b = append(b, '[')
		for i, item := range v {
			if i > 0 {
				b = append(b, ',')
			}
			b = appendString(b, item)
		}
		return append(b, ']')
	case []int:
		b = append(b, '[')
		for i, item := range v {
			if i > 0 {
				b = append(b, ',')
			}
			b = strconv.AppendInt(b, int64(item), 10)
		}
		return append(b, ']')
	default:
		encoded, err := json.Marshal(v)
		if err != nil {
			panic(err)
		}
		return append(b, encoded...)
	}
}

const hexDigits = "0123456789abcdef"

func appendString(b []byte, s string) []byte {
	b = append(b, '"')
	for i := 0; i < len(s); {
		c := s[i]
		if c < utf8.RuneSelf {
			switch {
			case c == '"' || c == '\\':
				b = append(b, '\\', c)
			case c == '\n':
				b = append(b, '\\', 'n')
			case c == '\r':
				b = append(b, '\\', 'r')
			case c == '\t':
				b = append(b, '\\', 't')
			case c < 0x20:
				b = append(b, '\\', 'u', '0', '0', hexDigits[c>>4], hexDigits[c&0xF])
			default:
				b = append(b, c)
			}
			i++
			continue
		}
		r, size := utf8.DecodeRuneInString(s[i:])
		if r == utf8.RuneError && size == 1 {
			b = append(b, `�`...)
		} else {
			b = append(b, s[i:i+size]...)
		}
		i += size
	}
	return append(b, '"')
}

// appendJavaDouble formats like Java's Double.toString (JDK 19+ shortest
// digits): plain notation with at least one fraction digit for magnitudes in
// [1e-3, 1e7), otherwise d.dddE±n.
func appendJavaDouble(b []byte, f float64) []byte {
	switch {
	case math.IsNaN(f) || math.IsInf(f, 0):
		return append(b, "null"...)
	case f == 0:
		if math.Signbit(f) {
			return append(b, "-0.0"...)
		}
		return append(b, "0.0"...)
	}
	abs := math.Abs(f)
	if abs >= 1e-3 && abs < 1e7 {
		s := strconv.FormatFloat(f, 'f', -1, 64)
		b = append(b, s...)
		if !strings.Contains(s, ".") {
			b = append(b, ".0"...)
		}
		return b
	}
	s := strconv.FormatFloat(f, 'e', -1, 64)
	mantissa, exponent, _ := strings.Cut(s, "e")
	b = append(b, mantissa...)
	if !strings.Contains(mantissa, ".") {
		b = append(b, ".0"...)
	}
	exp, _ := strconv.Atoi(exponent)
	b = append(b, 'E')
	return strconv.AppendInt(b, int64(exp), 10)
}
