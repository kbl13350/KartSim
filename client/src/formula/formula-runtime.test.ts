import assert from "node:assert/strict";
import test from "node:test";
import { FormulaRuntime, formulaOf } from "./formula-runtime";
import { FORMULA_PIT_SURFACES } from "./formula-data";
import type { FormulaRaceRequest } from "./formula-race";
import type { FormulaNpcSample } from "./formula-engine";
import { TimeAttackLifecycle } from "../timeattack/lifecycle";

function setup(laps = 1) {
  const radius = 1000;
  const frames = Array.from({ length: 65 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    return { position: { x: Math.sin(angle) * radius, y: 0, z: -Math.cos(angle) * radius },
      forward: { x: Math.cos(angle), y: 0, z: Math.sin(angle) }, up: { x: 0, y: 1, z: 0 } };
  });
  const gate = { triangles: [[], []], normal: frames[0]!.forward, name: "finish", final: true };
  let progress = 0;
  const track = { data: { firstSection: 0, lastSection: 0, lapTarget: laps },
    sections: [{ frames, length: 2 * Math.PI * radius, incoming: [{ gate, section: 0 }],
      outgoing: [{ gate, section: 0 }], surface: "road" }],
    getStart: () => frames[0], getRouteState: () => ({ distance: progress }),
    rayQuery: (origin: { x: number; y: number; z: number }) => ({ point: { ...origin, y: 0 } }) };
  const scales: Array<{ draftAcceleration: number }> = [];
  const locks: boolean[] = [];
  const physics = { body: { position: { x: 100_000, y: 0, z: 100_000 }, forward: { x: 1, y: 0, z: 0 } },
    state: { speedKmh: 0 }, setMultiplayerDrivingScales: (value: { draftAcceleration: number }) => scales.push(value),
    setRaceMotionLocked: (locked: boolean) => locks.push(locked) };
  let returns = 0;
  const errors: string[] = [];
  // This is deliberately the builder host: it does not have session, paused or
  // input. Those members only exist on the later frame host in the real game.
  const builderHost = { returnToReady: async () => { returns++; frameHost.shell.started = false; frameHost.session.formula = undefined; },
    hud: { showDebugText: (message: string) => errors.push(message) } };
  const lifecycle = new TimeAttackLifecycle(); lifecycle.phase = 2; lifecycle.startAtMs = 1000;
  const inputEnabled: boolean[] = [];
  const frameHost = { session: { lifecycle, localName: "本机车手", formula: undefined as FormulaRuntime | undefined }, paused: false,
    shell: { started: true },
    input: { setEnabled: (enabled: boolean) => inputEnabled.push(enabled) } };
  const request: FormulaRaceRequest = { round: 1, groupId: 1, difficulty: "normal", trackId: "wkc_R01", playerName: "测试车手" };
  const runtime = new FormulaRuntime(request, builderHost, track, physics);
  frameHost.session.formula = runtime;
  const pit = FORMULA_PIT_SURFACES.find(surface => surface.trackId === "wkc_R01")!.triangles[0]!;
  const enterPit = () => { physics.body.position = { x: (pit.a.x + pit.b.x + pit.c.x) / 3,
    y: (pit.a.y + pit.b.y + pit.c.y) / 3, z: (pit.a.z + pit.b.z + pit.c.z) / 3 }; };
  const advance = (elapsed: number) => runtime.update(lifecycle.startAtMs + elapsed + lifecycle.pausedTotalMs, frameHost);
  return { runtime, request, frameHost, lifecycle, physics, track, builderHost, scales, locks, errors,
    inputEnabled, enterPit, advance, setProgress: (value: number) => { progress = value; }, get returns() { return returns; } };
}

test("runtime construction only requires builder host; 19 playback streams expose live world poses", () => {
  const scene = setup();
  const { runtime } = scene;
  assert.equal("session" in scene.builderHost, false);
  assert.equal(runtime.activate(), false, "no frame host or racing lifecycle has been published yet");
  assert.equal(formulaOf({ formula: runtime }), runtime);
  assert.equal(formulaOf(undefined), undefined);
  const streams = Array.from({ length: 19 }, (_, index) => runtime.playback(index));
  const initial = streams.map(stream => (stream.sample(0) as { formulaPose: FormulaNpcSample }).formulaPose);
  scene.advance(0); scene.advance(1000);
  for (let index = 0; index < 19; index++) {
    const sample = streams[index]!.sample(999_999) as { formulaPose: FormulaNpcSample; sample: { timeMs: number }; speedKmh: number };
    assert.equal(sample.formulaPose.id, index + 1);
    assert.equal(sample.sample.timeMs, 1000, "playback follows race clock rather than an arbitrary replay timestamp");
    assert.ok(sample.formulaPose.distance > initial[index]!.distance);
    assert.ok(sample.speedKmh > 0);
    assert.equal(sample.formulaPose.position.y, 0, "world poses use the real track ground callback");
    assert.ok(Math.abs(Math.hypot(sample.formulaPose.forward.x, sample.formulaPose.forward.y, sample.formulaPose.forward.z) - 1) < 1e-9);
  }
  assert.throws(() => runtime.playback(19), /缺少 NPC/);
  runtime.dispose();
});

test("reused track ray-hit scratch cannot collapse or mutate the 19 NPC world positions", () => {
  const scene = setup();
  const point = { x: 0, y: 0, z: 0 };
  const hit = { point };
  // StaticTrackSurface.buildHit and MovingTrackSurface.buildHit intentionally
  // reuse this exact object for every query, including later physics queries.
  scene.track.rayQuery = origin => {
    Object.assign(point, { ...origin, y: 0 });
    return hit;
  };
  scene.advance(0); scene.advance(1000);
  const poses = scene.runtime.state.npcs.map(npc => npc.position);
  assert.equal(new Set(poses).size, 19, "each world pose must own its position");
  assert.equal(new Set(poses.map(p => `${p.x}:${p.y}:${p.z}`)).size, 19, "NPCs must stay in distinct lanes and rows");
  const saved = poses.map(p => ({ ...p }));
  scene.track.rayQuery({ x: 12345, y: 12, z: 54321 });
  assert.deepEqual(poses, saved, "the next tyre/road raycast must not rewrite the rendered field");
  scene.runtime.dispose();
});

test("pause uses the lifecycle effective clock, blocks activation and preserves boost time", () => {
  const scene = setup(); scene.enterPit(); scene.advance(0); scene.advance(2000);
  assert.equal(scene.runtime.state.charge, 1);
  assert.equal(scene.runtime.activate(), true, "the HUD/touch callback uses the same public activation path");
  assert.equal(scene.scales.at(-1)!.draftAcceleration, 2.2);
  const snapshot = scene.runtime.state;
  scene.lifecycle.togglePause(3000); scene.frameHost.paused = true;
  scene.runtime.update(33_000, scene.frameHost);
  assert.equal(scene.runtime.state, snapshot);
  assert.equal(scene.runtime.activate(), false);
  scene.lifecycle.togglePause(33_000); scene.frameHost.paused = false;
  scene.runtime.update(33_000, scene.frameHost);
  assert.equal(scene.runtime.state.timeMs, 2000);
  assert.equal(scene.runtime.state.boostRemainingMs, 2400);
  scene.advance(4400);
  assert.equal(scene.runtime.state.boosting, false);
  assert.equal(scene.scales.at(-1)!.draftAcceleration, 1);
  scene.runtime.dispose();
});

test("Space ignores key repeats and text fields, and triggers the charged accelerator once", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  class FakeElement { isContentEditable = false; constructor(readonly tagName: string) {} }
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: FakeElement });
  try {
    const scene = setup(); scene.enterPit(); scene.advance(0); scene.advance(2000);
    let prevented = 0, stopped = 0;
    const key = (overrides: Record<string, unknown> = {}) => ({ code: "Space", repeat: false, target: {},
      preventDefault: () => prevented++, stopImmediatePropagation: () => stopped++, ...overrides });
    const handler = (scene.runtime as unknown as { keydown(event: unknown): void }).keydown;
    handler(key({ repeat: true })); handler(key({ target: new FakeElement("INPUT") })); handler(key({ code: "ControlLeft" }));
    assert.equal(scene.runtime.state.boosting, false);
    assert.equal(prevented, 0);
    handler(key());
    assert.equal(scene.runtime.state.boosting, true);
    assert.equal(scene.runtime.state.charge, 0);
    assert.equal(prevented, 1); assert.equal(stopped, 1);
    assert.equal(scene.runtime.activate(), false, "an already consumed charge cannot be activated twice");
    scene.runtime.dispose();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "HTMLElement", descriptor);
    else Reflect.deleteProperty(globalThis, "HTMLElement");
  }
});

test("an unfinished human gets a DNF result at the race deadline and returns exactly once", async () => {
  const scene = setup(100); scene.advance(0); scene.advance(500_000);
  assert.equal(scene.runtime.state.raceOver, true);
  const result = scene.request.result!;
  assert.equal(result.elapsedMs, 480_000);
  assert.equal(result.standings.length, 20);
  assert.equal(result.standings.find(row => row.id === 0)!.dnf, true);
  assert.equal(result.standings.find(row => row.id === 0)!.name, "测试车手");
  assert.deepEqual(scene.locks, [true]); assert.deepEqual(scene.inputEnabled, [false]);
  scene.advance(501_000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(scene.returns, 1);
  scene.advance(502_000); await Promise.resolve();
  assert.equal(scene.returns, 1);
  assert.equal(scene.request.result, result, "repeat updates cannot mutate a completed round");
  scene.runtime.dispose();
});

test("normal local finish keeps NPCs running for the grace period and suppresses solo result actions", async () => {
  const scene = setup(); scene.advance(0); scene.advance(10_000);
  const before = scene.runtime.state.npcs[0]!.distance;
  scene.lifecycle.phase = 3; scene.lifecycle.finishElapsedMs = 10_000;
  scene.setProgress(scene.runtime.engine.raceDistance); scene.advance(10_000);
  assert.equal(scene.runtime.state.finishDeadlineMs, 40_000);
  assert.equal(scene.request.result, undefined);
  scene.lifecycle.phase = 4; scene.advance(20_000);
  assert.ok(scene.runtime.state.npcs[0]!.distance > before);
  assert.equal(scene.returns, 0);
  assert.equal(scene.runtime.consumes({ kind: "return-to-ready" }), true);
  assert.equal(scene.runtime.consumes({ kind: "play-result-bgm", beatTarget: false }), true);
  assert.equal(scene.runtime.consumes({ kind: "show-result", elapsedMs: 10_000, previousBestMs: null, bestMs: 10_000, isNewRecord: true }), true);
  assert.equal(scene.runtime.consumes({ kind: "finish", elapsedMs: 10_000 }), false, "normal finish must still lock the human kart");
  scene.advance(40_000); await new Promise(resolve => setImmediate(resolve));
  assert.equal(scene.request.result!.standings.find(row => row.id === 0)!.finishedMs, 10_000);
  assert.equal(scene.returns, 1);
  scene.runtime.dispose();
});

test("a forced failure is never converted to a human finish by the lifecycle timestamp", () => {
  const scene = setup(); scene.advance(0);
  scene.lifecycle.phase = 3; scene.lifecycle.finishElapsedMs = 1000; scene.lifecycle.forcedResult = "failed";
  scene.advance(1000);
  assert.equal(scene.runtime.engine.standings().find(row => row.id === 0)!.finishedMs, undefined);
  assert.equal(scene.runtime.state.finishDeadlineMs, undefined);
  scene.runtime.dispose();
});

test("reset and disposal clear the force multiplier and cancel a pending return callback", async () => {
  const scene = setup(); scene.enterPit(); scene.advance(0); scene.advance(2000); scene.runtime.activate();
  scene.runtime.reset();
  assert.equal(scene.scales.at(-1)!.draftAcceleration, 1);
  assert.equal(scene.runtime.state.timeMs, 0); assert.equal(scene.runtime.state.charge, 0);
  assert.equal(scene.request.result, undefined);
  scene.advance(0); scene.advance(2000); scene.runtime.activate();
  scene.runtime.dispose();
  assert.equal(scene.scales.at(-1)!.draftAcceleration, 1);
  assert.equal(scene.runtime.activate(), false);
  const state = scene.runtime.state; scene.advance(5000); assert.equal(scene.runtime.state, state);
  const disposedScales = scene.scales.length; scene.runtime.dispose(); assert.equal(scene.scales.length, disposedScales);

  const ending = setup(100); ending.advance(0); ending.advance(500_000);
  ending.runtime.dispose(); await Promise.resolve();
  assert.equal(ending.returns, 0, "a scene disposed before the queued return must not navigate the user away");
});

test("a resolved but unsuccessful Ready navigation retries after two seconds without duplicate settlement", async () => {
  const scene = setup(100);
  let calls = 0;
  scene.builderHost.returnToReady = async () => { calls++; };
  scene.advance(0); scene.advance(480_000);
  await new Promise(resolve => setImmediate(resolve));
  const result = scene.request.result;
  assert.equal(calls, 1);
  for (const elapsed of [480_016, 480_500, 481_000, 481_999]) scene.advance(elapsed);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1, "failure must not cause a navigation attempt every frame");
  scene.advance(482_000); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(scene.request.result, result);
  assert.deepEqual(scene.locks, [true]); assert.deepEqual(scene.inputEnabled, [false]);
  scene.frameHost.session.formula = undefined;
  scene.advance(484_000); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2, "a user exit or replaced session owns navigation now");
  scene.runtime.dispose();
});

test("pending return callbacks cannot navigate after a restart or owner replacement", async () => {
  for (const action of ["restart", "replacement"] as const) {
    const scene = setup(100); scene.advance(0); scene.advance(480_000);
    if (action === "restart") scene.runtime.reset();
    else scene.frameHost.session.formula = undefined;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scene.returns, 0, action);
    scene.runtime.dispose();
  }
});
