import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  blockedKartMessage, defaultLegacyKartState, isBlockedKartId,
  kartCatalogIdentity, legacyKartFamilies, legacyKartStateForAlias,
  requirePlayableKartId, resolveKartSelection, stableSystemKartKey,
  type LegacyKartFamily,
} from "./system-kart-identity";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseKartIdentity() {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("const EZ = [],");
  const end = source.indexOf("function LR(", start);
  assert.ok(start >= 0 && end > start);
  return new Function(`${source.slice(start, end)}
    return { Cr, n3, Mw, j6, _Z, xw, b4, N3, GZ };`)() as {
      Cr: typeof legacyKartFamilies;
      n3: typeof isBlockedKartId; Mw: typeof blockedKartMessage;
      j6: typeof requirePlayableKartId; _Z: typeof defaultLegacyKartState;
      xw: typeof legacyKartStateForAlias;
      b4: typeof resolveKartSelection;
      N3: typeof kartCatalogIdentity; GZ: typeof stableSystemKartKey;
    };
}

test("旧系统车辆家族及等级映射逐字段与发行版一致", async () => {
  const old = await releaseKartIdentity();
  assert.deepEqual(legacyKartFamilies, old.Cr);
  for (const family of legacyKartFamilies) {
    assert.deepEqual(defaultLegacyKartState(family), old._Z(family));
    for (const state of family.states)
      for (const alias of state.aliases)
        assert.deepEqual(legacyKartStateForAlias(family.key, alias.toUpperCase()),
          old.xw(family.key, alias.toUpperCase()));
  }
  const invalid = { key: "bad", defaultLevel: "l1", states: [] } as unknown as LegacyKartFamily;
  assert.throws(() => defaultLegacyKartState(invalid),
    (error: Error) => error.message ===
      (() => { try { old._Z(invalid); } catch (value) {
        return (value as Error).message; } })());
});

test("系统车辆选择、稳定键与禁止项诊断和发行版一致", async () => {
  const old = await releaseKartIdentity();
  const catalog = [
    { itemId: 0, systemKey: "legacyPractice", internalId: "practice3",
      path: "kart_/practice3/model.1s", title: "Practice" },
    { itemId: 0, systemKey: "legacyPracticeBlackline",
      internalId: "practiceblack4", path: "kart_/practiceblack4/model.1s",
      title: "Blackline" },
    { itemId: 101, internalId: "normal", path: "kart_/normal/model.1s" },
  ];
  const selections = [
    [0, "KART_/PRACTICE3/MODEL.1S", "legacyPractice"],
    [0, "kart_/practice2/model.1s", "legacyPractice"],
    [0, "kart_/practiceblack2/model.1s", "legacyPracticeBlackline"],
    [0, "kart_/practiceblack1/model.1s", "legacyPracticeBlackline"],
    [101, "kart_\\normal\\model.1s", undefined],
    [101, "kart_/missing/model.1s", undefined],
  ] as const;
  for (const [itemId, assetPath, systemKey] of selections)
    assert.deepEqual(resolveKartSelection(catalog, itemId, assetPath, systemKey),
      old.b4(catalog, itemId, assetPath, systemKey));
  for (const itemId of [0, 1, 101, 100000]) {
    assert.equal(isBlockedKartId(itemId), old.n3(itemId));
    assert.equal(blockedKartMessage(itemId), old.Mw(itemId));
    assert.equal(requirePlayableKartId(itemId), old.j6(itemId));
  }
  for (const key of ["legacyPractice", "  legacyPractice  ", "", undefined]) {
    const capture = (run: () => unknown) => {
      try { return { value: run() }; }
      catch (error) { return { error: (error as Error).message }; }
    };
    assert.deepEqual(capture(() => stableSystemKartKey(key)),
      capture(() => old.GZ(key)));
    assert.deepEqual(capture(() => kartCatalogIdentity({ itemId: 0,
      systemKey: key, internalId: "", path: "" })),
      capture(() => old.N3({ itemId: 0, systemKey: key,
        internalId: "", path: "" })));
  }
});
