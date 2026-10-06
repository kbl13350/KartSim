import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isReadyOptionSelected, randomTrackGroupName, readyButtonImageState,
  readyNodeVisible, readyOptionTexture, selectReadyOption,
  type ReadyOptions, type UiDefinitionNode,
} from "./ready-options";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first, `${start} → ${end}`);
  return source.slice(first, last);
}

const constants = between('jg = "timeAttack_main_iconBooster"', '\nclass ty {');
const release = new Function(`
  const ze = "国服", E4 = 7;
  const ${constants}
  ${between("function T(n, e) {", "function Mp(")}
  ${between("function st(n, e, t) {", "async function ma(")}
  ${between("function kP(n) {", "function y6(")}
  ${between("function Yg(n) {", "function M6(")}
  ${between("function fF(n, e, t = !1, i = !1) {", "function wT(")}
  ${between("function Z80(n, e, t, i, r) {", "function pf(")}
  return { P80, fF, W80, Z80, Q80, J80 };
`)() as {
  P80: typeof readyOptionTexture;
  fF: typeof readyNodeVisible;
  W80: typeof randomTrackGroupName;
  Z80: typeof readyButtonImageState;
  Q80: typeof isReadyOptionSelected;
  J80: typeof selectReadyOption;
};

test("Ready choice transitions and four-state buttons match release", () => {
  const options: ReadyOptions[] = [
    { speed: 7, booster: 0, showGhost: true },
    { speed: 4, booster: 1, showGhost: false, extra: "preserve" },
    { speed: 7, booster: 1, showGhost: false, version: "韩服复古" },
    { speed: 4, booster: 0, showGhost: true, settingSpeed: 4 },
  ];
  const names = ["S7", "S4", "indiBoosterBtn", "teamBoosterBtn", "onBtn", "offBtn", "exit", "training"];
  for (const current of options) for (const name of names) {
    const actual = selectReadyOption(current, name);
    const expected = release.J80(current, name);
    assert.deepEqual(actual, expected);
    assert.equal(actual === current, expected === current);
    assert.equal(isReadyOptionSelected(name, current), release.Q80(name, current));
    for (const hovered of [undefined, "id"]) for (const pressed of [undefined, "id"]) {
      assert.equal(readyButtonImageState("id", name, current, hovered, pressed),
        release.Z80("id", name, current, hovered, pressed));
    }
  }
});

test("Ready texture variants and BML visibility match release", () => {
  const options: ReadyOptions = { speed: 4, booster: 1, showGhost: false };
  for (const token of [
    undefined, "timeAttack_main_iconBooster0", "timeAttack_main_iconBooster1",
    "timeAttack_main_iconBooster2", "timeAttack_main_iconBooster3",
    "timeAttack_main_iconModeDefault", "timeAttack_main_iconMode7",
    "timeAttack_main_iconGhost1", "timeAttack_main_iconGhost2", "other",
  ]) assert.equal(readyOptionTexture(token, options), release.P80(token, options));

  const node = (nodeName: string, name?: string, text?: string, visible?: string): UiDefinitionNode => ({
    name: nodeName,
    attributes: [
      ...(name === undefined ? [] : [{ name: "name", value: name }]),
      ...(text === undefined ? [] : [{ name: "text", value: text }]),
      ...(visible === undefined ? [] : [{ name: "visible", value: visible }]),
    ],
  });
  const nodes = [
    node("Panel", "rvs"), node("Panel", "randomInfoText"),
    node("Panel", "clearPanel"), node("Panel", "shadowBtnPanel"),
    node("Label", "desc", "#sb(invalidShadow)"),
    node("Label", "desc", "other"), node("Panel", "training", undefined, "false"),
    node("Panel", "other", undefined, "false"), node("Panel", "other"),
  ];
  for (const current of nodes) for (const hasRecord of [false, true]) {
    for (const reverse of [false, true]) for (const random of [false, true]) {
      assert.equal(readyNodeVisible(current, hasRecord, reverse, random),
        release.fF(current, hasRecord, reverse, random));
    }
  }
});

test("random track group captions match release precedence", () => {
  for (const group of [
    ...["hot1", "hot2", "hot3", "hot4", "hot5", "all", "speedAll", "clubSpeed",
      "new", "reverse", "crazy"].map(randomType => ({ randomType })),
    { randomType: "other", cardToken: "speedAllRandom_TimeAttack@zz" },
    { randomType: "other" }, { randomType: "other", level: 7 },
    { randomType: "hot3", cardToken: "speedAllRandom_TimeAttack@zz" },
  ]) assert.equal(randomTrackGroupName(group), release.W80(group));
});
