import assert from "node:assert/strict";
import test from "node:test";
import { Group } from "three";
import { uniqueOriginalCoinAsset } from "../vehicle/track-coin-source";
import { ItemIdx } from "./item-catalog";
import { MOVING_CUBE_ID_OFFSET, type ItemCubeSource, type ItemVec3 } from "./item-cube-source";
import type { CubeModelData, ItemCubeFieldOps, ItemPairObject } from "./item-cubes";
import type { ItemHazardHit, ItemHazardSource } from "./item-hazards";
import { isItemRaceRoom, loadItemRaceFields } from "./item-race-map";
import { loadMirrorLibrary, type MirrorLibrary } from "./item-test-fixtures";

/**
 * End-to-end checks on the real p3553 mirror: the generated `ul` map loader
 * with the item flag, the item sources it returns, and the cube field built
 * from them with the real scene assembler.
 */

interface LoadedMap {
  admission: { ledger: { mode: string; records: Array<Record<string, any>> } };
  itemCubeSource?: ItemCubeSource;
  itemHazardSource?: ItemHazardSource;
  itemCatalog?: unknown;
  renderScene: { update(time: number): void; clientWorldElements(node: object): ArrayLike<number> | undefined;
    dispose(): void };
  skydome?: { dispose(): void };
  environment: { dispose(): void };
  stageBinding: unknown;
  [field: string]: unknown;
}

let shared: Promise<{ library: MirrorLibrary; formats: any; vehicle: any; host: unknown }> | undefined;
function pipeline() {
  return shared ??= (async () => {
    const library = await loadMirrorLibrary(["*"]);
    const formats = await import("../generated/formats.js") as any;
    const vehicle = await import("../generated/vehicle.js") as any;
    const host = {
      generationValue: () => 1,
      isGenerationCurrent: () => true,
      requireAsset: (path: string) => {
        const entry = (library as any).get(path);
        if (!entry) throw Error(`missing ${path}`);
        return entry;
      },
      getLibrary: () => library,
      toonStageBinding: new formats.ha(),
    };
    return { library, formats, vehicle, host };
  })();
}

async function loadMap(trackId: string, mode?: "item", file = "track.1s"): Promise<LoadedMap> {
  const { vehicle, host } = await pipeline();
  const id = file === "track_rvs.1s" ? `${trackId}_rvs` : trackId;
  return new vehicle.ul(host).loadMultiplayerMap(`track_/${trackId}/${file}`, id, mode);
}

function release(map: LoadedMap): void {
  map.renderScene.dispose();
  map.skydome?.dispose();
  map.environment.dispose();
}

function reasons(map: LoadedMap): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of map.admission.ledger.records)
    if (/item|cube|nonboost/.test(record.reason)) counts[record.reason] = (counts[record.reason] ?? 0) + 1;
  return counts;
}

const near = (actual: number, expected: number) => Math.abs(actual - expected) < 0.01;

test("item rooms are recognised by gameplay or original item channel", () => {
  assert.equal(isItemRaceRoom({ gameplay: "item", channelName: "speedIndiCombine" }), true);
  assert.equal(isItemRaceRoom({ channelName: "itemTeamCombine" }), true);
  assert.equal(isItemRaceRoom({ gameplay: "ordinary", channelName: "speedTeamCombine" }), false);
  assert.equal(isItemRaceRoom({}), false);
});

test("factory_I03 loads with the item flag: cubes, moving cubes and hazards are admitted", async () => {
  const speed = await loadMap("factory_I03");
  const item = await loadMap("factory_I03", "item");
  try {
    assert.equal(item.admission.ledger.mode, "speed-individual");
    assert.equal(item.admission.ledger.records.filter(record => record.decision === "block").length, 0);
    assert.deepEqual(reasons(item), {
      "item-cube-admitted": 38, "moving-item-cube-admitted": 21, "item-hazard-admitted": 4,
    });
    assert.deepEqual(reasons(speed), { "cube-loader-omission": 59, "excluded-nonboost-item-runtime": 4 });
    // Every other decision is the speed-individual one, record for record.
    const changed = item.admission.ledger.records.flatMap((record, index) => {
      const other = speed.admission.ledger.records[index]!;
      return JSON.stringify(record) === JSON.stringify(other) ? [] : [other.reason];
    });
    assert.equal(changed.length, 63);
    assert.ok(changed.every(reason => reason === "cube-loader-omission" || reason === "excluded-nonboost-item-runtime"));
    for (const key of ["itemCatalog", "itemCubeSource", "itemHazardSource"]) {
      assert.ok(item[key], key);
      assert.equal(key in speed, false, key);
    }

    const cubes = item.itemCubeSource!;
    assert.equal(cubes.theme, "factory");
    assert.equal(cubes.modelPath, "item/itemCube/factory/zz/itemCube.1s");
    assert.equal(cubes.eatenModelPath, "item/itemCube/fired01.1s");
    assert.equal(cubes.eatenSoundPath, "sound_/fx/item/itemCube/eaten.ogg");
    assert.equal(cubes.radius, 2);
    assert.equal(cubes.eatenLifeMs, 2000);
    const fixed = cubes.cubes.filter(cube => !cube.anchor);
    const moving = cubes.cubes.filter(cube => cube.anchor);
    assert.deepEqual(fixed.map(cube => cube.id), Array.from({ length: 38 }, (_, index) => index + 1));
    assert.equal(moving.length, 21);
    assert.ok(moving.every(cube => cube.id > MOVING_CUBE_ID_OFFSET));
    assert.deepEqual([fixed[0]!.name, fixed[0]!.clientPosition.map(value => Math.round(value * 100) / 100)],
      ["ic98+", [311.88, 407.39, 90]]);
    assert.ok(near(fixed[0]!.position.x, 311.88) && near(fixed[0]!.position.y, 90) &&
      near(fixed[0]!.position.z, -407.39));
    const conveyor = moving.find(cube => cube.name === "mo_itemcube")!;
    assert.equal(conveyor.id, MOVING_CUBE_ID_OFFSET + 1);

    // The moving cube anchor is a matrix-only root of the track scene and moves with its PRS
    // (the scene publishes a frame's matrices on the following update).
    const track: Array<number[]> = [];
    for (const time of [0, 2000, 4000, 6000]) {
      item.renderScene.update(time);
      const matrix = item.renderScene.clientWorldElements(conveyor.anchor!)!;
      track.push([matrix[12]!, matrix[13]!, matrix[14]!]);
    }
    assert.ok(near(track[0]![0]!, 418.3) && near(track[0]![2]!, 91.48));
    assert.ok(track[2]![0]! < 400, "the conveyor carries the cube along -x");
    assert.ok(track.every(position => near(position[1]!, 442.54)));

    const hazards = item.itemHazardSource!;
    assert.equal(hazards.cooldownMs, 3000);
    assert.equal(hazards.hazards[0]!.sound, "mo_프로펠라로봇");
    assert.deepEqual(hazards.hazards.map(hazard => [hazard.id, hazard.kind, hazard.itemIdx, hazard.radius]), [
      [45, "waterMine", ItemIdx.waterMine, 10], [46, "banana", ItemIdx.banana, 2],
      [47, "banana", ItemIdx.banana, 2], [48, "banana", ItemIdx.banana, 2],
    ]);
    // Hazards render through the track scene; their world matrices start at the movable transform.
    item.renderScene.update(0);
    for (const hazard of hazards.hazards) {
      const matrix = item.renderScene.clientWorldElements(hazard.anchor)!;
      assert.ok(matrix, hazard.name);
      assert.ok(near(matrix[12]!, hazard.clientPosition[0]) && near(matrix[13]!, hazard.clientPosition[1]),
        hazard.name);
    }
  } finally {
    release(speed);
    release(item);
  }
});

test("real cube placements, skins and hazards of gold_I06, forest_I01, tomb_I05, ice_I10 and abyss_I02", async () => {
  const gold = await loadMap("gold_I06", "item");
  try {
    const cubes = gold.itemCubeSource!.cubes;
    assert.equal(cubes.length, 38);
    assert.deepEqual(cubes.map(cube => cube.id), Array.from({ length: 38 }, (_, index) => index + 1));
    assert.equal(cubes[0]!.name, "ic_02");
    assert.ok(near(cubes[0]!.clientPosition[0], 678.29) && near(cubes[0]!.clientPosition[1], 417.89) &&
      near(cubes[0]!.clientPosition[2], 67.45));
    assert.equal(gold.itemCubeSource!.modelPath, "item/itemCube/gold/zz/itemCube.1s");
    // gold_I06 mines carry `model="item01_trans" size="3.0"`.
    assert.deepEqual(gold.itemHazardSource!.hazards.map(hazard =>
      [hazard.kind, hazard.radius, hazard.model, hazard.onlyItemGame]),
    Array.from({ length: 6 }, () => ["mine", 3, "item01_trans", false]));
  } finally { release(gold); }

  for (const [trackId, file, count, first] of [
    ["forest_I01", "track.1s", 24, undefined],
    ["forest_I01", "track_rvs.1s", 24, undefined],
    ["tomb_I05", "track.1s", 38, ["ic01", 553.55, 565.08, 227.0]],
  ] as const) {
    const map = await loadMap(trackId, "item", file);
    try {
      const source = map.itemCubeSource!;
      assert.equal(source.cubes.length, count, `${trackId} ${file}`);
      assert.ok(source.cubes.every((cube, index) => cube.id === index + 1 && !cube.anchor));
      assert.equal(map.itemHazardSource!.hazards.length, 0);
      assert.equal(source.theme, trackId.split("_")[0]);
      if (first) {
        assert.equal(source.cubes[0]!.name, first[0]);
        assert.ok(first.slice(1).every((value, axis) => near(source.cubes[0]!.clientPosition[axis]!, value as number)));
      }
    } finally { release(map); }
  }

  // ice_I10's only onlyItemGame objects are six bananas and a water mine.
  const speedIce = await loadMap("ice_I10");
  const ice = await loadMap("ice_I10", "item");
  try {
    assert.equal(reasons(speedIce)["only-item-game-loader-omission"], 7);
    assert.equal(reasons(ice)["only-item-game-loader-omission"], undefined);
    const onlyItemGame = ice.itemHazardSource!.hazards.filter(hazard => hazard.onlyItemGame);
    assert.deepEqual(onlyItemGame.map(hazard => hazard.kind).sort(),
      ["banana", "banana", "banana", "banana", "banana", "banana", "waterMine"]);
    assert.equal(ice.itemCubeSource!.cubes.filter(cube => cube.anchor).length, 10);
  } finally {
    release(speedIce);
    release(ice);
  }

  const abyss = await loadMap("abyss_I02", "item");
  try {
    const hidden = abyss.itemHazardSource!.hazards.filter(hazard => hazard.kind === "mineHidden");
    assert.ok(hidden.length > 0);
    assert.ok(hidden.every(hazard => hazard.itemIdx === ItemIdx.mine && hazard.radius === 2));
  } finally { release(abyss); }
});

test("trackLocale customItemCube picks the fengshen_dev skin; NaN moving cubes are skipped", async () => {
  const map = await loadMap("fengshen_I03", "item");
  try {
    assert.equal(map.itemCubeSource!.theme, "fengshen_dev");
    assert.equal(map.itemCubeSource!.modelPath, "item/itemCube/fengshen_dev/zz/itemCube.1s");
    const names = map.itemCubeSource!.cubes.map(cube => cube.name);
    assert.equal(names.includes("mo_ic044"), false);
    assert.equal(names.includes("mo_ic040"), true);
    assert.equal(map.admission.ledger.records.filter(record => record.decision === "block").length, 0);
  } finally { release(map); }
});

test("time attack still omits every item object", async () => {
  const { vehicle, host } = await pipeline();
  const map: LoadedMap = await new vehicle.ul(host).loadAssetMap("track_/factory_I03/track.1s", "factory_I03");
  try {
    assert.equal(map.admission.ledger.mode, "time-attack");
    assert.deepEqual(reasons(map), { "cube-loader-omission": 59, "excluded-nonboost-item-runtime": 4 });
    assert.equal("itemCubeSource" in map, false);
  } finally { release(map); }
});

test("the cube field assembles all cubes of factory_I03 into one scene and follows moving cubes", async () => {
  const { library, formats } = await pipeline();
  const map = await loadMap("factory_I03", "item");
  const ops: ItemCubeFieldOps<MirrorLibrary> = {
    createObject: () => new Group() as never,
    originalAsset: (archive, path) => uniqueOriginalCoinAsset(archive, path),
    decodeModel: bytes => formats.y9(bytes) as CubeModelData,
    decodeAudio: () => undefined,
    loadModel: (data, archive, path, identity, options) => formats.c5(data, archive, path, identity, options),
    routeAudio: () => {},
  };
  const fields = await loadItemRaceFields(library, map as never, undefined, ops);
  try {
    assert.ok(fields);
    const { cubes, hazards } = fields;
    assert.equal(cubes.count, 59);
    assert.equal(hazards.count, 4);
    const object = cubes.object as unknown as Group;
    let meshes = 0;
    const buffers = new Set<unknown>();
    object.children[0]!.traverse(node => {
      const mesh = node as unknown as { isMesh?: boolean; geometry?: { attributes: { position: unknown } } };
      if (mesh.isMesh) { meshes += 1; buffers.add(mesh.geometry!.attributes.position); }
    });
    assert.equal(meshes, 59, "one mesh per cube");
    assert.equal(buffers.size, 1, "all cubes share one pooled vertex buffer");

    const conveyor = cubes.cubes.find(cube => cube.name === "mo_itemcube")!;
    map.renderScene.update(2000);
    map.renderScene.update(4000);
    cubes.update(4000);
    const moved = cubes.position(conveyor.id)!;
    const matrix = map.renderScene.clientWorldElements(conveyor.anchor!)!;
    assert.ok(near(moved.x, matrix[12]!) && near(moved.z, -matrix[13]!) && near(moved.y, matrix[14]!));
    assert.ok(moved.x < 400);

    // The local kart drives through the moved cube and through a water mine.
    const objects: ItemPairObject[] = [];
    const kart = { kart: true };
    const world = { queueKartPairObject: (object: ItemPairObject) => objects.push(object),
      isKartPeer: (candidate: unknown) => candidate === kart };
    let position: ItemVec3 = { ...moved };
    const pickups: number[] = [];
    const hits: ItemHazardHit[] = [];
    cubes.attach(world, () => position, () => true, id => pickups.push(id));
    hazards.attach(world, () => position, () => true, hit => hits.push(hit));
    assert.deepEqual(objects.map(object => [object.name, object.category]),
      [["GoItemCube[]", 2], ["GoItemHazard[]", 2]]);
    for (const object of objects) object.slot13(kart, 4001);
    for (const object of objects) object.slot12(4017);
    assert.deepEqual(pickups, [conveyor.id]);
    const mine = hazards.hazards[0]!;
    hazards.update(4017);
    position = hazards.position(mine.id)!;
    for (const object of objects) object.slot13(kart, 4033);
    assert.deepEqual(hits.map(hit => [hit.id, hit.kind, hit.itemIdx]), [[45, "waterMine", ItemIdx.waterMine]]);
    // Staying inside does not re-trigger; leaving and coming back within 3 s does not either.
    for (const object of objects) object.slot13(kart, 4049);
    position = { x: 0, y: 0, z: 0 };
    for (const object of objects) object.slot13(kart, 4065);
    position = hazards.position(mine.id)!;
    for (const object of objects) object.slot13(kart, 5000);
    assert.equal(hits.length, 1);
    position = { x: 0, y: 0, z: 0 };
    for (const object of objects) object.slot13(kart, 7000);
    position = hazards.position(mine.id)!;
    for (const object of objects) object.slot13(kart, 7100);
    assert.equal(hits.length, 2);
  } finally {
    fields?.dispose();
    release(map);
  }
});
