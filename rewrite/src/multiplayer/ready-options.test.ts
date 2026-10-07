import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { multiplayerReadyOptions } from "./ready-options";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function Hl0(");
const end = release.indexOf("\nclass ql0 {", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

test("multiplayer Ready speed and version normalization match release", () => {
  for (const options of [
    { speed: 4, name: "normal" },
    { speed: 4, version: "国服", settingSpeed: 3 },
    { speed: 4, version: "韩服" },
    { speed: 7, version: "国服" },
    { speed: 0, version: null },
  ]) {
    const modernCalls: unknown[] = [];
    const releaseCalls: unknown[] = [];
    const modern = multiplayerReadyOptions(options, value => {
      modernCalls.push(value);
      return value.speed;
    });
    const old = new Function("Ue", `${source}\nreturn Hl0;`)(
      (value: typeof options) => {
        releaseCalls.push(value);
        return value.speed;
      },
    ) as (value: typeof options) => unknown;
    assert.deepEqual(modern, old(options));
    assert.deepEqual(modernCalls, releaseCalls);
  }
});
