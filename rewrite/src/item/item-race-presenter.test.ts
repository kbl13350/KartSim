import assert from "node:assert/strict";
import test from "node:test";
import { Group, PerspectiveCamera } from "three";
import { ItemIdx, loadItemCatalog, type ItemCatalog } from "./item-catalog";
import type {
  FxAudioContext, FxAudioParam, FxAudioSource, FxModelData, FxModelNode, FxRenderedScene, ItemFxOps,
} from "./item-fx-assets";
import { ITEM_FX_TUNING, type CloudFx } from "./item-fx-plan";
import {
  loadItemRacePresenter, type ItemPresenterFrame, type ItemPresenterPose, type ItemPresenterVec3,
  type ItemRacePresenterImpl,
} from "./item-race-presenter";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

/**
 * Event sequences against the real item data, with fake scenes, a fake
 * audio context, a fake clock and fake kart poses: which model shows where
 * and when, and which sound plays.
 */

let catalogLoad: Promise<ItemCatalog> | undefined;
const catalog = () => catalogLoad ??= loadMirrorLibrary(ITEM_CONTAINERS).then(loadItemCatalog);

class FakeScene implements FxRenderedScene {
  object = new Group();
  resets: number[] = [];
  updates: number[] = [];
  disposed = false;
  constructor(readonly path: string) { this.object.name = path; }
  reset(now: number) { this.resets.push(now); }
  playControllers() {}
  update(now: number) { this.updates.push(now); }
  dispose() { this.disposed = true; }
}

class FakeParam implements FxAudioParam {
  value = Number.NaN;
  setValueAtTime(value: number) { this.value = value; }
}

class FakeSource implements FxAudioSource {
  buffer: unknown;
  loop = false;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  start() { this.started = true; }
  stop() { this.stopped = true; }
  disconnect() {}
}

interface Played { path: string; volume: number; pan: number; loop: boolean; source: FakeSource }

function node(name: string, children: FxModelNode[] = []): FxModelNode {
  return { kind: "node", className: "Relement", name, children, transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    position: [0, 0, 0], scale: [1, 1, 1], slots: new Array(11), slotOccurrences: new Array(11) };
}

function harness() {
  const scenes: FakeScene[] = [];
  const played: Played[] = [];
  const builds: string[] = [];
  let holdBuilds = false;
  const pendingBuilds: Array<() => void> = [];
  const context: FxAudioContext = {
    currentTime: 0,
    createBufferSource: () => new FakeSource(),
    createGain: () => ({ gain: new FakeParam(), disconnect() {} }),
    createStereoPanner: () => ({ pan: new FakeParam(), disconnect() {} }),
  };
  const ops: ItemFxOps<string> = {
    originalAsset: (_archive, path) => ({ bytes: async () => path }),
    decodeModel: bytes => ({ root: node(String(bytes), [node("Point01"), node("물방울-중심", [node("balloon")])]) }),
    decodeAudio: (_context, bytes) => `buffer:${String(bytes)}`,
    loadModel: async (data: FxModelData, _archive, path) => {
      if (holdBuilds) await new Promise<void>(resolve => pendingBuilds.push(resolve));
      builds.push(path);
      // The carried balloon is built from the water bomb's falling balloon only.
      if (path === "item/waterBomb/item00.1s" && data.root.children.length === 1)
        assert.equal(data.root.children[0]!.name, "물방울-중심");
      const scene = new FakeScene(path);
      scenes.push(scene);
      return scene;
    },
    routeAudio: (_context, source, group, gain, panner) => {
      assert.equal(group, "fx");
      played.push({ path: String(source.buffer).slice("buffer:".length),
        volume: (gain!.gain as FakeParam).value, pan: panner ? (panner.pan as FakeParam).value : 0,
        loop: source.loop, source: source as FakeSource });
    },
    setGain: (param, value) => { param.setValueAtTime(value, 0); },
  };
  return {
    scenes, played, builds, context, ops,
    hold(on: boolean) { holdBuilds = on; },
    releaseBuilds() { for (const resolve of pendingBuilds.splice(0)) resolve(); },
  };
}

interface Kart { position: ItemPresenterVec3; forward?: ItemPresenterVec3 }

/** A kart facing +z (the physics start basis) or along `forward` on flat ground. */
function pose(kart: Kart): ItemPresenterPose {
  const forward = kart.forward ?? { x: 0, y: 0, z: 1 };
  return { position: { ...kart.position }, forward: { ...forward }, up: { x: 0, y: 1, z: 0 },
    right: { x: forward.z, y: 0, z: -forward.x } };
}

async function setup() {
  const h = harness();
  const presenter = await loadItemRacePresenter("lib", await catalog(), "env", "stage", h.context, h.ops);
  const karts = new Map<string, Kart>([
    ["A", { position: { x: 0, y: 0, z: 0 } }],
    ["B", { position: { x: 0, y: 0, z: 60 } }],
    ["C", { position: { x: 30, y: 0, z: 100 } }],
  ]);
  const camera = new PerspectiveCamera();
  camera.position.set(0, 3, -6);
  camera.lookAt(0, 0, 10);
  camera.updateMatrixWorld(true);
  const frame = (nowMs: number): ItemPresenterFrame => ({
    nowMs, camera, width: 1600, height: 900, localPlayerId: "A",
    pose: id => { const kart = karts.get(id); return kart ? pose(kart) : undefined; },
  });
  const at = (nowMs: number) => presenter.update(frame(nowMs));
  return { ...h, presenter, karts, at, frame };
}

interface Shown { model: string; position: [number, number, number]; scale: number; forward: [number, number, number] }

/** Visible copies, by model key, with their world placement. */
function shown(presenter: ItemRacePresenterImpl<string>): Shown[] {
  const result: Shown[] = [];
  for (const mount of presenter.object.children) {
    if (!mount.visible) continue;
    const e = mount.matrix.elements;
    result.push({
      model: mount.name.replace(/^itemFx:/, "").replace(/#\d+$/, ""),
      position: [e[12]!, e[13]!, e[14]!],
      scale: Math.hypot(e[0]!, e[1]!, e[2]!),
      forward: [e[8]!, e[9]!, e[10]!],
    });
  }
  return result;
}

const models = (presenter: ItemRacePresenterImpl<string>) => shown(presenter).map(entry => entry.model).sort();
const near = (a: number, b: number, epsilon = 1e-6) => Math.abs(a - b) <= epsilon;
const nearVec = (a: readonly number[], b: readonly number[], epsilon = 1e-6) =>
  a.length === b.length && a.every((value, index) => near(value, b[index]!, epsilon));
const flush = () => new Promise(resolve => setImmediate(resolve));

test("loading assembles one copy of every model and decodes every sound", async () => {
  const { presenter, builds, played } = await setup();
  const copies = presenter.plan.models.reduce((total, model) =>
    total + (model.preload ?? ITEM_FX_TUNING.preloadInstances), 0);
  assert.equal(builds.length, copies);
  assert.equal(new Set(builds).size, new Set(presenter.plan.models.map(model => model.path)).size);
  assert.equal(presenter.audio.buffers.size, presenter.plan.sounds.length);
  assert.equal(presenter.object.children.length, copies);
  assert.ok(presenter.object.children.every(mount => !mount.visible));
  assert.equal(played.length, 0);
});

test("a missile homes in on a moving target on a slight arc and explodes on the hit", async () => {
  const { presenter, karts, at, played } = await setup();
  presenter.used({ useId: 1, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 1000, etaMs: 800 });
  at(1000);
  let [missile] = shown(presenter);
  assert.equal(missile?.model, "item/rocket/item01.1s");
  assert.ok(nearVec(missile!.position, [0, ITEM_FX_TUNING.projectileLiftM, 0]));
  assert.deepEqual(played.map(sound => sound.path), ["sound_/fx/item/rocket/shooting.ogg"]);
  assert.equal(played[0]!.volume, 1, "the local racer's own sound is not attenuated");

  // Half way, the target has moved: the missile re-aims at its current pose.
  karts.get("B")!.position = { x: 10, y: 0, z: 70 };
  at(1400);
  [missile] = shown(presenter);
  assert.ok(nearVec(missile!.position, [5, 1 + ITEM_FX_TUNING.rocketArcM, 35]));
  // The nose follows the flight: level at the top of the arc, toward the target.
  assert.ok(near(missile!.forward[1], 0) && missile!.forward[0] > 0 && missile!.forward[2] > 0);

  at(1800);
  [missile] = shown(presenter);
  assert.ok(nearVec(missile!.position, [10, 1, 70]));
  // Arrived before the report: it waits on the target.
  at(2000);
  assert.deepEqual(models(presenter), ["item/rocket/item01.1s"]);

  presenter.hit({ useId: 1, itemId: ItemIdx.rocket, victimId: "B", userId: "A", result: "hit", atMs: 2000 });
  // A repeated delivery of the use or the hit changes nothing.
  presenter.hit({ useId: 1, itemId: ItemIdx.rocket, victimId: "B", userId: "A", result: "hit", atMs: 2000 });
  presenter.used({ useId: 1, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 1000, etaMs: 800 });
  at(2016);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s"]);
  assert.ok(nearVec(shown(presenter)[0]!.position, [10, 0, 70]));
  assert.equal(played.at(-1)!.path, "sound_/fx/item/rocket/exploding.ogg");
  assert.ok(played.at(-1)!.volume < 1, "a remote victim's explosion is quieter");
  at(3499);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s"]);
  at(3500);
  assert.deepEqual(models(presenter), []);
});

test("a missile with no target flies straight ahead for Use.life; one that is never reported vanishes", async () => {
  const { presenter, karts, at } = await setup();
  karts.get("A")!.forward = { x: 1, y: 0, z: 0 };
  presenter.used({ useId: 2, itemId: ItemIdx.guideRocket, userId: "A", targets: [], startMs: 500, etaMs: 0 });
  at(500);
  at(1500);
  const [missile] = shown(presenter);
  assert.ok(nearVec(missile!.position, [100, 1, 0]), JSON.stringify(missile));
  assert.ok(nearVec(missile!.forward, [1, 0, 0]));
  at(2000);
  assert.deepEqual(models(presenter), []);

  presenter.used({ useId: 3, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 3000, etaMs: 500 });
  at(3000);
  at(3500 + ITEM_FX_TUNING.projectileHoldMs - 1);
  assert.deepEqual(models(presenter), ["item/rocket/item01.1s"]);
  at(3500 + ITEM_FX_TUNING.projectileHoldMs);
  assert.deepEqual(models(presenter), []);
});

test("a blocked attack shows the item's shield block; escape immunity shows nothing", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 4, itemId: ItemIdx.waterFly, userId: "A", targets: ["B"], startMs: 0, etaMs: 1000 });
  at(10);
  assert.deepEqual(models(presenter), ["item/waterFly/item00.1s"]);
  presenter.hit({ useId: 4, itemId: ItemIdx.waterFly, victimId: "B", result: "blocked", by: "shield", atMs: 1000 });
  at(1000);
  assert.deepEqual(models(presenter), ["item/common/쉴드방어.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/waterFly/shield.ogg");
  at(2000);
  assert.deepEqual(models(presenter), []);

  presenter.used({ useId: 5, itemId: ItemIdx.rocket, userId: "B", targets: ["A"], startMs: 3000, etaMs: 400 });
  presenter.hit({ useId: 5, itemId: ItemIdx.rocket, victimId: "A", result: "blocked", by: "escape", atMs: 3400 });
  const count = played.length;
  at(3400);
  assert.deepEqual(models(presenter), []);
  assert.equal(played.length, count, "the use was too late to sound and the escape is silent");
});

test("late events start part-way: the animation is anchored to the server timeline", async () => {
  const { presenter, at, scenes } = await setup();
  at(5000);
  presenter.used({ useId: 6, itemId: ItemIdx.cloud2, userId: "B", targets: ["A"], startMs: 4800, etaMs: 0 });
  at(5016);
  const cloud = scenes.find(scene => scene.path === "item/cloud2/무지개구름_사용.1s")!;
  assert.deepEqual(cloud.resets, [4800]);
  assert.deepEqual(cloud.updates, [5016]);
  at(4800 + 666);
  assert.deepEqual(models(presenter), []);
});

test("a cloud blocked on my kart never sounds its removal; one that covers me does", async () => {
  const { presenter, at, played } = await setup();
  const { coverMs } = presenter.plan.items.get(ItemIdx.cloud2) as CloudFx;
  const removals = () => played.filter(sound => sound.path.endsWith("cloud2/disappear.ogg")).length;
  // My kart sits in a water bubble (escape immunity): no cover, so no removal either.
  presenter.used({ useId: 60, itemId: ItemIdx.cloud2, userId: "B", targets: ["A"], startMs: 0, etaMs: 0 });
  at(0);
  presenter.hit({ useId: 60, itemId: ItemIdx.cloud2, victimId: "A", userId: "B", result: "blocked", by: "escape",
    atMs: 500 });
  at(coverMs);
  at(coverMs + 16);
  assert.equal(removals(), 0);

  presenter.used({ useId: 61, itemId: ItemIdx.cloud2, userId: "B", targets: ["A"], startMs: 20_000, etaMs: 0 });
  at(20_000);
  presenter.hit({ useId: 61, itemId: ItemIdx.cloud2, victimId: "A", userId: "B", result: "hit", atMs: 20_500 });
  at(20_000 + coverMs);
  assert.equal(removals(), 1);
});

test("bananas are tossed behind the kart, lie for Set.life and go when run over", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 7, itemId: ItemIdx.banana, userId: "A", targets: [], startMs: 100, etaMs: 0,
    point: { x: 0, y: 0, z: -4 } });
  at(100);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/banana/firing.ogg");
  at(350);
  let [peel] = shown(presenter);
  assert.equal(peel!.model, "item/banana/item00.1s");
  assert.ok(nearVec(peel!.position, [0, 0, -2]), "half way to the drop point");
  assert.ok(nearVec(peel!.forward, [0, 0, -1]), "facing where it flies");
  at(600);
  [peel] = shown(presenter);
  assert.equal(peel!.model, "item/banana/item01.1s");
  assert.ok(nearVec(peel!.position, [0, 0, -4]));
  at(20_000);
  assert.deepEqual(models(presenter), ["item/banana/item01.1s"]);
  presenter.hit({ useId: 7, itemId: ItemIdx.banana, victimId: "B", result: "hit", atMs: 20_000 });
  presenter.removed(7);
  at(20_016);
  assert.deepEqual(models(presenter), []);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/banana/trapped.ogg");
});

test("a water bomb flies to its point and bursts there; the bubble follows the trapping item", async () => {
  const { presenter, at, played } = await setup();
  const point = { x: 0, y: 0, z: 40 };
  presenter.used({ useId: 8, itemId: ItemIdx.waterBomb, userId: "A", targets: [], startMs: 0, etaMs: 0, point });
  at(1);
  at(500);
  assert.ok(nearVec(shown(presenter)[0]!.position, [0, 0, 20], 0.05));
  at(1000);
  const [burst] = shown(presenter);
  assert.equal(burst!.model, "item/waterBomb/item01.1s");
  assert.ok(nearVec(burst!.position, [0, 0, 40]));
  assert.equal(played.at(-1)!.path, "sound_/fx/item/waterBomb/set.ogg");
  presenter.hit({ useId: 8, itemId: ItemIdx.waterBomb, victimId: "B", result: "hit", atMs: 1000 });
  presenter.kartEffect("B", "trap", 1000, 2000);
  at(1016);
  assert.deepEqual(models(presenter), ["item/common/물방울갇힘_일반.1s", "item/waterBomb/item01.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/waterBomb/trapped.ogg");
  // Mashing left/right ends the bubble early, then the blue shield.
  presenter.endKartEffect("B", "trap");
  presenter.kartEffect("B", "escapeShield", 1016, 2000);
  at(1032);
  assert.deepEqual(models(presenter), ["item/common/파란방패.1s", "item/waterBomb/item01.1s"]);
  assert.ok(nearVec(shown(presenter).find(entry => entry.model.includes("파란방패"))!.position, [0, 0, 60]));
  at(3016);
  assert.deepEqual(models(presenter), []);

  // A water fly's victim is wrapped in the water fly's own bubble.
  presenter.used({ useId: 9, itemId: ItemIdx.waterFly, userId: "A", targets: ["B"], startMs: 4000, etaMs: 600 });
  presenter.hit({ useId: 9, itemId: ItemIdx.waterFly, victimId: "B", result: "hit", atMs: 4600 });
  presenter.kartEffect("B", "trap", 4600, 1000);
  at(4600);
  assert.deepEqual(models(presenter), ["item/waterFly/fired01.1s", "item/waterFly/item01.1s"]);
});

test("a time bomb rides on the user, ticks faster, and bursts where it was placed", async () => {
  const { presenter, karts, at, played } = await setup();
  presenter.used({ useId: 10, itemId: ItemIdx.timeBomb, userId: "A", targets: [], startMs: 0, etaMs: 0 });
  presenter.kartEffect("A", "timeBomb", 0, 3000);
  at(1);
  assert.equal(played.filter(sound => sound.path.endsWith("timeBomb/firing.ogg")).length, 1);
  const scales: number[] = [];
  for (let now = 1; now < 3000; now += 20) {
    karts.get("A")!.position = { x: now / 100, y: 0, z: 0 };
    at(now);
    const [balloon] = shown(presenter);
    assert.equal(balloon!.model, "item/waterBomb/item00.1s#carriedBalloon");
    assert.ok(nearVec(balloon!.position, [now / 100, ITEM_FX_TUNING.timeBombLiftM, 0]));
    scales.push(balloon!.scale);
  }
  assert.ok(Math.max(...scales) > 1.1 && Math.min(...scales) === 1, "the balloon pulses");
  at(3000);
  let [burst] = shown(presenter);
  assert.equal(burst!.model, "item/common/물방울터짐.1s");
  assert.ok(nearVec(burst!.position, [karts.get("A")!.position.x, 0, 0]), "where the user is until placed");
  assert.equal(played.at(-1)!.path, "sound_/fx/item/timeBomb/set.ogg");
  presenter.placed({ useId: 10, itemId: ItemIdx.timeBomb, userId: "A", point: { x: 5, y: 0, z: 5 }, startMs: 0 });
  at(3050);
  [burst] = shown(presenter);
  assert.ok(nearVec(burst!.position, [5, 0, 5]));
  at(4000);
  assert.deepEqual(models(presenter), []);
});

test("a barricade is thrown, falls ahead of its target, stands, and breaks when hit", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 11, itemId: ItemIdx.barricade, userId: "A", targets: ["C"], startMs: 0, etaMs: 0 });
  at(1);
  assert.deepEqual(models(presenter), ["item/barricade/바리게이트_사용.1s"]);
  assert.equal(played.at(-1)!.path.split("/").at(-1), "장애물 발사.ogg");
  presenter.placed({ useId: 11, itemId: ItemIdx.barricade, userId: "C", point: { x: 30, y: 0, z: 120 }, startMs: 0 });
  at(1000);
  let [wall] = shown(presenter);
  assert.equal(wall!.model, "item/barricade/바리게이트_시작.1s");
  assert.ok(nearVec(wall!.position, [30, 0, 120]));
  assert.ok(nearVec(wall!.forward, [0, 0, 1]), "across the target's road");
  assert.equal(played.at(-1)!.path.split("/").at(-1), "장애물 등장.ogg");
  at(1266);
  assert.deepEqual(models(presenter), ["item/barricade/바리게이트_진행.1s"]);
  presenter.hit({ useId: 11, itemId: ItemIdx.barricade, victimId: "C", result: "hit", atMs: 3000 });
  at(3000);
  assert.deepEqual(models(presenter), ["item/barricade/바리게이트_끝.1s"]);
  assert.equal(played.at(-1)!.path.split("/").at(-1), "장애물 피격.ogg");
  at(3500);
  assert.deepEqual(models(presenter), []);

  // Unhit, it stands for StateActive.life, then breaks by itself.
  presenter.used({ useId: 12, itemId: ItemIdx.barricade, userId: "A", targets: ["B"], startMs: 10_000, etaMs: 0 });
  presenter.placed({ useId: 12, itemId: ItemIdx.barricade, userId: "B", point: { x: 0, y: 0, z: 130 }, startMs: 10_000 });
  at(16_265);
  assert.deepEqual(models(presenter), ["item/barricade/바리게이트_진행.1s"]);
  at(16_266);
  assert.deepEqual(models(presenter), ["item/barricade/바리게이트_끝.1s"]);
});

test("the UFO departs from its user, arrives over the leader, hovers while it slows and leaves", async () => {
  const { presenter, at, played, scenes } = await setup();
  presenter.used({ useId: 13, itemId: ItemIdx.ufo, userId: "A", targets: ["B"], startMs: 2000, etaMs: 900 });
  at(2000);
  assert.deepEqual(models(presenter), ["item/ufo/fired00.1s", "item/ufo/firing00.1s"]);
  // The approach's 1500 ms animation ends at the arrival.
  assert.deepEqual(scenes.find(scene => scene.path === "item/ufo/fired00.1s")!.resets, [2000 + 900 - 1500]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/ufo/using.ogg");
  presenter.hit({ useId: 13, itemId: ItemIdx.ufo, victimId: "B", result: "hit", atMs: 2900 });
  presenter.kartEffect("B", "slow", 2900, 3000);
  at(2900);
  assert.deepEqual(models(presenter), ["item/ufo/fired01.1s", "item/ufo/firing00.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/ufo/affecting.ogg");
  // An EMP ends it early: the UFO leaves now.
  at(4000);
  presenter.endKartEffect("B", "slow");
  at(4016);
  assert.deepEqual(models(presenter), ["item/ufo/fired02.1s"]);
  at(4500);
  assert.deepEqual(models(presenter), []);
});

test("thunderbolt warns and strikes every target; a blocked target sees the defence instead", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 14, itemId: ItemIdx.thunderbolt, userId: "A", targets: ["B", "C"], startMs: 0, etaMs: 0 });
  // The second warning and strike copies are assembled as soon as the use is known.
  await flush();
  at(1);
  assert.deepEqual(models(presenter), ["item/thunderbolt/벼락_던짐.1s"]);
  at(500);
  assert.deepEqual(models(presenter), ["item/thunderbolt/벼락_예고.1s", "item/thunderbolt/벼락_예고.1s"]);
  presenter.hit({ useId: 14, itemId: ItemIdx.thunderbolt, victimId: "C", result: "blocked", by: "angel", atMs: 600 });
  at(1500);
  assert.deepEqual(models(presenter), ["item/thunderbolt/벼락_방어.1s", "item/thunderbolt/벼락_피격.1s"]);
  assert.ok(nearVec(shown(presenter).find(entry => entry.model.endsWith("벼락_피격.1s"))!.position, [0, 0, 60]));
  presenter.hit({ useId: 14, itemId: ItemIdx.thunderbolt, victimId: "B", result: "hit", atMs: 2100 });
  presenter.kartEffect("B", "shrink", 2100, 1500);
  at(2100);
  assert.deepEqual(models(presenter), ["item/thunderbolt/벼락_피격진행.1s"]);
  const names = played.map(sound => sound.path.split("/").at(-1));
  // The throw, a warning on each target, then only B's strike and hit.
  assert.deepEqual(names.filter(name => name?.startsWith("벼락")), ["벼락_사용.ogg", "벼락_사용.ogg",
    "벼락_사용.ogg", "벼락_발동.ogg", "벼락_피격.ogg"]);
  at(3600);
  assert.deepEqual(models(presenter), []);
});

test("devil: warning on every opponent, its curse while reversed, then the escape", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 15, itemId: ItemIdx.devil, userId: "B", targets: ["A", "C"], startMs: 0, etaMs: 0 });
  await flush();
  at(1);
  assert.deepEqual(models(presenter), ["item/devil/firing00.1s"]);
  at(500);
  assert.deepEqual(models(presenter), ["item/devil/fired01.1s", "item/devil/fired01.1s"]);
  const curses = played.filter(sound => sound.path.endsWith("devil/affecting.ogg"));
  assert.deepEqual(curses.map(sound => sound.volume < 1), [false, true], "mine is loud, C's far away");
  presenter.kartEffect("A", "reverse", 1500, 3000);
  at(1500);
  assert.deepEqual(models(presenter), ["item/devil/fired02.1s"]);
  at(4500);
  assert.deepEqual(models(presenter), ["item/devil/fired03.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/waterBomb/trapped.ogg");
  at(6500);
  assert.deepEqual(models(presenter), []);
});

test("self items keep one visual per kart however often they are started; angel covers the team", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 16, itemId: ItemIdx.shield, userId: "A", targets: ["A"], startMs: 0, etaMs: 0 });
  presenter.kartEffect("A", "shield", 5, 2000);
  at(10);
  assert.deepEqual(models(presenter), ["item/shield/firing00.1s"]);
  at(2004);
  assert.deepEqual(models(presenter), ["item/shield/firing00.1s"], "the later start moved the end");
  presenter.endKartEffect("A", "shield");
  at(2010);
  assert.deepEqual(models(presenter), [], "consumed by a block");

  presenter.used({ useId: 17, itemId: ItemIdx.angel, userId: "A", targets: ["A", "C"], startMs: 3000, etaMs: 0 });
  presenter.kartEffect("C", "angel", 3000, 4000);
  at(3000);
  assert.deepEqual(models(presenter), ["item/angel/fired01.1s", "item/angel/fired01.1s"]);
  const angelSounds = played.filter(sound => sound.path.includes("/angel/")).map(sound => sound.path.split("/").at(-1));
  assert.deepEqual(angelSounds.sort(), ["affecting.ogg", "affecting.ogg", "using.ogg"]);
  at(7000);
  assert.deepEqual(models(presenter), []);

  presenter.used({ useId: 18, itemId: ItemIdx.emp, userId: "B", targets: ["B"], startMs: 8000, etaMs: 0 });
  presenter.used({ useId: 19, itemId: ItemIdx.scanning, userId: "A", targets: ["A", "C"], startMs: 8000, etaMs: 0 });
  presenter.used({ useId: 20, itemId: ItemIdx.slotLock, userId: "A", targets: ["B", "C"], startMs: 8000, etaMs: 0 });
  presenter.used({ useId: 21, itemId: ItemIdx.booster, userId: "A", targets: ["A"], startMs: 8000, etaMs: 0 });
  await flush();
  at(8000);
  assert.deepEqual(models(presenter), ["item/emp/fired01.1s", "item/scanning/fired01.1s",
    "item/slotLock/firing00.1s"]);
  at(10_000);
  assert.deepEqual(models(presenter), ["item/scanning/fired01.1s", "item/slotLock/fired.1s",
    "item/slotLock/fired.1s"]);
});

test("the magnet field points at its target and ends with the pull", async () => {
  const { presenter, at } = await setup();
  presenter.used({ useId: 22, itemId: ItemIdx.magnet, userId: "A", targets: ["C"], startMs: 0, etaMs: 0 });
  presenter.kartEffect("A", "pull", 0, 3000);
  at(100);
  const [field] = shown(presenter);
  assert.equal(field!.model, "item/magnet/item01.1s");
  const toC = [30 / Math.hypot(30, 100), 0, 100 / Math.hypot(30, 100)];
  assert.ok(nearVec(field!.forward, toC));
  presenter.endKartEffect("A", "pull");
  at(116);
  assert.deepEqual(models(presenter), []);
});

test("spin, launch and barrier add nothing; track hazards show their hit", async () => {
  const { presenter, at, played } = await setup();
  for (const kind of ["spin", "launch", "barrier"] as const) presenter.kartEffect("B", kind, 0, 1500);
  at(10);
  assert.deepEqual(models(presenter), []);
  presenter.hit({ useId: 0, itemId: ItemIdx.mine, victimId: "B", result: "hit", atMs: 100 });
  presenter.hit({ useId: 0, itemId: ItemIdx.waterMine, victimId: "A", result: "hit", atMs: 100,
    position: { x: 3, y: 0, z: 4 } });
  at(100);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s", "item/waterMine/item03.1s"]);
  assert.ok(nearVec(shown(presenter).find(entry => entry.model.includes("waterMine"))!.position, [3, 0, 4]));
  assert.deepEqual(played.map(sound => sound.path.split("fx/item/")[1]).sort(),
    ["mine/exploding.ogg", "waterMine/set.ogg", "waterMine/trapped.ogg"]);
});

test("positional sounds fade with distance from the camera and pan toward their side", async () => {
  const { presenter, karts, at, played } = await setup();
  at(0);
  presenter.sound(ItemIdx.rocket, "shield", { position: { x: 10, y: 0, z: 30 } });
  presenter.sound(ItemIdx.rocket, "shield", { position: { x: 0, y: 0, z: 500 } });
  presenter.sound(ItemIdx.rocket, "aiming", { key: "aim", loop: true });
  presenter.sound(ItemIdx.rocket, "no such stem");
  at(16);
  assert.equal(played.length, 2, "the far sound is silent, the unknown stem is ignored");
  const [side, aim] = played;
  const distance = Math.hypot(10, 3, 36);
  assert.ok(near(side!.volume, 1 - (distance - ITEM_FX_TUNING.soundNearM) /
    (ITEM_FX_TUNING.soundFarM - ITEM_FX_TUNING.soundNearM)));
  // The camera looks along +z from behind; +x is its left (three.js right is -x here).
  assert.ok(side!.pan < 0);
  assert.deepEqual([aim!.path, aim!.loop, aim!.volume], ["sound_/fx/item/rocket/aiming.ogg", true, 1]);
  // Replacing a keyed loop stops the previous one; stopSound stops it.
  presenter.sound(ItemIdx.rocket, "inrange", { key: "aim", loop: true });
  assert.ok(aim!.source.stopped);
  at(32);
  presenter.stopSound("aim");
  assert.ok(played.at(-1)!.source.stopped);
  assert.equal(presenter.audio.playing.size, 1);
  // Sounds are bounded: past the cap the oldest one-shot stops.
  for (let index = 0; index < ITEM_FX_TUNING.maxSounds + 3; index += 1)
    presenter.sound(ItemIdx.rocket, "shield");
  at(48);
  assert.equal(presenter.audio.playing.size, ITEM_FX_TUNING.maxSounds);
  assert.ok(side!.source.stopped, "the oldest one-shot made room");
  // A sound far behind schedule (an event after a stall) is dropped.
  presenter.used({ useId: 30, itemId: ItemIdx.rocket, userId: "A", targets: [], startMs: 0, etaMs: 0 });
  const before = played.length;
  at(1000);
  assert.equal(played.length, before);
  karts.clear();
});

test("copies are assembled as soon as overlapping visuals are scheduled, up to the cap", async () => {
  const { presenter, at, karts, hold, releaseBuilds } = await setup();
  for (let index = 0; index < 10; index += 1) karts.set(`R${index}`, { position: { x: index * 5, y: 0, z: 0 } });
  const pool = presenter.models.pools.get("item/common/미사일폭발.1s")!;
  assert.equal(pool.instances.length, ITEM_FX_TUNING.preloadShared);
  hold(true);
  for (let index = 0; index < 10; index += 1)
    presenter.hit({ useId: 0, itemId: ItemIdx.mine, victimId: `R${index}`, result: "hit", atMs: 100 });
  assert.equal(pool.building, ITEM_FX_TUNING.maxInstances - ITEM_FX_TUNING.preloadShared);
  at(100);
  assert.equal(models(presenter).length, ITEM_FX_TUNING.preloadShared, "the preloaded copies show at once");
  hold(false);
  releaseBuilds();
  await flush();
  assert.equal(pool.instances.length, ITEM_FX_TUNING.maxInstances);
  assert.equal(pool.building, 0);
  at(116);
  // At the cap the extra explosions take over the copies of the ones ending first.
  assert.equal(models(presenter).length, ITEM_FX_TUNING.maxInstances);
  assert.equal(presenter.visuals.length, ITEM_FX_TUNING.maxInstances);
  at(1600);
  assert.equal(models(presenter).length, 0);
  assert.equal(pool.instances.length, ITEM_FX_TUNING.maxInstances, "copies are kept for later uses");
});

test("reset forgets everything; dispose releases scenes and sounds", async () => {
  const { presenter, at, scenes, played } = await setup();
  const track = new Group();
  track.add(presenter.object);
  presenter.used({ useId: 40, itemId: ItemIdx.banana, userId: "A", targets: [], startMs: 0, etaMs: 0,
    point: { x: 0, y: 0, z: -4 } });
  presenter.sound(ItemIdx.magnet, "aiming", { key: "aim", loop: true });
  at(1000);
  assert.deepEqual(models(presenter), ["item/banana/item01.1s"]);
  presenter.reset();
  at(1016);
  assert.deepEqual(models(presenter), []);
  assert.ok(played.every(sound => sound.source.stopped || sound.loop === false));
  presenter.used({ useId: 41, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 2000, etaMs: 500 });
  at(2000);
  assert.deepEqual(models(presenter), ["item/rocket/item01.1s"]);
  presenter.dispose();
  assert.equal(presenter.object.parent, null);
  assert.ok(scenes.every(scene => scene.disposed));
  presenter.used({ useId: 42, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 3000, etaMs: 500 });
  at(3000);
  presenter.dispose();
});
