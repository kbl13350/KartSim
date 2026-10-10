import assert from "node:assert/strict";
import { test } from "node:test";
import * as three from "three";
import * as legacy from "../src/vendor/legacy-three.ts";
import { highlightedResultPlayers } from "../src/game/race-results.ts";

test("release Three.js exports map to the same r178 package symbols", () => {
  assert.equal(three.REVISION, "178");
  assert.equal(legacy.I4, three.WebGLRenderer);
  assert.equal(legacy.H, three.Vector3);
  assert.equal(legacy.v2, three.Matrix4);
  assert.equal(legacy.r9, three.Color);
  assert.equal(legacy.$1, three.ShaderMaterial);
  assert.equal(legacy.z2, three.ShaderChunk);
  assert.equal(legacy.u9, three.LinearFilter);
  assert.equal(legacy.Fe, three.SRGBColorSpace);
  const vector = new legacy.H(1, 2, 3).applyMatrix4(new legacy.v2().makeTranslation(4, 5, 6));
  assert.deepEqual(vector.toArray(), [5, 7, 9]);
});

test("highlighted result players preserve team and ranking rules", () => {
  const roster = [
    { playerId: "a", team: 1 },
    { playerId: "b", team: 2 },
    { playerId: "c", team: 1 },
  ];
  const results = [
    { playerId: "b", rank: 1, elapsedMs: 500 },
    { playerId: "a", rank: 2, elapsedMs: 520 },
    { playerId: "c", rank: 3, elapsedMs: null },
  ];
  assert.deepEqual(highlightedResultPlayers("team", roster, results, 1), ["a", "c"]);
  assert.deepEqual(highlightedResultPlayers("solo", roster, results, 1), ["b", "a"]);
});
