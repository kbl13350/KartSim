import assert from "node:assert/strict";
import test from "node:test";

test("generated timeattack module evaluates handwritten runtime bindings", async () => {
  const runtime = await import("../src/generated/timeattack.js");
  assert.equal(typeof runtime.Pt, "function");
});
