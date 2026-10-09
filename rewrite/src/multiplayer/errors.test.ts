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

test("data service and game server split codes have Chinese messages", () => {
  const codes = [
    "TICKET_REQUIRED", "TICKET_INVALID", "TICKET_EXPIRED", "TICKET_REUSED",
    "TICKET_WRONG_NODE", "DATA_NODE_MISMATCH", "GAME_SERVER_NOT_FOUND",
    "GAME_SERVER_FULL", "SERVER_FULL", "DATA_SERVICE_UNAVAILABLE",
    "NICKNAME_TAKEN", "LOGIN_REQUIRED", "SERVER_BUSY", "SERVER_SHUTTING_DOWN",
    "ROOM_LIMIT_REACHED", "PROTOCOL_MISMATCH",
    // client-websocket.ts rejections when a node refuses the upgrade.
    "WebSocket connection failed", "WebSocket connection timeout",
  ];
  for (const code of codes) {
    const message = formatMultiplayerError(new Error(code));
    assert.notEqual(message, code, code);
    assert.match(message, /[一-鿿]/u, code);
    assert.equal(formatMultiplayerError(code), message, code);
  }
  assert.equal(formatMultiplayerError(new Error("SERVER_FULL")),
    "游戏服务器人数已满，请稍后再试或选择其他服务器。");
  assert.equal(formatMultiplayerError(new Error("暂无可用的游戏服务器。")),
    "暂无可用的游戏服务器。");
});

test("account economy codes have Chinese messages", () => {
  for (const code of ["REGISTRATION_CLOSED", "TOO_MANY_ATTEMPTS", "LOGIN_REQUIRED",
    "ONBOARDING_REQUIRED", "ITEM_NOT_OWNED", "INSUFFICIENT_FUNDS", "ALREADY_OWNED",
    "EXP_REQUIRED", "OFFER_NOT_FOUND", "RATE_LIMITED", "STORAGE_QUOTA_EXCEEDED",
    "DATA_SERVICE_UNAVAILABLE", "ACCOUNT_ONLINE", "PRICE_CHANGED", "REQUEST_ID_CONFLICT"]) {
    const message = formatMultiplayerError(new Error(code));
    assert.notEqual(message, code, code);
    assert.match(message, /[一-鿿]/u, code);
  }
});

test("one live session per account and game-node throttling are explained in Chinese", () => {
  assert.equal(formatMultiplayerError(new Error("ACCOUNT_ONLINE")),
    "该账号已在其他地方在线，请先退出另一处登录。");
  assert.equal(formatMultiplayerError(new Error("RATE_LIMITED")), "操作太频繁，请稍后再试。");
});
