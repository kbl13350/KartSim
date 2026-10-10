import assert from "node:assert/strict";
import test from "node:test";
import { Mesh, PerspectiveCamera, Vector3, type Object3D } from "three";
import { uniqueOriginalCoinAsset } from "../vehicle/track-coin-source";
import { ItemIdx, loadItemCatalog } from "./item-catalog";
import {
  carriedBalloon, convertUnmappedColorKeys, type FxModelData, type FxModelNode, type ItemFxOps,
} from "./item-fx-assets";
import { ITEM_FX_TUNING } from "./item-fx-plan";
import { loadItemRacePresenter, type ItemPresenterFrame, type ItemPresenterPose } from "./item-race-presenter";
import { loadMirrorLibrary, type MirrorLibrary } from "./item-test-fixtures";

function node(name: string, children: FxModelNode[] = [], slots: unknown[] = new Array(11)): FxModelNode {
  return { kind: "node", className: "Relement", name, children, transform: [[0, 1, 0], [1, 0, 0], [0, 0, 1]],
    position: [1, 2, 3], scale: [1, 1, 1], slots, slotOccurrences: [...slots] };
}

test("unmapped color keys become Hermite keys with flat tangents", () => {
  const record = (time: number, color: number) => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setUint32(0, time, true);
    new DataView(bytes.buffer).setUint32(4, color, true);
    return bytes;
  };
  const linear = { kind: "color-controller", keys: { type: 1, records: [record(0, 0), record(66, 0xff000000)] } };
  const hermite = { kind: "color-controller", keys: { type: 0, records: [new Uint8Array(16)] } };
  const step = { kind: "color-controller", keys: { type: 3, records: [record(5, 1)] } };
  const slots = new Array(11);
  slots[6] = { value: { kind: "material", controllers: [null, linear, hermite, step] } };
  const root = node("root", [node("child", [], slots)]);
  assert.equal(convertUnmappedColorKeys(root), 1);
  assert.equal(convertUnmappedColorKeys(root), 0, "already converted");
  assert.equal(linear.keys.type, 0);
  const view = new DataView(linear.keys.records[1]!.buffer);
  assert.deepEqual([linear.keys.records[1]!.length, view.getUint32(0, true), view.getUint32(4, true),
    view.getFloat32(8, true), view.getFloat32(12, true)], [16, 66, 0xff000000, 0, 0]);
  assert.equal(step.keys.type, 3);
});

test("the carried balloon keeps the falling balloon, still, at the origin", () => {
  const slots = Array.from({ length: 11 }, (_, index) => ({ slot: index }));
  const model: FxModelData = { root: node("", [node("Point01", [node("thrown")]),
    node("물방울-중심", [node("balloon", [], slots), node("풍선낙하싸이드"), node("풍선낙하-깃01", [], slots)], slots)]),
  settings: "s" };
  const carried = carriedBalloon(model);
  assert.deepEqual(carried.root.children.map(child => child.name), ["물방울-중심"]);
  const [point] = carried.root.children;
  assert.deepEqual([point!.position, point!.transform], [[0, 0, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]]);
  assert.deepEqual(point!.children.map(child => child.name), ["balloon"], "no fall sheath or streaks");
  for (const part of [point!, point!.children[0]!]) {
    assert.equal(part.slots[0], undefined, "no visibility switch");
    assert.equal(part.slotOccurrences[1], undefined, "no throw track");
    assert.deepEqual(part.slots[7], { slot: 7 });
  }
  assert.equal(carried.settings, "s");
  assert.deepEqual(model.root.children[0]!.position, [1, 2, 3], "the source model is untouched");
  assert.throws(() => carriedBalloon({ root: node("") }));
});

let shared: Promise<{ library: MirrorLibrary; formats: any }> | undefined;
function pipeline() {
  return shared ??= (async () => ({
    library: await loadMirrorLibrary(["*"]),
    formats: await import("../generated/formats.js") as any,
  }))();
}

function meshCenter(object: Object3D): Vector3 | undefined {
  const points: Vector3[] = [];
  object.traverse(child => {
    if ((child as Mesh).isMesh) points.push(new Vector3().setFromMatrixPosition(child.matrixWorld));
  });
  if (points.length === 0) return undefined;
  return points.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(points.length);
}

test("every item model assembles with the real scene assembler and renders at its kart", async () => {
  const { library, formats } = await pipeline();
  const catalog = await loadItemCatalog(library);
  const ops: ItemFxOps<MirrorLibrary> = {
    originalAsset: (archive, path) => uniqueOriginalCoinAsset(archive, path),
    decodeModel: bytes => formats.y9(bytes) as FxModelData,
    decodeAudio: () => undefined,
    loadModel: (data, archive, path, identity, options) => formats.c5(data, archive, path, identity, options),
    routeAudio: () => {},
    setGain: () => {},
  };
  const environment = await formats.rn.load(library);
  const stageBinding = new formats.ha();
  const started = performance.now();
  const presenter = await loadItemRacePresenter(library, catalog, environment, stageBinding, undefined, ops);
  const loadMs = performance.now() - started;
  try {
    assert.ok(loadMs < 20_000, `loaded in ${Math.round(loadMs)} ms`);
    for (const [key, pool] of presenter.models.pools) {
      assert.equal(pool.failure, undefined, key);
      assert.equal(pool.instances.length, pool.model.preload ?? ITEM_FX_TUNING.preloadInstances, key);
      let meshes = 0;
      pool.instances[0]!.scene.object.traverse(child => { if ((child as Mesh).isMesh) meshes += 1; });
      assert.ok(meshes > 0, `${key} has meshes`);
    }
    // The UFO models only assemble once their type-1 color keys are converted.
    for (const path of ["item/ufo/firing00.1s", "item/ufo/fired00.1s", "item/ufo/fired01.1s", "item/ufo/fired02.1s"])
      assert.ok(presenter.models.pools.get(path)?.instances.length, path);

    const kart = (x: number, z: number): ItemPresenterPose => ({ position: { x, y: 10, z },
      forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 }, right: { x: 1, y: 0, z: 0 } });
    const poses = new Map([["A", kart(100, 100)], ["B", kart(100, 160)], ["C", kart(120, 200)]]);
    const camera = new PerspectiveCamera(60, 16 / 9, 0.5, 5000);
    camera.position.set(100, 14, 90);
    camera.lookAt(100, 10, 120);
    camera.updateMatrixWorld(true);
    const frame = (nowMs: number): ItemPresenterFrame => ({ nowMs, camera, width: 1600, height: 900,
      localPlayerId: "A", pose: id => poses.get(id) });

    const seen = new Set<string>();
    const step = (now: number) => {
      presenter.update(frame(now));
      for (const pool of presenter.models.pools.values())
        if (pool.instances.some(instance => instance.mount.visible)) seen.add(pool.model.key);
    };

    // A missile from A to B: its meshes are where the presenter put it, nose toward B.
    presenter.used({ useId: 1, itemId: ItemIdx.rocket, userId: "A", targets: ["B"], startMs: 1000, etaMs: 1000 });
    step(1000);
    step(1500);
    const missile = presenter.models.pools.get("item/rocket/item01.1s")!.instances[0]!;
    assert.ok(missile.mount.visible);
    const center = meshCenter(missile.scene.object)!;
    const expected = new Vector3(100, 10 + ITEM_FX_TUNING.projectileLiftM + ITEM_FX_TUNING.rocketArcM, 130);
    assert.ok(center.distanceTo(expected) < 3, `missile at ${center.toArray()}`);

    // Every other model shows and updates through the real assembler with a camera.
    const uses: Array<[number, string, string[], { x: number; y: number; z: number }?]> = [
      [ItemIdx.waterFly, "A", ["B"]], [ItemIdx.ufo, "A", ["C"]], [ItemIdx.magnet, "A", ["B"]],
      [ItemIdx.banana, "B", [], { x: 100, y: 10, z: 156 }], [ItemIdx.waterBomb, "A", [], { x: 100, y: 10, z: 125 }],
      [ItemIdx.timeBomb, "C", []], [ItemIdx.barricade, "A", ["C"], { x: 120, y: 10, z: 260 }],
      [ItemIdx.cloud2, "C", ["A", "B"]], [ItemIdx.thunderbolt, "A", ["B", "C"]], [ItemIdx.devil, "B", ["A", "C"]],
      [ItemIdx.shield, "A", ["A"]], [ItemIdx.angel, "B", ["B", "C"]], [ItemIdx.emp, "C", ["C"]],
      [ItemIdx.scanning, "A", ["A"]], [ItemIdx.slotLock, "B", ["A", "C"]],
    ];
    presenter.hit({ useId: 1, itemId: ItemIdx.rocket, victimId: "B", result: "blocked", by: "shield", atMs: 2000 });
    step(2000);
    uses.forEach(([itemId, userId, targets, point], index) => presenter.used({ useId: 10 + index, itemId, userId,
      targets, startMs: 5000, etaMs: 800, point }));
    // Hits and kart effects at the times the controller would report them.
    const events = new Map<number, () => void>([
      [5000, () => {
        presenter.hit({ useId: 0, itemId: ItemIdx.mine, victimId: "C", result: "hit", atMs: 5000 });
        presenter.hit({ useId: 0, itemId: ItemIdx.waterMine, victimId: "A", result: "hit", atMs: 5000 });
      }],
      [5800, () => {
        presenter.hit({ useId: 10, itemId: ItemIdx.waterFly, victimId: "B", result: "hit", atMs: 5800 });
        presenter.kartEffect("B", "trap", 5800, 1000);
        presenter.hit({ useId: 11, itemId: ItemIdx.ufo, victimId: "C", result: "hit", atMs: 5800 });
        presenter.kartEffect("C", "slow", 5800, 3000);
      }],
      [6000, () => presenter.hit({ useId: 18, itemId: ItemIdx.thunderbolt, victimId: "C", result: "blocked",
        by: "angel", atMs: 6000 })],
      [6000 + 1000, () => {
        presenter.hit({ useId: 14, itemId: ItemIdx.waterBomb, victimId: "A", result: "hit", atMs: 7000 });
        presenter.kartEffect("A", "trap", 7000, 2000);
      }],
      [6500, () => {
        presenter.kartEffect("A", "reverse", 6500, 3000);
        presenter.kartEffect("B", "escapeShield", 6800, 2000);
      }],
      [7100, () => presenter.kartEffect("B", "shrink", 7100, 1500)],
    ]);
    for (let now = 5000; now <= 13_000; now += 50) {
      events.get(now)?.();
      step(now);
      // Copies for overlapping visuals are assembled in the background.
      await new Promise(resolve => setImmediate(resolve));
    }
    const never = [...presenter.models.pools.keys()].filter(key => !seen.has(key));
    // Only the devil family's defences (kart-ability blocks, phase 3) never show here.
    // item-mode(p3c): newDevil and drrMine are in the catalog since phase 3.
    assert.deepEqual(never, ["item/devil/대마왕_방어효과.1s", "item/drmad/닥터R_방어효과.1s",
      "item/newDevil/강시_방어효과.1s"]);
  } finally {
    presenter.dispose();
    environment.dispose();
  }
});
