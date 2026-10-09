package api

import (
	"strings"
	"testing"
)

// Vectors produced by the Java service's own code (JDK 21): PBKDF2 hashes
// from Accounts.passwordHash with a fixed salt, digests from Accounts.sha256,
// and UUID.fromString acceptance.
func TestJavaPasswordHashesVerify(t *testing.T) {
	vectors := map[string]string{
		"correct horse battery": "120000:AwoRGB8mLTQ7QklQV15lbA==:ItnddrgVbI8ZaFWCHA0E4sLbai9JSSaCLK6DQwr/Wp8=",
		"密码密码密码密码密码密码":          "120000:AwoRGB8mLTQ7QklQV15lbA==:lZaKurA70z9CjFdSvhBi96bmYIayG9Vd0zD0BCxh3Ok=",
		"emoji😀😀😀😀😀😀":           "120000:AwoRGB8mLTQ7QklQV15lbA==:I2Wy6JrQFmOut9npXA2fv3Lt8mfhuRH61XjY7jlBrF0=",
	}
	for password, hash := range vectors {
		if !verifyPassword(password, hash) {
			t.Errorf("Java hash of %q rejected", password)
		}
		if verifyPassword(password+"x", hash) {
			t.Errorf("wrong password accepted for %q", password)
		}
	}
	for _, malformed := range []string{"", "120000", "x:AA==:AA==", "0:AA==:AA==", "120000:@@:AA==", "120000:AA==:"} {
		if verifyPassword("anything", malformed) {
			t.Errorf("malformed hash %q accepted", malformed)
		}
	}
}

func TestHashPasswordFormat(t *testing.T) {
	hash, err := hashPassword("a-local-password-123")
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(hash, ":")
	if len(parts) != 3 || parts[0] != "120000" || len(parts[1]) != 24 || len(parts[2]) != 44 {
		t.Fatalf("hash %q does not match the Java format", hash)
	}
	if !verifyPassword("a-local-password-123", hash) || verifyPassword("a-local-password-124", hash) {
		t.Fatal("round trip failed")
	}
}

func TestDigestMatchesJava(t *testing.T) {
	vectors := map[string]string{
		"abc": "ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0",
		"Zm9vYmFyYmF6cXV4cXV1eHF1dXhxdXV4cXV1eHF1dXg": "62GWGsK92wZLzUkfGSbbCiW6TenV1O1FABG7p3hEeHw",
		"名字": "Z3MxBJKpb8-WA1oz3JV7f1UtJt1mMLwsFBidLmqnI-4",
	}
	for input, want := range vectors {
		if got := digest(input); got != want {
			t.Errorf("digest(%q) = %q, want %q", input, got, want)
		}
	}
	if token := randomCode(32); !validToken(token) {
		t.Fatalf("session token %q has the wrong shape", token)
	}
	if invite := randomCode(18); len(invite) != 24 {
		t.Fatalf("invite %q", invite)
	}
	if id := newUUID(); !validOwnerID(id) || len(id) != 36 || id[14] != '4' {
		t.Fatalf("uuid %q", id)
	}
}

func TestOwnerIDMatchesJavaUUIDParsing(t *testing.T) {
	vectors := map[string]bool{
		"123e4567-e89b-12d3-a456-426614174000":  true,
		"123E4567-E89B-12D3-A456-426614174000":  true,
		"1-2-3-4-5":                             true,
		"+1-2-3-4-5":                            true,
		"123456789abc-1-1-1-1":                  true,
		"1-2-3-4":                               false,
		"1-2-3-4-5-6":                           false,
		"g-1-1-1-1":                             false,
		"-1-1-1-1":                              false,
		"1--1-1-1":                              false,
		"ffffffffffffffff-1-1-1-1":              false,
		"7fffffffffffffff-1-1-1-1":              true,
		"0x1-1-1-1-1":                           false,
		" 1-1-1-1-1":                            false,
		"123e4567-e89b-12d3-a456-4266141740001": false,
		"1-1-1-1-+1":                            true,
		"1-1-1-1-ffffffffffff":                  true,
		"1-1-1-1-1ffffffffffff":                 true,
		"0-0-0-0-0":                             true,
		"+-1-1-1-1":                             false,
		"":                                      false,
	}
	for input, want := range vectors {
		if got := validOwnerID(input); got != want {
			t.Errorf("validOwnerID(%q) = %v, want %v", input, got, want)
		}
	}
}

func TestValidNameMatchesJava(t *testing.T) {
	text := func(value string) *string { return &value }
	cases := []struct {
		name  *string
		max   int
		valid bool
	}{
		{nil, 18, false},
		{text(""), 18, false},
		{text("　"), 18, false},        // isBlank
		{text("a　"), 18, true},        // trim keeps U+3000
		{text(" "), 18, false},        // isBlank
		{text(" a"), 18, false},       // trim
		{text("a "), 18, false},       // trim
		{text(" x"), 18, true},        // not whitespace, above U+0020
		{text("a\u0085b"), 18, false}, // ISO control
		{text("a<b"), 18, false},
		{text("a>b"), 18, false},
		{text("名字名字名字名字名字名字名字名字名字"), 18, true},
		{text("名字名字名字名字名字名字名字名字名字名"), 18, false},
		{text("😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀"), 16, true}, // code points, not UTF-16 units
		{text("Alice Bob"), 16, true},
	}
	for _, c := range cases {
		if got := validName(c.name, c.max); got != c.valid {
			value := "<nil>"
			if c.name != nil {
				value = *c.name
			}
			t.Errorf("validName(%q, %d) = %v, want %v", value, c.max, got, c.valid)
		}
	}
}

func TestJavaLengthsAndPatterns(t *testing.T) {
	if utf16Len("a😀名") != 4 {
		t.Fatal("utf16Len")
	}
	text := func(value string) *string { return &value }
	if !validUsername(text("abc_123")) || validUsername(text("ab")) || validUsername(text("abc-1")) ||
		validUsername(text(strings.Repeat("a", 25))) || validUsername(nil) {
		t.Fatal("username pattern")
	}
	if !validRecordID("best-lap_1") || validRecordID("") || validRecordID("a.b") || validRecordID(strings.Repeat("a", 101)) {
		t.Fatal("record id pattern")
	}
	if !javaBlank("") || !javaBlank(" \t ") || javaBlank(" ") {
		t.Fatal("javaBlank")
	}
}
