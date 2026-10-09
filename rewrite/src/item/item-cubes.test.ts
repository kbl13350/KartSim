import assert from "node:assert/strict";
import test from "node:test";
import type { ItemCubeDescriptor, ItemCubeSource, ItemVec3 } from "./item-cube-source";
import {
  CUBE_EFFECT_POOL, ITEM_COMMON_TEXTURE_SOURCE, buildCubeRoots, cubeSpin, loadItemCubeField,
  type CubeAudioSource, type CubeModelData, type CubeModelNode, type CubeRenderedScene,
  type CubeSceneObject, type ItemCubeFieldOps, type ItemPairObject,
} from "./item-cubes";

class FakeObject implements CubeSceneObject {
  visible = true;
  name = "";
  children: FakeObject[] = [];
  parent: FakeObject | undefined;
  at: ItemVec3 = { x: 0, y: 0, z: 0 };
  position = { copy: (position: ItemVec3) => { this.at = { ...position }; } };
  add(...objects: CubeSceneObject[]) {
    for (const object of objects as FakeObject[]) { object.parent = this; this.children.push(object); }
  }
  removeFromParent() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter(child => child !== this);
    this.parent = undefined;
  }
}

function modelNode(name: string, children: CubeModelNode[] = []): CubeModelNode {
  return { kind: "node", className: "Relement", name, children,
    transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], position: [0, 0, 0], scale: [1, 1, 1],
    slots: new Array(11), slotOccurrences: new Array(11), childOccurrences: ["x"] };
}

function cube(id: number, client: [number, number, number], anchor?: object): ItemCubeDescriptor {
  return { id, name: `ic${id}`, clientPosition: client,
    position: { x: client[0], y: client[2], z: -client[1] }, ...(anchor ? { anchor } : {}) };
}

function source(cubes: ItemCubeDescriptor[]): ItemCubeSource {
  return { trackId: "forest_I01", theme: "forest", modelPath: "item/itemCube/forest/zz/itemCube.1s",
    eatenModelPath: "item/itemCube/fired01.1s", eatenSoundPath: "sound_/fx/item/itemCube/eaten.ogg",
    radius: 2, eatenLifeMs: 2000, cubes };
}

interface Log { calls: unknown[][]; scenes: FakeScene[]; sounds: FakeSound[] }

class FakeScene implements CubeRenderedScene {
  object = new FakeObject();
  rootObjects: FakeObject[];
  scaled: Array<{ node: CubeModelNode; position: number[]; basis: number[][] }> = [];
  updates: unknown[][] = [];
  resets: number[] = [];
  disposed = false;
  constructor(readonly path: string, readonly options: Record<string, unknown>, data: CubeModelData) {
    const roots = [data.root, ...((options.additionalRoots as CubeModelNode[]) ?? [])];
    this.rootObjects = roots.map(root => Object.assign(new FakeObject(), { name: root.name }));
  }
  setNodeScale(node: object) {
    const model = node as CubeModelNode;
    this.scaled.push({ node: model, position: [...model.position], basis: model.transform.map(row => [...row]) });
  }
  reset(now: number) { this.resets.push(now); }
  playControllers() {}
  update(...args: unknown[]) { this.updates.push(args); }
  dispose() { this.disposed = true; }
}

class FakeSound implements CubeAudioSource {
  buffer: unknown;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  start() { this.started = true; }
  stop() { this.stopped = true; }
  disconnect() {}
}

function fakeOps(log: Log): ItemCubeFieldOps<string> {
  const model: CubeModelData = { root: modelNode("cube", [modelNode("Box", [modelNode("mesh")])]), settings: "s" };
  return {
    createObject: () => new FakeObject(),
    originalAsset: (_archive, path) => ({ bytes: async () => { log.calls.push(["asset", path]); return path; } }),
    decodeModel: bytes => { log.calls.push(["decode", bytes]); return model; },
    decodeAudio: (_context, bytes) => { log.calls.push(["audio", bytes]); return "buffer"; },
    loadModel: async (data, archive, path, identity, options) => {
      log.calls.push(["load", archive, path, identity.id, (options.additionalRoots ?? []).length,
        options.advertisementSources]);
      const scene = new FakeScene(path, options as Record<string, unknown>, data);
      log.scenes.push(scene);
      return scene;
    },
    routeAudio: (_context, source, group) => { log.calls.push(["route", group]); log.sounds.push(source as FakeSound); },
  };
}

const context = { createBufferSource: () => new FakeSound() };

function world() {
  const objects: ItemPairObject[] = [];
  const kart = { kart: true };
  return { objects, kart,
    queueKartPairObject(object: ItemPairObject) { objects.push(object); },
    isKartPeer: (candidate: unknown) => candidate === kart };
}

test("cube roots wrap a fresh copy of the model per cube", () => {
  const model: CubeModelData = { root: modelNode("cube", [modelNode("Box", [modelNode("mesh")])]) };
  const { root, wrappers, spinners } = buildCubeRoots(model,
    [cube(1, [1, 2, 3]), cube(2049, [4, 5, 6], {})]);
  assert.equal(root.children.length, 0);
  assert.deepEqual(wrappers.map(wrapper => [wrapper.name, wrapper.position]),
    [["itemCube#1", [1, 2, 3]], ["itemCube#2049", [4, 5, 6]]]);
  assert.deepEqual(wrappers.map(wrapper => wrapper.children[0]), spinners);
  const [first, second] = spinners.map(spinner => spinner.children[0]!);
  assert.notEqual(first, second);
  assert.notEqual(first!.children[0], second!.children[0]);
  assert.notEqual(first, model.root);
  for (const node of [root, ...wrappers, ...spinners]) {
    assert.equal(node.slotOccurrences.length, 11);
    assert.ok(node.slotOccurrences.every(slot => slot === undefined));
    assert.deepEqual(node.childOccurrences, []);
  }
  assert.throws(() => buildCubeRoots({ root: { ...modelNode("x"), kind: "track" } }, []));
});

test("cube spin is the LTE coin's one turn per four seconds", () => {
  assert.equal(cubeSpin(0), 0);
  assert.ok(Math.abs(cubeSpin(2000) - Math.PI) < 1e-5);
  assert.equal(cubeSpin(4000), 0);
});

test("cube field loads one shared cube scene and a pool of eaten effects", async () => {
  const log: Log = { calls: [], scenes: [], sounds: [] };
  const field = await loadItemCubeField("lib", source([cube(1, [10, 20, 3]), cube(2, [30, 20, 3])]),
    "env", "stage", context, undefined, fakeOps(log));
  assert.equal(field.count, 2);
  const loads = log.calls.filter(call => call[0] === "load");
  assert.deepEqual(loads[0], ["load", "lib", "item/itemCube/forest/zz/itemCube.1s", "itemCube", 2, undefined]);
  assert.equal(loads.length, 1 + CUBE_EFFECT_POOL);
  for (const effect of loads.slice(1))
    assert.deepEqual(effect.slice(2), ["item/itemCube/fired01.1s", "itemCube", 0, [ITEM_COMMON_TEXTURE_SOURCE]]);
  assert.equal(log.calls.filter(call => call[0] === "decode").length, 2);
  assert.deepEqual(log.calls.find(call => call[0] === "audio"), ["audio", "sound_/fx/item/itemCube/eaten.ogg"]);
  const object = field.object as FakeObject;
  assert.equal(object.children.length, 1 + CUBE_EFFECT_POOL);
  assert.ok(object.children.slice(1).every(effect => !effect.visible));
  field.dispose();
  assert.ok(log.scenes.every(scene => scene.disposed));
});

test("the local kart eats a cube, which hides for Eaten.life and comes back", async () => {
  const log: Log = { calls: [], scenes: [], sounds: [] };
  const field = await loadItemCubeField("lib", source([cube(1, [10, 20, 3]), cube(2, [13, 20, 3]),
    cube(3, [100, 20, 3])]), "env", "stage", context, undefined, fakeOps(log));
  const coordinator = world();
  let kart: ItemVec3 = { x: 0, y: 0, z: 0 };
  let collect = true;
  const pickups: number[] = [];
  field.attach(coordinator, () => kart, () => collect, id => pickups.push(id));
  assert.throws(() => field.attach(coordinator, () => kart, () => true, () => {}));
  const [contact] = coordinator.objects;
  assert.equal(coordinator.objects.length, 1);
  assert.equal(contact!.category, 2);
  const [cubes] = log.scenes;
  const views = cubes!.rootObjects;

  // Midway between cubes 1 and 2 (1.5 from each): both break in one frame.
  kart = { x: 11.5, y: 3, z: -20 };
  contact!.slot13({ other: true }, 100);
  contact!.slot12(116);
  assert.deepEqual(pickups, []);
  collect = false;
  contact!.slot13(coordinator.kart, 116);
  contact!.slot12(132);
  assert.deepEqual(pickups, []);
  collect = true;
  assert.ok(field.available(1));
  contact!.slot13(coordinator.kart, 132);
  assert.equal(field.available(1), false, "pending until the next update");
  contact!.slot12(148);
  assert.deepEqual(pickups, [1, 2]);
  assert.equal(field.available(1), false);
  assert.equal(views[1]!.visible, false);
  assert.equal(views[2]!.visible, false);
  assert.equal(views[3]!.visible, true);
  assert.equal(log.sounds.length, 1);
  assert.ok(log.sounds[0]!.started);
  const effects = (field.object as FakeObject).children.slice(1);
  assert.deepEqual(effects.map(effect => effect.visible), [true, false, false]);
  assert.deepEqual(effects[0]!.at, kart);

  // Eaten cubes cannot be eaten again until Eaten.life passes.
  contact!.slot13(coordinator.kart, 1000);
  contact!.slot12(1000);
  assert.deepEqual(pickups, [1, 2]);
  contact!.slot12(2147);
  assert.equal(views[1]!.visible, false);
  contact!.slot12(2148);
  assert.equal(views[1]!.visible, true);
  assert.ok(field.available(1));

  // The effect follows the kart and ends after Eaten.life.
  kart = { x: 50, y: 3, z: -20 };
  field.update(1000);
  assert.deepEqual(effects[0]!.at, kart);
  field.update(2148);
  assert.equal(effects[0]!.visible, false);

  contact!.slot13(coordinator.kart, 2200);
  contact!.slot12(2216);
  assert.deepEqual(pickups, [1, 2], "the kart moved away");
  kart = { x: 10, y: 3, z: -20 };
  contact!.slot13(coordinator.kart, 2232);
  contact!.slot12(2248);
  assert.deepEqual(pickups, [1, 2, 1]);
  assert.equal(log.sounds.length, 2);
  field.dispose();
  assert.ok(log.sounds.every(sound => sound.stopped));
});

test("update spins standing cubes and moves moving cubes with their anchors", async () => {
  const log: Log = { calls: [], scenes: [], sounds: [] };
  const anchor = { kind: "node" };
  const matrix = new Float32Array(16);
  matrix.set([418.3, 442.5, 91.5], 12);
  const field = await loadItemCubeField("lib", source([cube(1, [10, 20, 3]), cube(2049, [418, 442, 91], anchor)]),
    "env", "stage", undefined, node => node === anchor ? matrix : undefined, fakeOps(log));
  assert.equal(log.calls.some(call => call[0] === "audio"), false);
  const [scene] = log.scenes;
  field.update(1000, "camera", 800, 600);
  assert.deepEqual(scene!.updates.at(-1), [1000, "camera", 800, 600]);
  const wrapperMove = scene!.scaled.find(entry => entry.node.name === "itemCube#2049");
  assert.deepEqual(wrapperMove!.position.map(value => Math.fround(value)),
    [Math.fround(418.3), Math.fround(442.5), Math.fround(91.5)]);
  const position = field.position(2049)!;
  assert.ok(Math.abs(position.x - 418.3) < 1e-4 && Math.abs(position.y - 91.5) < 1e-4 &&
    Math.abs(position.z + 442.5) < 1e-4);
  const spins = scene!.scaled.filter(entry => entry.node.name === "");
  assert.equal(spins.length, 2);
  const angle = cubeSpin(1000);
  assert.ok(Math.abs(spins[0]!.basis[0]![0]! - Math.cos(angle)) < 1e-6);
  assert.ok(Math.abs(spins[0]!.basis[1]![0]! - Math.sin(angle)) < 1e-6);
  assert.deepEqual(field.position(1), { x: 10, y: 3, z: -20 });
  assert.equal(field.position(99), undefined);

  // The pickup test uses the moved position.
  const coordinator = world();
  const pickups: number[] = [];
  field.attach(coordinator, () => ({ x: 418.3, y: 91.5, z: -442.5 }), () => true, id => pickups.push(id));
  coordinator.objects[0]!.slot13(coordinator.kart, 1001);
  coordinator.objects[0]!.slot12(1017);
  assert.deepEqual(pickups, [2049]);
  // An eaten cube no longer spins.
  scene!.scaled.length = 0;
  field.update(1100);
  assert.equal(scene!.scaled.filter(entry => entry.node.name === "").length, 1);
  field.dispose();
  field.update(1200);
  assert.equal(scene!.updates.length, 2);
});

test("a track without cubes loads nothing and registers no contact", async () => {
  const log: Log = { calls: [], scenes: [], sounds: [] };
  const field = await loadItemCubeField("lib", source([]), "env", "stage", context, undefined, fakeOps(log));
  assert.equal(field.count, 0);
  assert.deepEqual(log.calls, []);
  const coordinator = world();
  field.attach(coordinator, () => ({ x: 0, y: 0, z: 0 }), () => true, () => {});
  assert.equal(coordinator.objects.length, 0);
  field.update(10);
  field.dispose();
});

test("a failed load releases what was already assembled", async () => {
  const log: Log = { calls: [], scenes: [], sounds: [] };
  const ops = fakeOps(log);
  let loads = 0;
  const failing: ItemCubeFieldOps<string> = { ...ops, loadModel: async (...args) => {
    if (++loads === 3) throw Error("effect failed");
    return ops.loadModel(...args);
  } };
  await assert.rejects(loadItemCubeField("lib", source([cube(1, [0, 0, 0])]), "env", "stage", undefined,
    undefined, failing), /effect failed/);
  assert.equal(log.scenes.length, 2);
  assert.ok(log.scenes.every(scene => scene.disposed));
});
