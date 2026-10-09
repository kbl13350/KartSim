import assert from "node:assert/strict";
import test from "node:test";
import type { ItemXmlNode } from "./item-bml";
import { ITEM_RULES, ItemIdx, type ItemCatalog } from "./item-catalog";
import type { ItemTrackModel, ItemTrackObject, ItemVec3 } from "./item-cube-source";
import type { ItemPairObject } from "./item-cubes";
import { createItemHazardField, createItemHazardSource, type ItemHazardHit } from "./item-hazards";

function property(attributes: Record<string, string>): ItemXmlNode {
  return { name: "property", attributes: [], children: [{ name: "object", children: [],
    attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })) }] };
}

function movable(name: string, ordinal: number, attributes: Record<string, string>,
  position = [ordinal * 10, 0, 0]): ItemTrackObject {
  return { kind: "ToMovableObject", name, instanceOrdinal: ordinal, transform: { position },
    property: property(attributes), object: { kind: "node", name } };
}

const radii: Record<number, number> = { [ItemIdx.banana]: 2, [ItemIdx.mine]: 2, [ItemIdx.waterMine]: 10 };
const catalog = { get: (idx: number) => radii[idx] === undefined ? undefined
  : { behaviour: { radius: radii[idx] } } } as unknown as ItemCatalog;

function model(objects: ItemTrackObject[]): ItemTrackModel {
  return { root: { kind: "track", trackObjects: objects } };
}

test("hazard sources read type, radius, model and onlyItemGame from the movables", () => {
  const source = createItemHazardSource(model([
    movable("banana", 1, { type: "banana" }),
    movable("mine", 2, { type: "mine", model: "item01_trans", size: "3.0" }),
    movable("hidden", 3, { type: "mineHidden" }),
    movable("water", 4, { type: "waterMine", onlyItemGame: "true" }),
    movable("jump", 5, { type: "ltejump" }),
    movable("cube", 6, { type: "itemCube" }),
    movable("broken", 7, { type: "banana" }, [Number.NaN, 0, 0]),
    { kind: "ToItemCube", name: "ic", instanceOrdinal: 1, transform: { position: [0, 0, 0] } },
  ]), catalog);
  assert.equal(source.cooldownMs, ITEM_RULES.hazardCooldownMs);
  assert.deepEqual(source.hazards.map(hazard =>
    [hazard.id, hazard.kind, hazard.itemIdx, hazard.radius, hazard.model, hazard.onlyItemGame]), [
    [1, "banana", ItemIdx.banana, 2, undefined, false],
    [2, "mine", ItemIdx.mine, 3, "item01_trans", false],
    [3, "mineHidden", ItemIdx.mine, 2, undefined, false],
    [4, "waterMine", ItemIdx.waterMine, 10, undefined, true],
  ]);
  assert.deepEqual(source.hazards[1]!.position, { x: 20, y: 0, z: -0 });
  assert.throws(() => createItemHazardSource(model([movable("a", 1, { type: "banana" }),
    movable("b", 1, { type: "mine" })]), catalog), /唯一/);
  assert.throws(() => createItemHazardSource(model([movable("a", 1, { type: "mine", size: "big" })]), catalog));
  assert.throws(() => createItemHazardSource(model([{ ...movable("a", 1, { type: "mine" }), object: undefined }]),
    catalog), /嵌套场景/);
  assert.throws(() => createItemHazardSource({ root: { kind: "node", trackObjects: [] } }, catalog));
});

function world() {
  const objects: ItemPairObject[] = [];
  const kart = {};
  return { objects, kart, queueKartPairObject: (object: ItemPairObject) => objects.push(object),
    isKartPeer: (candidate: unknown) => candidate === kart };
}

test("a hazard fires when the local kart enters it, then rests for the cooldown", () => {
  const anchor = { kind: "node" };
  const source = createItemHazardSource(model([
    { ...movable("water", 4, { type: "waterMine" }, [100, 0, 0]), object: anchor },
    movable("banana", 9, { type: "banana" }, [0, 50, 0]),
  ]), catalog);
  const matrix = new Float32Array(16);
  matrix.set([100, 0, 0], 12);
  const field = createItemHazardField(source, node => node === anchor ? matrix : undefined);
  assert.equal(field.count, 2);
  const coordinator = world();
  let kart: ItemVec3 = { x: 0, y: 0, z: 0 };
  let allowed = true;
  const hits: ItemHazardHit[] = [];
  field.attach(coordinator, () => kart, () => allowed, hit => hits.push(hit));
  assert.throws(() => field.attach(coordinator, () => kart, () => true, () => {}));
  const [contact] = coordinator.objects;
  assert.equal(contact!.category, 2);
  const pair = (now: number) => contact!.slot13(coordinator.kart, now);

  kart = { x: 95, y: 0, z: 0 };
  contact!.slot13({}, 10);
  assert.equal(hits.length, 0, "only the local kart pairs");
  pair(20);
  assert.deepEqual(hits, [{ id: 4, itemIdx: ItemIdx.waterMine, kind: "waterMine", position: { x: 100, y: 0, z: -0 } }]);
  pair(40);
  assert.equal(hits.length, 1, "staying inside does not re-fire");
  kart = { x: 0, y: 0, z: 0 };
  pair(60);
  kart = { x: 95, y: 0, z: 0 };
  pair(80);
  assert.equal(hits.length, 1, "re-entering within 3 s does not fire");
  kart = { x: 0, y: 0, z: 0 };
  pair(3000);
  kart = { x: 95, y: 0, z: 0 };
  pair(3020);
  assert.equal(hits.length, 2);

  // Suppressed triggers still track inside/outside: a kart released inside must leave first.
  kart = { x: 0, y: 0, z: 0 };
  pair(7000);
  allowed = false;
  kart = { x: 95, y: 0, z: 0 };
  pair(7020);
  allowed = true;
  pair(7040);
  assert.equal(hits.length, 2);

  // Moving hazards follow their anchor after an update.
  matrix.set([500, 0, 0], 12);
  field.update(8000);
  assert.deepEqual(field.position(4), { x: 500, y: 0, z: -0 });
  kart = { x: 0, y: 0, z: -50 };
  pair(8020);
  assert.deepEqual(hits.at(-1), { id: 9, itemIdx: ItemIdx.banana, kind: "banana", position: { x: 0, y: 0, z: -50 } });
  assert.equal(field.position(99), undefined);
  field.dispose();
  pair(9000);
  assert.equal(hits.length, 3);
});

test("a track without hazards registers no contact", () => {
  const field = createItemHazardField(createItemHazardSource(model([]), catalog), undefined);
  const coordinator = world();
  field.attach(coordinator, () => ({ x: 0, y: 0, z: 0 }), () => true, () => {});
  assert.equal(coordinator.objects.length, 0);
  field.update(0);
});
