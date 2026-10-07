import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { findSpeedTypeEntry, defaultCnSpeedType } from "./speed-baseline";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("const I20 =");
const end = source.indexOf("const z20 =", start);
assert.ok(start > 0 && end > start);
const speedSection = source.slice(start, end);
const speedNames = {
  国服: { 普通S1: 0, 快速S2: 1, 高速S3: 2, 慢速S0: 3, 真无限: 6, 标准: 7 },
  国服复古: { 新手: 0, 初级: 1, L3: 2, L2: 3, L1: 4, Pro: 5 },
  韩服复古: { 新手: 0, 初级: 1, L3: 2, L2: 3, L1: 4, Pro: 5 },
};
const original = new Function("i3", `${speedSection}\nreturn { lookup: II, fallback: k20 };`)(speedNames) as {
  lookup: (version: unknown, speed: unknown) => unknown;
  fallback: Record<string, number>;
};

test("SpeedType table lookup preserves entries, missing values and identity", () => {
  for (const [version, speeds] of [
    ["国服", [0, 1, 2, 3, 4, 5, 6, 7, 8]],
    ["国服复古", [0, 1, 2, 3, 4, 5]],
    ["韩服复古", [0, 1, 2, 3, 4, 5]],
  ] as const) {
    for (const speed of speeds) {
      assert.deepEqual(findSpeedTypeEntry(version, speed), original.lookup(version, speed));
      assert.strictEqual(findSpeedTypeEntry(version, speed), findSpeedTypeEntry(version, speed));
    }
  }
  for (const [version, speed] of [
    ["国服", -1], ["国服", 9], ["国服复古", 8], ["韩服复古", 6],
    ["unknown", 0], ["国服", "00"],
  ] as const)
    assert.equal(findSpeedTypeEntry(version, speed), original.lookup(version, speed));
  assert.deepEqual(defaultCnSpeedType, original.fallback);
});
