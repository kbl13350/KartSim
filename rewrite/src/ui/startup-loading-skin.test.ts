import assert from "node:assert/strict";
import test from "node:test";
import { startupLoadingPercent } from "./startup-loading-skin";

test("the loading bar shows the overall percentage, clamped to 0..100", () => {
  assert.equal(startupLoadingPercent(null), 0);
  assert.equal(startupLoadingPercent("42.3"), 42.3);
  assert.equal(startupLoadingPercent("120"), 100);
  assert.equal(startupLoadingPercent("-5"), 0);
  assert.equal(startupLoadingPercent("not a number"), 0);
});
