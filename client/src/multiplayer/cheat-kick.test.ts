import assert from "node:assert/strict";
import test from "node:test";

import { cheatKickMessage, cheatKickOf } from "./cheat-kick";

test("only an unsolicited CHEAT_DETECTED error is a kick", () => {
  assert.deepEqual(cheatKickOf({ type: "error", code: "CHEAT_DETECTED", check: "CLOCK" }), { check: "CLOCK" });
  assert.deepEqual(cheatKickOf({ type: "error", code: "CHEAT_DETECTED" }), { check: "" });
  assert.deepEqual(cheatKickOf({ type: "error", code: "CHEAT_DETECTED", check: "<b>x</b>" }), { check: "" });
  for (const event of [undefined, null, "error", { type: "error", code: "RATE_LIMITED" },
    { type: "room", code: "CHEAT_DETECTED" },
    { type: "error", code: "CHEAT_DETECTED", check: "SPEED", requestId: "r2" }]) {
    assert.equal(cheatKickOf(event), undefined);
  }
});

test("the kick message names the check, or says data when it is unknown", () => {
  assert.match(cheatKickMessage({ check: "TELEPORT" }), /坐标瞬移/);
  assert.match(cheatKickMessage({ check: "CUBE_RATE" }), /道具箱拾取过快/);
  assert.match(cheatKickMessage({ check: "NEW_CHECK" }), /数据异常/);
});
