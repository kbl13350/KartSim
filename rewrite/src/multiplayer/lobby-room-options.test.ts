import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { roomChannelKey, roomChannelNames, roomStyleDropdown,
  type RoomDropdownDependencies, type RoomOptionNode } from
  "./lobby-room-options";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function NT(");
const end = release.indexOf("\nclass b1 {", start);
assert.ok(start >= 0 && end > start);
const originalFunctions = release.slice(start, end);

const ordinary = { speedIndiCombine: "个人竞速", speedTeamCombine: "组队竞速" };
const rp = { speedIndiCombine: "RP 模式" };

function harness() {
  const deps = {
    attribute(node: RoomOptionNode, name: string) {
      return node[name] as string | undefined;
    },
    clone(node: RoomOptionNode, attributes: Record<string, string>,
      children?: RoomOptionNode[]) {
      return { ...node, ...attributes, children: children ?? node.children };
    },
  } satisfies RoomDropdownDependencies;
  const Original = new Function("lw", "H6", "T", "h2",
    `${originalFunctions}\nreturn { NT, Ol0, zl0 };`)(
      rp, ordinary, deps.attribute, deps.clone,
    ) as { NT(mode: string): Record<string, string>;
      Ol0(value: string, channels?: Record<string, string>): string;
      zl0(combo: RoomOptionNode, template: RoomOptionNode,
        values?: string[]): RoomOptionNode };
  return { deps, Original };
}

test("gameplay room channel names and reverse category lookup match release", () => {
  const { Original } = harness();
  for (const mode of ["ordinary", "rp", "roadblock", "giant", "lte",
    "shadow", "grip", "ghost", "unknown", ""]) {
    const modern = roomChannelNames(mode, ordinary, rp);
    const legacy = Original.NT(mode);
    assert.deepEqual(modern, legacy, mode);
    assert.equal(modern === ordinary, legacy === ordinary, mode);
    assert.equal(modern === rp, legacy === rp, mode);
  }
  for (const value of ["个人竞速", "组队竞速", "missing", ""]) {
    const modern = () => roomChannelKey(value, ordinary);
    const legacy = () => Original.Ol0(value);
    const outcome = (run: () => string) => {
      try { return { value: run() }; }
      catch (error) { return { error: (error as Error).message }; }
    };
    assert.deepEqual(outcome(modern), outcome(legacy), value);
  }
});

type DropdownVariant = "normal" | "one" | "empty" | "wrong-combo" |
  "missing-skip" | "too-few-rows" | "missing-frame" |
  "missing-list-frame";

function observeDropdown(rewritten: boolean, variant: DropdownVariant) {
  const { deps, Original } = harness();
  const values = variant === "empty" ? [] : variant === "one" ? ["单人"] :
    ["单人", "组队"];
  const combo: RoomOptionNode = { name: variant === "wrong-combo"
    ? "Button" : "ComboBox", children: [] };
  const rows: RoomOptionNode[] = variant === "too-few-rows"
    ? [{ name: "row0", children: [] }]
    : [{ name: "row0", children: [] }, { name: "row1", children: [] }];
  const skip: RoomOptionNode = { name: "Skip", children: rows };
  const template: RoomOptionNode = {
    name: "template", children: variant === "missing-skip" ? [] : [skip],
    frame: variant === "missing-frame" ? "" : "frame-a",
    listFrame: variant === "missing-list-frame" ? "" : "frame-b",
  };
  try {
    return { result: rewritten
      ? roomStyleDropdown(combo, template, values, deps)
      : Original.zl0(combo, template, values) };
  } catch (error) { return { error: (error as Error).message }; }
}

test("room style dropdown validation and cloned option tree match release", () => {
  for (const variant of ["normal", "one", "empty", "wrong-combo",
    "missing-skip", "too-few-rows", "missing-frame",
    "missing-list-frame"] as const) {
    assert.deepEqual(observeDropdown(true, variant),
      observeDropdown(false, variant), variant);
  }
});

test("道具赛 offers the two original item channels by their string bag names", () => {
  const channels = roomChannelNames("item", ordinary, rp);
  assert.deepEqual(channels, { itemIndiCombine: "个人道具赛", itemTeamCombine: "组队道具赛" });
  assert.equal(roomChannelKey("组队道具赛", channels), "itemTeamCombine");
  assert.throws(() => roomChannelKey("个人竞速", channels));
  // The ordinary dropdown stays the speed channels.
  assert.deepEqual(roomChannelNames("ordinary", ordinary, rp), ordinary);
});
