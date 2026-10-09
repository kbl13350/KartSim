import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GAME_OPTIONS_STORAGE_KEY, ITEM_HUD_OPTION_FIELDS, defaultItemHudOptions, itemHudOptions,
  readStoredItemHudOptions, withItemHudOptions,
} from "./item-hud-options";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
}

test("道具选项默认开启，无效值按默认处理", () => {
  assert.deepEqual(defaultItemHudOptions(),
    { itemStateNotice: true, itemStateTotalNotice: true, dispIngameItemInfoCard: true });
  assert.deepEqual([...ITEM_HUD_OPTION_FIELDS],
    ["itemStateNotice", "itemStateTotalNotice", "dispIngameItemInfoCard"]);
  assert.deepEqual(itemHudOptions(undefined), defaultItemHudOptions());
  assert.deepEqual(itemHudOptions({ itemStateNotice: false, itemStateTotalNotice: "no",
    dispIngameItemInfoCard: 0 }),
  { itemStateNotice: false, itemStateTotalNotice: true, dispIngameItemInfoCard: true });
  const draft = withItemHudOptions({ bgmEnabled: true, itemStateTotalNotice: false });
  assert.deepEqual(draft, { bgmEnabled: true, itemStateNotice: true,
    itemStateTotalNotice: false, dispIngameItemInfoCard: true });
  assert.deepEqual(readStoredItemHudOptions({ getItem: () => "{broken" }), defaultItemHudOptions());
  assert.deepEqual(readStoredItemHudOptions({ getItem: () => "null" }), defaultItemHudOptions());
  assert.deepEqual(readStoredItemHudOptions({ getItem: () => null }), defaultItemHudOptions());
});

test("设置窗口的三个道具选项是可切换的真实选项", async () => {
  (globalThis as { document?: unknown }).document ??= {
    createElement: () => ({ relList: { supports: () => true } }),
  };
  const { settingsCheckState } = await import("./settings-window");
  for (const field of ITEM_HUD_OPTION_FIELDS) {
    assert.deepEqual(settingsCheckState({ [field]: true }, field), { field, checked: true });
    assert.deepEqual(settingsCheckState({ [field]: false }, field), { field, checked: false });
  }
  // The remaining release-fixed boxes stay fixed.
  assert.deepEqual(settingsCheckState({}, "dispIngameName"), { checked: true });
  assert.deepEqual(settingsCheckState({ raceTimeGap: true }, "raceTimeGap"),
    { field: "raceTimeGap", checked: true });
});

test("道具选项随游戏设置经发行版 la0/ua0 保存与读取", async () => {
  const storage = new MemoryStorage();
  const global = globalThis as { document?: unknown };
  // Node's own localStorage warns when read; swap the property without reading it.
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage",
    { value: storage, configurable: true, writable: true });
  global.document ??= { createElement: () => ({ relList: { supports: () => true } }) };
  try {
    const world = await import("../generated/world.js") as unknown as {
      la0(): Record<string, unknown>;
      ua0(options: Record<string, unknown>): void;
    };
    const source = readFileSync(new URL("../generated/world.js", import.meta.url), "utf8");
    assert.match(source, new RegExp(`GP = "${GAME_OPTIONS_STORAGE_KEY}"`));

    // A new player: nothing stored, every item option on.
    assert.deepEqual(readStoredItemHudOptions(storage), defaultItemHudOptions());
    const draft = withItemHudOptions(world.la0());
    assert.equal(draft.itemStateNotice, true);

    // The settings dialog confirms a draft; the game saves it with ua0.
    world.ua0({ ...draft, itemStateNotice: false, dispIngameItemInfoCard: false });
    const saved = JSON.parse(storage.getItem(GAME_OPTIONS_STORAGE_KEY)!);
    assert.equal(saved.itemStateNotice, false);
    assert.deepEqual(readStoredItemHudOptions(storage),
      { itemStateNotice: false, itemStateTotalNotice: true, dispIngameItemInfoCard: false });

    // The next start loads them back and the dialog shows them.
    const reloaded = withItemHudOptions(world.la0());
    assert.equal(reloaded.itemStateNotice, false);
    assert.equal(reloaded.itemStateTotalNotice, true);
    assert.equal(reloaded.dispIngameItemInfoCard, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
