import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  GarageSkillSelectionState, GarageUpgradePreparationState,
  type GarageProgressionCandidate,
} from "./garage-progression-session";
import type { XunGarageProgression } from "./garage-progression-panel";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
const sourceOf = (name: string) => {
  const node = nodes.find(candidate => candidate.type === "ClassDeclaration" && candidate.id?.name === name);
  assert.ok(node);
  return release.slice(node.start!, node.end!);
};
const originalSource = `${sourceOf("qa")}\n${sourceOf("Qa")}`;

const progression = (level = 3): XunGarageProgression => ({ kind: "xun", level,
  skills: [{ id: 1, points: 2 }, { id: 2, points: 3 }, { id: 3, points: 0 }] });

function fixture() {
  const events: unknown[] = [];
  const validate = (value: XunGarageProgression) => {
    events.push(["validate", value.level]);
    if (value.level < 0) throw new Error("invalid progression");
  };
  const select = (value: XunGarageProgression, slot: number, id: number) => {
    events.push(["select", slot, id]);
    const skills = value.skills.map(skill => ({ ...skill }));
    skills[slot]!.id = id;
    skills[slot]!.points = 0;
    return { ...value, skills };
  };
  const availablePoints = (value: XunGarageProgression) => {
    events.push(["points", value.skills.map(skill => skill.points)]);
    return 10 - value.skills.reduce((sum, skill) => sum + skill.points, 0);
  };
  const blockedKart = (itemId: number) => { events.push(["blocked", itemId]); return itemId === 2; };
  const nextLevel = (value: XunGarageProgression, method: string) => {
    events.push(["next", value.level, method]);
    return { ...value, level: value.level + 1 };
  };
  const Original = new Function("kt", "Xs", "we", "Re", "Ys",
    `${originalSource}\nreturn { qa, Qa };`)(
      validate, select, availablePoints, blockedKart, nextLevel,
    ) as {
      qa: new (value: XunGarageProgression, slot?: number) => GarageSkillSelectionState;
      Qa: new (candidates: GarageProgressionCandidate[], itemId: number) => GarageUpgradePreparationState;
    };
  const skill = (released: boolean, value = progression(), slot = 0) => released
    ? new Original.qa(value, slot)
    : new GarageSkillSelectionState(value, slot, { validate, select, availablePoints });
  const preparation = (released: boolean, candidates: GarageProgressionCandidate[], itemId: number) =>
    released ? new Original.Qa(candidates, itemId) :
      new GarageUpgradePreparationState(candidates, itemId,
        { blockedKart, validate, nextLevel });
  return { events, skill, preparation };
}

test("XUN skill choice validation, occupancy, refund and settlement match qa", () => {
  const run = (released: boolean) => {
    const f = fixture();
    const input = progression();
    const state = f.skill(released, input);
    input.skills[0]!.points = 99;
    const initial = { value: state.value, changed: state.changed,
      refunded: state.refunded, occupied: state.isOccupied(2), slot: state.equippedSlot(3) };
    const errors: string[] = [];
    for (const id of [0, 2]) {
      try { state.choose(id); } catch (error) { errors.push((error as Error).message); }
    }
    state.choose(5);
    const chosen = { value: state.value, changed: state.changed, refunded: state.refunded };
    const result = state.settle(true);
    state.choose(6);
    return { initial, errors, chosen, result, repeated: state.settle(true),
      finalId: state.id, events: f.events };
  };
  assert.deepEqual(run(false), run(true));
});

test("XUN preparation filtering, paging, target and settlement match Qa", () => {
  const run = (released: boolean) => {
    const f = fixture();
    const candidates = Array.from({ length: 36 }, (_, itemId) => ({
      item: { itemId, engineGrade: itemId === 3 ? 0 : 9 },
      value: progression(itemId === 30 ? 5 : 3),
    }));
    const state = f.preparation(released, candidates, 20);
    candidates[20]!.value.skills[0]!.points = 99;
    const initial = { selected: state.selected, page: state.page,
      pages: state.pages, visible: state.visible.map(candidate => candidate.item.itemId),
      target: state.target, canStart: state.canStart };
    state.turnPage(10);
    state.turnPage(-1);
    state.choose(30);
    const maxed = { page: state.page, target: state.target, canStart: state.canStart };
    state.choose(21);
    state.setUpgradeMethod("direct");
    const result = state.settle(true);
    state.turnPage(1);
    state.choose(22);
    state.setUpgradeMethod("step");
    return { initial, maxed, result, final: {
      selected: state.selected.item.itemId, page: state.page,
      method: state.upgradeMethod, repeated: state.settle(true),
    }, events: f.events };
  };
  assert.deepEqual(run(false), run(true));
});

test("XUN state invalid slot, duplicate catalog and missing selection match release", () => {
  const run = (released: boolean) => {
    const f = fixture();
    const errors: string[] = [];
    const attempt = (action: () => unknown) => {
      try { action(); } catch (error) { errors.push((error as Error).message); }
    };
    attempt(() => f.skill(released, progression(), 4));
    attempt(() => f.skill(released, progression(-1)));
    const duplicated = [1, 1].map(itemId => ({ item: { itemId, engineGrade: 9 },
      value: progression() }));
    attempt(() => f.preparation(released, duplicated, 1));
    attempt(() => f.preparation(released, [{ item: { itemId: 1, engineGrade: 9 },
      value: progression() }], 99));
    return { errors, events: f.events };
  };
  assert.deepEqual(run(false), run(true));
});
