/**
 * Canvas font matching for Brewser. Its canvas picks a face only when family,
 * weight and style all match exactly (font-face-set.ts findFont) and otherwise
 * falls back to the console's Standard font, which lacks most simplified
 * Chinese glyphs. The game loads SourceHanSansCN-Bold under one family per
 * window with the default weight, then draws "bold 16px <family>". Each
 * FontFace copies its font (7 MiB), so instead of registering every weight the
 * font setter asks for one that is registered, and generic or Windows families
 * go to one Chinese alias face (switch-runtime.ts registers it).
 */
export const CJK_FAMILY = "KartSim CJK";
const GENERIC_FAMILIES = new Set(["sans-serif", "serif", "system-ui", "monospace", "microsoft yahei",
  "arial", "arial narrow", "arial black", "impact", "din alternate", "consolas", "helvetica"]);

interface FaceVariant { weight: string; style: string }
const registered = new Map<string, FaceVariant[]>();
let cjkReady = false;

export function rememberFontFace(family: string, weight: string, style: string): void {
  const key = family.toLowerCase();
  const list = registered.get(key) ?? [];
  if (!list.some(face => face.weight === weight && face.style === style)) list.push({ weight, style });
  registered.set(key, list);
}

/** The Chinese alias face is registered: generic families use it from now on. */
export function markCjkFontReady(): void { cjkReady = true; }
export function cjkFontReady(): boolean { return cjkReady; }

/** Test support: forget registered faces. */
export function resetFontRegistry(): void {
  registered.clear();
  cjkReady = false;
}

const FONT_SHORTHAND = /^\s*((?:[^\s,"']+\s+)*?)(\d+(?:\.\d+)?(?:px|pt|em|rem|%))((?:\s*\/\s*[^\s,]+)?)\s+(.+?)\s*$/i;
const BOLD = new Set(["bold", "bolder", "600", "700", "800", "900"]);

/** Rewrites a canvas font so its weight, style and family name a registered face. */
export function matchRegisteredFont(font: string): string {
  const parts = FONT_SHORTHAND.exec(font);
  if (!parts) return font;
  const [, prefix = "", size, lineHeight = "", familyList = ""] = parts;
  const tokens = prefix.trim().split(/\s+/).filter(Boolean);
  const wantsBold = tokens.some(token => BOLD.has(token.toLowerCase()));
  const wantsItalic = tokens.some(token => /^(italic|oblique)$/i.test(token));
  const families = familyList.split(",").map(name => name.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  let chosen = families.find(name => registered.has(name.toLowerCase()));
  if (!chosen && cjkReady && families.some(name => GENERIC_FAMILIES.has(name.toLowerCase()))) chosen = CJK_FAMILY;
  if (!chosen) return font;
  const faces = registered.get(chosen.toLowerCase()) ?? [];
  const score = (face: FaceVariant) => (BOLD.has(face.weight) === wantsBold ? 2 : 0) +
    ((face.style !== "normal") === wantsItalic ? 1 : 0);
  const face = [...faces].sort((a, b) => score(b) - score(a))[0];
  if (!face) return font;
  const keep = tokens.filter(token => !BOLD.has(token.toLowerCase()) &&
    !/^(normal|italic|oblique|lighter|[1-5]00)$/i.test(token));
  const style = face.style === "normal" ? [] : [face.style];
  const weight = face.weight === "normal" ? [] : [face.weight];
  return [...style, ...keep, ...weight, `${size}${lineHeight}`, `"${chosen}"`].join(" ");
}
