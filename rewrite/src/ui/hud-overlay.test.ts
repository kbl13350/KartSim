import assert from "node:assert/strict";
import test from "node:test";

import { formatNetStats } from "./hud-overlay";

test("F10 readout shows the game-server round trip and the frame rate", () => {
  assert.equal(formatNetStats(23.4, 59.6), "延迟 23 ms  FPS 60");
  assert.equal(formatNetStats(null, 30), "延迟 --  FPS 30");
  assert.equal(formatNetStats(undefined, 0), "FPS 0");
});
