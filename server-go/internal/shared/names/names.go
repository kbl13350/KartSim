// Package names is the single nickname-folding rule used by the data
// service's presence keys and the game node's same-node duplicate check.
// Two nicknames are "the same" exactly when their folds are equal.
package names

import (
	"strings"
	"unicode"
)

// Fold is the case-insensitive form of a nickname. It maps each character
// through upper and then lower case (like Java's equalsIgnoreCase), except
// the letters in collationDistinct: two names with the same fold must also
// be equal under the nickname column collation (utf8mb4_0900_as_ci), so a
// look-alike name can never take another account's presence key.
func Fold(name string) string { return strings.Map(foldRune, name) }

func foldRune(r rune) rune {
	if folded := unicode.ToLower(unicode.ToUpper(r)); folded != r && !unicode.Is(collationDistinct, r) {
		return folded
	}
	return r
}

// collationDistinct lists the letters whose Go case mapping leads to another
// letter that utf8mb4_0900_as_ci (UCA 9.0.0) keeps apart: dotted and dotless
// I, long s, ypogegrammeni, long s with dot above, and the case pairs added
// after Unicode 9 (Georgian Mtavruli, Glagolitic U+2C2F, Latin Extended-D,
// Vithkuqi, Medefaidrin). The data api package's MySQL test checks every folded
// letter against the collation, so a Unicode table upgrade cannot widen it.
var collationDistinct = &unicode.RangeTable{
	R16: []unicode.Range16{
		{Lo: 0x0130, Hi: 0x0131, Stride: 1},
		{Lo: 0x017F, Hi: 0x017F, Stride: 1},
		{Lo: 0x0345, Hi: 0x0345, Stride: 1},
		{Lo: 0x1C90, Hi: 0x1CBF, Stride: 1},
		{Lo: 0x1E9B, Hi: 0x1E9B, Stride: 1},
		{Lo: 0x2C2F, Hi: 0x2C2F, Stride: 1},
		{Lo: 0xA7B8, Hi: 0xA7F5, Stride: 1},
	},
	R32: []unicode.Range32{
		{Lo: 0x10570, Hi: 0x10595, Stride: 1},
		{Lo: 0x16E40, Hi: 0x16E5F, Stride: 1},
	},
}
