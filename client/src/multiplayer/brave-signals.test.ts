import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera } from "three";
import { BraveSignals, noteBraveKartContact, type BraveContact } from "./brave-signals";
import { BraveHud } from "./brave-hud";
import { bindRaceScope, createRaceConnection, type RaceSessionHost } from "./race-session";
import { parseServerEvent } from "./server-events";

const roster = [
  { playerId: "red1", team: 1 as const }, { playerId: "red2", team: 1 as const },
  { playerId: "blue1", team: 2 as const }, { playerId: "blue2", team: 2 as const },
];
function fixture() {
  let time = 1000;
  const physics = {}, sends: string[] = [], listeners = new Set<(event: BraveContact) => void>();
  const connection = {
    sendBraveCollision: async (id: string) => { sends.push(id); },
    subscribeBraveCollision: (listener: (event: BraveContact) => void) => {
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
  };
  return { physics, sends, listeners, connection, now: () => time, at: (value: number) => { time = value; } };
}

test("勇者碰撞只提示实际敌车接触，限制重发并在销毁后解除监听", () => {
  const f = fixture(), signals = new BraveSignals(f.physics, "red1", roster, f.connection, f.now);
  noteBraveKartContact(f.physics, "blue1");
  assert.equal(signals.selfHitAt, -Infinity);
  signals.setActive(true);
  for (const id of ["red1", "red2", "unknown"]) noteBraveKartContact(f.physics, id);
  assert.deepEqual(f.sends, []);
  noteBraveKartContact(f.physics, "blue1");
  assert.equal(signals.selfHitAt, 1000);
  f.at(1200); noteBraveKartContact(f.physics, "blue1");
  assert.deepEqual(f.sends, ["blue1"]);
  f.at(1400); noteBraveKartContact(f.physics, "blue2");
  assert.deepEqual(f.sends, ["blue1", "blue2"]);
  signals.setActive(false);
  assert.equal(signals.selfHitAt, -Infinity);
  signals.dispose();
  signals.setActive(true);
  noteBraveKartContact(f.physics, "blue1");
  assert.equal(f.sends.length, 2);
  assert.equal(f.listeners.size, 0);
});

test("服务器通知区分自己碰撞与队友碰撞，忽略未知或同队组合", () => {
  const f = fixture(), signals = new BraveSignals(f.physics, "red1", roster, f.connection, f.now);
  signals.setActive(true);
  signals.receive({ playerId: "red2", targetId: "blue1" });
  assert.equal(signals.teamHitAt, 1000);
  assert.equal(signals.selfHitAt, -Infinity);
  f.at(1500);
  signals.receive({ playerId: "blue2", targetId: "red1" });
  assert.equal(signals.selfHitAt, 1500);
  for (const targetId of ["red1", "unknown"])
    signals.receive({ playerId: "red2", targetId });
  assert.equal(signals.teamHitAt, 1000);
  assert.deepEqual(f.sends, []);
  signals.setActive(false);
  signals.receive({ playerId: "blue2", targetId: "red1" });
  assert.equal(signals.selfHitAt, -Infinity);
  signals.dispose();
});

test("勇者提示只投影前方敌车，渲染受击红屏及队友警灯，比赛结束清理", () => {
  const f = fixture(), text: string[] = [], rects: unknown[][] = [];
  let removed = false;
  const ctx = { clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText: (value: string) => text.push(value), fillRect: (...args: unknown[]) => rects.push(args),
    createRadialGradient: () => ({ addColorStop() {} }) };
  const canvas = { dataset: {}, style: {}, hidden: false, width: 0, height: 0,
    clientWidth: 800, clientHeight: 600, setAttribute() {}, getContext: () => ctx,
    remove: () => { removed = true; } };
  const root = { ownerDocument: { createElement: () => canvas }, append() {} };
  const hud = new BraveHud(root as unknown as HTMLElement, f.physics, "red1", roster, f.connection, f.now);
  const camera = new PerspectiveCamera(60, 800 / 600, .1, 1000);
  camera.updateMatrixWorld();
  const frame = { active: true, camera, position: { x: 0, y: 0, z: 0 },
    pose: (id: string) => ({ position: { x: 0, y: 0, z: id === "blue2" ? 10 : -10 } }),
    finished: () => false };
  hud.update(1000, frame);
  assert.deepEqual(text, ["10 m"]);
  assert.equal(canvas.hidden, false);
  noteBraveKartContact(f.physics, "blue1");
  hud.signals.receive({ playerId: "red2", targetId: "blue1" });
  hud.update(1100, frame);
  assert.equal(rects.length, 4, "one red overlay and three teammate beacon rectangles");
  text.length = 0;
  hud.update(1200, { ...frame, finished: () => true });
  assert.deepEqual(text, []);
  hud.update(1300, { ...frame, active: false });
  assert.equal(canvas.hidden, true);
  assert.equal(hud.signals.teamHitAt, -Infinity);
  hud.dispose(); hud.dispose();
  assert.equal(removed, true);
  assert.equal(f.listeners.size, 0);
});

test("勇者事件校验及连接只能发送和接收当前比赛，abort解除全部订阅", async () => {
  const listeners = new Set<(value: any) => void>(), commands: unknown[] = [], received: unknown[] = [];
  const host: RaceSessionHost = { playerId: "red1", raceLatencies: new Map(),
    echoRtt: { reportAndReset() {} }, request: async value => { commands.push(value); },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    subscribeMotion: () => () => {}, sendMotion: () => true };
  bindRaceScope(host, { roomId: "room", phase: "racing",
    members: roster.map((racer, slot) => ({ ...racer, slot, ready: true, name: racer.playerId })),
    race: { raceId: "race", loadedIds: roster.map(racer => racer.playerId) } });
  const abort = new AbortController();
  const connection = createRaceConnection(host, "room", "race", abort.signal);
  connection.subscribeBraveCollision(event => received.push(event));
  await connection.sendBraveCollision("blue1");
  assert.deepEqual(commands, [{ type: "brave-collision", roomId: "room", raceId: "race", targetId: "blue1" }]);
  const valid = { type: "brave-collision", roomId: "room", raceId: "race", playerId: "red2", targetId: "blue1" };
  const validation = { validRoom: () => true, validChannel: () => true,
    validGameplay: () => true, validRandomTrackCode: () => true };
  assert.ok(parseServerEvent(valid, validation));
  for (const event of [{ ...valid, targetId: "red2" }, { ...valid, playerId: "" }, { ...valid, raceId: 1 }])
    assert.equal(parseServerEvent(event, validation), undefined);
  for (const listener of listeners) {
    for (const event of [valid, { ...valid, roomId: "old" }, { ...valid, raceId: "old" },
      { ...valid, playerId: "stranger" }]) listener(event);
  }
  assert.deepEqual(received, [{ playerId: "red2", targetId: "blue1" }]);
  abort.abort();
  assert.equal(listeners.size, 0);
  await assert.rejects(connection.sendBraveCollision("blue1"), /expired/);
});
