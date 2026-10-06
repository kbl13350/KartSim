import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/generated/world.js", import.meta.url), "utf8");
const start = source.indexOf("const Yo0 = {");
const end = source.indexOf("class Jo0 {", start);
assert.ok(start >= 0 && end > start, "generated ShellStateMachine declaration was not found");
const ShellStateMachine = new Function(`${source.slice(start, end)}\nreturn Qo0;`)();

test("house has its own Ready modal state and releases its lock on close", () => {
  const shell = new ShellStateMachine();
  shell.enterReady();
  assert.equal(shell.openModal("house"), true);
  assert.equal(shell.current, "ReadyHouse");
  assert.equal(shell.modal, "house");
  assert.equal(shell.readyModalBusy, true);
  assert.equal(shell.openModal("garage"), false);
  assert.equal(shell.enterMultiplayerLobby(), false);
  assert.equal(shell.beginRaceStart(), false);
  shell.closeModal("house");
  assert.equal(shell.current, "Ready");
  assert.equal(shell.readyModalBusy, false);
  assert.equal(shell.openModal("garage"), true);
});
