import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as rewritten from "./local-profile";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("function Sa0(");
const end = source.indexOf("const Ia0 =", start);
assert.ok(start > 0 && end > start);

function createRunner(release: boolean) {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
  const deps: rewritten.ProfileDependencies = {
    normalizeGarage: garage => garage,
    validateGarage: () => undefined,
    garageKart: (_garage, kartId) => ({ exceedType: kartId === 900 ? 3 : 0 }),
    systemKarts: [{ key: "system-1" }],
    resolveVariant: (_key, variant) => variant === "paint" ? { resource: "paint-resource" } : undefined,
  };
  const old = new Function("p5", "GI", "E20", "Cr", "xw", "localStorage",
    `${source.slice(start, end)}; return { Sa0, Ca0, Jd, wl, ef, Q3, sT, oT, Ea0,
      gr, Ta0, aT, cT, _a0, UP, Ga0, Ba0, Ra0, kt };`)(
      deps.garageKart, deps.validateGarage, deps.normalizeGarage,
      deps.systemKarts, deps.resolveVariant, storage,
    ) as Record<string, (...args: any[]) => any>;
  const api = release ? old : {
    Sa0: rewritten.uniqueItemKey,
    Ca0: rewritten.centerOffset,
    Jd: rewritten.favoriteItemIdentity,
    wl: rewritten.canFavoriteItem,
    ef: rewritten.makeFavoriteItem,
    Q3: rewritten.favoriteItemKey,
    sT: rewritten.favoriteItemKeys,
    oT: rewritten.isUnsignedInteger,
    Ea0: rewritten.hasSystemKartKey,
    gr: rewritten.defaultLocalProfile,
    Ta0: () => rewritten.loadLocalProfile(storage, deps),
    aT: (profile: rewritten.LocalProfile | undefined, kartId: number,
      characterId: number, systemKart?: string, variant?: string) =>
      rewritten.selectLocalKart(profile, kartId, characterId, systemKart, variant, deps),
    cT: (profile: rewritten.LocalProfile) => rewritten.saveLocalProfile(profile, storage, deps),
    _a0: (raw: string) => rewritten.parseLocalProfile(raw, deps),
    UP: (key: string, variant?: string) => rewritten.resolveSystemKartVariant(key, variant, deps),
    Ga0: rewritten.validateFavoriteTracks,
    Ba0: rewritten.validateFavoriteItems,
    Ra0: rewritten.validateNonzeroItemId,
    kt: rewritten.validateInteger,
  } as Record<string, (...args: any[]) => any>;

  const capture = (name: string, ...args: any[]): unknown => {
    try {
      const value = api[name]!(...args);
      return value instanceof Set ? [...value] : value;
    } catch (error) {
      return String(error);
    }
  };
  const base = api.gr!() as rewritten.LocalProfile;
  const examples = [
    capture("Sa0", 0), capture("Sa0", 7), capture("Sa0", 8),
    capture("Ca0", 127, false), capture("Ca0", 127, true),
    capture("Jd", { kind: "kart", itemId: 0, systemKey: " ksys " }),
    capture("Jd", { kind: "kart", itemId: 0 }),
    capture("Jd", { kind: "color", itemId: 12 }),
    capture("wl", { category: 3, itemId: 0, systemKart: "sys" }),
    capture("wl", { category: 3, itemId: 2, systemKart: "sys" }),
    capture("ef", { category: 3, itemId: 0, systemKart: " sys " }),
    capture("ef", { category: 2, itemId: 0 }),
    capture("Q3", { category: 3, itemId: 0, serial: 0, systemKart: "sys" }),
    capture("sT", [{ category: 3, itemId: 0, serial: 0, systemKart: "sys" }]),
    capture("oT", 65535, 65535), capture("oT", -1, 65535),
    capture("Ea0", "  "), capture("Ea0", " sys "),
    capture("Ga0", [{ themeId: 35, trackId: 4294967295 }]),
    capture("Ga0", [{ themeId: 36, trackId: 1 }]),
    capture("Ba0", [{ category: 2, itemId: 1, serial: 0 }]),
    capture("Ba0", [{ category: 2, itemId: 1, serial: 0 },
      { category: 2, itemId: 1, serial: 0 }]),
    capture("Ra0", 0), capture("Ra0", 1), capture("kt", 256, 255, "装备 +3E"),
    capture("UP", "system-1", "paint"), capture("UP", "system-1", "bad"),
    capture("_a0", JSON.stringify(base)),
    capture("_a0", JSON.stringify({ ...base, favoriteTracks: [{ themeId: 40, trackId: 1 }] })),
    capture("aT", base, 900, 2),
    capture("aT", base, 0, 2, "system-1", "paint"),
    capture("aT", base, 0, 2),
    capture("Ta0"),
  ];
  api.cT!(base);
  examples.push(capture("Ta0"), data.get(rewritten.LOCAL_PROFILE_KEY));
  return { base, examples };
}

test("local profile, equipment and favorites match released client", () => {
  assert.deepEqual(createRunner(false), createRunner(true));
});
