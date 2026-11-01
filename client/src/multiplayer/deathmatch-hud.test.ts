import assert from "node:assert/strict";
import test from "node:test";
import { DeathmatchHud, deathmatchTimeText, type DeathmatchHudFrame } from "./deathmatch-hud";
import { DEATHMATCH_TRACKS, isDeathmatchTrack } from "./deathmatch-rules";
import { DEATHMATCH_TRACK_IDS } from "./lobby-deathmatch-mode";

function fixture() {
  const text: string[] = [];
  let clears = 0, removed = 0;
  const canvas = { clientWidth: 1600, clientHeight: 900, width: 0, height: 0,
    hidden: true, dataset: {}, style: {}, setAttribute() {}, remove() { removed++; },
    getContext: () => ({ setTransform() {}, clearRect() { clears++; }, fillRect() {},
      strokeText() {}, fillText(value: string) { text.push(value); } }) };
  const document = { createElement: () => canvas, defaultView: { devicePixelRatio: 2 } };
  Object.assign(canvas, { ownerDocument: document });
  const root = { ownerDocument: document, append() {} } as unknown as HTMLElement;
  const hud = new DeathmatchHud(root, { canonicalCandidates: () => [] }, "local");
  const frame: DeathmatchHudFrame = { scores: { 1: 7, 2: 4 }, remainingMs: 61100,
    respawnRemainingMs: 0, protectedRemainingMs: 0, kills: 3, deaths: 1, team: 1, finished: false };
  return { hud, canvas, text, frame, get clears() { return clears; }, get removed() { return removed; } };
}

test("deathmatch HUD renders authoritative scores, remaining seconds and local knockouts", () => {
  assert.equal(deathmatchTimeText(180000), "03:00");
  assert.equal(deathmatchTimeText(1), "00:01");
  assert.equal(deathmatchTimeText(-10), "00:00");
  const f = fixture();
  f.hud.update(1000, f.frame);
  assert.equal(f.canvas.hidden, false);
  assert.equal(f.canvas.width, 3200);
  assert.equal(f.canvas.height, 1800);
  for (const value of ["红队", "蓝队", "04", "07", "01:02", "击落 3 · 坠落 1"])
    assert.ok(f.text.includes(value), value);
  f.hud.dispose();
});

test("respawn and protection give way to the team outcome, including a draw", () => {
  const f = fixture();
  f.hud.update(0, { ...f.frame, respawnRemainingMs: 2100 });
  assert.ok(f.text.includes("3 秒后复活"));
  f.text.length = 0;
  f.hud.update(0, { ...f.frame, protectedRemainingMs: 1100 });
  assert.ok(f.text.includes("复活保护 2 秒"));
  f.text.length = 0;
  f.hud.update(0, { ...f.frame, finished: true, respawnRemainingMs: 3000,
    outcome: { reason: "timeout", winningTeam: 2, endedAt: 180000 } });
  assert.ok(f.text.includes("蓝队胜利！"));
  assert.ok(!f.text.some(value => value.includes("秒后复活")));
  f.text.length = 0;
  f.hud.update(0, { ...f.frame, finished: true, outcome: { reason: "timeout", winningTeam: 0, endedAt: 180000 } });
  assert.ok(f.text.includes("平局"));
  f.hud.dispose();
});

test("disposing the HUD twice releases the canvas once and stops further frames", () => {
  const f = fixture();
  f.hud.update(0, f.frame);
  const clears = f.clears;
  f.hud.dispose();
  f.hud.dispose();
  f.hud.update(1, f.frame);
  assert.equal(f.removed, 1);
  assert.equal(f.clears, clears);
});

test("deathmatch runtime and lobby accept the same five original arenas", () => {
  assert.deepEqual(DEATHMATCH_TRACKS, DEATHMATCH_TRACK_IDS);
  for (const track of DEATHMATCH_TRACK_IDS) assert.ok(isDeathmatchTrack(track));
  for (const track of ["mine_D01", "space_D01", "desert_D01", null]) assert.equal(isDeathmatchTrack(track), false);
});
