package api

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// validName is Java Accounts.validName: present, not blank, no leading or
// trailing characters <= U+0020 (String.trim), at most maximum code points,
// and no ISO control characters or angle brackets.
func validName(name *string, maximum int) bool {
	if name == nil || javaBlank(*name) {
		return false
	}
	value := *name
	if value[0] <= ' ' || value[len(value)-1] <= ' ' {
		return false
	}
	if utf8.RuneCountInString(value) > maximum {
		return false
	}
	for _, r := range value {
		if isISOControl(r) || r == '<' || r == '>' {
			return false
		}
	}
	return true
}

// javaBlank is String.isBlank: empty or only Character.isWhitespace.
func javaBlank(value string) bool {
	for _, r := range value {
		if !javaWhitespace(r) {
			return false
		}
	}
	return true
}

// javaWhitespace is Character.isWhitespace.
func javaWhitespace(r rune) bool {
	switch {
	case r >= 0x09 && r <= 0x0D, r >= 0x1C && r <= 0x1F:
		return true
	case r == 0x00A0, r == 0x2007, r == 0x202F:
		return false
	}
	return unicode.In(r, unicode.Zs, unicode.Zl, unicode.Zp)
}

// isISOControl is Character.isISOControl.
func isISOControl(r rune) bool { return r <= 0x1F || (r >= 0x7F && r <= 0x9F) }

// utf16Len is Java String.length().
func utf16Len(value string) int {
	length := 0
	for _, r := range value {
		if r >= 0x10000 {
			length += 2
		} else {
			length++
		}
	}
	return length
}

// matchesClass reports whether value has min..max bytes, each allowed.
func matchesClass(value string, min, max int, allowed func(byte) bool) bool {
	if len(value) < min || len(value) > max {
		return false
	}
	for i := 0; i < len(value); i++ {
		if !allowed(value[i]) {
			return false
		}
	}
	return true
}

func isAlnum(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

func isWordChar(c byte) bool { return isAlnum(c) || c == '_' }
func isURLSafe(c byte) bool  { return isAlnum(c) || c == '_' || c == '-' }

// validUsername is [A-Za-z0-9_]{3,24}.
func validUsername(value *string) bool {
	return value != nil && matchesClass(*value, 3, 24, isWordChar)
}

// validToken is [A-Za-z0-9_-]{43}, the shape of session tokens and profile keys.
func validToken(value string) bool { return matchesClass(value, 43, 43, isURLSafe) }

// validRecordID is [A-Za-z0-9_-]{1,100}.
func validRecordID(value string) bool { return matchesClass(value, 1, 100, isURLSafe) }

// validNodeID is [A-Za-z0-9_-]{1,64}.
func validNodeID(value string) bool { return matchesClass(value, 1, 64, isURLSafe) }

// validASCIIID accepts 1..max printable ASCII characters without spaces;
// these values land in ascii_bin columns.
func validASCIIID(value string, max int) bool {
	return matchesClass(value, 1, max, func(c byte) bool { return c > ' ' && c < 0x7F })
}

// validOwnerID mirrors java.util.UUID.fromString, which the Java service
// used: at most 36 characters, exactly five dash-separated hexadecimal
// fields, each parsed by Long.parseLong(field, 16) (an optional leading "+",
// at least one digit, value below 2^63). Java also accepts non-ASCII digits;
// those cannot be stored in the ASCII owner_id column and are rejected here.
func validOwnerID(value string) bool {
	if len(value) > 36 {
		return false
	}
	fields := strings.Split(value, "-")
	if len(fields) != 5 {
		return false
	}
	for _, field := range fields {
		field = strings.TrimPrefix(field, "+")
		field = strings.TrimLeft(field, "0")
		if len(field) > 16 || (len(field) == 16 && field[0] > '7') {
			return false
		}
		for i := 0; i < len(field); i++ {
			if !isHex(field[i]) {
				return false
			}
		}
	}
	// Each field needs at least one digit; TrimLeft above hid all-zero fields.
	for _, field := range fields {
		if strings.TrimPrefix(field, "+") == "" {
			return false
		}
	}
	return true
}

func isHex(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

// validText reports whether value has 1..max code points and no control characters.
func validText(value string, max int) bool {
	if value == "" || utf8.RuneCountInString(value) > max {
		return false
	}
	for _, r := range value {
		if isISOControl(r) {
			return false
		}
	}
	return true
}
