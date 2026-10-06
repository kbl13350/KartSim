import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatMultiplayerError } from "./errors";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("function C1(n) {");
const end = source.indexOf("function Hl0(n)", start);
assert.ok(start > 0 && end > start);
const original = new Function(`${source.slice(start, end)}\nreturn C1;`)() as
  (error: unknown) => string;

test("all known multiplayer errors retain release UI text", () => {
  const codes = [
    "GUEST_NAME_TAKEN", "INVALID_GUEST_NAME", "RACE_IN_PROGRESS",
    "NOT_ENOUGH_PLAYERS", "TRACK_REQUIRED", "EQUIPMENT_REQUIRED",
    "PLAYERS_NOT_READY", "TEAM_REQUIRED", "CLIENT_RACE_UNAVAILABLE",
    "STALE_RACE", "LOAD_TIMEOUT", "LOAD_FAILED", "MEMBER_LEFT",
    "HOST_CANCELLED", "WRONG_PASSWORD", "ROOM_FULL", "ROOM_NOT_FOUND",
    "TEAM_FULL", "STALE_REVISION", "HOST_REQUIRED", "PLAYER_NOT_FOUND",
    "RESOURCE_VERSION_MISMATCH", "ROOM_LIMIT", "NOT_IN_ROOM", "ALREADY_IN_ROOM",
    "SLOT_OUTSIDE_CAPACITY", "SLOT_OCCUPIED", "VOTE_IN_PROGRESS", "VOTE_NOT_FOUND",
    "VOTE_NOT_ELIGIBLE", "PLAYER_CHANGING", "HOST_HAS_START_BUTTON",
    "PLAYER_READY", "READY_COUNTDOWN_LOCKED", "CHAT_RATE_LIMIT", "VERSION_MISMATCH",
    "ROADBLOCK_NEEDS_FIVE", "TRACK_UNAVAILABLE", "RUNNER_REQUIRED", "unknown", 42,
  ];
  for (const code of codes) {
    assert.equal(formatMultiplayerError(code), original(code), String(code));
    assert.equal(formatMultiplayerError(new Error(String(code))),
      original(new Error(String(code))), `Error: ${code}`);
  }
});
