import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  personalBoostFrame,
  teamBoostFrame,
  type RaceHudBoostState,
} from "./race-hud-boost";

const releaseFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js",
);

async function originalRaceHud(): Promise<{ prototype: {
  boostFrame(this: RaceHudBoostState, time: number, ratio: number): unknown;
  teamBoostFrame(this: RaceHudBoostState, time: number, ratio: number): unknown;
} }> {
  const release = await readFile(releaseFile, "utf8");
  const start = release.indexOf("class tI {");
  const end = release.indexOf("\nfunction jJ(", start);
  assert.ok(start >= 0 && end > start);
  return new Function("C2", "Ro", `${release.slice(start, end)}\nreturn tI;`)(
    Math.fround, Math.sin,
  );
}

test("个人与组队氮气满槽帧和发行版一致", async () => {
  const Original = await originalRaceHud();
  for (const mode of ["boostFrame", "teamBoostFrame"] as const) {
    const rewrite = mode === "boostFrame" ? personalBoostFrame : teamBoostFrame;
    for (const initialActive of [false, true]) {
      const baseline: RaceHudBoostState = {
        fullActive: mode === "boostFrame" && initialActive,
        fullAnchorMs: 0,
        teamFullActive: mode === "teamBoostFrame" && initialActive,
        teamFullAnchorMs: 0,
      };
      const current = structuredClone(baseline);
      for (const [time, ratio] of [
        [1234, 0.63], [1234, 0.92], [1434, 0.17], [1933, 1], [2234, 0.5],
      ] as const) {
        const expected = Original.prototype[mode].call(baseline, time, ratio);
        const actual = rewrite(current, time, ratio, Math.sin);
        assert.deepEqual(actual, expected, `${mode} ${time}`);
        assert.deepEqual(current, baseline, `${mode} state ${time}`);
      }
    }
    const invalid: RaceHudBoostState = {
      fullActive: true, fullAnchorMs: 0, teamFullActive: true, teamFullAnchorMs: 0,
    };
    for (const ratio of [NaN, Infinity, -Infinity]) {
      let originalMessage = "";
      try { Original.prototype[mode].call(invalid, 100, ratio); }
      catch (error) { originalMessage = (error as Error).message; }
      assert.ok(originalMessage);
      assert.throws(() => rewrite(structuredClone(invalid), 100, ratio, Math.sin),
        { message: originalMessage });
    }
  }
});
