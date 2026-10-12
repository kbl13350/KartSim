/**
 * Unicode property escapes (\p{L}, \p{N}) need ICU, which Brewser's V8 is
 * built without: there a regular expression literal using them is a syntax
 * error that stops the whole module. Patterns are built at run time instead,
 * and fall back to the letter and digit ranges the game data uses (Latin,
 * Greek, Cyrillic, kana, CJK, Hangul, full-width digits).
 */
const LETTERS = "A-Za-z\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u0370-\\u03FF" +
  "\\u0400-\\u04FF\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7AF\\uF900-\\uFAFF\\uFF21-\\uFF3A\\uFF41-\\uFF5A";
const NUMBERS = "0-9\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE\\u0660-\\u0669\\u2160-\\u2188\\u3007\\u3021-\\u3029\\uFF10-\\uFF19";

/** `source` with {L} and {N} standing for \p{L} and \p{N}. */
export function unicodeRegExp(source: string, flags = ""): RegExp {
  try {
    return new RegExp(source.replaceAll("{L}", "\\p{L}").replaceAll("{N}", "\\p{N}"), `u${flags}`);
  } catch {
    return new RegExp(source.replaceAll("{L}", LETTERS).replaceAll("{N}", NUMBERS), `u${flags}`);
  }
}
