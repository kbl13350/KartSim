package economy

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"testing"
	"unicode/utf8"
)

// canonicalJSON reproduces rewrite/tools/economy-export/canonical.mjs:
// JSON.stringify of a value whose object keys were inserted in sorted
// order. JavaScript enumerates integer-like keys first (ascending
// numerically), then string keys in insertion order.
func canonicalJSON(buffer *bytes.Buffer, value any) error {
	switch v := value.(type) {
	case map[string]any:
		keys := make([]string, 0, len(v))
		for key := range v {
			keys = append(keys, key)
		}
		sort.Slice(keys, func(i, j int) bool { return jsKeyLess(keys[i], keys[j]) })
		buffer.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				buffer.WriteByte(',')
			}
			writeJSString(buffer, key)
			buffer.WriteByte(':')
			if err := canonicalJSON(buffer, v[key]); err != nil {
				return err
			}
		}
		buffer.WriteByte('}')
	case []any:
		buffer.WriteByte('[')
		for index, item := range v {
			if index > 0 {
				buffer.WriteByte(',')
			}
			if err := canonicalJSON(buffer, item); err != nil {
				return err
			}
		}
		buffer.WriteByte(']')
	case string:
		writeJSString(buffer, v)
	case json.Number:
		if _, err := strconv.ParseInt(v.String(), 10, 64); err != nil {
			return fmt.Errorf("non-integer number %s", v)
		}
		buffer.WriteString(v.String())
	case bool:
		buffer.WriteString(strconv.FormatBool(v))
	case nil:
		buffer.WriteString("null")
	default:
		return fmt.Errorf("unexpected %T", value)
	}
	return nil
}

func arrayIndex(key string) (uint64, bool) {
	if key == "" || (len(key) > 1 && key[0] == '0') {
		return 0, false
	}
	value, err := strconv.ParseUint(key, 10, 32)
	return value, err == nil && value < 1<<32-1
}

func jsKeyLess(a, b string) bool {
	ai, aIndex := arrayIndex(a)
	bi, bIndex := arrayIndex(b)
	switch {
	case aIndex && bIndex:
		return ai < bi
	case aIndex != bIndex:
		return aIndex
	}
	return utf16Less(a, b)
}

// utf16Less orders strings by UTF-16 code units like Array.prototype.sort.
func utf16Less(a, b string) bool {
	unitsA, unitsB := utf16Units(a), utf16Units(b)
	for i := 0; i < len(unitsA) && i < len(unitsB); i++ {
		if unitsA[i] != unitsB[i] {
			return unitsA[i] < unitsB[i]
		}
	}
	return len(unitsA) < len(unitsB)
}

func utf16Units(s string) []uint16 {
	units := make([]uint16, 0, len(s))
	for _, r := range s {
		if r >= 0x10000 {
			r -= 0x10000
			units = append(units, uint16(0xd800+(r>>10)), uint16(0xdc00+(r&0x3ff)))
		} else {
			units = append(units, uint16(r))
		}
	}
	return units
}

// writeJSString escapes like JSON.stringify: quote, backslash and control
// characters only; everything else is written as UTF-8.
func writeJSString(buffer *bytes.Buffer, s string) {
	buffer.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			buffer.WriteString(`\"`)
		case '\\':
			buffer.WriteString(`\\`)
		case '\b':
			buffer.WriteString(`\b`)
		case '\f':
			buffer.WriteString(`\f`)
		case '\n':
			buffer.WriteString(`\n`)
		case '\r':
			buffer.WriteString(`\r`)
		case '\t':
			buffer.WriteString(`\t`)
		default:
			if r < 0x20 {
				fmt.Fprintf(buffer, `\u%04x`, r)
			} else {
				var encoded [utf8.UTFMax]byte
				buffer.Write(encoded[:utf8.EncodeRune(encoded[:], r)])
			}
		}
	}
	buffer.WriteByte('"')
}

func contentVersion(t *testing.T, document []byte) (stored, computed string) {
	t.Helper()
	decoder := json.NewDecoder(bytes.NewReader(document))
	decoder.UseNumber()
	var root map[string]any
	if err := decoder.Decode(&root); err != nil {
		t.Fatal(err)
	}
	stored, _ = root["version"].(string)
	delete(root, "version")
	var buffer bytes.Buffer
	if err := canonicalJSON(&buffer, root); err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(buffer.Bytes())
	return stored, hex.EncodeToString(sum[:])
}

func TestEmbeddedVersionsMatchContent(t *testing.T) {
	for name, document := range map[string][]byte{"catalog.json": embeddedCatalog, "levels.json": embeddedLevels,
		"tracks.json": embeddedTracks, "events.json": embeddedEvents} {
		stored, computed := contentVersion(t, document)
		if stored != computed {
			t.Errorf("%s: version %s, content hashes to %s; regenerate with "+
				"`node --import tsx tools/export-economy-data.mjs` in rewrite/ instead of editing by hand",
				name, stored, computed)
		}
	}
}

func TestCanonicalJSONMatchesJavaScriptRules(t *testing.T) {
	var buffer bytes.Buffer
	value := map[string]any{"b": "x\"\\\n\u0001é", "a": []any{json.Number("1"), true, nil},
		"115": json.Number("2"), "3": json.Number("3"), "B": map[string]any{}, "01": "s"}
	if err := canonicalJSON(&buffer, value); err != nil {
		t.Fatal(err)
	}
	// node -e 'const o={};for(const k of ["b","a","115","3","B","01"].sort())o[k]=1;Object.keys(o)'
	// -> ["3","115","01","B","a","b"]
	want := `{"3":3,"115":2,"01":"s","B":{},"a":[1,true,null],"b":"x\"\\\n\u0001é"}`
	if got := buffer.String(); got != want {
		t.Fatalf("canonical JSON\n got %s\nwant %s", got, want)
	}
}
