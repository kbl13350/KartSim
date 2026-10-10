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
import { SPECIAL_ITEM_ROWS, withSpecialItems } from "./item-special-fixture";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

/**
 * Event sequences against the real item data, with fake scenes, a fake
 * audio context, a fake clock and fake kart poses: which model shows where
 * and when, and which sound plays.
 */

let catalogLoad: Promise<ItemCatalog> | undefined;
/** The classic set plus every special item of ITEM_MODE.md C.4, on the real data. */
const catalog = () => catalogLoad ??= loadMirrorLibrary(ITEM_CONTAINERS)
  .then(async library => withSpecialItems(await loadItemCatalog(library), library));
/** Original bytes for the item.bml files the presenter reads at load (the balloon's states). */
const originalBytes = async (path: string) =>
  (await loadMirrorLibrary(ITEM_CONTAINERS)).exactCanonicalCandidates(path)[0]!.bytes();

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
    originalAsset: (_archive, path) => ({ bytes: async () => path.endsWith(".bml") ? originalBytes(path) : path }),
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

  // The angel covers the team from its Affect state on, after the 500 ms Use (ITEM_MODE.md C.5).
  presenter.used({ useId: 17, itemId: ItemIdx.angel, userId: "A", targets: ["A", "C"], startMs: 3000, etaMs: 0 });
  presenter.kartEffect("C", "angel", 3500, 4000);
  at(3000);
  assert.deepEqual(models(presenter), []);
  at(3500);
  assert.deepEqual(models(presenter), ["item/angel/fired01.1s", "item/angel/fired01.1s"]);
  const angelSounds = played.filter(sound => sound.path.includes("/angel/")).map(sound => sound.path.split("/").at(-1));
  assert.deepEqual(angelSounds.sort(), ["affecting.ogg", "affecting.ogg", "using.ogg"]);
  at(7500);
  assert.deepEqual(models(presenter), []);

  // EMP shows only on the racers it frees from a UFO (the controller's kartEffect).
  presenter.used({ useId: 18, itemId: ItemIdx.emp, userId: "B", targets: ["B"], startMs: 8000, etaMs: 0 });
  presenter.used({ useId: 19, itemId: ItemIdx.scanning, userId: "A", targets: ["A", "C"], startMs: 8000, etaMs: 0 });
  presenter.used({ useId: 20, itemId: ItemIdx.slotLock, userId: "A", targets: ["B", "C"], startMs: 8000, etaMs: 0 });
  presenter.used({ useId: 21, itemId: ItemIdx.booster, userId: "A", targets: ["A"], startMs: 8000, etaMs: 0 });
  await flush();
  at(8000);
  assert.deepEqual(models(presenter), ["item/slotLock/firing00.1s"]);
  assert.ok(played.some(sound => sound.path === "sound_/fx/item/emp/using.ogg"));
  presenter.kartEffect("C", "emp", 8500, 1500);
  at(8500);
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

test("my own magnet field turns to the locked target once the use names it", async () => {
  const { presenter, at } = await setup();
  const toC = [30 / Math.hypot(30, 100), 0, 100 / Math.hypot(30, 100)];
  // The physics pull starts at the release, a round trip before the reply.
  presenter.kartEffect("A", "pull", 0, 3000);
  at(16);
  assert.ok(nearVec(shown(presenter)[0]!.forward, [0, 0, 1]));
  presenter.used({ useId: 22, itemId: ItemIdx.magnet, userId: "A", targets: ["C"], startMs: 40, etaMs: 0 });
  at(100);
  const fields = shown(presenter);
  assert.deepEqual(fields.map(entry => entry.model), ["item/magnet/item01.1s"]);
  assert.ok(nearVec(fields[0]!.forward, toC), JSON.stringify(fields[0]));
  // A pull started with its target faces it at once, and a restart without one keeps it.
  at(4000);
  presenter.kartEffect("A", "pull", 5000, 3000, { target: "C" });
  presenter.kartEffect("A", "pull", 5010, 3000);
  at(5016);
  assert.ok(nearVec(shown(presenter)[0]!.forward, toC));
});

test("a self effect the controller already ended is not brought back by the late use reply", async () => {
  const { presenter, at } = await setup();
  const balloon = "item/waterBomb/item00.1s#carriedBalloon";
  // A shield pressed at the last moment blocks a missile before its reply arrives.
  at(992);
  presenter.kartEffect("A", "shield", 992, 2000);
  at(1008);
  assert.deepEqual(models(presenter), ["item/shield/firing00.1s"]);
  presenter.endKartEffect("A", "shield");
  at(1024);
  assert.deepEqual(models(presenter), []);
  presenter.used({ useId: 9, itemId: ItemIdx.shield, userId: "A", targets: [], startMs: 1040, etaMs: 0 });
  at(1104);
  assert.deepEqual(models(presenter), [], "the spent shield stays gone");
  at(2500);
  assert.deepEqual(models(presenter), []);

  // A time bomb whose balloon the end of my race removed, and a pull that arrived early.
  presenter.kartEffect("A", "timeBomb", 3000, 3000);
  presenter.kartEffect("A", "pull", 3000, 3000);
  at(3016);
  assert.deepEqual(models(presenter), ["item/magnet/item01.1s", balloon]);
  presenter.endKartEffect("A", "timeBomb");
  presenter.endKartEffect("A", "pull");
  at(3032);
  presenter.used({ useId: 10, itemId: ItemIdx.timeBomb, userId: "A", targets: [], startMs: 3040, etaMs: 0 });
  presenter.used({ useId: 11, itemId: ItemIdx.magnet, userId: "A", targets: ["C"], startMs: 3040, etaMs: 0 });
  at(3100);
  assert.deepEqual(models(presenter), []);

  // The next press starts the shield again, and its reply keeps that one visual.
  presenter.kartEffect("A", "shield", 8000, 2000);
  presenter.used({ useId: 12, itemId: ItemIdx.shield, userId: "A", targets: [], startMs: 8050, etaMs: 0 });
  at(8100);
  assert.deepEqual(models(presenter), ["item/shield/firing00.1s"]);
  at(10_100);
  assert.deepEqual(models(presenter), []);

  // A remote racer's next shield shows from its use alone.
  presenter.used({ useId: 13, itemId: ItemIdx.shield, userId: "B", targets: [], startMs: 11_000, etaMs: 0 });
  at(11_016);
  presenter.endKartEffect("B", "shield");
  at(11_032);
  assert.deepEqual(models(presenter), []);
  presenter.used({ useId: 14, itemId: ItemIdx.shield, userId: "B", targets: [], startMs: 11_100, etaMs: 0 });
  at(11_116);
  assert.deepEqual(models(presenter), ["item/shield/firing00.1s"]);
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

test("a visual whose copy was taken over this frame does not take another one", async () => {
  const { presenter, at } = await setup();
  const pool = presenter.models.pools.get("item/common/미사일폭발.1s")!;
  // Listed first but due later; the others end in reverse list order.
  presenter.show("late", pool.model, 1000, 1000, 3000, () => true);
  for (let index = 1; index <= ITEM_FX_TUNING.maxInstances; index += 1)
    presenter.show(`early:${index}`, pool.model, 0, 0, 10_000 - index * 1000, () => true);
  await flush();
  assert.equal(pool.instances.length, ITEM_FX_TUNING.maxInstances);
  at(0);
  assert.equal(models(presenter).length, ITEM_FX_TUNING.maxInstances);
  // The late one takes the copy of the last-listed one, which ends first.
  at(1000);
  assert.equal(models(presenter).length, ITEM_FX_TUNING.maxInstances);
  assert.equal(presenter.visuals.length, ITEM_FX_TUNING.maxInstances);
  assert.ok(presenter.visuals.every(visual => visual.instance));
  at(10_000);
  assert.deepEqual(models(presenter), []);
  assert.ok(pool.instances.every(instance => !instance.busy), "every copy is free again");
});

test("every banana lying on the track shows for its whole Set.life", async () => {
  const { presenter, at } = await setup();
  const users = ["A", "B", "C"];
  for (let index = 0; index < 9; index += 1) {
    presenter.used({ useId: 50 + index, itemId: ItemIdx.banana, userId: users[index % 3]!, targets: [],
      startMs: index * 2000, etaMs: 0, point: { x: 10 * (index + 1), y: 0, z: 0 } });
    await flush();
    at(index * 2000 + 600);
  }
  at(17_000);
  const peels = shown(presenter).filter(entry => entry.model === "item/banana/item01.1s");
  assert.deepEqual(peels.map(entry => entry.position[0]).sort((a, b) => a - b),
    [10, 20, 30, 40, 50, 60, 70, 80, 90]);
});

test("at the placed-object cap a new banana waits for a copy instead of hiding a live one", async () => {
  const { presenter, at } = await setup();
  const cap = ITEM_FX_TUNING.placedMaxInstances;
  assert.ok(cap > ITEM_FX_TUNING.maxInstances);
  for (let index = 0; index <= cap; index += 1) {
    presenter.used({ useId: 100 + index, itemId: ItemIdx.banana, userId: "B", targets: [], startMs: index,
      etaMs: 0, point: { x: index, y: 0, z: 0 } });
  }
  await flush();
  at(cap + 600);
  const peels = () => shown(presenter).filter(entry => entry.model === "item/banana/item01.1s")
    .map(entry => entry.position[0]);
  assert.equal(peels().length, cap);
  assert.ok(!peels().includes(cap), "the newest waits");
  assert.ok(peels().includes(0), "the oldest is still on the track");
  // One is run over: the waiting banana takes its copy.
  presenter.removed(100);
  at(cap + 616);
  assert.equal(peels().length, cap);
  assert.ok(peels().includes(cap) && !peels().includes(0));
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

// ---- phase 3: special items, hit variants, new kart effects (ITEM_MODE.md C.2, C.4) ----

test("every special item has a staging from its own folder and variant", async () => {
  const { presenter, at } = await setup();
  for (const row of SPECIAL_ITEM_ROWS) assert.ok(presenter.plan.items.get(row.idx), `${row.idx} ${row.name}`);
  // A use, hit and the end of each one never throws.
  let useId = 900;
  for (const row of SPECIAL_ITEM_ROWS) {
    presenter.used({ useId, itemId: row.idx, userId: "A", targets: ["B"], startMs: 0, etaMs: 800,
      point: { x: 0, y: 0, z: 30 } });
    presenter.hit({ useId, itemId: row.idx, victimId: "B", result: "hit", atMs: 800 });
    useId += 1;
  }
  for (const time of [0, 400, 800, 2000, 5000, 40_000]) at(time);
});

test("two missiles of one use fly 200 ms apart and each hit spends its own (useTwoRocket)", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 30, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 1000, etaMs: 800,
    count: 2 });
  await flush();
  at(1000);
  assert.deepEqual(models(presenter), ["item/rocket/item01.1s"]);
  at(1200);
  assert.deepEqual(models(presenter), ["item/rocket/item01.1s", "item/rocket/item01.1s"]);
  assert.equal(played.filter(sound => sound.path.endsWith("rocket/shooting.ogg")).length, 2);
  presenter.hit({ useId: 30, itemId: ItemIdx.rocket, victimId: "B", result: "hit", atMs: 1800, shot: 0 });
  at(1800);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s", "item/rocket/item01.1s"]);
  // The second missile is blocked by a shield the first did not break.
  presenter.hit({ useId: 30, itemId: ItemIdx.rocket, victimId: "B", result: "blocked", by: "shield",
    atMs: 2000, shot: 1 });
  at(2000);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s", "item/common/쉴드방어.1s"]);
  // A repeated report of either shot changes nothing.
  presenter.hit({ useId: 30, itemId: ItemIdx.rocket, victimId: "B", result: "hit", atMs: 2000, shot: 1 });
  at(2016);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s", "item/common/쉴드방어.1s"]);
});

test("equipment defences: SpecialShield looks, eating a banana and a mine that pays lucci", async () => {
  const { presenter, at, played } = await setup();
  // A kart that defends the devil family shows 대마왕_방어효과 (devil SpecialShield).
  presenter.used({ useId: 31, itemId: ItemIdx.devil, userId: "B", targets: ["A", "C"], startMs: 0, etaMs: 0 });
  presenter.hit({ useId: 31, itemId: ItemIdx.devil, victimId: "A", result: "blocked", by: "kart", atMs: 600 });
  at(600);
  assert.ok(models(presenter).includes("item/devil/대마왕_방어효과.1s"));
  // The warning on the defended kart is gone; C still has its own.
  assert.deepEqual(models(presenter).filter(model => model.endsWith("fired01.1s")), ["item/devil/fired01.1s"]);
  // newDevil's own defence model (강시_방어효과).
  presenter.used({ useId: 32, itemId: 38, userId: "B", targets: ["A"], startMs: 3000, etaMs: 0 });
  presenter.hit({ useId: 32, itemId: 38, victimId: "A", result: "blocked", by: "pet", atMs: 3500 });
  at(3500);
  assert.ok(models(presenter).includes("item/newDevil/강시_방어효과.1s"));
  // A missile blocked by a passive (no SpecialShield model) shows the ordinary shield block.
  presenter.used({ useId: 33, itemId: ItemIdx.rocket, userId: "B", targets: ["A"], startMs: 6000, etaMs: 500 });
  presenter.hit({ useId: 33, itemId: ItemIdx.rocket, victimId: "A", result: "blocked", by: "kart", atMs: 6500 });
  at(6500);
  assert.deepEqual(models(presenter), ["item/common/쉴드방어.1s"]);

  // A banana eaten (by:"eat"): 바나나먹기 on the eater and the eat sound; no spin look.
  presenter.used({ useId: 34, itemId: ItemIdx.banana, userId: "B", targets: [], startMs: 10_000, etaMs: 0,
    point: { x: 0, y: 0, z: 4 } });
  at(10_500);
  presenter.hit({ useId: 34, itemId: ItemIdx.banana, victimId: "A", result: "blocked", by: "eat", atMs: 11_000 });
  presenter.removed(34);
  at(11_000);
  assert.deepEqual(models(presenter), ["item/common/바나나먹기.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/banana/eat.ogg");
  at(13_000);
  assert.deepEqual(models(presenter), []);

  // A track mine eaten by an eatMine kart of a lucciMine character: EatBonus's 루찌획득 too.
  presenter.hit({ useId: 0, itemId: ItemIdx.mine, victimId: "A", result: "blocked", by: "eat", variant: "bonus",
    atMs: 14_000 });
  at(14_000);
  assert.deepEqual(models(presenter), ["item/common/루찌획득.1s", "item/common/바나나먹기.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/mine/eat.ogg");
});

test("a balloon takes the missile: AffectSmall, it pops for Affect and pays lucci at Reborn", async () => {
  const { presenter, at, played } = await setup();
  const balloon = presenter.plan.shared.balloon!;
  assert.deepEqual([balloon.popMs, balloon.rebornMs, balloon.reborn?.path],
    [1000, 1000, "item/common/루찌획득.1s"]);
  presenter.used({ useId: 40, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 0, etaMs: 600 });
  presenter.hit({ useId: 40, itemId: ItemIdx.rocket, victimId: "B", result: "hit", variant: "balloon", atMs: 600 });
  assert.equal(presenter.kartPresentation("B", 599), undefined);
  at(600);
  // AffectSmall: 미사일폭발 for 1000 ms instead of 1500 (its fired03 is the kart's motion).
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s"]);
  assert.deepEqual(presenter.kartPresentation("B", 600), { opacity: 1, balloonVisible: false });
  assert.equal(played.at(-1)!.path, "sound_/fx/item/balloon/affect.ogg");
  at(1600);
  assert.deepEqual(models(presenter), ["item/common/루찌획득.1s"]);
  assert.equal(presenter.kartPresentation("B", 1600), undefined, "the balloon is back");
  assert.deepEqual(played.slice(-2).map(sound => sound.path.split("/").at(-1)), ["reborn.ogg", "eaten.ogg"]);
});

test("a headband shortens the UFO to HeadBandAffect; Kiki's lucciUfo bonus pays lucci", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 41, itemId: ItemIdx.ufo, userId: "A", targets: ["B"], startMs: 0, etaMs: 900 });
  presenter.hit({ useId: 41, itemId: ItemIdx.ufo, victimId: "B", result: "hit", variant: "headband", atMs: 900 });
  presenter.kartEffect("B", "slow", 900, 1500);
  at(900);
  assert.deepEqual(models(presenter), ["item/ufo/fired03.1s", "item/ufo/firing00.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/ufo/headBandAffecting.ogg");
  at(2400);
  assert.deepEqual(models(presenter), [], "no PostAffect after a headband");

  presenter.used({ useId: 42, itemId: ItemIdx.ufo, userId: "A", targets: ["B"], startMs: 5000, etaMs: 900 });
  presenter.hit({ useId: 42, itemId: ItemIdx.ufo, victimId: "B", result: "hit", variant: "bonus", atMs: 5900 });
  presenter.kartEffect("B", "slow", 5900, 3000);
  at(5900);
  assert.deepEqual(models(presenter), ["item/common/루찌획득.1s", "item/ufo/fired01.1s", "item/ufo/firing00.1s"]);
  assert.ok(played.some(sound => sound.path === "sound_/fx/item/ufo/eaten.ogg"));
});

test("invisible: other teams lose the kart, its own team sees it translucent", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 43, itemId: 101, userId: "B", targets: ["B"], startMs: 0, etaMs: 0 });
  at(0);
  // The use shows ghost base 1's effect_tigerEye on the user during Use (500 ms).
  assert.deepEqual(models(presenter), ["item/ghost/effect_tigerEye.1s"]);
  assert.ok(played.some(sound => sound.path === "sound_/fx/item/ghost/usingTiger.ogg"));
  assert.equal(presenter.kartPresentation("B", 400), undefined, "the use alone does not hide it");
  presenter.kartEffect("B", "invisible", 500, 7000, { visibleToMe: false });
  assert.deepEqual(presenter.kartPresentation("B", 500), { opacity: 0, balloonVisible: true });
  presenter.kartEffect("C", "invisible", 500, 7000, { visibleToMe: true });
  assert.deepEqual(presenter.kartPresentation("C", 600),
    { opacity: ITEM_FX_TUNING.ghostOpacity, balloonVisible: true });
  at(7500);
  assert.equal(presenter.kartPresentation("B", 7500), undefined);
  // Hidden effects end early with the controller.
  presenter.kartEffect("B", "invisible", 8000, 7000, { visibleToMe: false });
  at(8100);
  presenter.endKartEffect("B", "invisible");
  assert.equal(presenter.kartPresentation("B", 8100), undefined);
});

test("gold and protect shields: the invincible look follows the user's own item", async () => {
  const { presenter, at, played } = await setup();
  // My own key press starts the default (gold) look; the reply of a protect shield replaces it.
  at(0);
  presenter.kartEffect("A", "invincible", 0, 4000);
  at(10);
  assert.deepEqual(models(presenter), ["item/goldShield/fired01.1s"]);
  presenter.used({ useId: 44, itemId: 81, userId: "A", targets: ["A"], startMs: 0, etaMs: 0 });
  at(20);
  assert.ok(played.some(sound => sound.path === "sound_/fx/item/goldShield/protectusing.ogg"));
  assert.deepEqual(models(presenter), ["item/goldShield/fired02.1s"]);
  at(4500);
  assert.deepEqual(models(presenter), []);
  // A remote user's gold shield: Use (500), then Affect for 2500.
  presenter.used({ useId: 45, itemId: 36, userId: "B", targets: ["B"], startMs: 5000, etaMs: 0 });
  presenter.kartEffect("B", "invincible", 5500, 2500);
  at(5400);
  assert.deepEqual(models(presenter), []);
  at(5500);
  assert.deepEqual(models(presenter), ["item/goldShield/fired01.1s"]);
  at(8000);
  assert.deepEqual(models(presenter), []);
  // superShield: the shield item's base 1 (GoldS) for 3000.
  presenter.used({ useId: 46, itemId: 18, userId: "C", targets: ["C"], startMs: 9000, etaMs: 0 });
  at(9000);
  assert.deepEqual(models(presenter), ["item/shield/GoldS.1s"]);
});

test("slow-and-blind missiles: no explosion and no UFO, their own cues; the lion spins", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 50, itemId: 99, userId: "A", targets: ["B"], startMs: 0, etaMs: 600 });
  at(0);
  assert.deepEqual(models(presenter), ["item/tigerRocket/missile_tiger.1s"]);
  presenter.hit({ useId: 50, itemId: 99, victimId: "B", result: "hit", atMs: 600 });
  presenter.kartEffect("B", "slow", 600, 4000);
  at(600);
  assert.deepEqual(models(presenter), [], "the claws are the victim's screen cover (HUD)");
  assert.equal(played.at(-1)!.path, "sound_/fx/item/tigerRocket/rocketuse.ogg");
  at(4600);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/tigerRocket/rocketend.ogg");
  // Without a hit just before it, a slow is the UFO's.
  presenter.kartEffect("B", "slow", 10_000, 3000);
  at(10_000);
  assert.deepEqual(models(presenter), ["item/ufo/fired01.1s"]);

  presenter.used({ useId: 51, itemId: 134, userId: "A", targets: ["C"], startMs: 20_000, etaMs: 700 });
  at(20_000);
  assert.deepEqual(models(presenter), ["item/lionMaskRocket/missile_lion.1s"]);
  presenter.hit({ useId: 51, itemId: 134, victimId: "C", result: "hit", atMs: 20_700 });
  presenter.kartEffect("C", "spin", 20_700, 2000);
  at(20_700);
  assert.deepEqual(models(presenter), []);
});

test("lockdown missile: holds its target, opens its field after CountDown and slows the others", async () => {
  const { presenter, at, played, karts } = await setup();
  presenter.used({ useId: 52, itemId: 104, userId: "A", targets: ["B"], startMs: 0, etaMs: 600 });
  at(0);
  assert.deepEqual(models(presenter), ["item/lockdownRocket/EMP투척.1s", "item/lockdownRocket/EMP투척_01.1s"]);
  presenter.hit({ useId: 52, itemId: 104, victimId: "B", result: "hit", atMs: 600 });
  presenter.kartEffect("B", "hold", 600, 2000);
  at(600);
  assert.deepEqual(models(presenter), ["item/lockdownRocket/EMP투척_01.1s", "item/lockdownRocket/락다운이펙_진행.1s"]);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/lockdownRocket/countdown.ogg");
  karts.get("B")!.position = { x: 2, y: 0, z: 62 };
  at(1100);
  const field = shown(presenter).find(entry => entry.model.endsWith("EMP_피격.1s"))!;
  assert.ok(nearVec(field.position, [2, 0, 62]), "the field opens where the target is at CountDown's end");
  assert.equal(played.at(-1)!.path, "sound_/fx/item/lockdownRocket/setEmp.ogg");
  // C, inside the field, reports its own hit: AffectSub's 간접타겟이펙트 and shock.
  presenter.hit({ useId: 52, itemId: 104, victimId: "C", result: "hit", atMs: 1100 });
  presenter.kartEffect("C", "slow", 1100, 3000);
  at(1116);
  assert.ok(models(presenter).includes("item/lockdownRocket/간접타겟이펙트.1s"));
  assert.ok(!models(presenter).includes("item/ufo/fired01.1s"));
  assert.equal(played.at(-1)!.path, "sound_/fx/item/lockdownRocket/shock.ogg");
  at(2100);
  assert.ok(!models(presenter).some(model => model.endsWith("EMP_피격.1s")), "the field lasts SetEmp (1000 ms)");
});

test("waterbombFly ticks on its target, bursts there and traps with the common bubble", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 53, itemId: 120, userId: "A", targets: ["B"], startMs: 0, etaMs: 1000 });
  at(0);
  assert.deepEqual(models(presenter), ["item/waterbombFly/item00.1s"]);
  at(1000);
  const ticking = shown(presenter).find(entry => entry.model === "item/waterBomb/item00.1s#carriedBalloon")!;
  assert.ok(ticking.position[1] > 2, "the balloon rides above the target");
  assert.ok(nearVec([ticking.position[0], ticking.position[2]], [0, 60]));
  at(3000);
  assert.ok(models(presenter).includes("item/waterbombFly/item01.1s"));
  assert.equal(played.at(-1)!.path, "sound_/fx/item/timeBomb/set.ogg");
  presenter.hit({ useId: 53, itemId: 120, victimId: "B", result: "hit", atMs: 3000 });
  presenter.kartEffect("B", "trap", 3000, 2000);
  at(3016);
  assert.ok(models(presenter).includes("item/common/물방울갇힘_일반.1s"));
  at(5000);
  presenter.kartEffect("B", "escapeShield", 5000, 1000);
  at(5016);
  assert.deepEqual(models(presenter), ["item/common/파란방패.1s"]);

  // A blocked arrival drops the countdown and the burst.
  presenter.used({ useId: 54, itemId: 120, userId: "A", targets: ["C"], startMs: 10_000, etaMs: 1000 });
  presenter.hit({ useId: 54, itemId: 120, victimId: "C", result: "blocked", by: "shield", atMs: 11_000 });
  at(11_000);
  at(13_000);
  assert.ok(!models(presenter).some(model => model.startsWith("item/waterbombFly")));
});

test("talisman and snowman land on their target from the user", async () => {
  const { presenter, at, played, scenes } = await setup();
  presenter.used({ useId: 55, itemId: 137, userId: "A", targets: ["B"], startMs: 0, etaMs: 1200 });
  at(0);
  assert.deepEqual(models(presenter), ["item/talisman/부적_사용.1s"]);
  assert.ok(scenes.every(scene => scene.path !== "item/talisman/fired00.1s"), "fired00 is a kart-motion track");
  assert.equal(played.at(-1)!.path, "sound_/fx/item/talisman/아이템 사용_B.ogg");
  at(1200);
  assert.equal(played.at(-1)!.path, "sound_/fx/item/talisman/아이템 피격.ogg");
  presenter.hit({ useId: 55, itemId: 137, victimId: "B", result: "hit", atMs: 1200 });
  presenter.kartEffect("B", "hold", 1200, 4000);
  at(1216);
  assert.ok(models(presenter).includes("item/talisman/부적_피격.1s"));
  assert.equal(played.at(-1)!.path, "sound_/fx/item/talisman/피격 디버프.ogg");

  presenter.used({ useId: 56, itemId: 112, userId: "A", targets: ["C"], startMs: 10_000, etaMs: 900 });
  at(10_000);
  assert.deepEqual(models(presenter), ["item/snowman/firing.1s"]);
  presenter.hit({ useId: 56, itemId: 112, victimId: "C", result: "hit", atMs: 10_900 });
  presenter.kartEffect("C", "shrink", 10_900, 2000);
  at(10_900);
  assert.ok(models(presenter).includes("item/snowman/fired.1s"));
  assert.ok(!models(presenter).some(model => model.startsWith("item/thunderbolt")));
});

test("special water bombs: their own bubbles, no blue shield after ice, the item lock after poison", async () => {
  const { presenter, at, played } = await setup();
  presenter.used({ useId: 57, itemId: 34, userId: "A", targets: [], startMs: 0, etaMs: 0, point: { x: 0, y: 0, z: 60 } });
  at(0);
  assert.deepEqual(models(presenter), ["item/snowBomb/item00.1s"]);
  at(1000);
  assert.deepEqual(models(presenter), ["item/snowBomb/item01.1s"]);
  presenter.hit({ useId: 57, itemId: 34, victimId: "B", result: "hit", atMs: 1000 });
  presenter.kartEffect("B", "trap", 1000, 3000);
  at(1016);
  assert.deepEqual(models(presenter), ["item/snowBomb/fired02.1s", "item/snowBomb/item01.1s"]);
  at(4000);
  presenter.kartEffect("B", "escapeShield", 4000, 2000);
  at(4016);
  assert.deepEqual(models(presenter), [], "snowBomb's EscapeAffect has no 파란방패");

  presenter.used({ useId: 58, itemId: 27, userId: "A", targets: [], startMs: 6000, etaMs: 0, point: { x: 0, y: 0, z: 60 } });
  presenter.hit({ useId: 58, itemId: 27, victimId: "B", result: "hit", atMs: 7000 });
  presenter.kartEffect("B", "trap", 7000, 2000);
  at(7016);
  assert.ok(models(presenter).includes("item/infectedBomb/fired02.1s"));
  // Escaping early brings the lock forward.
  at(7500);
  presenter.endKartEffect("B", "trap");
  at(7516);
  assert.ok(models(presenter).includes("item/common/녹색열쇠.1s"));
  assert.equal(played.at(-1)!.path, "sound_/fx/item/infectedBomb/locked.ogg");
  at(12_500);
  assert.ok(!models(presenter).includes("item/common/녹색열쇠.1s"), "PostAffect lasts 5000 ms");
});

test("dropped mines go off once at their first hit; the water mine bursts where it lies", async () => {
  const { presenter, at, played } = await setup();
  const point = { x: 0, y: 0, z: -4 };
  presenter.used({ useId: 59, itemId: 45, userId: "A", targets: [], startMs: 0, etaMs: 0, point });
  at(500);
  assert.deepEqual(models(presenter), ["item/mine/duckbomb_제자리.1s"]);
  presenter.hit({ useId: 59, itemId: 45, victimId: "B", result: "hit", atMs: 2000 });
  presenter.kartEffect("B", "launch", 2000, 1500);
  at(2000);
  assert.deepEqual(models(presenter), ["item/common/미사일폭발.1s"], "the duck is gone");
  assert.equal(played.at(-1)!.path, "sound_/fx/item/mine/exploding.ogg");

  presenter.used({ useId: 60, itemId: 37, userId: "A", targets: [], startMs: 5000, etaMs: 0, point });
  at(5500);
  presenter.hit({ useId: 60, itemId: 37, victimId: "B", result: "hit", atMs: 6000 });
  presenter.hit({ useId: 60, itemId: 37, victimId: "C", result: "hit", atMs: 6000 });
  at(6000);
  const bursts = shown(presenter).filter(entry => entry.model === "item/waterMine/item03.1s");
  assert.equal(bursts.length, 1, "one burst for every victim of the explosion");
  assert.ok(nearVec(bursts[0]!.position, [0, 0, -4]));
  assert.ok(!models(presenter).includes("item/waterMine/bubble.1s"));
});

test("hold, knockback, spin, launch and barrier without a cause add nothing; the start item sounds the charger", async () => {
  const { presenter, at, played } = await setup();
  for (const kind of ["hold", "knockback", "spin", "launch", "barrier"] as const)
    presenter.kartEffect("B", kind, 0, 1500);
  at(10);
  assert.deepEqual(models(presenter), []);
  // abyssBarricade's StateAffect (fired02_abyss) when it stops a kart.
  presenter.used({ useId: 61, itemId: 135, userId: "A", targets: ["B"], startMs: 1000, etaMs: 0 });
  presenter.placed({ useId: 61, itemId: 135, userId: "B", point: { x: 0, y: 0, z: 100 }, startMs: 1000 });
  presenter.hit({ useId: 61, itemId: 135, victimId: "B", result: "hit", atMs: 3000 });
  presenter.kartEffect("B", "hold", 3000, 2000);
  at(3000);
  // Its StateAffect model is a kart-motion track; the stop sounds.
  assert.equal(played.at(-1)!.path, "sound_/fx/item/abyssBarricade/용오름_3_피격효과음.ogg");
  presenter.startItemFlash(4000);
  at(4000);
  assert.equal(played.at(-1)!.path, "sound_/fx/charger/05_기타_슬롯차저_Large.ogg");
  assert.equal(played.at(-1)!.volume, 1);
});
