import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { raceStartPosition, validateRaceStartGrid } from "../src/vehicle/race-start-slots.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const names = ["iL", "rL"];
const originals = Object.fromEntries(parse(source, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.includes(node.id.name))
  .map(node => [node.id.name, new Function(`${source.slice(node.start, node.end)}; return ${node.id.name};`)()]));
assert.deepEqual(Object.keys(originals).sort(), names.sort());

test("race grid validation matches release for missing, duplicate and valid slots", () => {
  for (const grid of [
    { roster: [] }, { roster: [{ playerId: "a" }], startSlots: {} },
    { roster: [{ playerId: "a" }], startSlots: { a: 0 } },
    { roster: [{ playerId: "a" }, { playerId: "b" }], startSlots: { a: 0, b: 0 } },
    { roster: [{ playerId: "a" }, { playerId: "b" }], startSlots: { a: 0, b: 7 } },
    { roster: [{ playerId: "a" }], startSlots: { a: -1 } },
    { roster: [{ playerId: "a" }], startSlots: { a: 8 } },
    { roster: [{ playerId: "a" }], startSlots: { a: 1.5 } },
  ]) {
    const result = fn => { try { return fn(grid); } catch (error) { return error.message; } };
    assert.equal(result(validateRaceStartGrid), result(originals.iL), JSON.stringify(grid));
  }
});

test("paired start offsets and road projection match release", () => {
  const origin = { x: 1.25, y: 2.5, z: -3.5 };
  const right = { x: 0.95, y: 0.1, z: 0.75 };
  for (const slot of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 1.5])
    for (const snap of [false, true]) {
      const sample = (point, direction) =>
        snap ? { ...point, y: point.y - 10, direction } : undefined;
      const result = fn => {
        try { return fn(origin, right, slot, sample); }
        catch (error) { return error.message; }
      };
      assert.deepEqual(result(raceStartPosition), result(originals.rL), `${slot}/${snap}`);
    }
});
